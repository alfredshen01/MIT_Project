import io
import os
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import bcrypt
from jose import JWTError, jwt
from PIL import Image, ImageOps
from pydantic import BaseModel
from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:pwd@localhost:5432/mit_project")
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 7

ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

# 轉換後的檔案存放目錄(正式環境由 docker volume 掛載到 /data/files)
UPLOAD_DIR = os.getenv("UPLOAD_DIR", os.path.join(os.path.dirname(__file__), "uploads"))
os.makedirs(UPLOAD_DIR, exist_ok=True)

engine = create_engine(DATABASE_URL)
bearer = HTTPBearer()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "X-File-Id"],
)


# ---------- Models ----------

class UserRegister(BaseModel):
    username: str
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


# ---------- Helpers ----------

def content_disposition(filename: str) -> str:
    # HTTP header 只能用 latin-1;用 RFC 5987 同時給 ASCII fallback 與 UTF-8 原名
    ascii_name = filename.encode("ascii", "ignore").decode() or "file"
    return f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(filename)}"


def create_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRE_DAYS)
    return jwt.encode({"sub": str(user_id), "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)) -> int:
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="無效的 token")
    return user_id


# ---------- Routes ----------

@app.get("/")
def read_root():
    return {"message": "Hello, MIT Project!"}


@app.post("/register", status_code=201)
def register(body: UserRegister):
    hashed = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
    with engine.connect() as conn:
        existing = conn.execute(text("SELECT id FROM users WHERE username=:u"), {"u": body.username}).first()
        if existing:
            raise HTTPException(status_code=400, detail="帳號已被使用")
        conn.execute(
            text("INSERT INTO users (username, hashed_password) VALUES (:u, :h)"),
            {"u": body.username, "h": hashed},
        )
        conn.commit()
    return {"message": "註冊成功"}


@app.post("/login")
def login(body: UserLogin):
    with engine.connect() as conn:
        row = conn.execute(text("SELECT id, hashed_password FROM users WHERE username=:u"), {"u": body.username}).first()
    if not row or not bcrypt.checkpw(body.password.encode(), row.hashed_password.encode()):
        raise HTTPException(status_code=401, detail="帳號或密碼錯誤")
    return {"token": create_token(row.id)}


@app.post("/convert")
async def convert_to_bw(
    file: UploadFile = File(...),
    user_id: int = Depends(get_current_user),
):
    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(status_code=400, detail="只接受圖片檔案（JPEG、PNG、WebP、GIF、BMP）")

    data = await file.read()
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="檔案不能超過 10 MB")

    try:
        img = Image.open(io.BytesIO(data))
        # 先依 EXIF 方向把直式照片轉正,再轉灰階(否則直式會變橫式)
        img = ImageOps.exif_transpose(img).convert("L")
    except Exception:
        raise HTTPException(status_code=400, detail="無法解析圖片，請確認檔案格式正確")

    # 無損 PNG 當主檔存起來(日後可下載無損版),分類為 grayscale
    stored_name = f"{uuid.uuid4().hex}.png"
    img.save(os.path.join(UPLOAD_DIR, stored_name), format="PNG")

    stem = os.path.splitext(file.filename or "image")[0]
    original_name = f"{stem}_bw.png"
    with engine.connect() as conn:
        file_id = conn.execute(
            text("INSERT INTO files (user_id, category, original_name, stored_name) "
                 "VALUES (:user_id, :category, :original_name, :stored_name) RETURNING id"),
            {"user_id": user_id, "category": "grayscale", "original_name": original_name, "stored_name": stored_name},
        ).scalar()
        conn.commit()

    # 回傳有損 JPEG 當預覽:檔案小、顯示快,id 放在 header 供前端下載用
    preview = io.BytesIO()
    img.save(preview, format="JPEG", quality=85)
    preview.seek(0)
    return StreamingResponse(preview, media_type="image/jpeg", headers={"X-File-Id": str(file_id)})


@app.get("/files")
def list_files(category: str, user_id: int = Depends(get_current_user)):
    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT id, original_name, created_at FROM files "
                 "WHERE user_id=:user_id AND category=:category ORDER BY created_at DESC"),
            {"user_id": user_id, "category": category},
        ).mappings().all()
    return [dict(row) for row in rows]


@app.get("/files/{file_id}/download")
def download_file(file_id: int, format: str = "png", user_id: int = Depends(get_current_user)):
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT original_name, stored_name FROM files WHERE id=:id AND user_id=:user_id"),
            {"id": file_id, "user_id": user_id},
        ).first()
    if not row:
        raise HTTPException(status_code=404, detail="檔案不存在")
    path = os.path.join(UPLOAD_DIR, row.stored_name)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="檔案不存在")

    base = os.path.splitext(row.original_name)[0]  # 例如 xxx_bw
    if format in ("jpeg", "jpg"):
        # 從無損主檔即時轉成有損 JPEG(檔案小)
        buf = io.BytesIO()
        Image.open(path).convert("L").save(buf, format="JPEG", quality=92)
        buf.seek(0)
        return StreamingResponse(
            buf,
            media_type="image/jpeg",
            headers={"Content-Disposition": content_disposition(f"{base}.jpg")},
        )
    # 預設:無損 PNG,直接給主檔
    return FileResponse(
        path,
        media_type="image/png",
        headers={"Content-Disposition": content_disposition(f"{base}.png")},
    )


@app.delete("/files/{file_id}")
def delete_file(file_id: int, user_id: int = Depends(get_current_user)):
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT stored_name FROM files WHERE id=:id AND user_id=:user_id"),
            {"id": file_id, "user_id": user_id},
        ).first()
        if not row:
            raise HTTPException(status_code=404, detail="檔案不存在")
        conn.execute(
            text("DELETE FROM files WHERE id=:id AND user_id=:user_id"),
            {"id": file_id, "user_id": user_id},
        )
        conn.commit()
    path = os.path.join(UPLOAD_DIR, row.stored_name)
    if os.path.exists(path):
        os.remove(path)
    return {"message": "已刪除"}

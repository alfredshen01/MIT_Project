import io
import os
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import bcrypt
from jose import JWTError, jwt
from PIL import Image
from pydantic import BaseModel
from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:pwd@localhost:5432/mit_project")
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 7

ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

engine = create_engine(DATABASE_URL)
bearer = HTTPBearer()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


# ---------- Models ----------

class UserRegister(BaseModel):
    username: str
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


# ---------- Auth helpers ----------

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
        img = Image.open(io.BytesIO(data)).convert("L")
    except Exception:
        raise HTTPException(status_code=400, detail="無法解析圖片，請確認檔案格式正確")

    output = io.BytesIO()
    img.save(output, format="PNG")
    output.seek(0)

    # 檔名可能含中文等非 ASCII 字元;HTTP header 只能用 latin-1,
    # 因此用 RFC 5987:ASCII 安全的 filename 當 fallback,filename* 帶 UTF-8 原名
    stem = os.path.splitext(file.filename or "image")[0]
    out_name = f"{stem}_bw.png"
    ascii_name = out_name.encode("ascii", "ignore").decode() or "image_bw.png"
    disposition = f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(out_name)}"
    return StreamingResponse(
        output,
        media_type="image/png",
        headers={"Content-Disposition": disposition},
    )

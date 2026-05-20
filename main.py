import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import bcrypt
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:pwd@localhost:5432/mit_project")
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 7

engine = create_engine(DATABASE_URL)
bearer = HTTPBearer()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Models ----------

class Event(BaseModel):
    title: str
    description: Optional[str] = None
    date: str
    start_time: Optional[str] = None
    end_time: Optional[str] = None


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
        existing = conn.execute(text("SELECT id FROM users WHERE username=:username"), {"username": body.username}).first()
        if existing:
            raise HTTPException(status_code=400, detail="帳號已被使用")
        conn.execute(
            text("INSERT INTO users (username, hashed_password) VALUES (:username, :hashed)"),
            {"username": body.username, "hashed": hashed},
        )
        conn.commit()
    return {"message": "註冊成功"}


@app.post("/login")
def login(body: UserLogin):
    with engine.connect() as conn:
        row = conn.execute(text("SELECT id, hashed_password FROM users WHERE username=:username"), {"username": body.username}).first()
    if not row or not bcrypt.checkpw(body.password.encode(), row.hashed_password.encode()):
        raise HTTPException(status_code=401, detail="帳號或密碼錯誤")
    return {"token": create_token(row.id)}


@app.get("/events")
def get_events(user_id: int = Depends(get_current_user)):
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT * FROM events WHERE user_id=:uid ORDER BY date, start_time"),
            {"uid": user_id},
        )
        rows = result.mappings().all()
    return [dict(row) for row in rows]


@app.post("/events")
def create_event(event: Event, user_id: int = Depends(get_current_user)):
    data = event.model_dump()
    data["start_time"] = data["start_time"] or None
    data["end_time"] = data["end_time"] or None
    data["user_id"] = user_id
    with engine.connect() as conn:
        conn.execute(
            text("INSERT INTO events (title, description, date, start_time, end_time, user_id) "
                 "VALUES (:title, :description, :date, :start_time, :end_time, :user_id)"),
            data,
        )
        conn.commit()
    return {"message": "事件新增成功"}


@app.put("/events/{event_id}")
def update_event(event_id: int, event: Event, user_id: int = Depends(get_current_user)):
    with engine.connect() as conn:
        result = conn.execute(
            text("UPDATE events SET title=:title, description=:description, date=:date, "
                 "start_time=:start_time, end_time=:end_time "
                 "WHERE id=:id AND user_id=:user_id"),
            {**event.model_dump(), "id": event_id, "user_id": user_id},
        )
        conn.commit()
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="事件不存在")
    return {"message": "事件更新成功"}


@app.delete("/events/{event_id}")
def delete_event(event_id: int, user_id: int = Depends(get_current_user)):
    with engine.connect() as conn:
        result = conn.execute(
            text("DELETE FROM events WHERE id=:id AND user_id=:user_id"),
            {"id": event_id, "user_id": user_id},
        )
        conn.commit()
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="事件不存在")
    return {"message": "事件刪除成功"}

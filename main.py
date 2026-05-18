import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, text
from pydantic import BaseModel
from typing import Optional

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:pwd@localhost:5432/mit_project")

engine = create_engine(DATABASE_URL)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class Event(BaseModel):
    title: str
    description: Optional[str] = None
    date: str
    start_time: Optional[str] = None
    end_time: Optional[str] = None


@app.get("/")
def read_root():
    return {"message": "Hello, MIT Project!"}


@app.get("/events")
def get_events():
    with engine.connect() as conn:
        result = conn.execute(text("SELECT * FROM events ORDER BY date, start_time"))
        rows = result.mappings().all()
    return [dict(row) for row in rows]


@app.post("/events")
def create_event(event: Event):
    data = event.model_dump()
    data["start_time"] = data["start_time"] or None
    data["end_time"] = data["end_time"] or None
    with engine.connect() as conn:
        conn.execute(text(
            "INSERT INTO events (title, description, date, start_time, end_time) "
            "VALUES (:title, :description, :date, :start_time, :end_time)"
        ), data)
        conn.commit()
    return {"message": "事件新增成功"}


@app.put("/events/{event_id}")
def update_event(event_id: int, event: Event):
    with engine.connect() as conn:
        result = conn.execute(text(
            "UPDATE events SET title=:title, description=:description, date=:date, "
            "start_time=:start_time, end_time=:end_time WHERE id=:id"
        ), {**event.model_dump(), "id": event_id})
        conn.commit()
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="事件不存在")
    return {"message": "事件更新成功"}


@app.delete("/events/{event_id}")
def delete_event(event_id: int):
    with engine.connect() as conn:
        result = conn.execute(text("DELETE FROM events WHERE id=:id"), {"id": event_id})
        conn.commit()
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="事件不存在")
    return {"message": "事件刪除成功"}

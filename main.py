from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
import json
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")
DATA_FILE = os.path.join(BASE_DIR, "data.json")

app = FastAPI(title="Job Application Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


class JobCreate(BaseModel):
    company: str
    position: str
    applied_date: str
    deadline: Optional[str] = ""
    status: str
    interview_time: Optional[str] = ""
    notes: Optional[str] = ""


class Job(JobCreate):
    id: int


class StatusUpdate(BaseModel):
    status: str


def load_jobs() -> List[dict]:
    if not os.path.exists(DATA_FILE):
        return []
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_jobs(jobs: List[dict]) -> None:
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(jobs, f, ensure_ascii=False, indent=2)


@app.get("/")
def read_index():
    return FileResponse(os.path.join(TEMPLATES_DIR, "index.html"))


@app.get("/jobs", response_model=List[Job])
def get_jobs():
    return load_jobs()


@app.post("/jobs", response_model=Job)
def create_job(job: JobCreate):
    jobs = load_jobs()
    new_id = max([item["id"] for item in jobs], default=0) + 1

    new_job = {
        "id": new_id,
        "company": job.company,
        "position": job.position,
        "applied_date": job.applied_date,
        "deadline": job.deadline or "",
        "status": job.status,
        "interview_time": job.interview_time or "",
        "notes": job.notes or "",
    }

    jobs.append(new_job)
    save_jobs(jobs)
    return new_job


@app.put("/jobs/{job_id}/status")
def update_job_status(job_id: int, payload: StatusUpdate):
    jobs = load_jobs()
    for job in jobs:
        if job["id"] == job_id:
            job["status"] = payload.status
            save_jobs(jobs)
            return {"message": "状态更新成功", "job": job}
    return {"message": "未找到该记录"}


@app.delete("/jobs/{job_id}")
def delete_job(job_id: int):
    jobs = load_jobs()
    new_jobs = [job for job in jobs if job["id"] != job_id]
    save_jobs(new_jobs)
    return {"message": "删除成功"}
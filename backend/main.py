"""FastAPI backend for the Resume Customizer app.

Endpoints:
  POST /api/customize  -> JD text + resume file in, tailored resume JSON out
  GET  /api/health      -> liveness check
"""
from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.llm import LLMError, customize_resume
from app.models import CustomizeResponse
from app.parsers import EmptyResumeText, UnsupportedFileType, extract_text

MAX_UPLOAD_MB = float(os.environ.get("MAX_UPLOAD_MB", "5"))
MIN_JD_LENGTH = 40

app = FastAPI(title="Resume Customizer API", version="1.0.0")

origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/customize", response_model=CustomizeResponse)
async def customize(
    job_description: str = Form(...),
    resume: UploadFile = None,
):
    # --- validate JD ---
    jd = (job_description or "").strip()
    if not jd:
        raise HTTPException(status_code=400, detail="Job description cannot be empty.")
    if len(jd) < MIN_JD_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Job description looks too short (min {MIN_JD_LENGTH} characters). Paste the full JD.",
        )

    # --- validate resume file ---
    if resume is None:
        raise HTTPException(status_code=400, detail="Please attach a resume file (.pdf or .docx).")

    content = await resume.read()
    size_mb = len(content) / (1024 * 1024)
    if size_mb > MAX_UPLOAD_MB:
        raise HTTPException(
            status_code=400,
            detail=f"Resume file is {size_mb:.1f}MB, which exceeds the {MAX_UPLOAD_MB}MB limit.",
        )
    if size_mb == 0:
        raise HTTPException(status_code=400, detail="Uploaded resume file is empty.")

    try:
        resume_text = extract_text(resume.filename or "resume", content)
    except UnsupportedFileType as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except EmptyResumeText as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    # --- call the LLM ---
    try:
        result = customize_resume(job_description=jd, resume_text=resume_text)
    except LLMError as exc:
        raise HTTPException(status_code=502, detail=f"AI customization failed: {exc}") from exc

    return result

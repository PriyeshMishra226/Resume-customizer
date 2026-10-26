"""Pydantic schemas for request/response bodies."""
from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class ExperienceEntry(BaseModel):
    title: str = ""
    company: str = ""
    dates: str = ""
    bullets: List[str] = Field(default_factory=list)


class CustomizedResume(BaseModel):
    summary: str = ""
    skills: List[str] = Field(default_factory=list)
    experience: List[ExperienceEntry] = Field(default_factory=list)
    education: List[str] = Field(default_factory=list)
    certifications: List[str] = Field(default_factory=list)
    projects: List[str] = Field(default_factory=list)
    other_sections: List[str] = Field(
        default_factory=list,
        description="Any resume content that didn't fit the sections above, kept verbatim-ish.",
    )


class CustomizeResponse(BaseModel):
    customized_resume: CustomizedResume
    match_score: int = Field(ge=0, le=100)
    missing_keywords: List[str] = Field(default_factory=list)
    notes: Optional[str] = None
    raw_text: str  # flattened plain-text version, used for .txt download


class ErrorResponse(BaseModel):
    detail: str

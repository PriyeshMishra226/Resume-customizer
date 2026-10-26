"""LLM integration: prompt engineering + call to Gemini, with JSON-mode output."""
from __future__ import annotations

import json
import os
from typing import Any, Dict

from google import genai
from google.genai import types

from .models import CustomizedResume, CustomizeResponse

SYSTEM_PROMPT = """You are an expert technical resume writer and ATS (Applicant \
Tracking System) optimization specialist. You will be given a JOB DESCRIPTION and a \
candidate's ORIGINAL RESUME (plain text, extracted from a PDF/DOCX so formatting may \
be imperfect).

Your job is to tailor the resume to the job description WITHOUT FABRICATING anything. \
Follow these rules strictly:

1. Never invent employers, job titles, dates, degrees, certifications, or skills the \
   candidate does not already have in the original resume. You may rephrase, reorder, \
   and emphasize — never invent facts.
2. Rewrite the summary/objective (2-4 sentences) so it speaks directly to what this \
   JD is asking for, using the candidate's real background.
3. From the candidate's existing skills, list the ones most relevant to the JD first. \
   You may also surface skills that are implied by their experience bullets even if \
   not explicitly listed, but only if clearly supported by the resume text.
4. For each experience entry, reorder and rephrase bullets (do not change employer/ \
   title/dates) so the most JD-relevant achievements lead, using JD keywords \
   naturally where truthful. Keep bullets concise and achievement-oriented.
5. Identify 5-10 important keywords/skills from the JD that are MISSING from the \
   resume — these go in `missing_keywords`, not into the resume body.
6. Compute a `match_score` (0-100) estimating how well the ORIGINAL resume matches \
   this JD, based on skills/experience overlap. Be realistic, not generous.
7. Preserve any resume content that doesn't fit the standard sections (e.g. \
   volunteering, publications, languages) in `other_sections` as short strings, \
   rephrased only lightly.

Return ONLY valid JSON matching exactly this schema (no markdown fences, no prose \
before or after):

{
  "summary": string,
  "skills": string[],
  "experience": [
    {"title": string, "company": string, "dates": string, "bullets": string[]}
  ],
  "education": string[],
  "certifications": string[],
  "projects": string[],
  "other_sections": string[],
  "match_score": integer (0-100),
  "missing_keywords": string[]
}
"""


class LLMError(Exception):
    """Raised when the LLM call fails or returns something we can't use."""


def _get_client() -> tuple[genai.Client, str]:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise LLMError(
            "Server is missing GEMINI_API_KEY. Set it in backend/.env (see .env.example)."
        )
    model_name = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")
    return genai.Client(api_key=api_key), model_name


def customize_resume(job_description: str, resume_text: str) -> CustomizeResponse:
    client, model_name = _get_client()

    user_prompt = (
        f"JOB DESCRIPTION:\n{job_description.strip()}\n\n"
        f"ORIGINAL RESUME:\n{resume_text.strip()}\n\n"
        "Produce the tailored resume JSON now."
    )

    try:
        result = client.models.generate_content(
            model=model_name,
            contents=user_prompt,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                response_mime_type="application/json",
            ),
        )
    except Exception as exc:  # SDK raises various google.genai.errors.APIError subclasses
        raise LLMError(f"LLM request failed: {exc}") from exc

    raw_text = getattr(result, "text", None)
    if not raw_text:
        raise LLMError("LLM returned an empty response.")

    try:
        data: Dict[str, Any] = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise LLMError(f"LLM did not return valid JSON: {exc}") from exc

    try:
        customized = CustomizedResume(
            summary=data.get("summary", ""),
            skills=data.get("skills", []) or [],
            experience=data.get("experience", []) or [],
            education=data.get("education", []) or [],
            certifications=data.get("certifications", []) or [],
            projects=data.get("projects", []) or [],
            other_sections=data.get("other_sections", []) or [],
        )
        match_score = int(data.get("match_score", 0))
        match_score = max(0, min(100, match_score))
        missing_keywords = data.get("missing_keywords", []) or []
    except Exception as exc:
        raise LLMError(f"LLM response didn't match expected schema: {exc}") from exc

    return CustomizeResponse(
        customized_resume=customized,
        match_score=match_score,
        missing_keywords=missing_keywords,
        raw_text=_flatten_to_text(customized),
    )


def _flatten_to_text(r: CustomizedResume) -> str:
    """Render the structured resume as plain text, for the .txt download."""
    lines: list[str] = []

    if r.summary:
        lines += ["SUMMARY", r.summary, ""]

    if r.skills:
        lines += ["SKILLS", ", ".join(r.skills), ""]

    if r.experience:
        lines.append("EXPERIENCE")
        for e in r.experience:
            header = " — ".join(p for p in [e.title, e.company, e.dates] if p)
            if header:
                lines.append(header)
            for b in e.bullets:
                lines.append(f"  • {b}")
            lines.append("")

    if r.education:
        lines += ["EDUCATION"] + r.education + [""]

    if r.certifications:
        lines += ["CERTIFICATIONS"] + r.certifications + [""]

    if r.projects:
        lines += ["PROJECTS"] + r.projects + [""]

    if r.other_sections:
        lines += ["ADDITIONAL"] + r.other_sections + [""]

    return "\n".join(lines).strip() + "\n"

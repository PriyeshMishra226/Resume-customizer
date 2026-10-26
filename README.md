# Resume Customizer

An AI-powered tool that tailors a candidate's resume to a specific job description:
paste a JD, upload a resume (PDF/DOCX), and get back a rewritten, re-prioritized
resume plus a JD match score and a list of missing keywords — viewable in the UI
and downloadable as `.txt` or `.docx`.

## Tech Stack

| Layer    | Technology                                         |
|----------|-----------------------------------------------------|
| Frontend | Next.js 14 (App Router), React, TypeScript, Tailwind CSS |
| Backend  | Python, FastAPI                                     |
| Resume parsing | `pdfplumber` (PDF), `python-docx` (DOCX)      |
| LLM      | Google Gemini, via the `google-genai` SDK            |
| Download | `docx` (npm) for `.docx` generation, client-side     |

## LLM Provider & Model

**Google Gemini**, called through the official `google-genai` Python SDK.
The model is configurable via the `GEMINI_MODEL` env var (default: `gemini-2.0-flash`).
Gemini's free-tier model lineup changes over time — check
[Google AI Studio](https://aistudio.google.com/) for the current free-tier model
name before deploying, and update `GEMINI_MODEL` in `backend/.env` accordingly.

The system prompt (in `backend/app/llm.py`) explicitly instructs the model to:
- never fabricate employers, titles, dates, or skills not present in the original resume
- rewrite the summary to speak to the JD
- reorder/surface the most relevant skills and experience bullets
- list missing JD keywords separately (not inject them into the resume body)
- return a realistic 0–100 match score
- respond in strict JSON (`response_mime_type: application/json`), matching a fixed schema

## Architecture

```
 Next.js Frontend (frontend/)
 - JD textarea
 - Resume upload (drag/choose, PDF or DOCX)
 - Output display + .txt / .docx download
        |
        |  POST /api/customize  (multipart/form-data)
        v
 FastAPI Backend (backend/)
 - app/parsers.py   — extract text from PDF/DOCX
 - app/llm.py       — prompt engineering + Gemini call, JSON parsing
 - app/models.py    — Pydantic request/response schemas
 - main.py          — FastAPI app, validation, error handling, CORS
        |
        |  Gemini API
        v
 Google Gemini (gemini-2.0-flash or configured model)
```

## Setup & Run Locally

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# edit .env and set GEMINI_API_KEY (free key: https://aistudio.google.com/app/apikey)
uvicorn main:app --reload --port 8000
```

Backend runs at `http://localhost:8000`. Interactive API docs at `/docs`.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
# NEXT_PUBLIC_API_URL should point at the backend (http://localhost:8000 for local dev)
npm run dev
```

Frontend runs at `http://localhost:3000`.

## Deployment

- **Frontend → Vercel**: import the repo, set the project root to `frontend/`,
  add env var `NEXT_PUBLIC_API_URL` = your deployed backend URL.
- **Backend → Render** (or Railway): new Web Service, root directory `backend/`,
  build command `pip install -r requirements.txt`, start command
  `uvicorn main:app --host 0.0.0.0 --port $PORT`, add env var `GEMINI_API_KEY`
  (and optionally `GEMINI_MODEL`, `CORS_ORIGINS` set to your Vercel URL).

## Known Limitations / Trade-offs

- **No persistence / auth** — each request is stateless; nothing is saved server-side.
  Scoped out per the assignment (DB/auth are optional bonus items).
- **Scanned/image-only PDFs aren't supported** — `pdfplumber` extracts text layers only,
  no OCR. The API returns a clear 422 error in that case rather than silently failing.
- **Match score and missing-keywords are LLM estimates**, not a deterministic
  ATS-matching algorithm — they're directionally useful, not precise.
- **DOCX download is built client-side** (via the `docx` npm package) rather than
  by the backend, to avoid a second server round-trip; formatting is intentionally
  simple (headings + bullets), not a pixel-perfect resume template.
- **Bonus features implemented:** Match Score, Missing Keywords, `.docx` download.
  **Not implemented** (time-boxed out): diff view, multiple resume versions,
  section-wise customization toggles, cover letter generator, ATS score, auth,
  streaming responses.
- **Prompt engineering is a single-shot JSON-mode call** — no retry/self-correction
  loop if Gemini returns malformed JSON; it surfaces as a 502 with the raw error
  instead of masking the failure.

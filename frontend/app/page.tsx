"use client";

import { useState, useRef } from "react";
import type { CustomizeResponse } from "./types";
import { downloadAsText, downloadAsDocx } from "./lib/downloads";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const MIN_JD_LENGTH = 40;
const MAX_FILE_MB = 5;

type Status = "idle" | "loading" | "success" | "error";

export default function Home() {
  const [jobDescription, setJobDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CustomizeResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const jdTooShort = jobDescription.trim().length > 0 && jobDescription.trim().length < MIN_JD_LENGTH;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (!f) {
      setFile(null);
      return;
    }
    const ext = f.name.toLowerCase();
    if (!ext.endsWith(".pdf") && !ext.endsWith(".docx")) {
      setError("Please upload a .pdf or .docx file.");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`File is too large. Max size is ${MAX_FILE_MB}MB.`);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setError(null);
    setFile(f);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const jd = jobDescription.trim();
    if (!jd) {
      setError("Please paste the job description first.");
      return;
    }
    if (jd.length < MIN_JD_LENGTH) {
      setError(`Job description looks too short (min ${MIN_JD_LENGTH} characters).`);
      return;
    }
    if (!file) {
      setError("Please upload your resume (.pdf or .docx).");
      return;
    }

    setStatus("loading");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("job_description", jd);
      formData.append("resume", file);

      const res = await fetch(`${API_URL}/api/customize`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        let detail = `Request failed (${res.status})`;
        try {
          const body = await res.json();
          if (body?.detail) detail = body.detail;
        } catch {
          /* non-JSON error body, keep default message */
        }
        throw new Error(detail);
      }

      const data: CustomizeResponse = await res.json();
      setResult(data);
      setStatus("success");
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <header className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Resume Customizer</h1>
        <p className="mt-2 text-slate-600">
          Paste a job description, upload your resume, and get an AI-tailored version in seconds.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="jd" className="block text-sm font-medium text-slate-700 mb-1.5">
            Job Description
          </label>
          <textarea
            id="jd"
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            rows={10}
            placeholder="Paste the full job description here..."
            className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm shadow-sm focus:border-brand-600 focus:ring-1 focus:ring-brand-600 outline-none"
          />
          <div className="mt-1 flex justify-between text-xs text-slate-500">
            <span>{jdTooShort ? `Minimum ${MIN_JD_LENGTH} characters` : " "}</span>
            <span>{jobDescription.trim().length} chars</span>
          </div>
        </div>

        <div>
          <label htmlFor="resume" className="block text-sm font-medium text-slate-700 mb-1.5">
            Resume
          </label>
          <div className="flex items-center gap-3">
            <label
              htmlFor="resume"
              className="cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Choose file
            </label>
            <input
              ref={fileInputRef}
              id="resume"
              type="file"
              accept=".pdf,.docx"
              onChange={handleFileChange}
              className="hidden"
            />
            {file ? (
              <span className="text-sm text-slate-600">
                {file.name} &middot; {(file.size / 1024).toFixed(0)} KB
              </span>
            ) : (
              <span className="text-sm text-slate-400">PDF or DOCX, up to {MAX_FILE_MB}MB</span>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "loading" ? "Customizing your resume…" : "Customize Resume"}
        </button>
      </form>

      {result && <ResultView result={result} />}

      <footer className="mt-16 text-center text-xs text-slate-400">
        Powered by Gemini &middot; built with Next.js + FastAPI
      </footer>
    </main>
  );
}

function ResultView({ result }: { result: CustomizeResponse }) {
  const r = result.customized_resume;

  return (
    <section className="mt-10 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <MatchScoreBadge score={result.match_score} />
          <div>
            <div className="text-sm font-medium text-slate-900">JD Match Score</div>
            <div className="text-xs text-slate-500">Estimated fit of your original resume</div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => downloadAsText(result.raw_text)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Download .txt
          </button>
          <button
            onClick={() => downloadAsDocx(r)}
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            Download .docx
          </button>
        </div>
      </div>

      {result.missing_keywords?.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h3 className="text-sm font-semibold text-amber-900">Keywords you might add</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {result.missing_keywords.map((k) => (
              <span
                key={k}
                className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800"
              >
                {k}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        {r.summary && (
          <Section title="Summary">
            <p className="text-sm text-slate-700 leading-relaxed">{r.summary}</p>
          </Section>
        )}

        {r.skills?.length > 0 && (
          <Section title="Skills">
            <p className="text-sm text-slate-700">{r.skills.join(" · ")}</p>
          </Section>
        )}

        {r.experience?.length > 0 && (
          <Section title="Experience">
            <div className="space-y-4">
              {r.experience.map((e, i) => (
                <div key={i}>
                  <div className="text-sm font-semibold text-slate-900">
                    {[e.title, e.company].filter(Boolean).join(" — ")}
                  </div>
                  {e.dates && <div className="text-xs text-slate-500">{e.dates}</div>}
                  <ul className="mt-1.5 list-disc space-y-1 pl-5">
                    {e.bullets?.map((b, j) => (
                      <li key={j} className="text-sm text-slate-700 leading-relaxed">
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Section>
        )}

        {r.education?.length > 0 && (
          <Section title="Education">
            <ul className="space-y-1">
              {r.education.map((ed, i) => (
                <li key={i} className="text-sm text-slate-700">
                  {ed}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {r.certifications?.length > 0 && (
          <Section title="Certifications">
            <ul className="space-y-1">
              {r.certifications.map((c, i) => (
                <li key={i} className="text-sm text-slate-700">
                  {c}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {r.projects?.length > 0 && (
          <Section title="Projects">
            <ul className="space-y-1">
              {r.projects.map((p, i) => (
                <li key={i} className="text-sm text-slate-700">
                  {p}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {r.other_sections?.length > 0 && (
          <Section title="Additional">
            <ul className="space-y-1">
              {r.other_sections.map((o, i) => (
                <li key={i} className="text-sm text-slate-700">
                  {o}
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5 last:mb-0">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h3>
      {children}
    </div>
  );
}

function MatchScoreBadge({ score }: { score: number }) {
  const color =
    score >= 70 ? "bg-emerald-100 text-emerald-700" : score >= 40 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";
  return (
    <div className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold ${color}`}>
      {score}%
    </div>
  );
}

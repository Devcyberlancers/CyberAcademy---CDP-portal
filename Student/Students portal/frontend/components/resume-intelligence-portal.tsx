"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, ChevronDown, Copy, FileText, Loader2, UploadCloud } from "lucide-react";
import { Card } from "@/components/ui";
import { readStudentAccount } from "@/lib/student-account";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
const authTokenStorageKey = "cyber-academy-auth-token";

type ResumeAnalysisResult = {
  score: number;
  ats_score: number;
  grammar_score: number;
  formatting_score: number;
  skills_score: number;
  projects_score: number;
  experience_score: number;
  education_score: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  missing_keywords: string[];
  missing_skills: string[];
  career_roles: string[];
  suggestions: string[];
  roadmap?: ResumeRoadmap;
  quota?: ResumeQuota;
  ai_enhanced?: boolean;
  analysis_mode?: "ai_enhanced" | "deterministic";
};

const ANALYSIS_STEPS = [
  "Uploading resume securely",
  "Extracting readable resume text",
  "Calculating ATS compatibility score",
  "Reviewing formatting, grammar and sections",
  "Checking skills and keyword coverage",
  "Sending extracted resume text for AI suggestions",
  "Building your improvement roadmap",
  "Saving the completed analysis"
];

type ResumeQuota = {
  limit: number;
  used: number;
  remaining: number;
  window_days: number;
  resets_at: string | null;
};

type ResumeRoadmap = {
  current_score: number;
  potential_score: number;
  total_gain: number;
  estimated_time: string;
  deductions: RoadmapDeduction[];
};

type RoadmapDeduction = {
  section: string;
  reason: string;
  lost_points: number;
  suggestion: string;
  current_text: string;
  suggested_text: string;
  potential_gain: number;
  current_score: number;
  max_score: number;
  priority: "high" | "medium" | "low";
  ai_reason?: string;
};

export function ResumeIntelligencePortal() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ResumeAnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [quota, setQuota] = useState<ResumeQuota | null>(null);

  useEffect(() => {
    const token = window.localStorage.getItem(authTokenStorageKey);
    if (!token) return;
    const controller = new AbortController();
    void fetch(`${apiBaseUrl}/api/resume/quota`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(await readErrorMessage(response));
        return response.json() as Promise<ResumeQuota>;
      })
      .then(setQuota)
      .catch((quotaError) => {
        if (quotaError instanceof DOMException && quotaError.name === "AbortError") return;
        setError(quotaError instanceof Error ? quotaError.message : "Resume analysis availability could not be loaded.");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!isAnalyzing) {
      setAnalysisStep(0);
      return;
    }
    const interval = window.setInterval(() => {
      setAnalysisStep((current) => Math.min(current + 1, ANALYSIS_STEPS.length - 1));
    }, 2400);
    return () => window.clearInterval(interval);
  }, [isAnalyzing]);

  const fileLabel = useMemo(() => {
    if (!file) return "Upload a PDF or DOCX resume";
    return `${file.name} • ${(file.size / 1024 / 1024).toFixed(2)} MB`;
  }, [file]);

  async function analyzeResume() {
    setError("");
    setResult(null);
    if (!file) {
      setError("Choose a PDF or DOCX resume first.");
      return;
    }
    if (!/\.(pdf|docx)$/i.test(file.name)) {
      setError("Only PDF and DOCX resumes are supported.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Resume file is too large. Upload a file below 8 MB.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisStep(0);
    try {
      const account = readStudentAccount();
      const form = new FormData();
      form.append("resume", file);
      if (account.email) form.append("email", account.email);
      const token = window.localStorage.getItem(authTokenStorageKey);
      const response = await fetch(`${apiBaseUrl}/api/resume/analyze`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form
      });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }
      const analysis = await response.json() as ResumeAnalysisResult;
      setResult(analysis);
      if (analysis.quota) setQuota(analysis.quota);
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : "Resume analysis failed.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function analyzeSavedProfileResume() {
    setError("");
    setResult(null);
    const account = readStudentAccount();
    if (!account.email) {
      setError("Login email not found. Please sign in again.");
      return;
    }
    setIsAnalyzing(true);
    setAnalysisStep(0);
    try {
      const token = window.localStorage.getItem(authTokenStorageKey);
      const response = await fetch(`${apiBaseUrl}/api/resume/analyze-profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ email: account.email })
      });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }
      const analysis = await response.json() as ResumeAnalysisResult;
      setResult(analysis);
      if (analysis.quota) setQuota(analysis.quota);
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : "Saved resume analysis failed.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f8fc] px-4 py-8 text-[#07142f] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/dashboard/student" className="inline-flex items-center gap-2 text-sm font-medium text-[#3155ff]">
              <ArrowLeft size={17} /> Back to dashboard
            </Link>
            <h1 className="mt-3 text-3xl font-semibold">Resume Intelligence</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
              Upload your resume for deterministic ATS scoring plus AI-powered suggestions. The system analyzes only your extracted resume text and does not rewrite or modify the resume.
            </p>
          </div>
        </div>

        <UploadResumeCard fileLabel={fileLabel} error={error} isAnalyzing={isAnalyzing} analysisStep={analysisStep} quota={quota} onAnalyze={analyzeResume} onAnalyzeSaved={analyzeSavedProfileResume} onFileChange={setFile} />

        <div className="mt-7">
          {result ? <AnalysisResult result={result} /> : <EmptyState />}
        </div>
      </div>
    </main>
  );
}

function UploadResumeCard({
  fileLabel,
  error,
  isAnalyzing,
  analysisStep,
  quota,
  onAnalyze,
  onAnalyzeSaved,
  onFileChange
}: {
  fileLabel: string;
  error: string;
  isAnalyzing: boolean;
  analysisStep: number;
  quota: ResumeQuota | null;
  onAnalyze: () => void;
  onAnalyzeSaved: () => void;
  onFileChange: (file: File | null) => void;
}) {
  return (
    <Card className="rounded-[28px] border-[#dfe7f5] bg-white p-5 shadow-[0_18px_55px_rgba(17,24,74,.10)] sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#eef2ff] text-[#3155ff]">
            <FileText size={26} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#3155ff]">Resume Upload</p>
            <h2 className="mt-1 text-2xl font-semibold text-[#07142f]">Analyze a PDF or DOCX resume</h2>
            <p className="mt-2 text-sm leading-6 text-[#667085]">Upload once and get a score-linked roadmap with exact replacement sentences, ATS deductions, and career guidance.</p>
            <p className="mt-2 text-sm font-semibold text-[#3155ff]">
              {quota
                ? `${quota.remaining} of ${quota.limit} analyses remaining in the current 3-day period${quota.resets_at ? `. Resets ${formatQuotaReset(quota.resets_at)}` : ""}.`
                : "Limit: 2 resume analyses per 3 days."}
            </p>
            {error && (
              <div className="mt-3 flex gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex w-full flex-col gap-3 lg:w-[520px]">
          <label className="flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-[#bfc9dd] bg-[#f8faff] px-4 transition hover:border-[#3155ff] hover:bg-[#f2f5ff]">
            <UploadCloud size={24} className="shrink-0 text-[#3155ff]" />
            <span className="min-w-0 truncate text-sm font-medium text-[#25324b]">{fileLabel}</span>
            <input
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={onAnalyze}
              disabled={isAnalyzing || quota?.remaining === 0}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#3155ff] px-6 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(49,85,255,.25)] transition hover:bg-[#2447f1] disabled:opacity-60"
            >
              {isAnalyzing ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
              {isAnalyzing ? "Analyzing..." : "Analyze Uploaded Resume"}
            </button>
            <button
              type="button"
              onClick={onAnalyzeSaved}
              disabled={isAnalyzing || quota?.remaining === 0}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#cfd7e8] bg-white px-5 text-sm font-semibold text-[#3155ff] transition hover:bg-[#f7f9ff] disabled:opacity-60"
            >
              Use Profile Resume
            </button>
          </div>
          {isAnalyzing ? (
            <div className="rounded-2xl border border-[#dce3f3] bg-[#f8faff] p-4" role="status" aria-live="polite">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[#07142f]">{ANALYSIS_STEPS[analysisStep]}</p>
                <span className="text-xs font-bold text-[#3155ff]">{analysisStep + 1}/{ANALYSIS_STEPS.length}</span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#e1e6f2]">
                <div className="h-full rounded-full bg-[#3155ff] transition-all duration-700" style={{ width: `${Math.min(92, ((analysisStep + 1) / ANALYSIS_STEPS.length) * 100)}%` }} />
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {ANALYSIS_STEPS.map((message, index) => (
                  <div key={message} className={`flex items-center gap-2 text-xs ${index <= analysisStep ? "font-semibold text-[#344054]" : "text-[#98a2b3]"}`}>
                    {index < analysisStep ? <CheckCircle2 size={14} className="shrink-0 text-emerald-600" /> : index === analysisStep ? <Loader2 size={14} className="shrink-0 animate-spin text-[#3155ff]" /> : <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-[#cbd3e3]" />}
                    <span>{message}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-[#667085]">Keep this page open. Analysis continues independently for every signed-in student.</p>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function AnalysisResult({ result }: { result: ResumeAnalysisResult }) {
  const cleanResult = dedupeAnalysisResult(result);
  const scoreCards = [
    ["ATS Score", cleanResult.ats_score],
    ["Formatting", cleanResult.formatting_score],
    ["Grammar", cleanResult.grammar_score],
    ["Projects", cleanResult.projects_score],
    ["Experience", cleanResult.experience_score],
    ["Education", cleanResult.education_score],
    ["Skills", cleanResult.skills_score]
  ] as const;

  return (
    <div className="space-y-7">
      <RoadmapPanel result={cleanResult} />

      <Card className="rounded-[28px] border-[#e0e6f1] bg-white p-6 shadow-[0_16px_48px_rgba(17,24,74,.08)]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-5">
            <CircularScore value={cleanResult.score} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#3155ff]">Secondary Score View</p>
              <h2 className="mt-1 text-2xl font-semibold">Expandable ATS Snapshot</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">{cleanResult.summary || "Resume analysis completed."}</p>
            </div>
          </div>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {scoreCards.map(([label, value]) => <ScoreTile key={label} label={label} value={value} roadmap={cleanResult.roadmap} />)}
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-3">
        <InsightGroup title="Resume Overview" cards={[["Strengths", cleanResult.strengths], ["Weaknesses", cleanResult.weaknesses]]} />
        <InsightGroup title="ATS Optimization" cards={[["Missing Keywords", cleanResult.missing_keywords], ["Missing Skills", cleanResult.missing_skills], ["Improvement Suggestions", cleanResult.suggestions]]} />
        <InsightGroup title="Career Guidance" cards={[["Career Roles", cleanResult.career_roles]]} />
      </div>
    </div>
  );
}

function dedupeAnalysisResult(result: ResumeAnalysisResult): ResumeAnalysisResult {
  const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, " ").replace(/[^\w\s+#.-]/g, "").trim();
  const uniqueList = (items: string[] = []) => {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = normalize(String(item || ""));
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  const seenDeductions = new Set<string>();
  const roadmap = result.roadmap
    ? {
        ...result.roadmap,
        deductions: result.roadmap.deductions.filter((deduction) => {
          const key = [deduction.section, deduction.reason, deduction.current_text, deduction.suggested_text].map((item) => normalize(String(item || ""))).join("|");
          if (seenDeductions.has(key)) return false;
          seenDeductions.add(key);
          return true;
        })
      }
    : result.roadmap;
  return {
    ...result,
    strengths: uniqueList(result.strengths),
    weaknesses: uniqueList(result.weaknesses),
    missing_keywords: uniqueList(result.missing_keywords),
    missing_skills: uniqueList(result.missing_skills),
    career_roles: uniqueList(result.career_roles),
    suggestions: uniqueList(result.suggestions),
    roadmap
  };
}

function RoadmapPanel({ result }: { result: ResumeAnalysisResult }) {
  const roadmap = result.roadmap || {
    current_score: result.score,
    potential_score: result.score,
    total_gain: 0,
    estimated_time: "10-15 Minutes",
    deductions: []
  };
  return (
    <Card className="rounded-2xl border-[#d8e1ff] bg-[linear-gradient(135deg,#ffffff,#f4f7ff)] shadow-[0_18px_48px_rgba(49,85,255,.14)]">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#3155ff]">Action Plan</p>
        <h2 className="mt-2 text-2xl font-semibold">Resume Improvement Roadmap</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#667085]">
          Every card is tied to deterministic ATS deductions. Suggested wording only improves text already found in your resume.
        </p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <RoadmapMetric label="Current Resume Score" value={`${roadmap.current_score} / 100`} tone="blue" />
        <RoadmapMetric label="Potential Resume Score" value={`${roadmap.potential_score} / 100`} tone="green" />
        <RoadmapMetric label="Potential Improvement" value={`+${roadmap.total_gain} Points`} tone="orange" />
        <RoadmapMetric label="Estimated Time" value={roadmap.estimated_time} tone="blue" />
      </div>

      <div className="mt-6 space-y-4">
        {roadmap.deductions.length ? roadmap.deductions.map((deduction, index) => (
          <RoadmapDeductionCard key={`${deduction.section}-${index}`} deduction={deduction} defaultOpen={index < 3} />
        )) : (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">No major ATS deductions detected. Your resume is already in good shape.</div>
        )}
      </div>
    </Card>
  );
}

function RoadmapMetric({ label, value, tone }: { label: string; value: string; tone: "blue" | "green" | "orange" }) {
  const toneClass = tone === "green" ? "text-green-700 bg-green-50" : tone === "orange" ? "text-orange-700 bg-orange-50" : "text-[#3155ff] bg-[#eef2ff]";
  return (
    <div className={`rounded-xl border border-white/70 p-4 shadow-sm ${toneClass}`}>
      <div className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function RoadmapDeductionCard({ deduction, defaultOpen }: { deduction: RoadmapDeduction; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const priorityClass =
    deduction.priority === "high"
      ? "border-red-200 bg-red-50 text-red-700"
      : deduction.priority === "medium"
        ? "border-orange-200 bg-orange-50 text-orange-700"
        : "border-green-200 bg-green-50 text-green-700";
  return (
    <div className="overflow-hidden rounded-2xl border border-[#dfe6ff] bg-white shadow-sm">
      <button type="button" onClick={() => setOpen((current) => !current)} className="flex w-full items-center justify-between gap-4 p-5 text-left">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-lg font-semibold">{deduction.section}</h3>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityClass}`}>{deduction.priority.toUpperCase()}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-[#667085]">
            <span>Current: {deduction.current_score} / {deduction.max_score}</span>
            <span>Potential: {Math.min(deduction.max_score, deduction.current_score + deduction.potential_gain)} / {deduction.max_score}</span>
            <span className="font-semibold text-[#3155ff]">Gain +{deduction.potential_gain}</span>
          </div>
        </div>
        <ChevronDown size={20} className={`shrink-0 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-[#eef2ff] p-5">
          <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <MiniStat label="Current Score" value={`${deduction.current_score} / ${deduction.max_score}`} />
            <MiniStat label="Potential Score" value={`${Math.min(deduction.max_score, deduction.current_score + deduction.potential_gain)} / ${deduction.max_score}`} />
            <MiniStat label="Potential Gain" value={`+${deduction.potential_gain}`} />
            <MiniStat label="Priority" value={deduction.priority.toUpperCase()} />
            <MiniStat label="Lost Points" value={`-${deduction.lost_points}`} />
          </div>

          <div className="mb-5 rounded-xl bg-[#fff7ed] p-4 text-sm text-[#9a3412]">
            <div className="font-semibold">Reason for deduction</div>
            <div className="mt-1">{deduction.reason}</div>
          </div>

          <div className="rounded-2xl border border-[#dfe6ff] bg-[#fbfcff] p-4">
            <div className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-[#3155ff]">Section 1 • Replacement Text</div>
            <div className="grid gap-4 xl:grid-cols-[1fr_auto_1fr] xl:items-stretch">
              <TextBlock title="Current Resume Text" text={deduction.current_text} muted />
              <div className="hidden items-center justify-center text-[#98a2b3] xl:flex">→</div>
              <TextBlock title="Suggested Replacement" text={deduction.suggested_text} />
            </div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <button type="button" onClick={() => void navigator.clipboard?.writeText(deduction.suggested_text)} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#3155ff] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(49,85,255,.22)]">
                <Copy size={15} /> Copy Replacement
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-[#fde7c7] bg-[#fffaf3] p-4">
            <div className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-[#c76a14]">Section 2 • Improvement Suggestions</div>
            <ul className="space-y-2 text-sm leading-6 text-[#7c4a12]">
              {improvementAdvice(deduction).map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#f59e0b]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#edf0f6] bg-[#f8fafc] p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[#667085]">{label}</div>
      <div className="mt-1 text-base font-semibold text-[#07142f]">{value}</div>
    </div>
  );
}

function improvementAdvice(deduction: RoadmapDeduction) {
  const base = [deduction.suggestion, deduction.ai_reason].filter(Boolean) as string[];
  const reason = deduction.reason.toLowerCase();
  if (reason.includes("measurable")) base.push("Add measurable achievements only if your resume already supports the numbers.");
  if (reason.includes("technolog")) base.push("Mention the technologies, tools, or stack already used in this section.");
  if (reason.includes("action")) base.push("Use stronger action verbs such as developed, implemented, analyzed, automated, or secured.");
  if (reason.includes("project")) base.push("Add project scope, workflow, and deployment/context details already present in your work.");
  return Array.from(new Set(base)).slice(0, 5);
}

function TextBlock({ title, text, muted = false, copyable = false }: { title: string; text: string; muted?: boolean; copyable?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${muted ? "border-[#e5e7eb] bg-[#f8fafc]" : "border-[#dbe5ff] bg-[#f7f9ff]"}`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-[#344054]">{title}</h4>
        {copyable && (
          <button type="button" onClick={() => void navigator.clipboard?.writeText(text)} className="inline-flex items-center gap-1 text-xs font-semibold text-[#3155ff]">
            <Copy size={14} /> Copy Suggestion
          </button>
        )}
      </div>
      <p className="whitespace-pre-line text-sm leading-6 text-[#4b5565]">{text}</p>
    </div>
  );
}

function CircularScore({ value }: { value: number }) {
  const normalized = Math.max(0, Math.min(100, value));
  return (
    <div
      className="flex h-44 w-44 items-center justify-center rounded-full"
      style={{ background: `conic-gradient(#3155ff ${normalized * 3.6}deg, #e9eef8 0deg)` }}
    >
      <div className="flex h-36 w-36 flex-col items-center justify-center rounded-full bg-white shadow-inner">
        <span className="text-4xl font-semibold text-[#07142f]">{normalized}</span>
        <span className="text-sm text-[#667085]">Overall Score</span>
      </div>
    </div>
  );
}

function ScoreTile({ label, value, roadmap }: { label: string; value: number; roadmap?: ResumeRoadmap }) {
  const [open, setOpen] = useState(false);
  const sectionDeductions = roadmap?.deductions.filter((deduction) => {
    const normalizedLabel = label.toLowerCase().replace("ats score", "");
    return normalizedLabel ? deduction.section.toLowerCase().includes(normalizedLabel.split(" ")[0]) : true;
  }) || [];
  const lostPoints = sectionDeductions.reduce((sum, deduction) => sum + deduction.lost_points, 0);
  const gain = sectionDeductions.reduce((sum, deduction) => sum + deduction.potential_gain, 0);
  const potential = Math.min(100, Math.round(value + gain * 5));

  return (
    <div className="overflow-hidden rounded-xl border border-[#edf0f6] bg-[#f8faff]">
      <button type="button" onClick={() => setOpen((current) => !current)} className="w-full p-4 text-left">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-[#667085]">{label}</span>
          <span className="flex items-center gap-2 text-lg font-semibold text-[#07142f]">
            {Math.round(value)}
            <ChevronDown size={16} className={`text-[#98a2b3] transition ${open ? "rotate-180" : ""}`} />
          </span>
        </div>
        <div className="mt-3 h-2 rounded-full bg-[#e1e7f2]">
          <div className="h-2 rounded-full bg-[#3155ff]" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
        </div>
      </button>
      {open && (
        <div className="border-t border-[#e6ebf5] bg-white p-4 text-sm">
          <div className="grid gap-2 sm:grid-cols-2">
            <MiniStat label="Current Score" value={`${Math.round(value)} / 100`} />
            <MiniStat label="Lost Points" value={`-${lostPoints}`} />
            <MiniStat label="Potential Score" value={`${potential} / 100`} />
            <MiniStat label="Potential Gain" value={`+${gain}`} />
          </div>
          <div className="mt-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-[#667085]">Reasons</div>
            {sectionDeductions.length ? (
              <ul className="mt-2 space-y-2 text-[#4b5565]">
                {sectionDeductions.map((deduction, index) => (
                  <li key={`${label}-${index}`} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#ef4444]" />
                    <span>{deduction.reason} (-{deduction.lost_points})</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[#667085]">No major deductions for this area.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InsightGroup({ title, cards }: { title: string; cards: Array<[string, string[]]> }) {
  return (
    <Card className="rounded-[24px] border-[#e0e6f1] bg-white p-5 shadow-[0_14px_42px_rgba(17,24,74,.08)]">
      <h3 className="text-xl font-semibold text-[#07142f]">{title}</h3>
      <div className="mt-4 space-y-4">
        {cards.map(([cardTitle, items]) => (
          <div key={cardTitle} className="rounded-2xl border border-[#edf0f6] bg-[#fbfcff] p-4">
            <h4 className="text-sm font-semibold text-[#344054]">{cardTitle}</h4>
            {items.length ? (
              <ul className="mt-3 space-y-2 text-sm leading-6 text-[#4b5565]">
                {items.map((item, index) => (
                  <li key={`${cardTitle}-${index}`} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#3155ff]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-[#8a93a3]">No items reported.</p>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

function InsightCard({ title, items }: { title: string; items: string[] }) {
  return (
    <Card className="rounded-2xl border-[#e0e6f1] bg-white shadow-[0_12px_36px_rgba(17,24,74,.08)]">
      <h3 className="text-lg font-semibold">{title}</h3>
      {items.length ? (
        <ul className="mt-4 space-y-3 text-sm leading-6 text-[#4b5565]">
          {items.map((item, index) => (
            <li key={`${title}-${index}`} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#3155ff]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-[#8a93a3]">No items reported.</p>
      )}
    </Card>
  );
}

function EmptyState() {
  return (
    <Card className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border-[#e0e6f1] bg-white text-center shadow-[0_12px_36px_rgba(17,24,74,.08)]">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#eef2ff] text-[#3155ff]">
        <FileText size={30} />
      </div>
      <h2 className="mt-5 text-xl font-semibold">No resume analyzed yet</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-[#667085]">Upload a PDF or DOCX resume to see deterministic ATS scoring, strengths, missing sections, keyword gaps, role recommendations, and improvement suggestions.</p>
    </Card>
  );
}

async function readErrorMessage(response: Response) {
  try {
    const body = await response.json() as { detail?: unknown; message?: unknown };
    const detail = errorDetail(body.detail ?? body.message);
    if (detail) return detail;
  } catch {
    return `Resume analysis failed with HTTP ${response.status}.`;
  }
  return `Resume analysis failed with HTTP ${response.status}.`;
}

function errorDetail(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(errorDetail).filter(Boolean).join("; ");
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  return errorDetail(record.msg ?? record.message ?? record.detail);
}

function formatQuotaReset(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata"
  }).format(date);
}

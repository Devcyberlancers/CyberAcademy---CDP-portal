"use client";

import { AlertTriangle, CheckCircle2, FileUp, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";
import { importAssessmentQuestions, type ImportedAssessmentQuestion, type QuestionImportResult } from "@/lib/admin-api";

export function QuestionDocumentImporter({ onApply, disabled = false }: {
  onApply: (questions: ImportedAssessmentQuestion[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QuestionImportResult | null>(null);
  const [error, setError] = useState("");

  async function upload(file?: File) {
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      setResult(await importAssessmentQuestions(file));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The question document could not be read.");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return <>
    <label className={`inline-flex h-10 items-center gap-2 rounded-md border border-portal-line px-4 text-sm font-bold text-portal-blue ${disabled || loading ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
      {loading ? <Loader2 size={16} className="animate-spin"/> : <FileUp size={16}/>}
      {loading ? "Reading document..." : "Upload Questions"}
      <input ref={inputRef} type="file" accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown" disabled={disabled || loading} className="hidden" onChange={(event) => void upload(event.target.files?.[0])}/>
    </label>
    {error ? <p className="w-full rounded-md bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</p> : null}
    {result ? <div className="fixed inset-0 z-[150] grid place-items-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="question-import-title">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-portal-line px-6 py-5">
          <div><h2 id="question-import-title" className="text-xl font-bold text-slate-950">Review imported questions</h2><p className="mt-1 text-sm text-slate-500">{result.fileName} · {result.questionCount} question{result.questionCount === 1 ? "" : "s"} recognized</p></div>
          <button type="button" onClick={() => setResult(null)} className="grid h-9 w-9 place-items-center rounded-md border border-portal-line text-slate-600" aria-label="Close import review"><X size={18}/></button>
        </header>
        <div className="overflow-y-auto px-6 py-5">
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p className="flex items-center gap-2 font-bold"><AlertTriangle size={17}/> Admin review required</p><p className="mt-1">Nothing is published automatically. Check every question, answer, option, section, and mark before filling the builder.</p></div>
          {result.warnings.length ? <ul className="mb-4 list-disc rounded-md bg-red-50 py-3 pl-9 pr-4 text-sm text-red-700">{result.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : null}
          <div className="grid gap-3">{result.questions.map((question, index) => <article key={index} className="rounded-lg border border-portal-line p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold text-slate-900">Q{index + 1}. {question.question}</p><span className={`rounded-full px-2 py-1 text-xs font-bold ${question.needsReview ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{question.needsReview ? "Needs review" : "Parsed"}</span></div>
            {question.options.length ? <ol className="mt-3 grid gap-1 text-sm text-slate-600">{question.options.map((option, optionIndex) => <li key={optionIndex}>{String.fromCharCode(65 + optionIndex)}. {option}</li>)}</ol> : null}
            <div className="mt-3 grid gap-1 text-sm"><p><b>Answer:</b> {question.answer || "Not recognized"}</p><p><b>Marks:</b> {question.marks}{question.section ? ` · ${question.section}` : ""}</p>{question.explanation ? <p><b>Explanation:</b> {question.explanation}</p> : null}</div>
          </article>)}</div>
        </div>
        <footer className="flex flex-wrap justify-end gap-3 border-t border-portal-line px-6 py-4">
          <button type="button" onClick={() => setResult(null)} className="h-10 rounded-md border border-portal-line px-5 text-sm font-bold text-slate-700">Cancel</button>
          <button type="button" onClick={() => { onApply(result.questions); setResult(null); }} className="inline-flex h-10 items-center gap-2 rounded-md bg-portal-blue px-5 text-sm font-bold text-white"><CheckCircle2 size={17}/> Fill Builder for Review</button>
        </footer>
      </div>
    </div> : null}
  </>;
}

"use client";

import { AlertTriangle, Mic } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getPreparedProctoringEngine } from "@/lib/proctoring/proctoring-engine";
import { proctoringStreams } from "@/lib/proctoring/media-streams";
import type { ProctoringState } from "@/lib/proctoring/types";

export function ProctoringPreview({ compact = false, enabled = true }: { compact?: boolean; enabled?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<ProctoringState | null>(() => getPreparedProctoringEngine()?.getState() ?? null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const video = videoRef.current;
    const stream = proctoringStreams().camera;
    if (video && stream) { video.srcObject = stream; void video.play(); }
    const unsubscribe = getPreparedProctoringEngine()?.subscribe(setState);
    return () => { unsubscribe?.(); if (video) video.srcObject = null; };
  }, []);
  useEffect(() => {
    if (!state?.phoneWarningDeadline && !state?.multiplePersonWarningDeadline) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [state?.multiplePersonWarningDeadline, state?.phoneWarningDeadline]);
  if (!enabled) return null;

  const seconds = state?.phoneWarningDeadline ? Math.max(0, Math.ceil((state.phoneWarningDeadline - now) / 1000)) : 0;
  const peopleSeconds = state?.multiplePersonWarningDeadline ? Math.max(0, Math.ceil((state.multiplePersonWarningDeadline - now) / 1000)) : 0;
  const activeViolation = state?.phoneDetected ? {
    title: `Mobile phone detected — warning ${Math.min(state.phoneWarningCount, 4)} of 4`,
    count: state.phoneWarningCount,
    seconds,
    activeText: "Remove the phone from the camera view",
    submitText: "The test is being submitted automatically for repeated phone use.",
  } : state?.multiplePersonsDetected ? {
    title: `Multiple people detected — warning ${Math.min(state.multiplePersonWarningCount, 4)} of 4`,
    count: state.multiplePersonWarningCount,
    seconds: peopleSeconds,
    activeText: "Every extra person must leave the camera view; only the test taker may remain",
    submitText: "The test is being submitted automatically after the fourth extra-person violation.",
  } : null;

  return <>
    <aside className={`overflow-hidden rounded-lg border border-slate-700 bg-slate-950 text-white shadow ${compact ? "w-full" : "fixed right-4 top-24 z-[75] w-52"}`} aria-label="Live proctor camera preview">
      <div className="relative aspect-video bg-black">
        <video ref={videoRef} muted playsInline className="h-full w-full object-cover"/>
        <span className="absolute left-2 top-2 rounded bg-red-600 px-2 py-1 text-[10px] font-bold">PROCTORING LIVE</span>
      </div>
      <div className="p-2.5 text-[11px]">
        <div className="flex items-center gap-2"><Mic size={13}/><span>Audio {state?.audioLevel ?? 0}%</span><span className="ml-auto capitalize">{(state?.status ?? "initializing").replace("PROCTORING_", "").toLowerCase()}</span></div>
        <div className="mt-2 h-1 overflow-hidden rounded bg-white/20"><div className="h-full bg-emerald-400 transition-all" style={{ width: `${state?.audioLevel ?? 0}%` }}/></div>
        {state?.phoneDetected ? <p className="mt-2 rounded border border-red-400/40 bg-red-500/20 p-2 font-bold text-red-100">Phone warning {Math.min(state.phoneWarningCount, 4)} / 4</p> : null}
        {state?.multiplePersonsDetected ? <p className="mt-2 rounded border border-red-400/40 bg-red-500/20 p-2 font-bold text-red-100">Extra-person warning {Math.min(state.multiplePersonWarningCount, 4)} / 4</p> : null}
      </div>
    </aside>
    {activeViolation ? <div className="fixed left-1/2 top-5 z-[140] w-[min(92vw,640px)] -translate-x-1/2 rounded-xl border border-red-300 bg-white p-4 text-slate-950 shadow-2xl" role="alert" aria-live="assertive">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-50 text-red-600"><AlertTriangle size={21}/></span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-red-700">{activeViolation.title}</p>
          <p className="mt-1 text-sm leading-5 text-slate-600">{activeViolation.count >= 4 ? activeViolation.submitText : `${activeViolation.activeText} within ${activeViolation.seconds} second${activeViolation.seconds === 1 ? "" : "s"}. Three warnings are allowed; the fourth detection automatically submits the test.`}</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-red-100"><div className="h-full bg-red-600 transition-[width] duration-200" style={{width: `${activeViolation.count >= 4 ? 100 : Math.max(0, Math.min(100, (activeViolation.seconds / 10) * 100))}%`}}/></div>
        </div>
      </div>
    </div> : null}
  </>;
}

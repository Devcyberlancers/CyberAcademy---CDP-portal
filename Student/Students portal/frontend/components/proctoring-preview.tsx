"use client";

import { Mic } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getPreparedProctoringEngine } from "@/lib/proctoring/proctoring-engine";
import { proctoringStreams } from "@/lib/proctoring/media-streams";
import type { ProctoringState } from "@/lib/proctoring/types";

export function ProctoringPreview({ compact = false }: { compact?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<ProctoringState | null>(() => getPreparedProctoringEngine()?.getState() ?? null);
  useEffect(() => {
    const video = videoRef.current;
    const stream = proctoringStreams().camera;
    if (video && stream) { video.srcObject = stream; void video.play(); }
    const unsubscribe = getPreparedProctoringEngine()?.subscribe(setState);
    return () => { unsubscribe?.(); if (video) video.srcObject = null; };
  }, []);
  return <aside className={`overflow-hidden rounded-lg border border-slate-700 bg-slate-950 text-white shadow ${compact ? "w-full" : "fixed right-4 top-24 z-[75] w-52"}`} aria-label="Live proctor camera preview">
    <div className="relative aspect-video bg-black"><video ref={videoRef} muted playsInline className="h-full w-full object-cover"/><span className="absolute left-2 top-2 rounded bg-red-600 px-2 py-1 text-[10px] font-bold">PROCTORING LIVE</span></div>
    <div className="p-2.5 text-[11px]"><div className="flex items-center gap-2"><Mic size={13}/><span>Audio {state?.audioLevel ?? 0}%</span><span className="ml-auto capitalize">{(state?.status ?? "initializing").replace("PROCTORING_", "").toLowerCase()}</span></div><div className="mt-2 h-1 overflow-hidden rounded bg-white/20"><div className="h-full bg-emerald-400 transition-all" style={{ width: `${state?.audioLevel ?? 0}%` }}/></div>{state?.phoneDetected ? <p className="mt-2 rounded bg-red-500/20 p-2 font-bold text-red-200">Phone detected</p> : null}</div>
  </aside>;
}

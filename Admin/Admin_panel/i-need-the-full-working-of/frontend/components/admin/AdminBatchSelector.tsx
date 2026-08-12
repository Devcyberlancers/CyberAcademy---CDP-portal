"use client";

import { useState } from "react";
import { Check, ChevronDown, Layers3, Plus, X } from "lucide-react";
import { useAdminBatch } from "@/lib/admin-batch-context";

export function AdminBatchSelector() {
  const { batches, selectedBatch, busy, createBatch, selectBatch } = useAdminBatch();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function submitNewBatch(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try { await createBatch(name); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Batch could not be created."); }
  }

  return <div className="relative shrink-0">
    <button type="button" onClick={() => setOpen((value) => !value)} className="flex h-11 min-w-[132px] items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 text-left transition hover:border-portal-blue sm:min-w-[185px] sm:gap-3" aria-expanded={open}>
      <span className="flex min-w-0 items-center gap-2"><Layers3 size={18} className="shrink-0 text-portal-blue"/><span className="min-w-0"><span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Selected batch</span><span className="block truncate text-sm font-black text-slate-950">{selectedBatch}</span></span></span>
      <ChevronDown size={17} className={`shrink-0 text-slate-500 transition ${open ? "rotate-180" : ""}`}/>
    </button>
    {open ? <div className="absolute right-0 top-12 z-[70] w-[min(92vw,360px)] overflow-hidden rounded-xl border border-portal-line bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-portal-line px-4 py-3"><div><p className="font-black text-slate-950">Select Batch</p><p className="mt-0.5 text-xs text-slate-500">Switches student data across the admin panel</p></div><button type="button" onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-md hover:bg-slate-100" aria-label="Close batch selector"><X size={17}/></button></div>
      <div className="max-h-64 overflow-y-auto p-2">{batches.map((batch) => <button type="button" disabled={busy} key={batch.name} onClick={() => void selectBatch(batch.name)} className={`flex w-full items-center justify-between rounded-lg px-3 py-3 text-left transition disabled:opacity-50 ${batch.name === selectedBatch ? "bg-blue-50" : "hover:bg-slate-50"}`}><span><span className="block font-bold text-slate-950">{batch.name}</span><span className="mt-0.5 block text-xs text-slate-500">{batch.student_count} student{batch.student_count === 1 ? "" : "s"}</span></span>{batch.name === selectedBatch ? <Check size={18} className="text-portal-blue"/> : null}</button>)}</div>
      <div className="border-t border-portal-line bg-slate-50 p-3">{creating ? <form onSubmit={submitNewBatch} className="space-y-2"><label className="block text-xs font-bold text-slate-700">New batch name</label><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="2027 A" maxLength={40} className="h-10 w-full rounded-md border border-portal-line bg-white px-3 text-sm outline-none focus:border-portal-blue"/><p className="text-[11px] text-slate-500">Year is compulsory; the label may contain letters, words, or numbers.</p>{error ? <p className="text-xs font-bold text-red-600">{error}</p> : null}<div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => { setCreating(false); setError(""); }} className="h-9 rounded-md border bg-white text-xs font-bold text-slate-700">Cancel</button><button type="submit" disabled={busy || !name.trim()} className="h-9 rounded-md bg-portal-blue text-xs font-bold text-white disabled:opacity-50">{busy ? "Creating..." : "Create & Select"}</button></div></form> : <button type="button" onClick={() => setCreating(true)} className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-blue-200 bg-white text-sm font-bold text-portal-blue"><Plus size={16}/>Create New Batch</button>}</div>
    </div> : null}
  </div>;
}

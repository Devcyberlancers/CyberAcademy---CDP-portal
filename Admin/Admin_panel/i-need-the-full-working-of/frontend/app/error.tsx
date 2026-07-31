"use client";

import { useEffect } from "react";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Admin portal page error", error); }, [error]);
  return <main className="grid min-h-screen place-items-center bg-slate-50 p-5 text-center"><div className="max-w-md rounded-2xl bg-white p-8 shadow-sm"><h1 className="text-xl font-bold text-slate-950">This page needs to reload</h1><p className="mt-3 text-sm text-slate-500">The portal can retry without losing saved data.</p><button onClick={reset} className="mt-6 rounded-lg bg-portal-blue px-5 py-3 font-semibold text-white">Try again</button></div></main>;
}

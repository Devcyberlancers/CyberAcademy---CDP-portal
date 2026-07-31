"use client";

import { useEffect } from "react";

export default function StudentError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Student portal page error", error); }, [error]);
  return <main className="grid min-h-screen place-items-center bg-[#f6f8fc] p-5 text-center"><div className="max-w-md rounded-2xl bg-white p-8 shadow-sm"><h1 className="text-xl font-bold text-[#07142f]">This page needs to reload</h1><p className="mt-3 text-sm text-[#657083]">Your data is safe. The portal will retry without ending your session.</p><button onClick={reset} className="mt-6 rounded-lg bg-[#3155ff] px-5 py-3 font-semibold text-white">Try again</button></div></main>;
}

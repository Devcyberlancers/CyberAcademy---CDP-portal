"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Student portal page error", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f8fc] px-5 text-[#07142f]">
      <section className="w-full max-w-lg rounded-3xl border border-[#dfe7f5] bg-white p-8 text-center shadow-xl">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#3155ff]">Cyber Academy</p>
        <h1 className="mt-3 text-2xl font-semibold">This section could not load</h1>
        <p className="mt-3 text-sm leading-6 text-[#667085]">
          Your account data is safe. The service may be temporarily busy or unavailable.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button onClick={reset} className="rounded-xl bg-[#3155ff] px-5 py-3 text-sm font-semibold text-white">
            Try again
          </button>
          <a href="/dashboard/student" className="rounded-xl border border-[#cfd7e8] px-5 py-3 text-sm font-semibold text-[#3155ff]">
            Dashboard
          </a>
        </div>
      </section>
    </main>
  );
}

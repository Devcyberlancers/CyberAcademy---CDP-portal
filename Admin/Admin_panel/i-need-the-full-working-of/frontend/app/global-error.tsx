"use client";

export default function AdminGlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html><body><main style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "Arial, sans-serif" }}><button onClick={reset}>Reload Admin Portal</button></main></body></html>;
}

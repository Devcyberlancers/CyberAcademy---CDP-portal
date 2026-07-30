"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, fontFamily: "Arial, sans-serif", background: "#f6f8fc", color: "#07142f" }}>
          <section style={{ maxWidth: 520, padding: 32, textAlign: "center", border: "1px solid #dfe7f5", borderRadius: 24, background: "white" }}>
            <h1>Cyber Academy is temporarily unavailable</h1>
            <p>Your data is safe. Please retry the page or return to the Student dashboard.</p>
            <button onClick={reset} style={{ marginTop: 16, padding: "12px 20px", border: 0, borderRadius: 12, background: "#3155ff", color: "white", cursor: "pointer" }}>
              Retry
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { STUDENT_EMAIL_DOMAIN } from "@/lib/portal-config";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);

  async function sendResetLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setError("");

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.endsWith(`@${STUDENT_EMAIL_DOMAIN}`)) {
      setError(`Use your official @${STUDENT_EMAIL_DOMAIN} email.`);
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/password-reset/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail })
      });
      if (!response.ok) {
        const message = await readErrorMessage(response);
        throw new Error(message || "Password reset email failed.");
      }
      setStatus("Password reset link sent. Check your email inbox.");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Password reset email failed.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f8fc] px-4">
      <form onSubmit={sendResetLink} className="w-full max-w-md rounded-xl bg-white p-7 shadow-sm">
        <h1 className="text-2xl font-bold text-[#07142f]">Reset Password</h1>
        <p className="mt-2 text-sm leading-6 text-[#6b7280]">Enter your Cyber Lancers email. We will send a secure reset link using the configured SMTP account.</p>
        <label className="mt-6 block text-sm font-semibold text-black">
          Email
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 h-11 w-full rounded-md border border-[#dbe0e9] px-3 outline-none focus:border-[#3155ff]"
            placeholder={`name@${STUDENT_EMAIL_DOMAIN}`}
          />
        </label>
        {status && <p className="mt-4 rounded-md bg-[#e6f8e9] p-3 text-sm font-semibold text-[#1e8d35]">{status}</p>}
        {error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm font-semibold text-red-600">{error}</p>}
        <button type="submit" disabled={isSending} className="mt-5 h-11 w-full rounded-md bg-[#3155ff] text-sm font-semibold text-white disabled:opacity-60">
          {isSending ? "Sending..." : "Send Reset Link"}
        </button>
        <Link href="/" className="mt-4 block text-center text-sm font-semibold text-[#3155ff]">Back to login</Link>
      </form>
    </main>
  );
}

async function readErrorMessage(response: Response) {
  try {
    const body = await response.json();
    if (typeof body?.detail === "string") return body.detail;
  } catch {
    return response.text();
  }
  return response.text();
}

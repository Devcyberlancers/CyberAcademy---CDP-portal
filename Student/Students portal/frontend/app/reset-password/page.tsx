"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

function ResetPasswordForm() {
  const token = useSearchParams().get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setError("");
    if (!token) {
      setError("Reset token is missing.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/password-reset/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: password })
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Password reset failed.");
      }
      setStatus("Password updated. You can sign in now.");
      setPassword("");
      setConfirmPassword("");
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Password reset failed.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-md rounded-xl bg-white p-7 shadow-sm">
      <h1 className="text-2xl font-bold text-[#07142f]">Create New Password</h1>
      <p className="mt-2 text-sm leading-6 text-[#6b7280]">This secure reset link expires in 15 minutes.</p>
      <label className="mt-6 block text-sm font-semibold text-black">
        New password
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          className="mt-2 h-11 w-full rounded-md border border-[#dbe0e9] px-3 outline-none focus:border-[#3155ff]"
          placeholder="Minimum 8 characters"
        />
      </label>
      <label className="mt-4 block text-sm font-semibold text-black">
        Confirm password
        <input
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          type="password"
          className="mt-2 h-11 w-full rounded-md border border-[#dbe0e9] px-3 outline-none focus:border-[#3155ff]"
          placeholder="Re-enter password"
        />
      </label>
      {status && <p className="mt-4 rounded-md bg-[#e6f8e9] p-3 text-sm font-semibold text-[#1e8d35]">{status}</p>}
      {error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm font-semibold text-red-600">{error}</p>}
      <button type="submit" disabled={isSaving} className="mt-5 h-11 w-full rounded-md bg-[#3155ff] text-sm font-semibold text-white disabled:opacity-60">
        {isSaving ? "Saving..." : "Update Password"}
      </button>
      <Link href="/" className="mt-4 block text-center text-sm font-semibold text-[#3155ff]">Back to login</Link>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f8fc] px-4">
      <Suspense fallback={<div className="rounded-xl bg-white p-7 shadow-sm">Loading...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { STUDENT_EMAIL_DOMAIN } from "@/lib/portal-config";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

function ResetPasswordForm() {
  const token = useSearchParams().get("token") || "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const passwordRules = [
    { label: "12 or more characters", valid: password.length >= 12 },
    { label: "One uppercase letter", valid: /[A-Z]/.test(password) },
    { label: "One lowercase letter", valid: /[a-z]/.test(password) },
    { label: "One number", valid: /\d/.test(password) },
    { label: "One special character", valid: /[^A-Za-z0-9]/.test(password) },
    { label: "No spaces", valid: password.length > 0 && !/\s/.test(password) },
  ];
  const strengthScore = passwordRules.filter((rule) => rule.valid).length;
  const isStrong = strengthScore === passwordRules.length;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setError("");
    if (!token) {
      setError("Reset token is missing.");
      return;
    }
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.endsWith(`@${STUDENT_EMAIL_DOMAIN}`)) {
      setError(`Use your official @${STUDENT_EMAIL_DOMAIN} email.`);
      return;
    }
    if (!isStrong) {
      setError("Create a strong password that meets every requirement.");
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
        body: JSON.stringify({ email: cleanEmail, token, new_password: password })
      });
      if (!response.ok) {
        const message = await readErrorMessage(response);
        throw new Error(message || "Password reset failed.");
      }
      setStatus("Password updated successfully.");
      setPassword("");
      setConfirmPassword("");
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Password reset failed.");
    } finally {
      setIsSaving(false);
    }
  }

  if (status) {
    return (
      <section className="w-full max-w-md rounded-xl bg-white p-7 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#e6f8e9] text-sm font-bold text-[#1e8d35]">OK</div>
        <h1 className="mt-5 text-2xl font-bold text-[#07142f]">Password Updated</h1>
        <p className="mt-2 text-sm leading-6 text-[#6b7280]">Your new password is active. Use your Cyberlancers email and new password to sign in.</p>
        <Link href="/" className="mt-6 flex h-11 w-full items-center justify-center rounded-md bg-[#3155ff] text-sm font-semibold text-white">
          Go to Login
        </Link>
      </section>
    );
  }

  return (
    <form onSubmit={submit} className="w-full max-w-md rounded-xl bg-white p-7 shadow-sm">
      <h1 className="text-2xl font-bold text-[#07142f]">Change Password</h1>
      <p className="mt-2 text-sm leading-6 text-[#6b7280]">This secure reset link expires in 15 minutes.</p>
      <label className="mt-6 block text-sm font-semibold text-black">
        Cyberlancers email
        <input
          value={email}
          onChange={(event) => { setEmail(event.target.value); setError(""); }}
          type="email"
          autoComplete="email"
          className="mt-2 h-11 w-full rounded-md border border-[#dbe0e9] px-3 outline-none focus:border-[#3155ff]"
          placeholder={`name@${STUDENT_EMAIL_DOMAIN}`}
        />
      </label>
      <label className="mt-4 block text-sm font-semibold text-black">
        New password
        <input
          value={password}
          onChange={(event) => { setPassword(event.target.value); setError(""); }}
          type="password"
          autoComplete="new-password"
          className="mt-2 h-11 w-full rounded-md border border-[#dbe0e9] px-3 outline-none focus:border-[#3155ff]"
          placeholder="Create a strong password"
        />
      </label>
      <div className="mt-3" aria-live="polite">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span>Password strength</span>
          <span className={isStrong ? "text-[#1e8d35]" : password ? "text-[#b66a00]" : "text-[#6b7280]"}>
            {isStrong ? "Strong" : password ? strengthScore >= 4 ? "Medium" : "Weak" : "Not entered"}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-6 gap-1">
          {passwordRules.map((rule, index) => (
            <span key={rule.label} className={`h-1.5 rounded-full ${index < strengthScore ? isStrong ? "bg-[#1e8d35]" : "bg-[#f59e0b]" : "bg-[#e5e7eb]"}`} />
          ))}
        </div>
        <ul className="mt-3 grid gap-1 text-xs text-[#6b7280] sm:grid-cols-2">
          {passwordRules.map((rule) => (
            <li key={rule.label} className={rule.valid ? "text-[#1e8d35]" : ""}>{rule.valid ? "[x]" : "[ ]"} {rule.label}</li>
          ))}
        </ul>
      </div>
      <label className="mt-4 block text-sm font-semibold text-black">
        Retype new password
        <input
          value={confirmPassword}
          onChange={(event) => { setConfirmPassword(event.target.value); setError(""); }}
          type="password"
          autoComplete="new-password"
          className="mt-2 h-11 w-full rounded-md border border-[#dbe0e9] px-3 outline-none focus:border-[#3155ff]"
          placeholder="Retype your new password"
        />
      </label>
      {confirmPassword && password !== confirmPassword ? <p className="mt-2 text-xs font-semibold text-red-600">Passwords do not match.</p> : null}
      {error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm font-semibold text-red-600">{error}</p>}
      <button type="submit" disabled={isSaving || !isStrong || password !== confirmPassword} className="mt-5 h-11 w-full rounded-md bg-[#3155ff] text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
        {isSaving ? "Saving..." : "Update Password"}
      </button>
      <Link href="/" className="mt-4 block text-center text-sm font-semibold text-[#3155ff]">Back to login</Link>
    </form>
  );
}

async function readErrorMessage(response: Response) {
  try {
    const body = await response.json();
    if (typeof body?.message === "string") return body.message;
    if (Array.isArray(body?.message)) return body.message.join(". ");
  } catch {
    return "Password reset failed.";
  }
  return "Password reset failed.";
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

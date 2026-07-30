"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { IdCard, Mail, UserRound } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const signupSchema = z.object({
  fullName: z.string().min(3, "Enter your full name"),
  cyberlancersId: z.string().min(3, "Enter your Cyberlancers ID"),
  email: z.string().email("Enter the personal email where Admin should send your credentials")
});

type SignupValues = z.infer<typeof signupSchema>;
const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export function SignupForm() {
  const [submitError, setSubmitError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [pendingAccount, setPendingAccount] = useState<SignupValues | null>(null);
  const [otp, setOtp] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<SignupValues>({ resolver: zodResolver(signupSchema) });

  async function onSubmit(values: SignupValues) {
    setSubmitError("");
    setStatusMessage("");
    const cleanEmail = values.email.trim().toLowerCase();
    const response = await fetch(`${apiBaseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: cleanEmail,
        full_name: values.fullName,
        cyberlancers_id: values.cyberlancersId
      })
    });
    if (!response.ok) {
      const message = await response.text();
      setSubmitError(message || "OTP email could not be sent. Check SMTP settings.");
      return;
    }
    setPendingAccount({ ...values, email: cleanEmail });
    setStatusMessage("OTP sent to your personal email. Verify it to submit the registration to Admin.");
  }

  async function verifyOtp() {
    if (!pendingAccount) return;
    setSubmitError("");
    setStatusMessage("");
    setIsVerifying(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingAccount.email, otp: otp.trim() })
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "OTP verification failed.");
      }
      window.location.href = "/?registration=submitted";
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "OTP verification failed.");
    } finally {
      setIsVerifying(false);
    }
  }

  async function resendOtp() {
    if (!pendingAccount) return;
    setSubmitError("");
    setStatusMessage("");
    setIsResending(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingAccount.email })
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "OTP resend failed.");
      }
      setStatusMessage("A new OTP was sent to your email.");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "OTP resend failed.");
    } finally {
      setIsResending(false);
    }
  }

  if (pendingAccount) {
    return (
      <div className="grid gap-4">
        <p className="rounded-md bg-blue-50 p-3 text-sm font-semibold text-[#3155ff]">{statusMessage || `Enter the 6-digit OTP sent to ${pendingAccount.email}.`}</p>
        <label className="grid gap-2 text-sm font-semibold">
          Email OTP
          <input
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
            className="h-11 rounded-md border bg-background px-3 text-center text-xl tracking-[0.4em] outline-none"
            placeholder="000000"
            inputMode="numeric"
          />
        </label>
        <button
          type="button"
          onClick={verifyOtp}
          disabled={isVerifying || otp.length !== 6}
          className="focus-ring h-11 rounded-md bg-primary px-5 font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
        >
          {isVerifying ? "Verifying..." : "Verify & Submit to Admin"}
        </button>
        <button
          type="button"
          onClick={resendOtp}
          disabled={isResending}
          className="h-10 rounded-md border border-[#dbe0e9] text-sm font-semibold text-[#3155ff] disabled:opacity-60"
        >
          {isResending ? "Resending..." : "Resend OTP"}
        </button>
        {submitError && <p className="rounded-md bg-red-50 p-3 text-sm font-semibold text-red-600">{submitError}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
      <label className="grid gap-2 text-sm font-semibold">
        Full name
        <span className="flex items-center gap-2 rounded-md border bg-background px-3">
          <UserRound size={16} className="text-muted-foreground" />
          <input {...register("fullName")} className="h-11 flex-1 bg-transparent outline-none" placeholder="Vikas Kumar" />
        </span>
        {errors.fullName && <span className="text-xs text-red-600">{errors.fullName.message}</span>}
      </label>

      <label className="grid gap-2 text-sm font-semibold">
        Cyberlancers ID
        <span className="flex items-center gap-2 rounded-md border bg-background px-3">
          <IdCard size={16} className="text-muted-foreground" />
          <input {...register("cyberlancersId")} className="h-11 flex-1 bg-transparent outline-none" placeholder="CL24CSE1042" />
        </span>
        {errors.cyberlancersId && <span className="text-xs text-red-600">{errors.cyberlancersId.message}</span>}
      </label>

      <label className="grid gap-2 text-sm font-semibold">
        Personal email
        <span className="flex items-center gap-2 rounded-md border bg-background px-3">
          <Mail size={16} className="text-muted-foreground" />
          <input {...register("email")} className="h-11 flex-1 bg-transparent outline-none" placeholder="your.personal@email.com" type="email" />
        </span>
        {errors.email && <span className="text-xs text-red-600">{errors.email.message}</span>}
      </label>

      <button disabled={isSubmitting} className="focus-ring h-11 rounded-md bg-primary px-5 font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60">
        {isSubmitting ? "Submitting registration..." : "Submit registration"}
      </button>
      {submitError && <p className="rounded-md bg-red-50 p-3 text-sm font-semibold text-red-600">{submitError}</p>}
    </form>
  );
}

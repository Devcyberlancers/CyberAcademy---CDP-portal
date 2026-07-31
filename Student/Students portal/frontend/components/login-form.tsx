"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { buildStudentAccount, fetchStudentProfile, saveStudentAccount } from "@/lib/student-account";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
const authTokenStorageKey = "cyber-academy-auth-token";

const getLoginSchema = () =>
  z.object({
    email: z.string().email(),
    password: z.string().optional()
  });

const getEmailSchema = () => z.string().email();

type LoginValues = {
  email: string;
  password: string;
};

export function LoginForm() {
  const [showPasswordStep, setShowPasswordStep] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const schema = getLoginSchema();
  const { register, handleSubmit, getValues, setError, clearErrors, formState: { errors, isSubmitting } } = useForm<LoginValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" }
  });

  function continueToPassword() {
    const result = getEmailSchema().safeParse(getValues("email"));
    if (!result.success) {
      setError("email", { type: "manual", message: result.error.issues[0]?.message || "Enter a valid email" });
      return;
    }
    clearErrors("email");
    setShowPasswordStep(true);
  }

  const onSubmit = async (values: LoginValues) => {
    if (!showPasswordStep) {
      continueToPassword();
      return;
    }
    if (!values.password || values.password.length < 8) {
      setError("password", { type: "manual", message: "Password must be at least 8 characters" });
      return;
    }
    const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: values.email.trim().toLowerCase(),
        password: values.password
      })
    });
    if (!response.ok) {
      const message = await readErrorMessage(response);
      setError("password", { type: "manual", message: message || "Invalid email or password" });
      return;
    }
    const token = (await response.json()) as { access_token?: string; role?: string };
    if (!token.access_token || !token.role) {
      setError("password", { type: "manual", message: "Login response was incomplete. Please try again." });
      return;
    }
    window.localStorage.setItem(authTokenStorageKey, token.access_token);
    if (token.role === "admin") {
      const adminPortalUrl = process.env.NEXT_PUBLIC_ADMIN_PORTAL_URL ?? "http://localhost:3001";
      window.location.href = `${adminPortalUrl}/auth/callback#token=${encodeURIComponent(token.access_token ?? "")}`;
      return;
    }
    const account = buildStudentAccount(values.email.trim().toLowerCase());
    saveStudentAccount(account);
    try {
      const profile = await fetchStudentProfile(account.email);
      if (profile) saveStudentAccount(profile);
    } catch (error) {
      window.localStorage.removeItem(authTokenStorageKey);
      setError("password", { type: "manual", message: error instanceof Error ? error.message : "Your profile could not be loaded. Please try again." });
      return;
    }
    window.location.href = "/dashboard/student";
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-7">
      <label className="grid gap-3 text-[15px] font-semibold text-[#010816]">
        Email
        {showPasswordStep ? (
          <span className="flex h-[50px] items-center rounded-md border border-[#cfd4dc] bg-white/80 px-4 text-base font-semibold">
            <span className="min-w-0 flex-1 truncate">{getValues("email")}</span>
            <button
              type="button"
              onClick={() => {
                setShowPasswordStep(false);
                clearErrors();
              }}
              className="ml-4 shrink-0 font-semibold text-[#3155ff]"
            >
              Change
            </button>
          </span>
        ) : (
          <input
            {...register("email")}
            className="h-[50px] rounded-md border border-[#cfd4dc] bg-white/80 px-4 text-base outline-none transition focus:border-[#3155ff] focus:ring-2 focus:ring-[#3155ff]/15"
            aria-label="Email"
          />
        )}
        {errors.email && <span className="text-xs text-red-600">{errors.email.message}</span>}
      </label>

      {showPasswordStep && (
        <div className="grid gap-4">
          <label className="grid gap-3 text-[15px] font-semibold text-[#010816]">
            Password
            <input
              {...register("password")}
              type={showPassword ? "text" : "password"}
              className="h-[50px] rounded-md border border-[#cfd4dc] bg-white/80 px-4 text-base outline-none transition focus:border-[#3155ff] focus:ring-2 focus:ring-[#3155ff]/15"
              placeholder="Enter your password"
              autoFocus
            />
            {errors.password && <span className="text-xs text-red-600">{errors.password.message}</span>}
          </label>
          <div className="flex items-center justify-between gap-4 text-[15px]">
            <label className="flex items-center gap-2 font-semibold text-[#010816]">
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(event) => setShowPassword(event.target.checked)}
                className="h-5 w-5 rounded border-[#cfd4dc]"
              />
              Show Password
            </label>
            <Link href="/forgot-password" className="font-medium text-[#3155ff]">Forgot Password?</Link>
          </div>
        </div>
      )}

      <button
        type={showPasswordStep ? "submit" : "button"}
        onClick={showPasswordStep ? undefined : continueToPassword}
        disabled={isSubmitting}
        className="focus-ring h-[50px] rounded-[4px] bg-[#3155ff] px-5 text-lg font-semibold text-white transition hover:bg-[#2447f1] disabled:opacity-60"
      >
        {isSubmitting ? "Verifying..." : showPasswordStep ? "Login" : "Next"}
      </button>

      <Link href="/test-compatibility" className="text-center text-[15px] font-medium text-[#3155ff]">
        System Compatibility Check?
      </Link>
    </form>
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

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, LogIn, UserRound } from "lucide-react";
import { loginStudent } from "@/lib/student-api";

export default function StudentLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await loginStudent(username, password);
      router.push("/student/profile");
    } catch {
      setError("Invalid student credentials or backend is not running.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-portal-bg p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-lg border border-portal-line bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-6">
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-md bg-blue-50 text-portal-blue">
            <UserRound size={25} />
          </div>
          <h1 className="text-2xl font-bold text-slate-950">Student Portal Login</h1>
          <p className="mt-2 text-sm text-slate-500">Use the username and temporary password sent by admin.</p>
        </div>
        <label className="mb-4 block">
          <span className="mb-2 block text-sm font-bold text-slate-700">Username</span>
          <div className="flex h-12 items-center gap-3 rounded-md border border-portal-line px-3">
            <UserRound size={18} className="text-slate-500" />
            <input value={username} onChange={(event) => setUsername(event.target.value)} className="w-full outline-none" />
          </div>
        </label>
        <label className="mb-5 block">
          <span className="mb-2 block text-sm font-bold text-slate-700">Temporary Password</span>
          <div className="flex h-12 items-center gap-3 rounded-md border border-portal-line px-3">
            <Lock size={18} className="text-slate-500" />
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" className="w-full outline-none" />
          </div>
        </label>
        <button disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-portal-blue font-bold text-white">
          <LogIn size={18} />
          {loading ? "Signing in..." : "Sign in"}
        </button>
        {error ? <p className="mt-3 rounded-md bg-red-50 p-3 text-sm font-bold text-red-600">{error}</p> : null}
      </form>
    </main>
  );
}

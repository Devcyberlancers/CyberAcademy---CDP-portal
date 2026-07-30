"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Save, UserRound } from "lucide-react";
import { getStudentProfile, submitStudentProfile } from "@/lib/student-api";

type ProfileForm = {
  name: string;
  email: string;
  phone: string;
  degree: string;
  branch: string;
  batch: string;
  registerNumber: string;
};

const emptyProfile: ProfileForm = {
  name: "",
  email: "",
  phone: "",
  degree: "",
  branch: "",
  batch: "",
  registerNumber: ""
};

export default function StudentProfilePage() {
  const [form, setForm] = useState<ProfileForm>(emptyProfile);
  const [status, setStatus] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStudentProfile()
      .then((profile) => {
        setForm({
          name: profile.name ?? "",
          email: profile.email ?? "",
          phone: profile.phone ?? "",
          degree: profile.degree ?? "",
          branch: profile.branch ?? "",
          batch: profile.batch ?? "",
          registerNumber: profile.register_number ?? ""
        });
        setStatus(profile.profile_status ?? "");
      })
      .catch(() => setNotice("Login again with the credentials sent by admin."))
      .finally(() => setLoading(false));
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setNotice("");
    try {
      const result = await submitStudentProfile({
        name: form.name,
        email: form.email,
        phone: form.phone,
        degree: form.degree,
        branch: form.branch,
        batch: form.batch
      });
      setStatus(result.profile_status ?? "Completed");
      setNotice("Profile submitted. Admin can now approve your account.");
    } catch {
      setNotice("Profile submission failed. Check all fields and try again.");
    }
  }

  function update(key: keyof ProfileForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <main className="min-h-screen bg-portal-bg p-4 sm:p-6">
      <form onSubmit={submit} className="mx-auto max-w-3xl rounded-lg border border-portal-line bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-md bg-blue-50 text-portal-blue">
              <UserRound size={25} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-950">Complete Profile</h1>
              <p className="mt-1 text-sm text-slate-500">Fill these details for admin approval.</p>
            </div>
          </div>
          {status ? (
            <span className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">
              <CheckCircle2 size={16} />
              {status}
            </span>
          ) : null}
        </div>

        {loading ? (
          <p className="rounded-md bg-slate-50 p-4 text-sm font-bold text-slate-600">Loading profile...</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="mb-2 block text-sm font-bold text-slate-700">Registration Number</span>
              <input value={form.registerNumber} disabled className="h-11 w-full rounded-md border border-portal-line bg-slate-50 px-3 text-slate-600" />
            </label>
            <label>
              <span className="mb-2 block text-sm font-bold text-slate-700">Name</span>
              <input value={form.name} onChange={(event) => update("name", event.target.value)} className="h-11 w-full rounded-md border border-portal-line px-3 outline-none focus:border-portal-blue" />
            </label>
            <label>
              <span className="mb-2 block text-sm font-bold text-slate-700">Email</span>
              <input value={form.email} onChange={(event) => update("email", event.target.value)} className="h-11 w-full rounded-md border border-portal-line px-3 outline-none focus:border-portal-blue" />
            </label>
            <label>
              <span className="mb-2 block text-sm font-bold text-slate-700">Phone</span>
              <input value={form.phone} onChange={(event) => update("phone", event.target.value)} className="h-11 w-full rounded-md border border-portal-line px-3 outline-none focus:border-portal-blue" />
            </label>
            <label>
              <span className="mb-2 block text-sm font-bold text-slate-700">Batch</span>
              <input value={form.batch} onChange={(event) => update("batch", event.target.value)} className="h-11 w-full rounded-md border border-portal-line px-3 outline-none focus:border-portal-blue" />
            </label>
            <label>
              <span className="mb-2 block text-sm font-bold text-slate-700">Degree</span>
              <input value={form.degree} onChange={(event) => update("degree", event.target.value)} className="h-11 w-full rounded-md border border-portal-line px-3 outline-none focus:border-portal-blue" />
            </label>
            <label>
              <span className="mb-2 block text-sm font-bold text-slate-700">Branch</span>
              <input value={form.branch} onChange={(event) => update("branch", event.target.value)} className="h-11 w-full rounded-md border border-portal-line px-3 outline-none focus:border-portal-blue" />
            </label>
          </div>
        )}

        {notice ? <p className="mt-4 rounded-md bg-blue-50 p-3 text-sm font-bold text-portal-blue">{notice}</p> : null}
        <div className="mt-6 grid gap-3 sm:flex sm:justify-between">
          <Link href="/student/courses/ethical-hacking/assessment" className="grid h-11 place-items-center rounded-md border border-portal-line px-5 text-sm font-bold text-slate-700">
            Go to Course Assessment
          </Link>
          <button disabled={loading} className="flex h-11 items-center justify-center gap-2 rounded-md bg-portal-blue px-5 text-sm font-bold text-white">
            <Save size={17} />
            Submit Profile
          </button>
        </div>
      </form>
    </main>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, CheckCircle2, Clock3, Loader2, Plus, RefreshCw, Search, X } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { SectionCard } from "@/components/admin/SectionCard";
import { createAdminJob, listAdminJobs, listJobApplicationActivity, type AdminJob, type AdminJobApplicationActivity } from "@/lib/admin-api";

const emptyJob = { company: "", role: "", location: "", job_type: "Full Time", ctc: "", eligibility: "", source_url: "" };

export default function JobsPage() {
  const [activity, setActivity] = useState<AdminJobApplicationActivity[]>([]);
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showJobForm, setShowJobForm] = useState(false);
  const [jobForm, setJobForm] = useState(emptyJob);
  const [savingJob, setSavingJob] = useState(false);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [applicationRows, jobRows] = await Promise.all([listJobApplicationActivity(), listAdminJobs()]);
      setActivity(applicationRows);
      setJobs(jobRows);
      setLastUpdated(new Date());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Admin job activity could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    const refresh = window.setInterval(() => void loadData(), 15_000);
    const clock = window.setInterval(() => setNow(new Date()), 1_000);
    return () => { window.clearInterval(refresh); window.clearInterval(clock); };
  }, []);

  const filteredActivity = useMemo(() => {
    const term = query.trim().toLowerCase();
    return activity.filter((item) => {
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      const matchesSearch = !term || [item.studentName, item.studentEmail, item.registrationNumber, item.jobTitle, item.company].join(" ").toLowerCase().includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [activity, query, statusFilter]);

  const studentHistory = useMemo(() => activity.filter((item) => item.studentId === selectedStudentId), [activity, selectedStudentId]);
  const selectedStudent = studentHistory[0];

  async function createJob() {
    if (!jobForm.company.trim() || !jobForm.role.trim()) return setError("Company and role are required.");
    setSavingJob(true);
    setError("");
    try {
      await createAdminJob(jobForm);
      setJobForm(emptyJob);
      setShowJobForm(false);
      await loadData();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Job could not be created.");
    } finally {
      setSavingJob(false);
    }
  }

  return (
    <AdminShell title="Jobs" subtitle="Live student application tracking from the shared database">
      <div className="grid gap-5">
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">{error}</div> : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-600">
            <Clock3 size={17} /><span>{now.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "medium" })}</span>
            {lastUpdated ? <span className="text-slate-400">· refreshed {relativeTime(lastUpdated, now)}</span> : null}
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => void loadData()} disabled={loading} className="flex h-10 items-center gap-2 rounded-md border border-portal-line bg-white px-4 text-sm font-bold text-portal-blue disabled:opacity-50">{loading ? <Loader2 size={17} className="animate-spin" /> : <RefreshCw size={17} />} Refresh</button>
            <button type="button" onClick={() => setShowJobForm((value) => !value)} className="flex h-10 items-center gap-2 rounded-md bg-portal-blue px-4 text-sm font-bold text-white"><Plus size={17} />{showJobForm ? "Close Form" : "Add Job"}</button>
          </div>
        </div>

        {showJobForm ? <SectionCard title="Add Job">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Field label="Company *" value={jobForm.company} onChange={(company) => setJobForm({ ...jobForm, company })} />
            <Field label="Role *" value={jobForm.role} onChange={(role) => setJobForm({ ...jobForm, role })} />
            <Field label="Location" value={jobForm.location} onChange={(location) => setJobForm({ ...jobForm, location })} />
            <Field label="Job Type" value={jobForm.job_type} onChange={(job_type) => setJobForm({ ...jobForm, job_type })} />
            <Field label="CTC" value={jobForm.ctc} onChange={(ctc) => setJobForm({ ...jobForm, ctc })} />
            <Field label="Source URL" value={jobForm.source_url} onChange={(source_url) => setJobForm({ ...jobForm, source_url })} />
            <label className="md:col-span-2 lg:col-span-3"><span className="mb-1 block text-sm font-bold text-slate-600">Eligibility</span><textarea value={jobForm.eligibility} onChange={(event) => setJobForm({ ...jobForm, eligibility: event.target.value })} className="h-24 w-full rounded-md border border-portal-line p-3" /></label>
          </div>
          <button type="button" onClick={() => void createJob()} disabled={savingJob} className="mt-4 flex h-10 items-center gap-2 rounded-md bg-portal-blue px-5 text-sm font-bold text-white disabled:opacity-50">{savingJob ? <Loader2 size={17} className="animate-spin" /> : <BriefcaseBusiness size={17} />} Save Job</button>
        </SectionCard> : null}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <SectionCard title={`Student Application Activity (${filteredActivity.length})`}>
            <div className="mb-5 grid gap-3 md:grid-cols-[1fr_210px]">
              <label className="flex h-11 items-center gap-3 rounded-md border border-portal-line px-3 text-slate-500"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full outline-none" placeholder="Search student, registration, company, or job" /></label>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-11 rounded-md border border-portal-line px-3 text-sm font-semibold text-slate-700"><option value="all">All applied jobs</option><option value="applied">Applied</option></select>
            </div>
            {loading ? <div className="grid min-h-48 place-items-center text-slate-500"><Loader2 className="animate-spin" /></div> : null}
            {!loading && !filteredActivity.length ? <div className="rounded-lg border border-dashed border-portal-line p-10 text-center text-sm text-slate-500">No matching application activity in MySQL.</div> : null}
            <div className="grid gap-3">
              {filteredActivity.map((item) => <article key={item.id} className="rounded-lg border border-portal-line bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <button type="button" onClick={() => setSelectedStudentId(item.studentId)} className="text-left font-bold text-portal-blue hover:underline">{item.studentName} <span className="font-normal text-slate-500">({item.registrationNumber})</span></button>
                    <p className="mt-1 text-sm text-slate-500">{item.studentEmail}</p>
                    <p className="mt-3 font-semibold text-slate-800">{item.jobTitle} · {item.company}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{formatEventTime(item.changedAt)} · {relativeTime(new Date(item.changedAt), now)}</p>
                  </div>
                  <Status value={item.status} />
                </div>
              </article>)}
            </div>
          </SectionCard>
          <SectionCard title={`Published Jobs (${jobs.length})`}>
            <div className="space-y-3">{jobs.map((job) => <div key={job.id} className="rounded-md border border-portal-line p-4"><p className="font-bold text-slate-950">{job.company}</p><p className="mt-1 text-sm text-slate-600">{job.role}</p><p className="mt-2 text-xs font-semibold text-slate-500">{job.location || "Location not provided"} · {job.ctc || "CTC not provided"}</p></div>)}{!jobs.length && !loading ? <p className="text-sm text-slate-500">No jobs in the database.</p> : null}</div>
          </SectionCard>
        </div>
      </div>

      {selectedStudent ? <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/55 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedStudentId(null); }}>
        <div role="dialog" aria-modal="true" className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-2xl">
          <div className="flex items-start justify-between border-b border-portal-line p-5"><div><h2 className="text-xl font-black text-slate-950">{selectedStudent.studentName}</h2><p className="mt-1 text-sm text-slate-500">{selectedStudent.registrationNumber} · {selectedStudent.studentEmail}</p></div><button type="button" onClick={() => setSelectedStudentId(null)} aria-label="Close job history" className="grid h-9 w-9 place-items-center rounded-md border border-portal-line text-slate-600"><X size={18} /></button></div>
          <div className="max-h-[65vh] overflow-y-auto p-5"><p className="mb-4 text-sm font-bold text-slate-600">{studentHistory.length} recorded job status {studentHistory.length === 1 ? "event" : "events"}</p><div className="space-y-3">{studentHistory.map((item) => <div key={item.id} className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-portal-line p-4"><div><p className="font-bold text-slate-950">{item.jobTitle}</p><p className="mt-1 text-sm text-slate-600">{item.company}</p><p className="mt-2 text-xs font-semibold text-slate-500">{formatEventTime(item.changedAt)} · {relativeTime(new Date(item.changedAt), now)}</p></div><Status value={item.status} /></div>)}</div></div>
        </div>
      </div> : null}
    </AdminShell>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label><span className="mb-1 block text-sm font-bold text-slate-600">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-md border border-portal-line px-3" /></label>;
}

function Status({ value }: { value: string }) {
  const style = value === "applied" ? "bg-emerald-50 text-emerald-700" : value === "pending" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-700";
  return <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold capitalize ${style}`}><CheckCircle2 size={14} />{value.replace("_", " ")}</span>;
}

function formatEventTime(value: string) {
  return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "medium", timeZone: "Asia/Kolkata" });
}

function relativeTime(value: Date, now: Date) {
  const seconds = Math.max(0, Math.floor((now.getTime() - value.getTime()) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

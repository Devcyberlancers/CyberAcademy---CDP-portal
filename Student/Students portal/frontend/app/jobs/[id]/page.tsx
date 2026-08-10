"use client";

import { ArrowLeft, Building2, Calendar, CheckCircle2, ExternalLink, MapPin } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { DashboardShell, type StudentSection } from "@/components/dashboard-shell";
import { defaultStudentAccount, readStudentAccount, type StudentAccount } from "@/lib/student-account";
import { statusForJob, syncJobApplicationsFromDatabase, writeJobApplication, type JobApplicationStatus } from "@/lib/job-applications";
import { rememberRecentJob } from "@/lib/recent-jobs";

type JobDetail = {
  id: number;
  title: string;
  company: string;
  location: string;
  experience: string;
  salary: string;
  employment_type: string;
  skills: string[];
  description: string;
  posted_date: string;
  apply_url: string;
  platform: string;
  company_logo?: string | null;
  match_score: number;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const jobId = Number(params.id);
  const [job, setJob] = useState<JobDetail | null>(null);
  const [status, setStatus] = useState<JobApplicationStatus>("not_applied");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [student, setStudent] = useState<StudentAccount>(defaultStudentAccount);
  const [searchValue, setSearchValue] = useState("");

  useEffect(() => { setStudent(readStudentAccount()); }, []);

  useEffect(() => {
    if (!jobId) return;
    setStatus(statusForJob(jobId));
    void syncJobApplicationsFromDatabase().then((records) => {
      const saved = records[String(jobId)];
      if (saved) setStatus(saved.status);
    });
    const url = new URL(`/api/jobs/${jobId}`, apiBaseUrl);
    fetch(url.toString())
      .then(async (response) => {
        if (!response.ok) throw new Error(await response.text());
        return response.json();
      })
      .then((loadedJob) => {
        const normalizedJob = normalizeJobDetail(loadedJob);
        if (!normalizedJob) throw new Error("Invalid job response");
        setJob(normalizedJob);
        rememberRecentJob({
          id: normalizedJob.id,
          title: normalizedJob.title,
          company: normalizedJob.company
        });
      })
      .catch(() => setError("Unable to load this job. Make sure the backend is running."))
      .finally(() => setIsLoading(false));
  }, [jobId]);

  function applyNow() {
    if (!job) return;
    writeJobApplication({
      jobId: job.id,
      status: "pending",
      updatedAt: new Date().toISOString(),
      title: job.title,
      company: job.company
    });
    setStatus("pending");
    window.open(job.apply_url, "_blank", "noopener,noreferrer");
  }

  function updateStatus(nextStatus: JobApplicationStatus) {
    if (!job) return;
    writeJobApplication({
      jobId: job.id,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
      title: job.title,
      company: job.company
    });
    setStatus(nextStatus);
  }

  return (
    <DashboardShell activeSection="jobs" onSectionChange={(section: StudentSection) => { window.location.href = `/dashboard/student?section=${encodeURIComponent(section)}`; }} searchValue={searchValue} onSearchValueChange={setSearchValue} onSearchSubmit={() => { window.location.href = `/dashboard/student?section=jobs&search=${encodeURIComponent(searchValue.trim())}`; }} student={student}>
    <main className="min-h-screen bg-[#f6f8fc] px-3 py-5 text-[#07142f] sm:px-5 lg:px-7">
      <div className="w-full">
        <Link href="/dashboard/student" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[#3155ff]">
          <ArrowLeft size={16} />
          Back to dashboard
        </Link>

        {isLoading && <Card className="rounded-xl border-0 bg-white p-8 shadow-sm">Loading job details...</Card>}
        {error && <Card className="rounded-xl border-0 bg-white p-8 text-red-600 shadow-sm">{error}</Card>}

        {job && (
          <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
            <Card className="rounded-xl border-0 bg-white p-7 shadow-sm">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-black">{job.title}</h1>
                  <p className="mt-3 flex items-center gap-2 text-base font-semibold text-[#343946]">
                    <Building2 size={18} />
                    {job.company || "Company not listed"}
                  </p>
                </div>
                <StatusBadge status={status} />
              </div>

              <div className="mt-6 grid gap-3 text-sm text-[#5a5f68] sm:grid-cols-2">
                <DetailPill icon={<MapPin size={16} />} label={job.location || "Location not provided"} />
                <DetailPill icon={<Calendar size={16} />} label={job.posted_date || "Recently fetched"} />
                <DetailPill label={job.experience || "Fresher / Entry Level"} />
                <DetailPill label={job.employment_type || "Full Time"} />
                {job.salary && <DetailPill label={job.salary} />}
                <DetailPill label={`Match Score: ${Math.round(job.match_score || 0)}%`} />
              </div>

              {job.skills.length > 0 && (
                <div className="mt-7">
                  <h2 className="font-bold text-black">Skills</h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {job.skills.map((skill) => (
                      <span key={skill} className="rounded-full bg-[#eef2ff] px-3 py-1.5 text-xs font-semibold text-[#3155ff]">{skill}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-7">
                <h2 className="font-bold text-black">Job Description</h2>
                <p className="mt-3 whitespace-pre-line text-sm leading-7 text-[#5a5f68]">{job.description || "No description was provided by the source."}</p>
              </div>
            </Card>

            <Card className="h-fit rounded-xl border-0 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-black">Application</h2>
              <p className="mt-2 text-sm leading-6 text-[#5a5f68]">
                Open the official job portal, apply there, then return here or to the dashboard to update your status.
              </p>
              <button
                type="button"
                onClick={applyNow}
                disabled={!job.apply_url}
                className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#3155ff] px-5 text-sm font-semibold text-white disabled:opacity-60"
              >
                Apply Now <ExternalLink size={16} />
              </button>
              {status === "pending" && (
                <div className="mt-4 grid gap-2">
                  <button type="button" onClick={() => updateStatus("applied")} className="rounded-md bg-[#e6f8e9] px-4 py-2 text-sm font-semibold text-[#1e8d35]">Mark as Applied</button>
                  <button type="button" onClick={() => updateStatus("not_applied")} className="rounded-md border border-[#dbe0e9] px-4 py-2 text-sm font-semibold text-[#07142f]">Not Applied</button>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </main>
    </DashboardShell>
  );
}

function normalizeJobDetail(value: unknown): JobDetail | null {
  if (!value || typeof value !== "object") return null;
  const job = value as Record<string, unknown>;
  const id = numberField(job.id);
  const title = stringField(job.title);
  if (!id || !title.trim()) return null;

  return {
    id,
    title,
    company: stringField(job.company),
    location: stringField(job.location),
    experience: stringField(job.experience),
    salary: stringField(job.salary),
    employment_type: stringField(job.employment_type ?? job.employmentType),
    skills: skillsField(job.skills),
    description: stringField(job.description),
    posted_date: stringField(job.posted_date ?? job.postedDate),
    apply_url: stringField(job.apply_url ?? job.applyUrl),
    platform: stringField(job.platform),
    company_logo: nullableStringField(job.company_logo ?? job.companyLogo),
    match_score: numberField(job.match_score ?? job.matchScore)
  };
}

function stringField(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function nullableStringField(value: unknown) {
  const clean = stringField(value).trim();
  return clean || null;
}

function numberField(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

function skillsField(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => stringField(item).trim()).filter(Boolean);
  return stringField(value).split(",").map((item) => item.trim()).filter(Boolean);
}

function DetailPill({ icon, label }: { icon?: React.ReactNode; label: string }) {
  return (
    <div className="flex min-h-11 items-center gap-2 rounded-md border border-[#e5e8f0] px-3 py-2">
      {icon}
      <span>{label}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: JobApplicationStatus }) {
  if (status === "applied") {
    return <span className="inline-flex items-center gap-2 rounded-md bg-[#e6f8e9] px-3 py-2 text-sm font-semibold text-[#1e8d35]"><CheckCircle2 size={16} /> Applied</span>;
  }
  if (status === "pending") {
    return <span className="rounded-md bg-[#fff3d7] px-3 py-2 text-sm font-semibold text-[#9a6500]">Confirm after applying</span>;
  }
  return <span className="rounded-md bg-[#e7ebf5] px-3 py-2 text-sm font-semibold text-[#001e72]">Not Applied</span>;
}

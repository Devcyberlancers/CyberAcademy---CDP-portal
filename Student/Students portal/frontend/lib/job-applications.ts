export type JobApplicationStatus = "not_applied" | "pending" | "applied";

export type JobApplicationRecord = {
  jobId: number;
  status: JobApplicationStatus;
  updatedAt: string;
  title?: string;
  company?: string;
};

export type AppliedJobRecord = {
  applicationId: number;
  jobId: number;
  title: string;
  company: string;
  location: string;
  appliedAt: string;
};

export const jobApplicationStorageKey = "cyber-academy-job-applications";
export const pendingApplicationTimeoutMs = 5 * 60 * 1000;
const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export function readJobApplications(): Record<string, JobApplicationRecord> {
  if (typeof window === "undefined") return {};
  try {
    const stored = window.localStorage.getItem(jobApplicationStorageKey);
    return stored ? (JSON.parse(stored) as Record<string, JobApplicationRecord>) : {};
  } catch {
    return {};
  }
}

export function writeJobApplication(record: JobApplicationRecord) {
  const current = readJobApplications();
  current[String(record.jobId)] = record;
  window.localStorage.setItem(jobApplicationStorageKey, JSON.stringify(current));
  const student = readStudentAccount();
  markStudentPortalUpdated(student.email, record.updatedAt);
  if (student.email) {
    void fetch(`${apiBaseUrl}/api/jobs/${record.jobId}/application-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: student.email, status: record.status })
    }).catch(() => undefined);
  }
}

export async function syncJobApplicationsFromDatabase() {
  const student = readStudentAccount();
  const current = readJobApplications();
  if (!student.email) return current;
  try {
    const url = new URL("/api/jobs/application-statuses", apiBaseUrl);
    url.searchParams.set("email", student.email);
    const response = await fetch(url.toString(), { cache: "no-store" });
    if (!response.ok) return current;
    const rows = (await response.json()) as Array<{ jobId: number; status: JobApplicationStatus; updatedAt: string }>;
    for (const row of rows) {
      const existing = current[String(row.jobId)];
      current[String(row.jobId)] = { ...existing, jobId: row.jobId, status: row.status, updatedAt: row.updatedAt };
    }
    window.localStorage.setItem(jobApplicationStorageKey, JSON.stringify(current));
  } catch {
    // Keep the local cache available while the backend is temporarily offline.
  }
  return current;
}

export async function loadAppliedJobs(): Promise<AppliedJobRecord[]> {
  const student = readStudentAccount();
  if (!student.email) return [];
  const url = new URL("/api/jobs/applied", apiBaseUrl);
  url.searchParams.set("email", student.email);
  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) throw new Error("Applied jobs could not be loaded.");
  return response.json() as Promise<AppliedJobRecord[]>;
}

export function statusForJob(jobId?: number) {
  if (!jobId) return "not_applied" as JobApplicationStatus;
  const record = readJobApplications()[String(jobId)];
  if (!record) return "not_applied" as JobApplicationStatus;
  if (record.status === "pending" && Date.now() - new Date(record.updatedAt).getTime() > pendingApplicationTimeoutMs) {
    const expired = { ...record, status: "not_applied" as JobApplicationStatus, updatedAt: new Date().toISOString() };
    writeJobApplication(expired);
    return expired.status;
  }
  return record.status;
}

export function pendingJobApplications() {
  const now = Date.now();
  const current = readJobApplications();
  const pending: JobApplicationRecord[] = [];

  for (const record of Object.values(current)) {
    if (record.status !== "pending") continue;
    if (now - new Date(record.updatedAt).getTime() > pendingApplicationTimeoutMs) {
      current[String(record.jobId)] = { ...record, status: "not_applied", updatedAt: new Date().toISOString() };
    } else {
      pending.push(record);
    }
  }

  window.localStorage.setItem(jobApplicationStorageKey, JSON.stringify(current));
  return pending;
}
import { markStudentPortalUpdated, readStudentAccount } from "@/lib/student-account";

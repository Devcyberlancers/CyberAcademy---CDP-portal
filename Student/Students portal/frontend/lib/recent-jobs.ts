export type RecentJobRecord = {
  id: number;
  title: string;
  company: string;
  openedAt: string;
};

const recentJobsKey = "cyber-academy-recent-jobs";
const maxRecentJobs = 20;

export function readRecentJobs(): RecentJobRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(recentJobsKey) || "[]") as RecentJobRecord[];
    return Array.isArray(parsed) ? parsed.filter((job) => job.id && job.title) : [];
  } catch {
    return [];
  }
}

export function rememberRecentJob(job: Omit<RecentJobRecord, "openedAt">) {
  if (typeof window === "undefined") return;
  const openedAt = new Date().toISOString();
  const existing = readRecentJobs().filter((item) => item.id !== job.id);
  window.localStorage.setItem(recentJobsKey, JSON.stringify([{ ...job, openedAt }, ...existing].slice(0, maxRecentJobs)));
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bookmark, Calendar, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ClipboardCheck, Filter, IdCard, Loader2, MapPin, RefreshCw, Search, ShieldCheck, Sparkles, TerminalSquare, UserRound } from "lucide-react";
import { DashboardShell, type StudentSection } from "@/components/dashboard-shell";
import { Card } from "@/components/ui";
import {
  defaultStudentAccount,
  fetchStudentProfile,
  readStudentAccount,
  studentPortalUpdatedEvent,
  type StudentAccount
} from "@/lib/student-account";
import {
  pendingJobApplications,
  loadAppliedJobs,
  readJobApplications,
  statusForJob,
  syncJobApplicationsFromDatabase,
  writeJobApplication,
  type JobApplicationRecord,
  type JobApplicationStatus,
  type AppliedJobRecord
} from "@/lib/job-applications";
import { readRecentJobs, type RecentJobRecord } from "@/lib/recent-jobs";
import { formatTimer } from "@/lib/assessment-timer";
import { saveAnswer, syncQueuedAnswers } from "@/lib/auto-save";
import { detectDevice, violationText, type SecureAssessmentSummary, type SecureAttempt } from "@/lib/assessment-security";
import { enterFullscreen, exitFullscreen } from "@/lib/fullscreen-manager";
import { installKeyboardBlocker } from "@/lib/keyboard-blocker";
import { installViolationMonitor } from "@/lib/violation-monitor";

type ExternalJob = {
  id?: number;
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
  company_logo: string | null;
  platform: string;
  match_score: number;
  is_entry_level: boolean;
  created_at?: string;
};

type RawExternalJob = Record<string, unknown>;

type ActivityMap = Record<string, number>;

type StudentStatistics = {
  courses: { total: number; completed: number; active: number; average_completion: number };
  assessments: {
    total: number;
    attempts: number;
    completed: number;
    average_score: number;
    questions_total: number;
    questions_answered: number;
    questions_correct: number;
    questions_incorrect: number;
    duration_seconds: number;
  };
  jobs: { available: number; applied: number };
  last_activity: string | null;
};

const emptyStudentStatistics: StudentStatistics = {
  courses: { total: 0, completed: 0, active: 0, average_completion: 0 },
  assessments: { total: 0, attempts: 0, completed: 0, average_score: 0, questions_total: 0, questions_answered: 0, questions_correct: 0, questions_incorrect: 0, duration_seconds: 0 },
  jobs: { available: 0, applied: 0 },
  last_activity: null
};

const jobPlatforms = ["naukri", "linkedin", "indeed", "foundit", "wellfound"];
const defaultJobLocations = [
  "Bengaluru",
  "Hyderabad",
  "Chennai",
  "Pune",
  "Mumbai",
  "Delhi NCR",
  "Gurugram",
  "Noida",
  "Kolkata",
  "Ahmedabad",
  "Coimbatore",
  "Kochi",
  "Trivandrum",
  "Indore",
  "Jaipur",
  "Remote",
  "India"
];
const demoCybersecurityCourses = [
  {
    title: "Cybersecurity Foundations",
    description: "Network basics, security controls, CIA triad, threat types, and safe system hardening for beginners.",
    icon: ShieldCheck,
    color: "bg-[#002779]",
    assessments: 8,
    labs: 6,
    progress: 0,
    start: "Self paced",
    end: "Beginner"
  },
  {
    title: "SOC Analyst Fresher Track",
    description: "Hands-on alert triage, SIEM dashboards, log investigation, incident notes, and escalation workflows.",
    icon: TerminalSquare,
    color: "bg-[#3155ff]",
    assessments: 10,
    labs: 12,
    progress: 0,
    start: "Live practice",
    end: "Job ready"
  },
  {
    title: "Ethical Hacking Essentials",
    description: "Reconnaissance, vulnerability scanning, web security basics, Linux tools, and responsible reporting.",
    icon: IdCard,
    color: "bg-[#92008d]",
    assessments: 7,
    labs: 10,
    progress: 0,
    start: "Practical",
    end: "Portfolio"
  },
  {
    title: "Cloud Security Basics",
    description: "IAM, storage security, cloud logging, secure configuration checks, and beginner cloud threat models.",
    icon: ShieldCheck,
    color: "bg-[#48b844]",
    assessments: 6,
    labs: 8,
    progress: 0,
    start: "Cloud labs",
    end: "Associate"
  },
  {
    title: "Python for Security",
    description: "Automation scripts for log parsing, IOC checks, API calls, password auditing, and simple scanners.",
    icon: TerminalSquare,
    color: "bg-[#002779]",
    assessments: 5,
    labs: 14,
    progress: 0,
    start: "Coding",
    end: "Automation"
  },
  {
    title: "GRC and Security Compliance",
    description: "Risk registers, policies, ISO 27001 basics, audits, evidence collection, and fresher GRC workflows.",
    icon: ClipboardCheck,
    color: "bg-[#3155ff]",
    assessments: 4,
    labs: 5,
    progress: 0,
    start: "Theory",
    end: "Governance"
  },
  {
    title: "Network Security and Firewalls",
    description: "Network defense fundamentals and firewall policy practice.",
    icon: ShieldCheck,
    color: "bg-[#48b844]",
    assessments: 9,
    labs: 11,
    progress: 0,
    start: "Self paced",
    end: "Intermediate"
  },
  {
    title: "Web Application Security",
    description: "OWASP-focused web security labs and secure testing workflows.",
    icon: TerminalSquare,
    color: "bg-[#92008d]",
    assessments: 12,
    labs: 16,
    progress: 0,
    start: "Practical",
    end: "Intermediate"
  },
  {
    title: "Linux for Cybersecurity",
    description: "Linux administration and command-line skills for analysts.",
    icon: TerminalSquare,
    color: "bg-[#002779]",
    assessments: 6,
    labs: 18,
    progress: 0,
    start: "Lab based",
    end: "Beginner"
  },
  {
    title: "Digital Forensics Fundamentals",
    description: "Evidence handling, disk analysis, and investigation basics.",
    icon: IdCard,
    color: "bg-[#3155ff]",
    assessments: 8,
    labs: 9,
    progress: 0,
    start: "Guided",
    end: "Intermediate"
  },
  {
    title: "Incident Response Essentials",
    description: "Triage, containment, recovery, and incident documentation.",
    icon: ShieldCheck,
    color: "bg-[#e25822]",
    assessments: 7,
    labs: 10,
    progress: 0,
    start: "Scenario based",
    end: "Job ready"
  },
  {
    title: "Threat Intelligence Analyst",
    description: "IOC enrichment, threat research, and intelligence reporting.",
    icon: ClipboardCheck,
    color: "bg-[#3155ff]",
    assessments: 10,
    labs: 8,
    progress: 0,
    start: "Self paced",
    end: "Associate"
  },
  {
    title: "SIEM with Splunk Basics",
    description: "Search, dashboards, alerts, and security log analysis.",
    icon: TerminalSquare,
    color: "bg-[#48b844]",
    assessments: 9,
    labs: 15,
    progress: 0,
    start: "Hands on",
    end: "Job ready"
  },
  {
    title: "Microsoft Sentinel Fundamentals",
    description: "Cloud SIEM operations, analytics rules, and investigation.",
    icon: ShieldCheck,
    color: "bg-[#002779]",
    assessments: 7,
    labs: 12,
    progress: 0,
    start: "Cloud labs",
    end: "Associate"
  },
  {
    title: "Vulnerability Assessment and VAPT",
    description: "Scanning, validation, prioritization, and security reporting.",
    icon: IdCard,
    color: "bg-[#92008d]",
    assessments: 11,
    labs: 17,
    progress: 0,
    start: "Practical",
    end: "Advanced"
  },
  {
    title: "API Security Testing",
    description: "Authentication, authorization, and API vulnerability testing.",
    icon: TerminalSquare,
    color: "bg-[#e25822]",
    assessments: 6,
    labs: 13,
    progress: 0,
    start: "Hands on",
    end: "Intermediate"
  },
  {
    title: "Secure Coding Practices",
    description: "Common coding weaknesses and defensive development patterns.",
    icon: TerminalSquare,
    color: "bg-[#3155ff]",
    assessments: 8,
    labs: 14,
    progress: 0,
    start: "Coding",
    end: "Intermediate"
  },
  {
    title: "AWS Cloud Security",
    description: "AWS identity, logging, network, and workload protection.",
    icon: ShieldCheck,
    color: "bg-[#48b844]",
    assessments: 10,
    labs: 12,
    progress: 0,
    start: "Cloud labs",
    end: "Associate"
  },
  {
    title: "Cybersecurity Interview Preparation",
    description: "Technical interviews, scenario questions, and resume practice.",
    icon: ClipboardCheck,
    color: "bg-[#002779]",
    assessments: 15,
    labs: 4,
    progress: 0,
    start: "Placement",
    end: "Job ready"
  },
  {
    title: "SOC Analyst Mock Assessments",
    description: "Timed SOC, SIEM, networking, and incident-response tests.",
    icon: ClipboardCheck,
    color: "bg-[#92008d]",
    assessments: 20,
    labs: 6,
    progress: 0,
    start: "Assessment",
    end: "Job ready"
  }
];
// Legacy shapes are retained for type compatibility only; visible courses come from MySQL.
const cybersecurityCourses = demoCybersecurityCourses.slice(0, 0);
const activityStorageKey = "cyber-academy-daily-activity";
const lastUpdatedStorageKey = "cyber-academy-last-updated";
const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
const dashboardBannerVariants = ["campus", "dunes", "night", "hills"] as const;

export function StudentPortal() {
  const [section, setSection] = useState<StudentSection>("dashboard");
  const [searchValue, setSearchValue] = useState("");
  const [student, setStudent] = useState<StudentAccount>(defaultStudentAccount);
  const [pendingApplications, setPendingApplications] = useState<JobApplicationRecord[]>([]);
  const [searchResults, setSearchResults] = useState<Array<{ key: string; label: string; detail: string; section: StudentSection }>>([]);
  const [searchComplete, setSearchComplete] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const activeSearch = searchValue.trim();

  useEffect(() => {
    const requestedSection = new URLSearchParams(window.location.search).get("section") as StudentSection | null;
    const requestedSearch = new URLSearchParams(window.location.search).get("search") || "";
    if (requestedSection) setSection(requestedSection);
    if (requestedSearch) {
      setSearchValue(requestedSearch);
      window.setTimeout(() => void submitSearchValue(requestedSearch), 0);
    }
    const localStudent = readStudentAccount();
    const token = window.localStorage.getItem("cyber-academy-auth-token");
    if (!token || !localStudent.email) {
      window.location.replace("/?error=session-required");
      return;
    }
    setStudent(localStudent);
    void fetchStudentProfile(localStudent.email)
      .then((profile) => {
        if (profile) setStudent(profile);
        setSessionReady(true);
      })
      .catch((error) => {
        setSessionError(error instanceof Error ? error.message : "Your dashboard data could not be loaded.");
        setSessionReady(true);
      });
  }, []);

  useEffect(() => {
    setPendingApplications(pendingJobApplications());
    const interval = window.setInterval(() => setPendingApplications(pendingJobApplications()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  function updatePendingApplication(jobId: number, status: JobApplicationStatus) {
    const record = pendingApplications.find((item) => item.jobId === jobId);
    if (record) {
      writeJobApplication({ ...record, status, updatedAt: new Date().toISOString() });
    }
    setPendingApplications(pendingJobApplications());
  }

  async function submitSearch() {
    const term = searchValue.trim();
    await submitSearchValue(term);
  }

  async function submitSearchValue(term: string) {
    const lowerTerm = term.toLowerCase();
    if (!term) { setSearchResults([]); setSearchComplete(false); return; }
    try {
      const [courseResponse, jobResponse] = await Promise.all([
        fetch(new URL("/api/courses", apiBaseUrl).toString(), { cache: "no-store", headers: (() => { const token = window.localStorage.getItem("cyber-academy-auth-token"); return token ? { Authorization: `Bearer ${token}` } : undefined; })() }),
        fetch(new URL("/api/jobs/entry-level?limit=500", apiBaseUrl).toString(), { cache: "no-store" })
      ]);
      const courses = courseResponse.ok ? await courseResponse.json() as Array<Record<string, unknown>> : [];
      const jobs = jobResponse.ok ? await jobResponse.json() as Array<Record<string, unknown>> : [];
      const matches = [
        ...courses.filter((item) => [item.title, item.heading, item.category, item.level].some((value) => String(value ?? "").toLowerCase().includes(lowerTerm))).map((item) => ({ key: `course-${item.id}`, label: String(item.title), detail: `${String(item.category || "")} · Course`, section: "courses" as StudentSection })),
        ...jobs.filter((item) => [item.title, item.company, item.location, item.skills].some((value) => String(value ?? "").toLowerCase().includes(lowerTerm))).map((item) => ({ key: `job-${item.id}`, label: String(item.title), detail: `${String(item.company || "")} · Job`, section: "jobs" as StudentSection }))
      ].slice(0, 16);
      if (lowerTerm.includes("assessment") || lowerTerm.includes("quiz") || lowerTerm.includes("test")) matches.push({ key: "assessment-section", label: "Assessments", detail: "Assessment section", section: "assessments" });
      setSearchResults(matches);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchComplete(true);
    }
  }

  if (!sessionReady) {
    return <div className="grid min-h-screen place-items-center bg-[#f6f8fc] text-sm font-semibold text-[#07142f]">Loading your student dashboard…</div>;
  }

  if (sessionError) {
    return <div className="grid min-h-screen place-items-center bg-[#f6f8fc] px-5 text-center text-[#07142f]"><div className="max-w-md rounded-xl bg-white p-7 shadow-sm"><h1 className="text-xl font-bold">Dashboard unavailable</h1><p className="mt-3 text-sm text-[#5a6170]">{sessionError}</p><button type="button" onClick={() => window.location.reload()} className="mt-6 rounded-md bg-[#3155ff] px-5 py-3 text-sm font-semibold text-white">Try again</button></div></div>;
  }

  return (
    <DashboardShell
      activeSection={section}
      onSectionChange={setSection}
      searchValue={searchValue}
      onSearchValueChange={setSearchValue}
      onSearchSubmit={submitSearch}
      student={student}
    >
      {searchComplete && activeSearch ? <Card className="mb-5 rounded-xl border-0 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3"><h2 className="font-bold text-[#07142f]">Search results for “{activeSearch}”</h2><button type="button" onClick={() => { setSearchComplete(false); setSearchValue(""); }} className="text-sm font-bold text-[#3155ff]">Clear</button></div>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {searchResults.map((result) => <button key={result.key} type="button" onClick={() => { setSection(result.section); setSearchComplete(false); }} className="rounded-lg border border-[#e4e8f0] p-3 text-left hover:border-[#3155ff]"><p className="font-bold">{result.label}</p><p className="mt-1 text-xs text-[#6c7280]">{result.detail}</p></button>)}
          {!searchResults.length ? <div className="md:col-span-2 rounded-lg bg-[#f6f8fc] px-4 py-8 text-center"><p className="font-bold">Not found</p><p className="mt-1 text-sm text-[#6c7280]">No course, job, or assessment matches your search.</p></div> : null}
        </div>
      </Card> : null}
      {section === "dashboard" && <DashboardView searchTerm={activeSearch} student={student} onSectionChange={setSection} />}
      {section === "course-dashboard" && <CourseDashboardView student={student} onSectionChange={setSection} />}
      {section === "courses" && <CoursesView searchTerm={activeSearch} />}
      {section === "job-dashboard" && <JobDashboardView headerSearch={activeSearch} student={student} onSectionChange={setSection} />}
      {section === "jobs" && <JobsView headerSearch={activeSearch} />}
      {section === "assessments" && <AssessmentsView />}
      {["company-tests", "ide", "nerd"].includes(section) && <ComingSoonFeature section={section} />}
      {pendingApplications[0] && (
        <ApplicationStatusPrompt
          record={pendingApplications[0]}
          onApplied={() => updatePendingApplication(pendingApplications[0].jobId, "applied")}
          onNotApplied={() => updatePendingApplication(pendingApplications[0].jobId, "not_applied")}
        />
      )}
    </DashboardShell>
  );
}

function DashboardView({
  searchTerm,
  student,
  onSectionChange
}: {
  searchTerm: string;
  student: StudentAccount;
  onSectionChange: (section: StudentSection) => void;
}) {
  const { activity, lastUpdatedAt } = useDailyActivity(student.email, student.status);
  const [statistics, setStatistics] = useState<StudentStatistics>(emptyStudentStatistics);
  const [statisticsLoading, setStatisticsLoading] = useState(true);
  const lastUpdatedDate = [student.updatedAt, statistics.last_activity, lastUpdatedAt].reduce<Date | null>((latest, value) => {
    if (!value) return latest;
    const candidate = new Date(value);
    if (Number.isNaN(candidate.getTime())) return latest;
    return !latest || candidate.getTime() > latest.getTime() ? candidate : latest;
  }, null);
  const [bannerVariant, setBannerVariant] = useState<(typeof dashboardBannerVariants)[number]>("campus");

  useEffect(() => {
    const index = Math.floor(Math.random() * dashboardBannerVariants.length);
    setBannerVariant(dashboardBannerVariants[index]);
  }, []);

  useEffect(() => {
    const token = window.localStorage.getItem("cyber-academy-auth-token");
    if (!token) {
      setStatisticsLoading(false);
      return;
    }
    const controller = new AbortController();
    const loadStatistics = async () => {
      try {
        const response = await fetch(new URL("/api/student/statistics", apiBaseUrl).toString(), {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal
        });
        if (!response.ok) throw new Error("Statistics could not be loaded");
        setStatistics(await response.json() as StudentStatistics);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setStatistics(emptyStudentStatistics);
      } finally {
        setStatisticsLoading(false);
      }
    };
    void loadStatistics();
    const interval = window.setInterval(() => void loadStatistics(), 30_000);
    return () => {
      window.clearInterval(interval);
      controller.abort();
    };
  }, []);

  const answeredPercent = statistics.assessments.questions_total
    ? Math.round(statistics.assessments.questions_answered / statistics.assessments.questions_total * 100)
    : 0;
  const correctPercent = statistics.assessments.questions_answered
    ? Math.round(statistics.assessments.questions_correct / statistics.assessments.questions_answered * 100)
    : 0;
  const incorrectPercent = statistics.assessments.questions_answered
    ? Math.round(statistics.assessments.questions_incorrect / statistics.assessments.questions_answered * 100)
    : 0;
  const unanswered = Math.max(0, statistics.assessments.questions_total - statistics.assessments.questions_answered);
  const unansweredPercent = statistics.assessments.questions_total
    ? Math.round(unanswered / statistics.assessments.questions_total * 100)
    : 0;

  return (
    <div className="w-full">
      <div className="mb-5 flex flex-col gap-5">
        <div className="flex w-fit rounded-md bg-white p-1 shadow-sm">
          <button type="button" className="rounded bg-[#3155ff] px-8 py-2.5 text-sm font-semibold text-white">Skill</button>
          <button type="button" onClick={() => onSectionChange("course-dashboard")} className="rounded px-8 py-2.5 text-sm font-semibold text-black">Course</button>
          <button type="button" onClick={() => onSectionChange("job-dashboard")} className="rounded px-8 py-2.5 text-sm font-semibold text-black">Jobs</button>
        </div>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h1 className="text-xl font-semibold tracking-[-0.02em] text-black">Dashboard</h1>
          <div className="flex w-fit items-center rounded border border-[#dbe0e9] bg-white px-4 py-3 text-sm font-medium text-[#4d5360]">
            <span>Last Updated on {lastUpdatedDate ? formatDate(lastUpdatedDate) : "--"}</span>
            <span className="mx-3 h-5 w-px bg-[#d8dce5]" />
            <span>{lastUpdatedDate ? formatTime(lastUpdatedDate) : "--"}</span>
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-[10px] bg-white shadow-sm">
        <DashboardBanner variant={bannerVariant} />

        <div className="relative px-7 pb-8 pt-20">
          <div className="absolute -top-[72px] left-7 flex h-36 w-36 items-center justify-center overflow-hidden rounded-full bg-white p-1.5">
            <span className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[#d8f4fb]">
              {student.photoDataUrl ? (
                <Image src={student.photoDataUrl} alt="Student profile photo" fill unoptimized className="object-cover" />
              ) : (
                <UserRound size={74} strokeWidth={1.2} className="text-[#0797ad]" />
              )}
            </span>
          </div>

          <h2 className="text-3xl font-bold leading-none text-[#07142f]">{student.fullName || "Student"}</h2>
          {student.email && <p className="mt-3 text-lg text-[#7d8189]">{student.email}</p>}
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3 text-base text-[#5a5f68]">
            <ProfileMeta label="Register Number" value={student.registrationNumber} />
            <ProfileMeta label="Department" value={student.department} />
            <ProfileMeta label="Batch" value={student.batch} />
            <ProfileMeta label="College" value={student.college} />
            {student.cyberlancersId && <ProfileMeta label="Cyberlancers ID" value={student.cyberlancersId} />}
          </div>
        </div>
      </section>

      <div className="mt-7 grid gap-5 xl:grid-cols-2">
        <Card className="grid min-h-[310px] gap-4 rounded-[12px] border-0 bg-white p-5 shadow-sm sm:grid-cols-[240px_1fr]">
          <DashboardFeaturePanel title="Neo-PAT">
            <div className="mt-8 inline-flex min-h-[150px] min-w-[135px] flex-col items-center justify-center border border-[#edf0fa] px-5 [clip-path:polygon(0_0,100%_0,100%_72%,50%_100%,0_72%)]">
              <span className="text-base text-[#747b8a]">Your Score</span>
              <strong className="mt-1 text-3xl text-black">{statisticsLoading ? "--" : statistics.assessments.average_score}</strong>
            </div>
            <p className="mt-5 text-lg font-bold text-[#8a3c06]">{statistics.assessments.completed} assessment{statistics.assessments.completed === 1 ? "" : "s"} completed</p>
          </DashboardFeaturePanel>
          <DashboardFeaturePanel title="Neo-Colab">
            <div className="flex min-h-[205px] items-center justify-center text-center text-2xl font-bold text-[#d9dce2]">
              {statistics.courses.total ? `${statistics.courses.completed} of ${statistics.courses.total} courses completed` : "No courses assigned"}
            </div>
          </DashboardFeaturePanel>
        </Card>

        <Card className="min-h-[310px] rounded-[12px] border-0 bg-white p-7 shadow-sm">
          <h2 className="border-b border-[#edf0f5] pb-5 text-xl font-bold text-[#07142f]">Solved Questions</h2>
          <div className="grid items-center gap-8 pt-7 md:grid-cols-[220px_1fr]">
            <div className="relative mx-auto flex h-44 w-44 items-center justify-center rounded-full p-[7px]" style={{ background: `conic-gradient(#3155ff 0deg ${answeredPercent * 3.6}deg,#edf0ff ${answeredPercent * 3.6}deg 360deg)` }}>
              <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-white">
                <strong className="text-3xl text-black">{statistics.assessments.questions_answered}/{statistics.assessments.questions_total}</strong>
                <span className="text-lg text-[#747b8a]">Questions</span>
              </div>
            </div>
            <div className="grid gap-6">
              <QuestionProgress label="Correct" value={`${statistics.assessments.questions_correct}/${statistics.assessments.questions_answered}`} percent={correctPercent} color="bg-[#31b64b]" />
              <QuestionProgress label="Incorrect" value={`${statistics.assessments.questions_incorrect}/${statistics.assessments.questions_answered}`} percent={incorrectPercent} color="bg-[#ff5e66]" />
              <QuestionProgress label="Not answered" value={`${unanswered}/${statistics.assessments.questions_total}`} percent={unansweredPercent} color="bg-[#ffb800]" />
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-7 grid gap-5 lg:grid-cols-3">
        <DashboardMetricCard
          title="Coding"
          leftLabel="Courses Available"
          leftValue={statistics.courses.total}
          rightLabel="Courses Completed"
          rightValue={statistics.courses.completed}
          scoreLabel="Course Progress"
          scoreValue={`${statistics.courses.average_completion}%`}
          accuracy={`${statistics.courses.active} active`}
          accent="text-[#3155ff]"
        />
        <DashboardMetricCard
          title="Projects"
          leftLabel="Jobs Available"
          leftValue={statistics.jobs.available}
          rightLabel="Jobs Applied"
          rightValue={statistics.jobs.applied}
          scoreLabel="Applications"
          scoreValue={statistics.jobs.applied}
          accuracy={statistics.jobs.available ? `${Math.round(statistics.jobs.applied / statistics.jobs.available * 100)}%` : "0%"}
          accent="text-[#3155ff]"
        />
        <DashboardMetricCard
          title="MCQ"
          leftLabel="Questions Attended"
          leftValue={statistics.assessments.questions_answered}
          rightLabel="Solved Correctly"
          rightValue={statistics.assessments.questions_correct}
          scoreLabel="Average Score"
          scoreValue={statistics.assessments.average_score}
          accuracy={`${correctPercent}%`}
          accent="text-[#ff5e66]"
        />
      </div>

      <ActivityCalendar activity={activity} searchTerm={searchTerm} />
    </div>
  );
}

function DashboardFeaturePanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[10px] border border-[#f0f2f7] bg-white p-5 shadow-[0_8px_24px_rgba(17,24,74,.08)]">
      <h2 className="border-b border-[#edf0f5] pb-5 text-xl font-bold text-[#07142f]">{title}</h2>
      {children}
    </div>
  );
}

function CourseDashboardView({ student, onSectionChange }: { student: StudentAccount; onSectionChange: (section: StudentSection) => void }) {
  const { activity } = useDailyActivity(student.email, student.status);
  const [databaseCourses, setDatabaseCourses] = useState<PortalCourse[]>([]);
  const [statistics, setStatistics] = useState<StudentStatistics>(emptyStudentStatistics);
  const [courseSearch, setCourseSearch] = useState("");
  const [courseScope, setCourseScope] = useState<"all" | "active" | "completed">("all");
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set());
  const [refreshedAt, setRefreshedAt] = useState(new Date());
  useEffect(() => {
    let active = true;
    const token = window.localStorage.getItem("cyber-academy-auth-token");
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const load = () => void Promise.all([
      fetch(new URL("/api/courses", apiBaseUrl).toString(), { cache: "no-store", headers }),
      fetch(new URL("/api/student/statistics", apiBaseUrl).toString(), { cache: "no-store", headers })
    ]).then(async ([courseResponse, statisticsResponse]) => {
      if (!active) return;
      setDatabaseCourses(courseResponse.ok ? (await courseResponse.json() as ApiCourse[]).map(apiCourseToPortalCourse) : []);
      setStatistics(statisticsResponse.ok ? await statisticsResponse.json() as StudentStatistics : emptyStudentStatistics);
      setRefreshedAt(new Date());
    }).catch(() => { if (active) { setDatabaseCourses([]); setStatistics(emptyStudentStatistics); } });
    load();
    const interval = window.setInterval(load, 30_000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);
  const visibleCourses = databaseCourses.filter((course) => {
    const matchesSearch = course.title.toLowerCase().includes(courseSearch.trim().toLowerCase());
    const matchesScope = courseScope === "all" || courseStatus(course) === courseScope;
    return matchesSearch && matchesScope;
  });
  const analyticsCourses = selectedCourses.size
    ? databaseCourses.filter((course) => selectedCourses.has(course.title))
    : databaseCourses;
  const completed = analyticsCourses.filter((course) => courseStatus(course) === "completed").length;
  const expired = analyticsCourses.filter((course) => courseStatus(course) === "expired").length;
  const overallCompletion = analyticsCourses.reduce((sum, course) => sum + courseCompletion(course), 0) / Math.max(1, analyticsCourses.length);
  const totalActivity = Object.values(activity).reduce((sum, count) => sum + count, 0);
  const learningMinutes = totalActivity * 15;
  const assessmentSeconds = statistics.assessments.duration_seconds;

  function toggleCourse(title: string) {
    setSelectedCourses((current) => {
      const next = new Set(current);
      if (next.has(title)) next.delete(title); else next.add(title);
      return next;
    });
  }

  return (
    <div className="w-full">
      <div className="mb-5 flex w-fit rounded-md bg-white p-1 shadow-sm">
        <button type="button" onClick={() => onSectionChange("dashboard")} className="rounded px-8 py-2.5 text-sm text-black">Skill</button>
        <button type="button" className="rounded bg-[#3155ff] px-8 py-2.5 text-sm font-medium text-white">Course</button>
        <button type="button" onClick={() => onSectionChange("job-dashboard")} className="rounded px-8 py-2.5 text-sm text-black">Jobs</button>
      </div>
      <h1 className="mb-6 text-xl font-medium text-black">Dashboard</h1>

      <section className="relative overflow-hidden rounded-[12px] bg-[#082a89] px-8 py-9 text-white">
        <div className="relative z-10">
          <h2 className="text-2xl font-semibold">Hello <span className="text-[#ff9f26]">{student.fullName || "Student"}</span> 👋</h2>
          <p className="mt-5 text-base text-white/65">Welcome to our online learning platform! We&apos;re excited to have you here and help you achieve your goals.</p>
          <p className="mt-3 text-base text-white/65">Good luck with your learning.</p>
        </div>
        <span className="absolute -bottom-7 right-12 text-[84px] font-medium text-white/15">Hello {student.firstName || "Student"}</span>
      </section>

      <div className="relative z-10 -mt-8 grid gap-5 px-0 lg:grid-cols-4 lg:px-7">
        <CourseSummaryMetric value={analyticsCourses.length} label={selectedCourses.size ? "Courses Selected" : "Courses Enrolled"} color="bg-[#e9edf6] text-[#082a89]" />
        <CourseSummaryMetric value={`${overallCompletion.toFixed(2)}%`} label="Overall Completion" color="bg-[#e5e9ff] text-[#3155ff]" />
        <CourseSummaryMetric value={completed} label="Completed" color="bg-[#e5f5e5] text-[#45b649]" />
        <CourseSummaryMetric value={expired} label="Expired" color="bg-[#fde6e8] text-[#ff4858]" />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <DashboardAnalyticsCard title="Courses">
          <div className="mb-5 flex flex-wrap items-center gap-3 border-b border-[#edf0f5] pb-5">
            <select value={courseScope} onChange={(event) => setCourseScope(event.target.value as typeof courseScope)} className="rounded-md bg-transparent px-2 py-2 text-sm outline-none">
              <option value="all">All</option><option value="active">Active</option><option value="completed">Completed</option>
            </select>
            <label className="ml-auto flex h-11 min-w-[260px] items-center gap-2 rounded-md border border-[#dbe0e9] bg-[#f8f9fc] px-3">
              <Search size={18} className="text-[#7b8390]" /><input value={courseSearch} onChange={(event) => setCourseSearch(event.target.value)} placeholder="Search here" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
            </label>
          </div>
          <label className="mb-4 flex items-center gap-3 text-sm text-[#5f6573]"><input type="checkbox" checked={visibleCourses.length > 0 && visibleCourses.every((course) => selectedCourses.has(course.title))} onChange={(event) => setSelectedCourses(event.target.checked ? new Set(visibleCourses.map((course) => course.title)) : new Set())} className="h-5 w-5" /> Select All</label>
          <div className="max-h-[330px] space-y-2 overflow-y-auto pr-2">
            {visibleCourses.map((course) => <CourseProgressRow key={course.title} course={course} selected={selectedCourses.has(course.title)} onToggle={() => toggleCourse(course.title)} />)}
          </div>
        </DashboardAnalyticsCard>

        <DashboardAnalyticsCard title="Time Spent" onRefresh={() => setRefreshedAt(new Date())}>
          <div className="relative mx-auto h-[390px] max-w-[560px]">
            <div className="absolute left-[18%] top-[88px] flex h-72 w-72 flex-col items-center justify-center rounded-full bg-[linear-gradient(145deg,#7388ff,#9b6df5)] text-center text-white shadow-[0_20px_50px_rgba(83,72,220,.28)]"><strong className="text-2xl">{Math.floor(learningMinutes / 1440)} Day</strong><span className="mt-2 text-xl">{Math.floor((learningMinutes % 1440) / 60)}:{String(learningMinutes % 60).padStart(2, "0")} hrs</span><span className="mt-2">Learning Contents</span></div>
            <div className="absolute right-[10%] top-3 flex h-44 w-44 flex-col items-center justify-center rounded-full bg-[linear-gradient(145deg,#3155ff,#1e3a9e)] text-center text-white shadow-[0_16px_38px_rgba(49,85,255,.3)]"><strong>{formatTimer(assessmentSeconds)}</strong><span>Assessment</span></div>
            <div className="absolute bottom-2 right-[8%] flex h-36 w-36 flex-col items-center justify-center rounded-full bg-[linear-gradient(145deg,#55c96b,#249848)] text-center text-white shadow-[0_14px_34px_rgba(36,152,72,.25)]"><strong>{statistics.assessments.attempts}</strong><span>Attempts</span></div>
          </div>
          <p className="text-right text-xs text-[#9aa1ad]">Updated {formatTime(refreshedAt)}</p>
        </DashboardAnalyticsCard>

        <QuestionCompletionCard statistics={statistics} />
        <LiveCompletionCard courses={analyticsCourses} statistics={statistics} />
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {["Top Performing Test", "Least Performing Test", "Top Performing Topic", "Least Performing Topic"].map((title) => <PerformanceCard key={title} title={title} courses={analyticsCourses} />)}
      </div>
      <LiveAssessmentStatisticsTable statistics={statistics} />
    </div>
  );
}

function CourseSummaryMetric({ value, label, color }: { value: string | number; label: string; color: string }) {
  return <Card className="flex min-h-[130px] items-center gap-5 rounded-[12px] border border-[#dce2f0] bg-[linear-gradient(135deg,#ffffff,#f7f9ff)] p-6 shadow-[0_12px_28px_rgba(17,24,74,.1)]"><span className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-full shadow-inner ${color}`}><ClipboardCheck size={32} /></span><span><strong className="block text-2xl text-[#07142f]">{value}</strong><span className="mt-3 block text-base text-[#4f5868]">{label}</span></span></Card>;
}

function DashboardAnalyticsCard({ title, children, onRefresh }: { title: string; children: React.ReactNode; onRefresh?: () => void }) {
  return <Card className="min-h-[500px] rounded-[18px] border border-[#dfe4f2] bg-[linear-gradient(145deg,#ffffff_0%,#fbfcff_60%,#f4f7ff_100%)] p-7 shadow-[0_14px_35px_rgba(17,24,74,.09)]"><div className="mb-5 flex items-center justify-between border-b border-[#e7eaf2] pb-4"><h2 className="text-xl font-semibold text-[#07142f]">{title}</h2>{onRefresh && <button type="button" onClick={onRefresh} className="inline-flex items-center gap-2 rounded-md bg-[#eef2ff] px-3 py-2 text-sm text-[#3155ff]"><RefreshCw size={16} /> Load</button>}</div>{children}</Card>;
}

function CourseProgressRow({ course, selected, onToggle }: { course: PortalCourse; selected: boolean; onToggle: () => void }) {
  const progress = courseCompletion(course);
  return <div className="grid grid-cols-[24px_36px_minmax(0,1fr)_minmax(100px,220px)_45px] items-center gap-3 py-2"><input type="checkbox" checked={selected} onChange={onToggle} className="h-5 w-5" /><span className={`flex h-9 w-9 items-center justify-center rounded text-white ${course.color}`}><course.icon size={18} /></span><span className="truncate text-sm text-[#4d5360]">{course.title}</span><span className="h-1.5 rounded-full bg-[#d6d6d6]"><span className="block h-full rounded-full bg-[#3155ff]" style={{ width: `${progress}%` }} /></span><span className="text-right text-sm">{progress}%</span></div>;
}

function courseAnalytics(courses: typeof cybersecurityCourses) {
  const attempts = courses.reduce((sum, course) => sum + course.assessments + course.labs, 0);
  const completion = courses.reduce((sum, course) => sum + courseCompletion(course), 0) / Math.max(1, courses.length);
  const correct = Math.round(attempts * completion / 100 * 0.58);
  const partial = Math.round(attempts * completion / 100 * 0.17);
  const wrong = Math.round(attempts * completion / 100 * 0.25);
  const remaining = Math.max(0, attempts - correct - partial - wrong);
  return { attempts, completion, correct, partial, wrong, skipped: Math.round(remaining * 0.35), notAttempted: Math.round(remaining * 0.4), notViewed: Math.round(remaining * 0.25) };
}

function QuestionCompletionCard({ statistics }: { statistics: StudentStatistics }) {
  const data = statistics.assessments;
  const segments = [["Correct", "#536dce", data.questions_correct], ["Incorrect", "#ff6572", data.questions_incorrect], ["Not Answered", "#8297ff", Math.max(0, data.questions_total - data.questions_answered)]] as const;
  return <DashboardAnalyticsCard title="Question Completion Status"><div className="grid min-h-[390px] items-center gap-8 md:grid-cols-2"><div className="mx-auto flex h-72 w-36 flex-col-reverse overflow-hidden rounded-b-lg shadow-[0_12px_30px_rgba(17,24,74,.16)]">{segments.map(([label, color, value]) => <span key={label} style={{ backgroundColor: color, flexGrow: Math.max(1, value) }} title={`${label}: ${value}`} />)}</div><div className="grid gap-5 text-sm text-[#434b5a]">{segments.map(([label, color, value]) => <span key={label} className="flex items-center gap-3"><i className="h-5 w-5 rounded-full shadow-sm" style={{ backgroundColor: color }} /><span className="flex-1">{label}</span><strong>{value}</strong></span>)}</div></div></DashboardAnalyticsCard>;
}

function TotalCompletionCard({ courses, statistics }: { courses: PortalCourse[]; statistics: StudentStatistics }) {
  const completed = courses.filter((course) => courseStatus(course) === "completed").length;
  const active = courses.filter((course) => courseStatus(course) === "active").length;
  const notStarted = courses.length - completed - active;
  const completedDegrees = Math.round(completed / Math.max(1, courses.length) * 360);
  const activeDegrees = completedDegrees + Math.round(active / Math.max(1, courses.length) * 360);
  const ring = `conic-gradient(#46bd62 0deg ${completedDegrees}deg,#3155ff ${completedDegrees}deg ${activeDegrees}deg,#ffb534 ${activeDegrees}deg 360deg)`;
  return <DashboardAnalyticsCard title="Total Completion Status"><div className="grid min-h-[390px] place-items-center gap-8 md:grid-cols-2">{["Course Status", "Assessment Status"].map((label) => <div key={label} className="text-center"><div className="flex h-48 w-48 items-center justify-center rounded-full p-3 shadow-[0_14px_35px_rgba(49,85,255,.16)]" style={{ background: ring }}><div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-white"><strong className="text-xl text-[#07142f]">{completed}/{courses.length}</strong><span className="text-sm text-[#646d7c]">{label}</span></div></div><div className="mt-5 text-sm text-[#4f5868]">Completed {completed} · Active {active} · Not started {notStarted}</div></div>)}</div></DashboardAnalyticsCard>;
}

function PerformanceCard({ title, courses }: { title: string; courses: PortalCourse[] }) {
  const accent = title.includes("Top") ? "text-[#3155ff] bg-[#eef2ff]" : "text-[#ff5967] bg-[#fff0f2]";
  const sorted = [...courses].sort((a, b) => courseCompletion(b) - courseCompletion(a));
  const course = title.includes("Top") ? sorted[0] : sorted[sorted.length - 1];
  if (!course) return <Card className="flex min-h-[300px] items-center justify-center rounded-[18px] border border-[#dfe4f2] bg-white p-6 text-center text-[#657083] shadow-[0_12px_30px_rgba(17,24,74,.08)]">No course performance data yet.</Card>;
  return <Card className="min-h-[300px] rounded-[18px] border border-[#dfe4f2] bg-white p-6 shadow-[0_12px_30px_rgba(17,24,74,.08)]"><div className="flex items-center justify-between border-b border-[#edf0f5] pb-5"><h3 className="text-base font-semibold text-[#07142f]">{title}</h3><span className="inline-flex items-center gap-1 rounded-md bg-[#f3f5fa] px-2 py-1 text-sm text-[#5f6573]"><RefreshCw size={15} /> Live</span></div><div className="flex h-52 flex-col items-center justify-center text-center text-[#657083]"><span className={`flex h-24 w-24 items-center justify-center rounded-full ${accent}`}><course.icon size={52} strokeWidth={1.4} /></span><strong className="mt-4 line-clamp-2 text-[#07142f]">{course.title}</strong><span className="mt-2">{courseCompletion(course)}% completion</span><span className="mt-1 text-xs">{course.assessments} assessments · {course.labs} labs</span></div></Card>;
}

function QuestionDifficultyTable({ courses }: { courses: typeof cybersecurityCourses }) {
  const rows = ["MCQ–Multiple Correct", "Fill-Ups", "HTML–CSS–JS", "Single File Programming", "MCQ–Single Correct", "Data Interpretation"];
  const base = Math.max(1, Math.round(courses.reduce((sum, course) => sum + course.assessments, 0) / rows.length));
  return <Card className="mt-6 overflow-hidden rounded-[18px] border-0 bg-white p-7 shadow-sm"><div className="mb-6 flex items-center justify-between"><h2 className="text-xl font-medium">Question Type and Difficulty Level Wise</h2><div className="flex gap-4 text-sm"><span className="text-[#35b582]">● Easy</span><span className="text-[#f5a331]">● Medium</span><span className="text-red-500">● Hard</span></div></div><div className="overflow-x-auto"><table className="min-w-[1100px] w-full text-left text-sm"><thead className="bg-[#f2f4fb] text-[#747b8a]"><tr>{["Question Type", "Difficulty Level Wise Count", "Correct", "Partially Correct", "Wrong", "Not Viewed", "Skipped"].map((heading) => <th key={heading} className="px-5 py-5 font-medium">{heading}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={row} className="border-b border-[#e8ebf2]"><td className="px-5 py-5 text-[#747b8a]">{row}</td>{Array.from({ length: 6 }).map((_, index) => <td key={index} className="px-5 py-5"><span className="inline-grid grid-cols-3 overflow-hidden rounded"><i className="bg-green-50 px-3 text-green-500">{Math.max(1, Math.round(base * .45) + rowIndex % 2)}</i><i className="bg-orange-50 px-3 text-orange-400">{Math.max(1, Math.round(base * .3) + index % 2)}</i><i className="bg-red-50 px-3 text-red-400">{Math.max(1, Math.round(base * .25))}</i></span></td>)}</tr>)}</tbody></table></div></Card>;
}

function LiveCompletionCard({ courses, statistics }: { courses: PortalCourse[]; statistics: StudentStatistics }) {
  const courseCompleted = courses.filter((course) => courseStatus(course) === "completed").length;
  const coursePercent = Math.round(courseCompleted / Math.max(1, courses.length) * 100);
  const assessmentPercent = Math.round(statistics.assessments.completed / Math.max(1, statistics.assessments.total) * 100);
  return (
    <DashboardAnalyticsCard title="Total Completion Status">
      <div className="grid min-h-[390px] place-items-center gap-8 md:grid-cols-2">
        {[
          { label: "Course Status", complete: courseCompleted, total: courses.length, percent: coursePercent },
          { label: "Assessment Status", complete: statistics.assessments.completed, total: statistics.assessments.total, percent: assessmentPercent }
        ].map((item) => (
          <div key={item.label} className="text-center">
            <div className="flex h-48 w-48 items-center justify-center rounded-full p-3 shadow-[0_14px_35px_rgba(49,85,255,.16)]" style={{ background: `conic-gradient(#46bd62 0deg ${item.percent * 3.6}deg,#edf0ff ${item.percent * 3.6}deg 360deg)` }}>
              <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-white">
                <strong className="text-xl text-[#07142f]">{item.complete}/{item.total}</strong>
                <span className="text-sm text-[#646d7c]">{item.label}</span>
              </div>
            </div>
            <div className="mt-5 text-sm text-[#4f5868]">{item.percent}% complete</div>
          </div>
        ))}
      </div>
    </DashboardAnalyticsCard>
  );
}

function LiveAssessmentStatisticsTable({ statistics }: { statistics: StudentStatistics }) {
  const rows = [
    ["Available assessments", statistics.assessments.total],
    ["Assessment attempts", statistics.assessments.attempts],
    ["Completed assessments", statistics.assessments.completed],
    ["Questions answered", statistics.assessments.questions_answered],
    ["Correct answers", statistics.assessments.questions_correct],
    ["Incorrect answers", statistics.assessments.questions_incorrect]
  ] as const;
  return (
    <Card className="mt-6 overflow-hidden rounded-[18px] border-0 bg-white p-7 shadow-sm">
      <h2 className="mb-6 text-xl font-medium">Live Assessment Statistics</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#f2f4fb] text-[#747b8a]"><tr><th className="px-5 py-5 font-medium">Metric</th><th className="px-5 py-5 font-medium">Database value</th></tr></thead>
          <tbody>{rows.map(([label, value]) => <tr key={label} className="border-b border-[#e8ebf2]"><td className="px-5 py-5 text-[#747b8a]">{label}</td><td className="px-5 py-5 font-bold text-[#07142f]">{value}</td></tr>)}</tbody>
        </table>
      </div>
    </Card>
  );
}

function QuestionProgress({ label, value, percent, color }: { label: string; value: string; percent: number; color: string }) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-sm font-semibold">
        <span className="text-[#5a5f68]">{label}</span>
        <span className="text-black">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#f0f2f8]">
        <div className={`h-full ${color}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function DashboardMetricCard({
  title,
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
  scoreLabel,
  scoreValue,
  accuracy,
  accent
}: {
  title: string;
  leftLabel: string;
  leftValue: number | string;
  rightLabel: string;
  rightValue: number | string;
  scoreLabel: string;
  scoreValue: number | string;
  accuracy?: string;
  accent: string;
}) {
  return (
    <Card className="min-h-[250px] rounded-[12px] border-0 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold text-[#07142f]">{title}</h2>
      <div className="mt-6 border-t pt-6">
        <div className="grid grid-cols-2 gap-5">
          <div>
            <p className="text-sm font-semibold text-black">{leftLabel}</p>
            <p className="mt-3 text-3xl font-bold text-black">{leftValue}</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-black">{rightLabel}</p>
            <p className="mt-3 text-3xl font-bold text-black">{rightValue}</p>
          </div>
        </div>
        <div className="mt-7 grid grid-cols-2 gap-5">
          <div className="rounded-lg border border-[#eef2ff] px-5 py-4">
            <p className="text-sm text-[#747b8a]">{scoreLabel}</p>
            <p className={`mt-2 text-3xl font-bold ${accent}`}>{scoreValue}</p>
          </div>
          <div className="rounded-lg bg-[#fffdfd] px-5 py-4 shadow-sm">
            <p className="text-sm text-black">Accuracy</p>
            <p className={`mt-2 text-3xl font-bold ${accent}`}>{accuracy || "--"}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}

function DashboardBanner({ variant }: { variant: (typeof dashboardBannerVariants)[number] }) {
  return (
    <div className={`relative h-[150px] overflow-hidden rounded-t-[10px] sm:h-[162px] ${bannerBaseClass(variant)}`}>
      <div className="absolute left-1/2 top-0 h-full w-[1180px] -translate-x-1/2 sm:w-[1380px] xl:w-[1540px]">
        {variant === "campus" && (
          <>
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(239,89,128,.18),rgba(255,140,80,.5)),radial-gradient(circle_at_35%_20%,rgba(255,224,84,.9)_0_8px,transparent_9px),radial-gradient(circle_at_8%_28%,rgba(255,224,84,.9)_0_8px,transparent_9px),radial-gradient(circle_at_21%_18%,rgba(255,224,84,.9)_0_8px,transparent_9px),radial-gradient(circle_at_52%_45%,rgba(113,64,153,.55)_0_48px,transparent_49px)]" />
            <div className="absolute -left-16 top-8 h-24 w-[560px] rotate-3 rounded-[50%] border-t-[14px] border-[#92469a]" />
            <div className="absolute left-[41%] -top-12 h-[260px] w-8 rotate-12 bg-[#7d2b85]" />
            <div className="absolute right-4 top-9 h-28 w-[460px] -rotate-12 rounded-full bg-[#b2448c]" />
            <div className="absolute bottom-0 right-[9%] h-24 w-[260px] bg-[#542164]" />
            <div className="absolute bottom-0 right-[13%] h-36 w-[150px] bg-[#7f3d9b] [clip-path:polygon(50%_0,100%_42%,100%_100%,0_100%,0_42%)]" />
          </>
        )}

        {variant === "dunes" && (
          <>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_22%,rgba(255,237,136,.95)_0_12px,transparent_13px),linear-gradient(180deg,#78cfd1_0%,#ffe59a_48%,#ff8a62_100%)]" />
            <div className="absolute -left-10 bottom-0 h-24 w-[470px] rounded-[50%] bg-[#f7c65e]" />
            <div className="absolute left-[22%] bottom-0 h-28 w-[520px] rounded-[50%] bg-[#f39a62]" />
            <div className="absolute right-[-4%] bottom-0 h-36 w-[540px] rounded-[50%] bg-[#db6b72]" />
            <div className="absolute right-[5%] bottom-0 h-24 w-5 bg-[#405c61]" />
            <div className="absolute right-[8%] bottom-11 h-24 w-4 -rotate-12 bg-[#405c61]" />
            <div className="absolute right-[4%] bottom-11 h-24 w-4 rotate-12 bg-[#405c61]" />
            <div className="absolute right-[18%] bottom-0 h-14 w-4 bg-[#516d53]" />
          </>
        )}

        {variant === "night" && (
          <>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_24%,rgba(255,231,113,.9)_0_7px,transparent_8px),radial-gradient(circle_at_32%_16%,rgba(255,255,255,.8)_0_2px,transparent_3px),radial-gradient(circle_at_72%_28%,rgba(255,255,255,.8)_0_2px,transparent_3px),linear-gradient(180deg,#26305f_0%,#6b3b86_55%,#ff806e_100%)]" />
            <div className="absolute -left-20 bottom-0 h-28 w-[500px] rounded-[50%] bg-[#2e245b]" />
            <div className="absolute left-[32%] bottom-0 h-20 w-[430px] rounded-[50%] bg-[#4f2e75]" />
            <div className="absolute right-[8%] bottom-0 h-20 w-[260px] bg-[#1f1f4c]" />
            <div className="absolute right-[14%] bottom-0 h-28 w-[120px] bg-[#3a3480] [clip-path:polygon(50%_0,100%_38%,100%_100%,0_100%,0_38%)]" />
            <div className="absolute left-[45%] -top-20 h-[260px] w-6 rotate-12 bg-[#d7536a]" />
          </>
        )}

        {variant === "hills" && (
          <>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_61%_25%,rgba(255,239,153,.95)_0_13px,transparent_14px),linear-gradient(180deg,#93d8df_0%,#ffc7ba_52%,#ff886d_100%)]" />
            <div className="absolute -left-10 bottom-0 h-24 w-[420px] rounded-[50%] bg-[#65b6a9]" />
            <div className="absolute left-[20%] bottom-0 h-28 w-[470px] rounded-[50%] bg-[#f2a1b5]" />
            <div className="absolute right-[20%] bottom-0 h-32 w-[500px] rounded-[50%] bg-[#8b4ea7]" />
            <div className="absolute right-[24%] bottom-0 h-24 w-[210px] bg-[#533066]" />
            <div className="absolute right-[29%] bottom-0 h-32 w-[120px] bg-[#7f4aa0] [clip-path:polygon(50%_0,100%_45%,100%_100%,0_100%,0_45%)]" />
            <div className="absolute left-[8%] top-8 h-12 w-[460px] -rotate-2 rounded-[50%] border-t-[10px] border-[#ab5fa0]" />
          </>
        )}
      </div>

      <div className="absolute bottom-0 left-0 h-12 w-full bg-white/20" />
    </div>
  );
}

function bannerBaseClass(variant: (typeof dashboardBannerVariants)[number]) {
  if (variant === "dunes") return "bg-[#7ecfd1]";
  if (variant === "night") return "bg-[#26305f]";
  if (variant === "hills") return "bg-[#93d8df]";
  return "bg-[#fb7b75]";
}

function ProfileMeta({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <span>
      {label} : <b className="text-black">{value}</b>
    </span>
  );
}

function ActivityCalendar({ activity, searchTerm }: { activity: ActivityMap; searchTerm: string }) {
  const [activityType, setActivityType] = useState<"Codings" | "MCQ" | "Projects">("Codings");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [isYearMenuOpen, setIsYearMenuOpen] = useState(false);
  const yearOptions = useMemo(() => buildYearOptions(2025, currentYear), [currentYear]);
  const months = useMemo(() => buildActivityMonths(selectedYear), [selectedYear]);
  const yearActivity = useMemo(
    () => Object.fromEntries(Object.entries(activity).filter(([dateKey]) => dateKey.startsWith(`${selectedYear}-`))) as ActivityMap,
    [activity, selectedYear]
  );
  const cleanSearch = searchTerm.trim().toLowerCase();
  const visibleMonths = cleanSearch
    ? months
      .map((month) => ({
        ...month,
        days: month.days.filter((day) => day.label.toLowerCase().includes(cleanSearch) || month.label.toLowerCase().includes(cleanSearch))
      }))
      .filter((month) => month.days.length > 0)
    : months;
  const totalContribution = Object.values(yearActivity).filter((count) => count > 0).length;
  const totalHours = Object.values(yearActivity).reduce((total, count) => total + count, 0) * 0.25;
  const averageTime = totalContribution ? totalHours / totalContribution : 0;

  return (
    <Card className="mt-7 rounded-[12px] border-0 bg-white p-7 shadow-sm">
      <div className="flex flex-col gap-5 border-b border-[#edf0f5] pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-6">
          <h2 className="text-xl font-bold text-[#07142f]">Contributions</h2>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsMenuOpen((current) => !current)}
              className="inline-flex h-11 min-w-[120px] items-center justify-between rounded-md border border-[#cfd6e3] bg-white px-4 text-base font-medium text-black shadow-sm"
            >
              {activityType}
              <ChevronDown size={18} className={`ml-3 text-[#7d8794] transition ${isMenuOpen ? "rotate-180" : ""}`} />
            </button>
            {isMenuOpen && (
              <div className="absolute left-0 top-[48px] z-20 w-[120px] rounded-md border border-[#e1e5ee] bg-white py-3 shadow-[0_18px_40px_rgba(15,23,42,.12)]">
                {(["Codings", "MCQ", "Projects"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setActivityType(item);
                      setIsMenuOpen(false);
                    }}
                    className={`block w-full px-4 py-3 text-left text-sm font-medium ${activityType === item ? "text-[#3155ff]" : "text-[#2f3542]"}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-base text-[#747b8a]">
          <span>Less</span>
          {[0, 1, 2, 4].map((count) => (
            <span key={count} className={`h-4 w-4 rounded ${activityColor(count)}`} />
          ))}
          <span>More</span>
          <span className="h-4 w-4 rounded bg-[#d8d8d8]" />
          <span>None</span>
          <div className="relative ml-3">
            <button
              type="button"
              onClick={() => setIsYearMenuOpen((current) => !current)}
              className="inline-flex h-11 min-w-[116px] items-center justify-between gap-3 rounded-md border border-[#cfd6e3] bg-white px-4 text-base font-medium text-black shadow-sm"
            >
              {selectedYear}
              <ChevronDown size={18} className={`text-[#7d8794] transition ${isYearMenuOpen ? "rotate-180" : ""}`} />
            </button>
            {isYearMenuOpen && (
              <div className="absolute right-0 top-[48px] z-20 w-[116px] overflow-hidden rounded-md border border-[#e1e5ee] bg-white py-2 shadow-[0_18px_40px_rgba(15,23,42,.12)]">
                {yearOptions.map((year) => (
                  <button
                    key={year}
                    type="button"
                    onClick={() => {
                      setSelectedYear(year);
                      setIsYearMenuOpen(false);
                    }}
                    className={`block w-full px-4 py-3 text-left text-sm font-medium hover:bg-[#f5f7ff] ${selectedYear === year ? "text-[#3155ff]" : "text-[#2f3542]"}`}
                  >
                    {year}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-8 border-b border-[#edf0f5] py-8 md:grid-cols-3">
        <div>
          <p className="text-sm font-semibold text-black">Total Contribution</p>
          <p className="mt-3 text-4xl font-bold text-black">{totalContribution} days</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-black">Total Hours Spent</p>
          <p className="mt-3 text-4xl font-bold text-black">{totalHours.toFixed(2)} Hours</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-black">Average Time</p>
          <p className="mt-3 text-4xl font-bold text-black">{averageTime.toFixed(2)} Hours per day</p>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto pb-2">
        <div className="flex min-w-max justify-between gap-8">
          {visibleMonths.map((month) => (
            <div key={month.label} className="shrink-0">
              <div className="grid grid-flow-col grid-rows-7 gap-1.5 px-1">
                {month.days.map((day) => {
                  const count = yearActivity[day.key] ?? 0;
                  return (
                    <div
                      key={day.key}
                      title={`${day.label}: ${count} activity`}
                      className={`h-4 w-4 rounded ${activityColor(count)}`}
                    />
                  );
                })}
              </div>
              <div className="mt-3 border-t border-[#edf0f5] pt-2 text-center text-lg font-medium text-black">{month.label}</div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

type CourseSort = "default" | "az" | "za" | "completion-desc" | "completion-asc" | "enrolled" | "accessed";
type CourseStatus = "all" | "active" | "completed" | "enrolled" | "expired";
type CyberCourse = (typeof cybersecurityCourses)[number];
type PortalCourse = CyberCourse & {
  id?: number;
  startDate?: string;
  endDate?: string;
  statusOverride?: Exclude<CourseStatus, "all">;
};
type ApiCourse = {
  id: number;
  title: string;
  heading?: string;
  category?: string;
  level?: string;
  status?: string;
  progress_percent?: number;
  assessments?: number;
  labs?: number;
  quizzes?: number;
  modules_count?: number;
  start_date?: string | null;
  end_date?: string | null;
  icon?: string;
  color?: string;
};

const courseSortOptions: Array<{ value: CourseSort; label: string }> = [
  { value: "az", label: "A – Z" },
  { value: "za", label: "Z – A" },
  { value: "completion-desc", label: "Completion percent: 100% – 0%" },
  { value: "completion-asc", label: "Completion percent: 0% – 100%" },
  { value: "enrolled", label: "Recently enrolled" },
  { value: "accessed", label: "Recent accessed" }
];

function apiCourseToPortalCourse(course: ApiCourse): PortalCourse {
  const progress = Math.max(0, Math.min(100, Number(course.progress_percent ?? 0)));
  const statusValue = String(course.status || "active").toLowerCase();
  const statusOverride: Exclude<CourseStatus, "all"> =
    statusValue === "completed" || progress >= 100
      ? "completed"
      : statusValue === "expired"
        ? "expired"
        : statusValue === "enrolled"
          ? "enrolled"
          : "active";
  const formatter = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "2-digit" });
  const formatApiDate = (value?: string | null) => {
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : formatter.format(date);
  };

  return {
    id: course.id,
    title: course.title,
    description: course.heading || "",
    icon: ShieldCheck,
    color: course.color?.startsWith("bg-") ? course.color : "bg-[#3155ff]",
    assessments: Number(course.quizzes ?? course.assessments ?? 0),
    labs: Number(course.modules_count ?? course.labs ?? 0),
    progress,
    start: course.level || course.category || "Course",
    end: statusOverride,
    startDate: formatApiDate(course.start_date),
    endDate: formatApiDate(course.end_date),
    statusOverride
  };
}

function courseCompletion(course: PortalCourse) {
  if (typeof course.progress === "number") return course.progress;
  return 0;
}

function courseStatus(course: PortalCourse): Exclude<CourseStatus, "all"> {
  if (course.statusOverride) return course.statusOverride;
  const progress = courseCompletion(course);
  if (progress >= 100) return "completed";
  if (progress > 0) return "active";
  return "active";
}

function courseDates(course: PortalCourse) {
  return { startDate: course.startDate || "", endDate: course.endDate || "" };
}

function CoursesView({ searchTerm }: { searchTerm: string }) {
  const [sortBy, setSortBy] = useState<CourseSort>("default");
  const [showSort, setShowSort] = useState(false);
  const [filterBy, setFilterBy] = useState<CourseStatus>("all");
  const [pendingFilter, setPendingFilter] = useState<CourseStatus>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [adminCourses, setAdminCourses] = useState<PortalCourse[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const token = window.localStorage.getItem("cyber-academy-auth-token");
    fetch(new URL("/api/courses", apiBaseUrl).toString(), { cache: "no-store", headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((response) => {
        if (!response.ok) throw new Error("Courses unavailable");
        return response.json() as Promise<ApiCourse[]>;
      })
      .then((data) => {
        if (alive) setAdminCourses(data.map(apiCourseToPortalCourse));
      })
      .catch(() => {
        if (alive) setAdminCourses([]);
      })
      .finally(() => {
        if (alive) setCoursesLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const sourceCourses: PortalCourse[] = adminCourses;
  const cleanSearch = searchTerm.trim().toLowerCase();
  const matchingCourses = cleanSearch
    ? sourceCourses.filter((course) => course.title.toLowerCase().includes(cleanSearch))
    : sourceCourses;
  const visibleCourses = [...matchingCourses]
    .filter((course) => filterBy === "all" || courseStatus(course) === filterBy)
    .sort((a, b) => {
      if (sortBy === "az") return a.title.localeCompare(b.title);
      if (sortBy === "za") return b.title.localeCompare(a.title);
      if (sortBy === "completion-desc") return courseCompletion(b) - courseCompletion(a);
      if (sortBy === "completion-asc") return courseCompletion(a) - courseCompletion(b);
      if (sortBy === "enrolled") return sourceCourses.indexOf(b) - sourceCourses.indexOf(a);
      if (sortBy === "accessed") return (sourceCourses.indexOf(a) + 7) % sourceCourses.length - (sourceCourses.indexOf(b) + 7) % sourceCourses.length;
      return 0;
    });

  return (
    <div className="w-full">
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div>
          <h1 className="mb-5 text-xl font-semibold text-black">Recently Viewed</h1>
          {coursesLoading && <div className="mb-4 text-sm text-[#657083]">Loading courses from database...</div>}
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {visibleCourses.slice(0, 3).map((course) => (
              <CourseCard key={course.title} course={course} compact onOpen={() => { if (course.id) window.location.href = `/courses/${course.id}`; }} />
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <h2 className="text-xl font-semibold text-black">My Courses</h2>
            <div className="relative flex gap-3">
              <div className="relative">
                <button type="button" onClick={() => { setShowSort((current) => !current); setShowFilters(false); }} className="flex h-[50px] min-w-[320px] items-center justify-between rounded-md border border-[#cfd6e3] bg-white px-4 text-left text-base text-[#5a5f68]">
                  {courseSortOptions.find((option) => option.value === sortBy)?.label || "Sort By"}
                  <ChevronDown size={19} className={`transition ${showSort ? "rotate-180" : ""}`} />
                </button>
                {showSort && (
                  <div className="absolute right-0 top-[56px] z-30 max-h-[250px] w-[320px] overflow-y-auto rounded-md border border-[#e0e3e9] bg-white py-2 shadow-[0_12px_30px_rgba(17,24,74,.16)]">
                    {courseSortOptions.map((option) => (
                      <button key={option.value} type="button" onClick={() => { setSortBy(option.value); setShowSort(false); }} className={`block w-full px-5 py-4 text-left text-base text-[#5a5f68] hover:bg-[#f0f1f3] ${sortBy === option.value ? "bg-[#e9ecf0]" : ""}`}>{option.label}</button>
                    ))}
                  </div>
                )}
              </div>
              <button type="button" onClick={() => { setShowFilters((current) => !current); setShowSort(false); setPendingFilter(filterBy); }} className="inline-flex h-[50px] items-center gap-2 rounded-md border border-[#dbe0e9] bg-white px-5 text-sm text-[#5a5f68]"><Filter size={16} /> Filters</button>
              {showFilters && (
                <div className="absolute right-0 top-[56px] z-30 w-[340px] rounded-md border border-[#e0e3e9] bg-white p-5 shadow-[0_12px_30px_rgba(17,24,74,.16)]">
                  <div className="flex items-center justify-between border-b border-[#dfe3e8] pb-4">
                    <h3 className="text-lg font-medium text-[#343946]">Status</h3>
                    <button type="button" onClick={() => setShowFilters(false)} className="flex h-5 w-5 items-center justify-center rounded-md border border-[#3155ff] text-[#3155ff]">−</button>
                  </div>
                  <div className="grid gap-4 py-5">
                    {([['active', 'Active'], ['completed', 'Completed'], ['enrolled', 'Enrolled'], ['expired', 'Expired']] as const).map(([value, label]) => (
                      <label key={value} className="flex cursor-pointer items-center gap-3 text-base text-[#202633]">
                        <input type="radio" name="course-status" checked={pendingFilter === value} onChange={() => setPendingFilter(value)} className="h-5 w-5 accent-[#3155ff]" />
                        {label}
                      </label>
                    ))}
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-[#dfe3e8] pt-5">
                    <button type="button" onClick={() => { setPendingFilter("all"); setFilterBy("all"); setShowFilters(false); }} className="px-3 py-3 text-base text-[#5a5f68]">Clear Filter</button>
                    <button type="button" onClick={() => { setFilterBy(pendingFilter); setShowFilters(false); }} className="min-w-[140px] rounded-md bg-[#6f82f7] px-5 py-3 text-base font-medium text-white">Apply</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {visibleCourses.map((course) => (
              <CourseCard key={`my-${course.title}`} course={course} onOpen={() => { if (course.id) window.location.href = `/courses/${course.id}`; }} />
            ))}
          </div>
          {!coursesLoading && visibleCourses.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-[#cfd6e3] bg-white px-6 py-12 text-center">
              <h3 className="text-lg font-semibold text-[#07142f]">No published courses available</h3>
              <p className="mt-2 text-sm text-[#657083]">Courses will appear here after an administrator publishes them.</p>
            </div>
          ) : null}
        </div>

        <aside className="hidden xl:block">
          <h2 className="mb-7 text-xl font-bold text-black">Courses &amp; Badges</h2>
          <div className="space-y-4">
            <SummaryBadge label="Courses Enrolled" value={sourceCourses.length} />
            <SummaryBadge label="Courses Completed" value={sourceCourses.filter((course) => courseStatus(course) === "completed").length} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function CourseCard({
  course,
  compact = false,
  onOpen
}: {
  course: PortalCourse;
  compact?: boolean;
  onOpen?: () => void;
}) {
  const progress = courseCompletion(course);
  const status = courseStatus(course);
  const dates = courseDates(course);
  const statusLabel = status === "completed" ? "Completed" : status === "active" ? "Active" : status === "enrolled" ? "Enrolled" : "Validity Expired";
  return (
    <button type="button" onClick={onOpen} className="block w-full text-left">
      <Card className={`rounded-[10px] border border-[#e1e5ee] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${compact ? "min-h-[390px]" : "min-h-[360px]"}`}>
      <div className="mb-6 flex items-start justify-between">
        <div className={`flex h-14 w-14 items-center justify-center rounded-lg text-white shadow ${course.color}`}>
          <course.icon size={28} strokeWidth={1.8} />
        </div>
        <span className="rounded-md bg-[#f3f5f9] px-2 py-1 text-xs italic text-[#9aa1ad]">i</span>
      </div>
      <h3 className="line-clamp-2 text-lg font-bold text-black">{course.title}</h3>
      <div className="mt-5 h-1.5 rounded-full bg-[#d6d6d6]">
        <div className="h-full rounded-full bg-[#3155ff]" style={{ width: `${progress}%` }} />
      </div>
      <div className={`mt-3 flex justify-between text-sm ${status === "completed" ? "text-[#259b42]" : status === "active" ? "text-[#3155ff]" : "text-red-500"}`}>
        <span>{statusLabel}</span>
        <span>{progress}%</span>
      </div>
      <div className="mt-7 grid grid-cols-2 gap-4 text-sm">
        <CourseStat value={course.assessments} label="Quiz" />
        <CourseStat value={course.labs || "--"} label="Modules" />
        <CourseStat value={dates.startDate} label="Start Date" icon="calendar" />
        <CourseStat value={dates.endDate} label="End Date" icon="calendar" />
      </div>
      </Card>
    </button>
  );
}

function CourseDetailPanel({ course, onClose }: { course: PortalCourse; onClose: () => void }) {
  const progress = courseCompletion(course);
  const dates = courseDates(course);
  const modules = [
    "Learning Contents",
    `${course.assessments} Assessments`,
    `${course.labs} Practice Labs`,
    "Progress Tracking",
    "Completion Certificate"
  ];
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 px-4 py-6">
      <Card className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[22px] border border-[#dfe4f2] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-white ${course.color}`}>
              <course.icon size={28} />
            </span>
            <div>
              <h2 className="text-2xl font-semibold text-black">{course.title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#657083]">
                Course content pushed from the admin portal will appear here with assessments, practice labs, dates, and completion status.
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-[#dbe0e9] px-3 py-2 text-sm text-[#5f6573]">Close</button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <MiniCourseInfo label="Progress" value={`${progress}%`} />
          <MiniCourseInfo label="Start Date" value={dates.startDate} />
          <MiniCourseInfo label="End Date" value={dates.endDate} />
          <MiniCourseInfo label="Status" value={courseStatus(course)} />
        </div>
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-black">Course Contents</h3>
          <div className="mt-3 grid gap-3">
            {modules.map((module, index) => (
              <div key={module} className="flex items-center justify-between rounded-xl border border-[#edf0f5] bg-[#f8fafc] px-4 py-3">
                <span className="text-sm font-medium text-[#25324b]">{index + 1}. {module}</span>
                <span className="rounded-full bg-[#eef2ff] px-3 py-1 text-xs font-semibold text-[#3155ff]">Available</span>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

function MiniCourseInfo({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-[#edf0f5] bg-[#f8fafc] p-3">
      <p className="text-xs text-[#657083]">{label}</p>
      <p className="mt-1 capitalize font-semibold text-[#07142f]">{value}</p>
    </div>
  );
}

function CourseStat({ value, label, icon = "assessment" }: { value: string | number; label: string; icon?: "assessment" | "calendar" }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#f4f7ff] text-[#3155ff]">
        {icon === "calendar" ? <Calendar size={17} /> : <ClipboardCheck size={17} />}
      </span>
      <span>
        <b className="block text-black">{value}</b>
        <span className="text-[#5f6573]">{label}</span>
      </span>
    </div>
  );
}

function SummaryBadge({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-[#e1e5ee] bg-white px-4 py-4 shadow-sm">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eef2ff] text-[#3155ff]">
        <ClipboardCheck size={18} />
      </span>
      <b className="ml-4 mr-auto text-sm text-black">{label}</b>
      <span className="font-bold text-[#001e72]">{value}</span>
    </div>
  );
}

function AssessmentsView() {
  const student = readStudentAccount();
  const [assessments, setAssessments] = useState<SecureAssessmentSummary[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [attempt, setAttempt] = useState<SecureAttempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [acceptedRules, setAcceptedRules] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState("");
  const [startConflict, setStartConflict] = useState<{ error: string; message: string; attempt_id?: number; resume_allowed?: boolean } | null>(null);
  const [timerReady, setTimerReady] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [assessmentSort, setAssessmentSort] = useState<"title" | "duration" | "attempts">("title");
  const [assessmentFilter, setAssessmentFilter] = useState<"all" | "available" | "completed" | "exhausted">("all");
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams(window.location.search);
    const assignmentId = params.get("assignment") || "";
    setSelectedAssignmentId(assignmentId);
    if (params.get("preflight") === "1" && assignmentId && window.sessionStorage.getItem(`cyber-academy-assessment-ready:${assignmentId}`) === "1") {
      setAcceptedRules(true);
      window.sessionStorage.removeItem(`cyber-academy-assessment-ready:${assignmentId}`);
    }
    void loadAssessments(alive, assignmentId);
    return () => {
      alive = false;
    };
  }, []);

  async function loadAssessments(alive = true, requestedAssignmentId = selectedAssignmentId) {
    try {
      const url = new URL("/api/assignments", apiBaseUrl);
      if (student.email) url.searchParams.set("email", student.email);
      if (requestedAssignmentId) url.searchParams.set("assignment", requestedAssignmentId);
      const response = await fetch(url.toString());
      if (!response.ok) throw new Error("Unable to load assessments");
      const data = (await response.json()) as SecureAssessmentSummary[];
      if (alive) setAssessments(data);
    } catch (exc) {
      if (alive) setError(exc instanceof Error ? exc.message : "Unable to load assessments");
    } finally {
      if (alive) setIsLoading(false);
    }
  }

  useEffect(() => {
    if (!attempt || attempt.status !== "in_progress") return;
    setSecondsLeft(attempt.remainingSeconds);
    setTimerReady(true);
    const interval = window.setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);
    return () => {
      setTimerReady(false);
      window.clearInterval(interval);
    };
  }, [attempt]);

  useEffect(() => {
    if (!timerReady || !attempt || attempt.status !== "in_progress" || secondsLeft !== 0) return;
    void submitAttempt(true);
  }, [attempt, secondsLeft, timerReady]);

  useEffect(() => {
    if (!attempt || attempt.status !== "in_progress") return;
    const cleanupKeyboard = installKeyboardBlocker(attempt.security);
    const cleanupMonitor = installViolationMonitor(
      attempt.security,
      (reason) => {
        if (attempt.security.violationPolicy === "warning") {
          void recordAssessmentEvent(attempt.attemptId, "SECURITY_WARNING", reason);
          return;
        }
        if (attempt.security.violationPolicy === "auto_submit") {
          void submitAttempt(true, reason);
          return;
        }
        void terminateAttempt(reason);
      },
      (reason, eventType) => void recordAssessmentEvent(attempt.attemptId, eventType.toUpperCase(), reason),
      4000
    );
    const sync = () => void syncQueuedAnswers();
    window.addEventListener("online", sync);
    const style = document.createElement("style");
    if (attempt.security.disableTextSelection) {
      style.innerHTML = "body.secure-assessment-active, body.secure-assessment-active *{user-select:none!important;-webkit-user-select:none!important}";
      document.head.appendChild(style);
      document.body.classList.add("secure-assessment-active");
    }
    function blockContext(event: MouseEvent) {
      if (attempt?.security.disableRightClick) event.preventDefault();
    }
    function blockDrag(event: DragEvent) {
      if (attempt?.security.disableDrag) event.preventDefault();
    }
    document.addEventListener("contextmenu", blockContext);
    document.addEventListener("dragstart", blockDrag);
    return () => {
      cleanupKeyboard();
      cleanupMonitor();
      window.removeEventListener("online", sync);
      document.removeEventListener("contextmenu", blockContext);
      document.removeEventListener("dragstart", blockDrag);
      document.body.classList.remove("secure-assessment-active");
      style.remove();
      void exitFullscreen().catch(() => undefined);
    };
  }, [attempt]);

  async function startAssessment(assessment: SecureAssessmentSummary) {
    if (!acceptedRules) {
      setError("Please click I Understand before entering the assessment.");
      return;
    }
    setIsStarting(true);
    setError("");
    setStartConflict(null);
    setTimerReady(false);
    try {
      if (assessment.security.requireFullscreen) await enterFullscreen();
      const response = await fetch(`${apiBaseUrl}/api/assignments/${assessment.assignmentId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: student.email || "vikas@cyberlancers.in", device: detectDevice() })
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { detail?: { error?: string; message?: string; attempt_id?: number; resume_allowed?: boolean } | string } | null;
        const detail = typeof data?.detail === "object" ? data.detail : null;
        if (detail?.error) {
          setStartConflict({ error: detail.error, message: detail.message || "Unable to start assessment", attempt_id: detail.attempt_id, resume_allowed: detail.resume_allowed });
          throw new Error(detail.message || "Unable to start assessment");
        }
        throw new Error(typeof data?.detail === "string" ? data.detail : "Unable to start assessment");
      }
      const data = (await response.json()) as SecureAttempt;
      setSecondsLeft(data.remainingSeconds);
      setAttempt(data);
      setAnswers(data.answers || {});
    } catch (exc) {
      await exitFullscreen().catch(() => undefined);
      setError(exc instanceof Error ? exc.message : "Unable to start assessment");
    } finally {
      setIsStarting(false);
    }
  }

  async function recordAssessmentEvent(attemptId: number, eventType: string, reason: string) {
    await fetch(`${apiBaseUrl}/api/assignments/${attemptId}/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_type: eventType, reason, details: { timestamp: new Date().toISOString() } })
    }).catch(() => undefined);
  }

  async function chooseAnswer(questionId: string, optionId: string) {
    if (!attempt || attempt.status !== "in_progress") return;
    const next = { ...answers, [questionId]: optionId };
    setAnswers(next);
    await saveAnswer(apiBaseUrl, attempt.attemptId, questionId, optionId);
  }

  async function terminateAttempt(reason: string) {
    if (!attempt || attempt.status !== "in_progress") return;
    const response = await fetch(`${apiBaseUrl}/api/assignments/${attempt.attemptId}/terminate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, answers })
    });
    if (response.ok) setAttempt((await response.json()) as SecureAttempt);
  }

  async function submitAttempt(autoSubmitted = false, reason = autoSubmitted ? "TIMER_EXPIRED" : "STUDENT_SUBMIT") {
    if (!attempt || attempt.status !== "in_progress") return;
    const response = await fetch(`${apiBaseUrl}/api/assignments/${attempt.attemptId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, answers, auto_submitted: autoSubmitted })
    });
    if (response.ok) setAttempt((await response.json()) as SecureAttempt);
  }

  if (attempt?.status === "terminated") {
    return <AssessmentEnded attempt={attempt} onBack={() => { setAttempt(null); void loadAssessments(); }} />;
  }

  if (attempt && attempt.status !== "in_progress") {
    return <AssessmentResult attempt={attempt} onBack={() => { setAttempt(null); void loadAssessments(); }} />;
  }

  if (attempt) {
    return <>
      <SecureExamRoom
        attempt={attempt}
        answers={answers}
        secondsLeft={secondsLeft}
        onChooseAnswer={chooseAnswer}
        onSubmit={() => setConfirmSubmit(true)}
      />
      {confirmSubmit ? <EndTestConfirmation attempt={attempt} answers={answers} onCancel={() => setConfirmSubmit(false)} onConfirm={() => { setConfirmSubmit(false); void submitAttempt(false); }} /> : null}
    </>;
  }

  return (
    <div className="w-full">
      <div className="grid min-h-[calc(100vh-160px)] gap-5 xl:grid-cols-[1fr_330px]">
        <div>
          <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-xl font-semibold text-black">My Assessments</h1>
              <p className="mt-1 text-sm text-[#687182]">Secure Safe Mode tests with fullscreen, tab monitoring, autosave and server-side scoring.</p>
            </div>
            <div className="flex gap-3">
              <select value={assessmentSort} onChange={(event) => setAssessmentSort(event.target.value as typeof assessmentSort)} className="min-w-[190px] rounded-md border border-[#dbe0e9] bg-white px-4 py-3 text-sm font-medium text-[#5a5f68]"><option value="title">Sort: Title</option><option value="duration">Sort: Duration</option><option value="attempts">Sort: Attempts left</option></select>
              <label className="inline-flex items-center gap-2 rounded-md border border-[#dbe0e9] bg-white px-4 text-sm text-[#5a5f68]"><Filter size={17} /><select value={assessmentFilter} onChange={(event) => setAssessmentFilter(event.target.value as typeof assessmentFilter)} className="bg-transparent py-3 outline-none"><option value="all">All assessments</option><option value="available">Available</option><option value="completed">Completed</option><option value="exhausted">Attempts exhausted</option></select></label>
            </div>
          </div>

          {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          {startConflict?.error === "ACTIVE_ATTEMPT" && startConflict.resume_allowed && (
            <div className="mb-4 rounded-lg border border-[#dbe0e9] bg-white px-4 py-3 text-sm text-[#4f5868]">
              You already have an attempt in progress. Click the same assessment again to resume attempt #{startConflict.attempt_id}.
            </div>
          )}
          {startConflict?.error === "NO_ATTEMPTS_LEFT" && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Attempts Exhausted — {startConflict.message}</div>
          )}

          <Card className="mb-5 rounded-[18px] border border-[#dfe4f2] bg-white p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef2ff] text-[#3155ff]"><ShieldCheck size={24} /></span>
              <div>
                <h2 className="text-lg font-semibold text-[#07142f]">Secure Assessment</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#596273]">This assessment requires Safe Mode. Stay in fullscreen, do not switch tabs, do not minimize the browser, and do not open another window. Leaving the assessment window can immediately terminate your attempt.</p>
                <label className="mt-4 flex cursor-pointer items-center gap-3 text-sm font-medium text-[#07142f]">
                  <input type="checkbox" checked={acceptedRules} onChange={(event) => setAcceptedRules(event.target.checked)} className="h-4 w-4 accent-[#3155ff]" />
                  I Understand
                </label>
              </div>
            </div>
          </Card>

          {isLoading ? (
            <div className="grid min-h-[300px] place-items-center text-[#657083]"><Loader2 className="animate-spin" /></div>
          ) : assessments.length === 0 ? (
            <div className="flex min-h-[560px] items-center justify-center"><NoDataState /></div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              {assessments
                .filter((assessment) => !selectedAssignmentId || assessment.assignmentId === selectedAssignmentId)
                .filter((assessment) => assessmentFilter === "all" || (assessmentFilter === "available" && assessment.canStart) || (assessmentFilter === "completed" && assessment.latestAttemptStatus === "completed") || (assessmentFilter === "exhausted" && assessment.remainingAttempts === 0))
                .sort((a, b) => assessmentSort === "duration" ? a.durationMinutes - b.durationMinutes : assessmentSort === "attempts" ? b.remainingAttempts - a.remainingAttempts : a.title.localeCompare(b.title))
                .map((assessment) => (
                <Card key={assessment.assignmentId} className="rounded-[18px] border border-[#dfe4f2] bg-white p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#3155ff] text-white"><ClipboardCheck size={25} /></span>
                    <span className="rounded-full bg-[#eef2ff] px-3 py-1 text-xs font-semibold text-[#3155ff]">Safe Mode</span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-black">{assessment.title}</h3>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-[#5f6573]">
                    <span>{assessment.questionCount} Questions</span>
                    <span>{assessment.durationMinutes} Minutes</span>
                    <span>Randomized order</span>
                    <span>Admin limit: {assessment.maxAttempts} attempts</span>
                    <span>{assessment.remainingAttempts} attempts remaining</span>
                  </div>
                  {assessment.latestAttemptStatus && (
                    <p className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold capitalize text-emerald-700">
                      <CheckCircle2 size={15} /> Latest status: {assessment.latestAttemptStatus.replace("_", " ")}
                    </p>
                  )}
                  <AssessmentAttemptHistory attempts={assessment.attempts || []} />
                  <button
                    type="button"
                    disabled={!acceptedRules || isStarting || !assessment.canStart}
                    onClick={() => startAssessment(assessment)}
                    className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-[#3155ff] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#aab7ff]"
                  >
                    {isStarting ? <Loader2 size={18} className="animate-spin" /> : assessmentButtonLabel(assessment)}
                  </button>
                </Card>
              ))}
            </div>
          )}
        </div>

        <aside className="hidden xl:block">
          <h2 className="mb-5 text-xl font-bold text-black">Assessments Summary</h2>
          <div className="space-y-4">
            <SummaryBadge label="Assessments Available" value={assessments.length} />
            <SummaryBadge label="Safe Mode Enabled" value={assessments.filter((item) => item.safeMode).length} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function assessmentButtonLabel(assessment: SecureAssessmentSummary) {
  if (assessment.latestAttemptStatus === "in_progress" && assessment.resumeAllowed) {
    return "Resume Assessment";
  }
  if (!assessment.canStart) {
    return "You already took the test";
  }
  if (assessment.attemptsUsed > 0) {
    return "Retake Test";
  }
  return "Enter Fullscreen & Begin";
}

function AssessmentAttemptHistory({ attempts }: { attempts: SecureAssessmentSummary["attempts"] }) {
  const [number, setNumber] = useState(attempts[attempts.length - 1]?.attemptNumber || 0);
  const selected = attempts.find((item) => item.attemptNumber === number) || attempts[attempts.length - 1];
  if (!selected) return null;
  return <div className="mt-4 rounded-lg border border-[#e1e5ee] bg-[#fafbfe] p-3 text-xs text-[#566075]">
    <div className="flex items-center justify-between gap-3"><strong className="text-[#07142f]">Attempt result</strong><select value={selected.attemptNumber} onChange={(event)=>setNumber(Number(event.target.value))} className="rounded border bg-white px-2 py-1.5">{attempts.map((item)=><option key={item.attemptNumber} value={item.attemptNumber}>Attempt {String(item.attemptNumber).padStart(2,"0")}</option>)}</select></div>
    <div className="mt-3 grid grid-cols-2 gap-2"><span>Score: <strong>{selected.score}/100</strong></span><span>Time: <strong>{formatAssessmentDuration(selected.durationSeconds)}</strong></span><span>Tab switches: <strong>{selected.violations}</strong></span><span>Browser: <strong>{selected.browser || "Unknown"}</strong></span></div>
    <p className="mt-2 truncate">IP: {selected.ipAddress || "Unavailable"}</p>
  </div>;
}
function formatAssessmentDuration(seconds: number) { const safe=Math.max(0,Math.floor(seconds||0)); return [Math.floor(safe/3600),Math.floor((safe%3600)/60),safe%60].map((part)=>String(part).padStart(2,"0")).join(":"); }
function EndTestConfirmation({ attempt, answers, onCancel, onConfirm }: { attempt: SecureAttempt; answers: Record<string, string>; onCancel: () => void; onConfirm: () => void }) {
  const [confirmation, setConfirmation] = useState("");
  const answered = Object.keys(answers).length;
  const total = attempt.questions.length;
  return <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-label="End Test confirmation"><div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl sm:p-8"><h2 className="text-2xl font-bold text-[#07142f]">End Test</h2><p className="mt-5 text-base text-[#4d5360]">Are you sure you want to submit this test?</p><p className="mt-3 font-semibold text-red-600">By typing END, the entire test will be submitted.</p><div className="mt-5 overflow-hidden rounded-xl border border-[#dfe4f2]"><div className="bg-[#eef2ff] px-4 py-3 text-center font-bold text-[#07142f]">Test Summary</div><dl className="grid grid-cols-[1fr_auto] gap-y-3 p-4 text-sm"><dt>Number of sections</dt><dd className="font-bold">1</dd><dt>Number of questions</dt><dd className="font-bold">{total}</dd><dt>Answered</dt><dd className="font-bold text-emerald-600">{answered}</dd><dt>Saved in server</dt><dd className="font-bold">{answered}</dd><dt>Skipped</dt><dd className="font-bold text-amber-600">{Math.max(0, total - answered)}</dd><dt>Not viewed</dt><dd className="font-bold">{Math.max(0, total - answered)}</dd></dl></div><label className="mt-5 block"><span className="mb-2 block text-sm font-bold text-[#07142f]">Enter “END” to confirm <b className="text-red-600">*</b></span><input autoFocus value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="h-11 w-full rounded-lg border border-[#cfd6e3] px-3 outline-none focus:border-[#3155ff]" placeholder="END" /></label><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onCancel} className="rounded-lg border border-[#cfd6e3] px-6 py-2.5 font-semibold text-[#4d5360]">No</button><button type="button" disabled={confirmation.trim().toUpperCase() !== "END"} onClick={onConfirm} className="rounded-lg bg-[#3155ff] px-7 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Yes, submit</button></div></div></div>;
}
function SecureExamRoom({ attempt, answers, secondsLeft, onChooseAnswer, onSubmit }: { attempt: SecureAttempt; answers: Record<string, string>; secondsLeft: number; onChooseAnswer: (questionId: string, optionId: string) => void; onSubmit: () => void; }) {
  const [current, setCurrent] = useState(0);
  const [bookmarked, setBookmarked] = useState<Set<string>>(() => new Set());
  const [visited, setVisited] = useState<Set<string>>(() => new Set(attempt.questions[0] ? [attempt.questions[0].id] : []));
  const question = attempt.questions[current];
  const answered = attempt.questions.filter((item) => Boolean(answers[item.id])).length;
  function go(index: number) { const safe = Math.max(0, Math.min(attempt.questions.length - 1, index)); setCurrent(safe); const id = attempt.questions[safe]?.id; if (id) setVisited((value) => new Set(value).add(id)); }
  function toggleBookmark() { if (!question) return; setBookmarked((value) => { const next = new Set(value); if (next.has(question.id)) next.delete(question.id); else next.add(question.id); return next; }); }
  if (!question) return null;
  return <div className="fixed inset-0 z-[70] flex flex-col overflow-hidden bg-[#f4f6fa] text-[#101522]"><div className="shrink-0 border-b border-emerald-200 bg-emerald-50 py-1.5 text-center text-sm font-semibold text-emerald-700">Internet Status: {navigator.onLine ? "Online" : "Offline"}</div><header className="flex shrink-0 flex-wrap items-center gap-4 border-b bg-white px-5 py-3"><h1 className="min-w-[220px] flex-1 font-bold">{attempt.title}</h1><select className="h-10 min-w-[260px] rounded border px-3"><option>Section 1/1 | Questions ({attempt.questions.length})</option></select><span className="text-sm">Question {current + 1} / {attempt.questions.length}</span><span className="rounded border px-3 py-2 font-mono font-bold">{formatTimer(secondsLeft)}</span><button onClick={onSubmit} className="rounded bg-[#153998] px-5 py-2.5 font-bold text-white">Submit Test</button></header><div className="grid min-h-0 flex-1 grid-cols-[150px_minmax(0,1fr)]"><aside className="flex min-h-0 flex-col border-r bg-white"><div className="grid grid-cols-2 gap-2 overflow-y-auto p-3">{attempt.questions.map((item,index) => <button key={item.id} onClick={() => go(index)} className={`h-9 rounded border text-sm font-semibold ${current === index ? "border-[#3155ff] bg-[#3155ff] text-white" : answers[item.id] ? "border-emerald-300 bg-emerald-50 text-emerald-700" : bookmarked.has(item.id) ? "border-amber-300 bg-amber-50" : "border-slate-200"}`}>{index + 1}</button>)}</div><dl className="mt-auto space-y-2 border-t p-3 text-xs"><div className="flex justify-between"><dt>Answered</dt><dd>{answered}/{attempt.questions.length}</dd></div><div className="flex justify-between"><dt>Bookmarked</dt><dd>{bookmarked.size}/{attempt.questions.length}</dd></div><div className="flex justify-between"><dt>Skipped</dt><dd>{Math.max(0, visited.size - answered)}/{attempt.questions.length}</dd></div><div className="flex justify-between"><dt>Not Viewed</dt><dd>{Math.max(0, attempt.questions.length - visited.size)}/{attempt.questions.length}</dd></div><div className="flex justify-between"><dt>Saved in Server</dt><dd>{answered}/{attempt.questions.length}</dd></div></dl></aside><main className="grid min-h-0 grid-cols-1 lg:grid-cols-2"><section className="overflow-y-auto border-r bg-white p-6"><div className="flex items-center justify-between"><p className="text-sm font-bold">Question No: {current + 1} / {attempt.questions.length}</p><button onClick={toggleBookmark} className={`grid h-10 w-10 place-items-center rounded border ${bookmarked.has(question.id) ? "border-amber-400 bg-amber-50 text-amber-600" : "border-slate-300"}`} aria-label="Bookmark question"><Bookmark size={19} fill={bookmarked.has(question.id) ? "currentColor" : "none"} /></button></div><h2 className="mt-8 text-xl font-bold">Multiple Choice Question</h2><p className="mt-5 whitespace-pre-wrap text-base leading-7">{question.text}</p></section><section className="flex min-h-0 flex-col bg-white"><div className="border-b px-6 py-4 text-lg font-bold">Answer here</div><div className="flex-1 overflow-y-auto">{question.options.map((option) => <label key={option.id} className="flex cursor-pointer items-center gap-4 border-b px-6 py-5 hover:bg-slate-50"><input type="radio" name={question.id} checked={answers[question.id] === option.id} onChange={() => onChooseAnswer(question.id, option.id)} className="h-5 w-5" /><span>{option.text}</span></label>)}</div><div className="flex justify-between border-t p-4"><button disabled={current === 0} onClick={() => go(current - 1)} className="inline-flex items-center gap-2 rounded border px-4 py-2 disabled:opacity-40"><ChevronLeft size={17}/>Previous</button><button disabled={current === attempt.questions.length - 1} onClick={() => go(current + 1)} className="inline-flex items-center gap-2 rounded bg-[#3155ff] px-4 py-2 text-white disabled:opacity-40">Next<ChevronRight size={17}/></button></div></section></main></div></div>;
}
function AssessmentEnded({ attempt, onBack }: { attempt: SecureAttempt; onBack: () => void }) {
  return (
    <div className="grid min-h-[calc(100vh-160px)] place-items-center">
      <Card className="max-w-xl rounded-[22px] border border-red-100 bg-white p-8 text-center shadow-sm">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-600"><ShieldCheck size={30} /></span>
        <h1 className="mt-5 text-2xl font-bold text-[#07142f]">Assessment Ended</h1>
        <p className="mt-3 text-sm leading-6 text-[#657083]">Your assessment has been automatically submitted because a prohibited action was detected.</p>
        <div className="mt-5 rounded-xl bg-[#f8fafc] p-4 text-left text-sm">
          <b className="block text-[#07142f]">Reason</b>
          <span className="text-[#5f6573]">{violationText(attempt.terminationReason)}</span>
          <b className="mt-4 block text-[#07142f]">Saved answers</b>
          <span className="text-[#5f6573]">{Object.keys(attempt.answers || {}).length} answers recorded · Score {attempt.score}%</span>
        </div>
        <button type="button" onClick={onBack} className="mt-6 rounded-lg bg-[#3155ff] px-6 py-3 text-sm font-semibold text-white">Back to Assessments</button>
      </Card>
    </div>
  );
}

function AssessmentResult({ attempt, onBack }: { attempt: SecureAttempt; onBack: () => void }) {
  return (
    <div className="grid min-h-[calc(100vh-160px)] place-items-center">
      <Card className="max-w-xl rounded-[22px] border border-[#dfe4f2] bg-white p-8 text-center shadow-sm">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-600"><ClipboardCheck size={30} /></span>
        <h1 className="mt-5 text-2xl font-bold text-[#07142f]">Assessment Submitted</h1>
        <p className="mt-3 text-sm leading-6 text-[#657083]">Your saved answers have been recorded successfully.</p>
        <div className="mt-5 rounded-xl bg-[#f8fafc] p-4 text-sm text-[#5f6573]">
          Score <b className="text-[#07142f]">{attempt.score}%</b> · Status <b className="text-[#07142f]">{attempt.status.replace("_", " ")}</b>
        </div>
        <button type="button" onClick={onBack} className="mt-6 rounded-lg bg-[#3155ff] px-6 py-3 text-sm font-semibold text-white">Back to Assessments</button>
      </Card>
    </div>
  );
}

function NoDataState() {
  return (
    <div className="text-center">
      <div className="relative mx-auto h-56 w-72">
        <div className="absolute left-8 top-10 h-40 w-28 -rotate-14 rounded-md border border-[#8f95a3] bg-white shadow-sm">
          <div className="mx-auto mt-8 h-24 w-20 bg-[#e4e4e4]" />
          <div className="absolute -top-2 left-9 h-8 w-20 rotate-[-8deg] rounded-sm bg-[#6657f4]" />
          <span className="absolute -top-5 left-[62px] h-4 w-4 rounded-full border-4 border-[#6657f4]" />
        </div>
        <div className="absolute right-8 top-16 h-36 w-32 rounded-md border border-[#8f95a3] bg-white shadow-sm">
          <div className="mx-auto mt-8 h-24 w-24 bg-[#e4e4e4]" />
          <div className="absolute -top-2 left-11 h-7 w-20 rounded-sm bg-[#6657f4]" />
          <span className="absolute -top-5 left-[72px] h-4 w-4 rounded-full border-4 border-[#6657f4]" />
        </div>
      </div>
      <p className="mt-3 text-2xl font-semibold text-[#6b6f78]">No data found</p>
    </div>
  );
}

function ComingSoonFeature({ section }: { section: StudentSection }) {
  const labels: Record<string, string> = {
    "company-tests": "Company Specific Test",
    ide: "Open IDE",
    nerd: "Go to NERD"
  };

  return (
    <div className="flex min-h-[calc(100vh-150px)] w-full items-center justify-center">
      <Card className="relative overflow-hidden rounded-[16px] border-0 bg-white p-10 text-center shadow-sm">
        <div className="absolute right-6 top-6 rounded-full bg-[#eef2ff] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[#3155ff]">Soon</div>
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-[#eef2ff] text-[#3155ff]">
          <Sparkles size={34} />
        </div>
        <h1 className="mt-6 text-2xl font-bold text-[#07142f]">{labels[section] || "Module"} is coming soon</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[#6c7280]">
          This section is reserved for the next Cyber Academy release. The layout is ready, and live data will be connected once the module is enabled.
        </p>
      </Card>
    </div>
  );
}

function JobDashboardView({ headerSearch, student, onSectionChange }: { headerSearch: string; student: StudentAccount; onSectionChange: (section: StudentSection) => void }) {
  const [jobs, setJobs] = useState<ExternalJob[]>([]);
  const [applicationStatuses, setApplicationStatuses] = useState<Record<string, JobApplicationRecord>>({});
  const [statusFilter, setStatusFilter] = useState<"all" | JobApplicationStatus>("all");
  const [showAllRecent, setShowAllRecent] = useState(false);
  const [recentJobs, setRecentJobs] = useState<RecentJobRecord[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [appliedHistory, setAppliedHistory] = useState<AppliedJobRecord[]>([]);

  useEffect(() => {
    void loadStoredJobs();
    setApplicationStatuses(readJobApplications());
    setRecentJobs(readRecentJobs());
    void loadAppliedJobs().then(setAppliedHistory).catch(() => setAppliedHistory([]));
    const refreshInterval = window.setInterval(() => void loadStoredJobs(true), 60_000);
    return () => window.clearInterval(refreshInterval);
  }, []);

  useEffect(() => {
    function syncRecentJobs() {
      setRecentJobs(readRecentJobs());
    }

    window.addEventListener("focus", syncRecentJobs);
    return () => window.removeEventListener("focus", syncRecentJobs);
  }, []);

  const filteredJobs = useMemo(() => {
    const term = jobSearchTerm(headerSearch);
    const filtered = jobs.filter((job) => {
      const status = job.id ? applicationStatuses[String(job.id)]?.status || statusForJob(job.id) : "not_applied";
      const matchesTerm = !term || searchableJobText(job).includes(term);
      const matchesStatus = statusFilter === "all" || status === statusFilter;
      return matchesTerm && matchesStatus;
    });

    return [...filtered].sort(compareJobsNewestFirst);
  }, [applicationStatuses, headerSearch, jobs, statusFilter]);

  async function loadStoredJobs(silent = false) {
    if (!silent) setIsLoading(true);
    if (!silent) setErrors({});
    try {
      const url = new URL("/api/jobs/entry-level", apiBaseUrl);
      url.searchParams.set("limit", "500");
      url.searchParams.set("_", String(Date.now()));
      const response = await fetch(url.toString(), { cache: "no-store" });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Backend returned ${response.status}`);
      }
      setJobs(onlyCybersecurityJobs(await response.json()).sort(compareJobsNewestFirst));
      setApplicationStatuses(await syncJobApplicationsFromDatabase());
      setAppliedHistory(await loadAppliedJobs());
    } catch (error) {
      if (!silent) setJobs([]);
      if (!silent) setErrors({
        Search:
          error instanceof Error
            ? error.message
            : "Stored jobs could not be loaded. Make sure the backend is running with npm run dev:all."
      });
    } finally {
      if (!silent) setIsLoading(false);
    }
  }

  const appliedCount = filteredJobs.filter((job) => job.id && (applicationStatuses[String(job.id)]?.status || statusForJob(job.id)) === "applied").length;
  const waitingCount = filteredJobs.filter((job) => job.id && (applicationStatuses[String(job.id)]?.status || statusForJob(job.id)) === "pending").length;
  const notAppliedCount = filteredJobs.filter((job) => !job.id || (applicationStatuses[String(job.id)]?.status || statusForJob(job.id)) === "not_applied").length;
  const appliedJobs = jobs.filter((job) => job.id && (applicationStatuses[String(job.id)]?.status || statusForJob(job.id)) === "applied");
  const waitingJobs = jobs.filter((job) => job.id && (applicationStatuses[String(job.id)]?.status || statusForJob(job.id)) === "pending");
  const notAppliedJobs = jobs.filter((job) => !job.id || (applicationStatuses[String(job.id)]?.status || statusForJob(job.id)) === "not_applied");
  const visibleRecentJobs = showAllRecent ? recentJobs : recentJobs.slice(0, 4);

  return (
    <div className="w-full">
      <div className="mb-5 flex w-fit rounded-md bg-white p-1 shadow-sm">
        <button type="button" onClick={() => onSectionChange("dashboard")} className="rounded px-8 py-2.5 text-sm text-black">Skill</button>
        <button type="button" onClick={() => onSectionChange("course-dashboard")} className="rounded px-8 py-2.5 text-sm text-black">Course</button>
        <button type="button" className="rounded bg-[#3155ff] px-8 py-2.5 text-sm font-medium text-white">Jobs</button>
      </div>
      <h1 className="mb-6 text-xl font-medium text-black">Dashboard</h1>
      <section className="relative overflow-hidden rounded-[12px] bg-[#082a89] px-8 py-9 text-white">
        <div className="relative z-10">
          <h2 className="text-2xl font-semibold">Hello <span className="text-[#ff9f26]">{student.fullName || "Student"}</span> 👋</h2>
          <p className="mt-5 max-w-4xl text-base leading-8 text-white/70">Welcome to our placement portal. Explore verified fresher cybersecurity opportunities matched to your interests and career goals.</p>
        </div>
        <span className="absolute -bottom-7 right-12 text-[84px] font-medium text-white/15">Hello {student.firstName || "Student"}</span>
      </section>
      <div className="relative z-10 -mt-8 mb-7 grid gap-4 lg:grid-cols-5 lg:px-7">
        <JobSummaryMetric value={jobs.length} label="Available jobs" tone="blue" />
        <JobSummaryMetric value={appliedCount} label="Applied" tone="indigo" />
        <JobSummaryMetric value={appliedHistory.length} label="Confirmed applications" tone="green" />
        <JobSummaryMetric value={waitingCount} label="Waiting" tone="orange" />
        <JobSummaryMetric value={notAppliedCount} label="Not Applied" tone="red" />
      </div>

      <div className="block">
        <div>
          <Card className="mb-6 rounded-[18px] border-0 bg-white p-7 shadow-sm">
            <h2 className="text-xl font-semibold text-black">Applied Jobs</h2>
            <p className="mt-2 text-sm text-[#6c7280]">Your confirmed applications, shown in Indian Standard Time.</p>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {appliedHistory.map((item) => (
                <Link key={item.applicationId} href={`/jobs/${item.jobId}`} className="rounded-xl border border-[#e1e5ee] p-4 transition hover:border-[#3155ff]">
                  <p className="font-bold text-[#07142f]">{item.title}</p>
                  <p className="mt-1 text-sm text-[#5a5f68]">{item.company}{item.location ? ` · ${item.location}` : ""}</p>
                  <p className="mt-3 text-xs font-semibold text-[#1e8d35]">Applied · {new Date(item.appliedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "medium", timeZone: "Asia/Kolkata" })} IST</p>
                </Link>
              ))}
              {!appliedHistory.length ? <p className="text-sm text-[#747b8a]">No confirmed job applications yet.</p> : null}
            </div>
          </Card>
          <Card className="mb-6 rounded-[18px] border-0 bg-white p-7 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <h1 className="text-xl font-semibold text-black">Jobs Status</h1>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | JobApplicationStatus)} className="h-11 min-w-[190px] rounded-md border border-[#dbe0e9] bg-white px-4 text-sm text-[#5a5f68] outline-none">
                <option value="all">All</option>
                <option value="applied">Applied</option>
                <option value="pending">Waiting</option>
                <option value="not_applied">Not Applied</option>
              </select>
            </div>

            {Object.keys(errors).length > 0 && (
              <Card className="mb-5 rounded-[12px] border-0 bg-white p-5 shadow-sm">
                <h2 className="font-semibold text-[#07142f]">Fetch warnings</h2>
                <div className="mt-3 space-y-2 text-sm text-[#5a5f68]">
                  <p>Some jobs could not be fetched or loaded. Try again after a moment.</p>
                </div>
              </Card>
            )}

            <div className="mt-6 max-h-[720px] space-y-3 overflow-y-auto pr-2">
              {filteredJobs.filter((job) => job.id).map((job) => {
                const status = job.id ? applicationStatuses[String(job.id)]?.status || statusForJob(job.id) : "not_applied";
                return (
                  <a
                    key={`${job.id}-${job.apply_url}-${job.title}`}
                    href={`/jobs/${job.id}`}
                    className="block h-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3155ff] focus-visible:ring-offset-2"
                  >
                    <JobStatusRow job={job} status={status} />
                  </a>
                )
              })}
              {!isLoading && filteredJobs.length === 0 && (
                <div className="md:col-span-2 xl:col-span-3">
                  <EmptyFeature title="No fresher cybersecurity jobs found" text="Try Search Jobs again or fetch the latest fresher cybersecurity openings." />
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <JobInsightPanel title="Best Performing Jobs" jobs={[...appliedJobs].sort((a, b) => b.match_score - a.match_score)} emptyText="No applied jobs yet" />
          <JobInsightPanel title="Least Performing Jobs" jobs={waitingJobs} emptyText="No waiting results" />
          <JobInsightPanel title="Latest opportunities" jobs={[...jobs].sort(compareJobsNewestFirst)} emptyText="No current opportunities" />
          <JobInsightPanel title="Eligible not Opted in Jobs" jobs={notAppliedJobs} emptyText="No pending opportunities" />
        </div>

        <div className="mt-7 grid gap-5 xl:grid-cols-2">
          <RoundWiseJobStatus applied={appliedJobs.length} waiting={waitingJobs.length} notApplied={notAppliedJobs.length} />
          <JobStrengthArea jobs={jobs} />
        </div>

        <aside className="hidden">
          <h2 className="mb-5 text-xl font-bold text-black">Summary</h2>
          <div className="space-y-4">
            <SummaryRow label="No. of Jobs" value={filteredJobs.length} />
            <SummaryRow label="Applied" value={appliedCount} />
            <SummaryRow label="Waiting" value={waitingCount} />
            <SummaryRow label="Not Applied" value={notAppliedCount} />
          </div>

          <div className="mt-10">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-black">Recently Consumed</h2>
              {recentJobs.length > 4 && (
                <button type="button" onClick={() => setShowAllRecent((current) => !current)} className="text-sm font-semibold text-[#3155ff]">
                  {showAllRecent ? "View less" : "View more"}
                </button>
              )}
            </div>
            <div className="space-y-4">
              {visibleRecentJobs.map((job) => (
                <Link key={`recent-${job.id}-${job.openedAt}`} href={`/jobs/${job.id}`} className="block rounded-md border border-[#e1e5ee] bg-white p-3 shadow-sm">
                  <p className="line-clamp-1 text-sm font-bold text-black">{job.company || job.title}</p>
                  <p className="mt-1 line-clamp-1 text-xs text-[#5f6573]">{job.title}</p>
                  <p className="mt-2 text-xs font-semibold text-[#5f6573]">{formatDate(new Date(job.openedAt))}</p>
                </Link>
              ))}
              {!recentJobs.length && (
                <div className="rounded-md border border-dashed border-[#dbe0e9] bg-white p-4 text-sm text-[#747b8a]">
                  Open a job to see it here.
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function JobsView({ headerSearch }: { headerSearch: string }) {
  const [activeTab, setActiveTab] = useState<"my" | "all">("my");
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [jobs, setJobs] = useState<ExternalJob[]>([]);
  const [applicationStatuses, setApplicationStatuses] = useState<Record<string, JobApplicationRecord>>({});
  const [statusFilter, setStatusFilter] = useState<"all" | JobApplicationStatus>("all");
  const [sortBy, setSortBy] = useState<"match" | "newest" | "title" | "salary">("newest");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showAllRecent, setShowAllRecent] = useState(false);
  const [recentJobs, setRecentJobs] = useState<RecentJobRecord[]>([]);
  const [locationSuggestions, setLocationSuggestions] = useState(defaultJobLocations);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [appliedHistory, setAppliedHistory] = useState<AppliedJobRecord[]>([]);
  const [dailySearchTime, setDailySearchTime] = useState("09:00");
  const [dailySearchActive, setDailySearchActive] = useState(false);
  const [scheduleNotice, setScheduleNotice] = useState("");

  useEffect(() => {
    if (headerSearch) setQuery(`${headerSearch} cybersecurity fresher`);
  }, [headerSearch]);

  useEffect(() => {
    void loadStoredJobs();
    void loadLocationSuggestions();
    setApplicationStatuses(readJobApplications());
    setRecentJobs(readRecentJobs());
    void loadAppliedJobs().then(setAppliedHistory).catch(() => setAppliedHistory([]));
    void loadJobSearchPreference();
    const refreshInterval = window.setInterval(() => void loadStoredJobs(location.trim(), true), 60_000);
    return () => window.clearInterval(refreshInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function syncRecentJobs() {
      setRecentJobs(readRecentJobs());
      void syncJobApplicationsFromDatabase().then(setApplicationStatuses);
    }

    window.addEventListener("focus", syncRecentJobs);
    return () => window.removeEventListener("focus", syncRecentJobs);
  }, []);

  const mergedLocationSuggestions = useMemo(() => {
    const fromJobs = jobs.flatMap((job) => job.location.split(",").map((item) => item.trim()).filter(Boolean));
    return Array.from(new Set([...locationSuggestions, ...fromJobs]))
      .filter((item) => item.length > 1)
      .sort((a, b) => a.localeCompare(b));
  }, [jobs, locationSuggestions]);

  const filteredJobs = useMemo(() => {
    const searchTerm = jobSearchTerm(query);
    const locationTerm = location.trim().toLowerCase();
    const filtered = jobs.filter((job) => {
      const status = job.id ? applicationStatuses[String(job.id)]?.status || statusForJob(job.id) : "not_applied";
      const matchesSearch = !searchTerm || searchableJobText(job).includes(searchTerm);
      const matchesLocation = !locationTerm || job.location.toLowerCase().includes(locationTerm);
      const matchesStatus = statusFilter === "all" || status === statusFilter;
      return matchesSearch && matchesLocation && matchesStatus;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === "title") return a.title.localeCompare(b.title);
      if (sortBy === "newest") return compareJobsNewestFirst(a, b);
      if (sortBy === "salary") return salaryNumber(b.salary) - salaryNumber(a.salary);
      return (b.match_score || 0) - (a.match_score || 0);
    });
  }, [applicationStatuses, jobs, location, query, sortBy, statusFilter]);

  async function loadStoredJobs(locationOverride = location.trim(), silent = false) {
    if (!silent) setIsLoading(true);
    if (!silent) setErrors({});
    try {
      const url = new URL("/api/jobs/entry-level", apiBaseUrl);
      if (locationOverride) url.searchParams.set("location", locationOverride);
      url.searchParams.set("limit", "500");
      url.searchParams.set("_", String(Date.now()));
      const response = await fetch(url.toString(), { cache: "no-store" });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Backend returned ${response.status}`);
      }
      setJobs(onlyCybersecurityJobs(await response.json()).sort(compareJobsNewestFirst));
      setApplicationStatuses(await syncJobApplicationsFromDatabase());
      setAppliedHistory(await loadAppliedJobs());
    } catch (error) {
      if (!silent) setJobs([]);
      if (!silent) setErrors({ Load: error instanceof Error ? error.message : "Stored jobs could not be loaded. Make sure the backend is running." });
    } finally {
      if (!silent) setIsLoading(false);
    }
  }

  async function loadLocationSuggestions() {
    try {
      const url = new URL("/api/jobs/locations", apiBaseUrl);
      url.searchParams.set("limit", "120");
      const response = await fetch(url.toString());
      if (!response.ok) return;
      const data = (await response.json()) as string[];
      setLocationSuggestions(Array.from(new Set([...defaultJobLocations, ...data.filter(Boolean)])));
    } catch {
      setLocationSuggestions(defaultJobLocations);
    }
  }

  async function searchJobs(searchTerm = query.trim(), nextLocation = location.trim()) {
    setIsLoading(true);
    setIsScraping(true);
    setErrors({});
    try {
      const cleanQuery = searchTerm.length >= 2 ? searchTerm : "cybersecurity fresher";
      const refreshUrl = new URL("/api/jobs/refresh", apiBaseUrl);
      refreshUrl.searchParams.set("q", cleanQuery);
      refreshUrl.searchParams.set("location", nextLocation || "India");
      refreshUrl.searchParams.set("platforms", jobPlatforms.join(","));
      refreshUrl.searchParams.set("limit_per_source", "6");

      const refreshResponse = await fetch(refreshUrl.toString(), { method: "POST" });
      if (!refreshResponse.ok) {
        const message = await refreshResponse.text();
        throw new Error(message || `Job scraping failed (${refreshResponse.status})`);
      }
      await loadStoredJobs(nextLocation);
    } catch (error) {
      setErrors({ Search: error instanceof Error ? error.message : "Job search failed. Make sure the backend and MySQL are running." });
      setIsLoading(false);
    } finally {
      setIsScraping(false);
    }
  }

  async function searchCybersecurityFresherJobs() {
    setQuery("");
    setLocation("");
    setStatusFilter("all");
    await searchJobs("cybersecurity fresher", "");
  }

  async function loadJobSearchPreference() {
    const token = window.localStorage.getItem("cyber-academy-auth-token");
    if (!token) return;
    const response = await fetch(`${apiBaseUrl}/api/job-search-preference`, { cache: "no-store", headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) return;
    const data = await response.json() as { search_time_ist: string; active: boolean };
    setDailySearchTime(data.search_time_ist);
    setDailySearchActive(data.active);
  }

  async function saveJobSearchPreference() {
    const token = window.localStorage.getItem("cyber-academy-auth-token");
    if (!token) return setScheduleNotice("Please log in again to save this schedule.");
    setScheduleNotice("");
    const response = await fetch(`${apiBaseUrl}/api/job-search-preference`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ search_time_ist: dailySearchTime, active: dailySearchActive })
    });
    if (!response.ok) return setScheduleNotice("Daily search schedule could not be saved.");
    setScheduleNotice(dailySearchActive ? `Daily cybersecurity job search scheduled for ${dailySearchTime} IST.` : "Automatic daily job search disabled.");
  }

  const appliedCount = jobs.filter((job) => job.id && (applicationStatuses[String(job.id)]?.status || statusForJob(job.id)) === "applied").length;
  const waitingCount = jobs.filter((job) => job.id && (applicationStatuses[String(job.id)]?.status || statusForJob(job.id)) === "pending").length;
  const visibleRecentJobs = showAllRecent ? recentJobs : recentJobs.slice(0, 5);

  return (
    <div className="w-full">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <div className="mb-6 flex w-fit rounded-md bg-white p-1 shadow-sm">
            <button type="button" onClick={() => setActiveTab("my")} className={`rounded px-8 py-2.5 text-sm ${activeTab === "my" ? "bg-[#3155ff] font-medium text-white" : "text-black"}`}>My Jobs</button>
            <button type="button" onClick={() => setActiveTab("all")} className={`rounded px-8 py-2.5 text-sm ${activeTab === "all" ? "bg-[#3155ff] font-medium text-white" : "text-black"}`}>All Jobs</button>
          </div>

          <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <h1 className="text-xl font-medium text-black">{activeTab === "my" ? "My Jobs" : "All Jobs"}</h1>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={searchCybersecurityFresherJobs} disabled={isLoading} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#3155ff] px-5 text-sm font-medium text-white shadow-sm disabled:opacity-60">
                {isScraping ? <Loader2 size={17} className="animate-spin" /> : <Search size={17} />} Search Jobs
              </button>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)} className="h-11 min-w-[230px] rounded-md border border-[#d2d8e4] bg-white px-4 text-sm text-[#5f6573] outline-none">
                <option value="match">Sort By</option>
                <option value="newest">Recently posted</option>
                <option value="title">A - Z</option>
                <option value="salary">Highest CTC</option>
              </select>
              <button type="button" onClick={() => setIsFilterOpen((current) => !current)} className="inline-flex h-11 items-center gap-3 rounded-md border border-[#d2d8e4] bg-white px-5 text-sm text-[#5f6573]">
                <Filter size={18} /> Filters
              </button>
            </div>
          </div>

          <Card className="mb-5 rounded-[12px] border border-[#dfe4ef] bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div><h2 className="font-bold text-[#07142f]">Automatic Daily Job Search</h2><p className="mt-1 text-sm text-[#6c7280]">The backend fetches fresh cybersecurity jobs daily at your selected IST time, even when this page is closed.</p></div>
              <div className="flex flex-wrap items-end gap-3"><label><span className="mb-1 block text-xs font-bold text-[#5a5f68]">Search time (IST)</span><input type="time" value={dailySearchTime} onChange={(event) => setDailySearchTime(event.target.value)} className="h-11 rounded-md border border-[#dbe0e9] px-3" /></label><label className="flex h-11 items-center gap-2 rounded-md border border-[#dbe0e9] px-3 text-sm"><input type="checkbox" checked={dailySearchActive} onChange={(event) => setDailySearchActive(event.target.checked)} className="h-4 w-4 accent-[#3155ff]" /> Enabled</label><button type="button" onClick={() => void saveJobSearchPreference()} className="h-11 rounded-md bg-[#3155ff] px-5 text-sm font-bold text-white">Save Schedule</button></div>
            </div>
            {scheduleNotice ? <p className="mt-3 text-sm font-semibold text-[#3155ff]">{scheduleNotice}</p> : null}
          </Card>

          {isFilterOpen && (
            <Card className="mb-5 rounded-[8px] border border-[#dfe4ef] bg-white p-5 shadow-sm">
              <div className="grid gap-4 lg:grid-cols-[1fr_220px_180px_auto]">
                <label className="flex h-11 items-center gap-2 rounded-md border border-[#dbe0e9] px-3">
                  <Search size={17} className="text-[#808795]" />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cybersecurity fresher" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
                </label>
                <label className="flex h-11 items-center gap-2 rounded-md border border-[#dbe0e9] px-3">
                  <MapPin size={17} className="text-[#3155ff]" />
                  <input value={location} onChange={(event) => setLocation(event.target.value)} list="job-location-options" placeholder="Location" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
                  <datalist id="job-location-options">{mergedLocationSuggestions.map((item) => <option key={item} value={item} />)}</datalist>
                </label>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="h-11 rounded-md border border-[#dbe0e9] bg-white px-3 text-sm outline-none">
                  <option value="all">All status</option>
                  <option value="applied">Applied</option>
                  <option value="pending">Waiting</option>
                  <option value="not_applied">Not Applied</option>
                </select>
                <button type="button" onClick={() => searchJobs()} disabled={isLoading} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#3155ff] px-5 text-sm font-medium text-white disabled:opacity-60">
                  {isScraping ? <Loader2 size={17} className="animate-spin" /> : <RefreshCw size={17} />} Fetch Jobs
                </button>
              </div>
            </Card>
          )}

          {Object.keys(errors).length > 0 && (
            <Card className="mb-5 rounded-[8px] border border-[#ffe1b8] bg-[#fffaf0] p-4 text-sm text-[#7a4d00]">
              Real jobs could not be loaded right now. Check that the backend and MySQL are running, then use Fetch Jobs.
            </Card>
          )}

          {activeTab === "my" ? <div><h2 className="mb-4 text-lg font-bold text-black">Applied Jobs ({appliedHistory.length})</h2><div className="grid gap-4 md:grid-cols-2">{appliedHistory.map((item) => <Link key={item.applicationId} href={`/jobs/${item.jobId}`} className="rounded-xl border border-[#e1e5ee] bg-white p-5 shadow-sm hover:border-[#3155ff]"><p className="font-bold text-black">{item.title}</p><p className="mt-1 text-sm text-[#5a5f68]">{item.company}{item.location ? ` · ${item.location}` : ""}</p><p className="mt-3 text-xs font-bold text-[#1e8d35]">Applied {new Date(item.appliedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })} IST</p></Link>)}</div>{!appliedHistory.length ? <EmptyFeature title="No applied jobs yet" text="Jobs you confirm as Applied will appear here with the application date and time." /> : null}</div>
          : <><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold text-black">Latest Jobs</h2><span className="text-sm text-[#6c7280]">Newest fetched jobs appear first</span></div><div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">{filteredJobs.map((job) => <JobCard key={`${job.id}-${job.apply_url}-${job.title}`} job={job} status={job.id ? applicationStatuses[String(job.id)]?.status || statusForJob(job.id) : "not_applied"} />)}</div>{!isLoading && filteredJobs.length === 0 && <EmptyFeature title="No fresher cybersecurity jobs found" text="Fetch jobs to load the latest verified cybersecurity openings from the database." />}</>}
        </div>

        <aside className="xl:sticky xl:top-24 xl:self-start">
          <h2 className="mb-5 text-xl font-semibold text-black">Summary</h2>
          <div className="space-y-4">
            <SummaryRow label="No. of Jobs" value={jobs.length} />
            <SummaryRow label="Placed" value={0} />
            <SummaryRow label="Waiting" value={waitingCount} />
          </div>

          <div className="mt-10">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-black">Recently Consumed</h2>
              {recentJobs.length > 5 && (
                <button type="button" onClick={() => setShowAllRecent((current) => !current)} className="text-sm font-medium text-[#3155ff]">
                  {showAllRecent ? "View less" : "View more"}
                </button>
              )}
            </div>
            <div className="max-h-[300px] space-y-3 overflow-y-auto pr-2">
              {visibleRecentJobs.map((job) => (
                <Link key={`recent-${job.id}-${job.openedAt}`} href={`/jobs/${job.id}`} className="block rounded-md border border-[#e1e5ee] bg-white p-3 shadow-sm">
                  <p className="line-clamp-1 text-sm font-semibold text-black">{job.company || job.title}</p>
                  <p className="mt-2 text-xs text-[#5f6573]">{formatDate(new Date(job.openedAt))} | {formatTime(new Date(job.openedAt))}</p>
                </Link>
              ))}
              {!recentJobs.length && <div className="rounded-md border border-dashed border-[#dbe0e9] bg-white p-4 text-sm text-[#747b8a]">Open a job to see it here.</div>}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function JobCard({ job, status }: { job: ExternalJob; status: JobApplicationStatus }) {
  return (
    <Link href={job.id ? `/jobs/${job.id}` : job.apply_url} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3155ff] focus-visible:ring-offset-2">
      <Card className="relative flex min-h-[414px] flex-col overflow-hidden rounded-[8px] border border-[#dde3ee] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-md bg-[#f5f7fb] text-lg font-medium text-[#3155ff]">
            {job.company_logo ? <Image src={job.company_logo} alt={`${job.company} logo`} width={56} height={56} unoptimized className="max-h-14 max-w-14 object-contain" /> : getCompanyInitials(job.company || job.title)}
          </div>
          <ApplicationBadge status={status} />
        </div>

        <h3 className="line-clamp-2 min-h-[56px] text-lg font-medium leading-7 text-black">{job.company || job.title}</h3>
        {job.company && job.title !== job.company && <p className="mt-1 line-clamp-1 text-sm text-[#4d5360]">{job.title}</p>}
        <div className="mt-7 space-y-3 text-sm text-[#4d5360]">
          <p className="flex items-center gap-2 text-[#3155ff]"><MapPin size={15} />{job.location || "Not Provided"}</p>
          <p className="flex items-center gap-2"><RefreshCw size={14} />{job.experience || job.employment_type || "Fresher / Entry Level"}</p>
          {job.skills[0] && <span className="inline-flex rounded-full border border-[#e4e8f0] px-3 py-1 text-xs text-[#5f6573]">{job.skills[0]}</span>}
        </div>

        <div className="mt-auto grid grid-cols-2 gap-4 pt-7 text-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#f5f7ff] text-[#3155ff]"><IdCard size={18} /></span>
            <span><strong className="block font-semibold text-black">{formatSalary(job.salary)}</strong><span className="text-[#5f6573]">CTC</span></span>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#f5f7ff] text-[#3155ff]"><Calendar size={18} /></span>
            <span><strong className="block font-semibold text-black">{formatPostedDate(job.posted_date, job.created_at)}</strong><span className="text-[#5f6573]">Round Date</span></span>
          </div>
        </div>

      </Card>
    </Link>
  );
}

function salaryNumber(value: string) {
  const match = value.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}

function JobSummaryMetric({ value, label, tone }: { value: number; label: string; tone: "blue" | "indigo" | "green" | "orange" | "red" }) {
  const tones = {
    blue: "bg-[#e7edff] text-[#3155ff]",
    indigo: "bg-[#edf0fa] text-[#082a89]",
    green: "bg-[#e5f5e5] text-[#43b84a]",
    orange: "bg-[#fff0dc] text-[#ff9f26]",
    red: "bg-[#fde6e8] text-[#ff4858]"
  };
  return <Card className="flex min-h-[105px] items-center gap-4 rounded-[10px] border border-[#e1e5ee] bg-white p-4 shadow-sm"><span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${tones[tone]}`}><UserRound size={25} /></span><span><strong className="block text-2xl text-[#07142f]">{value}</strong><span className="mt-2 block text-sm text-[#5f6573]">{label}</span></span></Card>;
}

function JobStatusRow({ job, status }: { job: ExternalJob; status: JobApplicationStatus }) {
  return (
    <Card className="grid min-h-[108px] items-center gap-4 rounded-[8px] border border-[#edf0f5] bg-[#fbfcff] p-5 transition hover:border-[#bfcaff] hover:bg-white hover:shadow-md md:grid-cols-[64px_minmax(0,1fr)_180px_170px_120px]">
      <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-md border border-[#dfe4ef] bg-white text-sm font-medium text-[#3155ff]">
        {job.company_logo ? <Image src={job.company_logo} alt={`${job.company} logo`} width={48} height={48} unoptimized className="max-h-12 max-w-12 object-contain" /> : getCompanyInitials(job.company || job.title)}
      </div>
      <div className="min-w-0">
        <h3 className="truncate text-base font-medium text-[#07142f]">{job.title || "Cybersecurity Fresher Role"}</h3>
        <p className="mt-2 truncate text-sm text-[#3155ff]">{job.company || "Company not listed"}</p>
        <p className="mt-1 flex items-center gap-1 truncate text-xs text-[#6b7280]"><MapPin size={13} />{job.location || "Location not provided"}</p>
      </div>
      <div className="text-sm text-[#5f6573]"><span className="block text-xs text-[#9299a6]">Salary</span><strong className="mt-1 block text-[#07142f]">{formatSalary(job.salary)}</strong></div>
      <div className="text-sm text-[#5f6573]"><span className="block text-xs text-[#9299a6]">Employment</span><strong className="mt-1 block text-[#07142f]">{job.employment_type || "Full Time"}</strong><span className="mt-1 block text-xs">{formatPostedDate(job.posted_date, job.created_at)}</span></div>
      <div className="justify-self-start md:justify-self-end"><ApplicationBadge status={status} /><span className="mt-3 block text-xs font-medium text-[#3155ff]">View details →</span></div>
    </Card>
  );
}

function JobInsightPanel({ title, jobs, emptyText }: { title: string; jobs: ExternalJob[]; emptyText: string }) {
  return (
    <Card className="h-[492px] rounded-[22px] border-0 bg-white p-6 shadow-[0_8px_24px_rgba(17,24,74,.04)]">
      <h2 className="border-b border-[#edf0f5] pb-6 text-base font-semibold text-[#07142f]">{title}</h2>
      <div className="mt-3 max-h-[390px] space-y-3 overflow-y-auto pr-2">
        {jobs.slice(0, 12).map((job) => (
          <Link key={`${title}-${job.id}`} href={`/jobs/${job.id}`} className="flex min-h-[82px] items-center gap-4 rounded-md px-2 py-2 transition hover:bg-[#f5f7ff]">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-[#3155ff] text-white"><MapPin size={27} strokeWidth={1.8} /></span>
            <span className="min-w-0"><strong className="block truncate text-sm text-[#4d5360]">{job.company || job.title}</strong><span className="mt-2 flex items-center gap-1 truncate text-xs text-[#3155ff]"><MapPin size={12} />{job.title}</span></span>
          </Link>
        ))}
        {!jobs.length && <div className="flex min-h-[340px] flex-col items-center justify-center text-center text-[#5f6573]"><span className="relative block h-40 w-44"><i className="absolute left-4 top-5 h-32 w-24 -rotate-12 rounded border border-[#8e96aa] bg-white" /><i className="absolute right-4 top-10 h-32 w-24 rounded border border-[#8e96aa] bg-[#f0f0f0]" /><i className="absolute right-10 top-6 h-5 w-16 rounded bg-[#6c5cff]" /></span><span className="mt-2">{emptyText}</span></div>}
      </div>
    </Card>
  );
}

function RoundWiseJobStatus({ applied, waiting, notApplied }: { applied: number; waiting: number; notApplied: number }) {
  const total = Math.max(1, applied + waiting + notApplied);
  const items = [{ label: "Applied", value: applied, color: "bg-[#4eb34e]" }, { label: "Waiting", value: waiting, color: "bg-[#ffad36]" }, { label: "Not Applied", value: notApplied, color: "bg-[#e71919]" }];
  return <Card className="min-h-[500px] rounded-[22px] border-0 bg-white p-8 shadow-[0_8px_24px_rgba(17,24,74,.04)]"><div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#edf0f5] pb-6"><h2 className="text-xl font-semibold">Round Wise Status</h2><div className="flex gap-4 text-sm">{items.map((item) => <span key={item.label} className="flex items-center gap-2"><i className={`h-4 w-4 rounded-full ${item.color}`} />{item.label}</span>)}</div></div><div className="mt-12 grid h-72 grid-cols-3 items-end gap-8 px-8">{items.map((item) => <div key={item.label} className="text-center"><strong className="mb-2 block text-xl">{item.value}</strong><div className={`mx-auto w-20 rounded-t-lg ${item.color}`} style={{ height: `${Math.max(12, item.value / total * 220)}px` }} /><span className="mt-3 block text-xs text-[#747b8a]">{item.label}</span></div>)}</div></Card>;
}

function JobStrengthArea({ jobs }: { jobs: ExternalJob[] }) {
  const counts = new Map<string, number>();
  jobs.forEach((job) => job.skills.forEach((skill) => { const clean = skill.trim(); if (clean) counts.set(clean, (counts.get(clean) || 0) + 1); }));
  const skills = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = Math.max(1, ...skills.map(([, count]) => count));
  return <Card className="min-h-[500px] rounded-[22px] border-0 bg-white p-8 shadow-[0_8px_24px_rgba(17,24,74,.04)]"><h2 className="border-b border-[#edf0f5] pb-6 text-xl font-semibold">Round Strong and Weak Area</h2><div className="mt-8 space-y-6">{skills.map(([skill, count], index) => <div key={skill}><div className="mb-2 flex justify-between text-sm"><span>{skill}</span><span>{count} jobs</span></div><div className="h-3 rounded-full bg-[#edf0f5]"><div className={`h-full rounded-full ${index < 3 ? "bg-[#4eb34e]" : "bg-[#ffad36]"}`} style={{ width: `${count / max * 100}%` }} /></div></div>)}{!skills.length && <div className="flex min-h-[330px] items-center justify-center text-[#747b8a]">Skill data will appear when jobs are loaded.</div>}</div></Card>;
}

function onlyCybersecurityJobs(payload: unknown) {
  const jobs = Array.isArray(payload) ? payload.map(normalizeExternalJob).filter(Boolean) : [];
  return dedupePortalJobs(jobs.filter((job): job is ExternalJob => Boolean(job && job.id && job.title.trim())));
}

function compareJobsNewestFirst(a: ExternalJob, b: ExternalJob) {
  const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0;
  const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0;
  if (Number.isFinite(aCreated) && Number.isFinite(bCreated) && aCreated !== bCreated) {
    return bCreated - aCreated;
  }
  return Number(b.id || 0) - Number(a.id || 0);
}

function dedupePortalJobs(jobs: ExternalJob[]) {
  const seen = new Set<string>();
  const unique: ExternalJob[] = [];

  for (const job of jobs) {
    const key = portalJobDedupeKey(job);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(job);
  }

  return unique;
}

function portalJobDedupeKey(job: ExternalJob) {
  const title = normalizeDedupeText(job.title);
  const company = normalizeDedupeText(job.company);
  const location = normalizeDedupeText(job.location);
  const applyUrl = normalizeApplyUrl(job.apply_url);
  return title && company ? `${title}|${company}|${location}` : applyUrl || `${job.id}`;
}

function normalizeDedupeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeApplyUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    return url.toString().toLowerCase();
  } catch {
    return normalizeDedupeText(value);
  }
}

function normalizeExternalJob(value: unknown): ExternalJob | null {
  if (!value || typeof value !== "object") return null;
  const job = value as RawExternalJob;
  const idValue = job.id;
  const id = typeof idValue === "number" ? idValue : Number(idValue);
  const title = stringField(job.title);
  if (!Number.isFinite(id) || !title.trim()) return null;

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
    company_logo: nullableStringField(job.company_logo ?? job.companyLogo),
    platform: stringField(job.platform),
    match_score: numberField(job.match_score ?? job.matchScore),
    is_entry_level: booleanField(job.is_entry_level ?? job.isEntryLevel, true),
    created_at: stringField(job.created_at ?? job.createdAt)
  };
}

function searchableJobText(job: ExternalJob) {
  return [
    job.title,
    job.company,
    job.location,
    job.experience,
    job.employment_type,
    job.platform,
    job.salary,
    job.description,
    job.skills.join(" ")
  ]
    .join(" ")
    .toLowerCase();
}

function jobSearchTerm(value: string) {
  const term = value.trim().toLowerCase();
  return term === "job" || term === "jobs" ? "" : term;
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

function booleanField(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return fallback;
}

function skillsField(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => stringField(item).trim()).filter(Boolean);
  return stringField(value).split(",").map((item) => item.trim()).filter(Boolean);
}

function getCompanyInitials(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "CA";
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join("");
}

function formatSalary(value: string) {
  const clean = value.trim();
  return clean || "--";
}

function formatPostedDate(postedDate: string, createdAt?: string) {
  const clean = postedDate.trim();
  if (clean) return clean;
  if (!createdAt) return "--";

  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "--";
  return formatDate(date);
}

function ApplicationBadge({ status }: { status: JobApplicationStatus }) {
  const label = status === "applied" ? "Applied" : status === "pending" ? "Confirm" : "Not Applied";
  const className =
    status === "applied"
      ? "bg-[#e6f8e9] text-[#1e8d35]"
      : status === "pending"
        ? "bg-[#fff3d7] text-[#9a6500]"
        : "bg-[#e7ebf5] text-[#001e72]";

  return <span className={`rounded-md px-3 py-1.5 text-xs font-semibold ${className}`}>{label}</span>;
}

function ApplicationStatusPrompt({
  record,
  onApplied,
  onNotApplied
}: {
  record: JobApplicationRecord;
  onApplied: () => void;
  onNotApplied: () => void;
}) {
  return (
    <div className="fixed bottom-5 right-5 z-50 w-[330px] rounded-xl border border-[#e1e5ee] bg-white p-4 shadow-[0_18px_50px_rgba(17,24,74,.18)]">
      <h2 className="text-sm font-bold text-[#07142f]">Did you apply?</h2>
      <p className="mt-1 text-sm leading-5 text-[#5f6573]">{record.title || "This job"} {record.company ? `at ${record.company}` : ""}</p>
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={onApplied} className="flex-1 rounded-md bg-[#3155ff] px-3 py-2 text-sm font-semibold text-white">Applied</button>
        <button type="button" onClick={onNotApplied} className="flex-1 rounded-md border border-[#dbe0e9] px-3 py-2 text-sm font-semibold text-[#07142f]">Not Applied</button>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-[#e5e8f0] bg-white px-4 py-3">
      <span className="inline-flex items-center gap-3 text-sm font-semibold">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eef2ff] text-[#3155ff]">
          <UserRound size={17} />
        </span>
        {label}
      </span>
      <b className="text-[#001e72]">{value}</b>
    </div>
  );
}

function EmptyFeature({ title, text }: { title: string; text: string }) {
  return (
    <Card className="rounded-[12px] border-0 bg-white p-8 text-center shadow-sm">
      <h2 className="text-lg font-bold text-[#07142f]">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#747b8a]">{text}</p>
    </Card>
  );
}

function useDailyActivity(studentEmail: string, profileStatus?: string) {
  const recordedStudentEmail = useRef("");
  const [activity, setActivity] = useState<ActivityMap>({});
  const [lastUpdatedAt, setLastUpdatedAt] = useState("");

  useEffect(() => {
    const cleanEmail = studentEmail.trim().toLowerCase();
    if (!cleanEmail) return;
    const scopedActivityKey = `${activityStorageKey}:${cleanEmail}`;
    const scopedUpdatedKey = `${lastUpdatedStorageKey}:${cleanEmail}`;
    const todayKey = toDateKey(new Date());
    const updatedAt = new Date().toISOString();
    const stored = window.localStorage.getItem(scopedActivityKey);
    let parsed: ActivityMap = {};
    try {
      parsed = stored ? (JSON.parse(stored) as ActivityMap) : {};
    } catch {
      parsed = {};
    }
    const normalizedStatus = (profileStatus || "").trim().toLowerCase();
    const isEstablishedStudent = ["active", "completed", "approved", "in progress", "advanced"].includes(normalizedStatus);
    const legacyOwnerKey = "cyber-academy-legacy-activity-owner";
    const legacyOwner = window.localStorage.getItem(legacyOwnerKey);
    const legacyStored = window.localStorage.getItem(activityStorageKey);
    if (isEstablishedStudent && legacyStored && (!legacyOwner || legacyOwner === cleanEmail)) {
      try {
        const legacy = JSON.parse(legacyStored) as ActivityMap;
        const merged = { ...parsed };
        for (const [dateKey, count] of Object.entries(legacy)) {
          merged[dateKey] = Math.max(merged[dateKey] ?? 0, Number(count) || 0);
        }
        parsed = merged;
        window.localStorage.setItem(scopedActivityKey, JSON.stringify(merged));
        window.localStorage.setItem(legacyOwnerKey, cleanEmail);
        window.localStorage.removeItem(activityStorageKey);
        const legacyUpdatedAt = window.localStorage.getItem(lastUpdatedStorageKey);
        if (legacyUpdatedAt && !window.localStorage.getItem(scopedUpdatedKey)) {
          window.localStorage.setItem(scopedUpdatedKey, legacyUpdatedAt);
        }
        window.localStorage.removeItem(lastUpdatedStorageKey);
      } catch {
        // Leave malformed legacy data untouched instead of assigning it to an account.
      }
    }
    if (recordedStudentEmail.current === cleanEmail) {
      setActivity(parsed);
      setLastUpdatedAt(window.localStorage.getItem(scopedUpdatedKey) || "");
      return;
    }
    recordedStudentEmail.current = cleanEmail;
    const sessionMarker = `${scopedActivityKey}:${todayKey}:recorded`;
    if (window.sessionStorage.getItem(sessionMarker)) {
      setActivity(parsed);
      setLastUpdatedAt(window.localStorage.getItem(scopedUpdatedKey) || "");
      return;
    }
    const next = { ...parsed, [todayKey]: (parsed[todayKey] ?? 0) + 1 };
    const storedUpdatedAt = window.localStorage.getItem(scopedUpdatedKey);
    window.localStorage.setItem(scopedActivityKey, JSON.stringify(next));
    window.localStorage.setItem(scopedUpdatedKey, updatedAt);
    window.sessionStorage.setItem(sessionMarker, "1");
    setActivity(next);
    setLastUpdatedAt(storedUpdatedAt || updatedAt);
  }, [profileStatus, studentEmail]);

  useEffect(() => {
    const cleanEmail = studentEmail.trim().toLowerCase();
    if (!cleanEmail) return;
    const scopedUpdatedKey = `${lastUpdatedStorageKey}:${cleanEmail}`;
    const refreshUpdatedAt = (event?: Event) => {
      const detail = event instanceof CustomEvent ? event.detail as { email?: string; updatedAt?: string } : undefined;
      if (detail?.email && detail.email !== cleanEmail) return;
      setLastUpdatedAt(detail?.updatedAt || window.localStorage.getItem(scopedUpdatedKey) || "");
    };
    window.addEventListener(studentPortalUpdatedEvent, refreshUpdatedAt);
    window.addEventListener("storage", refreshUpdatedAt);
    return () => {
      window.removeEventListener(studentPortalUpdatedEvent, refreshUpdatedAt);
      window.removeEventListener("storage", refreshUpdatedAt);
    };
  }, [studentEmail]);

  return { activity, lastUpdatedAt };
}

function buildActivityMonths(year: number) {
  return Array.from({ length: 12 }, (_, monthIndex) => {
    const monthStart = new Date(year, monthIndex, 1);
    const monthEnd = new Date(year, monthIndex + 1, 0);
    const days = [];

    for (let date = new Date(monthStart); date <= monthEnd; date.setDate(date.getDate() + 1)) {
      const current = new Date(date);
      days.push({
        key: toDateKey(current),
        label: current.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
      });
    }

    return {
      label: monthStart.toLocaleDateString("en-IN", { month: "short" }),
      days
    };
  });
}

function buildYearOptions(startYear: number, endYear: number) {
  return Array.from({ length: Math.max(0, endYear - startYear + 1) }, (_, index) => startYear + index);
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Kolkata" });
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
}

function activityColor(count: number) {
  if (count >= 7) return "bg-[#32a852]";
  if (count >= 4) return "bg-[#57c76a]";
  if (count >= 2) return "bg-[#9be7a5]";
  if (count >= 1) return "bg-[#b8edc0]";
  return "bg-[#d8d8d8]";
}

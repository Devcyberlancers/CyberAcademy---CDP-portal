"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Bell,
  BookOpen,
  BriefcaseBusiness,
  ChevronDown,
  ClipboardCheck,
  CodeSquare,
  Grid2X2,
  Search,
  ShoppingCart,
  LogOut,
  FileText,
  User,
  UserRound
} from "lucide-react";
import { studentAccountStorageKey, type StudentAccount } from "@/lib/student-account";
import { cn } from "@/lib/utils";

const authTokenStorageKey = "cyber-academy-auth-token";
type PortalAccess = { courses_enabled: boolean; assessments_enabled: boolean; jobs_enabled: boolean };

const studentMenu = [
  { id: "dashboard", label: "Dashboard", icon: Grid2X2 },
  { id: "courses", label: "Courses", icon: BookOpen },
  { id: "jobs", label: "Jobs", icon: BriefcaseBusiness },
  { id: "assessments", label: "Assessments", icon: ClipboardCheck },
  { id: "company-tests", label: "Company Specific Test", icon: ClipboardCheck },
  { id: "ide", label: "Open IDE", icon: CodeSquare },
  { id: "nerd", label: "Go to NERD", icon: Grid2X2 }
];

export type StudentSection = "dashboard" | "course-dashboard" | "job-dashboard" | "courses" | "jobs" | "assessments" | "company-tests" | "ide" | "nerd";

export function DashboardShell({
  activeSection,
  onSectionChange,
  searchValue,
  onSearchValueChange,
  onSearchSubmit,
  student,
  children
}: {
  activeSection: StudentSection;
  onSectionChange: (section: StudentSection) => void;
  searchValue: string;
  onSearchValueChange: (value: string) => void;
  onSearchSubmit: () => void;
  student: StudentAccount;
  children: React.ReactNode;
}) {
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [messages, setMessages] = useState<Array<{ id: number; message: string; sentBy: string; sentAt: string }>>([]);
  const [portalAccess, setPortalAccess] = useState<PortalAccess>({ courses_enabled: false, assessments_enabled: false, jobs_enabled: false });
  const [accessLoaded, setAccessLoaded] = useState(false);
  const [accessError, setAccessError] = useState("");
  const profileIncomplete = !student.fullName || !student.registrationNumber || !student.phone || !student.department;
  const notificationCount = messages.length + (profileIncomplete ? 1 : 0);

  useEffect(() => {
    if (!student.email) return;
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
    async function loadMessages() {
      try {
        const url = new URL("/api/student-messages", apiBaseUrl);
        const token = window.localStorage.getItem(authTokenStorageKey);
        const response = await fetch(url.toString(), {
          cache: "no-store",
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (response.ok) setMessages(await response.json());
      } catch {
        // Keep the portal usable while the backend is restarting.
      }
    }
    void loadMessages();
    const interval = window.setInterval(() => void loadMessages(), 15_000);
    return () => window.clearInterval(interval);
  }, [student.email]);

  useEffect(() => {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
    async function loadPortalAccess() {
      const token = window.localStorage.getItem(authTokenStorageKey);
      if (!token) {
        setAccessError("Your login session is missing. Redirecting to login...");
        setAccessLoaded(true);
        window.setTimeout(() => window.location.replace("/"), 800);
        return;
      }
      try {
        const response = await fetch(new URL("/api/portal-access", apiBaseUrl).toString(), { cache: "no-store", headers: { Authorization: `Bearer ${token}` } });
        if (response.status === 401 || response.status === 403) {
          window.localStorage.removeItem(authTokenStorageKey);
          setAccessError("Your login session expired. Redirecting to login...");
          window.setTimeout(() => window.location.replace("/"), 800);
          return;
        }
        if (!response.ok) {
          setAccessError("Portal access could not be checked. The backend may be restarting.");
          return;
        }
        setPortalAccess(await response.json());
        setAccessError("");
      } catch {
        // Network errors (for example while the API is restarting) must not
        // surface as an unhandled React runtime error or erase the last valid
        // access state.
        setAccessError("Portal access is temporarily unavailable. Retrying automatically...");
      } finally {
        setAccessLoaded(true);
      }
    }
    void loadPortalAccess();
    const interval = window.setInterval(() => void loadPortalAccess(), 5_000);
    window.addEventListener("focus", loadPortalAccess);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", loadPortalAccess);
    };
  }, [student.email]);

  const sectionAllowed = (section: StudentSection) => {
    if (section === "courses" || section === "course-dashboard") return portalAccess.courses_enabled;
    if (section === "jobs" || section === "job-dashboard") return portalAccess.jobs_enabled;
    if (section === "assessments") return portalAccess.assessments_enabled;
    return true;
  };
  const visibleMenu = studentMenu;

  function logout() {
    if (student.email) {
      window.localStorage.setItem("cyber-academy-last-logout-email", student.email.trim().toLowerCase());
    }
    window.localStorage.removeItem(studentAccountStorageKey);
    window.localStorage.removeItem(authTokenStorageKey);
    window.location.href = "/";
  }

  return (
    <div className="min-h-screen bg-[#f6f8fc] text-[#07142f]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[82px] bg-[#11184a] text-white shadow-lg lg:block">
        <div className="flex h-[86px] items-center justify-center border-b border-white/10">
          <div className="rounded-md bg-white p-1.5 shadow">
            <Image src="/cyber-academy-logo.jpeg" alt="Cyber Academy logo" width={44} height={44} className="rounded object-contain" />
          </div>
        </div>
        <nav className="py-2">
          {visibleMenu.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => onSectionChange(item.id as StudentSection)}
              className={cn(
                "relative flex min-h-[64px] w-full flex-col items-center justify-center gap-1.5 px-1.5 text-center text-[11px] font-medium text-white/85 transition hover:bg-white/10 hover:text-white",
                activeSection === item.id && "bg-[#3155ff] text-white before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-[#4f7cff] before:content-['']",
                accessLoaded && !sectionAllowed(item.id as StudentSection) && "text-white/55"
              )}
              title={accessLoaded && !sectionAllowed(item.id as StudentSection) ? "Admin approval required" : item.label}
            >
              <item.icon size={20} strokeWidth={1.8} />
              <span className="leading-tight">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>
      <div className="lg:pl-[82px]">
        <header className="sticky top-0 z-30 flex h-[72px] items-center gap-4 border-b border-[#edf0f6] bg-white px-4 shadow-sm sm:px-7">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onSearchSubmit();
            }}
            className="flex h-11 w-full max-w-[420px] items-center gap-3 rounded-md border border-[#e4e8f0] bg-[#f9fafc] px-4"
          >
            <Search size={20} className="text-[#6e7480]" />
            <input
              value={searchValue}
              onChange={(event) => onSearchValueChange(event.target.value)}
              className="h-full flex-1 bg-transparent text-sm outline-none placeholder:text-[#a0a7b6]"
              placeholder={activeSection === "jobs" ? "Search jobs..." : "Search dashboard..."}
            />
          </form>
          <div className="ml-auto flex items-center gap-4">
            <button type="button" onClick={() => setIsNotificationsOpen((value) => !value)} className="relative hidden text-[#666a73] transition hover:text-[#11184a] sm:inline-flex" aria-label="Notifications">
              <Bell size={24} strokeWidth={1.8} />
              {notificationCount ? <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">{notificationCount}</span> : null}
            </button>
            {isNotificationsOpen ? <div className="absolute right-20 top-16 z-50 max-h-[420px] w-[min(90vw,390px)] overflow-y-auto rounded-xl border border-[#e4e8f0] bg-white p-3 shadow-2xl">
              <h2 className="px-2 py-2 font-bold">Admin Messages</h2>
              {messages.map((item) => <div key={item.id} className="mb-2 rounded-lg bg-[#f6f8fc] p-3"><p className="text-sm font-semibold text-[#07142f]">{item.message}</p><p className="mt-2 text-xs text-[#6c7280]">{new Date(item.sentAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })} IST</p></div>)}
              {profileIncomplete ? (
                <a href="/profile" className="mb-2 block rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  <b>Complete your profile</b>
                  <span className="mt-1 block">Add your personal and academic details to finish setting up your Student account.</span>
                </a>
              ) : null}
              {!messages.length && !profileIncomplete ? <p className="p-5 text-center text-sm text-[#6c7280]">No messages from Admin.</p> : null}
            </div> : null}
            <button type="button" className="hidden text-[#666a73] transition hover:text-[#11184a] sm:inline-flex" aria-label="Cart">
              <ShoppingCart size={25} strokeWidth={1.8} />
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsAccountOpen((current) => !current)}
                className="flex items-center gap-2 rounded-md px-1.5 py-1 transition hover:bg-[#f4f6fb]"
                aria-expanded={isAccountOpen}
                aria-label="Open account menu"
              >
              <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#ebf4ff]">
                {student.photoDataUrl ? (
                  <Image src={student.photoDataUrl} alt="Student profile photo" fill unoptimized className="object-cover" />
                ) : (
                  <UserRound size={22} className="text-[#0e9fb5]" />
                )}
              </div>
              <span className="hidden text-base font-medium md:inline">{student.firstName || "Student"}</span>
              <ChevronDown size={16} className="text-[#777b84]" />
              </button>

              {isAccountOpen && (
                <div className="absolute right-0 top-14 z-50 w-[270px] overflow-hidden rounded-xl border border-[#e4e8f0] bg-white p-2 shadow-[0_18px_50px_rgba(17,24,74,.18)]">
                  <div className="mb-2 flex items-center gap-3 rounded-lg bg-[#f6f8ff] px-3 py-3">
                    <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#ebf4ff] shadow-sm">
                      {student.photoDataUrl ? <Image src={student.photoDataUrl} alt="Student profile photo" fill unoptimized className="object-cover" /> : <UserRound size={23} className="text-[#0e9fb5]" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[#07142f]">{student.fullName || student.firstName || "Student"}</p>
                      <p className="mt-0.5 truncate text-xs text-[#687182]">{student.email}</p>
                    </div>
                  </div>
                  <Link href="/profile" className="group flex items-center gap-3 rounded-lg px-3 py-3 transition hover:bg-[#f6f8fc]">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#eef2ff] text-[#3155ff]"><User size={17} /></span>
                    <span className="min-w-0"><b className="block text-sm text-[#07142f]">Profile</b><small className="mt-0.5 block text-xs text-[#7a8292]">View and update your details</small></span>
                  </Link>
                  <Link href="/resume-intelligence" className="group flex items-center gap-3 rounded-lg px-3 py-3 transition hover:bg-[#f6f8fc]">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#eef8f9] text-[#0e8b9c]"><FileText size={17} /></span>
                    <span className="min-w-0"><b className="block text-sm text-[#07142f]">Resume Intelligence</b><small className="mt-0.5 block text-xs text-[#7a8292]">Review your resume analysis</small></span>
                  </Link>
                  <div className="my-2 h-px bg-[#edf0f5]" />
                  <button
                    type="button"
                    onClick={logout}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition hover:bg-[#fff4f4]"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-red-50 text-[#c03434]"><LogOut size={17} /></span>
                    <span><b className="block text-sm text-[#c03434]">Logout</b><small className="mt-0.5 block text-xs text-[#9a6870]">Sign out of your account</small></span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="px-3 py-5 sm:px-5 lg:px-7">
          {!accessLoaded ? <div className="rounded-xl bg-white p-8 text-center font-semibold text-[#6c7280]">Checking portal access...</div>
          : accessError ? <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center font-semibold text-red-700">{accessError}</div>
          : sectionAllowed(activeSection) ? children
          : <div className="rounded-xl border border-amber-200 bg-amber-50 p-10 text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-100 text-2xl">🔒</div><h2 className="mt-4 text-xl font-bold text-[#07142f]">Admin approval required</h2><p className="mt-2 text-sm text-[#6c7280]">You need approval from an administrator before you can access this content. Please contact Admin to enable this section for your account.</p><button type="button" onClick={() => onSectionChange("dashboard")} className="mt-5 rounded-md bg-[#3155ff] px-5 py-2.5 font-bold text-white">Return to Dashboard</button></div>}
        </main>
      </div>
    </div>
  );
}

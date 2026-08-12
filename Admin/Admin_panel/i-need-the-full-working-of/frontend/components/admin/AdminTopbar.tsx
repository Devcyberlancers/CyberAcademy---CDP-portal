"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck, ChevronDown, LogOut, Menu, Search, Trash2, UserRound, X } from "lucide-react";
import { clearAdminToken, getAdminDashboard, getAdminProfile, listAdminJobs, listCoursesFromDb, listStudentsFromDb, type AdminJob, type DbCourse, type DbStudent } from "@/lib/admin-api";
import { studentPortalUrl } from "@/lib/urls";
import { AdminBatchSelector } from "./AdminBatchSelector";

type AdminTopbarProps = { title: string; subtitle?: string; onMenuClick?: () => void };
type Profile = { email: string; name: string; role: string };
type Notice = { type: string; count: number; message: string; read?: boolean };
const readNoticeStorageKey = "cyber-academy-admin-read-notifications-v1";
const clearedNoticeStorageKey = "cyber-academy-admin-cleared-notifications-v1";
const noticeKey = (notice: Notice) => `${notice.type}:${notice.count}`;

export function AdminTopbar({ title, subtitle, onMenuClick }: AdminTopbarProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [panel, setPanel] = useState<"notifications" | "profile" | null>(null);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [students, setStudents] = useState<DbStudent[]>([]);
  const [courses, setCourses] = useState<DbCourse[]>([]);
  const [jobs, setJobs] = useState<AdminJob[]>([]);

  useEffect(() => {
    void Promise.all([getAdminProfile(), getAdminDashboard()]).then(([admin, dashboard]) => {
      setProfile(admin);
      const read = new Set(JSON.parse(window.localStorage.getItem(readNoticeStorageKey) || "[]") as string[]);
      const cleared = new Set(JSON.parse(window.localStorage.getItem(clearedNoticeStorageKey) || "[]") as string[]);
      setNotices(dashboard.notifications.filter((item) => item.count > 0 && !cleared.has(noticeKey(item))).map((item) => ({ ...item, read: read.has(noticeKey(item)) })));
    }).catch(() => undefined);
    void Promise.all([listStudentsFromDb(), listCoursesFromDb(), listAdminJobs()]).then(([studentRows, courseRows, jobRows]) => {
      setStudents(studentRows); setCourses(courseRows); setJobs(jobRows);
    }).catch(() => undefined);
  }, []);

  const searchResults = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return [
      ...students.filter((item) => [item.name, item.email, item.register_number].some((value) => value?.toLowerCase().includes(term))).map((item) => ({ key: `student-${item.id}`, label: item.name, detail: `${item.register_number} · Student`, href: `/admin/students/${item.id}` })),
      ...courses.filter((item) => [item.title, item.category, item.instructor].some((value) => value?.toLowerCase().includes(term))).map((item) => ({ key: `course-${item.id}`, label: item.title, detail: `${item.category} · Course`, href: `/admin/courses/${item.id}/edit` })),
      ...jobs.filter((item) => [item.role, item.company, item.location || ""].some((value) => value.toLowerCase().includes(term))).map((item) => ({ key: `job-${item.id}`, label: item.role, detail: `${item.company} · Job`, href: "/admin/jobs" }))
    ].slice(0, 12);
  }, [courses, jobs, search, students]);

  function logout() {
    clearAdminToken();
    window.location.replace(studentPortalUrl);
  }

  function persistRead(next: Notice[]) {
    window.localStorage.setItem(readNoticeStorageKey, JSON.stringify(next.filter((item) => item.read).map(noticeKey)));
  }

  function markNoticeRead(type: string) {
    setNotices((items) => { const next = items.map((item) => item.type === type ? { ...item, read: true } : item); persistRead(next); return next; });
  }

  function markAllNoticesRead() {
    setNotices((items) => { const next = items.map((item) => ({ ...item, read: true })); persistRead(next); return next; });
  }

  function clearReadNotices() {
    setNotices((items) => {
      const cleared = new Set(JSON.parse(window.localStorage.getItem(clearedNoticeStorageKey) || "[]") as string[]);
      items.filter((item) => item.read).forEach((item) => cleared.add(noticeKey(item)));
      window.localStorage.setItem(clearedNoticeStorageKey, JSON.stringify([...cleared]));
      const next = items.filter((item) => !item.read); persistRead(next); return next;
    });
  }

  const initials = profile?.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "A";
  return <header className="sticky top-0 z-30 border-b border-portal-line bg-white">
    <div className="relative flex min-h-16 items-center gap-3 px-3 py-3 sm:gap-5 sm:px-5 md:min-h-20 md:px-8">
      <button type="button" onClick={onMenuClick} className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-portal-line text-slate-600 md:hidden" aria-label="Open navigation"><Menu size={22} /></button>
      <div className="min-w-0 flex-1"><h1 className="truncate text-lg font-bold text-slate-950 sm:text-xl">{title}</h1>{subtitle ? <p className="mt-1 truncate text-sm text-slate-500">{subtitle}</p> : null}</div>
      <AdminBatchSelector />
      <form onSubmit={(event) => { event.preventDefault(); setSearchOpen(true); }} className="relative hidden lg:block">
        <div className="flex h-11 w-[300px] items-center gap-2 rounded-md border border-portal-line px-3 text-slate-500"><input value={search} onFocus={() => setSearchOpen(true)} onChange={(event) => { setSearch(event.target.value); setSearchOpen(true); }} className="w-full bg-transparent text-sm outline-none" placeholder="Search students, courses, jobs..." /><button type="submit" aria-label="Search"><Search size={19} /></button></div>
        {searchOpen && search.trim() ? <div className="absolute right-0 top-12 z-50 max-h-96 w-[380px] overflow-y-auto rounded-xl border border-portal-line bg-white p-2 shadow-2xl">
          {searchResults.map((result) => <Link key={result.key} href={result.href} onClick={() => setSearchOpen(false)} className="block rounded-lg px-4 py-3 hover:bg-slate-50"><p className="font-bold text-slate-950">{result.label}</p><p className="mt-1 text-xs text-slate-500">{result.detail}</p></Link>)}
          {!searchResults.length ? <div className="px-4 py-8 text-center"><p className="font-bold text-slate-800">Not found</p><p className="mt-1 text-xs text-slate-500">No student, course, or job matches “{search.trim()}”.</p></div> : null}
        </div> : null}
      </form>
      <button type="button" onClick={() => setPanel(panel === "notifications" ? null : "notifications")} className="relative hidden h-10 w-10 shrink-0 place-items-center rounded-md text-slate-600 hover:bg-slate-100 sm:grid" aria-label="Notifications"><Bell size={22} />{notices.some((item) => !item.read) ? <span className="absolute right-1 top-0 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">{notices.filter((item) => !item.read).length}</span> : null}</button>
      <button type="button" onClick={() => setPanel(panel === "profile" ? null : "profile")} className="flex shrink-0 items-center gap-2 rounded-lg p-1 hover:bg-slate-100 sm:gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-portal-blue text-sm font-bold text-white sm:h-11 sm:w-11">{initials}</div>
        <div className="hidden text-left leading-tight sm:block"><p className="text-sm font-bold text-slate-950">{profile?.name || "Admin"}</p><p className="text-xs capitalize text-slate-500">{profile?.role?.replace("_", " ") || "Administrator"}</p></div><ChevronDown size={18} className="text-slate-500" />
      </button>
      {panel ? <div className="absolute right-3 top-[68px] z-50 w-[min(92vw,360px)] rounded-xl border border-portal-line bg-white p-4 shadow-2xl md:right-8 md:top-[78px]">
        <div className="mb-3 flex items-center justify-between"><h2 className="font-black text-slate-950">{panel === "profile" ? "Admin Profile" : "Notifications"}</h2><button type="button" onClick={() => setPanel(null)} aria-label="Close panel"><X size={18} /></button></div>
        {panel === "profile" ? <div className="space-y-3 text-sm"><div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3"><UserRound className="text-portal-blue" /><div><p className="font-bold">{profile?.name || "Loading..."}</p><p className="text-slate-500">{profile?.email || ""}</p></div></div><p><span className="text-slate-500">Role:</span> <b className="capitalize">{profile?.role?.replace("_", " ")}</b></p><button type="button" onClick={logout} className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-red-200 font-bold text-red-600"><LogOut size={17} />Sign out</button></div>
        : <div className="space-y-2"><div className="flex justify-end gap-2"><button type="button" onClick={markAllNoticesRead} disabled={!notices.some((item) => !item.read)} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-bold text-portal-blue disabled:opacity-40"><CheckCheck size={14}/>Mark all read</button><button type="button" onClick={clearReadNotices} disabled={!notices.some((item) => item.read)} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-bold text-red-600 disabled:opacity-40"><Trash2 size={14}/>Clear read</button></div>{notices.map((item) => <button type="button" onClick={() => markNoticeRead(item.type)} key={item.type} className={`block w-full rounded-lg border p-3 text-left text-sm ${item.read ? "border-transparent bg-slate-50 opacity-70" : "border-blue-200 bg-blue-50"}`}><p className="font-bold text-slate-900">{item.message}</p><p className="mt-1 text-xs text-slate-500">{item.count} item{item.count === 1 ? "" : "s"} / {item.read ? "Read" : "Unread"}</p></button>)}{!notices.length ? <p className="py-5 text-center text-sm text-slate-500">No pending notifications.</p> : null}</div>}
      </div> : null}
    </div>
  </header>;
}

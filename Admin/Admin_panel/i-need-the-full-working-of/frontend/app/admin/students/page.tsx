"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { ProgressBar } from "@/components/admin/ProgressBar";
import { SectionCard } from "@/components/admin/SectionCard";
import { StatCard } from "@/components/admin/StatCard";
import { useAdminStore } from "@/lib/admin-store";
import { approveStudentProfileInDb, getGlobalPortalAccess, updateGlobalPortalAccess, type PortalAccessSettings } from "@/lib/admin-api";
import { Bell, CheckCircle2, Download, Filter, Mail, Search, Star, TrendingUp, UserPlus, Users } from "lucide-react";

export default function StudentsPage() {
  const { students, registrations, stats, sendMessage, scheduleDailyReminder } = useAdminStore();
  const [activeTab, setActiveTab] = useState("All Students");
  const [query, setQuery] = useState("");
  const [bulkMessage, setBulkMessage] = useState("Placement reminder: complete your assigned module and check pending assessments today.");
  const [bulkReminder, setBulkReminder] = useState("Daily 9 AM reminder enabled for learning progress, pending quizzes, and new job updates.");
  const [notice, setNotice] = useState("");
  const [massAccess, setMassAccess] = useState<PortalAccessSettings>({ courses_enabled: false, assessments_enabled: false, jobs_enabled: false });
  const [savingAccess, setSavingAccess] = useState(false);
  const [verifyingId, setVerifyingId] = useState("");

  useEffect(() => { void getGlobalPortalAccess().then(setMassAccess).catch(() => undefined); }, []);

  async function setMassPermission(key: keyof PortalAccessSettings) {
    const next = { ...massAccess, [key]: !massAccess[key] };
    setSavingAccess(true);
    try {
      setMassAccess(await updateGlobalPortalAccess(next));
      setNotice(`Mass access updated for all students.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Mass access could not be updated.");
    } finally {
      setSavingAccess(false);
    }
  }

  async function verifyStudent(studentId: string) {
    const registration = registrations.find((item) => item.studentId === studentId);
    const databaseId = registration?.dbStudentId ?? Number(studentId.replace("DB-STU-", ""));
    if (!Number.isFinite(databaseId)) return setNotice("This student is not linked to a database account.");
    setVerifyingId(studentId);
    try {
      await approveStudentProfileInDb(databaseId);
      setNotice("Student account verified and approved.");
      window.location.reload();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Student verification failed."); setVerifyingId(""); }
  }

  const visibleStudents = useMemo(() => {
    return students
      .filter((student) => {
        if (activeTab === "All Students") return true;
        if (activeTab === "New Users") return student.status === "New User" || student.status === "Pending Approval";
        if (activeTab === "In Progress") return student.status === "In Progress";
        if (activeTab === "Advanced Students") return student.status === "Advanced";
        return true;
      })
      .filter((student) => {
        const search = query.trim().toLowerCase();
        if (!search) return true;
        return [student.name, student.email, student.regNo, student.status, student.module].some((value) =>
          String(value).toLowerCase().includes(search)
        );
      });
  }, [activeTab, query, students]);

  const studentStats = [
    { label: "Total Students", value: String(stats.totalStudents), caption: "Approved accounts", tone: "indigo", icon: Users },
    { label: "New Users", value: String(stats.newUsers), caption: "This month", tone: "emerald", icon: UserPlus },
    { label: "Active This Week", value: String(stats.activeThisWeek), caption: "Logged in", tone: "blue", icon: TrendingUp },
    { label: "Advanced Students", value: String(stats.advancedStudents), caption: "Completed 75%+", tone: "violet", icon: Star }
  ];

  return (
    <AdminShell title="Student Management" subtitle="Manage and monitor all students">
      <div className="mb-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {studentStats.map((stat) => <StatCard key={stat.label} {...stat} />)}
      </div>
      <SectionCard title="Mass Student Portal Access">
        <p className="mb-4 text-sm text-slate-500">These controls immediately enable or disable each section for every student. Dedicated student settings can be changed from that student&apos;s detail page.</p>
        <div className="grid gap-3 md:grid-cols-3">
          <AccessToggle label="Courses" enabled={massAccess.courses_enabled} disabled={savingAccess} onClick={() => void setMassPermission("courses_enabled")} />
          <AccessToggle label="Assessments" enabled={massAccess.assessments_enabled} disabled={savingAccess} onClick={() => void setMassPermission("assessments_enabled")} />
          <AccessToggle label="Jobs" enabled={massAccess.jobs_enabled} disabled={savingAccess} onClick={() => void setMassPermission("jobs_enabled")} />
        </div>
      </SectionCard>
      <SectionCard title="Student Messaging & Reminders">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
          <label>
            <span className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700"><Mail size={17} className="text-portal-blue" />Message to filtered students</span>
            <textarea value={bulkMessage} onChange={(event) => setBulkMessage(event.target.value)} className="min-h-20 w-full rounded-md border border-portal-line p-3 text-sm outline-none focus:border-portal-blue" />
          </label>
          <label>
            <span className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700"><Bell size={17} className="text-portal-blue" />Daily reminder automation</span>
            <textarea value={bulkReminder} onChange={(event) => setBulkReminder(event.target.value)} className="min-h-20 w-full rounded-md border border-portal-line p-3 text-sm outline-none focus:border-portal-blue" />
          </label>
          <div className="flex flex-col justify-end gap-3">
            <button
              onClick={() => {
                visibleStudents.forEach((student) => sendMessage(student.id, bulkMessage));
                setNotice(`Message sent to ${visibleStudents.length} filtered student${visibleStudents.length === 1 ? "" : "s"}.`);
              }}
              className="flex h-11 min-w-48 items-center justify-center gap-2 rounded-md bg-portal-blue px-4 font-bold text-white"
            >
              <Mail size={18} />
              Send Message
            </button>
            <button
              onClick={() => {
                visibleStudents.forEach((student) => scheduleDailyReminder(student.id, bulkReminder));
                setNotice(`Daily reminder scheduled for ${visibleStudents.length} filtered student${visibleStudents.length === 1 ? "" : "s"}.`);
              }}
              className="flex h-11 min-w-48 items-center justify-center gap-2 rounded-md border border-portal-line px-4 font-bold text-slate-700"
            >
              <Bell size={18} />
              Schedule Reminder
            </button>
          </div>
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-500">
          Applies to the currently filtered list: {visibleStudents.length} students.
        </p>
        {notice ? <p className="mt-3 rounded-md bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{notice}</p> : null}
      </SectionCard>
      <SectionCard>
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-6 text-sm font-bold">
            {["All Students", "New Users", "In Progress", "Advanced Students"].map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`pb-3 ${activeTab === tab ? "border-b-2 border-portal-blue text-portal-blue" : "text-slate-600"}`}>{tab}</button>
            ))}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="flex h-11 min-w-[280px] items-center gap-3 rounded-md border border-portal-line px-3 text-slate-500">
              <Search size={18} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full outline-none" placeholder="Search students..." />
            </label>
            <button onClick={() => setActiveTab("In Progress")} className="flex h-11 items-center justify-center gap-2 rounded-md border border-portal-line px-4 font-semibold text-slate-700"><Filter size={18} />In Progress</button>
            <button onClick={() => window.alert(`${visibleStudents.length} student rows ready for export.`)} className="flex h-11 items-center justify-center gap-2 rounded-md border border-portal-line px-4 font-semibold text-slate-700"><Download size={18} />Export</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-y border-portal-line bg-slate-50 text-slate-600">
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Course Progress</th>
                <th className="px-4 py-3">Current Module</th>
                <th className="px-4 py-3">Last Login</th>
                <th className="px-4 py-3">Joined On</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleStudents.map((student) => (
                <tr key={student.id} className="border-b border-portal-line">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-full bg-blue-50 font-bold text-portal-blue">{student.name.split(" ").map((part) => part[0]).join("")}</div>
                      <div>
                        <p className="font-bold text-slate-950">{student.name}</p>
                        <p className="text-xs text-slate-500">{student.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${student.status === "Advanced" ? "bg-emerald-50 text-emerald-700" : student.status === "In Progress" ? "bg-amber-50 text-amber-700" : student.status === "Suspended" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}`}>{student.status}</span>
                  </td>
                  <td className="px-4 py-4"><ProgressBar value={student.progress} /></td>
                  <td className="px-4 py-4">{student.module}</td>
                  <td className="px-4 py-4">{student.lastLogin}</td>
                  <td className="px-4 py-4">{student.joined}</td>
                  <td className="px-4 py-4"><div className="flex items-center gap-2"><Link href={`/admin/students/${student.id}`} className="rounded-md border border-portal-line px-4 py-2 font-bold text-portal-blue">View</Link>{(student.status === "New User" || student.status === "Pending Approval") ? <button type="button" disabled={verifyingId === student.id} onClick={() => void verifyStudent(student.id)} className="flex h-9 items-center gap-2 rounded-md border border-emerald-200 px-3 font-bold text-emerald-700 disabled:opacity-50"><CheckCircle2 size={15} />{verifyingId === student.id ? "Verifying..." : "Verify Account"}</button> : null}</div></td>
                </tr>
              ))}
              {visibleStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center font-semibold text-slate-500">No students found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </AdminShell>
  );
}

function AccessToggle({ label, enabled, disabled, onClick }: { label: string; enabled: boolean; disabled: boolean; onClick: () => void }) {
  return <button type="button" disabled={disabled} onClick={onClick} className="flex items-center justify-between rounded-lg border border-portal-line p-4 text-left disabled:opacity-50"><span><b className="block text-slate-950">{label}</b><span className="text-xs text-slate-500">{enabled ? "Accessible to all students" : "Blocked for all students"}</span></span><span className={`relative h-7 w-12 rounded-full transition ${enabled ? "bg-emerald-500" : "bg-slate-300"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${enabled ? "left-6" : "left-1"}`} /></span></button>;
}

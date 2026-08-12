"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, BookOpen, BriefcaseBusiness, CheckCircle2, ClipboardList, Download, Mail, ShieldAlert, Upload, UserPlus, Users } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { useAdminBatch } from "@/lib/admin-batch-context";
import { SectionCard } from "@/components/admin/SectionCard";
import { StatCard } from "@/components/admin/StatCard";
import { getAdminDashboard, getAdminDashboardActivity, listAdminJobs, listJobApplicationActivity, listStudentsFromDb, type AdminJobApplicationActivity, type DbStudent } from "@/lib/admin-api";
import { useAdminStore } from "@/lib/admin-store";

export default function AdminDashboardPage() {
  const {
    registrations,
    students,
    activityLog,
    stats,
    createStudentAccountFromIntake,
    createStudentAccount,
    sendPortalCredentials,
    approveRegistration,
    rejectRegistration,
  } = useAdminStore();
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [backendStats, setBackendStats] = useState<{
    totalStudents: number;
    activeThisWeek: number;
    coursesPublished: number;
    pendingApprovals: number;
    openJobs: number;
    securityAlerts: number;
  } | null>(null);
  const [activityBars, setActivityBars] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [latestJob, setLatestJob] = useState<{ company: string; role: string } | null>(null);
  const [liveStudents, setLiveStudents] = useState<DbStudent[]>([]);
  const [liveApplications, setLiveApplications] = useState<AdminJobApplicationActivity[]>([]);
  const approvedStudents = students.filter((student) => student.status !== "Pending Approval" && student.status !== "Rejected");
  const accountCandidates = registrations.filter((registration) => !["Completed", "Approval Pending by Admin", "Profile Completed - Approval Pending"].includes(registration.profileStatus ?? ""));
  const unsentAccountCandidates = accountCandidates.filter((registration) => registration.accountStatus !== "Credentials Sent");
  const profileApprovals = registrations.filter((registration) => ["Completed", "Approval Pending by Admin", "Profile Completed - Approval Pending"].includes(registration.profileStatus ?? ""));
  const selectedAccount = accountCandidates.find((registration) => registration.id === selectedAccountId) ?? accountCandidates[0];

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const [dashboard, activityData, liveJobs, databaseStudents, applications] = await Promise.all([getAdminDashboard(), getAdminDashboardActivity(), listAdminJobs(), listStudentsFromDb(), listJobApplicationActivity()]);
        setBackendStats({
          totalStudents: dashboard.stats.total_students,
          activeThisWeek: dashboard.stats.active_this_week,
          coursesPublished: dashboard.stats.courses_published,
          pendingApprovals: dashboard.stats.pending_approvals,
          openJobs: dashboard.stats.open_jobs,
          securityAlerts: dashboard.stats.security_alerts
        });
        setActivityBars(activityData.student_activity);
        setLatestJob(liveJobs[0] ?? null);
        setLiveStudents(databaseStudents);
        setLiveApplications(applications);
      } catch {
        setBackendStats(null);
      }
    };

    loadDashboardData();
  }, [stats.activeThisWeek, stats.pendingApprovals, stats.totalStudents]);

  const dashboardStats = [
    { label: "Total Students", value: String(backendStats?.totalStudents ?? stats.totalStudents), caption: "Approved accounts", tone: "indigo", icon: Users },
    { label: "Active This Week", value: String(backendStats?.activeThisWeek ?? stats.activeThisWeek), caption: "Logged in", tone: "emerald", icon: Activity },
    { label: "Courses Published", value: String(backendStats?.coursesPublished ?? 0), caption: "Shared database", tone: "blue", icon: BookOpen },
    { label: "Pending Approvals", value: String(backendStats?.pendingApprovals ?? stats.pendingApprovals), caption: "New registrations", tone: "amber", icon: ClipboardList },
    { label: "Open Jobs", value: String(backendStats?.openJobs ?? 0), caption: "Database jobs", tone: "violet", icon: BriefcaseBusiness },
    { label: "Assessment Flags", value: String(backendStats?.securityAlerts ?? 0), caption: "Need review", tone: "rose", icon: ShieldAlert }
  ];

  return (
    <AdminShell title="Dashboard" subtitle="Live admin control center for client testing">
      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-3 lg:gap-5">
        <div className="grid self-start gap-5 lg:col-span-2">
          <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {dashboardStats.map((stat) => (
              <StatCard key={stat.label} {...stat} />
            ))}
          </div>
          <SectionCard title="Student Activity">
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-7">
              {activityBars.map((height, index) => (
                <div key={index} className="flex h-36 flex-col justify-end rounded-md bg-slate-50 p-3 sm:h-44 xl:h-56">
                  <div className="rounded-t-md bg-portal-blue" style={{ height: `${height}%` }} />
                  <p className="mt-3 text-center text-xs font-semibold text-slate-500">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index]}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
        <div className="grid gap-5">
          <SectionCard title="Add Students">
            <div className="grid gap-3">
              <p className="text-sm text-slate-500">
                Add a new student, create portal login, and send credentials from one place.
              </p>
              <button
                onClick={() => {
                  setSelectedAccountId(selectedAccount?.id ?? "");
                  setShowAccountForm(true);
                }}
                className="flex h-11 items-center justify-center gap-2 rounded-md bg-portal-blue px-4 text-sm font-bold text-white"
              >
                <UserPlus size={17} />
                Add Students
              </button>
              <p className="text-xs font-semibold text-slate-500">
                {unsentAccountCandidates.length} saved student{unsentAccountCandidates.length === 1 ? "" : "s"} waiting.
              </p>
            </div>
          </SectionCard>

          <SectionCard title="New Student Registration Approvals">
            <div className="space-y-4">
              {liveStudents.filter((item) => ["Completed", "Approval Pending by Admin", "Profile Completed - Approval Pending"].includes(item.profile_status ?? "") || item.status === "Pending Approval").length === 0 ? (
                <div className="rounded-md border border-slate-100 bg-slate-50 p-4 text-sm font-semibold text-slate-600">
                  No completed profiles waiting for approval.
                </div>
              ) : liveStudents.filter((item) => ["Completed", "Approval Pending by Admin", "Profile Completed - Approval Pending"].includes(item.profile_status ?? "") || item.status === "Pending Approval").map((approval) => (
                <div key={approval.id} className="rounded-md border border-portal-line p-4">
                  <p className="font-bold text-slate-950">{approval.name}</p>
                  <p className="mt-1 text-sm text-slate-500">{approval.register_number} · {approval.email}</p>
                  <p className="mt-2 text-xs font-semibold text-emerald-600">{approval.profile_status || approval.status}</p>
                  <div className="mt-3 flex gap-2">
                    <Link href={`/admin/students/${approval.id}`} className="grid h-8 flex-1 place-items-center rounded-md border border-portal-line px-3 text-xs font-bold text-portal-blue">View student</Link>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
          <SectionCard title="Portal Snapshot">
            <div className="space-y-4">
              {[
                { title: "Published courses", value: `${backendStats?.coursesPublished ?? 0} courses`, caption: "Read from the shared database", icon: BookOpen },
                { title: "Latest job", value: latestJob?.company || "No jobs published", caption: latestJob?.role || "Create a job to display it here", icon: BriefcaseBusiness },
                { title: "Assessment flags", value: `${backendStats?.securityAlerts ?? 0} flagged`, caption: "Live assessment security data", icon: ClipboardList }
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="flex gap-3">
                    <div className="mt-1 grid h-8 w-8 place-items-center rounded-full bg-blue-50 text-portal-blue">
                      <Icon size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-slate-500">{item.title}</p>
                      <p className="text-sm font-bold text-slate-900">{item.value}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.caption}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
          <SectionCard title="Live Activity">
            <div className="space-y-3 text-sm text-slate-600">
              {liveApplications.slice(0, 6).map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  <CheckCircle2 size={18} className="text-emerald-500" />
                  <span><b>{item.studentName}</b> applied for {item.jobTitle}</span>
                </div>
              ))}
              {!liveApplications.length ? <p className="text-sm text-slate-500">No confirmed job applications yet.</p> : null}
            </div>
          </SectionCard>
        </div>
      </div>
      {showAccountForm ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30">
          <div className="h-full w-full overflow-y-auto border-l border-portal-line bg-white p-4 shadow-2xl sm:max-w-[520px] sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3 border-b border-portal-line pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Student Onboarding</h2>
                <p className="mt-1 text-sm text-slate-500">Create one account manually or import multiple students by CSV.</p>
              </div>
              <button
                onClick={() => setShowAccountForm(false)}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-portal-line text-lg font-bold text-slate-600"
                aria-label="Close create account panel"
              >
                x
              </button>
            </div>
            <BulkCsvAccountCreator onCreate={(record, account) => createStudentAccountFromIntake(record, account)} />
            <DashboardAccountCreator
              registrations={accountCandidates}
              selectedId={selectedAccountId}
              onSelect={setSelectedAccountId}
              registration={selectedAccount}
              onAfterCreate={setSelectedAccountId}
              onCreateNew={(record, account) => createStudentAccountFromIntake(record, account)}
              onCreate={(registrationId, account) => createStudentAccount(registrationId, account)}
              onCancel={() => setShowAccountForm(false)}
              onSend={(registrationId, account) => {
                setSelectedAccountId(registrationId);
                return sendPortalCredentials(registrationId, account);
              }}
            />
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}

type IntakeRecord = {
  name: string;
  regNo: string;
  email: string;
  phone?: string;
  degree?: string;
  branch?: string;
  batch: string;
};

type DashboardAccountCreatorProps = {
  registrations: Array<{
    id: string;
    name: string;
    regNo: string;
    email: string;
    accountStatus?: string;
  }>;
  selectedId: string;
  onSelect: (id: string) => void;
  registration?: {
    id: string;
    name: string;
    regNo: string;
    email: string;
    username?: string;
    tempPassword?: string;
    portalLink?: string;
    credentialEmail?: string;
    senderEmail?: string;
    companyEmail?: string;
  };
  onAfterCreate: (registrationId: string) => void;
  onCreateNew: (record: IntakeRecord, account: { name: string; username: string; tempPassword: string; portalLink: string; credentialEmail: string; senderEmail: string; companyEmail: string }) => Promise<string>;
  onCreate: (registrationId: string, account: { name: string; username: string; tempPassword: string; portalLink: string; credentialEmail: string; deliveryEmail?: string; senderEmail: string; companyEmail: string }) => Promise<unknown> | void;
  onSend: (
    registrationId: string,
    account: { name?: string; username?: string; tempPassword?: string; portalLink?: string; credentialEmail?: string; deliveryEmail?: string; senderEmail?: string; companyEmail?: string }
  ) => Promise<{ sent: boolean; mode: string; message: string } | null>;
  onCancel: () => void;
};

function DashboardAccountCreator({ registrations, selectedId, onSelect, registration, onAfterCreate, onCreateNew, onCreate, onSend, onCancel }: DashboardAccountCreatorProps) {
  const { batches, selectedBatch } = useAdminBatch();
  const fixedStorageKey = "student-account-fixed-fields-v1";
  const defaultPortalLink = process.env.NEXT_PUBLIC_STUDENT_PORTAL_LINK ?? "http://localhost:3000";
  const defaultSenderEmail = process.env.NEXT_PUBLIC_DEFAULT_SENDER_EMAIL ?? "";
  const [mode, setMode] = useState<"saved" | "new">(registration ? "saved" : "new");
  const [createdRegistrationId, setCreatedRegistrationId] = useState("");
  const [name, setName] = useState(registration?.name ?? "");
  const [regNo, setRegNo] = useState(registration?.regNo ?? "");
  const [phone, setPhone] = useState("");
  const [degree, setDegree] = useState("");
  const [branch, setBranch] = useState("");
  const [batch, setBatch] = useState(selectedBatch || "2026 A");
  const [personalEmail, setPersonalEmail] = useState("");
  const [credentialEmail, setCredentialEmail] = useState(registration?.credentialEmail ?? "");
  const [senderEmail, setSenderEmail] = useState(registration?.senderEmail ?? defaultSenderEmail);
  const [companyEmail, setCompanyEmail] = useState(registration?.companyEmail ?? "");
  const [username, setUsername] = useState(registration?.username ?? "");
  const [tempPassword, setTempPassword] = useState(registration?.tempPassword ?? "");
  const [portalLink, setPortalLink] = useState(registration?.portalLink ?? defaultPortalLink);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const saved = window.localStorage.getItem(fixedStorageKey);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as { senderEmail?: string; companyEmail?: string; portalLink?: string };
      const savedSender = parsed.senderEmail?.includes("client-company.com") ? defaultSenderEmail : parsed.senderEmail;
      setSenderEmail((current) => current || savedSender || defaultSenderEmail);
      setCompanyEmail((current) => current || parsed.companyEmail || "");
      const savedPortalLink = parsed.portalLink?.includes("/admin/dashboard") ? defaultPortalLink : parsed.portalLink;
      setPortalLink((current) => current || savedPortalLink || defaultPortalLink);
    } catch {
      window.localStorage.removeItem(fixedStorageKey);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(fixedStorageKey, JSON.stringify({ senderEmail, companyEmail, portalLink }));
  }, [senderEmail, companyEmail, portalLink]);

  useEffect(() => {
    if (!registration || mode === "new") return;
    setName(registration.name);
    setRegNo(registration.regNo);
    setPersonalEmail("");
    setCredentialEmail(registration.credentialEmail ?? "");
    setSenderEmail((current) => {
      const next = registration.senderEmail ?? current;
      return next.includes("client-company.com") ? defaultSenderEmail : next;
    });
    setCompanyEmail((current) => registration.companyEmail ?? current);
    setUsername(registration.username ?? "");
    setTempPassword(registration.tempPassword ?? "");
    setPortalLink((current) => {
      const next = registration.portalLink ?? current;
      return next.includes("/admin/dashboard") ? defaultPortalLink : next;
    });
    setCreatedRegistrationId("");
    setNotice("");
  }, [mode, registration]);

  const requiredReady = [name, regNo, personalEmail, credentialEmail, senderEmail, companyEmail, portalLink].every(
    (value) => value.trim().length > 0
  ) && (mode !== "new" || batch.trim().length > 0);

  async function requireFilled(action: () => Promise<void> | void) {
    if (!requiredReady) {
      setNotice(mode === "new" && !batch.trim() ? "Enter the student batch name (for example, 2026 A)." : "Fill all account and email fields before creating or sending credentials.");
      return;
    }
    const normalizedBatch = batch.trim().replace(/\s+/g, " ");
    if (mode === "new" && !/^\d{4}\s+[A-Za-z0-9][A-Za-z0-9 _-]*$/.test(normalizedBatch)) {
      setNotice("Batch must start with a four-digit year followed by an editable label, for example 2026 A, 2026 1, or 2026 Cybersecurity.");
      return;
    }
    if (!credentialEmail.trim().toLowerCase().endsWith("@cyberlancers.in")) {
      setNotice("The allocated Student login email must end with @cyberlancers.in.");
      return;
    }
    if (personalEmail.trim().toLowerCase() === credentialEmail.trim().toLowerCase()) {
      setNotice("Enter the student's personal registration email as the delivery inbox, not the Cyber Lancers login.");
      return;
    }
    setNotice("");
    try {
      await action();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setNotice(message || "Action failed. Check backend and database connection.");
    }
  }

  function clearStudentFields() {
    setName("");
    setRegNo("");
    setPhone("");
    setDegree("");
    setBranch("");
    setBatch(selectedBatch || "2026 A");
    setPersonalEmail("");
    setCredentialEmail("");
    setUsername("");
    setTempPassword("");
    setCreatedRegistrationId("");
  }

  function switchToNew() {
    clearStudentFields();
    setMode("new");
    setNotice("");
  }

  function switchToSaved() {
    setMode("saved");
    setCreatedRegistrationId("");
    setNotice("");
  }

  return (
    <div className="min-w-0 rounded-md border border-portal-line bg-white p-3">
      <div className="mb-3 grid grid-cols-2 rounded-md border border-portal-line bg-slate-50 p-1 text-xs font-bold">
        <button
          onClick={switchToNew}
          className={`h-9 rounded-md ${mode === "new" ? "bg-portal-blue text-white" : "text-slate-600"}`}
        >
          Add New Student
        </button>
        <button
          onClick={switchToSaved}
          disabled={!registrations.length}
          className={`h-9 rounded-md disabled:text-slate-300 ${mode === "saved" ? "bg-portal-blue text-white" : "text-slate-600"}`}
        >
          Saved Students
        </button>
      </div>
      {mode === "saved" ? (
        <label className="mb-3 block text-xs">
          <span className="mb-1 block font-bold text-slate-600">Select Student</span>
          <select
            value={selectedId}
            onChange={(event) => onSelect(event.target.value)}
            className="h-9 w-full rounded-md border border-portal-line px-3 outline-none focus:border-portal-blue"
          >
            {registrations.map((item) => (
              <option key={item.id} value={item.id}>{item.name} - {item.regNo} - {item.accountStatus ?? "Not Created"}</option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="grid gap-3 text-xs">
        <label>
          <span className="mb-1 block font-bold text-slate-600">Student Name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} className="h-9 w-full rounded-md border border-portal-line px-3 outline-none focus:border-portal-blue" />
        </label>
        <label>
          <span className="mb-1 block font-bold text-slate-600">Registration Number</span>
          <input value={regNo} onChange={(event) => setRegNo(event.target.value)} className="h-9 w-full rounded-md border border-portal-line px-3 outline-none focus:border-portal-blue" placeholder="student registration number" />
        </label>
        {mode === "new" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="mb-1 block font-bold text-slate-600">Phone</span>
              <input value={phone} onChange={(event) => setPhone(event.target.value)} className="h-9 w-full rounded-md border border-portal-line px-3 outline-none focus:border-portal-blue" placeholder="optional" />
            </label>
            <label>
              <span className="mb-1 block font-bold text-slate-600">Batch *</span>
              <select value={batch} onChange={(event) => setBatch(event.target.value)} className="h-9 w-full rounded-md border border-portal-line bg-white px-3 outline-none focus:border-portal-blue">{batches.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select>
              <span className="mt-1 block text-[11px] text-slate-500">Create additional batches from Select Batch in the topbar.</span>
            </label>
            <label>
              <span className="mb-1 block font-bold text-slate-600">Degree</span>
              <input value={degree} onChange={(event) => setDegree(event.target.value)} className="h-9 w-full rounded-md border border-portal-line px-3 outline-none focus:border-portal-blue" placeholder="optional" />
            </label>
            <label>
              <span className="mb-1 block font-bold text-slate-600">Branch</span>
              <input value={branch} onChange={(event) => setBranch(event.target.value)} className="h-9 w-full rounded-md border border-portal-line px-3 outline-none focus:border-portal-blue" placeholder="optional" />
            </label>
          </div>
        ) : null}
        <label>
          <span className="mb-1 block font-bold text-slate-600">Personal Email Used During Registration</span>
          <input value={personalEmail} onChange={(event) => setPersonalEmail(event.target.value)} className="h-9 w-full rounded-md border border-portal-line px-3 outline-none focus:border-portal-blue" placeholder="student's personal inbox" type="email" />
        </label>
        <label>
          <span className="mb-1 block font-bold text-slate-600">From Address</span>
          <input value={senderEmail} onChange={(event) => setSenderEmail(event.target.value)} className="h-9 w-full rounded-md border border-portal-line px-3 outline-none focus:border-portal-blue" placeholder="sender email address" />
        </label>
        <label>
          <span className="mb-1 block font-bold text-slate-600">Company Email For Student</span>
          <input value={companyEmail} onChange={(event) => setCompanyEmail(event.target.value)} className="h-9 w-full rounded-md border border-portal-line px-3 outline-none focus:border-portal-blue" placeholder="company email assigned to student" />
        </label>
        <label>
          <span className="mb-1 block font-bold text-slate-600">Portal Link</span>
          <input value={portalLink} onChange={(event) => setPortalLink(event.target.value)} className="h-9 w-full rounded-md border border-portal-line px-3 outline-none focus:border-portal-blue" placeholder="portal login URL" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="mb-1 block font-bold text-slate-600">Cyber Lancers Login Email</span>
            <input value={credentialEmail} onChange={(event) => setCredentialEmail(event.target.value)} className="h-9 w-full rounded-md border border-portal-line px-3 outline-none focus:border-portal-blue" placeholder="name@cyberlancers.in" type="email" />
          </label>
        </div>
      </div>
      <div className="mt-3 overflow-hidden rounded-md bg-white p-3 text-xs text-slate-700">
        <p className="font-bold">Email Preview</p>
        <p className="mt-1">From: {senderEmail}</p>
        <p>To: {personalEmail}</p>
        <p>Subject: Your student portal login credentials</p>
        <p className="mt-2 break-words">Hello {name}, your portal account is ready. Use {portalLink} with email {credentialEmail}. A secure temporary password will be generated and sent only to the student.</p>
        <p className="mt-1 break-words">Company email for future updates: {companyEmail}</p>
      </div>
      {notice ? <p className="mt-3 rounded-md bg-amber-50 p-3 text-xs font-bold text-amber-700">{notice}</p> : null}
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <button onClick={onCancel} className="h-9 rounded-md border border-portal-line bg-white px-3 text-xs font-bold text-slate-700">Cancel</button>
        <button
          onClick={() => requireFilled(async () => {
            let registrationId = selectedId;
            if (mode === "new") {
              if (createdRegistrationId) {
                registrationId = createdRegistrationId;
                await onCreate(registrationId, { name, username: credentialEmail, tempPassword, portalLink, credentialEmail, deliveryEmail: personalEmail, senderEmail, companyEmail });
              } else {
                registrationId = await onCreateNew(
                  { name, regNo, email: personalEmail, phone, degree, branch, batch: batch.trim().replace(/\s+/g, " ") },
                  { name, username: credentialEmail, tempPassword, portalLink, credentialEmail, senderEmail, companyEmail }
                );
                if (!registrationId) {
                  setNotice("This registration number already exists, the student details are incomplete, or the database rejected duplicate email/username.");
                  return;
                }
                onSelect(registrationId);
                onAfterCreate(registrationId);
                setCreatedRegistrationId(registrationId);
              }
            } else {
              if (!registrationId) {
                setNotice("Select a saved student first.");
                return;
              }
              await onCreate(registrationId, { name, username: credentialEmail, tempPassword, portalLink, credentialEmail, deliveryEmail: personalEmail, senderEmail, companyEmail });
              setCreatedRegistrationId(registrationId);
            }
            setNotice(`Account created for ${credentialEmail}; credentials sent to ${personalEmail}. Enter a recipient again if you need to resend.`);
            setPersonalEmail("");
          })}
          className="h-9 rounded-md border border-portal-line bg-white px-3 text-xs font-bold text-slate-700"
        >
          {createdRegistrationId ? "Update & Send Mail" : "Create Account & Send Mail"}
        </button>
        <button onClick={() => requireFilled(async () => {
          const registrationId = createdRegistrationId || selectedId;
          if (!registrationId) {
            setNotice("Create the account first, then send credentials.");
            return;
          }
          try {
            const result = await onSend(registrationId, { name, username: credentialEmail, tempPassword, portalLink, credentialEmail, deliveryEmail: personalEmail, senderEmail, companyEmail });
            if (result && result.sent) {
              setNotice("Credentials sent. Add the next student when ready.");
              clearStudentFields();
              setMode("new");
            } else {
              setNotice(`Send failed: ${result?.message ?? 'Unknown error'}`);
            }
          } catch (err: unknown) {
            setNotice(`Credential send failed: ${err instanceof Error ? err.message : String(err)}`);
          }
        })} className="flex h-9 flex-1 items-center justify-center gap-1 rounded-md bg-portal-blue px-3 text-xs font-bold text-white">
          <Mail size={14} />
          {createdRegistrationId || mode === "saved" ? "Send Mail Again" : "Send Mail"}
        </button>
      </div>
    </div>
  );
}

type CsvStudentRow = {
  name: string;
  register_number: string;
  delivery_email: string;
  login_email: string;
  temp_password?: string;
  phone: string;
  degree: string;
  branch: string;
  batch: string;
};

function parseStudentCsv(text: string): string[][] {
  const rows: string[][] = [];
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiters = [",", ";", "\t"];
  const delimiter = delimiters.reduce((best, candidate) =>
    firstLine.split(candidate).length > firstLine.split(best).length ? candidate : best
  , ",");
  let row: string[] = [], value = "", quoted = false;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (character === "\"") {
      if (quoted && text[index + 1] === "\"") { value += "\""; index++; } else quoted = !quoted;
    } else if (character === delimiter && !quoted) { row.push(value.trim()); value = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index++;
      row.push(value.trim()); value = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else value += character;
  }
  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function BulkCsvAccountCreator({ onCreate }: {
  onCreate: DashboardAccountCreatorProps["onCreateNew"];
}) {
  const { batches, selectedBatch } = useAdminBatch();
  const [rows, setRows] = useState<CsvStudentRow[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [bulkBatch, setBulkBatch] = useState(selectedBatch || "2026 A");
  const portalLink = process.env.NEXT_PUBLIC_STUDENT_PORTAL_LINK ?? "http://localhost:3000";
  const preview = rows[previewIndex] ?? rows[0];

  function rowError(row: CsvStudentRow) {
    if (!row.name || !row.delivery_email || !row.login_email) return "Student name, sender mail and login mail are required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.delivery_email)) return "Sender mail is not a valid email address";
    if (!row.login_email.toLowerCase().endsWith("@cyberlancers.in")) return "Login email must end with @cyberlancers.in";
    if (!/^\d{4}\s+[A-Za-z0-9][A-Za-z0-9 _-]*$/.test(row.batch)) return "Batch must use a four-digit year and label, for example 2026 A";
    return "";
  }

  function downloadTemplate() {
    const csv = "student_name,sender_mail,login_mail\r\nExample Student,personal@example.com,example.student@cyberlancers.in";
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url; link.download = "cyber-academy-student-import-template.csv"; link.click();
    URL.revokeObjectURL(url);
  }

  async function createAll() {
    const normalizedBatch = bulkBatch.trim().replace(/\s+/g, " ");
    if (!/^\d{4}\s+[A-Za-z0-9][A-Za-z0-9 _-]*$/.test(normalizedBatch)) {
      setNotice("Enter a valid batch before bulk creation, for example 2026 A, 2026 1, or 2026 Cybersecurity.");
      return;
    }
    setBusy(true); setNotice("");
    let created = 0;
    const errors: string[] = [];
    const seen = new Set<string>();
    for (let index = 0; index < rows.length; index++) {
      const row = { ...rows[index], batch: normalizedBatch };
      try {
        const validationError = rowError(row);
        if (validationError) throw new Error(validationError);
        const identity = `${row.register_number.toLowerCase()}|${row.login_email.toLowerCase()}`;
        if (seen.has(identity)) throw new Error("duplicate CSV row");
        seen.add(identity);
        const id = await onCreate(
          { name: row.name, regNo: row.register_number, email: row.delivery_email, phone: row.phone, degree: row.degree, branch: row.branch, batch: row.batch },
          { name: row.name, username: row.login_email, credentialEmail: row.login_email, tempPassword: "", portalLink, senderEmail: "", companyEmail: "" }
        );
        if (!id) throw new Error("student already exists or could not be created");
        created++;
      } catch (error) {
        errors.push(`Row ${index + 2}: ${error instanceof Error ? error.message : "failed"}`);
      }
    }
    setNotice(`${created} of ${rows.length} accounts created and emailed.${errors.length ? ` ${errors.slice(0, 4).join(" ")}` : ""}`);
    if (created === rows.length) setRows([]);
    setBusy(false);
  }

  return (
    <section className="mb-6 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="font-bold text-slate-950">Bulk student creation</h3><p className="mt-1 text-sm text-slate-500">Upload CSV rows and send each student the same credential email used by manual creation.</p></div>
        <button type="button" onClick={downloadTemplate} className="flex h-10 items-center gap-2 rounded-md border border-portal-line px-4 text-sm font-bold text-portal-blue"><Download size={16} /> CSV Template</button>
      </div>
      <label className="mt-4 block max-w-md">
        <span className="mb-1 block text-xs font-bold text-slate-700">Batch for every imported student *</span>
        <select value={bulkBatch} onChange={(event) => {
          const next = event.target.value;
          setBulkBatch(next);
          setRows((current) => current.map((row) => ({ ...row, batch: next.trim().replace(/\s+/g, " ") })));
        }} className="h-10 w-full rounded-md border border-portal-line bg-white px-3 text-sm outline-none focus:border-portal-blue">{batches.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select>
        <span className="mt-1 block text-xs text-slate-500">Every row will be assigned to this stored batch.</span>
      </label>
      <label className="mt-4 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-blue-200 bg-blue-50 p-4 text-center">
        <Upload size={25} className="text-portal-blue" /><span className="mt-2 font-bold text-slate-800">Choose student CSV</span>
        <input type="file" accept=".csv,text/csv" className="hidden" onChange={async (event) => {
          const file = event.target.files?.[0]; if (!file) return;
          const parsed = parseStudentCsv(await file.text());
          const normalizeHeader = (header: string) => header.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
          const headers = (parsed[0] ?? []).map(normalizeHeader);
          const aliases: Record<keyof CsvStudentRow, string[]> = {
            name: ["name", "student_name", "student", "full_name"],
            register_number: ["register_number", "registration_number", "register_no", "reg_no", "usn", "student_id"],
            delivery_email: ["delivery_email", "sender_mail", "sender_email", "recipient_email", "personal_email", "email", "email_id", "mail", "mail_id"],
            login_email: ["login_email", "login_mail", "login_email_id", "login_mail_id", "cyberlancers_email", "cyberlancers_mail", "username", "user_email"],
            temp_password: ["temp_password", "temporary_password", "password"],
            phone: ["phone", "phone_number", "mobile", "mobile_number"],
            degree: ["degree", "course", "programme", "program"],
            branch: ["branch", "department", "specialization"],
            batch: ["batch", "graduation_year", "year"]
          };
          const columnIndex = (field: keyof CsvStudentRow) => {
            const exact = headers.findIndex((header) => aliases[field].includes(header));
            if (exact >= 0) return exact;
            return headers.findIndex((header) => {
              if (field === "name") return header.includes("name") && (header.includes("student") || header.includes("full"));
              if (field === "delivery_email") return (header.includes("sender") || header.includes("recipient") || header.includes("personal") || header.includes("delivery")) && (header.includes("mail") || header.includes("email"));
              if (field === "login_email") return (header.includes("login") || header.includes("username") || header.includes("cyberlancer")) && (header.includes("mail") || header.includes("email") || header.includes("user"));
              return false;
            });
          };
          const value = (row: string[], field: keyof CsvStudentRow) => {
            const index = columnIndex(field);
            return index >= 0 ? (row[index] ?? "").trim() : "";
          };
          if (columnIndex("name") < 0 || columnIndex("login_email") < 0 || columnIndex("delivery_email") < 0) {
            setNotice("CSV needs only three columns: student name, sender mail and login mail. Common header variations are accepted.");
            setRows([]);
            return;
          }
          setRows(parsed.slice(1).map((row, index) => {
            const loginEmail = value(row, "login_email").toLowerCase();
            const generatedRegistration = `CL-${(loginEmail.split("@")[0] || "STUDENT").replace(/[^a-z0-9]/gi, "").slice(0, 22).toUpperCase()}-${String(index + 1).padStart(4, "0")}`;
            return {
              name: value(row, "name"),
              register_number: value(row, "register_number") || generatedRegistration,
              delivery_email: value(row, "delivery_email").toLowerCase(),
              login_email: loginEmail,
              temp_password: value(row, "temp_password"),
              phone: value(row, "phone"),
              degree: value(row, "degree"),
              branch: value(row, "branch"),
              batch: bulkBatch.trim().replace(/\s+/g, " ")
            };
          }).filter((row) => row.name || row.delivery_email || row.login_email));
          setPreviewIndex(0);
          setNotice("");
        }} />
      </label>
      {rows.length && preview ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-amber-700">Bulk Approval</p><h4 className="mt-1 font-bold text-slate-950">Review every email before sending</h4></div><span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">{rows.length} emails</span></div>
        <label className="mt-4 block"><span className="mb-1 block text-xs font-bold text-slate-600">Preview student</span><select value={previewIndex} onChange={(event) => setPreviewIndex(Number(event.target.value))} className="h-10 w-full rounded-md border border-amber-200 bg-white px-3 text-sm">{rows.map((row, index) => <option key={`${row.register_number}-${index}`} value={index}>{index + 1}. {row.name || "Unnamed"} — {row.delivery_email || "No recipient"}</option>)}</select></label>
        {rowError(preview) ? <p className="mt-3 rounded-md bg-red-50 p-3 text-sm font-bold text-red-700">{rowError(preview)}</p> : null}
        <div className="mt-3 overflow-hidden rounded-lg border border-portal-line bg-white text-sm">
          <div className="border-b border-portal-line bg-slate-50 p-3"><p><b>From:</b> Cyber Academy</p><p className="mt-1 break-all"><b>To:</b> {preview.delivery_email || "Missing recipient email"}</p><p className="mt-1"><b>Subject:</b> Your Cyber Academy portal login</p></div>
          <div className="space-y-3 p-4 text-slate-700"><p>Hello <b>{preview.name || "Student"}</b>,</p><p>Your Cyber Academy account is ready.</p><div className="rounded-md bg-blue-50 p-3"><p><b>Username:</b> {preview.login_email || "Missing login email"}</p><p className="mt-1">A secure temporary password will be generated and emailed directly to the student.</p></div><p><b>Portal:</b> <span className="break-all text-portal-blue">{portalLink}</span></p><p>Please change your password after signing in.</p></div>
        </div>
        <div className="mt-3 max-h-36 overflow-y-auto rounded-md border border-amber-200 bg-white">{rows.map((row, index) => <button type="button" key={`${row.login_email}-${index}`} onClick={() => setPreviewIndex(index)} className={`flex w-full items-center justify-between gap-3 border-b border-portal-line p-3 text-left text-xs last:border-0 ${previewIndex === index ? "bg-blue-50" : ""}`}><span><b>{row.name || `Row ${index + 2}`}</b><br /><span className="text-slate-500">{row.delivery_email}</span></span><span className={rowError(row) ? "font-bold text-red-600" : "font-bold text-emerald-600"}>{rowError(row) ? "Needs correction" : "Ready"}</span></button>)}</div>
        <button type="button" disabled={busy || rows.some((row) => Boolean(rowError(row)))} onClick={() => void createAll()} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"><Mail size={17} />{busy ? "Creating and emailing..." : `Approve, Create & Send ${rows.length} Emails`}</button>
        {rows.some((row) => Boolean(rowError(row))) ? <p className="mt-2 text-xs font-semibold text-red-600">Correct the invalid CSV rows before bulk approval can continue.</p> : null}
      </div> : null}
      {notice ? <p className="mt-3 rounded-md bg-blue-50 p-3 text-sm font-semibold text-slate-700">{notice}</p> : null}
    </section>
  );
}

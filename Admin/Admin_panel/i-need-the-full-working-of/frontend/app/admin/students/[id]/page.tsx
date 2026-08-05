"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { ProgressBar } from "@/components/admin/ProgressBar";
import { SectionCard } from "@/components/admin/SectionCard";
import { useAdminStore } from "@/lib/admin-store";
import { getStudentLearningRecord, getStudentPortalAccess, listCoursesFromDb, listJobApplicationActivity, scheduleStudentDailyReminder, sendMessageToStudent, updateStudentPortalAccess, type AdminJobApplicationActivity, type DbCourse, type PortalAccessSettings, type StudentLearningAssessment, type StudentLearningRecord } from "@/lib/admin-api";
import { Bell, BookOpen, BriefcaseBusiness, CheckCircle2, ClipboardCheck, LockKeyhole, Mail, ShieldCheck, ShieldOff, Trash2, UserCheck, X, XCircle } from "lucide-react";
import { studentPortalUrl } from "@/lib/urls";

export default function StudentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const {
    students,
    registrations,
    approveRegistration,
    rejectRegistration,
    verifyPayment,
    createStudentAccount,
    sendPortalCredentials,
    markProfileCompleted,
    sendMessage,
    scheduleDailyReminder,
    sendRegistrationOtp,
    assignCourse,
    resetPassword,
    suspendStudent,
    deleteStudent
  } = useAdminStore();
  const [message, setMessage] = useState("Complete today's course module and submit the pending quiz before 8 PM.");
  const [reminder, setReminder] = useState("Daily reminder: continue your course, complete pending lessons, and check new job updates.");
  const [jobApplications, setJobApplications] = useState<AdminJobApplicationActivity[]>([]);
  const [databaseCourses, setDatabaseCourses] = useState<DbCourse[]>([]);
  const [learningRecord, setLearningRecord] = useState<StudentLearningRecord | null>(null);
  const [selectedLearningCourseId, setSelectedLearningCourseId] = useState<number | null>(null);
  const [selectedLearningAssessment, setSelectedLearningAssessment] = useState<StudentLearningAssessment | null>(null);
  const [messageNotice, setMessageNotice] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [reminderTime, setReminderTime] = useState("09:00");
  const [schedulingReminder, setSchedulingReminder] = useState(false);
  const [reminderNotice, setReminderNotice] = useState("");
  const [portalAccess, setPortalAccess] = useState<PortalAccessSettings>({ courses_enabled: false, assessments_enabled: false, jobs_enabled: false });
  const [accessNotice, setAccessNotice] = useState("");
  const [deletingStudent, setDeletingStudent] = useState(false);
  const [deleteNotice, setDeleteNotice] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [adminActionNotice, setAdminActionNotice] = useState("");
  const [adminActionBusy, setAdminActionBusy] = useState(false);

  const student = students.find((item) => item.id === params.id || item.id === `DB-STU-${params.id}`);
  const registration = student ? registrations.find((item) => item.studentId === student.id) : undefined;
  const [username, setUsername] = useState("");
  const [deliveryEmail, setDeliveryEmail] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [portalLink, setPortalLink] = useState(studentPortalUrl);
  const selectedLearningCourse = learningRecord?.courses.find((course) => course.id === selectedLearningCourseId);
  const activityTimeline = useMemo(() => {
    const events: Array<{ at: string; title: string; detail: string }> = [];
    for (const course of learningRecord?.courses ?? []) {
      if (course.assigned_at) events.push({ at: course.assigned_at, title: "Course assigned", detail: course.title });
      for (const assessment of course.assessments) {
        for (const attempt of assessment.attempts) events.push({ at: attempt.submitted_at ?? attempt.started_at, title: "Assessment submitted", detail: `${assessment.assessment_title} · ${attempt.score}%` });
      }
    }
    for (const assessment of learningRecord?.standalone_assessments ?? []) {
      for (const attempt of assessment.attempts) events.push({ at: attempt.submitted_at ?? attempt.started_at, title: "Assessment submitted", detail: `${assessment.assessment_title} · ${attempt.score}%` });
    }
    for (const application of jobApplications) events.push({ at: application.changedAt, title: "Job application", detail: `${application.jobTitle} at ${application.company}` });
    return events.filter((event) => !Number.isNaN(new Date(event.at).getTime())).sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [jobApplications, learningRecord]);

  useEffect(() => {
    if (registration) {
      setUsername(registration.credentialEmail ?? registration.username ?? "");
      setTempPassword(registration.tempPassword ?? `${registration.name.split(" ")[0]}@${registration.regNo.slice(-4)}`);
      setPortalLink(registration.portalLink ?? studentPortalUrl);
    } else if (student) {
      setUsername(student.email.endsWith("@cyberlancers.in") ? student.email : "");
      setTempPassword(`${student.name.split(" ")[0]}@${student.regNo.slice(-4)}`);
    }
  }, [registration, student]);

  useEffect(() => {
    if (!student) return;
    const databaseId = registration?.dbStudentId ?? Number(student.id.replace("DB-STU-", ""));
    if (!Number.isFinite(databaseId)) return;
    void listJobApplicationActivity().then((jobs) => {
      setJobApplications(jobs.filter((item) => item.studentEmail.toLowerCase() === student.email.toLowerCase()));
    }).catch(() => setJobApplications([]));
    void listCoursesFromDb().then(setDatabaseCourses).catch(() => setDatabaseCourses([]));
    void getStudentLearningRecord(databaseId).then(setLearningRecord).catch(() => setLearningRecord(null));
  }, [registration?.dbStudentId, student]);

  useEffect(() => {
    if (!student) return;
    const databaseId = registration?.dbStudentId ?? Number(student.id.replace("DB-STU-", ""));
    if (Number.isFinite(databaseId)) void getStudentPortalAccess(databaseId).then(setPortalAccess).catch(() => undefined);
  }, [registration, student]);

  async function toggleStudentAccess(key: keyof PortalAccessSettings) {
    if (!student) return;
    const databaseId = registration?.dbStudentId ?? Number(student.id.replace("DB-STU-", ""));
    if (!Number.isFinite(databaseId)) return setAccessNotice("This student is not linked to a database profile.");
    const next = { ...portalAccess, [key]: !portalAccess[key] };
    try {
      setPortalAccess(await updateStudentPortalAccess(databaseId, next));
      setAccessNotice(`Dedicated access updated for ${student.name}.`);
    } catch (error) {
      setAccessNotice(error instanceof Error ? error.message : "Student access could not be updated.");
    }
  }

  if (!student) {
    return <AdminShell title="Student Details" subtitle="Loading shared-database student record"><div className="rounded-lg border border-dashed border-portal-line bg-white p-10 text-center text-sm text-slate-500">Loading student information or the requested student was not found.</div></AdminShell>;
  }

  return (
    <AdminShell title={student.name} subtitle={`${student.regNo} - ${student.email}`}>
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="grid gap-5">
          {student.status === "Pending Approval" && registration ? (
            <>
              <SectionCard title="Registration Review">
                <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                  <div>
                    <p className="flex items-center gap-2 text-xl font-bold text-orange-600">
                      <CheckCircle2 size={22} />
                      Awaiting Super Admin Setup
                    </p>
                    <p className="mt-2 text-sm text-slate-500">Verify payment first. Then create the portal account manually and send login details.</p>
                    <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                      <span className="rounded-md bg-slate-50 p-3">Payment<br /><b>{registration.paymentStatus ?? "Pending Verification"}</b></span>
                      <span className="rounded-md bg-slate-50 p-3">Account<br /><b>{registration.accountStatus ?? "Not Created"}</b></span>
                      <span className="rounded-md bg-slate-50 p-3">Profile<br /><b>{registration.profileStatus ?? "Waiting for Student"}</b></span>
                    </div>
                  </div>
                  <button onClick={() => verifyPayment(registration.id)} className="h-10 rounded-md border border-portal-line px-4 text-sm font-bold text-slate-700">Verify Payment</button>
                </div>
              </SectionCard>

              <SectionCard title="Create Student Account">
                <div className="grid gap-4 lg:grid-cols-2">
                  <label>
                    <span className="mb-2 block text-sm font-bold text-slate-700">Portal Link</span>
                    <input value={portalLink} onChange={(event) => setPortalLink(event.target.value)} className="h-11 w-full rounded-md border border-portal-line px-3 outline-none focus:border-portal-blue" />
                  </label>
                  <label>
                    <span className="mb-2 block text-sm font-bold text-slate-700">Cyber Lancers Login Email</span>
                    <input value={username} onChange={(event) => setUsername(event.target.value)} className="h-11 w-full rounded-md border border-portal-line px-3 outline-none focus:border-portal-blue" placeholder="name@cyberlancers.in" type="email" />
                  </label>
                  <label>
                    <span className="mb-2 block text-sm font-bold text-slate-700">Send Credentials To</span>
                    <input value={deliveryEmail} onChange={(event) => setDeliveryEmail(event.target.value)} className="h-11 w-full rounded-md border border-portal-line px-3 outline-none focus:border-portal-blue" placeholder="Enter recipient for this email only" type="email" />
                  </label>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    onClick={() => createStudentAccount(registration.id, { username, credentialEmail: username, tempPassword, portalLink, deliveryEmail })}
                    className="h-10 rounded-md border border-portal-line px-4 text-sm font-bold text-slate-700"
                  >
                    Create &amp; Email Login
                  </button>
                  <button onClick={() => sendPortalCredentials(registration.id, { name: student.name, credentialEmail: username, deliveryEmail, tempPassword, portalLink })} className="h-10 rounded-md bg-portal-blue px-4 text-sm font-bold text-white">Send Mail</button>
                </div>
              </SectionCard>

              <SectionCard title="Profile Approval">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-bold text-slate-950">Approve only after the student logs in and fills profile information.</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-sm">
                      {registration.criteria.map((item) => (
                        <span key={item} className="rounded-md bg-emerald-50 px-3 py-2 font-semibold text-emerald-700">{item}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => markProfileCompleted(registration.id)} className="h-10 rounded-md border border-portal-line px-4 text-sm font-bold text-slate-700">Profile Filled</button>
                    <button onClick={() => approveRegistration(registration.id)} className="flex h-10 items-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-bold text-white"><UserCheck size={17} />Approve</button>
                    <button onClick={() => rejectRegistration(registration.id)} className="flex h-10 items-center gap-2 rounded-md border border-red-200 px-4 text-sm font-bold text-red-600"><XCircle size={17} />Reject</button>
                  </div>
                </div>
              </SectionCard>
            </>
          ) : (
            <SectionCard title="Student Details">
              <div className="grid gap-4 text-sm md:grid-cols-3">
                <div><p className="text-slate-500">Name</p><p className="mt-1 font-bold text-slate-950">{student.name}</p></div>
                <div><p className="text-slate-500">Register Number</p><p className="mt-1 font-bold text-slate-950">{student.regNo}</p></div>
                <div><p className="text-slate-500">Status</p><p className="mt-1 font-bold text-slate-950">{student.status}</p></div>
                <div><p className="text-slate-500">Email</p><p className="mt-1 font-bold text-slate-950">{student.email}</p></div>
                <div><p className="text-slate-500">Joined On</p><p className="mt-1 font-bold text-slate-950">{student.joined}</p></div>
                <div><p className="text-slate-500">Last Login</p><p className="mt-1 font-bold text-slate-950">{student.lastLogin}</p></div>
              </div>
            </SectionCard>
          )}
          <SectionCard title="Learning Progress">
            <div className="grid gap-5 md:grid-cols-3">
              <div><p className="text-sm text-slate-500">Overall progress</p><div className="mt-3"><ProgressBar value={student.progress} /></div></div>
              <div><p className="text-sm text-slate-500">Current module</p><p className="mt-3 font-bold">{student.module}</p></div>
              <div><p className="text-sm text-slate-500">Last login</p><p className="mt-3 font-bold">{student.lastLogin}</p></div>
            </div>
          </SectionCard>
          <SectionCard title="Academic Summary">
            <div className="grid gap-3 md:grid-cols-3">
              {(student.educationSummary ?? []).map((education) => <div key={education.level} className="rounded-md border border-portal-line bg-slate-50 p-4"><p className="font-bold text-slate-950">{education.level}</p><p className="mt-2 text-sm text-slate-500">Years: {education.year_from || "—"} to {education.year_to || "—"}</p><p className="mt-1 text-sm text-slate-500">Score: <b className="text-slate-800">{education.score || "—"}</b></p></div>)}
              {!(student.educationSummary ?? []).length ? <p className="text-sm text-slate-500">The student has not added academic scores yet.</p> : null}
            </div>
          </SectionCard>
          <SectionCard title="Assigned Courses">
            <p className="mb-4 text-sm text-slate-500">Click a course to inspect this student&apos;s progress, assessment attempts, and scores.</p>
            <div className="grid gap-3 md:grid-cols-2">
              {learningRecord?.courses.map((course) => (
                <button key={course.id} type="button" onClick={() => setSelectedLearningCourseId(course.id)} className="rounded-xl border border-portal-line p-4 text-left transition hover:border-portal-blue hover:bg-blue-50">
                  <div className="flex items-start justify-between gap-3"><div><p className="font-bold text-slate-950">{course.title}</p><p className="mt-1 text-sm text-slate-500">{course.category} · {course.level}</p><p className={`mt-2 text-xs font-bold ${course.assigned ? "text-emerald-600" : "text-portal-blue"}`}>{course.assigned ? "Assigned to student" : "Published and available"}</p></div><BookOpen size={20} className="text-portal-blue" /></div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs"><div className="rounded-md bg-slate-50 p-2"><b className="block text-base text-slate-900">{course.progress_percent}%</b>Progress</div><div className="rounded-md bg-slate-50 p-2"><b className="block text-base text-slate-900">{course.attempt_count}</b>Attempts</div><div className="rounded-md bg-slate-50 p-2"><b className="block text-base text-portal-blue">{course.average_score ?? "—"}</b>Avg. score</div></div>
                </button>
              ))}
              {!learningRecord?.courses.length ? <p className="text-sm text-slate-500">No courses have been assigned to this student.</p> : null}
            </div>
          </SectionCard>
          <SectionCard title="Assessment History">
            <p className="mb-4 text-sm text-slate-500">Course and standalone assessment attempts belonging only to {student.name}.</p>
            <div className="grid gap-3 md:grid-cols-2">
              {[...(learningRecord?.courses.flatMap((course) => course.assessments) ?? []), ...(learningRecord?.standalone_assessments ?? [])].map((assessment) => (
                <button key={assessment.assessment_id} type="button" onClick={() => setSelectedLearningAssessment(assessment)} className="rounded-xl border border-portal-line p-4 text-left transition hover:border-portal-blue hover:bg-blue-50">
                  <div className="flex items-start justify-between gap-3"><div><p className="font-bold text-slate-950">{assessment.assessment_title}</p><p className="mt-1 text-sm capitalize text-slate-500">{assessment.question_count} questions · {assessment.attempts_used} of {assessment.max_attempts} attempts used</p></div><ClipboardCheck size={20} className="text-portal-blue" /></div>
                  <div className="mt-4 flex items-end justify-between"><p className="text-xs capitalize text-slate-500">{assessment.latest_status.replaceAll("_", " ")}</p><p className="text-xl font-bold text-portal-blue">{assessment.latest_score === null || assessment.latest_score === undefined ? "Not attempted" : `${assessment.latest_score}%`}</p></div>
                </button>
              ))}
              {!(learningRecord?.courses.some((course) => course.assessments.length) || learningRecord?.standalone_assessments.length) ? <p className="text-sm text-slate-500">No assessment attempts recorded for this student.</p> : null}
            </div>
          </SectionCard>
          <SectionCard title="Activity Timeline">
            <div className="space-y-4 text-sm">
              {activityTimeline.map((item, index) => (
                <div key={`${item.at}-${index}`} className="rounded-md border border-portal-line p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold text-slate-900">{item.title}</p><time className="text-xs text-slate-500">{new Date(item.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })} IST</time></div><p className="mt-1 text-slate-600">{item.detail}</p></div>
              ))}
              {!activityTimeline.length ? <p className="rounded-md bg-slate-50 p-5 text-slate-500">No course assignments, assessment submissions, or job applications have been recorded for this student yet.</p> : null}
            </div>
          </SectionCard>
          <SectionCard title="Job Applications">
            <div className="grid gap-3 md:grid-cols-2">
              {jobApplications.map((application) => <div key={application.id} className="rounded-md border border-portal-line p-4"><p className="font-bold text-slate-950">{application.jobTitle}</p><p className="mt-1 text-sm text-slate-500">{application.company}</p><p className="mt-2 text-sm font-bold text-emerald-600">Applied</p><p className="mt-1 text-xs text-slate-500">{new Date(application.changedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "medium" })} IST</p></div>)}
              {!jobApplications.length ? <p className="text-sm text-slate-500">No confirmed job applications recorded.</p> : null}
            </div>
          </SectionCard>
        </div>
        <div className="grid content-start gap-5">
          <SectionCard title="Dedicated Portal Access">
            <p className="mb-4 text-sm text-slate-500">These settings affect only {student.name}.</p>
            <div className="space-y-3">
              <StudentAccessToggle label="Courses" enabled={portalAccess.courses_enabled} onClick={() => void toggleStudentAccess("courses_enabled")} />
              <StudentAccessToggle label="Assessments" enabled={portalAccess.assessments_enabled} onClick={() => void toggleStudentAccess("assessments_enabled")} />
              <StudentAccessToggle label="Jobs" enabled={portalAccess.jobs_enabled} onClick={() => void toggleStudentAccess("jobs_enabled")} />
            </div>
            {accessNotice ? <p className="mt-3 text-sm font-semibold text-slate-600">{accessNotice}</p> : null}
          </SectionCard>
          <SectionCard title="Student Communication">
            <div className="space-y-4">
              {student.status === "Pending Approval" && registration ? (
                <button
                  onClick={() => sendRegistrationOtp(registration.id)}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-portal-blue px-4 font-bold text-white"
                >
                  <ShieldCheck size={18} />
                  Send Email OTP
                </button>
              ) : null}
              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                  <Mail size={17} className="text-portal-blue" />
                  Manual Message
                </span>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  className="min-h-28 w-full rounded-md border border-portal-line p-3 text-sm outline-none focus:border-portal-blue"
                />
              </label>
              <button
                disabled={sendingMessage}
                onClick={async () => {
                  const databaseId = registration?.dbStudentId ?? Number(student.id.replace("DB-STU-", ""));
                  if (!Number.isFinite(databaseId) || !message.trim()) {
                    setMessageNotice("Enter a message and select a database-backed student.");
                    return;
                  }
                  setSendingMessage(true);
                  setMessageNotice("");
                  try {
                    await sendMessageToStudent(databaseId, message.trim());
                    sendMessage(student.id, message);
                    setMessageNotice(`Email delivered to ${student.email} and saved in the student's notifications.`);
                  } catch (error) {
                    setMessageNotice(error instanceof Error ? error.message : "Message could not be sent.");
                  } finally {
                    setSendingMessage(false);
                  }
                }}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-portal-blue px-4 font-bold text-white"
              >
                <Mail size={18} />
                {sendingMessage ? "Sending..." : "Send Message"}
              </button>
              {messageNotice ? <p className="text-sm font-semibold text-slate-600">{messageNotice}</p> : null}
              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                  <Bell size={17} className="text-portal-blue" />
                  Daily Reminder Automation
                </span>
                <textarea
                  value={reminder}
                  onChange={(event) => setReminder(event.target.value)}
                  className="min-h-24 w-full rounded-md border border-portal-line p-3 text-sm outline-none focus:border-portal-blue"
                />
              </label>
              <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">Daily send time (IST)</span><input type="time" value={reminderTime} onChange={(event) => setReminderTime(event.target.value)} className="h-11 w-full rounded-md border border-portal-line px-3" /></label>
              <button
                disabled={schedulingReminder}
                onClick={async () => {
                  const databaseId = registration?.dbStudentId ?? Number(student.id.replace("DB-STU-", ""));
                  if (!Number.isFinite(databaseId) || !reminder.trim()) {
                    setReminderNotice("Enter a reminder and select a database-backed student.");
                    return;
                  }
                  setSchedulingReminder(true);
                  setReminderNotice("");
                  try {
                    await scheduleStudentDailyReminder(databaseId, reminder.trim(), reminderTime);
                    scheduleDailyReminder(student.id, reminder);
                    setReminderNotice(`Daily reminder scheduled only for ${student.email} at ${reminderTime} IST.`);
                  } catch (error) {
                    setReminderNotice(error instanceof Error ? error.message : "Reminder could not be scheduled.");
                  } finally {
                    setSchedulingReminder(false);
                  }
                }}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-portal-line px-4 font-bold text-slate-700"
              >
                <Bell size={18} />
                {schedulingReminder ? "Scheduling..." : "Schedule Daily Reminder"}
              </button>
              {reminderNotice ? <p className="text-sm font-semibold text-slate-600">{reminderNotice}</p> : null}
            </div>
          </SectionCard>

          <SectionCard title="Admin Actions">
            <div className="space-y-3">
              <button
                disabled={adminActionBusy}
                onClick={async () => {
                  if (!window.confirm(`Reset the password for ${student.email}? A temporary password will be emailed and the current password will stop working.`)) return;
                  setAdminActionBusy(true);
                  setAdminActionNotice("");
                  try {
                    setAdminActionNotice(await resetPassword(student.id));
                  } catch (error) {
                    setAdminActionNotice(error instanceof Error ? error.message : "Password reset failed.");
                  } finally {
                    setAdminActionBusy(false);
                  }
                }}
                className="flex h-11 w-full items-center gap-3 rounded-md border border-portal-line px-4 font-bold text-slate-700 disabled:opacity-50"
              ><LockKeyhole size={18} />Reset Password &amp; Send Email</button>
              {adminActionNotice ? <p className="rounded-md bg-slate-50 p-3 text-sm font-semibold text-slate-700">{adminActionNotice}</p> : null}
              <button onClick={() => suspendStudent(student.id)} className="flex h-11 w-full items-center gap-3 rounded-md border border-red-200 px-4 font-bold text-red-600"><ShieldOff size={18} />Suspend Account</button>
              <button
                disabled={deletingStudent}
                onClick={async () => {
                  const confirmed = window.confirm(
                    `Permanently delete ${student.name} (${student.email})?\n\nThis removes the login and all associated student activity. This action cannot be undone.`
                  );
                  if (!confirmed) return;
                  setDeletingStudent(true);
                  setDeleteNotice("");
                  try {
                    await deleteStudent(student.id);
                    router.replace("/admin/students");
                  } catch (error) {
                    setDeleteNotice(error instanceof Error ? error.message : "Student deletion failed.");
                    setDeletingStudent(false);
                  }
                }}
                className="flex h-11 w-full items-center gap-3 rounded-md bg-red-600 px-4 font-bold text-white disabled:opacity-50"
              >
                <Trash2 size={18} />
                {deletingStudent ? "Deleting..." : "Delete Account & Data"}
              </button>
              {deleteNotice ? <p className="text-sm font-semibold text-red-600">{deleteNotice}</p> : null}
            </div>
          </SectionCard>
        </div>
      </div>
      {selectedLearningCourse ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" role="dialog" aria-modal="true" aria-label={`${selectedLearningCourse.title} details`} onMouseDown={(event) => { if (event.currentTarget === event.target) setSelectedLearningCourseId(null); }}>
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-portal-line bg-white p-5">
              <div><p className="text-xs font-bold uppercase tracking-wide text-portal-blue">Assigned course · {student.name}</p><h2 className="mt-1 text-xl font-bold text-slate-950">{selectedLearningCourse.title}</h2><p className="mt-1 text-sm text-slate-500">{selectedLearningCourse.category} · {selectedLearningCourse.level}</p></div>
              <button type="button" onClick={() => setSelectedLearningCourseId(null)} className="grid h-10 w-10 place-items-center rounded-full border border-portal-line text-slate-600" aria-label="Close course details"><X size={20} /></button>
            </div>
            <div className="grid gap-5 p-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <LearningSummary label="Progress" value={`${selectedLearningCourse.progress_percent}%`} />
                <LearningSummary label="Duration" value={selectedLearningCourse.duration || "Not specified"} />
                <LearningSummary label="Attempts" value={String(selectedLearningCourse.attempt_count)} />
                <LearningSummary label="Average Score" value={selectedLearningCourse.average_score === null || selectedLearningCourse.average_score === undefined ? "No score yet" : `${selectedLearningCourse.average_score}%`} />
              </div>
              <div className="grid gap-3 text-sm sm:grid-cols-2"><div className="rounded-md bg-slate-50 p-4"><p className="font-semibold text-slate-500">Instructor</p><p className="mt-1 font-bold text-slate-900">{selectedLearningCourse.instructor || "Not specified"}</p></div><div className="rounded-md bg-slate-50 p-4"><p className="font-semibold text-slate-500">{selectedLearningCourse.assigned ? "Assigned On" : "Availability"}</p><p className="mt-1 font-bold text-slate-900">{selectedLearningCourse.assigned_at ? `${new Date(selectedLearningCourse.assigned_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })} IST` : "Published to Student Portal"}</p></div></div>
              <div><h3 className="mb-3 font-bold text-slate-950">Pushed Course Assessments and Scores</h3><div className="space-y-3">{selectedLearningCourse.assessments.map((assessment) => <button key={assessment.assessment_id} type="button" onClick={() => setSelectedLearningAssessment(assessment)} className="flex w-full items-center justify-between gap-4 rounded-md border border-portal-line p-4 text-left hover:bg-blue-50"><div><p className="font-bold text-slate-900">{assessment.assessment_title}</p><p className="mt-1 text-xs capitalize text-slate-500">{assessment.question_count} questions · {assessment.attempts_used} of {assessment.max_attempts} attempts used</p></div><p className="text-xl font-bold text-portal-blue">{assessment.latest_score === null || assessment.latest_score === undefined ? "Not attempted" : `${assessment.latest_score}%`}</p></button>)}{!selectedLearningCourse.assessments.length ? <p className="rounded-md bg-slate-50 p-5 text-sm text-slate-500">No assessment has been created and pushed for this course.</p> : null}</div></div>
            </div>
          </div>
        </div>
      ) : null}
      {selectedLearningAssessment ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-label="Assessment details" onMouseDown={(event) => { if (event.currentTarget === event.target) setSelectedLearningAssessment(null); }}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-portal-line bg-white p-5"><div><p className="text-xs font-bold uppercase tracking-wide text-portal-blue">Pushed assessment · {student.name}</p><h2 className="mt-1 text-xl font-bold text-slate-950">{selectedLearningAssessment.assessment_title}</h2></div><button type="button" onClick={() => setSelectedLearningAssessment(null)} className="grid h-10 w-10 place-items-center rounded-full border border-portal-line text-slate-600" aria-label="Close assessment details"><X size={20} /></button></div>
            <div className="grid gap-4 p-5 sm:grid-cols-2"><LearningSummary label="Questions" value={String(selectedLearningAssessment.question_count)} /><LearningSummary label="Duration Limit" value={`${selectedLearningAssessment.duration_minutes} minutes`} /><LearningSummary label="Attempts Used" value={`${selectedLearningAssessment.attempts_used} of ${selectedLearningAssessment.max_attempts}`} /><LearningSummary label="Latest Score" value={selectedLearningAssessment.latest_score === null || selectedLearningAssessment.latest_score === undefined ? "Not attempted" : `${selectedLearningAssessment.latest_score}%`} /></div>
            <div className="px-5 pb-5"><h3 className="mb-3 font-bold text-slate-950">Student Attempts</h3><div className="space-y-3">{selectedLearningAssessment.attempts.map((attempt) => <div key={attempt.attempt_id} className="rounded-md border border-portal-line p-4"><div className="flex items-center justify-between gap-3"><div><p className="font-bold text-slate-900">Attempt {attempt.attempt_number}</p><p className="mt-1 text-xs capitalize text-slate-500">{attempt.status.replaceAll("_", " ")} · {new Date(attempt.submitted_at ?? attempt.started_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })} IST</p></div><p className="text-xl font-bold text-portal-blue">{attempt.score}%</p></div><p className="mt-2 text-xs text-slate-500">Security violations: {attempt.violations}</p></div>)}{!selectedLearningAssessment.attempts.length ? <p className="rounded-md bg-slate-50 p-5 text-sm text-slate-500">This is a real published assessment, but this student has not attempted it yet.</p> : null}</div></div>
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}

function StudentAccessToggle({ label, enabled, onClick }: { label: string; enabled: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex w-full items-center justify-between rounded-lg border border-portal-line p-3 text-left"><span><b className="block">{label}</b><span className="text-xs text-slate-500">{enabled ? "Student can access" : "Student is blocked"}</span></span><span className={`relative h-7 w-12 rounded-full ${enabled ? "bg-emerald-500" : "bg-slate-300"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${enabled ? "left-6" : "left-1"}`} /></span></button>;
}

function LearningSummary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 break-words text-lg font-bold capitalize text-slate-950">{value}</p></div>;
}

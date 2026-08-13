"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { assignCourseToStudent, createStudentAccountInDb, deleteStudentFromDb, listStudentsFromDb, resetStudentPasswordInDb, sendStudentCredentialsFromDb, type DbStudent } from "@/lib/admin-api";
import { useAdminBatch } from "@/lib/admin-batch-context";

export type StudentStatus = "Pending Approval" | "New User" | "In Progress" | "Advanced" | "Suspended" | "Rejected";

export type StudentRecord = {
  id: string;
  name: string;
  email: string;
  regNo: string;
  status: StudentStatus | string;
  progress: number;
  module: string;
  lastLogin: string;
  joined: string;
  phone?: string;
  degree?: string;
  branch?: string;
  batch?: string;
  cyberlancersId?: string;
  tag?: string;
  portfolioUrl?: string;
  photoDataUrl?: string;
  educationSummary?: Array<{ level: string; year_from: string; year_to: string; score: string }>;
  educationDetails?: Array<{ level?: string; institution?: string; programme?: string; customProgramme?: string; yearFrom?: string; yearTo?: string; score?: string; markscardFileName?: string; markscardDataUrl?: string }>;
  resumeUrl?: string; resumeDataUrl?: string; resumeFileName?: string; gender?: string; dateOfBirth?: string; personalEmail?: string; college?: string; mentorName?: string; updatedAt?: string;
  notes?: string[];
};

export type RegistrationRecord = {
  id: string;
  studentId: string;
  name: string;
  regNo: string;
  email: string;
  phone: string;
  degree: string;
  branch: string;
  batch: string;
  criteria: string[];
  status: string;
  paymentStatus?: string;
  accountStatus?: string;
  profileStatus?: string;
  username?: string;
  tempPassword?: string;
  portalLink?: string;
  credentialEmail?: string;
  senderEmail?: string;
  companyEmail?: string;
  dbStudentId?: number;
};

type AdminStore = {
  students: StudentRecord[];
  registrations: RegistrationRecord[];
  activityLog: string[];
  stats: {
    totalStudents: number;
    activeThisWeek: number;
    pendingApprovals: number;
    advancedStudents: number;
    newUsers: number;
  };
  approveRegistration: (registrationId: string) => void;
  rejectRegistration: (registrationId: string) => void;
  verifyPayment: (registrationId: string) => void;
  addRegistrationIntake: (records: Array<{ name: string; regNo: string; email: string; phone?: string; degree?: string; branch?: string; batch?: string }>) => string[];
  createStudentAccountFromIntake: (
    record: { name: string; regNo: string; email: string; phone?: string; degree?: string; branch?: string; batch?: string },
    account: { name?: string; username: string; tempPassword: string; portalLink: string; credentialEmail?: string; senderEmail?: string; companyEmail?: string }
  ) => Promise<string>;
  createStudentAccount: (registrationId: string, account?: { name?: string; username: string; tempPassword: string; portalLink: string; credentialEmail?: string; deliveryEmail?: string; senderEmail?: string; companyEmail?: string }) => Promise<void>;
  sendPortalCredentials: (
    registrationId: string,
    account?: { name?: string; username?: string; tempPassword?: string; portalLink?: string; credentialEmail?: string; deliveryEmail?: string; senderEmail?: string; companyEmail?: string }
  ) => Promise<{ sent: boolean; mode: string; message: string } | null>;
  markProfileCompleted: (registrationId: string) => void;
  sendMessage: (studentId: string, message?: string) => void;
  scheduleDailyReminder: (studentId: string, reminder?: string) => void;
  sendRegistrationOtp: (registrationId: string) => void;
  assignCourse: (studentId: string, courseId: number) => Promise<string>;
  resetPassword: (studentId: string) => Promise<string>;
  suspendStudent: (studentId: string) => void;
  deleteStudent: (studentId: string) => Promise<void>;
};

const storageKey = "student-portal-admin-state-v1";
const batchConsolidationStorageKey = "student-portal-batch-2026-a-v1";
const AdminContext = createContext<AdminStore | null>(null);
const defaultSenderEmail = process.env.NEXT_PUBLIC_DEFAULT_SENDER_EMAIL ?? "";
const defaultStudentPortalLink = process.env.NEXT_PUBLIC_STUDENT_PORTAL_LINK ?? "http://localhost:3000";

const initialStudents: StudentRecord[] = [];
const initialRegistrations: RegistrationRecord[] = [];

function dbStatusToUi(status: string, profileStatus?: string | null): StudentStatus {
  if (status === "suspended") return "Suspended";
  if (["Completed", "Approval Pending by Admin", "Profile Completed - Approval Pending"].includes(profileStatus ?? "")) return "Pending Approval";
  if (profileStatus === "Waiting for Student") return "New User";
  if (profileStatus === "Approved") return "In Progress";
  if (status === "advanced") return "Advanced";
  if (status === "in_progress") return "In Progress";
  return "New User";
}

export function studentFromDb(student: DbStudent): StudentRecord {
  return {
    id: `DB-STU-${student.id}`,
    name: student.name,
    email: student.email,
    regNo: student.register_number,
    cyberlancersId: student.cyberlancers_id ?? undefined,
    tag: student.tag ?? undefined,
    status: dbStatusToUi(student.status, student.profile_status),
    progress: student.progress_percent,
    module: student.current_module ?? "Profile Pending",
    lastLogin: student.last_login ? new Date(student.last_login).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) + " IST" : "Never",
    joined: "From database",
    phone: student.phone ?? undefined,
    degree: student.degree ?? undefined,
    branch: student.branch ?? undefined,
    batch: student.batch ?? undefined,
    portfolioUrl: student.portfolio_url ?? undefined,
    photoDataUrl: student.photo_data_url ?? undefined,
    educationSummary: student.education_summary ?? [],
    educationDetails: student.education_details ?? [], resumeUrl: student.resume_url ?? undefined, resumeDataUrl: student.resume_data_url ?? undefined, resumeFileName: student.resume_file_name ?? undefined, gender: student.gender ?? undefined, dateOfBirth: student.date_of_birth ?? undefined, personalEmail: student.personal_email ?? undefined, college: student.college ?? undefined, mentorName: student.mentor_name ?? undefined, updatedAt: student.updated_at ?? undefined,
    notes: ["Loaded from MySQL database."]
  };
}

function registrationFromDb(student: DbStudent): RegistrationRecord {
  return {
    id: `DB-REG-${student.id}`,
    studentId: `DB-STU-${student.id}`,
    name: student.name,
    regNo: student.register_number,
    email: student.email,
    phone: student.phone ?? "",
    degree: student.degree ?? "",
    branch: student.branch ?? "",
    batch: student.batch ?? "",
    criteria: ["Loaded from database"],
    status: student.account_status ?? "Account Created",
    paymentStatus: student.payment_status ?? "Pending Verification",
    accountStatus: student.account_status ?? "Account Created",
    profileStatus: student.profile_status ?? "Waiting for Student",
    username: student.username ?? undefined,
    portalLink: student.portal_link ?? undefined,
    credentialEmail: student.credential_email ?? student.email,
    senderEmail: student.sender_email ?? undefined,
    companyEmail: student.company_email ?? undefined,
    dbStudentId: student.id
  };
}

export function AdminStoreProvider({ children }: { children: React.ReactNode }) {
  const { selectedBatch } = useAdminBatch();
  const [students, setStudents] = useState<StudentRecord[]>(initialStudents);
  const [registrations, setRegistrations] = useState<RegistrationRecord[]>(initialRegistrations);
  const [activityLog, setActivityLog] = useState<string[]>([]);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as {
        students?: StudentRecord[];
        registrations?: RegistrationRecord[];
        activityLog?: string[];
      };
      const needsBatchConsolidation = window.localStorage.getItem(batchConsolidationStorageKey) !== "done";
      if (parsed.students) setStudents(parsed.students
        .filter((student) => typeof student?.name === "string")
        .map((student) => needsBatchConsolidation ? { ...student, batch: "2026 A" } : student));
      if (parsed.registrations) setRegistrations(parsed.registrations
        .filter((registration) => typeof registration?.name === "string")
        .map((registration) => needsBatchConsolidation ? { ...registration, batch: "2026 A" } : registration));
      if (parsed.activityLog) setActivityLog(parsed.activityLog);
      if (needsBatchConsolidation) window.localStorage.setItem(batchConsolidationStorageKey, "done");
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, []);

  useEffect(() => {
    let active = true;
    let initialSync = true;

    async function syncStudents() {
      try {
        const dbStudents = await listStudentsFromDb();
        if (!active) return;
        setStudents(dbStudents.map(studentFromDb));
        setRegistrations(dbStudents.filter((student) => student.profile_status !== "Approved").map(registrationFromDb));
        if (initialSync) {
          setActivityLog((current) => {
            const message = `${dbStudents.length} student record${dbStudents.length === 1 ? "" : "s"} synced from MySQL.`;
            return current[0] === message ? current : [message, ...current].slice(0, 8);
          });
        }
      } catch {
        if (initialSync && active) {
          setActivityLog((current) => {
            const message = "MySQL sync skipped. Start backend and check DATABASE_URL when deploying.";
            return current[0] === message ? current : [message, ...current].slice(0, 8);
          });
        }
      } finally {
        initialSync = false;
      }
    }

    function syncWhenVisible() {
      if (document.visibilityState === "visible") void syncStudents();
    }

    void syncStudents();
    const refreshTimer = window.setInterval(() => void syncStudents(), 10_000);
    window.addEventListener("focus", syncWhenVisible);
    document.addEventListener("visibilitychange", syncWhenVisible);

    return () => {
      active = false;
      window.clearInterval(refreshTimer);
      window.removeEventListener("focus", syncWhenVisible);
      document.removeEventListener("visibilitychange", syncWhenVisible);
    };
  }, []);

  useEffect(() => {
    const browserSafeStudents = students.map(({ photoDataUrl: _photo, resumeDataUrl: _resume, educationDetails: _education, ...student }) => student);
    try { window.localStorage.setItem(storageKey, JSON.stringify({ students: browserSafeStudents, registrations, activityLog })); } catch { try { window.localStorage.removeItem(storageKey); } catch { /* MySQL remains authoritative */ } }
  }, [students, registrations, activityLog]);

  function addLog(message: string) {
    setActivityLog((current) => [message, ...current].slice(0, 8));
  }

  function approveRegistration(registrationId: string) {
    const registration = registrations.find((item) => item.id === registrationId);
    if (!registration) return;

    setStudents((current) => {
      const existing = current.find((student) => student.id === registration.studentId);
      if (existing) {
        return current.map((student) =>
          student.id === registration.studentId
            ? {
                ...student,
                status: "New User",
                phone: registration.phone,
                degree: registration.degree,
                branch: registration.branch,
                batch: registration.batch,
                progress: student.progress || 0,
                module: student.module === "Not Started" ? "Profile Approved - Course Pending" : student.module,
                notes: [
                  ...(student.notes ?? []),
                  "Registration approved by admin.",
                  "Automated welcome email sent with portal login instructions."
                ]
              }
            : student
        );
      }

      return [
        {
          id: registration.studentId,
          name: registration.name,
          email: registration.email,
          regNo: registration.regNo,
          status: "New User",
          progress: 0,
          module: "Not Started",
          lastLogin: "-",
          joined: "13 Jul 2026",
          phone: registration.phone,
          degree: registration.degree,
          branch: registration.branch,
          batch: registration.batch,
          notes: ["Registration approved by admin.", "Automated welcome email sent with portal login instructions."]
        },
        ...current
      ];
    });
    setRegistrations((current) => current.filter((item) => item.id !== registrationId));
    addLog(`${registration.name} registration approved and welcome email sent.`);
  }

  function patchRegistration(registrationId: string, patch: Partial<RegistrationRecord>) {
    setRegistrations((current) =>
      current.map((registration) => registration.id === registrationId ? { ...registration, ...patch } : registration)
    );
  }

  function verifyPayment(registrationId: string) {
    const registration = registrations.find((item) => item.id === registrationId);
    if (!registration) return;
    patchRegistration(registrationId, {
      paymentStatus: "Verified",
      status: "Payment Verified - Create Account"
    });
    addLog(`${registration.name} payment verified by super admin.`);
  }

  function addRegistrationIntake(records: Array<{ name: string; regNo: string; email: string; phone?: string; degree?: string; branch?: string; batch?: string }>) {
    const cleanRecords = records
      .map((record) => ({
        name: record.name.trim(),
        regNo: record.regNo.trim(),
        email: record.email.trim(),
        phone: record.phone?.trim() ?? "",
        degree: record.degree?.trim() ?? "",
        branch: record.branch?.trim() ?? "",
        batch: record.batch?.trim() ?? ""
      }))
      .filter((record) => record.name && record.regNo && record.email);

    if (!cleanRecords.length) return [];

    const existingRegNos = new Set([
      ...registrations.map((registration) => registration.regNo.toLowerCase()),
      ...students.map((student) => student.regNo.toLowerCase())
    ]);
    const timestamp = Date.now();
    const nextRegistrations = cleanRecords
      .filter((record) => !existingRegNos.has(record.regNo.toLowerCase()))
      .map((record, index): RegistrationRecord => ({
        id: `REG-${timestamp}-${index}`,
        studentId: `STU-${timestamp}-${index}`,
        name: record.name,
        regNo: record.regNo,
        email: record.email,
        phone: record.phone,
        degree: record.degree,
        branch: record.branch,
        batch: record.batch,
        criteria: ["Form received", "Payment details to verify"],
        status: "Ready for Account Creation",
        paymentStatus: "Pending Verification",
        accountStatus: "Not Created",
        profileStatus: "Waiting for Student"
      }));

    if (!nextRegistrations.length) return [];
    setRegistrations((current) => [...nextRegistrations, ...current]);
    addLog(`${nextRegistrations.length} student intake record${nextRegistrations.length === 1 ? "" : "s"} added for account creation.`);
    return nextRegistrations.map((registration) => registration.id);
  }

  async function createStudentAccount(registrationId: string, account?: { name?: string; username: string; tempPassword: string; portalLink: string; credentialEmail?: string; deliveryEmail?: string; senderEmail?: string; companyEmail?: string }) {
    const registration = registrations.find((item) => item.id === registrationId);
    if (!registration) return;
    const name = account?.name?.trim() || registration.name;
    const username = account?.username.trim() || registration.username || registration.regNo;
    const tempPassword = account?.tempPassword.trim() || registration.tempPassword || `${registration.name.split(" ")[0]}@${registration.regNo.slice(-4)}`;
    const portalLink = account?.portalLink.trim() || registration.portalLink || defaultStudentPortalLink;
    const credentialEmail = account?.credentialEmail?.trim() || registration.credentialEmail || "";
    const deliveryEmail = account?.deliveryEmail?.trim() || registration.email;
    const senderEmail = account?.senderEmail?.trim() || registration.senderEmail || defaultSenderEmail;
    const companyEmail = account?.companyEmail?.trim() || registration.companyEmail || `student.${registration.regNo.toLowerCase()}@client-company.com`;
    patchRegistration(registrationId, {
      name,
      username,
      tempPassword,
      accountStatus: "Creating and Sending",
      portalLink,
      credentialEmail,
      senderEmail,
      companyEmail,
      status: "Creating Account"
    });

    setStudents((current) => {
      const existing = current.find((student) => student.id === registration.studentId);
      if (existing) {
        return current.map((student) =>
          student.id === registration.studentId
            ? {
                ...student,
                status: "Pending Approval",
                name,
                email: credentialEmail,
                regNo: registration.regNo,
                phone: registration.phone,
                degree: registration.degree,
                branch: registration.branch,
                batch: registration.batch,
                notes: [...(student.notes ?? []), `Student account created. Username: ${username}.`]
              }
            : student
        );
      }

      return [
        {
          id: registration.studentId,
          name,
          email: credentialEmail,
          regNo: registration.regNo,
          status: "Pending Approval",
          progress: 0,
          module: "Profile Pending",
          lastLogin: "-",
          joined: "16 Jul 2026",
          phone: registration.phone,
          degree: registration.degree,
          branch: registration.branch,
          batch: registration.batch,
          notes: [`Student account created. Username: ${username}.`]
        },
        ...current
      ];
    });
    addLog(`${name} account created by super admin for ${credentialEmail}.`);
    await createStudentAccountInDb({
      name,
      register_number: registration.regNo,
      email: deliveryEmail,
      phone: registration.phone || undefined,
      degree: registration.degree || undefined,
      branch: registration.branch || undefined,
      batch: registration.batch?.trim() || "2026 A",
      username,
      temp_password: tempPassword,
      portal_link: portalLink,
      credential_email: credentialEmail,
      sender_email: senderEmail,
      company_email: companyEmail
    })
      .then((created) => {
        setRegistrations((current) =>
          current.map((item) => item.id === registrationId ? {
            ...item,
            email: credentialEmail,
            dbStudentId: created.id,
            accountStatus: "Credentials Sent",
            status: "Credentials Sent - Awaiting Profile"
          } : item)
        );
        addLog(`${name} stored in MySQL; ${credentialEmail} credentials emailed to ${registration.email}.`);
      })
      .catch((error: Error) => {
        addLog(`Database save failed for ${name}: ${error.message}`);
        throw error;
      });
  }

  async function createStudentAccountFromIntake(
    record: { name: string; regNo: string; email: string; phone?: string; degree?: string; branch?: string; batch?: string },
    account: { name?: string; username: string; tempPassword: string; portalLink: string; credentialEmail?: string; senderEmail?: string; companyEmail?: string }
  ) {
    const cleanRecord = {
      name: record.name.trim(),
      regNo: record.regNo.trim(),
      email: record.email.trim(),
      phone: record.phone?.trim() ?? "",
      degree: record.degree?.trim() ?? "",
      branch: record.branch?.trim() ?? "",
      batch: record.batch?.trim() ?? ""
    };
    if (!cleanRecord.name || !cleanRecord.regNo || !cleanRecord.email || !cleanRecord.batch) return "";
    if (!/^\d{4}\s+[A-Za-z0-9][A-Za-z0-9 _-]*$/.test(cleanRecord.batch)) {
      throw new Error("Batch must start with a four-digit year followed by a label, for example 2026 A.");
    }

    const duplicate = [...registrations, ...students].some((item) => item.regNo.toLowerCase() === cleanRecord.regNo.toLowerCase());
    if (duplicate) return "";

    const timestamp = Date.now();
    const registrationId = `REG-${timestamp}`;
    const studentId = `STU-${timestamp}`;
    const name = account.name?.trim() || cleanRecord.name;
    const username = account.username.trim();
    const tempPassword = account.tempPassword.trim();
    const portalLink = account.portalLink.trim();
    const credentialEmail = account.credentialEmail?.trim() || "";
    const senderEmail = account.senderEmail?.trim() || "";
    const companyEmail = account.companyEmail?.trim() || "";

    const registration: RegistrationRecord = {
      id: registrationId,
      studentId,
      name,
      regNo: cleanRecord.regNo,
      email: cleanRecord.email,
      phone: cleanRecord.phone,
      degree: cleanRecord.degree,
      branch: cleanRecord.branch,
      batch: cleanRecord.batch,
      criteria: ["Form received", "Payment details to verify"],
      status: "Creating Account",
      paymentStatus: "Pending Verification",
      accountStatus: "Creating and Sending",
      profileStatus: "Waiting for Student",
      username,
      tempPassword,
      portalLink,
      credentialEmail,
      senderEmail,
      companyEmail
    };

    setRegistrations((current) => [registration, ...current]);
    setStudents((current) => [
      {
        id: studentId,
        name,
        email: cleanRecord.email,
        regNo: cleanRecord.regNo,
        status: "Pending Approval",
        progress: 0,
        module: "Profile Pending",
        lastLogin: "-",
        joined: "16 Jul 2026",
        phone: cleanRecord.phone,
        degree: cleanRecord.degree,
        branch: cleanRecord.branch,
        batch: cleanRecord.batch,
        notes: [`Student account created. Username: ${username}.`]
      },
      ...current
    ]);
    addLog(`${name} account created by super admin for ${credentialEmail}.`);
    try {
      const created = await createStudentAccountInDb({
        name,
        register_number: cleanRecord.regNo,
        email: cleanRecord.email,
        phone: cleanRecord.phone || undefined,
        degree: cleanRecord.degree || undefined,
        branch: cleanRecord.branch || undefined,
        batch: cleanRecord.batch,
        username,
        temp_password: tempPassword,
        portal_link: portalLink,
        credential_email: credentialEmail,
        sender_email: senderEmail,
        company_email: companyEmail
      });
      setRegistrations((current) =>
        current.map((item) => item.id === registrationId ? {
          ...item,
          email: credentialEmail,
          dbStudentId: created.id,
          accountStatus: "Credentials Sent",
          status: "Credentials Sent - Awaiting Profile"
        } : item)
      );
      const refreshedStudents = await listStudentsFromDb();
      setStudents(refreshedStudents.map(studentFromDb));
      setRegistrations(refreshedStudents.filter((student) => student.profile_status !== 'Approved').map(registrationFromDb));
      addLog(`${name} stored in MySQL; ${credentialEmail} credentials emailed to ${cleanRecord.email}.`);
      return registrationId;
    } catch (error) {
      setRegistrations((current) => current.filter((item) => item.id !== registrationId));
      setStudents((current) => current.filter((item) => item.id !== studentId));
      const message = error instanceof Error ? error.message : "Database save failed";
      addLog(`Database save failed for ${name}: ${message}`);
      throw error;
    }
  }

  function sendPortalCredentials(
    registrationId: string,
    account?: { name?: string; username?: string; tempPassword?: string; portalLink?: string; credentialEmail?: string; deliveryEmail?: string; senderEmail?: string; companyEmail?: string }
  ): Promise<{ sent: boolean; mode: string; message: string } | null> {
    const registration = registrations.find((item) => item.id === registrationId);
    if (!registration) return Promise.resolve(null);
    const name = account?.name?.trim() || registration.name;
    const username = account?.username?.trim() || registration.username || registration.regNo;
    const tempPassword = account?.tempPassword?.trim() || registration.tempPassword || `${registration.name.split(" ")[0]}@${registration.regNo.slice(-4)}`;
    const portalLink = account?.portalLink?.trim() || registration.portalLink || defaultStudentPortalLink;
    const fromAddress = account?.senderEmail?.trim() || registration.senderEmail || defaultSenderEmail;
    const loginAddress = account?.credentialEmail?.trim() || registration.credentialEmail || "";
    const toAddress = account?.deliveryEmail?.trim() || registration.email;
    const companyEmail = account?.companyEmail?.trim() || registration.companyEmail || `student.${registration.regNo.toLowerCase()}@client-company.com`;
    patchRegistration(registrationId, {
      name,
      username,
      tempPassword,
      portalLink,
      senderEmail: fromAddress,
      credentialEmail: loginAddress,
      companyEmail,
      accountStatus: "Credentials Sent",
      status: "Credentials Sent - Awaiting Profile"
    });
    const dbStudentId = registration.dbStudentId;
    const ensureDbStudent = dbStudentId
      ? Promise.resolve({ id: dbStudentId })
      : createStudentAccountInDb({
          name,
          register_number: registration.regNo,
          email: toAddress,
          phone: registration.phone || undefined,
          degree: registration.degree || undefined,
          branch: registration.branch || undefined,
          batch: registration.batch?.trim() || "2026 A",
          username,
          temp_password: tempPassword,
          portal_link: portalLink,
          credential_email: loginAddress,
          sender_email: fromAddress || undefined,
          company_email: companyEmail || undefined,
          send_credentials: false
        });

    return ensureDbStudent
      .then((created) => {
        if (!created?.id) {
          throw new Error("Student creation did not return a valid ID.");
        }
        setRegistrations((current) =>
          current.map((item) => item.id === registrationId ? { ...item, dbStudentId: created.id } : item)
        );
        return sendStudentCredentialsFromDb(
          created.id,
          toAddress,
          loginAddress,
          name,
          portalLink,
          companyEmail,
          fromAddress,
          tempPassword
        );
      })
      .then((result) => {
        setStudents((current) =>
          current.map((student) =>
            student.id === registration.studentId
              ? {
                  ...student,
                  notes: [
                    ...(student.notes ?? []),
                    `Credential email sent. From: ${fromAddress}. To: ${toAddress}. Company email: ${companyEmail}. Link: ${portalLink}, username: ${username}.`
                  ]
                }
              : student
          )
        );
        addLog(`${name} credential email ${result.mode === "smtp" ? `sent to ${toAddress}` : "previewed"} from backend.`);
        addLog(`${registration.name} portal credentials sent from ${fromAddress}.`);
        return result;
      })
      .catch((error: Error) => {
        addLog(`Credential email failed for ${name}: ${error.message}`);
        throw error;
      });
  }

  function markProfileCompleted(registrationId: string) {
    const registration = registrations.find((item) => item.id === registrationId);
    if (!registration) return;
    patchRegistration(registrationId, {
      profileStatus: "Completed",
      status: "Ready for Admin Approval",
      criteria: Array.from(new Set([...registration.criteria, "Profile details completed"]))
    });
    setStudents((current) =>
      current.map((student) =>
        student.id === registration.studentId
          ? { ...student, module: "Profile Completed - Approval Pending", notes: [...(student.notes ?? []), "Student completed profile after first login."] }
          : student
      )
    );
    addLog(`${registration.name} profile completed and moved to approval.`);
  }

  function rejectRegistration(registrationId: string) {
    const registration = registrations.find((item) => item.id === registrationId);
    if (!registration) return;
    setRegistrations((current) => current.filter((item) => item.id !== registrationId));
    setStudents((current) =>
      current.map((student) =>
        student.id === registration.studentId
          ? { ...student, status: "Rejected", notes: [...(student.notes ?? []), "Registration rejected by admin."] }
          : student
      )
    );
    addLog(`${registration.name} registration rejected.`);
  }

  function sendMessage(studentId: string, message = "Manual message sent by admin.") {
    const student = students.find((item) => item.id === studentId);
    if (!student) return;
    const cleanMessage = message.trim() || "Manual message sent by admin.";
    setStudents((current) =>
      current.map((item) =>
        item.id === studentId ? { ...item, notes: [...(item.notes ?? []), cleanMessage] } : item
      )
    );
    addLog(`Message sent to ${student.name}.`);
  }

  function scheduleDailyReminder(studentId: string, reminder = "Daily learning reminder scheduled at 9:00 AM.") {
    const student = students.find((item) => item.id === studentId);
    if (!student) return;
    const cleanReminder = reminder.trim() || "Daily learning reminder scheduled at 9:00 AM.";
    setStudents((current) =>
      current.map((item) =>
        item.id === studentId ? { ...item, notes: [...(item.notes ?? []), cleanReminder] } : item
      )
    );
    addLog(`Daily reminder scheduled for ${student.name}.`);
  }

  function sendRegistrationOtp(registrationId: string) {
    const registration = registrations.find((item) => item.id === registrationId);
    if (!registration) return;
    const otp = "482916";
    setStudents((current) =>
      current.map((student) =>
        student.id === registration.studentId
          ? {
              ...student,
              notes: [
                ...(student.notes ?? []),
                `Registration OTP ${otp} sent to ${registration.email} for email verification.`
              ]
            }
          : student
      )
    );
    addLog(`Registration OTP sent to ${registration.name}.`);
  }

  async function assignCourse(studentId: string, courseId: number) {
    const student = students.find((item) => item.id === studentId);
    if (!student) throw new Error("Student was not found.");
    const databaseId = Number(student.id.replace("DB-STU-", ""));
    if (!Number.isFinite(databaseId)) throw new Error("Student is not linked to the shared database.");
    const result = await assignCourseToStudent(databaseId, courseId);
    setStudents((current) =>
      current.map((item) =>
        item.id === studentId
          ? { ...item, status: item.status === "New User" ? "In Progress" : item.status, module: result.course_title, notes: [...(item.notes ?? []), `${result.course_title} assigned.`] }
          : item
      )
    );
    addLog(`${result.course_title} assigned to ${student.name}.`);
    return result.course_title;
  }

  async function resetPassword(studentId: string) {
    const student = students.find((item) => item.id === studentId);
    if (!student) throw new Error("Student was not found.");
    const databaseId = Number(student.id.replace("DB-STU-", ""));
    if (!Number.isFinite(databaseId)) throw new Error("Student is not linked to the shared database.");
    const result = await resetStudentPasswordInDb(databaseId);
    setStudents((current) =>
      current.map((item) =>
        item.id === studentId ? { ...item, notes: [...(item.notes ?? []), `Temporary password securely emailed to ${result.recipient}.`] } : item
      )
    );
    addLog(`Temporary password reset completed for ${student.name}.`);
    return result.message;
  }

  function suspendStudent(studentId: string) {
    const student = students.find((item) => item.id === studentId);
    if (!student) return;
    setStudents((current) =>
      current.map((item) =>
        item.id === studentId ? { ...item, status: "Suspended", notes: [...(item.notes ?? []), "Account suspended by admin."] } : item
      )
    );
    addLog(`${student.name} account suspended.`);
  }

  async function deleteStudent(studentId: string) {
    const student = students.find((item) => item.id === studentId);
    if (!student) throw new Error("Student was not found.");
    const databaseId = Number(student.id.replace("DB-STU-", ""));
    if (!Number.isFinite(databaseId)) throw new Error("This student is not linked to the shared database.");

    await deleteStudentFromDb(databaseId, student.email);
    setStudents((current) => current.filter((item) => item.id !== studentId));
    setRegistrations((current) => current.filter((item) => item.studentId !== studentId && item.dbStudentId !== databaseId));
    addLog(`${student.name} account and associated data permanently deleted.`);
  }

  const batchStudents = useMemo(() => students.filter((student) => student.batch?.trim() === selectedBatch), [selectedBatch, students]);
  const batchRegistrations = useMemo(() => registrations.filter((registration) => registration.batch?.trim() === selectedBatch), [registrations, selectedBatch]);

  const stats = useMemo(() => {
    const visibleStudents = batchStudents.filter((student) => student.status !== "Rejected");
    return {
      totalStudents: visibleStudents.length,
      activeThisWeek: visibleStudents.filter((student) => student.lastLogin !== "-").length,
      pendingApprovals: batchRegistrations.length,
      advancedStudents: visibleStudents.filter((student) => student.status === "Advanced").length,
      newUsers: visibleStudents.filter((student) => student.status === "New User").length
    };
  }, [batchRegistrations.length, batchStudents]);

  const value: AdminStore = {
    students: batchStudents,
    registrations: batchRegistrations,
    activityLog,
    stats,
    approveRegistration,
    rejectRegistration,
    verifyPayment,
    addRegistrationIntake,
    createStudentAccountFromIntake,
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
  };

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdminStore() {
  const context = useContext(AdminContext);
  if (!context) throw new Error("useAdminStore must be used within AdminStoreProvider");
  return context;
}

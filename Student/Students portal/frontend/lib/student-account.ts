import { STUDENT_EMAIL_DOMAIN, studentProfile } from "@/lib/portal-config";

export type StudentAccount = {
  fullName: string;
  firstName: string;
  email: string;
  cyberlancersId: string;
  photoDataUrl?: string;
  registrationNumber?: string;
  phone?: string;
  gender?: string;
  dateOfBirth?: string;
  tag?: string;
  batch?: string;
  department?: string;
  course?: string;
  college?: string;
  status?: string;
  resumeUrl?: string;
  resumeFileName?: string;
  resumeDataUrl?: string;
  mentorName?: string;
};

export const studentAccountStorageKey = "cyber-academy-student-account";
const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export const defaultStudentAccount: StudentAccount = {
  fullName: studentProfile.fullName,
  firstName: studentProfile.firstName,
  email: studentProfile.email,
  cyberlancersId: studentProfile.cyberlancersId
};

export function buildStudentAccount(email: string, fullName?: string, cyberlancersId?: string): StudentAccount {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = fullName ? normalizeName(fullName) : "";
  return {
    fullName: cleanName,
    firstName: cleanName.split(" ")[0] || "",
    email: cleanEmail,
    cyberlancersId: cyberlancersId?.trim() || ""
  };
}

export function isStudentEmail(email: string) {
  return email.trim().toLowerCase().endsWith(`@${STUDENT_EMAIL_DOMAIN}`);
}

export function readStudentAccount(): StudentAccount {
  if (typeof window === "undefined") {
    return defaultStudentAccount;
  }

  try {
    const stored = window.localStorage.getItem(studentAccountStorageKey);
    if (!stored) {
      return defaultStudentAccount;
    }
    const parsed = { ...defaultStudentAccount, ...(JSON.parse(stored) as Partial<StudentAccount>) };
    const hadOldDemoProfile =
      parsed.fullName === "Vikas Kumar" &&
      parsed.email === `vikas@${STUDENT_EMAIL_DOMAIN}` &&
      parsed.cyberlancersId === "CL-VIKAS-1042";

    if (hadOldDemoProfile) {
      const cleaned = { ...parsed, fullName: "", firstName: "", cyberlancersId: "" };
      window.localStorage.setItem(studentAccountStorageKey, JSON.stringify(cleaned));
      return cleaned;
    }

    return parsed;
  } catch {
    return defaultStudentAccount;
  }
}

export function saveStudentAccount(account: StudentAccount) {
  window.localStorage.setItem(studentAccountStorageKey, JSON.stringify(account));
}

export async function fetchStudentProfile(email: string): Promise<StudentAccount | null> {
  if (!email) return null;
  try {
    const url = new URL("/api/student-profile", apiBaseUrl);
    url.searchParams.set("email", email);
    const response = await fetch(url.toString());
    if (!response.ok) return null;
    return fromApiProfile(await response.json());
  } catch {
    return null;
  }
}

export async function persistStudentProfile(account: StudentAccount): Promise<StudentAccount> {
  saveStudentAccount(account);
  if (!account.email) return account;
  const response = await fetch(new URL("/api/student-profile", apiBaseUrl).toString(), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toApiProfile(account))
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Profile save failed (${response.status})`);
  }
  const saved = fromApiProfile(await response.json());
  saveStudentAccount(saved);
  return saved;
}

function toApiProfile(account: StudentAccount) {
  return {
    email: account.email,
    full_name: account.fullName,
    first_name: account.firstName,
    cyberlancers_id: account.cyberlancersId,
    registration_number: account.registrationNumber || "",
    phone: account.phone || "",
    gender: account.gender || "",
    date_of_birth: account.dateOfBirth || "",
    tag: account.tag || "",
    batch: account.batch || "",
    course: account.course || "",
    college: account.college || "",
    department: account.department || "",
    status: account.status || "",
    resume_url: account.resumeUrl || "",
    resume_file_name: account.resumeFileName || "",
    resume_data_url: account.resumeDataUrl || null,
    mentor_name: account.mentorName || "",
    photo_data_url: account.photoDataUrl || null
  };
}

function fromApiProfile(profile: Record<string, string | number | null>): StudentAccount {
  return {
    email: String(profile.email || ""),
    fullName: String(profile.full_name || ""),
    firstName: String(profile.first_name || ""),
    cyberlancersId: String(profile.cyberlancers_id || ""),
    registrationNumber: String(profile.registration_number || ""),
    phone: String(profile.phone || ""),
    gender: String(profile.gender || ""),
    dateOfBirth: String(profile.date_of_birth || ""),
    tag: String(profile.tag || ""),
    batch: String(profile.batch || ""),
    course: String(profile.course || ""),
    college: String(profile.college || ""),
    department: String(profile.department || ""),
    status: String(profile.status || ""),
    resumeUrl: String(profile.resume_url || ""),
    resumeFileName: String(profile.resume_file_name || ""),
    resumeDataUrl: profile.resume_data_url ? String(profile.resume_data_url) : undefined,
    mentorName: String(profile.mentor_name || ""),
    photoDataUrl: profile.photo_data_url ? String(profile.photo_data_url) : undefined
  };
}

function normalizeName(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ") || "Student";
}

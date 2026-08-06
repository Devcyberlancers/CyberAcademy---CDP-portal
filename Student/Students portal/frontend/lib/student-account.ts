import { STUDENT_EMAIL_DOMAIN, studentProfile } from "@/lib/portal-config";

export type StudentEducation = {
  level: "Class 10" | "PUC" | "Diploma" | "Degree" | "Masters" | "PhD";
  institution?: string;
  boardOrUniversity?: string;
  programme?: string;
  customProgramme?: string;
  yearFrom?: string;
  yearTo?: string;
  score?: string;
  markscardFileName?: string;
  markscardDataUrl?: string;
};

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
  portfolioUrl?: string;
  education?: StudentEducation[];
  mentorName?: string;
};

export const studentAccountStorageKey = "cyber-academy-student-account";
const authTokenStorageKey = "cyber-academy-auth-token";
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
  const token = typeof window === "undefined" ? null : window.localStorage.getItem(authTokenStorageKey);
  if (!token) throw new Error("Your login session is missing. Please log in again.");

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
    const url = new URL("/api/student-profile", apiBaseUrl);
      const response = await fetch(url.toString(), { cache: "no-store", headers: { Authorization: `Bearer ${token}` } });
      if (response.status === 401 || response.status === 403) {
        window.localStorage.removeItem(authTokenStorageKey);
        throw new Error("Your login session has expired. Please log in again.");
      }
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`Profile service is unavailable (${response.status}).`);
      const profile = fromApiProfile(await response.json());
      saveStudentAccount(profile);
      return profile;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Profile could not be loaded.");
      if (attempt < 3 && !lastError.message.includes("session")) {
        await new Promise((resolve) => window.setTimeout(resolve, attempt * 500));
        continue;
      }
      throw lastError;
    }
  }
  throw lastError ?? new Error("Profile could not be loaded.");
}

export async function persistStudentProfile(account: StudentAccount): Promise<StudentAccount> {
  saveStudentAccount(account);
  if (!account.email) return account;
  const token = typeof window === "undefined" ? null : window.localStorage.getItem(authTokenStorageKey);
  if (!token) throw new Error("Your session has expired. Please log in again before saving your profile.");
  const response = await fetch(new URL("/api/student-profile", apiBaseUrl).toString(), {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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
    portfolio_url: account.portfolioUrl || "",
    education_json: JSON.stringify(account.education || []),
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
    portfolioUrl: String(profile.portfolio_url || ""),
    education: parseEducation(profile.education_json),
    mentorName: String(profile.mentor_name || ""),
    photoDataUrl: profile.photo_data_url ? String(profile.photo_data_url) : undefined
  };
}

function parseEducation(value: string | number | null | undefined): StudentEducation[] {
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is StudentEducation => Boolean(item) && typeof item === "object") : [];
  } catch {
    return [];
  }
}

function normalizeName(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ") || "Student";
}

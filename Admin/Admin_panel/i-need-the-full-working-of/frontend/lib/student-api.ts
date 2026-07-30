const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const studentTokenKey = "student-portal-token";

type StudentProfilePayload = {
  name: string;
  email: string;
  phone: string;
  degree: string;
  branch: string;
  batch: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined" ? window.localStorage.getItem(studentTokenKey) : null;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {})
    }
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function loginStudent(username: string, password: string) {
  const result = await request<{ access_token: string; name: string; profile_status: string }>("/api/student/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password })
  });
  window.localStorage.setItem(studentTokenKey, result.access_token);
  return result;
}

export function getStudentProfile() {
  return request<{
    name: string;
    email: string;
    register_number: string;
    phone?: string | null;
    degree?: string | null;
    branch?: string | null;
    batch?: string | null;
    profile_status?: string | null;
  }>("/api/student/me");
}

export function submitStudentProfile(payload: StudentProfilePayload) {
  return request<{ profile_status?: string }>("/api/student/profile", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

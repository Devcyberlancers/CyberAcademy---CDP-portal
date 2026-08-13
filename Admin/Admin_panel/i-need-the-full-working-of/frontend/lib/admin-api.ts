import { studentPortalPath } from "@/lib/urls";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const tokenStorageKey = "student-portal-admin-token";
export const selectedAdminBatchStorageKey = "cyber-academy-admin-selected-batch-v1";

export type AdminNotificationDetail = {
  type: "success" | "error";
  message: string;
};

export type PortalAccessSettings = {
  courses_enabled: boolean;
  assessments_enabled: boolean;
  jobs_enabled: boolean;
};

function notify(detail: AdminNotificationDetail) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<AdminNotificationDetail>("admin-notification", { detail }));
  }
}

function payloadError(payload: unknown): string {
  if (typeof payload === "string") return payload;
  if (Array.isArray(payload)) {
    return payload.map(payloadError).filter(Boolean).join("; ");
  }
  if (!payload || typeof payload !== "object") return "";
  const record = payload as Record<string, unknown>;
  if (typeof record.msg === "string") {
    const location = Array.isArray(record.loc) ? record.loc.filter((part) => part !== "body").join(".") : "";
    return location ? `${location}: ${record.msg}` : record.msg;
  }
  for (const key of ["detail", "message", "error"]) {
    const message = payloadError(record[key]);
    if (message) return message;
  }
  return "";
}

async function responseError(response: Response): Promise<string> {
  try {
    const message = payloadError(await response.json());
    if (message) return message;
  } catch {
    // The server may return plain text or an empty response.
  }
  return `Request failed with ${response.status}`;
}

function handleInvalidToken(response: Response): boolean {
  if (response.status !== 401 || typeof window === "undefined") return false;
  window.localStorage.removeItem(tokenStorageKey);
  window.location.replace(studentPortalPath("/?error=session-expired"));
  return true;
}

function mutationMessage(path: string, method: string) {
  if (path.includes("/courses") && path.endsWith("/publish")) return "Course published to the Student Portal.";
  if (path.includes("/courses") && path.endsWith("/draft")) return "Course moved to draft and hidden from students.";
  if (path.includes("/courses") && method === "POST") return "Course created successfully.";
  if (path.includes("/courses") && method === "DELETE") return "Course deleted successfully.";
  if (path.includes("/assessments")) return "Assessment changes published successfully.";
  if (path.includes("/students")) return "Student information updated successfully.";
  if (path.includes("/jobs")) return "Job information updated successfully.";
  if (path.includes("/settings")) return "Settings updated successfully.";
  return "Changes saved successfully.";
}

export type StudentAccountPayload = {
  name: string;
  register_number: string;
  email: string;
  phone?: string;
  degree?: string;
  branch?: string;
  batch: string;
  username: string;
  temp_password: string;
  portal_link: string;
  credential_email: string;
  sender_email?: string;
  company_email?: string;
  send_credentials?: boolean;
};

export type DbStudent = {
  id: number;
  name: string;
  email: string;
  register_number: string;
  cyberlancers_id?: string | null;
  tag?: string | null;
  phone?: string | null;
  degree?: string | null;
  branch?: string | null;
  batch?: string | null;
  status: string;
  progress_percent: number;
  current_module?: string | null;
  payment_status?: string | null;
  account_status?: string | null;
  profile_status?: string | null;
  username?: string | null;
  portal_link?: string | null;
  credential_email?: string | null;
  sender_email?: string | null;
  company_email?: string | null;
  portfolio_url?: string | null;
  photo_data_url?: string | null;
  education_summary?: Array<{ level: string; year_from: string; year_to: string; score: string }>;
  education_details?: Array<{ level?: string; institution?: string; programme?: string; customProgramme?: string; yearFrom?: string; yearTo?: string; score?: string; markscardFileName?: string; markscardDataUrl?: string }>;
  resume_url?: string | null; resume_file_name?: string | null; resume_data_url?: string | null;
  gender?: string | null; date_of_birth?: string | null; personal_email?: string | null; college?: string | null; mentor_name?: string | null; updated_at?: string | null; last_login?: string | null;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined" ? window.localStorage.getItem(tokenStorageKey) : null;
  const method = (init?.method ?? "GET").toUpperCase();
  let requestPath = path;
  if (typeof window !== "undefined" && path.includes("/admin/") && !path.startsWith("/api/admin/batches")) {
    const selectedBatch = window.localStorage.getItem(selectedAdminBatchStorageKey)?.trim();
    if (selectedBatch) requestPath += `${requestPath.includes("?") ? "&" : "?"}batch=${encodeURIComponent(selectedBatch)}`;
  }
  const response = await fetch(`${API_BASE_URL}${requestPath}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {})
    }
  });
  if (!response.ok) {
    const message = await responseError(response);
    if (handleInvalidToken(response)) {
      throw new Error("Your session expired. Redirecting to the unified login.");
    }
    if ((init?.method ?? "GET").toUpperCase() !== "GET") {
      notify({ type: "error", message: message || "The change could not be saved." });
    }
    throw new Error(message || `Request failed with ${response.status}`);
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    notify({ type: "success", message: mutationMessage(path, method) });
  }
  return response.json() as Promise<T>;
}

export type AdminBatch = {
  name: string;
  student_count: number;
  created_at?: string | null;
  created_by?: string | null;
};

export type AdminBatchContext = { selected_batch: string; batches: AdminBatch[] };

export function getAdminBatchContext() {
  return request<AdminBatchContext>("/api/admin/batches");
}

export function createAdminBatch(name: string) {
  return request<AdminBatchContext>("/api/admin/batches", { method: "POST", body: JSON.stringify({ name }) });
}

export function selectAdminBatch(name: string) {
  return request<{ selected_batch: string }>("/api/admin/batches/selection", { method: "PUT", body: JSON.stringify({ name }) });
}

export type AdminAssessmentAttempt = {
  attemptId: number;
  studentId?: number | null;
  studentEmail: string;
  assignmentId: string;
  assignmentTitle: string;
  attemptNumber: number;
  status: string;
  startedAt: string;
  endedAt?: string | null;
  violations: number;
  score: number;
  answeredCount: number;
  browser: string;
  operatingSystem: string;
  ipAddress: string;
  riskLevel: "green" | "yellow" | "red";
};

export type AdminAssessmentAttemptDetail = AdminAssessmentAttempt & {
  questions: number;
  events: Array<{
    eventId: number;
    eventType: string;
    reason: string;
    details: Record<string, unknown>;
    createdAt: string;
  }>;
  answers: Array<{
    questionId: string;
    question: string;
    selectedAnswer?: string | null;
    correctAnswer?: string | null;
    isCorrect: boolean;
    answered: boolean;
  }>;
};

export function listStudentAssessmentAttempts(scope: "standalone" | "all" = "standalone") {
  const scopeQuery = scope === "standalone" ? "&scope=standalone" : "";
  return request<{ total: number; items: AdminAssessmentAttempt[] }>(`/api/assignments/admin/attempts?page_size=200${scopeQuery}`);
}

export function getStudentAssessmentAttempt(attemptId: number) {
  return request<AdminAssessmentAttemptDetail>(`/api/assignments/admin/attempts/${attemptId}`);
}

export type AdminJobApplicationActivity = {
  id: number;
  studentId: number;
  studentName: string;
  studentEmail: string;
  registrationNumber: string;
  jobId: number;
  jobTitle: string;
  company: string;
  status: string;
  changedAt: string;
};

export function listJobApplicationActivity() {
  return request<AdminJobApplicationActivity[]>("/api/admin/jobs/applications");
}

export type AdminJob = { id: number; company: string; role: string; location?: string | null; ctc?: string | null; status: string };

export function listAdminJobs() {
  return request<AdminJob[]>("/api/admin/jobs");
}

export function createAdminJob(payload: { company: string; role: string; location?: string; job_type?: string; ctc?: string; eligibility?: string; source_url?: string }) {
  return request<AdminJob>("/api/admin/jobs", { method: "POST", body: JSON.stringify(payload) });
}

export function decideJobApplication(applicationId: number, decision: "approve" | "reject", reviewNote = "") {
  return request<{ application_id: number; status: string }>(`/api/admin/jobs/applications/${applicationId}/${decision}`, {
    method: "POST",
    body: JSON.stringify({ review_note: reviewNote })
  });
}

export async function loginAdmin(email: string, password: string) {
  const result = await request<{ access_token: string; role: string; name: string }>("/api/admin/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  window.localStorage.setItem(tokenStorageKey, result.access_token);
  return result;
}

export async function registerAdmin(name: string, email: string, password: string) {
  const result = await request<{ access_token: string; role: string; name: string }>("/api/admin/auth/register", { method: "POST", body: JSON.stringify({ name, email, password }) });
  window.localStorage.setItem(tokenStorageKey, result.access_token);
  return result;
}

export function requestAdminPasswordReset(email: string) {
  return request<{ message: string }>("/api/admin/auth/password-reset/request", { method: "POST", body: JSON.stringify({ email }) });
}

export function confirmAdminPasswordReset(token: string, password: string) {
  return request<{ message: string }>("/api/admin/auth/password-reset/confirm", { method: "POST", body: JSON.stringify({ token, password }) });
}

export function clearAdminToken() {
  window.localStorage.removeItem(tokenStorageKey);
}

export function getAdminProfile() {
  return request<{ email: string; name: string; role: string }>("/api/admin/auth/me");
}

export function getAdminDashboard() {
  return request<{
    stats: { total_students: number; active_this_week: number; courses_published: number; pending_approvals: number; open_jobs: number; security_alerts: number };
    notifications: Array<{ type: string; count: number; message: string }>;
  }>("/api/admin/dashboard");
}

export function getAdminDashboardActivity() {
  return request<{ student_activity: number[]; application_counts: number[] }>("/api/admin/dashboard/activity");
}
export type CourseCreatePayload = {
  title: string;
  short_description: string;
  description?: string | null;
  category: string;
  instructor: string;
  level?: string;
  duration?: string | null;
  language?: string;
  banner_url?: string | null;
  visibility?: string;
  start_date?: string;
  end_date?: string;
  status?: string;
  metadata?: Record<string, unknown>;
  modules?: Array<{
    title: string;
    position: number;
    lessons?: Array<{
      title: string;
      video_url?: string | null;
      duration_minutes?: number;
      required_completion_percent?: number;
    }>;
  }>;
};

export function createCourseInDb(payload: CourseCreatePayload) {
  return request<{ id: number; title: string; category: string; instructor: string; level: string; status: string; visibility: string }>("/api/admin/courses", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export type DbCourse = {
  id: number;
  title: string;
  category: string;
  instructor: string;
  level: string;
  status: string;
  visibility: string;
  duration?: string;
  progress_percent?: number;
  assessments?: number;
};

export type StudentLearningAttempt = {
  attempt_id: number | string;
  assessment_id: string;
  assessment_title: string;
  attempt_number: number;
  max_attempts: number;
  duration_minutes: number;
  status: string;
  score: number;
  violations: number;
  started_at: string;
  submitted_at?: string | null;
  earned_marks?: number;
  total_marks?: number;
  ip_address?: string;
  browser?: string;
  operating_system?: string;
  proctoring_events?: Array<{
    event_type: string;
    reason?: string;
    timestamp?: string;
    severity?: string;
    details?: Record<string, unknown>;
  }>;
};

export type StudentLearningAssessment = {
  assessment_id: string;
  assessment_title: string;
  max_attempts: number;
  duration_minutes: number;
  question_count: number;
  attempts_used: number;
  latest_score?: number | null;
  latest_status: string;
  attempts: StudentLearningAttempt[];
};

export type StudentLearningRecord = {
  student_id: number;
  academic_student_id?: number | null;
  student_email: string;
  courses: Array<{
    id: number;
    title: string;
    category: string;
    level: string;
    status: string;
    duration: string;
    instructor: string;
    progress_percent: number;
    assigned: boolean;
    assigned_at?: string | null;
    assessment_count: number;
    attempt_count: number;
    average_score?: number | null;
    assessments: StudentLearningAssessment[];
  }>;
  standalone_assessments: StudentLearningAssessment[];
};

export function listCoursesFromDb() {
  return request<DbCourse[]>("/api/admin/courses");
}

export type CourseStudentProgress = {
  student_id: number;
  student_name: string;
  student_email: string;
  register_number: string;
  assigned: boolean;
  progress_percent: number;
  assessments_completed: number;
  total_assessments: number;
  attempts: number;
  violations: number;
  average_score?: number | null;
  latest_score?: number | null;
  latest_activity?: string | null;
};

export function getCourseStudentProgress(courseId: number | string) {
  return request<{ course: DbCourse; total: number; students: CourseStudentProgress[] }>(
    `/api/admin/courses/${encodeURIComponent(String(courseId))}/students`
  );
}

export function getStudentProfileFromDb(studentId: number) {
  return request<DbStudent>(`/api/admin/students/${studentId}/profile`);
}

export function getStudentLearningRecord(studentId: number) {
  return request<StudentLearningRecord>(`/api/admin/students/${studentId}/learning`);
}

export function deleteCourseFromDb(courseId: string | number) {
  return request<{ deleted: boolean }>(`/api/admin/courses/${encodeURIComponent(String(courseId))}`, { method: "DELETE" });
}

export function updateCourseInDb(courseId: string | number, payload: Omit<CourseCreatePayload, "modules" | "language" | "banner_url">) {
  return request<DbCourse>(`/api/admin/courses/${encodeURIComponent(String(courseId))}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function publishCourseInDb(courseId: string | number) {
  return request<{ course_id: number; status: string }>(`/api/admin/courses/${encodeURIComponent(String(courseId))}/publish`, {
    method: "POST"
  });
}

export function moveCourseToDraftInDb(courseId: string | number) {
  return request<{ course_id: number; status: string }>(`/api/admin/courses/${encodeURIComponent(String(courseId))}/draft`, {
    method: "POST"
  });
}

export async function createStudentAccountInDb(payload: StudentAccountPayload) {
  const token = typeof window !== "undefined" ? window.localStorage.getItem(tokenStorageKey) : null;
  const response = await fetch(`${API_BASE_URL}/api/admin/students/accounts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(payload)
  });
  const json: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (handleInvalidToken(response)) {
      throw new Error("Your session expired. Redirecting to the unified login.");
    }
    if (response.status === 409 && json && typeof json === "object" && "id" in json) {
      return json as { id: number };
    }
    const detail = payloadError(json) || response.statusText;
    notify({ type: "error", message: detail || "Student account could not be saved." });
    throw new Error(detail || `Request failed with ${response.status}`);
  }
  const created = json as { id: number; credential_email_sent?: boolean; credential_delivery_message?: string | null; existing_account_recovered?: boolean };
  notify({
    type: "success",
    message: created.credential_email_sent
      ? "Student account created and login credentials emailed successfully."
      : created.credential_delivery_message || "Student account created successfully."
  });
  return created;
}

export function listStudentsFromDb() {
  return request<DbStudent[]>("/api/admin/students");
}

export async function deleteStudentFromDb(studentId: number, studentEmail: string) {
  const result = await request<{ deleted: boolean; student_id: number; email: string; message: string }>(
    `/api/admin/students/accounts/${studentId}?confirm=${encodeURIComponent(studentEmail.trim().toLowerCase())}`,
    { method: "DELETE" }
  );
  notify({ type: "success", message: result.message });
  return result;
}

export function assignCourseToStudent(studentId: number, courseId: number) {
  return request<{ assigned: boolean; student_id: number; course_id: number; course_title: string }>(
    `/api/admin/students/${studentId}/courses`,
    { method: "POST", body: JSON.stringify({ course_id: courseId }) }
  );
}

export function resetStudentPasswordInDb(studentId: number) {
  return request<{ reset: boolean; student_id: number; recipient: string; message: string }>(
    `/api/admin/students/${studentId}/reset-password`,
    { method: "POST" }
  );
}

export function approveStudentProfileInDb(studentId: number) {
  return request<{ student_id: number; status: string }>(`/api/admin/students/${studentId}/approve`, {
    method: "POST"
  });
}

export function sendStudentCredentialsFromDb(
  studentId: number,
  recipientEmail: string,
  loginEmail: string,
  studentName: string,
  portalLink: string,
  companyEmail: string,
  senderEmail: string,
  tempPassword: string
) {
  const body: { recipient_email: string; login_email: string; student_name: string; portal_link: string; company_email: string; sender_email?: string; temp_password: string } = {
    recipient_email: recipientEmail.trim(),
    login_email: loginEmail.trim(),
    student_name: studentName.trim(),
    portal_link: portalLink.trim(),
    company_email: companyEmail.trim(),
    temp_password: tempPassword
  };
  const cleanSenderEmail = senderEmail?.trim();
  if (cleanSenderEmail) {
    body.sender_email = cleanSenderEmail;
  }

  return request<{ sent: boolean; mode: string; message: string }> ("/api/admin/students/" + studentId + "/send-credentials", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function sendMessageToStudent(studentId: number, message: string) {
  return request<{ id: number; student_email: string; message: string; sent_at: string }>(`/api/admin/students/${studentId}/messages`, {
    method: "POST",
    body: JSON.stringify({ message })
  });
}

export function scheduleStudentDailyReminder(studentId: number, message: string, sendTimeIst: string) {
  return request<{ id: number; student_email: string; send_time_ist: string; active: boolean }>(`/api/admin/students/${studentId}/daily-reminder`, {
    method: "POST",
    body: JSON.stringify({ message, send_time_ist: sendTimeIst })
  });
}

export function getGlobalPortalAccess() {
  return request<PortalAccessSettings>("/api/admin/access/global");
}

export function updateGlobalPortalAccess(payload: PortalAccessSettings) {
  return request<PortalAccessSettings>("/api/admin/access/global", { method: "PUT", body: JSON.stringify(payload) });
}

export function getStudentPortalAccess(studentId: number) {
  return request<PortalAccessSettings>(`/api/admin/access/students/${studentId}`);
}

export function updateStudentPortalAccess(studentId: number, payload: PortalAccessSettings) {
  return request<PortalAccessSettings>(`/api/admin/access/students/${studentId}`, { method: "PUT", body: JSON.stringify(payload) });
}

export async function getAdminSnapshot<T>(key: string): Promise<T | null> {
  try {
    const result = await request<{ payload: T }>(`/api/admin/snapshots/${encodeURIComponent(key)}`);
    return result.payload;
  } catch {
    return null;
  }
}

export function saveAdminSnapshot<T>(key: string, payload: T) {
  return request<{ saved: boolean }>(`/api/admin/snapshots/${encodeURIComponent(key)}`, {
    method: "PUT",
    body: JSON.stringify({ payload })
  });
}

export async function getStandaloneAssessments<T>(): Promise<T | null> {
  try {
    const result = await request<{ assessments: T }>("/api/admin/assessments/standalone");
    return result.assessments;
  } catch {
    return null;
  }
}

export function saveStandaloneAssessments<T>(assessments: T) {
  return request<{ saved: boolean }>("/api/admin/assessments/standalone", {
    method: "PUT",
    body: JSON.stringify({ assessments })
  });
}

export async function getCourseAssessments<T>(courseId: string): Promise<T | null> {
  try {
    const result = await request<{ assessments: T }>(`/api/admin/assessments/courses/${encodeURIComponent(courseId)}`);
    return result.assessments;
  } catch {
    return null;
  }
}

export function saveCourseAssessments<T>(courseId: string, assessments: T) {
  return request<{ saved: boolean }>(`/api/admin/assessments/courses/${encodeURIComponent(courseId)}`, {
    method: "PUT",
    body: JSON.stringify({ assessments })
  });
}

export async function getStudentCourseAssessments<T>(courseId: string): Promise<T | null> {
  try {
    const result = await request<{ assessments: T }>(`/api/student/courses/${encodeURIComponent(courseId)}/assessments`);
    return result.assessments;
  } catch {
    return null;
  }
}

export async function saveStudentCourseSubmission<T>(courseId: string, submission: T): Promise<void> {
  try {
    await request<{ saved: boolean }>(`/api/student/courses/${encodeURIComponent(courseId)}/assessment-submissions`, {
      method: "POST",
      body: JSON.stringify({ submission })
    });
  } catch {
    // Keep student flow usable offline; localStorage remains the fallback.
  }
}

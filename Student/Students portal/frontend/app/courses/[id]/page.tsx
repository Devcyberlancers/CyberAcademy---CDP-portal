"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, BookOpen, CalendarDays, CheckCircle2, ClipboardCheck, Lock, Medal, Search, Trophy, X } from "lucide-react";
import { DashboardShell, type StudentSection } from "@/components/dashboard-shell";
import { defaultStudentAccount, fetchStudentProfile, readStudentAccount, type StudentAccount } from "@/lib/student-account";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

type CourseAssessment = {
  assignmentId: string;
  title: string;
  durationMinutes: number;
  maxAttempts: number;
  questionCount: number;
};
type ModuleQuestion = { question?: string; options?: string[] };
type CourseModule = {
  title?: string;
  videoUrl?: string;
  videoSource?: "youtube" | "upload";
  uploadedVideoName?: string;
  uploadedVideoUrl?: string;
  imageUrl?: string;
  resources?: string[];
  quiz?: string;
  locked?: boolean;
  unlockRule?: string;
  generatedQuestions?: ModuleQuestion[];
  accessible?: boolean;
  completed?: boolean;
  videoCompleted?: boolean;
  quizPassed?: boolean;
  quizAssignmentId?: string | null;
};
type CourseContent = {
  course: {
    id: number;
    title: string;
    heading?: string;
    category?: string;
    level?: string;
    metadata?: Record<string, string>;
    banner?: { imageUrl?: string };
  };
  modules: CourseModule[];
  assessments: CourseAssessment[];
};

export default function StudentCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const [courseId, setCourseId] = useState("");
  const [data, setData] = useState<CourseContent | null>(null);
  const [error, setError] = useState("");
  const [completing, setCompleting] = useState<number | null>(null);
  const [activeQuizIndex, setActiveQuizIndex] = useState<number | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizError, setQuizError] = useState("");
  const [quizResult, setQuizResult] = useState<{ score: number; passed: boolean } | null>(null);
  const [activeModuleIndex, setActiveModuleIndex] = useState(0);
  const [student, setStudent] = useState<StudentAccount>(defaultStudentAccount);
  const [searchValue, setSearchValue] = useState("");
  const [instructionAssessment, setInstructionAssessment] = useState<CourseAssessment | null>(null);
  const [preflightAssessment, setPreflightAssessment] = useState<CourseAssessment | null>(null);

  useEffect(() => {
    const account = readStudentAccount();
    setStudent(account);
    if (account.email) void fetchStudentProfile(account.email).then((profile) => { if (profile) setStudent(profile); }).catch(() => undefined);
  }, []);

  useEffect(() => {
    void params.then(({ id }) => setCourseId(id));
  }, [params]);

  useEffect(() => {
    if (!courseId) return;
    const token = window.localStorage.getItem("cyber-academy-auth-token");
    fetch(`${apiBaseUrl}/api/courses/${encodeURIComponent(courseId)}/content`, { cache: "no-store", headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 404 ? "This course is not published." : "Course content could not be loaded.");
        return response.json() as Promise<CourseContent>;
      })
      .then(setData)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Course content could not be loaded."));
  }, [courseId]);

  const withPortalShell = (content: ReactNode) => (
    <DashboardShell
      activeSection="courses"
      onSectionChange={(section: StudentSection) => { window.location.href = `/dashboard/student?section=${encodeURIComponent(section)}`; }}
      searchValue={searchValue}
      onSearchValueChange={setSearchValue}
      onSearchSubmit={() => { window.location.href = `/dashboard/student?section=courses&search=${encodeURIComponent(searchValue.trim())}`; }}
      student={student}
    >
      {content}
    </DashboardShell>
  );

  if (error) {
    return withPortalShell(<CourseMessage message={error} />);
  }
  if (!data) {
    return withPortalShell(<CourseMessage message="Loading course content…" />);
  }

  const description = data.course.metadata?.description || data.course.heading || "Course content published by your administrator.";
  const completedModules = data.modules.filter((module) => module.completed).length;
  const courseProgress = data.modules.length ? Math.round((completedModules / data.modules.length) * 100) : 0;
  const activeModule = data.modules[Math.min(activeModuleIndex, Math.max(0, data.modules.length - 1))];
  const activeModulePosition = Math.min(activeModuleIndex, Math.max(0, data.modules.length - 1));

  function startModuleQuiz(moduleIndex: number) {
    setQuizError("");
    setQuizAnswers({});
    setQuizResult(null);
    setActiveQuizIndex(moduleIndex);
  }

  async function submitModuleQuiz() {
    if (activeQuizIndex === null) return;
    const token = window.localStorage.getItem("cyber-academy-auth-token");
    const response = await fetch(`${apiBaseUrl}/api/courses/${encodeURIComponent(courseId)}/modules/quiz-submit`, {
      method: "PUT", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ module_index: activeQuizIndex, answers: quizAnswers }),
    });
    if (!response.ok) { setQuizError("Quiz submission failed. Please try again."); return; }
    setQuizResult(await response.json() as { score: number; passed: boolean });
    const refreshed = await fetch(`${apiBaseUrl}/api/courses/${encodeURIComponent(courseId)}/content`, { cache: "no-store", headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (refreshed.ok) setData(await refreshed.json() as CourseContent);
  }

  return withPortalShell(
    <main className="min-h-[calc(100vh-72px)] bg-[#f6f8fc] px-4 py-6 text-[#07142f] sm:px-7">
      <div className="mx-auto max-w-6xl">
        <Link href="/dashboard/student?section=courses" className="inline-flex items-center gap-2 font-semibold text-[#3155ff]">
          <ArrowLeft size={18} /> Back to Courses
        </Link>

        <CourseHeader course={data.course} courseProgress={courseProgress} assessmentCount={data.assessments.length} moduleCount={data.modules.length} />
        {data.assessments.length ? <CourseAssessmentWorkspace assessments={data.assessments} courseProgress={courseProgress} onInstructions={setInstructionAssessment} onTakeTest={setPreflightAssessment} /> : null}
        <section className="mt-6 grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-[#dfe4f2] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-[#edf0f5] pb-4"><h2 className="flex items-center gap-2 text-lg font-bold"><BookOpen size={20} /> Course content</h2><span className="rounded-full bg-[#eef2ff] px-2.5 py-1 text-xs font-bold text-[#3155ff]">{completedModules}/{data.modules.length}</span></div>
            <div className="mt-3 space-y-2">{data.modules.map((module, moduleIndex) => <button key={`${module.title}-${moduleIndex}`} type="button" disabled={!module.accessible} onClick={() => setActiveModuleIndex(moduleIndex)} className={`w-full rounded-xl border p-3 text-left transition ${activeModulePosition === moduleIndex ? "border-[#3155ff] bg-[#eef2ff]" : "border-transparent hover:bg-[#f6f8fc]"} ${!module.accessible ? "cursor-not-allowed opacity-55" : ""}`}><div className="flex items-start gap-3"><span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${module.completed ? "bg-emerald-500 text-white" : module.accessible ? "bg-[#3155ff] text-white" : "bg-slate-200 text-slate-600"}`}>{module.completed ? <CheckCircle2 size={14} /> : module.accessible ? moduleIndex + 1 : <Lock size={13} />}</span><span className="min-w-0"><span className="block truncate text-sm font-bold text-[#07142f]">{module.title || `Module ${moduleIndex + 1}`}</span><span className="mt-1 block text-xs text-[#657083]">{module.completed ? "Completed" : module.accessible ? "Available" : "Locked"}</span></span></div></button>)}</div>
          </aside>
          <article className="min-w-0 rounded-2xl border border-[#dfe4f2] bg-white p-5 shadow-sm sm:p-7">
            {activeModule ? <><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-bold text-[#3155ff]">Module {activeModulePosition + 1} of {data.modules.length}</p><h2 className="mt-1 text-2xl font-bold">{activeModule.title || `Module ${activeModulePosition + 1}`}</h2></div>{activeModule.completed ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700"><CheckCircle2 size={14} /> Completed</span> : <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">In progress</span>}</div>
              {activeModule.imageUrl ? <img src={activeModule.imageUrl} alt="" className="mt-6 max-h-80 w-full rounded-xl object-cover" /> : null}
              <div className="mt-6 grid gap-3 sm:grid-cols-2"><ProgressTile label="Module test" complete={Boolean(activeModule.quizPassed)} optional={!activeModule.generatedQuestions?.length} /><ProgressTile label="Module" complete={Boolean(activeModule.completed)} /></div>
              {activeModule.generatedQuestions?.length ? <div className="mt-7 border-t border-[#edf0f5] pt-5"><h3 className="flex items-center gap-2 font-bold"><ClipboardCheck size={18} /> {activeModule.quiz || "Module quiz"}</h3><p className="mt-2 text-sm text-[#657083]">Complete this quiz to unlock the next module. A score of at least 60% is required.</p><button type="button"  onClick={() => startModuleQuiz(activeModulePosition)} className="mt-4 rounded-lg bg-[#3155ff] px-4 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{activeModule.quizPassed ? "Review quiz" : "Start module quiz"}</button></div> : null}
            </> : <EmptyState message="No modules have been published for this course yet." />}
          </article>
        </section>
        {activeQuizIndex !== null ? <CourseQuiz module={data.modules[activeQuizIndex]} answers={quizAnswers} onChoose={(index, value) => setQuizAnswers((current) => ({ ...current, [String(index)]: value }))} error={quizError} result={quizResult} onSubmit={() => void submitModuleQuiz()} onClose={() => setActiveQuizIndex(null)} /> : null}
        {instructionAssessment ? <PlatformInstructions assessment={instructionAssessment} onClose={() => setInstructionAssessment(null)} /> : null}
        {preflightAssessment ? <AssessmentReadinessDialog assessment={preflightAssessment} onClose={() => setPreflightAssessment(null)} /> : null}
      </div>
    </main>
  );
}

function CourseHeader({ course, courseProgress, assessmentCount, moduleCount }: { course: CourseContent["course"]; courseProgress: number; assessmentCount: number; moduleCount: number }) {
  const details = course as CourseContent["course"] & { startDate?: string; start_date?: string; endDate?: string; end_date?: string };
  return <><section className="mt-5 rounded-xl bg-[#102f98] px-5 py-7 text-white shadow-sm sm:px-8"><div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-center gap-4"><span className="grid h-12 w-12 place-items-center rounded-md bg-[#a500a8]"><BookOpen size={23} /></span><h1 className="text-xl font-bold sm:text-2xl">{course.title}</h1></div><div className="flex w-full max-w-md items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-[#3155ff]" style={{ width: `${courseProgress}%` }} /></div><span className="font-bold">{courseProgress}%</span></div></div></section><div className="relative z-10 -mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><CourseMetric icon={<CalendarDays size={19} />} label="Start Date" value={courseDate(details.startDate || details.start_date)} tone="text-[#42b848]" /><CourseMetric icon={<CalendarDays size={19} />} label="End Date" value={courseDate(details.endDate || details.end_date)} tone="text-red-500" /><CourseMetric icon={<Medal size={19} />} label="Badges" value="0" tone="text-[#8d00ac]" /><CourseMetric icon={<Trophy size={19} />} label="Super Badges" value="0" tone="text-orange-400" /><CourseMetric icon={<ClipboardCheck size={19} />} label="Tests" value={String(assessmentCount || moduleCount)} tone="text-[#3155ff]" /></div></>;
}
function CourseMetric({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string; tone: string }) { return <div className="flex min-h-[56px] items-center gap-3 rounded-lg bg-white px-4 py-3 shadow-md"><span className={`grid h-8 w-8 place-items-center rounded-full bg-[#f2f4ff] ${tone}`}>{icon}</span><span className="font-semibold text-[#07142f]">{label}</span><span className={`ml-auto font-bold ${tone}`}>{value}</span></div>; }
function courseDate(value?: string) { if (!value) return "—"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" }); }
function CourseAssessmentWorkspace({ assessments, courseProgress, onInstructions, onTakeTest }: { assessments: CourseAssessment[]; courseProgress: number; onInstructions: (assessment: CourseAssessment) => void; onTakeTest: (assessment: CourseAssessment) => void }) {
  const [query, setQuery] = useState(""); const [selectedId, setSelectedId] = useState(assessments[0]?.assignmentId || "");
  const visible = assessments.filter((item) => item.title.toLowerCase().includes(query.trim().toLowerCase())); const selected = assessments.find((item) => item.assignmentId === selectedId) || visible[0] || assessments[0];
  useEffect(() => { if (selected && selected.assignmentId !== selectedId && !assessments.some((item) => item.assignmentId === selectedId)) setSelectedId(selected.assignmentId); }, [assessments, selected, selectedId]);
  if (!selected) return null;
  return <section className="mt-7 rounded-2xl bg-white p-4 shadow-sm sm:p-5"><div className="grid gap-5 xl:grid-cols-[32%_1fr]"><aside><label className="flex h-14 items-center gap-3 rounded-lg border border-[#e0e4ec] px-4 text-[#929bb0]"><Search size={24} /><input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-lg outline-none" placeholder="Search" /></label><div className="mt-3 overflow-hidden rounded-lg border border-[#e4e7ee]"><div className="flex items-center justify-between border-b border-[#e4e7ee] p-4"><span className="font-bold text-lg">Course Assessments</span><span className="grid h-11 w-11 place-items-center rounded-full border-4 border-[#e5e7eb] border-t-[#3155ff] text-xs font-bold">{courseProgress}%</span></div><div className="max-h-[420px] overflow-y-auto p-3">{visible.length ? visible.map((item, index) => <button key={item.assignmentId} type="button" onClick={() => setSelectedId(item.assignmentId)} className={`mb-2 w-full rounded-md p-3 text-left ${selected.assignmentId === item.assignmentId ? "bg-[#f0f2ff]" : "hover:bg-[#f7f8fc]"}`}><span className={`mr-2 inline-block h-3 w-3 rounded-full ${selected.assignmentId === item.assignmentId ? "bg-[#3155ff]" : "bg-slate-400"}`} /><span className="font-semibold text-[#44506b]">{index + 1}. {item.title}</span><span className="mt-2 block pl-5 text-sm text-[#68738a]">Questions: {item.questionCount} · {item.durationMinutes || "Unlimited"} min</span></button>) : <p className="p-4 text-sm text-[#657083]">No matching tests.</p>}</div></div></aside><article className="overflow-hidden rounded-lg border border-[#e4e7ee]"><header className="flex flex-wrap items-center justify-between gap-3 bg-[#f3f4ff] px-5 py-4"><h2 className="text-xl font-bold">{selected.title}</h2><div className="flex items-center gap-2"><button type="button" onClick={() => onInstructions(selected)} className="px-3 py-2 font-semibold text-[#3155ff]">View Instructions</button><button type="button" onClick={() => onTakeTest(selected)} className="rounded-md bg-[#3155ff] px-4 py-2.5 font-bold text-white hover:bg-[#2447f1]">Take Test</button></div></header><div className="flex items-center justify-between border-b border-[#e4e7ee]"><span className="border-b-2 border-[#3155ff] bg-[#f1f3ff] px-4 py-4 text-lg font-semibold text-[#3155ff]">Overview</span><span className="px-5 font-bold">Attempts: 00 / {selected.maxAttempts || 1}</span></div><div className="p-5"><p className="mb-6 text-center text-sm text-red-500">Start before the course end date</p><div className="overflow-x-auto rounded-lg border border-[#dfe4f2]"><table className="w-full min-w-[560px] text-left"><thead className="bg-[#e8ebff]"><tr><th className="p-4">SNo</th><th className="p-4">Name</th><th className="p-4">Questions</th><th className="p-4">Duration (Min)</th><th className="p-4">Marks</th></tr></thead><tbody><tr className="border-t border-[#e4e7ee]"><td className="p-4">1</td><td className="p-4">{selected.title}</td><td className="p-4">{selected.questionCount}</td><td className="p-4">{selected.durationMinutes || "Unlimited"}</td><td className="p-4">{selected.questionCount}</td></tr><tr className="border-t border-[#e4e7ee] font-bold"><td className="p-4"></td><td className="p-4 text-[#3155ff]">Total</td><td className="p-4">{selected.questionCount}</td><td className="p-4">{selected.durationMinutes || "Unlimited"}</td><td className="p-4">{selected.questionCount}</td></tr></tbody></table></div></div></article></div></section>;
}
function ProgressTile({ label, complete, optional = false }: { label: string; complete: boolean; optional?: boolean }) { return <div className={`rounded-xl p-3 text-sm ${complete ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-600"}`}><p className="font-bold">{label}</p><p className="mt-1 text-xs">{optional ? "Not required" : complete ? "Complete" : "Pending"}</p></div>; }

function EmptyState({ message }: { message: string }) {
  return <div className="mt-4 rounded-xl border border-dashed border-[#cfd6e3] bg-white px-6 py-10 text-center text-[#657083]">{message}</div>;
}

function CourseMessage({ message }: { message: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f8fc] px-4">
      <div className="rounded-xl bg-white p-8 text-center shadow">
        <CheckCircle2 className="mx-auto text-[#3155ff]" />
        <p className="mt-3 font-semibold">{message}</p>
        <Link href="/dashboard/student?section=courses" className="mt-5 inline-block text-[#3155ff]">Back to Courses</Link>
      </div>
    </main>
  );
}

function CourseQuiz({ module, answers, onChoose, error, result, onSubmit, onClose }: { module?: CourseModule; answers: Record<string, string>; onChoose: (index: number, value: string) => void; error: string; result: { score: number; passed: boolean } | null; onSubmit: () => void; onClose: () => void }) {
  return <section className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-4 sm:p-8"><div className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-[#3155ff]">Module quiz</p><h2 className="text-2xl font-bold">{module?.quiz || "Knowledge check"}</h2></div><button onClick={onClose} className="font-semibold text-slate-500">Close</button></div>{result ? <div className="mt-6 rounded-xl bg-[#eefaf1] p-5"><h3 className="text-xl font-bold">{result.passed ? "Quiz passed" : "Quiz not passed"}</h3><p className="mt-2">Score: {result.score}%. {result.passed ? "The next module is now unlocked." : "You need 60% to unlock the next module."}</p><button onClick={onClose} className="mt-4 rounded-lg bg-[#3155ff] px-4 py-2 font-semibold text-white">Return to course</button></div> : <><div className="mt-6 grid gap-5">{module?.generatedQuestions?.map((question, questionIndex) => <div key={questionIndex} className="rounded-xl border border-[#dfe4f2] p-4"><p className="font-bold">{questionIndex + 1}. {question.question}</p><div className="mt-3 grid gap-2">{question.options?.map((option) => <label key={option} className="flex cursor-pointer items-center gap-3 rounded-lg border p-3"><input type="radio" name={`q-${questionIndex}`} checked={answers[String(questionIndex)] === option} onChange={() => onChoose(questionIndex, option)} /><span>{option}</span></label>)}</div></div>)}</div>{error ? <p className="mt-4 text-sm font-semibold text-red-600">{error}</p> : null}<button onClick={onSubmit} className="mt-6 rounded-lg bg-[#3155ff] px-5 py-3 font-semibold text-white">Submit quiz</button></>}</div></section>;
}

function PlatformInstructions({ assessment, onClose }: { assessment: CourseAssessment; onClose: () => void }) {
  return <section className="fixed inset-0 z-[60] overflow-y-auto bg-slate-950/55 p-4 sm:p-8" role="dialog" aria-modal="true" aria-label="Platform Instructions" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="mx-auto max-w-3xl rounded-2xl bg-white shadow-2xl"><div className="sticky top-0 flex items-start justify-between gap-4 border-b border-[#edf0f5] bg-white p-5 sm:p-6"><div><p className="text-sm font-bold text-[#3155ff]">{assessment.title}</p><h2 className="mt-1 text-2xl font-bold text-[#07142f]">Platform Instructions</h2></div><button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full border border-[#dfe4f2] text-[#657083]" aria-label="Close instructions"><X size={20} /></button></div><div className="space-y-6 p-5 text-sm leading-6 text-[#4d5360] sm:p-7"><InstructionBlock title="Navigating Your Test"><p>You can see the time available to complete the test in the countdown timer at the top right of the test screen at all times.</p><p>If sectional lock is enabled, a separate countdown timer appears on the section tab.</p><p>You can bookmark an answer for later review using the flag icon. All answers are saved automatically.</p></InstructionBlock><InstructionBlock title="Instructions for Coding Section"><p>Click <b>Submit Code</b> to send code for evaluation; otherwise it is not submitted.</p><p>Changing the coding language may remove code you have typed. Confirm before switching languages.</p></InstructionBlock><InstructionBlock title="Instructions for Video Questions"><p>Record responses as videos where requested. Select Start Recording, then Submit Recording.</p><p>You may delete and re-record before submission. Once submitted, the recording cannot be changed.</p></InstructionBlock><InstructionBlock title="Important Instructions for Proctored Test"><ul className="list-disc space-y-2 pl-5"><li>Use a reliable, uninterrupted network connection and clear browser cache, history, and cookies before starting.</li><li>Keep your webcam uncovered, with a clear, well-lit background. Your face and both ears must remain visible.</li><li>Do not turn away from the monitor, use a personal calculator, or allow notifications to interrupt the assessment.</li><li>Mobile users should keep the phone stable and undisturbed. If phone monitoring is required, connect it by USB—not Bluetooth or Wi-Fi.</li><li>AI proctoring detects suspicious activity such as mobile phone usage or assistance from others.</li></ul></InstructionBlock><InstructionBlock title="Submitting Your Exam"><p>To end the test, select End Test and confirm by typing <b>END</b>. The test is submitted automatically when the allotted time expires.</p></InstructionBlock><InstructionBlock title="Caution"><p><b>Do not refresh the page or use the browser back button while the test is in progress.</b> You may lose unsaved data.</p><p>If internet or power is interrupted, sign in again to resume from the last automatic save point.</p></InstructionBlock><div className="flex justify-end border-t border-[#edf0f5] pt-5"><button type="button" onClick={onClose} className="rounded-lg bg-[#3155ff] px-5 py-2.5 font-semibold text-white">Close</button></div></div></div></section>;
}

function InstructionBlock({ title, children }: { title: string; children: ReactNode }) { return <section><h3 className="text-base font-bold text-[#07142f]">{title}</h3><div className="mt-2 space-y-2">{children}</div></section>; }
function AssessmentReadinessDialog({ assessment, onClose }: { assessment: CourseAssessment; onClose: () => void }) {
  const [cameraChecked, setCameraChecked] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const chromium = typeof navigator !== "undefined" && /Chrome|Edg|Chromium/i.test(navigator.userAgent) && !/Firefox|Safari\//i.test(navigator.userAgent);
  const checks = [
    { label: "Supported browser", detail: "Use the latest Google Chrome or Microsoft Edge.", passed: chromium },
    { label: "Internet connection", detail: navigator.onLine ? "Internet connection is online." : "Reconnect to the internet before starting.", passed: navigator.onLine },
    { label: "Screen size", detail: window.innerWidth >= 1024 ? "Desktop or laptop display detected." : "Use a desktop or laptop with at least 1024px width.", passed: window.innerWidth >= 1024 },
    { label: "Fullscreen support", detail: document.fullscreenEnabled ? "Fullscreen mode is available." : "Fullscreen is blocked by this browser or device.", passed: document.fullscreenEnabled },
    { label: "Camera permission", detail: cameraChecked ? "Camera access verified." : cameraError || "Verify your camera before continuing.", passed: cameraChecked },
  ];
  const allPassed = checks.every((check) => check.passed);
  async function verifyCamera() {
    setCameraError("");
    try { const stream = await navigator.mediaDevices.getUserMedia({ video: true }); stream.getTracks().forEach((track) => track.stop()); setCameraChecked(true); }
    catch { setCameraChecked(false); setCameraError("Camera permission was not granted. Allow camera access and try again."); }
  }
  function continueToTest() {
    if (!allPassed) return;
    window.sessionStorage.setItem(`cyber-academy-assessment-ready:${assessment.assignmentId}`, "1");
    window.location.href = `/dashboard/student?section=assessments&assignment=${encodeURIComponent(assessment.assignmentId)}&preflight=1`;
  }
  return <section className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-label="Assessment readiness check"><div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl"><div className="flex items-start justify-between gap-4 border-b border-[#edf0f5] p-5 sm:p-6"><div><p className="text-sm font-bold text-[#3155ff]">Secure assessment check</p><h2 className="mt-1 text-2xl font-bold text-[#07142f]">Ready to take {assessment.title}?</h2><p className="mt-2 text-sm text-[#657083]">Complete every requirement before the secure test can begin.</p></div><button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full border border-[#dfe4f2] text-[#657083]" aria-label="Close readiness check"><X size={20} /></button></div><div className="space-y-3 p-5 sm:p-6">{checks.map((check) => <div key={check.label} className={`flex items-start gap-3 rounded-xl border p-4 ${check.passed ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}><span className={`mt-0.5 grid h-6 w-6 place-items-center rounded-full text-white ${check.passed ? "bg-emerald-500" : "bg-red-500"}`}>{check.passed ? "✓" : "!"}</span><div><p className={`font-bold ${check.passed ? "text-emerald-800" : "text-red-800"}`}>{check.label}</p><p className={`mt-1 text-sm ${check.passed ? "text-emerald-700" : "text-red-700"}`}>{check.detail}</p></div></div>)}</div><div className="flex flex-col-reverse gap-3 border-t border-[#edf0f5] p-5 sm:flex-row sm:justify-end"><button type="button" onClick={() => void verifyCamera()} className="rounded-lg border border-[#3155ff] px-4 py-2.5 font-semibold text-[#3155ff]">{cameraChecked ? "Camera verified" : "Verify camera"}</button><button type="button" disabled={!allPassed} onClick={continueToTest} className="rounded-lg bg-[#3155ff] px-5 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Continue to secure test</button></div></div></section>;
}
"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, BookOpen, Bookmark, CalendarDays, ChevronLeft, ChevronRight, CheckCircle2, ClipboardCheck, Lock, Medal, Search, Trophy, X } from "lucide-react";
import { DashboardShell, type StudentSection } from "@/components/dashboard-shell";
import { defaultStudentAccount, fetchStudentProfile, readStudentAccount, type StudentAccount } from "@/lib/student-account";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

type TestAttempt = {
  attemptId?: number;
  attemptNumber: number;
  status?: "in_progress" | "completed" | "terminated" | "auto_submitted";
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  score: number;
  passed?: boolean;
  tabSwitches?: number;
  violations?: number;
  browser: string;
  ipAddress: string;
};
type CourseAssessment = {
  assignmentId: string;
  title: string;
  durationMinutes: number;
  maxAttempts: number;
  questionCount: number;
  attempts: TestAttempt[];
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
  maxAttempts?: number;
  quizAttempts?: TestAttempt[];
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
  const moduleTests: CourseAssessment[] = data.modules.flatMap((module, moduleIndex) => module.generatedQuestions?.length ? [{ assignmentId: `module:${moduleIndex}`, title: module.quiz || module.title || `Module ${moduleIndex + 1} Test`, durationMinutes: 0, maxAttempts: module.maxAttempts || 3, questionCount: module.generatedQuestions.length, attempts: module.quizAttempts || [] }] : []);
  const testItems = [...moduleTests, ...data.assessments];

  function startModuleQuiz(moduleIndex: number) {
    setQuizError("");
    setQuizAnswers({});
    setQuizResult(null);
    setActiveQuizIndex(moduleIndex);
  }

  async function submitModuleQuiz(metadata?: { startedAt: string; tabSwitches: number; browser: string }) {
    if (activeQuizIndex === null) return;
    const token = window.localStorage.getItem("cyber-academy-auth-token");
    const response = await fetch(`${apiBaseUrl}/api/courses/${encodeURIComponent(courseId)}/modules/quiz-submit`, {
      method: "PUT", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ module_index: activeQuizIndex, answers: quizAnswers, started_at: metadata?.startedAt, tab_switches: metadata?.tabSwitches ?? 0, browser: metadata?.browser }),
    });
    if (!response.ok) { setQuizError("Quiz submission failed. Please try again."); return; }
    setQuizResult(await response.json() as { score: number; passed: boolean });
    const refreshed = await fetch(`${apiBaseUrl}/api/courses/${encodeURIComponent(courseId)}/content`, { cache: "no-store", headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (refreshed.ok) setData(await refreshed.json() as CourseContent);
  }

  return withPortalShell(
    <main className="min-h-[calc(100vh-72px)] bg-[#f6f8fc] px-4 py-6 text-[#07142f] sm:px-7">
      <div className="mx-auto w-full max-w-none">
        <Link href="/dashboard/student?section=courses" className="inline-flex items-center gap-2 font-semibold text-[#3155ff]">
          <ArrowLeft size={18} /> Back to Courses
        </Link>

        <CourseHeader course={data.course} courseProgress={courseProgress} assessmentCount={testItems.length} moduleCount={data.modules.length} />
        {testItems.length ? <CourseAssessmentWorkspace assessments={testItems} courseProgress={courseProgress} onInstructions={setInstructionAssessment} onTakeTest={setPreflightAssessment} /> : null}
        {activeQuizIndex !== null ? <CourseQuiz module={data.modules[activeQuizIndex]} answers={quizAnswers} onChoose={(index, value) => setQuizAnswers((current) => ({ ...current, [String(index)]: value }))} error={quizError} result={quizResult} onSubmit={(metadata) => void submitModuleQuiz(metadata)} onClose={() => setActiveQuizIndex(null)} /> : null}
        {instructionAssessment ? <PlatformInstructions assessment={instructionAssessment} onClose={() => setInstructionAssessment(null)} /> : null}
        {preflightAssessment ? <AssessmentReadinessDialog assessment={preflightAssessment} onClose={() => setPreflightAssessment(null)} onProceed={preflightAssessment.assignmentId.startsWith("module:") ? () => startModuleQuiz(Number(preflightAssessment.assignmentId.slice("module:".length))) : undefined} /> : null}
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
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(assessments[0]?.assignmentId || "");
  const [attemptNumber, setAttemptNumber] = useState<number | null>(null);
  const visible = assessments.filter((item) => item.title.toLowerCase().includes(query.trim().toLowerCase()));
  const selected = assessments.find((item) => item.assignmentId === selectedId) || visible[0] || assessments[0];
  const attempts = selected?.attempts ?? [];
  const chosenAttempt = attempts.find((item) => item.attemptNumber === attemptNumber) || attempts[attempts.length - 1];
  const completed = attempts.filter((item) => item.status !== "in_progress");
  const scores = completed.map((item) => item.score);
  const average = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
  const exhausted = attempts.length >= (selected?.maxAttempts || 1);
  useEffect(() => { if (selected && selected.assignmentId !== selectedId && !assessments.some((item) => item.assignmentId === selectedId)) setSelectedId(selected.assignmentId); }, [assessments, selected, selectedId]);
  useEffect(() => { setAttemptNumber(null); }, [selectedId]);
  if (!selected) return null;
  return <section className="mt-7 rounded-2xl bg-white p-4 shadow-sm sm:p-5"><div className="grid gap-5 xl:grid-cols-[32%_1fr]"><aside><label className="flex h-14 items-center gap-3 rounded-lg border border-[#e0e4ec] px-4 text-[#929bb0]"><Search size={24} /><input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-lg outline-none" placeholder="Search" /></label><div className="mt-3 overflow-hidden rounded-lg border border-[#e4e7ee]"><div className="flex items-center justify-between border-b border-[#e4e7ee] p-4"><span className="text-lg font-bold">Course Tests</span><ProgressRing value={courseProgress} /></div><div className="max-h-[470px] overflow-y-auto p-3">{visible.length ? visible.map((item, index) => { const attempted=item.attempts.some((attempt)=>attempt.status!=="in_progress"); return <button key={item.assignmentId} type="button" onClick={() => setSelectedId(item.assignmentId)} className={`mb-2 w-full rounded-md p-3 text-left ${selected.assignmentId === item.assignmentId ? "bg-[#f0f2ff]" : "hover:bg-[#f7f8fc]"}`}>{attempted?<CheckCircle2 size={17} className="mr-2 inline text-emerald-600"/>:<span className="mr-2 inline-block h-3 w-3 rounded-full bg-slate-400"/>}<span className={`font-semibold ${attempted?"text-emerald-700":"text-[#44506b]"}`}>{index + 1}. {item.title}</span><span className="mt-2 block pl-6 text-sm text-[#68738a]">Questions: {item.questionCount} · {item.durationMinutes || "Unlimited"} min</span></button>; }) : <p className="p-4 text-sm text-[#657083]">No matching tests.</p>}</div></div></aside><article className="overflow-hidden rounded-lg border border-[#e4e7ee]"><header className="flex flex-wrap items-center justify-between gap-3 bg-[#f3f4ff] px-5 py-4"><h2 className="text-xl font-bold">{selected.title}</h2><div className="flex items-center gap-2"><button type="button" onClick={() => onInstructions(selected)} className="px-3 py-2 font-semibold text-[#3155ff]">View Instructions</button><button type="button" disabled={exhausted} onClick={() => onTakeTest(selected)} className="rounded-md bg-[#153998] px-4 py-2.5 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400">{attempts.length ? "Retake Test" : "Take Test"}</button></div></header><div className="flex items-center justify-between border-b border-[#e4e7ee]"><div className="flex"><span className="px-4 py-4 text-lg text-[#44506b]">Overview</span>{chosenAttempt?<span className="border-b-2 border-[#3155ff] bg-[#f1f3ff] px-4 py-4 text-lg font-semibold text-[#3155ff]">Attempt</span>:null}</div><div className="flex items-center gap-2 px-5 font-bold">{attempts.length?<select aria-label="Select attempt" value={chosenAttempt?.attemptNumber || ""} onChange={(event)=>setAttemptNumber(Number(event.target.value))} className="rounded-md border border-[#d7dce6] bg-white px-3 py-2 font-medium">{attempts.map((item)=><option key={item.attemptNumber} value={item.attemptNumber}>Attempt: {String(item.attemptNumber).padStart(2,"0")}</option>)}</select>:<span>Attempt: 00</span>}<span>of {String(selected.maxAttempts || 1).padStart(2,"0")}</span></div></div>{chosenAttempt?<div className="p-5 sm:p-8"><div className="mx-auto flex max-w-lg flex-wrap justify-center divide-x rounded-md border bg-[#f8f9fc] px-4 py-3 text-center"><span className="px-5">Time Spent <strong className="ml-2">{formatDuration(chosenAttempt.durationSeconds)}</strong></span><span className="px-5">Test Score <strong className="ml-2">{chosenAttempt.score.toFixed(0)} / 100</strong></span></div><div className="mt-6 overflow-x-auto rounded-lg border border-[#dfe4f2]"><table className="w-full min-w-[650px] text-left"><thead className="bg-[#e8ebff]"><tr><th className="p-4">Sections</th><th className="p-4">Score</th><th className="p-4">Average Score</th><th className="p-4">Top Score</th><th className="p-4">Least Score</th></tr></thead><tbody><tr><td className="p-4">{selected.title}</td><td className="p-4">{chosenAttempt.score.toFixed(2)}</td><td className="p-4">{average.toFixed(2)}</td><td className="p-4">{Math.max(...scores,chosenAttempt.score).toFixed(2)}</td><td className="p-4">{Math.min(...scores,chosenAttempt.score).toFixed(2)}</td></tr></tbody></table></div><p className="mt-7 text-center text-sm font-medium text-emerald-600">IP Address: {chosenAttempt.ipAddress || "Unavailable"} | Tab Switch: {chosenAttempt.tabSwitches ?? chosenAttempt.violations ?? 0} | Browser Used: {chosenAttempt.browser || "Unknown"}</p></div>:<div className="p-5"><p className="mb-6 text-center text-sm text-red-500">Start before the course end date</p><div className="overflow-x-auto rounded-lg border border-[#dfe4f2]"><table className="w-full min-w-[560px] text-left"><thead className="bg-[#e8ebff]"><tr><th className="p-4">SNo</th><th className="p-4">Name</th><th className="p-4">Questions</th><th className="p-4">Duration (Min)</th><th className="p-4">Marks</th></tr></thead><tbody><tr><td className="p-4">1</td><td className="p-4">{selected.title}</td><td className="p-4">{selected.questionCount}</td><td className="p-4">{selected.durationMinutes || "Unlimited"}</td><td className="p-4">100</td></tr></tbody></table></div></div>}</article></div></section>;
}
function formatDuration(seconds: number) { const safe=Math.max(0,Math.floor(seconds||0)); const hours=Math.floor(safe/3600); const minutes=Math.floor((safe%3600)/60); const secs=safe%60; return [hours,minutes,secs].map((part)=>String(part).padStart(2,"0")).join(":"); }
function ProgressRing({ value }: { value: number }) { const safe = Math.max(0, Math.min(100, value)); const radius = 18; const circumference = 2 * Math.PI * radius; return <span className="relative grid h-12 w-12 shrink-0 place-items-center"><svg className="absolute inset-0 -rotate-90" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="4" /><circle cx="24" cy="24" r={radius} fill="none" stroke="#3155ff" strokeWidth="4" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - safe / 100)} /></svg><span className="text-[11px] font-bold">{safe}%</span></span>; }
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

function CourseQuiz({ module, answers, onChoose, error, result, onSubmit, onClose }: { module?: CourseModule; answers: Record<string, string>; onChoose: (index: number, value: string) => void; error: string; result: { score: number; passed: boolean } | null; onSubmit: (metadata: { startedAt: string; tabSwitches: number; browser: string }) => void; onClose: () => void }) {
  const [current, setCurrent] = useState(0); const [bookmarked, setBookmarked] = useState<Set<number>>(() => new Set()); const [visited, setVisited] = useState<Set<number>>(() => new Set([0])); const startedAt = useRef(new Date().toISOString()); const tabSwitches = useRef(0); const questions = module?.generatedQuestions ?? []; const question = questions[current];
  const submit = () => onSubmit({ startedAt: startedAt.current, tabSwitches: tabSwitches.current, browser: detectClientEnvironment().browser });
  useEffect(() => { const block=(event:Event)=>event.preventDefault(); const keys=(event:KeyboardEvent)=>{if((event.ctrlKey||event.metaKey)&&["c","v","x","a"].includes(event.key.toLowerCase()))event.preventDefault();}; const hidden=()=>{if(document.hidden&&!result){tabSwitches.current+=1;onSubmit({ startedAt: startedAt.current, tabSwitches: tabSwitches.current, browser: detectClientEnvironment().browser });}}; document.addEventListener("copy",block);document.addEventListener("cut",block);document.addEventListener("paste",block);document.addEventListener("contextmenu",block);document.addEventListener("keydown",keys);document.addEventListener("visibilitychange",hidden);return()=>{document.removeEventListener("copy",block);document.removeEventListener("cut",block);document.removeEventListener("paste",block);document.removeEventListener("contextmenu",block);document.removeEventListener("keydown",keys);document.removeEventListener("visibilitychange",hidden);};},[onSubmit,result]);
  function go(index:number){const safe=Math.max(0,Math.min(questions.length-1,index));setCurrent(safe);setVisited((value)=>new Set(value).add(safe));} function toggle(){setBookmarked((value)=>{const next=new Set(value);if(next.has(current)) next.delete(current); else next.add(current); return next;});}
  if(result)return <section className="fixed inset-0 z-[90] grid place-items-center bg-[#f5f7fb] p-4"><div className="w-full max-w-xl rounded-xl bg-white p-8 text-center shadow"><h2 className="text-2xl font-bold">{result.passed?"Test passed":"Test not passed"}</h2><p className="mt-3">Score: {result.score}%. {result.passed?"The next module is now unlocked.":"You need 60% to unlock the next module."}</p><button onClick={onClose} className="mt-6 rounded bg-[#3155ff] px-5 py-3 font-bold text-white">Return to course</button></div></section>;
  if(!question)return null; const answered=Object.keys(answers).length;
  return <section className="fixed inset-0 z-[90] flex flex-col overflow-hidden bg-[#f4f6fa]"><div className="shrink-0 border-b border-emerald-200 bg-emerald-50 py-1.5 text-center text-sm font-semibold text-emerald-700">Internet Status: {navigator.onLine?"Online":"Offline"}</div><header className="flex shrink-0 flex-wrap items-center gap-4 border-b bg-white px-5 py-3"><h1 className="min-w-[220px] flex-1 font-bold">{module?.quiz||"Module Test"}</h1><select className="h-10 min-w-[250px] rounded border px-3"><option>Section 1/1 | Questions ({questions.length})</option></select><span className="text-sm">Question {current+1}/{questions.length}</span><button onClick={submit} className="rounded bg-[#153998] px-5 py-2.5 font-bold text-white">Submit Test</button></header><div className="grid min-h-0 flex-1 grid-cols-[150px_minmax(0,1fr)]"><aside className="flex min-h-0 flex-col border-r bg-white"><div className="grid grid-cols-2 gap-2 overflow-y-auto p-3">{questions.map((_,index)=><button key={index} onClick={()=>go(index)} className={`h-9 rounded border text-sm font-semibold ${current===index?"border-[#3155ff] bg-[#3155ff] text-white":answers[String(index)]?"border-emerald-300 bg-emerald-50 text-emerald-700":bookmarked.has(index)?"border-amber-300 bg-amber-50":"border-slate-200"}`}>{index+1}</button>)}</div><dl className="mt-auto space-y-2 border-t p-3 text-xs"><div className="flex justify-between"><dt>Answered</dt><dd>{answered}/{questions.length}</dd></div><div className="flex justify-between"><dt>Bookmarked</dt><dd>{bookmarked.size}/{questions.length}</dd></div><div className="flex justify-between"><dt>Skipped</dt><dd>{Math.max(0,visited.size-answered)}/{questions.length}</dd></div><div className="flex justify-between"><dt>Not Viewed</dt><dd>{Math.max(0,questions.length-visited.size)}/{questions.length}</dd></div><div className="flex justify-between"><dt>Saved in Server</dt><dd>{answered}/{questions.length}</dd></div></dl></aside><main className="grid min-h-0 grid-cols-1 lg:grid-cols-2"><section className="overflow-y-auto border-r bg-white p-6"><div className="flex items-center justify-between"><p className="font-bold">Question No: {current+1}/{questions.length}</p><button onClick={toggle} className={`grid h-10 w-10 place-items-center rounded border ${bookmarked.has(current)?"border-amber-400 bg-amber-50 text-amber-600":"border-slate-300"}`}><Bookmark size={19} fill={bookmarked.has(current)?"currentColor":"none"}/></button></div><h2 className="mt-8 text-xl font-bold">Multiple Choice Question</h2><p className="mt-5 whitespace-pre-wrap leading-7">{question.question}</p></section><section className="flex min-h-0 flex-col bg-white"><div className="border-b px-6 py-4 text-lg font-bold">Answer here</div><div className="flex-1 overflow-y-auto">{question.options?.map((option)=><label key={option} className="flex cursor-pointer items-center gap-4 border-b px-6 py-5 hover:bg-slate-50"><input type="radio" name={`q-${current}`} checked={answers[String(current)]===option} onChange={()=>onChoose(current,option)} className="h-5 w-5"/><span>{option}</span></label>)}</div>{error?<p className="px-6 font-semibold text-red-600">{error}</p>:null}<div className="flex justify-between border-t p-4"><button disabled={current===0} onClick={()=>go(current-1)} className="inline-flex items-center gap-2 rounded border px-4 py-2 disabled:opacity-40"><ChevronLeft size={17}/>Previous</button><button disabled={current===questions.length-1} onClick={()=>go(current+1)} className="inline-flex items-center gap-2 rounded bg-[#3155ff] px-4 py-2 text-white disabled:opacity-40">Next<ChevronRight size={17}/></button></div></section></main></div></section>;
}
function PlatformInstructions({ assessment, onClose }: { assessment: CourseAssessment; onClose: () => void }) {
  const items = ["Use a laptop or desktop; mobile devices are not recommended for coding tests.", "The test pauses after 60 seconds without internet.", "Use the latest version of Chrome, Edge, Firefox, Safari, or Opera.", "Enable third-party cookies and allow camera and microphone access.", "Maintain uninterrupted internet with at least 2 Mbps download and upload speed.", "Set the system clock to GMT +5:30 (Mumbai, Kolkata, Chennai, New Delhi).", "Do not change tabs or open notifications/pop-ups during the test.", "Copy, cut, paste, context menus, and browser navigation are disabled in secure test mode.", "Answers are saved when submitted. Type END when prompted to finish a full assessment."];
  return <section className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/55 p-4" role="dialog" aria-modal="true"><div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"><header className="flex shrink-0 items-center justify-between border-b p-5"><div><p className="text-sm font-bold text-[#3155ff]">{assessment.title}</p><h2 className="text-2xl font-bold">Platform Instructions</h2></div><button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full border" aria-label="Close"><X size={20} /></button></header><div className="overflow-y-auto p-6"><h3 className="text-lg font-bold">Please carefully read the following:</h3><ul className="mt-4 list-disc space-y-3 pl-6 text-[15px] leading-6 text-[#4d5360]">{items.map((item) => <li key={item} className="pl-1 marker:text-[#3155ff]">{item}</li>)}</ul><div className="mt-6 rounded-lg bg-amber-50 p-4 font-semibold text-amber-800">Leaving the test tab may automatically submit the current attempt.</div></div><footer className="flex shrink-0 justify-end border-t bg-white p-4"><button onClick={onClose} className="rounded-md bg-[#3155ff] px-5 py-2.5 font-bold text-white">Close</button></footer></div></section>;
}
function InstructionBlock({ title, children }: { title: string; children: ReactNode }) { return <section><h3 className="text-base font-bold text-[#07142f]">{title}</h3><div className="mt-2 space-y-2">{children}</div></section>; }
function AssessmentReadinessDialog({ assessment, onClose, onProceed }: { assessment: CourseAssessment; onClose: () => void; onProceed?: () => void }) {
  const [cameraChecked, setCameraChecked] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const environment = detectClientEnvironment();
  const fullscreenSupported = Boolean(document.fullscreenEnabled || (document as Document & { webkitFullscreenEnabled?: boolean }).webkitFullscreenEnabled);
  const mediaSupported = Boolean(navigator.mediaDevices?.getUserMedia);
  const checks = [
    { label: "Browser", detail: `${environment.browser} detected on ${environment.os}.`, passed: environment.supported },
    { label: "Secure connection", detail: window.isSecureContext || location.hostname === "localhost" ? "Secure browser features are available." : "Open this portal over HTTPS.", passed: window.isSecureContext || location.hostname === "localhost" },
    { label: "Internet connection", detail: navigator.onLine ? "Internet connection is online." : "Reconnect to the internet before starting.", passed: navigator.onLine },
    { label: "Desktop display", detail: window.innerWidth >= 768 ? "Laptop or desktop display detected." : "Use a laptop or desktop for this test.", passed: window.innerWidth >= 768 },
    { label: "Fullscreen", detail: fullscreenSupported ? "Fullscreen mode is supported." : "Fullscreen is unavailable or blocked.", passed: fullscreenSupported },
    { label: "Camera and microphone", detail: cameraChecked ? "Camera and microphone access verified." : cameraError || (mediaSupported ? "Permission has not been verified." : "Media access is unsupported."), passed: cameraChecked },
  ];
  const allPassed = checks.every((check) => check.passed);
  async function verifyCamera() {
    setCameraError("");
    if (!mediaSupported) { setCameraError("This browser does not provide camera access."); return; }
    try { const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); stream.getTracks().forEach((track) => track.stop()); setCameraChecked(true); }
    catch { setCameraChecked(false); setCameraError("Allow camera and microphone access in browser settings, then retry."); }
  }
  async function continueToTest() {
    if (!allPassed) return;
    window.sessionStorage.setItem(`cyber-academy-assessment-ready:${assessment.assignmentId}`, "1");
    const root = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
    try { if (!document.fullscreenElement) { if (root.requestFullscreen) await root.requestFullscreen(); else await root.webkitRequestFullscreen?.(); } } catch { return; }
    if (onProceed) { onClose(); onProceed(); return; }
    window.location.href = `/dashboard/student?section=assessments&assignment=${encodeURIComponent(assessment.assignmentId)}&preflight=1`;
  }
  return <section className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-label="Assessment readiness check"><div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl"><div className="flex items-start justify-between gap-4 border-b border-[#edf0f5] p-5 sm:p-6"><div><p className="text-sm font-bold text-[#3155ff]">Secure assessment check</p><h2 className="mt-1 text-2xl font-bold text-[#07142f]">Ready to take {assessment.title}?</h2><p className="mt-2 text-sm text-[#657083]">Complete every requirement before the secure test can begin.</p></div><button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full border border-[#dfe4f2] text-[#657083]" aria-label="Close readiness check"><X size={20} /></button></div><div className="space-y-3 p-5 sm:p-6">{checks.map((check) => <div key={check.label} className={`flex items-start gap-3 rounded-xl border p-4 ${check.passed ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}><span className={`mt-0.5 grid h-6 w-6 place-items-center rounded-full text-white ${check.passed ? "bg-emerald-500" : "bg-red-500"}`}>{check.passed ? "✓" : "!"}</span><div><p className={`font-bold ${check.passed ? "text-emerald-800" : "text-red-800"}`}>{check.label}</p><p className={`mt-1 text-sm ${check.passed ? "text-emerald-700" : "text-red-700"}`}>{check.detail}</p></div></div>)}</div><div className="flex flex-col-reverse gap-3 border-t border-[#edf0f5] p-5 sm:flex-row sm:justify-end"><button type="button" onClick={() => void verifyCamera()} className="rounded-lg border border-[#3155ff] px-4 py-2.5 font-semibold text-[#3155ff]">{cameraChecked ? "Camera verified" : "Verify camera"}</button><button type="button" disabled={!allPassed} onClick={continueToTest} className="rounded-lg bg-[#3155ff] px-5 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Agree &amp; Proceed</button></div></div></section>;
}
function detectClientEnvironment() {
  const agent = navigator.userAgent;
  const browser = /Edg\//i.test(agent) ? "Microsoft Edge" : /OPR\//i.test(agent) ? "Opera" : /Firefox\//i.test(agent) ? "Mozilla Firefox" : /CriOS|Chrome\//i.test(agent) ? "Google Chrome" : /FxiOS/i.test(agent) ? "Mozilla Firefox" : /Safari\//i.test(agent) ? "Apple Safari" : "Modern browser";
  const os = /Windows NT/i.test(agent) ? "Windows" : /Macintosh|Mac OS X/i.test(agent) ? "macOS" : /Android/i.test(agent) ? "Android" : /iPhone|iPad|iPod/i.test(agent) ? "iOS" : /Linux/i.test(agent) ? "Linux" : "your operating system";
  const supported = /Edg\/|OPR\/|Firefox\/|FxiOS|CriOS|Chrome\/|Safari\//i.test(agent) && typeof fetch !== "undefined";
  return { browser, os, supported };
}

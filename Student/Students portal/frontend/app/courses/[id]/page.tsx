"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, BookOpen, CheckCircle2, ClipboardCheck, ExternalLink, FileText, Lock, PlayCircle } from "lucide-react";

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

  if (error) {
    return <CourseMessage message={error} />;
  }
  if (!data) {
    return <CourseMessage message="Loading course content…" />;
  }

  const description = data.course.metadata?.description || data.course.heading || "Course content published by your administrator.";
  const completedModules = data.modules.filter((module) => module.completed).length;
  const courseProgress = data.modules.length ? Math.round((completedModules / data.modules.length) * 100) : 0;
  const activeModule = data.modules[Math.min(activeModuleIndex, Math.max(0, data.modules.length - 1))];
  const activeModulePosition = Math.min(activeModuleIndex, Math.max(0, data.modules.length - 1));

  async function markVideoComplete(moduleIndex: number) {
    const token = window.localStorage.getItem("cyber-academy-auth-token");
    if (!token) { setError("Please log in again to save your course progress."); return; }
    setCompleting(moduleIndex);
    try {
      const response = await fetch(`${apiBaseUrl}/api/courses/${encodeURIComponent(courseId)}/modules/video-complete`, {
        method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ module_index: moduleIndex }),
      });
      if (!response.ok) throw new Error("Course progress could not be saved.");
      const refreshed = await fetch(`${apiBaseUrl}/api/courses/${encodeURIComponent(courseId)}/content`, { cache: "no-store", headers: { Authorization: `Bearer ${token}` } });
      if (!refreshed.ok) throw new Error("Course content could not be refreshed.");
      setData(await refreshed.json() as CourseContent);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Course progress could not be saved."); }
    finally { setCompleting(null); }
  }

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

  return (
    <main className="min-h-screen bg-[#f6f8fc] px-4 py-8 text-[#07142f] sm:px-7">
      <div className="mx-auto max-w-6xl">
        <Link href="/dashboard/student?section=courses" className="inline-flex items-center gap-2 font-semibold text-[#3155ff]">
          <ArrowLeft size={18} /> Back to Courses
        </Link>

        <section className="mt-5 overflow-hidden rounded-2xl border border-[#dfe4f2] bg-white shadow-sm">
          {data.course.banner?.imageUrl ? (
            <img src={data.course.banner.imageUrl} alt="" className="h-56 w-full object-cover" />
          ) : null}
          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#3155ff]">
              <span>{data.course.category || "Course"}</span><span>•</span><span>{data.course.level || "All levels"}</span>
            </div>
            <h1 className="mt-3 text-3xl font-bold">{data.course.title}</h1>
            <p className="mt-4 max-w-4xl leading-7 text-[#657083]">{description}</p>
            <div className="mt-5 flex max-w-md items-center gap-3 text-sm"><span className="font-bold text-[#07142f]">Your progress</span><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e9edf5]"><div className="h-full rounded-full bg-[#3155ff] transition-all" style={{ width: `${courseProgress}%` }} /></div><span className="font-bold text-[#3155ff]">{courseProgress}%</span></div>
          </div>
        </section>

        <section className="mt-6 grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-[#dfe4f2] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-[#edf0f5] pb-4"><h2 className="flex items-center gap-2 text-lg font-bold"><BookOpen size={20} /> Course content</h2><span className="rounded-full bg-[#eef2ff] px-2.5 py-1 text-xs font-bold text-[#3155ff]">{completedModules}/{data.modules.length}</span></div>
            <div className="mt-3 space-y-2">{data.modules.map((module, moduleIndex) => <button key={`${module.title}-${moduleIndex}`} type="button" disabled={!module.accessible} onClick={() => setActiveModuleIndex(moduleIndex)} className={`w-full rounded-xl border p-3 text-left transition ${activeModulePosition === moduleIndex ? "border-[#3155ff] bg-[#eef2ff]" : "border-transparent hover:bg-[#f6f8fc]"} ${!module.accessible ? "cursor-not-allowed opacity-55" : ""}`}><div className="flex items-start gap-3"><span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${module.completed ? "bg-emerald-500 text-white" : module.accessible ? "bg-[#3155ff] text-white" : "bg-slate-200 text-slate-600"}`}>{module.completed ? <CheckCircle2 size={14} /> : module.accessible ? moduleIndex + 1 : <Lock size={13} />}</span><span className="min-w-0"><span className="block truncate text-sm font-bold text-[#07142f]">{module.title || `Module ${moduleIndex + 1}`}</span><span className="mt-1 block text-xs text-[#657083]">{module.completed ? "Completed" : module.accessible ? "Available" : "Locked"}</span></span></div></button>)}</div>
          </aside>
          <article className="min-w-0 rounded-2xl border border-[#dfe4f2] bg-white p-5 shadow-sm sm:p-7">
            {activeModule ? <><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-bold text-[#3155ff]">Module {activeModulePosition + 1} of {data.modules.length}</p><h2 className="mt-1 text-2xl font-bold">{activeModule.title || `Module ${activeModulePosition + 1}`}</h2></div>{activeModule.completed ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700"><CheckCircle2 size={14} /> Completed</span> : <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">In progress</span>}</div>
              {activeModule.imageUrl ? <img src={activeModule.imageUrl} alt="" className="mt-6 max-h-80 w-full rounded-xl object-cover" /> : null}
              <div className="mt-6 grid gap-3 sm:grid-cols-3"><ProgressTile label="Learning content" complete={Boolean(activeModule.videoCompleted)} /><ProgressTile label="Module quiz" complete={Boolean(activeModule.quizPassed)} optional={!activeModule.generatedQuestions?.length} /><ProgressTile label="Module" complete={Boolean(activeModule.completed)} /></div>
              {activeModule.resources?.length ? <div className="mt-7 border-t border-[#edf0f5] pt-5"><h3 className="flex items-center gap-2 font-bold"><FileText size={18} /> Learning resources</h3><div className="mt-3 flex flex-wrap gap-2">{activeModule.resources.map((resource) => isUrl(resource) ? <a key={resource} href={resource} target="_blank" rel="noreferrer" download={resource.startsWith("data:")} className="inline-flex items-center gap-2 rounded-lg bg-[#eef2ff] px-3 py-2 text-sm font-semibold text-[#3155ff]">Open resource <ExternalLink size={14} /></a> : <span key={resource} className="rounded-lg bg-[#f2f4f8] px-3 py-2 text-sm font-semibold">{resource}</span>)}</div></div> : <p className="mt-7 rounded-xl bg-[#f8fafc] p-4 text-sm text-[#657083]">Your administrator has not added downloadable learning resources for this module.</p>}
              {!activeModule.videoCompleted && !activeModule.completed ? <button type="button" disabled={completing === activeModulePosition} onClick={() => void markVideoComplete(activeModulePosition)} className="mt-6 rounded-lg border border-[#3155ff] px-4 py-2.5 font-semibold text-[#3155ff] disabled:opacity-50">{completing === activeModulePosition ? "Saving…" : "Mark module content as completed"}</button> : null}
              {activeModule.generatedQuestions?.length ? <div className="mt-7 border-t border-[#edf0f5] pt-5"><h3 className="flex items-center gap-2 font-bold"><ClipboardCheck size={18} /> {activeModule.quiz || "Module quiz"}</h3><p className="mt-2 text-sm text-[#657083]">Complete this quiz to unlock the next module. A score of at least 60% is required.</p><button type="button" disabled={!activeModule.videoCompleted && !activeModule.completed} onClick={() => startModuleQuiz(activeModulePosition)} className="mt-4 rounded-lg bg-[#3155ff] px-4 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{activeModule.quizPassed ? "Review quiz" : "Start module quiz"}</button></div> : null}
            </> : <EmptyState message="No modules have been published for this course yet." />}
          </article>
        </section>
        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-2xl font-bold"><ClipboardCheck size={24} /> Assessments</h2>
          {data.assessments.length ? (
            <div className="mt-4 grid gap-5">
              {data.assessments.map((assessment) => (
                <article key={assessment.assignmentId} className="rounded-2xl border border-[#dfe4f2] bg-white p-6 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-bold">{assessment.title}</h3>
                      <p className="mt-1 text-sm text-[#657083]">{assessment.durationMinutes} minutes · {assessment.maxAttempts} attempts · {assessment.questionCount} questions</p>
                    </div>
                    <Link
                      href={`/dashboard/student?section=assessments&assignment=${encodeURIComponent(assessment.assignmentId)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg bg-[#3155ff] px-4 py-2.5 font-semibold text-white"
                    >
                      Open assessment
                    </Link>
                  </div>
                  <div className="mt-4 rounded-xl border border-[#dfe4f2] bg-[#f9fafc] px-4 py-3 text-sm text-[#657083]">
                    Questions are protected and will appear only after you accept the rules and begin the test.
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState message="No assessments have been published for this course yet." />
          )}
        </section>

        {activeQuizIndex !== null ? <CourseQuiz module={data.modules[activeQuizIndex]} answers={quizAnswers} onChoose={(index, value) => setQuizAnswers((current) => ({ ...current, [String(index)]: value }))} error={quizError} result={quizResult} onSubmit={() => void submitModuleQuiz()} onClose={() => setActiveQuizIndex(null)} /> : null}
      </div>
    </main>
  );
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

function isUrl(value: string) {
  return /^https?:\/\//i.test(value) || value.startsWith("data:");
}

function youtubeEmbedUrl(value: string) {
  try {
    const url = new URL(value);
    const id = url.hostname.includes("youtu.be") ? url.pathname.slice(1) : url.searchParams.get("v");
    return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : value;
  } catch {
    return value;
  }
}

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
  imageUrl?: string;
  resources?: string[];
  quiz?: string;
  locked?: boolean;
  unlockRule?: string;
  generatedQuestions?: ModuleQuestion[];
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

  useEffect(() => {
    void params.then(({ id }) => setCourseId(id));
  }, [params]);

  useEffect(() => {
    if (!courseId) return;
    fetch(`${apiBaseUrl}/api/courses/${encodeURIComponent(courseId)}/content`, { cache: "no-store" })
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
          </div>
        </section>

        <section className="mt-7">
          <h2 className="flex items-center gap-2 text-2xl font-bold"><BookOpen size={24} /> Course modules</h2>
          {data.modules.length ? (
            <div className="mt-4 grid gap-5">
              {data.modules.map((module, moduleIndex) => (
                <article key={`${module.title}-${moduleIndex}`} className="rounded-2xl border border-[#dfe4f2] bg-white p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-[#3155ff]">Module {moduleIndex + 1}</p>
                      <h3 className="mt-1 text-xl font-bold">{module.title || `Module ${moduleIndex + 1}`}</h3>
                    </div>
                    {module.locked ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700"><Lock size={13} /> Sequenced</span> : null}
                  </div>

                  {module.imageUrl ? <img src={module.imageUrl} alt="" className="mt-5 max-h-80 w-full rounded-xl object-cover" /> : null}

                  <div className="mt-5 flex flex-wrap gap-3">
                    {module.videoUrl ? (
                      <a href={module.videoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-[#3155ff] px-4 py-2.5 font-semibold text-white">
                        <PlayCircle size={18} /> Open teaching video <ExternalLink size={15} />
                      </a>
                    ) : module.uploadedVideoName ? (
                      <span className="inline-flex items-center gap-2 rounded-lg bg-[#eef2ff] px-4 py-2.5 font-semibold text-[#3155ff]"><PlayCircle size={18} /> {module.uploadedVideoName}</span>
                    ) : null}
                  </div>

                  {module.resources?.length ? (
                    <div className="mt-5">
                      <h4 className="flex items-center gap-2 font-bold"><FileText size={17} /> Resources</h4>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {module.resources.map((resource) => <span key={resource} className="rounded-full bg-[#f2f4f8] px-3 py-1.5 text-sm font-semibold">{resource}</span>)}
                      </div>
                    </div>
                  ) : null}

                  {module.generatedQuestions?.length ? (
                    <div className="mt-6 border-t border-[#edf0f5] pt-5">
                      <h4 className="flex items-center gap-2 font-bold"><ClipboardCheck size={18} /> {module.quiz || "Module quiz"}</h4>
                      <p className="mt-2 text-sm text-[#657083]">
                        {module.generatedQuestions.length} questions. Questions stay hidden until you begin the secure assessment.
                      </p>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <EmptyState message="No modules have been published for this course yet." />
          )}
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
      </div>
    </main>
  );
}

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

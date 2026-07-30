"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CourseAssessment,
  CourseAssessmentSubmission,
  fallbackCourseAssessments,
  gradeCourseAssessment,
  loadCourseAssessments,
  saveCourseSubmission
} from "@/lib/course-assessment-flow";
import { getStudentCourseAssessments, saveStudentCourseSubmission } from "@/lib/admin-api";
import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardList, Eye, PartyPopper, ShieldCheck, Trophy, XCircle } from "lucide-react";

const paperPieces = Array.from({ length: 18 }, (_, index) => index);

export function StudentCourseAssessment({ courseId }: { courseId: string }) {
  const [assessments, setAssessments] = useState<CourseAssessment[]>(fallbackCourseAssessments);
  const [assessmentId, setAssessmentId] = useState(fallbackCourseAssessments[0].id);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [activeIndex, setActiveIndex] = useState(0);
  const [result, setResult] = useState<CourseAssessmentSubmission | null>(null);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [safeModeNotice, setSafeModeNotice] = useState("Safe mode active. Stay on this tab until submission.");
  const [watchedLesson, setWatchedLesson] = useState(false);

  useEffect(() => {
    const loaded = loadCourseAssessments(courseId);
    setAssessments(loaded);
    setAssessmentId(loaded[0]?.id ?? fallbackCourseAssessments[0].id);
    getStudentCourseAssessments<CourseAssessment[]>(courseId).then((dbAssessments) => {
      if (!dbAssessments?.length) return;
      setAssessments(dbAssessments);
      setAssessmentId(dbAssessments[0].id);
    });
  }, [courseId]);

  useEffect(() => {
    if (result) return;
    function recordViolation(reason: string) {
      setTabSwitches((current) => {
        const next = current + 1;
        setSafeModeNotice(`${reason}. Warning ${next}/3 recorded.`);
        return next;
      });
    }
    function onVisibilityChange() {
      if (document.hidden) recordViolation("Tab switching detected");
    }
    function onWindowBlur() {
      recordViolation("Assessment window lost focus");
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onWindowBlur);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onWindowBlur);
    };
  }, [result]);

  const assessment = useMemo(
    () => assessments.find((item) => item.id === assessmentId) ?? assessments[0] ?? fallbackCourseAssessments[0],
    [assessmentId, assessments]
  );
  const activeQuestion = assessment.questions[activeIndex];
  const totalMarks = assessment.questions.reduce((sum, question) => sum + question.marks, 0);

  function submitAssessment() {
    if (!watchedLesson) return;
    const graded = gradeCourseAssessment(assessment, answers);
    const submission = tabSwitches >= 3
      ? { ...graded, score: 0, percent: 0, status: "Failed" as const }
      : graded;
    saveCourseSubmission(submission, courseId);
    void saveStudentCourseSubmission(courseId, submission);
    setResult(submission);
  }

  function restart() {
    setAnswers({});
    setActiveIndex(0);
    setResult(null);
    setTabSwitches(0);
    setWatchedLesson(false);
    setSafeModeNotice("Safe mode active. Stay on this tab until submission.");
  }

  if (result) {
    const passed = result.status === "Passed";
    const resultAssessment = assessments.find((item) => item.id === result.assessmentId) ?? assessment;
    return (
      <div className="relative overflow-hidden rounded-lg border border-portal-line bg-white p-8 shadow-sm">
        {passed
          ? paperPieces.map((piece) => (
              <span
                key={piece}
                className="course-confetti absolute h-3 w-2 rounded-sm"
                style={{
                  left: `${8 + piece * 5}%`,
                  top: "-16px",
                  animationDelay: `${piece * 80}ms`,
                  backgroundColor: ["#3455ff", "#10b981", "#f59e0b", "#ef4444"][piece % 4]
                }}
              />
            ))
          : null}

        <div className="mx-auto max-w-2xl text-center">
          <div
            className={`mx-auto grid h-20 w-20 place-items-center rounded-full ${
              passed ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
            }`}
          >
            {passed ? <PartyPopper size={36} /> : <ClipboardList size={36} />}
          </div>
          <h1 className="mt-5 text-3xl font-bold text-slate-950">
            {passed ? "Yay, you passed!" : "Keep learning, try again"}
          </h1>
          <p className="mt-2 text-slate-600">
            {passed
              ? `You crossed the ${result.passPercent}% pass mark. Your next module is unlocked after this passing score.`
              : "You need the passing score before the next locked module opens."}
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-md bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-500">Marks</p>
              <p className="mt-1 text-2xl font-bold text-slate-950">
                {result.score}/{result.totalMarks}
              </p>
            </div>
            <div className="rounded-md bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-500">Score</p>
              <p className="mt-1 text-2xl font-bold text-slate-950">{result.percent}%</p>
            </div>
            <div className="rounded-md bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-500">Pass Mark</p>
              <p className="mt-1 text-2xl font-bold text-slate-950">{result.passPercent}%</p>
            </div>
          </div>

          <div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all duration-700 ${passed ? "bg-emerald-500" : "bg-red-500"}`}
              style={{ width: `${Math.min(result.percent, 100)}%` }}
            />
          </div>

          <div className="mt-6 rounded-lg border border-portal-line text-left">
            <div className="border-b border-portal-line px-4 py-3">
              <p className="font-bold text-slate-950">Answer Review</p>
              <p className="text-xs text-slate-500">Students can see the correct answers after submission.</p>
            </div>
            <div className="divide-y divide-portal-line">
              {result.answers.map((answer, index) => {
                const question = resultAssessment.questions.find((item) => item.id === answer.questionId);
                return (
                  <div key={answer.questionId} className="p-4">
                    <div className="flex items-start gap-3">
                      {answer.correct ? <CheckCircle2 className="mt-1 text-emerald-600" size={18} /> : <XCircle className="mt-1 text-red-500" size={18} />}
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-900">Q{index + 1}. {question?.text ?? answer.questionId}</p>
                        <p className="mt-2 text-sm text-slate-600">Your answer: <span className="font-semibold text-slate-950">{answer.answer || "Not answered"}</span></p>
                        <p className="mt-1 text-sm text-slate-600">Correct answer: <span className="font-semibold text-emerald-700">{question?.answer ?? "-"}</span></p>
                        <p className="mt-1 text-xs font-bold text-slate-500">{answer.awardedMarks}/{answer.maxMarks} marks</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={restart}
              className="h-11 rounded-md border border-portal-line px-5 text-sm font-bold text-slate-700"
            >
              Retake Assessment
            </button>
            <button className="flex h-11 items-center gap-2 rounded-md bg-portal-blue px-5 text-sm font-bold text-white">
              Continue Learning
              <ArrowRight size={17} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[280px_1fr] xl:gap-5">
      <div className="rounded-lg border border-portal-line bg-white p-4">
        <h2 className="font-bold text-slate-950">Course Assessments</h2>
        <div className={`mt-3 rounded-md p-3 text-xs font-bold ${tabSwitches >= 3 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"}`}>
          <span className="flex items-center gap-2">
            {tabSwitches >= 3 ? <AlertTriangle size={15} /> : <ShieldCheck size={15} />}
            {safeModeNotice}
          </span>
        </div>
        <div className="mt-4 space-y-3">
          {assessments.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setAssessmentId(item.id);
                setActiveIndex(0);
                setAnswers({});
                setWatchedLesson(false);
              }}
              className={`w-full rounded-md border p-3 text-left text-sm ${
                assessment.id === item.id ? "border-portal-blue bg-blue-50" : "border-portal-line"
              }`}
            >
              <p className="font-bold text-slate-950">{item.title}</p>
              <p className="mt-1 text-xs text-slate-500">{item.module}</p>
              <p className="mt-2 text-xs font-bold text-portal-blue">Pass: {item.passPercent}%</p>
            </button>
          ))}
        </div>
      </div>

      <div className="min-w-0 rounded-lg border border-portal-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-portal-line p-5">
          <div>
            <h1 className="text-xl font-bold text-slate-950">{assessment.title}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {assessment.module} / {assessment.questions.length} questions / {totalMarks} marks / pass {assessment.passPercent}%
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-full bg-blue-50 px-3 py-2 text-sm font-bold text-portal-blue">
              <Trophy size={16} />
              Unlock gate
            </div>
            <div className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold ${tabSwitches >= 3 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"}`}>
              <ShieldCheck size={16} />
              Safe mode {tabSwitches}/3
            </div>
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[220px_1fr]">
          <div className="border-b border-portal-line p-4 lg:border-b-0 lg:border-r">
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-7 lg:grid-cols-3">
              {assessment.questions.map((question, index) => (
                <button
                  key={question.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`grid h-10 place-items-center rounded-md border text-sm font-bold ${
                    activeIndex === index
                      ? "border-portal-blue bg-portal-blue text-white"
                      : answers[question.id]
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-portal-line text-slate-600"
                  }`}
                >
                  {index + 1}
                </button>
              ))}
            </div>
          </div>

          <div className="min-w-0 p-4 sm:p-5">
            <label className="mb-5 flex cursor-pointer items-start gap-3 rounded-md border border-blue-100 bg-blue-50 p-3 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={watchedLesson}
                onChange={(event) => setWatchedLesson(event.target.checked)}
                className="mt-1 h-4 w-4 accent-portal-blue"
              />
              <span>
                <span className="flex items-center gap-2 font-bold text-portal-blue"><Eye size={16} /> I have watched the lesson video and reviewed module resources.</span>
                <span className="mt-1 block text-xs font-medium text-slate-500">This unlock gate must be checked before submitting the course assessment.</span>
              </span>
            </label>

            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-bold text-slate-500">
                Question {activeIndex + 1} of {assessment.questions.length}
              </p>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                {activeQuestion.marks} marks
              </span>
            </div>

            <p className="break-words text-base font-bold leading-7 text-slate-950 sm:text-lg">{activeQuestion.text}</p>
            {activeQuestion.diagramUrl ? (
              <img src={activeQuestion.diagramUrl} alt="Question diagram" className="mt-4 max-h-64 rounded-md border border-portal-line object-contain" />
            ) : null}

            <div className="mt-5 grid gap-3">
              {activeQuestion.type === "MCQ" ? (
                activeQuestion.options.map((option) => (
                  <label
                    key={option}
                    className={`flex cursor-pointer items-center gap-3 rounded-md border p-4 text-sm font-semibold ${
                      answers[activeQuestion.id] === option ? "border-portal-blue bg-blue-50" : "border-portal-line"
                    }`}
                  >
                    <input
                      type="radio"
                      name={activeQuestion.id}
                      checked={answers[activeQuestion.id] === option}
                      onChange={() => setAnswers((current) => ({ ...current, [activeQuestion.id]: option }))}
                      className="h-4 w-4 accent-portal-blue"
                    />
                    {option}
                  </label>
                ))
              ) : (
                <textarea
                  value={answers[activeQuestion.id] ?? ""}
                  onChange={(event) => setAnswers((current) => ({ ...current, [activeQuestion.id]: event.target.value }))}
                  className="min-h-36 rounded-md border border-portal-line p-4 outline-none focus:border-portal-blue"
                  placeholder="Type your answer here"
                />
              )}
            </div>

            <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap sm:justify-between">
              <button
                type="button"
                onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}
                className="h-11 rounded-md border border-portal-line px-5 text-sm font-bold text-slate-700"
              >
                Previous
              </button>
              {activeIndex === assessment.questions.length - 1 ? (
                <button
                  type="button"
                  onClick={submitAssessment}
                  disabled={!watchedLesson}
                  className={`flex h-11 items-center gap-2 rounded-md px-5 text-sm font-bold ${
                    watchedLesson ? "bg-portal-blue text-white" : "cursor-not-allowed bg-slate-200 text-slate-500"
                  }`}
                >
                  <CheckCircle2 size={17} />
                  Submit Assessment
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveIndex((index) => Math.min(assessment.questions.length - 1, index + 1))}
                  className="h-11 rounded-md bg-portal-blue px-5 text-sm font-bold text-white"
                >
                  Next
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

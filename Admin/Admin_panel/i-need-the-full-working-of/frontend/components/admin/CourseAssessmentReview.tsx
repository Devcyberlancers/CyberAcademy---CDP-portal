"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CourseAssessment,
  CourseAssessmentSubmission,
  fallbackCourseAssessments,
  loadCourseAssessments,
  loadCourseSubmissions
} from "@/lib/course-assessment-flow";
import { getAdminSnapshot, getStudentAssessmentAttempt, listStudentAssessmentAttempts } from "@/lib/admin-api";
import { CheckCircle2, Eye, FileCheck2, XCircle } from "lucide-react";

export function CourseAssessmentReview({ courseId }: { courseId: string }) {
  const [submissions, setSubmissions] = useState<CourseAssessmentSubmission[]>([]);
  const [assessments, setAssessments] = useState<CourseAssessment[]>(fallbackCourseAssessments);
  const [selectedId, setSelectedId] = useState<string>("");

  async function loadDatabaseSubmissions() {
    const result = await listStudentAssessmentAttempts("all");
    const courseAttempts = result.items.filter((item) => item.assignmentId.startsWith(`course:${courseId}:`));
    const details = await Promise.all(courseAttempts.map((item) => getStudentAssessmentAttempt(item.attemptId)));
    const mapped: CourseAssessmentSubmission[] = details.map((attempt) => ({
      id: String(attempt.attemptId),
      studentName: attempt.studentEmail,
      registrationNumber: attempt.studentId ? `Student #${attempt.studentId}` : "",
      assessmentId: attempt.assignmentId.split(":").at(-1) || attempt.assignmentId,
      assessmentTitle: attempt.assignmentTitle || attempt.assignmentId,
      module: "",
      submittedAt: attempt.endedAt || attempt.startedAt,
      score: attempt.score,
      totalMarks: 100,
      percent: attempt.score,
      passPercent: 60,
      status: attempt.score >= 60 ? "Passed" : "Failed",
      answers: attempt.answers.map((answer) => ({
        questionId: answer.questionId,
        answer: answer.selectedAnswer || "",
        awardedMarks: answer.isCorrect ? 1 : 0,
        maxMarks: 1,
        correct: answer.isCorrect,
      })),
    }));
    setSubmissions(mapped);
    setSelectedId(mapped[0]?.id ?? "");
  }

  useEffect(() => {
    const loadedSubmissions = loadCourseSubmissions(courseId);
    setSubmissions(loadedSubmissions);
    setAssessments(loadCourseAssessments(courseId));
    setSelectedId(loadedSubmissions[0]?.id ?? "");
    getAdminSnapshot<CourseAssessmentSubmission[]>(`course-assessment-submissions-${courseId}-v1`).then((snapshot) => {
      if (!snapshot?.length) return;
      setSubmissions(snapshot);
      setSelectedId(snapshot[0].id);
    });
    void loadDatabaseSubmissions().catch(() => undefined);
  }, [courseId]);

  const selected = submissions.find((submission) => submission.id === selectedId);
  const selectedAssessment = useMemo(
    () => assessments.find((assessment) => assessment.id === selected?.assessmentId),
    [assessments, selected]
  );

  return (
    <div className="rounded-lg border border-portal-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-portal-line p-4">
        <div>
          <h3 className="flex items-center gap-2 font-bold text-slate-950">
            <FileCheck2 size={18} className="text-portal-blue" />
            Admin Answer Review
          </h3>
          <p className="mt-1 text-sm text-slate-500">Review student answers, marks, pass status, and unlock decision.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            const loaded = loadCourseSubmissions(courseId);
            setSubmissions(loaded);
            setAssessments(loadCourseAssessments(courseId));
            setSelectedId(loaded[0]?.id ?? "");
            getAdminSnapshot<CourseAssessmentSubmission[]>(`course-assessment-submissions-${courseId}-v1`).then((snapshot) => {
              if (!snapshot?.length) return;
              setSubmissions(snapshot);
              setSelectedId(snapshot[0].id);
            });
            void loadDatabaseSubmissions().catch(() => undefined);
          }}
          className="h-10 rounded-md border border-portal-line px-4 text-sm font-bold text-portal-blue"
        >
          Refresh Answers
        </button>
      </div>

      {submissions.length === 0 ? (
        <div className="p-5 text-sm text-slate-600">
          No submissions yet. Open the student preview, submit an assessment, then refresh this panel.
        </div>
      ) : (
        <div className="grid gap-0 lg:grid-cols-[280px_1fr]">
          <div className="border-r border-portal-line p-4">
            <div className="space-y-3">
              {submissions.map((submission) => (
                <button
                  key={submission.id}
                  type="button"
                  onClick={() => setSelectedId(submission.id)}
                  className={`w-full rounded-md border p-3 text-left text-sm ${
                    selected?.id === submission.id ? "border-portal-blue bg-blue-50" : "border-portal-line"
                  }`}
                >
                  <p className="font-bold text-slate-950">{submission.studentName}</p>
                  <p className="mt-1 text-xs text-slate-500">{submission.assessmentTitle}</p>
                  <span
                    className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs font-bold ${
                      submission.status === "Passed" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                    }`}
                  >
                    {submission.percent}% - {submission.status}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {selected ? (
            <div className="p-4">
              <div className="mb-4 grid gap-3 rounded-md bg-slate-50 p-4 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-slate-500">Student</p>
                  <p className="font-bold text-slate-950">{selected.studentName}</p>
                </div>
                <div>
                  <p className="text-slate-500">Score</p>
                  <p className="font-bold text-slate-950">
                    {selected.score}/{selected.totalMarks} ({selected.percent}%)
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Pass Mark</p>
                  <p className="font-bold text-slate-950">{selected.passPercent}%</p>
                </div>
                <div>
                  <p className="text-slate-500">Unlock</p>
                  <p className={`font-bold ${selected.status === "Passed" ? "text-emerald-700" : "text-red-700"}`}>
                    {selected.status === "Passed" ? "Next module opens" : "Keep locked"}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {selected.answers.map((answer, index) => {
                  const question = selectedAssessment?.questions.find((item) => item.id === answer.questionId);
                  return (
                    <div key={answer.questionId} className="rounded-md border border-portal-line p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-slate-950">Question {index + 1}</p>
                          <p className="mt-1 text-sm text-slate-700">{question?.text ?? "Question text unavailable"}</p>
                        </div>
                        <span
                          className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
                            answer.correct ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                          }`}
                        >
                          {answer.correct ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                          {answer.awardedMarks}/{answer.maxMarks}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                        <div className="rounded-md bg-slate-50 p-3">
                          <p className="font-bold text-slate-600">Student Answer</p>
                          <p className="mt-1 text-slate-900">{answer.answer || "Not answered"}</p>
                        </div>
                        <div className="rounded-md bg-blue-50 p-3">
                          <p className="font-bold text-slate-600">Expected Answer</p>
                          <p className="mt-1 text-slate-900">{question?.answer ?? "-"}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button className="mt-4 flex h-10 items-center gap-2 rounded-md border border-portal-line px-4 text-sm font-bold text-portal-blue">
                <Eye size={17} />
                Open Full Submission
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

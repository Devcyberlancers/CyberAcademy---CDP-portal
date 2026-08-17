"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { SectionCard } from "@/components/admin/SectionCard";
import { getAdminSnapshot, getStandaloneAssessments, getStudentAssessmentAttempt, listStudentAssessmentAttempts, saveAdminSnapshot, saveStandaloneAssessments } from "@/lib/admin-api";
import { loadCourseCatalog } from "@/lib/course-catalog";
import { downloadCsv, downloadPdf, type ReportRow } from "@/lib/report-download";
import { AlertTriangle, CheckCircle2, ClipboardList, Download, FileCheck2, FileText, ImagePlus, Plus, RefreshCw, Save, Search, Send, ShieldCheck, Trash2, Users, X, XCircle } from "lucide-react";

type QuestionType = "MCQ" | "Coding" | "Descriptive";

type AssessmentQuestion = {
  id: string;
  title: string;
  text: string;
  type: QuestionType;
  section: string;
  marks: number;
  options: string[];
  correctAnswer: string;
  explanation: string;
  diagramUrl?: string;
  diagramName?: string;
};

type StandaloneAssessment = {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  maxAttempts: number;
  passPercent: number;
  sections: string;
  safeMode: true;
  cameraRequired: boolean;
  questions: AssessmentQuestion[];
};

type StandaloneAnswer = {
  questionId: string;
  question: string;
  answer: string;
  expectedAnswer: string;
  awardedMarks: number;
  maxMarks: number;
  correct: boolean;
};

type StandaloneSubmission = {
  id: string;
  studentName: string;
  registrationNumber: string;
  courseTitle: string;
  assessmentId: string;
  assessmentTitle: string;
  attemptNumber: number;
  submittedAt: string;
  score: number;
  totalMarks: number;
  percent: number;
  status: "Passed" | "Failed" | "Needs Review";
  tabSwitches: number;
  focusLosses: number;
  copyPasteAttempts: number;
  browser: string;
  ipAddress: string;
  proctoringStatus: "Clean" | "Warning" | "Flagged";
  proctoringEvents?: Array<{ eventType: string; reason: string; createdAt: string }>;
  answers: StandaloneAnswer[];
};

const standaloneDraftStorageKey = "admin-standalone-assessments-draft-v1";

const assessmentsStorageKey = "standalone-assessments-v4";
const submissionsStorageKey = "standalone-assessment-submissions-v1";

function makeQuestion(index: number): AssessmentQuestion {
  return {
    id: `Q-${Date.now()}-${index}`,
    title: "",
    text: "",
    type: "MCQ",
    section: "",
    marks: 1,
    options: ["", "", "", ""],
    correctAnswer: "",
    explanation: ""
  };
}

const seedAssessments: StandaloneAssessment[] = [
  {
    id: "ASM-001",
    title: "TCS NQT Mock Set 4",
    description: "Company-style aptitude, logical reasoning, and coding assessment.",
    durationMinutes: 90,
    maxAttempts: 1,
    passPercent: 60,
    sections: "Aptitude + Logical Reasoning + Coding",
    safeMode: true,
    cameraRequired: true,
    questions: [
      { id: "Q1", title: "Percentage", text: "A candidate scores 72 marks out of 90. What percentage did the candidate score?", type: "MCQ", section: "Quantitative Aptitude", marks: 2, options: ["70%", "75%", "80%", "90%"], correctAnswer: "80%", explanation: "(72 / 90) × 100 = 80%." },
      { id: "Q2", title: "Ratio", text: "The ratio of boys to girls in a class is 3:5. If there are 40 students, how many are girls?", type: "MCQ", section: "Quantitative Aptitude", marks: 2, options: ["15", "20", "25", "30"], correctAnswer: "25", explanation: "There are 8 total parts; each part is 5 students, so girls = 5 × 5 = 25." },
      { id: "Q3", title: "Average", text: "Find the average of 12, 15, 18, 21 and 24.", type: "MCQ", section: "Quantitative Aptitude", marks: 2, options: ["16", "17", "18", "19"], correctAnswer: "18", explanation: "The sum is 90 and 90 ÷ 5 = 18." },
      { id: "Q4", title: "Number Series", text: "Choose the next number in the series: 3, 8, 15, 24, 35, __.", type: "MCQ", section: "Logical Reasoning", marks: 2, options: ["42", "46", "48", "50"], correctAnswer: "48", explanation: "The differences are +5, +7, +9, +11; the next difference is +13." },
      { id: "Q5", title: "Direction Sense", text: "Priya walks 4 km north, then 3 km east, and then 4 km south. Where is she from her starting point?", type: "MCQ", section: "Logical Reasoning", marks: 2, options: ["3 km east", "3 km west", "4 km north", "4 km south"], correctAnswer: "3 km east", explanation: "The north and south movements cancel, leaving 3 km east." },
      { id: "Q6", title: "Statement Logic", text: "All programmers are problem solvers. Some problem solvers are designers. Which conclusion definitely follows?", type: "MCQ", section: "Logical Reasoning", marks: 2, options: ["All programmers are problem solvers", "All designers are programmers", "Some programmers are designers", "No designer is a programmer"], correctAnswer: "All programmers are problem solvers", explanation: "Only the first statement is guaranteed by the given information." },
      { id: "Q7", title: "String Reversal", text: "Write a program that reads a string and prints its reverse. For example, input `codex` should produce `xedoc`.", type: "Coding", section: "Programming", marks: 10, options: [], correctAnswer: "Reverse the input string and print the reversed value", explanation: "Evaluate for correct reversal, handling of empty input, and clear output." },
      { id: "Q8", title: "Array Maximum", text: "Write a program that reads N integers and prints the largest value. State the time complexity of your approach.", type: "Coding", section: "Programming", marks: 10, options: [], correctAnswer: "Traverse the array once while tracking the maximum; O(n) time", explanation: "A single pass is sufficient. Initialize from the first element or use a safe minimum value." },
      { id: "Q9", title: "OOP Basics", text: "What is encapsulation in object-oriented programming?", type: "MCQ", section: "Computer Science Fundamentals", marks: 2, options: ["Bundling data with methods and controlling access", "Creating many unrelated classes", "Converting source code to machine code", "Storing every variable globally"], correctAnswer: "Bundling data with methods and controlling access", explanation: "Encapsulation groups state and behavior while exposing a controlled interface." },
      { id: "Q10", title: "SQL Query", text: "Write an SQL query to return the names of students whose score is greater than 80 from a table named students(name, score).", type: "Coding", section: "Database Fundamentals", marks: 6, options: [], correctAnswer: "SELECT name FROM students WHERE score > 80;", explanation: "The query must select name and filter rows with a score greater than 80." }
    ]
  }
];

const seedSubmissions: StandaloneSubmission[] = [
  {
    id: "SUB-ASM-001",
    studentName: "Riya Sharma",
    registrationNumber: "21BCE1024",
    courseTitle: "Standalone Assessment",
    assessmentId: "ASM-001",
    assessmentTitle: "TCS NQT Mock Set 4",
    attemptNumber: 1,
    submittedAt: "21 Jul 2026, 10:35 AM",
    score: 82,
    totalMarks: 100,
    percent: 82,
    status: "Passed",
    tabSwitches: 0,
    focusLosses: 0,
    copyPasteAttempts: 0,
    browser: "Chrome / Windows",
    ipAddress: "192.168.1.24",
    proctoringStatus: "Clean",
    answers: [
      { questionId: "Q1", question: "Solve the ratio and proportion problem.", answer: "Option A", expectedAnswer: "Option A", awardedMarks: 2, maxMarks: 2, correct: true },
      { questionId: "Q2", question: "Write a program to reverse a string.", answer: "Submitted code passed sample tests", expectedAnswer: "Correct reverse string logic", awardedMarks: 10, maxMarks: 10, correct: true }
    ]
  },
  {
    id: "SUB-ASM-002",
    studentName: "Aarav Kumar",
    registrationNumber: "21BCE1042",
    courseTitle: "Standalone Assessment",
    assessmentId: "ASM-001",
    assessmentTitle: "TCS NQT Mock Set 4",
    attemptNumber: 1,
    submittedAt: "21 Jul 2026, 11:12 AM",
    score: 58,
    totalMarks: 100,
    percent: 58,
    status: "Needs Review",
    tabSwitches: 2,
    focusLosses: 1,
    copyPasteAttempts: 0,
    browser: "Edge / Windows",
    ipAddress: "192.168.1.31",
    proctoringStatus: "Warning",
    answers: [
      { questionId: "Q1", question: "Solve the ratio and proportion problem.", answer: "Option C", expectedAnswer: "Option A", awardedMarks: 0, maxMarks: 2, correct: false }
    ]
  }
];

function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const saved = window.localStorage.getItem(key);
    return saved ? JSON.parse(saved) as T : fallback;
  } catch {
    return fallback;
  }
}

export default function AssessmentsPage() {
  const [activeTab, setActiveTab] = useState<"builder" | "results">("builder");
  const [assessments, setAssessments] = useState<StandaloneAssessment[]>([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState("");
  const [submissions, setSubmissions] = useState<StandaloneSubmission[]>([]);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState("");
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState("");
  const blankAssessment: StandaloneAssessment = { id: "", title: "", description: "", durationMinutes: 60, maxAttempts: 1, passPercent: 60, sections: "", safeMode: true, cameraRequired: true, questions: [] };
  const selectedAssessment = assessments.find((item) => item.id === selectedAssessmentId) ?? assessments[0] ?? blankAssessment;
  const selectedSubmission = submissions.find((item) => item.id === selectedSubmissionId);

  async function loadDatabaseResults() {
    setResultsLoading(true);
    setResultsError("");
    try {
      const [result, catalog] = await Promise.all([
        listStudentAssessmentAttempts(),
        loadCourseCatalog().catch(() => [])
      ]);
      const detailResults = await Promise.allSettled(result.items.map((item) => getStudentAssessmentAttempt(item.attemptId)));
      const courseNames = new Map(catalog.map((course) => [String(course.id), course.title]));
      const details = detailResults.map((detail, index) => detail.status === "fulfilled" ? detail.value : { ...result.items[index], questions: 0, answers: [], events: [] });
      const databaseSubmissions: StandaloneSubmission[] = details.map((attempt) => {
        const courseMatch = /^course:([^:]+):/.exec(attempt.assignmentId);
        const courseTitle = courseMatch ? courseNames.get(courseMatch[1]) ?? `Course ${courseMatch[1]}` : "Standalone Assessment";
        return {
      id: String(attempt.attemptId),
      studentName: attempt.studentEmail,
      registrationNumber: attempt.studentId ? `Student #${attempt.studentId}` : "",
      courseTitle,
      assessmentId: attempt.assignmentId,
      assessmentTitle: attempt.assignmentTitle || attempt.assignmentId,
      attemptNumber: attempt.attemptNumber,
      submittedAt: attempt.endedAt || attempt.startedAt,
      score: attempt.score,
      totalMarks: 100,
      percent: attempt.score,
      status: attempt.status === "in_progress" ? "Needs Review" : attempt.score >= 60 ? "Passed" : "Failed",
      tabSwitches: attempt.violations,
      focusLosses: 0,
      copyPasteAttempts: 0,
      browser: attempt.browser || "Unknown",
      ipAddress: attempt.ipAddress || "",
      proctoringStatus: attempt.riskLevel === "green" ? "Clean" : attempt.riskLevel === "yellow" ? "Warning" : "Flagged",
      proctoringEvents: (attempt.events ?? []).map((event) => ({ eventType: event.eventType, reason: event.reason, createdAt: event.createdAt })),
      answers: (attempt.answers ?? []).map((answer) => ({
        questionId: answer.questionId,
        question: answer.question,
        answer: answer.selectedAnswer || "",
        expectedAnswer: answer.correctAnswer || "",
        awardedMarks: answer.isCorrect ? 1 : 0,
        maxMarks: 1,
        correct: answer.isCorrect,
      })),
    };
      });
      setSubmissions(databaseSubmissions);
      setSelectedSubmissionId("");
    } catch (error) {
      setResultsError(error instanceof Error ? error.message : "Assessment results could not be loaded.");
    } finally {
      setResultsLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    const localAssessments = readLocal<StandaloneAssessment[]>(assessmentsStorageKey, []).filter((item) => !(item.id === "ASM-001" && item.title === "TCS NQT Mock Set 4"));
    const localSubmissions = readLocal<StandaloneSubmission[]>(submissionsStorageKey, []).filter((item) => item.assessmentTitle !== "TCS NQT Mock Set 4");
    setAssessments(localAssessments);
    setSelectedAssessmentId(localAssessments[0]?.id ?? "");
    setSubmissions(localSubmissions);
    setSelectedSubmissionId("");
    void Promise.all([
      getAdminSnapshot<StandaloneAssessment[]>(standaloneDraftStorageKey),
      getStandaloneAssessments<StandaloneAssessment[]>(),
      Promise.resolve(null as StandaloneSubmission[] | null)
    ]).then(([draftSnapshot, assessmentSnapshot, submissionSnapshot]) => {
      if (!active) return;
      const savedAssessments = draftSnapshot ?? assessmentSnapshot;
      if (savedAssessments) {
        const cleanAssessments = savedAssessments.filter((item) => !(item.id === "ASM-001" && item.title === "TCS NQT Mock Set 4"));
        setAssessments(cleanAssessments);
        setSelectedAssessmentId(cleanAssessments[0]?.id ?? "");
      }
      if (submissionSnapshot?.length) {
        setSubmissions(submissionSnapshot);
        setSelectedSubmissionId("");
      }
      setHydrated(true);
    });
    void loadDatabaseResults().catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(assessmentsStorageKey, JSON.stringify(assessments));
    const timer = window.setTimeout(() => {
      void saveAdminSnapshot(standaloneDraftStorageKey, assessments)
        .then(() => setSaveNotice((current) => current.startsWith("Saving assessment") ? current : "Draft saved to the admin database."))
        .catch((error) => setSaveNotice(error instanceof Error ? error.message : "Draft could not be saved to the database."));
    }, 600);
    return () => window.clearTimeout(timer);
  }, [assessments, hydrated]);

  const totalMarks = useMemo(() => selectedAssessment?.questions.reduce((sum, question) => sum + Number(question.marks || 0), 0) ?? 0, [selectedAssessment]);
  const totals = useMemo(() => ({
    total: submissions.length,
    passed: submissions.filter((submission) => submission.status === "Passed").length,
    review: submissions.filter((submission) => submission.status === "Needs Review").length,
    tabSwitches: submissions.reduce((sum, submission) => sum + submission.tabSwitches, 0),
    flagged: submissions.filter((submission) => submission.proctoringStatus !== "Clean").length
  }), [submissions]);

  function updateAssessment(patch: Partial<StandaloneAssessment>) {
    setAssessments((current) => current.map((item) => item.id === selectedAssessment.id ? { ...item, ...patch, safeMode: true } : item));
    setSaveNotice("Unsaved changes. Push when the assessment is ready for students.");
  }

  function createAssessment() {
    const next: StandaloneAssessment = {
      id: `ASM-${String(assessments.length + 1).padStart(3, "0")}`,
      title: "",
      description: "",
      durationMinutes: 60,
      maxAttempts: 1,
      passPercent: 60,
      sections: "",
      safeMode: true,
      cameraRequired: true,
      questions: []
    };
    setAssessments((current) => [next, ...current]);
    setSelectedAssessmentId(next.id);
    setSaveNotice("New assessment draft created.");
  }

  function addQuestion() {
    updateAssessment({ questions: [...selectedAssessment.questions, makeQuestion(selectedAssessment.questions.length + 1)] });
  }

  function updateQuestion(id: string, patch: Partial<AssessmentQuestion>) {
    updateAssessment({ questions: selectedAssessment.questions.map((question) => question.id === id ? { ...question, ...patch } : question) });
  }

  function removeQuestion(id: string) {
    updateAssessment({ questions: selectedAssessment.questions.filter((question) => question.id !== id) });
  }

  async function pushAssessments() {
    if (!assessments.length) {
      setSaveNotice("Create an assessment before pushing to students.");
      return;
    }
    const invalid = assessments.find((assessment) =>
      !assessment.title.trim()
      || assessment.questions.length === 0
      || assessment.questions.some((question) =>
        !question.text.trim()
        || !question.correctAnswer.trim()
        || (question.type === "MCQ" && question.options.filter((option) => option.trim()).length < 2)
      )
    );
    if (invalid) {
      setSelectedAssessmentId(invalid.id);
      setSaveNotice(`Complete the title, questions, answers, and MCQ options for ${invalid.title.trim() || "the selected assessment"}.`);
      return;
    }
    setSaving(true);
    setSaveNotice("Saving assessment and pushing it to the Student Panel...");
    try {
      await saveStandaloneAssessments(assessments);
      setSaveNotice("Assessment saved to the shared database and pushed to the Student Panel.");
    } catch (error) {
      setSaveNotice(error instanceof Error ? error.message : "Assessment could not be pushed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell title="Assessments" subtitle="Create company-style assessments and review safe-mode student results">
      <div className="grid gap-5">
        <div className="flex flex-wrap gap-3 rounded-lg border border-portal-line bg-white p-2">
          <button onClick={() => setActiveTab("builder")} className={`h-10 rounded-md px-4 text-sm font-bold ${activeTab === "builder" ? "bg-portal-blue text-white" : "text-slate-700"}`}>Assessment Builder</button>
          <button onClick={() => setActiveTab("results")} className={`h-10 rounded-md px-4 text-sm font-bold ${activeTab === "results" ? "bg-portal-blue text-white" : "text-slate-700"}`}>Student Results</button>
        </div>

        {activeTab === "builder" ? (
          <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
            <SectionCard title="Assessment List" action={<button onClick={createAssessment} className="flex h-10 items-center gap-2 rounded-md bg-portal-blue px-4 text-sm font-bold text-white"><Plus size={16} /> Create</button>}>
              <div className="space-y-3">
                {assessments.map((assessment) => (
                  <button key={assessment.id} onClick={() => setSelectedAssessmentId(assessment.id)} className={`w-full rounded-md border p-4 text-left ${selectedAssessment.id === assessment.id ? "border-portal-blue bg-blue-50" : "border-portal-line"}`}>
                    <p className="font-bold text-slate-950">{assessment.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{assessment.questions.length} questions / {assessment.passPercent}% pass</p>
                    <p className="mt-2 flex items-center gap-1 text-xs font-bold text-emerald-700"><ShieldCheck size={14} /> Safe mode · Camera {assessment.cameraRequired === false ? "off" : "on"}</p>
                  </button>
                ))}
                {!assessments.length ? <p className="rounded-md border border-dashed border-portal-line p-5 text-center text-sm font-semibold text-slate-500">No assessments yet. Click Create to add one.</p> : null}
              </div>
            </SectionCard>

            <SectionCard title="Question Paper" action={<div className="flex flex-wrap gap-2"><button onClick={addQuestion} disabled={!selectedAssessment.id} className="flex h-10 items-center gap-2 rounded-md border border-portal-line px-4 text-sm font-bold text-portal-blue disabled:cursor-not-allowed disabled:opacity-40"><Plus size={16} /> Add Question</button><button onClick={() => void pushAssessments()} disabled={saving || !selectedAssessment.id} className="flex h-10 items-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? <Save size={16} /> : <Send size={16} />}{saving ? "Pushing..." : "Save & Push to Student Panel"}</button></div>}>
              {saveNotice ? <p className={`mb-4 rounded-md px-4 py-3 text-sm font-semibold ${saveNotice.includes("pushed") ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-slate-700"}`}>{saveNotice}</p> : null}
              <div className="grid gap-4 lg:grid-cols-2">
                <label><span className="mb-1 block text-sm font-bold text-slate-600">Assessment Title</span><input value={selectedAssessment.title} onChange={(event) => updateAssessment({ title: event.target.value })} className="h-11 w-full rounded-md border border-portal-line px-3" /></label>
                <label><span className="mb-1 block text-sm font-bold text-slate-600">Sections</span><input value={selectedAssessment.sections} onChange={(event) => updateAssessment({ sections: event.target.value })} className="h-11 w-full rounded-md border border-portal-line px-3" /></label>
                <label><span className="mb-1 block text-sm font-bold text-slate-600">Duration Minutes</span><input type="number" value={selectedAssessment.durationMinutes} onChange={(event) => updateAssessment({ durationMinutes: Number(event.target.value) })} className="h-11 w-full rounded-md border border-portal-line px-3" /></label>
                <label><span className="mb-1 block text-sm font-bold text-slate-600">Pass %</span><input type="number" value={selectedAssessment.passPercent} onChange={(event) => updateAssessment({ passPercent: Number(event.target.value) })} className="h-11 w-full rounded-md border border-portal-line px-3" /></label>
                <label><span className="mb-1 block text-sm font-bold text-slate-600">Maximum Attempts</span><input type="number" min={1} max={20} value={selectedAssessment.maxAttempts ?? 1} onChange={(event) => updateAssessment({ maxAttempts: Math.max(1, Math.min(20, Number(event.target.value) || 1)) })} className="h-11 w-full rounded-md border border-portal-line px-3" /></label>
                <label className="flex min-h-11 items-center gap-3 rounded-md border border-portal-line px-4"><input type="checkbox" checked={selectedAssessment.cameraRequired !== false} onChange={(event) => updateAssessment({ cameraRequired: event.target.checked })} className="h-5 w-5 accent-portal-blue"/><span><b className="block text-sm text-slate-800">Approve camera monitoring</b><small className="text-slate-500">When off, camera and phone detection are not requested.</small></span></label>
                <label className="lg:col-span-2"><span className="mb-1 block text-sm font-bold text-slate-600">Instructions</span><textarea value={selectedAssessment.description} onChange={(event) => updateAssessment({ description: event.target.value })} className="h-24 w-full rounded-md border border-portal-line p-3" /></label>
              </div>

              <div className="mt-5 rounded-md bg-blue-50 p-4 text-sm font-semibold text-slate-700">
                Total: {selectedAssessment.questions.length} questions / {totalMarks} marks. Safe mode is enabled for tab-switch, focus-loss, and copy/paste reports.
              </div>

              <div className="mt-5 divide-y divide-portal-line rounded-lg border border-portal-line">
                {selectedAssessment.questions.map((question, index) => (
                  <div key={question.id} className="grid gap-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-bold text-slate-950">Q{index + 1}. {question.title}</h3>
                        <p className="text-sm text-slate-500">{question.type} / {question.marks} marks / {question.section}</p>
                      </div>
                      <button onClick={() => removeQuestion(question.id)} className="grid h-10 w-10 place-items-center rounded-md border border-red-200 text-red-600"><Trash2 size={17} /></button>
                    </div>
                    <textarea value={question.text} onChange={(event) => updateQuestion(question.id, { text: event.target.value })} className="h-28 rounded-md border border-portal-line p-3" />
                    <div className="grid gap-4 md:grid-cols-4">
                      <label><span className="mb-1 block text-xs font-bold text-slate-500">Type</span><select value={question.type} onChange={(event) => updateQuestion(question.id, { type: event.target.value as QuestionType })} className="h-11 w-full rounded-md border border-portal-line px-3"><option>MCQ</option><option>Coding</option><option>Descriptive</option></select></label>
                      <label><span className="mb-1 block text-xs font-bold text-slate-500">Section</span><input value={question.section} onChange={(event) => updateQuestion(question.id, { section: event.target.value })} className="h-11 w-full rounded-md border border-portal-line px-3" /></label>
                      <label><span className="mb-1 block text-xs font-bold text-slate-500">Marks</span><input type="number" value={question.marks} onChange={(event) => updateQuestion(question.id, { marks: Number(event.target.value) })} className="h-11 w-full rounded-md border border-portal-line px-3" /></label>
                      <label className="flex h-11 cursor-pointer items-center justify-center gap-2 self-end rounded-md border border-portal-line text-sm font-bold text-portal-blue"><ImagePlus size={16} /> Diagram<input type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => updateQuestion(question.id, { diagramUrl: String(reader.result), diagramName: file.name }); reader.readAsDataURL(file); }} /></label>
                    </div>
                    {question.type === "MCQ" ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        {question.options.map((option, optionIndex) => <input key={optionIndex} value={option} onChange={(event) => { const next = [...question.options]; next[optionIndex] = event.target.value; updateQuestion(question.id, { options: next }); }} className="h-11 rounded-md border border-portal-line px-3" placeholder={`Option ${optionIndex + 1}`} />)}
                      </div>
                    ) : null}
                    <input value={question.correctAnswer} onChange={(event) => updateQuestion(question.id, { correctAnswer: event.target.value })} className="h-11 rounded-md border border-portal-line px-3" placeholder="Correct answer / expected output" />
                    <textarea value={question.explanation} onChange={(event) => updateQuestion(question.id, { explanation: event.target.value })} className="h-24 rounded-md border border-portal-line p-3" placeholder="Explanation / evaluation notes" />
                    {question.diagramName ? <p className="text-xs font-bold text-slate-500">Diagram attached: {question.diagramName}</p> : null}
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        ) : (
          <ResultsView submissions={submissions} selected={selectedSubmission} onSelect={setSelectedSubmissionId} onRefresh={() => void loadDatabaseResults()} totals={totals} loading={resultsLoading} error={resultsError} />
        )}
      </div>
    </AdminShell>
  );
}

function ResultsView({ submissions, selected, onSelect, onRefresh, totals, loading, error }: { submissions: StandaloneSubmission[]; selected?: StandaloneSubmission; onSelect: (id: string) => void; onRefresh: () => void; totals: { total: number; passed: number; review: number; tabSwitches: number; flagged: number }; loading: boolean; error: string }) {
  const [resultQuery, setResultQuery] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const groups = useMemo(() => {
    const grouped = new Map<string, { assessmentId: string; assessmentTitle: string; submissions: StandaloneSubmission[] }>();
    for (const submission of submissions) {
      const key = submission.assessmentId;
      const group = grouped.get(key) ?? { assessmentId: submission.assessmentId, assessmentTitle: submission.assessmentTitle, submissions: [] };
      group.submissions.push(submission);
      grouped.set(key, group);
    }
    return [...grouped.values()];
  }, [submissions]);
  const visibleGroups = useMemo(() => {
    const clean = resultQuery.trim().toLowerCase();
    if (!clean) return groups;
    return groups.map((group) => ({ ...group, submissions: group.submissions.filter((submission) => [submission.studentName, submission.registrationNumber, submission.assessmentTitle].some((value) => value.toLowerCase().includes(clean))) })).filter((group) => group.submissions.length);
  }, [groups, resultQuery]);
  const reportRows = (items: StandaloneSubmission[]): ReportRow[] => items.map((submission) => ({
    Assessment: submission.assessmentTitle,
    Student: submission.studentName,
    "Registration Number": submission.registrationNumber,
    "Attempt Number": submission.attemptNumber,
    Status: submission.status,
    "Score %": submission.percent,
    "Submitted At": new Date(submission.submittedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) + " IST",
    "Security Status": submission.proctoringStatus,
    Violations: submission.tabSwitches
  }));
  const selectedGroup = groups.find((group) => group.assessmentId === selectedGroupId);

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-5">
        {[{ label: "Submissions", value: totals.total, icon: ClipboardList }, { label: "Passed", value: totals.passed, icon: CheckCircle2 }, { label: "Needs Review", value: totals.review, icon: FileCheck2 }, { label: "Tab Switches", value: totals.tabSwitches, icon: AlertTriangle }, { label: "Security Reports", value: totals.flagged, icon: ShieldCheck }].map((stat) => { const Icon = stat.icon; return <div key={stat.label} className="rounded-lg border border-portal-line bg-white p-5"><Icon className="text-portal-blue" /><p className="mt-4 text-sm font-semibold text-slate-500">{stat.label}</p><p className="mt-1 text-2xl font-bold text-slate-950">{stat.value}</p></div>; })}
      </div>
      <SectionCard title="Assessment Student Results" action={<div className="flex flex-wrap gap-2"><button onClick={() => downloadCsv("all-assessment-results", reportRows(submissions))} disabled={!submissions.length} className="flex h-10 items-center gap-2 rounded-md border border-portal-line px-4 text-sm font-bold disabled:opacity-40"><Download size={16} /> Overall CSV</button><button onClick={onRefresh} disabled={loading} className="flex h-10 items-center gap-2 rounded-md border border-portal-line px-4 text-sm font-bold text-portal-blue disabled:opacity-50"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /> {loading ? "Refreshing..." : "Refresh Results"}</button></div>}>
        {error ? <p className="mb-4 rounded-md bg-red-50 p-4 text-sm font-bold text-red-700">{error}</p> : null}
        <label className="mb-4 flex h-11 items-center gap-3 rounded-md border border-portal-line px-3 text-slate-500"><Search size={17} /><input value={resultQuery} onChange={(event) => setResultQuery(event.target.value)} className="w-full outline-none" placeholder="Search assessment or student result" /></label>
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b bg-slate-50 text-slate-600"><th className="p-3">Assessment</th><th className="p-3">Student Attempts</th><th className="p-3">Passed</th><th className="p-3">Failed / Review</th><th className="p-3">Actions</th></tr></thead><tbody>{visibleGroups.map((group) => <tr key={group.assessmentId} className="border-b border-portal-line"><td className="p-3 font-bold text-slate-950">{group.assessmentTitle}</td><td className="p-3">{group.submissions.length}</td><td className="p-3 font-bold text-emerald-600">{group.submissions.filter((item) => item.status === "Passed").length}</td><td className="p-3 font-bold text-amber-600">{group.submissions.filter((item) => item.status !== "Passed").length}</td><td className="p-3"><div className="flex gap-2"><button onClick={() => setSelectedGroupId(group.assessmentId)} className="flex h-9 items-center gap-2 rounded-md border border-blue-200 px-3 font-bold text-portal-blue"><Users size={15} /> Students</button><button onClick={() => downloadPdf(`${group.assessmentTitle} All Student Results`, reportRows(group.submissions))} className="flex h-9 items-center gap-2 rounded-md border border-portal-line px-3 font-bold text-slate-700"><FileText size={15} /> PDF</button></div></td></tr>)}</tbody></table></div>
        {!loading && !visibleGroups.length ? <p className="rounded-md border border-dashed border-portal-line p-8 text-center text-sm text-slate-500">No student assessment results match this view.</p> : null}
      </SectionCard>

      {selectedGroup ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/55 p-4" role="dialog" aria-modal="true" aria-label={`${selectedGroup.assessmentTitle} student results`} onMouseDown={(event) => { if (event.currentTarget === event.target) setSelectedGroupId(""); }}>
          <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex flex-wrap items-start justify-between gap-4 border-b border-portal-line bg-white p-5"><div><p className="text-xs font-bold uppercase tracking-wide text-portal-blue">All student results</p><h2 className="mt-1 text-xl font-bold text-slate-950">{selectedGroup.assessmentTitle}</h2><p className="mt-1 text-sm text-slate-500">{selectedGroup.submissions.length} submitted attempts</p></div><div className="flex gap-2"><button onClick={() => downloadPdf(`${selectedGroup.assessmentTitle} All Student Results`, reportRows(selectedGroup.submissions))} className="flex h-10 items-center gap-2 rounded-md border border-portal-line px-4 text-sm font-bold"><FileText size={16} /> Download PDF</button><button onClick={() => setSelectedGroupId("")} className="grid h-10 w-10 place-items-center rounded-full border border-portal-line" aria-label="Close assessment students"><X size={19} /></button></div></div>
            <div className="overflow-x-auto p-5"><table className="w-full min-w-[980px] text-left text-sm"><thead><tr className="border-b bg-slate-50 text-slate-600"><th className="p-3">Student</th><th className="p-3">Attempt</th><th className="p-3">Score</th><th className="p-3">Status</th><th className="p-3">Submitted</th><th className="p-3">Security</th><th className="p-3">Details</th></tr></thead><tbody>{selectedGroup.submissions.map((submission) => <tr key={submission.id} className="border-b border-portal-line"><td className="p-3"><p className="font-bold text-slate-900">{submission.studentName}</p><p className="text-xs text-slate-500">{submission.registrationNumber}</p></td><td className="p-3">{submission.attemptNumber}</td><td className="p-3 font-bold text-portal-blue">{submission.percent}%</td><td className="p-3 font-bold">{submission.status}</td><td className="p-3">{new Date(submission.submittedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</td><td className="p-3">{submission.proctoringStatus} · {submission.tabSwitches} violations</td><td className="p-3"><button onClick={() => onSelect(submission.id)} className="h-9 rounded-md border border-portal-line px-3 font-bold text-portal-blue">Open Result</button></td></tr>)}</tbody></table></div>
          </div>
        </div>
      ) : null}

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" role="dialog" aria-modal="true" aria-label="Assessment submission details" onMouseDown={(event) => { if (event.currentTarget === event.target) onSelect(""); }}>
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-portal-line bg-white p-5">
              <div><p className="text-xs font-bold uppercase tracking-wide text-portal-blue">{selected.courseTitle}</p><h2 className="mt-1 text-xl font-bold text-slate-950">{selected.assessmentTitle}</h2><p className="mt-1 text-sm text-slate-500">{selected.studentName} · Attempt {selected.attemptNumber} · {new Date(selected.submittedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p></div>
              <button type="button" onClick={() => onSelect("")} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-portal-line text-slate-600" aria-label="Close result details"><X size={20} /></button>
            </div>
            <div className="grid gap-5 p-5">
              <div className="grid gap-4 md:grid-cols-4"><Summary label="Score" value={`${selected.score}/${selected.totalMarks}`} /><Summary label="Status" value={selected.status} /><Summary label="Security" value={selected.proctoringStatus} /><Summary label="Violations" value={String(selected.tabSwitches)} /></div>
              <div><h3 className="mb-3 font-bold text-slate-950">Proctoring Timeline</h3><div className="space-y-2">{selected.proctoringEvents?.map((event, index) => <div key={`${event.eventType}-${event.createdAt}-${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-portal-line p-3 text-sm"><div><p className="font-bold text-slate-900">{event.eventType.replaceAll("_", " ")}</p><p className="text-slate-500">{event.reason || "Monitoring event recorded"}</p></div><time className="text-xs font-semibold text-slate-500">{new Date(event.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</time></div>)}{!selected.proctoringEvents?.length ? <p className="rounded-md bg-slate-50 p-4 text-sm text-slate-500">No proctoring violations were recorded for this attempt.</p> : null}</div></div>
              <div><h3 className="mb-3 font-bold text-slate-950">Answer Review</h3><div className="space-y-3">{selected.answers.map((answer, index) => <div key={`${answer.questionId}-${index}`} className="rounded-md border border-portal-line p-4"><div className="flex justify-between gap-3"><p className="font-bold text-slate-950">Q{index + 1}. {answer.question}</p><span className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${answer.correct ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{answer.correct ? <CheckCircle2 size={14} /> : <XCircle size={14} />}{answer.correct ? "Correct" : "Incorrect"}</span></div><div className="mt-3 grid gap-3 text-sm md:grid-cols-2"><div className="rounded-md bg-slate-50 p-3"><p className="font-bold text-slate-600">Student Answer</p><p>{answer.answer || "Not answered"}</p></div><div className="rounded-md bg-blue-50 p-3"><p className="font-bold text-slate-600">Correct Answer</p><p>{answer.expectedAnswer || "Manual evaluation required"}</p></div></div></div>)}</div>{!selected.answers.length ? <p className="rounded-md bg-slate-50 p-5 text-sm text-slate-500">Detailed answers are unavailable for this attempt, but its submission status and score are stored.</p> : null}</div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-slate-50 p-4"><p className="text-sm font-semibold text-slate-500">{label}</p><p className="mt-1 break-words text-xl font-bold text-slate-950">{value}</p></div>;
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Eye, HelpCircle, ImagePlus, Plus, Send, Trash2 } from "lucide-react";
import { getAdminSnapshot, getCourseAssessments, publishCourseInDb, saveAdminSnapshot, saveCourseAssessments } from "@/lib/admin-api";

type CourseQuestion = {
  id: string;
  text: string;
  type: "MCQ" | "Coding" | "Descriptive";
  section: string;
  marks: number;
  options: string[];
  answer: string;
  explanation: string;
  diagramUrl?: string;
  diagramName?: string;
};

type CourseAssessment = {
  id: string;
  module: string;
  title: string;
  passPercent: number;
  maxAttempts: number;
  requiredToUnlock: boolean;
  cameraRequired: boolean;
  questions: CourseQuestion[];
};

const defaultOptions = ["Option A", "Option B", "Option C", "Option D"];

function makeCourseQuestion(index: number, module: string): CourseQuestion {
  return {
    id: `CQ${index}`,
    text: "",
    type: "MCQ",
    section: "",
    marks: 1,
    options: ["", "", "", ""],
    answer: "",
    explanation: ""
  };
}

function normalizeQuestion(question: Partial<CourseQuestion>, index: number, module: string): CourseQuestion {
  return {
    id: question.id ?? `CQ${index + 1}`,
    text: question.text ?? "",
    type: question.type ?? "MCQ",
    section: question.section ?? "",
    marks: question.marks ?? 1,
    options: question.options?.length ? question.options : defaultOptions,
    answer: question.answer ?? "",
    explanation: question.explanation ?? "",
    diagramUrl: question.diagramUrl,
    diagramName: question.diagramName
  };
}

function normalizeAssessment(assessment: CourseAssessment): CourseAssessment {
  return {
    ...assessment,
    passPercent: assessment.passPercent ?? 60,
    maxAttempts: Math.max(1, Math.min(20, assessment.maxAttempts ?? 3)),
    requiredToUnlock: assessment.requiredToUnlock ?? true,
    cameraRequired: assessment.cameraRequired ?? true,
    questions: assessment.questions.map((question, index) => normalizeQuestion(question, index, assessment.module))
  };
}

const legacyDemoAssessmentIds = new Set(["CA-001", "CA-002"]);

function removeLegacyDemoAssessments(items: CourseAssessment[]) {
  return items.filter((item) => !(legacyDemoAssessmentIds.has(item.id) && ["Intro Module Check", "Scanning Networks Quiz"].includes(item.title)));
}

export function CourseAssessmentCurriculum({ courseId }: { courseId: string }) {
  const storageKey = `course-assessment-curriculum-${courseId}-v2`;
  const draftStorageKey = `course-assessment-draft-${courseId}-v1`;
  const [assessments, setAssessments] = useState<CourseAssessment[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [notice, setNotice] = useState("No assessments yet. Add one when the course needs a test.");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadAssessments() {
      const [draftAssessments, publishedAssessments] = await Promise.all([
        getAdminSnapshot<CourseAssessment[]>(draftStorageKey),
        getCourseAssessments<CourseAssessment[]>(courseId),
      ]);
      if (!active) return;
      const savedAssessments = draftAssessments ?? publishedAssessments;
      if (savedAssessments?.length) {
        const normalized = removeLegacyDemoAssessments(savedAssessments.map(normalizeAssessment));
        setAssessments(normalized);
        if (normalized[0]) setSelectedId(normalized[0].id);
        if (!normalized.length) {
          setNotice("Demo assessments removed. Add your first assessment.");
          void saveCourseAssessments(courseId, []);
        }
        setHydrated(true);
        return;
      }

      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as CourseAssessment[];
        const normalized = removeLegacyDemoAssessments(parsed.map(normalizeAssessment));
        setAssessments(normalized);
        if (normalized[0]) setSelectedId(normalized[0].id);
        } catch {
          window.localStorage.removeItem(storageKey);
        }
      }
      setHydrated(true);
    }
    void loadAssessments();

    return () => {
      active = false;
    };
  }, [courseId, draftStorageKey, storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(storageKey, JSON.stringify(assessments));
    const timer = window.setTimeout(() => {
      void saveAdminSnapshot(draftStorageKey, assessments)
        .then(() => setNotice((current) => current.startsWith("Saving assessment") ? current : "Assessment draft saved to the admin database."))
        .catch((error) => setNotice(error instanceof Error ? error.message : "Assessment draft could not be saved to the database."));
    }, 600);
    return () => window.clearTimeout(timer);
  }, [assessments, draftStorageKey, hydrated, storageKey]);

  const selected = assessments.find((assessment) => assessment.id === selectedId) ?? assessments[0];
  const totalMarks = useMemo(
    () => selected?.questions.reduce((sum, question) => sum + Number(question.marks), 0) ?? 0,
    [selected]
  );

  function addAssessment() {
    const next: CourseAssessment = {
      id: `CA-${String(assessments.length + 1).padStart(3, "0")}`,
      module: "",
      title: "",
      passPercent: 60,
      maxAttempts: 3,
      requiredToUnlock: true,
      cameraRequired: true,
      questions: []
    };
    setAssessments((current) => [next, ...current]);
    setSelectedId(next.id);
    setNotice("Course assessment added.");
  }

  function updateAssessment(id: string, patch: Partial<CourseAssessment>) {
    setAssessments((current) => current.map((item) => item.id === id ? normalizeAssessment({ ...item, ...patch }) : item));
    setNotice("Course assessment updated.");
  }

  function removeAssessment(id: string) {
    const next = assessments.filter((item) => item.id !== id);
    setAssessments(next);
    setSelectedId(next[0]?.id ?? "");
    setNotice("Course assessment removed.");
  }

  function addQuestion() {
    updateAssessment(selected.id, {
      questions: [...selected.questions, makeCourseQuestion(selected.questions.length + 1, selected.module)]
    });
    setNotice("Question added to course assessment.");
  }

  function updateQuestion(questionId: string, patch: Partial<CourseQuestion>) {
    updateAssessment(selected.id, {
      questions: selected.questions.map((question, index) =>
        question.id === questionId ? normalizeQuestion({ ...question, ...patch }, index, selected.module) : question
      )
    });
  }

  function removeQuestion(questionId: string) {
    updateAssessment(selected.id, {
      questions: selected.questions.filter((question) => question.id !== questionId)
    });
  }

  async function pushAssessmentCurriculum() {
    const invalid = assessments.find((assessment) =>
      !assessment.title.trim()
      || !assessment.module.trim()
      || assessment.questions.length === 0
      || assessment.questions.some((question) =>
        !question.text.trim()
        || !question.answer.trim()
        || (question.type === "MCQ" && question.options.filter((option) => option.trim()).length < 2)
      )
    );
    if (invalid) {
      setSelectedId(invalid.id);
      setNotice(`Complete the module, title, questions, answers, and MCQ options for ${invalid.title.trim() || "this assessment"}.`);
      return;
    }
    setNotice("Saving assessment curriculum and pushing it to the Student Panel...");
    try {
      await publishCourseInDb(courseId);
      await saveCourseAssessments(courseId, assessments);
      setNotice("Course and assessment curriculum published to the shared database and pushed to the Student Panel.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Assessment curriculum could not be pushed.");
    }
  }

  if (!selected) {
    return (
      <div className="rounded-lg border border-portal-line bg-white p-5">
        <button type="button" onClick={addAssessment} className="flex h-10 items-center gap-2 rounded-md bg-portal-blue px-4 text-sm font-bold text-white">
          <Plus size={17} />
          Add Course Assessment
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-portal-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-portal-line p-5">
        <div>
          <h2 className="flex items-center gap-2 font-bold text-slate-950">
            <ClipboardList size={18} className="text-portal-blue" />
            Course Assessment Authoring
          </h2>
          <p className="mt-1 text-sm text-slate-500">{notice}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => setNotice("Student preview opens the same questions and evaluates by pass percentage.")} className="flex h-10 items-center gap-2 rounded-md border border-portal-line px-4 text-sm font-bold text-slate-700">
            <Eye size={17} />
            Preview Student Flow
          </button>
          <button type="button" onClick={addAssessment} className="flex h-10 items-center gap-2 rounded-md bg-portal-blue px-4 text-sm font-bold text-white">
            <Plus size={17} />
            Add Course Assessment
          </button>
        </div>
      </div>

      <div className="grid gap-0">
        <div className="border-b border-portal-line p-4">
          <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {assessments.map((assessment) => (
              <button
                key={assessment.id}
                type="button"
                onClick={() => setSelectedId(assessment.id)}
                className={`w-full rounded-md border p-3 text-left text-sm ${
                  selected.id === assessment.id ? "border-portal-blue bg-blue-50" : "border-portal-line bg-white"
                }`}
              >
                <p className="font-bold text-slate-950">{assessment.title}</p>
                <p className="mt-1 text-xs text-slate-500">{assessment.module}</p>
                <p className="mt-2 text-xs font-bold text-portal-blue">
                  {assessment.questions.length} questions / pass {assessment.passPercent}%
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-5 p-5">
          <div className="grid gap-3 xl:grid-cols-[1fr_1fr_110px_130px_auto]">
            <label>
              <span className="mb-1 block text-xs font-bold text-slate-500">Module</span>
              <input value={selected.module} onChange={(event) => updateAssessment(selected.id, { module: event.target.value })} className="h-10 w-full rounded-md border border-portal-line px-3 text-sm outline-none focus:border-portal-blue" />
            </label>
            <label>
              <span className="mb-1 block text-xs font-bold text-slate-500">Assessment Title</span>
              <input value={selected.title} onChange={(event) => updateAssessment(selected.id, { title: event.target.value })} className="h-10 w-full rounded-md border border-portal-line px-3 text-sm outline-none focus:border-portal-blue" />
            </label>
            <label>
              <span className="mb-1 block text-xs font-bold text-slate-500">Pass %</span>
              <input type="number" min={0} max={100} value={selected.passPercent} onChange={(event) => updateAssessment(selected.id, { passPercent: Number(event.target.value) })} className="h-10 w-full rounded-md border border-portal-line px-3 text-sm outline-none focus:border-portal-blue" />
            </label>
            <label>
              <span className="mb-1 block text-xs font-bold text-slate-500">Max Attempts</span>
              <input type="number" min={1} max={20} value={selected.maxAttempts} onChange={(event) => updateAssessment(selected.id, { maxAttempts: Math.max(1, Math.min(20, Number(event.target.value) || 1)) })} className="h-10 w-full rounded-md border border-portal-line px-3 text-sm outline-none focus:border-portal-blue" />
            </label>
            <div className="flex items-end gap-2">
              <button type="button" onClick={() => updateAssessment(selected.id, { requiredToUnlock: !selected.requiredToUnlock })} className={`h-10 rounded-md px-3 text-sm font-bold ${selected.requiredToUnlock ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                {selected.requiredToUnlock ? "Unlock Gate" : "Optional"}
              </button>
              <button type="button" onClick={() => removeAssessment(selected.id)} className="grid h-10 w-10 place-items-center rounded-md border border-red-200 text-red-600" aria-label="Delete course assessment">
                <Trash2 size={17} />
              </button>
            </div>
          </div>
          <label className="flex items-center gap-3 rounded-md border border-portal-line bg-slate-50 p-4"><input type="checkbox" checked={selected.cameraRequired !== false} onChange={(event) => updateAssessment(selected.id, { cameraRequired: event.target.checked })} className="h-5 w-5 accent-portal-blue"/><span><b className="block text-sm text-slate-900">Approve camera for this assessment</b><small className="text-slate-500">Enables camera preview, face/person checks, and phone detection for students.</small></span></label>

          <div className="rounded-md border border-portal-line">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-portal-line px-4 py-3">
              <div>
                <p className="font-bold text-slate-950">Question Paper ({selected.questions.length})</p>
                <p className="text-xs text-slate-500">
                  {totalMarks} marks / Course module assessment / Auto evaluated by correct answer
                </p>
              </div>
              <button type="button" onClick={addQuestion} className="h-9 rounded-md border border-portal-line px-3 text-sm font-bold text-portal-blue">Add Question</button>
            </div>

            <div className="divide-y divide-portal-line">
              {selected.questions.map((question, index) => (
                <details key={question.id} className="group p-4" open={index === 0}>
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <p className="font-bold text-slate-800">
                        Q{index + 1}. Course-style Question Authoring
                        </p>
                        <p className="mt-1 text-xs text-slate-500">{question.type} / {question.marks} marks / {question.section}</p>
                      </div>
                      <span className="text-xs font-bold text-portal-blue">Click to edit</span>
                    </div>
                  </summary>

                  <div className="mt-4 grid gap-4">
                  <div className="flex justify-end">
                    <button type="button" onClick={() => removeQuestion(question.id)} className="grid h-9 w-9 place-items-center rounded-md border border-red-200 text-red-600" aria-label="Delete question">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <textarea value={question.text} onChange={(event) => updateQuestion(question.id, { text: event.target.value })} className="min-h-24 rounded-md border border-portal-line p-3 text-sm outline-none focus:border-portal-blue" />

                  <div className="grid gap-3 md:grid-cols-4">
                    <label>
                      <span className="mb-1 block text-xs font-bold text-slate-500">Type</span>
                      <select value={question.type} onChange={(event) => updateQuestion(question.id, { type: event.target.value as CourseQuestion["type"] })} className="h-10 w-full rounded-md border border-portal-line px-3 text-sm">
                        <option>MCQ</option>
                        <option>Coding</option>
                        <option>Descriptive</option>
                      </select>
                    </label>
                    <label>
                      <span className="mb-1 block text-xs font-bold text-slate-500">Section</span>
                      <input value={question.section} onChange={(event) => updateQuestion(question.id, { section: event.target.value })} className="h-10 w-full rounded-md border border-portal-line px-3 text-sm" />
                    </label>
                    <label>
                      <span className="mb-1 block text-xs font-bold text-slate-500">Marks</span>
                      <input type="number" min={1} value={question.marks} onChange={(event) => updateQuestion(question.id, { marks: Number(event.target.value) })} className="h-10 w-full rounded-md border border-portal-line px-3 text-sm" />
                    </label>
                    <label className="flex cursor-pointer items-end">
                      <span className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-portal-line px-3 text-sm font-bold text-portal-blue">
                        <ImagePlus size={16} />
                        {question.diagramName || "Add Diagram"}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => updateQuestion(question.id, { diagramUrl: String(reader.result), diagramName: file.name });
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                  </div>

                  {question.diagramUrl ? (
                    <div className="overflow-hidden rounded-md border border-portal-line bg-slate-50">
                      <img src={question.diagramUrl} alt="Course assessment diagram" className="max-h-64 w-full object-contain" />
                    </div>
                  ) : null}

                  {question.type === "MCQ" ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {question.options.map((option, optionIndex) => (
                        <label key={`${question.id}-${optionIndex}`}>
                          <span className="mb-1 block text-xs font-bold text-slate-500">Option {optionIndex + 1}</span>
                          <input
                            value={option}
                            onChange={(event) => {
                              const options = [...question.options];
                              options[optionIndex] = event.target.value;
                              updateQuestion(question.id, { options });
                            }}
                            className="h-10 w-full rounded-md border border-portal-line px-3 text-sm"
                          />
                        </label>
                      ))}
                    </div>
                  ) : null}

                  <label>
                    <span className="mb-1 block text-xs font-bold text-slate-500">Correct Answer</span>
                    <input value={question.answer} onChange={(event) => updateQuestion(question.id, { answer: event.target.value })} className="h-10 w-full rounded-md border border-portal-line px-3 text-sm" />
                  </label>
                  <label>
                    <span className="mb-1 block text-xs font-bold text-slate-500">Explanation / Evaluation Notes</span>
                    <textarea value={question.explanation} onChange={(event) => updateQuestion(question.id, { explanation: event.target.value })} className="min-h-20 w-full rounded-md border border-portal-line p-3 text-sm" />
                  </label>
                  </div>
                </details>
              ))}
              {selected.questions.length === 0 ? <p className="p-4 text-sm font-semibold text-slate-500">No course questions yet.</p> : null}
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-md bg-blue-50 p-3 text-sm text-slate-700">
            <HelpCircle size={18} className="text-portal-blue" />
            Student gets this assessment after the module. If they score the pass percentage, the next module unlocks and admin can review answers.
          </div>
          <button type="button" onClick={() => void pushAssessmentCurriculum()} className="flex h-10 w-fit items-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-bold text-white">
            <Send size={17} />
            Save & Push to Student Panel
          </button>
        </div>
      </div>
    </div>
  );
}

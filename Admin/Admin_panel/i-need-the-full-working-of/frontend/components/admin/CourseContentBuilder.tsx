"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FileText,
  GripVertical,
  HelpCircle,
  ImagePlus,
  Link2,
  Lock,
  Pencil,
  PlaySquare,
  Plus,
  Trash2,
  Upload,
  Video,
  Youtube
} from "lucide-react";
import { getAdminSnapshot, getCourseAssessments, saveAdminSnapshot, saveCourseAssessments } from "@/lib/admin-api";

type QuizQuestion = {
  question: string;
  options: string[];
  answer: string;
  explanation?: string;
};

type ModuleItem = {
  title: string;
  videoUrl: string;
  videoSource: "youtube" | "upload";
  uploadedVideoName?: string;
  uploadedVideoUrl?: string;
  quiz: string;
  locked: boolean;
  imageUrl?: string;
  imageName?: string;
  resources: string[];
  unlockRule: "video_quiz" | "video" | "manual";
  generatedQuestions: QuizQuestion[];
};
type StoredAssessment = { id?: string } & Record<string, unknown>;

type CourseContentBuilderProps = {
  courseId: string;
};

const legacyDemoModuleTitles = new Set([
  "Introduction to Ethical Hacking", "Footprinting & Reconnaissance", "Scanning Networks", "Enumeration",
  "Vulnerability Analysis", "System Hacking", "Malware Threats", "Sniffing & Spoofing"
]);

function removeLegacyDemoModules(items: ModuleItem[]) {
  return items.filter((item) => !(legacyDemoModuleTitles.has(item.title) && item.videoUrl.includes("watch?v=sample-")));
}

function normalizeModule(module: Partial<ModuleItem> & { title: string }): ModuleItem {
  return {
    title: module.title,
    videoUrl: module.videoUrl ?? "",
    videoSource: module.videoSource ?? "youtube",
    uploadedVideoName: module.uploadedVideoName,
    uploadedVideoUrl: module.uploadedVideoUrl,
    quiz: module.quiz ?? "",
    locked: module.locked ?? true,
    imageUrl: module.imageUrl,
    imageName: module.imageName,
    resources: module.resources ?? [],
    unlockRule: module.unlockRule ?? "video_quiz",
    generatedQuestions: (module.generatedQuestions ?? []).map((question) => ({
      question: question.question,
      options: question.options?.length ? question.options.slice(0, 4) : ["", "", "", ""],
      answer: question.answer,
      explanation: question.explanation ?? ""
    }))
  };
}

// Sequencing starts after the first module.  The first lesson is always the
// entry point to a course, even for courses saved before this rule existed.
function normalizeModuleSequence(items: ModuleItem[]) {
  return items.map((item, index) => ({ ...item, locked: index === 0 ? false : item.locked }));
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "module";
}

function moduleAssessmentItems(modules: ModuleItem[]) {
  return modules.flatMap((module, index) => {
    if (!module.generatedQuestions.length) return [];
    return [{
      id: `module-${index + 1}-${slugify(module.title)}`,
      module: module.title || `Module ${index + 1}`,
      title: module.quiz || `${module.title || `Module ${index + 1}`} Quiz`,
      passPercent: 60,
      maxAttempts: 3,
      requiredToUnlock: module.unlockRule !== "manual",
      questions: module.generatedQuestions.map((question, questionIndex) => ({
        id: `module-${index + 1}-q${questionIndex + 1}`,
        text: question.question,
        options: question.options,
        answer: question.answer,
      })),
    }];
  });
}

function videoContext(module: ModuleItem) {
  if (module.videoSource === "upload") return module.uploadedVideoName ? `uploaded video "${module.uploadedVideoName}"` : "uploaded teaching video";
  if (module.videoUrl.includes("youtube.com") || module.videoUrl.includes("youtu.be")) return "linked YouTube lesson";
  return "teaching video";
}

function topicBank(topic: string) {
  const lower = topic.toLowerCase();
  if (lower.includes("footprint") || lower.includes("recon")) {
    return ["open-source intelligence", "passive reconnaissance", "active reconnaissance", "scope control", "evidence notes"];
  }
  if (lower.includes("scan")) return ["host discovery", "port scanning", "service detection", "scan timing", "false positives"];
  if (lower.includes("enumeration")) return ["service enumeration", "user discovery", "banner grabbing", "permission boundaries", "documentation"];
  if (lower.includes("vulnerab")) return ["vulnerability severity", "CVSS basics", "verification", "remediation priority", "risk reporting"];
  if (lower.includes("malware")) return ["malware behavior", "indicators of compromise", "safe analysis", "persistence", "containment"];
  if (lower.includes("sniff") || lower.includes("spoof")) return ["packet capture", "ARP spoofing", "traffic inspection", "mitigation", "ethical limits"];
  if (lower.includes("system")) return ["privilege concepts", "access control", "hardening", "audit trails", "least privilege"];
  return ["authorized testing", "core terminology", "practical workflow", "common mistake", "completion criteria"];
}

function buildFiveQuestions(module: ModuleItem): QuizQuestion[] {
  const topic = module.title.trim() || "this module";
  const source = videoContext(module);
  const concepts = topicBank(topic);

  return concepts.slice(0, 5).map((concept, index) => ({
    question: `Q${index + 1}. In ${topic}, what best describes ${concept} from the ${source}?`,
    options: [
      `The correct ${concept} concept applied within the lesson scope`,
      "A random action outside the module objective",
      "A shortcut that skips verification and notes",
      "Only watching the video without understanding the concept"
    ],
    answer: `The correct ${concept} concept applied within the lesson scope`,
    explanation: `Expected answer should match the ${topic} lesson objective and the admin-provided video/resource material.`
  }));
}

export function CourseContentBuilder({ courseId }: CourseContentBuilderProps) {
  const modulesStorageKey = `course-editor-modules-${courseId}-v2`;
  const moduleQuizStorageKey = `course-module-quizzes-${courseId}-v2`;
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [draft, setDraft] = useState<ModuleItem>(normalizeModule({ title: "" }));
  const [notice, setNotice] = useState("No modules yet. Add the first module when you are ready.");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadModules() {
      const snapshot = await getAdminSnapshot<ModuleItem[]>(modulesStorageKey);
      if (!active) return;
      if (snapshot?.length) {
        const normalized = normalizeModuleSequence(removeLegacyDemoModules(snapshot.map((module) => normalizeModule(module))));
        setModules(normalized);
        if (normalized[0]) {
          setSelectedIndex(0);
          setDraft(normalized[0]);
          setNotice("Saved course modules loaded from database.");
        } else {
          setNotice("Demo modules removed. Add your first module.");
          void saveAdminSnapshot(modulesStorageKey, []);
        }
        setHydrated(true);
        return;
      }

      const saved = window.localStorage.getItem(modulesStorageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as ModuleItem[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            const normalized = normalizeModuleSequence(removeLegacyDemoModules(parsed.map((module) => normalizeModule(module))));
            setModules(normalized);
            if (normalized[0]) {
              setSelectedIndex(0);
              setDraft(normalized[0]);
              setNotice("Saved course modules loaded.");
            }
          }
        } catch {
          window.localStorage.removeItem(modulesStorageKey);
        }
      }
      setHydrated(true);
    }
    void loadModules();

    return () => {
      active = false;
    };
  }, [modulesStorageKey]);

  useEffect(() => {
    if (!hydrated) return;
    const sequencedModules = normalizeModuleSequence(modules);
    window.localStorage.setItem(modulesStorageKey, JSON.stringify(sequencedModules));
    void saveAdminSnapshot(modulesStorageKey, sequencedModules).catch((error) => {
      setNotice(error instanceof Error ? error.message : "Course modules could not be saved to the database.");
    });
    const moduleQuizzes = sequencedModules
      .filter((module) => module.generatedQuestions.length > 0)
      .map((module, moduleIndex) => ({
        id: `MQ-${moduleIndex + 1}-${slugify(module.title)}`,
        module: module.title,
        title: module.quiz || `${module.title} Quiz`,
        passPercent: 60,
        requiredToUnlock: module.unlockRule !== "manual",
        questions: module.generatedQuestions.map((question, questionIndex) => ({
          id: `${slugify(module.title)}-Q${questionIndex + 1}`,
          text: question.question.replace(/^Q\d+\.\s*/, ""),
          type: "MCQ",
          marks: 2,
          options: question.options,
          answer: question.answer
        }))
      }));
    window.localStorage.setItem(moduleQuizStorageKey, JSON.stringify(moduleQuizzes));
    void saveAdminSnapshot(moduleQuizStorageKey, moduleQuizzes).catch((error) => {
      setNotice(error instanceof Error ? error.message : "Course quiz draft could not be saved to the database.");
    });
    // Course module quizzes stay inside the course flow. Remove only legacy
    // module quiz records created by older builds; separately authored course
    // assessments are preserved.
    void getCourseAssessments<StoredAssessment[]>(courseId)
      .then((existing) => saveCourseAssessments(courseId, [
        ...(existing ?? []).filter((item) => !String(item.id ?? "").startsWith("module-")),
      ]))
      .catch((error) => setNotice(error instanceof Error ? error.message : "Legacy module quiz cleanup could not be saved."));
  }, [courseId, hydrated, moduleQuizStorageKey, modules, modulesStorageKey]);

  const selectedModule = modules[selectedIndex];

  // Keep the selected editor draft and the persisted module collection in
  // sync. The old flow only saved when the admin remembered to press Update,
  // so changing modules could discard a complete lesson or quiz.
  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      setModules((current) => {
        if (!current[selectedIndex]) return current;
        const next = [...current];
        next[selectedIndex] = draft;
        return normalizeModuleSequence(next);
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [draft, hydrated, selectedIndex]);

  const completionRule = useMemo(() => {
    if (draft.unlockRule === "video") return "Next module opens after video completion.";
    if (draft.unlockRule === "manual") return "Next module opens only after admin unlock.";
    return "Next module opens after video completion and quiz pass.";
  }, [draft.unlockRule]);

  function selectModule(index: number) {
    // Commit immediately as well, so a rapid click between module rows never
    // races the short autosave debounce above.
    if (modules[selectedIndex]) {
      setModules((current) => {
        const next = [...current];
        next[selectedIndex] = draft;
        return normalizeModuleSequence(next);
      });
    }
    setSelectedIndex(index);
    setDraft(modules[index]);
    setNotice(`Editing ${modules[index].title}`);
  }

  function persistModule(nextDraft = draft) {
    const next = [...modules];
    next[selectedIndex] = nextDraft;
    setModules(next);
    setDraft(nextDraft);
    setNotice(`${nextDraft.title} updated and saved.`);
  }

  function addModule() {
    const next = normalizeModule({
      title: "",
      videoUrl: "",
      quiz: "",
      locked: modules.length > 0,
      unlockRule: "video_quiz"
    });
    const nextModules = normalizeModuleSequence([...modules, next]);
    setModules(nextModules);
    setSelectedIndex(nextModules.length - 1);
    setDraft(next);
    setNotice("Blank module added. Enter the content you want.");
  }

  function deleteModule(index: number) {
    const next = normalizeModuleSequence(modules.filter((_, itemIndex) => itemIndex !== index));
    setModules(next);
    const safeIndex = Math.max(0, Math.min(selectedIndex, next.length - 1));
    setSelectedIndex(safeIndex);
    setDraft(next[safeIndex] ?? normalizeModule({ title: "New Module" }));
    setNotice("Module removed and course content saved.");
  }

  function generateQuiz() {
    const questions = buildFiveQuestions(draft);
    persistModule({
      ...draft,
      quiz: draft.quiz || `${draft.title} - 5 Question Check`,
      generatedQuestions: questions
    });
  }

  function updateGeneratedQuestion(index: number, question: QuizQuestion) {
    const next = [...draft.generatedQuestions];
    next[index] = question;
    setDraft({ ...draft, generatedQuestions: next });
  }

  function addManualQuestion() {
    setDraft({
      ...draft,
      generatedQuestions: [
        ...draft.generatedQuestions,
        {
          question: `Question ${draft.generatedQuestions.length + 1}: `,
          options: ["Option A", "Option B", "Option C", "Option D"],
          answer: "Option A",
          explanation: ""
        }
      ]
    });
  }

  function removeGeneratedQuestion(index: number) {
    setDraft({
      ...draft,
      generatedQuestions: draft.generatedQuestions.filter((_, itemIndex) => itemIndex !== index)
    });
  }

  return (
    <div className="grid gap-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-950">Course Modules ({modules.length})</h2>
          <p className="mt-1 text-sm text-slate-500">{notice}</p>
        </div>
        <button type="button" onClick={addModule} className="flex h-10 items-center gap-2 rounded-md bg-portal-blue px-4 text-sm font-bold text-white">
          <Plus size={17} />
          Add Module
        </button>
      </div>

      <div className="rounded-lg border border-portal-line bg-white">
        <div className="divide-y divide-portal-line">
          {modules.map((module, index) => (
            <div key={`${module.title}-${index}`} className={`flex min-h-14 items-center gap-3 px-4 py-3 ${selectedIndex === index ? "bg-blue-50" : ""}`}>
              <GripVertical size={17} className="text-slate-400" />
              <span className="w-6 text-sm font-bold text-slate-500">{index + 1}</span>
              <button type="button" onClick={() => selectModule(index)} className="flex-1 text-left text-sm font-semibold text-slate-800">
                {module.title || "Untitled module"}
                <span className="ml-2 text-xs font-normal text-slate-500">
                  {module.videoSource === "youtube" ? "YouTube" : "Uploaded video"} / {module.generatedQuestions.length || 0} quiz questions
                </span>
              </button>
              <span className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold ${module.locked ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                <Lock size={13} />
                {module.locked ? "Locked" : "Open"}
              </span>
              <button type="button" onClick={() => selectModule(index)} className="text-slate-500" aria-label="Edit module">
                <Pencil size={17} />
              </button>
              <button type="button" onClick={() => deleteModule(index)} className="text-red-500" aria-label="Delete module">
                <Trash2 size={17} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {selectedModule ? (
        <div className="rounded-lg border border-portal-line bg-white p-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-bold text-slate-950">Edit Module Content</h3>
            <div className="flex gap-3">
              <button type="button" onClick={generateQuiz} className="h-10 rounded-md border border-portal-line px-4 text-sm font-bold text-portal-blue">
                Generate 5 Questions
              </button>
              <button type="button" onClick={() => persistModule()} className="h-10 rounded-md bg-portal-blue px-4 text-sm font-bold text-white">
                Update Module
              </button>
            </div>
          </div>
          <div className="grid gap-5">
            <div className="max-w-md">
              <span className="mb-2 block text-sm font-bold text-slate-700">Module Image</span>
              <div className="grid h-44 w-full place-items-center overflow-hidden rounded-lg border border-portal-line bg-slate-50">
                {draft.imageUrl ? (
                  <img src={draft.imageUrl} alt="Module preview" className="h-full w-full object-cover" />
                ) : (
                  <ImagePlus className="text-slate-400" />
                )}
              </div>
              <label className="mt-3 flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-portal-line text-sm font-bold text-portal-blue">
                <Upload size={17} />
                Add Image
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => setDraft({ ...draft, imageUrl: String(reader.result), imageName: file.name });
                    reader.readAsDataURL(file);
                  }}
                />
              </label>
              {draft.imageName ? <p className="mt-2 text-xs font-semibold text-slate-500">{draft.imageName}</p> : null}
            </div>
            <div className="grid gap-4">
              <label>
                <span className="mb-2 block text-sm font-bold text-slate-700">Module Title</span>
                <input className="h-11 w-full rounded-md border border-portal-line px-3 outline-none focus:border-portal-blue" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
              </label>

              <div>
                <span className="mb-2 block text-sm font-bold text-slate-700">Teaching Video Source</span>
                <div className="grid gap-3">
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, videoSource: "youtube" })}
                    className={`flex h-11 items-center justify-center gap-2 rounded-md border text-sm font-bold ${draft.videoSource === "youtube" ? "border-portal-blue bg-blue-50 text-portal-blue" : "border-portal-line text-slate-700"}`}
                  >
                    <Youtube size={17} />
                    YouTube Link
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, videoSource: "upload" })}
                    className={`flex h-11 items-center justify-center gap-2 rounded-md border text-sm font-bold ${draft.videoSource === "upload" ? "border-portal-blue bg-blue-50 text-portal-blue" : "border-portal-line text-slate-700"}`}
                  >
                    <Video size={17} />
                    Upload Own Video
                  </button>
                </div>
              </div>

              {draft.videoSource === "youtube" ? (
                <label>
                  <span className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700"><Youtube size={17} className="text-red-500" />YouTube Video Link</span>
                  <input className="h-11 w-full rounded-md border border-portal-line px-3 outline-none focus:border-portal-blue" value={draft.videoUrl} onChange={(event) => setDraft({ ...draft, videoUrl: event.target.value })} placeholder="Paste YouTube lesson link here" />
                </label>
              ) : (
                <label className="flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-md border border-portal-line px-4">
                  <span className="flex items-center gap-2 text-sm font-bold text-slate-700"><PlaySquare size={18} className="text-portal-blue" />{draft.uploadedVideoName || "Upload MP4/WebM teaching video"}</span>
                  <span className="text-sm font-bold text-portal-blue">Choose</span>
                  <input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) setDraft({ ...draft, uploadedVideoName: file.name, uploadedVideoUrl: URL.createObjectURL(file) });
                    }}
                  />
                </label>
              )}

              <label>
                <span className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700"><HelpCircle size={17} className="text-portal-blue" />Quiz After This Module</span>
                <input className="h-11 w-full rounded-md border border-portal-line px-3 outline-none focus:border-portal-blue" value={draft.quiz} onChange={(event) => setDraft({ ...draft, quiz: event.target.value })} placeholder="Quiz title or quiz ID" />
              </label>

              <div>
                <span className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700"><FileText size={17} className="text-portal-blue" />Module Resources</span>
                <label className="flex min-h-11 cursor-pointer items-center justify-between rounded-md border border-portal-line px-3 text-sm">
                  <span className="font-semibold text-slate-600">Upload PDF, PPT, DOCX, ZIP, or worksheet files</span>
                  <span className="font-bold text-portal-blue">Add Files</span>
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={async (event) => {
                      const files = Array.from(event.target.files ?? []);
                      const resources = await Promise.all(files.map((file) => new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(String(reader.result));
                        reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
                        reader.readAsDataURL(file);
                      })));
                      setDraft({ ...draft, resources: [...draft.resources, ...resources] });
                    }}
                  />
                </label>
                {draft.resources.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {draft.resources.map((resource) => (
                      <span key={resource} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{resource.startsWith("data:") ? "Uploaded resource" : resource}</span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="grid gap-4">
                <label>
                  <span className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700"><Link2 size={17} className="text-portal-blue" />Unlock Rule</span>
                  <select className="h-11 w-full rounded-md border border-portal-line px-3" value={draft.unlockRule} onChange={(event) => setDraft({ ...draft, unlockRule: event.target.value as ModuleItem["unlockRule"] })}>
                    <option value="video_quiz">Finish video + pass quiz</option>
                    <option value="video">Finish video only</option>
                    <option value="manual">Manual admin unlock</option>
                  </select>
                </label>
                <label className="flex items-end gap-3 pb-3">
                  <input type="checkbox" checked={draft.locked} onChange={(event) => setDraft({ ...draft, locked: event.target.checked })} className="h-5 w-5 accent-portal-blue" />
                  <span className="text-sm font-bold text-slate-700">Lock this module until previous completion</span>
                </label>
              </div>
              <p className="rounded-md bg-blue-50 p-3 text-sm font-semibold text-slate-700">{completionRule}</p>

              <div className="rounded-md border border-portal-line">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-portal-line px-4 py-3">
                  <div>
                    <p className="font-bold text-slate-950">{draft.quiz || "Module Quiz"}</p>
                    <p className="text-xs text-slate-500">Add as many questions as needed. Admin can generate, edit, or enter them manually.</p>
                  </div>
                  <button
                    type="button"
                    onClick={addManualQuestion}
                    className="h-9 rounded-md border border-portal-line px-3 text-xs font-bold text-portal-blue"
                  >
                    Add Manual Question
                  </button>
                </div>
                {draft.generatedQuestions.length ? (
                  <div className="divide-y divide-portal-line">
                    {draft.generatedQuestions.map((question, index) => (
                      <div key={`${question.question}-${index}`} className="grid gap-3 p-4 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-bold text-slate-800">Question {index + 1}</p>
                          <button type="button" onClick={() => removeGeneratedQuestion(index)} className="text-red-500" aria-label="Remove question">
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <textarea
                          value={question.question.replace(/^Q\d+\.\s*/, "")}
                          onChange={(event) => updateGeneratedQuestion(index, { ...question, question: event.target.value })}
                          className="min-h-20 rounded-md border border-portal-line p-3 outline-none focus:border-portal-blue"
                          placeholder="Enter question"
                        />
                        <div className="grid gap-3 sm:grid-cols-2">
                          {question.options.slice(0, 4).map((option, optionIndex) => (
                            <input
                              key={optionIndex}
                              value={option}
                              onChange={(event) => {
                                const options = [...question.options];
                                options[optionIndex] = event.target.value;
                                updateGeneratedQuestion(index, { ...question, options });
                              }}
                              className="h-10 rounded-md border border-portal-line px-3 outline-none focus:border-portal-blue"
                              placeholder={`Option ${optionIndex + 1}`}
                            />
                          ))}
                        </div>
                        <input
                          value={question.answer}
                          onChange={(event) => updateGeneratedQuestion(index, { ...question, answer: event.target.value })}
                          className="h-10 rounded-md border border-emerald-200 bg-emerald-50 px-3 font-semibold text-emerald-700 outline-none focus:border-emerald-500"
                          placeholder="Correct answer"
                        />
                        <textarea
                          value={question.explanation ?? ""}
                          onChange={(event) => updateGeneratedQuestion(index, { ...question, explanation: event.target.value })}
                          className="min-h-16 rounded-md border border-portal-line p-3 outline-none focus:border-portal-blue"
                          placeholder="Explanation or evaluation note"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-sm font-semibold text-slate-500">Generate suggested questions or add questions manually.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

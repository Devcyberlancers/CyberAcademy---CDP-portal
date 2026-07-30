"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, ChevronDown, Save, Send } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { createCourseInDb, publishCourseInDb } from "@/lib/admin-api";
import { type AdminCourse, loadCourseCatalog, normalizeCourse, saveCourseCatalog, uniqueCourseId } from "@/lib/course-catalog";

const emptyCourse = {
  title: "",
  category: "",
  instructor: "",
  level: "",
  duration: "",
  shortDescription: "",
  description: "",
  visibility: ""
};

export default function NewCoursePage() {
  const router = useRouter();
  const [catalog, setCatalog] = useState<AdminCourse[]>([]);
  const [form, setForm] = useState(emptyCourse);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showOptional, setShowOptional] = useState(false);

  useEffect(() => {
    loadCourseCatalog().then(setCatalog).catch(() => setCatalog([]));
  }, []);

  const completedRequired = useMemo(
    () => [form.title, form.instructor, form.shortDescription].filter((value) => value.trim()).length,
    [form.instructor, form.shortDescription, form.title]
  );

  async function createCourse(pushToStudents = false) {
    const title = form.title.trim();
    if (!title || !form.instructor.trim() || !form.shortDescription.trim() || !form.category) {
      setError("Complete the course title, instructor, category, and student summary.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const course = normalizeCourse({
        ...form,
        id: uniqueCourseId(title, catalog),
        title,
        status: "Draft",
        students: 0,
        completion: 0,
        modules: 0,
        lessons: 0
      });
      const created = await createCourseInDb({
        title: course.title,
        short_description: course.shortDescription,
        description: course.description,
        category: course.category,
        instructor: course.instructor,
        level: course.level,
        duration: course.duration,
        language: "English",
        visibility: course.visibility.toLowerCase(),
        modules: []
      });
      const databaseCourse = normalizeCourse({ ...course, id: String(created.id) });
      if (pushToStudents) {
        await publishCourseInDb(databaseCourse.id);
        databaseCourse.status = "Published";
      }
      await saveCourseCatalog([databaseCourse, ...catalog.filter((item) => item.id !== course.id)]);
      router.push(`/admin/courses/${encodeURIComponent(databaseCourse.id)}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Course could not be saved.");
      setSaving(false);
    }
  }

  const inputClass = "h-11 w-full rounded-lg border border-portal-line bg-white px-3 outline-none transition focus:border-portal-blue focus:ring-2 focus:ring-blue-100";

  return (
    <AdminShell title="Create Course" subtitle="Start with the basics. Add modules and assessments after the course is created.">
      <div className="mx-auto grid max-w-6xl gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <section className="overflow-hidden rounded-xl border border-portal-line bg-white shadow-sm">
          <div className="border-b border-portal-line bg-gradient-to-r from-blue-50 to-white px-6 py-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-portal-blue">Step 1 of 3</p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">Course basics</h2>
                <p className="mt-1 text-sm text-slate-500">Only three fields are required to get started.</p>
              </div>
              <Link href="/admin/courses" className="flex h-10 items-center gap-2 rounded-lg border border-portal-line bg-white px-4 text-sm font-bold text-slate-700">
                <ArrowLeft size={17} /> Back
              </Link>
            </div>
          </div>

          <div className="grid gap-5 p-6 md:grid-cols-2">
            <label className="md:col-span-2">
              <span className="mb-2 block text-sm font-bold text-slate-700">Course title *</span>
              <input autoFocus value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className={inputClass} placeholder="Example: Cybersecurity Foundations" />
            </label>
            <label>
              <span className="mb-2 block text-sm font-bold text-slate-700">Instructor *</span>
              <input value={form.instructor} onChange={(event) => setForm({ ...form, instructor: event.target.value })} className={inputClass} />
            </label>
            <label>
              <span className="mb-2 block text-sm font-bold text-slate-700">Category</span>
              <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className={inputClass}>
                <option value="" disabled>Select category</option>
                <option>Cyber Security</option><option>Placement Prep</option><option>Programming</option><option>Assessment</option><option>General</option>
              </select>
            </label>
            <label className="md:col-span-2">
              <span className="mb-2 block text-sm font-bold text-slate-700">Student summary *</span>
              <textarea value={form.shortDescription} onChange={(event) => setForm({ ...form, shortDescription: event.target.value })} className="h-24 w-full rounded-lg border border-portal-line p-3 outline-none transition focus:border-portal-blue focus:ring-2 focus:ring-blue-100" placeholder="What will students learn in this course?" />
            </label>
          </div>

          <div className="border-t border-portal-line px-6 py-4">
            <button type="button" onClick={() => setShowOptional((current) => !current)} className="flex w-full items-center justify-between text-left">
              <span><strong className="block text-sm text-slate-800">Optional details</strong><span className="text-xs text-slate-500">Level, duration, visibility and detailed description</span></span>
              <ChevronDown size={19} className={`transition ${showOptional ? "rotate-180" : ""}`} />
            </button>
            {showOptional ? (
              <div className="mt-5 grid gap-5 md:grid-cols-3">
                <label><span className="mb-2 block text-sm font-bold text-slate-700">Level</span><select value={form.level} onChange={(event) => setForm({ ...form, level: event.target.value })} className={inputClass}><option value="" disabled>Select level</option><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></label>
                <label><span className="mb-2 block text-sm font-bold text-slate-700">Duration</span><input value={form.duration} onChange={(event) => setForm({ ...form, duration: event.target.value })} className={inputClass} /></label>
                <label><span className="mb-2 block text-sm font-bold text-slate-700">Visibility</span><select value={form.visibility} onChange={(event) => setForm({ ...form, visibility: event.target.value })} className={inputClass}><option value="" disabled>Select visibility</option><option>Public</option><option>Batch-only</option><option>Invite-only</option></select></label>
                <label className="md:col-span-3"><span className="mb-2 block text-sm font-bold text-slate-700">Detailed description</span><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="h-28 w-full rounded-lg border border-portal-line p-3 outline-none focus:border-portal-blue" placeholder="Outcomes, prerequisites, and instructions" /></label>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-portal-line bg-slate-50 px-6 py-5">
            <div>{error ? <p className="text-sm font-bold text-red-600">{error}</p> : <p className="text-sm text-slate-500">Save a draft for later, or push it to the Student Panel immediately.</p>}</div>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => void createCourse(false)} disabled={saving} className="flex h-11 items-center gap-2 rounded-lg border border-portal-line bg-white px-5 text-sm font-bold text-slate-700 disabled:opacity-60">
                <Save size={17} />
                {saving ? "Saving..." : "Save Draft"}
              </button>
              <button type="button" onClick={() => void createCourse(true)} disabled={saving} className="flex h-11 items-center gap-2 rounded-lg bg-portal-blue px-6 text-sm font-bold text-white shadow-sm disabled:opacity-60">
                {saving ? <Save size={17} /> : <Send size={17} />}
                {saving ? "Saving..." : "Save & Push to Student Panel"}
              </button>
            </div>
          </div>
        </section>

        <aside className="h-fit rounded-xl border border-portal-line bg-white p-5 shadow-sm">
          <p className="text-sm font-bold text-slate-950">Setup progress</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-portal-blue transition-all" style={{ width: `${completedRequired / 3 * 100}%` }} /></div>
          <p className="mt-2 text-xs text-slate-500">{completedRequired} of 3 required fields complete</p>
          <div className="mt-6 space-y-4 text-sm">
            <ProgressItem done={completedRequired === 3} label="Course basics" />
            <ProgressItem done={false} label="Add modules and lessons" />
            <ProgressItem done={false} label="Add assessments and publish" />
          </div>
        </aside>
      </div>
    </AdminShell>
  );
}

function ProgressItem({ done, label }: { done: boolean; label: string }) {
  return <div className="flex items-center gap-3"><span className={`grid h-7 w-7 place-items-center rounded-full ${done ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}><Check size={15} /></span><span className={done ? "font-semibold text-slate-800" : "text-slate-500"}>{label}</span></div>;
}

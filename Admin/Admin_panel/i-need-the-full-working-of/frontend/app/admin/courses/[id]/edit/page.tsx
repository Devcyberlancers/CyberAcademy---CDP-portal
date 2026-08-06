"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { studentPortalUrl } from "@/lib/urls";
import { AdminShell } from "@/components/admin/AdminShell";
import { CourseAssessmentCurriculum } from "@/components/admin/CourseAssessmentCurriculum";
import { CourseAssessmentReview } from "@/components/admin/CourseAssessmentReview";
import { CourseBannerPicker } from "@/components/admin/CourseBannerPicker";
import { CourseContentBuilder } from "@/components/admin/CourseContentBuilder";
import { SectionCard } from "@/components/admin/SectionCard";
import { type AdminCourse, loadCourseCatalog, normalizeCourse, readLocalCourseCatalog, saveCourseCatalog } from "@/lib/course-catalog";
import { getAdminSnapshot, moveCourseToDraftInDb, publishCourseInDb, saveAdminSnapshot, updateCourseInDb } from "@/lib/admin-api";
import { Calendar, CheckCircle2, Eye, Lock, Save, Send, Settings2 } from "lucide-react";

const tabs = ["Course Information", "Assessments", "Settings", "Publish"] as const;
type CourseTab = (typeof tabs)[number];

export default function EditCoursePage() {
  const [activeTab, setActiveTab] = useState<CourseTab>("Course Information");
  const params = useParams<{ id: string }>();
  const courseId = decodeURIComponent(params.id ?? "ethical-hacking");
  const [catalog, setCatalog] = useState<AdminCourse[]>(readLocalCourseCatalog());
  const [course, setCourse] = useState<AdminCourse>(() => {
    const found = readLocalCourseCatalog().find((item) => item.id === courseId);
    return found ?? normalizeCourse({ id: courseId, title: courseId.replace(/-/g, " ") });
  });
  const [notice, setNotice] = useState("Course editor ready.");

  useEffect(() => {
    let active = true;
    loadCourseCatalog().then((items) => {
      if (!active) return;
      setCatalog(items);
      const found = items.find((item) => item.id === courseId);
      if (found) {
        setCourse(found);
        setNotice(`${found.title} loaded from saved catalog.`);
      }
    }).catch(() => setNotice("Loaded local course editor. Start backend to sync with MySQL."));
    return () => {
      active = false;
    };
  }, [courseId]);

  async function updateCourse(status?: AdminCourse["status"]) {
    setNotice("Saving course changes...");
    if (!course.title.trim()) {
      setNotice("Course title is required.");
      return;
    }
    try {
      await updateCourseInDb(courseId, {
        title: course.title,
        short_description: course.shortDescription,
        description: course.description,
        category: course.category,
        instructor: course.instructor,
        level: course.level,
        duration: course.duration,
        visibility: course.visibility.toLowerCase()
      });
      if (status === "Published") {
        await publishCourseInDb(courseId);
      } else if (status === "Draft") {
        await moveCourseToDraftInDb(courseId);
      }
      const nextCourse = normalizeCourse({ ...course, status: status ?? course.status, updated: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) });
      const exists = catalog.some((item) => item.id === nextCourse.id);
      const nextCatalog = exists ? catalog.map((item) => item.id === nextCourse.id ? nextCourse : item) : [nextCourse, ...catalog];
      setCourse(nextCourse);
      setCatalog(nextCatalog);
      await saveCourseCatalog(nextCatalog);
      setNotice(status === "Published" ? `${nextCourse.title} is published and visible in the Student Portal.` : `${nextCourse.title} saved to the shared database.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Course changes could not be saved.");
    }
  }

  return (
    <AdminShell title="Edit Course" subtitle={`Dashboard > Courses > ${course.title}`}>
      <div className="grid gap-5">
        <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-portal-line bg-white/95 p-4 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className={`rounded-full px-3 py-1 font-bold ${course.status === "Published" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{course.status}</span>
            <span className="text-slate-500">{course.category} · {course.level} · {course.duration}</span>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href={`${studentPortalUrl}/courses/${encodeURIComponent(courseId)}`} target="_blank" rel="noreferrer" className="flex h-10 items-center gap-2 rounded-md border border-portal-line px-4 text-sm font-bold text-slate-700"><Eye size={17} /> Preview</a>
            <button type="button" onClick={() => updateCourse("Draft")} className="flex h-10 items-center gap-2 rounded-md border border-portal-line px-4 text-sm font-bold text-slate-700"><Save size={17} /> Save Draft</button>
            <button type="button" onClick={() => updateCourse()} className="h-10 rounded-md bg-portal-blue px-5 text-sm font-bold text-white">Save Changes</button>
            <button type="button" onClick={() => updateCourse("Published")} className="flex h-10 items-center gap-2 rounded-md bg-emerald-600 px-5 text-sm font-bold text-white"><Send size={17} /> Save & Push to Student Panel</button>
          </div>
        </div>

        <SectionCard>
          <div className="mb-6 flex flex-wrap gap-6 border-b border-portal-line text-sm font-bold text-slate-600">
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`pb-4 transition ${activeTab === tab ? "border-b-2 border-portal-blue text-portal-blue" : "hover:text-slate-900"}`}
              >
                {tab}
              </button>
            ))}
          </div>

          {notice ? <p className="mb-4 rounded-md bg-blue-50 px-4 py-3 text-sm font-semibold text-slate-700">{notice}</p> : null}
          {activeTab === "Course Information" && (
            <div className="grid gap-7">
              <CourseInformationTab course={course} onChange={setCourse} />
              <div className="border-t border-portal-line pt-7">
                <CourseContentBuilder courseId={courseId} />
              </div>
              <CourseSummary course={course} />
            </div>
          )}
          {activeTab === "Assessments" && (
            <div className="grid gap-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-blue-100 bg-blue-50 p-4 text-sm text-slate-700">
                <span>Build this course final assessment here. Students are redirected to it after finishing the course modules.</span>
                <a href={`${studentPortalUrl}/dashboard/student?section=assessments`} target="_blank" rel="noreferrer" className="rounded-md bg-portal-blue px-4 py-2 text-sm font-bold text-white">Open Student Preview</a>
              </div>
              <CourseAssessmentCurriculum courseId={courseId} />
              <CourseAssessmentReview courseId={courseId} />
            </div>
          )}
          {activeTab === "Settings" && <CourseSettingsTab courseId={courseId} course={course} onChange={setCourse} />}
          {activeTab === "Publish" && <PublishTab courseId={courseId} onPublish={() => updateCourse("Published")} onDraft={() => updateCourse("Draft")} />}
        </SectionCard>
      </div>
    </AdminShell>
  );
}

function CourseSummary({ course }: { course: AdminCourse }) {
  return (
    <div className="grid gap-3 rounded-xl border border-portal-line bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-6">
      <InfoRow label="Course ID" value={course.id} />
      <InfoRow label="Status" value={course.status} valueClass={course.status === "Published" ? "text-emerald-600" : "text-amber-600"} />
      <InfoRow label="Updated" value={course.updated} />
      <InfoRow label="Students" value={String(course.students)} />
      <InfoRow label="Lessons" value={String(course.lessons)} />
      <InfoRow label="Assessments" value="Final + quizzes" />
    </div>
  );
}

function InfoRow({ label, value, valueClass = "" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`mt-1 truncate font-bold ${valueClass}`}>{value}</dd>
    </div>
  );
}

function CourseInformationTab({ course, onChange }: { course: AdminCourse; onChange: (course: AdminCourse) => void }) {
  return (
    <>
      <div className="grid gap-5 lg:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-slate-700">Course Title *</span>
          <input className="h-11 w-full rounded-md border border-portal-line px-3 outline-none focus:border-portal-blue" value={course.title} onChange={(event) => onChange({ ...course, title: event.target.value })} />
        </label>
        <CourseBannerPicker courseId={course.id} />
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-slate-700">Short Description *</span>
          <textarea className="h-28 w-full rounded-md border border-portal-line p-3 outline-none focus:border-portal-blue" value={course.shortDescription} onChange={(event) => onChange({ ...course, shortDescription: event.target.value })} />
        </label>
        <div className="grid gap-5 sm:grid-cols-2">
          <label>
            <span className="mb-2 block text-sm font-bold text-slate-700">Category *</span>
            <select className="h-11 w-full rounded-md border border-portal-line px-3" value={course.category} onChange={(event) => onChange({ ...course, category: event.target.value })}>
              <option>Cyber Security</option>
              <option>Placement Prep</option>
              <option>Programming</option>
              <option>Assessment</option>
              <option>General</option>
            </select>
          </label>
          <label>
            <span className="mb-2 block text-sm font-bold text-slate-700">Instructor *</span>
            <input className="h-11 w-full rounded-md border border-portal-line px-3" value={course.instructor} onChange={(event) => onChange({ ...course, instructor: event.target.value })} />
          </label>
          <label>
            <span className="mb-2 block text-sm font-bold text-slate-700">Level *</span>
            <select className="h-11 w-full rounded-md border border-portal-line px-3" value={course.level} onChange={(event) => onChange({ ...course, level: event.target.value })}>
              <option>Beginner</option>
              <option>Intermediate</option>
              <option>Advanced</option>
            </select>
          </label>
          <label>
            <span className="mb-2 block text-sm font-bold text-slate-700">Duration</span>
            <input className="h-11 w-full rounded-md border border-portal-line px-3" value={course.duration} onChange={(event) => onChange({ ...course, duration: event.target.value })} />
          </label>
        </div>
      </div>
      <label className="mt-5 block">
        <span className="mb-2 block text-sm font-bold text-slate-700">Detailed Description</span>
        <textarea className="h-32 w-full rounded-md border border-portal-line p-3 outline-none focus:border-portal-blue" value={course.description} onChange={(event) => onChange({ ...course, description: event.target.value })} />
      </label>
    </>
  );
}

type CourseSchedule = { startDate: string; endDate: string; unlockRule: string; certificateEnabled: boolean };

function CourseSettingsTab({ courseId, course, onChange }: { courseId: string; course: AdminCourse; onChange: (course: AdminCourse) => void }) {
  const [schedule, setSchedule] = useState<CourseSchedule>({ startDate: "", endDate: "", unlockRule: "video_quiz", certificateEnabled: true });
  const [settingsNotice, setSettingsNotice] = useState("");

  useEffect(() => {
    getAdminSnapshot<CourseSchedule>(`course-settings-${courseId}-v1`).then((saved) => {
      if (saved) setSchedule(saved);
    });
  }, [courseId]);

  async function persistSettings() {
    await saveAdminSnapshot(`course-settings-${courseId}-v1`, schedule);
    setSettingsNotice("Course settings saved.");
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <label className="flex items-center justify-between rounded-md border border-portal-line p-4">
        <span>
          <span className="block font-bold text-slate-800">Published</span>
          <span className="text-sm text-slate-500">Students can see this course.</span>
        </span>
        <input type="checkbox" checked={course.status === "Published"} onChange={(event) => onChange({ ...course, status: event.target.checked ? "Published" : "Draft" })} className="h-5 w-5 accent-portal-blue" />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-bold text-slate-700">Visibility</span>
        <select value={course.visibility} onChange={(event) => onChange({ ...course, visibility: event.target.value })} className="h-11 w-full rounded-md border border-portal-line px-3">
          <option>Public</option>
          <option>Batch-only</option>
          <option>Invite-only</option>
        </select>
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-bold text-slate-700">Start Date</span>
        <span className="flex h-11 items-center gap-2 rounded-md border border-portal-line px-3 text-sm"><Calendar size={17} /><input type="date" value={schedule.startDate} onChange={(event) => setSchedule({ ...schedule, startDate: event.target.value })} className="w-full outline-none" /></span>
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-bold text-slate-700">End Date</span>
        <span className="flex h-11 items-center gap-2 rounded-md border border-portal-line px-3 text-sm"><Calendar size={17} /><input type="date" value={schedule.endDate} onChange={(event) => setSchedule({ ...schedule, endDate: event.target.value })} className="w-full outline-none" /></span>
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-bold text-slate-700">Unlock Rule</span>
        <select value={schedule.unlockRule} onChange={(event) => setSchedule({ ...schedule, unlockRule: event.target.value })} className="h-11 w-full rounded-md border border-portal-line px-3">
          <option value="video_quiz">Complete video and pass quiz</option>
          <option value="video">Complete video only</option>
          <option value="manual">Manual admin unlock</option>
        </select>
      </label>
      <label className="flex items-center justify-between rounded-md border border-portal-line p-4">
        <span>
          <span className="block font-bold text-slate-800">Certificate Enabled</span>
          <span className="text-sm text-slate-500">Allow certificate after final course assessment.</span>
        </span>
        <input type="checkbox" checked={schedule.certificateEnabled} onChange={(event) => setSchedule({ ...schedule, certificateEnabled: event.target.checked })} className="h-5 w-5 accent-portal-blue" />
      </label>
      <div className="flex items-center gap-3 lg:col-span-2">
        <button type="button" onClick={persistSettings} className="h-11 rounded-md bg-portal-blue px-5 text-sm font-bold text-white">Save Settings</button>
        {settingsNotice ? <span className="text-sm font-semibold text-emerald-700">{settingsNotice}</span> : null}
      </div>
    </div>
  );
}

function PublishTab({ courseId, onPublish, onDraft }: { courseId: string; onPublish: () => void; onDraft: () => void }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
      <div className="rounded-md border border-portal-line p-5">
        <h3 className="text-lg font-bold text-slate-900">Publish Checklist</h3>
        <div className="mt-4 grid gap-3 text-sm">
          {[
            "Course information is complete",
            "Banner image is uploaded",
            "Modules include videos or YouTube links",
            "Course assessments are attached",
            "Unlock rules are configured"
          ].map((item) => (
            <div key={item} className="flex items-center gap-3 rounded-md bg-slate-50 p-3">
              <CheckCircle2 className="text-emerald-600" size={18} />
              <span className="font-semibold text-slate-700">{item}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-md border border-portal-line p-5">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-700"><Settings2 size={17} /> Final Actions</div>
        <a href={`${studentPortalUrl}/courses/${encodeURIComponent(courseId)}`} target="_blank" rel="noreferrer" className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-md border border-portal-line text-sm font-bold text-slate-700"><Eye size={17} /> Preview as Student</a>
        <button type="button" onClick={onDraft} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-md border border-portal-line text-sm font-bold text-slate-700"><Save size={17} /> Save as Draft</button>
        <button type="button" onClick={onPublish} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-portal-blue text-sm font-bold text-white"><Lock size={17} /> Publish to Student Portal</button>
      </div>
    </div>
  );
}

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, BriefcaseBusiness, ClipboardCheck, Download, ExternalLink, FileText, Mail, Phone, UserRound, X, ZoomIn } from "lucide-react";
import { useState } from "react";
import type { StudentRecord } from "@/lib/admin-store";
import type { AdminJobApplicationActivity, StudentLearningRecord } from "@/lib/admin-api";

type Props = {
  student: StudentRecord;
  learningRecord: StudentLearningRecord | null;
  jobs: AdminJobApplicationActivity[];
  onClose: () => void;
};

export function StudentProfilePreview({ student, learningRecord, jobs, onClose }: Props) {
  const [photoOpen, setPhotoOpen] = useState(false);
  const profile = student as StudentRecord & { photo_data_url?: string };
  const photo = profile.photoDataUrl || profile.photo_data_url || "";
  const resume = profile.resumeDataUrl || profile.resumeUrl || "";
  const assessments = [...(learningRecord?.courses.flatMap((course) => course.assessments) ?? []), ...(learningRecord?.standalone_assessments ?? [])];
  const educationDocuments = (student.educationDetails ?? []).filter((item) => item.markscardDataUrl);

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] bg-slate-950/55 p-0 backdrop-blur-sm sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} role="dialog" aria-modal="true" aria-label={`${student.name} profile preview`}>
        <motion.div initial={{ opacity: 0, y: 18, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: 0.99 }} transition={{ duration: 0.2 }} className="ml-auto flex h-full w-full max-w-5xl flex-col overflow-hidden bg-[#f6f8fc] shadow-2xl sm:h-[calc(100vh-2rem)] sm:rounded-2xl">
          <header className="flex shrink-0 items-center justify-between gap-4 border-b border-portal-line bg-white px-5 py-4 sm:px-7">
            <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-portal-blue">Student portal · monitoring mode</p><h2 className="mt-1 text-xl font-bold text-slate-950">Profile details</h2></div>
            <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full border border-portal-line text-slate-600 transition hover:bg-slate-50" aria-label="Close profile preview"><X size={20} /></button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
              <div className="space-y-5">
                <section className="rounded-2xl border border-portal-line bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                    <button type="button" onClick={() => photo && setPhotoOpen(true)} disabled={!photo} className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-portal-blue text-2xl font-bold text-white disabled:cursor-default">
                      {photo ? <img src={photo} alt={`${student.name} profile`} className="h-full w-full object-cover" /> : <span>{student.name.slice(0, 1).toUpperCase()}</span>}
                      {photo ? <span className="absolute inset-0 grid place-items-center bg-slate-950/45 opacity-0 transition group-hover:opacity-100"><ZoomIn size={22} /></span> : null}
                    </button>
                    <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-2xl font-bold text-slate-950">{student.name}</h3><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-portal-blue">Read only</span></div><p className="mt-1 text-sm text-slate-500">{student.regNo} · {student.status}</p><div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-600"><span className="flex items-center gap-1.5"><Mail size={15} />{student.email}</span>{student.phone ? <span className="flex items-center gap-1.5"><Phone size={15} />{student.phone}</span> : null}</div></div>
                  </div>
                </section>

                <PreviewSection icon={<UserRound size={18} />} title="Profile information"><InfoGrid rows={[["Full name", student.name], ["Official email", student.email], ["Personal email", student.personalEmail], ["Phone", student.phone], ["Gender", student.gender], ["Date of birth", student.dateOfBirth], ["Registration number", student.regNo], ["Batch", student.batch], ["Degree", student.degree], ["Department", student.branch], ["College", student.college], ["Mentor", student.mentorName], ["Profile status", student.status], ["Last login", student.lastLogin], ["Last profile update", student.updatedAt ? new Date(student.updatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) + " IST" : undefined]]} /></PreviewSection>
                <PreviewSection icon={<FileText size={18} />} title="Academic details"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{(student.educationSummary ?? []).map((item) => <div key={item.level} className="rounded-xl border border-portal-line bg-slate-50 p-4"><p className="font-bold text-slate-950">{item.level}</p><p className="mt-2 text-sm text-slate-500">{item.year_from || "—"} to {item.year_to || "—"}</p><p className="mt-1 text-sm text-slate-600">Score: <b>{item.score || "—"}</b></p></div>)}{!(student.educationSummary ?? []).length ? <EmptyState text="No academic details have been added by this student." /> : null}</div></PreviewSection>
                <PreviewSection icon={<BookOpen size={18} />} title="Courses and progress"><div className="grid gap-3 sm:grid-cols-2">{learningRecord?.courses.map((course) => <div key={course.id} className="rounded-xl border border-portal-line p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-slate-950">{course.title}</p><p className="mt-1 text-xs text-slate-500">{course.category} · {course.level}</p></div><b className="text-portal-blue">{course.progress_percent}%</b></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-portal-blue" style={{ width: `${course.progress_percent}%` }} /></div><p className="mt-3 text-xs text-slate-500">{course.attempt_count} assessment attempt{course.attempt_count === 1 ? "" : "s"} · {course.average_score ?? "—"}% average score</p></div>)}{!learningRecord?.courses.length ? <EmptyState text="No course activity recorded for this student." /> : null}</div></PreviewSection>
                <PreviewSection icon={<ClipboardCheck size={18} />} title="Assessments"><div className="grid gap-3 sm:grid-cols-2">{assessments.map((assessment) => <div key={assessment.assessment_id} className="rounded-xl border border-portal-line p-4"><p className="font-bold text-slate-950">{assessment.assessment_title}</p><p className="mt-1 text-sm capitalize text-slate-500">{assessment.latest_status.replaceAll("_", " ")} · {assessment.attempts_used}/{assessment.max_attempts} attempts</p><p className="mt-3 text-lg font-bold text-portal-blue">{assessment.latest_score == null ? "Not attempted" : `${assessment.latest_score}%`}</p></div>)}{!assessments.length ? <EmptyState text="No assessment activity recorded for this student." /> : null}</div></PreviewSection>
                <PreviewSection icon={<BriefcaseBusiness size={18} />} title="Jobs and placement"><div className="grid gap-3 sm:grid-cols-2">{jobs.map((job) => <div key={job.id} className="rounded-xl border border-portal-line p-4"><p className="font-bold text-slate-950">{job.jobTitle}</p><p className="mt-1 text-sm text-slate-500">{job.company}</p><p className="mt-3 text-xs font-bold uppercase tracking-wide text-emerald-600">Applied</p></div>)}{!jobs.length ? <EmptyState text="No job applications recorded for this student." /> : null}</div></PreviewSection>
              </div>
              <aside className="space-y-5"><PreviewSection icon={<FileText size={18} />} title="Documents"><div className="space-y-3">{resume ? <DocumentCard name={profile.resumeFileName || "Resume"} url={resume} /> : null}{educationDocuments.map((item, index) => <DocumentCard key={`${item.level}-${index}`} name={item.markscardFileName || `${item.level || "Education"} markscard`} url={item.markscardDataUrl || ""} />)}{!resume && !educationDocuments.length ? <EmptyState text="No uploaded documents are available in the current record." /> : null}</div></PreviewSection><PreviewSection icon={<ExternalLink size={18} />} title="External links">{student.portfolioUrl ? <a href={student.portfolioUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border border-portal-line p-3 text-sm font-bold text-portal-blue transition hover:bg-blue-50">Portfolio <ExternalLink size={16} /></a> : <EmptyState text="No portfolio link added." />}</PreviewSection></aside>
            </div>
          </div>
        </motion.div>
      </motion.div>
      {photoOpen && photo ? <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/70 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setPhotoOpen(false); }}><motion.div initial={{ scale: 0.96 }} animate={{ scale: 1 }} className="relative max-h-[90vh] max-w-3xl overflow-hidden rounded-2xl bg-white p-3 shadow-2xl"><button type="button" onClick={() => setPhotoOpen(false)} className="absolute right-5 top-5 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-slate-700 shadow" aria-label="Close image preview"><X size={18} /></button><img src={photo} alt={`${student.name} enlarged profile`} className="max-h-[82vh] w-auto rounded-xl object-contain" /></motion.div></motion.div> : null}
    </AnimatePresence>
  );
}

function PreviewSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-portal-line bg-white p-5 shadow-sm"><h3 className="flex items-center gap-2 text-base font-bold text-slate-950"> <span className="text-portal-blue">{icon}</span>{title}</h3><div className="mt-4">{children}</div></section>; }
function InfoGrid({ rows }: { rows: Array<[string, string | undefined]> }) { return <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">{rows.map(([label, value]) => <div key={label}><p className="text-slate-500">{label}</p><p className="mt-1 break-words font-bold text-slate-900">{value || "—"}</p></div>)}</div>; }
function EmptyState({ text }: { text: string }) { return <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">{text}</p>; }
function DocumentCard({ name, url }: { name: string; url: string }) { return <div className="rounded-xl border border-portal-line p-3"><div className="flex items-center gap-2"><FileText size={18} className="text-portal-blue" /><p className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">{name}</p></div><div className="mt-3 flex gap-2"><a href={url} target="_blank" rel="noreferrer" className="flex h-9 flex-1 items-center justify-center gap-1 rounded-md border border-portal-line text-xs font-bold text-slate-700 hover:bg-slate-50">View</a><a href={url} download={name} className="grid h-9 w-9 place-items-center rounded-md bg-portal-blue text-white hover:bg-blue-700" aria-label={`Download ${name}`}><Download size={15} /></a></div></div>; }
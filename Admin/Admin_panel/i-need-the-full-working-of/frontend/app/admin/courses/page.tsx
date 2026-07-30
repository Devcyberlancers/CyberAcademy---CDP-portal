"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { ProgressBar } from "@/components/admin/ProgressBar";
import { SectionCard } from "@/components/admin/SectionCard";
import { type AdminCourse, loadCourseCatalog, readLocalCourseCatalog, saveCourseCatalog } from "@/lib/course-catalog";
import { deleteCourseFromDb, getCourseStudentProgress, publishCourseInDb, type CourseStudentProgress, type DbCourse } from "@/lib/admin-api";
import { downloadCsv, downloadPdf, type ReportRow } from "@/lib/report-download";
import { Download, Edit3, FileText, Filter, Plus, RefreshCw, Rocket, Search, Trash2, Users, X } from "lucide-react";

export default function CoursesPage() {
  const [catalog, setCatalog] = useState<AdminCourse[]>(readLocalCourseCatalog());
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Published" | "Draft" | "Archived">("All");
  const [showFilters, setShowFilters] = useState(false);
  const [notice, setNotice] = useState("Courses are synced to the admin database when backend is running.");
  const [studentReport, setStudentReport] = useState<{ course: DbCourse; students: CourseStudentProgress[] } | null>(null);
  const [studentQuery, setStudentQuery] = useState("");
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    let active = true;
    loadCourseCatalog()
      .then((courses) => {
        if (!active) return;
        setCatalog(courses);
        setNotice("Courses loaded from saved catalog.");
      })
      .catch(() => setNotice("Showing local courses. Start backend to sync with MySQL."));
    return () => {
      active = false;
    };
  }, []);

  const filteredCourses = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (!clean) return catalog;
    return catalog.filter((course) => statusFilter === "All" || course.status === statusFilter).filter((course) =>
      !clean || [course.title, course.category, course.instructor, course.status].some((value) => value.toLowerCase().includes(clean))
    );
  }, [catalog, query, statusFilter]);

  async function refreshCatalog() {
    const fresh = await loadCourseCatalog();
    setCatalog(fresh);
    setNotice("Course catalog refreshed.");
  }

  async function seedDatabase() {
    const saved = await saveCourseCatalog(catalog);
    setCatalog(saved);
    setNotice("Course catalog saved to database.");
  }

  async function deleteCourse(course: AdminCourse) {
    if (!window.confirm(`Delete \"${course.title}\"? This removes it from the course catalog.`)) return;
    const nextCatalog = catalog.filter((item) => item.id !== course.id);
    try {
      if (/^\d+$/.test(course.id)) await deleteCourseFromDb(course.id);
      const saved = await saveCourseCatalog(nextCatalog);
      setCatalog(saved);
      setNotice(`${course.title} was deleted from the course catalog.`);
    } catch {
      setCatalog(nextCatalog);
      setNotice(`${course.title} was deleted locally. Start the backend to sync the change.`);
    }
  }

  async function publishCourse(course: AdminCourse) {
    if (!/^\d+$/.test(course.id)) {
      setNotice("This local placeholder is not stored in the database and cannot be published.");
      return;
    }
    await publishCourseInDb(course.id);
    const nextCatalog = catalog.map((item) => item.id === course.id ? { ...item, status: "Published" as const } : item);
    setCatalog(nextCatalog);
    await saveCourseCatalog(nextCatalog);
    setNotice(`${course.title} is now visible in the Student Portal.`);
  }

  function courseRows(course: { title: string }, students: CourseStudentProgress[]): ReportRow[] {
    return students.map((student) => ({
      Course: course.title,
      Student: student.student_name,
      Email: student.student_email,
      "Register Number": student.register_number,
      Assigned: student.assigned ? "Yes" : "No",
      "Progress %": student.progress_percent,
      "Assessments Completed": `${student.assessments_completed}/${student.total_assessments}`,
      Attempts: student.attempts,
      "Average Score": student.average_score ?? "Not attempted",
      "Latest Score": student.latest_score ?? "Not attempted",
      "Latest Activity": student.latest_activity ? new Date(student.latest_activity).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) + " IST" : ""
    }));
  }

  async function openStudents(course: AdminCourse) {
    if (!/^\d+$/.test(course.id)) return setNotice("Save this course to the database before opening student progress.");
    setReportLoading(true);
    setStudentQuery("");
    try {
      const report = await getCourseStudentProgress(course.id);
      setStudentReport({ course: report.course, students: report.students });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Course student progress could not be loaded.");
    } finally {
      setReportLoading(false);
    }
  }

  async function exportAll(format: "csv" | "pdf") {
    setReportLoading(true);
    try {
      const reports = await Promise.all(catalog.filter((course) => /^\d+$/.test(course.id)).map((course) => getCourseStudentProgress(course.id)));
      const rows = reports.flatMap((report) => courseRows(report.course, report.students));
      if (format === "csv") downloadCsv("all-course-student-progress", rows);
      else downloadPdf("All Course Student Progress", rows);
      setNotice(`Complete course progress ${format.toUpperCase()} downloaded.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Complete course report could not be generated.");
    } finally {
      setReportLoading(false);
    }
  }

  return (
    <AdminShell title="Courses" subtitle="Create, publish, and maintain student learning content">
      <SectionCard
        title="All Courses"
        action={
          <div className="flex flex-wrap gap-2">
            <button onClick={refreshCatalog} className="flex h-10 items-center gap-2 rounded-md border border-portal-line px-4 text-sm font-bold text-slate-700">
              <RefreshCw size={17} />
              Refresh
            </button>
            <button onClick={seedDatabase} className="flex h-10 items-center gap-2 rounded-md border border-portal-line px-4 text-sm font-bold text-portal-blue">
              Save Catalog
            </button>
            <button onClick={() => void exportAll("csv")} disabled={reportLoading} className="flex h-10 items-center gap-2 rounded-md border border-portal-line px-4 text-sm font-bold text-slate-700 disabled:opacity-50"><Download size={16} /> All CSV</button>
            <button onClick={() => void exportAll("pdf")} disabled={reportLoading} className="flex h-10 items-center gap-2 rounded-md border border-portal-line px-4 text-sm font-bold text-slate-700 disabled:opacity-50"><FileText size={16} /> All PDF</button>
            <Link href="/admin/courses/new" className="flex h-10 items-center gap-2 rounded-md bg-portal-blue px-4 text-sm font-bold text-white">
              <Plus size={18} />
              Add Course
            </Link>
          </div>
        }
      >
        <p className="mb-4 text-sm font-semibold text-slate-500">{notice}</p>
        <div className="mb-5 flex flex-col gap-3 md:flex-row">
          <label className="flex h-11 flex-1 items-center gap-3 rounded-md border border-portal-line px-3 text-slate-500">
            <Search size={18} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full outline-none" placeholder="Search courses..." />
          </label>
          <div className="relative"><button type="button" onClick={() => setShowFilters((value) => !value)} className="flex h-11 items-center justify-center gap-2 rounded-md border border-portal-line px-4 font-semibold text-slate-700">
            <Filter size={18} />
            {statusFilter === "All" ? "Filters" : statusFilter}
          </button>{showFilters ? <div className="absolute right-0 top-12 z-20 w-48 rounded-lg border border-portal-line bg-white p-2 shadow-xl">{(["All", "Published", "Draft", "Archived"] as const).map((status) => <button key={status} type="button" onClick={() => { setStatusFilter(status); setShowFilters(false); }} className={`block w-full rounded-md px-3 py-2 text-left text-sm font-semibold ${statusFilter === status ? "bg-blue-50 text-portal-blue" : "text-slate-700 hover:bg-slate-50"}`}>{status}</button>)}</div> : null}</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-portal-line bg-slate-50 text-slate-600">
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Instructor</th>
                <th className="px-4 py-3">Progress</th>
                <th className="px-4 py-3">Modules</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredCourses.map((course) => (
                <tr key={course.id} className="border-b border-portal-line">
                  <td className="px-4 py-4">
                    <p className="font-bold text-slate-950">{course.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{course.id} - Updated {course.updated}</p>
                  </td>
                  <td className="px-4 py-4">{course.category}</td>
                  <td className="px-4 py-4">{course.instructor}</td>
                  <td className="px-4 py-4"><ProgressBar value={course.completion} /></td>
                  <td className="px-4 py-4">{course.modules} modules / {course.lessons} lessons</td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${course.status === "Published" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                      {course.status}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <Link href={`/admin/courses/${encodeURIComponent(course.id)}/edit`} className="inline-flex h-9 items-center gap-2 rounded-md border border-portal-line px-3 font-semibold text-portal-blue">
                        <Edit3 size={16} />
                        Edit
                      </Link>
                      <button type="button" onClick={() => void openStudents(course)} className="inline-flex h-9 items-center gap-2 rounded-md border border-blue-200 px-3 font-semibold text-portal-blue"><Users size={16} /> Students</button>
                      {course.status !== "Published" ? (
                        <button type="button" onClick={() => void publishCourse(course)} className="inline-flex h-9 items-center gap-2 rounded-md border border-emerald-200 px-3 font-semibold text-emerald-700">
                          <Rocket size={16} />
                          Publish
                        </button>
                      ) : null}
                      <button type="button" onClick={() => void deleteCourse(course)} className="inline-flex h-9 items-center gap-2 rounded-md border border-red-200 px-3 font-semibold text-red-600" aria-label={`Delete ${course.title}`}>
                        <Trash2 size={16} />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredCourses.length === 0 ? <p className="p-6 text-center text-sm font-semibold text-slate-500">No courses match this search.</p> : null}
        </div>
      </SectionCard>
      {studentReport ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" role="dialog" aria-modal="true" aria-label="Course student progress">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex flex-wrap items-start justify-between gap-4 border-b border-portal-line bg-white p-5"><div><p className="text-xs font-bold uppercase tracking-wide text-portal-blue">Course student progress</p><h2 className="mt-1 text-xl font-bold text-slate-950">{studentReport.course.title}</h2><p className="mt-1 text-sm text-slate-500">{studentReport.students.length} student records</p></div><div className="flex flex-wrap gap-2"><button onClick={() => downloadCsv(`${studentReport.course.title}-student-progress`, courseRows(studentReport.course, studentReport.students))} className="flex h-10 items-center gap-2 rounded-md border border-portal-line px-4 text-sm font-bold"><Download size={16} /> CSV</button><button onClick={() => downloadPdf(`${studentReport.course.title} Student Progress`, courseRows(studentReport.course, studentReport.students))} className="flex h-10 items-center gap-2 rounded-md border border-portal-line px-4 text-sm font-bold"><FileText size={16} /> PDF</button><button onClick={() => setStudentReport(null)} className="grid h-10 w-10 place-items-center rounded-full border border-portal-line" aria-label="Close student report"><X size={19} /></button></div></div>
            <div className="p-5"><label className="mb-4 flex h-11 items-center gap-3 rounded-md border border-portal-line px-3 text-slate-500"><Search size={17} /><input value={studentQuery} onChange={(event) => setStudentQuery(event.target.value)} className="w-full outline-none" placeholder="Search student, email or register number" /></label><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead><tr className="border-b bg-slate-50 text-slate-600"><th className="p-3">Student</th><th className="p-3">Assigned</th><th className="p-3">Progress</th><th className="p-3">Assessments</th><th className="p-3">Attempts</th><th className="p-3">Average Score</th><th className="p-3">Latest Score</th></tr></thead><tbody>{studentReport.students.filter((student) => !studentQuery.trim() || [student.student_name, student.student_email, student.register_number].some((value) => value.toLowerCase().includes(studentQuery.trim().toLowerCase()))).map((student) => <tr key={student.student_id} className="border-b border-portal-line"><td className="p-3"><p className="font-bold text-slate-900">{student.student_name}</p><p className="text-xs text-slate-500">{student.student_email} · {student.register_number}</p></td><td className="p-3">{student.assigned ? "Yes" : "Available"}</td><td className="p-3 font-bold">{student.progress_percent}%</td><td className="p-3">{student.assessments_completed}/{student.total_assessments}</td><td className="p-3">{student.attempts}</td><td className="p-3 font-bold text-portal-blue">{student.average_score ?? "—"}</td><td className="p-3 font-bold text-portal-blue">{student.latest_score ?? "—"}</td></tr>)}</tbody></table></div></div>
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}

import { StudentCourseAssessment } from "@/components/student/StudentCourseAssessment";

function titleFromId(courseId: string) {
  return courseId
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function StudentCourseAssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const courseTitle = titleFromId(id);

  return (
    <main className="min-h-screen bg-portal-bg">
      <header className="border-b border-portal-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div>
            <p className="text-sm font-bold text-portal-blue">Student Preview</p>
            <h1 className="text-2xl font-bold text-slate-950">{courseTitle} Assessment</h1>
          </div>
          <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700">
            Uppalapati Bhargav
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-5 py-6">
        <StudentCourseAssessment courseId={id} />
      </div>
    </main>
  );
}

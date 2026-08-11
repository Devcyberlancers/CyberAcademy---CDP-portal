"use client";

import { AdminShell } from "@/components/admin/AdminShell";
import { CourseCreationWizard } from "@/components/admin/CourseCreationWizard";

export default function NewCoursePage() {
  return (
    <AdminShell
      title="Create Course"
      subtitle="Build the course step by step, review it, and publish it once."
    >
      <CourseCreationWizard />
    </AdminShell>
  );
}

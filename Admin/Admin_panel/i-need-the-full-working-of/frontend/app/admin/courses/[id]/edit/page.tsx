"use client";

import { useParams } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { CourseCreationWizard } from "@/components/admin/CourseCreationWizard";

export default function EditCoursePage(){
  const params=useParams<{id:string}>();
  const courseId=decodeURIComponent(params.id??"");
  return (
    <AdminShell
      title="Edit Course"
      subtitle="Update the course step by step, review every module, and publish once."
    >
      <CourseCreationWizard courseId={courseId}/>
    </AdminShell>
  );
}

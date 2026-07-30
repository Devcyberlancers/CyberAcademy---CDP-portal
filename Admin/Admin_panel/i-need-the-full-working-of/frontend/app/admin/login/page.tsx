import { redirect } from "next/navigation";

export default function RemovedAdminLoginPage() {
  redirect(process.env.NEXT_PUBLIC_STUDENT_PORTAL_URL ?? "http://localhost:3000");
}

import { redirect } from "next/navigation";

export default function HomePage() {
  redirect(process.env.NEXT_PUBLIC_STUDENT_PORTAL_URL ?? "http://localhost:3000");
}

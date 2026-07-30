import { courses as seedCourses } from "@/lib/admin-data";
import { listCoursesFromDb } from "@/lib/admin-api";

export type AdminCourse = {
  id: string;
  title: string;
  category: string;
  instructor: string;
  status: "Published" | "Draft" | "Archived";
  students: number;
  completion: number;
  modules: number;
  lessons: number;
  updated: string;
  shortDescription: string;
  description: string;
  level: string;
  duration: string;
  visibility: string;
};

export const courseCatalogStorageKey = "admin-course-catalog-v1";

export function slugifyCourse(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "course";
}

export function normalizeCourse(course: Partial<AdminCourse> & { id?: string; title: string }, index = 0): AdminCourse {
  const title = course.title.trim() || `Course ${index + 1}`;
  return {
    id: String(course.id || slugifyCourse(title)),
    title,
    category: course.category || "General",
    instructor: course.instructor || "Admin Faculty",
    status: (course.status === "Published" || course.status === "Archived" || course.status === "Draft") ? course.status : "Draft",
    students: Number(course.students ?? 0),
    completion: Number(course.completion ?? 0),
    modules: Number(course.modules ?? 0),
    lessons: Number(course.lessons ?? 0),
    updated: course.updated || new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    shortDescription: course.shortDescription || "Add a short description for students.",
    description: course.description || "Add detailed course description, outcomes, and learning path here.",
    level: course.level || "Beginner",
    duration: course.duration || "0 Hours",
    visibility: course.visibility || "Public"
  };
}

export function seedCourseCatalog(): AdminCourse[] {
  return seedCourses.slice(0, 0).map((course, index) => normalizeCourse({
    ...course,
    id: index === 0 ? "ethical-hacking" : slugifyCourse(course.title),
    status: course.status === "Published" || course.status === "Archived" || course.status === "Draft" ? course.status : "Draft",
    shortDescription: course.title === "Ethical Hacking"
      ? "Learn ethical hacking from scratch and master penetration testing techniques."
      : `${course.title} for student learning and placement preparation.`,
    description: course.title === "Ethical Hacking"
      ? "This course covers the fundamentals to advanced concepts of ethical hacking including information gathering, scanning, gaining access, maintaining access, covering tracks, and practical labs."
      : "Client can update this course with modules, teaching videos, resources, quizzes, and a final course assessment.",
    level: course.category === "Assessment" ? "Intermediate" : "Beginner",
    duration: course.modules ? `${course.modules * 5} Hours` : "0 Hours",
    visibility: "Public"
  }, index));
}

export function readLocalCourseCatalog(): AdminCourse[] {
  if (typeof window === "undefined") return seedCourseCatalog();
  try {
    const saved = window.localStorage.getItem(courseCatalogStorageKey);
    if (!saved) return [];
    const parsed = JSON.parse(saved) as AdminCourse[];
    return Array.isArray(parsed) ? parsed.map(normalizeCourse).filter((course) => /^\d+$/.test(course.id)) : [];
  } catch {
    return [];
  }
}

export async function loadCourseCatalog(): Promise<AdminCourse[]> {
  const local = readLocalCourseCatalog();
  try {
    const databaseCourses = await listCoursesFromDb();
    if (databaseCourses.length) {
      const normalized = databaseCourses.map((course) => normalizeCourse({
        ...course,
        id: String(course.id),
        status: ["active", "published"].includes(course.status.toLowerCase())
          ? "Published"
          : course.status.toLowerCase() === "archived" ? "Archived" : "Draft"
      }));
      writeLocalCourseCatalog(normalized);
      return normalized;
    }
  } catch {
    // Local catalog remains available while the database is offline.
  }
  return local;
}

export function writeLocalCourseCatalog(catalog: AdminCourse[]) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(courseCatalogStorageKey, JSON.stringify(catalog.map(normalizeCourse)));
  }
}

export async function saveCourseCatalog(catalog: AdminCourse[]) {
  const normalized = catalog.map(normalizeCourse);
  writeLocalCourseCatalog(normalized);
  return normalized;
}

export function uniqueCourseId(title: string, existing: AdminCourse[]) {
  const base = slugifyCourse(title);
  let id = base;
  let count = 2;
  const existingIds = new Set(existing.map((course) => course.id));
  while (existingIds.has(id)) {
    id = `${base}-${count}`;
    count += 1;
  }
  return id;
}



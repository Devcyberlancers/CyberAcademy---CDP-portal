export const studentPortalUrl =
  (process.env.NEXT_PUBLIC_STUDENT_PORTAL_URL ?? "http://localhost:3000").replace(/\/+$/, "");

export function studentPortalPath(path = "") {
  return `${studentPortalUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

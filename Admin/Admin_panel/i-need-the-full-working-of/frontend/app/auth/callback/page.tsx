"use client";

import { useEffect } from "react";
import { studentPortalPath } from "@/lib/urls";

const adminTokenStorageKey = "student-portal-admin-token";

export default function UnifiedAuthCallbackPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get("token");
    if (!token) {
      window.location.replace(studentPortalPath("/?error=missing-admin-token"));
      return;
    }
    window.localStorage.setItem(adminTokenStorageKey, token);
    window.history.replaceState(null, "", "/auth/callback");
    window.location.replace("/admin/dashboard");
  }, []);

  return (
    <main className="grid min-h-screen place-items-center bg-portal-bg">
      <p className="rounded-lg bg-white px-6 py-4 font-semibold text-slate-700 shadow">Opening Admin Portal…</p>
    </main>
  );
}

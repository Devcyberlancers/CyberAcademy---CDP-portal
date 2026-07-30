"use client";

import { useEffect, useState } from "react";
import { AdminSidebar } from "./AdminSidebar";
import { AdminTopbar } from "./AdminTopbar";
import type { AdminNotificationDetail } from "@/lib/admin-api";
import { studentPortalUrl } from "@/lib/urls";

type AdminShellProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function AdminShell({ title, subtitle, children }: AdminShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [notification, setNotification] = useState<AdminNotificationDetail | null>(null);

  useEffect(() => {
    const token = window.localStorage.getItem("student-portal-admin-token");
    if (!token) {
      window.location.replace(studentPortalUrl);
      return;
    }
    setAuthorized(true);
  }, []);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<AdminNotificationDetail>).detail;
      setNotification(detail);
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => setNotification(null), 4000);
    };
    window.addEventListener("admin-notification", listener);
    return () => {
      window.removeEventListener("admin-notification", listener);
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  if (!authorized) {
    return <div className="grid min-h-screen place-items-center bg-portal-bg font-semibold text-slate-600">Checking access…</div>;
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-portal-bg">
      {notification ? (
        <div
          role="status"
          className={`fixed right-5 top-5 z-[100] max-w-md rounded-lg border px-5 py-4 text-sm font-bold shadow-xl ${
            notification.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {notification.message}
        </div>
      ) : null}
      <AdminSidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <main className="min-w-0 md:pl-[93px]">
        <AdminTopbar title={title} subtitle={subtitle} onMenuClick={() => setMobileNavOpen(true)} />
        <div className="p-3 sm:p-5 md:p-8">{children}</div>
      </main>
    </div>
  );
}

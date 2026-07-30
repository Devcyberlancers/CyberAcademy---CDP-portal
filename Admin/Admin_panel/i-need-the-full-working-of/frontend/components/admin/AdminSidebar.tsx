"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  BriefcaseBusiness,
  ClipboardList,
  Code2,
  Grid2X2,
  LayoutDashboard,
  LogOut,
  Settings,
  Users
} from "lucide-react";
import { clearAdminToken } from "@/lib/admin-api";
import { studentPortalUrl } from "@/lib/urls";

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/courses", label: "Courses", icon: BookOpen },
  { href: "/admin/jobs", label: "Jobs", icon: BriefcaseBusiness },
  { href: "/admin/assignments", label: "Assessments", icon: ClipboardList },
  { href: "/admin/students", label: "Students", icon: Users },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/ide", label: "Open IDE", icon: Code2 },
  { href: "/admin/nerd", label: "Go to NERD", icon: Grid2X2 }
];

type AdminSidebarProps = {
  mobileOpen?: boolean;
  onClose?: () => void;
};

export function AdminSidebar({ mobileOpen = false, onClose }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const content = (
    <div className="admin-scrollbar flex h-full flex-col overflow-y-auto overflow-x-hidden border-r border-white/10">
      <div className="flex h-[96px] shrink-0 items-center justify-center">
        <div className="grid h-[58px] w-[58px] place-items-center rounded-md bg-white p-1 shadow-sm">
          <img src="/assets/admin-logo.jpeg" alt="Cyber Academy rocket logo" className="h-full w-full rounded object-contain" />
        </div>
      </div>
      <nav className="flex-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== "/admin/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`relative flex min-h-[72px] flex-col items-center justify-center gap-2 px-1 text-center text-[12px] font-medium leading-tight transition sm:text-[13px] ${
                active ? "bg-[#2f45d4] text-white" : "text-white hover:bg-white/10"
              }`}
            >
              {active ? <span className="absolute left-0 top-0 h-full w-[5px] rounded-r bg-[#4165ff]" /> : null}
              <Icon size={26} strokeWidth={1.8} className={active ? "text-white" : "text-slate-200"} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <button
        type="button"
        onClick={() => {
          clearAdminToken();
          onClose?.();
          router.push(studentPortalUrl);
        }}
        className="flex min-h-[72px] flex-col items-center justify-center gap-2 px-1 text-center text-[12px] font-medium leading-tight text-white hover:bg-white/10 sm:text-[13px]"
      >
        <LogOut size={26} strokeWidth={1.8} />
        <span>Logout</span>
      </button>
    </div>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[93px] bg-[#111846] text-white md:block">
        {content}
      </aside>
      <div className={`fixed inset-0 z-40 md:hidden ${mobileOpen ? "" : "pointer-events-none"}`}>
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onClose}
          className={`absolute inset-0 bg-slate-950/40 transition-opacity ${mobileOpen ? "opacity-100" : "opacity-0"}`}
        />
        <aside
          className={`absolute inset-y-0 left-0 w-[93px] bg-[#111846] text-white shadow-2xl transition-transform duration-200 ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {content}
        </aside>
      </div>
    </>
  );
}

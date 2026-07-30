import { AdminShell } from "@/components/admin/AdminShell";
import { SectionCard } from "@/components/admin/SectionCard";
import { KeyRound, Lock, ShieldCheck, type LucideIcon } from "lucide-react";

const securitySettings: Array<[string, string, LucideIcon]> = [
  ["Role-based access control", "Enabled", ShieldCheck],
  ["JWT refresh rotation", "Enabled", KeyRound],
  ["Student email domain restriction", "Enabled", Lock],
  ["Assessment suspicious activity logging", "Enabled", ShieldCheck]
];

export default function SecurityPage() {
  return (
    <AdminShell title="Security" subtitle="Monitor access, assessment integrity, and admin audit logs">
      <div className="grid gap-5 lg:grid-cols-[1fr_420px]">
        <SectionCard title="Security Events">
          <div className="space-y-4">
            <div className="rounded-lg border border-dashed border-portal-line p-10 text-center text-sm text-slate-500">No recorded security events.</div>
          </div>
        </SectionCard>
        <SectionCard title="Security Settings">
          <div className="space-y-4 text-sm">
            {securitySettings.map(([title, value, Icon]) => (
              <div key={String(title)} className="flex items-center justify-between rounded-md border border-portal-line p-4">
                <div className="flex items-center gap-3"><Icon className="text-portal-blue" size={18} /><span className="font-bold">{title}</span></div>
                <span className="text-emerald-600">{value}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </AdminShell>
  );
}

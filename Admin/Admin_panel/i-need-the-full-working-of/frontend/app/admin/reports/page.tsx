import { AdminShell } from "@/components/admin/AdminShell";
import { SectionCard } from "@/components/admin/SectionCard";

export default function ReportsPage() {
  return (
    <AdminShell title="Reports" subtitle="Export academic, placement, activity, and security reports">
      <SectionCard title="Available Reports">
        <div className="rounded-lg border border-dashed border-portal-line p-10 text-center text-sm text-slate-500">No database-generated reports are available yet.</div>
      </SectionCard>
    </AdminShell>
  );
}

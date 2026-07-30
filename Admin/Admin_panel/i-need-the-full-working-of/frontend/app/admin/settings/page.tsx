import { AdminShell } from "@/components/admin/AdminShell";
import { SectionCard } from "@/components/admin/SectionCard";

export default function SettingsPage() {
  return (
    <AdminShell title="Settings" subtitle="Configure institution, domain, notification, and scraper settings">
      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard title="Institution Settings">
          <div className="grid gap-4">
            <label><span className="mb-2 block text-sm font-bold">Institution Name</span><input className="h-11 w-full rounded-md border border-portal-line px-3" defaultValue="CDC - Assessment Portal" /></label>
            <label><span className="mb-2 block text-sm font-bold">Allowed Student Domain</span><input className="h-11 w-full rounded-md border border-portal-line px-3" defaultValue="@vitstudent.ac.in" /></label>
            <label><span className="mb-2 block text-sm font-bold">Allowed Admin Domain</span><input className="h-11 w-full rounded-md border border-portal-line px-3" defaultValue="@vit.ac.in" /></label>
          </div>
        </SectionCard>
        <SectionCard title="Placement Settings">
          <div className="grid gap-4">
            <label><span className="mb-2 block text-sm font-bold">Minimum CGPA Rule</span><input className="h-11 w-full rounded-md border border-portal-line px-3" defaultValue="Company specific" /></label>
            <label><span className="mb-2 block text-sm font-bold">Scraper Sources</span><input className="h-11 w-full rounded-md border border-portal-line px-3" defaultValue="LinkedIn, company career pages, configured portals" /></label>
            <label className="flex items-center gap-3"><input type="checkbox" defaultChecked className="h-5 w-5 accent-portal-blue" /><span className="font-bold">Require manual approval after automated eligibility</span></label>
          </div>
        </SectionCard>
      </div>
    </AdminShell>
  );
}

import type { LucideIcon } from "lucide-react";

const toneClasses: Record<string, string> = {
  indigo: "bg-indigo-50 text-indigo-600",
  emerald: "bg-emerald-50 text-emerald-600",
  blue: "bg-blue-50 text-blue-600",
  amber: "bg-amber-50 text-amber-600",
  violet: "bg-violet-50 text-violet-600",
  rose: "bg-rose-50 text-rose-600"
};

type StatCardProps = {
  label: string;
  value: string;
  caption: string;
  tone?: string;
  icon: LucideIcon;
};

export function StatCard({ label, value, caption, tone = "blue", icon: Icon }: StatCardProps) {
  return (
    <div className="min-w-0 rounded-lg border border-portal-line bg-white p-4 shadow-sm sm:p-5">
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full sm:h-12 sm:w-12 ${toneClasses[tone] ?? toneClasses.blue}`}>
          <Icon size={22} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-600">{label}</p>
          <p className="mt-1 text-xl font-bold text-slate-950 sm:text-2xl">{value}</p>
          <p className="mt-1 truncate text-sm text-slate-500">{caption}</p>
        </div>
      </div>
    </div>
  );
}

type ProgressBarProps = {
  value: number;
};

export function ProgressBar({ value }: ProgressBarProps) {
  const tone = value >= 75 ? "bg-emerald-500" : value >= 35 ? "bg-amber-500" : "bg-blue-500";
  return (
    <div className="flex items-center gap-3">
      <span className="w-10 text-sm font-semibold text-slate-700">{value}%</span>
      <div className="h-2 w-36 rounded-full bg-slate-100">
        <div className={`h-2 rounded-full ${tone}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

type SectionCardProps = {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
};

export function SectionCard({ title, action, children }: SectionCardProps) {
  return (
    <section className="min-w-0 rounded-lg border border-portal-line bg-white shadow-sm">
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-portal-line px-4 py-3 sm:px-5 sm:py-4">
          {title ? <h2 className="text-base font-bold text-slate-950">{title}</h2> : <span />}
          {action}
        </div>
      )}
      <div className="min-w-0 p-4 sm:p-5">{children}</div>
    </section>
  );
}

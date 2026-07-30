import Link from "next/link";
import { cn } from "@/lib/utils";

export function ButtonLink({
  href,
  children,
  variant = "primary",
  className
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "focus-ring inline-flex h-11 items-center justify-center rounded-md px-5 text-sm font-semibold transition hover:-translate-y-0.5",
        variant === "primary" && "bg-primary text-primary-foreground shadow-soft hover:bg-primary/90",
        variant === "secondary" && "bg-secondary text-secondary-foreground shadow-soft hover:bg-secondary/90",
        variant === "ghost" && "border bg-card text-foreground hover:bg-muted",
        className
      )}
    >
      {children}
    </Link>
  );
}

export function Card({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("rounded-lg border bg-card p-6 shadow-soft", className)}>{children}</div>;
}

export function SectionHeading({
  eyebrow,
  title,
  text
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <div className="mx-auto mb-10 max-w-3xl text-center">
      <p className="text-sm font-bold uppercase tracking-[0.22em] text-accent">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
      <p className="mt-4 text-base leading-7 text-muted-foreground">{text}</p>
    </div>
  );
}

export function StatusPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex rounded-full border border-accent/25 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
      {children}
    </span>
  );
}

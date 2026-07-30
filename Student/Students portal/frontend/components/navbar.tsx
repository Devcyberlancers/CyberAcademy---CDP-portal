import Image from "next/image";
import Link from "next/link";
import { Building2, Menu } from "lucide-react";
import { institution, navItems } from "@/lib/data";
import { ButtonLink } from "@/components/ui";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <Image src="/logo.svg" width={46} height={46} alt={`${institution.shortName} logo`} className="rounded-lg" />
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-sm font-bold">{institution.shortName}</p>
            <p className="truncate text-xs text-muted-foreground">{institution.centre}</p>
          </div>
        </Link>
        <nav className="ml-auto hidden items-center gap-5 lg:flex">
          {navItems.slice(0, 8).map(([label, href]) => (
            <Link key={href} href={href} className="text-sm font-medium text-muted-foreground transition hover:text-foreground">
              {label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 lg:ml-3">
          <ButtonLink href="/login/student" className="hidden sm:inline-flex">Student Login</ButtonLink>
          <ButtonLink href="/login/recruiter" variant="ghost" className="hidden md:inline-flex">Recruiter</ButtonLink>
          <button className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-md border bg-card lg:hidden" aria-label="Open menu">
            <Menu size={20} />
          </button>
        </div>
      </div>
      <div className="border-t bg-muted/35 px-4 py-2 lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto text-sm">
          <Building2 size={16} className="shrink-0 text-accent" />
          {navItems.map(([label, href]) => (
            <Link key={href} href={href} className="shrink-0 rounded-full px-3 py-1 text-muted-foreground">
              {label}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}

import Image from "next/image";
import Link from "next/link";
import { institution, navItems } from "@/lib/data";

export function Footer() {
  return (
    <footer className="border-t bg-card">
      <div className="section grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-3">
            <Image src="/logo.svg" alt="Cyber Academy logo" width={48} height={48} className="rounded-lg" />
            <div>
              <p className="font-bold">{institution.name}</p>
              <p className="text-sm text-muted-foreground">{institution.centre}</p>
            </div>
          </div>
          <p className="mt-5 max-w-xl text-sm leading-6 text-muted-foreground">
            A complete placement ecosystem connecting students, departments, recruiters, training teams, alumni, and administrators with verified outcomes.
          </p>
        </div>
        <div>
          <p className="font-semibold">Portal</p>
          <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
            {navItems.slice(1, 7).map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
          </div>
        </div>
        <div>
          <p className="font-semibold">Contact</p>
          <div className="mt-4 space-y-2 text-sm text-muted-foreground">
            <p>{institution.address}</p>
            <p>{institution.phone}</p>
            <p>{institution.email}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

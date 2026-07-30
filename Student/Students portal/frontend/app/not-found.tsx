import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-lg text-center">
        <p className="text-sm font-bold uppercase tracking-[0.22em] text-accent">404</p>
        <h1 className="mt-4 text-4xl font-bold">Page not found</h1>
        <p className="mt-3 text-muted-foreground">The requested portal page may have moved or requires a different role.</p>
        <Link href="/" className="mt-6 inline-flex rounded-md bg-primary px-5 py-3 font-semibold text-primary-foreground">Return home</Link>
      </div>
    </main>
  );
}

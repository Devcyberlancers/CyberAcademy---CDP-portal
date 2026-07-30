import Image from "next/image";
import Link from "next/link";
import { SignupForm } from "@/components/signup-form";
import { institution } from "@/lib/data";

export default function SignupPage() {
  return (
    <main className="min-h-screen bg-[#f6f8fc] px-4 py-6 text-[#07142f]">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl items-center justify-center">
        <section className="grid w-full overflow-hidden rounded-lg bg-white shadow-[0_18px_60px_rgba(17,24,74,.12)] lg:grid-cols-[0.85fr_1fr]">
          <div className="hidden bg-[#11184a] p-8 text-white lg:block">
            <div className="flex items-center gap-3">
              <Image src="/login-logo.png" alt="Cyber Academy CDP logo" width={150} height={68} className="h-auto w-[150px] rounded-md bg-white p-1" priority />
              <div>
                <p className="text-base font-semibold">{institution.name}</p>
                <p className="text-xs text-white/70">Student Portal</p>
              </div>
            </div>
            <div className="mt-20 max-w-sm">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#35d3e8]">student signup</p>
              <h1 className="mt-4 text-3xl font-bold leading-tight">Create your Cyber Academy account.</h1>
              <p className="mt-4 text-sm leading-6 text-white/72">
                Use your official Cyber Lancers email so your student dashboard can identify you correctly.
              </p>
            </div>
          </div>

          <div className="p-6 sm:p-10">
            <div className="mx-auto max-w-md">
              <Image src="/login-logo.png" alt="Cyber Academy CDP logo" width={170} height={78} className="mb-5 h-auto w-[170px] rounded-md" priority />
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#3155ff]">student portal</p>
              <h2 className="mt-3 text-2xl font-bold">Sign up</h2>
              <p className="mb-6 mt-2 text-sm leading-6 text-[#747b8a]">
                Already registered?{" "}
                <Link href="/" className="font-semibold text-[#3155ff]">
                  Sign in
                </Link>
              </p>
              <SignupForm />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

import Image from "next/image";
import { LoginForm } from "@/components/login-form";

export default function HomePage() {
  return (
    <main className="login-page-bg min-h-screen px-4 py-10 text-[#020817]">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-[1510px] items-center justify-center">
        <section className="login-container-blend grid min-h-[70vh] w-full max-w-[1450px] overflow-hidden rounded-[32px] bg-white/94 p-5 lg:grid-cols-[1fr_1fr]">
          <div className="relative hidden overflow-hidden rounded-[18px] lg:block">
            <Image
              src="/login-graduates.webp"
              alt="Graduates celebrating at sunset"
              fill
              priority
              unoptimized
              sizes="50vw"
              className="object-cover object-center"
            />
            <div className="absolute inset-0 bg-[#1a1235]/18" />
          </div>

          <div className="login-panel-pattern flex min-h-[720px] items-start justify-center overflow-hidden rounded-[18px] px-6 py-11 sm:px-10 lg:rounded-l-none lg:px-14">
            <div className="mt-2 w-full max-w-[475px]">
              <div className="mb-6 flex justify-center">
                <Image src="/login-logo.png" alt="Cyber Academy CDP logo" width={180} height={88} className="h-auto w-[180px]" priority unoptimized />
              </div>
              <h1 className="text-center text-2xl font-bold text-[#020817]">CDP - Assessment Portal</h1>

              <div className="mt-8">
                <h2 className="text-[24px] font-bold text-[#020817]">Sign In</h2>
                <p className="mt-2 text-lg text-[#5f6573]">The key to happiness is to sign in.</p>
              </div>

              <div className="mt-7">
                <LoginForm />
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

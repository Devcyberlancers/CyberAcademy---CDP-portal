import Image from "next/image";
import { LoginForm } from "@/components/login-form";

export default function HomePage() {
  return (
    <main className="login-page-bg min-h-[100dvh] overflow-x-hidden px-4 py-3 text-[#020817] sm:px-6 sm:py-5 lg:flex lg:h-[100dvh] lg:items-center lg:px-[3cm] lg:py-12">
      <div className="mx-auto flex w-full max-w-[1636px] items-center justify-center lg:h-full">
        <section className="login-container-blend grid w-full overflow-hidden rounded-[24px] bg-white/94 p-3 sm:p-4 lg:h-[min(876px,calc(100dvh-6rem))] lg:grid-cols-[1fr_1fr] lg:rounded-[38px] lg:p-6">
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

          <div className="login-panel-pattern flex min-h-0 items-start justify-center overflow-hidden rounded-[15px] px-5 py-7 sm:px-9 sm:py-8 lg:h-full lg:justify-start lg:rounded-l-none lg:pl-28 lg:pr-12 lg:pt-9">
            <div className="w-full max-w-[520px]">
              <div className="mb-4 flex justify-center sm:mb-5">
                <Image src="/login-logo.png" alt="Cyber Academy CDP logo" width={150} height={74} className="h-auto w-[150px]" priority unoptimized />
              </div>
              <h1 className="text-center text-[22px] font-bold text-[#020817] sm:text-[24px]">CDP - Assessment Portal</h1>

              <div className="mt-5 sm:mt-6">
                <h2 className="text-[23px] font-bold text-[#020817] sm:text-[24px]">Sign In</h2>
                <p className="mt-1 text-base text-[#5f6573] sm:text-[17px]">The key to happiness is to sign in.</p>
              </div>

              <div className="mt-5 sm:mt-6">
                <LoginForm />
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

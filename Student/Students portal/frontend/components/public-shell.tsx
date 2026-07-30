import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main>{children}</main>
      <Footer />
    </div>
  );
}

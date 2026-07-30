import { AdminStoreProvider } from "@/lib/admin-store";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AdminStoreProvider>{children}</AdminStoreProvider>;
}

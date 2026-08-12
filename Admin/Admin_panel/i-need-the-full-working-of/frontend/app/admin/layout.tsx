import { AdminStoreProvider } from "@/lib/admin-store";
import { AdminBatchProvider } from "@/lib/admin-batch-context";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AdminBatchProvider><AdminStoreProvider>{children}</AdminStoreProvider></AdminBatchProvider>;
}

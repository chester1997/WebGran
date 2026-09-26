export const instant = false;
import { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth";
import AdminSidebar from "./AdminSidebar";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAdmin();

  return (
    <div className="min-h-screen bg-[#0B0B0D] text-white selection:bg-red-500/30 selection:text-red-200">
      <div className="flex h-screen overflow-hidden">
        {/* Modern Sidebar Component */}
        <AdminSidebar user={user} />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#0B0B0D]">
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#0B0B0D]">
            <div className="w-full space-y-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

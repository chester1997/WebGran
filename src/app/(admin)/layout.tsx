import { ReactNode, Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import AdminSidebar from "./AdminSidebar";

async function AdminSidebarWrapper() {
  const user = await requireAdmin();
  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      role: true,
    },
  });

  return (
    <AdminSidebar
      user={{
        id: user.id,
        name: dbUser?.name || user.name || "Administrador",
        email: dbUser?.email || user.email || "",
        avatarUrl: dbUser?.avatarUrl || null,
        role: dbUser?.role || user.role || "admin",
      }}
    />
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0B0B0D] text-white selection:bg-red-500/30 selection:text-red-200">
      <div className="flex flex-col md:flex-row h-screen overflow-hidden">
        {/* Modern Sidebar Component wrapped in Suspense */}
        <Suspense fallback={<div className="w-64 bg-[#111115] h-full animate-pulse hidden md:block" />}>
          <AdminSidebarWrapper />
        </Suspense>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#0B0B0D]">
          <main className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 bg-[#0B0B0D]">
            <div className="w-full space-y-6">
              <Suspense fallback={<div className="p-8 text-center text-zinc-400 animate-pulse">Carregando painel admin...</div>}>
                {children}
              </Suspense>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

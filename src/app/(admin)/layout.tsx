import { ReactNode, Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import AdminSidebar from "./AdminSidebar";

async function AdminSidebarWrapper() {
  const user = await requireAdmin();
  let dbUser = null;
  try {
    dbUser = await db.query.users.findFirst({
      where: eq(users.id, user.id),
      columns: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        role: true,
      },
    });
  } catch (err) {
    console.warn("[AdminSidebarWrapper] Transient DB fetch error, falling back to session user:", err);
  }

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
    <div className="min-h-screen bg-[#050608] text-white selection:bg-blue-500/30 selection:text-blue-200 antialiased">
      <div className="flex flex-col md:flex-row h-screen overflow-hidden">
        {/* Modern Sidebar Component wrapped in Suspense */}
        <Suspense fallback={<div className="w-64 bg-[#050608] h-full animate-pulse hidden md:block" />}>
          <AdminSidebarWrapper />
        </Suspense>

        {/* Floating Main Content Canvas (Visualmente elevado e avançando sobre a sidebar) */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden md:py-2.5 md:pr-2.5 md:-ml-2.5 relative z-10">
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#090A0E] md:rounded-2xl border-0 md:border md:border-white/[0.06] md:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95)] custom-admin-scrollbar relative">
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

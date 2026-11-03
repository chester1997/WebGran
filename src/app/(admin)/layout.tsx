import { ReactNode, Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import AdminSidebar from "./AdminSidebar";
import AdminScrollReset from "./AdminScrollReset";
import { SaleNotificationSoundHandler } from "@/components/audio/SaleNotificationSoundHandler";

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
    <div
      style={{ "--admin-bg": "#0B0D13" } as React.CSSProperties}
      className="min-h-screen bg-[var(--admin-bg,#0B0D13)] text-white selection:bg-blue-500/30 selection:text-blue-200 antialiased"
    >
      <div className="flex flex-col lg:flex-row h-screen overflow-hidden bg-[var(--admin-bg,#0B0D13)]">
        {/* Modern Sidebar Component wrapped in Suspense */}
        <Suspense fallback={<div className="w-[var(--sidebar-w,320px)] bg-[var(--admin-bg,#0B0D13)] h-full animate-pulse hidden lg:block" />}>
          <AdminSidebarWrapper />
        </Suspense>

        {/* Content Canvas Wrapper */}
        <div className="flex-1 min-h-0 flex flex-col min-w-0 overflow-hidden relative bg-[var(--admin-bg,#0B0D13)]">
          {/* External Header Slot for Admin Pages (rendered via AdminPageHeader portal) */}
          <div
            id="admin-page-header-portal"
            className="shrink-0 w-full px-6 md:px-7 lg:px-8 py-0 bg-[var(--admin-bg,#0B0D13)] h-[var(--header-h,112px)] min-h-[var(--header-h,112px)] max-h-[var(--header-h,112px)] flex items-center relative z-30 overflow-visible"
          />

          <Suspense fallback={null}>
            <AdminScrollReset />
          </Suspense>

          <main
            tabIndex={0}
            aria-label="Conteúdo Principal"
            className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[var(--admin-bg,#0B0D13)] rounded-none lg:rounded-tl-[24px] border-0 lg:border-t lg:border-l lg:border-white/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/10 custom-admin-scrollbar relative"
          >
            <SaleNotificationSoundHandler />
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

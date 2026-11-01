import { connection } from "next/server";
import { db } from "@/db";
import { themes } from "@/db/schema";
import { desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { ThemeList } from "./ThemeList";
import { ThemeForm } from "./ThemeForm";
import AdminPageHeader from "../../AdminPageHeader";

export default async function AdminThemesPage() {
  await connection();
  await requireAdmin();

  const allThemes = await db.query.themes.findMany({
    orderBy: [desc(themes.createdAt)]
  });

  return (
    <div className="space-y-8 pb-10">
      <AdminPageHeader
        title="Temas do WebGran"
        badge={
          <span className="px-2.5 py-1 text-xs font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-full">
            Design SaaS
          </span>
        }
        subtitle="Gerencie os layouts visuais globais disponíveis para os lojistas da plataforma"
        actions={<ThemeForm />}
      />

      <ThemeList initialThemes={allThemes} />
    </div>
  );
}

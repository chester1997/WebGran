import { db } from "@/db";
import { themes } from "@/db/schema";
import { desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { ThemeList } from "./ThemeList";
import { ThemeForm } from "./ThemeForm";

export default async function AdminThemesPage() {
  await requireAdmin();

  const allThemes = await db.query.themes.findMany({
    orderBy: [desc(themes.createdAt)]
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Temas do WebGran</h2>
          <p className="text-muted-foreground text-sm">
            Gerencie os temas globais disponíveis para os lojistas.
          </p>
        </div>
        <ThemeForm />
      </div>

      <ThemeList initialThemes={allThemes} />
    </div>
  );
}

import { connection } from "next/server";
import { db } from "@/db";
import { themes } from "@/db/schema";
import { desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { ThemeList } from "./ThemeList";
import { ThemeForm } from "./ThemeForm";

export default async function AdminThemesPage() {
  await connection();
  await requireAdmin();

  const allThemes = await db.query.themes.findMany({
    orderBy: [desc(themes.createdAt)]
  });

  return (
    <div className="space-y-8 pb-10">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#141416] p-6 rounded-2xl border border-[#27272A] shadow-xl">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Temas do WebGran</h1>
            <span className="px-2.5 py-1 text-xs font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-full">
              Design SaaS
            </span>
          </div>
          <p className="text-gray-400 text-sm mt-1">
            Gerencie os layouts visuais globais disponíveis para os lojistas da plataforma
          </p>
        </div>

        <ThemeForm />
      </div>

      <ThemeList initialThemes={allThemes} />
    </div>
  );
}

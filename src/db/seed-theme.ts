import { db } from "./index";
import { themes } from "./schema";
import { eq } from "drizzle-orm";

async function seedTheme() {
  try {
    console.log("Verificando se o tema Studio já existe...");
    const existingTheme = await db.query.themes.findFirst({
      where: eq(themes.slug, 'studio')
    });

    if (existingTheme) {
      console.log("O tema Studio já existe. Verificando se é o padrão...");
      if (!existingTheme.isDefault) {
        await db.update(themes).set({ isDefault: true }).where(eq(themes.id, existingTheme.id));
        console.log("Tema Studio definido como padrão.");
      } else {
        console.log("Tema Studio já é o padrão.");
      }
    } else {
      console.log("Criando tema Studio...");
      await db.insert(themes).values({
        name: "Studio",
        slug: "studio",
        description: "Tema Premium Oficial com foco em covers grandes, semelhante a plataformas de streaming.",
        isDefault: true,
        isActive: true,
        config: {}
      });
      console.log("✅ Tema Studio criado com sucesso e definido como padrão!");
    }

    process.exit(0);
  } catch (error) {
    console.error("Erro ao criar tema:", error);
    process.exit(1);
  }
}

seedTheme();

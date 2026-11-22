import { like } from "drizzle-orm";
import { db } from "@/db";
import { systemSettings } from "@/db/schema";
import { PLAQUES, defaultPlaqueArts, plaqueArtKey, type PlaqueArtMap } from "./plaques";

/**
 * Artes em uso de cada placa: a troca feita pelo admin (system_settings) ou a arte padrão.
 * Em caso de erro no banco, devolve as artes padrão (a página nunca quebra por isso).
 */
export async function getPlaqueArts(): Promise<{ arts: PlaqueArtMap; custom: Record<number, boolean> }> {
  const arts = defaultPlaqueArts();
  const custom: Record<number, boolean> = Object.fromEntries(PLAQUES.map((p) => [p.value, false]));
  try {
    const rows = await db.select().from(systemSettings).where(like(systemSettings.key, "plaque_art_%"));
    for (const p of PLAQUES) {
      const row = rows.find((r) => r.key === plaqueArtKey(p.value));
      if (row?.value) {
        arts[p.value] = row.value;
        custom[p.value] = true;
      }
    }
  } catch (err) {
    console.error("[getPlaqueArts]", err);
  }
  return { arts, custom };
}

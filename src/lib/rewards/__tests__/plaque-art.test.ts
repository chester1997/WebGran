import { describe, expect, it, vi } from "vitest";

const rows: { key: string; value: string }[] = [];
vi.mock("@/db", () => ({
  db: { select: () => ({ from: () => ({ where: async () => rows }) }) },
}));

import { getPlaqueArts } from "../art";
import { detectImageType } from "../image-type";
import { PLAQUES } from "../plaques";

describe("artes das placas", () => {
  it("usa as artes oficiais padrão quando o admin não trocou nada", async () => {
    rows.length = 0;
    const { arts, custom } = await getPlaqueArts();
    expect(arts[50_000]).toBe("/premiacoes/placa-50k.webp");
    expect(arts[1_500_000]).toBe("/premiacoes/placa-1-5m.webp");
    expect(Object.values(custom).every((c) => c === false)).toBe(true);
    expect(PLAQUES.every((p) => p.art?.startsWith("/premiacoes/"))).toBe(true);
  });

  it("a arte trocada pelo admin tem prioridade só na placa trocada", async () => {
    rows.length = 0;
    rows.push({ key: "plaque_art_500000", value: "https://cdn.example/nova.webp" });
    const { arts, custom } = await getPlaqueArts();
    expect(arts[500_000]).toBe("https://cdn.example/nova.webp");
    expect(custom[500_000]).toBe(true);
    expect(arts[50_000]).toBe("/premiacoes/placa-50k.webp");
  });

  it("reconhece PNG, JPG e WEBP pelos bytes e recusa o resto", () => {
    expect(detectImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.ext).toBe("png");
    expect(detectImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))?.ext).toBe("jpg");
    expect(detectImageType(Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP")]))?.ext).toBe("webp");
    expect(detectImageType(Buffer.from("<svg></svg>"))).toBeNull();
  });
});

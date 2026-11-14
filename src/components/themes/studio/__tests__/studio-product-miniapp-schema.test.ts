import { describe, it, expect, vi, beforeEach } from "vitest";
import { products } from "@/db/schema";
import { getTableColumns } from "drizzle-orm";

describe("Mini App Product & Neon Schema Compatibility Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. Garante que a tabela products no Drizzle NÃO contém a coluna trailerVideoId / trailer_video_id", () => {
    const columns = getTableColumns(products);
    const columnKeys = Object.keys(columns);
    const dbColumnNames = Object.values(columns).map((c: any) => c.name);

    expect(columnKeys).not.toContain("trailerVideoId");
    expect(dbColumnNames).not.toContain("trailer_video_id");
  });

  it("2. Garante que as colunas essenciais de produtos do Mini App estão intactas e mapeadas", () => {
    const columns = getTableColumns(products);
    const dbColumnNames = Object.values(columns).map((c: any) => c.name);

    // Campos vitais para o catálogo e Mini App
    expect(dbColumnNames).toContain("id");
    expect(dbColumnNames).toContain("store_id");
    expect(dbColumnNames).toContain("title");
    expect(dbColumnNames).toContain("slug");
    expect(dbColumnNames).toContain("price");
    expect(dbColumnNames).toContain("compare_at_price");
    expect(dbColumnNames).toContain("delivery_type");
    expect(dbColumnNames).toContain("delivery_value");
    expect(dbColumnNames).toContain("catalog_scope");
    expect(dbColumnNames).toContain("sharing_mode");
    expect(dbColumnNames).toContain("status");
  });

  it("3. Garante que StudioProduct não referencia nem tenta buscar trailerVideoId", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const studioProductPath = path.resolve(process.cwd(), "src/components/themes/studio/views/StudioProduct.tsx");
    const content = fs.readFileSync(studioProductPath, "utf-8");

    expect(content).not.toContain("trailerVideoId");
    expect(content).not.toContain("trailerVideo");
    expect(content).not.toContain("/trailer");
  });

  it("4. Garante que StudioProductClient não referencia trailer nem player de trailer", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const clientPath = path.resolve(process.cwd(), "src/components/themes/studio/views/StudioProductClient.tsx");
    const content = fs.readFileSync(clientPath, "utf-8");

    expect(content).not.toContain("trailerState");
    expect(content).not.toContain("trailerPlaybackUrl");
    expect(content).not.toContain("trailerVideo");
    expect(content).not.toContain("/trailer");
  });
});

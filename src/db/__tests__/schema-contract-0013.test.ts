import { describe, it, expect } from "vitest";
import { combos, comboTiers, comboProducts, orders } from "@/db/schema";
import { getTableColumns } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

describe("Schema Contract & Migration 0013 Verification", () => {
  it("valida contrato exato das colunas de combo_tiers no schema.ts", () => {
    const cols = getTableColumns(comboTiers);

    // Colunas esperadas
    expect(cols).toHaveProperty("id");
    expect(cols).toHaveProperty("comboId");
    expect(cols).toHaveProperty("minQuantity");
    expect(cols).toHaveProperty("price");
    expect(cols).toHaveProperty("position");
    expect(cols).toHaveProperty("createdAt");

    // Nomes físicos no banco de dados (snake_case)
    expect(cols.id.name).toBe("id");
    expect(cols.comboId.name).toBe("combo_id");
    expect(cols.minQuantity.name).toBe("min_quantity");
    expect(cols.price.name).toBe("price");
    expect(cols.position.name).toBe("position");
    expect(cols.createdAt.name).toBe("created_at");

    // Tipos de dados e nullability
    expect(cols.minQuantity.notNull).toBe(true);
    expect(cols.price.notNull).toBe(true);
    expect(cols.position.notNull).toBe(true);
    expect(cols.position.default).toBe(0);

    // Certificar que NÃO existem colunas errôneas de outras propostas
    expect(cols).not.toHaveProperty("discountType");
    expect(cols).not.toHaveProperty("discountValue");
    expect((cols as any).discount_type).toBeUndefined();
    expect((cols as any).discount_value).toBeUndefined();
  });

  it("valida contrato das novas colunas na tabela combos", () => {
    const cols = getTableColumns(combos);

    expect(cols).toHaveProperty("type");
    expect(cols).toHaveProperty("eligibilityMode");

    expect(cols.type.name).toBe("type");
    expect(cols.type.notNull).toBe(true);
    expect(cols.type.default).toBe("curated");

    expect(cols.eligibilityMode.name).toBe("eligibility_mode");
    expect(cols.eligibilityMode.notNull).toBe(true);
    expect(cols.eligibilityMode.default).toBe("all_products");
  });

  it("valida contrato das novas colunas na tabela orders", () => {
    const cols = getTableColumns(orders);

    expect(cols).toHaveProperty("progressiveComboId");
    expect(cols).toHaveProperty("progressiveComboDiscount");
    expect(cols).toHaveProperty("progressiveComboSnapshot");

    expect(cols.progressiveComboId.name).toBe("progressive_combo_id");
    expect(cols.progressiveComboDiscount.name).toBe("progressive_combo_discount");
    expect(cols.progressiveComboSnapshot.name).toBe("progressive_combo_snapshot");

    // Nullability e default
    expect(cols.progressiveComboId.notNull).toBe(false); // opcional (só quando houver oferta aplicada)
    expect(cols.progressiveComboDiscount.default).toBe("0");
  });

  it("compara diretamente o arquivo drizzle/0013_progressive_combo_tiers.sql com o schema", () => {
    const sqlPath = path.resolve(process.cwd(), "drizzle/0013_progressive_combo_tiers.sql");
    expect(fs.existsSync(sqlPath)).toBe(true);

    const sqlContent = fs.readFileSync(sqlPath, "utf-8");

    // 1. Tabela combo_tiers deve ser criada com min_quantity, price e position
    expect(sqlContent).toContain('"combo_tiers"');
    expect(sqlContent).toContain('"min_quantity" integer NOT NULL');
    expect(sqlContent).toContain('"price" numeric(10, 2) NOT NULL');
    expect(sqlContent).toContain('"position" integer DEFAULT 0 NOT NULL');

    // 2. Não deve conter discount_type ou discount_value
    expect(sqlContent).not.toContain("discount_type");
    expect(sqlContent).not.toContain("discount_value");

    // 3. Colunas na tabela combos
    expect(sqlContent).toContain('"type" text DEFAULT \'curated\' NOT NULL');
    expect(sqlContent).toContain('"eligibility_mode" text DEFAULT \'all_products\' NOT NULL');

    // 4. Colunas na tabela orders
    expect(sqlContent).toContain('"progressive_combo_id" uuid REFERENCES "combos"("id") ON DELETE SET NULL');
    expect(sqlContent).toContain('"progressive_combo_discount" numeric(10, 2) DEFAULT 0');
    expect(sqlContent).toContain('"progressive_combo_snapshot" jsonb');

    // 5. Constraints e Índices de integridade
    expect(sqlContent).toContain('"combo_tiers_combo_quantity_uidx"');
    expect(sqlContent).toContain('"combo_tiers_combo_idx"');
    expect(sqlContent).toContain('"combo_tiers_min_quantity_check"');
    expect(sqlContent).toContain('"combo_tiers_price_check"');
    expect(sqlContent).toContain('"orders_progressive_combo_idx"');
  });
});

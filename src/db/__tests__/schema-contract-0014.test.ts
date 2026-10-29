import { describe, it, expect } from "vitest";
import { sellerCommissionSettings, sellerCommissionAuditLogs } from "@/db/schema";
import { getTableColumns } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

describe("Schema Contract & Migration 0014 Verification", () => {
  it("valida contrato exato das colunas de seller_commission_settings no schema.ts", () => {
    const cols = getTableColumns(sellerCommissionSettings);

    // Colunas esperadas
    expect(cols).toHaveProperty("id");
    expect(cols).toHaveProperty("sellerId");
    expect(cols).toHaveProperty("customFeeCents");
    expect(cols).toHaveProperty("exemptionActive");
    expect(cols).toHaveProperty("exemptionStart");
    expect(cols).toHaveProperty("exemptionEnd");
    expect(cols).toHaveProperty("exemptionReason");
    expect(cols).toHaveProperty("version");
    expect(cols).toHaveProperty("updatedAt");
    expect(cols).toHaveProperty("updatedById");
    expect(cols).toHaveProperty("updatedByName");
    expect(cols).toHaveProperty("updatedByEmail");

    // Nomes físicos no banco de dados (snake_case)
    expect(cols.id.name).toBe("id");
    expect(cols.sellerId.name).toBe("seller_id");
    expect(cols.customFeeCents.name).toBe("custom_fee_cents");
    expect(cols.exemptionActive.name).toBe("exemption_active");
    expect(cols.exemptionStart.name).toBe("exemption_start");
    expect(cols.exemptionEnd.name).toBe("exemption_end");
    expect(cols.exemptionReason.name).toBe("exemption_reason");
    expect(cols.version.name).toBe("version");
    expect(cols.updatedAt.name).toBe("updated_at");
    expect(cols.updatedById.name).toBe("updated_by_id");
    expect(cols.updatedByName.name).toBe("updated_by_name");
    expect(cols.updatedByEmail.name).toBe("updated_by_email");

    // Nullability e defaults
    expect(cols.sellerId.notNull).toBe(true);
    expect(cols.exemptionActive.notNull).toBe(true);
    expect(cols.version.notNull).toBe(true);
    expect(cols.updatedAt.notNull).toBe(true);
    expect(cols.customFeeCents.notNull).toBe(false); // NULL herda padrão
  });

  it("valida contrato exato das colunas de seller_commission_audit_logs no schema.ts", () => {
    const cols = getTableColumns(sellerCommissionAuditLogs);

    expect(cols).toHaveProperty("id");
    expect(cols).toHaveProperty("sellerId");
    expect(cols).toHaveProperty("previousFeeCents");
    expect(cols).toHaveProperty("newFeeCents");
    expect(cols).toHaveProperty("previousExemptionActive");
    expect(cols).toHaveProperty("newExemptionActive");
    expect(cols).toHaveProperty("previousExemptionStart");
    expect(cols).toHaveProperty("previousExemptionEnd");
    expect(cols).toHaveProperty("newExemptionStart");
    expect(cols).toHaveProperty("newExemptionEnd");
    expect(cols).toHaveProperty("reason");
    expect(cols).toHaveProperty("changedById");
    expect(cols).toHaveProperty("changedByName");
    expect(cols).toHaveProperty("changedByEmail");
    expect(cols).toHaveProperty("createdAt");

    expect(cols.id.name).toBe("id");
    expect(cols.sellerId.name).toBe("seller_id");
    expect(cols.reason.name).toBe("reason");
    expect(cols.reason.notNull).toBe(true);
    expect(cols.createdAt.name).toBe("created_at");
    expect(cols.createdAt.notNull).toBe(true);
  });

  it("valida a existência e integridade do arquivo de migration 0014_seller_commission_settings.sql", () => {
    const migrationPath = path.join(process.cwd(), "drizzle", "0014_seller_commission_settings.sql");
    expect(fs.existsSync(migrationPath)).toBe(true);

    const sqlContent = fs.readFileSync(migrationPath, "utf-8");

    // Deve conter proteção transacional e lock timeout
    expect(sqlContent).toContain("BEGIN;");
    expect(sqlContent).toContain("SET LOCAL lock_timeout = '3s';");
    expect(sqlContent).toContain("SELECT pg_advisory_xact_lock(2026102801);");

    // Deve criar tabelas se não existirem
    expect(sqlContent).toContain('CREATE TABLE IF NOT EXISTS "seller_commission_settings"');
    expect(sqlContent).toContain('CREATE TABLE IF NOT EXISTS "seller_commission_audit_logs"');

    // Deve conter check constraints
    expect(sqlContent).toContain('"seller_comm_fee_check"');
    expect(sqlContent).toContain('"seller_comm_exemption_dates_check"');

    // Deve conter índices de auditoria
    expect(sqlContent).toContain('"seller_comm_audit_seller_idx"');
    expect(sqlContent).toContain('"seller_comm_audit_created_idx"');

    // Finalizar com COMMIT
    expect(sqlContent).toContain("COMMIT;");
  });
});


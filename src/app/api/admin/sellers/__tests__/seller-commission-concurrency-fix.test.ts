import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, PATCH } from "../[id]/commission/route";
import {
  SellerCommissionService,
  SellerCommissionValidationError,
  SellerCommissionConcurrencyError,
} from "@/lib/commission/seller-commission-service";
import { PlatformCommissionService } from "@/lib/commission/platform-commission-service";
import { requirePlatformAdmin } from "@/lib/auth";
import { db } from "@/db";

vi.mock("@/lib/auth", () => ({
  requirePlatformAdmin: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(),
      },
      sellerCommissionSettings: {
        findFirst: vi.fn(),
      },
      sellerCommissionAuditLogs: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    },
    transaction: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
  sellerCommissionSettings: {
    id: "id",
    sellerId: "seller_id",
    customFeeCents: "custom_fee_cents",
    exemptionActive: "exemption_active",
    exemptionStart: "exemption_start",
    exemptionEnd: "exemption_end",
    exemptionReason: "exemption_reason",
    version: "version",
    updatedAt: "updated_at",
    updatedById: "updated_by_id",
    updatedByName: "updated_by_name",
    updatedByEmail: "updated_by_email",
  },
  sellerCommissionAuditLogs: {
    id: "id",
    sellerId: "seller_id",
    previousFeeCents: "previous_fee_cents",
    newFeeCents: "new_fee_cents",
    previousExemptionActive: "previous_exemption_active",
    newExemptionActive: "new_exemption_active",
    previousExemptionStart: "previous_exemption_start",
    previousExemptionEnd: "previous_exemption_end",
    newExemptionStart: "new_exemption_start",
    newExemptionEnd: "new_exemption_end",
    reason: "reason",
    changedById: "changed_by_id",
    changedByName: "changed_by_name",
    changedByEmail: "changed_by_email",
    createdAt: "created_at",
  },
}));

describe("Regressão e Validação: Resolução do Falso Conflito de Concorrência ao Salvar Taxa do Vendedor", () => {
  const mockAdmin = {
    id: "admin-uuid-1",
    name: "Administrador Geral",
    email: "admin@webgran.com",
    role: "super_admin",
  };

  const mockSeller = {
    id: "seller-uuid-123",
    name: "Vendedor Alpha",
    email: "alpha@vendedor.com",
    role: "seller",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requirePlatformAdmin).mockResolvedValue(mockAdmin as any);
    vi.mocked(db.query.users.findFirst as any).mockResolvedValue(mockSeller);
    vi.spyOn(PlatformCommissionService, "getCurrentCommissionCents").mockResolvedValue(50);
  });

  it("1. Um administrador consegue salvar uma taxa para vendedor novo (versão inicial 0 -> 1)", async () => {
    // Simula que o vendedor não tem registro prévio
    let persistedRow: any = null;
    const auditEntries: any[] = [];

    const mockTx = {
      query: {
        sellerCommissionSettings: {
          findFirst: vi.fn().mockImplementation(async () => persistedRow),
        },
      },
      insert: vi.fn().mockImplementation((table: any) => {
        return {
          values: vi.fn().mockImplementation((val: any) => {
            if (val.customFeeCents !== undefined) {
              persistedRow = { ...val, id: "cfg-1" };
              return {
                returning: vi.fn().mockResolvedValue([persistedRow]),
              };
            } else {
              auditEntries.push({ ...val, id: "log-1" });
              return {
                returning: vi.fn().mockResolvedValue([val]),
              };
            }
          }),
        };
      }),
    };

    vi.spyOn(db, "transaction").mockImplementation(async (cb: any) => cb(mockTx));

    // GET inicial retorna version: 0
    vi.spyOn(db.query.sellerCommissionSettings, "findFirst").mockResolvedValue(null as any);
    const getReq = new Request(`http://localhost/api/admin/sellers/${mockSeller.id}/commission`);
    const getRes = await GET(getReq, { params: Promise.resolve({ id: mockSeller.id }) });
    const getJson = await getRes.json();

    expect(getRes.status).toBe(200);
    expect(getJson.data.version).toBe(0);
    expect(getJson.data.setting).toBeNull();

    // Salva com expectedVersion: 0 (sem conflito falso!)
    const patchReq = new Request(`http://localhost/api/admin/sellers/${mockSeller.id}/commission`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "CUSTOM",
        customFeeCents: 20,
        expectedVersion: 0,
        reason: "Taxa especial negociada na integração",
      }),
    });

    const patchRes = await PATCH(patchReq, { params: Promise.resolve({ id: mockSeller.id }) });
    expect(patchRes.status).toBe(200);
    const patchJson = await patchRes.json();

    expect(patchJson.success).toBe(true);
    expect(patchJson.data.setting.version).toBe(1);
    expect(patchJson.data.setting.customFeeCents).toBe(20);
    expect(auditEntries).toHaveLength(1);
    expect(auditEntries[0].newFeeCents).toBe(20);
  });

  it("2. Reabrir o modal e salvar novamente não produz conflito falso (atualiza de v1 para v2)", async () => {
    // Vendedor já possui configuração na versão 1
    let persistedRow: any = {
      id: "cfg-1",
      sellerId: mockSeller.id,
      customFeeCents: 20,
      exemptionActive: false,
      version: 1,
      updatedAt: new Date(),
    };

    const mockTx = {
      query: {
        sellerCommissionSettings: {
          findFirst: vi.fn().mockImplementation(async () => persistedRow),
        },
      },
      update: vi.fn().mockImplementation(() => ({
        set: vi.fn().mockImplementation((updates: any) => ({
          where: vi.fn().mockImplementation(() => {
            persistedRow = { ...persistedRow, ...updates, version: persistedRow.version + 1 };
            return {
              returning: vi.fn().mockResolvedValue([persistedRow]),
            };
          }),
        })),
      })),
      insert: vi.fn().mockImplementation(() => ({
        values: vi.fn().mockResolvedValue([]),
      })),
    };

    vi.spyOn(db, "transaction").mockImplementation(async (cb: any) => cb(mockTx));

    // GET do modal reaberto retorna version: 1
    vi.spyOn(db.query.sellerCommissionSettings, "findFirst").mockResolvedValue(persistedRow);
    const getReq = new Request(`http://localhost/api/admin/sellers/${mockSeller.id}/commission`);
    const getRes = await GET(getReq, { params: Promise.resolve({ id: mockSeller.id }) });
    const getJson = await getRes.json();

    expect(getJson.data.version).toBe(1);
    expect(getJson.data.setting.customFeeCents).toBe(20);

    // Salva nova alteração com expectedVersion: 1
    const patchReq = new Request(`http://localhost/api/admin/sellers/${mockSeller.id}/commission`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "CUSTOM",
        customFeeCents: 15,
        expectedVersion: 1,
        reason: "Revisão periódica de taxa para v2",
      }),
    });

    const patchRes = await PATCH(patchReq, { params: Promise.resolve({ id: mockSeller.id }) });
    expect(patchRes.status).toBe(200);
    const patchJson = await patchRes.json();

    expect(patchJson.success).toBe(true);
    expect(patchJson.data.setting.version).toBe(2);
    expect(patchJson.data.setting.customFeeCents).toBe(15);
  });

  it("3. Detecta conflito real entre duas alterações simultâneas (concorrência legítima)", async () => {
    // Banco já está na versão 2 (outro admin salvou)
    const mockTx = {
      query: {
        sellerCommissionSettings: {
          findFirst: vi.fn().mockResolvedValue({
            id: "cfg-1",
            sellerId: mockSeller.id,
            customFeeCents: 30,
            version: 2, // Versão atual no banco
          }),
        },
      },
    };

    vi.spyOn(db, "transaction").mockImplementation(async (cb: any) => cb(mockTx));

    // Admin envia expectedVersion: 1 (desatualizada!)
    const patchReq = new Request(`http://localhost/api/admin/sellers/${mockSeller.id}/commission`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "CUSTOM",
        customFeeCents: 10,
        expectedVersion: 1, // Desatualizado
        reason: "Tentativa concorrente",
      }),
    });

    const patchRes = await PATCH(patchReq, { params: Promise.resolve({ id: mockSeller.id }) });
    expect(patchRes.status).toBe(409);
    const patchJson = await patchRes.json();

    expect(patchJson.success).toBe(false);
    expect(patchJson.code).toBe("CONCURRENCY_CONFLICT");
    expect(patchJson.error).toContain("Conflito de concorrência");
  });

  it("4. Um formulário com versão desatualizada NÃO sobrescreve dados mais recentes", async () => {
    let updateExecuted = false;

    const mockTx = {
      query: {
        sellerCommissionSettings: {
          findFirst: vi.fn().mockResolvedValue({
            id: "cfg-1",
            sellerId: mockSeller.id,
            customFeeCents: 45,
            version: 5, // Versão mais recente
          }),
        },
      },
      update: vi.fn().mockImplementation(() => {
        updateExecuted = true;
        return {
          set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning: vi.fn() }) }),
        };
      }),
    };

    vi.spyOn(db, "transaction").mockImplementation(async (cb: any) => cb(mockTx));

    const patchReq = new Request(`http://localhost/api/admin/sellers/${mockSeller.id}/commission`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "CUSTOM",
        customFeeCents: 0,
        expectedVersion: 4, // Tentando sobrescrever v5 com base na v4
        reason: "Tentativa de sobrescrita",
      }),
    });

    const patchRes = await PATCH(patchReq, { params: Promise.resolve({ id: mockSeller.id }) });
    expect(patchRes.status).toBe(409);
    expect(updateExecuted).toBe(false); // Garante que a escrita NÃO ocorreu
  });

  it("5. Após conflito real, recarregar dados entrega a versão e valores atualizados", async () => {
    // Simula o recarregamento (GET) pós-conflito
    vi.spyOn(db.query.sellerCommissionSettings, "findFirst").mockResolvedValue({
      id: "cfg-1",
      sellerId: mockSeller.id,
      customFeeCents: 35,
      exemptionActive: false,
      version: 5,
    } as any);

    const getReq = new Request(`http://localhost/api/admin/sellers/${mockSeller.id}/commission`);
    const getRes = await GET(getReq, { params: Promise.resolve({ id: mockSeller.id }) });
    const getJson = await getRes.json();

    expect(getRes.status).toBe(200);
    expect(getJson.data.version).toBe(5);
    expect(getJson.data.setting.customFeeCents).toBe(35);
  });

  it("6. O histórico de auditoria preserva o autor e motivo das alterações", async () => {
    const auditLogs: any[] = [];
    const mockTx = {
      query: {
        sellerCommissionSettings: {
          findFirst: vi.fn().mockResolvedValue({
            id: "cfg-1",
            sellerId: mockSeller.id,
            customFeeCents: 50,
            version: 1,
          }),
        },
      },
      update: vi.fn().mockImplementation(() => ({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              {
                id: "cfg-1",
                sellerId: mockSeller.id,
                customFeeCents: 25,
                version: 2,
              },
            ]),
          }),
        }),
      })),
      insert: vi.fn().mockImplementation(() => ({
        values: vi.fn().mockImplementation((val: any) => {
          auditLogs.push(val);
          return Promise.resolve([]);
        }),
      })),
    };

    vi.spyOn(db, "transaction").mockImplementation(async (cb: any) => cb(mockTx));

    const patchReq = new Request(`http://localhost/api/admin/sellers/${mockSeller.id}/commission`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "CUSTOM",
        customFeeCents: 25,
        expectedVersion: 1,
        reason: "Acordo promocional anual",
      }),
    });

    const patchRes = await PATCH(patchReq, { params: Promise.resolve({ id: mockSeller.id }) });
    expect(patchRes.status).toBe(200);
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0].reason).toBe("Acordo promocional anual");
    expect(auditLogs[0].changedById).toBe(mockAdmin.id);
    expect(auditLogs[0].previousFeeCents).toBe(50);
    expect(auditLogs[0].newFeeCents).toBe(25);
  });

  it("7. Falhas de validação (ex: justificativa ausente, taxa inválida) continuam barradas com HTTP 400", async () => {
    // Justificativa vazia
    const reqNoReason = new Request(`http://localhost/api/admin/sellers/${mockSeller.id}/commission`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "CUSTOM",
        customFeeCents: 20,
        expectedVersion: 0,
        reason: "   ", // Inválido
      }),
    });

    const resNoReason = await PATCH(reqNoReason, { params: Promise.resolve({ id: mockSeller.id }) });
    expect(resNoReason.status).toBe(400);
    const jsonNoReason = await resNoReason.json();
    expect(jsonNoReason.error).toContain("justificativa da alteração é obrigatória");

    // Taxa acima do teto de R$ 0,50
    const reqInvalidFee = new Request(`http://localhost/api/admin/sellers/${mockSeller.id}/commission`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "CUSTOM",
        customFeeCents: 90,
        expectedVersion: 0,
        reason: "Taxa acima do teto",
      }),
    });

    const resInvalidFee = await PATCH(reqInvalidFee, { params: Promise.resolve({ id: mockSeller.id }) });
    expect(resInvalidFee.status).toBe(400);
    const jsonInvalidFee = await resInvalidFee.json();
    expect(jsonInvalidFee.error).toContain("Taxa personalizada deve ser um valor entre R$ 0,00 e R$ 0,50");
  });
});

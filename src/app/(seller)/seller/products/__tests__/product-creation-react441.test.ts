import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth
vi.mock("@/lib/auth", () => ({
  requireSeller: vi.fn(),
  getCurrentStore: vi.fn(),
}));

// Mock db
vi.mock("@/db", () => {
  const insertReturning = vi.fn();
  const insertValues = vi.fn(() => ({ returning: insertReturning }));
  const insert = vi.fn(() => ({ values: insertValues }));
  const updateWhere = vi.fn();
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set: updateSet }));
  const deleteWhere = vi.fn();
  const deleteFn = vi.fn(() => ({ where: deleteWhere }));

  const selectWhere = vi.fn();
  const selectFrom = vi.fn(() => ({ where: selectWhere }));
  const select = vi.fn(() => ({ from: selectFrom }));

  return {
    db: {
      select,
      insert,
      update,
      delete: deleteFn,
      query: {
        products: { findFirst: vi.fn(), findMany: vi.fn() },
        productVideos: { findFirst: vi.fn(), findMany: vi.fn() },
        productCarousels: { findFirst: vi.fn(), findMany: vi.fn() },
        carouselProducts: { findMany: vi.fn() },
        telegramBots: { findFirst: vi.fn(), findMany: vi.fn() },
      },
    },
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/entitlements/entitlement-service", () => ({
  checkLimit: vi.fn().mockResolvedValue({ allowed: true, limit: 100 }),
}));

vi.mock("@/lib/telegram/product-chat-validator", () => ({
  validateProductTelegramChat: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/storage/lifecycle-service", () => ({
  MediaLifecycleService: {
    handleImageReplacement: vi.fn().mockResolvedValue(undefined),
    deleteMediaFile: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/lib/storage/storage-usage-service", () => ({
  StorageUsageService: {
    reserveStorageForUpload: vi.fn().mockResolvedValue({ allowed: true, reservationId: "res-1" }),
    confirmReservation: vi.fn().mockResolvedValue(true),
    releaseReservation: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock("@/lib/storage/provider", () => ({
  getStorageProvider: vi.fn().mockReturnValue({
    upload: vi.fn().mockResolvedValue({ url: "https://cdn.test/prod.webp", sizeBytes: 1000 }),
  }),
  generateMultiTenantStoragePath: vi.fn().mockReturnValue("stores/store-1/products/prod.webp"),
}));

vi.mock("@/lib/videos/product-video-service", () => ({
  ProductVideoService: {
    assignVideosToProduct: vi.fn().mockResolvedValue(undefined),
    listProductVideos: vi.fn().mockResolvedValue([]),
  },
}));

import { requireSeller, getCurrentStore } from "@/lib/auth";
import { checkLimit } from "@/lib/entitlements/entitlement-service";
import { validateProductTelegramChat } from "@/lib/telegram/product-chat-validator";
import { db } from "@/db";
import { createProductAction, updateProductAction } from "../actions";

describe("Product Creation & React #441 Prevention Suite", () => {
  const mockSeller = { id: "seller-441", email: "seller441@test.com" };
  const mockStore = { id: "store-441", name: "Loja 441", slug: "loja-441" };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireSeller).mockResolvedValue(mockSeller as any);
    vi.mocked(getCurrentStore).mockResolvedValue(mockStore as any);
    vi.mocked(checkLimit).mockResolvedValue({ allowed: true, limit: 100 } as any);
    vi.mocked(validateProductTelegramChat).mockResolvedValue({ success: true });

    // Default db count
    const selectWhere = vi.fn().mockResolvedValue([{ count: 2 }]);
    const selectFrom = vi.fn(() => ({ where: selectWhere }));
    vi.mocked(db.select).mockReturnValue({ from: selectFrom } as any);

    // Default db insert
    const returningFn = vi.fn().mockResolvedValue([{ id: "prod-new-123", title: "Produto Criado" }]);
    const valuesFn = vi.fn(() => ({ returning: returningFn }));
    vi.mocked(db.insert).mockReturnValue({ values: valuesFn } as any);
  });

  it("1. Cria produto válido com sucesso retornando { success: true, product }", async () => {
    const formData = new FormData();
    formData.set("title", "Curso Profissional de React");
    formData.set("price", "97.00");
    formData.set("deliveryType", "telegram");
    formData.set("deliveryValue", "-1001999888777");

    const res = await createProductAction(formData);

    expect(res.success).toBe(true);
    expect(res.product?.id).toBe("prod-new-123");
    expect(res.product?.title).toBe("Produto Criado");
  });

  it("2. Valida título obrigatório retornando erro amigável sem lançar exceção (#441 prevention)", async () => {
    const formData = new FormData();
    formData.set("title", "");
    formData.set("price", "97.00");

    const res = await createProductAction(formData);

    expect(res.success).toBe(false);
    expect(res.error).toBe("O título do produto é obrigatório.");
  });

  it("3. Valida preço inválido retornando erro amigável sem lançar exceção", async () => {
    const formData = new FormData();
    formData.set("title", "Produto Preço Negativo");
    formData.set("price", "-10");

    const res = await createProductAction(formData);

    expect(res.success).toBe(false);
    expect(res.error).toBe("Informe um preço válido maior ou igual a zero.");
  });

  it("4. Valida limite de plano retornando erro informativo sem derrubar a tela", async () => {
    vi.mocked(checkLimit).mockResolvedValueOnce({
      allowed: false,
      limit: 5,
    } as any);

    const formData = new FormData();
    formData.set("title", "Produto Extra");
    formData.set("price", "50.00");
    formData.set("deliveryType", "external");
    formData.set("deliveryValue", "https://link.com");

    const res = await createProductAction(formData);

    expect(res.success).toBe(false);
    expect(res.error).toContain("Limite de produtos atingido");
  });

  it("5. Retorna erro específico da validação do Telegram sem máscara minificada", async () => {
    vi.mocked(validateProductTelegramChat).mockResolvedValueOnce({
      success: false,
      code: "CHAT_NOT_FOUND",
      error: "❌ Grupo/canal não encontrado. O bot da loja não conseguiu localizar o grupo/canal informado.",
    });

    const formData = new FormData();
    formData.set("title", "Produto Grupo Telegram");
    formData.set("price", "49.90");
    formData.set("deliveryType", "telegram");
    formData.set("deliveryValue", "-100111222333");

    const res = await createProductAction(formData);

    expect(res.success).toBe(false);
    expect(res.error).toContain("Grupo/canal não encontrado");
  });

  it("6. Previne duplicidade validando carrosséis ANTES de inserir no banco", async () => {
    vi.mocked(db.query.productCarousels.findMany).mockResolvedValueOnce([
      { id: "c-valid-1" } as any, // Only 1 found, but 2 submitted
    ]);

    const formData = new FormData();
    formData.set("title", "Produto Carrossel Inválido");
    formData.set("price", "79.90");
    formData.set("deliveryType", "external");
    formData.set("deliveryValue", "https://externo.com");
    formData.set("carouselIds", JSON.stringify(["c-valid-1", "c-invalid-2"]));

    const res = await createProductAction(formData);

    expect(res.success).toBe(false);
    expect(res.error).toBe("Um ou mais carrosséis selecionados são inválidos ou não pertencem a esta loja.");

    // Verifica que NENHUM produto foi inserido no banco (evita órfão/duplicata)
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("7. Trata falha de persistência no Neon sem quebrar a Server Action", async () => {
    const valuesFn = vi.fn(() => ({
      returning: vi.fn().mockRejectedValueOnce(new Error("Connection to Neon DB timed out")),
    }));
    vi.mocked(db.insert).mockReturnValueOnce({ values: valuesFn } as any);

    const formData = new FormData();
    formData.set("title", "Produto Falha DB");
    formData.set("price", "39.90");
    formData.set("deliveryType", "external");
    formData.set("deliveryValue", "https://link.com");

    const res = await createProductAction(formData);

    expect(res.success).toBe(false);
    expect(res.error).toContain("Erro ao gravar produto no banco de dados");
  });
});


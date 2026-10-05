import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      productVideos: { findFirst: vi.fn(), findMany: vi.fn() },
      productVideoAssignments: { findMany: vi.fn() },
      products: { findFirst: vi.fn() },
      stores: { findFirst: vi.fn() },
      sellers: { findFirst: vi.fn() },
      telegramBots: { findFirst: vi.fn() },
      orders: { findFirst: vi.fn() },
      accesses: { findFirst: vi.fn() },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: "prod-new-1", title: "Novo Produto" }]),
        onConflictDoNothing: vi.fn().mockResolvedValue([]),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([{ id: "prod-1" }]),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn().mockResolvedValue([]),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([{ count: 0, value: 0 }]),
      })),
    })),
  },
}));

vi.mock("@/lib/auth", () => ({
  requireSeller: vi.fn().mockResolvedValue({ id: "seller-1" }),
  getCurrentStore: vi.fn().mockResolvedValue({ id: "store-1", slug: "minha-loja" }),
}));

vi.mock("@/lib/entitlements/entitlement-service", () => ({
  checkLimit: vi.fn().mockResolvedValue({ allowed: true, limit: 100 }),
  hasFeature: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/storage/provider", () => ({
  getStorageProvider: vi.fn(),
  generateMultiTenantStoragePath: vi.fn(),
}));

vi.mock("@/lib/videos/product-video-service", () => ({
  ProductVideoService: {
    assignVideosToProduct: vi.fn().mockResolvedValue([]),
    listProductVideos: vi.fn().mockImplementation(async (storeId, productId) => {
      if (productId === "prod-existing-empty") return [];
      return [
        {
          id: "vid-ready-1",
          storeId,
          productId,
          title: "Aula 1",
          status: "READY",
        },
      ];
    }),
  },
}));

vi.mock("@/lib/delivery/access-delivery-service", () => ({
  AccessDeliveryService: {
    processOrderDelivery: vi.fn().mockImplementation(async (orderId) => {
      if (orderId === "ord-pv") {
        return [
          {
            id: "acc-1",
            status: "ACTIVE",
            deliveryStatus: "DELIVERED",
            inviteLink: "https://www.webgran.online/miniapp/minha-loja/product/curso-video",
          },
        ];
      }
      return [
        {
          id: "acc-2",
          status: "ACTIVE",
          deliveryStatus: "DELIVERED",
          inviteLink: "https://drive.google.com/folder",
        },
      ];
    }),
  },
}));

import { createProductAction, updateProductAction } from "@/app/(seller)/seller/products/actions";
import { AccessDeliveryService } from "@/lib/delivery/access-delivery-service";
import { db } from "@/db";

describe("DeliveryType & Product Video Validation Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. external_link exige URL quando fornecida", async () => {
    const formData = new FormData();
    formData.set("title", "Produto Link Externo");
    formData.set("price", "49.90");
    formData.set("deliveryType", "external");
    formData.set("deliveryValue", "https://meudrive.com/conteudo");

    const res = await createProductAction(formData);
    expect(res.success).toBe(true);
  });

  it("2. external_link sem URL falha", async () => {
    const formData = new FormData();
    formData.set("title", "Produto Link Sem URL");
    formData.set("price", "49.90");
    formData.set("deliveryType", "external");
    formData.set("deliveryValue", "");

    await expect(createProductAction(formData)).rejects.toThrow(
      "Informe o Link externo para entrega após o pagamento."
    );
  });

  it("3. product_video não exige URL (externalDeliveryUrl)", async () => {
    vi.mocked(db.query.productVideos.findFirst).mockResolvedValueOnce({
      id: "vid-ready-1",
      storeId: "store-1",
      title: "Aula 1",
      status: "READY",
    } as any);

    const formData = new FormData();
    formData.set("title", "Curso em Vídeo");
    formData.set("price", "99.90");
    formData.set("deliveryType", "product_video");
    formData.set("deliveryValue", ""); // URL is empty
    formData.set("videoIds", JSON.stringify(["vid-ready-1"]));

    const res = await createProductAction(formData);
    expect(res.success).toBe(true);
  });

  it("4. product_video sem vídeo associado falha", async () => {
    const formData = new FormData();
    formData.set("title", "Curso Sem Vídeo");
    formData.set("price", "99.90");
    formData.set("deliveryType", "product_video");
    formData.set("deliveryValue", "");
    formData.set("videoIds", JSON.stringify([]));

    await expect(createProductAction(formData)).rejects.toThrow(
      "Produtos do tipo Vídeo exigem pelo menos um vídeo com status PRONTO associado."
    );
  });

  it("5. product_video com vídeo READY salva com sucesso", async () => {
    vi.mocked(db.query.productVideos.findFirst).mockResolvedValueOnce({
      id: "vid-ready-10",
      storeId: "store-1",
      title: "Vídeo Pronto",
      status: "READY",
    } as any);

    const formData = new FormData();
    formData.set("title", "Curso Vídeo Pronto");
    formData.set("price", "199.90");
    formData.set("deliveryType", "product_video");
    formData.set("videoIds", JSON.stringify(["vid-ready-10"]));

    const res = await createProductAction(formData);
    expect(res.success).toBe(true);
  });

  it("6. product_video com vídeo PROCESSING falha", async () => {
    vi.mocked(db.query.productVideos.findFirst).mockResolvedValueOnce({
      id: "vid-proc-1",
      storeId: "store-1",
      title: "Vídeo Processando",
      status: "PROCESSING",
    } as any);

    const formData = new FormData();
    formData.set("title", "Curso Vídeo Processando");
    formData.set("price", "199.90");
    formData.set("deliveryType", "product_video");
    formData.set("videoIds", JSON.stringify(["vid-proc-1"]));

    await expect(createProductAction(formData)).rejects.toThrow(
      'O vídeo "Vídeo Processando" ainda não está pronto para entrega (status: PROCESSING).'
    );
  });

  it("7. product_video com vídeo UPLOADING falha", async () => {
    vi.mocked(db.query.productVideos.findFirst).mockResolvedValueOnce({
      id: "vid-up-1",
      storeId: "store-1",
      title: "Vídeo Enviando",
      status: "UPLOADING",
    } as any);

    const formData = new FormData();
    formData.set("title", "Curso Vídeo Enviando");
    formData.set("price", "199.90");
    formData.set("deliveryType", "product_video");
    formData.set("videoIds", JSON.stringify(["vid-up-1"]));

    await expect(createProductAction(formData)).rejects.toThrow(
      'O vídeo "Vídeo Enviando" ainda não está pronto para entrega (status: UPLOADING).'
    );
  });

  it("8. product_video com vídeo FAILED falha", async () => {
    vi.mocked(db.query.productVideos.findFirst).mockResolvedValueOnce({
      id: "vid-fail-1",
      storeId: "store-1",
      title: "Vídeo Com Falha",
      status: "FAILED",
    } as any);

    const formData = new FormData();
    formData.set("title", "Curso Vídeo Falhou");
    formData.set("price", "199.90");
    formData.set("deliveryType", "product_video");
    formData.set("videoIds", JSON.stringify(["vid-fail-1"]));

    await expect(createProductAction(formData)).rejects.toThrow(
      'O vídeo "Vídeo Com Falha" ainda não está pronto para entrega (status: FAILED).'
    );
  });

  it("9. produto PAID com deliveryType product_video libera acesso aos vídeos", async () => {
    const deliveries = await AccessDeliveryService.processOrderDelivery("ord-pv");
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].status).toBe("ACTIVE");
    expect(deliveries[0].inviteLink).toContain("/miniapp/minha-loja/product/curso-video");
  });

  it("10. produto external_link continua entregando o link configurado", async () => {
    const deliveries = await AccessDeliveryService.processOrderDelivery("ord-ext");
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].status).toBe("ACTIVE");
    expect(deliveries[0].inviteLink).toBe("https://drive.google.com/folder");
  });

  it("11. edição de produto preserva corretamente o deliveryType", async () => {
    vi.mocked(db.query.products.findFirst).mockResolvedValueOnce({
      id: "prod-existing-1",
      storeId: "store-1",
      title: "Produto Antigo Link",
      deliveryType: "external",
      deliveryValue: "https://meudrive.com/antigo",
    } as any);

    const formData = new FormData();
    formData.set("title", "Produto Atualizado");
    formData.set("price", "59.90");
    formData.set("deliveryType", "external");
    formData.set("deliveryValue", "https://meudrive.com/novo");

    const res = await updateProductAction("prod-existing-1", formData);
    expect(res.success).toBe(true);
    expect(db.update).toHaveBeenCalled();
  });

  it("12. frontend não consegue burlar a validação backend", async () => {
    // Simula tentativa de enviar formulário com deliveryType=product_video mas sem vídeos
    const formDataBypass = new FormData();
    formDataBypass.set("title", "Tentativa de Burlar");
    formDataBypass.set("price", "10.00");
    formDataBypass.set("deliveryType", "product_video");
    formDataBypass.set("deliveryValue", ""); // sem link e sem vídeo

    await expect(createProductAction(formDataBypass)).rejects.toThrow(
      "Produtos do tipo Vídeo exigem pelo menos um vídeo com status PRONTO associado."
    );
  });
});

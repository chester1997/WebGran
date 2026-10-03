import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProductVideoService } from "../product-video-service";
import { db } from "@/db";
import { generateBunnyPlaybackToken } from "@/lib/bunny/token";

vi.mock("@/db", () => ({
  db: {
    query: {
      accesses: {
        findFirst: vi.fn(),
      },
      productVideos: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      productVideoAssignments: {
        findMany: vi.fn(),
      },
      videoProgress: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "prog-1", positionSeconds: 30 }]),
        }),
      }),
    }),
  },
}));

vi.mock("@/lib/bunny/token", () => ({
  generateBunnyPlaybackToken: vi.fn().mockReturnValue({
    videoId: "bunny-vid-1",
    playbackUrl: "https://vz-73b50578-eab.b-cdn.net/bunny-vid-1/playlist.m3u8?token=xyz&expires=123",
    directUrl: "https://vz-73b50578-eab.cdn.net/bunny-vid-1/play_720p.mp4?token=xyz&expires=123",
    expiresAt: 123456789,
  }),
}));

describe("Product Video Delivery & Access Integration (PASSO 3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateBunnyPlaybackToken).mockReturnValue({
      videoId: "bunny-vid-1",
      playbackUrl: "https://vz-73b50578-eab.b-cdn.net/bunny-vid-1/playlist.m3u8?token=xyz&expires=123",
      directUrl: "https://vz-73b50578-eab.cdn.net/bunny-vid-1/play_720p.mp4?token=xyz&expires=123",
      expiresAt: 123456789,
    });
  });

  it("1. Cliente com access ativo consegue listar vídeos", async () => {
    vi.mocked(db.query.accesses.findFirst).mockResolvedValueOnce({
      id: "acc-1",
      storeId: "store-1",
      customerId: "cust-1",
      productId: "prod-1",
      status: "ACTIVE",
      expiresAt: null,
    } as any);

    vi.mocked(db.query.productVideoAssignments.findMany).mockResolvedValueOnce([
      {
        id: "pva-1",
        storeId: "store-1",
        productId: "prod-1",
        videoId: "vid-1",
        position: 0,
        video: {
          id: "vid-1",
          title: "Aula 01",
          description: "Intro",
          status: "READY",
          active: true,
          durationSeconds: 120,
          thumbnailUrl: "thumb.jpg",
        },
      },
    ] as any);

    vi.mocked(db.query.productVideos.findMany).mockResolvedValueOnce([]);
    vi.mocked(db.query.videoProgress.findFirst).mockResolvedValueOnce(null as any);

    const videos = await ProductVideoService.listCustomerProductVideos("store-1", "cust-1", "prod-1");
    expect(videos).toHaveLength(1);
    expect(videos[0].title).toBe("Aula 01");
  });

  it("2. Cliente sem access não consegue listar vídeos", async () => {
    vi.mocked(db.query.accesses.findFirst).mockResolvedValueOnce(null as any);

    await expect(
      ProductVideoService.listCustomerProductVideos("store-1", "cust-no-access", "prod-1")
    ).rejects.toThrow("Você não possui acesso válido a este produto.");
  });

  it("3. Cliente sem access não consegue gerar playback", async () => {
    vi.mocked(db.query.productVideos.findFirst).mockResolvedValueOnce({
      id: "vid-1",
      storeId: "store-1",
      productId: "prod-1",
      bunnyVideoId: "bunny-vid-1",
      status: "READY",
      active: true,
    } as any);

    vi.mocked(db.query.productVideoAssignments.findMany).mockResolvedValueOnce([
      { productId: "prod-1", videoId: "vid-1" },
    ] as any);

    vi.mocked(db.query.accesses.findFirst).mockResolvedValueOnce(null as any);

    await expect(
      ProductVideoService.getProductVideoForPlayback("store-1", "cust-no-access", "vid-1")
    ).rejects.toThrow("Você não possui acesso válido a este produto.");
  });

  it("4. Cliente com access expirado não consegue playback", async () => {
    vi.mocked(db.query.productVideos.findFirst).mockResolvedValueOnce({
      id: "vid-1",
      storeId: "store-1",
      productId: "prod-1",
      bunnyVideoId: "bunny-vid-1",
      status: "READY",
      active: true,
    } as any);

    vi.mocked(db.query.productVideoAssignments.findMany).mockResolvedValueOnce([
      { productId: "prod-1", videoId: "vid-1" },
    ] as any);

    const pastDate = new Date(Date.now() - 10000);
    vi.mocked(db.query.accesses.findFirst).mockResolvedValueOnce({
      id: "acc-exp",
      status: "ACTIVE",
      expiresAt: pastDate,
    } as any);

    await expect(
      ProductVideoService.getProductVideoForPlayback("store-1", "cust-expired", "vid-1")
    ).rejects.toThrow("Seu acesso a este produto expirou.");
  });

  it("5. Cliente consegue acessar todos os vídeos associados ao produto comprado", async () => {
    vi.mocked(db.query.accesses.findFirst).mockResolvedValueOnce({
      id: "acc-1",
      status: "ACTIVE",
    } as any);

    vi.mocked(db.query.productVideoAssignments.findMany).mockResolvedValueOnce([
      {
        position: 0,
        video: { id: "vid-1", title: "Video 1", status: "READY", active: true },
      },
      {
        position: 1,
        video: { id: "vid-2", title: "Video 2", status: "READY", active: true },
      },
    ] as any);
    vi.mocked(db.query.productVideos.findMany).mockResolvedValueOnce([]);
    vi.mocked(db.query.videoProgress.findFirst).mockResolvedValue(null as any);

    const videos = await ProductVideoService.listCustomerProductVideos("store-1", "cust-1", "prod-1");
    expect(videos).toHaveLength(2);
    expect(videos[0].id).toBe("vid-1");
    expect(videos[1].id).toBe("vid-2");
  });

  it("6. Cliente não consegue acessar vídeo não associado ao produto", async () => {
    vi.mocked(db.query.productVideos.findFirst).mockResolvedValueOnce({
      id: "vid-unassigned",
      storeId: "store-1",
      status: "READY",
      active: true,
    } as any);

    vi.mocked(db.query.productVideoAssignments.findMany).mockResolvedValueOnce([]);

    await expect(
      ProductVideoService.getProductVideoForPlayback("store-1", "cust-1", "vid-unassigned")
    ).rejects.toThrow("Vídeo sem produto vinculado.");
  });

  it("7. Cliente não consegue acessar vídeo de outro produto que não comprou", async () => {
    vi.mocked(db.query.productVideos.findFirst).mockResolvedValueOnce({
      id: "vid-other",
      storeId: "store-1",
      productId: "prod-other",
      status: "READY",
      active: true,
    } as any);

    vi.mocked(db.query.productVideoAssignments.findMany).mockResolvedValueOnce([
      { productId: "prod-other", videoId: "vid-other" },
    ] as any);

    await expect(
      ProductVideoService.getProductVideoForPlayback("store-1", "cust-1", "vid-other", "prod-bought")
    ).rejects.toThrow("Vídeo não está associado ao produto especificado.");
  });

  it("8. Cliente não consegue acessar vídeo de outra store", async () => {
    vi.mocked(db.query.productVideos.findFirst).mockResolvedValueOnce(null as any);

    await expect(
      ProductVideoService.getProductVideoForPlayback("store-A", "cust-A", "vid-store-B")
    ).rejects.toThrow("Vídeo de produto não encontrado ou inativo.");
  });

  it("9. Vídeo PROCESSING não pode ser reproduzido", async () => {
    vi.mocked(db.query.productVideos.findFirst).mockResolvedValueOnce({
      id: "vid-proc",
      storeId: "store-1",
      status: "PROCESSING",
      active: true,
    } as any);

    await expect(
      ProductVideoService.getProductVideoForPlayback("store-1", "cust-1", "vid-proc")
    ).rejects.toThrow("Este vídeo ainda está em processamento e não pode ser reproduzido.");
  });

  it("10. Vídeo FAILED não pode ser reproduzido", async () => {
    vi.mocked(db.query.productVideos.findFirst).mockResolvedValueOnce({
      id: "vid-fail",
      storeId: "store-1",
      status: "FAILED",
      active: true,
    } as any);

    await expect(
      ProductVideoService.getProductVideoForPlayback("store-1", "cust-1", "vid-fail")
    ).rejects.toThrow("Falha no processamento do vídeo.");
  });

  it("11. Vídeo inactive não pode ser reproduzido", async () => {
    vi.mocked(db.query.productVideos.findFirst).mockResolvedValueOnce(null as any);

    await expect(
      ProductVideoService.getProductVideoForPlayback("store-1", "cust-1", "vid-inactive")
    ).rejects.toThrow("Vídeo de produto não encontrado ou inativo.");
  });

  it("12. Produto com múltiplos vídeos respeita position", async () => {
    vi.mocked(db.query.accesses.findFirst).mockResolvedValueOnce({
      id: "acc-1",
      status: "ACTIVE",
      expiresAt: null,
    } as any);

    vi.mocked(db.query.productVideoAssignments.findMany).mockResolvedValueOnce([
      { position: 2, video: { id: "vid-b", title: "Aula 2", status: "READY", active: true } },
      { position: 1, video: { id: "vid-a", title: "Aula 1", status: "READY", active: true } },
    ] as any);
    vi.mocked(db.query.productVideos.findMany).mockResolvedValueOnce([]);
    vi.mocked(db.query.videoProgress.findFirst).mockResolvedValue(null as any);

    const videos = await ProductVideoService.listCustomerProductVideos("store-1", "cust-1", "prod-1");
    expect(videos[0].id).toBe("vid-a");
    expect(videos[1].id).toBe("vid-b");
  });

  it("13. Progresso existente é recuperado corretamente", async () => {
    vi.mocked(db.query.productVideos.findFirst).mockResolvedValueOnce({
      id: "vid-1",
      storeId: "store-1",
      productId: "prod-1",
      bunnyVideoId: "bunny-1",
      status: "READY",
      active: true,
    } as any);

    vi.mocked(db.query.productVideoAssignments.findMany).mockResolvedValueOnce([
      { productId: "prod-1", videoId: "vid-1" },
    ] as any);

    vi.mocked(db.query.accesses.findFirst).mockResolvedValueOnce({
      id: "acc-1",
      status: "ACTIVE",
    } as any);

    vi.mocked(db.query.videoProgress.findFirst).mockResolvedValueOnce({
      positionSeconds: 120,
      durationSeconds: 300,
      progressPercent: "40.00",
      completed: false,
      lastWatchedAt: new Date(),
    } as any);

    const res = await ProductVideoService.getProductVideoForPlayback("store-1", "cust-1", "vid-1");
    expect(res.progress).toEqual({
      positionSeconds: 120,
      durationSeconds: 300,
      progressPercent: 40,
      completed: false,
      lastWatchedAt: expect.any(Date),
    });
  });

  it("14. Playback continua usando token temporário Bunny", async () => {
    vi.mocked(db.query.productVideos.findFirst).mockResolvedValueOnce({
      id: "vid-1",
      storeId: "store-1",
      productId: "prod-1",
      bunnyVideoId: "bunny-1",
      status: "READY",
      active: true,
    } as any);

    vi.mocked(db.query.productVideoAssignments.findMany).mockResolvedValueOnce([
      { productId: "prod-1", videoId: "vid-1" },
    ] as any);

    vi.mocked(db.query.accesses.findFirst).mockResolvedValueOnce({
      id: "acc-1",
      status: "ACTIVE",
    } as any);

    vi.mocked(db.query.videoProgress.findFirst).mockResolvedValueOnce(null as any);

    const res = await ProductVideoService.getProductVideoForPlayback("store-1", "cust-1", "vid-1");
    expect(res.playback.playbackUrl).toContain("token=");
    expect(res.playback.playbackUrl).toContain(".m3u8");
  });
});

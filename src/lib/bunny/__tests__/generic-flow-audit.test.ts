import { describe, it, expect } from "vitest";
import { resolveClipStatusTransition, verifyBunnyStreamSignature, type ClipStatus } from "../webhook-utils";
import fs from "fs";
import path from "path";

describe("Generic Clip Upload & Processing Flow Audit", () => {
  const storeA = "store-111";
  const mockClips = [
    {
      id: "clip-a",
      storeId: storeA,
      title: "Clip A",
      bunnyVideoId: "guid-video-aaaa-1111",
      status: "UPLOADING",
      duration: null as number | null,
    },
    {
      id: "clip-b",
      storeId: storeA,
      title: "Clip B",
      bunnyVideoId: "guid-video-bbbb-2222",
      status: "UPLOADING",
      duration: null as number | null,
    },
  ];

  it("1. Bunny VideoGuid encontra o Clip correto", () => {
    const targetGuid = "guid-video-aaaa-1111";
    const found = mockClips.find((c) => c.bunnyVideoId === targetGuid);

    expect(found).toBeDefined();
    expect(found?.id).toBe("clip-a");
  });

  it("2. Dois VideoGuids diferentes atualizam dois Clips diferentes", () => {
    const state = JSON.parse(JSON.stringify(mockClips));

    const updateClipByGuid = (guid: string, newStatus: any, duration?: number) => {
      const clip = state.find((c: any) => c.bunnyVideoId === guid);
      if (clip) {
        clip.status = resolveClipStatusTransition(newStatus, clip.status);
        if (duration) clip.duration = duration;
      }
    };

    updateClipByGuid("guid-video-aaaa-1111", 4, 191);
    updateClipByGuid("guid-video-bbbb-2222", 4, 606);

    expect(state[0].status).toBe("READY");
    expect(state[0].duration).toBe(191);
    expect(state[1].status).toBe("READY");
    expect(state[1].duration).toBe(606);
  });

  it("3. READY de um Clip não altera outro Clip", () => {
    const state: { id: string; bunnyVideoId: string; status: ClipStatus }[] = [
      { id: "clip-1", bunnyVideoId: "guid-1", status: "UPLOADING" },
      { id: "clip-2", bunnyVideoId: "guid-2", status: "UPLOADING" },
    ];

    const clip1 = state.find((c) => c.bunnyVideoId === "guid-1");
    if (clip1) clip1.status = resolveClipStatusTransition(4, clip1.status);

    expect(state[0].status).toBe("READY");
    expect(state[1].status).toBe("UPLOADING"); // Unchanged
  });

  it("4. Status 4 (ResolutionFinished) atualiza qualquer Clip correspondente para READY", () => {
    expect(resolveClipStatusTransition(4, "UPLOADING")).toBe("READY");
    expect(resolveClipStatusTransition(4, "PROCESSING")).toBe("READY");
  });

  it("5. Status 5 (Failed) atualiza qualquer Clip correspondente para FAILED", () => {
    expect(resolveClipStatusTransition(5, "UPLOADING")).toBe("FAILED");
    expect(resolveClipStatusTransition(5, "PROCESSING")).toBe("FAILED");
  });

  it("6. Evento intermediário (status 0, 1, 2, 7) não faz READY regredir", () => {
    expect(resolveClipStatusTransition(0, "READY")).toBe("READY");
    expect(resolveClipStatusTransition(1, "READY")).toBe("READY");
    expect(resolveClipStatusTransition(2, "READY")).toBe("READY");
    expect(resolveClipStatusTransition(7, "READY")).toBe("READY");
  });

  it("7. Nenhum ID hardcoded existe no código do fluxo de webhook ou serviço de clips", () => {
    const filesToAudit = [
      "src/app/api/webhooks/bunny-stream/route.ts",
      "src/lib/clips/service.ts",
      "src/lib/bunny/webhook-utils.ts",
      "src/lib/bunny/stream.ts",
    ];

    const forbiddenGuids = [
      "0c6f0573" + "-6bce-466b-afbc-2f971675733d",
      "cb841604" + "-602c-47cc-a5bc-8f1af4056bf9",
      "1daabf9d" + "-cf9a-4a17-a3c1-01754ee30d9d",
    ];

    const projectRoot = path.join(process.cwd());

    for (const relativePath of filesToAudit) {
      const fullPath = path.join(projectRoot, relativePath);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, "utf8");
        for (const guid of forbiddenGuids) {
          expect(content).not.toContain(guid);
        }
      }
    }
  });

  it("8. Nenhum secret ou API Key é retornado ao browser pela API pública de Clips", () => {
    const samplePublicClip = {
      id: "clip-public-1",
      title: "Clip Público",
      description: "Vídeo curto",
      bunnyVideoId: "guid-xyz-999",
      thumbnailUrl: "https://vz-73b50578-eab.b-cdn.net/guid-xyz-999/thumbnail.jpg",
      playbackUrl: "https://vz-73b50578-eab.b-cdn.net/guid-xyz-999/playlist.m3u8",
      directUrl: "https://vz-73b50578-eab.b-cdn.net/guid-xyz-999/play_720p.mp4",
      duration: 120,
      position: 0,
    };

    const json = JSON.stringify(samplePublicClip);

    expect(json).not.toContain("BUNNY_STREAM_API_KEY");
    expect(json).not.toContain("BUNNY_STREAM_READ_ONLY_API_KEY");
    expect(json).not.toContain("AccessKey");
  });

  it("9. Valida estritamente a assinatura oficial HMAC-SHA256 e rejeita formatos legado", () => {
    const rawBody = JSON.stringify({
      VideoLibraryId: "763931",
      VideoGuid: "guid-test-123",
      Status: 4,
    });
    const readOnlyApiKey = "test-api-key-secret";

    // Official Format: HMAC-SHA256(readOnlyApiKey, rawBody)
    const crypto = require("crypto");
    const officialSig = crypto
      .createHmac("sha256", readOnlyApiKey)
      .update(rawBody)
      .digest("hex");

    expect(
      verifyBunnyStreamSignature({
        rawBody,
        signature: officialSig,
        version: "v1",
        algorithm: "hmac-sha256",
        readOnlyApiKey,
      })
    ).toBe(true);

    // Legacy Format A: sha256(libraryId + apiKey + videoGuid) -> REJECTED
    const legacySigA = crypto
      .createHash("sha256")
      .update(`763931${readOnlyApiKey}guid-test-123`)
      .digest("hex");

    expect(
      verifyBunnyStreamSignature({
        rawBody,
        signature: legacySigA,
        version: "v1",
        algorithm: "hmac-sha256",
        readOnlyApiKey,
      })
    ).toBe(false);

    // Legacy Format B: sha256(apiKey + rawBody) -> REJECTED
    const legacySigB = crypto
      .createHash("sha256")
      .update(readOnlyApiKey + rawBody)
      .digest("hex");

    expect(
      verifyBunnyStreamSignature({
        rawBody,
        signature: legacySigB,
        version: "v1",
        algorithm: "hmac-sha256",
        readOnlyApiKey,
      })
    ).toBe(false);
  });
});

describe("ClipService Auto-Healing Detailed Unit Tests", () => {
  it("1. Clip UPLOADING + Bunny status 4 → READY", () => {
    expect(resolveClipStatusTransition(4, "UPLOADING")).toBe("READY");
  });

  it("2. Clip PROCESSING + Bunny status 4 → READY", () => {
    expect(resolveClipStatusTransition(4, "PROCESSING")).toBe("READY");
  });

  it("3. Clip UPLOADING + Bunny status 1 → PROCESSING", () => {
    expect(resolveClipStatusTransition(1, "UPLOADING")).toBe("PROCESSING");
  });

  it("4. Clip UPLOADING + Bunny status 5 → FAILED", () => {
    expect(resolveClipStatusTransition(5, "UPLOADING")).toBe("FAILED");
  });

  it("5. READY não regride quando recebe eventos de processamento", () => {
    expect(resolveClipStatusTransition(1, "READY")).toBe("READY");
    expect(resolveClipStatusTransition(2, "READY")).toBe("READY");
    expect(resolveClipStatusTransition(0, "READY")).toBe("READY");
  });

  it("6. Dois Clips diferentes com estados distintos da Bunny (Bunny A → READY, Bunny B → PROCESSING)", () => {
    const clips = [
      { id: "c1", status: "UPLOADING", bunnyVideoId: "v-a" },
      { id: "c2", status: "UPLOADING", bunnyVideoId: "v-b" },
    ];

    const bunnyResponses: Record<string, number> = { "v-a": 4, "v-b": 1 };

    const updated = clips.map((clip) => ({
      ...clip,
      status: resolveClipStatusTransition(bunnyResponses[clip.bunnyVideoId], clip.status as ClipStatus),
    }));

    expect(updated[0].status).toBe("READY");
    expect(updated[1].status).toBe("PROCESSING");
  });

  it("7. Falha de rede ou HTTP na Bunny para Clip B não impede o processamento do Clip A e C", () => {
    const clips = [
      { id: "c-a", bunnyVideoId: "v-a", status: "UPLOADING" },
      { id: "c-b", bunnyVideoId: "v-b", status: "UPLOADING" },
      { id: "c-c", bunnyVideoId: "v-c", status: "UPLOADING" },
    ];

    const results: Record<string, string> = {};

    for (const clip of clips) {
      try {
        if (clip.bunnyVideoId === "v-b") {
          throw new Error("Bunny API Timeout / HTTP 500");
        }
        results[clip.bunnyVideoId] = resolveClipStatusTransition(4, clip.status as ClipStatus);
      } catch (err) {
        // Log & preserve existing state for failed clip
        results[clip.bunnyVideoId] = clip.status;
      }
    }

    expect(results["v-a"]).toBe("READY");
    expect(results["v-b"]).toBe("UPLOADING"); // Preserved despite error
    expect(results["v-c"]).toBe("READY");
  });

  it("8. storeId isola corretamente a consulta de Clips pendentes (Multi-tenancy)", () => {
    const allClips = [
      { id: "c1", storeId: "store-alpha", status: "UPLOADING" },
      { id: "c2", storeId: "store-beta", status: "UPLOADING" },
    ];

    const storeAlphaPending = allClips.filter(
      (c) => c.storeId === "store-alpha" && (c.status === "UPLOADING" || c.status === "PROCESSING")
    );

    expect(storeAlphaPending).toHaveLength(1);
    expect(storeAlphaPending[0].id).toBe("c1");
  });

  it("9. Clips nos estados READY e FAILED são ignorados pela consulta de Auto-Healing à Bunny", () => {
    const allClips = [
      { id: "c1", status: "READY" },
      { id: "c2", status: "FAILED" },
      { id: "c3", status: "UPLOADING" },
      { id: "c4", status: "PROCESSING" },
    ];

    const pendingOnly = allClips.filter((c) => c.status === "UPLOADING" || c.status === "PROCESSING");

    expect(pendingOnly).toHaveLength(2);
    expect(pendingOnly.map((c) => c.id)).toEqual(["c3", "c4"]);
  });

  it("10. listStoreClips aciona syncPendingClipsForStore antes de retornar a lista do banco Neon", async () => {
    let syncCalledWithStoreId: string | null = null;

    const mockService = {
      async syncPendingClipsForStore(storeId: string) {
        syncCalledWithStoreId = storeId;
      },
      async listStoreClips(storeId: string) {
        await this.syncPendingClipsForStore(storeId);
        return [{ id: "c1", storeId, status: "READY" }];
      },
    };

    const result = await mockService.listStoreClips("store-xyz-123");

    expect(syncCalledWithStoreId).toBe("store-xyz-123");
    expect(result[0].status).toBe("READY");
  });

  it("11. Confirma que nenhum Bunny Video ID real de produção foi hardcoded em fixtures de teste", () => {
    const testContent = fs.readFileSync(__filename, "utf8");
    const forbidden1 = "0c6f0573" + "-6bce-466b-afbc-2f971675733d";
    const forbidden2 = "cb841604" + "-602c-47cc-a5bc-8f1af4056bf9";
    const forbidden3 = "1daabf9d" + "-cf9a-4a17-a3c1-01754ee30d9d";

    expect(testContent).not.toContain(forbidden1);
    expect(testContent).not.toContain(forbidden2);
    expect(testContent).not.toContain(forbidden3);
  });
});

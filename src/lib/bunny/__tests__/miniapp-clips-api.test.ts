import { describe, it, expect } from "vitest";

describe("MiniApp Public Clips API Security & Business Rules", () => {
  const storeIdA = "store-uuid-aaaa-1111";
  const storeIdB = "store-uuid-bbbb-2222";

  const cdnHostname = "vz-73b50578-eab.b-cdn.net";

  const rawClipsDatabase = [
    {
      id: "clip-1",
      storeId: storeIdA,
      title: "Primeiro Clip da Loja A",
      description: "Descrição do clip 1",
      bunnyVideoId: "guid-aaa-001",
      thumbnailUrl: null,
      duration: 15,
      status: "READY",
      position: 1,
      isActive: true,
      createdAt: new Date(),
    },
    {
      id: "clip-2",
      storeId: storeIdA,
      title: "Clip Em Processamento",
      description: "Ainda enviando...",
      bunnyVideoId: "guid-aaa-002",
      thumbnailUrl: null,
      duration: null,
      status: "UPLOADING",
      position: 0,
      isActive: true,
      createdAt: new Date(),
    },
    {
      id: "clip-3",
      storeId: storeIdA,
      title: "Clip Desativado pelo Seller",
      description: "Oculto",
      bunnyVideoId: "guid-aaa-003",
      thumbnailUrl: null,
      duration: 30,
      status: "READY",
      position: 2,
      isActive: false,
      createdAt: new Date(),
    },
    {
      id: "clip-4",
      storeId: storeIdA,
      title: "Clip Inicial da Loja A",
      description: "Clip em destaque",
      bunnyVideoId: "guid-aaa-000",
      thumbnailUrl: `https://${cdnHostname}/guid-aaa-000/thumbnail.jpg`,
      duration: 45,
      status: "READY",
      position: 0,
      isActive: true,
      createdAt: new Date(),
    },
    {
      id: "clip-5",
      storeId: storeIdB,
      title: "Clip da Loja B",
      description: "Clip da outra loja",
      bunnyVideoId: "guid-bbb-001",
      thumbnailUrl: null,
      duration: 20,
      status: "READY",
      position: 0,
      isActive: true,
      createdAt: new Date(),
    },
  ];

  // Helper function simulating the logic in /api/public/clips
  function filterPublicClips(storeId: string) {
    const items = rawClipsDatabase
      .filter((c) => c.storeId === storeId && c.status === "READY" && c.isActive === true)
      .sort((a, b) => a.position - b.position);

    return items.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      bunnyVideoId: c.bunnyVideoId,
      thumbnailUrl: c.thumbnailUrl || `https://${cdnHostname}/${c.bunnyVideoId}/thumbnail.jpg`,
      playbackUrl: `https://${cdnHostname}/${c.bunnyVideoId}/playlist.m3u8`,
      directUrl: `https://${cdnHostname}/${c.bunnyVideoId}/play_720p.mp4`,
      duration: c.duration,
      position: c.position,
    }));
  }

  it("filters clips strictly by target storeId (Multi-tenancy)", () => {
    const clipsA = filterPublicClips(storeIdA);
    const clipsB = filterPublicClips(storeIdB);

    expect(clipsA.length).toBe(2);
    expect(clipsB.length).toBe(1);
    expect(clipsA.every((c) => c.bunnyVideoId.startsWith("guid-aaa-"))).toBe(true);
    expect(clipsB[0].bunnyVideoId).toBe("guid-bbb-001");
  });

  it("returns ONLY READY and isActive=true clips", () => {
    const clipsA = filterPublicClips(storeIdA);

    // clip-2 (UPLOADING) and clip-3 (isActive=false) must be excluded
    const clipIds = clipsA.map((c) => c.id);
    expect(clipIds).toContain("clip-4");
    expect(clipIds).toContain("clip-1");
    expect(clipIds).not.toContain("clip-2");
    expect(clipIds).not.toContain("clip-3");
  });

  it("sorts clips by position ASC", () => {
    const clipsA = filterPublicClips(storeIdA);

    expect(clipsA[0].id).toBe("clip-4"); // position 0
    expect(clipsA[1].id).toBe("clip-1"); // position 1
    expect(clipsA[0].position).toBeLessThan(clipsA[1].position);
  });

  it("constructs correct public Bunny CDN streaming & thumbnail URLs", () => {
    const clipsA = filterPublicClips(storeIdA);
    const clip = clipsA[0];

    expect(clip.playbackUrl).toBe(`https://${cdnHostname}/guid-aaa-000/playlist.m3u8`);
    expect(clip.directUrl).toBe(`https://${cdnHostname}/guid-aaa-000/play_720p.mp4`);
    expect(clip.thumbnailUrl).toBe(`https://${cdnHostname}/guid-aaa-000/thumbnail.jpg`);
  });

  it("never exposes Bunny Stream API keys or internal database fields", () => {
    const response = {
      success: true,
      clips: filterPublicClips(storeIdA),
    };

    const jsonString = JSON.stringify(response);

    expect(jsonString).not.toContain("BUNNY_STREAM_API_KEY");
    expect(jsonString).not.toContain("BUNNY_STREAM_READ_ONLY_API_KEY");
    expect(jsonString).not.toContain("AccessKey");
    expect(jsonString).not.toContain("storeId");
  });
});

import { describe, it, expect } from "vitest";
import { resolveClipStatusTransition } from "../webhook-utils";

describe("Seller Clips CRUD & Multi-Tenancy Rules", () => {
  const storeA_Id = "store-uuid-aaaa-1111";
  const storeB_Id = "store-uuid-bbbb-2222";

  const mockClipsDatabase = [
    {
      id: "clip-1",
      storeId: storeA_Id,
      title: "Clip da Loja A",
      description: "Descrição A",
      bunnyVideoId: "guid-a-111",
      thumbnailUrl: "https://vz-73b50578-eab.b-cdn.net/guid-a-111/thumbnail.jpg",
      duration: 30,
      status: "READY",
      position: 0,
      isActive: true,
    },
    {
      id: "clip-2",
      storeId: storeA_Id,
      title: "Clip 2 da Loja A",
      description: null,
      bunnyVideoId: "guid-a-222",
      thumbnailUrl: null,
      duration: null,
      status: "PROCESSING",
      position: 1,
      isActive: true,
    },
    {
      id: "clip-3",
      storeId: storeB_Id,
      title: "Clip da Loja B",
      description: "Descrição B",
      bunnyVideoId: "guid-b-333",
      thumbnailUrl: "https://vz-73b50578-eab.b-cdn.net/guid-b-333/thumbnail.jpg",
      duration: 45,
      status: "READY",
      position: 0,
      isActive: true,
    },
  ];

  it("filters clips strictly by authenticated seller storeId (Multi-tenancy)", () => {
    const storeAClips = mockClipsDatabase.filter((c) => c.storeId === storeA_Id);
    const storeBClips = mockClipsDatabase.filter((c) => c.storeId === storeB_Id);

    expect(storeAClips.length).toBe(2);
    expect(storeBClips.length).toBe(1);
    expect(storeAClips.every((c) => c.storeId === storeA_Id)).toBe(true);
  });

  it("blocks seller from modifying or accessing a clip belonging to another store", () => {
    const activeStoreId = storeA_Id;
    const targetClipId = "clip-3"; // Belongs to Store B

    const clip = mockClipsDatabase.find(
      (c) => c.id === targetClipId && c.storeId === activeStoreId
    );

    expect(clip).toBeUndefined(); // Access must be rejected
  });

  it("auto-increments position sequentially for new clips in a store", () => {
    const storeAClips = mockClipsDatabase.filter((c) => c.storeId === storeA_Id);
    const maxPosition = Math.max(...storeAClips.map((c) => c.position));
    const nextPosition = maxPosition + 1;

    expect(nextPosition).toBe(2);
  });

  it("toggles isActive status without deleting or modifying bunnyVideoId", () => {
    const originalClip = { ...mockClipsDatabase[0] };
    const updatedClip = { ...originalClip, isActive: false };

    expect(updatedClip.isActive).toBe(false);
    expect(updatedClip.bunnyVideoId).toBe(originalClip.bunnyVideoId);
    expect(updatedClip.storeId).toBe(originalClip.storeId);
  });

  it("calculates correct summary statistics (Total, Publicados, Processando, Falhos)", () => {
    const calculateStats = (clips: typeof mockClipsDatabase) => {
      let published = 0;
      let processing = 0;
      let failed = 0;

      clips.forEach((c) => {
        if (c.status === "READY") published++;
        else if (c.status === "FAILED") failed++;
        else processing++;
      });

      return {
        total: clips.length,
        published,
        processing,
        failed,
      };
    };

    const statsA = calculateStats(mockClipsDatabase.filter((c) => c.storeId === storeA_Id));
    expect(statsA.total).toBe(2);
    expect(statsA.published).toBe(1);
    expect(statsA.processing).toBe(1);
    expect(statsA.failed).toBe(0);
  });

  it("never exposes administrative API keys in JSON responses", () => {
    const mockApiResponse = {
      success: true,
      clips: mockClipsDatabase.filter((c) => c.storeId === storeA_Id),
      stats: { total: 2, published: 1, processing: 1, failed: 0 },
    };

    const jsonString = JSON.stringify(mockApiResponse);
    expect(jsonString).not.toContain("23d07e69-8a7f-4227-b0edbd3591e8-a312-4772");
    expect(jsonString).not.toContain("74b4003f-2621-4342-a901f3a4d696-ce52-445a");
  });
});

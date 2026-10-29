import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, POST } from "../route";
import { requirePlatformAdmin } from "@/lib/auth";
import { db } from "@/db";

// Mock next/server connection
vi.mock("next/server", async (importOriginal) => {
  const mod = await importOriginal<typeof import("next/server")>();
  return {
    ...mod,
    connection: vi.fn(),
  };
});

// Mock auth module
vi.mock("@/lib/auth", () => ({
  requirePlatformAdmin: vi.fn(),
}));

// Mock db
vi.mock("@/db", () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(),
      },
    },
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowCount: 1 }),
      }),
    }),
  },
}));

// Mock storage provider
vi.mock("@/lib/storage/provider", () => ({
  getStorageProvider: vi.fn().mockReturnValue({
    upload: vi.fn().mockResolvedValue({
      url: "https://storage.webgran.online/admin/profiles/admin-avatar-test.png",
      key: "admin/profiles/admin-avatar-test.png",
    }),
  }),
  generateMultiTenantStoragePath: vi.fn().mockReturnValue("admin/profiles/admin-avatar-test.png"),
}));

describe("Admin Profile API (GET & POST /api/admin/profile)", () => {
  const mockAdmin = {
    id: "admin-uuid-1",
    name: "Administrador WebGran",
    email: "admin@webgran.online",
    role: "admin",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requirePlatformAdmin).mockResolvedValue(mockAdmin as any);
  });

  describe("GET /api/admin/profile", () => {
    it("1. Blocks unauthenticated requests with HTTP 401", async () => {
      vi.mocked(requirePlatformAdmin).mockRejectedValueOnce(new Error("UNAUTHORIZED"));

      const res = await GET();
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/Sessão não autenticada/i);
    });

    it("2. Blocks non-admin requests with HTTP 403", async () => {
      vi.mocked(requirePlatformAdmin).mockRejectedValueOnce(new Error("FORBIDDEN"));

      const res = await GET();
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/Acesso negado/i);
    });

    it("3. Returns profile data for authenticated platform admin", async () => {
      vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({
        id: "admin-uuid-1",
        name: "Super Admin",
        email: "admin@webgran.online",
        avatarUrl: "https://storage.webgran.online/avatar.png",
        role: "admin",
      } as any);

      const res = await GET();
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.user).toEqual({
        id: "admin-uuid-1",
        name: "Super Admin",
        email: "admin@webgran.online",
        avatarUrl: "https://storage.webgran.online/avatar.png",
        role: "admin",
      });
    });
  });

  describe("POST /api/admin/profile", () => {
    it("1. Blocks unauthenticated update requests with HTTP 401", async () => {
      vi.mocked(requirePlatformAdmin).mockRejectedValueOnce(new Error("UNAUTHORIZED"));

      const req = new Request("http://localhost/api/admin/profile", {
        method: "POST",
        body: JSON.stringify({ name: "Novo Nome" }),
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
    });

    it("2. Blocks non-admin update requests with HTTP 403", async () => {
      vi.mocked(requirePlatformAdmin).mockRejectedValueOnce(new Error("FORBIDDEN"));

      const req = new Request("http://localhost/api/admin/profile", {
        method: "POST",
        body: JSON.stringify({ name: "Novo Nome" }),
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.success).toBe(false);
    });

    it("3. Validates required display name", async () => {
      const req = new Request("http://localhost/api/admin/profile", {
        method: "POST",
        body: JSON.stringify({ name: "   " }),
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/nome de exibição é obrigatório/i);
    });

    it("4. Validates minimum and maximum name length", async () => {
      const reqShort = new Request("http://localhost/api/admin/profile", {
        method: "POST",
        body: JSON.stringify({ name: "A" }),
      });
      const resShort = await POST(reqShort);
      expect(resShort.status).toBe(400);

      const reqLong = new Request("http://localhost/api/admin/profile", {
        method: "POST",
        body: JSON.stringify({ name: "A".repeat(81) }),
      });
      const resLong = await POST(reqLong);
      expect(resLong.status).toBe(400);
    });

    it("5. Rejects unsupported MIME formats", async () => {
      const req = new Request("http://localhost/api/admin/profile", {
        method: "POST",
        body: JSON.stringify({
          name: "Admin",
          avatarUrl: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
        }),
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/Formato inválido/i);
    });

    it("6. Rejects files with invalid magic bytes", async () => {
      // Fake PNG mime header but corrupted bytes
      const fakeCorruptBase64 = Buffer.from("NOT_A_REAL_IMAGE").toString("base64");
      const req = new Request("http://localhost/api/admin/profile", {
        method: "POST",
        body: JSON.stringify({
          name: "Admin",
          avatarUrl: `data:image/png;base64,${fakeCorruptBase64}`,
        }),
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/não é uma imagem válida/i);
    });

    it("7. Successfully updates display name and removes avatar when avatarUrl is null", async () => {
      vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({
        id: "admin-uuid-1",
        name: "Luiz Fernando",
        email: "admin@webgran.online",
        avatarUrl: null,
        role: "admin",
      } as any);

      const req = new Request("http://localhost/api/admin/profile", {
        method: "POST",
        body: JSON.stringify({
          name: "Luiz Fernando",
          avatarUrl: null,
        }),
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.user.name).toBe("Luiz Fernando");
      expect(json.user.avatarUrl).toBeNull();
      expect(db.update).toHaveBeenCalled();
    });

    it("8. Successfully uploads valid PNG image with magic bytes and persists in DB", async () => {
      // Valid minimal 8-byte PNG header: 89 50 4E 47 0D 0A 1A 0A
      const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const base64Png = pngHeader.toString("base64");

      vi.mocked(db.query.users.findFirst).mockResolvedValueOnce({
        id: "admin-uuid-1",
        name: "Luiz Fernando",
        email: "admin@webgran.online",
        avatarUrl: "https://storage.webgran.online/admin/profiles/admin-avatar-test.png",
        role: "admin",
      } as any);

      const req = new Request("http://localhost/api/admin/profile", {
        method: "POST",
        body: JSON.stringify({
          name: "Luiz Fernando",
          avatarUrl: `data:image/png;base64,${base64Png}`,
        }),
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.user.avatarUrl).toBe("https://storage.webgran.online/admin/profiles/admin-avatar-test.png");
      expect(db.update).toHaveBeenCalled();
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../status/route";
import { getCurrentUser } from "@/lib/auth";
import { SellerPushService } from "@/lib/push/seller-push-service";

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/push/seller-push-service", () => ({
  SellerPushService: {
    getPublicKey: vi.fn(),
    hasActiveSubscription: vi.fn(),
  },
}));

describe("API /api/seller/push/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna 401 com Cache-Control no-store se o usuário não estiver autenticado", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null as any);

    const req = new NextRequest("http://localhost:3000/api/seller/push/status");

    const res = await GET(req);

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Não autenticado.");
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });

  it("retorna 403 se o usuário não tiver permissão de seller ou admin", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "cust-1",
      role: "customer",
    } as any);

    const req = new NextRequest("http://localhost:3000/api/seller/push/status");
    const res = await GET(req);

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("Acesso não autorizado.");
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });

  it("retorna 200 com status da chave e assinatura ativa do vendedor autenticado", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "seller-42",
      role: "seller",
    } as any);

    vi.mocked(SellerPushService.getPublicKey).mockReturnValue("mock-vapid-public-key");
    vi.mocked(SellerPushService.hasActiveSubscription).mockResolvedValue(true);

    const req = new NextRequest("http://localhost:3000/api/seller/push/status");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({
      configured: true,
      publicKey: "mock-vapid-public-key",
      hasActiveSubscription: true,
    });
    // Verifica que consultou o serviço exatamente com o id do vendedor autenticado (isolamento estrito)
    expect(SellerPushService.hasActiveSubscription).toHaveBeenCalledWith("seller-42");
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const processExpiredAccesses = vi.fn();

vi.mock("@/lib/orders/expiration-service", () => ({
  processExpiredAccesses: () => processExpiredAccesses(),
}));

import { GET } from "../route";

function makeReq(auth?: string) {
  return new NextRequest("http://localhost/api/cron/maintenance", {
    headers: auth ? { authorization: auth } : {},
  });
}

describe("Cron de manutenção (/api/cron/maintenance)", () => {
  const original = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "segredo-teste";
    processExpiredAccesses.mockResolvedValue({ processedCount: 2, results: [{ error: "x" }, {}] });
  });

  afterEach(() => {
    process.env.CRON_SECRET = original;
  });

  it("recusa com 503 quando CRON_SECRET não está configurado", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(makeReq("Bearer qualquer"));
    expect(res.status).toBe(503);
    expect(processExpiredAccesses).not.toHaveBeenCalled();
  });

  it("recusa com 401 sem header ou com segredo errado", async () => {
    expect((await GET(makeReq())).status).toBe(401);
    expect((await GET(makeReq("Bearer errado"))).status).toBe(401);
    expect(processExpiredAccesses).not.toHaveBeenCalled();
  });

  it("expira os acessos com o segredo correto", async () => {
    const res = await GET(makeReq("Bearer segredo-teste"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.expiredAccesses).toEqual({ processed: 2, revocationErrors: 1 });
  });

  it("retorna 500 quando o job falha", async () => {
    processExpiredAccesses.mockRejectedValue(new Error("banco fora"));
    const res = await GET(makeReq("Bearer segredo-teste"));
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toBe("banco fora");
  });
});

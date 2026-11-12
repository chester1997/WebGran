import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/db", () => ({
  db: {
    execute: vi.fn(),
  },
}));

import {
  checkTelegramAuthRateLimit,
  inMemoryFallback,
  RATE_LIMIT_CONFIG,
} from "../rate-limiter";

describe("Rate Limiter da Autenticação Telegram e Validação de Contingência", () => {
  const clientIp = "192.168.1.100";
  const storeSlug = "doramas-vip";

  beforeEach(() => {
    vi.clearAllMocks();
    inMemoryFallback.clear();
  });

  it("1. Operação normal no Neon: permite requisições até o limite de 60 e bloqueia a 61ª com source 'neon_postgres'", async () => {
    let mockCount = 0;
    const mockDb = {
      execute: vi.fn().mockImplementation((query: any) => {
        const qStr = JSON.stringify(query);
        if (qStr.includes("DELETE")) return Promise.resolve([]);
        mockCount++;
        return Promise.resolve([
          { count: mockCount, reset_at: new Date(Date.now() + 60000) },
        ]);
      }),
    };

    // 60 requisições permitidas
    for (let i = 1; i <= RATE_LIMIT_CONFIG.NORMAL_LIMIT; i++) {
      const res = await checkTelegramAuthRateLimit(clientIp, storeSlug, mockDb);
      expect(res.allowed).toBe(true);
      expect(res.fallback).toBe(false);
      expect(res.source).toBe("neon_postgres");
    }

    // 61ª requisição deve ser bloqueada
    const blockedRes = await checkTelegramAuthRateLimit(clientIp, storeSlug, mockDb);
    expect(blockedRes.allowed).toBe(false);
    expect(blockedRes.retryAfter).toBeGreaterThan(0);
    expect(blockedRes.fallback).toBe(false);
    expect(blockedRes.source).toBe("neon_postgres");
  });

  it("2. Isolamento contextual: tentativas na Loja A não interferem no acesso à Loja B para o mesmo IP", async () => {
    const storeACounts = new Map<string, number>();
    const mockDb = {
      execute: vi.fn().mockImplementation((query: any) => {
        const queryStr = JSON.stringify(query);
        const store = queryStr.includes("loja-b") ? "loja-b" : "loja-a";
        const current = (storeACounts.get(store) || 0) + 1;
        storeACounts.set(store, current);
        return Promise.resolve([
          { count: current, reset_at: new Date(Date.now() + 60000) },
        ]);
      }),
    };

    // Esgota a Loja A
    for (let i = 1; i <= 65; i++) {
      await checkTelegramAuthRateLimit(clientIp, "loja-a", mockDb);
    }

    const resLojaA = await checkTelegramAuthRateLimit(clientIp, "loja-a", mockDb);
    expect(resLojaA.allowed).toBe(false);

    // Loja B deve continuar permitida normalmente
    const resLojaB = await checkTelegramAuthRateLimit(clientIp, "loja-b", mockDb);
    expect(resLojaB.allowed).toBe(true);
    expect(resLojaB.source).toBe("neon_postgres");
  });

  it("3. Contingência: indisponibilidade do Neon ativa fallback em memória com limite conservador de 15/min", async () => {
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const brokenDb = {
      execute: vi.fn().mockRejectedValue(new Error("Neon connection timeout")),
    };

    // 15 requisições permitidas durante contingência
    for (let i = 1; i <= RATE_LIMIT_CONFIG.FALLBACK_LIMIT; i++) {
      const res = await checkTelegramAuthRateLimit(clientIp, storeSlug, brokenDb);
      expect(res.allowed).toBe(true);
      expect(res.fallback).toBe(true);
      expect(res.source).toBe("memory_contingency");
    }

    // 16ª requisição deve ser bloqueada pelo limite conservador
    const blockedRes = await checkTelegramAuthRateLimit(clientIp, storeSlug, brokenDb);
    expect(blockedRes.allowed).toBe(false);
    expect(blockedRes.fallback).toBe(true);
    expect(blockedRes.source).toBe("memory_contingency");
    expect(blockedRes.retryAfter).toBeGreaterThan(0);

    // Confirma que o log de advertência registrou a contingência sem expor dados sensíveis ou IPs
    expect(consoleWarnSpy).toHaveBeenCalled();
    const logCall = consoleWarnSpy.mock.calls[0][0];
    expect(logCall).toContain("[TelegramAuthRateLimiter:CONTINGENCY]");
    expect(logCall).toContain(storeSlug);
    expect(logCall).not.toContain(clientIp); // IP real NÃO pode ser vazado no log
  });

  it("4. Concorrência no fallback: múltiplas requisições simultâneas não ultrapassam o limite de 15", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const brokenDb = {
      execute: vi.fn().mockRejectedValue(new Error("Neon connection timeout")),
    };

    // Dispara 30 requisições simultâneas via Promise.all
    const promises = Array.from({ length: 30 }, () =>
      checkTelegramAuthRateLimit("203.0.113.1", "loja-concorrente", brokenDb)
    );
    const results = await Promise.all(promises);

    const allowed = results.filter((r) => r.allowed);
    const blocked = results.filter((r) => !r.allowed);

    // Exatamente 15 devem ser permitidas e 15 bloqueadas
    expect(allowed).toHaveLength(15);
    expect(blocked).toHaveLength(15);
  });

  it("5. Auto-recuperação: o sistema retorna imediatamente ao controle persistente quando o Neon volta", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});

    // Estado 1: Banco fora do ar -> contingência ativada
    const brokenDb = {
      execute: vi.fn().mockRejectedValue(new Error("Neon network partition")),
    };
    const resWhileDown = await checkTelegramAuthRateLimit(clientIp, storeSlug, brokenDb);
    expect(resWhileDown.fallback).toBe(true);
    expect(resWhileDown.source).toBe("memory_contingency");

    // Estado 2: Banco restabelecido -> próxima requisição volta automaticamente para o Neon
    const recoveredDb = {
      execute: vi.fn().mockResolvedValue([
        { count: 1, reset_at: new Date(Date.now() + 60000) },
      ]),
    };
    const resAfterRecovery = await checkTelegramAuthRateLimit(clientIp, storeSlug, recoveredDb);
    expect(resAfterRecovery.allowed).toBe(true);
    expect(resAfterRecovery.fallback).toBe(false);
    expect(resAfterRecovery.source).toBe("neon_postgres");
  });
});

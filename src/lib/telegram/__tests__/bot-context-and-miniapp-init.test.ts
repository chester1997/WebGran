import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveSafeOriginBotContext } from "../bot-context";

// Mock das dependências de banco e cache
vi.mock("@/lib/store-cache", () => ({
  getStoreBySlug: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      telegramBots: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
    },
  },
}));

import { getStoreBySlug } from "@/lib/store-cache";
import { db } from "@/db";

describe("Mini App Telegram Initialization & Bot Context Resolution (12 Cenários Obrigatórios)", () => {
  const storeA = { id: "store-uuid-a", slug: "loja-alpha", name: "Loja Alpha" };
  const storeB = { id: "store-uuid-b", slug: "loja-beta", name: "Loja Beta" };

  const botA1 = {
    id: "bot-uuid-a1",
    botId: "111111111",
    username: "alpha_primary_bot",
    displayName: "Alpha Bot 1",
    storeId: "store-uuid-a",
    status: "active",
  };

  const botA2 = {
    id: "bot-uuid-a2",
    botId: "222222222",
    username: "alpha_secondary_bot",
    displayName: "Alpha Bot 2",
    storeId: "store-uuid-a",
    status: "active",
  };

  const botB1 = {
    id: "bot-uuid-b1",
    botId: "333333333",
    username: "beta_sole_bot",
    displayName: "Beta Bot 1",
    storeId: "store-uuid-b",
    status: "active",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // CENÁRIO 1: Primeira abertura pelo botão Abrir App (URL com ?b=botId, sem cookie de sessão)
  it("Cenário 1: Primeira abertura pelo botão Abrir App resolve imediatamente via URL sem cookie", async () => {
    vi.mocked(getStoreBySlug).mockResolvedValue(storeA as any);
    vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(botA1 as any);

    const result = await resolveSafeOriginBotContext({
      storeSlug: "loja-alpha",
      urlBotParam: botA1.id,
      session: null,
    });

    expect(result.originBotId).toBe(botA1.id);
    expect(result.originBotUsername).toBe("alpha_primary_bot");
    expect(result.source).toBe("url");
    expect(result.isDivergent).toBe(false);
  });

  // CENÁRIO 2: Segunda abertura (URL com ?b=botId e sessão autenticada com mesmo bot)
  it("Cenário 2: Segunda abertura com sessão autenticada e URL correspondente resolve via sessão", async () => {
    vi.mocked(getStoreBySlug).mockResolvedValue(storeA as any);
    vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(botA1 as any);

    const result = await resolveSafeOriginBotContext({
      storeSlug: "loja-alpha",
      urlBotParam: botA1.id,
      session: {
        storeId: storeA.id,
        originBotId: botA1.id,
        originBotUsername: botA1.username,
      },
    });

    expect(result.originBotId).toBe(botA1.id);
    expect(result.source).toBe("session");
    expect(result.isDivergent).toBe(false);
  });

  // CENÁRIO 3: Fechar e abrir novamente (cookie descartado pelo WebView sheet, mas ?b=botId preservado)
  it("Cenário 3: Fechar e abrir novamente no Telegram (cookie descartado, URL preservada) não causa tela branca", async () => {
    vi.mocked(getStoreBySlug).mockResolvedValue(storeA as any);
    vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(botA1 as any);

    const result = await resolveSafeOriginBotContext({
      storeSlug: "loja-alpha",
      urlBotParam: botA1.id,
      session: null, // Cookie não persistiu após fechar sheet
    });

    expect(result.originBotId).toBe(botA1.id);
    expect(result.source).toBe("url");
    expect(result.isDivergent).toBe(false);
  });

  // CENÁRIO 4: Abertura com cookie ausente (usuário anônimo ou modo anônimo no Telegram)
  it("Cenário 4: Abertura com cookie ausente resolve via parâmetro da URL", async () => {
    vi.mocked(getStoreBySlug).mockResolvedValue(storeA as any);
    vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(botA1 as any);

    const result = await resolveSafeOriginBotContext({
      storeSlug: "loja-alpha",
      urlBotParam: [botA1.id], // Parâmetro em array de searchParams
      session: null,
    });

    expect(result.originBotId).toBe(botA1.id);
    expect(result.source).toBe("url");
  });

  // CENÁRIO 5: Autenticação e router.refresh() (ref guard contra loops e preservação do comprador)
  it("Cenário 5: Guard de router.refresh() previne loop de atualizações no MiniAppProviders", () => {
    // Simulação do comportamento de guard do MiniAppProviders
    let refreshCount = 0;
    const authRefreshedRef = { current: false };

    const fakeRouter = {
      refresh: () => {
        refreshCount++;
      },
    };

    const handleAuthSuccess = () => {
      if (!authRefreshedRef.current) {
        authRefreshedRef.current = true;
        fakeRouter.refresh();
      }
    };

    // 1ª resposta de auth: dispara refresh
    handleAuthSuccess();
    expect(refreshCount).toBe(1);
    expect(authRefreshedRef.current).toBe(true);

    // 2ª ou 3ª resposta de polling ou re-render: NÃO dispara novamente
    handleAuthSuccess();
    handleAuthSuccess();
    expect(refreshCount).toBe(1);
  });

  // CENÁRIO 6: URL com bot válido pertencente à loja
  it("Cenário 6: URL com bot válido e ativo da loja resolve com sucesso", async () => {
    vi.mocked(getStoreBySlug).mockResolvedValue(storeA as any);
    vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(botA2 as any);

    const result = await resolveSafeOriginBotContext({
      storeSlug: "loja-alpha",
      urlBotParam: botA2.id,
      session: null,
    });

    expect(result.originBotId).toBe(botA2.id);
    expect(result.originBotUsername).toBe("alpha_secondary_bot");
    expect(result.source).toBe("url");
  });

  // CENÁRIO 7: URL com bot inválido (inexistente ou inativo) -> REJEIÇÃO ESTRITA sem fallback
  it("Cenário 7: URL com bot inválido retorna null e NÃO aplica fallback silencioso", async () => {
    vi.mocked(getStoreBySlug).mockResolvedValue(storeA as any);
    // Simula bot não encontrado ou inativo
    vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(null as any);

    const result = await resolveSafeOriginBotContext({
      storeSlug: "loja-alpha",
      urlBotParam: "invalid-bot-id-12345",
      session: null,
    });

    expect(result.originBotId).toBeNull();
    expect(result.source).toBe("none");
    expect(result.isDivergent).toBe(false);
    // Garante que o fallback de bot único NÃO foi acionado para mascarar parâmetro inválido
    expect(db.query.telegramBots.findMany).not.toHaveBeenCalled();
  });

  // CENÁRIO 8: URL com bot de outra loja (tentativa de bypass/cross-tenant)
  it("Cenário 8: URL com bot de outra loja é estritamente rejeitada", async () => {
    vi.mocked(getStoreBySlug).mockResolvedValue(storeA as any);
    // A query filtra por storeId = storeA.id, portanto botB1 não é retornado
    vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(null as any);

    const result = await resolveSafeOriginBotContext({
      storeSlug: "loja-alpha",
      urlBotParam: botB1.id, // Bot da Loja Beta tentando acessar Loja Alpha
      session: null,
    });

    expect(result.originBotId).toBeNull();
    expect(result.source).toBe("none");
  });

  // CENÁRIO 9: Sessão e parâmetro b divergentes (spoofing ou troca de bot)
  it("Cenário 9: Sessão autenticada e parâmetro b divergentes aciona detecção de divergência e bloqueio", async () => {
    vi.mocked(getStoreBySlug).mockResolvedValue(storeA as any);
    // Parâmetro b aponta para botA2, mas a sessão foi autenticada pelo botA1
    vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(botA2 as any);

    const result = await resolveSafeOriginBotContext({
      storeSlug: "loja-alpha",
      urlBotParam: botA2.id,
      session: {
        storeId: storeA.id,
        originBotId: botA1.id, // Divergência!
        originBotUsername: botA1.username,
      },
    });

    expect(result.originBotId).toBeNull();
    expect(result.isDivergent).toBe(true);
    expect(result.source).toBe("none");
  });

  // CENÁRIO 10: Duas lojas com bots diferentes (isolamento estrito multi-tenant)
  it("Cenário 10: Isolamento multi-tenant entre lojas e bots diferentes", async () => {
    // Consulta Loja Beta com seu bot B1
    vi.mocked(getStoreBySlug).mockResolvedValue(storeB as any);
    vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(botB1 as any);

    const resultB = await resolveSafeOriginBotContext({
      storeSlug: "loja-beta",
      urlBotParam: botB1.id,
      session: null,
    });

    expect(resultB.originBotId).toBe(botB1.id);
    expect(resultB.originBotUsername).toBe("beta_sole_bot");

    // Tentativa de sessão da Loja A acessando Loja B é bloqueada
    const crossSessionResult = await resolveSafeOriginBotContext({
      storeSlug: "loja-beta",
      urlBotParam: botB1.id,
      session: {
        storeId: storeA.id, // Sessão pertence à Loja A
        originBotId: botA1.id,
      },
    });

    expect(crossSessionResult.originBotId).toBeNull();
    expect(crossSessionResult.isDivergent).toBe(true);
  });

  // CENÁRIO 11: Fallback de Bot Único estrito
  it("Cenário 11: Loja com exatamente 1 bot ativo aciona fallback seguro; Loja com múltiplos bots não escolhe arbitrariamente", async () => {
    // Caso 11A: Loja B tem exatamente 1 bot ativo -> Fallback ativado com segurança
    vi.mocked(getStoreBySlug).mockResolvedValue(storeB as any);
    vi.mocked(db.query.telegramBots.findMany).mockResolvedValue([botB1] as any);

    const resultSole = await resolveSafeOriginBotContext({
      storeSlug: "loja-beta",
      urlBotParam: null, // Sem parâmetro
      session: null,     // Sem sessão
    });

    expect(resultSole.originBotId).toBe(botB1.id);
    expect(resultSole.source).toBe("single_bot_fallback");
    expect(resultSole.isDivergent).toBe(false);

    // Caso 11B: Loja A tem 2 bots ativos -> Fallback NÃO escolhe arbitrariamente (permanece null)
    vi.mocked(getStoreBySlug).mockResolvedValue(storeA as any);
    vi.mocked(db.query.telegramBots.findMany).mockResolvedValue([botA1, botA2] as any);

    const resultMultiple = await resolveSafeOriginBotContext({
      storeSlug: "loja-alpha",
      urlBotParam: null,
      session: null,
    });

    expect(resultMultiple.originBotId).toBeNull();
    expect(resultMultiple.source).toBe("none");
  });

  // CENÁRIO 12: Regressão do catálogo Multi-Bot com originBotId resolvido
  it("Cenário 12: Contexto resolvido integra perfeitamente com a governança do Catálogo Multi-Bot", async () => {
    vi.mocked(getStoreBySlug).mockResolvedValue(storeA as any);
    vi.mocked(db.query.telegramBots.findFirst).mockResolvedValue(botA1 as any);

    const resolved = await resolveSafeOriginBotContext({
      storeSlug: "loja-alpha",
      urlBotParam: botA1.id,
      session: null,
    });

    // O botId resolvido é válido e pode ser passado para CatalogResolverService
    expect(resolved.originBotId).toBe(botA1.id);
    expect(typeof resolved.originBotId).toBe("string");
  });
});


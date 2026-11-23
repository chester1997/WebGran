/* eslint-disable @typescript-eslint/no-explicit-any -- dublês de teste do banco e do Telegram */
import { beforeEach, describe, expect, it, vi } from "vitest";

/* Banco falso: qualquer cadeia (select/update/insert…) resolve para [], findFirst para undefined. */
const inserts: unknown[] = [];
const chain: any = new Proxy(function () {}, {
  get(_t, k) {
    if (k === "then") return (res: (v: unknown) => void) => res([]);
    if (k === "values") return (v: unknown) => (inserts.push(v), chain);
    return chain;
  },
  apply: () => chain,
});
vi.mock("@/db", () => ({
  db: {
    query: new Proxy({}, { get: () => ({ findFirst: async () => undefined, findMany: async () => [] }) }),
    select: () => chain,
    update: () => chain,
    insert: () => chain,
  },
}));

const sent: { method: string; payload: any }[] = [];
vi.mock("@/lib/telegram/client", () => ({
  telegramFetch: vi.fn(async (_token: string, method: string, payload: any) => {
    sent.push({ method, payload });
    return {};
  }),
}));

import { graphOrder, normalizeGraph, type FlowGraph } from "../advanced-graph";
import { parseCampaign, runAdvancedCallback, runAdvancedStart, type LoadedAdvancedFlow } from "../advanced-runtime";

const ctx = { token: "t", storeId: "s", storeSlug: "", botDbId: "b" };
const user = { id: 123, first_name: "Lucas" };
const flowOf = (g: Partial<FlowGraph>): LoadedAdvancedFlow => ({ flowId: "f", status: "published", graph: normalizeGraph(g) });
const texts = () => sent.filter((s) => s.method === "sendMessage").map((s) => String(s.payload.text));

beforeEach(() => {
  sent.length = 0;
  inserts.length = 0;
});

describe("fluxo avançado no Telegram", () => {
  const graph = {
    nodes: [
      { id: "start", type: "inicio", x: 0, y: 0, data: {} },
      { id: "t1", type: "texto", x: 0, y: 0, data: { text: "Olá, {nome}!" } },
      { id: "b1", type: "botoes", x: 0, y: 0, data: { text: "O que prefere?", buttons: "Ver planos\nSuporte" } },
      { id: "t2", type: "texto", x: 0, y: 0, data: { text: "Aqui estão os planos" } },
    ],
    edges: [
      { from: "start", out: "out", to: "t1" },
      { from: "t1", out: "out", to: "b1" },
      { from: "b1", out: "b0", to: "t2" },
    ],
  } as unknown as FlowGraph;

  it("no /start segue as ligações e para no bloco de botões", async () => {
    await runAdvancedStart(ctx, flowOf(graph), "live", 123, user);
    expect(texts()).toEqual(["Olá, Lucas!", "O que prefere?"]);
    const kb = sent.find((s) => s.payload.text === "O que prefere?")!.payload.reply_markup.inline_keyboard;
    expect(kb.map((r: any) => r[0].text)).toEqual(["Ver planos", "Suporte"]);
    expect(kb[0][0].callback_data).toBe("al:g:b1:b0");
  });

  it("no modo de teste avisa e usa o prefixo de teste nos botões", async () => {
    await runAdvancedStart(ctx, flowOf(graph), "test", 123, user);
    expect(texts()[0]).toContain("Modo de teste");
    const btn = sent.find((s) => s.payload.reply_markup)!.payload.reply_markup.inline_keyboard[0][0];
    expect(btn.callback_data).toBe("at:g:b1:b0");
  });

  it("o clique num botão continua pelo caminho daquele botão", async () => {
    await runAdvancedCallback(ctx, flowOf(graph), "live", { id: "cb", data: "al:g:b1:b0", chatId: 123, user, messageId: 9 });
    expect(texts()).toEqual(["Aqui estão os planos"]);
    expect(sent.some((s) => s.method === "editMessageReplyMarkup")).toBe(true); // tira os botões já usados
  });

  it("um botão sem ligação não envia nada", async () => {
    await runAdvancedCallback(ctx, flowOf(graph), "live", { id: "cb", data: "al:g:b1:b1", chatId: 123, user });
    expect(texts()).toEqual([]);
  });

  it("Teste A/B com 100% vai sempre pelo caminho A", async () => {
    const g = {
      nodes: [
        { id: "start", type: "inicio", x: 0, y: 0, data: {} },
        { id: "ab", type: "ab", x: 0, y: 0, data: { pct: 100 } },
        { id: "a", type: "texto", x: 0, y: 0, data: { text: "A" } },
        { id: "b", type: "texto", x: 0, y: 0, data: { text: "B" } },
      ],
      edges: [
        { from: "start", out: "out", to: "ab" },
        { from: "ab", out: "a", to: "a" },
        { from: "ab", out: "b", to: "b" },
      ],
    } as unknown as FlowGraph;
    await runAdvancedStart(ctx, flowOf(g), "live", 123, user);
    expect(texts()).toEqual(["A"]);
  });

  it("Esperar agenda o próximo bloco na fila em vez de enviar na hora", async () => {
    const g = {
      nodes: [
        { id: "start", type: "inicio", x: 0, y: 0, data: {} },
        { id: "w", type: "espera", x: 0, y: 0, data: { n: 5, u: "minutos" } },
        { id: "t", type: "texto", x: 0, y: 0, data: { text: "Depois" } },
      ],
      edges: [
        { from: "start", out: "out", to: "w" },
        { from: "w", out: "out", to: "t" },
      ],
    } as unknown as FlowGraph;
    await runAdvancedStart(ctx, flowOf(g), "live", 123, user);
    expect(texts()).toEqual([]);
    const job = inserts.find((v: any) => v?.kind === "adv_step") as any;
    expect(job?.payload?.nodeId).toBe("t");
    expect(job.runAt.getTime()).toBeGreaterThan(Date.now() + 4 * 60_000);
  });

  it("Order Bump mostra Aceitar e Recusar com o valor", async () => {
    const g = {
      nodes: [
        { id: "start", type: "inicio", x: 0, y: 0, data: {} },
        { id: "bp", type: "bump", x: 0, y: 0, data: { name: "Pack", price: 9.9, text: "Leve {plano} por {valor}?" } },
      ],
      edges: [{ from: "start", out: "out", to: "bp" }],
    } as unknown as FlowGraph;
    await runAdvancedStart(ctx, flowOf(g), "live", 123, user);
    const msg = sent.find((s) => s.method === "sendMessage")!.payload;
    expect(msg.text).toBe("Leve Pack por R$ 9,90?");
    expect(msg.reply_markup.inline_keyboard.map((r: any) => r[0].callback_data)).toEqual(["al:g:bp:sim", "al:g:bp:nao"]);
  });
});

describe("numeração dos blocos (Ir para)", () => {
  it("segue o caminho a partir do Início", () => {
    const g = normalizeGraph({
      nodes: [
        { id: "start", type: "inicio", x: 0, y: 0, data: {} },
        { id: "x", type: "texto", x: 0, y: 0, data: {} },
        { id: "y", type: "texto", x: 0, y: 0, data: {} },
        { id: "solto", type: "texto", x: 0, y: 0, data: {} },
      ],
      edges: [
        { from: "start", out: "out", to: "y" },
        { from: "y", out: "out", to: "x" },
      ],
    });
    const o = graphOrder(g);
    expect([o.get("start"), o.get("y"), o.get("x"), o.get("solto")]).toEqual([1, 2, 3, 4]);
  });
});

describe("blocos novos (iguais à referência)", () => {
  const start = { id: "start", type: "inicio", x: 0, y: 0, data: {} };

  it("Mensagem envia os itens em ordem e põe os botões no último texto", async () => {
    const g = {
      nodes: [start, { id: "m", type: "mensagem", x: 0, y: 0, data: {
        items: JSON.stringify([{ t: "texto", text: "Oi {nome}" }, { t: "texto", text: "Segredo", spoiler: true }]),
        buttons: JSON.stringify([{ label: "Quero" }, { label: "Site", url: "https://exemplo.com" }]),
      } }],
      edges: [{ from: "start", out: "out", to: "m" }],
    } as unknown as FlowGraph;
    await runAdvancedStart(ctx, flowOf(g), "live", 123, user);
    expect(texts()).toEqual(["Oi Lucas", "<tg-spoiler>Segredo</tg-spoiler>"]);
    const kb = sent.filter((s) => s.method === "sendMessage")[1].payload.reply_markup.inline_keyboard;
    expect(kb[0][0].callback_data).toBe("al:g:m:b0");
    expect(kb[1][0].url).toBe("https://exemplo.com");
  });

  it("Mensagem com timeout agenda a saída Sem clique", async () => {
    const g = {
      nodes: [start, { id: "m", type: "mensagem", x: 0, y: 0, data: { items: "[]", buttons: JSON.stringify([{ label: "Sim" }]), btnText: "Escolha", timeout: 10 } }],
      edges: [{ from: "start", out: "out", to: "m" }],
    } as unknown as FlowGraph;
    await runAdvancedStart(ctx, flowOf(g), "live", 123, user);
    expect(texts()).toEqual(["Escolha"]);
    expect((inserts.find((v: any) => v?.kind === "adv_btn") as any)?.payload?.nodeId).toBe("m");
  });

  it("Imagem com spoiler e Vídeo redondo usam os métodos certos do Telegram", async () => {
    const g = {
      nodes: [start,
        { id: "i", type: "imagem", x: 0, y: 0, data: { url: "https://cdn.x/a.jpg", caption: "Olá", spoiler: 1 } },
        { id: "v", type: "video", x: 0, y: 0, data: { url: "https://cdn.x/b.mp4", format: "redondo" } },
        { id: "f", type: "arquivo", x: 0, y: 0, data: { url: "https://cdn.x/c.pdf" } }],
      edges: [{ from: "start", out: "out", to: "i" }, { from: "i", out: "out", to: "v" }, { from: "v", out: "out", to: "f" }],
    } as unknown as FlowGraph;
    await runAdvancedStart(ctx, flowOf(g), "live", 123, user);
    const photo = sent.find((s) => s.method === "sendPhoto")!.payload;
    expect(photo.has_spoiler).toBe(true);
    expect(photo.caption).toBe("Olá");
    expect(sent.some((s) => s.method === "sendVideoNote")).toBe(true);
    expect(sent.some((s) => s.method === "sendDocument")).toBe(true);
  });

  it("Condição por horário que cobre o dia todo vai pelo primeiro caminho; sem bater vai pelo Senão", async () => {
    const mk = (rules: unknown[]) => ({
      nodes: [start, { id: "c", type: "condicao", x: 0, y: 0, data: { rules: JSON.stringify(rules) } },
        { id: "a", type: "texto", x: 0, y: 0, data: { text: "Bateu" } }, { id: "z", type: "texto", x: 0, y: 0, data: { text: "Senão" } }],
      edges: [{ from: "start", out: "out", to: "c" }, { from: "c", out: "c0", to: "a" }, { from: "c", out: "senao", to: "z" }],
    }) as unknown as FlowGraph;
    await runAdvancedStart(ctx, flowOf(mk([{ kind: "horario", value: "00:00", value2: "23:59" }])), "live", 123, user);
    expect(texts()).toEqual(["Bateu"]);
    sent.length = 0;
    await runAdvancedStart(ctx, flowOf(mk([{ kind: "idioma", value: "es" }])), "live", 123, { ...user, language_code: "pt-br" } as any);
    expect(texts()).toEqual(["Senão"]);
  });

  it("Input pergunta e espera a resposta com o tipo e o tempo certos", async () => {
    const g = {
      nodes: [start, { id: "q", type: "input", x: 0, y: 0, data: { text: "Seu e-mail?", kind: "email", wait: 2, u: "minutos", var: "email" } }],
      edges: [{ from: "start", out: "out", to: "q" }],
    } as unknown as FlowGraph;
    await runAdvancedStart(ctx, flowOf(g), "live", 123, user);
    expect(texts()).toEqual(["Seu e-mail?"]);
    const job = inserts.find((v: any) => v?.kind === "adv_wait") as any;
    expect(job.payload).toMatchObject({ nodeId: "q", var: "email", kind: "email" });
    expect(job.runAt.getTime()).toBeGreaterThan(Date.now() + 100_000);
  });

  it("Fake Call manda Atender e Recusar", async () => {
    const g = {
      nodes: [start, { id: "fc", type: "fakecall", x: 0, y: 0, data: { name: "Maria", msg: "Me atende!" } }],
      edges: [{ from: "start", out: "out", to: "fc" }],
    } as unknown as FlowGraph;
    await runAdvancedStart(ctx, flowOf(g), "live", 123, user);
    const msg = sent.find((s) => s.method === "sendMessage")!.payload;
    expect(msg.text).toContain("Maria");
    expect(msg.reply_markup.inline_keyboard.map((r: any) => r[0].callback_data)).toEqual(["al:g:fc:atendeu", "al:g:fc:recusou"]);
  });
});

describe("link de campanha", () => {
  it("lê origem, campanha e mídia", () => {
    expect(parseCampaign("s-facebook_c-black_m-stories")).toEqual({ source: "facebook", campaign: "black", medium: "stories" });
    expect(parseCampaign("instagram")).toEqual({ source: "instagram", campaign: "", medium: "" });
  });
});

describe("bloco Botões e cores dos botões", () => {
  const start = { id: "start", type: "inicio", x: 0, y: 0, data: {} };
  it("Botões manda o texto com os botões coloridos e espera o clique", async () => {
    const g = {
      nodes: [start, { id: "bt", type: "botao", x: 0, y: 0, data: { text: "Qual plano?", buttons: JSON.stringify([{ label: "Mensal", color: "green" }, { label: "Anual", color: "red" }, { label: "Site", url: "https://x.com", color: "blue" }]) } }],
      edges: [{ from: "start", out: "out", to: "bt" }],
    } as unknown as FlowGraph;
    await runAdvancedStart(ctx, flowOf(g), "live", 123, user);
    const msg = sent.find((s) => s.method === "sendMessage")!.payload;
    expect(msg.text).toBe("Qual plano?");
    const kb = msg.reply_markup.inline_keyboard;
    expect(kb[0][0]).toMatchObject({ text: "Mensal", callback_data: "al:g:bt:b0", style: "success" });
    expect(kb[1][0]).toMatchObject({ text: "Anual", callback_data: "al:g:bt:b1", style: "danger" });
    expect(kb[2][0]).toMatchObject({ text: "Site", url: "https://x.com", style: "primary" });
  });
});

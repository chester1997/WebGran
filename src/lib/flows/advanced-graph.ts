/**
 * Fluxo Avançado: blocos (nós) ligados por saídas nomeadas.
 * Módulo puro, compartilhado entre o editor (cliente), o salvamento e o motor (servidor).
 *
 * Os dados de cada bloco são planos (texto/número). Listas (itens da Mensagem, botões,
 * condições, variantes do A/B) ficam em campos "json" (texto JSON validado).
 */

export type FieldType = "text" | "area" | "num" | "select" | "bool" | "json" | "media" | "chat" | "bot";
export interface NodeField {
  key: string;
  type: FieldType;
  /** Tamanho máximo do texto (padrão: 300; área 4000; json 20000; mídia 1000). */
  max?: number;
}

export type Category = "Início" | "Comunicação" | "Lógica e fluxo" | "Pagamento" | "Entrega" | "Notas" | "Antigos";

export interface NodeTypeDef {
  label: string;
  desc: string;
  category: Category;
  color: string;
  /** Saídas fixas, ou calculadas a partir dos dados (ex.: um caminho por botão). */
  outputs: Array<[string, string]> | ((data: Record<string, unknown>) => Array<[string, string]>);
  fields: NodeField[];
  defaults: Record<string, string | number>;
  summary: (data: Record<string, unknown>) => string;
  /** Tipos antigos: continuam abrindo e rodando, mas não aparecem na lista de blocos. */
  hidden?: boolean;
}

const s = (v: unknown) => (v == null ? "" : String(v));
const n = (v: unknown) => Number(v) || 0;
const money = (v: unknown) => "R$ " + n(v).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** Lê um campo json (lista). Nunca lança erro. */
export function jsonList<T = Record<string, unknown>>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  try {
    const parsed = JSON.parse(s(v) || "[]");
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export interface MsgItem {
  t: "texto" | "midia" | "delay";
  text?: string;
  url?: string;
  spoiler?: boolean;
  sec?: number;
}
export interface MsgButton {
  label: string;
  url?: string;
}
export type RuleKind = "horario" | "idioma" | "utm_source" | "utm_medium" | "utm_campaign" | "pagou";
export interface CondRule {
  kind: RuleKind;
  value?: string;
  value2?: string;
}
export interface AbVariant {
  name: string;
  pct: number;
}

export const RULE_LABEL: Record<RuleKind, string> = {
  horario: "Horário",
  idioma: "Idioma do Telegram",
  utm_source: "UTM Source",
  utm_medium: "UTM Medium",
  utm_campaign: "UTM Campaign",
  pagou: "Já pagou?",
};

export function ruleSummary(r: CondRule): string {
  switch (r.kind) {
    case "horario": return `Entre ${r.value || "00:00"} e ${r.value2 || "23:59"}`;
    case "idioma": return `Idioma: ${r.value || "—"}`;
    case "pagou": return r.value === "nao" ? "Ainda não pagou" : "Já pagou";
    default: return `${RULE_LABEL[r.kind] || r.kind}: ${r.value || "—"}`;
  }
}

const LETTERS = "ABCDEFGH";
const waitLabel = (v: unknown, u: unknown) => {
  const unit = s(u) || "min";
  const short = unit === "segundos" ? "seg" : unit === "minutos" ? "min" : unit === "horas" ? "h" : unit === "dias" ? "dias" : unit;
  return `${n(v)} ${short}`;
};

export const NODE_TYPES = {
  /* ---------------- Início ---------------- */
  inicio: {
    label: "Gatilho", desc: "Ponto de entrada do fluxo", category: "Início", color: "#3b82f6",
    outputs: [["out", ""]], fields: [{ key: "ignoreRepeat", type: "bool" }], defaults: { ignoreRepeat: 0 },
    summary: () => "Ponto de entrada da automação. Clique para configurar.",
  },

  /* ---------------- Comunicação ---------------- */
  mensagem: {
    label: "Mensagem", desc: "Enviar texto, mídia ou botões", category: "Comunicação", color: "#3b82f6",
    outputs: (d) => {
      const btns = jsonList<MsgButton>(d.buttons).filter((b) => s(b.label).trim() && !s(b.url).trim()).slice(0, 8);
      if (!btns.length) return [["out", ""]];
      const outs: Array<[string, string]> = btns.map((b, i) => [`b${i}`, s(b.label).trim()]);
      if (n(d.timeout) > 0) outs.push(["sem", "Sem clique"]);
      return outs;
    },
    fields: [{ key: "items", type: "json" }, { key: "buttons", type: "json" }, { key: "btnText", type: "area" }, { key: "timeout", type: "num" }, { key: "simulate", type: "bool" }, { key: "simSec", type: "num" }],
    defaults: { items: "[]", buttons: "[]", btnText: "", timeout: 0, simulate: 0, simSec: 2 },
    summary: (d) => {
      const items = jsonList<MsgItem>(d.items);
      if (!items.length) return "Clique para gerenciar";
      const first = items.find((i) => i.t === "texto" && s(i.text).trim());
      const parts = [`${items.length} ${items.length === 1 ? "item" : "itens"}`];
      return first ? s(first.text).slice(0, 90) : parts.join(" · ");
    },
  },
  texto: {
    label: "Texto", desc: "Enviar uma mensagem de texto", category: "Comunicação", color: "#60a5fa",
    outputs: [["out", ""]], fields: [{ key: "text", type: "area" }, { key: "spoiler", type: "bool" }], defaults: { text: "", spoiler: 0 },
    summary: (d) => s(d.text) || "Clique para escrever",
  },
  imagem: {
    label: "Imagem", desc: "Enviar uma foto com legenda", category: "Comunicação", color: "#34d399",
    outputs: [["out", ""]], fields: [{ key: "url", type: "media" }, { key: "caption", type: "area", max: 1024 }, { key: "spoiler", type: "bool" }],
    defaults: { url: "", caption: "", spoiler: 0 }, summary: (d) => (d.url ? s(d.caption) || "Imagem pronta" : "Clique para enviar o arquivo"),
  },
  video: {
    label: "Vídeo", desc: "Enviar um vídeo ou recado redondo", category: "Comunicação", color: "#f87171",
    outputs: [["out", ""]], fields: [{ key: "url", type: "media" }, { key: "format", type: "select" }, { key: "caption", type: "area", max: 1024 }, { key: "spoiler", type: "bool" }],
    defaults: { url: "", format: "normal", caption: "", spoiler: 0 },
    summary: (d) => (d.url ? (d.format === "redondo" ? "Recado redondo" : s(d.caption) || "Vídeo pronto") : "Clique para enviar o arquivo"),
  },
  audio: {
    label: "Áudio", desc: "Enviar áudio gravado ou música", category: "Comunicação", color: "#f472b6",
    outputs: [["out", ""]], fields: [{ key: "url", type: "media" }, { key: "mode", type: "select" }, { key: "caption", type: "area", max: 1024 }],
    defaults: { url: "", mode: "voz", caption: "" }, summary: (d) => (d.url ? (d.mode === "musica" ? "Música" : "Áudio gravado") : "Clique para enviar o arquivo"),
  },
  arquivo: {
    label: "Arquivo", desc: "Enviar PDF, ZIP, Word, Excel...", category: "Comunicação", color: "#cbd5e1",
    outputs: [["out", ""]], fields: [{ key: "url", type: "media" }, { key: "name", type: "text" }, { key: "caption", type: "area", max: 1024 }],
    defaults: { url: "", name: "", caption: "" }, summary: (d) => (d.url ? s(d.name) || "Arquivo pronto" : "Clique para enviar o arquivo"),
  },
  digitando: {
    label: "Digitando", desc: "Mostrar “digitando...” ou “gravando áudio...”", category: "Comunicação", color: "#a5b4fc",
    outputs: [["out", ""]], fields: [{ key: "action", type: "select" }, { key: "sec", type: "num" }], defaults: { action: "digitando", sec: 5 },
    summary: (d) => `${n(d.sec)} seg · ${d.action === "gravando" ? "gravando áudio" : "digitando"}`,
  },
  fakecall: {
    label: "Fake Call", desc: "Simular chamada de vídeo", category: "Comunicação", color: "#ef4444",
    outputs: [["atendeu", "Atendeu"], ["recusou", "Recusou"]],
    fields: [{ key: "name", type: "text" }, { key: "videoUrl", type: "media" }, { key: "msg", type: "area" }, { key: "acceptBtn", type: "text" }, { key: "declineBtn", type: "text" }],
    defaults: { name: "", videoUrl: "", msg: "📞 Chamada de vídeo recebida", acceptBtn: "📞 Atender chamada", declineBtn: "❌ Recusar" },
    summary: (d) => `Chamada simulada${d.name ? " de " + s(d.name) : ""}`,
  },

  /* ---------------- Lógica e fluxo ---------------- */
  espera: {
    label: "Espera", desc: "Esperar um tempo antes de continuar", category: "Lógica e fluxo", color: "#fbbf24",
    outputs: [["out", ""]], fields: [{ key: "n", type: "num" }, { key: "u", type: "select" }], defaults: { n: 0, u: "minutos" },
    summary: (d) => waitLabel(d.n, d.u),
  },
  condicao: {
    label: "Condição", desc: "Dividir por horário, idioma ou UTM", category: "Lógica e fluxo", color: "#a78bfa",
    outputs: (d) => [...jsonList<CondRule>(d.rules).slice(0, 8).map((r, i) => [`c${i}`, ruleSummary(r)] as [string, string]), ["senao", "Senão"]],
    fields: [{ key: "rules", type: "json" }], defaults: { rules: "[]" },
    summary: (d) => (jsonList(d.rules).length ? `${jsonList(d.rules).length} condição(ões)` : "Configure as condições"),
  },
  ab: {
    label: "Teste A/B", desc: "Dividir leads entre caminhos", category: "Lógica e fluxo", color: "#fb923c",
    outputs: (d) => jsonList<AbVariant>(d.variants).slice(0, 8).map((v, i) => [LETTERS[i].toLowerCase(), `${s(v.name) || LETTERS[i]} · ${n(v.pct)}%`] as [string, string]),
    fields: [{ key: "variants", type: "json" }], defaults: { variants: JSON.stringify([{ name: "A", pct: 50 }, { name: "B", pct: 50 }]) },
    summary: (d) => (jsonList(d.variants).length ? `${jsonList(d.variants).length} caminhos` : "Configure as variantes"),
  },
  input: {
    label: "Input", desc: "Perguntar e aguardar resposta do lead", category: "Lógica e fluxo", color: "#2dd4bf",
    outputs: [["resp", "Respondeu"], ["sem", "Timeout"]],
    fields: [{ key: "text", type: "area" }, { key: "kind", type: "select" }, { key: "wait", type: "num" }, { key: "u", type: "select" }, { key: "var", type: "text", max: 30 }],
    defaults: { text: "", kind: "texto", wait: 60, u: "segundos", var: "resposta" },
    summary: (d) => `${s(d.text) || "Pergunta não configurada"} · ${({ texto: "Texto", numero: "Número", email: "E-mail", telefone: "Telefone" } as Record<string, string>)[s(d.kind)] || "Texto"} · ${waitLabel(d.wait, d.u)}`,
  },

  /* ---------------- Pagamento ---------------- */
  pagamento: {
    label: "Pagamento", desc: "Gerar cobrança PIX", category: "Pagamento", color: "#22c55e",
    outputs: [["pago", "Pagou"], ["expirou", "Expirou"]],
    fields: [{ key: "value", type: "num" }, { key: "desc", type: "text", max: 120 }, { key: "saleType", type: "select" }, { key: "timeout", type: "num" }, { key: "msg", type: "area" }, { key: "qr", type: "select" }, { key: "payColor", type: "select" }, { key: "checkColor", type: "select" }],
    defaults: { value: 0, desc: "", saleType: "principal", timeout: 15, msg: "", qr: "botao", payColor: "none", checkColor: "none" },
    summary: (d) => `${money(d.value)} · PIX · ${n(d.timeout)}min`,
  },

  /* ---------------- Entrega ---------------- */
  grupo: {
    label: "Grupo", desc: "Enviar convite para grupo", category: "Entrega", color: "#14b8a6",
    outputs: [["out", ""], ["expirado", "Expirado"]], fields: [{ key: "chatId", type: "chat" }, { key: "days", type: "num" }], defaults: { chatId: "", days: 30 },
    summary: (d) => (d.chatId ? `Acesso por ${n(d.days) > 0 ? `${n(d.days)} dias` : "tempo ilimitado"}` : "Selecione o grupo"),
  },
  bottaxa: {
    label: "Bot/Taxa", desc: "Entregar via outro bot (abre no /start)", category: "Entrega", color: "#818cf8",
    outputs: [["out", ""]], fields: [{ key: "botId", type: "bot" }, { key: "btnText", type: "text", max: 64 }], defaults: { botId: "", btnText: "" },
    summary: (d) => (d.botId ? "🤖 Acessar bot" : "Selecionar bot"),
  },
  remover: {
    label: "Remover", desc: "Remover lead do grupo", category: "Entrega", color: "#fb7185",
    outputs: [["out", ""]], fields: [{ key: "groupId", type: "text", max: 20 }], defaults: { groupId: "" },
    summary: (d) => (d.groupId ? `Remove do grupo ${s(d.groupId)}` : "Remove o lead do grupo do último acesso"),
  },
  pixel: {
    label: "Pixel", desc: "Disparar evento de pixel", category: "Entrega", color: "#e879f9",
    outputs: [["out", ""]],
    fields: [{ key: "event", type: "select" }, { key: "value", type: "num" }, { key: "fbPixelId", type: "text", max: 40 }, { key: "fbToken", type: "text", max: 400 }],
    defaults: { event: "", value: 0, fbPixelId: "", fbToken: "" }, summary: (d) => `Evento: ${s(d.event) || "Não definido"}`,
  },

  /* ---------------- Notas ---------------- */
  nota: {
    label: "Nota", desc: "Anotação que só você vê", category: "Notas", color: "#fde047",
    outputs: [], fields: [{ key: "text", type: "area" }], defaults: { text: "" }, summary: (d) => s(d.text) || "Nota vazia",
  },

  /* ---------------- Tipos antigos (abrem e rodam; fora da lista) ---------------- */
  midia: { label: "Foto ou vídeo", desc: "Envia foto ou vídeo", category: "Antigos", color: "#38bdf8", hidden: true, outputs: [["out", ""]], fields: [{ key: "url", type: "media" }, { key: "caption", type: "area" }], defaults: { url: "", caption: "" }, summary: (d) => s(d.caption) || (d.url ? "Imagem" : "Sem imagem") },
  botoes: {
    label: "Mensagem com botões", desc: "Texto com botões", category: "Antigos", color: "#22d3ee", hidden: true,
    outputs: (d) => s(d.buttons).split("\n").map((b) => b.trim()).filter(Boolean).slice(0, 8).map((b, i) => [`b${i}`, b] as [string, string]),
    fields: [{ key: "text", type: "area" }, { key: "buttons", type: "area" }], defaults: { text: "O que você prefere?", buttons: "Ver planos\nFalar com suporte" }, summary: (d) => s(d.text),
  },
  pergunta: { label: "Pergunta", desc: "Pergunta e guarda a resposta", category: "Antigos", color: "#2dd4bf", hidden: true, outputs: [["resp", "Respondeu"], ["sem", "Não respondeu"]], fields: [{ key: "text", type: "area" }, { key: "var", type: "text" }, { key: "wait", type: "num" }], defaults: { text: "Qual o seu e-mail?", var: "email", wait: 30 }, summary: (d) => s(d.text) },
  salto: { label: "Ir para", desc: "Continua em outro bloco", category: "Antigos", color: "#a3a3a3", hidden: true, outputs: [], fields: [{ key: "target", type: "text" }], defaults: { target: "" }, summary: (d) => "Continua em: " + (s(d.target) || "—") },
  pix: { label: "Pix (antigo)", desc: "Gera o Pix de um produto", category: "Antigos", color: "#34d399", hidden: true, outputs: [["pago", "Pagou"], ["nao", "Não pagou"]], fields: [{ key: "productId", type: "select" }, { key: "wait", type: "num" }, { key: "qr", type: "select" }], defaults: { productId: "", wait: 30, qr: "Por botão" }, summary: (d) => `Espera ${s(d.wait)} min pelo pagamento` },
  bump: { label: "Order Bump", desc: "Oferta extra antes do Pix", category: "Antigos", color: "#f59e0b", hidden: true, outputs: [["sim", "Aceitou"], ["nao", "Recusou"]], fields: [{ key: "name", type: "text" }, { key: "price", type: "num" }, { key: "text", type: "area" }], defaults: { name: "Oferta extra", price: 9.9, text: "Leve também por um preço especial?" }, summary: (d) => `${s(d.name)} · ${money(d.price)}` },
  upsell: { label: "Upsell", desc: "Oferta depois da compra", category: "Antigos", color: "#60a5fa", hidden: true, outputs: [["sim", "Comprou"], ["nao", "Recusou"]], fields: [{ key: "name", type: "text" }, { key: "price", type: "num" }, { key: "text", type: "area" }], defaults: { name: "Oferta especial", price: 29.9, text: "Oferta só para quem acabou de entrar." }, summary: (d) => `${s(d.name)} · ${money(d.price)}` },
  downsell: { label: "Oferta com desconto", desc: "Desconto para quem não comprou", category: "Antigos", color: "#f87171", hidden: true, outputs: [["sim", "Comprou"], ["nao", "Não comprou"]], fields: [{ key: "desc", type: "num" }, { key: "text", type: "area" }], defaults: { desc: 10, text: "Liberei 10% off para você." }, summary: (d) => `${s(d.desc)}% off · ${s(d.text)}` },
  entrega: { label: "Liberar acesso", desc: "Libera o acesso ao grupo", category: "Antigos", color: "#34d399", hidden: true, outputs: [["out", ""]], fields: [{ key: "chatId", type: "chat" }], defaults: { chatId: "" }, summary: () => "Libera o acesso comprado" },
} satisfies Record<string, NodeTypeDef>;

export type NodeType = keyof typeof NODE_TYPES;
export const PALETTE_CATEGORIES = ["Comunicação", "Lógica e fluxo", "Pagamento", "Entrega"] as const;
export const MAX_NODES = 200;

export interface FlowNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  data: Record<string, string | number>;
}
export interface FlowEdge {
  from: string;
  out: string;
  to: string;
}
export interface FlowGraph {
  version: 1;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export function nodeOutputs(n: Pick<FlowNode, "type" | "data">): Array<[string, string]> {
  const def = NODE_TYPES[n.type] as NodeTypeDef;
  return typeof def.outputs === "function" ? def.outputs(n.data) : def.outputs;
}

export const isSuccessOutput = (k: string) => k === "pago" || k === "sim" || k === "resp" || k === "atendeu";
export const isFailOutput = (k: string) => k === "nao" || k === "sem" || k === "expirou" || k === "recusou" || k === "expirado";

export function blankGraph(): FlowGraph {
  return { version: 1, nodes: [{ id: "start", type: "inicio", x: 60, y: 240, data: { ignoreRepeat: 0 } }], edges: [] };
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Saídas renomeadas entre versões (as ligações antigas continuam valendo). */
const OUT_ALIAS: Partial<Record<NodeType, Record<string, string>>> = { condicao: { sim: "c0", nao: "senao" } };

/**
 * Valida o grafo: só tipos conhecidos, coordenadas dentro da área, dados primitivos,
 * sempre um único bloco Início, e ligações apenas entre blocos/saídas existentes
 * (uma ligação por saída; nada entra no Início).
 */
export function normalizeGraph(input: unknown): FlowGraph {
  const g = isObj(input) ? input : {};
  const seen = new Set<string>();
  const nodes: FlowNode[] = [];
  let hasStart = false;

  for (const raw of Array.isArray(g.nodes) ? g.nodes : []) {
    if (!isObj(raw) || nodes.length >= MAX_NODES) continue;
    const type = raw.type as NodeType;
    if (typeof raw.id !== "string" || !raw.id || raw.id.length > 40 || seen.has(raw.id)) continue;
    if (!(type in NODE_TYPES)) continue;
    if (type === "inicio") {
      if (hasStart) continue;
      hasStart = true;
    }
    const def = NODE_TYPES[type] as NodeTypeDef;
    const data: Record<string, string | number> = { ...def.defaults };
    if (isObj(raw.data)) {
      for (const f of def.fields) {
        const v = raw.data[f.key];
        if (v === undefined || v === null) continue;
        if (f.type === "num") {
          const num = Number(v);
          if (Number.isFinite(num)) data[f.key] = Math.max(0, Math.min(1_000_000, num));
        } else if (f.type === "bool") {
          data[f.key] = v === true || v === 1 || v === "1" || v === "true" ? 1 : 0;
        } else if (f.type === "json") {
          const list = jsonList(v);
          const txt = JSON.stringify(list.slice(0, 30));
          data[f.key] = txt.length <= (f.max ?? 20000) ? txt : def.defaults[f.key];
        } else if (typeof v === "string" || typeof v === "number") {
          const max = f.max ?? (f.type === "area" ? 4000 : f.type === "media" ? 1000 : 300);
          data[f.key] = String(v).slice(0, max);
        }
      }
      // Condição antiga (uma regra fixa) → lista de regras.
      if (type === "condicao" && typeof raw.data.rule === "string" && !raw.data.rules) {
        const old = raw.data.rule;
        const rule: CondRule = /comprou/i.test(old) ? { kind: "pagou", value: "sim" } : /campanha/i.test(old) ? { kind: "utm_source", value: "*" } : { kind: "pagou", value: /não pagou/i.test(old) ? "nao" : "sim" };
        data.rules = JSON.stringify([rule]);
      }
      // A/B antigo (porcentagem do A) → variantes.
      if (type === "ab" && raw.data.pct !== undefined && !raw.data.variants) {
        const pct = Math.max(0, Math.min(100, n(raw.data.pct)));
        data.variants = JSON.stringify([{ name: "A", pct }, { name: "B", pct: 100 - pct }]);
      }
    }
    seen.add(raw.id);
    nodes.push({
      id: raw.id,
      type,
      x: Math.max(-20000, Math.min(20000, Math.round(Number(raw.x) || 0))),
      y: Math.max(-20000, Math.min(20000, Math.round(Number(raw.y) || 0))),
      data,
    });
  }

  if (!hasStart) nodes.unshift(blankGraph().nodes[0]);
  const byId = new Map(nodes.map((nd) => [nd.id, nd]));
  const used = new Set<string>();
  const edges: FlowEdge[] = [];
  for (const raw of Array.isArray(g.edges) ? g.edges : []) {
    if (!isObj(raw)) continue;
    const from = byId.get(String(raw.from));
    const to = byId.get(String(raw.to));
    let out = String(raw.out ?? "");
    if (!from || !to || from.id === to.id || to.type === "inicio") continue;
    if (!nodeOutputs(from).some(([k]) => k === out)) out = OUT_ALIAS[from.type]?.[out] ?? out;
    if (!nodeOutputs(from).some(([k]) => k === out)) continue;
    const key = `${from.id}|${out}`;
    if (used.has(key)) continue;
    used.add(key);
    edges.push({ from: from.id, out, to: to.id });
  }
  return { version: 1, nodes, edges };
}

/**
 * Número de cada bloco na ordem em que o cliente passa por eles, a partir do Início
 * (o mesmo número do editor). Blocos soltos vêm depois; notas não entram.
 */
export function graphOrder(g: FlowGraph): Map<string, number> {
  const order = new Map<string, number>();
  const start = g.nodes.find((nd) => nd.type === "inicio");
  const queue = start ? [start.id] : [];
  while (queue.length) {
    const id = queue.shift()!;
    if (order.has(id)) continue;
    order.set(id, order.size + 1);
    const node = g.nodes.find((nd) => nd.id === id);
    if (!node) continue;
    for (const [k] of nodeOutputs(node)) {
      const e = g.edges.find((x) => x.from === id && x.out === k);
      if (e && !order.has(e.to)) queue.push(e.to);
    }
  }
  for (const nd of g.nodes) if (nd.type !== "nota" && !order.has(nd.id)) order.set(nd.id, order.size + 1);
  return order;
}

/** Checklist antes de publicar (usada na tela e pelo servidor). */
export function graphChecklist(g: FlowGraph) {
  const start = g.nodes.find((nd) => nd.type === "inicio");
  const loose = g.nodes.filter((nd) => nd.type !== "inicio" && nd.type !== "nota" && !g.edges.some((e) => e.to === nd.id)).length;
  const pays = g.nodes.filter((nd) => nd.type === "pagamento");
  return [
    { label: "Gatilho ligado a um bloco", ok: !!start && g.edges.some((e) => e.from === start.id), required: true },
    { label: "Pagamentos com valor (mín. R$ 1,00)", ok: pays.every((p) => n(p.data.value) >= 1), required: true },
    { label: loose ? `${loose} bloco(s) sem nenhuma entrada` : "Todos os blocos têm entrada", ok: !loose, required: false },
  ];
}

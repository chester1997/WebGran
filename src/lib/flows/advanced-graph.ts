/**
 * Fluxo Avançado: blocos (nós) ligados por saídas nomeadas.
 * Módulo puro, compartilhado entre o editor (cliente) e o salvamento (servidor).
 */

export type FieldType = "text" | "area" | "num" | "select";
export interface NodeField {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
}

export interface NodeTypeDef {
  label: string;
  category: "Início" | "Mensagens" | "Lógica" | "Venda" | "Entrega e notas";
  color: string;
  icon: string;
  /** Saídas fixas, ou calculadas a partir dos dados (ex.: um caminho por botão). */
  outputs: Array<[string, string]> | ((data: Record<string, unknown>) => Array<[string, string]>);
  fields: NodeField[];
  defaults: Record<string, string | number>;
  summary: (data: Record<string, unknown>) => string;
}

const s = (v: unknown) => (v == null ? "" : String(v));
const money = (v: unknown) =>
  "R$ " + (Number(v) || 0).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");

export const NODE_TYPES = {
  inicio: { label: "Início", category: "Início", color: "#34d399", icon: "▶", outputs: [["out", ""]], fields: [], defaults: {}, summary: () => "Quando o cliente manda /start" },
  texto: { label: "Mensagem", category: "Mensagens", color: "#60a5fa", icon: "T", outputs: [["out", ""]], fields: [{ key: "text", label: "Mensagem", type: "area" }], defaults: { text: "Olá, {nome}! 👋" }, summary: (d) => s(d.text) || "Mensagem vazia" },
  midia: { label: "Foto ou vídeo", category: "Mensagens", color: "#38bdf8", icon: "▣", outputs: [["out", ""]], fields: [{ key: "url", label: "Link da imagem (https)", type: "text" }, { key: "caption", label: "Legenda", type: "area" }], defaults: { url: "", caption: "" }, summary: (d) => s(d.caption) || (d.url ? "Imagem" : "Sem imagem") },
  audio: { label: "Áudio", category: "Mensagens", color: "#818cf8", icon: "♪", outputs: [["out", ""]], fields: [{ key: "url", label: "Link do áudio .ogg (https)", type: "text" }], defaults: { url: "" }, summary: (d) => (d.url ? "Áudio de voz" : "Sem áudio") },
  botoes: {
    label: "Mensagem com botões", category: "Mensagens", color: "#22d3ee", icon: "⌘",
    outputs: (d) => s(d.buttons).split("\n").map((b) => b.trim()).filter(Boolean).slice(0, 8).map((b, i) => [`b${i}`, b] as [string, string]),
    fields: [{ key: "text", label: "Mensagem", type: "area" }, { key: "buttons", label: "Botões (um por linha, cada um vira um caminho)", type: "area" }],
    defaults: { text: "O que você prefere?", buttons: "Ver planos\nFalar com suporte" }, summary: (d) => s(d.text),
  },
  digitando: { label: "Digitando…", category: "Mensagens", color: "#94a3b8", icon: "…", outputs: [["out", ""]], fields: [{ key: "sec", label: "Segundos", type: "num" }], defaults: { sec: 3 }, summary: (d) => `Mostra “digitando” por ${s(d.sec)}s` },
  pergunta: { label: "Pergunta", category: "Mensagens", color: "#2dd4bf", icon: "?", outputs: [["resp", "Respondeu"], ["sem", "Não respondeu"]], fields: [{ key: "text", label: "Pergunta", type: "area" }, { key: "var", label: "Guardar resposta como", type: "text" }, { key: "wait", label: "Esperar resposta (minutos)", type: "num" }], defaults: { text: "Qual o seu e-mail?", var: "email", wait: 30 }, summary: (d) => s(d.text) },
  espera: { label: "Esperar", category: "Lógica", color: "#fbbf24", icon: "⏱", outputs: [["out", ""]], fields: [{ key: "n", label: "Tempo", type: "num" }, { key: "u", label: "Unidade", type: "select", options: ["minutos", "horas", "dias"] }], defaults: { n: 15, u: "minutos" }, summary: (d) => `Espera ${s(d.n)} ${s(d.u)}` },
  condicao: { label: "Condição", category: "Lógica", color: "#f472b6", icon: "◇", outputs: [["sim", "Sim"], ["nao", "Não"]], fields: [{ key: "rule", label: "Se o cliente", type: "select", options: ["Já comprou algum plano", "Gerou Pix e não pagou", "Está com acesso ativo", "Veio de uma campanha (UTM)"] }], defaults: { rule: "Já comprou algum plano" }, summary: (d) => "Se " + s(d.rule).toLowerCase() },
  ab: { label: "Teste A/B", category: "Lógica", color: "#fb923c", icon: "⑂", outputs: [["a", "Caminho A"], ["b", "Caminho B"]], fields: [{ key: "pct", label: "% para o caminho A", type: "num" }], defaults: { pct: 50 }, summary: (d) => `${s(d.pct)}% vão para A` },
  salto: { label: "Ir para", category: "Lógica", color: "#a3a3a3", icon: "↪", outputs: [], fields: [{ key: "target", label: "Bloco de destino", type: "text" }], defaults: { target: "" }, summary: (d) => "Continua em: " + (s(d.target) || "—") },
  pix: { label: "Pix", category: "Venda", color: "#34d399", icon: "$", outputs: [["pago", "Pagou"], ["nao", "Não pagou"]], fields: [{ key: "productId", label: "Plano", type: "select" }, { key: "wait", label: "Considerar “não pagou” depois de (min)", type: "num" }, { key: "qr", label: "QR Code", type: "select", options: ["Por botão", "Junto do Pix", "Não enviar"] }], defaults: { productId: "", wait: 30, qr: "Por botão" }, summary: (d) => `Espera ${s(d.wait)} min pelo pagamento` },
  bump: { label: "Order Bump", category: "Venda", color: "#f59e0b", icon: "+", outputs: [["sim", "Aceitou"], ["nao", "Recusou"]], fields: [{ key: "name", label: "Oferta", type: "text" }, { key: "price", label: "Preço (R$)", type: "num" }, { key: "text", label: "Mensagem", type: "area" }], defaults: { name: "Oferta extra", price: 9.9, text: "Leve também por um preço especial?" }, summary: (d) => `${s(d.name)} · ${money(d.price)}` },
  upsell: { label: "Upsell", category: "Venda", color: "#60a5fa", icon: "↗", outputs: [["sim", "Comprou"], ["nao", "Recusou"]], fields: [{ key: "name", label: "Oferta", type: "text" }, { key: "price", label: "Preço (R$)", type: "num" }, { key: "text", label: "Mensagem", type: "area" }], defaults: { name: "Oferta especial", price: 29.9, text: "Oferta só para quem acabou de entrar." }, summary: (d) => `${s(d.name)} · ${money(d.price)}` },
  downsell: { label: "Oferta com desconto", category: "Venda", color: "#f87171", icon: "↘", outputs: [["sim", "Comprou"], ["nao", "Não comprou"]], fields: [{ key: "desc", label: "Desconto (%)", type: "num" }, { key: "text", label: "Mensagem", type: "area" }], defaults: { desc: 10, text: "Liberei 10% off para você." }, summary: (d) => `${s(d.desc)}% off · ${s(d.text)}` },
  entrega: { label: "Liberar acesso", category: "Entrega e notas", color: "#34d399", icon: "✓", outputs: [["out", ""]], fields: [{ key: "chatId", label: "Entregar em", type: "select" }], defaults: { chatId: "" }, summary: () => "Libera o acesso comprado" },
  nota: { label: "Nota", category: "Entrega e notas", color: "#fde047", icon: "✎", outputs: [], fields: [{ key: "text", label: "Nota (só você vê)", type: "area" }], defaults: { text: "" }, summary: (d) => s(d.text) || "Nota vazia" },
} satisfies Record<string, NodeTypeDef>;

export type NodeType = keyof typeof NODE_TYPES;
export const PALETTE_CATEGORIES = ["Mensagens", "Lógica", "Venda", "Entrega e notas"] as const;
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

export const isSuccessOutput = (k: string) => k === "pago" || k === "sim" || k === "resp";
export const isFailOutput = (k: string) => k === "nao" || k === "sem";

export function blankGraph(): FlowGraph {
  return { version: 1, nodes: [{ id: "start", type: "inicio", x: 60, y: 240, data: {} }], edges: [] };
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

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
        if (f.type === "num") {
          const n = Number(v);
          if (Number.isFinite(n)) data[f.key] = Math.max(0, Math.min(1_000_000, n));
        } else if (typeof v === "string") {
          data[f.key] = v.slice(0, f.type === "area" ? 4000 : 300);
        }
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
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const used = new Set<string>();
  const edges: FlowEdge[] = [];
  for (const raw of Array.isArray(g.edges) ? g.edges : []) {
    if (!isObj(raw)) continue;
    const from = byId.get(String(raw.from));
    const to = byId.get(String(raw.to));
    const out = String(raw.out ?? "");
    if (!from || !to || from.id === to.id || to.type === "inicio") continue;
    if (!nodeOutputs(from).some(([k]) => k === out)) continue;
    const key = `${from.id}|${out}`;
    if (used.has(key)) continue;
    used.add(key);
    edges.push({ from: from.id, out, to: to.id });
  }
  return { version: 1, nodes, edges };
}

/** Checklist mínima antes de publicar (usada na tela e, depois, pelo servidor). */
export function graphChecklist(g: FlowGraph) {
  const start = g.nodes.find((n) => n.type === "inicio");
  const loose = g.nodes.filter((n) => n.type !== "inicio" && n.type !== "nota" && !g.edges.some((e) => e.to === n.id)).length;
  return [
    { label: "Início ligado a um bloco", ok: !!start && g.edges.some((e) => e.from === start.id), required: true },
    { label: "Tem um bloco Pix", ok: g.nodes.some((n) => n.type === "pix"), required: true },
    { label: "Tem um bloco Liberar acesso", ok: g.nodes.some((n) => n.type === "entrega"), required: true },
    { label: loose ? `${loose} bloco(s) sem nenhuma entrada` : "Todos os blocos têm entrada", ok: !loose, required: false },
  ];
}

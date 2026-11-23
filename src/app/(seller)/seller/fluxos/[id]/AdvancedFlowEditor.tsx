"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, Maximize2, Minus, Plus, Trash2 } from "lucide-react";
import {
  graphChecklist,
  isFailOutput,
  isSuccessOutput,
  MAX_NODES,
  NODE_TYPES,
  nodeOutputs,
  normalizeGraph,
  PALETTE_CATEGORIES,
  type FlowGraph,
  type FlowNode,
  type NodeType,
  type NodeTypeDef,
} from "@/lib/flows/advanced-graph";
import { saveFlowConfigAction } from "../actions";
import { CARD, Callout, INPUT, useToast } from "../_components/flow-ui";
import EditorTopBar, { type SaveState } from "../_components/EditorTopBar";
import Toaster from "../_components/Toaster";
import type { FlowChat, FlowProduct } from "./BasicFlowEditor";

/* Medidas fixas dos blocos: as ligações são calculadas a partir delas, sem medir o DOM. */
const NODE_W = 232;
const HEAD_H = 42;
const BODY_H = 44;
const OUT_PAD = 4;
const OUT_H = 24;
const PORT_R = 7;

const def = (t: NodeType) => NODE_TYPES[t] as NodeTypeDef;
const newId = () => `n_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const brl = (v: number) => "R$ " + (Number(v) || 0).toFixed(2).replace(".", ",");

function outPoint(n: FlowNode, index: number) {
  return { x: n.x + NODE_W, y: n.y + HEAD_H + BODY_H + OUT_PAD + index * OUT_H + OUT_H / 2 };
}
function inPoint(n: FlowNode) {
  return { x: n.x, y: n.y + HEAD_H / 2 };
}

export default function AdvancedFlowEditor({
  flowId,
  name,
  status,
  bots,
  products,
  chats,
  initialGraph,
}: {
  flowId: string;
  name: string;
  status: "draft" | "published";
  bots: { id: string; username: string }[];
  products: FlowProduct[];
  chats: FlowChat[];
  botName: string;
  initialGraph: FlowGraph;
}) {
  const toast = useToast();
  const [graph, setGraph] = useState<FlowGraph>(() => normalizeGraph(initialGraph));
  const [sel, setSel] = useState<string | null>(null);
  const [scale, setScale] = useState(0.9);
  const [connecting, setConnecting] = useState<{ from: string; out: string } | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const justDragged = useRef(false);
  const lastSaved = useRef<string | null>(null);
  const seq = useRef(0);

  const byId = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph.nodes]);
  const selected = sel ? byId.get(sel) || null : null;

  // Salvamento automático.
  useEffect(() => {
    const snapshot = JSON.stringify(graph);
    if (lastSaved.current === null) lastSaved.current = snapshot;
    if (snapshot === lastSaved.current) {
      setSaveState((s) => (s === "dirty" ? "saved" : s));
      return;
    }
    setSaveState("dirty");
    const id = ++seq.current;
    const t = setTimeout(async () => {
      setSaveState("saving");
      const res = await saveFlowConfigAction(flowId, graph);
      if (id !== seq.current) return;
      if (!res.success) {
        setSaveState("error");
        toast(res.error, "err");
      } else {
        lastSaved.current = snapshot;
        setSaveState("saved");
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [graph, flowId, toast]);

  const mutate = useCallback((fn: (g: FlowGraph) => FlowGraph) => setGraph((g) => fn(g)), []);

  const addNode = (type: NodeType) => {
    if (graph.nodes.length >= MAX_NODES) {
      toast(`Limite de ${MAX_NODES} blocos por fluxo.`, "err");
      return;
    }
    const w = wrapRef.current;
    const cx = w ? (w.scrollLeft + w.clientWidth / 2) / scale : 400;
    const cy = w ? (w.scrollTop + w.clientHeight / 2) / scale : 300;
    const data: Record<string, string | number> = { ...def(type).defaults };
    if (type === "pix" && products[0]) data.productId = products[0].id;
    if (type === "entrega" && chats[0]) data.chatId = chats[0].id;
    const node: FlowNode = { id: newId(), type, x: Math.max(10, Math.round(cx - NODE_W / 2 + (Math.random() * 60 - 30))), y: Math.max(10, Math.round(cy - 60 + (Math.random() * 60 - 30))), data };
    mutate((g) => ({ ...g, nodes: [...g.nodes, node] }));
    setSel(node.id);
  };

  const removeNode = (id: string) => {
    if (byId.get(id)?.type === "inicio") return;
    mutate((g) => ({ ...g, nodes: g.nodes.filter((n) => n.id !== id), edges: g.edges.filter((e) => e.from !== id && e.to !== id) }));
    setSel(null);
  };

  const duplicateNode = (id: string) => {
    const n = byId.get(id);
    if (!n || n.type === "inicio") return;
    const copy: FlowNode = { ...n, id: newId(), x: n.x + 30, y: n.y + 40, data: { ...n.data } };
    mutate((g) => ({ ...g, nodes: [...g.nodes, copy] }));
    setSel(copy.id);
  };

  const setData = (id: string, key: string, value: string | number) =>
    mutate((g) => {
      const nodes = g.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, [key]: value } } : n));
      // Se um bloco de botões perdeu saídas, remove as ligações órfãs.
      const valid = new Set(nodes.flatMap((n) => nodeOutputs(n).map(([k]) => `${n.id}|${k}`)));
      return { ...g, nodes, edges: g.edges.filter((e) => valid.has(`${e.from}|${e.out}`)) };
    });

  const connectTo = (targetId: string) => {
    if (!connecting) return;
    const target = byId.get(targetId);
    if (target && target.type !== "inicio" && targetId !== connecting.from) {
      mutate((g) => ({ ...g, edges: [...g.edges.filter((e) => !(e.from === connecting.from && e.out === connecting.out)), { from: connecting.from, out: connecting.out, to: targetId }] }));
    }
    setConnecting(null);
  };

  // Teclado: Esc cancela ligação; Delete apaga o bloco selecionado (fora de campos de texto).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName || "");
      if (e.key === "Escape") setConnecting(null);
      if ((e.key === "Delete" || e.key === "Backspace") && sel && !typing) removeNode(sel);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Arrastar blocos pelo cabeçalho.
  const onPointerDown = (e: React.PointerEvent, n: FlowNode) => {
    if (e.button !== 0) return;
    dragRef.current = { id: n.id, sx: e.clientX, sy: e.clientY, ox: n.x, oy: n.y, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = (e.clientX - d.sx) / scale;
    const dy = (e.clientY - d.sy) / scale;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    const x = Math.max(0, Math.round(d.ox + dx));
    const y = Math.max(0, Math.round(d.oy + dy));
    setGraph((g) => ({ ...g, nodes: g.nodes.map((n) => (n.id === d.id ? { ...n, x, y } : n)) }));
  };
  const onPointerUp = () => {
    if (dragRef.current?.moved) {
      justDragged.current = true;
      setTimeout(() => (justDragged.current = false), 0);
    }
    dragRef.current = null;
  };

  const width = Math.max(1700, ...graph.nodes.map((n) => n.x + NODE_W + 400));
  const height = Math.max(900, ...graph.nodes.map((n) => n.y + 400));

  const paths = graph.edges.flatMap((e) => {
    const a = byId.get(e.from);
    const b = byId.get(e.to);
    if (!a || !b) return [];
    const idx = nodeOutputs(a).findIndex(([k]) => k === e.out);
    if (idx < 0) return [];
    const p1 = outPoint(a, idx);
    const p2 = inPoint(b);
    const dx = Math.max(50, Math.abs(p2.x - p1.x) / 2);
    const tone = isSuccessOutput(e.out) ? "rgba(52,211,153,.75)" : isFailOutput(e.out) ? "rgba(248,113,113,.65)" : "rgba(148,163,184,.6)";
    return [{ key: `${e.from}|${e.out}`, d: `M${p1.x},${p1.y} C${p1.x + dx},${p1.y} ${p2.x - dx},${p2.y} ${p2.x},${p2.y}`, tone, e }];
  });

  const checklist = graphChecklist(graph).map((c) => ({ ...c, onFix: undefined }));

  return (
    <div className="w-full max-w-full pb-10 space-y-4">
      <Toaster />
      <EditorTopBar flowId={flowId} name={name} type="advanced" status={status} bots={bots} saveState={saveState} checklist={checklist} />

      <div className="relative grid grid-cols-1 lg:grid-cols-[200px_minmax(0,1fr)] 2xl:grid-cols-[200px_minmax(0,1fr)_320px] gap-3.5 items-stretch">
        {/* Paleta */}
        <aside aria-label="Blocos" className={`${CARD} p-2.5 flex lg:flex-col gap-3 overflow-auto lg:max-h-[calc(100vh-170px)]`}>
          {PALETTE_CATEGORIES.map((cat) => (
            <div key={cat} className="shrink-0">
              <p className="text-[10.5px] tracking-[0.08em] font-semibold text-zinc-500 uppercase px-1.5 pb-1">{cat}</p>
              <div className="flex lg:flex-col gap-0.5">
                {(Object.entries(NODE_TYPES) as [NodeType, NodeTypeDef][])
                  .filter(([, d]) => d.category === cat)
                  .map(([k, d]) => (
                    <button key={k} type="button" onClick={() => addNode(k)} className="flex items-center gap-2.5 px-2 py-1.5 rounded-[9px] text-[13px] text-zinc-300 hover:bg-white/[0.05] text-left whitespace-nowrap">
                      <span className="w-[26px] h-[26px] rounded-[7px] flex items-center justify-center text-[12px] font-bold shrink-0" style={{ background: d.color + "22", color: d.color }}>{d.icon}</span>
                      <span className="flex-1">{d.label}</span>
                      <Plus className="w-3.5 h-3.5 text-zinc-600" />
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </aside>

        {/* Canvas */}
        <section className={`${CARD} relative overflow-hidden flex flex-col min-w-0`}>
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/[0.07] text-[12.5px] text-zinc-500 flex-wrap">
            <span>Clique num bloco para editar. Para ligar, clique na bolinha de saída e depois no bloco de destino.</span>
            <span className="font-mono text-[11.5px]">{graph.nodes.length} blocos · {graph.edges.length} ligações</span>
          </div>
          <div
            ref={wrapRef}
            className="relative flex-1 overflow-auto min-h-[560px] h-[calc(100vh-230px)]"
            style={{ backgroundColor: "#0c0d11", backgroundImage: "radial-gradient(rgba(255,255,255,.07) 1px, transparent 1px)", backgroundSize: `${22 * scale}px ${22 * scale}px` }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setSel(null);
                setConnecting(null);
              }
            }}
          >
            {connecting && <div className="sticky top-3 z-10 mx-auto w-max bg-[#3984FF] text-white text-[12.5px] px-3 py-1.5 rounded-full">Clique no bloco de destino · Esc cancela</div>}
            <div className="relative origin-top-left" style={{ width, height, transform: `scale(${scale})` }} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
              <svg className="absolute inset-0 overflow-visible" width={width} height={height}>
                {paths.map((p) => (
                  <path
                    key={p.key}
                    d={p.d}
                    fill="none"
                    stroke={p.tone}
                    strokeWidth={2}
                    className="cursor-pointer hover:!stroke-red-400 [pointer-events:stroke]"
                    onClick={() => mutate((g) => ({ ...g, edges: g.edges.filter((x) => !(x.from === p.e.from && x.out === p.e.out)) }))}
                  >
                    <title>Clique para remover a ligação</title>
                  </path>
                ))}
              </svg>
              {graph.nodes.map((n) => {
                const d = def(n.type);
                const outs = nodeOutputs(n);
                const isSel = sel === n.id;
                return (
                  <div
                    key={n.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Bloco ${d.label}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (justDragged.current) return;
                      if (connecting) connectTo(n.id);
                      else setSel(n.id);
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter") setSel(n.id); }}
                    className={`absolute rounded-[14px] border bg-[#16171c] shadow-[0_14px_30px_-18px_#000] select-none ${isSel ? "border-[#3984FF] ring-[3px] ring-[#3984FF]/25" : "border-white/[0.13]"} ${connecting && connecting.from !== n.id && n.type !== "inicio" ? "outline-dashed outline-2 outline-offset-2 outline-[#60a5fa]/60" : ""}`}
                    style={{ left: n.x, top: n.y, width: NODE_W }}
                  >
                    {n.type !== "inicio" && n.type !== "nota" && (
                      <span className="absolute -left-[8px] rounded-full bg-[#16171c] border-2 border-zinc-400" style={{ top: HEAD_H / 2 - PORT_R, width: PORT_R * 2, height: PORT_R * 2 }} aria-hidden="true" />
                    )}
                    <div className="flex items-center gap-2 px-2.5 border-b border-white/[0.08] cursor-grab active:cursor-grabbing touch-none" style={{ height: HEAD_H }} onPointerDown={(e) => onPointerDown(e, n)}>
                      <span className="w-[26px] h-[26px] rounded-[7px] flex items-center justify-center text-[12px] font-bold shrink-0" style={{ background: d.color + "22", color: d.color }}>{d.icon}</span>
                      <b className="text-[13px] text-white truncate">{d.label}</b>
                    </div>
                    <div className="px-2.5 py-1.5 text-[12px] leading-[1.35] text-zinc-400 overflow-hidden" style={{ height: BODY_H }}>
                      <span className="line-clamp-2">{nodeSummary(n, products)}</span>
                    </div>
                    {outs.length > 0 && (
                      <div className="border-t border-white/[0.08]" style={{ paddingTop: OUT_PAD, paddingBottom: OUT_PAD }}>
                        {outs.map(([k, label]) => {
                          const on = connecting?.from === n.id && connecting.out === k;
                          const ring = isSuccessOutput(k) ? "border-emerald-400" : isFailOutput(k) ? "border-red-400" : "border-zinc-400";
                          return (
                            <div key={k} className="relative flex items-center justify-end pr-3 text-[11.5px] text-zinc-500" style={{ height: OUT_H }}>
                              <span className="truncate max-w-[180px]">{label}</span>
                              <button
                                type="button"
                                aria-label={`Ligar saída ${label || "continua"}`}
                                title="Clique e depois clique no bloco de destino"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConnecting(on ? null : { from: n.id, out: k });
                                }}
                                className={`absolute -right-[8px] rounded-full border-2 ${on ? "bg-[#3984FF] border-[#3984FF]" : `bg-[#16171c] ${ring} hover:bg-[#3984FF]`}`}
                                style={{ width: PORT_R * 2, height: PORT_R * 2, top: OUT_H / 2 - PORT_R }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="absolute left-3 bottom-3 flex gap-1 z-10">
            {[
              { icon: Plus, label: "Aproximar", on: () => setScale((s) => Math.min(1.3, +(s + 0.1).toFixed(2))) },
              { icon: Minus, label: "Afastar", on: () => setScale((s) => Math.max(0.5, +(s - 0.1).toFixed(2))) },
              { icon: Maximize2, label: "Tamanho padrão", on: () => setScale(0.9) },
            ].map(({ icon: I, label, on }) => (
              <button key={label} type="button" aria-label={label} title={label} onClick={on} className="w-8 h-8 rounded-lg border border-white/[0.1] bg-[#16171c] text-zinc-400 hover:text-white flex items-center justify-center"><I className="w-4 h-4" /></button>
            ))}
          </div>
        </section>

        {/* Painel do bloco */}
        <aside className={`${CARD} flex-col min-w-0 ${selected ? "flex absolute right-3 top-12 bottom-14 z-20 w-[min(320px,calc(100%-24px))] overflow-y-auto shadow-2xl shadow-black/60 2xl:static 2xl:w-auto 2xl:shadow-none" : "hidden 2xl:flex"}`} aria-label="Configuração do bloco">
          {!selected ? (
            <div className="p-4 flex flex-col gap-2.5 text-[13px] text-zinc-400 leading-relaxed">
              <p className="text-[14px] font-semibold text-white">Nenhum bloco selecionado</p>
              <p>Clique num bloco do canvas para editar aqui. Os blocos da esquerda entram no meio da tela.</p>
              <p>Saídas <span className="text-emerald-400">verdes</span> são o caminho bom (pagou, aceitou). <span className="text-red-400">Vermelhas</span> são o caminho de recuperação.</p>
              <p>Para apagar uma ligação, clique nela. Para apagar um bloco, selecione e aperte Delete.</p>
            </div>
          ) : (
            <Inspector node={selected} graph={graph} products={products} chats={chats} onChange={(k, v) => setData(selected.id, k, v)} onDelete={() => removeNode(selected.id)} onDuplicate={() => duplicateNode(selected.id)} />
          )}
        </aside>
      </div>
    </div>
  );
}

function nodeSummary(n: FlowNode, products: FlowProduct[]) {
  if (n.type === "pix") {
    const p = products.find((x) => x.id === n.data.productId);
    return `${p ? `${p.title} · ${brl(p.price)}` : "Escolha o plano"} · espera ${n.data.wait} min`;
  }
  return def(n.type).summary(n.data);
}

function Inspector({
  node,
  graph,
  products,
  chats,
  onChange,
  onDelete,
  onDuplicate,
}: {
  node: FlowNode;
  graph: FlowGraph;
  products: FlowProduct[];
  chats: FlowChat[];
  onChange: (key: string, value: string | number) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const d = def(node.type);
  const outs = nodeOutputs(node);
  const optionsFor = (key: string, fallback?: string[]): [string, string][] => {
    if (node.type === "pix" && key === "productId") return [["", "Escolha…"], ...products.map((p) => [p.id, `${p.title} · ${brl(p.price)}`] as [string, string])];
    if (node.type === "entrega" && key === "chatId") return [["", chats.length ? "Escolha…" : "Ligue um bot para listar os grupos"], ...chats.map((c) => [c.id, c.title] as [string, string])];
    return (fallback || []).map((o) => [o, o]);
  };

  return (
    <>
      <header className="flex items-center gap-2.5 px-4 py-3.5 border-b border-white/[0.07]">
        <span className="w-[30px] h-[30px] rounded-lg flex items-center justify-center font-bold" style={{ background: d.color + "22", color: d.color }}>{d.icon}</span>
        <b className="flex-1 text-[14.5px] text-white">{d.label}</b>
        {node.type !== "inicio" && (
          <>
            <button type="button" onClick={onDuplicate} aria-label="Duplicar bloco" title="Duplicar" className="w-8 h-8 rounded-lg border border-white/[0.08] text-zinc-500 hover:text-white flex items-center justify-center"><Copy className="w-4 h-4" /></button>
            <button type="button" onClick={onDelete} aria-label="Excluir bloco" title="Excluir" className="w-8 h-8 rounded-lg border border-white/[0.08] text-zinc-500 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
          </>
        )}
      </header>
      <div className="p-4 flex flex-col gap-3.5">
        {d.fields.length === 0 && <Callout>Este é o começo do fluxo. Ligue a saída dele no primeiro bloco da conversa.</Callout>}
        {d.fields.map((f) => {
          const id = `g-${node.id}-${f.key}`;
          const value = node.data[f.key] ?? "";
          return (
            <label key={f.key} className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-semibold text-zinc-300">{f.label}</span>
              {f.type === "area" ? (
                <textarea id={id} rows={4} maxLength={4000} value={String(value)} onChange={(e) => onChange(f.key, e.target.value)} className={`${INPUT} resize-y leading-relaxed`} />
              ) : f.type === "select" ? (
                <select id={id} value={String(value)} onChange={(e) => onChange(f.key, e.target.value)} className={INPUT}>
                  {optionsFor(f.key, f.options).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              ) : f.type === "num" ? (
                <input id={id} type="number" min={0} step="any" value={Number(value) || 0} onChange={(e) => onChange(f.key, Number(e.target.value))} className={INPUT} />
              ) : (
                <input id={id} maxLength={300} value={String(value)} onChange={(e) => onChange(f.key, e.target.value)} className={INPUT} />
              )}
            </label>
          );
        })}
        {outs.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold text-zinc-300">Saídas</span>
            {outs.map(([k, l]) => {
              const e = graph.edges.find((x) => x.from === node.id && x.out === k);
              const t = e && graph.nodes.find((n) => n.id === e.to);
              return (
                <div key={k} className="flex justify-between gap-2 text-[12.5px] px-2.5 py-1.5 rounded-[9px] bg-[#0d0e12] border border-white/[0.08]">
                  <span className={isSuccessOutput(k) ? "text-emerald-400" : isFailOutput(k) ? "text-red-400" : "text-zinc-300"}>{l || "Continua"}</span>
                  <span className="text-zinc-500 truncate">{t ? "→ " + def(t.type).label : "sem ligação"}</span>
                </div>
              );
            })}
          </div>
        )}
        <p className="text-[12px] text-zinc-600">Variáveis nas mensagens: {"{nome}"}, {"{saudacao}"}, {"{plano}"}.</p>
      </div>
    </>
  );
}

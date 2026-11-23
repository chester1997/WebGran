"use client";

import "@xyflow/react/dist/base.css";
import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ComponentType, type DragEvent as ReactDragEvent } from "react";
import {
  Background,
  BackgroundVariant,
  Handle,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import {
  Activity,
  Banknote,
  Bot,
  Clock,
  Copy,
  CornerDownRight,
  File as FileIcon,
  GitBranch,
  HelpCircle,
  Image as ImageIcon,
  KeyRound,
  LayoutList,
  LocateFixed,
  Lock,
  Maximize,
  MessageCircle,
  MessageSquare,
  Mic,
  Minus,
  MoreHorizontal,
  PackagePlus,
  PhoneCall,
  Plus,
  QrCode,
  Redo2,
  Shuffle,
  StickyNote,
  TextCursorInput,
  Trash2,
  TrendingDown,
  TrendingUp,
  Undo2,
  Unlock,
  UserMinus,
  Users,
  Video,
  Zap,
} from "lucide-react";
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
  type NodeType,
  type NodeTypeDef,
} from "@/lib/flows/advanced-graph";
import { saveFlowConfigAction } from "../actions";
import { Modal, useToast } from "../_components/flow-ui";
import EditorTopBar, { type SaveState } from "../_components/EditorTopBar";
import Toaster from "../_components/Toaster";
import type { FlowChat, FlowProduct } from "./BasicFlowEditor";
import { BlockForm, BlockModal } from "./advanced-forms";

/* ------------------------------------------------------------------ */
/* Tipos e utilidades                                                  */
/* ------------------------------------------------------------------ */
type Values = Record<string, string | number>;
type BlockData = { type: NodeType; values: Values };
type BlockNode = Node<BlockData, "block">;

const ACCENT = "#3b82f6";
const def = (t: NodeType) => NODE_TYPES[t] as NodeTypeDef;
const newId = () => `n_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const brl = (v: number) => "R$ " + (Number(v) || 0).toFixed(2).replace(".", ",");
const edgeId = (source: string, out: string) => `${source}|${out}`;

const ICONS: Record<NodeType, ComponentType<{ className?: string }>> = {
  inicio: Zap,
  mensagem: MessageCircle,
  texto: MessageSquare,
  imagem: ImageIcon,
  video: Video,
  audio: Mic,
  arquivo: FileIcon,
  digitando: MoreHorizontal,
  fakecall: PhoneCall,
  espera: Clock,
  condicao: GitBranch,
  ab: Shuffle,
  input: TextCursorInput,
  pagamento: Banknote,
  grupo: Users,
  bottaxa: Bot,
  remover: UserMinus,
  pixel: Activity,
  nota: StickyNote,
  midia: ImageIcon,
  botoes: LayoutList,
  pergunta: HelpCircle,
  salto: CornerDownRight,
  pix: QrCode,
  bump: PackagePlus,
  upsell: TrendingUp,
  downsell: TrendingDown,
  entrega: KeyRound,
};

function toFlow(g: FlowGraph): { nodes: BlockNode[]; edges: Edge[] } {
  return {
    nodes: g.nodes.map((n) => ({
      id: n.id,
      type: "block",
      position: { x: n.x, y: n.y },
      data: { type: n.type, values: { ...n.data } },
      deletable: n.type !== "inicio",
    })),
    edges: g.edges.map((e) => ({ id: edgeId(e.from, e.out), source: e.from, sourceHandle: e.out, target: e.to, targetHandle: "in" })),
  };
}

function toGraph(nodes: BlockNode[], edges: Edge[]): FlowGraph {
  return {
    version: 1,
    nodes: nodes.map((n) => ({ id: n.id, type: n.data.type, x: Math.round(n.position.x), y: Math.round(n.position.y), data: n.data.values })),
    edges: edges.map((e) => ({ from: e.source, out: String(e.sourceHandle ?? "out"), to: e.target })),
  };
}

/** Numeração dos blocos na ordem em que o cliente passa por eles (a partir do Início). */
function blockOrder(nodes: BlockNode[], edges: Edge[]): Map<string, number> {
  const order = new Map<string, number>();
  const start = nodes.find((n) => n.data.type === "inicio");
  const queue = start ? [start.id] : [];
  while (queue.length) {
    const id = queue.shift()!;
    if (order.has(id)) continue;
    order.set(id, order.size + 1);
    const node = nodes.find((n) => n.id === id);
    if (!node) continue;
    for (const [k] of nodeOutputs({ type: node.data.type, data: node.data.values })) {
      const e = edges.find((x) => x.source === id && x.sourceHandle === k);
      if (e && !order.has(e.target)) queue.push(e.target);
    }
  }
  for (const n of nodes) if (n.data.type !== "nota" && !order.has(n.id)) order.set(n.id, order.size + 1);
  return order;
}

function summary(type: NodeType, values: Values, products: FlowProduct[]) {
  if (type === "pix") {
    const p = products.find((x) => x.id === values.productId);
    return `${p ? `${p.title} · ${brl(p.price)}` : "Escolha o plano"} · espera ${values.wait} min`;
  }
  return def(type).summary(values);
}

/** Histórico de desfazer/refazer (fora do React; avisa a tela quando muda). */
function createHistory(initial: string) {
  let past: string[] = [];
  let future: string[] = [];
  let current = initial;
  let snap = { canUndo: false, canRedo: false };
  const listeners = new Set<() => void>();
  const emit = () => {
    snap = { canUndo: past.length > 0, canRedo: future.length > 0 };
    listeners.forEach((l) => l());
  };
  return {
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    get: () => snap,
    record: (key: string) => {
      if (key === current) return;
      past = [...past.slice(-79), current];
      future = [];
      current = key;
      emit();
    },
    undo: (): string | null => {
      const prev = past.pop();
      if (prev === undefined) return null;
      future.push(current);
      current = prev;
      emit();
      return prev;
    },
    redo: (): string | null => {
      const next = future.pop();
      if (next === undefined) return null;
      past.push(current);
      current = next;
      emit();
      return next;
    },
  };
}

/* ------------------------------------------------------------------ */
/* Contexto compartilhado com os blocos                                */
/* ------------------------------------------------------------------ */
interface EditorCtx {
  order: Map<string, number>;
  products: FlowProduct[];
  locked: boolean;
  open: (id: string) => void;
  duplicate: (id: string) => void;
  remove: (id: string) => void;
}
const Ctx = createContext<EditorCtx | null>(null);
const useEditor = () => useContext(Ctx)!;

const PORT = "!w-[13px] !h-[13px] !rounded-full !border-2 !bg-[#0e0f13] transition-colors";

/* ------------------------------------------------------------------ */
/* Bloco                                                               */
/* ------------------------------------------------------------------ */
const Block = memo(function Block({ id, data, selected }: NodeProps<BlockNode>) {
  const ed = useEditor();
  const d = def(data.type);
  const Icon = ICONS[data.type];
  const outs = nodeOutputs({ type: data.type, data: data.values });
  const num = ed.order.get(id);
  const text = summary(data.type, data.values, ed.products);

  if (data.type === "nota") {
    return (
      <div
        onDoubleClick={() => ed.open(id)}
        className={`group w-[240px] rounded-[12px] border px-3.5 py-3 bg-[#1d1a0f] text-[13px] leading-[1.5] text-amber-100/90 shadow-[0_14px_30px_-18px_#000] ${selected ? "border-amber-300/70 ring-[3px] ring-amber-300/15" : "border-amber-300/20"}`}
      >
        <div className="flex items-center gap-2 mb-1.5 text-[11.5px] font-semibold text-amber-200/80">
          <StickyNote className="w-3.5 h-3.5" />
          Nota
          <NodeActions id={id} className="ml-auto" />
        </div>
        <p className="whitespace-pre-wrap break-words line-clamp-6">{String(data.values.text || "") || "Clique duas vezes para escrever."}</p>
      </div>
    );
  }

  return (
    <div
      onDoubleClick={() => ed.open(id)}
      className={`group relative w-[288px] rounded-[16px] border bg-[linear-gradient(180deg,#17181d_0%,#121317_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_18px_38px_-20px_rgba(0,0,0,0.95)] transition-[border-color,box-shadow] ${
        selected ? "border-[#3b82f6]/70 ring-[3px] ring-[#3b82f6]/20" : "border-white/[0.09] hover:border-white/[0.16]"
      }`}
    >
      {/* fio de luz no topo, na cor do bloco */}
      <span aria-hidden="true" className="pointer-events-none absolute left-5 right-5 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${d.color}, transparent)` }} />

      {data.type !== "inicio" && (
        <Handle type="target" position={Position.Left} id="in" isConnectable={!ed.locked} className={`${PORT} !border-zinc-400 hover:!border-[#3b82f6]`} style={{ top: 29 }} />
      )}

      <header className="relative flex items-center gap-2.5 h-[58px] px-3.5 border-b border-white/[0.06]">
        {num !== undefined && (
          <span className="w-6 h-6 rounded-full text-[#0b0c0f] text-[12px] font-bold flex items-center justify-center shrink-0 tabular-nums" style={{ background: d.color, boxShadow: `0 0 0 3px ${d.color}26` }}>{num}</span>
        )}
        <span className="w-7 h-7 rounded-[8px] flex items-center justify-center shrink-0" style={{ background: d.color + "1f", color: d.color }}>
          <Icon className="w-[15px] h-[15px]" />
        </span>
        <b className="text-[15px] font-semibold text-white tracking-tight truncate">{d.label}</b>
        <NodeActions id={id} help={d.desc} canEdit={data.type !== "inicio"} className="absolute right-2.5 top-[15px] pl-3 bg-[linear-gradient(90deg,transparent,#17181d_30%)]" />
      </header>

      <div className="px-3.5 py-3 text-[13px] leading-[1.5] text-zinc-400 break-words">
        <span className="line-clamp-3">{text}</span>
      </div>

      {outs.length > 0 && (
        <div className="border-t border-white/[0.06] py-1.5">
          {outs.map(([k, label]) => {
            const tone = isSuccessOutput(k) ? "!border-emerald-400 hover:!bg-emerald-400" : isFailOutput(k) ? "!border-red-400 hover:!bg-red-400" : "!border-[#3b82f6] hover:!bg-[#3b82f6]";
            const txt = isSuccessOutput(k) ? "text-emerald-400/90" : isFailOutput(k) ? "text-red-400/90" : label ? "text-zinc-400" : "text-[#60a5fa]";
            return (
              <div key={k} className="relative flex items-center justify-end h-[26px] pr-4 pl-3.5">
                <span className={`text-[12px] truncate ${txt}`}>{label || "Próximo passo"}</span>
                <Handle type="source" position={Position.Right} id={k} isConnectable={!ed.locked} className={`${PORT} ${tone}`} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

function NodeActions({ id, className = "", help, canEdit = true }: { id: string; className?: string; help?: string; canEdit?: boolean }) {
  const ed = useEditor();
  const btn = "nodrag w-7 h-7 rounded-[7px] flex items-center justify-center text-zinc-500 transition-colors";
  if (ed.locked || !canEdit) {
    return help ? (
      <span className={`flex items-center ${className}`}>
        <span title={help} aria-label={help} className={`${btn} cursor-help hover:text-white`}><HelpCircle className="w-3.5 h-3.5" /></span>
      </span>
    ) : null;
  }
  return (
    <span className={`flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity ${className}`}>
      {help && <span title={help} aria-label={help} className={`${btn} cursor-help hover:text-white`}><HelpCircle className="w-3.5 h-3.5" /></span>}
      <button type="button" aria-label="Duplicar bloco" title="Duplicar (Ctrl+D)" onClick={(e) => { e.stopPropagation(); ed.duplicate(id); }} className={`${btn} hover:text-white hover:bg-white/[0.07]`}>
        <Copy className="w-3.5 h-3.5" />
      </button>
      <button type="button" aria-label="Excluir bloco" title="Excluir (Delete)" onClick={(e) => { e.stopPropagation(); ed.remove(id); }} className={`${btn} hover:text-red-400 hover:bg-red-500/10`}>
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </span>
  );
}

const nodeTypes = { block: Block };

/* ------------------------------------------------------------------ */
/* Editor                                                              */
/* ------------------------------------------------------------------ */
type Props = {
  flowId: string;
  name: string;
  status: "draft" | "published";
  bots: { id: string; username: string }[];
  products: FlowProduct[];
  chats: FlowChat[];
  botName: string;
  initialGraph: FlowGraph;
  /** Todos os bots da loja (bloco Bot/Taxa). */
  storeBots?: { id: string; username: string; displayName?: string | null }[];
};

export default function AdvancedFlowEditor(props: Props) {
  return (
    <ReactFlowProvider>
      <Editor {...props} />
    </ReactFlowProvider>
  );
}

function Editor({ flowId, name, status, bots, products, chats, initialGraph, storeBots = [] }: Props) {
  const toast = useToast();
  const rf = useReactFlow<BlockNode, Edge>();
  const initial = useMemo(() => toFlow(normalizeGraph(initialGraph)), [initialGraph]);
  const [nodes, setNodes, onNodesChange] = useNodesState<BlockNode>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges);
  const [locked, setLocked] = useState(false);
  const [editing, setEditing] = useState<{ id: string; draft: Values } | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const graph = useMemo(() => toGraph(nodes, edges), [nodes, edges]);
  const graphKey = useMemo(() => JSON.stringify(graph), [graph]);
  const order = useMemo(() => blockOrder(nodes, edges), [nodes, edges]);

  /** Sobe a cada fim de arrasto/restauração: refaz histórico e salvamento com a posição final. */
  const [tick, bump] = useState(0);

  /* ---------- salvamento automático ---------- */
  const lastSaved = useRef<string | null>(null);
  const seq = useRef(0);
  useEffect(() => {
    if (lastSaved.current === null) lastSaved.current = graphKey;
    if (graphKey === lastSaved.current) {
      setSaveState((s) => (s === "dirty" ? "saved" : s));
      return;
    }
    setSaveState("dirty");
    const id = ++seq.current;
    const t = setTimeout(async () => {
      if (dragging.current) return;
      setSaveState("saving");
      const res = await saveFlowConfigAction(flowId, JSON.parse(graphKey));
      if (id !== seq.current) return;
      if (!res.success) {
        setSaveState("error");
        toast(res.error, "err");
      } else {
        lastSaved.current = graphKey;
        setSaveState("saved");
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [graphKey, tick, flowId, toast]);

  /* ---------- desfazer / refazer ---------- */
  const [history] = useState(() => createHistory(graphKey));
  const { canUndo, canRedo } = useSyncExternalStore(history.subscribe, history.get, history.get);
  useEffect(() => {
    if (!dragging.current) history.record(graphKey);
  }, [graphKey, tick, history]);

  const restore = useCallback(
    (key: string | null) => {
      if (!key) return;
      const f = toFlow(JSON.parse(key) as FlowGraph);
      setNodes(f.nodes);
      setEdges(f.edges);
    },
    [setNodes, setEdges]
  );
  const undo = useCallback(() => restore(history.undo()), [restore, history]);
  const redo = useCallback(() => restore(history.redo()), [restore, history]);

  /* ---------- ações nos blocos ---------- */
  const centerPoint = useCallback(() => {
    const r = canvasRef.current?.getBoundingClientRect();
    return r ? rf.screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 }) : { x: 300, y: 200 };
  }, [rf]);

  const addNode = useCallback(
    (type: NodeType, at?: { x: number; y: number }) => {
      if (nodes.length >= MAX_NODES) {
        toast(`Limite de ${MAX_NODES} blocos por fluxo.`, "err");
        return;
      }
      const p = at || centerPoint();
      const values: Values = { ...def(type).defaults };
      if (type === "pix" && products[0]) values.productId = products[0].id;
      if ((type === "entrega" || type === "grupo") && chats[0]) values.chatId = chats[0].id;
      const jitter = at ? 0 : Math.round(Math.random() * 40 - 20);
      const node: BlockNode = {
        id: newId(),
        type: "block",
        position: { x: Math.round(p.x - 144 + jitter), y: Math.round(p.y - 60 + jitter) },
        data: { type, values },
        selected: true,
        deletable: true,
      };
      setNodes((ns) => [...ns.map((n) => (n.selected ? { ...n, selected: false } : n)), node]);
      setPaletteOpen(false);
    },
    [nodes.length, centerPoint, products, chats, setNodes, toast]
  );

  const duplicate = useCallback(
    (id: string) => {
      setNodes((ns) => {
        const n = ns.find((x) => x.id === id);
        if (!n || n.data.type === "inicio" || ns.length >= MAX_NODES) return ns;
        const copy: BlockNode = { ...n, id: newId(), position: { x: n.position.x + 36, y: n.position.y + 44 }, data: { type: n.data.type, values: { ...n.data.values } }, selected: true, deletable: true };
        return [...ns.map((x) => ({ ...x, selected: false })), copy];
      });
    },
    [setNodes]
  );

  const remove = useCallback(
    (id: string) => {
      if (nodes.find((n) => n.id === id)?.data.type === "inicio") return;
      setNodes((ns) => ns.filter((n) => n.id !== id));
      setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
    },
    [nodes, setNodes, setEdges]
  );

  const open = useCallback(
    (id: string) => {
      const n = nodes.find((x) => x.id === id);
      if (n) setEditing({ id, draft: { ...n.data.values } });
    },
    [nodes]
  );

  const saveEdit = useCallback(() => {
    if (!editing) return;
    const node = nodes.find((n) => n.id === editing.id);
    if (!node) return setEditing(null);
    const valid = new Set(nodeOutputs({ type: node.data.type, data: editing.draft }).map(([k]) => k));
    setNodes((ns) => ns.map((n) => (n.id === editing.id ? { ...n, data: { ...n.data, values: editing.draft } } : n)));
    // Um bloco de botões que perdeu saídas perde também as ligações delas.
    setEdges((es) => es.filter((e) => e.source !== editing.id || valid.has(String(e.sourceHandle))));
    setEditing(null);
  }, [editing, nodes, setNodes, setEdges]);

  /* ---------- ligações ---------- */
  const typeOf = useCallback((id: string | null | undefined) => nodes.find((n) => n.id === id)?.data.type, [nodes]);

  const link = useCallback(
    (source: string, out: string, target: string) => {
      if (source === target || typeOf(target) === "inicio" || typeOf(target) === "nota") return;
      setEdges((es) => [...es.filter((e) => !(e.source === source && e.sourceHandle === out)), { id: edgeId(source, out), source, sourceHandle: out, target, targetHandle: "in" }]);
    },
    [setEdges, typeOf]
  );

  const onConnect = useCallback((c: Connection) => c.sourceHandle && link(c.source, c.sourceHandle, c.target), [link]);

  const isValidConnection = useCallback(
    (c: Connection | Edge) => c.source !== c.target && typeOf(c.target) !== "inicio" && typeOf(c.target) !== "nota" && (c.targetHandle ?? "in") === "in",
    [typeOf]
  );

  // Soltar a linha em cima do bloco (não só na bolinha) também liga.
  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, state: { isValid?: boolean | null; fromNode?: { id: string } | null; fromHandle?: { id?: string | null; type?: string } | null }) => {
      if (state.isValid || !state.fromNode || !state.fromHandle?.id || state.fromHandle.type !== "source") return;
      const pt = "changedTouches" in event ? event.changedTouches[0] : event;
      const el = document.elementFromPoint(pt.clientX, pt.clientY)?.closest<HTMLElement>(".react-flow__node");
      const target = el?.dataset.id;
      if (target) link(state.fromNode.id, state.fromHandle.id, target);
    },
    [link]
  );

  /* ---------- arrastar da lista para o canvas ---------- */
  const onDrop = useCallback(
    (e: ReactDragEvent) => {
      const type = e.dataTransfer.getData("application/x-webgran-block") as NodeType;
      if (!type || !(type in NODE_TYPES)) return;
      e.preventDefault();
      addNode(type, rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }));
    },
    [addNode, rf]
  );

  /* ---------- atalhos ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editing || paletteOpen) return;
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName || "") || (e.target as HTMLElement)?.isContentEditable;
      if (typing) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (mod && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) { e.preventDefault(); redo(); }
      else if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        const s = nodes.find((n) => n.selected);
        if (s) duplicate(s.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, paletteOpen, undo, redo, duplicate, nodes]);

  /* ---------- visual das ligações ---------- */
  const styledEdges = useMemo(
    () =>
      edges.map((e) => {
        const k = String(e.sourceHandle);
        const color = e.selected ? ACCENT : isSuccessOutput(k) ? "rgba(52,211,153,0.7)" : isFailOutput(k) ? "rgba(248,113,113,0.65)" : "rgba(148,163,184,0.55)";
        return { ...e, style: { stroke: color, strokeWidth: e.selected ? 2.5 : 2 }, interactionWidth: 22 };
      }),
    [edges]
  );

  const ctx = useMemo<EditorCtx>(() => ({ order, products, locked, open, duplicate, remove }), [order, products, locked, open, duplicate, remove]);
  const checklist = graphChecklist(graph).map((c) => ({ ...c, onFix: undefined }));
  const editingNode = editing ? nodes.find((n) => n.id === editing.id) : null;
  const ctrlBtn = "w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors disabled:opacity-35 disabled:hover:bg-transparent";

  return (
    <div className="-mx-4 sm:-mx-6 md:-mx-7 lg:-mx-8 -mt-4 sm:-mt-5 -mb-6 md:-mb-8 flex flex-col h-[100dvh] min-h-[560px] overflow-hidden bg-[#0b0c0f]">
      <Toaster />
      <div className="shrink-0 px-4 sm:px-6 pt-4 bg-[var(--seller-bg,#0A0A0A)] [&>div:first-child]:pb-3.5">
        <EditorTopBar flowId={flowId} name={name} type="advanced" status={status} bots={bots} saveState={saveState} checklist={checklist} />
      </div>

      <div className="flex-1 min-h-0 flex">
        {/* Lista de blocos */}
        <aside aria-label="Blocos disponíveis" className="hidden lg:flex w-[272px] shrink-0 flex-col border-r border-white/[0.07] bg-[#0f1012] overflow-hidden">
          <PaletteHeader />
          <div className="flex-1 overflow-y-auto custom-scrollbar px-2.5 pb-3">
            <Palette onAdd={(t) => addNode(t)} />
          </div>
        </aside>

        {/* Canvas */}
        <div
          ref={canvasRef}
          className="relative flex-1 min-w-0 overflow-hidden bg-[#0b0c0f]"
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes("application/x-webgran-block")) {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
            }
          }}
          onDrop={onDrop}
        >
          <Ctx.Provider value={ctx}>
            <ReactFlow<BlockNode, Edge>
              nodes={nodes}
              edges={styledEdges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onConnectEnd={onConnectEnd as never}
              isValidConnection={isValidConnection}
              onNodeDragStart={() => { dragging.current = true; }}
              onNodeDragStop={() => { dragging.current = false; bump((n) => n + 1); }}
              onNodeClick={(_, n) => { if (!locked) open(n.id); }}
              nodesDraggable={!locked}
              nodesConnectable={!locked}
              connectionRadius={36}
              connectionLineStyle={{ stroke: ACCENT, strokeWidth: 2 }}
              deleteKeyCode={locked ? null : ["Delete", "Backspace"]}
              minZoom={0.25}
              maxZoom={1.75}
              fitView
              fitViewOptions={{ maxZoom: 1, padding: 0.3 }}
              proOptions={{ hideAttribution: true }}
              className="webgran-flow"
            >
              <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="rgba(255,255,255,0.09)" />

              <Panel position="top-left" className="!m-3 hidden sm:block">
                <span className="inline-flex items-center gap-2 h-8 px-3 rounded-[9px] border border-white/[0.07] bg-[#121316]/90 backdrop-blur text-[12px] text-[#8b8b94]">
                  Puxe da bolinha de um bloco até outro para ligar
                  <span className="w-px h-3.5 bg-white/[0.1]" />
                  <span className="tabular-nums">{nodes.length} blocos · {edges.length} ligações</span>
                </span>
              </Panel>

              <Panel position="bottom-left" className="!m-3 hidden sm:block">
                <div className="flex flex-col rounded-[10px] border border-white/[0.08] bg-[#121316] overflow-hidden divide-y divide-white/[0.06] shadow-[0_10px_24px_-12px_#000]">
                  <button type="button" aria-label="Aproximar" title="Aproximar" onClick={() => rf.zoomIn({ duration: 200 })} className={ctrlBtn}><Plus className="w-4 h-4" /></button>
                  <button type="button" aria-label="Afastar" title="Afastar" onClick={() => rf.zoomOut({ duration: 200 })} className={ctrlBtn}><Minus className="w-4 h-4" /></button>
                  <button type="button" aria-label="Enquadrar tudo" title="Enquadrar tudo" onClick={() => rf.fitView({ duration: 300, maxZoom: 1, padding: 0.3 })} className={ctrlBtn}><Maximize className="w-[15px] h-[15px]" /></button>
                  <button type="button" aria-pressed={locked} aria-label={locked ? "Destravar edição" : "Travar edição"} title={locked ? "Destravar" : "Travar (evita mover sem querer)"} onClick={() => setLocked((v) => !v)} className={`${ctrlBtn} ${locked ? "!text-[#60a5fa]" : ""}`}>
                    {locked ? <Lock className="w-[15px] h-[15px]" /> : <Unlock className="w-[15px] h-[15px]" />}
                  </button>
                </div>
              </Panel>

              <Panel position="bottom-center" className="!mb-3">
                <div className="flex items-center gap-0.5 p-1 rounded-[12px] border border-white/[0.08] bg-[#121316] shadow-[0_10px_24px_-12px_#000]">
                  <button type="button" aria-label="Desfazer" title="Desfazer (Ctrl+Z)" disabled={!canUndo} onClick={undo} className={`${ctrlBtn} rounded-[8px]`}><Undo2 className="w-4 h-4" /></button>
                  <button type="button" aria-label="Refazer" title="Refazer (Ctrl+Y)" disabled={!canRedo} onClick={redo} className={`${ctrlBtn} rounded-[8px]`}><Redo2 className="w-4 h-4" /></button>
                  <span className="w-px h-5 mx-1 bg-white/[0.08]" />
                  <button type="button" aria-label="Adicionar nota" title="Adicionar nota" disabled={locked} onClick={() => addNode("nota")} className={`${ctrlBtn} rounded-[8px] !text-amber-300/80 hover:!text-amber-200`}><StickyNote className="w-4 h-4" /></button>
                  <button type="button" aria-label="Centralizar" title="Centralizar" onClick={() => rf.fitView({ duration: 300, maxZoom: 1, padding: 0.3 })} className={`${ctrlBtn} rounded-[8px]`}><LocateFixed className="w-4 h-4" /></button>
                  <button type="button" disabled={locked} onClick={() => setPaletteOpen(true)} className="lg:hidden ml-1 inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] bg-[#3b82f6] text-white text-[12.5px] font-semibold disabled:opacity-40">
                    <Plus className="w-3.5 h-3.5" />Bloco
                  </button>
                </div>
              </Panel>

              <MiniMap
                position="bottom-right"
                pannable
                zoomable
                className="!m-3 !rounded-[12px] !overflow-hidden !border !border-white/[0.08] hidden sm:block"
                bgColor="#0f1013"
                maskColor="rgba(0,0,0,0.55)"
                nodeColor={(n) => { const ty = (n as BlockNode).data?.type; return ty ? def(ty).color : ACCENT; }}
                nodeBorderRadius={6}
                style={{ width: 172, height: 112 }}
              />
            </ReactFlow>
          </Ctx.Provider>
        </div>
      </div>

      {editing && editingNode && (
        <EditModal
          node={editingNode}
          draft={editing.draft}
          setDraft={(k, v) => setEditing((s) => (s ? { ...s, draft: { ...s.draft, [k]: v } } : s))}
          chats={chats}
          storeBots={storeBots}
          currentBotIds={bots.map((b) => b.id)}
          graph={graph}
          onClose={() => setEditing(null)}
          onSave={saveEdit}
        />
      )}

      {paletteOpen && (
        <Modal title="Adicionar bloco" subtitle="Toque num bloco para colocar no meio da tela." onClose={() => setPaletteOpen(false)}>
          <Palette onAdd={(t) => addNode(t)} compact />
        </Modal>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Lista de blocos                                                     */
/* ------------------------------------------------------------------ */
function PaletteHeader() {
  return (
    <div className="flex items-center gap-3 px-4 pt-4 pb-3.5 mb-1 border-b border-white/[0.06]">
      <span className="w-9 h-9 rounded-[10px] flex items-center justify-center bg-[#3b82f6]/[0.14] text-[#60a5fa] shrink-0">
        <LayoutList className="w-[18px] h-[18px]" />
      </span>
      <div className="min-w-0">
        <p className="text-[14px] font-semibold text-white">Blocos disponíveis</p>
        <p className="text-[12px] text-[#8b8b94]">Clique para adicionar ou arraste</p>
      </div>
    </div>
  );
}

function Palette({ onAdd, compact = false }: { onAdd: (t: NodeType) => void; compact?: boolean }) {
  return (
    <div className="flex flex-col">
      {PALETTE_CATEGORIES.map((cat) => (
        <div key={cat} className="mt-3 first:mt-2">
          <p className="px-1.5 pb-1.5 text-[11px] font-semibold tracking-[0.08em] uppercase text-[#8b8b94]">{cat}</p>
          <div className="flex flex-col gap-1.5">
            {(Object.entries(NODE_TYPES) as [NodeType, NodeTypeDef][])
              .filter(([, d]) => d.category === cat && !d.hidden)
              .map(([k, d]) => {
                const Icon = ICONS[k];
                return (
                  <div
                    key={k}
                    draggable={!compact}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/x-webgran-block", k);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    onClick={() => onAdd(k)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onAdd(k); } }}
                    aria-label={`Adicionar bloco ${d.label}`}
                    className="group flex items-center gap-3 px-2.5 py-2 rounded-[11px] border border-white/[0.06] bg-[#16171b] hover:bg-[#1b1c21] hover:border-white/[0.12] cursor-pointer active:cursor-grabbing transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6]/50"
                  >
                    <span className="w-8 h-8 rounded-[9px] flex items-center justify-center shrink-0" style={{ background: d.color + "1f", color: d.color }}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-medium text-white truncate">{d.label}</span>
                      <span className="block text-[11.5px] text-[#8b8b94] truncate">{d.desc}</span>
                    </span>
                    <span className="w-6 h-6 rounded-[7px] flex items-center justify-center text-zinc-500 border border-white/[0.08] group-hover:text-white group-hover:border-white/[0.2] shrink-0 transition-colors">
                      <Plus className="w-3.5 h-3.5" />
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Janela de edição do bloco                                           */
/* ------------------------------------------------------------------ */
function EditModal({
  node,
  draft,
  setDraft,
  chats,
  storeBots,
  currentBotIds,
  graph,
  onClose,
  onSave,
}: {
  node: BlockNode;
  draft: Values;
  setDraft: (key: string, value: string | number) => void;
  chats: FlowChat[];
  storeBots: { id: string; username: string; displayName?: string | null }[];
  currentBotIds: string[];
  graph: FlowGraph;
  onClose: () => void;
  onSave: () => void;
}) {
  const type = node.data.type;
  const d = def(type);
  const outs = nodeOutputs({ type, data: draft });

  const WIDE: NodeType[] = ["mensagem", "texto", "imagem", "video", "audio", "arquivo", "condicao", "fakecall"];

  return (
    <BlockModal title={d.label} subtitle={d.desc} color={d.color} icon={ICONS[type]} wide={WIDE.includes(type)} onClose={onClose} onSave={onSave}>
      <BlockForm type={type} draft={draft} set={setDraft} chats={chats} storeBots={storeBots} currentBotIds={currentBotIds} />

        {outs.length > 0 && (
          <section className="flex flex-col gap-2">
            <span className="text-[14px] font-semibold text-white">Saídas</span>
            <div className="rounded-[12px] border border-white/[0.08] bg-[#121316] divide-y divide-white/[0.06]">
              {outs.map(([k, l]) => {
                const e = graph.edges.find((x) => x.from === node.id && x.out === k);
                const t = e && graph.nodes.find((n) => n.id === e.to);
                return (
                  <div key={k} className="flex justify-between gap-3 px-3 py-2 text-[12.5px]">
                    <span className={isSuccessOutput(k) ? "text-emerald-400" : isFailOutput(k) ? "text-red-400" : "text-zinc-300"}>{l || "Próximo passo"}</span>
                    <span className="text-[#8b8b94] truncate">{t ? "→ " + def(t.type).label : "sem ligação"}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}
    </BlockModal>
  );
}

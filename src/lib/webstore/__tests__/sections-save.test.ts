import { beforeEach, describe, expect, it, vi } from "vitest";

// Banco simulado: guarda as linhas da vitrine e pode recusar a seção "vip" (como antes da migration 0033).
const state = vi.hoisted(() => ({ rows: [] as { id: string; kind: string }[], rejectVip: true, seq: 0 }));

vi.mock("@/db", () => {
  const select = () => ({ from: () => ({ where: async () => state.rows.map((r) => ({ id: r.id })) }) });
  const insert = () => ({
    values: (vals: { kind: string }[]) => ({
      returning: async () => {
        if (state.rejectVip && vals.some((v) => v.kind === "vip")) {
          throw Object.assign(new Error('new row for relation "web_store_sections" violates check constraint "web_store_sections_kind_check"'), { code: "23514" });
        }
        const added = vals.map((v) => ({ id: `n${++state.seq}`, kind: v.kind }));
        state.rows.push(...added);
        return added.map((a) => ({ id: a.id }));
      },
    }),
  });
  const del = () => ({
    where: async () => {
      // remove as linhas antigas (as que não vieram desta gravação)
      state.rows = state.rows.filter((r) => r.id.startsWith("n") && Number(r.id.slice(1)) > state.seq - 100 && !r.id.startsWith("old"));
    },
  });
  return { db: { select, insert, delete: del } };
});

import { defaultSections, saveSections } from "../sections";

describe("saveSections", () => {
  beforeEach(() => {
    state.rows = [
      { id: "old1", kind: "hero" },
      { id: "old2", kind: "carousel" },
    ];
    state.seq = 0;
  });

  it("não apaga a vitrine atual quando a gravação falha por outro motivo", async () => {
    state.rejectVip = true;
    const bad = defaultSections().filter((s) => s.kind !== "vip");
    // força erro diferente: produto inválido não importa; simulamos falha geral trocando o insert
    const { db } = await import("@/db");
    const orig = db.insert;
    (db as unknown as { insert: unknown }).insert = () => ({ values: () => ({ returning: async () => { throw new Error("falha de rede"); } }) });
    await expect(saveSections("s1", bad, new Set())).rejects.toThrow("falha de rede");
    (db as unknown as { insert: unknown }).insert = orig;
    expect(state.rows.map((r) => r.id)).toEqual(["old1", "old2"]);
  });

  it("sem a migration 0033: salva o resto sem a seção VIP e avisa", async () => {
    state.rejectVip = true;
    const r = await saveSections("s1", defaultSections(), new Set());
    expect(r.vipSaved).toBe(false);
    expect(state.rows.some((x) => x.kind === "vip")).toBe(false);
    expect(state.rows.some((x) => x.id.startsWith("old"))).toBe(false);
    expect(state.rows.length).toBe(defaultSections().length - 1);
  });

  it("com a migration 0033: salva a seção VIP na posição escolhida", async () => {
    state.rejectVip = false;
    const r = await saveSections("s1", defaultSections(), new Set());
    expect(r.vipSaved).toBe(true);
    expect(state.rows.map((x) => x.kind)).toEqual(defaultSections().map((s) => s.kind));
  });
});

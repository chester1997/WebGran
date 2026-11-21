import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import RecebimentosClientV2 from "../RecebimentosClientV2";

const html = (props: Partial<React.ComponentProps<typeof RecebimentosClientV2>> = {}) =>
  renderToStaticMarkup(<RecebimentosClientV2 connection={null} {...props} />);

describe("RecebimentosClientV2", () => {
  it("lists the four gateways with what each accepts", () => {
    const out = html();
    for (const name of ["Pushin Pay", "SyncPay", "Mercado Pago", "MisticPay"]) expect(out).toContain(name);
    expect(out).toContain("ACEITA");
    expect(out).toContain("Cartão de crédito");
    expect(out).toContain("Boleto");
  });

  it("shows SyncPay and MisticPay as em breve, the others connectable", () => {
    const out = html();
    expect(out.match(/Em breve/g)).toHaveLength(2);
    expect(out.match(/Integração em construção\./g)).toHaveLength(2);
    expect(out.match(/>Conectar</g)?.length ?? out.match(/Conectar<\/button>/g)?.length).toBe(2);
  });

  it("shows the connected state with test and disconnect", () => {
    const out = html({ pushinPayConnection: { id: "x", status: "active", updatedAt: null } });
    expect(out).toContain("Conectado");
    expect(out).toContain("Testar conexão");
    expect(out).toContain("Desconectar Pushin Pay");
  });
});

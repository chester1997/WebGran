import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import SalesVolumeCardV2 from "../SalesVolumeCardV2";
import { PLAQUES, plaqueProgress } from "@/lib/rewards/plaques";
import { validateRedemptionForm } from "@/lib/rewards/validate";

describe("placas de faturamento", () => {
  it("tem 5 placas em ordem crescente", () => {
    expect(PLAQUES.map((p) => p.short)).toEqual(["50K", "250K", "500K", "1M", "1,5M"]);
  });

  it("calcula próxima placa, nível atual e conquistas", () => {
    expect(plaqueProgress(45.5)).toMatchObject({ allReached: false, current: null, reachedCount: 0 });
    expect(plaqueProgress(45.5).next.short).toBe("50K");
    const p = plaqueProgress(312_400);
    expect(p.next.short).toBe("500K");
    expect(p.current?.level).toBe("Prata");
    expect(p.reachedCount).toBe(2);
    expect(plaqueProgress(2_000_000)).toMatchObject({ allReached: true, reachedCount: 5 });
  });
});

describe("SalesVolumeCardV2", () => {
  it("mostra a próxima placa, quanto falta e leva às premiações", () => {
    const html = renderToStaticMarkup(<SalesVolumeCardV2 totalRevenue={312400} />);
    expect(html).toContain("Próxima: 500K");
    expect(html).toContain("62%");
    expect(html).toContain("187.600,00");
    expect(html).toContain('href="/seller/premiacoes"');
    expect(html).toContain("#e0b24a"); // dourado
  });

  it("usa bronze na de 50K e prata na de 250K", () => {
    expect(renderToStaticMarkup(<SalesVolumeCardV2 totalRevenue={45.5} />)).toContain("#cd7f45");
    expect(renderToStaticMarkup(<SalesVolumeCardV2 totalRevenue={60000} />)).toContain("Próxima: 250K");
  });
});

describe("validateRedemptionForm", () => {
  const base = {
    fullName: "Fulano de Tal",
    phone: "(11) 99999-0000",
    zipCode: "01310-100",
    street: "Av. Paulista",
    number: "1000",
    district: "Bela Vista",
    city: "São Paulo",
    state: "sp",
  };
  const fd = (over: Record<string, string> = {}) => {
    const f = new FormData();
    Object.entries({ ...base, ...over }).forEach(([k, v]) => f.set(k, v));
    return f;
  };

  it("aceita dados completos e normaliza CEP, telefone e UF", () => {
    const r = validateRedemptionForm(fd());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toMatchObject({ zipCode: "01310100", phone: "11999990000", state: "SP", complement: null });
  });

  it("recusa CEP, telefone ou UF inválidos", () => {
    expect(validateRedemptionForm(fd({ zipCode: "123" })).ok).toBe(false);
    expect(validateRedemptionForm(fd({ phone: "9999" })).ok).toBe(false);
    expect(validateRedemptionForm(fd({ state: "XX" })).ok).toBe(false);
  });
});

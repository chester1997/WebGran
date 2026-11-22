import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import SalesVolumeCardV2, { formatPlaqueShort, nextPlaque } from "../SalesVolumeCardV2";

describe("SalesVolumeCardV2 (placas)", () => {
  it("escolhe a próxima placa não alcançada", () => {
    expect(nextPlaque(45.5)).toEqual({ goal: 50_000, allReached: false });
    expect(nextPlaque(312_400)).toEqual({ goal: 500_000, allReached: false });
    expect(nextPlaque(1_004_210)).toEqual({ goal: 1_500_000, allReached: false });
    expect(nextPlaque(2_000_000)).toEqual({ goal: 1_500_000, allReached: true });
  });

  it("formata os selos curtos", () => {
    expect(formatPlaqueShort(50_000)).toBe("50K");
    expect(formatPlaqueShort(500_000)).toBe("500K");
    expect(formatPlaqueShort(1_500_000)).toBe("1,5M");
  });

  it("renderiza valor, próxima placa e quanto falta", () => {
    const html = renderToStaticMarkup(<SalesVolumeCardV2 totalRevenue={312400} />);
    expect(html).toContain("Próxima: 500K");
    expect(html).toContain("62%");
    expect(html).toContain("da placa de");
    expect(html).toContain("Faltam");
    expect(html).toContain("187.600,00");
    expect(html).toContain("Ver premiações");
    expect(html).not.toMatch(/emerald|#10b981/);
    expect(html).toContain("#e0b24a"); // dourado na placa de 500K
  });

  it("usa bronze na placa de 50K e azul na de 1,5M", () => {
    expect(renderToStaticMarkup(<SalesVolumeCardV2 totalRevenue={45.5} />)).toContain("#cd7f45");
    expect(renderToStaticMarkup(<SalesVolumeCardV2 totalRevenue={1004210} />)).toContain("59,130,246");
  });
});

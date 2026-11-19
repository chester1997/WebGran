import { describe, it, expect } from "vitest";
import { formatAxisValue, describeChange, describeSplitStatus } from "../AdminDashboardClientV2";
import { isOwnerUser, OWNER_EMAIL, OWNER_USER_ID } from "@/lib/bots/owner-guard";

describe("Dashboard admin V2", () => {
  it("eixo do gráfico não repete rótulos para valores diferentes (antes 1.500 e 2.000 viravam 'R$2k')", () => {
    expect(formatAxisValue(1500, true)).toBe("R$ 1,5 mil");
    expect(formatAxisValue(2000, true)).toBe("R$ 2 mil");
    expect(formatAxisValue(952.4, true)).toBe("R$ 952");
    expect(formatAxisValue(12500, true)).toBe("R$ 13 mil");
    expect(formatAxisValue(340, false)).toBe("340");
  });

  it("comparação com o período anterior não mostra '+999%'", () => {
    expect(describeChange(null).text).toBe("Sem período anterior para comparar");
    expect(describeChange(9999).text).toBe("Muito acima do período anterior");
    expect(describeChange(12.5)).toEqual({ text: "+12,5% vs período anterior", tone: "up" });
    expect(describeChange(-8).tone).toBe("down");
  });

  it("situação do split segue os mesmos grupos do serviço", () => {
    for (const st of ["PROCESSED", "CONFIRMED", "GATEWAY_ACCEPTED"]) {
      expect(describeSplitStatus(st).label).toBe("Taxa processada");
    }
    expect(describeSplitStatus("SETTLED").label).toBe("Na conta");
    expect(describeSplitStatus("SKIPPED").label).toBe("Isenta");
    expect(describeSplitStatus("FAILED").label).toBe("Falha no split");
    expect(describeSplitStatus(null).label).toBe("Split pendente");
  });

  it("só a conta proprietária recebe a V2", () => {
    expect(isOwnerUser({ id: OWNER_USER_ID, email: null })).toBe(true);
    expect(isOwnerUser({ id: "x", email: OWNER_EMAIL })).toBe(true);
    expect(isOwnerUser({ id: "admin-2", email: "outro.admin@exemplo.com" })).toBe(false);
  });
});

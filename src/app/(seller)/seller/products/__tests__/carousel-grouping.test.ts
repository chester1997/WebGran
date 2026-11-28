import { describe, it, expect } from "vitest";
import { carouselsForBots, isCarouselSelected, toggleCarouselSelection, expandCarouselSelection } from "../ProductCarouselsPicker";

const list = [
  { id: "a1", name: "LANÇAMENTO", botId: "A" },
  { id: "b1", name: "Lançamento ", botId: "B" },
  { id: "c1", name: "LANÇAMENTO", botId: "C" },
  { id: "a2", name: "DUBLADAS", botId: "A" },
  { id: "x1", name: "", botId: "A" },
  { id: "x2", name: "", botId: "B" },
];

describe("carrosséis com o mesmo nome em bots diferentes", () => {
  it("aparecem uma vez só, com os ids de cada bot", () => {
    const opts = carouselsForBots(list, "ALL_BOTS", []);
    expect(opts.map((o) => o.name)).toEqual(["LANÇAMENTO", "DUBLADAS", "", ""]);
    expect(opts[0].memberIds).toEqual(["a1", "b1", "c1"]);
  });

  it("produto de bot específico só junta os carrosséis dos bots dele", () => {
    const opts = carouselsForBots(list, "BOT_SPECIFIC", ["A", "B"]);
    expect(opts[0].memberIds).toEqual(["a1", "b1"]);
  });

  it("marcar e desmarcar vale para todos os bots", () => {
    const [lanc] = carouselsForBots(list, "ALL_BOTS", []);
    expect(isCarouselSelected(lanc, ["b1"])).toBe(true);
    expect(toggleCarouselSelection(lanc, [])).toEqual(["a1", "b1", "c1"]);
    expect(toggleCarouselSelection(lanc, ["b1", "a2"])).toEqual(["a2"]);
  });

  it("ao salvar, opção marcada entra em todos os bots do produto", () => {
    const opts = carouselsForBots(list, "ALL_BOTS", []);
    expect(expandCarouselSelection(opts, ["c1"]).sort()).toEqual(["a1", "b1", "c1"]);
  });
});

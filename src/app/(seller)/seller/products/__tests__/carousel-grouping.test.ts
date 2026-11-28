import { describe, it, expect } from "vitest";
import { carouselsForBots, carouselsByBot, toggleCarouselSelection, expandCarouselSelection } from "../ProductCarouselsPicker";

const list = [
  { id: "a1", name: "LANÇAMENTO", botId: "A", botLabel: "botA" },
  { id: "b1", name: "LANÇAMENTO", botId: "B", botLabel: "botB" },
  { id: "c1", name: "LANÇAMENTO", botId: "C", botLabel: "botC" },
  { id: "a2", name: "DUBLADAS", botId: "A", botLabel: "botA" },
];

describe("carrosséis no cadastro do produto: escolha separada por bot", () => {
  it("cada bot mostra os seus carrosséis, sem juntar pelo nome", () => {
    const groups = carouselsByBot(carouselsForBots(list, "ALL_BOTS", []));
    expect(groups.map((g) => g.label)).toEqual(["@botA", "@botB", "@botC"]);
    expect(groups[0].items.map((c) => c.id)).toEqual(["a1", "a2"]);
  });

  it("produto de bot específico só vê os carrosséis dos bots dele", () => {
    const opts = carouselsForBots(list, "BOT_SPECIFIC", ["A", "B"]);
    expect(opts.map((c) => c.id)).toEqual(["a1", "b1", "a2"]);
  });

  it("marcar LANÇAMENTO de um bot não marca o dos outros", () => {
    const opts = carouselsForBots(list, "ALL_BOTS", []);
    const sel = toggleCarouselSelection(opts[0], []);
    expect(sel).toEqual(["a1"]);
    expect(expandCarouselSelection(opts, sel)).toEqual(["a1"]);
  });
});

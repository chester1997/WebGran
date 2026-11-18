import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("../actions", () => ({
  updateFloatingSettingsAction: vi.fn(),
  toggleFloatingNotificationAction: vi.fn(),
  deleteFloatingNotificationAction: vi.fn(),
  reorderFloatingNotificationsAction: vi.fn(),
  seedDefaultFloatingNotificationsAction: vi.fn(),
  saveFloatingNotificationAction: vi.fn(),
}));

import NotificationsClientV2, { getNotificationStatusLabel } from "../NotificationsClientV2";

const SETTINGS = {
  floatingNotificationsEnabled: false,
  floatingNotificationsPages: ["home", "product"],
  floatingNotificationsDisplayDuration: 5,
  floatingNotificationsIntervalMin: 15,
  floatingNotificationsIntervalMax: 30,
};

const ITEMS = [
  { id: "n1", storeId: "s1", productId: "p1", text: "Título em destaque", icon: "🔥", enabled: true, position: 0, countMin: null, countMax: null, product: { id: "p1", title: "O segredo do professor" } },
  { id: "n2", storeId: "s1", productId: null, text: "{count} pessoas comprando", icon: "👀", enabled: false, position: 1, countMin: 5, countMax: 18, product: null },
];

describe("Notificações V2", () => {
  it("situação da mensagem considera o interruptor geral", () => {
    expect(getNotificationStatusLabel(true, true).label).toBe("Aparecendo");
    expect(getNotificationStatusLabel(true, false).label).toBe("Pronta · pausada");
    expect(getNotificationStatusLabel(false, true).label).toBe("Desligada");
  });

  it("com o geral desligado, avisa em destaque e não mostra mensagem como ativa", () => {
    const html = renderToStaticMarkup(
      <NotificationsClientV2 initialSettings={SETTINGS} notifications={ITEMS} products={[]} hideHeader />
    );
    expect(html).toContain("Desligadas na vitrine");
    expect(html).toContain("Ligar notificações");
    expect(html).toContain("1 mensagem está pronta");
    expect(html).toContain("Pronta · pausada");
    expect(html).not.toContain("Aparecendo");
    expect(html).toContain("Leva para: O segredo do professor");
    expect(html).toContain("Vale para toda a loja");
  });

  it("com o geral ligado, resume onde as mensagens aparecem", () => {
    const html = renderToStaticMarkup(
      <NotificationsClientV2
        initialSettings={{ ...SETTINGS, floatingNotificationsEnabled: true }}
        notifications={ITEMS}
        products={[]}
      />
    );
    expect(html).toContain("Ligadas na vitrine");
    expect(html).toContain("Página inicial, Página de produto");
    expect(html).toContain("Aparecendo");
  });

  it("sem mensagens, oferece os modelos prontos", () => {
    const html = renderToStaticMarkup(
      <NotificationsClientV2 initialSettings={SETTINGS} notifications={[]} products={[]} />
    );
    expect(html).toContain("Crie sua primeira mensagem");
    expect(html).toContain("Usar modelos prontos");
  });
});

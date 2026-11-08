import { describe, it, expect } from "vitest";
import {
  buildPlatformCommissionPayload,
  buildSaleNotificationPayload,
  formatNotificationBRL,
  WEBGRAN_CANONICAL_DOMAIN,
  WEBGRAN_NOTIFICATION_BRAND,
} from "../notification-payload-builder";

describe("WebGran — Alteração Exclusiva dos Textos das Notificações de Comissão", () => {
  it("1. Gera exatamente o novo título '💰 Taxas Recebidas!'", () => {
    const payload = buildPlatformCommissionPayload({
      orderId: "ord-1",
      feeReais: 0.50,
      eventType: "SPLIT_PROCESSED",
    });

    expect(payload.title).toBe("💰 Taxas Recebidas!");
  });

  it("2. Gera o corpo dinâmico com formatação monetária brasileira 'Taxa de R$ X,XX recebida!'", () => {
    const testCases = [
      { fee: 0.50, expected: "Taxa de R$ 0,50 recebida!" },
      { fee: 1.25, expected: "Taxa de R$ 1,25 recebida!" },
      { fee: 10.00, expected: "Taxa de R$ 10,00 recebida!" },
      { fee: "0.50", expected: "Taxa de R$ 0,50 recebida!" },
      { fee: 150.75, expected: "Taxa de R$ 150,75 recebida!" },
    ];

    for (const { fee, expected } of testCases) {
      const payload = buildPlatformCommissionPayload({
        orderId: `ord-${fee}`,
        feeReais: fee,
        eventType: "SPLIT_PROCESSED",
      });

      expect(payload.body).toBe(expected);
      expect(payload.title).toBe("💰 Taxas Recebidas!");
    }
  });

  it("3. Garante consistência em todos os fluxos de eventos (SPLIT_PROCESSED, COMMISSION_CONFIRMED, COMMISSION_SETTLED)", () => {
    const events = ["SPLIT_PROCESSED", "COMMISSION_CONFIRMED", "COMMISSION_SETTLED", "CUSTOM_FLOW"];

    for (const eventType of events) {
      const payload = buildPlatformCommissionPayload({
        orderId: `ord-${eventType}`,
        feeReais: 0.50,
        eventType,
      });

      expect(payload.title).toBe("💰 Taxas Recebidas!");
      expect(payload.body).toBe("Taxa de R$ 0,50 recebida!");
    }
  });

  it("4. Preserva integralmente a identificação de domínio canônico 'www.webgran.online'", () => {
    expect(WEBGRAN_CANONICAL_DOMAIN).toBe("https://www.webgran.online");
    expect(WEBGRAN_NOTIFICATION_BRAND.canonicalOrigin).toBe("https://www.webgran.online");
    expect(WEBGRAN_NOTIFICATION_BRAND.canonicalIcon).toContain("www.webgran.online");
    expect(WEBGRAN_NOTIFICATION_BRAND.canonicalBadge).toContain("www.webgran.online");
  });

  it("5. Preserva integralmente os assets de ícone e badge sem alteração", () => {
    const payload = buildPlatformCommissionPayload({
      orderId: "ord-assets-check",
      feeReais: 0.50,
      eventType: "SPLIT_PROCESSED",
    });

    expect(payload.icon).toBe(WEBGRAN_NOTIFICATION_BRAND.defaultIcon);
    expect(payload.badge).toBe(WEBGRAN_NOTIFICATION_BRAND.defaultBadge);
    expect(payload.icon).toBe("/icons/icon-192x192.png");
    expect(payload.badge).toBe("/icons/badge-72x72.png");
  });

  it("6. Não modifica notificações de outras categorias (ex: Nova Venda)", () => {
    const salePayload = buildSaleNotificationPayload({
      orderId: "ord-sale-check",
      amount: 49.90,
      itemTitle: "Curso Completo",
    });

    expect(salePayload.title).toBe("🛒 Nova venda no WebGran");
    expect(salePayload.body).toBe("Você recebeu R$ 49,90");
  });
});


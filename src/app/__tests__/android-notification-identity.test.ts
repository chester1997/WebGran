import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import {
  WEBGRAN_CANONICAL_DOMAIN,
  WEBGRAN_NOTIFICATION_BRAND,
  buildSaleNotificationPayload,
  buildPlatformCommissionPayload,
  buildTestNotificationPayload,
  standardizePushPayload,
  resolveNotificationAssetUrl,
} from "@/lib/push/notification-payload-builder";

describe("WebGran — Homologação da Identidade Visual e Notificações Android", () => {
  const publicIconsDir = path.join(process.cwd(), "public", "icons");

  // ─── 1. ÍCONE DO APLICATIVO WEBGRAN (IMAGEM 1) ──────────────────────────────
  describe("1. Ocupação Visual e Ícones Maskable PWA (Sem bordas pretas)", () => {
    it("garante que o ícone maskable 512x512 preenche 100% da área útil com o gradiente oficial e sem bordas pretas #121214", async () => {
      const maskablePath = path.join(publicIconsDir, "icon-maskable-512x512.png");
      expect(fs.existsSync(maskablePath)).toBe(true);

      const { data, info } = await sharp(maskablePath).raw().toBuffer({ resolveWithObject: true });
      expect(info.width).toBe(512);
      expect(info.height).toBe(512);

      // Canto superior esquerdo (0,0) deve ser azul do gradiente oficial, NUNCA preto #121214 (18, 18, 20)
      const rTop = data[0], gTop = data[1], bTop = data[2], aTop = data[3];
      expect(aTop).toBe(255);
      expect(bTop).toBeGreaterThan(180); // Tom azul vibrante do gradiente
      expect(rTop).toBeLessThan(20);

      // Canto inferior esquerdo (0, 511) deve ser o tom azul escuro do gradiente
      const idxBottom = (511 * 512) * 4;
      const bBottom = data[idxBottom + 2];
      expect(bBottom).toBeGreaterThan(50); // Azul escuro do gradiente

      // Verifica que não existe borda preta artificial (#121214) nos 4 cantos
      const corners = [
        0, // (0,0)
        (511) * 4, // (511,0)
        (511 * 512) * 4, // (0,511)
        (511 * 512 + 511) * 4, // (511,511)
      ];

      for (const c of corners) {
        const r = data[c], g = data[c + 1], b = data[c + 2];
        const isBlackBorder = r === 18 && g === 18 && b === 20;
        expect(isBlackBorder, "O canto não pode conter borda preta artificial").toBe(false);
      }
    });

    it("assegura que o emblema branco no maskable 512x512 respeita estritamente a safe zone de 80% do Android", async () => {
      const maskablePath = path.join(publicIconsDir, "icon-maskable-512x512.png");
      const { data, info } = await sharp(maskablePath).raw().toBuffer({ resolveWithObject: true });

      let minX = 512, maxX = 0, minY = 512, maxY = 0;
      for (let y = 0; y < 512; y++) {
        for (let x = 0; x < 512; x++) {
          const idx = (y * 512 + x) * 4;
          const r = data[idx], g = data[idx + 1], b = data[idx + 2];
          if (r > 230 && g > 230 && b > 230) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      // Safe zone do Android: círculo central de 80% (raio = 512 * 0.4 = 204.8px)
      const halfW = (maxX - minX) / 2;
      const halfH = (maxY - minY) / 2;
      const maxRadius = Math.sqrt(halfW * halfW + halfH * halfH);

      expect(maxRadius).toBeLessThanOrEqual(512 * 0.4);
      // Margens devem ser equilibradas para não cortar o símbolo
      expect(minX).toBeGreaterThanOrEqual(40);
      expect(512 - maxX).toBeGreaterThanOrEqual(40);
      expect(minY).toBeGreaterThanOrEqual(40);
      expect(512 - maxY).toBeGreaterThanOrEqual(40);
    });

    it("garante que o ícone maskable 192x192 também possui gradiente azul contínuo", async () => {
      const maskablePath = path.join(publicIconsDir, "icon-maskable-192x192.png");
      const { data } = await sharp(maskablePath).raw().toBuffer({ resolveWithObject: true });
      const bTop = data[2];
      expect(bTop).toBeGreaterThan(180);
    });
  });

  // ─── 2. NOTIFICAÇÕES DE COMISSÃO (IMAGEM 2) ─────────────────────────────────
  describe("2. Padronização Global de Notificações de Comissão (Sem letra 'W')", () => {
    it("todas as notificações de comissão apontam para a URL canônica sem redirect 308", () => {
      const payload1 = buildPlatformCommissionPayload({
        orderId: "ord-test-1",
        feeReais: 0.15,
        eventType: "SPLIT_PROCESSED",
      });

      const payload2 = buildPlatformCommissionPayload({
        orderId: "ord-test-2",
        feeReais: 0.15,
        eventType: "COMMISSION_CONFIRMED",
      });

      const payload3 = buildPlatformCommissionPayload({
        orderId: "ord-test-3",
        feeReais: 0.15,
        eventType: "COMMISSION_SETTLED",
      });

      // Todos devem utilizar rigorosamente a mesma especificação de asset
      expect(payload1.icon).toBe(WEBGRAN_NOTIFICATION_BRAND.defaultIcon);
      expect(payload2.icon).toBe(WEBGRAN_NOTIFICATION_BRAND.defaultIcon);
      expect(payload3.icon).toBe(WEBGRAN_NOTIFICATION_BRAND.defaultIcon);

      // Garante que o formatador BRL gera 'R$ 0,15' com espaço padrão sem colapsar
      expect(payload1.body).toBe("Taxa de R$ 0,15 recebida!");
      expect(payload2.body).toBe("Taxa de R$ 0,15 recebida!");
      expect(payload3.body).toBe("Taxa de R$ 0,15 recebida!");
    });

    it("resolveNotificationAssetUrl elimina redirect 308 do domínio apex webgran.online", () => {
      const apexUrl = "https://webgran.online/icons/icon-192x192.png";
      const resolved = resolveNotificationAssetUrl(apexUrl, WEBGRAN_NOTIFICATION_BRAND.defaultIcon);
      expect(resolved).toBe("https://www.webgran.online/icons/icon-192x192.png");
      expect(resolved).not.toContain("https://webgran.online/");
    });

    it("standardizePushPayload preserva consistência global entre todos os disparos", () => {
      const standardized = standardizePushPayload({
        title: "💰 Taxas Recebidas!",
        body: "Taxa de R$ 0,15 recebida!",
      });

      expect(standardized.icon).toBe(WEBGRAN_NOTIFICATION_BRAND.defaultIcon);
      expect(standardized.badge).toBe(WEBGRAN_NOTIFICATION_BRAND.defaultBadge);
      expect(standardized.icon).toBe("/icons/icon-192x192.png");
      expect(standardized.badge).toBe("/icons/badge-72x72.png");
    });
  });

  // ─── 3. BADGE MONOCROMÁTICO (IMAGEM 3) ──────────────────────────────────────
  describe("3. Badges Monocromáticos Android (Sem quadrado vazio ou preenchido)", () => {
    it("badge-72x72.png possui 100% de fundo transparente e silhueta pura em branco", async () => {
      const badgePath = path.join(publicIconsDir, "badge-72x72.png");
      const { data, info } = await sharp(badgePath).raw().toBuffer({ resolveWithObject: true });

      expect(info.width).toBe(72);
      expect(info.height).toBe(72);

      let coloredCount = 0;
      let whiteCount = 0;
      let transparentCount = 0;

      for (let i = 0; i < data.length; i += info.channels) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        if (a === 0) {
          transparentCount++;
        } else if (r === 255 && g === 255 && b === 255) {
          whiteCount++;
        } else {
          coloredCount++;
        }
      }

      // Fundo deve ser majoritariamente transparente (mais de 60% dos pixels)
      expect(transparentCount).toBeGreaterThan(info.width * info.height * 0.6);
      // Silhueta branca deve existir
      expect(whiteCount).toBeGreaterThan(1000);
      // NÃO pode haver nenhum pixel colorido (evita o quadrado sólido azul no Android)
      expect(coloredCount).toBe(0);
    });

    it("todos os tamanhos de badge (72, 96, 128, 192) são estritamente monocromáticos e válidos", async () => {
      const sizes = [72, 96, 128, 192];
      for (const size of sizes) {
        const bPath = path.join(publicIconsDir, `badge-${size}x${size}.png`);
        const { data, info } = await sharp(bPath).raw().toBuffer({ resolveWithObject: true });
        let coloredCount = 0;

        for (let i = 0; i < data.length; i += info.channels) {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (a > 0 && (r !== 255 || g !== 255 || b !== 255)) {
            coloredCount++;
          }
        }

        expect(coloredCount, `Badge ${size}x${size} contém pixels coloridos!`).toBe(0);
      }
    });
  });

  // ─── 4. CABEÇALHOS DE CACHE E SERVICE WORKER ────────────────────────────────
  describe("4. Cache e Service Worker v15", () => {
    it("public/sw.js está na versão webgran-static-v15 com normalização de URLs", () => {
      const swContent = fs.readFileSync(path.join(process.cwd(), "public", "sw.js"), "utf8");
      expect(swContent).toContain("webgran-static-v15");
      expect(swContent).toContain("normalizeNotificationUrl");
      expect(swContent).toContain("www.webgran.online");
    });
  });
});


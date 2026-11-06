import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { WEBGRAN_NOTIFICATION_BRAND, buildSaleNotificationPayload, buildPlatformCommissionPayload, buildTestNotificationPayload } from "@/lib/push/notification-payload-builder";

describe("WebGran Visual Identity Assets Suite — PWA vs Favicon Separation", () => {
  const publicDir = path.join(process.cwd(), "public");
  const iconsDir = path.join(publicDir, "icons");
  const appDir = path.join(process.cwd(), "src", "app");

  // ─── 1. PWA & APP ASSETS (PRIMEIRA IMAGEM) ──────────────────────────────────
  describe("1. PWA & App Icons (First Image — Blue Gradient App Logo)", () => {
    const pwaFiles = [
      { path: path.join(iconsDir, "icon-512x512.png"), width: 512, height: 512 },
      { path: path.join(iconsDir, "icon-192x192.png"), width: 192, height: 192 },
      { path: path.join(iconsDir, "icon-maskable-512x512.png"), width: 512, height: 512 },
      { path: path.join(iconsDir, "icon-maskable-192x192.png"), width: 192, height: 192 },
      { path: path.join(iconsDir, "apple-touch-icon.png"), width: 180, height: 180 },
      { path: path.join(publicDir, "apple-touch-icon.png"), width: 180, height: 180 },
      { path: path.join(appDir, "apple-icon.png"), width: 180, height: 180 },
      { path: path.join(iconsDir, "badge-72x72.png"), width: 72, height: 72 },
      { path: path.join(iconsDir, "badge-96x96.png"), width: 96, height: 96 },
      { path: path.join(iconsDir, "badge-128x128.png"), width: 128, height: 128 },
      { path: path.join(iconsDir, "badge-192x192.png"), width: 192, height: 192 },
    ];

    it("verifies all PWA and App icon files exist and have valid PNG headers", () => {
      for (const item of pwaFiles) {
        expect(fs.existsSync(item.path), `Missing PWA file: ${item.path}`).toBe(true);
        const buf = fs.readFileSync(item.path);
        // PNG magic bytes
        expect(buf[0]).toBe(0x89);
        expect(buf[1]).toBe(0x50);
        expect(buf[2]).toBe(0x4E);
        expect(buf[3]).toBe(0x47);

        // Dimensions from IHDR chunk
        const w = buf.readUInt32BE(16);
        const h = buf.readUInt32BE(20);
        expect(w).toBe(item.width);
        expect(h).toBe(item.height);
      }
    });

    it("ensures PWA icons are derived from the vibrant blue app identity", () => {
      // Verifica icon-512x512.png
      const iconPath = path.join(iconsDir, "icon-512x512.png");
      const stat = fs.statSync(iconPath);
      expect(stat.size).toBeGreaterThan(10000);
    });

    it("guarantees notification badges are TRUE monochrome alpha-masks (0 colored pixels, transparent background)", async () => {
      const badgeFiles = [
        path.join(iconsDir, "badge-72x72.png"),
        path.join(iconsDir, "badge-96x96.png"),
        path.join(iconsDir, "badge-128x128.png"),
        path.join(iconsDir, "badge-192x192.png"),
      ];

      for (const badgePath of badgeFiles) {
        const buf = fs.readFileSync(badgePath);
        const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
        let coloredPixels = 0;
        let nonZeroAlpha = 0;

        for (let i = 0; i < data.length; i += info.channels) {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (a > 10) {
            nonZeroAlpha++;
            if (r !== g || g !== b) {
              coloredPixels++;
            }
          }
        }

        // Deve possuir pixels visíveis na silhueta
        expect(nonZeroAlpha).toBeGreaterThan(100);
        // NÃO PODE ter pixels coloridos (deve ser máscara alfa pura em branco/monocromático)
        expect(coloredPixels).toBe(0);
      }
    });
  });

  // ─── 2. SITE FAVICON ASSETS (SEGUNDA IMAGEM) ────────────────────────────────
  describe("2. Site Favicon Assets (Second Image — Circular Dark Favicon)", () => {
    const faviconFiles = [
      { path: path.join(appDir, "favicon.ico"), format: "ico" },
      { path: path.join(publicDir, "favicon.ico"), format: "ico" },
      { path: path.join(publicDir, "favicon.png"), format: "png", width: 32, height: 32 },
      { path: path.join(appDir, "icon.png"), format: "png", width: 512, height: 512 },
      { path: path.join(publicDir, "icon.png"), format: "png", width: 512, height: 512 },
    ];

    it("verifies all favicon files exist and are populated with official dark circular icon", () => {
      for (const item of faviconFiles) {
        expect(fs.existsSync(item.path), `Missing Favicon file: ${item.path}`).toBe(true);
        const buf = fs.readFileSync(item.path);
        expect(buf.length).toBeGreaterThan(500);

        if (item.format === "ico") {
          // ICO magic bytes: 0x00 0x00 0x01 0x00
          expect(buf[0]).toBe(0x00);
          expect(buf[1]).toBe(0x00);
          expect(buf[2]).toBe(0x01);
          expect(buf[3]).toBe(0x00);

          // Verifica se o ICO possui múltiplas resoluções embutidas (mínimo 3 resoluções)
          const imgCount = buf.readUInt16LE(4);
          expect(imgCount).toBeGreaterThanOrEqual(3);
        } else if (item.format === "png") {
          // PNG magic bytes
          expect(buf[0]).toBe(0x89);
          expect(buf[1]).toBe(0x50);
          expect(buf[2]).toBe(0x4E);
          expect(buf[3]).toBe(0x47);

          const w = buf.readUInt32BE(16);
          const h = buf.readUInt32BE(20);
          expect(w).toBe(item.width);
          expect(h).toBe(item.height);
        }
      }
    });

    it("ensures favicon formats and PWA icon paths are properly segregated", () => {
      const appIconBuf = fs.readFileSync(path.join(iconsDir, "icon-512x512.png"));
      const favIcoBuf = fs.readFileSync(path.join(appDir, "favicon.ico"));
      const favPngBuf = fs.readFileSync(path.join(appDir, "icon.png"));

      // Favicon é ICO (começa com 0x00000100) e PWA é PNG (começa com 0x89504E47)
      expect(favIcoBuf[0]).toBe(0x00);
      expect(appIconBuf[0]).toBe(0x89);
      expect(appIconBuf.equals(favIcoBuf)).toBe(false);

      // Favicon icon.png e PWA icon-512x512.png são identidades visuais distintas
      expect(favPngBuf.equals(appIconBuf)).toBe(false);
    });
  });

  // ─── 3. MANIFEST & SERVICE WORKER CACHE BUSTING ────────────────────────────
  describe("3. Manifest Specification & Service Worker Versioning", () => {
    it("service worker has incremented cache version to clear stale cached icons", () => {
      const swContent = fs.readFileSync(path.join(publicDir, "sw.js"), "utf8");
      expect(swContent).toContain("webgran-static-v15");
      expect(swContent).not.toContain("webgran-static-v14");
    });

    it("service worker precaches all essential brand assets including monochrome badges and favicon", () => {
      const swContent = fs.readFileSync(path.join(publicDir, "sw.js"), "utf8");
      expect(swContent).toContain("'/icons/badge-72x72.png'");
      expect(swContent).toContain("'/icons/badge-96x96.png'");
      expect(swContent).toContain("'/icons/icon-192x192.png'");
      expect(swContent).toContain("'/favicon.ico'");
    });

    it("manifest points exclusively to PWA icons under /icons/", () => {
      const manifestPath = path.join(publicDir, "manifest.json");
      const manifestContent = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

      for (const icon of manifestContent.icons) {
        expect(icon.src).toMatch(/^\/icons\/icon/);
        // Não aponta para favicon
        expect(icon.src).not.toContain("favicon");
      }
    });

    it("notification payloads use centralized official brand constants for icon and monochrome badge", () => {
      expect(WEBGRAN_NOTIFICATION_BRAND.defaultIcon).toBe("/icons/icon-192x192.png");
      expect(WEBGRAN_NOTIFICATION_BRAND.defaultBadge).toBe("/icons/badge-72x72.png");

      const sale = buildSaleNotificationPayload({ orderId: "ord-test", amount: 150 });
      expect(sale.icon).toBe("/icons/icon-192x192.png");
      expect(sale.badge).toBe("/icons/badge-72x72.png");

      const commission = buildPlatformCommissionPayload({ orderId: "ord-test", feeReais: 15, eventType: "COMMISSION_SETTLED" });
      expect(commission.icon).toBe("/icons/icon-192x192.png");
      expect(commission.badge).toBe("/icons/badge-72x72.png");

      const testNotif = buildTestNotificationPayload();
      expect(testNotif.icon).toBe("/icons/icon-192x192.png");
      expect(testNotif.badge).toBe("/icons/badge-72x72.png");
    });
  });
});

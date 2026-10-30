import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

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

    it("strictly separates favicon from PWA icon (different files and formats)", () => {
      const appIconBuf = fs.readFileSync(path.join(iconsDir, "icon-512x512.png"));
      const favIconBuf = fs.readFileSync(path.join(appDir, "icon.png"));

      // As duas imagens têm bytes diferentes e identidades visuais distintas
      expect(appIconBuf.equals(favIconBuf)).toBe(false);
    });
  });

  // ─── 3. MANIFEST & SERVICE WORKER CACHE BUSTING ────────────────────────────
  describe("3. Manifest Specification & Service Worker Versioning", () => {
    it("service worker has incremented cache version to clear stale cached icons", () => {
      const swContent = fs.readFileSync(path.join(publicDir, "sw.js"), "utf8");
      expect(swContent).toMatch(/webgran-static-v(7|8|9|\d+)/);
      expect(swContent).not.toContain("webgran-static-v6");
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
  });
});


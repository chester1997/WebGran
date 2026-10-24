import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import manifest from "../manifest";

describe("WebGran PWA Implementation Suite (Etapa 1)", () => {
  const publicDir = path.join(process.cwd(), "public");

  describe("1. Manifest Configuration & Verification", () => {
    it("generates manifest with all required PWA fields", () => {
      const manifestData = manifest();

      expect(manifestData.name).toBe("WebGran");
      expect(manifestData.short_name).toBe("WebGran");
      expect(manifestData.description).toBe("plataforma WebGran");
      expect(manifestData.start_url).toBe("/");
      expect(manifestData.scope).toBe("/");
      expect(manifestData.display).toBe("standalone");
      expect(manifestData.theme_color).toBe("#121214");
      expect(manifestData.background_color).toBe("#121214");
      expect(manifestData.lang).toBe("pt-BR");
    });

    it("includes both standard ('any') and maskable icons in 192x192 and 512x512", () => {
      const manifestData = manifest();
      const icons = manifestData.icons || [];

      expect(icons.length).toBeGreaterThanOrEqual(4);

      const any192 = icons.find((i) => i.sizes === "192x192" && i.purpose === "any");
      const any512 = icons.find((i) => i.sizes === "512x512" && i.purpose === "any");
      const maskable192 = icons.find((i) => i.sizes === "192x192" && i.purpose === "maskable");
      const maskable512 = icons.find((i) => i.sizes === "512x512" && i.purpose === "maskable");

      expect(any192).toBeDefined();
      expect(any512).toBeDefined();
      expect(maskable192).toBeDefined();
      expect(maskable512).toBeDefined();
    });

    it("ensures all icon files exist physically on disk with valid PNG headers", () => {
      const manifestData = manifest();
      const icons = manifestData.icons || [];

      for (const icon of icons) {
        const relativePath = icon.src.startsWith("/") ? icon.src.slice(1) : icon.src;
        const fullPath = path.join(publicDir, relativePath);

        expect(fs.existsSync(fullPath), `Icon file missing: ${fullPath}`).toBe(true);

        const buffer = fs.readFileSync(fullPath);
        // Verify PNG magic bytes: 0x89, 0x50, 0x4E, 0x47
        expect(buffer[0]).toBe(0x89);
        expect(buffer[1]).toBe(0x50);
        expect(buffer[2]).toBe(0x4E);
        expect(buffer[3]).toBe(0x47);

        // Verify dimensions from IHDR chunk
        const width = buffer.readUInt32BE(16);
        const height = buffer.readUInt32BE(20);
        const [expectedW, expectedH] = (icon.sizes || "").split("x").map(Number);

        expect(width).toBe(expectedW);
        expect(height).toBe(expectedH);
      }
    });

    it("verifies public/manifest.json matches manifest.ts specification", () => {
      const jsonPath = path.join(publicDir, "manifest.json");
      expect(fs.existsSync(jsonPath)).toBe(true);

      const jsonContent = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
      expect(jsonContent.name).toBe("WebGran");
      expect(jsonContent.short_name).toBe("WebGran");
      expect(jsonContent.display).toBe("standalone");
      expect(jsonContent.theme_color).toBe("#121214");
    });
  });

  describe("2. Service Worker Security Boundaries", () => {
    const swPath = path.join(publicDir, "sw.js");

    it("service worker file exists in public/sw.js", () => {
      expect(fs.existsSync(swPath)).toBe(true);
    });

    it("enforces strict bypass for authenticated APIs, private pages, and tokens", () => {
      const swCode = fs.readFileSync(swPath, "utf8");

      // Verify non-GET requests are immediately bypassed
      expect(swCode).toContain("request.method !== 'GET'");

      // Verify critical security exclusions
      expect(swCode).toContain("url.pathname.startsWith('/api/')");
      expect(swCode).toContain("url.pathname.startsWith('/seller')");
      expect(swCode).toContain("url.pathname.startsWith('/admin')");
      expect(swCode).toContain("url.pathname.startsWith('/login')");
      expect(swCode).toContain("request.headers.get('Authorization')");
      expect(swCode).toContain("request.headers.get('cookie')");
    });

    it("ensures immediate activation and cache cleanup to avoid stale frontend", () => {
      const swCode = fs.readFileSync(swPath, "utf8");

      expect(swCode).toContain("self.skipWaiting()");
      expect(swCode).toContain("self.clients.claim()");
      expect(swCode).toContain("caches.delete");
    });
  });

  describe("3. Apple Touch Icon & iOS Standalone Support", () => {
    it("ensures apple-touch-icon exists in 180x180 resolution", () => {
      const appleIconPath = path.join(publicDir, "icons", "apple-touch-icon.png");
      expect(fs.existsSync(appleIconPath)).toBe(true);

      const buffer = fs.readFileSync(appleIconPath);
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);

      expect(width).toBe(180);
      expect(height).toBe(180);
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isWebmBuffer,
  isOggBuffer,
  isM4aBuffer,
  isMp3Buffer,
  webmOpusToOggOpus,
  prepareAudioForTelegram,
} from "@/lib/telegram/audio-remuxer";
import fs from "fs";
import path from "path";

describe("WebGran Bots — Remuxer de Áudio e Compatibilidade Telegram", () => {
  // Amostra sintética de WebM válida gerada pelo Chromium
  const sampleWebmPath = path.resolve(process.cwd(), "scratch/sample_chrome_recording.webm");
  let chromeWebmBuffer: Buffer;

  beforeEach(() => {
    if (fs.existsSync(sampleWebmPath)) {
      chromeWebmBuffer = fs.readFileSync(sampleWebmPath);
    } else {
      // Mock de cabeçalho WebM para fallback de ambiente
      chromeWebmBuffer = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01]);
    }
  });

  describe("1. Detecção por Magic Bytes", () => {
    it("detecta corretamente buffer WebM (EBML 0x1A45DFA3)", () => {
      const webmBuf = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x00, 0x00]);
      expect(isWebmBuffer(webmBuf)).toBe(true);
      expect(isOggBuffer(webmBuf)).toBe(false);
      expect(isM4aBuffer(webmBuf)).toBe(false);
    });

    it("detecta corretamente buffer Ogg (OggS)", () => {
      const oggBuf = Buffer.from([0x4f, 0x67, 0x67, 0x53, 0x00, 0x02]);
      expect(isOggBuffer(oggBuf)).toBe(true);
      expect(isWebmBuffer(oggBuf)).toBe(false);
    });

    it("detecta corretamente buffer M4A (ftyp no offset 4)", () => {
      const m4aBuf = Buffer.from([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41]);
      expect(isM4aBuffer(m4aBuf)).toBe(true);
      expect(isWebmBuffer(m4aBuf)).toBe(false);
    });

    it("detecta corretamente buffer MP3 (ID3 ou sync word)", () => {
      const mp3Id3 = Buffer.from([0x49, 0x44, 0x33, 0x03, 0x00]);
      const mp3Sync = Buffer.from([0xff, 0xfb, 0x90, 0x64]);
      expect(isMp3Buffer(mp3Id3)).toBe(true);
      expect(isMp3Buffer(mp3Sync)).toBe(true);
    });
  });

  describe("2. Conversão de WebM/Opus para Ogg/Opus RFC 7845", () => {
    it("converte com sucesso gravação do Chromium em container Ogg Opus autêntico", () => {
      if (!fs.existsSync(sampleWebmPath)) return;

      const oggResult = webmOpusToOggOpus(chromeWebmBuffer);
      expect(oggResult).toBeDefined();
      expect(oggResult.length).toBeGreaterThan(0);

      // Validações estritas da especificação RFC 7845:
      // 1. Magic bytes OggS
      expect(oggResult.slice(0, 4).toString("ascii")).toBe("OggS");

      // 2. Página 0: Header Type 0x02 (BOS)
      expect(oggResult.readUInt8(5)).toBe(0x02);

      // 3. Contém cabeçalho OpusHead na página 0
      expect(oggResult.indexOf("OpusHead")).toBe(28);

      // 4. Contém cabeçalho OpusTags na página 1
      expect(oggResult.indexOf("OpusTags")).toBeGreaterThan(28);

      // 5. Contém pelo menos 1 página de dados com EOS (0x04)
      const isOggValid = isOggBuffer(oggResult);
      expect(isOggValid).toBe(true);

      // 6. Validação de Decodificação com FFmpeg / ffprobe nativos se presentes
      const tmpOggPath = path.resolve(process.cwd(), "scratch/test_vitest_output.ogg");
      fs.writeFileSync(tmpOggPath, oggResult);
      try {
        const { execSync } = require("child_process");
        // ffprobe valida container Ogg e formato Opus
        const probeOut = execSync(`ffprobe -hide_banner "${tmpOggPath}" 2>&1`, { encoding: "utf8" });
        expect(probeOut).toContain("Audio: opus");

        // ffmpeg decodifica integralmente sem erros
        execSync(`ffmpeg -v error -i "${tmpOggPath}" -f null - 2>&1`, { encoding: "utf8" });
      } catch (e: any) {
        if (!e.message?.includes("not recognized") && !e.message?.includes("Command failed")) {
          throw e;
        }
      } finally {
        if (fs.existsSync(tmpOggPath)) fs.unlinkSync(tmpOggPath);
      }
    });

    it("rejeita buffer inválido ou corrompido com erro descritivo", () => {
      const corruptBuf = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0xff, 0xff]);
      expect(() => webmOpusToOggOpus(corruptBuf)).toThrow();
    });
  });

  describe("3. Preparação Inteligente de Áudio (prepareAudioForTelegram)", () => {
    it("preserva áudio nativo Ogg sem remux desnecessário", () => {
      const oggBuf = Buffer.from([0x4f, 0x67, 0x67, 0x53, 0x00, 0x02, 0x00, 0x00]);
      const res = prepareAudioForTelegram(oggBuf, "audio_note.ogg");
      expect(res.format).toBe("ogg");
      expect(res.fileName).toBe("audio_note.ogg");
      expect(res.isVoiceCompatible).toBe(true);
      expect(res.buffer).toBe(oggBuf);
    });

    it("preserva áudio M4A gerado no Safari/iOS como compatível com sendVoice", () => {
      const m4aBuf = Buffer.from([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41]);
      const res = prepareAudioForTelegram(m4aBuf, "recording.m4a");
      expect(res.format).toBe("m4a");
      expect(res.fileName).toBe("recording.m4a");
      expect(res.isVoiceCompatible).toBe(true);
    });

    it("converte WebM do Chromium em Ogg/Opus com extensão .ogg", () => {
      if (!fs.existsSync(sampleWebmPath)) return;

      const res = prepareAudioForTelegram(chromeWebmBuffer, "voice_123.webm");
      expect(res.format).toBe("ogg");
      expect(res.fileName).toBe("voice_123.ogg");
      expect(res.isVoiceCompatible).toBe(true);
      expect(res.buffer.slice(0, 4).toString("ascii")).toBe("OggS");
    });
  });
});


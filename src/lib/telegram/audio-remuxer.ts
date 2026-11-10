/**
 * WebGran Audio Remuxer & Telegram Audio Preparation
 * Converte gravações WebM/Opus do Chromium/Android em OGG/Opus RFC 7845 nativo
 * para que a API sendVoice do Telegram aceite como Nota de Voz autêntica com forma de onda.
 */

// Tabela de CRC-32 para Ogg (polinômio 0x04C11DB7)
const oggCrcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let r = i << 24;
    for (let j = 0; j < 8; j++) {
      if (r & 0x80000000) {
        r = ((r << 1) ^ 0x04c11db7) >>> 0;
      } else {
        r = (r << 1) >>> 0;
      }
    }
    table[i] = r;
  }
  return table;
})();

function calculateOggCrc(buf: Buffer): number {
  let crc = 0;
  for (let i = 0; i < buf.length; i++) {
    crc = ((crc << 8) ^ oggCrcTable[((crc >>> 24) ^ buf[i]) & 0xff]) >>> 0;
  }
  return crc;
}

function buildOggPage(
  headerType: number,
  granulePosition: number | bigint,
  serialNumber: number,
  pageSequence: number,
  packets: Buffer[]
): Buffer {
  const segmentLengths: number[] = [];
  let totalPayloadSize = 0;

  for (const pkt of packets) {
    let len = pkt.length;
    totalPayloadSize += len;
    while (len >= 255) {
      segmentLengths.push(255);
      len -= 255;
    }
    segmentLengths.push(len);
  }

  if (segmentLengths.length > 255) {
    throw new Error("Payload do pacote excede o limite de 255 segmentos de página Ogg (RFC 7845)");
  }

  const headerLen = 27 + segmentLengths.length;
  const page = Buffer.alloc(headerLen + totalPayloadSize);

  // 0-3: "OggS"
  page.write("OggS", 0, 4, "ascii");
  // 4: stream structure version (0)
  page.writeUInt8(0, 4);
  // 5: header type (0x02 = BOS, 0x00 = normal, 0x04 = EOS)
  page.writeUInt8(headerType, 5);
  // 6-13: granule position (little-endian 64-bit int)
  page.writeBigInt64LE(BigInt(granulePosition), 6);
  // 14-17: bitstream serial number
  page.writeUInt32LE(serialNumber, 14);
  // 18-21: page sequence number
  page.writeUInt32LE(pageSequence, 18);
  // 22-25: CRC checksum (zero durante cálculo)
  page.writeUInt32LE(0, 22);
  // 26: segment count
  page.writeUInt8(segmentLengths.length, 26);
  // 27..: segment table
  for (let i = 0; i < segmentLengths.length; i++) {
    page.writeUInt8(segmentLengths[i], 27 + i);
  }

  // Copiar os payloads dos pacotes
  let payloadOffset = headerLen;
  for (const pkt of packets) {
    pkt.copy(page, payloadOffset);
    payloadOffset += pkt.length;
  }

  // Calcular e gravar CRC
  const crc = calculateOggCrc(page);
  page.writeUInt32LE(crc, 22);

  return page;
}

/**
 * Extrai duração em samples (a 48kHz) do byte TOC do pacote Opus (RFC 6716)
 */
function getOpusPacketSamples(packet: Buffer): number {
  if (!packet || packet.length === 0) return 960;
  const toc = packet[0];
  const config = toc >> 3;
  let frameDurationMs = 20;

  if (config === 16 || config === 20 || config === 24 || config === 28) frameDurationMs = 2.5;
  else if (config === 17 || config === 21 || config === 25 || config === 29) frameDurationMs = 5;
  else if (
    config === 0 || config === 4 || config === 8 || config === 12 ||
    config === 14 || config === 18 || config === 22 || config === 26 || config === 30
  ) frameDurationMs = 10;
  else if (
    config === 1 || config === 5 || config === 9 || config === 13 ||
    config === 15 || config === 19 || config === 23 || config === 27 || config === 31
  ) frameDurationMs = 20;
  else if (config === 2 || config === 6 || config === 10) frameDurationMs = 40;
  else if (config === 3 || config === 7 || config === 11) frameDurationMs = 60;

  const c = toc & 0x03;
  let frameCount = 1;
  if (c === 1 || c === 2) frameCount = 2;
  else if (c === 3 && packet.length > 1) {
    frameCount = packet[1] & 0x3f;
  }
  return Math.round(((frameDurationMs * 48000) / 1000) * frameCount);
}

/**
 * Lê Matroska/EBML Variable-Size Integer (VINT)
 */
function readVint(buffer: Buffer, offset: number) {
  if (offset >= buffer.length) return null;
  const firstByte = buffer[offset];
  let mask = 0x80;
  let len = 1;
  while (len <= 8 && !(firstByte & mask)) {
    mask >>= 1;
    len++;
  }
  if (len > 8) return null;
  let val = firstByte & (mask - 1);
  let isUnknown = (firstByte & (mask - 1)) === (mask - 1);
  for (let i = 1; i < len; i++) {
    if (offset + i >= buffer.length) return null;
    const b = buffer[offset + i];
    if (b !== 0xff) isUnknown = false;
    val = (val << 8) | b;
  }
  return { val: isUnknown ? -1 : val, len, isUnknown };
}

/**
 * Lê EBML Element ID
 */
function readEbmlId(buffer: Buffer, offset: number) {
  if (offset >= buffer.length) return null;
  const firstByte = buffer[offset];
  let mask = 0x80;
  let len = 1;
  while (len <= 4 && !(firstByte & mask)) {
    mask >>= 1;
    len++;
  }
  if (len > 4) return null;
  let id = 0;
  for (let i = 0; i < len; i++) {
    if (offset + i >= buffer.length) return null;
    id = (id << 8) | buffer[offset + i];
  }
  return { id, len };
}

/**
 * Extrai pacotes Opus individuais de um SimpleBlock (0xA3) ou Block (0xA1),
 * decodificando corretamente os modos de lacing da especificação Matroska:
 * - 00: No lacing (padrão Chromium MediaRecorder)
 * - 01: Xiph lacing
 * - 10: Fixed-size lacing
 * - 11: EBML lacing
 */
function extractOpusPacketsFromBlock(blockData: Buffer): Buffer[] {
  if (blockData.length < 4) return [];
  const trackVint = readVint(blockData, 0);
  if (!trackVint || trackVint.val < 0) return [];
  const headerLen = trackVint.len + 2 + 1; // track(vint) + timecode(int16) + flags(uint8)
  if (blockData.length <= headerLen) return [];

  const flags = blockData[trackVint.len + 2];
  const lacing = (flags & 0x06) >> 1;
  const payload = blockData.slice(headerLen);

  if (lacing === 0) {
    // 00: No lacing (1 pacote Opus direto)
    return payload.length > 0 ? [payload] : [];
  }

  if (payload.length < 1) return [];
  const numFrames = payload[0] + 1;
  let offset = 1;
  const packets: Buffer[] = [];

  if (lacing === 1) {
    // 01: Xiph lacing
    const frameSizes: number[] = [];
    for (let f = 0; f < numFrames - 1; f++) {
      let size = 0;
      while (offset < payload.length) {
        const val = payload[offset++];
        size += val;
        if (val < 255) break;
      }
      frameSizes.push(size);
    }
    const knownSizes = frameSizes.reduce((a, b) => a + b, 0);
    const lastSize = payload.length - offset - knownSizes;
    if (lastSize >= 0) {
      for (const size of frameSizes) {
        if (offset + size <= payload.length && size > 0) {
          packets.push(payload.slice(offset, offset + size));
          offset += size;
        }
      }
      if (offset + lastSize <= payload.length && lastSize > 0) {
        packets.push(payload.slice(offset, offset + lastSize));
      }
    }
  } else if (lacing === 2) {
    // 10: Fixed-size lacing
    const totalRemaining = payload.length - offset;
    const frameSize = Math.floor(totalRemaining / numFrames);
    for (let f = 0; f < numFrames; f++) {
      if (offset + frameSize <= payload.length && frameSize > 0) {
        packets.push(payload.slice(offset, offset + frameSize));
        offset += frameSize;
      }
    }
  } else if (lacing === 3) {
    // 11: EBML lacing
    const frameSizes: number[] = [];
    let prevSize = 0;
    for (let f = 0; f < numFrames - 1; f++) {
      const v = readVint(payload, offset);
      if (!v || v.val < 0) break;
      offset += v.len;
      if (f === 0) {
        prevSize = v.val;
      } else {
        const bias = (1 << ((7 * v.len) - 1)) - 1;
        const diff = v.val - bias;
        prevSize = prevSize + diff;
      }
      frameSizes.push(prevSize);
    }
    const knownSizes = frameSizes.reduce((a, b) => a + b, 0);
    const lastSize = payload.length - offset - knownSizes;
    if (lastSize >= 0) {
      for (const size of frameSizes) {
        if (offset + size <= payload.length && size > 0) {
          packets.push(payload.slice(offset, offset + size));
          offset += size;
        }
      }
      if (offset + lastSize <= payload.length && lastSize > 0) {
        packets.push(payload.slice(offset, offset + lastSize));
      }
    }
  }

  return packets.length > 0 ? packets : [payload];
}

/**
 * Converte um buffer WebM contendo áudio Opus em um buffer OGG/Opus RFC 7845 nativo.
 */
export function webmOpusToOggOpus(webmBuf: Buffer): Buffer {
  if (!isWebmBuffer(webmBuf)) {
    throw new Error("Formato não reconhecido como WebM");
  }

  let offset = 0;
  let opusHead: Buffer | null = null;
  const opusPackets: Buffer[] = [];

  // Pular cabeçalho EBML
  const topId = readEbmlId(webmBuf, offset);
  if (!topId) throw new Error("EBML ID ausente");
  offset += topId.len;
  const topSize = readVint(webmBuf, offset);
  if (!topSize) throw new Error("EBML tamanho ausente");
  offset += topSize.len + topSize.val;

  // Segment
  const segId = readEbmlId(webmBuf, offset);
  if (!segId || segId.id !== 0x18538067) throw new Error("Elemento Segment ausente");
  offset += segId.len;
  const segSize = readVint(webmBuf, offset);
  offset += segSize ? segSize.len : 0;

  // Iterar elementos do Segment (suporta streaming WebM)
  while (offset < webmBuf.length) {
    const elId = readEbmlId(webmBuf, offset);
    if (!elId) break;
    const id = elId.id;
    const idLen = elId.len;
    const sizeVint = readVint(webmBuf, offset + idLen);
    if (!sizeVint) break;
    const sizeLen = sizeVint.len;
    const dataOffset = offset + idLen + sizeLen;

    if (id === 0x1654ae6b) {
      // Tracks
      let trkOffset = dataOffset;
      const trkEnd = dataOffset + sizeVint.val;
      while (trkOffset < trkEnd && trkOffset < webmBuf.length) {
        const tId = readEbmlId(webmBuf, trkOffset);
        if (!tId) break;
        const tSize = readVint(webmBuf, trkOffset + tId.len);
        if (!tSize) break;
        const tData = trkOffset + tId.len + tSize.len;
        if (tId.id === 0xae) {
          // TrackEntry
          let teOffset = tData;
          const teEnd = tData + tSize.val;
          while (teOffset < teEnd && teOffset < webmBuf.length) {
            const teId = readEbmlId(webmBuf, teOffset);
            if (!teId) break;
            const teSize = readVint(webmBuf, teOffset + teId.len);
            if (!teSize) break;
            const teData = teOffset + teId.len + teSize.len;
            if (teId.id === 0x63a2) {
              // CodecPrivate: Contém o cabeçalho OpusHead
              opusHead = webmBuf.slice(teData, teData + teSize.val);
            }
            teOffset = teData + teSize.val;
          }
        }
        trkOffset = tData + tSize.val;
      }
      offset = dataOffset + sizeVint.val;
    } else if (id === 0x1f43b675 || id === 0xa0) {
      // Cluster (0x1f43b675) ou BlockGroup (0xa0) - elementos estruturais master
      offset = dataOffset;
    } else if (id === 0xa3 || id === 0xa1) {
      // SimpleBlock (0xa3) ou Block (0xa1)
      const blockSize = sizeVint.val;
      if (blockSize > 0 && dataOffset + blockSize <= webmBuf.length) {
        const blockData = webmBuf.slice(dataOffset, dataOffset + blockSize);
        const extracted = extractOpusPacketsFromBlock(blockData);
        for (const pkt of extracted) {
          if (pkt.length > 0) {
            opusPackets.push(pkt);
          }
        }
      }
      offset = dataOffset + blockSize;
    } else {
      offset = sizeVint.isUnknown ? offset + 1 : dataOffset + sizeVint.val;
    }
  }

  if (opusPackets.length === 0) {
    throw new Error("Nenhum pacote de áudio Opus encontrado no container WebM");
  }

  // Se o navegador não gravou OpusHead no CodecPrivate, constrói um cabeçalho RFC 7845 padrão
  if (!opusHead || opusHead.length < 19 || !opusHead.slice(0, 8).equals(Buffer.from("OpusHead", "ascii"))) {
    opusHead = Buffer.alloc(19);
    opusHead.write("OpusHead", 0, 8, "ascii");
    opusHead.writeUInt8(1, 8); // version
    opusHead.writeUInt8(1, 9); // channel count (mono para voz)
    opusHead.writeUInt16LE(312, 10); // pre-skip
    opusHead.writeUInt32LE(48000, 12); // input sample rate
    opusHead.writeInt16LE(0, 16); // output gain
    opusHead.writeUInt8(0, 18); // channel mapping family
  }

  // Pre-skip do cabeçalho OpusHead
  const preSkip = opusHead.length >= 12 ? opusHead.readUInt16LE(10) : 0;

  const serialNumber = 0x5747524e; // "WGRN"
  const pages: Buffer[] = [];

  // Página 0: OpusHead (BOS)
  pages.push(buildOggPage(0x02, BigInt(0), serialNumber, 0, [opusHead]));

  // Página 1: OpusTags
  const vendor = "WebGran Opus Voice Remuxer";
  const vendorBuf = Buffer.from(vendor, "utf8");
  const tagsBuf = Buffer.alloc(8 + 4 + vendorBuf.length + 4);
  tagsBuf.write("OpusTags", 0, 8, "ascii");
  tagsBuf.writeUInt32LE(vendorBuf.length, 8);
  vendorBuf.copy(tagsBuf, 12);
  tagsBuf.writeUInt32LE(0, 12 + vendorBuf.length); // 0 user comments
  pages.push(buildOggPage(0x00, BigInt(0), serialNumber, 1, [tagsBuf]));

  // Páginas 2..N: Pacotes de áudio com avanço de granulePosition incluindo preSkip inicial
  let pageSeq = 2;
  let currentGranule = preSkip;
  for (let i = 0; i < opusPackets.length; i++) {
    const pkt = opusPackets[i];
    const samples = getOpusPacketSamples(pkt);
    currentGranule += samples;
    const isLast = i === opusPackets.length - 1;
    const headerType = isLast ? 0x04 : 0x00; // 0x04 = EOS
    pages.push(buildOggPage(headerType, currentGranule, serialNumber, pageSeq++, [pkt]));
  }

  return Buffer.concat(pages);
}

export function isWebmBuffer(buf: Buffer): boolean {
  return (
    buf.length >= 4 &&
    buf[0] === 0x1a &&
    buf[1] === 0x45 &&
    buf[2] === 0xdf &&
    buf[3] === 0xa3
  );
}

export function isOggBuffer(buf: Buffer): boolean {
  return (
    buf.length >= 4 &&
    buf[0] === 0x4f &&
    buf[1] === 0x67 &&
    buf[2] === 0x67 &&
    buf[3] === 0x53
  );
}

export function isM4aBuffer(buf: Buffer): boolean {
  return (
    buf.length >= 8 &&
    buf[4] === 0x66 &&
    buf[5] === 0x74 &&
    buf[6] === 0x79 &&
    buf[7] === 0x70
  );
}

export function isMp3Buffer(buf: Buffer): boolean {
  if (buf.length < 3) return false;
  // ID3v2 header
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return true;
  // MPEG-1/2 Audio sync word 0xFF 0xFB / 0xFA / 0xF3 / 0xF2
  return buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0;
}

/**
 * Prepara um arquivo de áudio recebido para despacho ideal na API do Telegram.
 * Converte WebM/Opus do Chromium em OGG/Opus para sendVoice, ou preserva M4A/OGG nativos.
 */
export function prepareAudioForTelegram(
  buffer: Buffer,
  originalName?: string
): {
  buffer: Buffer;
  fileName: string;
  isVoiceCompatible: boolean;
  format: "ogg" | "m4a" | "mp3" | "webm" | "unknown";
} {
  const baseName = (originalName || "audio").replace(/\.[^/.]+$/, "");
  const hasVoiceExt = /\.(ogg|opus|m4a)$/i.test(originalName || "");

  // 1. Já é Ogg nativo (ou arquivo com extensão de voz .ogg/.opus)
  if (isOggBuffer(buffer) || (hasVoiceExt && !isWebmBuffer(buffer))) {
    return {
      buffer,
      fileName: hasVoiceExt ? originalName! : `${baseName}.ogg`,
      isVoiceCompatible: true,
      format: hasVoiceExt && originalName?.toLowerCase().endsWith(".m4a") ? "m4a" : "ogg",
    };
  }

  // 2. Já é M4A / MP4 nativo (ex: Safari / iOS)
  if (isM4aBuffer(buffer)) {
    return {
      buffer,
      fileName: `${baseName}.m4a`,
      isVoiceCompatible: true,
      format: "m4a",
    };
  }

  // 3. MP3 nativo
  if (isMp3Buffer(buffer)) {
    return {
      buffer,
      fileName: `${baseName}.mp3`,
      isVoiceCompatible: true,
      format: "mp3",
    };
  }

  // 4. WebM com Opus (Chromium / Android) -> Remux para Ogg Opus
  if (isWebmBuffer(buffer)) {
    try {
      const oggBuffer = webmOpusToOggOpus(buffer);
      return {
        buffer: oggBuffer,
        fileName: `${baseName}.ogg`,
        isVoiceCompatible: true,
        format: "ogg",
      };
    } catch (err: any) {
      console.warn("[prepareAudioForTelegram] Remux WebM -> Ogg falhou, mantendo original:", err?.message);
      return {
        buffer,
        fileName: `${baseName}.webm`,
        isVoiceCompatible: false,
        format: "webm",
      };
    }
  }

  // 5. Formato não identificado
  return {
    buffer,
    fileName: originalName || `${baseName}.bin`,
    isVoiceCompatible: false,
    format: "unknown",
  };
}

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SOURCE_PATH = 'C:/Users/luiz_/.gemini/antigravity/brain/ef804771-f5c4-49ac-9c33-d932abd0dddb/.user_uploaded/media_1793788375210_70fa9f6f.png';

async function createIcoBuffer(sourceBuffer) {
  const sizes = [16, 32, 48];
  const images = [];

  for (const size of sizes) {
    const buffer = await sharp(sourceBuffer)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    images.push({ width: size, height: size, buffer });
  }

  const count = images.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  let offset = headerSize + count * dirEntrySize;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // ICO type 1
  header.writeUInt16LE(count, 4); // Count of images

  const entries = [];
  for (const img of images) {
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(img.width >= 256 ? 0 : img.width, 0);
    entry.writeUInt8(img.height >= 256 ? 0 : img.height, 1);
    entry.writeUInt8(0, 2); // Color palette count (0 for 32bpp)
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(img.buffer.length, 8); // Image size in bytes
    entry.writeUInt32LE(offset, 12); // Image data offset
    entries.push(entry);
    offset += img.buffer.length;
  }

  return Buffer.concat([header, ...entries, ...images.map((img) => img.buffer)]);
}

async function main() {
  if (!fs.existsSync(SOURCE_PATH)) {
    throw new Error('Fonte da nova logo não encontrada em: ' + SOURCE_PATH);
  }

  console.log('Lendo imagem original da nova logo WebGran...');
  const originalBuffer = fs.readFileSync(SOURCE_PATH);
  const metadata = await sharp(originalBuffer).metadata();
  console.log(`Dimensões originais: ${metadata.width}x${metadata.height}, formato: ${metadata.format}`);

  const rootDir = path.resolve(__dirname, '..');
  const publicDir = path.join(rootDir, 'public');
  const publicIconsDir = path.join(publicDir, 'icons');
  const appDir = path.join(rootDir, 'src', 'app');

  // Garante diretórios
  fs.mkdirSync(publicIconsDir, { recursive: true });

  // 1. Logo principal do sistema em resolução nativa 1024x1024
  console.log('1. Gerando logo-webgran-icon.png e variantes em public/...');
  const fullResLogo = await sharp(originalBuffer)
    .resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ quality: 100, compressionLevel: 9 })
    .toBuffer();

  fs.writeFileSync(path.join(publicDir, 'logo-webgran-icon.png'), fullResLogo);
  fs.writeFileSync(path.join(publicDir, 'logo.png'), fullResLogo);
  fs.writeFileSync(path.join(publicDir, 'logo-icon.png'), fullResLogo);
  fs.writeFileSync(path.join(publicDir, 'logo-expanded.png'), fullResLogo);

  // 2. Ícones de alta densidade PWA (public/icons)
  console.log('2. Gerando ícones PWA e badges...');
  const icon512 = await sharp(originalBuffer)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(publicIconsDir, 'icon-512x512.png'), icon512);

  const icon192 = await sharp(originalBuffer)
    .resize(192, 192, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(publicIconsDir, 'icon-192x192.png'), icon192);

  // Maskable icons (com 80% safe zone padding com background #121214)
  const innerMaskable512 = await sharp(originalBuffer)
    .resize(Math.round(512 * 0.8), Math.round(512 * 0.8), { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const maskable512 = await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 18, g: 18, b: 20, alpha: 1 } // #121214
    }
  })
    .composite([{ input: innerMaskable512, gravity: 'center' }])
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(publicIconsDir, 'icon-maskable-512x512.png'), maskable512);

  const innerMaskable192 = await sharp(originalBuffer)
    .resize(Math.round(192 * 0.8), Math.round(192 * 0.8), { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const maskable192 = await sharp({
    create: {
      width: 192,
      height: 192,
      channels: 4,
      background: { r: 18, g: 18, b: 20, alpha: 1 } // #121214
    }
  })
    .composite([{ input: innerMaskable192, gravity: 'center' }])
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(publicIconsDir, 'icon-maskable-192x192.png'), maskable192);

  // Apple touch icons (180x180)
  const apple180 = await sharp(originalBuffer)
    .resize(180, 180, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(publicIconsDir, 'apple-touch-icon.png'), apple180);
  fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), apple180);
  fs.writeFileSync(path.join(appDir, 'apple-icon.png'), apple180);

  // Badges para notificações PWA
  for (const size of [72, 96, 128, 192]) {
    const badge = await sharp(originalBuffer)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    fs.writeFileSync(path.join(publicIconsDir, `badge-${size}x${size}.png`), badge);
  }

  // 3. Favicon e App Icons
  console.log('3. Gerando Favicons (.ico, .png) e icon.png do Next.js...');
  fs.writeFileSync(path.join(publicDir, 'icon.png'), icon512);
  fs.writeFileSync(path.join(appDir, 'icon.png'), icon512);

  const favicon32 = await sharp(originalBuffer)
    .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(publicDir, 'favicon.png'), favicon32);

  const icoBuffer = await createIcoBuffer(originalBuffer);
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoBuffer);
  fs.writeFileSync(path.join(appDir, 'favicon.ico'), icoBuffer);

  console.log('Todos os assets da nova logo oficial foram gerados com sucesso!');
}

main().catch((err) => {
  console.error('Erro na geração dos assets:', err);
  process.exit(1);
});


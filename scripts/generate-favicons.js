const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function createIcoBuffer(sourcePath) {
  const sizes = [16, 32, 48];
  const images = [];

  for (const size of sizes) {
    const buffer = await sharp(sourcePath)
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

async function generateAll() {
  let source = path.resolve(__dirname, '../scratch_favicon.png');
  if (!fs.existsSync(source)) {
    source = path.resolve(__dirname, '../public/icon.png');
  }
  if (!fs.existsSync(source)) {
    throw new Error('Source file not found at ' + source);
  }

  console.log('Generating ICO files...');
  const icoBuffer = await createIcoBuffer(source);
  fs.writeFileSync(path.resolve(__dirname, '../src/app/favicon.ico'), icoBuffer);
  fs.writeFileSync(path.resolve(__dirname, '../public/favicon.ico'), icoBuffer);

  console.log('Generating standard PNG icons...');
  // 32x32 favicon.png
  await sharp(source)
    .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.resolve(__dirname, '../public/favicon.png'));

  // 180x180 Apple touch icons
  const apple180Buffer = await sharp(source)
    .resize(180, 180, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  fs.writeFileSync(path.resolve(__dirname, '../src/app/apple-icon.png'), apple180Buffer);
  fs.writeFileSync(path.resolve(__dirname, '../public/apple-touch-icon.png'), apple180Buffer);
  fs.writeFileSync(path.resolve(__dirname, '../public/icons/apple-touch-icon.png'), apple180Buffer);

  // 192x192 PWA standard icon
  await sharp(source)
    .resize(192, 192, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.resolve(__dirname, '../public/icons/icon-192x192.png'));

  // 512x512 PWA & app icon
  const icon512Buffer = await sharp(source)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  fs.writeFileSync(path.resolve(__dirname, '../src/app/icon.png'), icon512Buffer);
  fs.writeFileSync(path.resolve(__dirname, '../public/icon.png'), icon512Buffer);
  fs.writeFileSync(path.resolve(__dirname, '../public/icons/icon-512x512.png'), icon512Buffer);

  console.log('Generating maskable icons for Android PWA...');
  // Maskable 192x192 with safe zone padding
  const inner192 = await sharp(source)
    .resize(Math.round(192 * 0.8), Math.round(192 * 0.8), { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  await sharp({
    create: {
      width: 192,
      height: 192,
      channels: 4,
      background: { r: 18, g: 18, b: 20, alpha: 1 } // #121214
    }
  })
    .composite([{ input: inner192, gravity: 'center' }])
    .png()
    .toFile(path.resolve(__dirname, '../public/icons/icon-maskable-192x192.png'));

  // Maskable 512x512 with safe zone padding
  const inner512 = await sharp(source)
    .resize(Math.round(512 * 0.8), Math.round(512 * 0.8), { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 18, g: 18, b: 20, alpha: 1 } // #121214
    }
  })
    .composite([{ input: inner512, gravity: 'center' }])
    .png()
    .toFile(path.resolve(__dirname, '../public/icons/icon-maskable-512x512.png'));

  console.log('All favicon and icon assets generated successfully!');
}

generateAll().catch((err) => {
  console.error('Error generating favicons:', err);
  process.exit(1);
});

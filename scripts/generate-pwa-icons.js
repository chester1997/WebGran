const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function generatePwaIcons() {
  let sourcePath = path.resolve(__dirname, '../scratch_pwa.png');
  let baseBuffer;
  if (fs.existsSync(sourcePath)) {
    // 1. Prepare base 1080x1080 square image without the 1px screenshot artifact on the left
    const baseSquare = sharp(sourcePath).extract({ left: 1, top: 0, width: 1080, height: 1080 });
    baseBuffer = await baseSquare.png().toBuffer();
  } else {
    sourcePath = path.resolve(__dirname, '../public/icons/icon-512x512.png');
    if (!fs.existsSync(sourcePath)) {
      throw new Error('Source file not found at ' + sourcePath);
    }
    baseBuffer = await sharp(sourcePath).png().toBuffer();
  }

  const publicIconsDir = path.resolve(__dirname, '../public/icons');

  console.log('Generating PWA standard and maskable icons...');

  // 192x192 standard icon
  await sharp(baseBuffer)
    .resize(192, 192, { kernel: sharp.kernel.lanczos3 })
    .png()
    .toFile(path.join(publicIconsDir, 'icon-192x192.png'));
  console.log('Created public/icons/icon-192x192.png');

  // 512x512 standard icon
  await sharp(baseBuffer)
    .resize(512, 512, { kernel: sharp.kernel.lanczos3 })
    .png()
    .toFile(path.join(publicIconsDir, 'icon-512x512.png'));
  console.log('Created public/icons/icon-512x512.png');

  // 192x192 maskable icon (emblem is centered and within 59% radius, well inside the 80% safe zone circle)
  await sharp(baseBuffer)
    .resize(192, 192, { kernel: sharp.kernel.lanczos3 })
    .png()
    .toFile(path.join(publicIconsDir, 'icon-maskable-192x192.png'));
  console.log('Created public/icons/icon-maskable-192x192.png');

  // 512x512 maskable icon
  await sharp(baseBuffer)
    .resize(512, 512, { kernel: sharp.kernel.lanczos3 })
    .png()
    .toFile(path.join(publicIconsDir, 'icon-maskable-512x512.png'));
  console.log('Created public/icons/icon-maskable-512x512.png');

  // 180x180 iOS Home Screen / PWA installation icon
  await sharp(baseBuffer)
    .resize(180, 180, { kernel: sharp.kernel.lanczos3 })
    .png()
    .toFile(path.join(publicIconsDir, 'apple-touch-icon.png'));
  console.log('Created public/icons/apple-touch-icon.png');

  console.log('All PWA application icons generated successfully!');
}

generatePwaIcons().catch((err) => {
  console.error('Error generating PWA icons:', err);
  process.exit(1);
});

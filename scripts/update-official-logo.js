const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SOURCE_PATH = 'C:/Users/luiz_/.gemini/antigravity/brain/ef804771-f5c4-49ac-9c33-d932abd0dddb/.user_uploaded/media_1793788375210_70fa9f6f.png';

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

  // 2. Ícones padrão PWA (public/icons/icon-*.png)
  console.log('2. Gerando ícones padrão PWA...');
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

  // 3. Maskable icons com gradiente oficial WebGran contínuo (SEM bordas pretas!)
  // Especificação W3C / Android: o fundo deve sangrar 100% de ponta a ponta e o emblema deve estar na safe zone
  console.log('3. Gerando ícones maskable com gradiente azul contínuo de ponta a ponta...');
  async function generateMaskableIcon(size) {
    const svgGradient = Buffer.from(
      `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#0135E7"/>
            <stop offset="100%" stop-color="#040E44"/>
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#bg)"/>
      </svg>`
    );

    const innerSize = Math.round(size * 0.88);
    const resizedSource = await sharp(originalBuffer)
      .resize(innerSize, innerSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();

    return await sharp(svgGradient)
      .composite([{ input: resizedSource, gravity: 'center' }])
      .png()
      .toBuffer();
  }

  const maskable512 = await generateMaskableIcon(512);
  fs.writeFileSync(path.join(publicIconsDir, 'icon-maskable-512x512.png'), maskable512);

  const maskable192 = await generateMaskableIcon(192);
  fs.writeFileSync(path.join(publicIconsDir, 'icon-maskable-192x192.png'), maskable192);

  // 4. Apple touch icons (180x180)
  console.log('4. Gerando apple-touch-icon.png...');
  const apple180 = await sharp(originalBuffer)
    .resize(180, 180, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(publicIconsDir, 'apple-touch-icon.png'), apple180);
  fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), apple180);
  fs.writeFileSync(path.join(appDir, 'apple-icon.png'), apple180);

  // NOTA ARQUITETURAL CRÍTICA:
  // 1. Badges de Notificação PWA (badge-*.png) DEVEM ser estritamente monocromáticos (silhueta branca sobre fundo transparente)
  //    para que o Android/SO consiga renderizar a máscara de canal alfa na barra de status sem gerar quadrado sólido/vazio.
  // 2. Favicons (favicon.ico, favicon.png, src/app/icon.png) utilizam a identidade circular dark de alta fidelidade
  //    em múltiplas resoluções (16, 32, 48, 64, 128, 256), segregados dos ícones PWA do app.
  // NÃO sobrescrever badges nem favicons a partir do logo do app.

  console.log('Todos os assets PWA e maskables gerados com sucesso!');
}

main().catch((err) => {
  console.error('Erro na geração dos assets:', err);
  process.exit(1);
});

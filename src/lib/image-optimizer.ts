/**
 * Helper utility for client-side automatic image optimization before uploading to WebGran.
 * Handles dimensional inspection, aspect ratio calculation, high-quality canvas compression,
 * and WebP format conversion tailored for mobile Telegram Mini App viewports.
 */

export interface OptimizeImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'image/webp' | 'image/jpeg';
}

export interface OptimizedImageResult {
  dataUrl: string;
  width: number;
  height: number;
  originalSizeBytes: number;
  optimizedSizeBytes: number;
  savedPercent: number;
}

export async function optimizeBannerImage(
  file: File,
  options: OptimizeImageOptions = {}
): Promise<OptimizedImageResult> {
  const maxWidth = options.maxWidth || 1200;
  const maxHeight = options.maxHeight || 1200;
  const quality = options.quality || 0.85;
  const format = options.format || 'image/webp';

  return new Promise((resolve, reject) => {
    const originalSizeBytes = file.size;
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;

      // Calculate proportional dimensions while keeping aspect ratio intact
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      if (height > maxHeight) {
        width = Math.round((width * maxHeight) / height);
        height = maxHeight;
      }

      // Create Canvas for high quality downscaling and compression
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context não disponível no navegador.'));
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Clear background and draw scaled image
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      // Export compressed image in WebP format
      let dataUrl = canvas.toDataURL(format, quality);

      // Fallback to JPEG if WebP is not supported by the browser
      if (!dataUrl.startsWith(`data:${format}`)) {
        dataUrl = canvas.toDataURL('image/jpeg', quality);
      }

      // Calculate compressed byte size
      const base64Content = dataUrl.split(',')[1] || '';
      const optimizedSizeBytes = Math.round(base64Content.length * 0.75);
      const savedPercent = Math.max(
        0,
        Math.round(((originalSizeBytes - optimizedSizeBytes) / originalSizeBytes) * 100)
      );

      resolve({
        dataUrl,
        width,
        height,
        originalSizeBytes,
        optimizedSizeBytes,
        savedPercent,
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Formato de imagem inválido ou arquivo corrompido.'));
    };

    img.src = objectUrl;
  });
}

/**
 * Client-side helper: Optimizes image via Canvas AND uploads directly from browser to Bunny Storage CDN.
 * The file binary NEVER passes through Vercel.
 */
export async function uploadOptimizedImage(
  file: File,
  entityType: 'products' | 'banners' | 'categories' | 'store' | 'profiles' = 'products',
  options: OptimizeImageOptions = {}
): Promise<{
  url: string;
  originalSizeBytes: number;
  optimizedSizeBytes: number;
  savedPercent: number;
}> {
  // 1. Optimize image locally in client canvas to WebP Blob
  const optimized = await optimizeBannerImage(file, options);
  
  // Convert Data URL to binary Blob
  const base64Data = optimized.dataUrl.split(',')[1] || '';
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const imageBlob = new Blob([byteArray], { type: 'image/webp' });

  // 2. Request lightweight upload session metadata from backend
  const sessionRes = await fetch('/api/storage/upload-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      mimeType: 'image/webp',
      fileSize: imageBlob.size,
      entityType,
    }),
  });

  const sessionData = await sessionRes.json();
  if (!sessionRes.ok || !sessionData.success) {
    throw new Error(sessionData.error || 'Erro ao gerar autorização de upload.');
  }

  // 3. Upload binary DIRECTLY from Browser to Bunny Storage CDN (Bypassing Vercel completely)
  const uploadRes = await fetch(sessionData.uploadUrl, {
    method: 'PUT',
    headers: sessionData.headers,
    body: imageBlob,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text().catch(() => '');
    throw new Error(`Falha no upload direto para Bunny Storage (${uploadRes.status}): ${errText}`);
  }

  return {
    url: sessionData.publicUrl,
    originalSizeBytes: optimized.originalSizeBytes,
    optimizedSizeBytes: optimized.optimizedSizeBytes,
    savedPercent: optimized.savedPercent,
  };
}

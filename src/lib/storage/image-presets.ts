export interface ImagePreset {
  maxWidth: number;
  maxHeight: number;
  quality: number;
  format: 'image/webp' | 'image/jpeg';
}

export const IMAGE_PRESETS: Record<string, ImagePreset> = {
  PRODUCT_COVER: {
    maxWidth: 1000,
    maxHeight: 1200,
    quality: 0.85,
    format: 'image/webp',
  },
  PRODUCT_BANNER: {
    maxWidth: 1400,
    maxHeight: 700,
    quality: 0.85,
    format: 'image/webp',
  },
  STORE_BANNER: {
    maxWidth: 1400,
    maxHeight: 600,
    quality: 0.85,
    format: 'image/webp',
  },
  CATEGORY_IMAGE: {
    maxWidth: 600,
    maxHeight: 600,
    quality: 0.85,
    format: 'image/webp',
  },
  PROFILE_IMAGE: {
    maxWidth: 400,
    maxHeight: 400,
    quality: 0.85,
    format: 'image/webp',
  },
};

export function getImagePreset(presetName?: string): ImagePreset {
  if (presetName && IMAGE_PRESETS[presetName]) {
    return IMAGE_PRESETS[presetName];
  }
  return IMAGE_PRESETS.PRODUCT_COVER;
}

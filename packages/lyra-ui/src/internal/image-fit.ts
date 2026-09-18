export type LyraImageFit = 'contain' | 'width' | 'actual';

const IMAGE_FITS = new Set<LyraImageFit>(['contain', 'width', 'actual']);

export function normalizeImageFit(
  value: unknown,
  fallback: LyraImageFit = 'contain',
): LyraImageFit {
  return IMAGE_FITS.has(value as LyraImageFit) ? value as LyraImageFit : fallback;
}

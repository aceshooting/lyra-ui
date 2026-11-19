import { safeMediaSrc } from '../../../internal/safe-url.js';

/** One WebVTT thumbnail cue: a time range and an image, optionally a sprite region. */
export interface ThumbnailCue {
  start: number;
  end: number;
  src: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

const MAX_THUMBNAIL_CUES = 2_000;

function parseVttTime(source: string): number | null {
  const parts = source.trim().split(':').map(Number);
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => !Number.isFinite(part))) {
    return null;
  }
  const seconds = parts.length === 3
    ? parts[0]! * 3600 + parts[1]! * 60 + parts[2]!
    : parts[0]! * 60 + parts[1]!;
  return seconds >= 0 ? seconds : null;
}

function parseThumbnailUrl(
  source: string,
  baseUrl: string,
  URLCtor: typeof URL,
): Omit<ThumbnailCue, 'start' | 'end'> | null {
  const trimmed = source.trim();
  if (!trimmed) return null;
  try {
    const resolved = new URLCtor(trimmed, baseUrl);
    const sprite = /^#xywh=(\d+),(\d+),(\d+),(\d+)$/u.exec(resolved.hash);
    resolved.hash = '';
    const src = safeMediaSrc(resolved.href, URLCtor);
    if (!src) return null;
    if (!sprite) return { src };
    const [x, y, width, height] = sprite.slice(1).map(Number);
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width! <= 0 ||
      height! <= 0
    ) {
      return null;
    }
    return { src, x, y, width, height };
  } catch {
    return null;
  }
}

/** Parses a WebVTT thumbnail track into at most 2,000 safe cues, resolving URLs against the track. */
export function parseThumbnailVtt(source: string, sourceUrl: string, URLCtor: typeof URL): ThumbnailCue[] {
  const cues: ThumbnailCue[] = [];
  const normalized = source.replace(/^\uFEFF/u, '').replaceAll('\r\n', '\n').replaceAll('\r', '\n');
  for (const block of normalized.split(/\n{2,}/u)) {
    if (cues.length >= MAX_THUMBNAIL_CUES) break;
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
    const timingIndex = lines.findIndex((line) => line.includes('-->'));
    if (timingIndex < 0 || !lines[timingIndex + 1]) continue;
    const match = /^(\S+)\s+-->\s+(\S+)/u.exec(lines[timingIndex]!);
    if (!match) continue;
    const start = parseVttTime(match[1]!);
    const end = parseVttTime(match[2]!);
    const thumbnail = parseThumbnailUrl(lines[timingIndex + 1]!, sourceUrl, URLCtor);
    if (start === null || end === null || end <= start || !thumbnail) continue;
    cues.push({ start, end, ...thumbnail });
  }
  return cues;
}

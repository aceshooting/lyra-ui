import { isPlainDataRecord } from '../../../internal/data-descriptors.js';
import { LyraMapImageExportError, type LyraMapImageExportErrorCode, type LyraMapImageExportOptions, type LyraMapImageExportType } from './map-image-export-error.js';

export { LyraMapImageExportError };
/** Explicit owner-bound hooks. A render listener must run synchronously after drawing. */
export interface MapImageExportServices {
  ready(signal: AbortSignal): Promise<void>;
  current(): boolean;
  onRender(callback: () => void): () => void;
  requestRender(): void;
  canvas(): HTMLCanvasElement;
  /** Complete plain source/provider attribution; empty text means none is required. */
  attributionText(): string;
  createCanvas(): HTMLCanvasElement;
  /** Set only when the admitted style is known to require visible pixels. Empty styles may not. */
  requiresVisiblePixels?: boolean;
  /** Internal total deadline for readiness, render and encoding; defaults to 10 seconds. */
  timeoutMs?: number;
}
const busy = new WeakSet<MapImageExportServices>();
const MAX_PIXELS = 16 * 1024 * 1024, MAX_SIDE = 8192, MAX_BLOB = 64 * 1024 * 1024;
function optionsOf(value: unknown): Required<LyraMapImageExportOptions> {
  if (value === undefined) return { type: 'image/png', attribution: true };
  if (!isPlainDataRecord(value)) throw new LyraMapImageExportError('invalid-options');
  const keys = Reflect.ownKeys(value); if (keys.length > 2 || keys.some((key) => key !== 'type' && key !== 'attribution')) throw new LyraMapImageExportError('invalid-options');
  const read = (key: string): unknown => { const descriptor = Object.getOwnPropertyDescriptor(value, key); if (descriptor && !Object.hasOwn(descriptor, 'value')) throw new LyraMapImageExportError('invalid-options'); return descriptor?.value; };
  const typeValue = read('type'), attributionValue = read('attribution');
  const type = typeValue === undefined ? 'image/png' : typeValue, attribution = attributionValue === undefined ? true : attributionValue;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(type as string) || typeof attribution !== 'boolean') throw new LyraMapImageExportError('invalid-options');
  return { type: type as LyraMapImageExportType, attribution };
}
function dimensions(width: number, height: number): boolean { return Number.isSafeInteger(width) && Number.isSafeInteger(height) && width > 0 && height > 0 && width <= MAX_SIDE && height <= MAX_SIDE && width * height <= MAX_PIXELS; }
function linesOf(ctx: CanvasRenderingContext2D, text: string, width: number): readonly string[] {
  if (text.length > 4096 || width < 24) throw new LyraMapImageExportError('attribution-failed');
  const lines: string[] = []; let line = '';
  const push = () => { lines.push(line); line = ''; if (lines.length > 32) throw new LyraMapImageExportError('attribution-failed'); };
  // Code-point iteration keeps surrogate pairs intact. All text is painted literally.
  for (const character of text.replaceAll('\r\n', '\n').replaceAll('\r', '\n')) {
    if (character === '\n') { push(); continue; }
    if (ctx.measureText(character).width > width) throw new LyraMapImageExportError('attribution-failed');
    if (line && ctx.measureText(line + character).width > width) push();
    line += character;
  }
  if (line || !lines.length) push(); return lines;
}
function signature(bytes: Uint8Array, type: LyraMapImageExportType): boolean {
  if (type === 'image/png') return [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
  if (type === 'image/jpeg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  return bytes[0] === 82 && bytes[1] === 73 && bytes[2] === 70 && bytes[3] === 70 && bytes[8] === 87 && bytes[9] === 69 && bytes[10] === 66 && bytes[11] === 80;
}
/**
 * Export the current rendered canvas without changing preserveDrawingBuffer. Readiness and a
 * fresh render establish frame provenance; pixel variance is not a completeness test. Copies
 * synchronously within render, then encodes the owned snapshot. DOM overlays are not captured.
 */
export function exportMapImage(input: unknown, services: MapImageExportServices, signal?: AbortSignal): Promise<Blob> {
  if (!services || typeof services !== 'object') return Promise.reject(new LyraMapImageExportError('invalid-options'));
  if (busy.has(services)) return Promise.reject(new LyraMapImageExportError('busy'));
  busy.add(services);
  let options: Required<LyraMapImageExportOptions>;
  try { options = optionsOf(input); } catch { busy.delete(services); return Promise.reject(new LyraMapImageExportError('invalid-options')); }
  return new Promise<Blob>((resolve, reject) => {
    let finished = false, captured = false, unsubscribe: (() => void) | undefined, destination: HTMLCanvasElement | undefined;
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
    const current = () => { try { if (finished || signal?.aborted) return false; const valid = services.current(); return !finished && !signal?.aborted && valid; } catch { return false; } };
    const releaseCanvas = (canvas: HTMLCanvasElement | undefined) => { try { if (canvas) { canvas.width = 0; canvas.height = 0; } } catch { /* Best-effort bitmap release. */ } };
    const stopListener = () => { const stop = unsubscribe; unsubscribe = undefined; try { stop?.(); } catch { /* Cleanup must not mask the export outcome. */ } };
    const finish = (blob?: Blob, code?: LyraMapImageExportErrorCode) => {
      if (finished) return; finished = true;
      if (timer !== undefined) clearTimeout(timer); try { signal?.removeEventListener('abort', aborted); } catch { /* Continue remaining cleanup. */ }
      controller.abort(); stopListener();
      releaseCanvas(destination);
      destination = undefined; busy.delete(services);
      if (blob) resolve(blob); else reject(new LyraMapImageExportError(code ?? 'capture-failed'));
    };
    const aborted = () => finish(undefined, 'cancelled');
    const encode = async (blob: Blob | null) => {
      if (!current()) { finish(undefined, 'cancelled'); return; }
      try {
        if (!blob || blob.type !== options.type || blob.size === 0 || blob.size > MAX_BLOB) { finish(undefined, 'encoding-failed'); return; }
        const header = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
        if (!current()) { finish(undefined, 'cancelled'); return; }
        if (!signature(header, options.type)) { finish(undefined, 'encoding-failed'); return; }
        finish(blob);
      } catch { finish(undefined, current() ? 'encoding-failed' : 'cancelled'); }
    };
    const capture = () => {
      if (captured || finished) return; if (!current()) { finish(undefined, 'cancelled'); return; } captured = true;
      try {
        const source = services.canvas(); if (!current()) { finish(undefined, 'cancelled'); return; }
        const width = source.width, height = source.height;
        if (!dimensions(width, height)) throw new LyraMapImageExportError('limit');
        const canvas = services.createCanvas();
        if (canvas === source) throw new LyraMapImageExportError('capture-failed');
        if (finished) { releaseCanvas(canvas); return; }
        destination = canvas;
        if (!current()) { finish(undefined, 'cancelled'); return; }
        // Capture now, before returning from render; WebGL may discard its buffer afterward.
        canvas.width = width; canvas.height = height; let ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new LyraMapImageExportError('capture-failed'); ctx.drawImage(source, 0, 0);
        const image = ctx.getImageData(0, 0, width, height), pixels = image.data;
        if (services.requiresVisiblePixels) {
          let visible = false; for (let index = 3; index < pixels.length; index += 4) if (pixels[index] !== 0) { visible = true; break; }
          if (!visible) throw new LyraMapImageExportError('blank-frame');
        }
        if (!current()) { finish(undefined, 'cancelled'); return; }
        let attribution = '';
        if (options.attribution) {
          try { attribution = services.attributionText(); }
          catch { throw new LyraMapImageExportError('attribution-failed'); }
        }
        if (!current()) { finish(undefined, 'cancelled'); return; }
        if (typeof attribution !== 'string') throw new LyraMapImageExportError('attribution-failed');
        if (attribution) {
          ctx.font = '12px sans-serif'; const lines = linesOf(ctx, attribution, width - 16), totalHeight = height + 16 + lines.length * 16;
          if (!dimensions(width, totalHeight)) throw new LyraMapImageExportError('limit');
          // Resizing clears the bitmap: preserve the already captured source pixels locally.
          canvas.height = totalHeight; ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) throw new LyraMapImageExportError('capture-failed'); ctx.putImageData(image, 0, 0);
          ctx.fillStyle = '#ffffff'; ctx.fillRect(0, height, width, totalHeight - height);
          ctx.fillStyle = '#111111'; ctx.font = '12px sans-serif'; ctx.textBaseline = 'top';
          for (let index = 0; index < lines.length; index++) ctx.fillText(lines[index]!, 8, height + 8 + index * 16);
        }
        if (!current()) { finish(undefined, 'cancelled'); return; }
        try { canvas.toBlob((blob) => { void encode(blob); }, options.type); }
        catch { throw new LyraMapImageExportError('encoding-failed'); }
      } catch (error) { finish(undefined, !current() ? 'cancelled' : error instanceof LyraMapImageExportError ? error.code : 'capture-failed'); }
    };
    if (!current()) { finish(undefined, 'cancelled'); return; }
    try {
      signal?.addEventListener('abort', aborted, { once: true });
      const deadline = services.timeoutMs ?? 10000;
      if (!current()) { finish(undefined, 'cancelled'); return; }
      if (!Number.isFinite(deadline) || deadline < 1 || deadline > 30000) { finish(undefined, 'invalid-options'); return; }
      timer = setTimeout(() => finish(undefined, 'timeout'), deadline);
    } catch { finish(undefined, 'invalid-options'); return; }
    void (async () => {
      try {
        await services.ready(controller.signal);
        if (!current()) { finish(undefined, 'cancelled'); return; }
        unsubscribe = services.onRender(capture);
        if (finished) { stopListener(); return; }
        if (!current()) { finish(undefined, 'cancelled'); return; }
        services.requestRender();
      } catch { finish(undefined, current() ? 'not-ready' : 'cancelled'); }
    })();
  });
}

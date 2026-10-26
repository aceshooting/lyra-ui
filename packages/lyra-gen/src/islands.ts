import { MARKUP_LIMITS, parseMarkup } from './parser.js';
import type { MarkupOptions, MarkupResult } from './parser.js';
import type { LyraGenDiagnostic } from './types.js';

export interface ProsePart { readonly kind: 'prose'; readonly source: string; readonly start: number; readonly end: number }
export interface MarkupIsland {
  readonly kind: 'island';
  readonly source: string;
  readonly body: string;
  readonly start: number;
  readonly end: number;
  readonly bodyStart: number;
  readonly bodyEnd: number;
  readonly closed: boolean;
  /** Parser offsets are relative to bodyStart. */
  readonly result: MarkupResult;
}
export type IslandPart = ProsePart | MarkupIsland;
export interface IslandResult {
  readonly parts: readonly IslandPart[];
  readonly diagnostics: readonly LyraGenDiagnostic[];
}
export interface IslandParser {
  push(chunk: string): IslandResult;
  finish(): IslandResult;
  cancel(): IslandResult;
}

/** Incremental fence scanner. Complete islands publish when their closing line arrives. */
export function createIslandParser(options: MarkupOptions): IslandParser {
  const limit = (key: 'maxLength' | 'maxBytes'): number => {
    const value = options.limits?.[key];
    return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? Math.min(MARKUP_LIMITS[key], value) : MARKUP_LIMITS[key];
  };
  const ceiling = limit('maxLength');
  const maxBytes = limit('maxBytes');
  let source = '';
  let bytes = 0;
  let receivedLength = 0;
  let previousHighSurrogate = false;
  let islandCount = 0;
  let scan = 0;
  let lineStart = 0;
  let proseStart = 0;
  let fence: { character: string; length: number; lyra: boolean; start: number; bodyStart: number } | undefined;
  let done = false;
  let failure: LyraGenDiagnostic | undefined;
  const parts: IslandPart[] = [];
  const incomplete: MarkupResult = { status: 'incomplete', diagnostics: [], sourceMap: {} };
  const addProse = (end: number): void => {
    if (end > proseStart) parts.push({ kind: 'prose', source: source.slice(proseStart, end), start: proseStart, end });
  };
  const line = (start: number, end: number): void => {
    const text = source.slice(start, end).replace(/(?:\r\n|\r|\n)$/, '');
    const match = /^ {0,3}(`{3,}|~{3,})([^\r\n]*)$/.exec(text);
    if (!fence) {
      if (!match) return;
      const run = match[1]!;
      // Backtick-containing info strings are not valid backtick fence openers.
      if (run[0] === '`' && match[2]!.includes('`')) return;
      const lyra = /^[ \t]*lyra[ \t]*$/.test(match[2]!);
      fence = { character: run[0]!, length: run.length, lyra, start, bodyStart: end };
      if (lyra) { addProse(start); proseStart = start; }
      return;
    }
    if (!match || match[1]![0] !== fence.character || match[1]!.length < fence.length || !/^[ \t]*$/.test(match[2]!)) return;
    if (fence.lyra) {
      const body = source.slice(fence.bodyStart, start);
      parts.push({ kind: 'island', source: source.slice(fence.start, end), body, start: fence.start, end,
        bodyStart: fence.bodyStart, bodyEnd: start, closed: true, result: parseMarkup(body, { ...options, surfaceId: `${options.surfaceId}:island-${islandCount++}` }) });
      proseStart = end;
    }
    fence = undefined;
  };
  const scanLines = (final: boolean): void => {
    while (scan < source.length) {
      const unit = source[scan];
      if (unit === '\r') {
        if (!final && scan + 1 === source.length) break;
        scan += source[scan + 1] === '\n' ? 2 : 1;
        line(lineStart, scan); lineStart = scan;
      } else if (unit === '\n') {
        scan++; line(lineStart, scan); lineStart = scan;
      } else scan++;
    }
  };
  const snapshot = (): IslandResult => {
    if (failure) return { parts: [], diagnostics: [failure] };
    const current = parts.slice();
    if (fence?.lyra) {
      current.push({ kind: 'island', source: source.slice(fence.start), body: source.slice(fence.bodyStart),
        start: fence.start, end: source.length, bodyStart: fence.bodyStart, bodyEnd: source.length,
        closed: false, result: incomplete });
    } else if (source.length > proseStart) {
      current.push({ kind: 'prose', source: source.slice(proseStart), start: proseStart, end: source.length });
    }
    return { parts: current, diagnostics: [] };
  };
  return {
    push(chunk) {
      if (done) return snapshot();
      if (typeof chunk !== 'string') {
        failure = { code: 'invalid-input', path: '', severity: 'error', message: 'Markdown island input must be a string.' };
        source = ''; parts.length = 0; done = true;
        return snapshot();
      }
      receivedLength = Math.min(ceiling + 1, receivedLength + chunk.length);
      if (receivedLength > ceiling) {
        failure = { code: 'source-length-limit', path: '', severity: 'error', message: 'Markdown island input exceeds its source limit.', source: { start: ceiling, end: ceiling } };
        source = ''; parts.length = 0;
        return snapshot();
      }
      if (failure) return snapshot();
      for (let index = 0; index < chunk.length; index++) {
        const unit = chunk.charCodeAt(index);
        bytes += unit >= 0xdc00 && unit <= 0xdfff && previousHighSurrogate ? 1 : unit < 0x80 ? 1 : unit < 0x800 ? 2 : 3;
        previousHighSurrogate = unit >= 0xd800 && unit <= 0xdbff;
      }
      if (bytes > maxBytes) {
        failure = { code: 'source-byte-limit', path: '', severity: 'error', message: 'Markdown island input exceeds its byte limit.', source: { start: 0, end: 0 } };
        source = ''; parts.length = 0;
        return snapshot();
      }
      source += chunk;
      scanLines(false);
      return snapshot();
    },
    finish() {
      if (!done) {
        scanLines(true);
        if (lineStart < source.length) line(lineStart, source.length);
        done = true;
      }
      return snapshot();
    },
    cancel() {
      done = true;
      // Already completed islands remain independently usable; incomplete input remains inert.
      return snapshot();
    }
  };
}

/** Preserve prose verbatim and parse only explicitly fenced Lyra islands. */
export function parseIslands(source: string, options: MarkupOptions): IslandResult {
  const parser = createIslandParser(options);
  parser.push(source);
  return parser.finish();
}

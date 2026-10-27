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
  let bytes = 0;
  let receivedLength = 0;
  let previousHighSurrogate = false;
  let islandCount = 0;
  // Offsets are absolute. Text is held per region (never one growing string that is indexed),
  // so a push scans only its own chunk and a rope is flattened at most once per completed line.
  let lineStart = 0;
  let lineText = '';
  let pendingReturn = false;
  let proseStart = 0;
  let proseText = '';
  let fenceText = '';
  let bodyText = '';
  let fence: { character: string; length: number; lyra: boolean; start: number; bodyStart: number } | undefined;
  let done = false;
  let failure: LyraGenDiagnostic | undefined;
  let retained: readonly IslandPart[] = [];
  const parts: IslandPart[] = [];
  const incomplete: MarkupResult = { status: 'incomplete', diagnostics: [], sourceMap: {} };
  const addProse = (): void => {
    if (proseText.length > 0) parts.push({ kind: 'prose', source: proseText, start: proseStart, end: lineStart });
  };
  const line = (raw: string, start: number, end: number): void => {
    const text = raw.replace(/(?:\r\n|\r|\n)$/, '');
    const match = /^ {0,3}(`{3,}|~{3,})([^\r\n]*)$/.exec(text);
    if (!fence) {
      // Backtick-containing info strings are not valid backtick fence openers.
      if (!match || (match[1]![0] === '`' && match[2]!.includes('`'))) { proseText += raw; return; }
      const run = match[1]!;
      const lyra = /^[ \t]*lyra[ \t]*$/.test(match[2]!);
      fence = { character: run[0]!, length: run.length, lyra, start, bodyStart: end };
      if (lyra) { addProse(); proseStart = start; proseText = ''; fenceText = raw; bodyText = ''; }
      else proseText += raw;
      return;
    }
    if (!match || match[1]![0] !== fence.character || match[1]!.length < fence.length || !/^[ \t]*$/.test(match[2]!)) {
      if (fence.lyra) { fenceText += raw; bodyText += raw; } else proseText += raw;
      return;
    }
    if (fence.lyra) {
      const body = bodyText;
      parts.push({ kind: 'island', source: fenceText + raw, body, start: fence.start, end,
        bodyStart: fence.bodyStart, bodyEnd: start, closed: true, result: parseMarkup(body, { ...options, surfaceId: `${options.surfaceId}:island-${islandCount++}` }) });
      proseStart = end; proseText = ''; fenceText = ''; bodyText = '';
    } else proseText += raw;
    fence = undefined;
  };
  const completeLine = (): void => {
    const raw = lineText;
    const start = lineStart;
    lineText = ''; pendingReturn = false; lineStart = start + raw.length;
    line(raw, start, lineStart);
  };
  const scanChunk = (chunk: string): void => {
    let from = 0;
    if (pendingReturn) {
      if (chunk.charCodeAt(0) === 0x0a) { lineText += '\n'; from = 1; }
      completeLine();
    }
    for (let index = from; index < chunk.length; index++) {
      const unit = chunk.charCodeAt(index);
      if (unit === 0x0a) { lineText += chunk.slice(from, index + 1); from = index + 1; completeLine(); }
      else if (unit === 0x0d) {
        if (index + 1 === chunk.length) { lineText += chunk.slice(from); from = chunk.length; pendingReturn = true; break; }
        const next = chunk.charCodeAt(index + 1) === 0x0a ? index + 2 : index + 1;
        lineText += chunk.slice(from, next); from = next; index = next - 1; completeLine();
      }
    }
    if (from < chunk.length) lineText += chunk.slice(from);
  };
  const snapshotParts = (): IslandPart[] => {
    const current = parts.slice();
    const total = lineStart + lineText.length;
    if (fence?.lyra) {
      current.push({ kind: 'island', source: fenceText + lineText, body: bodyText + lineText,
        start: fence.start, end: total, bodyStart: fence.bodyStart, bodyEnd: total,
        closed: false, result: incomplete });
    } else if (total > proseStart) {
      current.push({ kind: 'prose', source: proseText + lineText, start: proseStart, end: total });
    }
    return current;
  };
  const snapshot = (): IslandResult => {
    if (failure) return { parts: retained, diagnostics: [failure] };
    return { parts: snapshotParts(), diagnostics: [] };
  };
  // A rejected push keeps everything accepted before it; later input is never admitted.
  const reject = (diagnostic: LyraGenDiagnostic): void => {
    if (!failure) retained = snapshotParts();
    failure = diagnostic;
    parts.length = 0; lineText = ''; proseText = ''; fenceText = ''; bodyText = ''; pendingReturn = false;
  };
  return {
    push(chunk) {
      if (done) return snapshot();
      if (typeof chunk !== 'string') {
        reject({ code: 'invalid-input', path: '', severity: 'error', message: 'Markdown island input must be a string.' });
        done = true;
        return snapshot();
      }
      receivedLength = Math.min(ceiling + 1, receivedLength + chunk.length);
      if (receivedLength > ceiling) {
        reject({ code: 'source-length-limit', path: '', severity: 'error', message: 'Markdown island input exceeds its source limit.', source: { start: ceiling, end: ceiling } });
        return snapshot();
      }
      if (failure) return snapshot();
      for (let index = 0; index < chunk.length; index++) {
        const unit = chunk.charCodeAt(index);
        bytes += unit >= 0xdc00 && unit <= 0xdfff && previousHighSurrogate ? 1 : unit < 0x80 ? 1 : unit < 0x800 ? 2 : 3;
        previousHighSurrogate = unit >= 0xd800 && unit <= 0xdbff;
      }
      if (bytes > maxBytes) {
        reject({ code: 'source-byte-limit', path: '', severity: 'error', message: 'Markdown island input exceeds its byte limit.', source: { start: 0, end: 0 } });
        return snapshot();
      }
      scanChunk(chunk);
      return snapshot();
    },
    finish() {
      if (!done) {
        if (lineText.length > 0) completeLine();
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

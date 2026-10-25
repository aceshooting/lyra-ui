import { ModelAdmissionError } from './model-admission-error.js';
import type { ModelWorkGenerator } from './model-work-generator.js';

/** Validate the entire UTF-8 input before consuming records, matching admission refusal order. */
export function* decodeModelText(bytes: Uint8Array): ModelWorkGenerator<string[]> {
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const chunks: string[] = [];
  // Retain fixed decode blocks even when the caller grants a single byte at a time.
  let charged = 0; let decoded = 0;
  if (bytes.length) yield { unit: 'bytes', run(limit) {
    const used = Math.min(limit, bytes.length - charged); charged += used;
    while (decoded + 1024 <= charged || (charged === bytes.length && decoded < charged)) {
      const end = Math.min(decoded + 1024, charged);
      try { chunks.push(decoder.decode(bytes.subarray(decoded, end), { stream: true })); }
      catch { throw new ModelAdmissionError('invalid'); }
      decoded = end;
    }
    return { used, done: charged === bytes.length };
  } };
  try { const tail = decoder.decode(); if (tail) chunks.push(tail); }
  catch { throw new ModelAdmissionError('invalid'); }
  return chunks;
}

export class ModelTextCursor {
  private chunk = 0;
  private offset = 0;
  constructor(private readonly chunks: readonly string[]) {}
  peek(): string | undefined {
    while (this.chunk < this.chunks.length && this.offset === this.chunks[this.chunk]!.length) { this.chunk++; this.offset = 0; }
    return this.chunks[this.chunk]?.charAt(this.offset);
  }
  take(): string | undefined { const value = this.peek(); if (value !== undefined) this.offset++; return value; }
  span(limit: number): string {
    this.peek();
    return this.chunks[this.chunk]?.slice(this.offset, this.offset + limit) ?? '';
  }
  advance(count: number): void { this.offset += count; }
}

export class ModelLineCursor {
  private readonly cursor: ModelTextCursor;
  private count = 0;
  constructor(chunks: readonly string[], private readonly lineLimit: number, private readonly countLimit: number) { this.cursor = new ModelTextCursor(chunks); }
  *next(canonical = false): ModelWorkGenerator<string | undefined> {
    if (this.cursor.peek() === undefined) return undefined;
    let raw = '';
    yield { unit: 'scalars', run: (limit) => {
      let used = 0;
      while (used < limit) {
        const span = this.cursor.span(Math.min(limit - used, this.lineLimit - raw.length + 1));
        if (!span) return { used, done: true };
        const newline = span.indexOf('\n'); const length = newline < 0 ? span.length : newline;
        raw += span.slice(0, length); this.cursor.advance(length); used += length;
        if (raw.length > this.lineLimit) throw new ModelAdmissionError('limit');
        if (newline >= 0) { this.cursor.advance(1); return { used: used + 1, done: true }; }
      }
      return { used, done: this.cursor.peek() === undefined };
    } };
    yield 'records';
    return this.finishLine(raw, canonical);
  }
  *forEach(visit: (line: string) => void, canonical = false): ModelWorkGenerator<void> {
    let raw = ''; let ended = false; let oversized = false;
    const pending: string[] = [];
    while (!ended) {
      yield { unit: 'scalars', run: (limit) => {
        let used = 0;
        while (used < limit && pending.length < 64) {
          const span = this.cursor.span(Math.min(limit - used, this.lineLimit - raw.length + 1));
          if (!span) { ended = true; if (raw) { pending.push(raw); raw = ''; } break; }
          const newline = span.indexOf('\n'); const length = newline < 0 ? span.length : newline;
          raw += span.slice(0, length); this.cursor.advance(length); used += length;
          if (raw.length > this.lineLimit) { oversized = true; break; }
          if (newline >= 0) { this.cursor.advance(1); used++; pending.push(raw); raw = ''; }
        }
        // Earlier records must be admitted before a later oversized line can refuse the input.
        return { used, done: ended || oversized || pending.length > 0 };
      } };
      let index = 0;
      if (pending.length) yield { unit: 'records', run: (limit) => {
        const used = Math.min(limit, pending.length - index);
        const end = index + used;
        while (index < end) visit(this.finishLine(pending[index++]!, canonical));
        return { used, done: index === pending.length };
      } };
      pending.length = 0;
      if (oversized) throw new ModelAdmissionError('limit');
    }
  }
  private finishLine(raw: string, canonical: boolean): string {
    if (++this.count > this.countLimit) throw new ModelAdmissionError('limit');
    const line = raw.trim();
    if (canonical && (raw !== line || (line && line.split(/\s+/).join(' ') !== line))) throw new ModelAdmissionError('unsupported');
    return line;
  }
}

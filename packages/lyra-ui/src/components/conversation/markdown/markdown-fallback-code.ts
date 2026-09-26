const MARKDOWN_FALLBACK_BLOCK_RUN_MAX = 128;
const MARKDOWN_FALLBACK_INLINE_RUN_MAX = 128;
const MARKDOWN_FALLBACK_FENCE_PROBE = 64;

export type MarkdownFallbackSegmentKind = 'prose' | 'block' | 'inline';
export interface MarkdownFallbackSegment {
  readonly kind: MarkdownFallbackSegmentKind;
  readonly text: string;
}
export interface MarkdownFenceLine {
  readonly char: '`' | '~';
  readonly length: number;
  readonly indent: number;
  readonly info: string;
}

/** Classifies a complete source line. This deliberately does not parse nested Markdown. */
export function matchMarkdownFenceLine(line: string): MarkdownFenceLine | null {
  const match = /^([\t ]*)(`{3,}|~{3,})([^\r\n]*)\r?$/.exec(line);
  if (!match) return null;
  const run = match[2]!;
  const info = match[3]!;
  if (run[0] === '`' && info.includes('`')) return null;
  return { char: run[0] as '`' | '~', length: run.length, indent: match[1]!.length, info };
}

interface Tick { start: number; end: number; escaped: boolean }

/** A text-only scanner: source bytes are never normalized, interpreted as HTML, or discarded. */
export class MarkdownFallbackCodeScanner {
  private source = '';
  private lineStart = 0;
  private scannedTo = 0;
  private proseStart = 0;
  private blockStart = 0;
  private fence: MarkdownFenceLine | null = null;
  private blocks = 0;
  private inlines = 0;
  private ticks: Tick[] = [];
  private activeTick: Tick | null = null;
  private slashes = 0;
  private tailPairs: Array<readonly [number, number]> = [];
  private pendingTick = 0;
  private readonly committed: MarkdownFallbackSegment[] = [];
  private lastResult: readonly MarkdownFallbackSegment[] | null = null;
  private examined = 0;
  private probe: 'indent' | 'ticks' | 'tildes' | 'info' | 'invalid' = 'indent';
  private probeMarker = '';
  private probeCount = 0;
  private probeIndent = 0;

  get scannedCodeUnits(): number { return this.examined; }

  reset(): void {
    this.source = '';
    this.lineStart = this.scannedTo = this.proseStart = this.blockStart = 0;
    this.fence = null;
    this.blocks = this.inlines = this.examined = 0;
    this.ticks = [];
    this.activeTick = null;
    this.slashes = 0;
    this.tailPairs = [];
    this.pendingTick = 0;
    this.committed.length = 0;
    this.lastResult = null;
    this.resetProbe();
  }

  segments(content: string): readonly MarkdownFallbackSegment[] | null {
    if (content === this.source) return this.lastResult;
    if (!content.startsWith(this.source)) this.reset();
    this.source = content;
    while (this.scannedTo < content.length) {
      const at = this.scannedTo++;
      const character = content[at]!;
      this.examined++;
      if (character === '\n') {
        this.finishTick();
        this.finishLine(at + 1);
        continue;
      }
      this.probeCharacter(character);
      if (character === '`') {
        if (this.activeTick) this.activeTick.end = at + 1;
        else this.activeTick = { start: at, end: at + 1, escaped: this.slashes % 2 === 1 };
      } else this.finishTick();
      this.slashes = character === '\\' ? this.slashes + 1 : 0;
    }
    const result = [...this.committed];
    const add = (kind: MarkdownFallbackSegmentKind, start: number, end: number): void => {
      if (end > start) result.push({ kind, text: content.slice(start, end) });
    };
    if (this.fence) add('block', this.blockStart, content.length);
    else {
      const tentative = this.blocks < MARKDOWN_FALLBACK_BLOCK_RUN_MAX && this.probe !== 'invalid' && this.probeCount >= 3;
      if (tentative) {
        add('prose', this.proseStart, this.lineStart);
        add('block', this.lineStart, content.length);
      } else {
        let start = this.proseStart;
        const pendingFence = this.blocks < MARKDOWN_FALLBACK_BLOCK_RUN_MAX && this.probe !== 'invalid' && this.probe !== 'info' && this.probeCount < 3;
        if (!pendingFence) for (const [open, end] of this.tailPairs) {
          add('prose', start, open);
          add('inline', open, end);
          start = end;
        }
        add('prose', start, content.length);
      }
    }
    this.lastResult = result.some(({ kind }) => kind !== 'prose') ? result : null;
    return this.lastResult;
  }

  private resetProbe(): void {
    this.probe = 'indent';
    this.probeMarker = '';
    this.probeCount = this.probeIndent = 0;
  }

  private probeCharacter(character: string): void {
    if (this.probe === 'invalid') return;
    if (this.probe === 'indent') {
      if (character === ' ' || character === '\t') {
        if (++this.probeIndent >= MARKDOWN_FALLBACK_FENCE_PROBE) this.probe = 'invalid';
        return;
      }
      if (character !== '`' && character !== '~') { this.probe = 'invalid'; return; }
      this.probeMarker = character;
      this.probe = character === '`' ? 'ticks' : 'tildes';
    }
    if (this.probe === 'ticks' || this.probe === 'tildes') {
      if (character === this.probeMarker) { this.probeCount++; return; }
      if (this.probeCount < 3) { this.probe = 'invalid'; return; }
      this.probe = 'info';
    }
    if (this.probeMarker === '`' && character === '`') this.probe = 'invalid';
  }

  private finishTick(): void {
    const tick = this.activeTick;
    if (!tick) return;
    this.activeTick = null;
    this.ticks.push(tick);
    if (this.fence || this.inlines + this.tailPairs.length >= MARKDOWN_FALLBACK_INLINE_RUN_MAX) return;
    // Partial lines stop at the first unmatched opener. Once its closer terminates, the pair is final.
    while (this.pendingTick < this.ticks.length) {
      const opener = this.ticks[this.pendingTick]!;
      const open = opener.start + (opener.escaped ? 1 : 0);
      if (open === opener.end) { this.pendingTick++; continue; }
      if (tick === opener || tick.end - tick.start !== opener.end - open) return;
      this.tailPairs.push([open, tick.end]);
      this.pendingTick = this.ticks.length;
    }
  }

  private commit(kind: MarkdownFallbackSegmentKind, start: number, end: number): void {
    if (end > start) this.committed.push({ kind, text: this.source.slice(start, end) });
  }

  private finishLine(end: number): void {
    const line = this.source.slice(this.lineStart, end - 1);
    this.examined += line.length;
    const match = matchMarkdownFenceLine(line);
    if (this.fence) {
      if (match?.char === this.fence.char && match.length >= this.fence.length && !match.info.trim()) {
        this.commit('block', this.blockStart, end);
        this.blocks++;
        this.fence = null;
        this.proseStart = end;
      }
    } else if (match && this.blocks < MARKDOWN_FALLBACK_BLOCK_RUN_MAX) {
      this.commit('prose', this.proseStart, this.lineStart);
      this.blockStart = this.lineStart;
      this.fence = match;
    } else {
      // Reverse indices make unmatched-opener handling linear even with many different run lengths.
      const next = new Map<number, number>();
      const closers = new Map<number, number>();
      for (let i = this.ticks.length - 1; i >= 0; i--) {
        const tick = this.ticks[i]!;
        const length = tick.end - tick.start - (tick.escaped ? 1 : 0);
        const closer = next.get(length);
        if (closer !== undefined) closers.set(i, closer);
        next.set(tick.end - tick.start, i);
      }
      for (let i = 0; i < this.ticks.length && this.inlines < MARKDOWN_FALLBACK_INLINE_RUN_MAX; i++) {
        const closer = closers.get(i);
        if (closer === undefined) continue;
        const opener = this.ticks[i]!;
        const start = opener.start + (opener.escaped ? 1 : 0);
        this.commit('prose', this.proseStart, start);
        this.proseStart = this.ticks[closer]!.end;
        this.commit('inline', start, this.proseStart);
        this.inlines++;
        i = closer;
      }
    }
    this.lineStart = end;
    this.ticks = [];
    this.tailPairs = [];
    this.pendingTick = 0;
    this.slashes = 0;
    this.resetProbe();
  }
}

/** One-shot reference entry, with the same prefix-only classification as a streaming scanner. */
export function segmentMarkdownFallback(content: string): readonly MarkdownFallbackSegment[] | null {
  return new MarkdownFallbackCodeScanner().segments(content);
}

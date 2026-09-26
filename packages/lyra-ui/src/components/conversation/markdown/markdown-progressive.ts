import { Slugger } from '../../../internal/slugger.js';
import type { MarkdownCodeBlockRecord } from './markdown-code-header.js';
import type { MarkdownParserCapabilities, MarkdownLexicalState, MarkdownDefinition, MarkdownLexToken, MarkdownHeadingItem, PendingHighlight } from './markdown-shared.js';

const MARKDOWN_PROGRESSIVE_GROUP_TARGET = 2048;
const MARKDOWN_PROGRESSIVE_GROUP_RENDERS_PER_FRAME = 32;
const MARKDOWN_PROGRESSIVE_COMMIT_MAX = 65_536;
const MARKDOWN_PROGRESSIVE_BLOCK_MAX = 2000;
const MARKDOWN_PROGRESSIVE_HOLD_MAX = 32_768;
const MARKDOWN_PROGRESSIVE_HIGHLIGHT_MAX = 8192;
const MARKDOWN_PROGRESSIVE_REF_RECOMPUTE_MAX = 8;

type Definitions = Record<string, MarkdownDefinition>;
export interface MarkdownProgressiveRender {
  html: string;
  rawHtml: string;
  state: MarkdownLexicalState;
  hasRawHtml: boolean;
  hadMathFallback: boolean;
  headings: MarkdownHeadingItem[];
  codeBlocks: MarkdownCodeBlockRecord[];
  pendingKeys: PendingHighlight[];
}
export interface MarkdownProgressiveBlock extends MarkdownProgressiveRender {
  source: string;
  start: number;
  end: number;
  evidenceEnd: number;
  eofOnly: boolean;
  balanced: boolean;
  seedState: MarkdownLexicalState;
}
export interface MarkdownProgressiveOptions {
  parser: MarkdownParserCapabilities;
  gfm: boolean;
  tabSize: number;
  render(source: string, rawSource: string, links: Definitions, state: MarkdownLexicalState, slugger: Slugger, prefix: readonly MarkdownCodeBlockRecord[]): MarkdownProgressiveRender;
}
export interface MarkdownProgressiveStats {
  frames: number; lexedUnits: number; committedUnits: number; groupRenders: number;
  recomputes: number; stalls: number; highlightDispatches: number;
}
interface Candidate { start: number; end: number; eofOnly: boolean }

/** Tests effective per-render configuration, never mutating the parser's defaults. */
export function markdownProgressiveEligible(parser: MarkdownParserCapabilities, gfm: boolean): boolean {
  if (typeof parser.Lexer !== 'function' || typeof parser.parser !== 'function' || typeof parser.walkTokens !== 'function') return false;
  const defaults = parser.defaults;
  if (defaults['pedantic'] === true || defaults['async'] === true) return false;
  const extensions = defaults['extensions'] as { block?: unknown[]; startBlock?: unknown[] } | undefined;
  if (extensions?.block?.length || extensions?.startBlock?.length) return false;
  for (const [name, constructor] of [['tokenizer', parser.Tokenizer], ['hooks', parser.Hooks]] as const) {
    const value = defaults[name];
    if (value == null) continue;
    if (typeof value !== 'object' || Object.values(value).some((entry) => typeof entry === 'function')) return false;
    if (constructor && value.constructor !== constructor) return false;
  }
  try {
    const probe = new parser.Lexer({ ...defaults, gfm, async: false });
    return Boolean(probe.tokens?.links && probe.state && typeof probe.blockTokens === 'function' && typeof probe.options.tokenizer?.def === 'function');
  } catch { return false; }
}

/** Incremental line normalization with a withheld CR and raw/normalized line-boundary mapping. */
class NormalizedSource {
  raw = '';
  text = '';
  completeEnd = 0;
  displayEnd = 0;
  private processed = 0;
  private column = 0;
  private leading = true;
  private lineHasText = false;
  private readonly starts: Array<readonly [number, number]> = [[0, 0]];
  constructor(private readonly tabSize: number) {}
  append(raw: string, eof = false): void {
    this.raw = raw;
    let appended = '';
    for (let i = this.processed; i < raw.length; i++) {
      const character = raw[i]!;
      if (character === '\r' && i === raw.length - 1 && !eof) break;
      if (character === '\r' || character === '\n') {
        if (character === '\r' && raw[i + 1] === '\n') i++;
        appended += '\n';
        this.completeEnd = this.text.length + appended.length;
        if (this.lineHasText) this.displayEnd = this.completeEnd;
        this.lineHasText = false;
        this.column = 0;
        this.leading = true;
        this.starts.push([this.completeEnd, i + 1]);
      } else {
        if (this.leading && (character === ' ' || character === '\t')) {
          const count = character === '\t' ? this.tabSize - this.column % this.tabSize : 1;
          appended += ' '.repeat(count);
          this.column += count;
        } else {
          appended += character;
          this.leading = character === '\u2028' || character === '\u2029';
          if (this.leading) this.column = 0;
        }
        if (!/\s/.test(character)) this.lineHasText = true;
        if (this.lineHasText) this.displayEnd = this.text.length + appended.length;
      }
      this.processed = i + 1;
    }
    this.text += appended;
  }
  rawOffset(offset: number): number {
    let low = 0, high = this.starts.length;
    while (low + 1 < high) {
      const middle = (low + high) >>> 1;
      if (this.starts[middle]![0] <= offset) low = middle; else high = middle;
    }
    const [normalized, raw] = this.starts[low]!;
    if (offset === normalized) return raw;
    // Groups end at line starts except EOF; the latter maps to all remaining raw input.
    return offset === this.text.length ? this.raw.length : raw + offset - normalized;
  }
}

function decisive(line: string): boolean {
  const match = /^( *)(\S)/.exec(line);
  return Boolean(match && (match[1]!.length >= 4 || !/[#>*+\-=_`~<|["'(\d]/.test(match[2]!)));
}

function fence(source: string): { run: string; indent: number; end: number; backtick: boolean } | null {
  const match = /^( {0,3})(`{3,}|~{3,})([^\n]*)\n/.exec(source);
  if (!match || (match[2]![0] === '`' && match[3]!.includes('`'))) return null;
  return { run: match[2]!, indent: match[1]!.length, end: match[0].length, backtick: match[2]![0] === '`' };
}
function hasFenceClose(source: string, completeEnd = source.length): boolean {
  const opening = fence(source);
  if (!opening) return false;
  const pattern = new RegExp(`^ {0,3}${opening.run}[~\x60]* *$`, 'm');
  return pattern.test(source.slice(opening.end, completeEnd).replace(/[^\n]*$/, ''));
}

/** A conservative HTML tokenizer used before sanitizing independently-rendered groups. */
export function markdownHtmlBalanced(html: string): boolean {
  const stack: string[] = [];
  const voids = /^(?:area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr|basefont|bgsound|frame|keygen|param)$/;
  let cursor = 0;
  while (cursor < html.length) {
    const raw = stack.at(-1);
    if (raw && /^(?:script|style|textarea|title|xmp|iframe|noembed|noframes|noscript|plaintext)$/.test(raw)) {
      if (raw === 'plaintext') return false;
      const closing = new RegExp(`</${raw}(?=[\\s>])`, 'ig');
      closing.lastIndex = cursor;
      const match = closing.exec(html);
      if (!match) return false;
      cursor = match.index;
    } else {
      cursor = html.indexOf('<', cursor);
      if (cursor < 0) break;
    }
    if (html.startsWith('<!--', cursor)) {
      const end = html.indexOf('-->', cursor + 4);
      if (end < 0) return false;
      cursor = end + 3;
      continue;
    }
    if (/^[!?]/.test(html[cursor + 1] ?? '')) {
      const end = html.indexOf('>', cursor + 2);
      if (end < 0) return false;
      cursor = end + 1;
      continue;
    }
    const tag = /^<\/?([a-z][\w:-]*)/i.exec(html.slice(cursor));
    if (!tag) { cursor++; continue; }
    const name = tag[1]!.toLowerCase();
    let quote = '', end = cursor + tag[0].length;
    for (; end < html.length; end++) {
      const character = html[end]!;
      if (quote) { if (character === quote) quote = ''; }
      else if (character === '"' || character === '\x27') quote = character;
      else if (character === '>') break;
    }
    if (end === html.length) return false;
    if (html[cursor + 1] === '/') {
      const index = stack.lastIndexOf(name);
      if (index >= 0) stack.splice(index, 1);
    } else if (!voids.test(name) && !(html[end - 1] === '/' && (stack.includes('svg') || stack.includes('math') || name === 'svg' || name === 'math'))) stack.push(name);
    cursor = end + 1;
  }
  return stack.length === 0;
}

function definitionHeld(source: string, tokenize?: (source: string) => MarkdownLexToken | undefined): boolean {
  const opener = /^ {0,3}\[(?!\s*\])(?:\\[\s\S]|[^\[\]\\])+\]: *(?:\n[ \t]*)?(?:[^<\s][^\s]*|<.*?>)(?: +(?:\n[ \t]*)?| *\n[ \t]*)(["'(])/.exec(source);
  if (!opener) return false;
  const token = tokenize?.(source);
  if (token && token.title != null) return false;
  const complete = source.slice(opener[0].length, source.lastIndexOf('\n') + 1);
  return opener[1] === '"' ? !/(^|[^\\])"/.test(complete)
    : opener[1] === '(' ? !/[()]/.test(complete) : !/'|\n\n/.test(complete);
}

/** A bounded, append-aware document session. Only immutable groups enter its public block list. */
export class MarkdownProgressiveSession {
  readonly blocks: MarkdownProgressiveBlock[] = [];
  readonly stats: MarkdownProgressiveStats = { frames: 0, lexedUnits: 0, committedUnits: 0, groupRenders: 0, recomputes: 0, stalls: 0, highlightDispatches: 0 };
  private normalized: NormalizedSource;
  private committedEnd = 0;
  private definitions: Definitions = Object.create(null) as Definitions;
  private committedDefinitions: Definitions = Object.create(null) as Definitions;
  private definitionChanges = 0;
  private deferredDefinitions = false;
  private plan: Candidate[] = [];
  private planIndex = 0;
  private lastLexEnd = -1;
  private lastLexStart = -1;
  private lastLexSize = 0;
  private lastCompleteEnd = -1;
  private lastDecisive = false;
  private fenceScan?: { start: number; end: number; closed: boolean };
  private hintsEnabled = true;
  private waitForInput = false;
  private frozen = false;
  private eof = false;
  private recomputeFrom?: number;
  private slugger = new Slugger();
  private sluggerDirty = false;
  private readonly invalidated = new Set<number>();
  private readonly highlightQueue = new Map<string, PendingHighlight>();
  private readonly memo = new Map<string, { result: MarkdownProgressiveRender; slugger: Slugger }>();
  private readonly replayEnds: readonly number[];

  constructor(private readonly options: MarkdownProgressiveOptions, replay?: readonly MarkdownProgressiveBlock[]) {
    this.normalized = new NormalizedSource(options.tabSize);
    this.replayEnds = replay?.map((block) => block.end) ?? [];
  }
  get source(): string { return this.normalized.raw; }
  get end(): number { return this.committedEnd; }
  get failed(): boolean { return this.frozen; }
  get records(): MarkdownCodeBlockRecord[] { return this.blocks.flatMap((block) => block.codeBlocks); }
  get headings(): MarkdownHeadingItem[] { return this.blocks.flatMap((block) => block.headings); }
  get pending(): boolean { return !this.frozen && (!this.waitForInput && this.planIndex < this.plan.length || this.recomputeFrom !== undefined || this.highlightQueue.size > 0); }

  update(source: string): void {
    if (source === this.source) return;
    if (!source.startsWith(this.source)) {
      const previousDefinitions = JSON.stringify(this.definitions);
      let low = 0, high = Math.min(source.length, this.source.length) + 1;
      while (low + 1 < high) {
        const middle = (low + high) >>> 1;
        if (source.startsWith(this.source.slice(0, middle))) low = middle; else high = middle;
      }
      const keep = this.blocks.findIndex((block) => block.evidenceEnd > low);
      if (keep >= 0) this.blocks.length = keep;
      this.committedEnd = this.blocks.at(-1)?.end ?? 0;
      this.sluggerDirty = true;
      this.normalized = new NormalizedSource(this.options.tabSize);
      this.definitions = Object.create(null) as Definitions;
      this.committedDefinitions = Object.create(null) as Definitions;
      this.definitionChanges = 0;
      this.deferredDefinitions = false;
      this.memo.clear();
      this.frozen = false;
      this.lastLexEnd = this.lastCompleteEnd = -1;
      this.normalized.append(source);
      if (this.committedEnd) {
        const lexer = this.lexer();
        lexer.blockTokens(this.normalized.text.slice(0, this.committedEnd), lexer.tokens);
        Object.assign(this.definitions, lexer.tokens.links);
        Object.assign(this.committedDefinitions, lexer.tokens.links);
      }
      if (previousDefinitions !== JSON.stringify(this.definitions)) {
        this.blocks.forEach((block, index) => { if (block.source.includes('[')) this.invalidate(index); });
      }
      this.plan = [];
      this.planIndex = 0;
    } else this.normalized.append(source);
    if (this.waitForInput) { this.plan = []; this.planIndex = 0; }
    // Safe candidates already waiting behind a frame budget remain valid after an append.
    // Keeping them also avoids re-lexing a long partial line for each arriving character.
    this.waitForInput = false;
  }

  resume(): void {
    const eofIndex = this.blocks.findIndex((block) => block.eofOnly);
    if (eofIndex >= 0) this.blocks.length = eofIndex;
    this.committedEnd = this.blocks.at(-1)?.end ?? 0;
    if (eofIndex >= 0) {
      const previousDefinitions = JSON.stringify(this.definitions);
      const lexer = this.lexer();
      lexer.blockTokens(this.normalized.text.slice(0, this.committedEnd), lexer.tokens);
      this.committedDefinitions = { ...lexer.tokens.links };
      this.definitions = { ...this.committedDefinitions };
      if (previousDefinitions !== JSON.stringify(this.definitions)) {
        this.blocks.forEach((block, index) => { if (block.source.includes('[')) this.invalidate(index); });
      }
    }
    this.sluggerDirty = true;
    this.eof = false;
    this.plan = [];
    this.planIndex = 0;
    this.lastLexEnd = this.lastCompleteEnd = -1;
    this.waitForInput = false;
  }

  invalidateHighlights(keys: readonly string[]): void {
    const wanted = new Set(keys);
    this.blocks.forEach((block, index) => {
      if (block.pendingKeys.some(({ key }) => wanted.has(key))) this.invalidate(index);
    });
    this.memo.clear();
  }
  invalidateMath(): void {
    this.blocks.forEach((block, index) => { if (block.hadMathFallback) this.invalidate(index); });
    this.memo.clear();
  }
  private invalidate(index: number): void {
    this.invalidated.add(index);
    this.recomputeFrom = Math.min(this.recomputeFrom ?? index, index);
    this.sluggerDirty = true;
  }
  nextHighlight(): PendingHighlight | undefined {
    const entry = this.highlightQueue.entries().next().value as [string, PendingHighlight] | undefined;
    if (!entry) return undefined;
    this.highlightQueue.delete(entry[0]);
    this.stats.highlightDispatches++;
    return entry[1];
  }

  private lexer() {
    return new this.options.parser.Lexer({ ...this.options.parser.defaults, gfm: this.options.gfm, async: false });
  }

  private preparePlan(eof: boolean): void {
    const source = this.normalized.text;
    const start = this.committedEnd;
    if (start !== this.lastLexStart) {
      this.lastLexStart = start;
      this.lastLexEnd = start;
      this.lastLexSize = 0;
      this.lastCompleteEnd = -1;
      this.fenceScan = undefined;
    }
    const completeEnd = this.normalized.completeEnd;
    const partial = source.slice(completeEnd);
    const isDecisive = decisive(partial);
    const end = eof || isDecisive ? source.length : completeEnd;
    const size = end - start;
    if (!eof && completeEnd === this.lastCompleteEnd && isDecisive === this.lastDecisive) return;
    const delta = source.slice(Math.max(start, this.lastLexEnd));
    const hint = this.hintsEnabled && /\n[ \t]*\n(?![*+-](?:\s|$)|\d{1,9}[.)](?:\s|$))[^\s]/.test(delta);
    const tail = source.slice(start, end);
    const opening = fence(tail);
    let justClosed = false;
    if (opening) {
      if (this.fenceScan?.start !== start) this.fenceScan = { start, end: start + opening.end, closed: false };
      const scan = this.fenceScan;
      const pattern = new RegExp(`^ {0,3}${opening.run}[~\x60]* *$`, 'm');
      if (!scan.closed && completeEnd > scan.end) {
        scan.closed = pattern.test(source.slice(scan.end, completeEnd).replace(/[^\n]*$/, ''));
        justClosed = scan.closed;
        scan.end = completeEnd;
      }
      if (!eof && this.lastLexEnd >= start + opening.end && !scan.closed) {
        this.lastCompleteEnd = completeEnd;
        this.lastDecisive = isDecisive;
        return;
      }
    }
    if (!eof && !justClosed && size > 16_384 && size < this.lastLexSize * 1.25 && size - this.lastLexSize < 16_384 && !hint) return;
    this.lastCompleteEnd = completeEnd;
    this.lastDecisive = isDecisive;
    this.lastLexEnd = end;
    this.lastLexSize = size;
    this.stats.lexedUnits += tail.length;
    const lexer = this.lexer();
    lexer.blockTokens(tail, lexer.tokens);
    const tokens = lexer.tokens;
    const tokenEnds: number[] = [];
    let offset = 0;
    for (const token of tokens) {
      while (!tail.startsWith(token.raw, offset)) {
        const duplicate = lexer.options.tokenizer?.def?.(tail.slice(offset));
        if (duplicate?.raw && typeof duplicate['tag'] === 'string' && lexer.tokens.links[duplicate['tag']]) offset += duplicate.raw.length;
        else { this.stats.stalls++; return; }
      }
      offset += token.raw.length;
      tokenEnds.push(offset);
    }
    let last = tokens.length - 1;
    while (last >= 0 && tokens[last]!.type === 'space') last--;
    const plan: Candidate[] = [];
    let groupStart = start;
    let definitionBoundary: number | undefined;
    for (let index = 0; index <= last; index++) {
      const token = tokens[index]!;
      if (token.type === 'space') continue;
      const tokenEnd = tokenEnds[index]!;
      let after = index + 1;
      while (after < tokens.length && tokens[after]!.type === 'space') after++;
      const followed = after < tokens.length;
      const rawStart = tokenEnd - token.raw.length;
      const onCompleteLine = start + tokenEnd <= completeEnd;
      let closed = onCompleteLine && (token.type === 'heading' || token.type === 'hr' || token.type === 'code' && hasFenceClose(token.raw));
      if (!closed && /^(?:paragraph|table|blockquote|def|html)$/.test(token.type)) {
        const htmlOpen = token.type === 'html' && /^ {0,3}(?:<(?:script|pre|style|textarea)[\s>]|<!--|<\?|<![A-Z]|<!\[CDATA\[)/i.test(token.raw);
        const nextStart = tail[tokenEnd - 1] === '\n' ? tokenEnd : tail.indexOf('\n', tokenEnd) + 1;
        const nextEnd = nextStart > 0 ? tail.indexOf('\n', nextStart) : -1;
        closed = !htmlOpen && nextEnd >= 0 && /^[\t ]*$/.test(tail.slice(nextStart, nextEnd));
      }
      const held = !eof && tail.length - rawStart < MARKDOWN_PROGRESSIVE_HOLD_MAX && definitionHeld(tail.slice(rawStart), lexer.options.tokenizer?.def?.bind(lexer.options.tokenizer));
      if (held) { definitionBoundary = rawStart; break; }
      if (!eof && !followed && !closed) break;
      const groupEnd = start + (after > index + 1 ? tokenEnds[after - 1]! : tokenEnd);
      plan.push({ start: groupStart, end: groupEnd, eofOnly: !followed && !closed });
      groupStart = groupEnd;
    }
    if (eof && groupStart < source.length) plan.push({ start: groupStart, end: source.length, eofOnly: true });
    // Definitions in the unsettled suffix are provisional: a title may begin on its next line.
    // Only a definition inside a committed group wins permanently over later duplicates.
    const nextLinks = { ...this.committedDefinitions };
    let links = tokens.links;
    if (definitionBoundary !== undefined && !eof) {
      const prefixLexer = this.lexer();
      prefixLexer.blockTokens(tail.slice(0, definitionBoundary), prefixLexer.tokens);
      links = prefixLexer.tokens.links;
    }
    for (const [label, value] of Object.entries(links)) if (!(label in nextLinks)) nextLinks[label] = value;
    if (JSON.stringify(nextLinks) !== JSON.stringify(this.definitions)) {
      this.definitions = nextLinks;
      this.memo.clear();
      this.definitionChanges++;
      if (eof || this.definitionChanges <= MARKDOWN_PROGRESSIVE_REF_RECOMPUTE_MAX) {
        this.blocks.forEach((block, index) => { if (block.source.includes('[')) this.invalidate(index); });
      } else this.deferredDefinitions = true;
    }
    this.plan = plan;
    this.planIndex = 0;
    this.hintsEnabled = !hint || plan.length > 0;
  }

  step(eof = false, unlimited = false, untilEnd = Infinity): void {
    if (this.frozen) return;
    this.stats.frames++;
    if (eof) {
      this.eof = true;
      this.normalized.append(this.source, true);
      this.plan = [];
      this.planIndex = 0;
      this.lastCompleteEnd = -1;
      if (this.deferredDefinitions) this.blocks.forEach((block, index) => { if (block.source.includes('[')) this.invalidate(index); });
    }
    const limit = eof || unlimited ? Infinity : MARKDOWN_PROGRESSIVE_GROUP_RENDERS_PER_FRAME;
    let rendered = 0, committed = 0;
    try {
      if (this.planIndex >= this.plan.length) this.preparePlan(eof);
      if (this.sluggerDirty) {
        this.slugger = new Slugger();
        const end = this.recomputeFrom ?? this.blocks.length;
        for (let index = 0; index < end; index++) {
          for (const heading of this.blocks[index]!.headings) this.slugger.slug(heading.label);
        }
        this.sluggerDirty = false;
      }
      while (this.recomputeFrom !== undefined && rendered < limit) {
        const index = this.recomputeFrom;
        this.recomputeFrom = index + 1 < this.blocks.length ? index + 1 : undefined;
        const old = this.blocks[index];
        if (!old) continue;
        const previous = this.blocks[index - 1];
        const state = previous?.state ?? { inLink: false, inRawBlock: false };
        const slugger = this.slugger;
        let changedSlug = false;
        const replay = slugger.clone();
        for (const heading of old.headings) if (replay.slug(heading.label) !== heading.id) changedSlug = true;
        const changedState = old.seedState.inLink !== state.inLink || old.seedState.inRawBlock !== state.inRawBlock;
        if (!this.invalidated.delete(index) && !changedSlug && !changedState) {
          this.slugger = replay;
          continue;
        }
        const prefix = this.blocks.slice(0, index).flatMap((block) => block.codeBlocks);
        const result = this.options.render(old.source, this.rawSlice(old.start, old.end), this.definitions, state, slugger, prefix);
        this.blocks[index] = { ...old, ...result, seedState: { ...state } };
        rendered++;
        this.stats.groupRenders++;
        this.stats.recomputes++;
      }
      while (this.planIndex < this.plan.length && rendered < limit && this.committedEnd < untilEnd) {
        if (this.blocks.length >= MARKDOWN_PROGRESSIVE_BLOCK_MAX) { this.frozen = true; break; }
        const first = this.plan[this.planIndex]!;
        let lastIndex = this.planIndex;
        const replayEnd = this.replayEnds[this.blocks.length];
        while (lastIndex + 1 < this.plan.length) {
          const next = this.plan[lastIndex + 1]!;
          if (replayEnd !== undefined ? next.end > replayEnd : next.end - first.start > MARKDOWN_PROGRESSIVE_GROUP_TARGET) break;
          lastIndex++;
        }
        let finished = false;
        while (lastIndex < this.plan.length && rendered < limit) {
          const last = this.plan[lastIndex]!;
          const source = this.normalized.text.slice(first.start, last.end);
          if (!eof && !unlimited && committed > 0 && committed + source.length > MARKDOWN_PROGRESSIVE_COMMIT_MAX) return;
          const previous = this.blocks.at(-1);
          const state = previous?.state ?? { inLink: false, inRawBlock: false };
          const sluggerBefore = this.slugger;
          const key = `${first.start}:${last.end}`;
          let cached = this.memo.get(key);
          if (!cached) {
            const slugger = sluggerBefore.clone();
            const result = this.options.render(source, this.rawSlice(first.start, last.end), this.definitions, state, slugger, this.records);
            cached = { result, slugger };
            this.memo.set(key, cached);
            rendered++;
            this.stats.groupRenders++;
          }
          const balanced = markdownHtmlBalanced(cached.result.rawHtml);
          if (!eof && !balanced && source.length < MARKDOWN_PROGRESSIVE_HOLD_MAX) { lastIndex++; continue; }
          const block: MarkdownProgressiveBlock = {
            ...cached.result, source, start: first.start, end: last.end, evidenceEnd: this.source.length,
            eofOnly: this.plan.slice(this.planIndex, lastIndex + 1).some((candidate) => candidate.eofOnly),
            balanced, seedState: { ...state },
          };
          this.blocks.push(block);
          this.slugger = cached.slugger;
          // Only held candidates need a memo. Committed groups retain their HTML and heading
          // ledger, so keeping a full slug snapshot for every group would grow quadratically.
          this.memo.clear();
          const definitionLexer = this.lexer();
          definitionLexer.blockTokens(source, definitionLexer.tokens);
          this.stats.lexedUnits += source.length;
          for (const [label, value] of Object.entries(definitionLexer.tokens.links)) {
            if (!(label in this.committedDefinitions)) this.committedDefinitions[label] = value;
          }
          this.committedEnd = last.end;
          committed += source.length;
          this.stats.committedUnits += source.length;
          for (const pending of block.pendingKeys) if (pending.code.length <= MARKDOWN_PROGRESSIVE_HIGHLIGHT_MAX) this.highlightQueue.set(pending.key, pending);
          this.planIndex = lastIndex + 1;
          if (this.planIndex === this.plan.length) this.lastCompleteEnd = -1;
          this.waitForInput = false;
          finished = true;
          break;
        }
        if (!finished) { this.waitForInput = lastIndex >= this.plan.length; break; }
      }
    } catch { this.frozen = true; }
  }

  private rawSlice(start: number, end: number): string {
    return this.source.slice(this.normalized.rawOffset(start), this.normalized.rawOffset(end));
  }

  get tail(): { kind: 'text' | 'open-fence'; text: string } | null {
    const tail = this.normalized.text.slice(this.committedEnd);
    if (!tail || this.eof) return null;
    const opening = !this.frozen && fence(tail);
    const closed = this.fenceScan?.start === this.committedEnd ? this.fenceScan.closed : hasFenceClose(tail);
    if (opening && !closed) {
      let text = tail.slice(opening.end);
      if (opening.backtick && opening.indent) text = text.replace(new RegExp(`^ {0,${opening.indent}}`, 'gm'), '');
      return { kind: 'open-fence', text };
    }
    const text = this.normalized.text.slice(this.committedEnd, Math.max(this.committedEnd, this.normalized.displayEnd));
    return text ? { kind: 'text', text } : null;
  }
}

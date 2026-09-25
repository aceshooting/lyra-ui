/** The small block-token shape used from marked's optional lexer. */
export interface MarkdownBlockToken {
  type?: string;
  raw: string;
  lang?: string;
}

export type MarkdownBlockLexer = (source: string) => readonly MarkdownBlockToken[];

export interface MarkdownStreamingSnapshot {
  /** All immutable block source accumulated in this stream generation. */
  settledBlocks: readonly string[];
  /** Blocks newly added to the immutable prefix by this update. */
  newSettledBlocks: readonly string[];
  /** The one lexer tail that remains mutable as more text arrives. */
  tail: string;
  /** Reference definitions seen in this stream, prepended when parsing isolated blocks. */
  definitions: readonly string[];
  /** True when the caller replaced an earlier source rather than appending to it. */
  reset: boolean;
}

/**
 * Keeps Markdown block lexing bounded to the unfinished tail. The caller gives this class the
 * complete source on each property update; on an append it lexes only the previous tail plus the
 * new suffix, then moves lexer-confirmed blocks into a stable prefix. Lists, tables, block quotes,
 * and fenced blocks remain indivisible because marked returns them as top-level block tokens.
 */
export class MarkdownStreamingBuffer {
  private source = '';
  private tail = '';
  private readonly settled: string[] = [];
  private readonly definitions: string[] = [];

  update(source: string, lex: MarkdownBlockLexer): MarkdownStreamingSnapshot {
    // Marked normalizes CRLF and CR in token.raw. Use that same canonical source for offsets and
    // parsing so line-ending variants cannot cut the wrong UTF-16 boundary.
    source = source.replace(/\r\n?/g, '\n');
    const reset = !source.startsWith(this.source);
    if (reset) this.reset();
    const appended = source.slice(this.source.length);
    this.source = source;
    this.tail += appended;

    let tokens: readonly MarkdownBlockToken[];
    try {
      tokens = lex(this.tail);
    } catch {
      // A configured marked extension can throw during lexing. Keep the text visible and retry
      // from the current source on the next update rather than retaining a partially trusted tree.
      this.reset();
      this.source = source;
      this.tail = source;
      return this.snapshot([], true);
    }

    let settledCount = countSettledTokens(tokens);
    for (let index = 0; index < settledCount; index++) {
      const token = tokens[index];
      if (token?.type === 'def' && token.raw && !this.definitions.includes(token.raw)) {
        this.definitions.push(token.raw);
      }
    }
    for (let index = 0; index < settledCount; index++) {
      const token = tokens[index];
      if (token?.type !== 'code' && hasUnresolvedReference(token?.raw ?? '', this.definitions)) {
        settledCount = index;
        break;
      }
    }
    const added: string[] = [];
    let consumed = 0;
    for (let index = 0; index < settledCount; index++) {
      const raw = tokens[index]?.raw;
      if (typeof raw !== 'string' || raw.length === 0) continue;
      added.push(raw);
      consumed += raw.length;
    }
    const committedSource = added.join('');
    // Marked's `raw` is meant to be a source slice. Fail closed to a visible mutable tail if a
    // peer extension returns normalized or synthetic token text that cannot safely index the
    // caller's canonical UTF-16 source.
    if (committedSource && !this.tail.startsWith(committedSource)) {
      return this.snapshot([], reset);
    }
    if (consumed > 0) {
      this.settled.push(...added);
      this.tail = this.tail.slice(consumed);
    }
    return this.snapshot(added, reset);
  }

  /** Commits the final tail when streaming ends, allowing the ordinary full parse to take over. */
  finish(): string[] {
    const tail = this.tail;
    if (tail) this.settled.push(tail);
    this.tail = '';
    return [...this.settled];
  }

  reset(): void {
    this.source = '';
    this.tail = '';
    this.settled.length = 0;
    this.definitions.length = 0;
  }

  private snapshot(added: string[], reset: boolean): MarkdownStreamingSnapshot {
    return {
      settledBlocks: [...this.settled],
      newSettledBlocks: added,
      tail: this.tail,
      definitions: [...this.definitions],
      reset,
    };
  }
}

function hasUnresolvedReference(raw: string, definitions: readonly string[]): boolean {
  const available = new Set<string>();
  for (const definition of definitions) {
    const match = /^ {0,3}\[([^\]]+)\]:/m.exec(definition);
    if (match?.[1]) available.add(normalizeReferenceLabel(match[1]));
  }
  const withoutTaskMarkers = raw.replace(/^[ \t]*(?:[-*+]\s+|\d+[.)]\s+)\[[ xX]\][ \t]+/gm, '');
  const withoutInlineCode = withoutTaskMarkers.replace(/(`+)[^`\n]*\1/g, '');
  const references = [
    /!?\[([^\]]+)\]\[([^\]]*)\]/g,
    /!?\[([^\]]+)\](?!\s*[\[(])/g,
  ];
  for (const reference of references) for (const match of withoutInlineCode.matchAll(reference)) {
    const label = normalizeReferenceLabel(match[2] || match[1] || '');
    if (label && !available.has(label)) return true;
  }
  return false;
}

function normalizeReferenceLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ').toLowerCase();
}

function countSettledTokens(tokens: readonly MarkdownBlockToken[]): number {
  let lastSubstantive = tokens.length - 1;
  while (lastSubstantive >= 0 && tokens[lastSubstantive]?.type === 'space') lastSubstantive--;
  if (lastSubstantive < 0) return 0;
  const trailingTokens = tokens.slice(lastSubstantive);
  if (
    trailingTokens[0]?.type === 'code' &&
    isClosedFence(trailingTokens.map((token) => token.raw).join(''))
  ) {
    return tokens.length;
  }
  if (lastSubstantive === 0) {
    // A closed fenced block cannot be extended by appended source, so it is safe to commit even
    // while it remains the lexer's last token. An unterminated fence stays in the live tail.
    return isClosedFence(tokens[0]?.raw ?? '') ? 1 : 0;
  }
  const last = tokens[lastSubstantive];
  // Trailing blank lines do not close an extensible list: another list item can follow the blank
  // line and still belong to the same loose list. Keep that token and the separator together.
  const settled = lastSubstantive;
  // A closed final fence is also immutable; otherwise keep the final token alive so paragraph and
  // list continuation remain ordinary Markdown while the stream is in flight.
  return isClosedFence(last?.raw ?? '') ? settled + 1 : settled;
}

function isClosedFence(raw: string): boolean {
  const opener = /^ {0,3}(`{3,}|~{3,})[^\n]*(?:\n|$)/.exec(raw);
  if (!opener?.[1]) return false;
  const marker = opener[1][0];
  const minimum = opener[1].length;
  const close = new RegExp(`^ {0,3}${marker === '`' ? '`' : '~'}{${minimum},}[ \\t]*(?:\\n|$)`, 'm');
  const match = close.exec(raw.slice(opener[0].length));
  return Boolean(match?.[0]?.endsWith('\n'));
}

/** Returns an unfinished fenced block's displayable language and code, if the tail is one. */
export function markdownOpenFence(source: string): { language: string; code: string } | null {
  const match = /^ {0,3}(`{3,}|~{3,})([^\n]*)\n([\s\S]*)$/.exec(source);
  if (!match || isClosedFence(source)) return null;
  const info = match[2]?.trim() ?? '';
  const language = info.split(/\s+/, 1)[0] ?? '';
  return { language, code: match[3] ?? '' };
}

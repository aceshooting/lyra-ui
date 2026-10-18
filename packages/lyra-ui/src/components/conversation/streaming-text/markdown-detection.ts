/**
 * Lightweight, deliberately-imperfect signals that the currently-displayed
 * text contains Markdown syntax worth routing through the composed Markdown
 * renderer rather than a plain `white-space: pre-wrap` node. Checked in order against
 * the whole string; the first match short-circuits. None of these need to be
 * airtight -- a false positive just renders ordinary prose through
 * Markdown mode (which renders plain prose fine); a false negative just
 * renders literal `**`/backticks/etc. as plain text until more of the stream
 * arrives.
 */
export const APPEND_MONOTONIC_MARKDOWN_PATTERNS: readonly RegExp[] = [
  /^ {0,3}#{1,6}\s+\S/m, // ATX heading: "# Heading"
  /```/, // fenced code block
  /\*\*[^*\n]+\*\*/, // **bold**
  /`[^`\n]+`/, // inline code
  /^ {0,3}[-*+]\s+\S/m, // bullet list item
  /^ {0,3}\d+\.\s+\S/m, // numbered list item
  /\[[^\]]+\]\([^)\s]+\)/, // [text](url)
  /^ {0,3}>\s?\S/m, // blockquote
];

// The trailing boundary may be the current end of a stream. Appending a
// word character can therefore invalidate a prior match (`_x_` -> `_x_a`).
export const BOUNDARY_SENSITIVE_MARKDOWN_PATTERNS: readonly RegExp[] = [
  /(?:^|[^\w])_[^_\n]+_(?:[^\w]|$)/, // _italic_
];

/** Runs {@link APPEND_MONOTONIC_MARKDOWN_PATTERNS}/{@link BOUNDARY_SENSITIVE_MARKDOWN_PATTERNS}
 *  against `text`, used whenever `contentMode` is left unset (auto-detect). Exported so the
 *  heuristic is directly testable without going through either variant's render cycle. */
export function looksLikeMarkdown(text: string): boolean {
  if (!text) return false;
  return [...APPEND_MONOTONIC_MARKDOWN_PATTERNS, ...BOUNDARY_SENSITIVE_MARKDOWN_PATTERNS].some((pattern) =>
    pattern.test(text),
  );
}

type CharacterTest = (character: string) => boolean;
type Atom = readonly [CharacterTest, number, number];
interface DetectionState { edges: Array<readonly [CharacterTest, number]>; epsilon: number[] }
const character = (value: string): CharacterTest => input => input === value;
const space: CharacterTest = input => /\s/.test(input);
const nonspace: CharacterTest = input => !space(input);
const atom = (test: CharacterTest, min = 1, max = min): Atom => [test, min, max];

/** Small finite-state matchers retain delimiter state without retaining or rescanning a suffix. */
class MarkdownSignal {
  private states: DetectionState[] = [{ edges: [], epsilon: [] }];
  private active = new Set<number>();
  constructor(atoms: readonly Atom[], readonly start: 'any' | 'line' | 'boundary' = 'any') {
    let current = 0;
    for (const [test, min, max] of atoms) {
      for (let index = 0; index < min; index++) {
        const next = this.states.length; this.states.push({ edges: [], epsilon: [] });
        this.states[current]!.edges.push([test, next]); current = next;
      }
      if (max === Infinity) this.states[current]!.edges.push([test, current]);
      else for (let index = min; index < max; index++) {
        const next = this.states.length; this.states.push({ edges: [], epsilon: [] });
        this.states[current]!.edges.push([test, next]); this.states[current]!.epsilon.push(next); current = next;
      }
    }
  }
  private expand(states: Set<number>): Set<number> {
    for (const state of states) for (const next of this.states[state]!.epsilon) states.add(next);
    return states;
  }
  step(input: string, previous: string | undefined): boolean {
    if (this.start === 'any' || this.start === 'line' && (previous === undefined || /[\n\r\u2028\u2029]/.test(previous)) ||
      this.start === 'boundary' && (previous === undefined || !/\w/.test(previous))) this.active.add(0);
    const next = new Set<number>();
    for (const state of this.expand(this.active)) for (const [test, target] of this.states[state]!.edges) if (test(input)) next.add(target);
    this.active = this.expand(next);
    return this.active.has(this.states.length - 1);
  }
}
function markdownSignals(): MarkdownSignal[] {
  const indent = atom(character(' '), 0, 3);
  const whitespace = atom(space, 1, Infinity);
  return [
    new MarkdownSignal([indent, atom(character('#'), 1, 6), whitespace, atom(nonspace)], 'line'),
    new MarkdownSignal([atom(character('`'), 3)]),
    new MarkdownSignal([atom(character('*'), 2), atom(c => c !== '*' && c !== '\n', 1, Infinity), atom(character('*'), 2)]),
    new MarkdownSignal([atom(character('`')), atom(c => c !== '`' && c !== '\n', 1, Infinity), atom(character('`'))]),
    new MarkdownSignal([indent, atom(c => /[-*+]/.test(c)), whitespace, atom(nonspace)], 'line'),
    new MarkdownSignal([indent, atom(c => /\d/.test(c), 1, Infinity), atom(character('.')), whitespace, atom(nonspace)], 'line'),
    new MarkdownSignal([atom(character('[')), atom(c => c !== ']', 1, Infinity), atom(character(']')), atom(character('(')), atom(c => c !== ')' && nonspace(c), 1, Infinity), atom(character(')'))]),
    new MarkdownSignal([indent, atom(character('>')), atom(space, 0, 1), atom(nonspace)], 'line'),
    new MarkdownSignal([atom(character('_')), atom(c => c !== '_' && c !== '\n', 1, Infinity), atom(character('_'))], 'boundary'),
  ];
}

/** Append-only equivalent of looksLikeMarkdown; arbitrary replacements reset the finite state. */
export class IncrementalMarkdownDetector {
  private source = '';
  private signals = markdownSignals();
  private permanent = false;
  private boundaryPending = false;
  private previous?: string;
  scannedCodeUnits = 0;
  update(source: string): boolean {
    if (!source.startsWith(this.source)) {
      this.source = ''; this.signals = markdownSignals(); this.permanent = false;
      this.boundaryPending = false; this.previous = undefined;
    }
    if (!this.permanent) for (let index = this.source.length; index < source.length; index++) {
      const input = source[index]!; this.scannedCodeUnits++;
      if (this.boundaryPending && !/\w/.test(input)) this.permanent = true;
      this.boundaryPending = false;
      for (let signal = 0; signal < this.signals.length; signal++) {
        if (!this.signals[signal]!.step(input, this.previous)) continue;
        if (signal === this.signals.length - 1) this.boundaryPending = true;
        else this.permanent = true;
      }
      this.previous = input;
      if (this.permanent) break;
    }
    this.source = source;
    return this.permanent || this.boundaryPending;
  }
}

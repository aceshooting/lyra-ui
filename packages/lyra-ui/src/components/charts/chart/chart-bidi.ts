import { css, html, type TemplateResult } from 'lit';

/**
 * Bidirectional-text isolation for the chart family's formatted labels.
 *
 * A formatted chart label -- a tick, a data label, a tooltip line, a table cell -- is one unit of
 * text whose reading direction belongs to its own content, not to the chart around it. Painted
 * inside an RTL chart with no isolation, a number-first LTR label such as `2.4 MiB/s`, `9:00 AM`
 * or `-3` inherits the RTL base direction and reads unit-first (`MiB/s 2.4`). Every surface here
 * therefore resolves a label's direction from its first strong character, the way a first-strong
 * isolate (U+2068 ... U+2069) would, while leaving the chart's own geometry alone.
 *
 * Three mechanisms, one per rendering technology:
 *
 * - HTML (legends, generated tables): a `<span class="bidi">` styled by {@link bidiStyles}.
 *   `unicode-bidi: plaintext` on an inline box isolates it with first-strong direction, exactly
 *   like `<bdi>`, without putting any character into the accessible text. A table cell is wrapped
 *   only when its direction differs from the chart's ({@link isolateHtml}): one extra inline
 *   element per cell costs WebKit about a second across a sampled table of a thousand rows.
 * - SVG `<text>`: the `unicode-bidi: plaintext` declaration in the component stylesheet. WebKit's
 *   SVG text ignores the isolate controls entirely, and the declaration keeps screen-reader text
 *   clean as well.
 * - Canvas (Chart.js ticks, titles, tooltips, data labels): {@link isolateCanvasText}. A canvas has
 *   no stylesheet and no accessible text, so the direction is carried by explicit embedding
 *   controls. Embeddings rather than isolates because WebKit's canvas text also ignores U+2066-9;
 *   for a label that is the whole drawn string the two are equivalent. A formatted value
 *   interpolated into a localized canvas sentence (`{label}: {value}` in a tooltip) is embedded on
 *   its own before interpolation ({@link canvasSentence}), so it keeps its order after a
 *   right-to-left series label too.
 */
export type ChartTextDirection = 'ltr' | 'rtl';

/** The rule behind every `<span class="bidi">` a chart renders; include it in the component's
 *  `static styles`. */
export const bidiStyles = css`
  .bidi {
    unicode-bidi: plaintext;
  }
`;

const LEFT_TO_RIGHT_EMBEDDING = '\u202a';
const RIGHT_TO_LEFT_EMBEDDING = '\u202b';
const POP_DIRECTIONAL_FORMATTING = '\u202c';
const LEFT_TO_RIGHT_MARK = '\u200e';
const RIGHT_TO_LEFT_MARK = '\u200f';
const ARABIC_LETTER_MARK = '\u061c';
const ISOLATE_INITIATORS = new Set(['\u2066', '\u2067', '\u2068']);
const POP_DIRECTIONAL_ISOLATE = '\u2069';
// LRE, RLE, LRO, RLO: each opens a run that a PDF closes.
const EMBEDDING_INITIATORS = new Set(['\u202a', '\u202b', '\u202d', '\u202e']);

// Letters are the strong characters in practice. Letters of the right-to-left scripts -- Hebrew
// through Arabic Extended-A, their presentation forms, and the historic right-to-left blocks of the
// supplementary planes -- are strong RTL; every other letter is strong LTR. Digits, punctuation and
// symbols are weak or neutral and never decide a direction, exactly as in rule P2.
const LETTER = /\p{L}/u;
const RIGHT_TO_LEFT_SCRIPT_RANGE =
  /[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufefc\u{10800}-\u{10fff}\u{1e800}-\u{1efff}]/u;
// Any character that could make a label's first strong direction right-to-left. Its absence lets an
// LTR canvas skip the per-character scan: such a label can only resolve to LTR there.
const ANY_RIGHT_TO_LEFT =
  /[\u061c\u200f\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufefc\u{10800}-\u{10fff}\u{1e800}-\u{1efff}]/u;

/**
 * The direction of the first strong character in `text` (Unicode bidi rule P2), or `null` when
 * the text has none (a bare number, a date, punctuation). Characters inside an isolate are skipped,
 * as P2 requires, so a label that already carries its own isolated run is judged by what surrounds
 * that run. Characters inside an embedding are skipped too: this module embeds a formatted value
 * as its stand-in for an isolate (see {@link isolateCanvasText}), so a tooltip line such as
 * `<label>: <embedded value>` is judged by its label, not by the value it carries.
 */
export function firstStrongDirection(text: string): ChartTextDirection | null {
  // Open isolates (`true`) and embeddings (`false`), innermost last.
  const open: boolean[] = [];
  for (const character of text) {
    if (ISOLATE_INITIATORS.has(character)) {
      open.push(true);
      continue;
    }
    if (character === POP_DIRECTIONAL_ISOLATE) {
      // A PDI closes the innermost open isolate and every embedding opened inside it (rule X6a);
      // with no isolate open it matches nothing.
      const isolate = open.lastIndexOf(true);
      if (isolate >= 0) open.length = isolate;
      continue;
    }
    if (EMBEDDING_INITIATORS.has(character)) {
      open.push(false);
      continue;
    }
    if (character === POP_DIRECTIONAL_FORMATTING) {
      // A PDF closes only an embedding opened inside the current isolate (rule X7).
      if (open.length > 0 && open[open.length - 1] === false) open.pop();
      continue;
    }
    if (open.length > 0) continue;
    if (character === LEFT_TO_RIGHT_MARK) return 'ltr';
    if (character === RIGHT_TO_LEFT_MARK || character === ARABIC_LETTER_MARK) return 'rtl';
    if (!LETTER.test(character)) continue;
    return RIGHT_TO_LEFT_SCRIPT_RANGE.test(character) ? 'rtl' : 'ltr';
  }
  return null;
}

/** Whether `text` is one embedding from its first character to its last: an LRE/RLE whose own
 *  matching PDF is the final character, not two adjacent runs that merely start and end the text. */
function whollyEmbedded(text: string): boolean {
  if (!text.startsWith(LEFT_TO_RIGHT_EMBEDDING) && !text.startsWith(RIGHT_TO_LEFT_EMBEDDING)) {
    return false;
  }
  let depth = 0;
  let index = 0;
  for (const character of text) {
    index += character.length;
    if (EMBEDDING_INITIATORS.has(character)) depth++;
    else if (character === POP_DIRECTIONAL_FORMATTING && depth > 0 && --depth === 0) {
      return index === text.length;
    }
  }
  return false;
}

/**
 * Prepares one drawn canvas label -- or one formatted value about to be interpolated into a
 * drawn sentence -- so it paints in its own first-strong direction inside a canvas whose base
 * direction is `context`. A label whose direction already matches the context is returned
 * unchanged -- a standalone string in its own direction needs no embedding -- so LTR charts keep
 * their exact label strings. A label with no strong character reads left-to-right, the P3
 * default. Idempotent: an already embedded label is returned as is.
 */
export function isolateCanvasText(text: string, context: ChartTextDirection): string {
  if (!text) return text;
  if (whollyEmbedded(text)) return text;
  if (context === 'ltr' && !ANY_RIGHT_TO_LEFT.test(text)) return text;
  const direction = firstStrongDirection(text) ?? 'ltr';
  if (direction === context) return text;
  const embedding = direction === 'rtl' ? RIGHT_TO_LEFT_EMBEDDING : LEFT_TO_RIGHT_EMBEDDING;
  return `${embedding}${text}${POP_DIRECTIONAL_FORMATTING}`;
}

/**
 * Interpolates a formatted value into one localized, canvas-drawn sentence (a tooltip's
 * `{label}: {value}`), embedding the value in its own direction whenever that differs from the
 * sentence's. The sentence's direction is its first strong character outside the value -- exactly
 * the direction {@link isolateCanvasText} then paints the whole line in, since the scan skips an
 * embedded value -- so a number-first `1.5 MiB/s` keeps its order after a right-to-left series
 * label on either canvas direction, and an LTR sentence on an LTR canvas keeps its exact string.
 * `format` receives the value to interpolate; calling it with `''` must yield the sentence
 * without it.
 */
export function canvasSentence(format: (value: string) => string, value: string): string {
  const direction = firstStrongDirection(format('')) ?? 'ltr';
  return format(isolateCanvasText(value, direction));
}

// Digits joined by single decimal or grouping separators read the same in either base direction:
// a common separator between two digits -- including the no-break spaces Intl groups with --
// takes the digits' class (Unicode bidi rule W4). A plain space or an apostrophe does not, so
// those numbers are still isolated.
const PLAIN_NUMBER = /^\p{Nd}+(?:[.,\u00a0\u202f\u066b\u066c]\p{Nd}+)*$/u;

/**
 * One generated table cell's or legend entry's content, wrapped in a `<span class="bidi">` (see
 * {@link bidiStyles}) only when it needs isolating inside an HTML context of direction `context`:
 * text whose first-strong direction (left-to-right when it has no strong character) differs from
 * the context, other than a plain number. Text already in the context's direction is returned
 * unchanged, like {@link isolateCanvasText}, so a large left-to-right table gains no elements.
 * Non-text content is always wrapped.
 */
export function isolateHtml(content: unknown, context: ChartTextDirection): unknown {
  if (typeof content === 'number') content = String(content);
  if (typeof content !== 'string') return html`<span class="bidi">${content}</span>`;
  if (!content || PLAIN_NUMBER.test(content)) return content;
  if (context === 'ltr' && !ANY_RIGHT_TO_LEFT.test(content)) return content;
  return (firstStrongDirection(content) ?? 'ltr') === context
    ? content
    : html`<span class="bidi">${content}</span>`;
}

/** {@link isolateCanvasText} over a Chart.js label, which may be a string, a multi-line array of
 *  strings (each line is drawn as its own string) or a non-string passthrough. */
export function isolateCanvasLabel<T>(label: T, context: ChartTextDirection): T {
  if (typeof label === 'string') return isolateCanvasText(label, context) as T;
  if (Array.isArray(label)) {
    return label.map((line: unknown) =>
      typeof line === 'string' ? isolateCanvasText(line, context) : line,
    ) as T;
  }
  return label;
}

interface ChartTickLike {
  label?: unknown;
}

/** The scale-option hook shape Chart.js calls as `afterTickToLabelConversion(scale)`: isolates
 *  every tick label the scale is about to measure and draw. */
export function isolateScaleTickLabels(
  scale: { ticks?: unknown },
  context: ChartTextDirection,
): void {
  if (!Array.isArray(scale.ticks)) return;
  for (const tick of scale.ticks as ChartTickLike[]) {
    if (tick && typeof tick === 'object' && 'label' in tick) {
      tick.label = isolateCanvasLabel(tick.label, context);
    }
  }
}

interface ChartTooltipBodyLike {
  before?: unknown;
  lines?: unknown;
  after?: unknown;
}

function isolateLines(lines: unknown, context: ChartTextDirection): void {
  if (!Array.isArray(lines)) return;
  for (let index = 0; index < lines.length; index++) {
    lines[index] = isolateCanvasLabel(lines[index], context);
  }
}

/**
 * Isolates every line a Chart.js tooltip is about to draw (title, before/after body, body items,
 * footer) -- the shape of a `beforeTooltipDraw` plugin hook. Chart.js draws each line as its own
 * string, so each line is judged by its own first strong character. Mutating the tooltip model is
 * safe: Chart.js rebuilds every one of these arrays on its next update, and the embedding is
 * idempotent across the repeated draws of one update.
 */
export function isolateTooltipLines(
  tooltip: {
    title?: unknown;
    beforeBody?: unknown;
    body?: unknown;
    afterBody?: unknown;
    footer?: unknown;
  },
  context: ChartTextDirection,
): void {
  isolateLines(tooltip.title, context);
  isolateLines(tooltip.beforeBody, context);
  isolateLines(tooltip.afterBody, context);
  isolateLines(tooltip.footer, context);
  if (!Array.isArray(tooltip.body)) return;
  for (const item of tooltip.body as ChartTooltipBodyLike[]) {
    if (!item || typeof item !== 'object') continue;
    isolateLines(item.before, context);
    isolateLines(item.lines, context);
    isolateLines(item.after, context);
  }
}

/**
 * The direction a Chart.js tooltip or legend draws its text in: the element's own configured
 * `textDirection` option when a caller set one, otherwise `host` (the canvas inherits the host's
 * resolved direction). `element` is the live `chart.tooltip`/`chart.legend`, or anything else,
 * which resolves to `host`.
 */
export function canvasTextDirection(element: unknown, host: ChartTextDirection): ChartTextDirection {
  if (!element || typeof element !== 'object') return host;
  const configured = (element as { options?: { textDirection?: unknown } }).options?.textDirection;
  return configured === 'ltr' || configured === 'rtl' ? configured : host;
}

/**
 * A Chart.js `beforeTooltipDraw` plugin hook that isolates every tooltip line against the
 * direction the tooltip draws in (see {@link canvasTextDirection}).
 */
export function tooltipIsolationHook(
  hostDirection: () => ChartTextDirection,
): (chart: unknown, args: { tooltip?: unknown }) => void {
  return (_chart, args) => {
    const tooltip = args?.tooltip;
    if (!tooltip || typeof tooltip !== 'object') return;
    isolateTooltipLines(tooltip, canvasTextDirection(tooltip, hostDirection()));
  };
}

const SENTINEL = /\ue000(\d+)\ue001/g;

/** A localized message whose key is bound in `format` (so the key stays a literal at the call
 *  site), with the values to interpolate and the names of those to isolate. */
export interface IsolatableMessage {
  format: (values: Record<string, string | number>) => string;
  values: Readonly<Record<string, string | number>>;
  isolated: readonly string[];
}

/**
 * Renders a localized `{placeholder}` message with each value named in `isolated` wrapped in its
 * own `<span class="bidi">` (see {@link bidiStyles}), so a formatted value or caller label keeps
 * its own direction inside a translated sentence while the sentence keeps the translation's. `format` receives the values with the
 * isolated ones replaced by private-use sentinels (plural selection still sees the real numeric
 * `count`), and the sentinels are then swapped for the isolated parts. The accessible text is the
 * same string `format(values)` would return, with no control characters added.
 */
export function isolatedMessage(
  format: (values: Record<string, string | number>) => string,
  values: Readonly<Record<string, string | number>>,
  isolated: readonly string[],
): TemplateResult {
  const sentinelValues: Record<string, string | number> = { ...values };
  isolated.forEach((name, index) => {
    sentinelValues[name] = `\ue000${index}\ue001`;
  });
  const text = format(sentinelValues);
  const parts: (string | TemplateResult)[] = [];
  let cursor = 0;
  for (const match of text.matchAll(SENTINEL)) {
    const name = isolated[Number(match[1])];
    if (match.index > cursor) parts.push(text.slice(cursor, match.index));
    parts.push(name === undefined ? match[0] : html`<span class="bidi">${String(values[name] ?? '')}</span>`);
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return html`${parts}`;
}

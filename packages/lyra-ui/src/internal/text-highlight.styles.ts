import { unsafeCSS, type CSSResult } from 'lit';
import { activeFill, focusRingOffset, hoverFill } from './interactive-control.styles.js';

/** The painted text-quote tones and their fallback fills. */
const TONES = [
  ['accent', 'var(--lr-color-brand-quiet)'],
  ['success', 'var(--lr-color-success-quiet)'],
  ['warning', 'var(--lr-color-warning-quiet)'],
  ['danger', 'var(--lr-color-danger-quiet)'],
  ['neutral', 'var(--lr-color-surface-raised)'],
] as const;

export interface HighlightToneStyleOptions {
  /** Selector containing the `<mark>` fallback elements. Defaults to `[part='content']`. */
  readonly scope?: string;
  /** Fill used when the component's neutral highlight token is unset. */
  readonly neutralBackground?: string;
  /** Marks are clickable: pointer cursor plus hover and press fills mixed from the tone. */
  readonly interactive?: boolean;
  /** Custom property naming the active mark's outline colour. Defaults to
   *  `--lr-<prefix>-highlight-active-outline-color`. */
  readonly activeOutlineToken?: string;
}

/**
 * Tone styles for painted text-quote highlights, kept in sync across the CSS Custom Highlight API
 * (`::highlight(lr-highlight-<tone>)`) and the `<mark data-lr-highlight-tone>` fallback. Each tone
 * reads `--lr-<prefix>-highlight-<tone>-bg`; the active highlight reads `-active-bg` and an outline
 * token. Forced colours underline every tone (double for the active one). `prefix`, `scope` and the
 * token name are author-controlled CSS, never user input.
 */
export function highlightToneStyles(prefix: string, options: HighlightToneStyleOptions = {}): CSSResult {
  const scope = options.scope ?? "[part='content']";
  const token = (tone: string): string => `--lr-${prefix}-highlight-${tone}-bg`;
  const fill = (tone: string, fallback: string): string =>
    `var(${token(tone)}, ${tone === 'neutral' ? options.neutralBackground ?? fallback : fallback})`;
  const carrier = `--_lr-${prefix}-highlight-background`;
  const outline = options.activeOutlineToken ?? `--lr-${prefix}-highlight-active-outline-color`;
  const mark = `${scope} mark[data-lr-highlight-tone]`;
  const rules: string[] = [];
  for (const [tone, fallback] of TONES) {
    rules.push(`::highlight(lr-highlight-${tone}) { background-color: ${fill(tone, fallback)}; }`);
  }
  rules.push(`::highlight(lr-highlight-active) { background-color: var(${token('active')}, var(--lr-color-brand-quiet)); text-decoration: underline; }`);
  rules.push(`${mark} { ${carrier}: var(${token('accent')}, ${TONES[0][1]}); background: var(${carrier}); color: inherit; border-radius: calc(var(--lr-radius) * 0.5); }`);
  for (const [tone, fallback] of TONES.slice(1)) {
    rules.push(`${scope} mark[data-lr-highlight-tone='${tone}'] { ${carrier}: ${fill(tone, fallback)}; }`);
  }
  if (options.interactive) {
    rules.push(`${mark} { cursor: pointer; transition: var(--lr-transition-interactive); }`);
    rules.push(`${mark}:hover { background: ${hoverFill(`var(${carrier})`).cssText}; }`);
    rules.push(`${mark}:active { background: ${activeFill(`var(${carrier})`).cssText}; }`);
  }
  rules.push(`${scope} mark[data-lr-highlight-name='lr-highlight-active'] { outline: var(--lr-border-width-thin) solid var(${outline}, var(--lr-color-brand)); ${focusRingOffset.cssText} }`);
  const toneHighlights = TONES.map(([tone]) => `::highlight(lr-highlight-${tone})`).join(', ');
  rules.push(`@media (forced-colors: active) {
    ${toneHighlights}, ${mark} { text-decoration: underline; }
    ::highlight(lr-highlight-active), ${scope} mark[data-lr-highlight-name='lr-highlight-active'] { text-decoration: double underline; }
  }`);
  rules.push(`@media (prefers-reduced-motion: reduce) { ${mark} { transition: none; } }`);
  return unsafeCSS(rules.join('\n'));
}

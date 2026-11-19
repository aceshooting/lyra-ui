import { unsafeCSS, type CSSResult } from 'lit';

/** The painted text-quote tones and their fallback fills. */
const TONES = [
  ['accent', 'var(--lr-color-brand-quiet)'],
  ['success', 'var(--lr-color-success-quiet)'],
  ['warning', 'var(--lr-color-warning-quiet)'],
  ['danger', 'var(--lr-color-danger-quiet)'],
  // surface-raised, not surface: content usually sits on --lr-color-surface, where a neutral mark
  // would have no contrast.
  ['neutral', 'var(--lr-color-surface-raised)'],
] as const;

export interface HighlightToneStyleOptions {
  /** Selector containing the `<mark>` fallback elements. Defaults to `[part='content']`. */
  readonly scope?: string;
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
  const carrier = `--_lr-${prefix}-highlight-background`;
  const outline = options.activeOutlineToken ?? `--lr-${prefix}-highlight-active-outline-color`;
  const mark = `${scope} mark[data-lr-highlight-tone]`;
  const rules: string[] = [];
  for (const [tone, fallback] of TONES) {
    rules.push(`::highlight(lr-highlight-${tone}) { background-color: var(${token(tone)}, ${fallback}); }`);
  }
  rules.push(`::highlight(lr-highlight-active) { background-color: var(${token('active')}, var(--lr-color-brand-quiet)); text-decoration: underline; }`);
  rules.push(`${mark} { ${carrier}: var(${token('accent')}, ${TONES[0][1]}); background: var(${carrier}); color: inherit; border-radius: calc(var(--lr-radius) * 0.5); }`);
  for (const [tone, fallback] of TONES.slice(1)) {
    rules.push(`${scope} mark[data-lr-highlight-tone='${tone}'] { ${carrier}: var(${token(tone)}, ${fallback}); }`);
  }
  if (options.interactive) {
    rules.push(`${mark} { cursor: pointer; transition: background-color var(--lr-transition-fast); }`);
    rules.push(`${mark}:hover { background: color-mix(in oklab, var(${carrier}), var(--lr-color-mix-partner) var(--lr-color-mix-hover)); }`);
    rules.push(`${mark}:active { background: color-mix(in oklab, var(${carrier}), var(--lr-color-mix-partner) var(--lr-color-mix-active)); }`);
  }
  rules.push(`${scope} mark[data-lr-highlight-name='lr-highlight-active'] { outline: var(--lr-border-width-thin) solid var(${outline}, var(--lr-color-brand)); outline-offset: var(--lr-focus-ring-offset); }`);
  const toneHighlights = TONES.map(([tone]) => `::highlight(lr-highlight-${tone})`).join(', ');
  rules.push(`@media (forced-colors: active) {
    ${toneHighlights}, ${mark} { text-decoration: underline; }
    ::highlight(lr-highlight-active), ${scope} mark[data-lr-highlight-name='lr-highlight-active'] { text-decoration: double underline; }
  }`);
  rules.push(`@media (prefers-reduced-motion: reduce) { ${mark} { transition: none; } }`);
  return unsafeCSS(rules.join('\n'));
}

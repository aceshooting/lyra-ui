import { html, type TemplateResult } from 'lit';

const LRI = '⁦';
const PDI = '⁩';

/** Caller-authored text (ids, numbers, code, names) isolated from the surrounding direction.
 *  `auto` takes the text's own direction (`<bdi dir="auto">`); `ltr` forces left-to-right, for
 *  ids, numbers and code. Bound flush so no whitespace text node is introduced. */
export function isolateText(text: string, dir: 'auto' | 'ltr' = 'auto'): TemplateResult {
  return html`<bdi dir=${dir}>${text}</bdi>`;
}

/** The string counterpart for `aria-label`/`title`, where markup cannot go: wraps `text` in
 *  Unicode LTR isolates (U+2066 ... U+2069) so it cannot reorder its neighbours. */
export function ltrIsolate(text: string): string {
  return `${LRI}${text}${PDI}`;
}

/** Caller data of unknown type isolated with `dir="auto"`; nullish renders nothing. */
export function bdi(text: unknown): TemplateResult {
  return html`<bdi dir="auto">${text === null || text === undefined ? '' : String(text)}</bdi>`;
}

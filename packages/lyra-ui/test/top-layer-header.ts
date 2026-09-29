import { fixture, html } from '@open-wc/testing';
import type { TemplateResult } from 'lit';

/**
 * A fixed, `z-index`ed header that is only a stacking context (no transform, filter or
 * `contain`, so no containing block traps what opens inside it) beside a sibling fixed surface
 * stacked higher that covers the area an overlay from the header opens into.
 */
const headerStyle = (inlineSize: string): string =>
  'position: fixed; inset-block-start: 0; inset-inline-start: 0; z-index: 1000; ' +
  `inline-size: ${inlineSize}; block-size: 48px; padding: 8px; ` +
  'box-sizing: border-box; background: white';
const SIBLING_STYLE =
  'position: fixed; inset-block-start: 0; inset-inline-start: 24px; z-index: 1100; ' +
  'inline-size: 640px; block-size: 640px; background: rgb(235, 235, 235)';

export interface HeaderFixture {
  wrapper: HTMLElement;
  /** The sibling surface stacked above the header. */
  sibling: HTMLElement;
}

/** Mounts `content` inside the z-indexed fixed header, beside the higher sibling surface. */
export async function headerFixture(
  content: TemplateResult,
  headerInlineSize = '240px',
): Promise<HeaderFixture> {
  const wrapper = await fixture<HTMLElement>(html`<div>
    <div id="header" style=${headerStyle(headerInlineSize)}>${content}</div>
    <div id="sibling" style=${SIBLING_STYLE}></div>
  </div>`);
  return { wrapper, sibling: wrapper.querySelector<HTMLElement>('#sibling')! };
}

/** The centre of the placed popup's box where it lies over the sibling surface. */
export function pointOverSibling(popup: HTMLElement, sibling: HTMLElement): [number, number] {
  const a = popup.getBoundingClientRect();
  const b = sibling.getBoundingClientRect();
  const left = Math.max(a.left, b.left);
  const right = Math.min(a.right, b.right);
  const top = Math.max(a.top, b.top);
  const bottom = Math.min(a.bottom, b.bottom);
  if (right - left < 4 || bottom - top < 4) {
    throw new Error('the placed popup does not overlap the sibling surface');
  }
  return [(left + right) / 2, (top + bottom) / 2];
}

/** Whether the topmost hit at (x, y) is `host` or lives inside it; a boolean, never a node. */
export function hitBelongsTo(host: HTMLElement, x: number, y: number): boolean {
  const hit = document.elementFromPoint(x, y);
  return hit !== null && (hit === host || host.contains(hit));
}

export function hitId(x: number, y: number): string {
  return document.elementFromPoint(x, y)?.id ?? '';
}

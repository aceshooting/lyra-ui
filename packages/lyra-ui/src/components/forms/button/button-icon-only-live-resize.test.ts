import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './button.js';
import type { LyraButton } from './button.js';

const icon = html`<svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16"><circle r="6" cx="8" cy="8" /></svg>`;

/** `[part~="base"]`'s rendered geometry -- never the internal `isIconButton` flag, which a
 *  consumer never sees. `aspectRatio` and `paddingInlineStart` are the two declarations
 *  `[data-icon-button]` actually rewrites (see button.styles.ts); comparing them against a
 *  same-test reference button, rather than a hardcoded pixel/ratio literal, is the library's own
 *  documented way to prove two controls render the same shape (docs/agents/testing.md: "diff
 *  getComputedStyle between them rather than eyeballing"). */
function baseGeometry(el: LyraButton): { aspectRatio: string; paddingInlineStart: string; square: boolean } {
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  const style = getComputedStyle(base);
  const rect = base.getBoundingClientRect();
  return {
    aspectRatio: style.aspectRatio,
    paddingInlineStart: style.paddingInlineStart,
    square: Math.abs(rect.width - rect.height) < 0.5,
  };
}

/** Injects (and returns a remover for) a page-level stylesheet whose `@container` rule hides a
 *  slotted label at a narrow container width -- a real container query, not a stand-in for one, so
 *  the fixture reproduces the exact "CSS state changes with no DOM mutation" shape the bug report
 *  describes. Scoped to a per-call class name so parallel `it()` blocks in this file cannot bleed
 *  into each other's containers. */
function injectNarrowLabelQuery(className: string): () => void {
  const style = document.createElement('style');
  style.textContent = `
    @container (max-width: 100px) {
      .${className} { display: none; }
    }
  `;
  document.head.append(style);
  return () => style.remove();
}

describe('lr-button: re-evaluates icon-only geometry when a CSS-only label visibility change has no accompanying DOM mutation', () => {
  it('matches a plain icon-only button once a container query hides the label after mount, and matches a plain text button again once it reappears -- with no slotchange in between', async () => {
    const className = 'live-resize-label';
    const removeQuery = injectNarrowLabelQuery(className);
    try {
      const iconOnlyReference = await fixture<LyraButton>(
        html`<lr-button aria-label="Save changes">${icon}</lr-button>`
      );
      const textReference = await fixture<LyraButton>(
        html`<lr-button aria-label="Save changes">${icon}<span>Save changes</span></lr-button>`
      );

      const container = document.createElement('div');
      container.style.cssText = 'container-type: inline-size; inline-size: 320px;';
      const live = await fixture<LyraButton>(
        html`<lr-button aria-label="Save changes">${icon}<span class="${className}">Save changes</span></lr-button>`,
        { parentNode: container }
      );

      // Wide container: the query does not match, the label paints, and geometry starts out
      // identical to an ordinary icon+label text button -- never square.
      expect(baseGeometry(live).square, 'wide: starts as a text button, not square').to.equal(false);
      expect(baseGeometry(live)).to.deep.equal(baseGeometry(textReference));

      // Narrow the container. This flips the @container query -- display: none lands on
      // .live-resize-label -- with no attribute/child mutation anywhere in lr-button's own light
      // DOM, so no slotchange fires. Before this fix nothing else re-ran
      // hasIconOnlyDefaultContent(), so the button kept the wide-state's non-square geometry
      // around the now-invisible label.
      container.style.inlineSize = '60px';
      await waitUntil(
        () => baseGeometry(live).square,
        'narrow: never re-squared to icon-only geometry after the label was hidden with no DOM mutation'
      );
      expect(baseGeometry(live)).to.deep.equal(baseGeometry(iconOnlyReference));

      // Widen it back out. The label reappears, again via the query alone, and the button must
      // track back to full text-button geometry -- proving this is a live re-evaluation, not a
      // one-shot latch.
      container.style.inlineSize = '320px';
      await waitUntil(
        () => !baseGeometry(live).square,
        'wide again: never reverted to text-button geometry after the label reappeared'
      );
      expect(baseGeometry(live)).to.deep.equal(baseGeometry(textReference));
    } finally {
      removeQuery();
    }
  });
});

describe('lr-button: unset regression -- the new ResizeObserver changes nothing for a button that never resizes', () => {
  it('renders an ordinary text button identically before and after the ResizeObserver has had a chance to settle', async () => {
    const el = await fixture<LyraButton>(html`<lr-button>Save changes</lr-button>`);
    const before = el.shadowRoot!.innerHTML;
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    expect(el.shadowRoot!.innerHTML).to.equal(before);
    expect(baseGeometry(el).square).to.equal(false);
  });

  it('renders an already icon-only button identically before and after the ResizeObserver has had a chance to settle', async () => {
    const el = await fixture<LyraButton>(html`<lr-button aria-label="Settings">${icon}</lr-button>`);
    const before = el.shadowRoot!.innerHTML;
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    expect(el.shadowRoot!.innerHTML).to.equal(before);
    expect(baseGeometry(el).square).to.equal(true);
  });

  it('disconnects its ResizeObserver on teardown instead of leaking one per mount/unmount cycle', async () => {
    const el = await fixture<LyraButton>(html`<lr-button>Save changes</lr-button>`);
    const internals = el as unknown as { resizeObserver?: { disconnect(): void } };
    const observer = internals.resizeObserver;
    expect(observer, 'a connected button arms its resize observer').to.not.equal(undefined);
    let disconnected = false;
    const originalDisconnect = observer!.disconnect.bind(observer);
    observer!.disconnect = () => {
      disconnected = true;
      originalDisconnect();
    };
    el.remove();
    expect(disconnected, 'disconnectedCallback must disconnect the resize observer').to.equal(true);
    expect(internals.resizeObserver, 'the reference is cleared, not just disconnected').to.equal(undefined);
  });
});

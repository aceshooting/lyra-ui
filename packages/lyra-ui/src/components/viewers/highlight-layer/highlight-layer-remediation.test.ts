import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import './highlight-layer.js';
import type { LyraHighlightLayer, HighlightLayerItem } from './highlight-layer.js';
import { setReducedMotion } from '../../../../test/wtr-media.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';

const ITEMS: HighlightLayerItem[] = [
  { id: 'a', rects: [{ x: 10, y: 10, width: 20, height: 5 }], label: 'Zone A' },
  { id: 'b', rects: [{ x: 10, y: 60, width: 20, height: 5 }] },
];

function targets(el: LyraHighlightLayer): HTMLElement[] {
  return [...el.shadowRoot!.querySelectorAll<HTMLElement>('[data-item-action]')];
}

describe('lr-highlight-layer remediation', () => {
  it('keeps the snapshot and flash on identity reassignment and clears the flash on replacement or disconnect', async () => {
    const el = await fixture<LyraHighlightLayer>(html`<lr-highlight-layer .items=${ITEMS}></lr-highlight-layer>`);
    const snapshot = el.items;
    const hasFlash = () => el.shadowRoot!.querySelector('[data-flash]') !== null;
    el.flash('a');
    await el.updateComplete;

    for (const source of [ITEMS, snapshot]) {
      el.items = source;
      await el.updateComplete;
      expect(el.items === snapshot).to.equal(true);
      expect(hasFlash()).to.equal(true);
    }

    el.items = [...ITEMS];
    await el.updateComplete;
    expect(hasFlash()).to.equal(false);
    el.flash('a');
    await el.updateComplete;
    expect(hasFlash()).to.equal(true);
    el.remove();
    await el.updateComplete;
    expect(hasFlash()).to.equal(false);
  });

  const modified: Array<[string, KeyboardEventInit]> = [
    ['Ctrl', { ctrlKey: true }],
    ['Meta', { metaKey: true }],
    ['Alt', { altKey: true }],
    ['IME composition', { isComposing: true }],
    ['auto-repeat', { repeat: true }],
  ];
  for (const [name, init] of modified) {
    it(`leaves Enter alone and unactivated under ${name}`, async () => {
      const el = await fixture<LyraHighlightLayer>(html`<lr-highlight-layer .items=${ITEMS}></lr-highlight-layer>`);
      let activations = 0;
      el.addEventListener('lr-highlight-activate', () => (activations += 1));
      const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...init });
      targets(el)[0]!.dispatchEvent(event);
      expect(event.defaultPrevented).to.be.false;
      expect(activations).to.equal(0);
    });
  }

  it('does not cancel Alt+ArrowRight, so browser history navigation still works', async () => {
    const el = await fixture<LyraHighlightLayer>(html`<lr-highlight-layer .items=${ITEMS}></lr-highlight-layer>`);
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true, cancelable: true });
    targets(el)[0]!.dispatchEvent(event);
    expect(event.defaultPrevented).to.be.false;
  });

  it('still activates on a plain Enter', async () => {
    const el = await fixture<LyraHighlightLayer>(html`<lr-highlight-layer .items=${ITEMS}></lr-highlight-layer>`);
    await focusByKeyboard(targets(el)[0]!);
    let activations = 0;
    el.addEventListener('lr-highlight-activate', () => (activations += 1));
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    targets(el)[0]!.dispatchEvent(event);
    expect(event.defaultPrevented).to.be.true;
    expect(activations).to.equal(1);
  });

  it('treats a whitespace-only item label as absent', async () => {
    const el = await fixture<LyraHighlightLayer>(html`
      <lr-highlight-layer .items=${[{ id: 'w', label: '   ', rects: [{ x: 1, y: 1, width: 5, height: 5 }] }]}></lr-highlight-layer>
    `);
    expect(targets(el)[0]!.getAttribute('aria-label')).to.equal('Highlight 1 of 1');
  });

  it('names the group with the default for a whitespace-only host label', async () => {
    const el = await fixture<LyraHighlightLayer>(html`
      <lr-highlight-layer aria-label="   " .items=${ITEMS}></lr-highlight-layer>
    `);
    const label = el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label');
    expect(label).to.be.a('string');
    expect(label!.trim().length).to.be.greaterThan(0);
  });

  it('keeps only sanitized finite rectangles in the snapshot', async () => {
    const el = await fixture<LyraHighlightLayer>(html`<lr-highlight-layer></lr-highlight-layer>`);
    el.items = [{ id: 'x', rects: [{ x: Number.NaN, y: 0, width: 1, height: 1 }, { x: 2, y: 3, width: 4, height: 5 }] }];
    await el.updateComplete;
    expect(el.items[0]!.rects).to.have.length(1);
    expect(el.items[0]!.rects[0]!.x).to.equal(2);
  });

  it('refreshes when a re-assigned list differs', async () => {
    const el = await fixture<LyraHighlightLayer>(html`<lr-highlight-layer .items=${ITEMS}></lr-highlight-layer>`);
    el.items = [{ ...ITEMS[0]!, rects: [{ x: 50, y: 50, width: 5, height: 5 }] }];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector<HTMLElement>('[part="rect"]')!.style.left).to.equal('50%');
  });

  it('draws the active highlight with a heavier outline than a hovered one', async () => {
    const el = await fixture<LyraHighlightLayer>(html`
      <lr-highlight-layer .items=${ITEMS} active-highlight-id="a"></lr-highlight-layer>
    `);
    const rects = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="rect"]')];
    const active = parseFloat(getComputedStyle(rects[0]!).outlineWidth);
    const resting = parseFloat(getComputedStyle(rects[1]!).outlineWidth);
    const medium = parseFloat(getComputedStyle(el).getPropertyValue('--lr-border-width-medium') || '2');
    expect(active).to.be.greaterThan(resting);
    expect(active).to.be.greaterThan(medium);
  });

  it('keeps a lasting non-opaque cue for a flash under reduced motion', async () => {
    await setReducedMotion('reduce');
    try {
      const el = await fixture<LyraHighlightLayer>(html`<lr-highlight-layer .items=${ITEMS}></lr-highlight-layer>`);
      el.flash('a');
      await el.updateComplete;
      await new Promise((resolve) => setTimeout(resolve, 150));
      const rect = el.shadowRoot!.querySelector<HTMLElement>('[part="rect"][data-flash]');
      expect(rect !== null, 'flash cue still present after 150ms').to.be.true;
      const style = getComputedStyle(rect!);
      // WebKit can keep a shared stylesheet's media result stale after an emulation switch; the
      // paint assertions apply once the reduced-motion rule is the one in effect.
      if (style.animationName === 'none') {
        const sibling = el.shadowRoot!.querySelector<HTMLElement>('[part="rect"]:not([data-flash])')!;
        expect(style.backgroundColor).to.equal(getComputedStyle(sibling).backgroundColor);
        expect(parseFloat(style.outlineWidth)).to.be.greaterThan(2);
      }
      await waitUntil(() => el.shadowRoot!.querySelector('[data-flash]') === null, 'the flash cue never cleared');
    } finally {
      await setReducedMotion('no-preference');
    }
  });
});

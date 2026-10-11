import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { hoverUntilMatched, resetMouse } from '../../../../test/wtr-mouse.js';
import { setForcedColors } from '../../../../test/wtr-media.js';
import './heatmap.js';
import type { LyraHeatmap } from './heatmap.js';

const calendar = {
  kind: 'calendar' as const,
  days: [
    { date: '2026-03-01', value: 1 },
    { date: '2026-03-08', value: 2 },
    { date: '2026-03-15', value: 3 },
    { date: '2026-03-22', value: 4 },
  ],
};
const matrix = { kind: 'matrix' as const, rowLabels: ['A'], colLabels: ['X'], values: [[1]] };

for (const layout of ['fit', 'minimum', 'fixed'] as const) {
  it(`contains a deferred fit frame after shrinking without changing ${layout} sizing semantics`, async () => {
    const original = window.IntersectionObserver;
    let observer: IntersectionObserver | undefined;
    let callback: IntersectionObserverCallback | undefined;
    class VisibilityObserver implements IntersectionObserver {
      readonly root = null;
      readonly rootMargin = '0px';
      readonly scrollMargin = '0px';
      readonly thresholds = [0];
      constructor(next: IntersectionObserverCallback) { callback = next; observer = this; }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
      takeRecords(): IntersectionObserverEntry[] { return []; }
    }
    window.IntersectionObserver = VisibilityObserver;
    let el: LyraHeatmap | undefined;
    try {
      el = await fixture<LyraHeatmap>(html`<lr-heatmap
        style="inline-size:640px" .data=${calendar} .fitToWidth=${layout !== 'fixed'}
        .cellSize=${160} .minCellSize=${layout === 'minimum' ? 160 : undefined}
      ></lr-heatmap>`);
      await el.updateComplete;
      const canvas = el.shadowRoot!.querySelector<HTMLCanvasElement>('[part="canvas"]')!;
      await waitUntil(() => canvas.width > 0 && canvas.style.width !== '', 'initial canvas frame');
      const bitmapWidth = canvas.width;
      const notify = (isIntersecting: boolean) => {
        const rect = el!.getBoundingClientRect();
        callback!([{ target: el!, isIntersecting, boundingClientRect: rect,
          intersectionRect: rect, rootBounds: null, intersectionRatio: isIntersecting ? 1 : 0,
          time: performance.now() }], observer!);
      };
      notify(false);
      el.style.inlineSize = '240px';
      await waitUntil(() => el!.exportData('png') === '', 'resize invalidates the suspended frame');
      expect(canvas.width, 'offscreen resize does not repaint the backing store').to.equal(bitmapWidth);
      if (layout === 'fit') {
        expect(canvas.getBoundingClientRect().width, 'stale desktop frame fits the new allocation').to.be.at.most(240);
        expect(el.scrollWidth, 'deferred canvas does not widen the document').to.be.at.most(240);
      } else {
        expect(canvas.getBoundingClientRect().width, 'explicit cell floors retain horizontal extent').to.be.greaterThan(240);
      }
      notify(true);
      if (layout === 'fit') {
        await waitUntil(() => canvas.width < bitmapWidth, 'visible frame repaints at the new width');
        expect(canvas.getBoundingClientRect().width).to.be.at.most(240);
      }
    } finally {
      el?.remove();
      window.IntersectionObserver = original;
    }
  });
}

for (const accessibleCells of [false, true]) {
  for (const configured of [false, true]) {
    it(`keeps ${accessibleCells ? 'cell' : 'canvas'} keyboard feedback independent of ${configured ? 'custom' : 'unset'} hover color`, async () => {
      const el = await fixture<LyraHeatmap>(html`<lr-heatmap .data=${matrix}
        .accessibleCells=${accessibleCells}
        style="--lr-heatmap-focus-ring-color: rgb(1, 2, 3)"
      ></lr-heatmap>`);
      if (configured) el.style.setProperty('--lr-heatmap-hover-ring-color', 'transparent');
      await el.updateComplete;
      const target = el.shadowRoot!.querySelector<HTMLElement>(accessibleCells ? '[part="cell"]' : '[part="canvas"]')!;
      try {
        await hoverUntilMatched(target, 'heatmap interaction target is hovered');
        expect(getComputedStyle(target).outlineColor).to.equal(configured ? 'rgba(0, 0, 0, 0)' : 'rgb(1, 2, 3)');
        await resetMouse();
        await focusByKeyboard(target);
        await waitUntil(() => target.matches(':focus-visible'), 'keyboard focus is visible');
        expect(getComputedStyle(target).outlineColor).to.equal('rgb(1, 2, 3)');
        expect(parseFloat(getComputedStyle(target).outlineWidth)).to.be.greaterThan(0);
      } finally {
        await resetMouse();
      }
    });
  }

  it(`preserves ${accessibleCells ? 'cell' : 'canvas'} keyboard outlines in forced colors with transparent hover`, async () => {
    await setForcedColors('active');
    try {
      const el = await fixture<LyraHeatmap>(html`<lr-heatmap .data=${matrix}
        .accessibleCells=${accessibleCells} style="--lr-heatmap-hover-ring-color: transparent"
      ></lr-heatmap>`);
      await el.updateComplete;
      const target = el.shadowRoot!.querySelector<HTMLElement>(accessibleCells ? '[part="cell"]' : '[part="canvas"]')!;
      await hoverUntilMatched(target, 'forced-colors heatmap target is hovered');
      if (CSS.supports('forced-color-adjust', 'auto')) {
        expect(getComputedStyle(target).forcedColorAdjust).to.equal('auto');
      }
      await resetMouse();
      await focusByKeyboard(target);
      const style = getComputedStyle(target);
      expect(style.outlineStyle).to.equal('solid');
      expect(parseFloat(style.outlineWidth)).to.be.greaterThan(0);
      expect(style.outlineColor).not.to.equal('rgba(0, 0, 0, 0)');
    } finally {
      await resetMouse();
      await setForcedColors('none');
    }
  });
}

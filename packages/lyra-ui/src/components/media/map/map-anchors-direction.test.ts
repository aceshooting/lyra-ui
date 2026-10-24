import { expect, fixtureCleanup, nextFrame, waitUntil } from '@open-wc/testing';
import { setReducedMotion } from '../../../../test/wtr-media.js';
import {
  addAnchor, base, captureCloses, closeButton, isPlaced, mountMap, placed, restoreMapEnvironment, stubMapEnvironment,
} from '../../../../test/map-anchors.js';
import type { LyraMap } from './map.js';
import type { LyraMapAnchor } from './map-anchor.js';

function guardUpdates(elements: readonly HTMLElement[]): { value: number; restore(): void } {
  const counter = { value: 0, restore: (): void => undefined };
  const restores = elements.map(element => {
    const own = Object.getOwnPropertyDescriptor(element, 'requestUpdate');
    const original = (element as unknown as { requestUpdate: (...args: unknown[]) => void }).requestUpdate;
    (element as unknown as { requestUpdate: (...args: unknown[]) => void }).requestUpdate = (...args: unknown[]) => {
      counter.value += 1;
      // Retire a runaway fixture before its microtasks can starve the runner's timeout.
      if (counter.value > 64) { element.remove(); return; }
      original.apply(element, args);
    };
    return () => { if (own) Object.defineProperty(element, 'requestUpdate', own); else Reflect.deleteProperty(element, 'requestUpdate'); };
  });
  counter.restore = () => { for (const restore of restores) restore(); };
  return counter;
}

function insideInsets(map: LyraMap, anchor: LyraMapAnchor, start: number, end: number, direction: 'ltr' | 'rtl'): boolean {
  const frame = map.getBoundingClientRect(), panel = base(anchor).getBoundingClientRect();
  const [left, right] = direction === 'rtl' ? [end, start] : [start, end];
  return panel.left >= frame.left + left + 7 && panel.right <= frame.right - right + 1 - 8;
}

describe('lr-map-anchor direction and motion', () => {
  beforeEach(() => { stubMapEnvironment(); });
  afterEach(() => { fixtureCleanup(); restoreMapEnvironment(); });

  it('settles two open closable anchors through inherited direction flips with logical insets and an inline-end close action', async () => {
    const root = document.documentElement, original = root.getAttribute('dir');
    let guard: { value: number; restore(): void } | undefined;
    try {
      root.setAttribute('dir', 'ltr');
      const { map, wrapper } = await mountMap(element => { element.anchorSafeArea = { inlineStart: 60, inlineEnd: 10 }; });
      const west = addAnchor(map, { lngLat: [-12, 0], closable: true }), east = addAnchor(map, { lngLat: [12, 0], closable: true });
      await placed(west, east);
      guard = guardUpdates([map, west, east]);
      for (const direction of ['rtl', 'ltr'] as const) {
        guard.value = 0;
        root.setAttribute('dir', direction);
        await new Promise<void>(resolve => { setTimeout(resolve, 0); });
        await nextFrame();
        expect(guard.value, 'inherited direction updates must settle').to.be.below(32);
        expect(map.isConnected && west.isConnected && east.isConnected).to.equal(true);
        await waitUntil(() => [west, east].every(anchor => isPlaced(anchor) && getComputedStyle(base(anchor)).direction === direction &&
          insideInsets(map, anchor, 60, 10, direction)), `anchors placed with ${direction} insets`, { timeout: 4000 });
        for (const anchor of [west, east]) {
          const panel = base(anchor).getBoundingClientRect(), close = closeButton(anchor).getBoundingClientRect();
          if (direction === 'rtl') expect(close.left - panel.left).to.be.at.most(20);
          else expect(panel.right - close.right).to.be.at.most(20);
        }
        const settled = guard.value;
        wrapper.style.padding = direction === 'rtl' ? '1px' : '2px';
        await nextFrame();
        expect(guard.value, 'an unrelated ancestor style change must not replay direction updates').to.equal(settled);
      }
      expect(west.close()).to.equal(true); expect(isPlaced(east)).to.equal(true);
    } finally {
      guard?.restore();
      if (original === null) root.removeAttribute('dir'); else root.setAttribute('dir', original);
    }
  });

  it('maps safe-area edges through the map direction, not an anchor\'s own dir', async () => {
    const { map } = await mountMap(element => { element.setAttribute('dir', 'ltr'); element.anchorSafeArea = { inlineStart: 120 }; });
    const anchor = addAnchor(map, { lngLat: [-20, 0], closable: true }); anchor.setAttribute('dir', 'rtl');
    await placed(anchor);
    await waitUntil(() => base(anchor).getBoundingClientRect().left >= map.getBoundingClientRect().left + 120 + 7, 'the map\'s inline start is kept clear');
    const panel = base(anchor).getBoundingClientRect(), close = closeButton(anchor).getBoundingClientRect();
    expect(getComputedStyle(base(anchor)).direction).to.equal('rtl');
    expect(close.left - panel.left).to.be.at.most(20);
  });

  it('has no show or hide motion under reduced motion and keeps its close action working', async () => {
    try {
      await setReducedMotion('reduce');
      const { map } = await mountMap();
      const anchor = addAnchor(map, { closable: true }), log = captureCloses(anchor);
      await placed(anchor);
      expect(getComputedStyle(base(anchor)).animationName).to.equal('none');
      const durations = getComputedStyle(closeButton(anchor)).transitionDuration.split(',').map(value => parseFloat(value));
      expect(durations.every(seconds => seconds <= 0.001)).to.equal(true);
      closeButton(anchor).click(); await anchor.updateComplete;
      expect(log.order).to.deep.equal(['request:close-button', 'close:close-button']); expect(base(anchor).hidden).to.equal(true);
    } finally { await setReducedMotion('no-preference'); }
  });
});

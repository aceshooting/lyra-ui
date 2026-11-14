import { expect, fixture, html } from '@open-wc/testing';
import { platform as floatingPlatform } from '@floating-ui/dom';
import { place } from './positioner.js';

const frames = async (count: number): Promise<void> => {
  for (let index = 0; index < count; index += 1) await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
};

describe('positioner post-resolve failure boundary', () => {
  it('writes no position or hover bridge and stops when the anchor geometry turns non-finite after resolving', async () => {
    const wrap = await fixture<HTMLElement>(html`
      <div>
        <button style="position:absolute; top:100px; left:100px; width:40px; height:20px;">x</button>
        <div style="width:50px; height:20px;"></div>
        <div></div>
      </div>
    `);
    const [anchor, popup, bridge] = Array.from(wrap.children) as HTMLElement[];
    const realRect = anchor!.getBoundingClientRect.bind(anchor);
    let poisoned = false;
    anchor!.getBoundingClientRect = () => poisoned ? new DOMRect(Number.NaN, 0, 40, 20) : realRect();
    const mutablePlatform = floatingPlatform as unknown as { getElementRects: (...args: unknown[]) => Promise<unknown> };
    const original = mutablePlatform.getElementRects;
    // Geometry is valid while floating-ui resolves, then the hover bridge's own anchor read fails.
    mutablePlatform.getElementRects = async (...args: unknown[]) => {
      const rects = await original.apply(floatingPlatform, args);
      poisoned = true;
      return rects;
    };
    let placed = 0;
    let stop: (() => void) | undefined;
    try {
      stop = place(anchor!, popup!, { flip: false, shift: false, hoverBridge: bridge!, onPlaced: () => placed++ });
      await frames(3);
      expect(placed).to.equal(0);
      expect(popup!.style.left).to.equal('');
      expect(popup!.style.top).to.equal('');
      expect(bridge!.style.getPropertyValue('--lr-positioner-hover-bridge-top-left-x')).to.equal('');
      // The failed session is disposed: restoring valid geometry and resizing does not revive it.
      poisoned = false;
      mutablePlatform.getElementRects = original;
      anchor!.style.top = '140px';
      window.dispatchEvent(new Event('resize'));
      await frames(3);
      expect(placed).to.equal(0);
      expect(popup!.style.left).to.equal('');
    } finally {
      mutablePlatform.getElementRects = original;
      stop?.();
    }
  });

  it('writes no placement when the session stops during the failing anchor read', async () => {
    const wrap = await fixture<HTMLElement>(html`
      <div>
        <button style="position:absolute; top:100px; left:100px; width:40px; height:20px;">x</button>
        <div style="width:50px; height:20px;"></div>
        <div></div>
      </div>
    `);
    const [anchor, popup, bridge] = Array.from(wrap.children) as HTMLElement[];
    const realRect = anchor!.getBoundingClientRect.bind(anchor);
    let poisoned = false;
    let stop: (() => void) | undefined;
    anchor!.getBoundingClientRect = () => {
      if (!poisoned) return realRect();
      // The owner closes from inside the read that is about to fail.
      stop?.();
      return new DOMRect(Number.NaN, 0, 40, 20);
    };
    const mutablePlatform = floatingPlatform as unknown as { getElementRects: (...args: unknown[]) => Promise<unknown> };
    const original = mutablePlatform.getElementRects;
    mutablePlatform.getElementRects = async (...args: unknown[]) => {
      const rects = await original.apply(floatingPlatform, args);
      poisoned = true;
      return rects;
    };
    let placed = 0;
    try {
      stop = place(anchor!, popup!, { flip: false, shift: false, hoverBridge: bridge!, onPlaced: () => placed++ });
      await frames(3);
      expect(placed).to.equal(0);
      expect(popup!.style.left).to.equal('');
      expect(bridge!.style.getPropertyValue('--lr-positioner-hover-bridge-top-left-x')).to.equal('');
    } finally {
      mutablePlatform.getElementRects = original;
      stop?.();
    }
  });
});

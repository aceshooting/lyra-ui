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

  it('writes default-padded auto-size limits, and none from a size pass a stop() overtook', async () => {
    const wrap = await fixture<HTMLElement>(html`
      <div>
        <button style="position:absolute; top:100px; left:100px; width:40px; height:20px;">x</button>
        <div style="width:50px; height:20px;"></div>
      </div>
    `);
    const [anchor, popup] = Array.from(wrap.children) as HTMLElement[];
    const blockSize = () => popup!.style.getPropertyValue('--lr-positioner-available-block-size');
    let stop = place(anchor!, popup!, { flip: false, shift: false, autoSize: 'both' });
    try {
      await frames(3);
      expect(popup!.style.getPropertyValue('--lr-positioner-available-inline-size')).to.match(/px$/);
      expect(blockSize()).to.match(/px$/);
    } finally { stop(); }
    popup!.style.removeProperty('--lr-positioner-available-inline-size');
    popup!.style.removeProperty('--lr-positioner-available-block-size');
    popup!.style.removeProperty('left');
    popup!.style.removeProperty('top');

    const mutablePlatform = floatingPlatform as unknown as { getDimensions: (...args: unknown[]) => Promise<unknown> };
    const original = mutablePlatform.getDimensions;
    let stopped = false;
    // The size middleware measures the popup immediately before applying; the owner stops then.
    mutablePlatform.getDimensions = async (...args: unknown[]) => {
      const result = await original.apply(floatingPlatform, args);
      if (!stopped) { stopped = true; stop(); }
      return result;
    };
    let placed = 0;
    try {
      stop = place(anchor!, popup!, { flip: false, shift: false, autoSize: 'vertical', autoSizePadding: 4, onPlaced: () => placed++ });
      await frames(3);
      expect(stopped).to.equal(true);
      expect(placed).to.equal(0);
      expect(blockSize()).to.equal('');
      expect(popup!.style.left).to.equal('');
    } finally {
      mutablePlatform.getDimensions = original;
      stop();
    }
  });

  it('abandons a placement whose owner stops while the anchor is being validated', async () => {
    const wrap = await fixture<HTMLElement>(html`
      <div>
        <button style="position:absolute; top:100px; left:100px; width:40px; height:20px;">x</button>
        <div style="width:50px; height:20px;"></div>
      </div>
    `);
    const [anchor, popup] = Array.from(wrap.children) as HTMLElement[];
    const realRect = anchor!.getBoundingClientRect.bind(anchor);
    let stop: (() => void) | undefined;
    let armed = false;
    let stoppedDuringRead = false;
    anchor!.getBoundingClientRect = () => {
      // The owner closes from inside the next update's anchor validation.
      if (armed && !stoppedDuringRead) { stoppedDuringRead = true; stop?.(); }
      return realRect();
    };
    let placed = 0;
    stop = place(anchor!, popup!, { flip: false, shift: false, onPlaced: () => placed++ });
    await frames(3);
    const settled = placed;
    const left = popup!.style.left;
    armed = true;
    anchor!.style.left = '160px';
    window.dispatchEvent(new Event('resize'));
    await frames(3);
    expect(stoppedDuringRead).to.equal(true);
    expect(placed).to.equal(settled);
    expect(popup!.style.left).to.equal(left);
    stop();
  });
});

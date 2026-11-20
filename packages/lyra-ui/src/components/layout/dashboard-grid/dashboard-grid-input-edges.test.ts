import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-dashboard-grid.js';
import type { LyraDashboardGrid } from '../../lr-dashboard-grid.js';
import type { LyraDashboardCell } from './layout.js';

function cellsOf(el: LyraDashboardGrid): HTMLElement[] {
  return Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>('[part="cell"]'));
}

function key(target: HTMLElement, init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

function threeInARow(): LyraDashboardCell[] {
  return [
    { cellId: 'a', x: 0, y: 0, w: 1, h: 1, label: 'Alpha' },
    { cellId: 'b', x: 1, y: 0, w: 1, h: 1, label: 'Beta' },
    { cellId: 'c', x: 2, y: 0, w: 1, h: 1, label: 'Gamma' },
  ];
}

describe('lr-dashboard-grid keyboard edges', () => {
  it('moves the roving stop backward with ArrowLeft/ArrowUp and jumps home with Home', async () => {
    const el = await fixture<LyraDashboardGrid>(html`<lr-dashboard-grid></lr-dashboard-grid>`);
    el.layout = threeInARow();
    await el.updateComplete;
    const [a, b, c] = cellsOf(el) as [HTMLElement, HTMLElement, HTMLElement];

    key(a, { key: 'End' });
    await el.updateComplete;
    expect(c.getAttribute('tabindex')).to.equal('0');

    const left = key(c, { key: 'ArrowLeft' });
    await el.updateComplete;
    expect(left.defaultPrevented).to.equal(true);
    expect(b.getAttribute('tabindex')).to.equal('0');

    key(b, { key: 'ArrowUp' });
    await el.updateComplete;
    expect(a.getAttribute('tabindex')).to.equal('0');

    // Already at the first cell: a backward key changes nothing and is left unhandled.
    const atStart = key(a, { key: 'ArrowUp' });
    expect(atStart.defaultPrevented).to.equal(false);

    key(a, { key: 'End' });
    await el.updateComplete;
    const home = key(c, { key: 'Home' });
    await el.updateComplete;
    expect(home.defaultPrevented).to.equal(true);
    expect(a.getAttribute('tabindex')).to.equal('0');
    expect(c.getAttribute('tabindex')).to.equal('-1');
  });

  it('leaves Alt-modified, composing, and unrelated keys alone', async () => {
    const el = await fixture<LyraDashboardGrid>(html`<lr-dashboard-grid></lr-dashboard-grid>`);
    el.layout = threeInARow();
    await el.updateComplete;
    const [a, b] = cellsOf(el) as [HTMLElement, HTMLElement];

    expect(key(a, { key: 'ArrowRight', altKey: true }).defaultPrevented).to.equal(false);
    expect(key(a, { key: 'ArrowRight', isComposing: true }).defaultPrevented).to.equal(false);
    expect(key(a, { key: 'Enter' }).defaultPrevented).to.equal(false);
    await el.updateComplete;
    expect(a.getAttribute('tabindex')).to.equal('0');
    expect(b.getAttribute('tabindex')).to.equal('-1');
  });

  it('moves a cell up with Ctrl+ArrowUp and shrinks its height with Ctrl+Shift+ArrowUp', async () => {
    const el = await fixture<LyraDashboardGrid>(
      html`<lr-dashboard-grid cells-draggable cells-resizable></lr-dashboard-grid>`
    );
    el.layout = [{ cellId: 'a', x: 1, y: 2, w: 2, h: 3 }];
    await el.updateComplete;
    const moves: unknown[] = [];
    const resizes: unknown[] = [];
    el.addEventListener('lr-cell-move', (e) => moves.push((e as CustomEvent).detail));
    el.addEventListener('lr-cell-resize', (e) => resizes.push((e as CustomEvent).detail));

    const up = key(cellsOf(el)[0]!, { key: 'ArrowUp', ctrlKey: true });
    expect(up.defaultPrevented).to.equal(true);
    expect(moves).to.deep.equal([{ cellId: 'a', position: { x: 1, y: 1 }, previous: { x: 1, y: 2 } }]);
    await el.updateComplete;

    const shrink = key(cellsOf(el)[0]!, { key: 'ArrowUp', ctrlKey: true, shiftKey: true });
    expect(shrink.defaultPrevented).to.equal(true);
    expect(resizes).to.deep.equal([{ cellId: 'a', size: { w: 2, h: 2 }, previous: { w: 2, h: 3 } }]);

    // A non-arrow chord neither moves nor resizes.
    const other = key(cellsOf(el)[0]!, { key: 'PageUp', ctrlKey: true });
    expect(other.defaultPrevented).to.equal(false);
    expect(moves.length).to.equal(1);
    expect(resizes.length).to.equal(1);
  });
});

describe('lr-dashboard-grid property edges', () => {
  it('falls back to the default row height and gap once the authored attributes are removed', async () => {
    const el = await fixture<LyraDashboardGrid>(
      html`<lr-dashboard-grid row-height="40" gap="20"></lr-dashboard-grid>`
    );
    el.layout = threeInARow();
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    expect(getComputedStyle(base).gridAutoRows).to.equal('40px');
    expect(getComputedStyle(base).columnGap).to.equal('20px');

    el.removeAttribute('row-height');
    el.removeAttribute('gap');
    await el.updateComplete;
    expect(el.rowHeight).to.equal(null);
    expect(getComputedStyle(base).gridAutoRows).to.equal('80px');
    expect(getComputedStyle(base).columnGap).to.equal('8px');
  });

  it('clears a default cell renderer document when its layout entry drops the widget', async () => {
    const el = await fixture<LyraDashboardGrid>(html`<lr-dashboard-grid></lr-dashboard-grid>`);
    el.layout = [
      { cellId: 'a', x: 0, y: 0, w: 2, h: 1, label: 'Users', widget: { type: 'stat', props: { label: 'Users', value: '12' } } },
    ];
    await el.updateComplete;
    const renderer = el.querySelector('[data-cell-id="a"] lr-widget-renderer') as unknown as { document: unknown };
    expect(renderer.document !== null).to.equal(true);

    el.layout = [{ cellId: 'a', x: 0, y: 0, w: 2, h: 1, label: 'Users' }];
    await el.updateComplete;
    expect(el.querySelector('[data-cell-id="a"] lr-widget-renderer') === (renderer as unknown)).to.equal(true);
    expect(renderer.document).to.equal(null);
  });
});

describe('lr-dashboard-grid foreign pointers during a gesture', () => {
  it('ignores moves and releases from another pointer while a cell drag is active', async () => {
    const el = await fixture<LyraDashboardGrid>(
      html`<lr-dashboard-grid cells-draggable row-height="50" gap="8"></lr-dashboard-grid>`
    );
    el.layout = [{ cellId: 'a', x: 0, y: 0, w: 1, h: 1 }];
    await el.updateComplete;
    const wrapper = cellsOf(el)[0]!;
    wrapper.setPointerCapture = () => {};
    const moves: Array<{ position: { x: number; y: number } }> = [];
    el.addEventListener('lr-cell-move', (e) => moves.push((e as CustomEvent).detail));

    wrapper.dispatchEvent(new PointerEvent('pointerdown', { isPrimary: true, pointerId: 41, clientX: 0, clientY: 0, bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 41, clientX: 0, clientY: 58 }));
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 42, clientX: 0, clientY: 290 }));
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 42, clientX: 0, clientY: 290 }));
    expect(wrapper.hasAttribute('data-dragging')).to.equal(true);
    expect(moves.length).to.equal(0);

    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 41, clientX: 0, clientY: 58 }));
    expect(wrapper.hasAttribute('data-dragging')).to.equal(false);
    expect(moves.map((m) => m.position)).to.deep.equal([{ x: 0, y: 1 }]);
  });

  it('ignores moves and releases from another pointer while a resize is active', async () => {
    const el = await fixture<LyraDashboardGrid>(
      html`<lr-dashboard-grid cells-resizable row-height="50" gap="8"></lr-dashboard-grid>`
    );
    el.layout = [{ cellId: 'a', x: 0, y: 0, w: 1, h: 1 }];
    await el.updateComplete;
    const wrapper = cellsOf(el)[0]!;
    const handle = el.shadowRoot!.querySelector<HTMLElement>('[part="resize-handle"]')!;
    handle.setPointerCapture = () => {};
    const resizes: Array<{ size: { w: number; h: number } }> = [];
    el.addEventListener('lr-cell-resize', (e) => resizes.push((e as CustomEvent).detail));

    handle.dispatchEvent(
      new PointerEvent('pointerdown', { isPrimary: true, pointerId: 51, clientX: 0, clientY: 0, bubbles: true, composed: true })
    );
    expect(wrapper.hasAttribute('data-resizing')).to.equal(true);
    // Two same-frame moves coalesce into one preview; the later position wins.
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 51, clientX: 0, clientY: 116 }));
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 51, clientX: 0, clientY: 58 }));
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 52, clientX: 0, clientY: 400 }));
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 52, clientX: 0, clientY: 400 }));
    expect(wrapper.hasAttribute('data-resizing')).to.equal(true);
    expect(resizes.length).to.equal(0);

    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 51, clientX: 0, clientY: 58 }));
    expect(wrapper.hasAttribute('data-resizing')).to.equal(false);
    expect(resizes.map((r) => r.size)).to.deep.equal([{ w: 1, h: 2 }]);
  });
});

describe('lr-dashboard-grid controlled layout follow-up', () => {
  it('stays silent when the host answers a move request with a different or missing cell', async () => {
    const el = await fixture<LyraDashboardGrid>(html`<lr-dashboard-grid cells-draggable></lr-dashboard-grid>`);
    el.layout = [
      { cellId: 'a', x: 0, y: 0, w: 1, h: 1, label: 'Alpha' },
      { cellId: 'b', x: 4, y: 0, w: 1, h: 1, label: 'Beta' },
    ];
    await el.updateComplete;
    (el as unknown as { announcer: { throttleMs: number } }).announcer.throttleMs = 0;
    const mirror = el.shadowRoot!.querySelector<HTMLElement>('[part="live-region"]')!;
    const moveA = (): void => {
      el.shadowRoot!.querySelector<HTMLElement>('[data-cell-id="a"]')!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', ctrlKey: true, bubbles: true, cancelable: true })
      );
    };

    moveA();
    // The host overrides the proposal with its own position for the cell.
    el.layout = [
      { cellId: 'a', x: 0, y: 3, w: 1, h: 1, label: 'Alpha' },
      { cellId: 'b', x: 4, y: 0, w: 1, h: 1, label: 'Beta' },
    ];
    await el.updateComplete;
    moveA();
    // The host drops the cell entirely.
    el.layout = [{ cellId: 'b', x: 4, y: 0, w: 1, h: 1, label: 'Beta' }];
    await el.updateComplete;
    // wait-reason: negative assertion: an unapplied placement must never be announced
    await new Promise<void>((resolve) => setTimeout(resolve, 30));
    expect(mirror.textContent?.trim()).to.equal('');
    expect(el.layout.map((cell) => cell.cellId)).to.deep.equal(['b']);
  });

  it('clamps the roving stop when the active cell id disappears from a shorter layout', async () => {
    const el = await fixture<LyraDashboardGrid>(html`<lr-dashboard-grid></lr-dashboard-grid>`);
    el.layout = threeInARow();
    await el.updateComplete;
    key(cellsOf(el)[0]!, { key: 'End' });
    await el.updateComplete;
    expect(cellsOf(el)[2]!.getAttribute('tabindex')).to.equal('0');

    el.layout = [
      { cellId: 'x', x: 0, y: 0, w: 1, h: 1 },
      { cellId: 'y', x: 1, y: 0, w: 1, h: 1 },
    ];
    await el.updateComplete;
    expect(cellsOf(el).map((cell) => cell.getAttribute('tabindex'))).to.deep.equal(['-1', '0']);
  });
});

import { expectDeprecatedUsage } from '../../../../test/expected-deprecations.js';
import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import './table.js';
import '../../forms/select/select.js';
import type { LyraTable, TableColumn } from './table.js';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
// Registers the real shipped `ar` catalog's `data` slice so the `lang="ar-EG"` resize-value
// test below (which only overrides `resizeValuePixels`) can render without tripping the
// dev-mode locale-fallback warning that strict-console platform lanes treat as fatal.
import '../../../translations/ar/data.js';
import { installTableTestHooks, type Row, columns, rows, priorityColumns } from '../../../../test/table.js';
installTableTestHooks();


expectDeprecatedUsage('lr-table', 'attribute', 'accessible-label');
expectDeprecatedUsage('lr-table', 'property', 'accessibleLabel');


it('resizes a resizable column through its native pointer handle and emits live widths', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = [
    {
      key: 'name',
      label: 'Name',
      width: '120px',
      minWidth: '80px',
      resizable: true,
      cell: (r) => r.name,
    },
    columns[1]!,
  ];
  el.rows = rows;
  el.rowKey = (r) => r.id;
  await el.updateComplete;

  const handle = el.shadowRoot!.querySelector('[part="resize-handle"]') as HTMLElement;
  expect(handle.getAttribute('aria-label')).to.equal('Resize Name column');
  // Synthetic PointerEvents do not carry a browser-owned pointer, so Firefox
  // rejects native pointer capture for this fixture. The gesture behavior is
  // exercised through the dispatched move/up events below.
  handle.setPointerCapture = () => {};
  handle.releasePointerCapture = () => {};
  let detail: { columnKey: string; width: number } | undefined;
  el.addEventListener('lr-column-resize', (event) => (detail = (event as CustomEvent).detail));

  handle.dispatchEvent(
    new PointerEvent('pointerdown', {
      bubbles: true,
      pointerId: 1,
      clientX: 100,
    })
  );
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 140 }));
  await el.updateComplete;
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: 140 }));

  expect(detail?.columnKey).to.equal('name');
  expect(detail?.width).to.be.greaterThan(80);
  expect((el.shadowRoot!.querySelector('col') as HTMLElement).style.inlineSize).to.equal(`${detail!.width}px`);
});

it('keeps an adopted iframe resize drag in its owner window and releases that window on teardown', async () => {
  const iframe = document.createElement('iframe');
  const loaded = new Promise<void>((resolve) => iframe.addEventListener('load', () => resolve(), { once: true }));
  document.body.append(iframe);
  await loaded;
  const frameDocument = iframe.contentDocument!;
  const frameWindow = iframe.contentWindow!;
  const OriginalMainResizeObserver = window.ResizeObserver;
  const OriginalFrameResizeObserver = frameWindow.ResizeObserver;
  const originalFrameRequestAnimationFrame = frameWindow.requestAnimationFrame;
  const originalFrameCancelAnimationFrame = frameWindow.cancelAnimationFrame;
  let frameResizeObserverCallback: ResizeObserverCallback | undefined;
  let frameResizeObserverConstructions = 0;
  let frameResizeObserverDisconnects = 0;
  const frameObservedTargets: Element[] = [];
  const frameCallbacks = new Map<number, FrameRequestCallback>();
  const canceledFrameIds: number[] = [];
  let nextFrameId = 500;
  class MainInertResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  class FrameResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      frameResizeObserverConstructions += 1;
      frameResizeObserverCallback = callback;
    }
    observe(target: Element) {
      frameObservedTargets.push(target);
    }
    unobserve() {}
    disconnect() {
      frameResizeObserverDisconnects += 1;
    }
  }
  window.ResizeObserver = MainInertResizeObserver as unknown as typeof ResizeObserver;
  frameWindow.ResizeObserver = FrameResizeObserver as unknown as typeof ResizeObserver;
  frameWindow.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    const id = ++nextFrameId;
    frameCallbacks.set(id, callback);
    return id;
  }) as typeof frameWindow.requestAnimationFrame;
  frameWindow.cancelAnimationFrame = ((id: number) => {
    canceledFrameIds.push(id);
    frameCallbacks.delete(id);
  }) as typeof frameWindow.cancelAnimationFrame;
  frameDocument.documentElement.style.fontSize = '10px';
  let el: LyraTable<Row> | undefined;

  try {
    el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.style.setProperty('--lr-table-resize-min-width', '3rem');
    el.columns = [
      {
        key: 'name',
        label: 'Name',
        width: '120px',
        resizable: true,
        cell: (row) => row.name,
      },
      columns[1]!,
    ];
    el.rows = rows;
    el.rowKey = (row) => row.id;
    await el.updateComplete;
    frameDocument.body.append(frameDocument.adoptNode(el));
    await el.updateComplete;
    expect(frameResizeObserverConstructions, 'the observer is constructed in the iframe realm').to.equal(1);
    expect(frameObservedTargets.every((target) => target.ownerDocument === frameDocument)).to.be.true;
    const handle = el.shadowRoot!.querySelector('[part="resize-handle"]') as HTMLElement;
    handle.setPointerCapture = () => {};
    handle.releasePointerCapture = () => {};
    let liveEvents = 0;
    el.addEventListener('lr-column-resize', (event) => {
      if (!event.cancelable) liveEvents += 1;
    });

    handle.dispatchEvent(
      new frameWindow.PointerEvent('pointerdown', {
        bubbles: true,
        pointerId: 71,
        clientX: 100,
      })
    );
    expect(
      (el as unknown as { resizeEventWindow?: Window }).resizeEventWindow === frameWindow,
      'the drag retains the iframe window that owns the handle'
    ).to.be.true;
    frameWindow.dispatchEvent(
      new frameWindow.PointerEvent('pointermove', {
        pointerId: 71,
        clientX: -10000,
      })
    );
    expect(liveEvents, 'pointer movement from the iframe window reaches the drag').to.equal(1);
    expect(
      (el as unknown as { resizedColumnWidths: Map<string, number> }).resizedColumnWidths.get('name'),
      'rem minimum width resolves from the iframe document root'
    ).to.equal(30);
    frameWindow.dispatchEvent(
      new frameWindow.PointerEvent('pointerup', {
        pointerId: 71,
        clientX: -10000,
      })
    );
    expect((el as unknown as { resizeEventWindow?: Window }).resizeEventWindow === undefined).to.be.true;

    frameResizeObserverCallback!([], {} as ResizeObserver);
    expect(frameCallbacks.size, 'layout sync uses the iframe animation clock').to.equal(1);
    const pendingFrameIds = [...frameCallbacks.keys()];

    handle.dispatchEvent(
      new frameWindow.PointerEvent('pointerdown', {
        bubbles: true,
        pointerId: 72,
        clientX: 100,
      })
    );
    el.remove();
    expect(
      (el as unknown as { resizeEventWindow?: Window }).resizeEventWindow === undefined,
      'disconnect releases the exact retained window'
    ).to.be.true;
    expect(frameResizeObserverDisconnects, 'disconnect tears down the iframe observer').to.equal(1);
    expect(canceledFrameIds).to.include.members(pendingFrameIds);
    expect(frameCallbacks.size).to.equal(0);
  } finally {
    el?.remove();
    window.ResizeObserver = OriginalMainResizeObserver;
    frameWindow.ResizeObserver = OriginalFrameResizeObserver;
    frameWindow.requestAnimationFrame = originalFrameRequestAnimationFrame;
    frameWindow.cancelAnimationFrame = originalFrameCancelAnimationFrame;
    iframe.remove();
  }
});

it('rolls back an uncommitted resize preview when another drag replaces it or the table disconnects', async () => {
  const wrapper = (await fixture(html`<div><lr-table></lr-table></div>`)) as HTMLElement;
  const el = wrapper.querySelector('lr-table') as LyraTable<Row>;
  el.columns = [
    {
      key: 'name',
      label: 'Name',
      width: '120px',
      minWidth: '80px',
      resizable: true,
      cell: (row) => row.name,
    },
  ];
  el.rows = rows;
  el.rowKey = (row) => row.id;
  await el.updateComplete;
  const handle = el.shadowRoot!.querySelector('[part="resize-handle"]') as HTMLElement;
  handle.setPointerCapture = () => {};
  handle.releasePointerCapture = () => {};
  const widths = (): Map<string, number> =>
    (el as unknown as { resizedColumnWidths: Map<string, number> }).resizedColumnWidths;

  handle.dispatchEvent(
    new PointerEvent('pointerdown', {
      bubbles: true,
      pointerId: 75,
      clientX: 100,
    })
  );
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 75, clientX: 150 }));
  expect(widths().get('name')).to.be.greaterThan(120);

  handle.dispatchEvent(
    new PointerEvent('pointerdown', {
      bubbles: true,
      pointerId: 76,
      clientX: 100,
    })
  );
  expect(widths().has('name'), 'replacing a drag rolls back its live-only width').to.be.false;
  window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 76 }));
  await el.updateComplete;
  expect((el.shadowRoot!.querySelector('col') as HTMLElement).style.inlineSize).to.equal('120px');

  handle.dispatchEvent(
    new PointerEvent('pointerdown', {
      bubbles: true,
      pointerId: 77,
      clientX: 100,
    })
  );
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 77, clientX: 160 }));
  expect(widths().get('name')).to.be.greaterThan(120);
  el.remove();
  expect(widths().has('name'), 'disconnect rolls back the live-only width').to.be.false;
  wrapper.append(el);
  await el.updateComplete;
  expect((el.shadowRoot!.querySelector('col') as HTMLElement).style.inlineSize).to.equal('120px');
});

it('does not throw when releasePointerCapture rejects the release while canceling a resize gesture on disconnect', async () => {
  const wrapper = (await fixture(html`<div><lr-table></lr-table></div>`)) as HTMLElement;
  const el = wrapper.querySelector('lr-table') as LyraTable<Row>;
  el.columns = [
    {
      key: 'name',
      label: 'Name',
      width: '120px',
      minWidth: '80px',
      resizable: true,
      cell: (row) => row.name,
    },
  ];
  el.rows = rows;
  await el.updateComplete;
  const handle = el.shadowRoot!.querySelector('[part="resize-handle"]') as HTMLElement;
  handle.setPointerCapture = () => {};
  handle.releasePointerCapture = () => {
    throw new DOMException('already released', 'InvalidStateError');
  };

  handle.dispatchEvent(
    new PointerEvent('pointerdown', {
      bubbles: true,
      pointerId: 80,
      clientX: 100,
    })
  );
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 80, clientX: 150 }));
  // Disconnecting mid-drag cancels the in-flight gesture, which tries to release native pointer
  // capture as a courtesy -- a browser that has already invalidated it (or never granted it to a
  // synthetic PointerEvent) must not crash the disconnect.
  expect(() => el.remove()).to.not.throw();
  expect((el as unknown as { resizeState: unknown }).resizeState).to.be.undefined;
});

it('fires exactly one cancelable lr-column-resize-request, at drag-end, for the committed width -- not per pixel', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = [
    {
      key: 'name',
      label: 'Name',
      width: '120px',
      minWidth: '80px',
      resizable: true,
      cell: (r) => r.name,
    },
    columns[1]!,
  ];
  el.rows = rows;
  el.rowKey = (r) => r.id;
  await el.updateComplete;

  const handle = el.shadowRoot!.querySelector('[part="resize-handle"]') as HTMLElement;
  handle.setPointerCapture = () => {};
  handle.releasePointerCapture = () => {};

  const cancelableCount = { value: 0 };
  const nonCancelableCount = { value: 0 };
  el.addEventListener('lr-column-resize-request', (event) => {
    expect(event.cancelable).to.be.true;
    cancelableCount.value += 1;
  });
  el.addEventListener('lr-column-resize', (event) => {
    expect(event.cancelable).to.be.false;
    nonCancelableCount.value += 1;
  });

  handle.dispatchEvent(
    new PointerEvent('pointerdown', {
      bubbles: true,
      pointerId: 8,
      clientX: 100,
    })
  );
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 8, clientX: 120 }));
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 8, clientX: 140 }));
  await el.updateComplete;
  // Per-pixel move steps stay non-cancelable -- a refuted parallel proposal made these
  // vetoable, which would make live drag feedback janky/inconsistent.
  expect(nonCancelableCount.value, 'per-pixel pointermove steps are not cancelable').to.equal(2);
  expect(cancelableCount.value, 'no commit yet -- drag still in progress').to.equal(0);

  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 8, clientX: 140 }));
  await el.updateComplete;
  expect(cancelableCount.value, 'exactly one cancelable commit, fired at drag-end').to.equal(1);
});

it('honors preventDefault() on the drag-end lr-column-resize-request proposal by reverting the rendered width', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = [
    {
      key: 'name',
      label: 'Name',
      width: '120px',
      minWidth: '80px',
      resizable: true,
      cell: (r) => r.name,
    },
    columns[1]!,
  ];
  el.rows = rows;
  el.rowKey = (r) => r.id;
  await el.updateComplete;

  const handle = el.shadowRoot!.querySelector('[part="resize-handle"]') as HTMLElement;
  handle.setPointerCapture = () => {};
  handle.releasePointerCapture = () => {};
  el.addEventListener('lr-column-resize-request', (event) => {
    const custom = event as CustomEvent<{ columnKey: string; width: number }>;
    if (custom.cancelable) custom.preventDefault();
  });

  const col = (): HTMLElement => el.shadowRoot!.querySelector('col') as HTMLElement;
  const originalWidth = col().style.inlineSize; // the declared '120px', pre-drag

  handle.dispatchEvent(
    new PointerEvent('pointerdown', {
      bubbles: true,
      pointerId: 9,
      clientX: 100,
    })
  );
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 9, clientX: 140 }));
  await el.updateComplete;
  // Mid-drag the (non-cancelable) live preview still applies, matching existing behavior.
  expect(col().style.inlineSize).to.not.equal(originalWidth);

  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 9, clientX: 140 }));
  await el.updateComplete;
  // The vetoed drag-end commit reverts the rendered width back to its pre-drag value.
  expect(col().style.inlineSize).to.equal(originalWidth);
});

it('rolls back the live column-width preview without a terminal commit when pointer capture is canceled', async () => {
  for (const [index, endType] of (['pointercancel', 'lostpointercapture'] as const).entries()) {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = [
      {
        key: 'name',
        label: 'Name',
        width: '120px',
        minWidth: '80px',
        resizable: true,
        cell: (r) => r.name,
      },
      columns[1]!,
    ];
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;

    const handle = el.shadowRoot!.querySelector('[part="resize-handle"]') as HTMLElement;
    const col = (): HTMLElement => el.shadowRoot!.querySelector('col') as HTMLElement;
    handle.setPointerCapture = () => {};
    handle.releasePointerCapture = () => {};
    const originalWidth = col().style.inlineSize;
    let liveEvents = 0;
    let terminalEvents = 0;
    el.addEventListener('lr-column-resize-request', () => terminalEvents++);
    el.addEventListener('lr-column-resize', () => liveEvents++);
    const pointerId = 40 + index;

    handle.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        pointerId,
        clientX: 100,
      })
    );
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId, clientX: 140 }));
    await el.updateComplete;
    expect(liveEvents, endType).to.equal(1);
    expect(col().style.inlineSize, endType).to.not.equal(originalWidth);

    window.dispatchEvent(new PointerEvent(endType, { pointerId }));
    await el.updateComplete;

    expect(terminalEvents, endType).to.equal(0);
    expect(col().style.inlineSize, endType).to.equal(originalWidth);
  }
});

it('does not throw when releasePointerCapture rejects the release at drag-end (pointerup)', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = [
    {
      key: 'name',
      label: 'Name',
      width: '120px',
      minWidth: '80px',
      resizable: true,
      cell: (r) => r.name,
    },
  ];
  el.rows = rows;
  await el.updateComplete;

  const handle = el.shadowRoot!.querySelector('[part="resize-handle"]') as HTMLElement;
  handle.setPointerCapture = () => {};
  handle.releasePointerCapture = () => {
    throw new DOMException('already released', 'InvalidStateError');
  };

  handle.dispatchEvent(
    new PointerEvent('pointerdown', {
      bubbles: true,
      pointerId: 70,
      clientX: 100,
    })
  );
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 70, clientX: 150 }));
  expect(() => window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 70, clientX: 150 }))).to.not.throw();
  await el.updateComplete;
  // The drag still completes normally (state cleared) despite the native release failing.
  expect((el as unknown as { resizeState: unknown }).resizeState).to.be.undefined;
});

it('uses the themed minimum width when a resizable column has no explicit minimum', async () => {
  const el = (await fixture(html`<lr-table style="--lr-table-resize-min-width:90px"></lr-table>`)) as LyraTable<Row>;
  el.columns = [
    {
      key: 'name',
      label: 'Name',
      width: '120px',
      resizable: true,
      cell: (r) => r.name,
    },
  ];
  el.rows = rows;
  await el.updateComplete;

  const handle = el.shadowRoot!.querySelector('[part="resize-handle"]') as HTMLElement;
  handle.setPointerCapture = () => {};
  handle.releasePointerCapture = () => {};
  handle.dispatchEvent(
    new PointerEvent('pointerdown', {
      bubbles: true,
      pointerId: 2,
      clientX: 100,
    })
  );
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 2, clientX: -10000 }));

  expect((el as unknown as { resizedColumnWidths: Map<string, number> }).resizedColumnWidths.get('name')).to.equal(90);
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 2, clientX: -10000 }));
});

it('inherits resize theme hooks from an ancestor while direct host values still win', async () => {
  const wrapper = await fixture(html`
    <div style="--lr-table-resize-min-width:77px; --lr-table-resize-handle-opacity:0.37">
      <lr-table></lr-table>
    </div>
  `);
  const el = wrapper.querySelector('lr-table') as LyraTable<Row>;
  el.columns = [
    {
      key: 'name',
      label: 'Name',
      width: '120px',
      resizable: true,
      cell: (r) => r.name,
    },
  ];
  el.rows = rows;
  await el.updateComplete;

  const handle = el.shadowRoot!.querySelector('[part="resize-handle"]') as HTMLElement;
  expect(getComputedStyle(handle).getPropertyValue('--lr-table-resize-handle-opacity').trim()).to.equal('0.37');
  handle.setPointerCapture = () => {};
  handle.releasePointerCapture = () => {};
  handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 22, clientX: 100 }));
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 22, clientX: -10000 }));
  expect((el as unknown as { resizedColumnWidths: Map<string, number> }).resizedColumnWidths.get('name')).to.equal(77);
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 22, clientX: -10000 }));

  el.style.setProperty('--lr-table-resize-min-width', '91px');
  el.style.setProperty('--lr-table-resize-handle-opacity', '0.21');
  expect(getComputedStyle(handle).getPropertyValue('--lr-table-resize-handle-opacity').trim()).to.equal('0.21');
});

it('renders inherited resize-handle hover/pressed hooks while direct host values still win', async () => {
  const wrapper = await fixture(html`
    <div
      style="--lr-table-resize-handle-hover-bg: rgb(1, 2, 3); --lr-table-resize-handle-hover-opacity: 0.31; --lr-table-resize-handle-active-bg: rgb(4, 5, 6); --lr-table-resize-handle-active-opacity: 0.72"
    >
      <lr-table></lr-table>
    </div>
  `);
  const el = wrapper.querySelector('lr-table') as LyraTable<Row>;
  el.columns = [
    {
      key: 'name',
      label: 'Name',
      width: '120px',
      resizable: true,
      cell: (row) => row.name,
    },
  ];
  el.rows = rows;
  await el.updateComplete;
  const handle = el.shadowRoot!.querySelector('[part="resize-handle"]') as HTMLElement;

  try {
    // `sendMouse` resolves once the synthesized command completes, which is not when the engine
    // has processed the native pointer event it produced -- and a late layout settle can move the
    // handle out from under an already-dispatched position. `hoverUntilMatched` re-reads the rect
    // and re-dispatches until `:hover` actually matches, so the poll below waits on the paint
    // rather than on the pointer ever having arrived.
    await hoverUntilMatched(handle, 'the resize handle never took the pointer');
    await waitUntil(() => getComputedStyle(handle).backgroundColor === 'rgb(1, 2, 3)');
    expect(getComputedStyle(handle).opacity).to.equal('0.31');

    el.style.setProperty('--lr-table-resize-handle-hover-bg', 'rgb(7, 8, 9)');
    await waitUntil(() => getComputedStyle(handle).backgroundColor === 'rgb(7, 8, 9)');

    await sendMouse({ type: 'down' });
    await waitUntil(() => getComputedStyle(handle).backgroundColor === 'rgb(4, 5, 6)');
    await waitUntil(() => getComputedStyle(handle).opacity === '0.72', 'handle opacity never reached 0.72');

    el.style.setProperty('--lr-table-resize-handle-active-bg', 'rgb(10, 11, 12)');
    await waitUntil(() => getComputedStyle(handle).backgroundColor === 'rgb(10, 11, 12)');
  } finally {
    await sendMouse({ type: 'up' });
    await resetMouse();
  }
});

it('resolves a rem-unit themed minimum width against the root font size', async () => {
  const el = (await fixture(html`<lr-table style="--lr-table-resize-min-width:5rem"></lr-table>`)) as LyraTable<Row>;
  el.columns = [
    {
      key: 'name',
      label: 'Name',
      width: '400px',
      resizable: true,
      cell: (r) => r.name,
    },
  ];
  el.rows = rows;
  await el.updateComplete;

  const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  const handle = el.shadowRoot!.querySelector('[part="resize-handle"]') as HTMLElement;
  handle.setPointerCapture = () => {};
  handle.releasePointerCapture = () => {};
  handle.dispatchEvent(
    new PointerEvent('pointerdown', {
      bubbles: true,
      pointerId: 3,
      clientX: 100,
    })
  );
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 3, clientX: -10000 }));

  expect((el as unknown as { resizedColumnWidths: Map<string, number> }).resizedColumnWidths.get('name')).to.equal(
    5 * rootFontSize
  );
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 3, clientX: -10000 }));
});

it("resolves an em-unit themed minimum width against the table's own font size", async () => {
  const el = (await fixture(html`<lr-table style="--lr-table-resize-min-width:3em"></lr-table>`)) as LyraTable<Row>;
  el.columns = [
    {
      key: 'name',
      label: 'Name',
      width: '400px',
      resizable: true,
      cell: (r) => r.name,
    },
  ];
  el.rows = rows;
  await el.updateComplete;

  const ownFontSize = Number.parseFloat(getComputedStyle(el).fontSize);
  const handle = el.shadowRoot!.querySelector('[part="resize-handle"]') as HTMLElement;
  handle.setPointerCapture = () => {};
  handle.releasePointerCapture = () => {};
  handle.dispatchEvent(
    new PointerEvent('pointerdown', {
      bubbles: true,
      pointerId: 4,
      clientX: 100,
    })
  );
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 4, clientX: -10000 }));

  expect((el as unknown as { resizedColumnWidths: Map<string, number> }).resizedColumnWidths.get('name')).to.equal(
    3 * ownFontSize
  );
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 4, clientX: -10000 }));
});

it('resolves a case-insensitive REM minimum width against the root font size, not as raw pixels', async () => {
  const el = (await fixture(html`<lr-table style="--lr-table-resize-min-width:5REM"></lr-table>`)) as LyraTable<Row>;
  el.columns = [
    {
      key: 'name',
      label: 'Name',
      width: '400px',
      resizable: true,
      cell: (r) => r.name,
    },
  ];
  el.rows = rows;
  await el.updateComplete;

  const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  const handle = el.shadowRoot!.querySelector('[part="resize-handle"]') as HTMLElement;
  handle.setPointerCapture = () => {};
  handle.releasePointerCapture = () => {};
  handle.dispatchEvent(
    new PointerEvent('pointerdown', {
      bubbles: true,
      pointerId: 5,
      clientX: 100,
    })
  );
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 5, clientX: -10000 }));

  // CSS units are case-insensitive: a lowercase-only unit check reads '5REM' as a bare 5px floor.
  expect((el as unknown as { resizedColumnWidths: Map<string, number> }).resizedColumnWidths.get('name')).to.equal(
    5 * rootFontSize
  );
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 5, clientX: -10000 }));
});

it('falls back to the default minimum width for a unit with no resolvable pixel length, instead of reading it as pixels', async () => {
  const el = (await fixture(html`<lr-table style="--lr-table-resize-min-width:5pt"></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  await el.updateComplete;
  const internals = el as unknown as {
    minimumResizeWidth(column: TableColumn<Row>): number;
  };
  // A number-plus-unrecognized-unit value must not collapse to its bare number, which would let a
  // drag shrink the column to 5px; the documented default floor applies instead.
  expect(internals.minimumResizeWidth(columns[0]!)).to.equal(48);
});

it('resolves an em-unit minimum width against the root font size when the host has no readable font-size', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  await el.updateComplete;
  const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  const originalGetComputedStyle = window.getComputedStyle;
  window.getComputedStyle = ((element: Element) => {
    if (element === el) {
      return {
        fontSize: '',
        getPropertyValue: (name: string) =>
          name === '--lr-table-resize-min-width' ? '2em' : '',
      } as CSSStyleDeclaration;
    }
    return originalGetComputedStyle(element);
  }) as typeof window.getComputedStyle;
  try {
    const internals = el as unknown as {
      minimumResizeWidth(column: TableColumn<Row>): number;
    };
    // An element with no computed font-size of its own inherits the document root's, so an `em`
    // floor anchors there rather than discarding the authored width -- the shared
    // resolveCssLength() contract every unit-resolving component in the library now follows.
    expect(internals.minimumResizeWidth(columns[0]!)).to.equal(2 * rootFontSize);
  } finally {
    window.getComputedStyle = originalGetComputedStyle;
  }
});

it('exposes focusable separator state and resizes by keyboard without sorting the header', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = [
    {
      key: 'name',
      label: 'Name',
      width: '120px',
      minWidth: '80px',
      maxWidth: '160px',
      resizable: true,
      sortable: true,
      cell: (row) => row.name,
    },
  ];
  el.rows = rows;
  await el.updateComplete;

  const handle = el.shadowRoot!.querySelector('[part="resize-handle"]') as HTMLElement;
  expect(handle.getAttribute('tabindex')).to.equal('0');
  expect(handle.getAttribute('role')).to.equal('separator');
  expect(handle.getAttribute('aria-valuemin')).to.equal('80');
  expect(handle.getAttribute('aria-valuenow')).to.equal('120');
  expect(handle.getAttribute('aria-valuemax')).to.equal('160');
  handle.focus();
  expect((el.shadowRoot!.activeElement as HTMLElement | null)?.getAttribute('part')).to.equal('resize-handle');

  const widths: number[] = [];
  el.addEventListener('lr-column-resize', (event) => widths.push(event.detail.width));
  const press = async (key: string, shiftKey = false): Promise<KeyboardEvent> => {
    const event = new KeyboardEvent('keydown', {
      key,
      shiftKey,
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    handle.dispatchEvent(event);
    await el.updateComplete;
    return event;
  };

  expect((await press('ArrowRight')).defaultPrevented).to.be.true;
  expect(handle.getAttribute('aria-valuenow')).to.equal('130');
  expect(el.sortKey).to.equal('');
  await press('ArrowLeft', true);
  expect(handle.getAttribute('aria-valuenow')).to.equal('80');
  await press('End');
  expect(handle.getAttribute('aria-valuenow')).to.equal('160');
  await press('Home');
  expect(handle.getAttribute('aria-valuenow')).to.equal('80');
  expect(widths).to.deep.equal([130, 80, 160, 80]);
});

it('honors preventDefault() on a keyboard resize commit, reverting to the pre-press width', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = [
    {
      key: 'name',
      label: 'Name',
      width: '120px',
      minWidth: '80px',
      maxWidth: '160px',
      resizable: true,
      cell: (row) => row.name,
    },
  ];
  el.rows = rows;
  await el.updateComplete;

  const handle = el.shadowRoot!.querySelector('[part="resize-handle"]') as HTMLElement;
  el.addEventListener('lr-column-resize-request', (event) => (event as CustomEvent).preventDefault());
  handle.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;

  expect(handle.getAttribute('aria-valuenow')).to.equal('120');
});

it('reverts to a previously-committed width (not the originally-declared one) when a later keyboard resize is vetoed', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = [
    {
      key: 'name',
      label: 'Name',
      width: '120px',
      minWidth: '80px',
      maxWidth: '200px',
      resizable: true,
      cell: (row) => row.name,
    },
  ];
  el.rows = rows;
  await el.updateComplete;

  const handle = el.shadowRoot!.querySelector('[part="resize-handle"]') as HTMLElement;
  // First resize succeeds (no listener yet), establishing a committed width distinct from the
  // originally-declared 120px -- the value a later veto below must roll back to.
  handle.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect(handle.getAttribute('aria-valuenow')).to.equal('130');

  el.addEventListener('lr-column-resize-request', (event) => (event as CustomEvent).preventDefault());
  handle.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  // Reverts to the first resize's 130px, not the originally-declared 120px.
  expect(handle.getAttribute('aria-valuenow')).to.equal('130');
});

it('keeps the width a vetoing listener applied itself during a keyboard resize commit', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = [
    {
      key: 'name',
      label: 'Name',
      width: '120px',
      minWidth: '80px',
      maxWidth: '200px',
      resizable: true,
      cell: (row) => row.name,
    },
  ];
  el.rows = rows;
  await el.updateComplete;

  const handle = el.shadowRoot!.querySelector('[part="resize-handle"]') as HTMLElement;
  const press = (key: string): void => {
    handle.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  };
  // An unvetoed first step, so the vetoed one below has a committed 130px to roll back *to*.
  // Without it the rollback would just delete the entry and the declared 120px would mask the bug.
  press('ArrowRight');
  await el.updateComplete;
  expect(handle.getAttribute('aria-valuenow')).to.equal('130');

  // The listener refuses the proposed step and resolves the resize its own way from inside the
  // same synchronous dispatch -- through the component's own keyboard affordance, the only public
  // route to a committed width. `resolving` stops that re-entrant commit being vetoed in turn.
  let resolving = false;
  el.addEventListener('lr-column-resize-request', (event) => {
    if (resolving) return;
    resolving = true;
    (event as CustomEvent).preventDefault();
    press('Home');
  });
  press('ArrowRight');
  await el.updateComplete;

  // The listener's own 80px stands: the veto must not roll back on top of a width written during
  // its own dispatch, which would restore the stale pre-emit 130px.
  expect(handle.getAttribute('aria-valuenow')).to.equal('80');
});

it('keeps the width a vetoing listener applied itself during a drag-end resize commit', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = [
    {
      key: 'name',
      label: 'Name',
      width: '120px',
      minWidth: '80px',
      resizable: true,
      cell: (r) => r.name,
    },
    columns[1]!,
  ];
  el.rows = rows;
  el.rowKey = (r) => r.id;
  await el.updateComplete;

  const handle = el.shadowRoot!.querySelector('[part="resize-handle"]') as HTMLElement;
  handle.setPointerCapture = () => {};
  handle.releasePointerCapture = () => {};
  const col = (): HTMLElement => el.shadowRoot!.querySelector('col') as HTMLElement;

  let resolving = false;
  el.addEventListener('lr-column-resize-request', (event) => {
    const custom = event as CustomEvent<{ columnKey: string; width: number }>;
    if (!custom.cancelable || resolving) return;
    resolving = true;
    custom.preventDefault();
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
  });

  handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 11, clientX: 100 }));
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 11, clientX: 160 }));
  await el.updateComplete;
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 11, clientX: 160 }));
  await el.updateComplete;

  // The listener's own minimum-width resolution stands, rather than the pre-drag width the
  // vetoed commit would otherwise restore over it.
  expect(col().style.inlineSize).to.equal('80px');
});

it('mirrors resize ArrowLeft/ArrowRight under RTL and passes axe populated', async () => {
  const el = (await fixture(html`<lr-table dir="rtl"></lr-table>`)) as LyraTable<Row>;
  el.columns = [
    {
      key: 'name',
      label: 'Name',
      width: '120px',
      minWidth: '80px',
      resizable: true,
      cell: (row) => row.name,
    },
  ];
  el.rows = rows;
  await el.updateComplete;
  const handle = el.shadowRoot!.querySelector('[part="resize-handle"]') as HTMLElement;

  handle.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect(handle.getAttribute('aria-valuenow')).to.equal('110');
  handle.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect(handle.getAttribute('aria-valuenow')).to.equal('120');
  await expect(el).to.be.accessible();
});

it('announces the rendered width when a resizable column has no pixel width', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = [
    {
      key: 'name',
      label: 'Name',
      width: '12rem',
      resizable: true,
      cell: (row) => row.name,
    },
  ];
  el.rows = rows;
  await el.updateComplete;

  const header = el.shadowRoot!.querySelector('th[data-col-key="name"]') as HTMLElement;
  header.getBoundingClientRect = () => ({ width: 192 } as DOMRect);
  el.requestUpdate();
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('[part="resize-handle"]')!.getAttribute('aria-valuenow')).to.equal('192');
});

it('localizes the synchronized rendered resize value while retaining its numeric ARIA value', async () => {
  const el = (await fixture(
    html`<lr-table
      lang="ar-EG"
      .strings=${{ resizeValuePixels: 'العرض {value} بكسل' }}
    ></lr-table>`
  )) as LyraTable<Row>;
  el.columns = [
    {
      key: 'name',
      label: 'Name',
      width: '12rem',
      resizable: true,
      cell: (row) => row.name,
    },
  ];
  el.rows = rows;
  await el.updateComplete;

  const header = el.shadowRoot!.querySelector('th[data-col-key="name"]') as HTMLElement;
  header.getBoundingClientRect = () => ({ width: 192 } as DOMRect);
  el.requestUpdate();
  await el.updateComplete;

  const handle = el.shadowRoot!.querySelector<HTMLElement>('[part="resize-handle"]')!;
  expect(handle.getAttribute('aria-valuenow')).to.equal('192');
  expect(handle.getAttribute('aria-valuetext')).to.equal(
    `العرض ${new Intl.NumberFormat('ar-EG').format(192)} بكسل`
  );
});

it('starts a keyboard resize from the live rendered width when a column has no pixel width yet', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = [
    {
      key: 'name',
      label: 'Name',
      width: '12rem',
      resizable: true,
      cell: (row) => row.name,
    },
  ];
  el.rows = rows;
  await el.updateComplete;

  const header = el.shadowRoot!.querySelector('th[data-col-key="name"]') as HTMLElement;
  header.getBoundingClientRect = () => ({ width: 192 } as DOMRect);
  const handle = el.shadowRoot!.querySelector('[part="resize-handle"]') as HTMLElement;
  handle.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;

  // 192 (the live rendered width, not the 12rem CSS length nor minimumResizeWidth's fallback) + the 10px step.
  expect(handle.getAttribute('aria-valuenow')).to.equal('202');
});

it('skips a resize handle whose data-col-key was removed, without breaking sibling handles', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = [
    { key: 'name', label: 'Name', resizable: true, cell: (row) => row.name },
    { key: 'score', label: 'Score', resizable: true, cell: (row) => row.score },
  ];
  el.rows = rows;
  await el.updateComplete;

  const handles = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="resize-handle"]')];
  expect(handles.length).to.equal(2);
  const beforeValue = handles[0]!.getAttribute('aria-valuenow');
  // A dangling reference: the handle's own data-col-key is gone by the time the sync pass reads
  // it (e.g. a consumer-owned DOM mutation), so it must be skipped rather than throwing.
  handles[0]!.removeAttribute('data-col-key');

  const secondHeader = el.shadowRoot!.querySelector('th[data-col-key="score"]') as HTMLElement;
  secondHeader.getBoundingClientRect = () => ({ width: 222 } as DOMRect);
  // Any property change re-runs syncResizeHandleValues() from updated() -- force one.
  el.requestUpdate();
  await el.updateComplete;

  expect(handles[1]!.getAttribute('aria-valuenow'), 'the sibling handle still updates').to.equal('222');
  expect(handles[0]!.getAttribute('aria-valuenow'), 'the handle with no key is left untouched').to.equal(beforeValue);
});

it('restores priority-hidden columns once the container widens back out, driven by real container resizes', async () => {
  // Reproduces the reported one-way lock: narrowing hides low+medium (matches the 300px case
  // above), and widening back to the ORIGINAL 1000px container -- which the "does not render
  // reveal-columns-button when wide" case above proves never needs to hide anything -- must
  // restore both tiers rather than staying stuck. Driven by real `el.style.width` mutations so
  // the component's own ResizeObserver does the measuring, not a direct private-method call.
  const el = (await fixture(html`<lr-table style="display: block; width: 1000px;"></lr-table>`)) as LyraTable<Row>;
  el.columns = priorityColumns;
  el.rows = rows;
  await el.updateComplete;
  expect(el.hasHiddenPriorityColumns).to.be.false;

  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const lowHeader = el.shadowRoot!.querySelector('[part="header-cell"][data-priority="low"]') as HTMLElement;
  const mediumHeader = el.shadowRoot!.querySelector('[part="header-cell"][data-priority="medium"]') as HTMLElement;

  el.style.width = '300px';
  await waitUntil(() => el.hasHiddenPriorityColumns === true);
  expect(getComputedStyle(lowHeader).display).to.equal('none');
  expect(getComputedStyle(mediumHeader).display).to.equal('none');

  // Back to the original width, which comfortably fit every column before anything was hidden.
  el.style.width = '1000px';
  await waitUntil(() => el.hasHiddenPriorityColumns === false);
  expect(getComputedStyle(lowHeader).display).to.not.equal('none');
  expect(getComputedStyle(mediumHeader).display).to.not.equal('none');
  expect(base.hasAttribute('data-hide-priority-low')).to.be.false;
  expect(base.hasAttribute('data-hide-priority-medium')).to.be.false;
  expect(el.hasAttribute('has-hidden-priority-columns')).to.be.false;
  expect((el.shadowRoot!.querySelector('[part="reveal-columns-button"]')) == null).to.be.true;

  // Oscillation guard: a restored column must not immediately re-hide on a later measurement pass
  // triggered by the resize the restoration itself causes (mirrors the existing
  // "settles into a stable hidden state ... without oscillating" narrowing test above).
  const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  for (let i = 0; i < 6; i++) {
    await nextFrame();
    expect(el.hasHiddenPriorityColumns).to.be.false;
    expect(getComputedStyle(lowHeader).display).to.not.equal('none');
    expect(getComputedStyle(mediumHeader).display).to.not.equal('none');
  }
});

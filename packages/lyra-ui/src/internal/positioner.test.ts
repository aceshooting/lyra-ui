import { fixture, expect, html } from '@open-wc/testing';
import { platform as floatingPlatform } from '@floating-ui/dom';
import {
  createPlacementSyncOwnershipController,
  createPlacementStyleTransaction,
  place,
  trackRect,
  virtualAnchorFromRect,
  type VirtualAnchor,
} from './positioner.js';

/** Polls `read()` until it satisfies `until`, or throws once `timeoutMs` elapses. */
async function waitFor<T>(read: () => T, until: (v: T) => boolean, timeoutMs = 2000): Promise<T> {
  const start = performance.now();
  for (;;) {
    const value = read();
    if (until(value)) return value;
    if (performance.now() - start > timeoutMs) {
      throw new Error(`waitFor timed out after ${timeoutMs}ms`);
    }
    await new Promise((r) => requestAnimationFrame(() => r(null)));
  }
}

it('positions the popup relative to the anchor', async () => {
  const wrap = await fixture(html`
    <div>
      <button id="a" style="position:absolute; top:100px; left:100px;">x</button>
      <div id="p" style="width:50px; height:20px;">pop</div>
    </div>
  `);
  const a = wrap.querySelector('#a') as HTMLElement;
  const p = wrap.querySelector('#p') as HTMLElement;

  const stop = place(a, p);
  // autoUpdate schedules an async computePosition; wait a frame for it to land.
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  await new Promise((r) => requestAnimationFrame(() => r(null)));

  expect(p.style.position).to.equal('fixed');
  expect(p.style.left).to.not.be.empty;
  expect(p.style.top).to.not.be.empty;
  expect(p.style.getPropertyValue('--lr-positioner-available-inline-size')).to.match(/^\d+(?:\.\d+)?px$/);
  expect(p.style.getPropertyValue('--lr-positioner-available-block-size')).to.match(/^\d+(?:\.\d+)?px$/);
  stop();
});

it('refreshes available space when the visual viewport changes', async () => {
  const wrap = await fixture(html`
    <div>
      <button id="a" style="position:absolute; top:100px; left:100px;">x</button>
      <div id="p" style="width:50px; height:20px;">pop</div>
    </div>
  `);
  const a = wrap.querySelector('#a') as HTMLElement;
  const p = wrap.querySelector('#p') as HTMLElement;
  const visualViewport = window.visualViewport;

  if (!visualViewport) return;

  const stop = place(a, p);
  await waitFor(
    () => p.style.getPropertyValue('--lr-positioner-available-block-size'),
    (value) => value !== '',
  );
  const initialTop = p.style.top;
  visualViewport.dispatchEvent(new Event('resize'));
  await waitFor(
    () => p.style.top,
    (top) => top !== '' && top === initialTop,
  );
  expect(p.style.getPropertyValue('--lr-positioner-available-block-size')).to.match(/^\d+(?:\.\d+)?px$/);
  stop();
});

it('tracks visual viewport rect changes until its cleanup runs', async () => {
  const target = await fixture<HTMLElement>(html`<div style="inline-size: 80px; block-size: 30px"></div>`);
  const updates: DOMRect[] = [];
  const stop = trackRect(target, (rect) => updates.push(rect));
  const visualViewport = window.visualViewport;

  expect(updates.length, 'trackRect reports the initial rect exactly once').to.equal(1);
  const initial = updates[0]!;
  const expectedInitial = target.getBoundingClientRect();
  expect([initial.left, initial.top, initial.width, initial.height]).to.deep.equal([
    expectedInitial.left,
    expectedInitial.top,
    expectedInitial.width,
    expectedInitial.height,
  ]);

  if (!visualViewport) {
    stop();
    return;
  }

  const beforeResize = updates.length;
  visualViewport.dispatchEvent(new Event('resize'));
  expect(updates.length, 'a visual viewport resize publishes the latest rect').to.be.greaterThan(beforeResize);

  stop();
  const afterStop = updates.length;
  visualViewport.dispatchEvent(new Event('resize'));
  expect(updates.length, 'cleanup removes the visual viewport listener').to.equal(afterStop);
});

it('publishes a hover bridge quad for every placement axis and direction', async () => {
  const wrap = await fixture(html`
    <div>
      <button id="anchor" style="position: fixed; top: 240px; left: 320px; width: 80px; height: 40px;">Anchor</button>
      <div id="popup" style="width: 60px; height: 30px;">Popup</div>
      <div id="bridge"></div>
    </div>
  `);
  const anchor = wrap.querySelector('#anchor') as HTMLElement;
  const popup = wrap.querySelector('#popup') as HTMLElement;
  const bridge = wrap.querySelector('#bridge') as HTMLElement;
  const corners = ['top-left', 'top-right', 'bottom-right', 'bottom-left'] as const;
  const scenarios: Array<{
    placement: 'bottom' | 'top' | 'right' | 'left';
    expected(anchorRect: DOMRect, popupRect: DOMRect): number[][];
  }> = [
    {
      placement: 'bottom',
      expected: (anchorRect, popupRect) => [
        [anchorRect.left, anchorRect.bottom],
        [anchorRect.right, anchorRect.bottom],
        [popupRect.right, popupRect.top],
        [popupRect.left, popupRect.top],
      ],
    },
    {
      placement: 'top',
      expected: (anchorRect, popupRect) => [
        [popupRect.left, popupRect.bottom],
        [popupRect.right, popupRect.bottom],
        [anchorRect.right, anchorRect.top],
        [anchorRect.left, anchorRect.top],
      ],
    },
    {
      placement: 'right',
      expected: (anchorRect, popupRect) => [
        [anchorRect.right, anchorRect.top],
        [popupRect.left, popupRect.top],
        [popupRect.left, popupRect.bottom],
        [anchorRect.right, anchorRect.bottom],
      ],
    },
    {
      placement: 'left',
      expected: (anchorRect, popupRect) => [
        [popupRect.right, popupRect.top],
        [anchorRect.left, anchorRect.top],
        [anchorRect.left, anchorRect.bottom],
        [popupRect.right, popupRect.bottom],
      ],
    },
  ];

  for (const scenario of scenarios) {
    for (const corner of corners) {
      bridge.style.removeProperty(`--lr-positioner-hover-bridge-${corner}-x`);
      bridge.style.removeProperty(`--lr-positioner-hover-bridge-${corner}-y`);
    }
    let resolvedPlacement = '';
    const stop = place(anchor, popup, {
      placement: scenario.placement,
      flip: false,
      shift: false,
      hoverBridge: bridge,
      onPlaced: ({ placement }) => {
        resolvedPlacement = placement;
      },
    });

    await waitFor(
      () => bridge.style.getPropertyValue('--lr-positioner-hover-bridge-top-left-x'),
      (value) => value !== '',
    );
    await waitFor(
      () => resolvedPlacement,
      (placement) => placement === scenario.placement,
    );

    const quad = corners.map((corner) => [
      Number.parseFloat(bridge.style.getPropertyValue(`--lr-positioner-hover-bridge-${corner}-x`)),
      Number.parseFloat(bridge.style.getPropertyValue(`--lr-positioner-hover-bridge-${corner}-y`)),
    ]);
    expect(quad, `${scenario.placement} bridge corners`).to.deep.equal(
      scenario.expected(anchor.getBoundingClientRect(), popup.getBoundingClientRect()),
    );
    stop();
  }
});

it('keeps tracking the anchor via autoUpdate until stop() is called', async () => {
  const wrap = await fixture(html`
    <div>
      <button id="a" style="position:absolute; top:100px; left:100px; height:20px;">x</button>
      <div id="p" style="width:50px; height:20px;">pop</div>
    </div>
  `);
  const a = wrap.querySelector('#a') as HTMLElement;
  const p = wrap.querySelector('#p') as HTMLElement;

  const stop = place(a, p);
  await waitFor(
    () => p.style.top,
    (top) => top !== '',
  );
  const initialTop = parseFloat(p.style.top);

  // Growing the anchor (ResizeObserver-driven) pushes the anchor's bottom
  // edge down; autoUpdate should recompute and follow it without any
  // explicit re-invocation of place().
  a.style.height = '200px';
  await waitFor(
    () => parseFloat(p.style.top),
    (top) => top > initialTop,
  );
  const trackedTop = parseFloat(p.style.top);
  expect(trackedTop).to.be.greaterThan(initialTop);

  // Once stopped, further anchor changes must no longer move the popup.
  stop();
  a.style.height = '400px';
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  await new Promise((r) => setTimeout(r, 100));
  expect(parseFloat(p.style.top)).to.equal(trackedTop);
});

it('invalidates an in-flight placement before cleanup returns', async () => {
  const wrap = await fixture(html`
    <div>
      <button id="a" style="position:absolute; top:100px; left:100px;">x</button>
      <div id="p" style="width:50px; height:20px;">pop</div>
    </div>
  `);
  const anchor = wrap.querySelector('#a') as HTMLElement;
  const popup = wrap.querySelector('#p') as HTMLElement;
  let placedCount = 0;

  const stop = place(anchor, popup, { onPlaced: () => placedCount++ });
  stop();
  await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
  await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

  expect(popup.style.left).to.equal('');
  expect(popup.style.top).to.equal('');
  expect(placedCount).to.equal(0);
});

it('lets a replacement placement win while the cleaned-up run is still in flight', async () => {
  const wrap = await fixture(html`
    <div>
      <button id="first" style="position:absolute; top:40px; left:40px;">first</button>
      <button id="second" style="position:absolute; top:180px; left:300px;">second</button>
      <div id="popup" style="width:50px; height:20px;">pop</div>
    </div>
  `);
  const first = wrap.querySelector('#first') as HTMLElement;
  const second = wrap.querySelector('#second') as HTMLElement;
  const popup = wrap.querySelector('#popup') as HTMLElement;
  let obsoletePlacements = 0;
  let currentPlacements = 0;

  const stopFirst = place(first, popup, { onPlaced: () => obsoletePlacements++ });
  stopFirst();
  const stopSecond = place(second, popup, { onPlaced: () => currentPlacements++ });
  await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
  await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

  expect(obsoletePlacements).to.equal(0);
  expect(currentPlacements).to.be.greaterThan(0);
  expect(parseFloat(popup.style.left)).to.be.closeTo(300, 1);
  stopSecond();
});

it('does not let an older rollback replace a newer identical committed style write', async () => {
  const element = await fixture<HTMLElement>(html`<div></div>`);
  element.style.setProperty('--transaction-probe', 'baseline', 'important');
  const older = createPlacementStyleTransaction();
  const newer = createPlacementStyleTransaction();

  older.set(element, '--transaction-probe', 'shared', 'important');
  newer.set(element, '--transaction-probe', 'shared', 'important');
  newer.commit();
  older.rollback();

  expect(element.style.getPropertyValue('--transaction-probe')).to.equal('shared');
  expect(element.style.getPropertyPriority('--transaction-probe')).to.equal('important');
});

it('preserves an observable external value and priority written over a placement transaction', async () => {
  const element = await fixture<HTMLElement>(html`<div></div>`);
  element.style.setProperty('--transaction-probe', 'baseline', 'important');
  const transaction = createPlacementStyleTransaction();

  transaction.set(element, '--transaction-probe', 'owned');
  element.style.setProperty('--transaction-probe', 'external', 'important');
  transaction.rollback();

  expect(element.style.getPropertyValue('--transaction-probe')).to.equal('external');
  expect(element.style.getPropertyPriority('--transaction-probe')).to.equal('important');
});

it('rebases a repeated write after a newer placement transaction commits', async () => {
  const element = await fixture<HTMLElement>(html`<div></div>`);
  element.style.setProperty('--transaction-probe', 'baseline', 'important');
  const older = createPlacementStyleTransaction();
  const newer = createPlacementStyleTransaction();

  older.set(element, '--transaction-probe', 'older-first');
  newer.set(element, '--transaction-probe', 'newer-committed', 'important');
  newer.commit();
  older.set(element, '--transaction-probe', 'older-second');
  older.rollback();

  expect(element.style.getPropertyValue('--transaction-probe')).to.equal('newer-committed');
  expect(element.style.getPropertyPriority('--transaction-probe')).to.equal('important');
});

it('rebases a repeated write after an observable external style change', async () => {
  const element = await fixture<HTMLElement>(html`<div></div>`);
  element.style.setProperty('--transaction-probe', 'baseline', 'important');
  const transaction = createPlacementStyleTransaction();

  transaction.set(element, '--transaction-probe', 'owned-first');
  element.style.setProperty('--transaction-probe', 'external', 'important');
  transaction.set(element, '--transaction-probe', 'owned-second');
  transaction.rollback();

  expect(element.style.getPropertyValue('--transaction-probe')).to.equal('external');
  expect(element.style.getPropertyPriority('--transaction-probe')).to.equal('important');
});

it('fails closed when a public virtual anchor rejects positioning', async () => {
  const popup = await fixture<HTMLElement>(html`
    <div style="width:50px; height:20px; left:11px; top:12px;">pop</div>
  `);
  popup.style.setProperty('--lr-positioner-available-inline-size', 'sentinel-inline');
  popup.style.setProperty('--lr-positioner-available-block-size', 'sentinel-block');
  const failure = new Error('hostile virtual anchor geometry');
  let geometryReads = 0;
  let placedCount = 0;
  const unhandled: unknown[] = [];
  const onUnhandled = (event: PromiseRejectionEvent) => {
    unhandled.push(event.reason);
    event.preventDefault();
  };
  window.addEventListener('unhandledrejection', onUnhandled);

  let stop = () => undefined;
  try {
    stop = place(
      {
        getBoundingClientRect() {
          geometryReads += 1;
          throw failure;
        },
      },
      popup,
      { onPlaced: () => placedCount++ },
    );
    await waitFor(() => geometryReads, (reads) => reads > 0);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(unhandled.length).to.equal(0);
    expect(placedCount).to.equal(0);
    expect(popup.style.left).to.equal('11px');
    expect(popup.style.top).to.equal('12px');
    expect(popup.style.getPropertyValue('--lr-positioner-available-inline-size')).to.equal('sentinel-inline');
    expect(popup.style.getPropertyValue('--lr-positioner-available-block-size')).to.equal('sentinel-block');

    const readsAfterFailure = geometryReads;
    window.dispatchEvent(new Event('resize'));
    window.visualViewport?.dispatchEvent(new Event('resize'));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(geometryReads).to.equal(readsAfterFailure);
  } finally {
    stop();
    window.removeEventListener('unhandledrejection', onUnhandled);
  }
});

it('fails closed before committing placement when hover-bridge geometry throws', async () => {
  const wrap = await fixture(html`
    <div>
      <button id="stable-anchor" style="position: fixed; top: 20px; left: 20px;">anchor</button>
      <div
        id="popup"
        style="--sentinel-width: 50px; --sentinel-height: 20px;
          width: var(--sentinel-width); height: var(--sentinel-height); left: 11px; top: 12px;"
      >
        pop
      </div>
      <div id="bridge"></div>
    </div>
  `);
  const stableAnchor = wrap.querySelector('#stable-anchor') as HTMLElement;
  const popup = wrap.querySelector('#popup') as HTMLElement;
  const bridge = wrap.querySelector('#bridge') as HTMLElement;
  popup.style.setProperty('--lr-positioner-available-inline-size', 'sentinel-inline');
  popup.style.setProperty('--lr-positioner-available-block-size', 'sentinel-block');
  bridge.style.setProperty('--lr-positioner-hover-bridge-top-left-x', 'sentinel-x');
  bridge.style.setProperty('--lr-positioner-hover-bridge-top-left-y', 'sentinel-y');
  const failure = new Error('late hostile virtual anchor geometry');
  const anchorRect = new DOMRect(100, 100, 50, 20);
  let geometryReads = 0;
  let placedCount = 0;
  const unhandled: unknown[] = [];
  const onUnhandled = (event: PromiseRejectionEvent) => {
    unhandled.push(event.reason);
    event.preventDefault();
  };
  window.addEventListener('unhandledrejection', onUnhandled);

  let stop = () => undefined;
  let stopUnsynced = () => undefined;
  try {
    stop = place(
      {
        getBoundingClientRect() {
          geometryReads += 1;
          if (geometryReads === 1) return anchorRect;
          throw failure;
        },
      },
      popup,
      {
        flip: false,
        hoverBridge: bridge,
        onPlaced: () => placedCount++,
        shift: false,
        sync: 'both',
      },
    );
    await waitFor(() => geometryReads, (reads) => reads > 1);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(unhandled.length).to.equal(0);
    expect(placedCount).to.equal(0);
    expect(popup.style.left).to.equal('11px');
    expect(popup.style.top).to.equal('12px');
    expect(popup.style.width).to.equal('var(--sentinel-width)');
    expect(popup.style.height).to.equal('var(--sentinel-height)');
    expect(popup.style.getPropertyValue('--lr-positioner-available-inline-size')).to.equal('sentinel-inline');
    expect(popup.style.getPropertyValue('--lr-positioner-available-block-size')).to.equal('sentinel-block');
    expect(bridge.style.getPropertyValue('--lr-positioner-hover-bridge-top-left-x')).to.equal('sentinel-x');
    expect(bridge.style.getPropertyValue('--lr-positioner-hover-bridge-top-left-y')).to.equal('sentinel-y');

    stopUnsynced = place(stableAnchor, popup, { flip: false, shift: false });
    await waitFor(() => popup.style.left, (value) => value !== '11px');
    expect(popup.style.width).to.equal('var(--sentinel-width)');
    expect(popup.style.height).to.equal('var(--sentinel-height)');
    stopUnsynced();

    const readsAfterFailure = geometryReads;
    window.dispatchEvent(new Event('resize'));
    window.visualViewport?.dispatchEvent(new Event('resize'));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(geometryReads).to.equal(readsAfterFailure);
  } finally {
    stopUnsynced();
    stop();
    window.removeEventListener('unhandledrejection', onUnhandled);
  }
});

it('does not release newer external dimensions after a synced replacement rolls back', async () => {
  const wrap = await fixture(html`
    <div>
      <button id="stable-anchor" style="position: fixed; width: 80px; height: 30px;">anchor</button>
      <div id="popup" style="width: 41px !important; height: 42px !important;">pop</div>
      <div id="bridge"></div>
    </div>
  `);
  const stableAnchor = wrap.querySelector('#stable-anchor') as HTMLElement;
  const popup = wrap.querySelector('#popup') as HTMLElement;
  const bridge = wrap.querySelector('#bridge') as HTMLElement;
  let initialPlacements = 0;
  const stopInitial = place(stableAnchor, popup, {
    flip: false,
    onPlaced: () => initialPlacements++,
    shift: false,
    sync: 'both',
  });
  await waitFor(() => initialPlacements, (count) => count > 0);
  stopInitial();

  const anchorRect = new DOMRect(100, 100, 50, 20);
  let geometryReads = 0;
  let stopFailed = () => undefined;
  let stopUnsynced = () => undefined;
  try {
    stopFailed = place(
      {
        getBoundingClientRect() {
          geometryReads += 1;
          if (geometryReads === 1) return anchorRect;
          popup.style.setProperty('width', '99px', 'important');
          popup.style.setProperty('height', '44px', 'important');
          throw new Error('late synced replacement failure');
        },
      },
      popup,
      { flip: false, hoverBridge: bridge, shift: false, sync: 'both' },
    );
    await waitFor(() => geometryReads, (reads) => reads > 1);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(popup.style.width).to.equal('99px');
    expect(popup.style.getPropertyPriority('width')).to.equal('important');
    expect(popup.style.height).to.equal('44px');
    expect(popup.style.getPropertyPriority('height')).to.equal('important');

    stopUnsynced = place(stableAnchor, popup, { flip: false, shift: false });
    expect(popup.style.width).to.equal('99px');
    expect(popup.style.getPropertyPriority('width')).to.equal('important');
    expect(popup.style.height).to.equal('44px');
    expect(popup.style.getPropertyPriority('height')).to.equal('important');
  } finally {
    stopUnsynced();
    stopFailed();
  }
});

it('does not claim external dimensions written before a synced replacement commits', async () => {
  const wrap = await fixture(html`
    <div>
      <button id="stable-anchor" style="position: fixed; width: 80px; height: 30px;">anchor</button>
      <div id="popup" style="width: 41px !important; height: 42px !important;">pop</div>
      <div id="bridge"></div>
    </div>
  `);
  const stableAnchor = wrap.querySelector('#stable-anchor') as HTMLElement;
  const popup = wrap.querySelector('#popup') as HTMLElement;
  const bridge = wrap.querySelector('#bridge') as HTMLElement;
  let initialPlacements = 0;
  const stopInitial = place(stableAnchor, popup, {
    flip: false,
    onPlaced: () => initialPlacements++,
    shift: false,
    sync: 'both',
  });
  await waitFor(() => initialPlacements, (count) => count > 0);
  stopInitial();

  const anchorRect = new DOMRect(100, 100, 50, 20);
  let geometryReads = 0;
  let replacementPlacements = 0;
  let stopReplacement = () => undefined;
  let stopUnsynced = () => undefined;
  try {
    stopReplacement = place(
      {
        getBoundingClientRect() {
          geometryReads += 1;
          if (geometryReads > 1) {
            popup.style.setProperty('width', '99px', 'important');
            popup.style.setProperty('height', '44px', 'important');
          }
          return anchorRect;
        },
      },
      popup,
      {
        flip: false,
        hoverBridge: bridge,
        onPlaced: () => replacementPlacements++,
        shift: false,
        sync: 'both',
      },
    );
    await waitFor(() => replacementPlacements, (count) => count > 0);
    stopReplacement();

    expect(popup.style.width).to.equal('99px');
    expect(popup.style.getPropertyPriority('width')).to.equal('important');
    expect(popup.style.height).to.equal('44px');
    expect(popup.style.getPropertyPriority('height')).to.equal('important');

    stopUnsynced = place(stableAnchor, popup, { flip: false, shift: false });
    expect(popup.style.width).to.equal('99px');
    expect(popup.style.getPropertyPriority('width')).to.equal('important');
    expect(popup.style.height).to.equal('44px');
    expect(popup.style.getPropertyPriority('height')).to.equal('important');
  } finally {
    stopUnsynced();
    stopReplacement();
  }
});

it('does not let an older sync completion erase a newer sync release marker', async () => {
  const popup = await fixture<HTMLElement>(html`<div style="width: 60px; height: 25px;"></div>`);
  const ownership = createPlacementSyncOwnershipController();
  const older = ownership.beginPlacement(popup);
  const olderUpdate = ownership.beginUpdate(older);
  const newer = ownership.beginPlacement(popup);
  const newerUpdate = ownership.beginUpdate(newer);

  ownership.publish(popup, newerUpdate, {
    width: { value: '60px', priority: '' },
    height: { value: '25px', priority: '' },
  });
  // The older computation settles last without owning either dimension. Its empty publication
  // must not erase the newer run's marker, which a later unsynced placement uses for release.
  ownership.publish(popup, olderUpdate, {});
  ownership.release(popup, ownership.beginPlacement(popup));

  expect([popup.style.width, popup.style.height]).to.deep.equal(['', '']);
});

it('lets an older successful sync own dimensions after a newer sync fails', async () => {
  const popup = await fixture<HTMLElement>(html`<div style="width: 50px; height: 20px;"></div>`);
  const ownership = createPlacementSyncOwnershipController();
  const older = ownership.beginPlacement(popup);
  const olderUpdate = ownership.beginUpdate(older);
  const newer = ownership.beginPlacement(popup);
  ownership.beginUpdate(newer); // The newer computation starts, then fails without publishing.

  ownership.publish(popup, olderUpdate, {
    width: { value: '50px', priority: '' },
    height: { value: '20px', priority: '' },
  });
  ownership.release(popup, ownership.beginPlacement(popup));

  expect([popup.style.width, popup.style.height]).to.deep.equal(['', '']);
});

it('does not let an obsolete placement recreate sync ownership after an unsynced release', async () => {
  const popup = await fixture<HTMLElement>(html`<div></div>`);
  const ownership = createPlacementSyncOwnershipController();
  const obsolete = ownership.beginPlacement(popup);
  const obsoleteUpdate = ownership.beginUpdate(obsolete);
  ownership.release(popup, ownership.beginPlacement(popup));

  popup.style.width = '50px';
  popup.style.height = '20px';
  ownership.publish(popup, obsoleteUpdate, {
    width: { value: '50px', priority: '' },
    height: { value: '20px', priority: '' },
  });
  ownership.release(popup, ownership.beginPlacement(popup));

  expect([popup.style.width, popup.style.height]).to.deep.equal(['50px', '20px']);
});

it('synchronously restores open middleware writes when placement is disposed', async () => {
  const wrap = await fixture(html`
    <div>
      <div
        id="popup"
        style="--sentinel-width: 50px; --sentinel-height: 20px;
          width: var(--sentinel-width) !important; height: var(--sentinel-height) !important;
          left: 11px; top: 12px;"
      >
        pop
      </div>
      <div id="bridge"></div>
    </div>
  `);
  const popup = wrap.querySelector('#popup') as HTMLElement;
  const bridge = wrap.querySelector('#bridge') as HTMLElement;
  popup.style.setProperty('--lr-positioner-available-inline-size', 'sentinel-inline', 'important');
  popup.style.setProperty('--lr-positioner-available-block-size', 'sentinel-block', 'important');
  const anchorRect = new DOMRect(100, 100, 50, 20);
  const snapshot = () => ({
    width: [popup.style.width, popup.style.getPropertyPriority('width')],
    height: [popup.style.height, popup.style.getPropertyPriority('height')],
    availableInline: [
      popup.style.getPropertyValue('--lr-positioner-available-inline-size'),
      popup.style.getPropertyPriority('--lr-positioner-available-inline-size'),
    ],
    availableBlock: [
      popup.style.getPropertyValue('--lr-positioner-available-block-size'),
      popup.style.getPropertyPriority('--lr-positioner-available-block-size'),
    ],
  });
  const sentinel = {
    width: ['var(--sentinel-width)', 'important'],
    height: ['var(--sentinel-height)', 'important'],
    availableInline: ['sentinel-inline', 'important'],
    availableBlock: ['sentinel-block', 'important'],
  };
  let geometryReads = 0;
  let beforeStop: ReturnType<typeof snapshot> | undefined;
  let afterStop: ReturnType<typeof snapshot> | undefined;
  let stop = () => undefined;

  stop = place(
    {
      getBoundingClientRect() {
        geometryReads += 1;
        if (geometryReads > 3) {
          beforeStop = snapshot();
          stop();
          afterStop = snapshot();
        }
        return anchorRect;
      },
    },
    popup,
    { flip: false, hoverBridge: bridge, shift: false, sync: 'both' },
  );
  await waitFor(() => geometryReads, (reads) => reads > 3);

  expect(beforeStop?.width).to.deep.equal(['50px', '']);
  expect(beforeStop?.height).to.deep.equal(['20px', '']);
  expect(beforeStop?.availableInline).to.deep.equal(sentinel.availableInline);
  expect(beforeStop?.availableBlock).to.deep.equal(sentinel.availableBlock);
  expect(afterStop).to.deep.equal(sentinel);

  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  expect(snapshot()).to.deep.equal(sentinel);
  expect(popup.style.left).to.equal('11px');
  expect(popup.style.top).to.equal('12px');
});

it('handles a rejected placement after cleanup and disconnect without a global rejection', async () => {
  const popup = await fixture<HTMLElement>(html`<div style="width:50px; height:20px;">pop</div>`);
  const unhandled: unknown[] = [];
  const onUnhandled = (event: PromiseRejectionEvent) => {
    unhandled.push(event.reason);
    event.preventDefault();
  };
  window.addEventListener('unhandledrejection', onUnhandled);

  try {
    const stop = place(
      { getBoundingClientRect: () => { throw new Error('late disconnected geometry'); } },
      popup,
    );
    popup.remove();
    stop();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(unhandled.length).to.equal(0);
    expect(popup.style.left).to.equal('');
    expect(popup.style.top).to.equal('');
  } finally {
    window.removeEventListener('unhandledrejection', onUnhandled);
  }
});

it('does not swallow an exception deliberately thrown by onPlaced', async () => {
  const popup = await fixture<HTMLElement>(html`<div style="width:50px; height:20px;">pop</div>`);
  const anchor: VirtualAnchor = {
    getBoundingClientRect: () => new DOMRect(100, 100, 0, 0),
  };
  const failure = new Error('consumer onPlaced failure');
  let failureThrown = false;
  let stop = () => undefined;
  const observed = new Promise<unknown>((resolve) => {
    window.addEventListener(
      'unhandledrejection',
      (event) => {
        event.preventDefault();
        stop();
        resolve(event.reason);
      },
      { once: true },
    );
  });

  stop = place(anchor, popup, {
    onPlaced: () => {
      if (failureThrown) return;
      failureThrown = true;
      // Stop the auto-update loop before surfacing the deliberate consumer failure. Otherwise a
      // callback already queued by the initial observer pass could surface the same failure twice.
      stop();
      throw failure;
    },
  });
  expect(await observed).to.equal(failure);
});

it('honors a custom offset from PlaceOptions', async () => {
  const wrap = await fixture(html`
    <div>
      <button id="a" style="position:absolute; top:100px; left:100px; width:80px; height:20px;">x</button>
      <div id="p" style="width:50px; height:20px;">pop</div>
    </div>
  `);
  const a = wrap.querySelector('#a') as HTMLElement;
  const p = wrap.querySelector('#p') as HTMLElement;

  const stop = place(a, p, { offset: 50 });
  await waitFor(
    () => p.style.top,
    (top) => top !== '',
  );

  // Default placement is 'bottom-start', so the gap between the anchor's
  // bottom edge and the popup's top edge should equal the requested offset,
  // not the built-in default of 4.
  const gap = p.getBoundingClientRect().top - a.getBoundingClientRect().bottom;
  expect(gap).to.be.closeTo(50, 1);
  stop();
});

it('honors a custom placement from PlaceOptions', async () => {
  const wrap = await fixture(html`
    <div>
      <button id="a" style="position:absolute; top:200px; left:100px; width:80px; height:20px;">x</button>
      <div id="p" style="width:50px; height:20px;">pop</div>
    </div>
  `);
  const a = wrap.querySelector('#a') as HTMLElement;
  const p = wrap.querySelector('#p') as HTMLElement;

  const stop = place(a, p, { placement: 'top-end' });
  await waitFor(
    () => p.style.top,
    (top) => top !== '',
  );

  const anchorRect = a.getBoundingClientRect();
  const popupRect = p.getBoundingClientRect();
  // A 'top-*' placement puts the popup above the anchor, unlike the default
  // 'bottom-start' (which would put it below).
  expect(popupRect.bottom).to.be.at.most(anchorRect.top);
  // '-end' alignment lines the popup's trailing edge up with the anchor's
  // trailing edge (the right edge, in this LTR fixture).
  expect(popupRect.right).to.be.closeTo(anchorRect.right, 1);
  stop();
});

it('positions the popup relative to a virtual anchor with no backing DOM element', async () => {
  const wrap = await fixture(html`
    <div>
      <div id="p" style="width:50px; height:20px;">pop</div>
    </div>
  `);
  const p = wrap.querySelector('#p') as HTMLElement;
  const anchor: VirtualAnchor = {
    getBoundingClientRect: () => new DOMRect(100, 100, 0, 0),
  };

  const stop = place(anchor, p);
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  await new Promise((r) => requestAnimationFrame(() => r(null)));

  expect(p.style.position).to.equal('fixed');
  expect(p.style.left).to.not.be.empty;
  expect(p.style.top).to.not.be.empty;
  // Default placement 'bottom-start' + default 4px offset puts the popup's
  // top edge 4px below the anchor's (zero-height) point.
  expect(parseFloat(p.style.top)).to.be.closeTo(104, 1);
  expect(parseFloat(p.style.left)).to.be.closeTo(100, 1);
  stop();
});

it('honors an optional contextElement on a virtual anchor without throwing', async () => {
  const wrap = await fixture(html`
    <div>
      <div id="p" style="width:50px; height:20px;">pop</div>
    </div>
  `);
  const p = wrap.querySelector('#p') as HTMLElement;
  const anchor: VirtualAnchor = {
    getBoundingClientRect: () => new DOMRect(20, 30, 0, 0),
    contextElement: wrap as unknown as Element,
  };

  const stop = place(anchor, p);
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  await new Promise((r) => requestAnimationFrame(() => r(null)));

  expect(p.style.left).to.not.include('NaN');
  expect(p.style.top).to.not.include('NaN');
  stop();
});

describe('virtualAnchorFromRect', () => {
  it('builds a VirtualAnchor whose getBoundingClientRect() reflects the given rect', () => {
    const anchor = virtualAnchorFromRect({ x: 10, y: 20, width: 30, height: 40 });
    const rect = anchor.getBoundingClientRect();
    expect(rect.x).to.equal(10);
    expect(rect.y).to.equal(20);
    expect(rect.width).to.equal(30);
    expect(rect.height).to.equal(40);
    expect(rect.left).to.equal(10);
    expect(rect.top).to.equal(20);
    expect(rect.right).to.equal(40);
    expect(rect.bottom).to.equal(60);
  });

  it('defaults width/height to 0, producing a zero-size point anchor', () => {
    const anchor = virtualAnchorFromRect({ x: 5, y: 6 });
    const rect = anchor.getBoundingClientRect();
    expect(rect.width).to.equal(0);
    expect(rect.height).to.equal(0);
    expect(rect.left).to.equal(5);
    expect(rect.top).to.equal(6);
  });

  it('forwards an optional contextElement onto the built VirtualAnchor', () => {
    const el = document.createElement('div');
    const anchor = virtualAnchorFromRect({ x: 0, y: 0, contextElement: el });
    expect(anchor.contextElement).to.equal(el);
  });

  it('leaves contextElement undefined when not supplied', () => {
    const anchor = virtualAnchorFromRect({ x: 0, y: 0 });
    expect(anchor.contextElement).to.equal(undefined);
  });

  it('rejects non-finite coordinates and negative or non-finite dimensions', () => {
    for (const rect of [
      { x: Number.NaN, y: 0 },
      { x: 0, y: Number.POSITIVE_INFINITY },
      { x: 0, y: 0, width: -1 },
      { x: 0, y: 0, width: Number.NaN },
      { x: 0, y: 0, height: -1 },
      { x: 0, y: 0, height: Number.NEGATIVE_INFINITY },
    ]) {
      expect(() => virtualAnchorFromRect(rect)).to.throw(RangeError);
    }
  });
});

describe('numeric input validation', () => {
  it('rejects every non-finite numeric option before mutating or observing the popup', () => {
    const anchor = document.createElement('button');
    const popup = document.createElement('div');
    popup.style.position = 'sticky';
    popup.style.margin = '3px';
    let placed = 0;

    for (const name of [
      'offset',
      'skidding',
      'flipPadding',
      'shiftPadding',
      'padding',
      'autoSizePadding',
      'arrowPadding',
    ] as const) {
      let cleanup: (() => void) | undefined;
      let error: unknown;
      try {
        cleanup = place(anchor, popup, {
          [name]: Number.NaN,
          onPlaced: () => placed++,
        });
      } catch (caught) {
        error = caught;
      } finally {
        cleanup?.();
      }
      expect(error instanceof RangeError, `${name} must reject synchronously`).to.equal(true);
      expect(popup.style.position, `${name} must not partially restyle position`).to.equal('sticky');
      expect(popup.style.margin, `${name} must not partially restyle margin`).to.equal('3px');
    }
    expect(placed).to.equal(0);
  });

  it('allows signed finite offsets but rejects negative padding before setup', () => {
    const anchor = document.createElement('button');
    const popup = document.createElement('div');
    const signedCleanup = place(anchor, popup, { offset: -4, skidding: -2 });
    signedCleanup();

    for (const name of [
      'flipPadding',
      'shiftPadding',
      'padding',
      'autoSizePadding',
      'arrowPadding',
    ] as const) {
      let cleanup: (() => void) | undefined;
      let error: unknown;
      try {
        cleanup = place(anchor, popup, { [name]: -1 });
      } catch (caught) {
        error = caught;
      } finally {
        cleanup?.();
      }
      expect(error instanceof RangeError, `${name} must reject negative values`).to.equal(true);
    }
  });

  it('rejects invalid custom virtual-anchor geometry before popup writes or callbacks', () => {
    const popup = document.createElement('div');
    popup.style.position = 'sticky';
    popup.style.margin = '5px';
    let placed = 0;
    const anchor: VirtualAnchor = {
      getBoundingClientRect: () => ({
        x: Number.NaN,
        y: 0,
        width: 0,
        height: 0,
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        toJSON: () => ({}),
      }) as DOMRect,
    };

    expect(() => place(anchor, popup, { onPlaced: () => placed++ })).to.throw(RangeError);
    expect(popup.style.position).to.equal('sticky');
    expect(popup.style.margin).to.equal('5px');
    expect(placed).to.equal(0);
  });

  it('fails closed when platform geometry makes derived available space non-finite', async () => {
    const popup = await fixture<HTMLElement>(html`<div style="width: 20px; height: 20px;"></div>`);
    const mutablePlatform = floatingPlatform as unknown as {
      getClippingRect: (...args: unknown[]) => Promise<{
        x: number;
        y: number;
        width: number;
        height: number;
      }>;
    };
    const originalGetClippingRect = mutablePlatform.getClippingRect;
    mutablePlatform.getClippingRect = async () => ({
      x: 0,
      y: 0,
      width: Number.NaN,
      height: 100,
    });
    let placed = 0;
    let stop: (() => void) | undefined;

    try {
      stop = place(virtualAnchorFromRect({ x: 10, y: 10 }), popup, {
        flip: false,
        shift: false,
        onPlaced: () => placed++,
      });
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    } finally {
      stop?.();
      mutablePlatform.getClippingRect = originalGetClippingRect;
    }

    expect(placed).to.equal(0);
    expect(popup.style.left).to.equal('');
    expect(popup.style.top).to.equal('');
    expect(popup.style.getPropertyValue('--lr-positioner-available-inline-size')).to.equal('');
    expect(popup.style.getPropertyValue('--lr-positioner-available-block-size')).to.equal('');
  });
});

describe('shared overflow boundary', () => {
  async function boundaryFixture(): Promise<{
    box: HTMLElement;
    anchor: HTMLElement;
    popup: HTMLElement;
  }> {
    const box = await fixture<HTMLElement>(html`
      <div
        style="position: fixed; inset-block-start: 100px; inset-inline-start: 100px;
          inline-size: 240px; block-size: 140px; overflow: hidden;"
      >
        <button
          id="boundary-anchor"
          style="position: absolute; inset-block-end: 8px; inset-inline-start: 60px;
            inline-size: 80px; block-size: 24px;"
        >
          Anchor
        </button>
        <div id="boundary-popup" style="inline-size: 100px; block-size: 70px;">Popup</div>
      </div>
    `);
    return {
      box,
      anchor: box.querySelector('#boundary-anchor') as HTMLElement,
      popup: box.querySelector('#boundary-popup') as HTMLElement,
    };
  }

  it('uses an empty shared boundary as viewport-only clipping', async () => {
    const { anchor, popup } = await boundaryFixture();
    const stop = place(anchor, popup, { placement: 'bottom', boundary: [] });
    await waitFor(
      () => popup.style.top,
      (top) => top !== '',
    );
    expect(popup.getBoundingClientRect().top).to.be.at.least(anchor.getBoundingClientRect().bottom);
    stop();
  });

  it('uses an element shared boundary for flip, shift, and available-size measurement', async () => {
    const { box, anchor, popup } = await boundaryFixture();
    const stop = place(anchor, popup, { placement: 'bottom', boundary: box });
    await waitFor(
      () => popup.style.top,
      (top) => top !== '',
    );
    expect(popup.getBoundingClientRect().bottom).to.be.at.most(anchor.getBoundingClientRect().top + 1);
    expect(parseFloat(popup.style.getPropertyValue('--lr-positioner-available-inline-size'))).to.be.at.most(
      box.getBoundingClientRect().width,
    );
    stop();
  });

  it('lets a per-middleware boundary override the shared boundary', async () => {
    const { box, anchor, popup } = await boundaryFixture();
    const stop = place(anchor, popup, {
      placement: 'bottom',
      boundary: box,
      flipBoundary: [],
      shift: false,
    });
    await waitFor(
      () => popup.style.top,
      (top) => top !== '',
    );
    expect(popup.getBoundingClientRect().top).to.be.at.least(anchor.getBoundingClientRect().bottom);
    stop();
  });
});

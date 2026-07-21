import { fixture, expect, html, oneEvent, aTimeout } from '@open-wc/testing';
import './virtual-list.js';
import { MAX_OVERSCAN_ROWS, type LyraVirtualList } from './virtual-list.js';
import { styles } from './virtual-list.styles.js';

/** Waits two animation frames -- enough for the component's rAF-coalesced
 *  scroll handler *and* a queued ResizeObserver callback to have run. */
async function nextFrame(): Promise<void> {
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
}

const numberKey = (item: unknown) => item as number;
const stringKey = (item: unknown) => item as string;
const renderText = (item: unknown, index: number) => html`item ${item}#${index}`;

it('does not schedule a Lit update from the initial container measurement', async () => {
  const globalWarnings = (globalThis as { litIssuedWarnings?: Set<string> }).litIssuedWarnings;
  globalWarnings?.forEach((warning) => {
    if (warning.includes('scheduled an update')) globalWarnings.delete(warning);
  });
  const originalWarn = console.warn;
  const calls: unknown[][] = [];
  console.warn = (...args: unknown[]) => calls.push(args);
  try {
    const el = (await fixture(
      html`<lr-virtual-list
        style="--lr-virtual-list-height:200px"
        row-height="40"
        .items=${[1, 2, 3]}
        .renderItem=${renderText}
        .keyFunction=${numberKey}
      ></lr-virtual-list>`,
    )) as LyraVirtualList;
    await el.updateComplete;
    await nextFrame();
  } finally {
    console.warn = originalWarn;
  }
  expect(calls.flat().map(String).some((message) => message.includes('scheduled an update'))).to.be.false;
});

it('is accessible with an empty items array', async () => {
  const el = (await fixture(
    html`<lr-virtual-list
      .items=${[]}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`,
  )) as LyraVirtualList;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('is accessible with a populated, windowed item list', async () => {
  const items = Array.from({ length: 200 }, (_, i) => i);
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      row-height="40"
      .items=${items}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`,
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();
  await expect(el).to.be.accessible();
});

it('renders only a small window of DOM rows for a large items array, not every item', async () => {
  const items = Array.from({ length: 2000 }, (_, i) => i);
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      .items=${items}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`,
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();
  const rows = el.shadowRoot!.querySelectorAll('[part="row"]');
  expect(rows.length).to.be.greaterThan(0);
  expect(rows.length).to.be.lessThan(50);
});

it('normalizes invalid and excessive overscan attributes to bounded whole-row values', async () => {
  const cases = [
    { value: 'Infinity', expected: 6 },
    { value: 'NaN', expected: 6 },
    { value: '-20', expected: 0 },
    { value: '12.9', expected: 12 },
    { value: '1000000000', expected: MAX_OVERSCAN_ROWS },
  ];
  const items = Array.from({ length: 1000 }, (_, i) => i);

  for (const testCase of cases) {
    const el = (await fixture(
      html`<lr-virtual-list
        style="--lr-virtual-list-height:200px"
        row-height="40"
        overscan=${testCase.value}
        .items=${items}
        .renderItem=${renderText}
        .keyFunction=${numberKey}
      ></lr-virtual-list>`,
    )) as LyraVirtualList;
    await el.updateComplete;
    await nextFrame();

    const rowCount = el.shadowRoot!.querySelectorAll('[part="row"]').length;
    expect(el.overscan, testCase.value).to.equal(testCase.expected);
    expect(rowCount, testCase.value).to.be.greaterThan(0);
    expect(rowCount, testCase.value).to.be.lessThan(250);
  }
});

it('uses the same bounded overscan fallback for direct property assignments', async () => {
  const items = Array.from({ length: 1000 }, (_, i) => i);
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      row-height="40"
      .items=${items}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`,
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();

  for (const overscan of [Infinity, NaN, -20, 1_000_000_000]) {
    el.overscan = overscan;
    await el.updateComplete;
    const rowCount = el.shadowRoot!.querySelectorAll('[part="row"]').length;
    expect(rowCount, String(overscan)).to.be.greaterThan(0);
    expect(rowCount, String(overscan)).to.be.lessThan(250);
  }
});

it('uses role="list"/"listitem" (not listbox/option) and reflects the real item index via aria-setsize/aria-posinset', async () => {
  const items = Array.from({ length: 100 }, (_, i) => i);
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      row-height="40"
      overscan="0"
      .items=${items}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`,
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();

  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('role')).to.equal('list');

  const rowsBefore = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="row"]')];
  expect(rowsBefore.length).to.be.greaterThan(0);
  rowsBefore.forEach((r) => expect(r.getAttribute('role')).to.equal('listitem'));
  // Full-array size, not the rendered-window size.
  expect(rowsBefore[0].getAttribute('aria-setsize')).to.equal('100');
  expect(rowsBefore[0].getAttribute('aria-posinset')).to.equal('1');

  // Scroll 10 rows down (400px / 40px per row) -- the *first rendered* row's
  // posinset must reflect its real index (11), not "1st DOM node".
  base.scrollTop = 400;
  base.dispatchEvent(new Event('scroll'));
  await nextFrame();
  await el.updateComplete;

  const rowsAfter = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="row"]')];
  expect(rowsAfter[0].getAttribute('aria-posinset')).to.equal('11');
  expect(rowsAfter[0].getAttribute('aria-setsize')).to.equal('100');
});

it('positions rows via translateY using exact cumulative offsets in fixed row-height mode', async () => {
  const items = Array.from({ length: 50 }, (_, i) => i);
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:120px"
      row-height="40"
      overscan="0"
      .items=${items}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`,
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();

  const rows = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="row"]')];
  expect(rows[0].style.transform).to.equal('translateY(0px)');
  expect(rows[1].style.transform).to.equal('translateY(40px)');
  expect(rows[2].style.transform).to.equal('translateY(80px)');

  const spacer = el.shadowRoot!.querySelector('[part="spacer"]') as HTMLElement;
  expect(spacer.style.height).to.equal('2000px'); // 50 * 40
});

it("falls back to the item's index as the row key when keyFunction is omitted", async () => {
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      row-height="40"
      .items=${['a', 'b', 'c']}
      .renderItem=${renderText}
    ></lr-virtual-list>`,
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();
  const rows = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="row"]')];
  expect(rows.map((r) => r.dataset.rowKey)).to.deep.equal(['number:0', 'number:1', 'number:2']);
});

it('keeps NaN and negative zero keys distinct in their DOM tokens', async () => {
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      row-height="40"
      .items=${[NaN, -0]}
      .renderItem=${renderText}
      .keyFunction=${(item: unknown) => item as number}
    ></lr-virtual-list>`,
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();

  const rows = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="row"]')];
  expect(rows.map((row) => row.dataset.rowKey)).to.deep.equal(['number:NaN', 'number:-0']);
});

it("measures each row's real height via ResizeObserver in row-height='auto' mode instead of only using the fallback estimate", async () => {
  const tallRender = () => html`<div style="block-size:100px;box-sizing:border-box;">row</div>`;
  const items = Array.from({ length: 5 }, (_, i) => i);
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:600px"
      .items=${items}
      .renderItem=${tallRender}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`,
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();
  await nextFrame();
  await el.updateComplete;

  const spacer = el.shadowRoot!.querySelector('[part="spacer"]') as HTMLElement;
  const measuredTotal = parseFloat(spacer.style.height);
  // 5 * 100px measured vs. 5 * 48px (DEFAULT_ROW_ESTIMATE_PX) if measurement
  // never kicked in -- assert well above the estimate-only figure.
  expect(measuredTotal).to.be.greaterThan(400);
});

it('marks the row matching active-id with aria-current="true", not aria-selected', async () => {
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      row-height="40"
      active-id="b"
      .items=${['a', 'b', 'c']}
      .renderItem=${renderText}
      .keyFunction=${stringKey}
    ></lr-virtual-list>`,
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();
  const rows = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="row"]')];
  const active = rows.find((r) => r.dataset.rowKey === 'string:b')!;
  expect(active.getAttribute('aria-current')).to.equal('true');
  expect(active.hasAttribute('aria-selected')).to.be.false;
  const others = rows.filter((r) => r.dataset.rowKey !== 'string:b');
  others.forEach((r) => expect(r.hasAttribute('aria-current')).to.be.false);
});

it('does not scroll on initial mount even when active-id targets a row far outside the viewport', async () => {
  const items = Array.from({ length: 50 }, (_, i) => i);
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      row-height="40"
      .activeId=${40}
      .items=${items}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`,
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.scrollTop).to.equal(0);
});

it('scrolls the matching row into view once active-id changes after mount', async () => {
  const originalMatchMedia = window.matchMedia;
  // Forces the reduced-motion branch so the scroll lands synchronously
  // instead of needing to wait out a real smooth-scroll animation.
  window.matchMedia = ((query: string) => ({
    matches: query === '(prefers-reduced-motion: reduce)',
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as typeof window.matchMedia;

  try {
    const items = Array.from({ length: 50 }, (_, i) => i);
    const el = (await fixture(
      html`<lr-virtual-list
        style="--lr-virtual-list-height:200px"
        row-height="40"
        overscan="0"
        .items=${items}
        .renderItem=${renderText}
        .keyFunction=${numberKey}
      ></lr-virtual-list>`,
    )) as LyraVirtualList;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.scrollTop).to.equal(0);

    el.activeId = 40; // row 40's top edge is 40*40=1600px, well past the 200px viewport
    await el.updateComplete;
    await nextFrame();

    expect(base.scrollTop).to.be.greaterThan(1000);
  } finally {
    window.matchMedia = originalMatchMedia;
  }
});

describe('aria-label forwarding', () => {
  it('forwards a host-level aria-label onto the internal role="list" element', async () => {
    const el = (await fixture(
      html`<lr-virtual-list
        aria-label="Recent activity"
        .items=${[1, 2, 3]}
        .renderItem=${renderText}
        .keyFunction=${numberKey}
      ></lr-virtual-list>`,
    )) as LyraVirtualList;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Recent activity');
  });

  it('has no aria-label on the internal element when the host has none', async () => {
    const el = (await fixture(
      html`<lr-virtual-list
        .items=${[1, 2, 3]}
        .renderItem=${renderText}
        .keyFunction=${numberKey}
      ></lr-virtual-list>`,
    )) as LyraVirtualList;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.hasAttribute('aria-label')).to.be.false;
  });
});

it('scrollToIndex scrolls a fixed-row-height list to the requested row, honoring align', async () => {
  const items = Array.from({ length: 50 }, (_, i) => i);
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      row-height="40"
      overscan="0"
      .items=${items}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`,
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  el.scrollToIndex(20, { align: 'start', behavior: 'auto' });
  await nextFrame();
  expect(base.scrollTop).to.equal(800); // row 20's top edge: 20 * 40

  el.scrollToIndex(0, { align: 'start', behavior: 'auto' });
  await nextFrame();
  el.scrollToIndex(20, { align: 'end', behavior: 'auto' });
  await nextFrame();
  // row 20's bottom edge (840) flush with the 200px viewport bottom.
  expect(base.scrollTop).to.equal(640);
});

it('scrollToIndex with align "auto" only scrolls the minimal distance (no-op when already visible)', async () => {
  const items = Array.from({ length: 50 }, (_, i) => i);
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      row-height="40"
      overscan="0"
      .items=${items}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`,
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  el.scrollToIndex(2, { behavior: 'auto' }); // row 2's top (80px) is already within the 200px viewport
  await nextFrame();
  expect(base.scrollTop).to.equal(0);
});

it('scrollToIndex clamps an out-of-range index instead of throwing', async () => {
  const items = Array.from({ length: 10 }, (_, i) => i);
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      row-height="40"
      .items=${items}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`,
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();
  expect(() => el.scrollToIndex(999, { behavior: 'auto' })).to.not.throw();
  expect(() => el.scrollToIndex(-5, { behavior: 'auto' })).to.not.throw();
});

it('scrollToIndex is a no-op against an empty items array', async () => {
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      .items=${[]}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`,
  )) as LyraVirtualList;
  await el.updateComplete;
  expect(() => el.scrollToIndex(0)).to.not.throw();
});

it('forces behavior "auto" under prefers-reduced-motion even when "smooth" is requested', async () => {
  const originalMatchMedia = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: query === '(prefers-reduced-motion: reduce)',
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as typeof window.matchMedia;

  try {
    const items = Array.from({ length: 50 }, (_, i) => i);
    const el = (await fixture(
      html`<lr-virtual-list
        style="--lr-virtual-list-height:200px"
        row-height="40"
        overscan="0"
        .items=${items}
        .renderItem=${renderText}
        .keyFunction=${numberKey}
      ></lr-virtual-list>`,
    )) as LyraVirtualList;
    await el.updateComplete;
    await nextFrame();
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

    el.scrollToIndex(20, { align: 'start', behavior: 'smooth' });
    await nextFrame();
    // Reduced motion forces an immediate jump -- scrollTop already landed
    // synchronously rather than animating over several frames.
    expect(base.scrollTop).to.equal(800);
  } finally {
    window.matchMedia = originalMatchMedia;
  }
});

it("in row-height='auto' mode, issues one corrective re-scroll once the target row's real height arrives", async () => {
  const tallRender = () => html`<div style="block-size:100px;box-sizing:border-box;">row</div>`;
  const items = Array.from({ length: 30 }, (_, i) => i);
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      overscan="0"
      .items=${items}
      .renderItem=${tallRender}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`,
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();
  await nextFrame();
  await el.updateComplete;

  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  // Row 25 is far outside both the currently-rendered window and any
  // measured offsets -- its estimate-based offset (DEFAULT_ROW_ESTIMATE_PX
  // per row) undershoots its real 100px-tall offset substantially. `'end'`
  // alignment is used because it targets the row's *bottom* edge
  // (offsets[index + 1]), which is exactly the value that shifts once this
  // row's own real height is measured -- unlike `'start'`, whose target is
  // the row's top edge and depends only on the (here, never-rendered and so
  // never re-measured) rows before it.
  el.scrollToIndex(25, { align: 'end', behavior: 'auto' });
  const estimateBasedTop = base.scrollTop;
  await nextFrame();
  await nextFrame();
  await el.updateComplete;

  // Once row 25 actually renders and gets measured at 100px, the corrective
  // re-scroll lands well past the estimate-based guess.
  expect(base.scrollTop).to.be.greaterThan(estimateBasedTop);
});

it('emits lr-visible-range-changed once the container is measured after mount', async () => {
  const el = document.createElement('lr-virtual-list') as LyraVirtualList;
  el.setAttribute('style', '--lr-virtual-list-height:200px');
  el.setAttribute('row-height', '40');
  el.items = Array.from({ length: 30 }, (_, i) => i);
  el.renderItem = renderText;
  el.keyFunction = numberKey;

  const eventPromise = oneEvent(el, 'lr-visible-range-changed');
  document.body.appendChild(el);
  const ev = await eventPromise;
  expect(ev.detail.start).to.equal(0);
  expect(ev.detail.end).to.be.greaterThan(0);
  el.remove();
});

it('coalesces rapid scroll events into a single visible-range recompute per animation frame', async () => {
  const items = Array.from({ length: 100 }, (_, i) => i);
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      row-height="40"
      overscan="0"
      .items=${items}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`,
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();

  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  let count = 0;
  el.addEventListener('lr-visible-range-changed', () => count++);

  base.scrollTop = 100;
  base.dispatchEvent(new Event('scroll'));
  base.scrollTop = 200;
  base.dispatchEvent(new Event('scroll'));
  base.scrollTop = 400;
  base.dispatchEvent(new Event('scroll'));
  await nextFrame();
  await el.updateComplete;

  expect(count, 'three rapid scroll events should coalesce to one recompute').to.equal(1);
});

it('cancels a pending scroll frame when disconnected before it runs', async () => {
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      row-height="40"
      .items=${Array.from({ length: 30 }, (_, i) => i)}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`,
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();

  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  base.scrollTop = 200;
  base.dispatchEvent(new Event('scroll'));
  el.remove();
  await nextFrame();
});

it('keeps the scroll position anchored when a measured row above the viewport grows', async () => {
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      overscan="100"
      .items=${Array.from({ length: 20 }, (_, i) => i)}
      .renderItem=${() => html`<div style="block-size:48px;box-sizing:border-box">row</div>`}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`,
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();
  await nextFrame();

  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  base.scrollTop = 400;
  const before = base.scrollTop;
  const firstRow = el.shadowRoot!.querySelector('[part="row"]') as HTMLElement;
  (firstRow.firstElementChild as HTMLElement).style.blockSize = '100px';
  await nextFrame();
  await nextFrame();

  expect(base.scrollTop).to.be.greaterThan(before);
});

it('fires lr-load-more once when scrolling near the bottom while has-more is true and loading is false', async () => {
  const items = Array.from({ length: 20 }, (_, i) => i);
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      row-height="40"
      has-more
      .items=${items}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`,
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();

  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const eventPromise = oneEvent(el, 'lr-load-more');
  base.scrollTop = base.scrollHeight; // jump to the bottom
  base.dispatchEvent(new Event('scroll'));
  await eventPromise; // resolves iff lr-load-more fires
});

it('does not refire lr-load-more while already loading, and re-arms after scrolling away and back', async () => {
  const items = Array.from({ length: 20 }, (_, i) => i);
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      row-height="40"
      has-more
      .items=${items}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`,
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();

  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  let count = 0;
  el.addEventListener('lr-load-more', () => count++);

  base.scrollTop = base.scrollHeight;
  base.dispatchEvent(new Event('scroll'));
  await nextFrame();
  await el.updateComplete;
  expect(count).to.equal(1);

  // Still at the bottom, and loading -- must not refire.
  el.loading = true;
  base.dispatchEvent(new Event('scroll'));
  await nextFrame();
  await el.updateComplete;
  expect(count, 'should not refire while loading').to.equal(1);

  el.loading = false;
  base.dispatchEvent(new Event('scroll'));
  await nextFrame();
  await el.updateComplete;
  expect(count, 'should not refire just because loading finished while still at the same bottom approach').to.equal(
    1,
  );

  // Scroll away from the bottom, then back -- a fresh approach re-arms it.
  base.scrollTop = 0;
  base.dispatchEvent(new Event('scroll'));
  await nextFrame();
  await el.updateComplete;

  base.scrollTop = base.scrollHeight;
  base.dispatchEvent(new Event('scroll'));
  await nextFrame();
  await el.updateComplete;
  expect(count, 're-approaching the bottom after leaving it should fire again').to.equal(2);
});

it('never fires lr-load-more when has-more is false', async () => {
  const items = Array.from({ length: 20 }, (_, i) => i);
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      row-height="40"
      .items=${items}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`,
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();

  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  let fired = false;
  el.addEventListener('lr-load-more', () => (fired = true));

  base.scrollTop = base.scrollHeight;
  base.dispatchEvent(new Event('scroll'));
  await aTimeout(100);
  expect(fired).to.be.false;
});

it('reflects loading via the loading attribute and aria-busy on the scroll container', async () => {
  const el = (await fixture(
    html`<lr-virtual-list
      loading
      .items=${[]}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`,
  )) as LyraVirtualList;
  await el.updateComplete;
  expect(el.hasAttribute('loading')).to.be.true;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('aria-busy')).to.equal('true');
});

it('falls back to auto (measured) mode when row-height is neither "auto" nor a valid positive number', async () => {
  const items = Array.from({ length: 5 }, (_, i) => i);
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      row-height="not-a-number"
      .items=${items}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`,
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();
  const spacer = el.shadowRoot!.querySelector('[part="spacer"]') as HTMLElement;
  const height = parseFloat(spacer.style.height);
  expect(height).to.be.greaterThan(0);
  expect(Number.isNaN(height)).to.be.false;
});

it('positions rows via a transform instead of a padding-based spacer, so a new measurement only shifts later rows, not a page-wide reflow', () => {
  expect(styles.cssText).to.match(/\[part=['"]row['"]\][^}]*position:\s*absolute/);
  expect(styles.cssText).to.not.match(/padding-block-start|padding-top/);
});

it('gives the always-focusable [part="base"] scroll region a :hover state, matching its own :focus-visible affordance', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/\[part='base'\]:hover\s*\{[^}]+\}/);
});

it('themes the hover outline color via --lr-virtual-list-hover-outline-color, falling back to --lr-color-border-strong', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  const rule = css.match(/\[part='base'\]:hover\s*\{([^}]+)\}/)?.[1] ?? '';
  expect(rule).to.match(/outline:[^;]*var\(--lr-virtual-list-hover-outline-color,\s*var\(--lr-color-border-strong\)\)/);
});

it('cascades --lr-virtual-list-hover-outline-color onto [part="base"]', async () => {
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      .items=${[1, 2, 3]}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`,
  )) as LyraVirtualList;
  await el.updateComplete;
  el.style.setProperty('--lr-virtual-list-hover-outline-color', 'rgb(12, 34, 56)');
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(getComputedStyle(base).getPropertyValue('--lr-virtual-list-hover-outline-color').trim()).to.equal('rgb(12, 34, 56)');
});

it('does not rebuild the offsets array on a pure scroll-position update in row-height="auto" mode', async () => {
  const items = Array.from({ length: 300 }, (_, i) => i);
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      .items=${items}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`,
  )) as LyraVirtualList;
  await el.updateComplete;
  // Let the initial measurement pass (and any offsets rebuild it triggers)
  // fully settle before taking the "before" snapshot.
  await nextFrame();
  await nextFrame();
  await el.updateComplete;

  const offsetsBefore = (el as unknown as { offsets: number[] }).offsets;

  // A tiny scroll delta that doesn't move the rendered window at all (rows
  // are ~48px tall by default) -- a pure scroll-position tick with no
  // items/rowHeight/keyFunction change and no new row entering view to be
  // measured for the first time.
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  base.scrollTop = 5;
  base.dispatchEvent(new Event('scroll'));
  await nextFrame();
  await el.updateComplete;

  const offsetsAfter = (el as unknown as { offsets: number[] }).offsets;
  expect(offsetsAfter, 'offsets should be the same array instance -- recomputeOffsets() must not have run').to.equal(
    offsetsBefore,
  );
});

it('keeps watching already-rendered rows for height changes after a disconnect/reconnect that changes no other property', async () => {
  const resizableRender = () => html`<div style="block-size:48px;box-sizing:border-box;">row</div>`;
  const items = Array.from({ length: 5 }, (_, i) => i);
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:600px"
      .items=${items}
      .renderItem=${resizableRender}
      .keyFunction=${numberKey}
    ></lr-virtual-list>`,
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();
  await nextFrame();
  await el.updateComplete;

  const spacerBefore = el.shadowRoot!.querySelector('[part="spacer"]') as HTMLElement;
  const heightBefore = parseFloat(spacerBefore.style.height);

  // Detach/reattach without touching any other property -- simulates the
  // reparenting-drag scenario the class doc calls out. No reactive property
  // changes here, so a Lit re-render must not be the only thing that keeps
  // row-height measurement alive.
  const parent = el.parentElement!;
  parent.removeChild(el);
  parent.appendChild(el);
  await el.updateComplete;

  const row = el.shadowRoot!.querySelector('[part="row"]') as HTMLElement;
  const content = row.firstElementChild as HTMLElement;
  content.style.blockSize = '300px';
  await nextFrame();
  await nextFrame();
  await el.updateComplete;

  const spacerAfter = el.shadowRoot!.querySelector('[part="spacer"]') as HTMLElement;
  const heightAfter = parseFloat(spacerAfter.style.height);
  expect(heightAfter, 'a mutated row height should still reach the spacer after reconnect').to.be.greaterThan(
    heightBefore,
  );
});

it('prunes stale measuredHeights entries once items changes to a wholly different set of keys', async () => {
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      .items=${['a', 'b', 'c']}
      .renderItem=${renderText}
      .keyFunction=${stringKey}
    ></lr-virtual-list>`,
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();
  await nextFrame();
  await el.updateComplete;

  const measuredHeights = (el as unknown as { measuredHeights: Map<string | number, number> }).measuredHeights;
  expect(measuredHeights.has('a')).to.be.true;
  expect(measuredHeights.has('b')).to.be.true;
  expect(measuredHeights.has('c')).to.be.true;

  el.items = ['x', 'y'];
  await el.updateComplete;
  await nextFrame();
  await nextFrame();
  await el.updateComplete;

  expect(measuredHeights.has('a'), 'stale key "a" should have been pruned').to.be.false;
  expect(measuredHeights.has('b'), 'stale key "b" should have been pruned').to.be.false;
  expect(measuredHeights.has('c'), 'stale key "c" should have been pruned').to.be.false;
});

it('keeps numeric and string keys distinct in internal measurements and DOM identity', async () => {
  const items = [1, '1'];
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      row-height="auto"
      .items=${items}
      .renderItem=${renderText}
      .keyFunction=${(item: unknown) => item as string | number}
      .activeId=${1}
    ></lr-virtual-list>`,
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();
  await nextFrame();
  const rows = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="row"]')];
  expect(rows.map((row) => row.dataset.rowKey)).to.deep.equal(['number:1', 'string:1']);
  expect(rows[0].getAttribute('aria-current')).to.equal('true');
  expect(rows[1].hasAttribute('aria-current')).to.be.false;
});

it('renders valid group labels at their indexed row offsets', async () => {
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      row-height="40"
      .items=${['a', 'b', 'c']}
      .groups=${[
        { key: 'first', label: 'First', startIndex: 0 },
        { key: 'second', label: 'Second', startIndex: 2 },
        { key: 'invalid', startIndex: 99 },
      ]}
      .renderItem=${renderText}
    ></lr-virtual-list>`,
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();
  const groups = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="group"]')];
  expect(groups.map((group) => group.textContent?.trim())).to.deep.equal(['First', 'Second']);
  expect(groups[1].style.transform).to.equal('translateY(80px)');
});

it('falls back to a group key when a group has no explicit label', async () => {
  const el = (await fixture(
    html`<lr-virtual-list
      style="--lr-virtual-list-height:200px"
      row-height="40"
      .items=${['a', 'b']}
      .groups=${[{ key: 'Ungrouped', startIndex: 0 }]}
      .renderItem=${renderText}
    ></lr-virtual-list>`,
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();

  expect(el.shadowRoot!.querySelector('[part="group"]')!.textContent?.trim()).to.equal('Ungrouped');
});

describe('itemRole / rowIndexOffset', () => {
  it('defaults to listitem/list roles (unchanged from today)', async () => {
    const el = (await fixture(html`<lr-virtual-list style="height:100px"></lr-virtual-list>`)) as LyraVirtualList;
    el.items = ['a', 'b'];
    el.renderItem = (item: unknown) => html`<span>${item}</span>`;
    await el.updateComplete;
    await aTimeout(0);
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('role')).to.equal('list');
    expect(el.shadowRoot!.querySelector('[part="row"]')!.getAttribute('role')).to.equal('listitem');
  });

  it('maps to table roles when item-role="row"', async () => {
    const el = (await fixture(
      html`<lr-virtual-list style="height:100px" item-role="row" row-index-offset="1"></lr-virtual-list>`,
    )) as LyraVirtualList;
    el.items = ['a', 'b'];
    el.renderItem = (item: unknown) => html`<span>${item}</span>`;
    await el.updateComplete;
    await aTimeout(0);
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('role')).to.equal('rowgroup');
    const firstRow = el.shadowRoot!.querySelector('[part="row"]')!;
    expect(firstRow.getAttribute('role')).to.equal('row');
    expect(firstRow.getAttribute('aria-rowindex')).to.equal('2'); // index 0 + 1 (1-based) + offset 1
    expect(firstRow.hasAttribute('aria-setsize')).to.be.false;
    expect(firstRow.hasAttribute('aria-posinset')).to.be.false;
    expect(el.shadowRoot!.querySelector('[part="spacer"]')!.getAttribute('role')).to.equal('presentation');
  });

  it('keeps [part="base"] focusable (tabindex 0) in row mode', async () => {
    const el = (await fixture(
      html`<lr-virtual-list style="height:100px" item-role="row"></lr-virtual-list>`,
    )) as LyraVirtualList;
    el.items = ['a'];
    el.renderItem = (item: unknown) => html`<span>${item}</span>`;
    await el.updateComplete;
    await aTimeout(0);
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('tabindex')).to.equal('0');
  });

  it('resize-driven row observation still works in row mode (data-row-index, not aria-posinset)', async () => {
    const el = (await fixture(
      html`<lr-virtual-list style="height:60px" item-role="row" row-height="auto"></lr-virtual-list>`,
    )) as LyraVirtualList;
    el.items = ['a', 'b', 'c'];
    el.renderItem = (item: unknown) => html`<span>${item}</span>`;
    await el.updateComplete;
    await aTimeout(50); // allow ResizeObserver to report real row heights and trigger a re-render
    expect(el.shadowRoot!.querySelectorAll('[part="row"]').length).to.be.greaterThan(0);
  });

  it('sanitizes an invalid row-index-offset instead of producing aria-rowindex="NaN"', async () => {
    const cases = [
      { value: 'NaN', expected: 0 },
      { value: 'Infinity', expected: 0 },
      { value: '2.9', expected: 2 },
    ];
    for (const { value, expected } of cases) {
      const el = (await fixture(
        html`<lr-virtual-list style="height:100px" item-role="row" row-index-offset=${value}></lr-virtual-list>`,
      )) as LyraVirtualList;
      el.items = ['a'];
      el.renderItem = (item: unknown) => html`<span>${item}</span>`;
      await el.updateComplete;
      await aTimeout(0);
      const firstRow = el.shadowRoot!.querySelector('[part="row"]')!;
      expect(firstRow.getAttribute('aria-rowindex'), value).to.equal(String(1 + expected));
    }
  });

  it('uses the same sanitized fallback for a direct out-of-range rowIndexOffset property assignment', async () => {
    const el = (await fixture(
      html`<lr-virtual-list style="height:100px" item-role="row"></lr-virtual-list>`,
    )) as LyraVirtualList;
    el.items = ['a'];
    el.renderItem = (item: unknown) => html`<span>${item}</span>`;
    el.rowIndexOffset = NaN;
    await el.updateComplete;
    await aTimeout(0);
    const firstRow = el.shadowRoot!.querySelector('[part="row"]')!;
    expect(firstRow.getAttribute('aria-rowindex')).to.equal('1');
  });
});

describe('public offset/index queries', () => {
  /** The pixel top a row is actually rendered at, read back from its own box rather than from the
   *  component's internal state -- `[part="row"]` is absolutely positioned inside `[part="spacer"]`
   *  and shifted by `translateY(offset)`, so this difference *is* the rendered offset. */
  function renderedTop(el: LyraVirtualList, index: number): number {
    const spacer = el.shadowRoot!.querySelector('[part="spacer"]') as HTMLElement;
    const row = el.shadowRoot!.querySelector<HTMLElement>(`[part="row"][data-row-index="${index}"]`)!;
    return row.getBoundingClientRect().top - spacer.getBoundingClientRect().top;
  }

  it('offsetForIndex matches the pixel top a row renders at in fixed row-height mode', async () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    const el = (await fixture(
      html`<lr-virtual-list
        style="--lr-virtual-list-height:200px"
        row-height="40"
        overscan="2"
        .items=${items}
        .renderItem=${renderText}
        .keyFunction=${numberKey}
      ></lr-virtual-list>`,
    )) as LyraVirtualList;
    await el.updateComplete;
    await nextFrame();

    for (const index of [0, 1, 3]) {
      expect(el.offsetForIndex(index), `row ${index}`).to.equal(index * 40);
      expect(renderedTop(el, index), `rendered row ${index}`).to.be.closeTo(el.offsetForIndex(index), 0.5);
    }
    // offsetForIndex(items.length) is the total content height -- the spacer's own height.
    const spacer = el.shadowRoot!.querySelector('[part="spacer"]') as HTMLElement;
    expect(el.offsetForIndex(items.length)).to.equal(parseFloat(spacer.style.height));
  });

  it('offsetForIndex matches the pixel top a row renders at in row-height="auto" mode', async () => {
    const heights = [30, 90, 55, 120, 45, 70];
    const items = heights.map((h, i) => ({ id: i, h }));
    const el = (await fixture(
      html`<lr-virtual-list
        style="--lr-virtual-list-height:600px"
        .items=${items}
        .renderItem=${(item: unknown) =>
          html`<div style="block-size:${(item as { h: number }).h}px;box-sizing:border-box">row</div>`}
        .keyFunction=${(item: unknown) => (item as { id: number }).id}
      ></lr-virtual-list>`,
    )) as LyraVirtualList;
    await el.updateComplete;
    await nextFrame();
    await nextFrame();
    await el.updateComplete;

    for (let i = 0; i < heights.length; i++) {
      expect(renderedTop(el, i), `rendered row ${i}`).to.be.closeTo(el.offsetForIndex(i), 0.5);
    }
    expect(el.offsetForIndex(heights.length)).to.be.closeTo(
      heights.reduce((a, b) => a + b, 0),
      1,
    );
  });

  it('clamps offsetForIndex to 0…items.length and returns 0 for an empty list', async () => {
    const el = (await fixture(
      html`<lr-virtual-list
        style="--lr-virtual-list-height:200px"
        row-height="40"
        .items=${[1, 2, 3]}
        .renderItem=${renderText}
        .keyFunction=${numberKey}
      ></lr-virtual-list>`,
    )) as LyraVirtualList;
    await el.updateComplete;
    await nextFrame();
    expect(el.offsetForIndex(-10)).to.equal(0);
    expect(el.offsetForIndex(999)).to.equal(120); // clamped to items.length -> total height
    expect(el.offsetForIndex(NaN)).to.equal(0);

    el.items = [];
    await el.updateComplete;
    expect(el.offsetForIndex(0)).to.equal(0);
  });

  it('indexAtOffset round-trips offsetForIndex for every index in a mixed-height list', async () => {
    const heights = [30, 90, 55, 120, 45, 70];
    const items = heights.map((h, i) => ({ id: i, h }));
    const el = (await fixture(
      html`<lr-virtual-list
        style="--lr-virtual-list-height:600px"
        .items=${items}
        .renderItem=${(item: unknown) =>
          html`<div style="block-size:${(item as { h: number }).h}px;box-sizing:border-box">row</div>`}
        .keyFunction=${(item: unknown) => (item as { id: number }).id}
      ></lr-virtual-list>`,
    )) as LyraVirtualList;
    await el.updateComplete;
    await nextFrame();
    await nextFrame();
    await el.updateComplete;

    for (let i = 0; i < heights.length; i++) {
      expect(el.indexAtOffset(el.offsetForIndex(i)), `round trip ${i}`).to.equal(i);
      // A point strictly inside the row's box resolves to the same row.
      expect(el.indexAtOffset(el.offsetForIndex(i) + 1), `inside ${i}`).to.equal(i);
    }
  });

  it('clamps indexAtOffset and reports -1 for an empty list', async () => {
    const el = (await fixture(
      html`<lr-virtual-list
        style="--lr-virtual-list-height:200px"
        row-height="40"
        .items=${[1, 2, 3]}
        .renderItem=${renderText}
        .keyFunction=${numberKey}
      ></lr-virtual-list>`,
    )) as LyraVirtualList;
    await el.updateComplete;
    await nextFrame();
    expect(el.indexAtOffset(-500)).to.equal(0);
    expect(el.indexAtOffset(99999)).to.equal(2);
    expect(el.indexAtOffset(Infinity)).to.equal(2);
    expect(el.indexAtOffset(NaN)).to.equal(0);

    el.items = [];
    await el.updateComplete;
    expect(el.indexAtOffset(0)).to.equal(-1);
  });
});

describe('public scroll container and lr-scroll', () => {
  async function scrollFixture(): Promise<LyraVirtualList> {
    const el = (await fixture(
      html`<lr-virtual-list
        style="--lr-virtual-list-height:200px"
        row-height="40"
        overscan="0"
        .items=${Array.from({ length: 100 }, (_, i) => i)}
        .renderItem=${renderText}
        .keyFunction=${numberKey}
      ></lr-virtual-list>`,
    )) as LyraVirtualList;
    await el.updateComplete;
    await nextFrame();
    return el;
  }

  it('exposes [part="base"] as the public scrollContainer', async () => {
    const el = await scrollFixture();
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    // Compared as a boolean: a failing DOM-node assertion hangs the whole file under wtr.
    expect(el.scrollContainer === base, 'scrollContainer should be the [part="base"] element').to.be.true;
    expect(el.scrollContainer!.getAttribute('part')).to.equal('base');
  });

  it('reports scrollContainer as undefined before the first render', () => {
    const el = document.createElement('lr-virtual-list') as LyraVirtualList;
    expect(el.scrollContainer === undefined, 'no scroll container exists before first render').to.be.true;
  });

  it('coalesces a burst of scroll events within one frame into exactly one lr-scroll', async () => {
    const el = await scrollFixture();
    const base = el.scrollContainer!;
    const details: { scrollTop: number; viewportHeight: number }[] = [];
    el.addEventListener('lr-scroll', (e) => details.push((e as CustomEvent).detail));

    base.scrollTop = 100;
    base.dispatchEvent(new Event('scroll'));
    base.scrollTop = 260;
    base.dispatchEvent(new Event('scroll'));
    base.scrollTop = 375;
    base.dispatchEvent(new Event('scroll'));
    await nextFrame();
    await el.updateComplete;

    expect(details.length, 'three scroll events in one frame produce one lr-scroll').to.equal(1);
    expect(details[0].scrollTop).to.equal(base.scrollTop);
    expect(details[0].scrollTop).to.equal(375);
    expect(details[0].viewportHeight).to.be.closeTo(base.clientHeight, 1);
  });

  it('reports sub-row scroll deltas that never change the visible index range', async () => {
    // 210px viewport over 40px rows: both the top and the bottom edge sit strictly inside a row's
    // box, so a few pixels of movement cannot pull a new row into the visible range.
    const el = (await fixture(
      html`<lr-virtual-list
        style="--lr-virtual-list-height:210px"
        row-height="40"
        overscan="0"
        .items=${Array.from({ length: 100 }, (_, i) => i)}
        .renderItem=${renderText}
        .keyFunction=${numberKey}
      ></lr-virtual-list>`,
    )) as LyraVirtualList;
    await el.updateComplete;
    await nextFrame();
    const base = el.scrollContainer!;
    let scrollEvents = 0;
    let rangeEvents = 0;
    el.addEventListener('lr-scroll', () => scrollEvents++);
    el.addEventListener('lr-visible-range-changed', () => rangeEvents++);

    // 3px: far less than the 40px row height, so the rendered index range cannot change.
    base.scrollTop = 3;
    base.dispatchEvent(new Event('scroll'));
    await nextFrame();
    await el.updateComplete;

    expect(scrollEvents, 'lr-scroll tracks sub-row movement').to.equal(1);
    expect(rangeEvents, 'lr-visible-range-changed is not a substitute').to.equal(0);
  });

  it('does not fire lr-scroll when nothing actually scrolled', async () => {
    const el = await scrollFixture();
    const base = el.scrollContainer!;
    let count = 0;
    el.addEventListener('lr-scroll', () => count++);

    base.dispatchEvent(new Event('scroll')); // scrollTop still 0
    await nextFrame();
    await el.updateComplete;
    expect(count).to.equal(0);

    base.scrollTop = 120;
    base.dispatchEvent(new Event('scroll'));
    await nextFrame();
    await el.updateComplete;
    expect(count).to.equal(1);

    base.dispatchEvent(new Event('scroll')); // same position again
    await nextFrame();
    await el.updateComplete;
    expect(count, 'a repeat scroll event at an unchanged position is not a scroll').to.equal(1);
  });
});

describe('renderedRows', () => {
  it('returns the currently-rendered row wrappers in item order, and never the sticky overlay', async () => {
    const items = Array.from({ length: 100 }, (_, i) => i);
    const el = (await fixture(
      html`<lr-virtual-list
        style="--lr-virtual-list-height:200px"
        row-height="40"
        overscan="0"
        .items=${items}
        .groups=${[{ key: 'g', label: '', startIndex: 0 }]}
        .renderItem=${renderText}
        .keyFunction=${numberKey}
        .renderStickyGroup=${() => html`<div>pinned</div>`}
      ></lr-virtual-list>`,
    )) as LyraVirtualList;
    await el.updateComplete;
    await nextFrame();

    const rows = el.renderedRows;
    expect(rows.length).to.equal(el.shadowRoot!.querySelectorAll('[part="row"]').length);
    expect(rows.length).to.be.greaterThan(1);
    expect(rows.every((row) => row.getAttribute('part') === 'row')).to.be.true;
    expect(rows.map((row) => Number(row.dataset.rowIndex))).to.deep.equal(
      rows.map((_, i) => i + Number(rows[0].dataset.rowIndex)),
    );

    // Windowed, not the whole collection -- and it tracks the window as it moves.
    expect(rows.length).to.be.lessThan(items.length);
    el.scrollContainer!.scrollTop = 1600;
    el.scrollContainer!.dispatchEvent(new Event('scroll'));
    await nextFrame();
    await el.updateComplete;
    expect(Number(el.renderedRows[0].dataset.rowIndex)).to.equal(40);
  });

  it('is empty before the first render', () => {
    const el = document.createElement('lr-virtual-list') as LyraVirtualList;
    expect(el.renderedRows.length).to.equal(0);
  });
});

describe('sticky group overlay', () => {
  const STICKY_HEIGHT = 32;
  const ROW = 40;
  const groups = [
    { key: 'a', label: 'Group A', startIndex: 5 },
    { key: 'b', label: 'Group B', startIndex: 20 },
    { key: 'c', label: 'Group C', startIndex: 40 },
  ];
  const items = Array.from({ length: 60 }, (_, i) => i);

  // Mirrors what a real consumer does: the group header is an ordinary row that owns the heading
  // semantics, and the sticky copy repeats the same markup.
  const renderGroupAwareRow = (item: unknown, index: number) =>
    groups.some((group) => group.startIndex === index)
      ? html`<div role="heading" aria-level="2" style="block-size:${ROW}px;box-sizing:border-box">
          ${groups.find((group) => group.startIndex === index)!.label}
        </div>`
      : html`item ${item}#${index}`;

  /** A row whose height is explicit, so `row-height="auto"` measurement settles in one pass. */
  const measuredRow = (item: unknown, index: number) =>
    html`<div style="block-size:${ROW}px;box-sizing:border-box">item ${item}#${index}</div>`;

  const renderSticky = (group: { key: string | number; label?: string }) => html`
    <div
      class="sticky-copy"
      role="heading"
      aria-level="2"
      style="block-size:${STICKY_HEIGHT}px;box-sizing:border-box;background:var(--lr-color-surface)"
    >
      <button type="button" class="sticky-button">${group.label}</button>
    </div>
  `;

  async function mount(
    sticky: boolean,
    extra: {
      rowHeight?: string;
      groups?: typeof groups;
      items?: unknown[];
      renderItem?: (item: unknown, index: number) => unknown;
    } = {},
  ): Promise<LyraVirtualList> {
    const el = (await fixture(
      html`<lr-virtual-list
        style="--lr-virtual-list-height:200px"
        row-height=${extra.rowHeight ?? String(ROW)}
        overscan="0"
        .items=${extra.items ?? items}
        .groups=${extra.groups ?? groups}
        .renderItem=${extra.renderItem ?? renderGroupAwareRow}
        .keyFunction=${numberKey}
        .renderStickyGroup=${sticky ? renderSticky : undefined}
      ></lr-virtual-list>`,
    )) as LyraVirtualList;
    await el.updateComplete;
    await nextFrame();
    await nextFrame();
    await el.updateComplete;
    return el;
  }

  async function scrollTo(el: LyraVirtualList, top: number): Promise<void> {
    const base = el.scrollContainer!;
    base.scrollTop = top;
    base.dispatchEvent(new Event('scroll'));
    await nextFrame();
    await el.updateComplete;
    await nextFrame();
    await el.updateComplete;
  }

  function overlay(el: LyraVirtualList): HTMLElement | null {
    return el.shadowRoot!.querySelector<HTMLElement>('[part~="sticky-group"]');
  }

  /** Every element in the shadow tree, as `tag[sorted attributes]` -- a byte-level record of the
   *  rendered output that a shifted row transform or a stray attribute would change. */
  function elementOutline(el: LyraVirtualList): string[] {
    return [...el.shadowRoot!.querySelectorAll('*')].map(
      (node) =>
        `${node.localName}[${[...node.attributes]
          .map((attr) => `${attr.name}="${attr.value}"`)
          .sort()
          .join(' ')}]`,
    );
  }

  /** The scroll inset on `[part="base"]` is the one documented, deliberate difference the sticky
   *  layer makes outside its own subtree; it is asserted on its own, so it is normalized away here. */
  function withoutScrollInset(outline: string[]): string[] {
    return outline.map((entry) => entry.replace(/ ?style="scroll-padding-block-start:[^"]*"/, ''));
  }

  /** Elements the browser would stop at during a forward Tab walk, in DOM order: `tabIndex` is the
   *  browser's own computed value (0 for a bare `<button>`), not a stylesheet or markup guess. */
  function tabStops(el: LyraVirtualList): string[] {
    return [...el.shadowRoot!.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]')]
      .filter((node) => node.tabIndex >= 0)
      .map((node) => `${node.localName}.${node.className || node.getAttribute('part') || ''}`);
  }

  it('renders no overlay at all, and output identical to the no-callback render, while renderStickyGroup is unset', async () => {
    const plain = await mount(false);
    const withSticky = await mount(true);
    // Same scroll position for both, deep inside Group A, so the overlay is definitely rendered in
    // the second one and the two are otherwise in exactly the same state.
    await scrollTo(plain, 10 * ROW);
    await scrollTo(withSticky, 10 * ROW);

    expect(overlay(plain) === null, 'no overlay element without renderStickyGroup').to.be.true;
    expect(plain.shadowRoot!.querySelectorAll('[part~="sticky-group"]').length).to.equal(0);

    const plainOutline = elementOutline(plain);
    const stickyOutline = elementOutline(withSticky);
    // The *only* difference the overlay makes is the overlay subtree itself: every other element,
    // attribute, and row transform is byte-identical.
    const stickyIds = new Set<number>();
    stickyOutline.forEach((entry, i) => {
      if (entry.includes('sticky-group') || entry.includes('sticky-copy') || entry.includes('sticky-button')) {
        stickyIds.add(i);
      }
    });
    expect(stickyIds.size, 'overlay renders exactly its own subtree').to.equal(3);
    expect(withoutScrollInset(stickyOutline.filter((_, i) => !stickyIds.has(i)))).to.deep.equal(
      withoutScrollInset(plainOutline),
    );
    expect(plain.scrollContainer!.hasAttribute('style'), 'no inline style without the sticky layer').to.be.false;
    expect(withSticky.scrollContainer!.getAttribute('style')).to.equal(
      `scroll-padding-block-start:${STICKY_HEIGHT}px`,
    );
  });

  it('keeps total content height identical with and without the overlay in row-height="auto" mode', async () => {
    // Group A starts at row 0 so the overlay is pinned from the very first frame -- no scrolling,
    // and therefore no interleaving of measurement with window changes.
    const autoGroups = [{ key: 'a', label: 'Group A', startIndex: 0 }];
    const autoItems = Array.from({ length: 20 }, (_, i) => i);
    // Explicit-height row content so measurement converges in a single pass instead of cascading.
    const autoRow = { rowHeight: 'auto', groups: autoGroups, items: autoItems, renderItem: measuredRow };
    const plain = await mount(false, autoRow);
    const withSticky = await mount(true, autoRow);
    expect(overlay(withSticky) === null, 'overlay is rendered for this assertion to mean anything').to.be.false;

    // The overlay is a *copy* of a header that also exists as a real row. If it were measured, or
    // counted in offsets, the content height would grow by its own height.
    expect(withSticky.offsetForIndex(autoItems.length)).to.equal(plain.offsetForIndex(autoItems.length));
    const spacer = withSticky.shadowRoot!.querySelector('[part="spacer"]') as HTMLElement;
    expect(parseFloat(spacer.style.height)).to.equal(plain.offsetForIndex(autoItems.length));
  });

  it('never hands the overlay to the row ResizeObserver', async () => {
    const el = await mount(true, {
      rowHeight: 'auto',
      groups: [{ key: 'a', label: 'Group A', startIndex: 0 }],
      items: Array.from({ length: 20 }, (_, i) => i),
      renderItem: measuredRow,
    });
    expect(overlay(el) === null, 'overlay is present').to.be.false;
    const observed = (el as unknown as { observedRows: Map<unknown, HTMLElement> }).observedRows;
    const rows = el.shadowRoot!.querySelectorAll('[part="row"]').length;
    expect(rows).to.be.greaterThan(0);
    expect(observed.size).to.equal(rows);
    expect([...observed.values()].some((node) => node.getAttribute('part')?.includes('sticky'))).to.be.false;
  });

  it('pins the group whose header has scrolled past the top, and swaps it at the next group', async () => {
    const el = await mount(true);
    const base = el.scrollContainer!;

    // Above the first group's start index -- nothing is pinned yet, so nothing is shown. The band
    // element itself stays mounted (hidden) purely so its height remains measurable.
    await scrollTo(el, 0);
    expect(getComputedStyle(overlay(el)!).visibility, 'no sticky header above the first group').to.equal('hidden');

    // Inside Group A (rows 5..19).
    await scrollTo(el, 10 * ROW);
    expect(getComputedStyle(overlay(el)!).visibility).to.equal('visible');
    expect(overlay(el)!.textContent).to.contain('Group A');
    expect(overlay(el)!.getBoundingClientRect().top).to.be.closeTo(base.getBoundingClientRect().top, 1);

    // Still inside Group A, much further down: still pinned to the viewport top.
    await scrollTo(el, 18 * ROW);
    expect(overlay(el)!.textContent).to.contain('Group A');
    expect(overlay(el)!.getBoundingClientRect().top).to.be.closeTo(base.getBoundingClientRect().top, 1);

    // Into Group B (rows 20..39).
    await scrollTo(el, 25 * ROW);
    expect(overlay(el)!.textContent).to.contain('Group B');

    await scrollTo(el, 45 * ROW);
    expect(overlay(el)!.textContent).to.contain('Group C');
  });

  it('pushes the pinned header off as the next group header arrives, instead of swapping abruptly', async () => {
    const el = await mount(true);
    const base = el.scrollContainer!;
    const viewportTop = () => base.getBoundingClientRect().top;

    // Group B starts at row 20 (offset 800). Scroll so its header row is 8px below the viewport
    // top -- less than the 32px sticky band, so Group A's pinned header must be riding up.
    await scrollTo(el, 20 * ROW - 8);
    const pushed = overlay(el)!;
    expect(pushed.textContent).to.contain('Group A');
    const pushedTop = pushed.getBoundingClientRect().top - viewportTop();
    expect(pushedTop, 'pushed up by the overlap').to.be.closeTo(8 - STICKY_HEIGHT, 1.5);

    // Halfway through the push-off it is less displaced.
    await scrollTo(el, 20 * ROW - 24);
    const partly = overlay(el)!.getBoundingClientRect().top - viewportTop();
    expect(partly).to.be.greaterThan(pushedTop);
    expect(partly).to.be.closeTo(24 - STICKY_HEIGHT, 1.5);

    // Far enough above the next group and there is no push at all.
    await scrollTo(el, 15 * ROW);
    expect(overlay(el)!.getBoundingClientRect().top - viewportTop()).to.be.closeTo(0, 1);
  });

  it('is aria-hidden, adds no tab stop, and leaves exactly one exposed heading per group', async () => {
    const plain = await mount(false);
    const el = await mount(true);
    // Group A's real header row sits exactly at the viewport top here, so the real header and the
    // pinned copy are both in the DOM at once -- the only state in which a duplicate heading or a
    // duplicate tab stop can exist at all.
    await scrollTo(el, 5 * ROW);

    const copy = overlay(el)!;
    expect(copy.getAttribute('aria-hidden')).to.equal('true');

    // The copy's own button is focusable by script at most -- never a Tab stop, so the Tab order is
    // exactly the one the list has without any overlay.
    const stickyButton = copy.querySelector<HTMLElement>('.sticky-button')!;
    expect(stickyButton.tabIndex).to.equal(-1);
    expect(tabStops(el)).to.deep.equal(tabStops(plain));

    const headings = [...el.shadowRoot!.querySelectorAll('[role="heading"]')];
    expect(headings.length, 'both the real header row and the copy carry heading markup').to.equal(2);
    // ...but only the real row's is exposed: the copy is out of the accessibility tree entirely.
    expect(headings.filter((node) => node.closest('[aria-hidden="true"]') === null).length).to.equal(1);
    expect(copy.closest('[aria-hidden="true"]') === copy, 'the copy itself carries the aria-hidden').to.be.true;
  });

  it('is pointer-transparent by default and interactive only when the consumer opts in', async () => {
    const el = await mount(true);
    await scrollTo(el, 10 * ROW);
    const copy = overlay(el)!;
    expect(getComputedStyle(copy).pointerEvents).to.equal('none');

    const rect = copy.getBoundingClientRect();
    const hitDefault = el.shadowRoot!.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    expect(hitDefault?.closest('[part~="sticky-group"]') === null, 'clicks pass through by default').to.be.true;

    const style = document.createElement('style');
    style.textContent = 'lr-virtual-list::part(sticky-group) { pointer-events: auto; }';
    document.head.append(style);
    try {
      expect(getComputedStyle(copy).pointerEvents).to.equal('auto');
      const hitOptedIn = el.shadowRoot!.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      expect(hitOptedIn?.closest('[part~="sticky-group"]') !== null, 'the opted-in band receives the hit').to.be.true;
    } finally {
      style.remove();
    }
  });

  it('treats an empty group label as a position anchor: no marker, but it still drives the overlay', async () => {
    const anchorGroups = [
      { key: 'a', label: '', startIndex: 5 },
      { key: 'b', label: '', startIndex: 20 },
    ];
    const el = await mount(true, { groups: anchorGroups });
    expect(el.shadowRoot!.querySelectorAll('[part="group"]').length, 'no duplicate marker').to.equal(0);

    await scrollTo(el, 10 * ROW);
    const copy = overlay(el);
    expect(copy === null, 'the anchor still pins a sticky header').to.be.false;
    expect(copy!.getBoundingClientRect().top).to.be.closeTo(el.scrollContainer!.getBoundingClientRect().top, 1);

    // An omitted label still falls back to the key, exactly as before.
    el.groups = [{ key: 'Ungrouped', startIndex: 5 }];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="group"]')!.textContent?.trim()).to.equal('Ungrouped');
  });

  describe('scroll inset for the sticky band', () => {
    let originalMatchMedia: typeof window.matchMedia;

    beforeEach(() => {
      originalMatchMedia = window.matchMedia;
      // Reduced motion forces every scroll to land synchronously instead of animating.
      window.matchMedia = ((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      })) as typeof window.matchMedia;
    });

    afterEach(() => {
      window.matchMedia = originalMatchMedia;
    });

    it('lands an active-id row below the sticky band instead of behind it', async () => {
      const el = await mount(true);
      const base = el.scrollContainer!;
      expect(getComputedStyle(base).scrollPaddingBlockStart).to.equal(`${STICKY_HEIGHT}px`);

      // Start below the target so the scroll-into-view runs *upward*: that is the direction that
      // aligns the row's top edge, and therefore the one the band can hide it behind.
      await scrollTo(el, 900);
      el.activeId = 20; // Group B's first row, offset 800
      await el.updateComplete;
      await nextFrame();
      await el.updateComplete;
      await nextFrame();

      const band = overlay(el)!;
      const row = el.shadowRoot!.querySelector<HTMLElement>('[part="row"][data-row-index="20"]')!;
      expect(base.scrollTop, 'the inset is subtracted from the top-aligned target').to.equal(
        20 * ROW - STICKY_HEIGHT,
      );
      expect(row.getBoundingClientRect().top).to.be.gte(band.getBoundingClientRect().bottom - 0.5);
    });

    it('applies the same inset to scrollToIndex', async () => {
      const el = await mount(true);
      const base = el.scrollContainer!;
      el.scrollToIndex(20, { align: 'start', behavior: 'auto' });
      await nextFrame();
      expect(base.scrollTop).to.equal(20 * ROW - STICKY_HEIGHT);

      // `align: 'end'` targets the bottom edge, which the top band does not obscure.
      el.scrollToIndex(0, { align: 'start', behavior: 'auto' });
      await nextFrame();
      el.scrollToIndex(20, { align: 'end', behavior: 'auto' });
      await nextFrame();
      expect(base.scrollTop).to.equal(21 * ROW - 200);
    });

    it('leaves both scroll paths exactly as they are when renderStickyGroup is unset', async () => {
      const el = await mount(false);
      const base = el.scrollContainer!;
      expect(getComputedStyle(base).scrollPaddingBlockStart, 'the initial value, untouched').to.equal('auto');
      expect(base.hasAttribute('style'), 'no inline style at all without the sticky layer').to.be.false;

      el.scrollToIndex(20, { align: 'start', behavior: 'auto' });
      await nextFrame();
      expect(base.scrollTop).to.equal(20 * ROW);

      await scrollTo(el, 900);
      el.activeId = 20;
      await el.updateComplete;
      await nextFrame();
      expect(base.scrollTop, 'the row lands flush with the viewport top, exactly as before').to.equal(20 * ROW);
    });
  });

  it('is accessible with the overlay present', async () => {
    const el = await mount(true);
    await scrollTo(el, 10 * ROW);
    expect(overlay(el) === null, 'overlay is present for the axe run').to.be.false;
    await expect(el).to.be.accessible();
  });
});

describe('row stacking context', () => {
  // Every [part="row"] is its own stacking context (`will-change: transform`), so a popup opened
  // from inside a row -- an lr-menu dropdown at z-index 900, say -- can never paint above a *later*
  // row: 900 only orders siblings inside the row's own context, and rows themselves paint in DOM
  // order at z-index auto. The failure is invisible in a small fixture because the last row has
  // nothing painting after it, so these fixtures deliberately probe an *earlier* row.
  const ROW_HEIGHT = 40;
  const POPUP_TOP = 30;
  const POPUP_HEIGHT = 30;
  // 10px below row N's own bottom edge, i.e. inside row N+1's box and inside row N's popup.
  const PROBE_OFFSET = ROW_HEIGHT + 10;

  /** A row that owns a focusable control plus an absolutely-positioned overlay (a stand-in for a
   *  menu/tooltip popup) that deliberately overflows down into the following row's box. */
  const renderPopupRow = (item: unknown) => html`
    <button
      id="btn-${item}"
      type="button"
      style="display:block;box-sizing:border-box;margin:0;padding:0;inline-size:100%;block-size:${ROW_HEIGHT}px"
    >
      row ${item}
    </button>
    <div
      id="popup-${item}"
      style="position:absolute;inset-inline-start:0;inset-block-start:${POPUP_TOP}px;inline-size:100%;block-size:${POPUP_HEIGHT}px;background:#123456"
    ></div>
  `;

  async function popupListFixture(): Promise<LyraVirtualList> {
    const el = (await fixture(
      html`<lr-virtual-list
        style="--lr-virtual-list-height:200px"
        row-height=${ROW_HEIGHT}
        .items=${['1', '2', '3', '4']}
        .renderItem=${renderPopupRow}
        .keyFunction=${stringKey}
      ></lr-virtual-list>`,
    )) as LyraVirtualList;
    await el.updateComplete;
    await nextFrame();
    return el;
  }

  /** The id of the top-most element at a point, resolved inside the list's own shadow tree.
   *  Deliberately returns a string, never the node: a failed `expect(node).to.equal(node)` hangs
   *  the whole file under wtr. */
  function topmostIdAt(el: LyraVirtualList, offsetFromListTop: number): string {
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    const rect = base.getBoundingClientRect();
    const hit = el.shadowRoot!.elementFromPoint(rect.left + rect.width / 2, rect.top + offsetFromListTop);
    return hit?.id || (hit as HTMLElement | null)?.getAttribute?.('part') || 'none';
  }

  it("paints a focused row's overflowing popup above the following rows", async () => {
    const el = await popupListFixture();
    // Baseline: nothing focused, so row 2 legitimately paints over row 1's overlay.
    expect(topmostIdAt(el, PROBE_OFFSET)).to.equal('btn-2');

    const firstButton = el.shadowRoot!.querySelector<HTMLButtonElement>('#btn-1')!;
    firstButton.focus();
    expect(el.shadowRoot!.activeElement?.id).to.equal('btn-1');
    await el.updateComplete;

    expect(topmostIdAt(el, PROBE_OFFSET)).to.equal('popup-1');
  });

  it('lifts only the focused row, leaving every other row at the default layer', async () => {
    const el = await popupListFixture();
    const rows = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="row"]')];
    expect(rows.length).to.be.greaterThan(2);
    for (const row of rows) expect(getComputedStyle(row).zIndex).to.equal('auto');

    el.shadowRoot!.querySelector<HTMLButtonElement>('#btn-1')!.focus();
    await el.updateComplete;

    expect(getComputedStyle(rows[0]).zIndex).to.equal('1');
    for (const row of rows.slice(1)) expect(getComputedStyle(row).zIndex).to.equal('auto');
  });

  it('puts a focused row on the same layer as a group header, not above or below it', async () => {
    const el = (await fixture(
      html`<lr-virtual-list
        style="--lr-virtual-list-height:200px"
        row-height=${ROW_HEIGHT}
        .items=${['1', '2', '3', '4']}
        .renderItem=${renderPopupRow}
        .keyFunction=${stringKey}
        .groups=${[{ key: 'g', label: 'Group', startIndex: 0 }]}
      ></lr-virtual-list>`,
    )) as LyraVirtualList;
    await el.updateComplete;
    await nextFrame();

    el.shadowRoot!.querySelector<HTMLButtonElement>('#btn-1')!.focus();
    await el.updateComplete;

    const group = el.shadowRoot!.querySelector<HTMLElement>('[part="group"]')!;
    const focusedRow = el.shadowRoot!.querySelector<HTMLElement>('[part="row"]')!;
    expect(getComputedStyle(focusedRow).zIndex).to.equal(getComputedStyle(group).zIndex);
  });
});

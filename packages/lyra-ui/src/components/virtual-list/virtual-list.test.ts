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
      html`<lyra-virtual-list
        style="--lyra-virtual-list-height:200px"
        row-height="40"
        .items=${[1, 2, 3]}
        .renderItem=${renderText}
        .keyFunction=${numberKey}
      ></lyra-virtual-list>`,
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
    html`<lyra-virtual-list
      .items=${[]}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lyra-virtual-list>`,
  )) as LyraVirtualList;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('is accessible with a populated, windowed item list', async () => {
  const items = Array.from({ length: 200 }, (_, i) => i);
  const el = (await fixture(
    html`<lyra-virtual-list
      style="--lyra-virtual-list-height:200px"
      row-height="40"
      .items=${items}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lyra-virtual-list>`,
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();
  await expect(el).to.be.accessible();
});

it('renders only a small window of DOM rows for a large items array, not every item', async () => {
  const items = Array.from({ length: 2000 }, (_, i) => i);
  const el = (await fixture(
    html`<lyra-virtual-list
      style="--lyra-virtual-list-height:200px"
      .items=${items}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lyra-virtual-list>`,
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
      html`<lyra-virtual-list
        style="--lyra-virtual-list-height:200px"
        row-height="40"
        overscan=${testCase.value}
        .items=${items}
        .renderItem=${renderText}
        .keyFunction=${numberKey}
      ></lyra-virtual-list>`,
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
    html`<lyra-virtual-list
      style="--lyra-virtual-list-height:200px"
      row-height="40"
      .items=${items}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lyra-virtual-list>`,
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
    html`<lyra-virtual-list
      style="--lyra-virtual-list-height:200px"
      row-height="40"
      overscan="0"
      .items=${items}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lyra-virtual-list>`,
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
    html`<lyra-virtual-list
      style="--lyra-virtual-list-height:120px"
      row-height="40"
      overscan="0"
      .items=${items}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lyra-virtual-list>`,
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
    html`<lyra-virtual-list
      style="--lyra-virtual-list-height:200px"
      row-height="40"
      .items=${['a', 'b', 'c']}
      .renderItem=${renderText}
    ></lyra-virtual-list>`,
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();
  const rows = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="row"]')];
  expect(rows.map((r) => r.dataset.rowKey)).to.deep.equal(['number:0', 'number:1', 'number:2']);
});

it("measures each row's real height via ResizeObserver in row-height='auto' mode instead of only using the fallback estimate", async () => {
  const tallRender = () => html`<div style="block-size:100px;box-sizing:border-box;">row</div>`;
  const items = Array.from({ length: 5 }, (_, i) => i);
  const el = (await fixture(
    html`<lyra-virtual-list
      style="--lyra-virtual-list-height:600px"
      .items=${items}
      .renderItem=${tallRender}
      .keyFunction=${numberKey}
    ></lyra-virtual-list>`,
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
    html`<lyra-virtual-list
      style="--lyra-virtual-list-height:200px"
      row-height="40"
      active-id="b"
      .items=${['a', 'b', 'c']}
      .renderItem=${renderText}
      .keyFunction=${stringKey}
    ></lyra-virtual-list>`,
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
    html`<lyra-virtual-list
      style="--lyra-virtual-list-height:200px"
      row-height="40"
      .activeId=${40}
      .items=${items}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lyra-virtual-list>`,
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
      html`<lyra-virtual-list
        style="--lyra-virtual-list-height:200px"
        row-height="40"
        overscan="0"
        .items=${items}
        .renderItem=${renderText}
        .keyFunction=${numberKey}
      ></lyra-virtual-list>`,
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
      html`<lyra-virtual-list
        aria-label="Recent activity"
        .items=${[1, 2, 3]}
        .renderItem=${renderText}
        .keyFunction=${numberKey}
      ></lyra-virtual-list>`,
    )) as LyraVirtualList;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Recent activity');
  });

  it('has no aria-label on the internal element when the host has none', async () => {
    const el = (await fixture(
      html`<lyra-virtual-list
        .items=${[1, 2, 3]}
        .renderItem=${renderText}
        .keyFunction=${numberKey}
      ></lyra-virtual-list>`,
    )) as LyraVirtualList;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.hasAttribute('aria-label')).to.be.false;
  });
});

it('scrollToIndex scrolls a fixed-row-height list to the requested row, honoring align', async () => {
  const items = Array.from({ length: 50 }, (_, i) => i);
  const el = (await fixture(
    html`<lyra-virtual-list
      style="--lyra-virtual-list-height:200px"
      row-height="40"
      overscan="0"
      .items=${items}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lyra-virtual-list>`,
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
    html`<lyra-virtual-list
      style="--lyra-virtual-list-height:200px"
      row-height="40"
      overscan="0"
      .items=${items}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lyra-virtual-list>`,
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
    html`<lyra-virtual-list
      style="--lyra-virtual-list-height:200px"
      row-height="40"
      .items=${items}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lyra-virtual-list>`,
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();
  expect(() => el.scrollToIndex(999, { behavior: 'auto' })).to.not.throw();
  expect(() => el.scrollToIndex(-5, { behavior: 'auto' })).to.not.throw();
});

it('scrollToIndex is a no-op against an empty items array', async () => {
  const el = (await fixture(
    html`<lyra-virtual-list
      style="--lyra-virtual-list-height:200px"
      .items=${[]}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lyra-virtual-list>`,
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
      html`<lyra-virtual-list
        style="--lyra-virtual-list-height:200px"
        row-height="40"
        overscan="0"
        .items=${items}
        .renderItem=${renderText}
        .keyFunction=${numberKey}
      ></lyra-virtual-list>`,
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
    html`<lyra-virtual-list
      style="--lyra-virtual-list-height:200px"
      overscan="0"
      .items=${items}
      .renderItem=${tallRender}
      .keyFunction=${numberKey}
    ></lyra-virtual-list>`,
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

it('emits lyra-visible-range-changed once the container is measured after mount', async () => {
  const el = document.createElement('lyra-virtual-list') as LyraVirtualList;
  el.setAttribute('style', '--lyra-virtual-list-height:200px');
  el.setAttribute('row-height', '40');
  el.items = Array.from({ length: 30 }, (_, i) => i);
  el.renderItem = renderText;
  el.keyFunction = numberKey;

  const eventPromise = oneEvent(el, 'lyra-visible-range-changed');
  document.body.appendChild(el);
  const ev = await eventPromise;
  expect(ev.detail.start).to.equal(0);
  expect(ev.detail.end).to.be.greaterThan(0);
  el.remove();
});

it('coalesces rapid scroll events into a single visible-range recompute per animation frame', async () => {
  const items = Array.from({ length: 100 }, (_, i) => i);
  const el = (await fixture(
    html`<lyra-virtual-list
      style="--lyra-virtual-list-height:200px"
      row-height="40"
      overscan="0"
      .items=${items}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lyra-virtual-list>`,
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();

  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  let count = 0;
  el.addEventListener('lyra-visible-range-changed', () => count++);

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

it('fires lyra-load-more once when scrolling near the bottom while has-more is true and loading is false', async () => {
  const items = Array.from({ length: 20 }, (_, i) => i);
  const el = (await fixture(
    html`<lyra-virtual-list
      style="--lyra-virtual-list-height:200px"
      row-height="40"
      has-more
      .items=${items}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lyra-virtual-list>`,
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();

  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const eventPromise = oneEvent(el, 'lyra-load-more');
  base.scrollTop = base.scrollHeight; // jump to the bottom
  base.dispatchEvent(new Event('scroll'));
  await eventPromise; // resolves iff lyra-load-more fires
});

it('does not refire lyra-load-more while already loading, and re-arms after scrolling away and back', async () => {
  const items = Array.from({ length: 20 }, (_, i) => i);
  const el = (await fixture(
    html`<lyra-virtual-list
      style="--lyra-virtual-list-height:200px"
      row-height="40"
      has-more
      .items=${items}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lyra-virtual-list>`,
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();

  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  let count = 0;
  el.addEventListener('lyra-load-more', () => count++);

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

it('never fires lyra-load-more when has-more is false', async () => {
  const items = Array.from({ length: 20 }, (_, i) => i);
  const el = (await fixture(
    html`<lyra-virtual-list
      style="--lyra-virtual-list-height:200px"
      row-height="40"
      .items=${items}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lyra-virtual-list>`,
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();

  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  let fired = false;
  el.addEventListener('lyra-load-more', () => (fired = true));

  base.scrollTop = base.scrollHeight;
  base.dispatchEvent(new Event('scroll'));
  await aTimeout(100);
  expect(fired).to.be.false;
});

it('reflects loading via the loading attribute and aria-busy on the scroll container', async () => {
  const el = (await fixture(
    html`<lyra-virtual-list
      loading
      .items=${[]}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lyra-virtual-list>`,
  )) as LyraVirtualList;
  await el.updateComplete;
  expect(el.hasAttribute('loading')).to.be.true;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('aria-busy')).to.equal('true');
});

it('falls back to auto (measured) mode when row-height is neither "auto" nor a valid positive number', async () => {
  const items = Array.from({ length: 5 }, (_, i) => i);
  const el = (await fixture(
    html`<lyra-virtual-list
      style="--lyra-virtual-list-height:200px"
      row-height="not-a-number"
      .items=${items}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lyra-virtual-list>`,
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

it('does not rebuild the offsets array on a pure scroll-position update in row-height="auto" mode', async () => {
  const items = Array.from({ length: 300 }, (_, i) => i);
  const el = (await fixture(
    html`<lyra-virtual-list
      style="--lyra-virtual-list-height:200px"
      .items=${items}
      .renderItem=${renderText}
      .keyFunction=${numberKey}
    ></lyra-virtual-list>`,
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
    html`<lyra-virtual-list
      style="--lyra-virtual-list-height:600px"
      .items=${items}
      .renderItem=${resizableRender}
      .keyFunction=${numberKey}
    ></lyra-virtual-list>`,
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
    html`<lyra-virtual-list
      style="--lyra-virtual-list-height:200px"
      .items=${['a', 'b', 'c']}
      .renderItem=${renderText}
      .keyFunction=${stringKey}
    ></lyra-virtual-list>`,
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
    html`<lyra-virtual-list
      style="--lyra-virtual-list-height:200px"
      row-height="auto"
      .items=${items}
      .renderItem=${renderText}
      .keyFunction=${(item: unknown) => item as string | number}
      .activeId=${1}
    ></lyra-virtual-list>`,
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
    html`<lyra-virtual-list
      style="--lyra-virtual-list-height:200px"
      row-height="40"
      .items=${['a', 'b', 'c']}
      .groups=${[
        { key: 'first', label: 'First', startIndex: 0 },
        { key: 'second', label: 'Second', startIndex: 2 },
        { key: 'invalid', startIndex: 99 },
      ]}
      .renderItem=${renderText}
    ></lyra-virtual-list>`,
  )) as LyraVirtualList;
  await el.updateComplete;
  await nextFrame();
  const groups = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="group"]')];
  expect(groups.map((group) => group.textContent?.trim())).to.deep.equal(['First', 'Second']);
  expect(groups[1].style.transform).to.equal('translateY(80px)');
});

describe('itemRole / rowIndexOffset', () => {
  it('defaults to listitem/list roles (unchanged from today)', async () => {
    const el = (await fixture(html`<lyra-virtual-list style="height:100px"></lyra-virtual-list>`)) as LyraVirtualList;
    el.items = ['a', 'b'];
    el.renderItem = (item: unknown) => html`<span>${item}</span>`;
    await el.updateComplete;
    await aTimeout(0);
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('role')).to.equal('list');
    expect(el.shadowRoot!.querySelector('[part="row"]')!.getAttribute('role')).to.equal('listitem');
  });

  it('maps to table roles when item-role="row"', async () => {
    const el = (await fixture(
      html`<lyra-virtual-list style="height:100px" item-role="row" row-index-offset="1"></lyra-virtual-list>`,
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
      html`<lyra-virtual-list style="height:100px" item-role="row"></lyra-virtual-list>`,
    )) as LyraVirtualList;
    el.items = ['a'];
    el.renderItem = (item: unknown) => html`<span>${item}</span>`;
    await el.updateComplete;
    await aTimeout(0);
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('tabindex')).to.equal('0');
  });

  it('resize-driven row observation still works in row mode (data-row-index, not aria-posinset)', async () => {
    const el = (await fixture(
      html`<lyra-virtual-list style="height:60px" item-role="row" row-height="auto"></lyra-virtual-list>`,
    )) as LyraVirtualList;
    el.items = ['a', 'b', 'c'];
    el.renderItem = (item: unknown) => html`<span>${item}</span>`;
    await el.updateComplete;
    await aTimeout(50); // allow ResizeObserver to report real row heights and trigger a re-render
    expect(el.shadowRoot!.querySelectorAll('[part="row"]').length).to.be.greaterThan(0);
  });
});

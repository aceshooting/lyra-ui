import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import './table.js';
import '../../forms/select/select.js';
import type { LyraTable, TableColumn } from './table.js';
import { styles } from './table.styles.js';
import { hoverUntilMatched, resetMouse } from '../../../../test/wtr-mouse.js';
import { readScrollbarWidth } from '../../../../test/scrollbar-reporting.js';
// Registers the real shipped `ar` catalog's `data` slice so the `lang="ar-EG"` resize-value
// test below (which only overrides `resizeValuePixels`) can render without tripping the
// dev-mode locale-fallback warning that strict-console platform lanes treat as fatal.
import '../../../translations/ar/data.js';
import { installTableTestHooks, type Row, columns, rows, forcedWidthHeaderCell, priorityColumns, watchPriorityChurn, nextPriorityFrame } from '../../../../test/table.js';
installTableTestHooks();




it('retains content-driven rows until a theme or table minimum is supplied and respects inherited density', async () => {
  const densityResponse = await fetch(new URL('../../../density.css', import.meta.url));
  expect(densityResponse.ok).to.equal(true);
  const wrapper = await fixture<HTMLElement>(html`
    <div>
      <style>${await densityResponse.text()}</style>
      <section data-lr-density="comfortable">
        <lr-table aria-label="Rows" .columns=${columns} .rows=${rows}></lr-table>
      </section>
    </div>
  `);
  const scope = wrapper.querySelector<HTMLElement>('section')!;
  const element = scope.querySelector<LyraTable<Row>>('lr-table')!;
  await element.updateComplete;
  const row = element.shadowRoot!.querySelector<HTMLElement>('[part="row"]')!;
  const header = element.shadowRoot!.querySelector<HTMLElement>('[part="head"] > tr')!;
  const baseline = row.getBoundingClientRect().height;
  scope.style.setProperty('--lr-theme-table-row-height', '80px');
  expect(row.getBoundingClientRect().height).to.be.at.least(80);
  expect(header.getBoundingClientRect().height).to.be.at.least(80);
  scope.setAttribute('data-lr-density', 'compact');
  expect(row.getBoundingClientRect().height).to.be.closeTo(68, 1);
  element.style.setProperty('--lr-table-row-height', '72px');
  expect(row.getBoundingClientRect().height).to.be.closeTo(72, 1);
  element.style.removeProperty('--lr-table-row-height');
  scope.style.removeProperty('--lr-theme-table-row-height');
  scope.setAttribute('data-lr-density', 'comfortable');
  expect(row.getBoundingClientRect().height).to.be.closeTo(baseline, 0.1);
});

it('reads the theme-level scrollbar hook on the base scrollport, defaulting to auto', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const computed = getComputedStyle(base);
  expect(readScrollbarWidth(base, '[part="base"]')).to.equal('auto');
  expect(computed.scrollbarGutter).to.equal('auto');
});

it('lets a --lr-theme-scrollbar-width/-gutter ancestor override retune the base scrollport', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div style="--lr-theme-scrollbar-width: thin; --lr-theme-scrollbar-gutter: stable">
      <lr-table></lr-table>
    </div>
  `);
  const el = wrapper.querySelector('lr-table') as LyraTable<Row>;
  el.columns = columns;
  el.rows = rows;
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const computed = getComputedStyle(base);
  expect(readScrollbarWidth(base, '[part="base"]')).to.equal('thin');
  expect(computed.scrollbarGutter).to.equal('stable');
});

it('renders [part="reveal-columns-button"] only when at least one column declares a priority and a priority column is actually hidden', async () => {
  const el = (await fixture(html`<lr-table style="display: block; width: 300px;"></lr-table>`)) as LyraTable<Row>;
  el.columns = columns; // no priority columns
  el.rows = rows;
  await el.updateComplete;
  expect((el.shadowRoot!.querySelector('[part="reveal-columns-button"]')) == null).to.be.true;

  el.columns = priorityColumns;
  await el.updateComplete;
  // hasHiddenPriorityColumns is measured from the DOM inside updated(), one render cycle
  // after the columns change lands — wait for that settled state rather than
  // assuming a single updateComplete covers the resulting cascaded update.
  await waitUntil(() => el.shadowRoot!.querySelector('[part="reveal-columns-button"]') !== null);
  expect(el.shadowRoot!.querySelector('[part="reveal-columns-button"]')).to.exist;
});

it('hides low- and medium-priority columns in a narrow container, and reveals them via the toggle button', async () => {
  const el = (await fixture(html`<lr-table style="display: block; width: 300px;"></lr-table>`)) as LyraTable<Row>;
  el.columns = priorityColumns;
  el.rows = rows;
  await el.updateComplete;
  await waitUntil(() => el.hasHiddenPriorityColumns === true);

  const lowHeader = el.shadowRoot!.querySelector('[part="header-cell"][data-priority="low"]') as HTMLElement;
  const mediumHeader = el.shadowRoot!.querySelector('[part="header-cell"][data-priority="medium"]') as HTMLElement;
  const lowCell = el.shadowRoot!.querySelector('[part="cell"][data-priority="low"]') as HTMLElement;
  expect(lowHeader != null).to.equal(true);
  expect(mediumHeader != null).to.equal(true);
  expect(getComputedStyle(lowHeader).display).to.equal('none');
  expect(getComputedStyle(mediumHeader).display).to.equal('none');
  expect(getComputedStyle(lowCell).display).to.equal('none');

  const revealButton = el.shadowRoot!.querySelector('[part="reveal-columns-button"]') as HTMLElement;
  expect(revealButton.getAttribute('aria-pressed')).to.equal('false');
  revealButton.click();
  await el.updateComplete;

  expect(revealButton.getAttribute('aria-pressed')).to.equal('true');
  expect(getComputedStyle(lowHeader).display).to.not.equal('none');
  expect(getComputedStyle(mediumHeader).display).to.not.equal('none');
  expect(getComputedStyle(lowCell).display).to.not.equal('none');

  // Toggling back re-hides them.
  revealButton.click();
  await el.updateComplete;
  expect(getComputedStyle(lowHeader).display).to.equal('none');
});

it('hides only the low-priority column (not medium) in a mid-width container', async () => {
  const el = (await fixture(html`<lr-table style="display: block; width: 700px;"></lr-table>`)) as LyraTable<Row>;
  el.columns = priorityColumns;
  el.rows = rows;
  await el.updateComplete;
  await waitUntil(() => el.hasHiddenPriorityColumns === true);

  const lowHeader = el.shadowRoot!.querySelector('[part="header-cell"][data-priority="low"]') as HTMLElement;
  const mediumHeader = el.shadowRoot!.querySelector('[part="header-cell"][data-priority="medium"]') as HTMLElement;
  expect(getComputedStyle(lowHeader).display).to.equal('none');
  expect(getComputedStyle(mediumHeader).display).to.not.equal('none');
});

it('hides the lowest-priority column in a WIDE container once its content actually overflows -- not at a fixed width', async () => {
  // 1000px is wider than 15.0.0's old fixed 899.98px "low" breakpoint, which would never have
  // hidden anything at this width regardless of content. A `low` column forced far wider than the
  // container proves this is driven by real measured overflow, not any surviving width threshold.
  const wideOverflowColumns: TableColumn<Row>[] = [
    { key: 'name', label: 'Name', cell: (r) => r.name },
    { key: 'id', label: 'Id', priority: 'low', headerCell: forcedWidthHeaderCell(1200, 'Id'), cell: (r) => r.id },
  ];
  const el = (await fixture(html`<lr-table style="display: block; width: 1000px;"></lr-table>`)) as LyraTable<Row>;
  el.columns = wideOverflowColumns;
  el.rows = rows;
  await el.updateComplete;
  await waitUntil(() => el.hasHiddenPriorityColumns === true);

  const lowHeader = el.shadowRoot!.querySelector('[part="header-cell"][data-priority="low"]') as HTMLElement;
  expect(getComputedStyle(lowHeader).display).to.equal('none');
});

it('does not hide a priority column in a NARROW container when the content actually fits -- not at a fixed width', async () => {
  // 300px is narrower than 15.0.0's old fixed 639.98px "medium" breakpoint (and its 899.98px "low"
  // one), which would have hidden both tiers at this width regardless of content. Genuinely short,
  // unforced content that fits comfortably proves nothing hides just because the container is
  // narrow.
  const shortContentColumns: TableColumn<Row>[] = [
    { key: 'name', label: 'Name', cell: (r) => r.name },
    { key: 'score', label: 'Score', align: 'end', priority: 'medium', cell: (r) => r.score },
    { key: 'id', label: 'Id', priority: 'low', cell: (r) => r.id },
  ];
  const el = (await fixture(html`<lr-table style="display: block; width: 300px;"></lr-table>`)) as LyraTable<Row>;
  el.columns = shortContentColumns;
  el.rows = rows;
  await el.updateComplete;
  // No "becomes true" state to poll for here (the claim is that nothing ever changes), so
  // explicitly let a couple of the ResizeObserver-driven layout passes this component schedules
  // settle first -- mirrors the reconnect-settle pattern used elsewhere in this file for the same
  // ResizeObserver.
  const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await nextFrame();
  await nextFrame();
  await nextFrame();

  const lowHeader = el.shadowRoot!.querySelector('[part="header-cell"][data-priority="low"]') as HTMLElement;
  const mediumHeader = el.shadowRoot!.querySelector('[part="header-cell"][data-priority="medium"]') as HTMLElement;
  expect(getComputedStyle(lowHeader).display).to.not.equal('none');
  expect(getComputedStyle(mediumHeader).display).to.not.equal('none');
  expect(el.hasHiddenPriorityColumns).to.be.false;
  expect((el.shadowRoot!.querySelector('[part="reveal-columns-button"]')) == null).to.be.true;
});

it('settles into a stable hidden state across repeated layout passes, without oscillating', async () => {
  // Guards against the read+write measure/layout pass thrashing: hiding a column changes the very
  // geometry (`[part='base']`'s/`[part='table']`'s own size) the ResizeObserver this mechanism
  // shares with syncAutoScrollMode() watches, so a wrong reconstruction of "the fully-visible width"
  // would flip the decision back and forth forever instead of reaching a fixed point.
  const el = (await fixture(html`<lr-table style="display: block; width: 300px;"></lr-table>`)) as LyraTable<Row>;
  el.columns = priorityColumns;
  el.rows = rows;
  await el.updateComplete;
  await waitUntil(() => el.hasHiddenPriorityColumns === true);

  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const lowHeader = el.shadowRoot!.querySelector('[part="header-cell"][data-priority="low"]') as HTMLElement;
  const mediumHeader = el.shadowRoot!.querySelector('[part="header-cell"][data-priority="medium"]') as HTMLElement;
  expect(base.hasAttribute('data-hide-priority-low')).to.be.true;
  expect(base.hasAttribute('data-hide-priority-medium')).to.be.true;

  const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  for (let i = 0; i < 6; i++) {
    await nextFrame();
    expect(base.hasAttribute('data-hide-priority-low')).to.be.true;
    expect(base.hasAttribute('data-hide-priority-medium')).to.be.true;
    expect(getComputedStyle(lowHeader).display).to.equal('none');
    expect(getComputedStyle(mediumHeader).display).to.equal('none');
  }
});

for (const extraColumn of ['expansion', 'total', 'both'] as const) {
  for (const loading of [false, true]) {
    it(`includes ${extraColumn} column widths when priority columns hide${loading ? ' during skeleton loading' : ''}`, async () => {
      const el = await fixture<LyraTable<Row>>(html`<lr-table
        style="inline-size: 100px"
        scroll-mode="auto"
        priority-columns-visible
        .columns=${[
          { key: 'name', label: 'Name', headerCell: forcedWidthHeaderCell(200, 'Name'), cell: (row: Row) => row.name },
          { key: 'score', label: 'Score', priority: 'low', headerCell: forcedWidthHeaderCell(200, 'Score'), cell: (row: Row) => row.score },
        ] satisfies TableColumn<Row>[]}
        .rows=${rows}
        .expandedContent=${extraColumn !== 'total' ? (row: Row) => html`<p>${row.name}</p>` : undefined}
        .rowTotal=${extraColumn !== 'expansion' ? (row: Row) => row.score : undefined}
        .loading=${loading}
        loading-appearance="skeleton"
      ></lr-table>`);
      const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
      const structuralWidth = [...el.shadowRoot!.querySelectorAll<HTMLElement>('thead th:not([data-col-key])')]
        .reduce((sum, header) => sum + header.getBoundingClientRect().width, 0);
      expect(structuralWidth).to.be.greaterThan(4);
      // The data columns alone fit, but the complete grid does not. Derive the boundary from
      // rendered geometry so font metrics and expansion-control sizes can vary by engine/theme.
      const borderWidth = el.getBoundingClientRect().width - base.clientWidth;
      el.style.inlineSize = `${base.scrollWidth - structuralWidth / 2 + borderWidth}px`;
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      expect(base.scrollWidth - base.clientWidth).to.be.greaterThan(1);

      // A broken implementation can starve timers with a hide/reveal microtask loop. Detach only
      // after excessive attribute changes so the regression fails instead of wedging the runner.
      let mutations = 0;
      const observer = new MutationObserver((records) => {
        mutations += records.length;
        if (mutations > 16) el.remove();
      });
      observer.observe(base, { attributes: true, attributeFilter: ['data-hide-priority-low'] });
      try {
        el.priorityColumnsVisible = false;
        for (let frame = 0; frame < 6; frame++) {
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          expect(el.isConnected, 'priority hiding must settle without a render loop').to.be.true;
          expect(el.hasHiddenPriorityColumns).to.be.true;
          const low = el.shadowRoot!.querySelector<HTMLElement>('th[data-priority="low"]')!;
          expect(getComputedStyle(low).display).to.equal('none');
        }
        el.style.inlineSize = '1000px';
        await waitUntil(() => !el.hasHiddenPriorityColumns, 'columns did not return after widening');
        expect(mutations).to.be.at.most(2);
      } finally {
        observer.disconnect();
      }
    });
  }
}

it('settles under layout="fixed" when priority header content spills out of its fixed column share', async () => {
  // `table-layout: fixed` sizes every column from the allocation, not from its content, so these
  // 300px/350px headers spill out of an even ~100px share instead of widening their columns. The
  // table's own box then always matches the container, and a reconstruction of the fully-visible
  // width from those shares re-admits the very columns that just overflowed.
  const el = await fixture<LyraTable<Row>>(
    html`<lr-table layout="fixed" style="display: block; inline-size: 300px;"></lr-table>`
  );
  const churn = watchPriorityChurn(el);
  try {
    el.columns = priorityColumns;
    el.rows = rows;
    for (let frame = 0; frame < 6; frame++) {
      await nextPriorityFrame();
      expect(el.isConnected, 'priority hiding must settle without a hide/reveal loop').to.be.true;
    }
    const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    const low = el.shadowRoot!.querySelector<HTMLElement>('th[data-priority="low"]')!;
    expect(el.hasHiddenPriorityColumns).to.be.true;
    expect(getComputedStyle(low).display).to.equal('none');
    const settled = churn.count();
    const settledMedium = base.hasAttribute('data-hide-priority-medium');
    for (let frame = 0; frame < 6; frame++) {
      await nextPriorityFrame();
      expect(churn.count(), 'the settled decision must not flip on later layout passes').to.equal(settled);
      expect(base.hasAttribute('data-hide-priority-low')).to.be.true;
      expect(base.hasAttribute('data-hide-priority-medium')).to.equal(settledMedium);
    }

    // A real allocation change is still honored in both directions.
    el.style.inlineSize = '2400px';
    await waitUntil(() => !el.hasHiddenPriorityColumns, 'priority columns did not return after widening');
    for (const header of el.shadowRoot!.querySelectorAll<HTMLElement>('th[data-priority]')) {
      expect(getComputedStyle(header).display).to.not.equal('none');
    }
    el.style.inlineSize = '300px';
    await waitUntil(() => el.hasHiddenPriorityColumns, 'priority columns did not hide again after narrowing');
    for (let frame = 0; frame < 3; frame++) {
      await nextPriorityFrame();
      expect(el.isConnected, 'narrowing again must settle without a hide/reveal loop').to.be.true;
    }
    expect(getComputedStyle(low).display).to.equal('none');
  } finally {
    churn.disconnect();
  }
});

it('settles when revealing a priority column shrinks the table allocation itself', async () => {
  // Models a page scrollbar that only appears while every column renders: the host is narrower
  // while nothing is hidden than while a tier is. The full set overflows the narrower allocation,
  // so the only stable answer is to keep the tier hidden rather than re-admit it each time hiding
  // it hands the room back.
  const wrapper = await fixture(html`<div>
    <style>
      .shrinks-on-reveal {
        display: block;
        inline-size: var(--revealed-inline-size);
      }
      .shrinks-on-reveal[has-hidden-priority-columns] {
        inline-size: var(--hidden-inline-size);
      }
    </style>
    <lr-table
      class="shrinks-on-reveal"
      priority-columns-visible
      style="--revealed-inline-size: 100px; --hidden-inline-size: 100px"
      .columns=${[
        { key: 'name', label: 'Name', headerCell: forcedWidthHeaderCell(200, 'Name'), cell: (row: Row) => row.name },
        { key: 'id', label: 'Id', priority: 'low', headerCell: forcedWidthHeaderCell(200, 'Id'), cell: (row: Row) => row.id },
      ] satisfies TableColumn<Row>[]}
      .rows=${rows}
    ></lr-table>
  </div>`);
  const el = wrapper.querySelector('lr-table') as LyraTable<Row>;
  await el.updateComplete;
  await nextPriorityFrame();
  const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  // Derived from rendered geometry so font metrics and borders can vary by engine.
  const fullWidth = base.scrollWidth;
  const borderWidth = el.getBoundingClientRect().width - base.clientWidth;
  el.style.setProperty('--revealed-inline-size', `${fullWidth - 12 + borderWidth}px`);
  el.style.setProperty('--hidden-inline-size', `${fullWidth + 12 + borderWidth}px`);
  await nextPriorityFrame();

  const churn = watchPriorityChurn(el);
  try {
    el.priorityColumnsVisible = false;
    for (let frame = 0; frame < 6; frame++) {
      await nextPriorityFrame();
      expect(el.isConnected, 'priority hiding must settle without a hide/reveal loop').to.be.true;
    }
    expect(el.hasHiddenPriorityColumns).to.be.true;
    const settled = churn.count();
    for (let frame = 0; frame < 4; frame++) {
      await nextPriorityFrame();
      expect(churn.count(), 'the settled decision must not flip on later layout passes').to.equal(settled);
    }
    const low = el.shadowRoot!.querySelector<HTMLElement>('th[data-priority="low"]')!;
    expect(getComputedStyle(low).display).to.equal('none');

    // Once the allocation genuinely grows past both sizes, the column returns.
    el.style.setProperty('--hidden-inline-size', '1200px');
    el.style.setProperty('--revealed-inline-size', '1200px');
    await waitUntil(() => !el.hasHiddenPriorityColumns, 'the column did not return after widening');
    expect(getComputedStyle(low).display).to.not.equal('none');
  } finally {
    churn.disconnect();
  }
});

it('keeps hiding and re-admitting declared-width priority columns by their declared widths', async () => {
  // Declared widths already select `table-layout: fixed`, and their column boxes -- unlike an even
  // share -- do not depend on the allocation, so this path must keep its existing thresholds.
  const el = await fixture<LyraTable<Row>>(html`<lr-table style="display: block; inline-size: 500px;"></lr-table>`);
  const churn = watchPriorityChurn(el);
  try {
    el.columns = [
      { key: 'name', label: 'Name', width: '200px', cell: (row) => row.name },
      { key: 'score', label: 'Score', width: '200px', cell: (row) => row.score },
      { key: 'id', label: 'Id', priority: 'low', width: '200px', cell: (row) => row.id },
    ];
    el.rows = rows;
    await waitUntil(() => el.hasHiddenPriorityColumns, 'the low column did not hide in a narrow container');
    const low = el.shadowRoot!.querySelector<HTMLElement>('th[data-priority="low"]')!;
    expect(getComputedStyle(low).display).to.equal('none');
    for (let frame = 0; frame < 4; frame++) {
      await nextPriorityFrame();
      expect(el.isConnected).to.be.true;
      expect(el.hasHiddenPriorityColumns).to.be.true;
    }

    el.style.inlineSize = '800px';
    await waitUntil(() => !el.hasHiddenPriorityColumns, 'the low column did not return after widening');
    expect(getComputedStyle(low).display).to.not.equal('none');

    el.style.inlineSize = '500px';
    await waitUntil(() => el.hasHiddenPriorityColumns, 'the low column did not hide again after narrowing');
    expect(churn.count()).to.equal(3);
  } finally {
    churn.disconnect();
  }
});

it('never hides a column with no priority declared', async () => {
  const el = (await fixture(html`<lr-table style="display: block; width: 300px;"></lr-table>`)) as LyraTable<Row>;
  el.columns = priorityColumns;
  el.rows = rows;
  await el.updateComplete;
  // Waits for the settled, genuinely-hidden state (both priority tiers overflow at 300px, per
  // `priorityColumns`' forced widths) so this actually exercises "hidden columns coexist with an
  // always-visible one", not just "nothing has been measured yet".
  await waitUntil(() => el.hasHiddenPriorityColumns === true);
  const nameHeader = el.shadowRoot!.querySelector('[part="header-cell"]') as HTMLElement;
  expect(nameHeader.hasAttribute('data-priority')).to.be.false;
  expect(getComputedStyle(nameHeader).display).to.not.equal('none');
});

it('does not render [part="reveal-columns-button"] when a wide container has no hidden priority column', async () => {
  const el = (await fixture(html`<lr-table style="display: block; width: 1000px;"></lr-table>`)) as LyraTable<Row>;
  el.columns = priorityColumns;
  el.rows = rows;
  await el.updateComplete;

  const lowHeader = el.shadowRoot!.querySelector('[part="header-cell"][data-priority="low"]') as HTMLElement;
  expect(getComputedStyle(lowHeader).display).to.not.equal('none');
  expect((el.shadowRoot!.querySelector('[part="reveal-columns-button"]')) == null).to.be.true;
  expect(el.hasHiddenPriorityColumns).to.be.false;
  expect(el.hasAttribute('has-hidden-priority-columns')).to.be.false;
});

it('renders [part="reveal-columns-button"] and sets hasHiddenPriorityColumns when a priority column is hidden', async () => {
  const el = (await fixture(html`<lr-table style="display: block; width: 300px;"></lr-table>`)) as LyraTable<Row>;
  el.columns = priorityColumns;
  el.rows = rows;
  await el.updateComplete;
  // The real hidden-state is measured (offsetParent) after render, in
  // updated() — self-corrects a frame later than the initial paint, mirroring
  // lite-chart.ts's plotWidth/plotHeight ResizeObserver settle pattern, so
  // poll for the settled state instead of assuming a single updateComplete
  // covers the resulting cascaded update.
  await waitUntil(() => el.hasHiddenPriorityColumns === true);

  expect(el.shadowRoot!.querySelector('[part="reveal-columns-button"]')).to.exist;
  expect(el.hasAttribute('has-hidden-priority-columns')).to.be.true;
});

it('priorityColumnsVisible is a public, reflected property that stays in sync with the reveal button', async () => {
  const el = (await fixture(html`<lr-table style="display: block; width: 300px;"></lr-table>`)) as LyraTable<Row>;
  el.columns = priorityColumns;
  el.rows = rows;
  await el.updateComplete;
  await waitUntil(() => el.hasHiddenPriorityColumns === true);

  expect(el.priorityColumnsVisible).to.be.false;
  expect(el.hasAttribute('priority-columns-visible')).to.be.false;

  const revealButton = el.shadowRoot!.querySelector('[part="reveal-columns-button"]') as HTMLElement;
  revealButton.click();
  await el.updateComplete;
  expect(el.priorityColumnsVisible).to.be.true;
  expect(el.hasAttribute('priority-columns-visible')).to.be.true;

  revealButton.click();
  await el.updateComplete;
  expect(el.priorityColumnsVisible).to.be.false;
  expect(el.hasAttribute('priority-columns-visible')).to.be.false;
});

it('emits lr-priority-columns-visibility-change with the new state whenever the reveal button is toggled', async () => {
  const el = (await fixture(html`<lr-table style="display: block; width: 300px;"></lr-table>`)) as LyraTable<Row>;
  el.columns = priorityColumns;
  el.rows = rows;
  await el.updateComplete;
  await waitUntil(() => el.hasHiddenPriorityColumns === true);

  const events: boolean[] = [];
  el.addEventListener('lr-priority-columns-visibility-change', (e) =>
    events.push((e as CustomEvent).detail.visible)
  );
  const revealButton = el.shadowRoot!.querySelector('[part="reveal-columns-button"]') as HTMLElement;
  revealButton.click();
  await el.updateComplete;
  revealButton.click();
  await el.updateComplete;

  expect(events).to.deep.equal([true, false]);
});

it('restores a priorityColumnsVisible preference from the initial property/attribute', async () => {
  const el = (await fixture(
    html`<lr-table style="display: block; width: 300px;" priority-columns-visible></lr-table>`
  )) as LyraTable<Row>;
  el.columns = priorityColumns;
  el.rows = rows;
  await el.updateComplete;

  expect(el.priorityColumnsVisible).to.be.true;
  const lowHeader = el.shadowRoot!.querySelector('[part="header-cell"][data-priority="low"]') as HTMLElement;
  expect(getComputedStyle(lowHeader).display).to.not.equal('none');

  await waitUntil(() => el.shadowRoot!.querySelector('[part="reveal-columns-button"]') !== null);
  const revealButton = el.shadowRoot!.querySelector('[part="reveal-columns-button"]') as HTMLElement;
  expect(revealButton.getAttribute('aria-pressed')).to.equal('true');
});

it('persists and restores priorityColumnsVisible via storage-key', async () => {
  const key = `lr-test-table-${Math.random()}`;
  const fullKey = `lr-table:${key}`;
  localStorage.removeItem(fullKey);
  try {
    const el = await fixture<LyraTable<Row>>(html`<lr-table storage-key=${key}></lr-table>`);
    // The first `updated()` pass only flips the `persistReady` gate; the write happens on the
    // *next* pass. Set the property, then wait until the value has actually landed in storage
    // before remounting -- asserting the write flushed removes any dependence on update timing
    // (this test previously never reached its body under strict console, so the race was hidden).
    el.priorityColumnsVisible = true;
    await el.updateComplete;
    await waitUntil(() => localStorage.getItem(fullKey) !== null, 'priorityColumnsVisible was never persisted');
    el.remove();

    const restored = await fixture<LyraTable<Row>>(html`<lr-table storage-key=${key}></lr-table>`);
    expect(restored.priorityColumnsVisible).to.be.true;
  } finally {
    localStorage.removeItem(fullKey);
  }
});

it('never renders [part="reveal-columns-button"] without priority columns', async () => {
  const el = (await fixture(html`<lr-table style="display: block; width: 300px;"></lr-table>`)) as LyraTable<Row>;
  el.columns = columns; // no priority columns
  el.rows = rows;
  await el.updateComplete;

  expect((el.shadowRoot!.querySelector('[part="reveal-columns-button"]')) == null).to.be.true;
  expect(el.hasHiddenPriorityColumns).to.be.false;
});

it("gives a sticky column's header and cell the sticky positioning attribute and styles", async () => {
  const stickyColumns: TableColumn<Row>[] = [
    { key: 'name', label: 'Name', sticky: 'start', cell: (r) => r.name },
    { key: 'score', label: 'Score', align: 'end', cell: (r) => r.score },
  ];
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = stickyColumns;
  el.rows = rows;
  await el.updateComplete;

  const stickyHeader = el.shadowRoot!.querySelector('[part="header-cell"]') as HTMLElement;
  const stickyCell = el.shadowRoot!.querySelector('[part="cell"]') as HTMLElement;
  const nonStickyHeader = el.shadowRoot!.querySelectorAll('[part="header-cell"]')[1] as HTMLElement;

  expect(stickyHeader.hasAttribute('data-sticky')).to.be.true;
  expect(stickyCell.hasAttribute('data-sticky')).to.be.true;
  expect(nonStickyHeader.hasAttribute('data-sticky')).to.be.false;

  expect(getComputedStyle(stickyHeader).position).to.equal('sticky');
  expect(getComputedStyle(stickyCell).position).to.equal('sticky');
  expect(getComputedStyle(stickyCell).insetInlineStart).to.equal('0px');
  expect(getComputedStyle(stickyCell).boxShadow).to.not.equal('none');
});

it('fails closed for the removed boolean sticky form', async () => {
  const stickyColumns = [
    { key: 'name', label: 'Name', sticky: true, cell: (r: Row) => r.name } as unknown as TableColumn<Row>,
  ];
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = stickyColumns;
  el.rows = rows;
  await el.updateComplete;
  const stickyHeader = el.shadowRoot!.querySelector('[part="header-cell"]') as HTMLElement;
  expect(stickyHeader.hasAttribute('data-sticky')).to.equal(false);
});

it("pins a sticky: 'end' column's header and cell to the inline-end edge instead of inline-start", async () => {
  const stickyEndColumns: TableColumn<Row>[] = [
    { key: 'name', label: 'Name', cell: (r) => r.name },
    {
      key: 'score',
      label: 'Score',
      align: 'end',
      sticky: 'end',
      cell: (r) => r.score,
    },
  ];
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = stickyEndColumns;
  el.rows = rows;
  await el.updateComplete;

  const stickyHeader = el.shadowRoot!.querySelectorAll('[part="header-cell"]')[1] as HTMLElement;
  const stickyCell = el.shadowRoot!.querySelectorAll('[part="cell"]')[1] as HTMLElement;

  expect(stickyHeader.getAttribute('data-sticky')).to.equal('end');
  expect(getComputedStyle(stickyHeader).position).to.equal('sticky');
  expect(getComputedStyle(stickyCell).insetInlineEnd).to.equal('0px');
});

it('keeps a sticky header/cell at the plain surface background when no row state applies (unstyled regression)', async () => {
  const stickyColumns: TableColumn<Row>[] = [
    { key: 'name', label: 'Name', sticky: 'start', cell: (r) => r.name },
    { key: 'score', label: 'Score', align: 'end', cell: (r) => r.score },
  ];
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = stickyColumns;
  el.rows = rows;
  await el.updateComplete;

  // rows[1] ('b') is the second rendered row, so it never receives the internal stripe marker
  // (entryIndex % 2 === 0 only), and selection/hover are untouched -- a genuinely plain row.
  const plainRow = el.shadowRoot!.querySelectorAll('[part="row"]')[1] as HTMLElement;
  expect(plainRow.hasAttribute('data-stripe')).to.be.false;
  const stickyCell = plainRow.querySelector('[part="cell"][data-sticky]') as HTMLElement;
  const stickyHeader = el.shadowRoot!.querySelector('[part="header-cell"][data-sticky]') as HTMLElement;
  // The non-sticky header cell still declares the unconditional plain background this library
  // shipped before the fix, so it is a stable, independent reference for "unchanged".
  const plainHeader = el.shadowRoot!.querySelectorAll('[part="header-cell"]')[1] as HTMLElement;
  const surfaceBg = getComputedStyle(plainHeader).backgroundColor;

  expect(getComputedStyle(stickyHeader).backgroundColor).to.equal(surfaceBg);
  expect(getComputedStyle(stickyCell).backgroundColor).to.equal(surfaceBg);
});

it("gives a sticky cell in a striped row the row's stripe background instead of the flat surface color", async () => {
  const stickyColumns: TableColumn<Row>[] = [
    { key: 'name', label: 'Name', sticky: 'start', cell: (r) => r.name },
    { key: 'score', label: 'Score', align: 'end', cell: (r) => r.score },
  ];
  const el = (await fixture(
    html`<lr-table style="--lr-table-row-stripe-bg: rgb(9, 9, 9);"></lr-table>`,
  )) as LyraTable<Row>;
  el.columns = stickyColumns;
  el.rows = rows;
  await el.updateComplete;

  // rows[0] ('a') is the first rendered row, which carries the internal stripe marker.
  const stripedRow = el.shadowRoot!.querySelectorAll('[part="row"]')[0] as HTMLElement;
  expect(stripedRow.hasAttribute('data-stripe')).to.be.true;
  const stickyCell = stripedRow.querySelector('[part="cell"][data-sticky]') as HTMLElement;

  expect(getComputedStyle(stripedRow).backgroundColor).to.equal('rgb(9, 9, 9)');
  expect(getComputedStyle(stickyCell).backgroundColor).to.equal('rgb(9, 9, 9)');
});

it("gives a sticky cell in a hovered row the row's hover background instead of the flat surface color", async () => {
  const stickyColumns: TableColumn<Row>[] = [
    { key: 'name', label: 'Name', sticky: 'start', cell: (r) => r.name },
    { key: 'score', label: 'Score', align: 'end', cell: (r) => r.score },
  ];
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = stickyColumns;
  el.rows = rows;
  await el.updateComplete;

  const plainRow = el.shadowRoot!.querySelectorAll('[part="row"]')[1] as HTMLElement;
  const stickyCell = plainRow.querySelector('[part="cell"][data-sticky]') as HTMLElement;
  const before = getComputedStyle(stickyCell).backgroundColor;

  try {
    // `hoverUntilMatched` re-reads the rect and re-dispatches until `:hover` matches the cell: a
    // single move resolves before the engine has necessarily processed the pointer event, and a
    // late layout settle can slide the sticky cell out from under the dispatched position.
    await hoverUntilMatched(stickyCell, 'the sticky cell never took the pointer');
    await waitUntil(
      () => getComputedStyle(stickyCell).backgroundColor !== before,
      'hovered sticky cell never picked up the row hover background',
    );
    expect(getComputedStyle(stickyCell).backgroundColor).to.equal(getComputedStyle(plainRow).backgroundColor);
  } finally {
    await resetMouse();
  }
});

it('honors an override of --lr-table-cell-padding-compact on group-cell/footer-cell independently of --lr-table-cell-padding, preserving the tighter block/inline shorthand by default (unset-regression)', async () => {
  const columnsWithFooter: TableColumn<Row>[] = [
    { key: 'name', label: 'Name', cell: (r) => r.name, footer: () => 'Total' },
    { key: 'score', label: 'Score', align: 'end', cell: (r) => r.score },
  ];
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = columnsWithFooter;
  el.rows = rows;
  el.groupBy = (r) => (r.score > 2 ? 'Passing' : 'Needs review');
  await el.updateComplete;

  const groupCell = el.shadowRoot!.querySelector('[part="group-cell"]') as HTMLElement;
  const footerCell = el.shadowRoot!.querySelector('[part="footer-cell"]') as HTMLElement;
  const bodyCell = el.shadowRoot!.querySelector('[part="cell"]') as HTMLElement;

  // Default (unset): still the historical two-value shorthand -- tighter block spacing than
  // inline, and identical between the two parts that share the hook.
  expect(getComputedStyle(groupCell).paddingTop).to.equal(getComputedStyle(footerCell).paddingTop);
  expect(getComputedStyle(groupCell).paddingLeft).to.equal(getComputedStyle(footerCell).paddingLeft);
  expect(getComputedStyle(groupCell).paddingTop).to.not.equal(getComputedStyle(groupCell).paddingLeft);

  el.style.setProperty('--lr-table-cell-padding-compact', '3px 7px');
  await el.updateComplete;

  for (const target of [groupCell, footerCell]) {
    expect(getComputedStyle(target).paddingTop).to.equal('3px');
    expect(getComputedStyle(target).paddingLeft).to.equal('7px');
  }
  // Unaffected: the ordinary body cell reads --lr-table-cell-padding, a separate hook.
  expect(getComputedStyle(bodyCell).paddingTop).to.not.equal('3px');
});

it('stops observing removed sticky headers when sticky columns are replaced', async () => {
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = [
    { key: 'name', label: 'Name', sticky: 'start', cell: (r) => r.name },
    { key: 'score', label: 'Score', sticky: 'start', cell: (r) => r.score },
  ];
  el.rows = rows;
  await el.updateComplete;
  el.columns = columns;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('th[data-col-key]').length).to.equal(2);
});

it('offsets a second sticky column past the first instead of overlapping at inset 0', async () => {
  const stickyColumns: TableColumn<Row>[] = [
    { key: 'name', label: 'Name', sticky: 'start', cell: (r) => r.name },
    { key: 'score', label: 'Score', sticky: 'start', cell: (r) => r.score },
  ];
  const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
  el.columns = stickyColumns;
  el.rows = rows;
  await el.updateComplete;
  const cells = el.shadowRoot!.querySelectorAll('[part="header-cell"][data-sticky]');
  const first = getComputedStyle(cells[0]!).insetInlineStart;
  const second = getComputedStyle(cells[1]!).insetInlineStart;
  expect(first).to.not.equal(second);
});

it('does not trigger a Lit "scheduled an update after an update completed" dev warning when a priority column transitions to actually-hidden', async () => {
  // Reset Lit's own dedupe set first so this doesn't silently pass just
  // because an earlier test in this file (or another file in the same
  // browser session) already tripped -- and thus suppressed -- the exact
  // same warning string. Same guard chip-group.test.ts's/toast-item.test.ts's
  // equivalent tests use.
  const globalWarnings = (globalThis as { litIssuedWarnings?: Set<string> }).litIssuedWarnings;
  if (globalWarnings) {
    [...globalWarnings].filter((w) => w.includes('scheduled an update')).forEach((w) => globalWarnings.delete(w));
  }

  const originalWarn = console.warn;
  const calls: unknown[][] = [];
  console.warn = (...args: unknown[]) => calls.push(args);
  try {
    const el = (await fixture(html`<lr-table style="display: block; width: 300px;"></lr-table>`)) as LyraTable<Row>;
    el.columns = priorityColumns;
    el.rows = rows;
    await el.updateComplete;
    // recomputeColumnsHidden() runs a frame after the initial paint (see the
    // sibling hidden-priority tests above) -- wait for the settled state so the
    // synchronous-mutation-inside-updated() warning (if any) has had a chance
    // to fire before asserting on it.
    await waitUntil(() => el.hasHiddenPriorityColumns === true);
  } finally {
    console.warn = originalWarn;
  }

  const messages = calls.flat().map(String);
  expect(messages.some((m) => m.includes('scheduled an update'))).to.be.false;
});

describe('footer column hook', () => {
  it('renders a real tfoot when any column has a footer hook', async () => {
    const withFooter: TableColumn<Row>[] = [
      ...columns,
      {
        key: 'total',
        label: 'Total',
        footer: (rs) => rs.reduce((sum, r) => sum + r.score, 0),
        cell: () => '',
      },
    ];
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = withFooter;
    el.rows = rows;
    await el.updateComplete;
    const foot = el.shadowRoot!.querySelector('tfoot[part="foot"]');
    expect(foot != null).to.equal(true);
    const footerCells = [...foot!.querySelectorAll('[part="footer-cell"]')];
    expect(footerCells).to.have.length(withFooter.length);
    expect(footerCells[footerCells.length - 1]!.textContent!.trim()).to.equal('4');
  });

  it('renders no tfoot when no column has a footer hook (unchanged default)', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('tfoot') == null).to.equal(true);
  });
});

describe('cellStyle column hook', () => {
  it('applies cellStyle to the generated td via styleMap', async () => {
    const withStyle: TableColumn<Row>[] = [
      {
        key: 'name',
        label: 'Name',
        cell: (r) => r.name,
        cellStyle: (r) => ({ background: r.score > 2 ? 'red' : 'blue' }),
      },
    ];
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = withStyle;
    el.rows = rows;
    await el.updateComplete;
    const cells = [...el.shadowRoot!.querySelectorAll('[part="cell"]')] as HTMLElement[];
    expect(cells[0]!.style.background).to.equal('red'); // Alpha, score 3
    expect(cells[1]!.style.background).to.equal('blue'); // Beta, score 1
  });

  it('coexists with sticky-column offset styling without clobbering it', async () => {
    const withBoth: TableColumn<Row>[] = [
      {
        key: 'name',
        label: 'Name',
        sticky: 'start',
        cellStyle: () => ({ background: 'green' }),
        cell: (r) => r.name,
      },
    ];
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = withBoth;
    el.rows = rows;
    await el.updateComplete;
    const cell = el.shadowRoot!.querySelector('[part="cell"]') as HTMLElement;
    expect(cell.style.background).to.equal('green');
    expect(cell.style.getPropertyValue('--lr-table-sticky-offset')).to.not.equal('');
  });

  it('drops non-string runtime cellStyle values before assigning inline styles', async () => {
    const withMalformedStyle: TableColumn<Row>[] = [
      {
        key: 'name',
        label: 'Name',
        cell: (row) => row.name,
        // TypeScript callers receive Record<string, string>, but JavaScript consumers can still
        // pass arbitrary runtime values. The generated native style must never coerce one.
        cellStyle: () => ({ color: 123 } as unknown as Record<string, string>),
      },
    ];
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = withMalformedStyle;
    el.rows = rows;
    await el.updateComplete;

    const cell = el.shadowRoot!.querySelector<HTMLElement>('[part="cell"]')!;
    expect(cell.style.color).to.equal('');
  });

  for (const [property, value] of [
    ['background', '\\75 rl(https://example.test/x.png)'],
    ['backgroundImage', 'image-set("https://example.test/x.png" 1x)'],
    ['--note', '\\75 rl(https://example.test/x.png)'],
    ['--note', 'teal /* note */'],
    ['--note', 'calc(1px'],
  ] as const) {
    it(`drops the cellStyle declaration ${property}: ${value}`, async () => {
      const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
      el.columns = [
        { key: 'name', label: 'Name', cell: (r) => r.name, cellStyle: () => ({ [property]: value, color: 'rgb(1, 2, 3)' }) },
      ];
      el.rows = rows;
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector<HTMLElement>('[part="cell"]')!.style.cssText).to.equal('color: rgb(1, 2, 3);');
    });
  }

  it('keeps safe cell styles when the host browser has no CSS validation API', async () => {
    const originalCss = Object.getOwnPropertyDescriptor(window, 'CSS');
    try {
      for (const cssApi of [undefined, {}]) {
        Object.defineProperty(window, 'CSS', { configurable: true, value: cssApi });
        const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
        el.columns = [
          {
            key: 'name',
            label: 'Name',
            cell: (row) => row.name,
            cellStyle: () => ({ color: 'rgb(1, 2, 3)' }),
          },
        ];
        el.rows = rows;
        await el.updateComplete;

        const cell = el.shadowRoot!.querySelector<HTMLElement>('[part="cell"]')!;
        expect(cell.style.color).to.equal('rgb(1, 2, 3)');
      }
    } finally {
      if (originalCss) Object.defineProperty(window, 'CSS', originalCss);
      else Reflect.deleteProperty(window, 'CSS');
    }
  });
});

describe('headerCell', () => {
  it('renders col.label by default when headerCell is unset', async () => {
    const columns: TableColumn<{ id: number }>[] = [{ key: 'id', label: 'ID', cell: (row) => row.id }];
    const el = (await fixture(html`<lr-table .columns=${columns} .rows=${[{ id: 1 }]}></lr-table>`)) as LyraTable;
    const th = el.shadowRoot!.querySelector('th[data-col-key="id"]')!;
    expect(th.textContent).to.contain('ID');
  });

  it('renders headerCell(column) instead of the plain label when set', async () => {
    const columns: TableColumn<{ id: number }>[] = [
      {
        key: 'id',
        label: 'ID',
        headerCell: (col) => html`<strong class="custom">${col.label}!</strong>`,
        cell: (row) => row.id,
      },
    ];
    const el = (await fixture(html`<lr-table .columns=${columns} .rows=${[{ id: 1 }]}></lr-table>`)) as LyraTable;
    const th = el.shadowRoot!.querySelector('th[data-col-key="id"]')!;
    expect(th.querySelector('.custom')).to.exist;
    expect(th.textContent).to.contain('ID!');
  });
});

describe('column width', () => {
  it('does not set table-layout: fixed when no column defines width', async () => {
    const columns: TableColumn<{ id: number }>[] = [{ key: 'id', label: 'ID', cell: (row) => row.id }];
    const el = (await fixture(html`<lr-table .columns=${columns} .rows=${[{ id: 1 }]}></lr-table>`)) as LyraTable;
    const table = el.shadowRoot!.querySelector('[part="table"]') as HTMLElement;
    expect(getComputedStyle(table).tableLayout).to.equal('auto');
  });

  it('sets table-layout: fixed and applies <col> widths when a column defines width', async () => {
    const columns: TableColumn<{ id: number }>[] = [
      { key: 'id', label: 'ID', width: '120px', cell: (row) => row.id },
      { key: 'name', label: 'Name', cell: () => 'x' },
    ];
    const el = (await fixture(html`<lr-table .columns=${columns} .rows=${[{ id: 1 }]}></lr-table>`)) as LyraTable;
    const table = el.shadowRoot!.querySelector('[part="table"]') as HTMLElement;
    expect(getComputedStyle(table).tableLayout).to.equal('fixed');
    const cols = el.shadowRoot!.querySelectorAll('colgroup col');
    expect(cols).to.have.lengthOf(2);
    expect((cols[0] as HTMLElement).style.getPropertyValue('inline-size')).to.equal('120px');
  });

  it('drops a priority-hidden column\'s <col> with its cells, so later columns keep their own widths', async () => {
    const el = await fixture<LyraTable<Row>>(html`<lr-table style="display: block; inline-size: 400px;"></lr-table>`);
    el.columns = [
      { key: 'name', label: 'Name', width: '200px', cell: (r) => r.name },
      { key: 'id', label: 'Id', width: '300px', priority: 'low', cell: (r) => r.id },
      { key: 'score', label: 'Score', width: '250px', cell: (r) => r.score },
    ];
    el.rows = rows;
    await waitUntil(() => el.hasHiddenPriorityColumns);
    const width = (selector: string) => el.shadowRoot!.querySelector<HTMLElement>(selector)!.getBoundingClientRect().width;
    expect(width('th[data-col-key="name"]')).to.be.closeTo(200, 2);
    expect(width('th[data-col-key="score"]')).to.be.closeTo(250, 2);
    expect(width('[part="table"]')).to.be.closeTo(450, 2);

    el.priorityColumnsVisible = true;
    await el.updateComplete;
    expect(width('th[data-col-key="id"]')).to.be.closeTo(300, 2);
    expect(width('[part="table"]')).to.be.closeTo(750, 2);
  });

  it('keeps the medium tier visible once the declared widths left after hiding the low tier fit', async () => {
    const el = await fixture<LyraTable<Row>>(html`<lr-table style="display: block; inline-size: 600px;"></lr-table>`);
    el.columns = [
      { key: 'name', label: 'Name', width: '200px', cell: (r) => r.name },
      { key: 'id', label: 'Id', width: '300px', priority: 'low', cell: (r) => r.id },
      { key: 'score', label: 'Score', width: '250px', cell: (r) => r.score },
      { key: 'rank', label: 'Rank', width: '120px', priority: 'medium', cell: (r) => r.score },
    ];
    el.rows = rows;
    await waitUntil(() => el.hasHiddenPriorityColumns);
    for (let frame = 0; frame < 4; frame++) await nextPriorityFrame();
    const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    expect(base.hasAttribute('data-hide-priority-low')).to.be.true;
    expect(base.hasAttribute('data-hide-priority-medium')).to.be.false;
  });
});

describe('heat-tint mode', () => {
  const heatColumns: TableColumn<Row>[] = [
    { key: 'name', label: 'Name', cell: (r) => r.name },
    {
      key: 'score',
      label: 'Score',
      align: 'end',
      heatValue: (r) => r.score,
      cell: (r) => r.score,
    },
  ];

  it('renders no data-heat cells when no column defines heatValue (unchanged default)', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[data-heat]').length).to.equal(0);
  });

  it('does not add a style attribute to a plain cell with no cellStyle and no heatValue (regression: styleMap({}) previously left a stray style="")', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;
    const cells = [...el.shadowRoot!.querySelectorAll('[part="cell"]')] as HTMLElement[];
    expect(cells.length).to.be.greaterThan(0);
    expect(cells.every((c) => !c.hasAttribute('style'))).to.be.true;
  });

  it('sanitizes user-supplied cellStyle entries before styleMap assignment', async () => {
    const sanitizedColumns: TableColumn<Row>[] = [
      { key: 'name', label: 'Name', cell: (r) => r.name },
      {
        key: 'score',
        label: 'Score',
        cell: (r) => r.score,
        cellStyle: () => ({
          background: 'rgb(1, 2, 3)',
          color: 'url(javascript:alert(1))',
          border: '1px;position:fixed',
          'background-image': 'url(javascript:alert(1))',
          'font-size': '16px',
          '--lr-table-cell-note': 'teal',
          '--lr-table;bad': 'should-drop',
        }),
      },
    ];
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = sanitizedColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;
    const cell = el.shadowRoot!.querySelector('[part="cell"][data-col-key="score"]') as HTMLElement;
    expect(cell.style.backgroundColor).to.equal('rgb(1, 2, 3)');
    expect(cell.style.fontSize).to.equal('16px');
    expect(cell.style.color).to.equal('');
    expect(cell.style.border).to.equal('');
    // Not necessarily '': setting the `background` shorthand alongside a rejected
    // `background-image` makes engines serialize the untouched longhand differently -- Chromium
    // reports the literal CSS-wide keyword "initial", Firefox reports the resolved initial value
    // "none". Either is proof the injected url() never reached the declaration; assert on that
    // instead of a specific engine's serialization choice.
    expect(cell.style.backgroundImage).to.not.include('url(');
    expect(cell.style.getPropertyValue('--lr-table-cell-note')).to.equal('teal');
    expect(cell.style.getPropertyValue('--lr-table;bad')).to.equal('');
  });

  it('computes --lr-table-heat-t from the auto-derived min/max across all heatValue columns', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = heatColumns;
    el.rows = rows; // Alpha score 3, Beta score 1 -> auto domain [1, 3]
    el.rowKey = (r) => r.id;
    await el.updateComplete;
    const scoreCells = [...el.shadowRoot!.querySelectorAll('[part="cell"][data-col-key="score"]')] as HTMLElement[];
    expect(scoreCells.length).to.equal(2);
    expect(scoreCells[0]!.style.getPropertyValue('--lr-table-heat-t')).to.equal('100.00%'); // Alpha: (3-1)/(3-1)
    expect(scoreCells[1]!.style.getPropertyValue('--lr-table-heat-t')).to.equal('0.00%'); // Beta: (1-1)/2
    expect(scoreCells.every((c) => c.hasAttribute('data-heat'))).to.be.true;
    const nameCells = [...el.shadowRoot!.querySelectorAll('[part="cell"][data-col-key="name"]')] as HTMLElement[];
    expect(nameCells.every((c) => !c.hasAttribute('data-heat'))).to.be.true;
  });

  it('overrides the auto-derived domain with heatTintScale', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = heatColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    el.heatTintScale = { min: 0, max: 10 };
    await el.updateComplete;
    const scoreCells = [...el.shadowRoot!.querySelectorAll('[part="cell"][data-col-key="score"]')] as HTMLElement[];
    expect(scoreCells[0]!.style.getPropertyValue('--lr-table-heat-t')).to.equal('30.00%'); // Alpha: 3/10
    expect(scoreCells[1]!.style.getPropertyValue('--lr-table-heat-t')).to.equal('10.00%'); // Beta: 1/10
  });

  it('keeps full-range finite heat values at the low, midpoint, and high tint stops', async () => {
    const extremeRows = [
      { id: 'low', name: 'Low', score: -Number.MAX_VALUE },
      { id: 'mid', name: 'Mid', score: 0 },
      { id: 'high', name: 'High', score: Number.MAX_VALUE },
    ];
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = heatColumns;
    el.rows = extremeRows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;

    const shares = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="cell"][data-col-key="score"]')].map(
      (cell) => cell.style.getPropertyValue('--lr-table-heat-t')
    );
    expect(shares).to.deep.equal(['0.00%', '50.00%', '100.00%']);
  });

  it('skips tinting a cell whose heatValue returns null (not clamped to 0)', async () => {
    interface RowN {
      id: string;
      name: string;
      score: number | null;
    }
    const nullRows: RowN[] = [
      { id: 'a', name: 'Alpha', score: 3 },
      { id: 'b', name: 'Beta', score: null },
    ];
    const nullCols: TableColumn<RowN>[] = [
      { key: 'name', label: 'Name', cell: (r) => r.name },
      {
        key: 'score',
        label: 'Score',
        heatValue: (r) => r.score,
        cell: (r) => r.score ?? '',
      },
    ];
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<RowN>;
    el.columns = nullCols;
    el.rows = nullRows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;
    const scoreCells = [...el.shadowRoot!.querySelectorAll('[part="cell"][data-col-key="score"]')] as HTMLElement[];
    expect(scoreCells[0]!.hasAttribute('data-heat')).to.be.true;
    expect(scoreCells[1]!.hasAttribute('data-heat')).to.be.false;
  });

  it('declares the heat-tint ramp CSS with retheme-able tokens matching lr-heatmap defaults', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.include('--_lr-table-heat-tint-lo-default: var(--lr-color-brand-quiet);');
    expect(css).to.include('--_lr-table-heat-tint-hi-default: var(--lr-color-brand);');
    expect(css).to.not.include('--lr-table-heat-tint-lo:');
    expect(css).to.not.include('--lr-table-heat-tint-hi:');
    expect(css).to.match(/\[part='cell'\]\[data-heat\]\s*\{[^}]*color-mix\(/);
  });

  it('actually paints the color-mix() background on a rendered heat-tinted cell (not just present in the stylesheet source)', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = heatColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;
    const tintedCell = el.shadowRoot!.querySelector('[part="cell"][data-col-key="score"]') as HTMLElement;
    const untintedCell = el.shadowRoot!.querySelector('[part="cell"][data-col-key="name"]') as HTMLElement;
    // A drifted [part='cell'][data-heat] selector or --lr-table-heat-t/-lo/-hi property name would
    // leave this rendering exactly like the untinted column's own (transparent) background while
    // the cssText-regex test above kept passing -- this proves the rule reaches a live cell.
    expect(tintedCell.hasAttribute('data-heat')).to.be.true;
    const tintedBackground = getComputedStyle(tintedCell).backgroundColor;
    const untintedBackground = getComputedStyle(untintedCell).backgroundColor;
    expect(tintedBackground).to.not.equal(untintedBackground);
    expect(tintedBackground).to.not.equal('rgba(0, 0, 0, 0)');
  });

  it('inherits heat-tint endpoints from an ancestor and paints them on cells', async () => {
    const wrapper = await fixture(html`
      <div style="--lr-table-heat-tint-lo:rgb(1, 2, 3); --lr-table-heat-tint-hi:rgb(1, 2, 3)">
        <lr-table></lr-table>
      </div>
    `);
    const el = wrapper.querySelector('lr-table') as LyraTable<Row>;
    el.columns = heatColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;

    const tintedCell = el.shadowRoot!.querySelector('[part="cell"][data-col-key="score"]') as HTMLElement;
    expect(getComputedStyle(tintedCell).getPropertyValue('--lr-table-heat-tint-lo').trim()).to.equal('rgb(1, 2, 3)');

    const baseline = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    baseline.columns = heatColumns;
    baseline.rows = rows;
    baseline.rowKey = (r) => r.id;
    await baseline.updateComplete;
    const baselineCell = baseline.shadowRoot!.querySelector('[part="cell"][data-col-key="score"]') as HTMLElement;
    expect(getComputedStyle(tintedCell).backgroundColor).to.not.equal(getComputedStyle(baselineCell).backgroundColor);
  });

  it('applies both cellStyle and the heat-tint custom property to the same cell when both are set', async () => {
    const bothColumns: TableColumn<Row>[] = [
      { key: 'name', label: 'Name', cell: (r) => r.name },
      {
        key: 'score',
        label: 'Score',
        heatValue: (r) => r.score,
        cellStyle: () => ({ 'font-style': 'italic' }),
        cell: (r) => r.score,
      },
    ];
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = bothColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;
    const cell = el.shadowRoot!.querySelector('[part="cell"][data-col-key="score"]') as HTMLElement;
    expect(cell.style.fontStyle).to.equal('italic');
    expect(cell.hasAttribute('data-heat')).to.be.true;
    expect(cell.style.getPropertyValue('--lr-table-heat-t')).to.not.equal('');
  });

  it('lets a cellStyle background silently win over the heat-tint background (documents the inline-style-vs-stylesheet-rule precedence)', async () => {
    const conflictColumns: TableColumn<Row>[] = [
      { key: 'name', label: 'Name', cell: (r) => r.name },
      {
        key: 'score',
        label: 'Score',
        heatValue: (r) => r.score,
        cellStyle: () => ({ background: 'rgb(1, 2, 3)' }),
        cell: (r) => r.score,
      },
    ];
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = conflictColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;
    const cell = el.shadowRoot!.querySelector('[part="cell"][data-col-key="score"]') as HTMLElement;
    // The cell is still marked/measured as heat-tinted...
    expect(cell.hasAttribute('data-heat')).to.be.true;
    expect(cell.style.getPropertyValue('--lr-table-heat-t')).to.not.equal('');
    // ...but the actually-rendered background is cellStyle's inline color, not the heat-tint ramp:
    // an inline style= attribute always wins the cascade over table.styles.ts's
    // [part='cell'][data-heat] stylesheet rule regardless of specificity.
    expect(getComputedStyle(cell).backgroundColor).to.equal('rgb(1, 2, 3)');
  });
});

describe('sticky-offset observation across reconnect', () => {
  it('keeps tracking a header resize after the table is detached and re-attached', async () => {
    const stickyColumns: TableColumn<Row>[] = [
      { key: 'name', label: 'Name', sticky: 'start', cell: (r) => r.name },
      { key: 'score', label: 'Score', sticky: 'start', cell: (r) => r.score },
    ];
    const el = (await fixture(html`<lr-table style="inline-size: 600px"></lr-table>`)) as LyraTable<Row>;
    el.columns = stickyColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;

    const headers = () => el.shadowRoot!.querySelectorAll<HTMLElement>('th[data-col-key]');
    await waitUntil(
      () => headers()[1]!.style.getPropertyValue('--lr-table-sticky-offset') !== '',
      'expected an initial sticky offset on the second sticky column'
    );
    const initialOffset = headers()[1]!.style.getPropertyValue('--lr-table-sticky-offset');

    // A pure DOM move never runs the Lit update lifecycle, so only the
    // reconnect path itself can restore the per-header resize observations.
    const parent = el.parentElement!;
    el.remove();
    parent.appendChild(el);
    await el.updateComplete;
    // The reconnect-created ResizeObserver delivers an initial size for every
    // newly-observed element one rendering frame after observe(); let that
    // delivery settle first so the header resize below is only observable
    // through a live per-header observation, not the initial delivery.
    const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await nextFrame();
    await nextFrame();

    const first = headers()[0]!;
    first.style.inlineSize = '100px';
    await waitUntil(
      () => {
        const offset = headers()[1]!.style.getPropertyValue('--lr-table-sticky-offset');
        return offset === `${first.offsetWidth}px` && offset !== initialOffset;
      },
      'expected the second sticky column offset to track the resized first header after reconnect',
      { timeout: 2000 }
    );
  });
});

describe('TableColumn.cellTitle', () => {
  const titledColumns: TableColumn<Row>[] = [
    {
      key: 'name',
      label: 'Name',
      cellTitle: (r) => `Full name: ${r.name}`,
      cell: (r) => r.name,
    },
    { key: 'score', label: 'Score', cell: (r) => r.score },
  ];

  it('renders the native title on the cells of a column that defines cellTitle', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = titledColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;
    const titled = el.shadowRoot!.querySelector('td[data-col-key="name"]')!;
    expect(titled.getAttribute('title')).to.equal('Full name: Alpha');
  });

  it('renders no title attribute at all for a column without cellTitle, or an empty return', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = [
      ...titledColumns,
      { key: 'blank', label: 'Blank', cellTitle: () => '', cell: () => 'x' },
      {
        key: 'undef',
        label: 'Undef',
        cellTitle: () => undefined,
        cell: () => 'x',
      },
    ];
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;
    // An empty `title=""` would suppress an ancestor's tooltip, so it must be absent entirely.
    expect(el.shadowRoot!.querySelector('td[data-col-key="score"]')!.hasAttribute('title')).to.be.false;
    expect(el.shadowRoot!.querySelector('td[data-col-key="blank"]')!.hasAttribute('title')).to.be.false;
    expect(el.shadowRoot!.querySelector('td[data-col-key="undef"]')!.hasAttribute('title')).to.be.false;
  });

  it('suppresses the cell title while that cell is in edit mode', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = [
      {
        key: 'name',
        label: 'Name',
        cellTitle: (r: Row) => `Full name: ${r.name}`,
        cell: (r: Row) => r.name,
        editTrigger: 'double-click',
        editValue: (r: Row) => r.name,
      },
      titledColumns[1]!,
    ];
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;
    const cell = el.shadowRoot!.querySelector('td[data-col-key="name"]') as HTMLElement;
    expect(cell.getAttribute('title')).to.equal('Full name: Alpha');
    cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await el.updateComplete;
    const editing = el.shadowRoot!.querySelector('td[data-col-key="name"]') as HTMLElement;
    expect(editing.querySelector('[part="cell-editor"]'), 'expected the editor to have opened').to.exist;
    expect(editing.hasAttribute('title')).to.be.false;
    // Every other cell in that column keeps its title.
    const others = [...el.shadowRoot!.querySelectorAll('td[data-col-key="name"]')].slice(1);
    expect(others.map((td) => td.getAttribute('title'))).to.deep.equal(['Full name: Beta']);
  });

  it('is accessible with cell titles rendered', async () => {
    const el = (await fixture(html`<lr-table aria-label="Scores"></lr-table>`)) as LyraTable<Row>;
    el.columns = titledColumns;
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('td[data-col-key="name"]')!.hasAttribute('title')).to.be.true;
    await expect(el).to.be.accessible();
  });
});

describe('layout', () => {
  const plainColumns: TableColumn<Row>[] = [
    { key: 'name', label: 'Name', cell: (r) => r.name },
    { key: 'score', label: 'Score', cell: (r) => r.score },
  ];

  it('defaults to auto and reflects the attribute', async () => {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    el.columns = plainColumns;
    el.rows = rows;
    await el.updateComplete;
    expect(el.layout).to.equal('auto');
    expect(el.getAttribute('layout')).to.equal('auto');
    const table = el.shadowRoot!.querySelector('[part="table"]') as HTMLElement;
    expect(table.getAttribute('data-layout')).to.equal('auto');
    expect(getComputedStyle(table).tableLayout).to.equal('auto');
  });

  it('computes table-layout: fixed with layout="fixed" and no column widths', async () => {
    const el = (await fixture(html`<lr-table layout="fixed"></lr-table>`)) as LyraTable<Row>;
    el.columns = plainColumns;
    el.rows = rows;
    await el.updateComplete;
    const table = el.shadowRoot!.querySelector('[part="table"]') as HTMLElement;
    expect(table.getAttribute('data-layout')).to.equal('fixed');
    expect(getComputedStyle(table).tableLayout).to.equal('fixed');
    // `layout` is a floor, not the <colgroup>-carries-real-widths signal.
    expect(table.hasAttribute('data-has-column-widths')).to.be.false;
  });

  it('stays fixed under layout="auto" when a column declares a width', async () => {
    const el = (await fixture(html`<lr-table layout="auto"></lr-table>`)) as LyraTable<Row>;
    el.columns = [{ ...plainColumns[0]!, width: '120px' }, plainColumns[1]!];
    el.rows = rows;
    await el.updateComplete;
    const table = el.shadowRoot!.querySelector('[part="table"]') as HTMLElement;
    expect(table.getAttribute('data-layout')).to.equal('fixed');
    expect(getComputedStyle(table).tableLayout).to.equal('fixed');
  });

  it('stays fixed under layout="auto" through an active drag-resize', async () => {
    const el = (await fixture(html`<lr-table layout="auto"></lr-table>`)) as LyraTable<Row>;
    el.columns = [{ ...plainColumns[0]!, resizable: true }, plainColumns[1]!];
    el.rows = rows;
    el.rowKey = (r) => r.id;
    await el.updateComplete;
    const handle = el.shadowRoot!.querySelector('[part="resize-handle"]') as HTMLElement;
    handle.setPointerCapture = () => {};
    handle.releasePointerCapture = () => {};
    handle.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        pointerId: 7,
        clientX: 100,
      })
    );
    window.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        pointerId: 7,
        clientX: 180,
      })
    );
    await el.updateComplete;
    const table = el.shadowRoot!.querySelector('[part="table"]') as HTMLElement;
    expect(getComputedStyle(table).tableLayout, 'resizing does not work without table-layout: fixed').to.equal('fixed');
    window.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        pointerId: 7,
        clientX: 180,
      })
    );
  });
});

describe('--lr-table-row-stripe-bg', () => {
  it('recolors alternating body rows without affecting the others', async () => {
    const el = (await fixture(html`
      <lr-table style="--lr-table-row-stripe-bg: rgb(10, 20, 30);"></lr-table>
    `)) as LyraTable<Row>;
    el.columns = columns;
    el.rows = [...rows, { id: 'c', name: 'Gamma', score: 2 }];
    el.rowKey = (r) => r.id;
    await el.updateComplete;
    const rowEls = [...el.shadowRoot!.querySelectorAll('[part="row"]')] as HTMLElement[];
    expect(rowEls).to.have.length(3);
    expect(rowEls[0]!.hasAttribute('data-stripe')).to.equal(true);
    expect(rowEls[1]!.hasAttribute('data-stripe')).to.equal(false);
    expect(rowEls[2]!.hasAttribute('data-stripe')).to.equal(true);
    expect(getComputedStyle(rowEls[0]!).backgroundColor).to.equal('rgb(10, 20, 30)');
    expect(getComputedStyle(rowEls[1]!).backgroundColor).to.not.equal('rgb(10, 20, 30)');
    expect(getComputedStyle(rowEls[2]!).backgroundColor).to.equal('rgb(10, 20, 30)');
  });
});

it('rejects a column width that would inject extra declarations into the col element', async () => {
  const el = (await fixture(html`<lr-table aria-label="Scores"></lr-table>`)) as LyraTable<Row>;
  el.columns = [
    {
      key: 'name',
      label: 'Name',
      cell: (r: Row) => r.name,
      width: '10rem;background-image:url(https://example.test/b.png)',
    },
    { key: 'score', label: 'Score', cell: (r: Row) => r.score, width: '8rem' },
  ];
  el.rows = rows;
  await el.updateComplete;
  const cols = [...el.shadowRoot!.querySelectorAll<HTMLElement>('col')];
  expect(cols[0]!.style.backgroundImage, 'no injected paint server').to.equal('');
  expect(cols[0]!.style.getPropertyValue('inline-size').trim(), 'the unsafe width is dropped').to.equal('');
  expect(cols[1]!.style.getPropertyValue('inline-size').trim()).to.equal('8rem');
});

// A column's cell(row) renders its TemplateResult inside this shadow root, so an anchor it returns
// is unreachable from page CSS, and ::part() cannot select past the first compound selector to
// reach it either. Left alone it computes to the UA default link blue.
describe('cell link colour', () => {
  const linked = () =>
    fixture(html`<lr-table></lr-table>`) as Promise<LyraTable<Row>>;

  async function withLinkCell(style = ''): Promise<HTMLAnchorElement> {
    const el = await linked();
    if (style) el.setAttribute('style', style);
    el.columns = [
      { key: 'name', header: 'Name', cell: (row: Row) => html`<a href="#x">${row.name}</a>` },
    ] as unknown as TableColumn<Row>[];
    el.rows = rows;
    await el.updateComplete;
    return el.shadowRoot!.querySelector('[part~="cell"] a') as HTMLAnchorElement;
  }

  it('gives a cell anchor the brand colour rather than the UA default blue', async () => {
    const anchor = await withLinkCell();
    const brand = getComputedStyle(anchor).color;
    expect(brand, 'must not be the UA default link blue').to.not.equal('rgb(0, 0, 238)');
  });

  it('honours --lr-table-cell-link-color', async () => {
    const anchor = await withLinkCell('--lr-table-cell-link-color: rgb(1, 2, 3)');
    expect(getComputedStyle(anchor).color).to.equal('rgb(1, 2, 3)');
  });

  it('honours --lr-table-cell-link-hover-color on hover, overriding --lr-table-cell-link-color', async () => {
    const anchor = await withLinkCell(
      '--lr-table-cell-link-color: rgb(1, 2, 3); --lr-table-cell-link-hover-color: rgb(4, 5, 6)'
    );
    try {
      // A single `sendMouse` move resolves before the engine has necessarily processed the pointer
      // event it synthesized, so the poll below would be waiting on a hover that never arrived.
      await hoverUntilMatched(anchor, 'the link cell never took the pointer');
      await waitUntil(
        () => getComputedStyle(anchor).color === 'rgb(4, 5, 6)',
        'link cell hover colour never landed'
      );
    } finally {
      await resetMouse();
    }
  });

  it('honours --lr-table-cell-color on a plain (non-link) body cell', async () => {
    const el = await linked();
    el.setAttribute('style', '--lr-table-cell-color: rgb(7, 8, 9)');
    el.columns = [{ key: 'name', header: 'Name', cell: (row: Row) => row.name }] as unknown as TableColumn<Row>[];
    el.rows = rows;
    await el.updateComplete;
    const cell = el.shadowRoot!.querySelector('[part~="cell"]') as HTMLElement;
    expect(getComputedStyle(cell).color).to.equal('rgb(7, 8, 9)');
  });

  it('lets an inline style on the returned anchor still win', async () => {
    const el = await linked();
    el.columns = [
      {
        key: 'name',
        header: 'Name',
        cell: (row: Row) => html`<a href="#x" style="color: rgb(9, 9, 9)">${row.name}</a>`,
      },
    ] as unknown as TableColumn<Row>[];
    el.rows = rows;
    await el.updateComplete;
    const anchor = el.shadowRoot!.querySelector('[part~="cell"] a') as HTMLAnchorElement;
    expect(getComputedStyle(anchor).color).to.equal('rgb(9, 9, 9)');
  });
});

// A scroll container clips both axes, so an uncapped `overflow: auto` base is a sticky containing
// block that never scrolls -- the header then scrolls away with the page.
describe('scrollMode', () => {
  async function tableWith(mode?: string): Promise<LyraTable<Row>> {
    const el = (await fixture(html`<lr-table></lr-table>`)) as LyraTable<Row>;
    if (mode) el.setAttribute('scroll-mode', mode);
    el.columns = columns;
    el.rows = rows;
    await el.updateComplete;
    return el;
  }
  const base = (el: LyraTable<Row>) =>
    el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;

  it("defaults to 'self', keeping the base a scroll container", async () => {
    const el = await tableWith();
    expect(el.scrollMode).to.equal('self');
    expect(getComputedStyle(base(el)).overflowY).to.equal('auto');
  });

  it("scroll-mode='page' stops the base being a scroll container", async () => {
    const el = await tableWith('page');
    expect(el.scrollMode).to.equal('page');
    const style = getComputedStyle(base(el));
    expect(style.overflowY, 'a visible overflow leaves the page as the scrollport').to.equal(
      'visible'
    );
    expect(style.maxBlockSize).to.equal('none');
  });

  it("scroll-mode='page' ignores a height cap rather than half-applying it", async () => {
    const el = await tableWith('page');
    el.style.setProperty('--lr-table-max-height', '120px');
    await el.updateComplete;
    expect(getComputedStyle(base(el)).maxBlockSize).to.equal('none');
  });

  const responsiveColumns: TableColumn<Row>[] = [
    { key: 'name', label: 'Long localized account name', cell: (row) => row.name },
    { key: 'score', label: 'Current quality score', cell: (row) => row.score },
    { key: 'id', label: 'Persistent external identifier', cell: (row) => row.id },
  ];

  async function responsiveTable(width: number): Promise<{ wrapper: HTMLElement; el: LyraTable<Row> }> {
    const wrapper = await fixture<HTMLElement>(html`
      <div style=${`inline-size: ${width}px; max-inline-size: 100%;`}>
        <lr-table scroll-mode="auto" aria-label="Accounts"></lr-table>
      </div>
    `);
    const el = wrapper.querySelector('lr-table') as LyraTable<Row>;
    el.columns = responsiveColumns;
    el.rows = rows;
    await el.updateComplete;
    return { wrapper, el };
  }

  it("scroll-mode='auto' keeps page flow at desktop width when rendered content fits", async () => {
    const { wrapper, el } = await responsiveTable(960);
    const scrollport = base(el);
    await waitUntil(() => scrollport.scrollWidth <= scrollport.clientWidth + 1);

    const style = getComputedStyle(scrollport);
    expect(style.overflowX).to.equal('visible');
    expect(style.overflowY).to.equal('visible');
    expect(wrapper.scrollWidth).to.be.at.most(wrapper.clientWidth + 1);
  });

  it("scroll-mode='auto' contains actual horizontal overflow inside a 320px allocation", async () => {
    const { wrapper, el } = await responsiveTable(320);
    const scrollport = base(el);
    await waitUntil(
      () => scrollport.scrollWidth > scrollport.clientWidth && getComputedStyle(scrollport).overflowX === 'auto',
      'the narrow table never became its own horizontal scrollport'
    );

    expect(scrollport.scrollWidth).to.be.greaterThan(scrollport.clientWidth);
    expect(wrapper.scrollWidth).to.be.at.most(wrapper.clientWidth + 1);
  });

  it("scroll-mode='auto' re-evaluates when its allocation moves between desktop and 320px", async () => {
    const { wrapper, el } = await responsiveTable(960);
    const scrollport = base(el);
    await waitUntil(() => getComputedStyle(scrollport).overflowX === 'visible');

    wrapper.style.inlineSize = '320px';
    await waitUntil(
      () => scrollport.scrollWidth > scrollport.clientWidth && getComputedStyle(scrollport).overflowX === 'auto',
      'the resized table never contained its horizontal overflow'
    );
    expect(wrapper.scrollWidth).to.be.at.most(wrapper.clientWidth + 1);

    wrapper.style.inlineSize = '960px';
    await waitUntil(
      () => scrollport.scrollWidth <= scrollport.clientWidth + 1 && getComputedStyle(scrollport).overflowX === 'visible',
      'the table never returned to page flow after its content fit again'
    );
  });

  it("scroll-mode='auto' re-evaluates intrinsic table growth without a host update", async () => {
    const { wrapper, el } = await responsiveTable(960);
    const scrollport = base(el);
    const table = el.shadowRoot!.querySelector('[part="table"]') as HTMLTableElement;
    await waitUntil(() => getComputedStyle(scrollport).overflowX === 'visible');

    table.style.minInlineSize = '1200px';
    await waitUntil(
      () => scrollport.scrollWidth > scrollport.clientWidth && getComputedStyle(scrollport).overflowX === 'auto',
      'intrinsic table growth never activated contained scrolling'
    );
    expect(wrapper.scrollWidth).to.be.at.most(wrapper.clientWidth + 1);

    table.style.removeProperty('min-inline-size');
    await waitUntil(
      () => scrollport.scrollWidth <= scrollport.clientWidth + 1 && getComputedStyle(scrollport).overflowX === 'visible',
      'intrinsic table shrinkage never restored page flow'
    );
  });
});

describe('decorative edges versus control boundaries', () => {
  // Distinct sentinels on the host itself: an inline declaration beats the shadow :host token
  // defaults, so each assertion names which of the two border tokens a surface is wired to. The
  // theme input repeats the control sentinel because the retry button is slotted into a nested
  // lr-empty, whose own :host re-derives --lr-color-border from that input.
  const borderTokens =
    '--lr-theme-color-surface-border: rgb(4, 5, 6); --lr-color-border: rgb(4, 5, 6); --lr-color-border-subtle: rgb(1, 2, 3)';
  const subtle = 'rgb(1, 2, 3)';
  const control = 'rgb(4, 5, 6)';

  it('draws the frame, rules and sticky seams with --lr-color-border-subtle', async () => {
    const stickyColumns: TableColumn<Row>[] = [
      { key: 'name', label: 'Name', sticky: 'start', cell: (r) => r.name },
      { key: 'score', label: 'Score', align: 'end', cell: (r) => r.score },
    ];
    const el = (await fixture(html`<lr-table
      aria-label="People"
      filterable
      has-more
      style=${borderTokens}
    ></lr-table>`)) as LyraTable<Row>;
    el.columns = stickyColumns;
    el.rows = rows;
    await el.updateComplete;

    const part = (name: string): HTMLElement =>
      el.shadowRoot!.querySelector(`[part="${name}"]`) as HTMLElement;
    expect(getComputedStyle(part('base')).borderTopColor, 'frame').to.equal(subtle);
    expect(getComputedStyle(part('filter-label')).borderBottomColor, 'filter rule').to.equal(subtle);
    expect(getComputedStyle(part('header-cell')).borderBottomColor, 'header underline').to.equal(subtle);
    expect(getComputedStyle(part('cell')).borderBottomColor, 'row rule').to.equal(subtle);
    expect(getComputedStyle(part('cell')).boxShadow, 'sticky seam').to.include(subtle);
  });

  it('keeps the only drawn edge of the load-more button on --lr-color-border', async () => {
    const el = (await fixture(html`<lr-table
      aria-label="People"
      has-more
      style=${borderTokens}
      .columns=${columns}
      .rows=${rows}
    ></lr-table>`)) as LyraTable<Row>;
    await el.updateComplete;

    const more = el.shadowRoot!.querySelector('[part="more-button"]') as HTMLElement;
    expect(getComputedStyle(more).borderTopWidth, 'load-more edge width').to.not.equal('0px');
    expect(getComputedStyle(more).borderTopColor, 'load-more edge').to.equal(control);
  });

  it('keeps the filter field and retry button boundaries on --lr-color-border', async () => {
    const el = (await fixture(html`<lr-table
      aria-label="People"
      filterable
      error
      style=${borderTokens}
      .columns=${columns}
      .rows=${rows}
    ></lr-table>`)) as LyraTable<Row>;
    await el.updateComplete;

    const filter = el.shadowRoot!.querySelector('[part="filter"]') as HTMLElement;
    const retry = el.shadowRoot!.querySelector('[part="retry-button"]') as HTMLElement;
    const errorCell = el.shadowRoot!.querySelector('[part="error-cell"]') as HTMLElement;
    expect(getComputedStyle(filter).borderTopColor, 'filter field').to.equal(control);
    expect(getComputedStyle(retry).borderTopColor, 'retry button').to.equal(control);
    expect(getComputedStyle(errorCell).borderBottomColor, 'error row rule').to.equal(subtle);
  });
});

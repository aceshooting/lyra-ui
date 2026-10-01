import { expectLocaleFallback } from '../../../../test/expected-locale-fallbacks.js';
import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
import { hoverUntilMatched, resetMouse, sendMouse, sendWheel } from '../../../../test/wtr-mouse.js';
import './data-grid.js';
import type { LyraDataGrid } from './data-grid.js';
import type { DataGridColumn } from './data-grid-types.js';
import { type Person, columns, rows, dataGrid, measurementAccess, header, dataCells } from '../../../../test/data-grid.js';


expectLocaleFallback('de-DE', ['select']);

it("auto-sizes bounded columns and distributes body width by flex", async () => {
  const sizingColumns: DataGridColumn<Person>[] = [
    { field: "name", label: "Name", minWidth: 80, maxWidth: 150, flex: 1 },
    { field: "team", label: "Team", minWidth: 80, flex: 2 },
  ];
  const element = await dataGrid(html`
    <lr-data-grid
      label="Sized people"
      .columns=${sizingColumns}
      .data=${rows}
    ></lr-data-grid>
  `);
  for (const cell of element.shadowRoot!.querySelectorAll<HTMLElement>(
    '[data-column-id="name"]'
  )) {
    Object.defineProperty(cell, "scrollWidth", {
      configurable: true,
      value: 220,
    });
  }
  element.autoSizeColumn("name");
  expect(element.getState().widths).to.deep.include({ name: 150 });
  element.autoSizeColumn("missing");

  element.resetColumns();
  const body = element.shadowRoot!.querySelector(
    '[part="body"]'
  ) as HTMLElement;
  Object.defineProperty(body, "clientWidth", {
    configurable: true,
    value: 600,
  });
  element.sizeColumnsToFit();
  const widths = element.getState().widths!;
  expect(widths["name"]).to.equal(150);
  expect(widths["team"]).to.equal(400);
  element.autoSizeColumns();
  expect(Object.keys(element.getState().widths!)).to.have.members([
    "name",
    "team",
  ]);
});

it("resolves sizing and virtualization styles through the adopted owner window", async () => {
  const manyRows: Person[] = Array.from({ length: 100 }, (_value, index) => ({
    id: index,
    name: `Owner ${index}`,
    team: "Realm",
    score: index,
  }));
  const sizingColumns: DataGridColumn<Person>[] = [
    { id: "name", field: "name", label: "Name", flex: 1 },
    { id: "team", field: "team", label: "Team", flex: 1 },
  ];
  const element = await dataGrid();
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const frameDocument = frame.contentDocument;
  const frameWindow = frame.contentWindow;
  if (!frameDocument || !frameWindow)
    throw new Error("The iframe realm was unavailable.");

  element.remove();
  frameDocument.adoptNode(element);
  element.columns = sizingColumns;
  element.data = manyRows;
  element.rowKey = "id";
  element.selectable = "multiple";
  element.setState({ pinning: { name: "left", team: "left" } });
  frameDocument.documentElement.style.fontSize = "10px";

  const ambientGetComputedStyle = window.getComputedStyle;
  const ownerGetComputedStyle = frameWindow.getComputedStyle;
  let ambientStyleReads = 0;
  let ownerStyleReads = 0;
  let maxHeight = "200px";
  window.getComputedStyle = (() => {
    ambientStyleReads += 1;
    throw new Error(
      "ambient getComputedStyle must not inspect an adopted data grid"
    );
  }) as typeof window.getComputedStyle;
  frameWindow.getComputedStyle = ((
    target: Element,
    pseudoElement?: string | null
  ) => {
    ownerStyleReads += 1;
    const style = ownerGetComputedStyle.call(
      frameWindow,
      target,
      pseudoElement
    );
    if (target !== element) return style;
    return new Proxy(style, {
      get(cssStyle, property) {
        if (property === "getPropertyValue") {
          return (name: string): string => {
            if (name === "--lr-icon-button-size") return "2rem";
            if (name === "--row-height") return "2rem";
            if (name === "--max-height") return maxHeight;
            if (name === "--lr-size-7rem") return "7rem";
            return cssStyle.getPropertyValue(name);
          };
        }
        const value = Reflect.get(cssStyle, property, cssStyle) as unknown;
        return typeof value === "function" ? value.bind(cssStyle) : value;
      },
    });
  }) as typeof frameWindow.getComputedStyle;

  try {
    frameDocument.body.append(element);
    await element.updateComplete;

    const pinnedTeam = header(element, "team");
    expect(pinnedTeam.style.getPropertyValue("--pin-offset")).to.equal("70px");
    expect(
      element.shadowRoot!.querySelectorAll('[part~="row"][data-visible-index]')
        .length
    ).to.be.lessThan(80);

    const body = element.shadowRoot!.querySelector(
      '[part="body"]'
    ) as HTMLElement;
    Object.defineProperty(body, "clientWidth", {
      configurable: true,
      value: 600,
    });
    Object.defineProperty(body, "clientHeight", {
      configurable: true,
      value: 100,
    });
    let scrollTop = -1;
    Object.defineProperty(body, "scrollTo", {
      configurable: true,
      value: (options: ScrollToOptions) => {
        scrollTop = Number(options.top ?? 0);
      },
    });

    element.sizeColumnsToFit();
    expect(element.getState().widths).to.deep.equal({ name: 290, team: 290 });
    element.scrollToIndex(90, { align: "start" });
    // One-line rows retain the 20px estimate, while a wrapped measured row may legitimately add
    // to a distant target's offset. The lower bound proves the adopted owner's 2rem estimate still
    // participates without pinning variable-height measurement to one engine's line metrics.
    expect(scrollTop).to.be.at.least(1800);

    maxHeight = "none";
    element.requestUpdate();
    await element.updateComplete;
    expect(
      element.shadowRoot!.querySelectorAll('[part~="row"][data-visible-index]')
        .length
    ).to.equal(100);
    expect(ownerStyleReads).to.be.greaterThan(0);
    expect(ambientStyleReads).to.equal(0);

    element.remove();
    const ownerlessDocument =
      frameDocument.implementation.createHTMLDocument("ownerless grid");
    ownerlessDocument.adoptNode(element);
    element.resetColumns();
    expect(() => element.sizeColumnsToFit()).to.not.throw();
    expect(element.getState().widths).to.deep.equal({ name: 300, team: 300 });
    element.resetColumns();
    const internals = element as unknown as {
      readonly resolvedRowHeight: number;
      readonly virtualWindow: { items: unknown[] };
      estimatedColumnWidth(column: DataGridColumn<Person>, id: string): number;
    };
    expect(internals.resolvedRowHeight).to.equal(56);
    expect(internals.estimatedColumnWidth(sizingColumns[0]!, "name")).to.equal(
      112
    );
    expect(() => internals.virtualWindow.items.length).to.not.throw();
    expect(
      ambientStyleReads,
      "an ownerless grid must not borrow the ambient style realm"
    ).to.equal(0);
  } finally {
    element.remove();
    window.getComputedStyle = ambientGetComputedStyle;
    frameWindow.getComputedStyle = ownerGetComputedStyle;
    frame.remove();
  }
});

it("virtualizes 80+ rows, scrolls to an index, and reconciles a dynamic shrink", async () => {
  const manyRows: Person[] = Array.from({ length: 100 }, (_value, index) => ({
    id: index,
    name: `Person ${index}`,
    team: "Virtual",
    score: index,
  }));
  const element = await dataGrid(html`
    <lr-data-grid
      label="Virtual people"
      row-key="id"
      style="--row-height: 40px; --max-height: 200px"
      .columns=${columns}
      .data=${manyRows}
    ></lr-data-grid>
  `);
  const initialCount =
    element.shadowRoot!.querySelectorAll('[part~="row"]').length;
  expect(initialCount).to.be.greaterThan(0);
  expect(initialCount).to.be.lessThan(80);
  await expect(element).to.be.accessible();
  const body = element.shadowRoot!.querySelector(
    '[part="body"]'
  ) as HTMLElement;
  Object.defineProperty(body, "clientHeight", {
    configurable: true,
    value: 200,
  });
  const originalScrollTo = Object.getOwnPropertyDescriptor(body, "scrollTo");
  Object.defineProperty(body, "scrollTo", {
    configurable: true,
    value: (options: ScrollToOptions) => {
      body.scrollTop = Number(options.top ?? 0);
      body.dispatchEvent(new Event("scroll"));
    },
  });
  try {
    element.scrollToIndex(90, { align: "center" });
    await element.updateComplete;
    expect(element.shadowRoot!.textContent).to.contain("Person 90");

    element.data = manyRows.slice(0, 85);
    await element.updateComplete;
    expect(
      element.shadowRoot!.querySelectorAll('[part~="row"]').length
    ).to.be.greaterThan(0);
    expect(element.shadowRoot!.textContent).to.contain("Person 84");

    element.style.setProperty("--max-height", "none");
    element.requestUpdate();
    await element.updateComplete;
    expect(
      element.shadowRoot!.querySelectorAll('[part~="row"]')
    ).to.have.length(85);
  } finally {
    if (originalScrollTo)
      Object.defineProperty(body, "scrollTo", originalScrollTo);
    else Reflect.deleteProperty(body, "scrollTo");
  }
});

it("scrolls a virtualized focus target into the body viewport", async () => {
  const many: Person[] = Array.from({ length: 300 }, (_value, index) => ({
    id: index,
    name: `Person ${index}`,
    team: index % 2 === 0 ? "Compiler" : "Runtime",
    score: index,
  }));
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      style="height: 240px"
      .columns=${columns}
      .data=${many}
    ></lr-data-grid>
  `);
  const body = element.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
  expect(body.scrollTop).to.equal(0);
  const end = new KeyboardEvent("keydown", {
    key: "End",
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  });
  dataCells(element)[0]!.dispatchEvent(end);
  await element.updateComplete;
  expect(end.defaultPrevented).to.equal(true);
  expect(body.scrollTop).to.be.greaterThan(0);
});

it("aligns a programmatic scroll to the start, center, and end of the viewport", async () => {
  const many: Person[] = Array.from({ length: 400 }, (_value, index) => ({
    id: index,
    name: `Person ${index}`,
    team: "Compiler",
    score: index,
  }));
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      style="height: 240px"
      .columns=${columns}
      .data=${many}
    ></lr-data-grid>
  `);
  const body = element.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;

  element.scrollToIndex(300, { align: "end" });
  await element.updateComplete;
  const atEnd = body.scrollTop;
  expect(atEnd).to.be.greaterThan(0);

  element.scrollToIndex(300, { align: "center" });
  await element.updateComplete;
  expect(body.scrollTop).to.be.greaterThan(atEnd);

  element.scrollToIndex(0, { align: "start" });
  await element.updateComplete;
  expect(body.scrollTop).to.equal(0);

  element.scrollToIndex(Number.NaN);
  await element.updateComplete;
  expect(body.scrollTop).to.equal(0);
});

it('keeps ancestor scroll positions when aligning an already-rendered row', async () => {
  const data = Array.from({ length: 100 }, (_, id) => ({ id, name: `Row ${id}` }));
  const wrapper = await fixture<HTMLDivElement>(html`
    <div style="height: 2200px">
      <div style="height: 400px"></div>
      <div id="outer" style="height: 350px; overflow: auto">
        <div style="height: 400px"></div>
        <lr-data-grid
          label="Contained scroll"
          row-key="id"
          style="display: block; inline-size: 500px; --max-height: 180px; --row-height: 40px"
          .columns=${[{ field: 'name', label: 'Name', width: 1000 }]}
          .data=${data}
        ></lr-data-grid>
        <div style="height: 400px"></div>
      </div>
    </div>
  `);
  const outer = wrapper.querySelector<HTMLElement>('#outer')!;
  const element = wrapper.querySelector<LyraDataGrid<(typeof data)[number]>>('lr-data-grid')!;
  const body = element.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
  const initialWindowY = window.scrollY;
  try {
    await waitUntil(() => body.scrollHeight > body.clientHeight && body.scrollWidth > body.clientWidth);
    for (const align of ['start', 'center', 'end', 'nearest'] as const) {
      body.scrollTop = 0;
      body.scrollLeft = 75;
      body.dispatchEvent(new Event('scroll'));
      outer.scrollTop = 250;
      window.scrollTo(0, 250);
      await aTimeout(40);
      const target = element.shadowRoot!.querySelector<HTMLElement>('[part~="row"][data-visible-index="2"]')!;
      expect(target !== null).to.equal(true);
      const targetRect = target.getBoundingClientRect();
      const bodyRect = body.getBoundingClientRect();
      const viewportTop = bodyRect.top + body.clientTop;
      const viewportBottom = viewportTop + body.clientHeight;
      const delta = align === 'start' ? targetRect.top - viewportTop
        : align === 'center' ? (targetRect.top + targetRect.bottom - viewportTop - viewportBottom) / 2
        : align === 'end' ? targetRect.bottom - viewportBottom
        : targetRect.top < viewportTop ? targetRect.top - viewportTop
        : Math.max(0, targetRect.bottom - viewportBottom);
      const expectedTop = Math.max(0, Math.min(body.scrollHeight - body.clientHeight, body.scrollTop + delta));
      const pageBefore = window.scrollY;
      const outerBefore = outer.scrollTop;
      const horizontalBefore = body.scrollLeft;
      if (align === 'nearest') element.scrollToIndex(2);
      else element.scrollToIndex(2, { align });
      await aTimeout(40);
      expect(Math.abs(body.scrollTop - expectedTop), `${align} body alignment`).to.be.at.most(1);
      expect(window.scrollY, `${align} page position`).to.equal(pageBefore);
      expect(outer.scrollTop, `${align} outer position`).to.equal(outerBefore);
      expect(body.scrollLeft, `${align} horizontal position`).to.equal(horizontalBefore);
    }
  } finally {
    window.scrollTo(0, initialWindowY);
  }
});

it('uses native nearest geometry for an oversized rendered row without scrolling ancestors', async () => {
  const data = Array.from({ length: 20 }, (_, id) => ({ id, name: `Row ${id}` }));
  const wrapper = await fixture<HTMLDivElement>(html`
    <div style="height: 2200px">
      <div style="height: 400px"></div>
      <div id="outer" style="height: 350px; overflow: auto">
        <div style="height: 400px"></div>
        <lr-data-grid
          label="Oversized contained scroll"
          row-key="id"
          style="display: block; inline-size: 500px; --max-height: 180px; --row-height: 32px; --cell-padding: 0px"
          .columns=${[{
            field: 'name', label: 'Name',
            formatter: (_value: unknown, row: (typeof data)[number]) => html`
              <span style="display: block; block-size: ${row.id === 2 ? 260 : 32}px">${row.name}</span>
            `,
          }]}
          .data=${data}
        ></lr-data-grid>
        <div style="height: 400px"></div>
      </div>
    </div>
  `);
  const outer = wrapper.querySelector<HTMLElement>('#outer')!;
  const element = wrapper.querySelector<LyraDataGrid<(typeof data)[number]>>('lr-data-grid')!;
  const body = element.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
  const initialWindowY = window.scrollY;
  const target = element.shadowRoot!.querySelector<HTMLElement>('[part~="row"][data-visible-index="2"]')!;
  try {
    await waitUntil(() => target.getBoundingClientRect().height > body.clientHeight);
    await waitUntil(() => measurementAccess(element).measuredItemHeights.has('row:number:2'));
    await aTimeout(40);
    for (const state of ['spanning', 'bottom-outside', 'top-outside'] as const) {
      const bodyTop = body.getBoundingClientRect().top + body.clientTop;
      const rowTop = target.getBoundingClientRect().top - bodyTop + body.scrollTop;
      const rowHeight = target.getBoundingClientRect().height;
      body.scrollTop = state === 'spanning' ? rowTop + 50
        : state === 'bottom-outside' ? rowTop - 20
        : rowTop + rowHeight - body.clientHeight + 20;
      body.dispatchEvent(new Event('scroll'));
      outer.scrollTop = 250;
      window.scrollTo(0, 250);
      await aTimeout(40);
      const before = body.scrollTop;
      const pageBefore = window.scrollY;
      const outerBefore = outer.scrollTop;
      const beforeRect = target.getBoundingClientRect();
      const viewportTop = body.getBoundingClientRect().top + body.clientTop;
      const viewportBottom = viewportTop + body.clientHeight;
      const geometry = `${state}: row ${beforeRect.top}/${beforeRect.bottom}, viewport ${viewportTop}/${viewportBottom}, body scroll ${body.scrollTop}`;
      if (state === 'spanning')
        expect(beforeRect.top < viewportTop && beforeRect.bottom > viewportBottom, geometry).to.equal(true);
      else if (state === 'bottom-outside')
        expect(beforeRect.top >= viewportTop && beforeRect.bottom > viewportBottom, geometry).to.equal(true);
      else
        expect(beforeRect.top < viewportTop && beforeRect.bottom <= viewportBottom, geometry).to.equal(true);

      element.scrollToIndex(2);
      await aTimeout(40);
      const afterRect = target.getBoundingClientRect();
      if (state === 'spanning') expect(Math.abs(body.scrollTop - before)).to.be.at.most(1);
      else if (state === 'bottom-outside') expect(Math.abs(afterRect.top - viewportTop)).to.be.at.most(1);
      else expect(Math.abs(afterRect.bottom - viewportBottom)).to.be.at.most(1);
      expect(window.scrollY, `${state} page position`).to.equal(pageBefore);
      expect(outer.scrollTop, `${state} outer position`).to.equal(outerBefore);
    }
  } finally {
    window.scrollTo(0, initialWindowY);
  }
});

it('aligns rendered rows in a scaled ancestor using the body viewport geometry', async () => {
  const data = Array.from({ length: 100 }, (_, id) => ({ id, name: `Row ${id}` }));
  const wrapper = await fixture<HTMLDivElement>(html`
    <div style="transform: scale(0.5); transform-origin: top left">
      <lr-data-grid
        label="Scaled contained scroll"
        row-key="id"
        style="display: block; inline-size: 500px; --max-height: 180px; --row-height: 40px"
        .columns=${[{ field: 'name', label: 'Name' }]}
        .data=${data}
      ></lr-data-grid>
    </div>
  `);
  const element = wrapper.querySelector<LyraDataGrid<(typeof data)[number]>>('lr-data-grid')!;
  const body = element.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
  for (const align of ['start', 'center', 'end'] as const) {
    body.scrollTop = 50;
    body.dispatchEvent(new Event('scroll'));
    await aTimeout(40);
    const target = element.shadowRoot!.querySelector<HTMLElement>('[part~="row"][data-visible-index="4"]')!;
    expect(target !== null).to.equal(true);
    element.scrollToIndex(4, { align });
    const rowRect = target.getBoundingClientRect();
    const bodyRect = body.getBoundingClientRect();
    const scale = bodyRect.height / body.offsetHeight;
    const top = bodyRect.top + body.clientTop * scale;
    const bottom = top + body.clientHeight * scale;
    const error = align === 'start' ? Math.abs(rowRect.top - top)
      : align === 'center' ? Math.abs((rowRect.top + rowRect.bottom - top - bottom) / 2)
      : Math.abs(rowRect.bottom - bottom);
    expect(error, `${align} rendered alignment under scale(0.5)`).to.be.at.most(1);
  }
  body.scrollTop = 50;
  body.dispatchEvent(new Event('scroll'));
  await aTimeout(40);
  const shifted = element.shadowRoot!.querySelector<HTMLElement>('[part~="row"][data-visible-index="4"]')!;
  shifted.style.transform = 'translateY(12px)';
  element.scrollToIndex(4, { align: 'start' });
  await aTimeout(40);
  const shiftedViewportTop = body.getBoundingClientRect().top + body.clientTop * 0.5;
  expect(Math.abs(shifted.getBoundingClientRect().top - shiftedViewportTop)).to.be.at.most(1);
  shifted.style.transform = '';
  shifted.style.position = 'sticky';
  shifted.style.top = '0px';
  body.scrollTop = 190;
  body.dispatchEvent(new Event('scroll'));
  await aTimeout(40);
  expect(shifted.isConnected).to.equal(true);
  const stickyViewportTop = body.getBoundingClientRect().top + body.clientTop * 0.5;
  expect(Math.abs(shifted.getBoundingClientRect().top - stickyViewportTop)).to.be.at.most(1);
  const beforeStickyScroll = body.scrollTop;
  element.scrollToIndex(4);
  await aTimeout(40);
  expect(body.scrollTop).to.equal(beforeStickyScroll);
  shifted.style.position = '';
  shifted.style.top = '';
  await aTimeout(40);
  body.scrollTop = 0;
  body.style.maxBlockSize = '100px';
  expect(body.clientHeight).to.equal(100);
  element.scrollToIndex(2, { align: 'start' });
  await aTimeout(40);
  const row = element.shadowRoot!.querySelector<HTMLElement>('[part~="row"][data-visible-index="2"]')!;
  const viewportTop = body.getBoundingClientRect().top + body.clientTop * 0.5;
  expect(Math.abs(row.getBoundingClientRect().top - viewportTop)).to.be.at.most(1);
});

it('aligns a rendered row after a fractional viewport resize in the same task', async () => {
  const data = Array.from({ length: 100 }, (_, id) => ({ id, name: `Row ${id}` }));
  const element = await fixture<LyraDataGrid<(typeof data)[number]>>(html`
    <lr-data-grid
      label="Fractional viewport"
      row-key="id"
      style="display: block; inline-size: 500px; --max-height: none; --row-height: 40px"
      .columns=${[{ field: 'name', label: 'Name' }]}
      .data=${data}
    ></lr-data-grid>
  `);
  const body = element.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
  body.style.height = '54.55px';
  await aTimeout(40);
  const roundedHeight = body.offsetHeight;
  body.style.height = '55.45px';
  expect(body.offsetHeight).to.equal(roundedHeight);
  const row = element.shadowRoot!.querySelector<HTMLElement>('[part~="row"][data-visible-index="2"]')!;
  expect(row !== null).to.equal(true);
  element.scrollToIndex(2, { align: 'start' });
  await aTimeout(40);
  const viewportTop = body.getBoundingClientRect().top + body.clientTop;
  expect(Math.abs(row.getBoundingClientRect().top - viewportTop)).to.be.at.most(1);
});

it('records layout row heights despite an ancestor scale and a fractional expanded detail', async () => {
  const data = Array.from({ length: 12 }, (_, id) => ({ id, name: `Row ${id}` }));
  const wrapper = await fixture<HTMLDivElement>(html`
    <div style="transform: scale(0.5); transform-origin: top left">
      <lr-data-grid
        label="Scaled row measurements"
        row-key="id"
        style="display: block; inline-size: 500px; --max-height: 180px; --row-height: 32px; --cell-padding: 0px"
        .columns=${[{
          field: 'name', label: 'Name',
          formatter: (_value: unknown, row: (typeof data)[number]) => html`
            <span style="display: block; block-size: ${row.id === 2 ? 72.5 : 32.5}px">${row.name}</span>
          `,
        }]}
        .rowDetail=${() => html`<div style="block-size: 37px">Expanded detail</div>`}
        .expandedKeys=${[2]}
        .data=${data}
      ></lr-data-grid>
    </div>
  `);
  const element = wrapper.querySelector<LyraDataGrid<(typeof data)[number]>>('lr-data-grid')!;
  const body = element.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
  const row = element.shadowRoot!.querySelector<HTMLElement>('[part~="row"][data-visible-index="2"]')!;
  const detail = element.shadowRoot!.querySelector<HTMLElement>('[data-virtual-item-detail-for="row:number:2"]')!;
  await waitUntil(() => measurementAccess(element).measuredItemHeights.has('row:number:2'));
  const measured = measurementAccess(element).measuredItemHeights.get('row:number:2')!;
  const layoutHeight = Number.parseFloat(getComputedStyle(row).height) +
    Number.parseFloat(getComputedStyle(detail).height);
  expect(detail !== null).to.equal(true);
  expect(Math.abs(measured - layoutHeight), `measured ${measured} vs layout ${layoutHeight}`).to.be.at.most(0.1);

  element.scrollToIndex(2, { align: 'start' });
  await aTimeout(40);
  const scale = body.getBoundingClientRect().height / body.offsetHeight;
  const viewportTop = body.getBoundingClientRect().top + body.clientTop * scale;
  expect(Math.abs(row.getBoundingClientRect().top - viewportTop)).to.be.at.most(1);
});

it('measures a content-box group row in layout pixels under CSS zoom', async () => {
  const data = Array.from({ length: 12 }, (_, id) => ({ id, name: `Row ${id}`, team: id % 2 ? 'A' : 'B' }));
  const wrapper = await fixture<HTMLDivElement>(html`
    <div style="zoom: 125%">
      <lr-data-grid
        label="Zoomed group measurements"
        row-key="id"
        group-by="team"
        style="display: block; inline-size: 500px; --max-height: 180px; --row-height: 32px"
        .columns=${[{ field: 'name', label: 'Name' }, { field: 'team', label: 'Team' }]}
        .data=${data}
      ></lr-data-grid>
    </div>
  `);
  const element = wrapper.querySelector<LyraDataGrid<(typeof data)[number]>>('lr-data-grid')!;
  await element.updateComplete;
  await waitUntil(() => element.shadowRoot!.querySelector('[part="group-row"]') !== null);
  const group = element.shadowRoot!.querySelector<HTMLElement>('[part="group-row"]')!;
  expect(group !== null).to.equal(true);
  group.style.boxSizing = 'content-box';
  group.style.height = '52.5px';
  group.style.paddingTop = '3.25px';
  group.style.paddingBottom = '2.25px';
  measurementAccess(element).measureRenderedItems();
  const style = getComputedStyle(group);
  const layoutHeight = Number.parseFloat(style.height) +
    Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom) +
    Number.parseFloat(style.borderTopWidth) + Number.parseFloat(style.borderBottomWidth);
  const key = group.dataset['virtualItemKey']!;
  const measured = measurementAccess(element).measuredItemHeights.get(key)!;
  expect(Math.abs(measured - layoutHeight), `group measured ${measured} vs layout ${layoutHeight}`).to.be.at.most(0.1);
  measurementAccess(element).measuredItemHeights.delete(key);
  group.style.display = 'none';
  measurementAccess(element).measureRenderedItems();
  expect(measurementAccess(element).measuredItemHeights.has(key)).to.equal(false);
});

it('settles fractional bordered row and detail heights under CSS zoom', async () => {
  const data = Array.from({ length: 100 }, (_, id) => ({ id, name: `Row ${id}` }));
  const wrapper = await fixture<HTMLDivElement>(html`
    <div style="height: 2200px">
      <div style="height: 400px"></div>
      <div id="outer" style="height: 350px; overflow: auto">
        <div style="height: 400px"></div>
        <div id="scaled" style="zoom: 100%">
          <lr-data-grid
            label="Zoomed fractional rows"
            row-key="id"
            style="display: block; inline-size: 500px; --max-height: none; --row-height: 32px"
            .columns=${[{
              field: 'name', label: 'Name', width: 1000,
              formatter: (_value: unknown, row: (typeof data)[number]) => html`
                <span style="display: block; block-size: 32.25px">${row.name}</span>
              `,
            }]}
            .rowDetail=${() => html`<div style="block-size: 37.25px">Expanded detail</div>`}
            .expandedKeys=${[2]}
            .data=${data}
          ></lr-data-grid>
        </div>
        <div style="height: 400px"></div>
      </div>
    </div>
  `);
  const element = wrapper.querySelector<LyraDataGrid<(typeof data)[number]>>('lr-data-grid')!;
  const body = element.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
  body.style.height = '200.25px';
  body.style.boxSizing = 'content-box';
  body.style.borderBlock = '1.25px solid transparent';
  const row = element.shadowRoot!.querySelector<HTMLElement>('[part~="row"][data-visible-index="2"]')!;
  const detail = element.shadowRoot!.querySelector<HTMLElement>('[data-virtual-item-detail-for="row:number:2"]')!;
  row.style.boxSizing = 'content-box';
  row.style.height = '32.25px';
  row.style.borderBlockEnd = '1.25px solid transparent';
  detail.style.boxSizing = 'content-box';
  detail.style.height = '37.25px';
  detail.style.borderBlockEnd = '1.25px solid transparent';
  await waitUntil(() => body.scrollHeight > body.clientHeight);
  await waitUntil(() => measurementAccess(element).measuredItemHeights.has('row:number:2'));
  const beforeZoom = measurementAccess(element).measuredItemHeights.get('row:number:2')!;
  wrapper.querySelector<HTMLElement>('#scaled')!.style.zoom = '125%';
  await aTimeout(40);
  measurementAccess(element).measureRenderedItems();
  const measured = measurementAccess(element).measuredItemHeights.get('row:number:2')!;
  const expected = (row.getBoundingClientRect().height + detail.getBoundingClientRect().height) / 1.25;
  expect(Math.abs(beforeZoom - expected)).to.be.greaterThan(0.1);
  expect(Math.abs(measured - expected), `measured ${measured} vs visual/zoom ${expected}`).to.be.at.most(0.1);
  row.style.borderBlockEnd = '2.25px solid transparent';
  await aTimeout(40);
  measurementAccess(element).measureRenderedItems();
  const borderChanged = (row.getBoundingClientRect().height + detail.getBoundingClientRect().height) / 1.25;
  const measuredAfterBorder = measurementAccess(element).measuredItemHeights.get('row:number:2')!;
  expect(Math.abs(borderChanged - expected)).to.be.greaterThan(0.1);
  expect(Math.abs(measuredAfterBorder - borderChanged), `border-only measured ${measuredAfterBorder} vs ${borderChanged}`).to.be.at.most(0.1);
  element.scrollToIndex(2, { align: 'start' });
  await aTimeout(40);
  const viewportTop = body.getBoundingClientRect().top + body.clientTop * 1.25;
  expect(Math.abs(row.getBoundingClientRect().top - viewportTop)).to.be.at.most(1);
  const outer = wrapper.querySelector<HTMLElement>('#outer')!;
  const initialWindowY = window.scrollY;
  try {
    body.scrollLeft = 75;
    outer.scrollTop = 250;
    window.scrollTo(0, 250);
    await aTimeout(40);
    const pageBefore = window.scrollY;
    const outerBefore = outer.scrollTop;
    const horizontalBefore = body.scrollLeft;
    element.scrollToIndex(70, { align: 'start' });
    await waitUntil(() => element.shadowRoot!.querySelector('[part~="row"][data-visible-index="70"]') !== null);
    await aTimeout(40);
    const target = element.shadowRoot!.querySelector<HTMLElement>('[part~="row"][data-visible-index="70"]')!;
    const bodyRect = body.getBoundingClientRect();
    const alignedTop = bodyRect.top + body.clientTop * 1.25;
    expect(Math.abs(target.getBoundingClientRect().top - alignedTop)).to.be.at.most(1);
    expect(window.scrollY).to.equal(pageBefore);
    expect(outer.scrollTop).to.equal(outerBefore);
    expect(body.scrollLeft).to.equal(horizontalBefore);
  } finally {
    window.scrollTo(0, initialWindowY);
  }
});

it('contains measured offscreen-row alignment to the grid body', async () => {
  const data = Array.from({ length: 100 }, (_, id) => ({ id, name: `Row ${id}` }));
  const wrapper = await fixture<HTMLDivElement>(html`
    <div style="height: 2200px">
      <div style="height: 400px"></div>
      <div id="outer" style="height: 350px; overflow: auto">
        <div style="height: 400px"></div>
        <lr-data-grid
          label="Measured contained scroll"
          row-key="id"
          style="display: block; inline-size: 500px; --max-height: 180px; --row-height: 32px; --cell-padding: 0px"
          .columns=${[{
            field: 'name', label: 'Name', width: 1000,
            formatter: (_value: unknown, row: (typeof data)[number]) => html`
              <span style="display: block; block-size: ${row.id % 2 === 0 ? 72 : 32}px">${row.name}</span>
            `,
          }]}
          .data=${data}
        ></lr-data-grid>
        <div style="height: 400px"></div>
      </div>
    </div>
  `);
  const outer = wrapper.querySelector<HTMLElement>('#outer')!;
  const element = wrapper.querySelector<LyraDataGrid<(typeof data)[number]>>('lr-data-grid')!;
  const body = element.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
  const initialWindowY = window.scrollY;
  const targetFor = (index: number): HTMLElement | null =>
    element.shadowRoot!.querySelector<HTMLElement>(`[part~="row"][data-visible-index="${index}"]`);
  try {
    await waitUntil(() => body.scrollHeight > body.clientHeight && body.scrollWidth > body.clientWidth);
    for (const align of ['start', 'center', 'end', 'default'] as const) {
      body.scrollTop = 0;
      body.scrollLeft = 75;
      body.dispatchEvent(new Event('scroll'));
      outer.scrollTop = 0;
      window.scrollTo(0, 250);
      await aTimeout(40);
      expect(targetFor(60) === null).to.equal(true);
      const pageBefore = window.scrollY;
      const outerBefore = outer.scrollTop;
      const horizontalBefore = body.scrollLeft;
      if (align === 'default') element.scrollToIndex(60);
      else element.scrollToIndex(60, { align });
      await waitUntil(() => {
        const target = targetFor(60);
        if (!target || (measurementAccess(element).measuredItemHeights.get('row:number:60') ?? 0) < 72)
          return false;
        const targetRect = target.getBoundingClientRect();
        const bodyRect = body.getBoundingClientRect();
        const top = bodyRect.top + body.clientTop;
        const bottom = top + body.clientHeight;
        if (align === 'start' || align === 'default') return Math.abs(targetRect.top - top) <= 1;
        if (align === 'center')
          return Math.abs((targetRect.top + targetRect.bottom - top - bottom) / 2) <= 1;
        return Math.abs(targetRect.bottom - bottom) <= 1;
      }, `${align} measured target did not settle inside the grid body`);
      expect(window.scrollY, `${align} page position`).to.equal(pageBefore);
      expect(outer.scrollTop, `${align} outer position`).to.equal(outerBefore);
      expect(body.scrollLeft, `${align} horizontal position`).to.equal(horizontalBefore);
    }

    // The pending measurement path also accepts nearest after a target enters the rendered
    // window. Exercise both clipping directions through its existing test seam.
    const measurement = measurementAccess(element);
    for (const clipped of ['above', 'below'] as const) {
      const rendered = targetFor(60)!;
      const bodyTop = body.getBoundingClientRect().top + body.clientTop;
      const rowTop = rendered.getBoundingClientRect().top - bodyTop + body.scrollTop;
      const rowHeight = rendered.getBoundingClientRect().height;
      body.scrollTop = clipped === 'above'
        ? rowTop + 20
        : rowTop + rowHeight - body.clientHeight - 20;
      body.scrollLeft = 75;
      body.dispatchEvent(new Event('scroll'));
      outer.scrollTop = 0;
      window.scrollTo(0, 250);
      await aTimeout(40);
      const beforeRect = targetFor(60)!.getBoundingClientRect();
      const viewportTop = body.getBoundingClientRect().top + body.clientTop;
      const viewportBottom = viewportTop + body.clientHeight;
      if (clipped === 'above')
        expect(beforeRect.top < viewportTop && beforeRect.bottom <= viewportBottom).to.equal(true);
      else
        expect(beforeRect.top >= viewportTop && beforeRect.bottom > viewportBottom).to.equal(true);
      const pageBefore = window.scrollY;
      const outerBefore = outer.scrollTop;
      const horizontalBefore = body.scrollLeft;
      measurement.pendingVirtualScroll = { itemKey: 'row:number:60', align: 'nearest' };
      await waitUntil(() => {
        measurement.alignPendingVirtualScroll();
        const target = targetFor(60);
        if (!target) return false;
        const rect = target.getBoundingClientRect();
        return clipped === 'above'
          ? Math.abs(rect.top - viewportTop) <= 1
          : Math.abs(rect.bottom - viewportBottom) <= 1;
      }, `nearest measured target clipped ${clipped} did not settle`);
      expect(window.scrollY, `${clipped} nearest page position`).to.equal(pageBefore);
      expect(outer.scrollTop, `${clipped} nearest outer position`).to.equal(outerBefore);
      expect(body.scrollLeft, `${clipped} nearest horizontal position`).to.equal(horizontalBefore);
    }
  } finally {
    window.scrollTo(0, initialWindowY);
  }
});

it("ignores scrollToIndex when there are no rows to scroll to", async () => {
  const element = await dataGrid(
    html`<lr-data-grid label="Empty" .columns=${columns}></lr-data-grid>`
  );
  expect(() => element.scrollToIndex(0)).to.not.throw();
});

it("ignores scrollToIndex before the body element has ever been rendered", () => {
  const element = document.createElement(
    "lr-data-grid"
  ) as unknown as LyraDataGrid<Person>;
  element.columns = columns;
  element.data = rows;
  expect(() => element.scrollToIndex(0)).to.not.throw();
});

it("maps scrollToIndex from processed rows through grouped display items", async () => {
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      group-by="team"
      style="--max-height: 80px; --row-height: 40px"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  element.expandAllRows();
  await element.updateComplete;
  const requested = element.getVisibleRows()[1]!.name;
  const body = element.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
  element.scrollToIndex(1, { align: 'start' });
  await element.updateComplete;
  const target = [...element.shadowRoot!.querySelectorAll<HTMLElement>('[part~="row"]')]
    .find((row) => row.textContent?.includes(requested));
  expect(target !== undefined).to.equal(true);
  expect(body.scrollTop).to.be.greaterThan(0);
  expect(target!.getBoundingClientRect().top).to.be.at.least(body.getBoundingClientRect().top - 1);
  expect(target!.getBoundingClientRect().bottom).to.be.at.most(body.getBoundingClientRect().bottom + 1);
});

it("keeps virtualization active when optional child/detail/group capabilities are fixed-height", async () => {
  const manyRows: Person[] = Array.from({ length: 1_000 }, (_value, id) => ({
    id,
    name: `Person ${id}`,
    team: id % 2 ? "Compiler" : "Runtime",
    score: id,
  }));
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      style="--max-height: var(--lr-size-20rem)"
      .childRows=${() => []}
      .rowDetail=${() => "Details"}
      .columns=${columns}
      .data=${manyRows}
    ></lr-data-grid>
  `);
  expect(element.shadowRoot!.querySelectorAll('[part~="row"]').length).to.be.lessThan(100);
  element.rowDetail = null;
  element.groupBy = "team";
  element.expandAllRows();
  await element.updateComplete;
  expect(element.shadowRoot!.querySelectorAll('[part~="row"]').length).to.be.lessThan(100);
});

it('devirtualizes every row when an expanded detail is present in a 100+ row grid', async () => {
  const manyRows: Person[] = Array.from({ length: 101 }, (_value, id) => ({
    id,
    name: `Person ${id}`,
    team: id % 2 ? 'Compiler' : 'Runtime',
    score: id,
  }));
  const element = await dataGrid(html`
    <lr-data-grid
      label="Expanded details"
      row-key="id"
      style="--row-height: 40px; --max-height: 200px"
      .rowDetail=${(row: Person) => `Details for ${row.name}`}
      .expandedKeys=${[50]}
      .columns=${columns}
      .data=${manyRows}
    ></lr-data-grid>
  `);
  const renderedRows = [
    ...element.shadowRoot!.querySelectorAll<HTMLElement>(
      '[part~="row"][data-visible-index]'
    ),
  ];

  expect(renderedRows).to.have.length(101);
  expect(
    renderedRows.map((row) => Number(row.dataset['visibleIndex']))
  ).to.deep.equal(Array.from({ length: 101 }, (_value, index) => index));
  expect(
    element.shadowRoot!.querySelector('[part="row-detail"]')?.textContent
  ).to.contain('Details for Person 50');
});

it("evaluates the expanded-detail-row offset per pre-window item once virtualized, with nothing actually expanded", async () => {
  // rowDetail + any *currently rendered* expanded row disables virtualization outright (see
  // virtualWindow's own `expandedDetails` guard), so the only way to exercise the pre-window
  // expanded-row offset scan with virtualization still active is to configure rowDetail while
  // leaving expandedKeys empty -- the scan still runs over every pre-window item and evaluates
  // arrayHasKey() for each one, it just never finds a hit.
  const manyRows: Person[] = Array.from({ length: 100 }, (_value, index) => ({
    id: index,
    name: `Person ${index}`,
    team: "Virtual",
    score: index,
  }));
  const element = await dataGrid(html`
    <lr-data-grid
      label="Virtual people"
      row-key="id"
      style="--row-height: 40px; --max-height: 200px"
      .rowDetail=${(row: Person) => `Details for ${row.name}`}
      .columns=${columns}
      .data=${manyRows}
    ></lr-data-grid>
  `);
  const body = element.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
  Object.defineProperty(body, "clientHeight", { configurable: true, value: 200 });
  Object.defineProperty(body, "scrollTo", {
    configurable: true,
    value: (options: ScrollToOptions) => {
      body.scrollTop = Number(options.top ?? 0);
      body.dispatchEvent(new Event("scroll"));
    },
  });
  element.scrollToIndex(50, { align: "start" });
  await element.updateComplete;

  const renderedRows = [
    ...element.shadowRoot!.querySelectorAll<HTMLElement>('[role="row"][aria-rowindex]'),
  ];
  expect(renderedRows.length).to.be.lessThan(100);
  const ariaRowIndex = Number(renderedRows[0]!.getAttribute("aria-rowindex"));
  const visibleIndex = Number(renderedRows[0]!.dataset["visibleIndex"]);
  // Virtualization is active (window.start > 0, so the pre-window slice this offset scan walks is
  // non-empty and the scan actually ran) whenever the first rendered row isn't absolute index 0.
  expect(visibleIndex).to.be.greaterThan(0);
  // Nothing is actually expanded, so the offset the scan computes stays the plain `2 + window.start`
  // -- it must still agree exactly with the row's own visible position, not just avoid throwing.
  expect(ariaRowIndex).to.equal(visibleIndex + 2);
});

it('keeps header and footer columns aligned after native wheel and programmatic body scrolling', async () => {
  const wideColumns: DataGridColumn<Person>[] = [
    { field: 'name', label: 'Name', width: 300, footer: 'Names' },
    { field: 'team', label: 'Team', width: 300 },
    { field: 'score', label: 'Score', width: 300 },
  ];
  for (const direction of ['ltr', 'rtl'] as const) {
    const element = await dataGrid(html`
      <lr-data-grid
        dir=${direction}
        label="Wide ${direction} grid"
        style="inline-size: 200px; --transition-duration: 0s"
        .columns=${wideColumns}
        .data=${rows}
      ></lr-data-grid>
    `);
    const body = element.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
    const header = element.shadowRoot!.querySelector<HTMLElement>('[part="header"]')!;
    const footer = element.shadowRoot!.querySelector<HTMLElement>('[part="footer-row"]')!;
    const columnIds = wideColumns.map((column) => column.field!);
    const maximum = body.scrollWidth - body.clientWidth;
    expect(maximum).to.be.greaterThan(0);

    const logicalOffset = (): number =>
      direction === 'rtl' ? -body.scrollLeft : body.scrollLeft;
    const expectAligned = async (stage: string): Promise<void> => {
      const pairs = columnIds.map((id) => {
        const headerCell = header.querySelector<HTMLElement>(
          `[data-column-id="${id}"]`
        )!;
        const bodyCell = body.querySelector<HTMLElement>(
          `[part~="cell"][data-column-id="${id}"]`
        )!;
        const footerCell = footer.querySelector<HTMLElement>(
          `[data-column-id="${id}"]`
        )!;
        return [headerCell, bodyCell, footerCell] as const;
      });
      const expected = `${direction === 'rtl' ? logicalOffset() : -logicalOffset()}px`;
      await waitUntil(() => {
        const synchronized =
          header.style.getPropertyValue('--data-grid-scroll-translation') === expected &&
          footer.style.getPropertyValue('--data-grid-scroll-translation') === expected;
        return (
          synchronized &&
          pairs.every(([headerCell, bodyCell, footerCell]) => {
            const bodyRect = bodyCell.getBoundingClientRect();
            const headerRect = headerCell.getBoundingClientRect();
            const footerRect = footerCell.getBoundingClientRect();
            return (
              Math.abs(headerRect.left - bodyRect.left) <= 1 &&
              Math.abs(headerRect.right - bodyRect.right) <= 1 &&
              Math.abs(headerRect.width - bodyRect.width) <= 1 &&
              Math.abs(footerRect.left - bodyRect.left) <= 1 &&
              Math.abs(footerRect.right - bodyRect.right) <= 1 &&
              Math.abs(footerRect.width - bodyRect.width) <= 1
            );
          })
        );
      });
      expect(header.style.getPropertyValue('--data-grid-scroll-translation')).to.equal(expected);
      expect(footer.style.getPropertyValue('--data-grid-scroll-translation')).to.equal(expected);
      expect(
        pairs.every(([headerCell, bodyCell, footerCell]) => {
          const bodyRect = bodyCell.getBoundingClientRect();
          const headerRect = headerCell.getBoundingClientRect();
          const footerRect = footerCell.getBoundingClientRect();
          return (
            Math.abs(headerRect.left - bodyRect.left) <= 1 &&
            Math.abs(headerRect.right - bodyRect.right) <= 1 &&
            Math.abs(headerRect.width - bodyRect.width) <= 1 &&
            Math.abs(footerRect.left - bodyRect.left) <= 1 &&
            Math.abs(footerRect.right - bodyRect.right) <= 1 &&
            Math.abs(footerRect.width - bodyRect.width) <= 1
          );
        }),
        `${direction} ${stage}`
      ).to.equal(true);
    };

    await expectAligned('at logical start');
    let sawTrustedWheel = false;
    body.addEventListener('wheel', (event) => {
      sawTrustedWheel ||= event.isTrusted;
    });
    try {
      const rect = body.getBoundingClientRect();
      await sendMouse({
        type: 'move',
        position: [
          Math.round(rect.left + rect.width / 2),
          Math.round(rect.top + Math.min(rect.height / 2, 20)),
        ],
      });
      await sendWheel({
        deltaX:
          (direction === 'rtl' ? -1 : 1) * Math.max(1, Math.floor(maximum / 2)),
      });
      await waitUntil(
        () => sawTrustedWheel && logicalOffset() > 0 && logicalOffset() < maximum,
        `${direction} native wheel did not reach a middle horizontal offset`
      );
      await expectAligned('after a native horizontal wheel');

      body.scrollTo({ left: direction === 'rtl' ? -maximum : maximum });
      await waitUntil(
        () => Math.abs(logicalOffset() - maximum) <= 1,
        `${direction} programmatic scroll did not reach logical end`
      );
      await expectAligned('at programmatic logical end');

      body.scrollTo({ left: 0 });
      await waitUntil(
        () => Math.abs(logicalOffset()) <= 1,
        `${direction} programmatic scroll did not return to logical start`
      );
      await expectAligned('after returning to logical start');

    } finally {
      await resetMouse();
    }
    expect(getComputedStyle(body).overflowX).to.equal('auto');
    expect(getComputedStyle(header).overflowX).to.not.equal('auto');
    expect(getComputedStyle(footer).overflowX).to.not.equal('auto');
  }
});

it('keeps pinned header and footer cells aligned to the body scrollport', async () => {
  const pinnedColumns: DataGridColumn<Person>[] = [
    {
      id: 'start',
      field: 'name',
      label: 'Name',
      width: 80,
      footer: 'Names',
      pinned: 'left',
    },
    { id: 'middle', field: 'team', label: 'Team', width: 600 },
    {
      id: 'end',
      field: 'score',
      label: 'Score',
      width: 80,
      footer: 'Scores',
      pinned: 'right',
    },
  ];
  for (const direction of ['ltr', 'rtl'] as const) {
    const element = await dataGrid(html`
      <lr-data-grid
        dir=${direction}
        label="Pinned ${direction} grid"
        style="inline-size: 220px; --transition-duration: 0s"
        .columns=${pinnedColumns}
        .data=${rows}
      ></lr-data-grid>
    `);
    const body = element.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
    const header = element.shadowRoot!.querySelector<HTMLElement>('[part="header"]')!;
    const footer = element.shadowRoot!.querySelector<HTMLElement>('[part="footer-row"]')!;
    const bodyCells = body.querySelectorAll<HTMLElement>('[part~="cell"]');
    const headerStart = header.querySelector<HTMLElement>('[data-column-id="start"]')!;
    const headerMiddle = header.querySelector<HTMLElement>('[data-column-id="middle"]')!;
    const headerEnd = header.querySelector<HTMLElement>('[data-column-id="end"]')!;
    const footerCells = footer.querySelectorAll<HTMLElement>('[part="footer-cell"]');
    const footerStart = footerCells[0]!;
    const footerMiddle = footerCells[1]!;
    const footerEnd = footerCells[2]!;
    const bodyStart = bodyCells[0]!;
    const bodyMiddle = bodyCells[1]!;
    const bodyEnd = bodyCells[2]!;
    const maximum = body.scrollWidth - body.clientWidth;
    expect(maximum).to.be.greaterThan(0);
    const expectAligned = async (stage: string): Promise<void> => {
      const pairs: readonly [HTMLElement, HTMLElement][] = [
        [headerStart, bodyStart],
        [footerStart, bodyStart],
        [headerMiddle, bodyMiddle],
        [footerMiddle, bodyMiddle],
        [headerEnd, bodyEnd],
        [footerEnd, bodyEnd],
      ];
      const aligned = () =>
        pairs.every(([first, second]) => {
          const firstRect = first.getBoundingClientRect();
          const secondRect = second.getBoundingClientRect();
          return (
            Math.abs(firstRect.left - secondRect.left) <= 1 &&
            Math.abs(firstRect.right - secondRect.right) <= 1 &&
            Math.abs(firstRect.width - secondRect.width) <= 1
          );
        });
      await waitUntil(aligned);
      expect(aligned(), `${direction} ${stage}`).to.equal(true);
    };

    await expectAligned('at initial offset');

    for (const requestedLogicalOffset of [
      Math.floor(maximum / 2),
      maximum,
    ]) {
      body.scrollLeft =
        direction === 'rtl' ? -requestedLogicalOffset : requestedLogicalOffset;
      body.dispatchEvent(new Event('scroll'));
      await element.updateComplete;
      await expectAligned(`at ${requestedLogicalOffset}px`);
    }

    element.columns = pinnedColumns.map((column) =>
      column.id === 'middle' ? { ...column, width: 120 } : column
    );
    await element.updateComplete;
    expect(Math.abs(body.scrollLeft)).to.be.lessThan(maximum);
    await expectAligned('after a layout-driven scroll clamp');
  }
});

it('renders middle and last alternating-height targets after scrollToIndex', async () => {
  interface VariableRow {
    readonly id: number;
    readonly name: string;
  }
  const variableRows: VariableRow[] = Array.from({ length: 120 }, (_value, index) => ({
    id: index,
    name: `Row ${index}`,
  }));
  const element = document.createElement(
    'lr-data-grid'
  ) as unknown as LyraDataGrid<VariableRow>;
  const variableColumns: DataGridColumn<VariableRow>[] = [
    {
      field: 'name',
      label: 'Localized name',
      width: 100,
      formatter: (value, row) => {
        const locale = element.getAttribute('lang') === 'de-DE' ? 'de-DE' : 'en-US';
        const tall = locale === 'en-US' ? row.id % 2 === 0 : row.id % 2 !== 0;
        const ordinal = typeof value === 'string' ? value : String(row.id);
        const prefix =
          locale === 'de-DE' ? 'Lokalisierte Zeile' : 'Localized row';
        const text = tall
          ? [
              `${prefix} ${ordinal} one`,
              `${prefix} ${ordinal} two`,
              `${prefix} ${ordinal} three`,
              `${prefix} ${ordinal} four`,
            ].join('\n')
          : `${prefix} ${ordinal}`;
        return html`
          <span
            data-variable-locale=${locale}
            data-variable-lines=${tall ? 'four' : 'one'}
            style="display: block; line-height: 20px; white-space: pre"
            >${text}</span
          >
        `;
      },
    },
  ];
  element.label = 'Measured variable rows';
  element.setAttribute('lang', 'en-US');
  element.setAttribute('row-key', 'id');
  element.style.cssText =
    'inline-size: 120px; --cell-padding: 0px; --row-height: 20px; --max-height: 100px';
  element.columns = variableColumns;
  element.data = variableRows;
  document.body.append(element);
  await element.updateComplete;
  const body = element.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
  const state = measurementAccess(element);
  let stableTargetTop: number | undefined;
  const keepsMiddleTargetPosition = (tolerance = 5): boolean => {
    const target = element.shadowRoot!.querySelector<HTMLElement>(
      '[part~="row"][data-visible-index="50"]'
    );
    return (
      target !== null &&
      Math.abs(
        target.getBoundingClientRect().top -
          body.getBoundingClientRect().top -
          (stableTargetTop ?? Number.NaN)
      ) <= tolerance
    );
  };
  const keepsStableMiddleAnchor = (): boolean =>
    state.lastMeasurementAnchor?.itemKey === 'row:number:50' &&
    keepsMiddleTargetPosition();
  const assertTargetVisible = async (
    index: number,
    align: 'center' | 'end'
  ): Promise<void> => {
    const before = body.scrollTop;
    element.scrollToIndex(index, { align });
    await waitUntil(() => {
      const target = element.shadowRoot!.querySelector<HTMLElement>(
        `[part~="row"][data-visible-index="${index}"]`
      );
      if (!target) return false;
      const bodyRect = body.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const alignmentDelta =
        align === 'center'
          ? Math.abs(
              (targetRect.top + targetRect.bottom) / 2 -
                (bodyRect.top + bodyRect.bottom) / 2
            )
          : Math.abs(targetRect.bottom - bodyRect.bottom);
      return (
        body.scrollTop > before &&
        targetRect.top >= bodyRect.top - 1 &&
        targetRect.bottom <= bodyRect.bottom + 1 &&
        alignmentDelta <= 1
      );
    }, `scrollToIndex(${index}) did not render its variable-height target in the viewport`);
    const target = element.shadowRoot!.querySelector<HTMLElement>(
      `[part~="row"][data-visible-index="${index}"]`
    )!;
    const bodyRect = body.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    expect(body.scrollTop).to.be.greaterThan(before);
    expect(targetRect.top).to.be.at.least(bodyRect.top - 1);
    expect(targetRect.bottom).to.be.at.most(bodyRect.bottom + 1);
    const alignmentDelta =
      align === 'center'
        ? Math.abs(
            (targetRect.top + targetRect.bottom) / 2 -
              (bodyRect.top + bodyRect.bottom) / 2
          )
        : Math.abs(targetRect.bottom - bodyRect.bottom);
    expect(alignmentDelta).to.be.at.most(1);
  };

  try {
    element.scrollToIndex(50, { align: 'start' });
    await waitUntil(() => {
      const target = element.shadowRoot!.querySelector<HTMLElement>(
        '[part~="row"][data-visible-index="50"]'
      );
      const label = target?.querySelector<HTMLElement>('[data-variable-locale]');
      const anchor = state.lastMeasurementAnchor;
      const targetTop = target?.getBoundingClientRect().top;
      if (
        label?.dataset['variableLocale'] === 'en-US' &&
        label.dataset['variableLines'] === 'four' &&
        (state.measuredItemHeights.get('row:number:50') ?? 0) > 60 &&
        anchor?.itemKey === 'row:number:50' &&
        typeof targetTop === 'number'
      ) {
        stableTargetTop = targetTop - body.getBoundingClientRect().top;
        return true;
      }
      return false;
    }, 'the English four-line stable-key row did not measure and align');

    state.measuredItemHeights.set('locale-offscreen-stale-height', 80);
    element.setAttribute('lang', 'de-DE');
    await element.updateComplete;
    await waitUntil(() => {
      const first = element.shadowRoot!.querySelector<HTMLElement>(
        '[part~="row"][data-visible-index="50"]'
      );
      const second = element.shadowRoot!.querySelector<HTMLElement>(
        '[part~="row"][data-visible-index="51"]'
      );
      const firstLabel = first?.querySelector<HTMLElement>('[data-variable-locale]');
      const secondLabel = second?.querySelector<HTMLElement>('[data-variable-locale]');
      return (
        state.measurementLocale === 'de-DE' &&
        firstLabel?.dataset['variableLocale'] === 'de-DE' &&
        firstLabel.dataset['variableLines'] === 'one' &&
        secondLabel?.dataset['variableLocale'] === 'de-DE' &&
        secondLabel.dataset['variableLines'] === 'four' &&
        !state.measuredItemHeights.has('locale-offscreen-stale-height') &&
        !state.measuredItemHeights.has('row:number:50') &&
        (state.measuredItemHeights.get('row:number:51') ?? 0) > 60 &&
        state.lastMeasurementAnchor?.itemKey === 'row:number:50' &&
        Math.abs(
          (first?.getBoundingClientRect().top ?? Number.NaN) -
            body.getBoundingClientRect().top -
            (stableTargetTop ?? Number.NaN)
        ) <= 1
      );
    }, 'the German localized rows did not remeasure from their stable keys');

    state.measuredItemHeights.set('selectable-offscreen-stale-height', 80);
    element.selectable = 'multiple';
    await element.updateComplete;
    await waitUntil(() => {
      const anchored = element.shadowRoot!.querySelector<HTMLElement>(
        '[part~="row"][data-visible-index="50"]'
      );
      return (
        !state.measuredItemHeights.has('selectable-offscreen-stale-height') &&
        anchored?.querySelector('input[type="checkbox"]') !== null &&
        keepsStableMiddleAnchor()
      );
    }, 'selectable did not invalidate measured variable heights without moving the anchor');

    state.measuredItemHeights.set('columns-offscreen-stale-height', 80);
    element.columns = variableColumns.map((column) => ({ ...column, width: 80 }));
    await element.updateComplete;
    await waitUntil(
      () =>
        !state.measuredItemHeights.has('columns-offscreen-stale-height') &&
        keepsStableMiddleAnchor(),
      'a public columns update did not invalidate measured rows and retain the middle anchor'
    );

    state.measuredItemHeights.set('structure-offscreen-stale-height', 80);
    element.data = [...variableRows, { id: 120, name: 'Row 120' }];
    await element.updateComplete;
    await waitUntil(
      () =>
        !state.measuredItemHeights.has('structure-offscreen-stale-height') &&
        keepsStableMiddleAnchor(),
      'a public display-structure update did not invalidate measured rows and retain the middle anchor'
    );

    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const widthBeforeResize = body.clientWidth;
    state.measuredItemHeights.set('width-offscreen-stale-height', 80);
    element.style.setProperty('inline-size', '160px');
    await waitUntil(
      () =>
        body.clientWidth !== widthBeforeResize &&
        !state.measuredItemHeights.has('width-offscreen-stale-height') &&
        keepsStableMiddleAnchor(),
      'the measured-body ResizeObserver did not invalidate a real width change and retain the middle anchor'
    );

    await assertTargetVisible(60, 'center');
    await assertTargetVisible(119, 'end');
  } finally {
    element.remove();
  }
});

it('preserves a middle stable-key viewport anchor through column, locale, and structure cache invalidations', async () => {
  interface MeasurementRow {
    readonly id: number;
    readonly name: string;
  }
  const measurementRows: MeasurementRow[] = Array.from(
    { length: 120 },
    (_value, index) => ({ id: index, name: `Row ${index}` })
  );
  const element = await dataGrid<MeasurementRow>(html`
    <lr-data-grid
      label="Middle anchor"
      row-key="id"
      style="--row-height: 20px"
      .columns=${[{ field: 'name', label: 'Name' }] as DataGridColumn<MeasurementRow>[]}
      .data=${measurementRows}
    ></lr-data-grid>
  `);
  const body = element.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
  let scrollTop = 2510;
  Object.defineProperty(body, 'scrollTop', {
    configurable: true,
    get: () => scrollTop,
    set: (value: unknown) => {
      scrollTop = Number(value);
    },
  });
  const state = measurementAccess(element);
  const seedMeasurements = (): void => {
    state.measuredItemHeights.clear();
    for (const row of measurementRows)
      state.measuredItemHeights.set(
        `row:number:${row.id}`,
        row.id % 2 === 0 ? 20 : 80
      );
    state.measuredItemOffsetsDirty = true;
    state.pendingMeasurementAnchor = undefined;
    scrollTop = 2510;
    body.dispatchEvent(new Event('scroll'));
  };
  const expectRestoredMiddleAnchor = (
    invalidate: () => void
  ): void => {
    seedMeasurements();
    invalidate();
    expect(state.pendingMeasurementAnchor?.itemKey).to.equal('row:number:50');
    expect(state.pendingMeasurementAnchor?.offset).to.equal(10);
    state.correctMeasurementAnchor();
    // The authored 20px estimate is clamped to the shared 24px row minimum.
    expect(scrollTop).to.equal(50 * 24 + 10);
  };

  expectRestoredMiddleAnchor(() =>
    state.reconcileRowMeasurementCache(new Map([['columns', undefined]]))
  );
  state.measurementLocale = 'en-US';
  element.setAttribute('lang', 'de-DE');
  expectRestoredMiddleAnchor(() => state.reconcileRowMeasurementCache(new Map()));
  state.measurementDisplaySignature = 'stale display projection';
  expectRestoredMiddleAnchor(() => state.reconcileRowMeasurementCache(new Map()));
});

it('captures a virtual scrollToIndex target before a same-task cache invalidation', async () => {
  interface MeasurementRow {
    readonly id: number;
    readonly name: string;
  }
  const measurementRows: MeasurementRow[] = Array.from(
    { length: 120 },
    (_value, index) => ({ id: index, name: `Row ${index}` })
  );
  const element = await dataGrid<MeasurementRow>(html`
    <lr-data-grid
      label="Scroll anchor"
      row-key="id"
      style="--row-height: 20px; --max-height: 100px"
      .columns=${[{ field: 'name', label: 'Name' }] as DataGridColumn<MeasurementRow>[]}
      .data=${measurementRows}
    ></lr-data-grid>
  `);
  const body = element.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
  let scrollTop = 10;
  Object.defineProperty(body, 'clientHeight', {
    configurable: true,
    value: 100,
  });
  Object.defineProperty(body, 'scrollTop', {
    configurable: true,
    get: () => scrollTop,
    set: (value: unknown) => {
      scrollTop = Number(value);
    },
  });
  Object.defineProperty(body, 'scrollTo', {
    configurable: true,
    value: (options: ScrollToOptions) => {
      scrollTop = Number(options.top ?? 0);
    },
  });
  const state = measurementAccess(element);
  for (const row of measurementRows)
    state.measuredItemHeights.set(
      `row:number:${row.id}`,
      row.id % 2 === 0 ? 20 : 80
    );
  state.measuredItemOffsetsDirty = true;
  body.dispatchEvent(new Event('scroll'));

  element.scrollToIndex(50, { align: 'start' });
  expect(state.lastMeasurementAnchor?.itemKey).to.equal('row:number:50');
  expect(state.lastMeasurementAnchor?.offset).to.equal(0);

  state.reconcileRowMeasurementCache(new Map([['columns', undefined]]));
  expect(state.pendingMeasurementAnchor?.itemKey).to.equal('row:number:50');
});

it('lets a native user scroll supersede pending virtual alignment and measurement correction', async () => {
  interface MeasurementRow {
    readonly id: number;
    readonly name: string;
  }
  const measurementRows: MeasurementRow[] = Array.from(
    { length: 120 },
    (_value, index) => ({ id: index, name: `Row ${index}` })
  );
  const element = await dataGrid<MeasurementRow>(html`
    <lr-data-grid
      label="Manual virtual scroll"
      row-key="id"
      style="inline-size: 160px; --row-height: 20px; --max-height: 100px"
      .columns=${[{ field: 'name', label: 'Name' }] as DataGridColumn<MeasurementRow>[]}
      .data=${measurementRows}
    ></lr-data-grid>
  `);
  const body = element.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
  const state = measurementAccess(element);
  let sawTrustedUserScroll = false;
  let sawTrustedWheel = false;
  let userTop: number | undefined;
  let awaitingUserScroll = false;
  body.addEventListener('scroll', (event) => {
    sawTrustedUserScroll ||= event.isTrusted;
    if (awaitingUserScroll && event.isTrusted) userTop = body.scrollTop;
  });
  body.addEventListener('wheel', (event) => {
    sawTrustedWheel ||= event.isTrusted;
  });

  try {
    element.scrollToIndex(70, { align: 'start' });
    const targetAnchor = state.lastMeasurementAnchor;
    expect(state.pendingVirtualScroll?.itemKey).to.equal('row:number:70');
    expect(targetAnchor?.itemKey).to.equal('row:number:70');
    // Hold the later reconciliation long enough for a real user input to arrive between the
    // estimated jump and its forced target alignment.
    state.pendingMeasurementAnchor = targetAnchor;
    state.measurementUpdateQueued = true;
    const commandTop = body.scrollTop;
    await hoverUntilMatched(
      body,
      'the virtual scrollport never accepted the native wheel pointer'
    );
    awaitingUserScroll = true;
    await sendWheel({
      deltaX: 0,
      deltaY: -Math.max(40, Math.floor(commandTop / 4)),
    });
    await waitUntil(
      () =>
        sawTrustedWheel &&
        sawTrustedUserScroll &&
        userTop !== undefined &&
        Math.abs(userTop - commandTop) > 1,
      'the native user wheel did not move the virtual scrollport'
    );
    awaitingUserScroll = false;

    expect(state.pendingVirtualScroll).to.equal(undefined);
    expect(state.pendingMeasurementAnchor?.itemKey).to.not.equal(
      targetAnchor?.itemKey
    );
    const userAnchorKey = state.lastMeasurementAnchor?.itemKey;
    expect(userAnchorKey).to.not.equal(targetAnchor?.itemKey);
    state.measurementUpdateQueued = false;
    state.correctMeasurementAnchor();
    state.alignPendingVirtualScroll();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(state.lastMeasurementAnchor?.itemKey).to.equal(userAnchorKey);
    expect(
      Math.abs(body.scrollTop - commandTop),
      'stale virtual reconciliation restored the original virtual command position',
    ).to.be.greaterThan(1);
  } finally {
    state.measurementUpdateQueued = false;
    await resetMouse();
  }
});

it('invalidates offscreen measured heights when row-height metrics change', async () => {
  const element = await dataGrid<Person>(html`
    <lr-data-grid
      label="Row metric invalidation"
      style="--row-height: 20px"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const state = measurementAccess(element);
  state.measurementRowHeight = 20;
  state.measuredItemHeights.set('row:number:offscreen', 80);
  element.style.setProperty('--row-height', '100px');

  state.measureRenderedItems();

  expect(state.measuredItemHeights.has('row:number:offscreen')).to.equal(false);
});

it('keeps CSS-math row-height probe work bounded as rendered rows grow', async () => {
  const countProbes = async (count: number): Promise<number> => {
    const data = Array.from({ length: count }, (_value, index) => ({
      id: index,
      name: `Person ${index}`,
      team: 'Compiler',
      score: index,
    }));
    const element = await dataGrid<Person>(html`
      <lr-data-grid
        label="CSS math probe count"
        row-key="id"
        style="--row-height: max(calc(2em), 24px)"
        .columns=${columns}
        .data=${data}
      ></lr-data-grid>
    `);
    const state = measurementAccess(element);
    const root = element.shadowRoot!;
    const observer = new MutationObserver(() => {});
    observer.observe(root, { childList: true });
    let records: MutationRecord[];
    try {
      expect(
        root.querySelectorAll('[data-virtual-item-key]').length,
        `rendered rows for ${count}-row fixture`,
      ).to.equal(count);
      state.measureRenderedItems();
      records = observer.takeRecords();
    } finally {
      observer.disconnect();
    }
    return records
      .flatMap((record) => Array.from(record.addedNodes))
      .filter(
        (node): node is HTMLSpanElement =>
          node instanceof HTMLSpanElement &&
          node.getAttribute('aria-hidden') === 'true' &&
          node.style.translate !== '',
      ).length;
  };

  const smallProbeCount = await countProbes(3);
  const largeProbeCount = await countProbes(20);
  expect(smallProbeCount).to.be.greaterThan(0);
  expect(largeProbeCount - smallProbeCount).to.equal(0);
});

it('updates cached virtual-row metrics from CSS math token heights', async () => {
  const element = await dataGrid<Person>(html`
    <lr-data-grid label="Computed row metrics" style="--row-height: 20px" .columns=${columns} .data=${rows}></lr-data-grid>
  `);
  const state = measurementAccess(element);
  state.measurementRowHeight = 20;
  state.measuredItemHeights.set('row:number:offscreen', 80);
  element.style.setProperty('--row-height', 'max(calc(80px * 0.75), 24px)');
  state.measureRenderedItems();
  expect(state.measurementRowHeight).to.equal(60);
  expect(state.measuredItemHeights.has('row:number:offscreen')).to.equal(false);
});

it('invalidates offscreen measured heights when inherited font metrics change', async () => {
  const element = await dataGrid<Person>(html`
    <lr-data-grid
      label="Font metric invalidation"
      style="--row-height: 20px; font-size: 12px"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const state = measurementAccess(element);
  state.measuredItemHeights.set('font-metric-sentinel', 80);
  element.style.setProperty('font-size', '24px');

  state.measureRenderedItems();

  expect(state.measuredItemHeights.has('font-metric-sentinel')).to.equal(false);
});

it('invalidates offscreen measured heights when root-relative cell padding changes', async () => {
  const root = document.documentElement;
  const previousFontSize = root.style.getPropertyValue('font-size');
  const previousFontSizePriority = root.style.getPropertyPriority('font-size');
  const rootMetric = '--data-grid-test-root-font-size';
  const previousRootMetric = root.style.getPropertyValue(rootMetric);
  const previousRootMetricPriority = root.style.getPropertyPriority(rootMetric);

  try {
    root.style.setProperty(rootMetric, '16px');
    root.style.setProperty('font-size', `var(${rootMetric})`, 'important');
    const element = await dataGrid<Person>(html`
      <lr-data-grid
        label="Root padding metric invalidation"
        style="--row-height: 20px; font-size: 12px; --cell-padding: 1rem"
        .columns=${columns}
        .data=${rows}
      ></lr-data-grid>
    `);
    const state = measurementAccess(element);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    state.measuredItemHeights.set('root-padding-sentinel', 80);

    root.style.setProperty(rootMetric, '24px');
    await waitUntil(
      () => !state.measuredItemHeights.has('root-padding-sentinel'),
      'the measured-row ResizeObserver did not invalidate root-relative padding metrics'
    );
  } finally {
    if (previousFontSize)
      root.style.setProperty(
        'font-size',
        previousFontSize,
        previousFontSizePriority
      );
    else root.style.removeProperty('font-size');
    if (previousRootMetric)
      root.style.setProperty(
        rootMetric,
        previousRootMetric,
        previousRootMetricPriority
      );
    else root.style.removeProperty(rootMetric);
  }
});

it('invalidates stale measured heights when a reconnect observes a different body width', async () => {
  const element = await dataGrid<Person>(html`
    <lr-data-grid
      label="Reconnect width"
      style="inline-size: 320px"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const body = element.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
  Object.defineProperty(body, 'clientWidth', {
    configurable: true,
    value: 320,
  });
  const state = measurementAccess(element);
  state.recordMeasuredBodyWidth(320);
  state.measuredItemHeights.set('stale-width-sentinel', 80);
  try {
    element.remove();
    Object.defineProperty(body, 'clientWidth', {
      configurable: true,
      value: 160,
    });
    document.body.append(element);
    await element.updateComplete;

    expect(state.measuredItemHeights.has('stale-width-sentinel')).to.equal(false);
  } finally {
    element.remove();
  }
});

it('invalidates stale measured heights across a same-width reconnect', async () => {
  const element = await dataGrid<Person>(html`
    <lr-data-grid
      label="Reconnect unchanged width"
      style="inline-size: 320px"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const body = element.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
  Object.defineProperty(body, 'clientWidth', {
    configurable: true,
    value: 320,
  });
  const state = measurementAccess(element);
  state.recordMeasuredBodyWidth(320);
  state.measuredItemHeights.set('same-width-stale-sentinel', 80);
  try {
    element.remove();
    document.body.append(element);
    await element.updateComplete;

    expect(
      state.measuredItemHeights.has('same-width-stale-sentinel')
    ).to.equal(false);
  } finally {
    element.remove();
  }
});

it('invalidates measured heights for every finite fractional body-width change', async () => {
  const element = await dataGrid<Person>();
  const state = measurementAccess(element);
  state.recordMeasuredBodyWidth(100);
  state.measuredItemHeights.set('fractional-width-sentinel', 80);

  expect(state.recordMeasuredBodyWidth(100.25)).to.equal(true);
  expect(state.measuredItemHeights.has('fractional-width-sentinel')).to.equal(false);
});

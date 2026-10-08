import { expect, fixture, html } from '@open-wc/testing';
import { render } from 'lit';
import { collectTableSearchMatches, TableViewerController, TableViewerScrollController, tableHighlightsForColumn, tableHighlightsForRow } from './table-viewer-shared.js';
import type { LyraHighlight } from './document-viewer/anchors.js';

describe('TableViewerScrollController', () => {
  it('uses raw one-based rows and optional sheet scoping for cell highlights', () => {
    const global = { parsed: { startRow: 0, endRow: 1, startCol: 1, endCol: 2 } };
    const sheet = { parsed: { startRow: 1, endRow: 1, startCol: 2, endCol: 2 }, sheet: 'Second' };
    expect(tableHighlightsForRow([global, sheet], 1, 'First')).to.deep.equal([global]);
    expect(tableHighlightsForColumn(tableHighlightsForRow([global, sheet], 2, 'Second'), 2))
      .to.deep.equal([global, sheet]);
  });

  it('waits for the virtual row to render before scrolling the addressed column', async () => {
    const host = await fixture<HTMLElement>(html`<div></div>`);
    const list = Object.assign(document.createElement('div'), { updateComplete: Promise.resolve() });
    const shadow = list.attachShadow({ mode: 'open' });
    host.append(list);
    let finishUpdate!: () => void;
    list.updateComplete = new Promise<void>((resolve) => { finishUpdate = resolve; });
    let scrolled = 0;
    const scroll = new TableViewerScrollController(host).scrollColumnIntoView(list, 1);
    expect(scrolled).to.equal(0);
    const row = document.createElement('div');
    row.setAttribute('part', 'row');
    row.setAttribute('aria-current', 'true');
    for (let col = 0; col < 2; col++) {
      const cell = document.createElement('div');
      cell.setAttribute('part', 'cell');
      cell.scrollIntoView = () => { scrolled = col + 1; };
      row.append(cell);
    }
    shadow.append(row);
    finishUpdate();
    await scroll;
    expect(scrolled).to.equal(2);
  });

  it('settles a canceled frame without scrolling a stale row', async () => {
    const host = await fixture<HTMLElement>(html`<div></div>`);
    const list = Object.assign(document.createElement('div'), { updateComplete: Promise.resolve() });
    list.updateComplete = Promise.resolve();
    const row = document.createElement('div');
    row.setAttribute('part', 'row');
    row.setAttribute('aria-current', 'true');
    const cell = document.createElement('div');
    cell.setAttribute('part', 'cell');
    let scrolled = false;
    cell.scrollIntoView = () => { scrolled = true; };
    row.append(cell);
    list.attachShadow({ mode: 'open' }).append(row);
    host.append(list);
    const controller = new TableViewerScrollController(host);
    const scroll = controller.scrollColumnIntoView(list, 0);
    await Promise.resolve();
    controller.cancel();
    await scroll;
    expect(scrolled).to.equal(false);
  });

  it('drops a canceled pending update even when it resolves later', async () => {
    const host = await fixture<HTMLElement>(html`<div></div>`);
    const list = Object.assign(document.createElement('div'), { updateComplete: Promise.resolve() });
    let resolveUpdate!: () => void;
    list.updateComplete = new Promise<void>((resolve) => { resolveUpdate = resolve; });
    let scrolled = false;
    const row = document.createElement('div');
    row.setAttribute('part', 'row');
    row.setAttribute('aria-current', 'true');
    const cell = document.createElement('div');
    cell.setAttribute('part', 'cell');
    cell.scrollIntoView = () => { scrolled = true; };
    row.append(cell);
    list.attachShadow({ mode: 'open' }).append(row);
    host.append(list);
    const controller = new TableViewerScrollController(host);
    const pending = controller.scrollColumnIntoView(list, 0);
    controller.cancel();
    resolveUpdate();
    await pending;
    expect(scrolled).to.equal(false);
  });

  it('lets a newer scroll supersede an older pending update', async () => {
    const host = await fixture<HTMLElement>(html`<div></div>`);
    const oldList = Object.assign(document.createElement('div'), { updateComplete: Promise.resolve() });
    let resolveOld!: () => void;
    oldList.updateComplete = new Promise<void>((resolve) => { resolveOld = resolve; });
    host.append(oldList);
    const newList = Object.assign(document.createElement('div'), { updateComplete: Promise.resolve() });
    newList.updateComplete = Promise.resolve();
    const row = document.createElement('div');
    row.setAttribute('part', 'row');
    row.setAttribute('aria-current', 'true');
    const cell = document.createElement('div');
    cell.setAttribute('part', 'cell');
    let scrolled = 0;
    cell.scrollIntoView = () => { scrolled++; };
    row.append(cell);
    newList.attachShadow({ mode: 'open' }).append(row);
    host.append(newList);
    const controller = new TableViewerScrollController(host);
    const older = controller.scrollColumnIntoView(oldList, 0);
    const newer = controller.scrollColumnIntoView(newList, 0);
    resolveOld();
    await Promise.all([older, newer]);
    expect(scrolled).to.equal(1);
  });
});

describe('collectTableSearchMatches', () => {
  const cells = ['Alpha', 'beta', 'ALPHA'];
  const scan = (visit: (text: string, match: number) => boolean) => {
    for (let i = 0; i < cells.length; i++) if (!visit(cells[i]!, i)) return;
  };

  it('collects locale-folded matches in scan order', () => {
    expect(collectTableSearchMatches('alpha', 'en', true, scan)).to.deep.equal({ matches: [0, 2], exact: true });
  });

  it('returns nothing for a blank query or a disabled scan', () => {
    expect(collectTableSearchMatches('  ', 'en', true, scan).matches).to.have.lengthOf(0);
    expect(collectTableSearchMatches('alpha', 'en', false, scan).matches).to.have.lengthOf(0);
  });

  it('caps retained matches and reports a lower bound', () => {
    const many = (visit: (text: string, match: number) => boolean) => {
      for (let i = 0; i < 1_500; i++) if (!visit('x', i)) return;
    };
    const result = collectTableSearchMatches('x', 'en', true, many);
    expect(result.matches).to.have.lengthOf(1_000);
    expect(result.exact).to.equal(false);
  });
});

describe('TableViewerController', () => {
  type Match = { row: number; col: number };
  const setup = async () => {
    const host = Object.assign(await fixture<HTMLElement>(html`<div></div>`), { src: '', hasUpdated: true, requestUpdate: () => {}, updateComplete: Promise.resolve(true) });
    const events: unknown[] = [];
    const jumps: Match[] = [];
    const scheduled: Array<[() => void, string | undefined]> = [];
    let loads = 0;
    let locale = 'en';
    const table = new TableViewerController<Match>(host as never, {
      emitSearch: (detail) => events.push(detail),
      emitActivate: (id) => events.push(id),
      localize: (key) => key,
      locale: () => locale,
      schedule: (callback, key) => scheduled.push([callback, key]),
      load: async () => { loads++; },
      research: async () => 0,
      jump: async (match) => { jumps.push(match); },
      teardown: () => {},
    });
    return { host, table, events, jumps, scheduled, loads: () => loads, setLocale: (next: string) => { locale = next; } };
  };
  const cells = ['Ada', 'Grace', 'ada'];
  const scan = (visit: (text: string, match: Match) => boolean) => {
    for (let i = 0; i < cells.length; i++) if (!visit(cells[i]!, { row: i + 1, col: 0 })) return;
  };

  it('publishes matches, jumps to the first and steps with wrap-around', async () => {
    const { table, events, jumps } = await setup();
    expect(await table.runSearch('ada', true, scan)).to.equal(2);
    expect(jumps).to.deep.equal([{ row: 1, col: 0 }]);
    expect(await table.step(1)).to.equal(true);
    expect(jumps.at(-1)).to.deep.equal({ row: 3, col: 0 });
    expect(await table.step(1)).to.equal(true);
    expect(jumps.at(-1)).to.deep.equal({ row: 1, col: 0 });
    expect(events.at(-1)).to.deep.include({ query: 'ada', matchCount: 2, activeIndex: 0 });
  });

  it('does not step or jump without matches, and clearing resets the active row', async () => {
    const { table, events, jumps } = await setup();
    expect(await table.step(1)).to.equal(false);
    table.setActiveRow(4);
    await table.runSearch('ada', true, scan);
    table.clearSearch();
    expect(table.activeRowKey).to.equal('');
    expect(events.at(-1)).to.deep.equal({ query: '', matchCount: 0, matchCountExact: true, activeIndex: -1 });
    expect(jumps).to.have.lengthOf(1);
  });

  it('resets search on a source change and emits the reset once after the update', async () => {
    const { table, events, scheduled } = await setup();
    await table.runSearch('ada', true, scan);
    events.length = 0;
    table.willUpdate(new Map([['src', '']]), [], null, false);
    expect(table.search.query).to.equal('');
    table.updated(new Map([['src', '']]), { kind: 'idle' });
    expect(events).to.deep.equal([{ query: '', matchCount: 0, matchCountExact: true, activeIndex: -1 }]);
    expect(scheduled.some(([, key]) => key === undefined)).to.equal(true);
    table.updated(new Map(), { kind: 'idle' });
    expect(events).to.have.lengthOf(1);
  });

  it('re-runs a live query when the effective locale changes', async () => {
    const { table, scheduled, setLocale } = await setup();
    table.updated(new Map(), { kind: 'idle' });
    await table.runSearch('ada', true, scan);
    scheduled.length = 0;
    setLocale('tr');
    table.updated(new Map(), { kind: 'idle' });
    expect(scheduled.map(([, key]) => key)).to.deep.equal(['search']);
  });

  it('keeps sheet-qualified highlights only for sheet-aware viewers', async () => {
    const { table } = await setup();
    const highlights = [
      { id: 'a', anchor: { kind: 'cell-range', range: 'B2', sheet: 'Two' } },
      { id: 'b', anchor: { kind: 'cell-range', range: 'A1' } },
    ] as unknown as LyraHighlight[];
    table.willUpdate(new Map([['highlights', []]]), highlights, null, false);
    expect(table.highlights.map((entry) => entry.highlight.id)).to.deep.equal(['b']);
    table.willUpdate(new Map([['highlights', []]]), highlights, null, true);
    expect(table.highlights.map((entry) => [entry.highlight.id, entry.sheet])).to.deep.equal([['a', 'Two'], ['b', undefined]]);
  });

  it('renders a highlighted cell with a native action that reports its highlight', async () => {
    const { host, table, events } = await setup();
    table.willUpdate(new Map([['highlights', []]]), [{ id: 'h', label: 'note', anchor: { kind: 'cell-range', range: 'A1' } }] as unknown as LyraHighlight[], 'h', false);
    const target = document.createElement('div');
    host.append(target);
    render(table.renderCell('x', 0, table.highlightsForRow(1), 'cell', 'cell', '--_c', 'h'), target);
    const cell = target.firstElementChild!;
    expect(cell.getAttribute('part')).to.equal('cell cell-highlight');
    expect(cell.hasAttribute('data-active')).to.equal(true);
    (cell.querySelector('button') as HTMLButtonElement).click();
    expect(events).to.deep.equal(['h']);
    render(table.renderCell('y', 3, table.highlightsForRow(1), 'columnheader', 'header-cell', '--_c', null), target);
    expect(target.firstElementChild!.getAttribute('part')).to.equal('header-cell');
  });
});

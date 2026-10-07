import { expect, fixture, html } from '@open-wc/testing';
import { TableViewerScrollController, tableHighlightsForColumn, tableHighlightsForRow } from './table-viewer-shared.js';

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

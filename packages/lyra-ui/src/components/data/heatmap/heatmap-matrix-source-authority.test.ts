import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './heatmap.js';
import type { LyraHeatmap } from './heatmap.class.js';

type Rectangle = { rowStart: number; rowEnd: number; columnStart: number; columnEnd: number };
type SourceHost = LyraHeatmap & { matrixSource: unknown; matrixViewport: Rectangle | null; matrixReducer: string; revealSourceCell(row: number, col: number): Promise<boolean> };
function provider(rows = 1000, cols = 1000) {
  const queries: Rectangle[] = [];
  const cells: [number, number][] = [];
  return { queries, cells, revision: 1, rowCount: rows, columnCount: cols, domain: { min: 0, max: rows * cols },
    query(request: Rectangle) { queries.push(request); const count = (request.rowEnd - request.rowStart) * (request.columnEnd - request.columnStart);
      return [{ ...request, count, validCount: count, min: 0, max: rows * cols, sum: count }]; },
    getCell(row: number, col: number) { cells.push([row, col]); return { value: row * cols + col, rowLabel: `R${row}`, columnLabel: `C${col}` }; },
  };
}

it('does not continue obsolete keyboard navigation against a replacement source', async () => {
  const first = provider(20, 20), next = provider(20, 20);
  let finish!: () => void;
  first.getCell = ((row: number, col: number) => new Promise(resolve => { finish = () => resolve({ value: row * 20 + col, rowLabel: 'r', columnLabel: 'c' }); })) as unknown as typeof first.getCell;
  const el = await fixture<SourceHost>(html`<lr-heatmap style="width:320px" .matrixSource=${first}></lr-heatmap>`);
  await waitUntil(() => first.queries.length === 1);
  await focusByKeyboard(el.shadowRoot!.querySelector('canvas')!);
  await sendKeys({ press: 'ArrowRight' });
  await waitUntil(() => !!finish);
  el.matrixSource = next;
  await waitUntil(() => next.queries.length === 1);
  await new Promise(resolve => setTimeout(resolve, 40));
  finish();
  expect(next.cells.length).to.equal(0);
});

it('rejects an obsolete exact-cell button after a replacement source has loaded', async () => {
  const first = provider(2, 2), next = provider(2, 2);
  const el = await fixture<SourceHost>(html`<lr-heatmap accessible-cells style="width:320px" .matrixSource=${first}></lr-heatmap>`);
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="cell"]').length === 4);
  const old = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="cell"]')!;
  el.matrixSource = next;
  await waitUntil(() => next.cells.length === 4);
  await el.updateComplete;
  expect(old.isConnected).to.equal(false);
  const events: unknown[] = []; el.addEventListener('lr-cell-activate', event => events.push(event.detail));
  old.click(); await el.updateComplete; await new Promise(resolve => setTimeout(resolve, 30));
  expect(events.length).to.equal(0);
});

it('does not invoke an obsolete getCell method after its getter replaces the source', async () => {
  const first = provider(2, 2), next = provider(2, 2);
  const el = await fixture<SourceHost>(html`<lr-heatmap style="width:320px" .matrixSource=${first}></lr-heatmap>`);
  await waitUntil(() => first.queries.length === 1);
  let calls = 0;
  Object.defineProperty(first, 'getCell', { get() {
    el.matrixSource = next;
    return () => { calls++; return { value: 1, rowLabel: 'r', columnLabel: 'c' }; };
  } });
  expect(await el.revealSourceCell(0, 1)).to.equal(false);
  expect(calls).to.equal(0);
});

it('keeps the latest cached reveal authoritative while an older exact pane is pending', async () => {
  const source = provider();
  const el = await fixture<SourceHost>(html`<lr-heatmap accessible-cells style="width:320px" .matrixSource=${source}></lr-heatmap>`);
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="cell"]').length === 400);
  await focusByKeyboard(el.shadowRoot!.querySelector<HTMLButtonElement>('[part="cell"]')!);
  const normal = source.getCell;
  const releases: (() => void)[] = [];
  let paused = true;
  source.getCell = ((row: number, col: number) => paused ? new Promise(resolve => releases.push(() => resolve(normal(row, col)))) : normal(row, col)) as unknown as typeof source.getCell;
  const first = el.revealSourceCell(999, 999);
  await waitUntil(() => releases.length === 1);
  releases.shift()!();
  await waitUntil(() => releases.length === 2);
  expect(await el.revealSourceCell(0, 0)).to.equal(true);
  paused = false; releases.splice(0).forEach(release => release());
  expect(await first).to.equal(false);
  expect(el.shadowRoot!.activeElement?.getAttribute('data-source-row')).to.equal('0');
});

it('does not invoke an obsolete query method after its getter replaces the source', async () => {
  const first = provider(2, 2), next = provider(3, 3);
  const el = await fixture<SourceHost>(html`<lr-heatmap style="width:320px" .matrixSource=${first}></lr-heatmap>`);
  await waitUntil(() => first.queries.length === 1);
  let calls = 0;
  Object.defineProperty(first, 'query', { get() {
    el.matrixSource = next;
    return () => { calls++; return []; };
  } });
  el.requestUpdate();
  await waitUntil(() => next.queries.length === 1);
  expect(calls).to.equal(0);
});

it('revokes pending exact effects on locale changes without querying tiles again', async () => {
  const source = provider(2, 2);
  let release!: () => void;
  source.getCell = (() => new Promise(resolve => { release = () => resolve({ value: 1, rowLabel: 'old', columnLabel: 'old' }); })) as unknown as typeof source.getCell;
  const el = await fixture<SourceHost>(html`<lr-heatmap .matrixSource=${source}></lr-heatmap>`);
  await waitUntil(() => source.queries.length === 1);
  const pending = el.revealSourceCell(0, 1);
  await waitUntil(() => Boolean(release));
  el.locale = 'fr'; el.strings = { heatmapSourceSummary: 'Source complète' };
  expect(await pending).equal(false);
  release(); await el.updateComplete;
  expect(source.queries.length).equal(1);
  expect(el.shadowRoot!.querySelector('[part="source-summary"]')?.textContent).contain('Source complète');
});

it('refreshes once for either keyless and named coalescing order and same-source rebind', async () => {
  const source = provider(2, 2);
  const el = await fixture<SourceHost>(html`<lr-heatmap .matrixSource=${source}></lr-heatmap>`);
  await waitUntil(() => source.queries.length === 1);
  el.requestUpdate(); el.matrixReducer = 'max';
  await waitUntil(() => source.queries.length === 2); await el.updateComplete;
  expect(source.queries.length).equal(2);
  el.matrixReducer = 'min'; el.requestUpdate();
  await waitUntil(() => source.queries.length === 3); await el.updateComplete;
  expect(source.queries.length).equal(3);
  el.matrixSource = source; el.matrixReducer = 'mean';
  await waitUntil(() => source.queries.length === 4); await el.updateComplete;
  expect(source.queries.length).equal(4);
});

for (const callback of ['cellInteractive', 'cellText', 'cellColor'] as const) {
  it(`revokes exact pane rendering when ${callback} replaces its source`, async () => {
    const source = provider(2, 2), next = provider(3, 3);
    const el = await fixture<SourceHost>(html`<lr-heatmap .matrixSource=${source}></lr-heatmap>`);
    await waitUntil(() => source.queries.length === 1);
    const seen: number[] = [];
    const replace = (_position: unknown, value: number) => { seen.push(value); el[callback] = undefined; el.matrixSource = next; return callback === 'cellInteractive' ? true : 'custom'; };
    if (callback === 'cellInteractive') el.cellInteractive = replace as typeof el.cellInteractive;
    else if (callback === 'cellText') el.cellText = replace as typeof el.cellText;
    else el.cellColor = replace as typeof el.cellColor;
    el.accessibleCells = true;
    await waitUntil(() => next.queries.length === 1);
    el.cellInteractive = undefined; el.cellText = undefined; el.cellColor = undefined;
    await el.updateComplete;
    expect(seen.length).equal(1);
    expect(seen[0]).equal(0);
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="cell"]').length === 9);
  });
}

it('lets source replacement from an abort listener retain the newest exact window', async () => {
  const first = provider(2, 2), next = provider(3, 3);
  const releases: (() => void)[] = [];
  let el!: SourceHost;
  first.getCell = ((row: number, col: number, request: { signal: AbortSignal }) => {
    request.signal.addEventListener('abort', () => { el.matrixSource = next; }, { once: true });
    return new Promise(resolve => releases.push(() => resolve({ value: row * 2 + col, rowLabel: 'old', columnLabel: 'old' })));
  }) as unknown as typeof first.getCell;
  el = await fixture<SourceHost>(html`<lr-heatmap accessible-cells .matrixSource=${first}></lr-heatmap>`);
  await waitUntil(() => releases.length === 2);
  el.strings = { heatmapSourceSummary: 'New summary' };
  await waitUntil(() => next.queries.length === 1);
  releases.splice(0).forEach(release => release());
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="cell"]').length === 9);
  expect(el.matrixSource === next).equal(true);
  expect(el.shadowRoot!.textContent).not.contain('old');
});

for (const lifecycle of ['reconnect', 'adopt'] as const) {
  it(`revokes pending pane, selected and focus reads on ${lifecycle}`, async () => {
    const source = provider(30, 30);
    const wrapper = await fixture<HTMLElement>(html`<div><lr-heatmap accessible-cells .matrixSource=${source}></lr-heatmap><iframe></iframe></div>`);
    const el = wrapper.querySelector('lr-heatmap') as SourceHost;
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="cell"]').length === 400);
    const normal = source.getCell, releases: (() => void)[] = [];
    let paused = true, active = 0, peak = 0;
    source.getCell = ((row: number, col: number) => {
      if (!paused) return normal(row, col);
      active++; peak = Math.max(peak, active);
      return new Promise(resolve => releases.push(() => { active--; resolve(normal(row, col)); }));
    }) as unknown as typeof source.getCell;
    el.selectedCell = { row: 29, col: 29 };
    await waitUntil(() => releases.length === 1);
    const pending = el.revealSourceCell(28, 28);
    await waitUntil(() => releases.length === 2);
    if (lifecycle === 'reconnect') { el.remove(); wrapper.prepend(el); }
    else {
      const frame = wrapper.querySelector('iframe')!;
      await waitUntil(() => Boolean(frame.contentDocument?.body));
      frame.contentDocument!.body.append(el);
    }
    expect(await pending).equal(false);
    paused = false; releases.splice(0).forEach(release => release());
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="cell"]').length === 400);
    expect(peak).equal(2); expect(active).equal(0);
    expect(Boolean(el.shadowRoot!.querySelector('[part="source-error"]'))).equal(false);
    expect(Boolean(el.shadowRoot!.activeElement)).equal(false);
    el.remove();
  });
}

it('keeps the old pane focused while loading and restores the revealed exact coordinate', async () => {
  const source = provider(40, 40);
  const el = await fixture<SourceHost>(html`<lr-heatmap accessible-cells .matrixSource=${source}></lr-heatmap>`);
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="cell"]').length === 400);
  const old = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="cell"]')!;
  await focusByKeyboard(old);
  const normal = source.getCell, releases: (() => void)[] = [];
  let paused = true;
  source.getCell = ((row: number, col: number) => paused ? new Promise(resolve => releases.push(() => resolve(normal(row, col)))) : normal(row, col)) as unknown as typeof source.getCell;
  const pending = el.revealSourceCell(39, 39);
  await waitUntil(() => releases.length === 1); releases.shift()!();
  await waitUntil(() => releases.length === 2);
  expect(el.shadowRoot!.activeElement === old).equal(true);
  expect(el.shadowRoot!.querySelectorAll('[part="cell"]').length).equal(400);
  paused = false; releases.splice(0).forEach(release => release());
  expect(await pending).equal(true);
  expect(el.shadowRoot!.activeElement?.getAttribute('data-source-row')).equal('39');
  expect(el.shadowRoot!.activeElement?.getAttribute('data-source-col')).equal('39');
});

it('does not override an intervening focus move inside the current exact pane', async () => {
  const source = provider(40, 40);
  const el = await fixture<SourceHost>(html`<lr-heatmap accessible-cells .matrixSource=${source}></lr-heatmap>`);
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="cell"]').length === 400);
  const cells = el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="cell"]');
  await focusByKeyboard(cells[0]!);
  const normal = source.getCell;
  let release!: () => void;
  source.getCell = ((row: number, col: number) => new Promise(resolve => { release = () => resolve(normal(row, col)); })) as unknown as typeof source.getCell;
  const pending = el.revealSourceCell(39, 39);
  await waitUntil(() => Boolean(release));
  await focusByKeyboard(cells[1]!);
  source.getCell = normal; release();
  expect(await pending).equal(false);
  expect(el.shadowRoot!.activeElement?.getAttribute('data-source-col')).equal('1');
});

it('keeps physical left/right navigation under RTL and bounds excluded candidates', async () => {
  const source = provider(2, 100);
  const el = await fixture<SourceHost>(html`<lr-heatmap dir="rtl" .matrixSource=${source}></lr-heatmap>`);
  await waitUntil(() => source.queries.length === 1);
  expect(await el.revealSourceCell(0, 1)).equal(true);
  await sendKeys({ press: 'ArrowRight' });
  await waitUntil(() => source.cells.length === 2);
  expect(source.cells[1]).deep.equal([0, 2]);
  await sendKeys({ press: 'ArrowLeft' }); await el.updateComplete;
  let activated = -1;
  el.addEventListener('lr-cell-activate', event => { activated = 'col' in event.detail ? event.detail.col : -1; });
  await sendKeys({ press: 'Enter' }); await waitUntil(() => activated === 1);
  el.cellInteractive = () => false; await el.updateComplete;
  const before = source.cells.length;
  await sendKeys({ press: 'ArrowRight' });
  await waitUntil(() => source.cells.length - before === 32);
  await el.updateComplete;
  expect(source.cells.length - before).equal(32);
  const after = source.cells.length;
  for (const [row, col] of [[-1, 0], [2, 0], [0, 100], [NaN, 0], [0, 0.5]]) expect(await el.revealSourceCell(row!, col!)).equal(false);
  expect(source.cells.length).equal(after);
});

it('keeps long exact labels and native hit areas within a 320px allocation', async () => {
  const source = provider(2, 2);
  source.getCell = () => ({ value: 1, rowLabel: 'R'.repeat(1024), columnLabel: 'C'.repeat(1024) });
  const el = await fixture<SourceHost>(html`<lr-heatmap accessible-cells style="width:320px" .matrixSource=${source}></lr-heatmap>`);
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="cell"]').length === 4);
  const pane = el.shadowRoot!.querySelector<HTMLElement>('[part="source-exact-window"]')!;
  const button = pane.querySelector<HTMLButtonElement>('button')!;
  const min = parseFloat(getComputedStyle(button).minHeight);
  expect(pane.getBoundingClientRect().width).at.most(320);
  expect(pane.scrollWidth).greaterThan(pane.clientWidth);
  expect(getComputedStyle(pane).overflowX).equal('auto');
  expect(button.getBoundingClientRect().height).at.least(min);
  expect(button.getBoundingClientRect().width).at.least(min);
  expect(el.scrollWidth).at.most(320);
  expect(button.textContent).contain('R'.repeat(1024));
});

it('uses the unregistered English fallback and exposes a no-canvas source error', async () => {
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof original;
  try {
    const el = await fixture<SourceHost>(html`<lr-heatmap locale="zz-ZZ" .matrixSource=${provider(2, 2)}></lr-heatmap>`);
    await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[part="source-error"]')));
    expect(el.shadowRoot!.querySelector('[part="source-error"]')?.textContent).equal('Unable to load matrix data.');
    expect(el.shadowRoot!.querySelector('[data-source-entry]')?.getAttribute('tabindex')).equal('0');
    expect(el.exportData('csv')).equal('');
    expect(await el.revealSourceCell(0, 0)).equal(false);
  } finally { HTMLCanvasElement.prototype.getContext = original; }
});

it('keeps initial errors quiet and announces a later source failure in light DOM once', async () => {
  const source = provider(2, 2), normal = source.query;
  source.query = () => [];
  const el = await fixture<SourceHost>(html`<lr-heatmap .matrixSource=${source} .strings=${{ heatmapSourceError: 'Matrix could not load' }}></lr-heatmap>`);
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector('[part="source-error"]')));
  const liveText = () => [...document.querySelectorAll('[aria-live="polite"]')].map(node => node.textContent ?? '').join('');
  await new Promise(resolve => setTimeout(resolve, 600));
  expect(liveText()).not.contain('Matrix could not load');
  source.query = normal; el.requestUpdate();
  await waitUntil(() => el.exportData('csv') !== '');
  source.query = () => []; el.requestUpdate();
  await waitUntil(() => liveText().includes('Matrix could not load'), 'later failure announcement', { timeout: 2000 });
  let mutations = 0;
  const observer = new MutationObserver(records => { mutations += records.filter(record => (record.target as Element).closest?.('[aria-live="polite"]')).length; });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true });
  el.matrixReducer = 'max'; await el.updateComplete;
  await new Promise(resolve => setTimeout(resolve, 600)); observer.disconnect();
  expect(mutations).equal(0);
});

for (const callback of ['cellInteractive', 'cellText', 'cellColor'] as const) {
  it(`does not invoke an obsolete ${callback} returned by a reentrant getter`, async () => {
    const source = provider(2, 2), next = provider(3, 3);
    const el = await fixture<SourceHost>(html`<lr-heatmap .matrixSource=${source}></lr-heatmap>`);
    await waitUntil(() => source.queries.length === 1);
    let calls = 0;
    Object.defineProperty(el, callback, { configurable: true, get() {
      Object.defineProperty(el, callback, { configurable: true, writable: true, value: undefined });
      el.matrixSource = next;
      return () => { calls++; return callback === 'cellInteractive' ? true : 'obsolete'; };
    } });
    if (callback === 'cellColor') el.accessibleCells = true;
    else expect(await el.revealSourceCell(0, 0)).equal(false);
    await waitUntil(() => next.queries.length === 1);
    expect(calls).equal(0);
  });
}

for (const refresh of ['rebind', 'keyless'] as const) {
  it(`revokes a reveal before its first update wait on a same-source ${refresh}`, async () => {
    const source = provider(2, 2);
    const el = await fixture<SourceHost>(html`<lr-heatmap .matrixSource=${source}></lr-heatmap>`);
    await waitUntil(() => source.queries.length === 1);
    const pending = el.revealSourceCell(1, 1);
    if (refresh === 'rebind') el.matrixSource = source;
    else { el.requestUpdate(); el.matrixReducer = 'max'; }
    expect(await pending).equal(false);
    expect(source.cells.length).equal(0);
  });
}

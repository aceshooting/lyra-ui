import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { expectLocaleFallback } from '../../../../test/expected-locale-fallbacks.js';
import { nextFrame } from '../../../../test/frames.js';
import { renderedTemplateWhitespace } from '../../../../test/rendered-whitespace.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { setColorScheme, setForcedColors, setReducedMotion } from '../../../../test/wtr-media.js';
import type { LyraChart3d, LyraChart3dColumns, LyraChart3dSelectDetail } from './chart-3d.class.js';
import './chart-3d.js';

// The German fixtures intentionally render the English defaults without a registered catalog.
expectLocaleFallback('de', [
  'chart3dLabel', 'chart3dName', 'chart3dXAxis', 'chart3dYAxis', 'chart3dZAxis', 'chart3dCategory', 'chart3dRow',
  'chart3dInstructions', 'paginationLabel', 'paginationApplied', 'previous', 'next',
]);

function columns(count = 3, extra: Partial<LyraChart3dColumns> = {}): LyraChart3dColumns {
  return {
    ids: Array.from({ length: count }, (_, index) => `row-${index}`),
    x: Float32Array.from({ length: count }, (_, index) => index),
    y: Float32Array.from({ length: count }, (_, index) => index * 2),
    z: Float32Array.from({ length: count }, (_, index) => (index === 0 ? 0 : -index)),
    ...extra,
  };
}

/** A deliberately malformed shell for the error states; the component must report, not draw, it. */
const malformed = (value: Record<string, unknown>) => value as unknown as LyraChart3dColumns;

const part = (el: LyraChart3d, name: string) => el.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`);
const parts = (el: LyraChart3d, name: string) => Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>(`[part~="${name}"]`));
const text = (el: LyraChart3d, name: string) => part(el, name)?.textContent?.trim() ?? null;
const headers = (el: LyraChart3d) => Array.from(el.shadowRoot!.querySelectorAll('thead th')).map((cell) => cell.textContent!.trim());
const buttonIds = (el: LyraChart3d) => parts(el, 'row-button').map((button) => button.dataset['id']);
const pressed = (el: LyraChart3d) => parts(el, 'row-button').map((button) => button.getAttribute('aria-pressed'));
const cells = (el: LyraChart3d, row: number) =>
  Array.from(parts(el, 'row')[row]!.querySelectorAll('td')).map((cell) => cell.textContent!.trim());
const cursorText = (el: LyraChart3d) => text(el, 'cursor');

function record<T = unknown>(el: Element, name: string): T[] {
  const details: T[] = [];
  el.addEventListener(name, (event) => details.push((event as CustomEvent<T>).detail));
  return details;
}

async function mount(data: LyraChart3dColumns | null = columns(), attributes = ''): Promise<LyraChart3d> {
  const wrapper = await fixture<HTMLElement>(html`<div></div>`);
  const el = document.createElement('lr-chart-3d') as LyraChart3d;
  for (const entry of attributes.split(/\s+/).filter(Boolean)) {
    const [name, value = ''] = entry.split('=');
    el.setAttribute(name!, value.replaceAll('"', ''));
  }
  el.data = data;
  wrapper.append(el);
  await el.updateComplete;
  return el;
}

describe('lr-chart-3d data table', () => {
  it('renders the accessible table by default, loads no renderer and passes axe on populated data', async () => {
    const el = await fixture<LyraChart3d>(html`<lr-chart-3d lang="en" label="Measurements" .data=${columns(3, { labels: ['North', 'East', 'South'] })}></lr-chart-3d>`);
    expect([el.engine, el.type]).to.deep.equal(['builtin', 'scatter']);
    expect(part(el, 'engine') === null).to.equal(true);
    expect(headers(el)).to.deep.equal(['Label', 'X', 'Y', 'Z', 'Category']);
    expect(buttonIds(el)).to.deep.equal(['row-0', 'row-1', 'row-2']);
    expect(parts(el, 'row-button').map((button) => button.textContent!.trim())).to.deep.equal(['North', 'East', 'South']);
    expect(cells(el, 1)).to.deep.equal(['1', '2', '-1', '—']);
    expect(part(el, 'base')!.getAttribute('aria-busy')).to.equal('false');
    await expect(el).to.be.accessible();
  });

  it('adds the diameter column for bubble charts, names categories and renders both aria-pressed values', async () => {
    const el = await fixture<LyraChart3d>(html`<lr-chart-3d lang="en" type="bubble" selected-id="row-1" .data=${columns(3, {
      size: Float32Array.of(8, 16, 24), category: Uint16Array.of(0, 1, 0), categories: ['Control', 'Treatment'],
    })}></lr-chart-3d>`);
    expect(headers(el)).to.deep.equal(['Label', 'X', 'Y', 'Z', 'Diameter (CSS pixels)', 'Category']);
    expect(cells(el, 0)).to.deep.equal(['0', '0', '0', '8', 'Control']);
    expect(cells(el, 1)[4]).to.equal('Treatment');
    expect(pressed(el)).to.deep.equal(['false', 'true', 'false']);
    await expect(el).to.be.accessible();
    el.type = 'line';
    await el.updateComplete;
    expect(headers(el)).to.deep.equal(['Label', 'X', 'Y', 'Z', 'Category']);
  });

  it('normalizes type and engine attributes so a typo never opts into a download', () => {
    // A detached element never renders, so no renderer can start for the opt-in value.
    const el = document.createElement('lr-chart-3d') as LyraChart3d;
    el.setAttribute('type', 'pie');
    el.setAttribute('engine', 'gl');
    expect([el.type, el.engine]).to.deep.equal(['scatter', 'builtin']);
    el.setAttribute('type', 'line');
    el.setAttribute('engine', 'webgl');
    expect([el.type, el.engine]).to.deep.equal(['line', 'webgl']);
    el.engine = 'oops' as never;
    el.type = 'bar' as never;
    expect([el.type, el.engine]).to.deep.equal(['scatter', 'builtin']);
  });

  it('names the group, scrollable region and caption from the host aria-label, then label, then the localized default', async () => {
    const el = await mount();
    const names = () => [
      part(el, 'base')!.getAttribute('aria-label'),
      part(el, 'table-container')!.getAttribute('aria-label'),
      el.shadowRoot!.querySelector('caption')!.textContent!.trim(),
    ];
    expect(names()).to.deep.equal(Array(3).fill('Three-dimensional chart'));
    await expect(el).to.be.accessible();
    el.label = 'Coordinates';
    await el.updateComplete;
    expect(names()).to.deep.equal(Array(3).fill('Coordinates'));
    el.setAttribute('aria-label', 'Measurements');
    await el.updateComplete;
    expect(names()).to.deep.equal(Array(3).fill('Measurements'));
    el.setAttribute('aria-label', '   ');
    await el.updateComplete;
    expect(names()).to.deep.equal(Array(3).fill('Coordinates'));
    el.removeAttribute('aria-label');
    el.label = undefined;
    await el.updateComplete;
    expect(names()).to.deep.equal(Array(3).fill('Three-dimensional chart'));
  });

  it('shows English with no locale registered and lets .strings reach every rendered message', async () => {
    const el = await mount(columns(3, { size: Float32Array.of(1, 2, 3) }), 'type=bubble');
    expect(headers(el)).to.deep.equal(['Label', 'X', 'Y', 'Z', 'Diameter (CSS pixels)', 'Category']);
    expect(cursorText(el)).to.equal('row-0, row 1 of 3');
    expect(text(el, 'instructions')).to.contain('Use arrow keys to move between rows');
    expect(part(el, 'pagination')!.getAttribute('aria-label')).to.equal('Pagination');
    expect(parts(el, 'page-button').map((button) => button.textContent!.trim())).to.deep.equal(['Previous', 'Next']);
    expect(part(el, 'pagination')!.querySelector('span')!.textContent!.trim()).to.equal('Page 1 of 1');
    el.strings = {
      chart3dLabel: 'Graphique 3D', chart3dName: 'Nom', chart3dXAxis: 'Axe X', chart3dYAxis: 'Axe Y', chart3dZAxis: 'Axe Z',
      chart3dSize: 'Diamètre', chart3dCategory: 'Catégorie', chart3dInstructions: 'Utilisez les flèches.',
      chart3dRow: '{label} : ligne {index} sur {total}', paginationLabel: 'Pages', previous: 'Précédent', next: 'Suivant',
      paginationApplied: 'Page {page} sur {totalPages}',
    };
    await el.updateComplete;
    expect(headers(el)).to.deep.equal(['Nom', 'Axe X', 'Axe Y', 'Axe Z', 'Diamètre', 'Catégorie']);
    expect(cursorText(el)).to.equal('row-0 : ligne 1 sur 3');
    expect(text(el, 'instructions')).to.equal('Utilisez les flèches.');
    expect(part(el, 'base')!.getAttribute('aria-label')).to.equal('Graphique 3D');
    expect(part(el, 'pagination')!.getAttribute('aria-label')).to.equal('Pages');
    expect(parts(el, 'page-button').map((button) => button.textContent!.trim())).to.deep.equal(['Précédent', 'Suivant']);
    expect(part(el, 'pagination')!.querySelector('span')!.textContent!.trim()).to.equal('Page 1 sur 1');
  });

  it('formats numbers in the effective locale and titles axes with their units', async () => {
    const el = await fixture<LyraChart3d>(html`<lr-chart-3d lang="de" .xAxis=${{ label: 'Distance', unit: 'km' }}
      .data=${columns(3, { x: Float32Array.of(1.5, 2, 3) })}></lr-chart-3d>`);
    expect(headers(el).slice(0, 2)).to.deep.equal(['Label', 'Distance (km)']);
    expect(cells(el, 0)[0]).to.equal('1,5');
    el.xAxis = { label: 'Height', unit: '' };
    el.yAxis = { unit: 'm' };
    await el.updateComplete;
    expect(headers(el).slice(0, 3)).to.deep.equal(['Label', 'Height', 'Y (m)']);
  });

  it('reports an empty, fully filtered and invalid state separately and recovers when valid data arrives', async () => {
    const el = await mount(null);
    expect(text(el, 'empty')).to.equal('No visible chart data.');
    expect(el.shadowRoot!.querySelector('table') === null).to.equal(true);
    el.strings = { chart3dEmpty: 'No samples' };
    await el.updateComplete;
    expect(text(el, 'empty')).to.equal('No samples');
    await expect(el).to.be.accessible();
    el.data = columns(0);
    await el.updateComplete;
    expect(text(el, 'empty')).to.equal('No samples');
    el.data = malformed({ ...columns(), x: new Float32Array([Number.NaN, 1, 2]) });
    await el.updateComplete;
    expect(part(el, 'empty') === null).to.equal(true);
    expect(text(el, 'error')).to.contain('data.x');
    expect(el.shadowRoot!.querySelector('table') === null).to.equal(true);
    await expect(el).to.be.accessible();
    el.data = columns(2);
    await el.updateComplete;
    expect([part(el, 'error') === null, parts(el, 'row').length]).to.deep.equal([true, 2]);
    el.data = columns(2, { category: Uint16Array.of(1, 1), categories: ['a', 'b'] });
    el.hiddenCategories = new Set([1]);
    await el.updateComplete;
    expect(text(el, 'empty')).to.equal('No samples');
  });

  it('names the invalid column and reports the row ceiling with grouped digits', async () => {
    const el = await mount(null);
    for (const [value, column] of [
      [{ ...columns(), z: undefined }, 'data.z'],
      [{ ...columns(), ids: ['a', 'a', 'c'] }, 'data.ids'],
      [{ ...columns(), size: new Float32Array([1, 2, 1025]) }, 'data.size'],
      [{ ...columns(), labels: ['only'] }, 'data.labels'],
      [{ ...columns(), x: new Float64Array(3) }, 'data.x'],
    ] as const) {
      el.data = malformed({ ...value });
      await el.updateComplete;
      expect(text(el, 'error'), column).to.contain(column);
    }
    el.data = malformed({ ...columns(), ids: Array(1_000_001) });
    await el.updateComplete;
    expect(text(el, 'error')).to.match(/1.000.000/);
  });

  it('announces a data error assertively only after the first render', async () => {
    const el = await mount(malformed({ ...columns(), labels: ['only'] }));
    expect(text(el, 'error')).to.contain('data.labels');
    el.data = columns();
    await el.updateComplete;
    el.data = malformed({ ...columns(), ids: ['a', 'a', 'c'] });
    await el.updateComplete;
    await waitUntil(() => document.querySelector('[data-lr-live-region="assertive"]')?.textContent?.includes('data.ids') === true);
    expect(document.querySelector('[data-lr-live-region="assertive"]')?.textContent?.includes('data.labels')).to.equal(false);
  });
});

describe('lr-chart-3d selection and hidden categories', () => {
  it('selects through the row button with the original source index and keeps programmatic writes silent', async () => {
    const el = await mount(columns(4));
    const selections = record<LyraChart3dSelectDetail>(el, 'lr-chart-row-select');
    parts(el, 'row-button')[2]!.click();
    await el.updateComplete;
    expect(selections).to.deep.equal([{ id: 'row-2', index: 2 }]);
    expect(Object.isFrozen(selections[0])).to.equal(true);
    expect([el.selectedId, pressed(el)]).to.deep.equal(['row-2', ['false', 'false', 'true', 'false']]);
    el.selectedId = 'row-3';
    await el.updateComplete;
    expect(pressed(el)).to.deep.equal(['false', 'false', 'false', 'true']);
    expect(cursorText(el)).to.equal('row-3, row 4 of 4');
    el.selectedId = 'missing';
    await el.updateComplete;
    expect(pressed(el)).to.deep.equal(['false', 'false', 'false', 'false']);
    expect(selections.length).to.equal(1);
  });

  it('hides categories without changing the identity or source index of the remaining rows', async () => {
    const el = await mount(columns(4, { category: Uint16Array.of(0, 1, 0, 1), categories: ['A', 'B'] }));
    const selections = record<LyraChart3dSelectDetail>(el, 'lr-chart-row-select');
    el.hiddenCategories = new Set([0]);
    await el.updateComplete;
    expect(buttonIds(el)).to.deep.equal(['row-1', 'row-3']);
    expect(cursorText(el)).to.equal('row-1, row 1 of 2');
    parts(el, 'row-button')[1]!.click();
    await el.updateComplete;
    expect(selections).to.deep.equal([{ id: 'row-3', index: 3 }]);
    el.hiddenCategories = new Set();
    await el.updateComplete;
    expect(buttonIds(el)).to.deep.equal(['row-0', 'row-1', 'row-2', 'row-3']);
    expect(cursorText(el)).to.equal('row-3, row 4 of 4');
    expect(selections.length).to.equal(1);
  });

  it('ignores values that are not valid category indices and returns a detached copy', async () => {
    const el = await mount(columns(2, { category: Uint16Array.of(0, 1), categories: ['A', 'B'] }));
    el.hiddenCategories = new Set([-1, 1.5, 70000, Number.NaN, 0]);
    await el.updateComplete;
    expect([...el.hiddenCategories]).to.deep.equal([0]);
    expect(buttonIds(el)).to.deep.equal(['row-1']);
    (el.hiddenCategories as Set<number>).add(1);
    expect([...el.hiddenCategories]).to.deep.equal([0]);
    el.hiddenCategories = {} as unknown as ReadonlySet<number>;
    await el.updateComplete;
    expect([...el.hiddenCategories, parts(el, 'row').length]).to.deep.equal([2]);
  });

  it('leaves the rendered DOM unchanged when unset inputs are assigned their defaults', async () => {
    const el = await mount(columns(3, { category: Uint16Array.of(0, 1, 0), categories: ['A', 'B'] }));
    const before = el.shadowRoot!.innerHTML;
    el.hiddenCategories = new Set();
    el.xAxis = {};
    el.yAxis = { label: '', unit: '' };
    el.zAxis = {};
    el.camera = undefined;
    await el.updateComplete;
    expect(el.shadowRoot!.innerHTML).to.equal(before);
    expect([el.camera, [...el.hiddenCategories], el.selectedId, el.label]).to.deep.equal([undefined, [], '', undefined]);
  });
});

describe('lr-chart-3d keyboard', () => {
  it('moves one cursor through every row, paging the table with it, and selects with Enter', async () => {
    const el = await mount(columns(405));
    const selections = record<LyraChart3dSelectDetail>(el, 'lr-chart-row-select');
    const cursor = part(el, 'cursor')!;
    await focusByKeyboard(cursor);
    await sendKeys({ press: 'ArrowDown' });
    await waitUntil(() => cursor.textContent!.trim() === 'row-1, row 2 of 405');
    await sendKeys({ press: 'ArrowUp' });
    await sendKeys({ press: 'ArrowUp' });
    await waitUntil(() => cursor.textContent!.trim() === 'row-0, row 1 of 405');
    await sendKeys({ press: 'End' });
    await waitUntil(() => cursor.textContent!.trim() === 'row-404, row 405 of 405');
    await el.updateComplete;
    expect([parts(el, 'row').length, buttonIds(el)[0]]).to.deep.equal([5, 'row-400']);
    expect(part(el, 'pagination')!.querySelector('span')!.textContent!.trim()).to.equal('Page 3 of 3');
    await sendKeys({ press: 'ArrowDown' });
    await sendKeys({ press: 'Home' });
    await waitUntil(() => cursor.textContent!.trim() === 'row-0, row 1 of 405');
    await sendKeys({ press: 'PageDown' });
    await waitUntil(() => cursor.textContent!.trim() === 'row-200, row 201 of 405');
    await el.updateComplete;
    expect([parts(el, 'row').length, buttonIds(el)[0]]).to.deep.equal([200, 'row-200']);
    await expect(el).to.be.accessible();
    await sendKeys({ press: 'PageUp' });
    await waitUntil(() => cursor.textContent!.trim() === 'row-0, row 1 of 405');
    expect(selections.length).to.equal(0);
    await sendKeys({ press: 'PageDown' });
    await sendKeys({ press: 'Enter' });
    await el.updateComplete;
    expect(selections).to.deep.equal([{ id: 'row-200', index: 200 }]);
    expect(buttonIds(el)[0]).to.equal('row-200');
    expect(pressed(el)[0]).to.equal('true');
  });

  it('activates exactly once with Space', async () => {
    const el = await mount(columns(3));
    const selections = record<LyraChart3dSelectDetail>(el, 'lr-chart-row-select');
    const cursor = part(el, 'cursor')!;
    await focusByKeyboard(cursor);
    await sendKeys({ press: 'ArrowDown' });
    await waitUntil(() => cursor.textContent!.includes('row 2 of 3'));
    await sendKeys({ press: 'Space' });
    await el.updateComplete;
    await aTimeout(30);
    expect(selections).to.deep.equal([{ id: 'row-1', index: 1 }]);
  });

  it('clamps at both ends and ignores arrows pressed with a modifier', async () => {
    const el = await mount(columns(3));
    const cursor = part(el, 'cursor')!;
    await focusByKeyboard(cursor);
    await sendKeys({ press: 'ArrowUp' });
    await sendKeys({ press: 'ArrowLeft' });
    await el.updateComplete;
    expect(cursor.textContent!.trim()).to.equal('row-0, row 1 of 3');
    await sendKeys({ down: 'Alt' });
    await sendKeys({ press: 'ArrowDown' });
    await sendKeys({ up: 'Alt' });
    await el.updateComplete;
    expect(cursor.textContent!.trim()).to.equal('row-0, row 1 of 3');
    await sendKeys({ press: 'End' });
    await sendKeys({ press: 'ArrowDown' });
    await sendKeys({ press: 'ArrowRight' });
    await waitUntil(() => cursor.textContent!.trim() === 'row-2, row 3 of 3');
  });

  it('swaps the horizontal arrows under RTL and leaves them in LTR order otherwise', async () => {
    const rtl = await fixture<HTMLElement>(html`<div dir="rtl"><lr-chart-3d .data=${columns(3)}></lr-chart-3d></div>`);
    const el = rtl.querySelector<LyraChart3d>('lr-chart-3d')!;
    await el.updateComplete;
    const cursor = part(el, 'cursor')!;
    await focusByKeyboard(cursor);
    await sendKeys({ press: 'ArrowRight' });
    await el.updateComplete;
    expect(cursor.textContent!.trim()).to.equal('row-0, row 1 of 3');
    await sendKeys({ press: 'ArrowLeft' });
    await waitUntil(() => cursor.textContent!.trim() === 'row-1, row 2 of 3');
    await sendKeys({ press: 'ArrowDown' });
    await waitUntil(() => cursor.textContent!.trim() === 'row-2, row 3 of 3');
    const ltr = await mount(columns(3));
    const ltrCursor = part(ltr, 'cursor')!;
    await focusByKeyboard(ltrCursor);
    await sendKeys({ press: 'ArrowRight' });
    await waitUntil(() => ltrCursor.textContent!.trim() === 'row-1, row 2 of 3');
    await sendKeys({ press: 'ArrowLeft' });
    await waitUntil(() => ltrCursor.textContent!.trim() === 'row-0, row 1 of 3');
  });

  it('announces the row the cursor moved to without announcing the first render', async () => {
    const el = await mount(columns(3));
    const live = () => document.querySelector('[data-lr-live-region="polite"]')?.textContent ?? '';
    expect(live()).to.not.contain('row-1, row 2 of 3');
    await focusByKeyboard(part(el, 'cursor')!);
    await sendKeys({ press: 'ArrowDown' });
    await waitUntil(() => live().includes('row-1, row 2 of 3'));
  });

  it('clamps the cursor when the data shrinks below it', async () => {
    const el = await mount(columns(5));
    const cursor = part(el, 'cursor')!;
    await focusByKeyboard(cursor);
    await sendKeys({ press: 'End' });
    await waitUntil(() => cursor.textContent!.includes('row 5 of 5'));
    el.data = columns(2);
    await el.updateComplete;
    expect(cursor.textContent!.trim()).to.equal('row-0, row 1 of 2');
    await sendKeys({ press: 'ArrowDown' });
    await waitUntil(() => cursor.textContent!.trim() === 'row-1, row 2 of 2');
  });
});

describe('lr-chart-3d public methods', () => {
  it('fits and focuses silently without any renderer, moving the cursor and table page', async () => {
    const el = await mount(columns(405));
    const events = record(el, 'lr-camera-change');
    const selections = record(el, 'lr-chart-row-select');
    el.fit();
    expect(el.camera !== undefined && Number.isFinite(el.camera.distance) && el.camera.distance > 0).to.equal(true);
    expect(el.focusRow('row-300')).to.equal(true);
    await el.updateComplete;
    expect(cursorText(el)).to.equal('row-300, row 301 of 405');
    expect(buttonIds(el)[0]).to.equal('row-200');
    expect(el.camera!.target).to.deep.equal({ x: 300 / 404 - 202 / 404, y: (600 / 404 - 404 / 404) * -1, z: -300 / 404 - -202 / 404 });
    expect(el.focusRow('missing')).to.equal(false);
    expect(el.focusRow('')).to.equal(false);
    expect([events.length, selections.length]).to.deep.equal([0, 0]);
  });

  it('cannot focus a hidden row and reports false before data arrives', async () => {
    const el = await mount(null);
    expect(el.focusRow('row-0')).to.equal(false);
    el.data = columns(2, { category: Uint16Array.of(0, 1), categories: ['A', 'B'] });
    el.hiddenCategories = new Set([1]);
    await el.updateComplete;
    expect([el.focusRow('row-1'), el.focusRow('row-0')]).to.deep.equal([false, true]);
  });

  it('normalizes written cameras silently', async () => {
    const el = await mount();
    const events = record(el, 'lr-camera-change');
    el.camera = { yaw: Number.NaN, pitch: 9, distance: -4, target: { x: 1, y: Number.POSITIVE_INFINITY, z: 3 } };
    await el.updateComplete;
    expect(el.camera!.yaw).to.equal(0);
    expect(el.camera!.pitch).to.be.below(Math.PI / 2);
    expect(el.camera!.distance).to.be.above(0);
    expect(el.camera!.target).to.deep.equal({ x: 1, y: 0, z: 3 });
    el.camera = undefined;
    expect([el.camera, events.length]).to.deep.equal([undefined, 0]);
  });
});

describe('lr-chart-3d allocation', () => {
  const long = 'unbroken-'.repeat(12);
  const hostile = () => columns(30, {
    ids: Array.from({ length: 30 }, (_, index) => `${long}${index}`),
    labels: Array.from({ length: 30 }, (_, index) => `${long}label-${index}`),
    category: Uint16Array.from({ length: 30 }, (_, index) => index % 2),
    categories: [`${long}one`, `${long}two`],
  });

  it('contains long content inside a 320px allocation and keeps every control reachable', async () => {
    const wrapper = await fixture<HTMLElement>(html`<div style="inline-size:320px"><lr-chart-3d
      lang="en" type="bubble" .xAxis=${{ label: `${long}axis`, unit: 'kilometres' }}
      .data=${{ ...hostile(), size: new Float32Array(30).fill(10) }}></lr-chart-3d></div>`);
    const el = wrapper.querySelector<LyraChart3d>('lr-chart-3d')!;
    await el.updateComplete;
    const box = el.getBoundingClientRect();
    expect(box.width).to.be.at.most(320);
    expect(el.scrollWidth).to.be.at.most(el.clientWidth + 1);
    expect(part(el, 'table-container')!.getBoundingClientRect().width).to.be.at.most(320);
    expect(part(el, 'cursor')!.getBoundingClientRect().width).to.be.at.most(320);
    expect(part(el, 'cursor')!.getBoundingClientRect().height).to.be.at.least(36 - 1);
    await expect(el).to.be.accessible();
  });

  it('stacks its controls in a compact allocation and keeps them in a row otherwise', async () => {
    const wrapper = await fixture<HTMLElement>(html`<div style="inline-size:288px"><lr-chart-3d .data=${columns()}></lr-chart-3d></div>`);
    const el = wrapper.querySelector<LyraChart3d>('lr-chart-3d')!;
    await el.updateComplete;
    expect(getComputedStyle(part(el, 'toolbar')!).flexDirection).to.equal('column');
    wrapper.style.inlineSize = '420px';
    await nextFrame();
    expect(getComputedStyle(part(el, 'toolbar')!).flexDirection).to.equal('row');
  });

  it('keeps a usable width when a shrink-to-fit parent gives it no intrinsic size', async () => {
    const wrapper = await fixture<HTMLElement>(html`<div style="display:grid;place-items:center;inline-size:640px"><lr-chart-3d .data=${columns()}></lr-chart-3d></div>`);
    const el = wrapper.querySelector<LyraChart3d>('lr-chart-3d')!;
    await el.updateComplete;
    expect(el.getBoundingClientRect().width).to.be.above(100);
  });

  it('reflows with an enlarged root font size', async () => {
    const root = document.documentElement;
    const previous = root.style.fontSize;
    root.style.fontSize = '24px';
    try {
      const wrapper = await fixture<HTMLElement>(html`<div style="inline-size:320px"><lr-chart-3d .data=${hostile()}></lr-chart-3d></div>`);
      const el = wrapper.querySelector<LyraChart3d>('lr-chart-3d')!;
      await el.updateComplete;
      expect(el.getBoundingClientRect().width).to.be.at.most(320);
      expect(el.scrollWidth).to.be.at.most(el.clientWidth + 1);
    } finally {
      root.style.fontSize = previous;
    }
  });

  it('renders no template-formatting whitespace in a populated or empty state', async () => {
    const el = await mount();
    expect(renderedTemplateWhitespace(el.shadowRoot!)).to.deep.equal([]);
    el.data = null;
    await el.updateComplete;
    expect(renderedTemplateWhitespace(el.shadowRoot!)).to.deep.equal([]);
    const wrapped = await fixture<HTMLElement>(html`<div style="white-space:pre-wrap"><lr-chart-3d .data=${columns()}></lr-chart-3d></div>`);
    const inner = wrapped.querySelector<LyraChart3d>('lr-chart-3d')!;
    await inner.updateComplete;
    expect(renderedTemplateWhitespace(inner.shadowRoot!)).to.deep.equal([]);
  });
});

describe('lr-chart-3d theme, forced colors and motion', () => {
  it('follows the color scheme through its tokens', async () => {
    const el = await mount(columns(3), 'selected-id=row-1');
    await setColorScheme('light');
    try {
      await nextFrame();
      const surface = (style: CSSStyleDeclaration) => [style.color, style.backgroundColor].join('|');
      const read = () => [
        surface(getComputedStyle(part(el, 'base')!)),
        surface(getComputedStyle(parts(el, 'row-button')[0]!)),
        surface(getComputedStyle(parts(el, 'row-button')[1]!)),
      ];
      const light = read();
      await setColorScheme('dark');
      await nextFrame();
      await waitUntil(() => read().join('/') !== light.join('/'));
      const dark = read();
      expect(dark[0]).to.not.equal(light[0]);
      expect(dark[2]).to.not.equal(dark[1]);
    } finally {
      await setColorScheme('no-preference');
    }
  });

  it('marks the selected row with a system-color outline under forced colors', async function () {
    const el = await mount(columns(3), 'selected-id=row-1');
    const outline = () => parts(el, 'row-button').map((button) => getComputedStyle(button).outlineStyle);
    expect(outline()).to.deep.equal(['none', 'none', 'none']);
    try {
      await setForcedColors('active');
    } catch {
      this.skip();
    }
    try {
      if (!matchMedia('(forced-colors: active)').matches) this.skip();
      await nextFrame();
      expect(outline()).to.deep.equal(['none', 'solid', 'none']);
      expect(getComputedStyle(parts(el, 'row-button')[1]!).outlineWidth).to.not.equal('0px');
    } finally {
      await setForcedColors('none');
    }
  });

  it('collapses its interaction transition under reduced motion and keeps it otherwise', async () => {
    const el = await mount(columns(3));
    const durations = () => getComputedStyle(parts(el, 'row-button')[0]!).transitionDuration.split(',').map((value) => Number.parseFloat(value));
    await setReducedMotion('no-preference');
    try {
      await nextFrame();
      expect(matchMedia('(prefers-reduced-motion: no-preference)').matches).to.equal(true);
      expect(durations().every((value) => value > 0.05)).to.equal(true);
      await setReducedMotion('reduce');
      expect(matchMedia('(prefers-reduced-motion: reduce)').matches).to.equal(true);
      await nextFrame();
      await waitUntil(() => durations().every((value) => value < 0.001));
    } finally {
      await setReducedMotion('no-preference');
    }
  });
});

describe('lr-chart-3d lifecycle', () => {
  it('keeps its selection through a disconnect and reconnect and still responds to the keyboard', async () => {
    const el = await mount(columns(4), 'selected-id=row-2');
    const parent = el.parentElement!;
    el.remove();
    parent.append(el);
    await el.updateComplete;
    expect(el.selectedId).to.equal('row-2');
    expect(pressed(el)).to.deep.equal(['false', 'false', 'true', 'false']);
    const cursor = part(el, 'cursor')!;
    await focusByKeyboard(cursor);
    await sendKeys({ press: 'ArrowDown' });
    await waitUntil(() => cursor.textContent!.includes('row 4 of 4'));
  });

  it('treats re-assigning the same data object as a no-op and a new object as a replacement', async () => {
    const data = columns(3);
    const el = await mount(data);
    const before = el.shadowRoot!.innerHTML;
    el.data = data;
    await el.updateComplete;
    expect(el.shadowRoot!.innerHTML).to.equal(before);
    const replacement = columns(2);
    el.data = replacement;
    await el.updateComplete;
    expect(buttonIds(el)).to.deep.equal(['row-0', 'row-1']);
    expect(el.data === replacement && !Object.isFrozen(replacement)).to.equal(true);
  });

  it('keeps the newest data assignment when admission reflection re-enters the setter', async () => {
    const el = await mount(null);
    const newer = columns(1, { ids: ['newest'] });
    let entered = false;
    const older = new Proxy(columns(), {
      getOwnPropertyDescriptor(target, key) {
        if (!entered) {
          entered = true;
          el.data = newer;
        }
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    el.data = older;
    await el.updateComplete;
    expect(el.data === newer).to.equal(true);
    expect(buttonIds(el)).to.deep.equal(['newest']);
  });
});

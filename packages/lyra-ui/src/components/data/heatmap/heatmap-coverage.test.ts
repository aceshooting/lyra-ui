import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './heatmap.js';
import type { LyraHeatmap } from './heatmap.js';

async function settleFrames(frames = 4): Promise<void> {
  for (let frame = 0; frame < frames; frame++) await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

/** Every theme token the canvas palette is derived from, emptied: the built-in palette must then
 *  take over rather than painting from an unresolved `var()`. */
const EMPTY_THEME = [
  '--lr-color-brand-quiet', '--lr-color-brand', '--lr-color-no-data', '--lr-size-10px', '--lr-font',
  '--lr-focus-ring-color', '--lr-color-danger', '--lr-color-success', '--lr-color-surface',
].map((name) => `${name}:;`).join('');

/** The documented built-in palette, spelled through the public tokens instead. */
const EXPLICIT_PALETTE = [
  '--lr-heatmap-scale-lo:#cde2fb', '--lr-heatmap-scale-hi:#0969da',
  '--lr-heatmap-no-data-fill:rgba(128,128,128,0.25)', '--lr-heatmap-label-font:10px system-ui, sans-serif',
  '--lr-heatmap-sticky-label-bg:#ffffff', '--lr-heatmap-focus-ring-color:#0969da',
  '--lr-heatmap-annotation-color:#cf222e', '--lr-heatmap-selected-color:#1a7f37',
].join(';');

const matrix = {
  kind: 'matrix' as const,
  rowLabels: ['Row'],
  colLabels: ['Low', 'High', 'None'],
  values: [[0, 10, Number.NaN]],
};

async function paintedMatrix(style: string): Promise<LyraHeatmap> {
  const el = await fixture<LyraHeatmap>(html`<lr-heatmap cell-size="22" sticky-labels="both" style=${style}
    .data=${matrix} .annotations=${[{ row: 0, col: 0 }]} .selectedCell=${{ row: 0, col: 1 }}></lr-heatmap>`);
  await waitUntil(() => el.matrixGeometry !== undefined);
  el.shadowRoot!.querySelector('canvas')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await el.updateComplete;
  await settleFrames();
  return el;
}

function surfaces(el: LyraHeatmap): string[] {
  return [...el.shadowRoot!.querySelectorAll<HTMLCanvasElement>('canvas')].map((canvas) => canvas.toDataURL());
}

it('paints the built-in palette when the theme supplies none of the tokens it derives from', async () => {
  const bare = await paintedMatrix(`display:block;${EMPTY_THEME}`);
  const cs = getComputedStyle(bare);
  expect(cs.getPropertyValue('--_lr-heatmap-scale-lo').trim(), 'precondition: ramp token unresolved').to.equal('');
  expect(cs.getPropertyValue('--_lr-heatmap-selected-color').trim(), 'precondition: ring token unresolved').to.equal('');
  const reference = await paintedMatrix(`display:block;${EXPLICIT_PALETTE}`);
  expect(bare.matrixGeometry!.padLeft).to.equal(reference.matrixGeometry!.padLeft);
  const painted = surfaces(bare);
  const expected = surfaces(reference);
  expect(painted.length).to.equal(expected.length);
  expect(painted.length).to.be.greaterThan(0);
  painted.forEach((url, index) => expect(url === expected[index], `canvas ${index} matches the built-in palette`).to.equal(true));
});

it('lets an unmeasurable host keep the whole weekday label instead of capping it to zero', async () => {
  const days = [{ date: '2026-01-05', value: 3 }];
  const data = {
    kind: 'calendar' as const,
    days,
    weekdayLabelWidth: 'auto' as const,
    weekdayLabelText: () => 'Wednesday (localized long label)',
  };
  const narrow = await fixture<LyraHeatmap>(html`<lr-heatmap cell-size="20" style="display:block;inline-size:90px" .data=${data}></lr-heatmap>`);
  await waitUntil(() => narrow.calendarGeometry !== undefined);
  const inline = await fixture<LyraHeatmap>(html`<lr-heatmap cell-size="20" style="display:inline" .data=${data}></lr-heatmap>`);
  await waitUntil(() => inline.calendarGeometry !== undefined);
  expect(inline.clientWidth).to.equal(0);
  expect(narrow.calendarGeometry!.padLeft).to.be.greaterThan(28);
  expect(inline.calendarGeometry!.padLeft).to.be.greaterThan(narrow.calendarGeometry!.padLeft);
});

it('keeps a stale fitted matrix frame contained only while it still fits, until it scrolls into view', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`<div>
    <div style="block-size:3000px"></div>
    <lr-heatmap fit-to-width style="display:block;inline-size:320px" .data=${matrix}></lr-heatmap>
  </div>`);
  const el = wrapper.querySelector<LyraHeatmap>('lr-heatmap')!;
  await waitUntil(() => el.matrixGeometry !== undefined);
  await settleFrames(6);
  const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  const wide = {
    kind: 'matrix' as const,
    rowLabels: ['Row'],
    colLabels: Array.from({ length: 120 }, (_, index) => `C${index}`),
    values: [Array.from({ length: 120 }, (_, index) => index)],
  };
  el.data = wide;
  await el.updateComplete;
  await settleFrames();
  expect(base.hasAttribute('data-fit-frame-contained'), 'a matrix wider than the host is never clipped').to.equal(false);
  el.data = matrix;
  await el.updateComplete;
  await waitUntil(() => base.hasAttribute('data-fit-frame-contained'), 'a matrix that fits is contained while its redraw is deferred');
  el.scrollIntoView();
  await waitUntil(() => !base.hasAttribute('data-fit-frame-contained'), 'the real redraw releases the containment');
});

import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './heatmap.js';
import type { LyraHeatmap } from './heatmap.js';

const data = { kind: 'matrix' as const, rowLabels: ['Row'], colLabels: ['First', 'Second'], values: [[1, 2]] };

async function selectionFixture(accessible = true) {
  const el = await fixture<LyraHeatmap>(html`<lr-heatmap multiple .accessibleCells=${accessible}
    style="inline-size:320px" .data=${data}></lr-heatmap>`);
  await waitUntil(() => el.matrixGeometry !== undefined);
  let selections = 0, activations = 0;
  el.addEventListener('lr-selection-change', () => { selections++; });
  el.addEventListener('lr-cell-activate', () => { activations++; });
  const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  const dispatch = (type: string) => {
    const canvas = el.shadowRoot!.querySelector<HTMLCanvasElement>('[part="canvas"]')!;
    const cell = el.shadowRoot!.querySelector<HTMLElement>('[data-cell-key="matrix-0-0"]') ?? canvas;
    const rect = canvas.getBoundingClientRect(), geometry = el.matrixGeometry!;
    const init = { bubbles: true, composed: true, pointerId: 37, isPrimary: true,
      clientX: rect.x + geometry.padLeft + (geometry.cellWidth ?? geometry.cellSize - 1) / 2,
      clientY: rect.y + geometry.padTop + (geometry.cellHeight ?? (geometry.rowHeight ?? geometry.cellSize) - 1) / 2 };
    (type === 'pointerdown' ? cell : base).dispatchEvent(new PointerEvent(type, init));
  };
  const counts = () => ({ selections, activations });
  const recover = async () => {
    el.multiple = true; el.maxCells = 10000; el.data = data; el.cellInteractive = undefined; el.accessibleCells = true; el.selectedCells = [];
    await el.updateComplete;
    dispatch('pointerdown'); dispatch('pointerup');
    expect(counts()).to.deep.equal({ selections: 1, activations: 1 });
  };
  return { el, base, dispatch, counts, recover };
}

for (const boundary of ['release', 'focus'] as const) {
  for (const replacement of ['multiple', 'data', 'selectedCells', 'accessibleCells', 'cellInteractive', 'maxCells'] as const) {
    it(`discards selection when ${replacement} changes during ${boundary} and accepts a later gesture`, async () => {
      const { el, dispatch, counts, recover } = await selectionFixture(boundary === 'release');
      let changes = 0;
      const replace = () => {
        changes++;
        if (replacement === 'multiple') el.multiple = false;
        if (replacement === 'data') el.data = { ...data, values: [[8, 9]] };
        if (replacement === 'selectedCells') el.selectedCells = [{ row: 0, col: 1 }];
        if (replacement === 'accessibleCells') el.accessibleCells = !el.accessibleCells;
        if (replacement === 'cellInteractive') el.cellInteractive = () => false;
        if (replacement === 'maxCells') el.maxCells = 1;
      };
      if (boundary === 'focus') el.addEventListener('focusin', replace, { once: true });
      dispatch('pointerdown');
      if (boundary === 'release') { await el.updateComplete; replace(); }
      dispatch('pointerup');
      expect(changes).to.equal(1);
      expect(counts(), 'retired gestures cannot overwrite selection or activate a cell').to.deep.equal({ selections: 0, activations: 0 });
      await el.updateComplete;
      expect(el.shadowRoot!.querySelectorAll('[data-cell-key="matrix-0-0"][aria-selected="true"]').length).to.equal(0);
      await recover();
    });
  }
}

for (const phase of ['start', 'move'] as const) {
  it(`ignores ${phase} against a grid with a pending data replacement`, async () => {
    const { el, dispatch, counts, recover } = await selectionFixture();
    if (phase === 'move') { dispatch('pointerdown'); await el.updateComplete; }
    el.data = { ...data, values: [[8, 9]] };
    dispatch(phase === 'start' ? 'pointerdown' : 'pointermove'); dispatch('pointerup');
    expect(counts()).to.deep.equal({ selections: 0, activations: 0 });
    await recover();
  });
}

for (const phase of ['pointerdown', 'pointermove', 'pointerup'] as const) {
  it(`retires a gesture when hit testing replaces the data during ${phase}`, async () => {
    const { el, dispatch, counts, recover } = await selectionFixture();
    let armed = false, replacements = 0;
    el.cellInteractive = () => {
      if (armed) { armed = false; replacements++; el.data = { ...data, values: [[8, 9]] }; }
      return true;
    };
    await el.updateComplete;
    if (phase !== 'pointerdown') { dispatch('pointerdown'); await el.updateComplete; }
    armed = true; dispatch(phase);
    if (phase !== 'pointerup') dispatch('pointerup');
    expect(replacements).to.equal(1);
    expect(counts()).to.deep.equal({ selections: 0, activations: 0 });
    await recover();
  });
}

it('does not commit after releasing pointer capture replaces the selection', async () => {
  const { el, base, dispatch, counts, recover } = await selectionFixture();
  dispatch('pointerdown'); await el.updateComplete;
  const has = base.hasPointerCapture, release = base.releasePointerCapture;
  let releases = 0;
  try {
    base.hasPointerCapture = () => true;
    base.releasePointerCapture = () => { releases++; el.selectedCells = [{ row: 0, col: 1 }]; };
    dispatch('pointerup');
    expect(releases).to.equal(1);
    expect(counts()).to.deep.equal({ selections: 0, activations: 0 });
  } finally { base.hasPointerCapture = has; base.releasePointerCapture = release; }
  await recover();
});

it('retains cell activation when a selection listener accepts the controlled proposal', async () => {
  const { el, dispatch, counts } = await selectionFixture();
  el.addEventListener('lr-selection-change', event => { el.selectedCells = event.detail.selectedCells; });
  dispatch('pointerdown'); dispatch('pointerup');
  expect(counts()).to.deep.equal({ selections: 1, activations: 1 });
  await el.updateComplete;
  expect([...el.selectedCells]).to.deep.equal([{ row: 0, col: 0 }]);
});

it('does not activate an obsolete cell when a selection listener replaces the data', async () => {
  const { el, dispatch, counts } = await selectionFixture();
  el.addEventListener('lr-selection-change', () => { el.data = { ...data, values: [[8, 9]] }; });
  dispatch('pointerdown'); dispatch('pointerup');
  expect(counts()).to.deep.equal({ selections: 1, activations: 0 });
});

it('does not activate a cell when its final interactivity check replaces the data', async () => {
  const { el, dispatch, counts } = await selectionFixture();
  let armed = false, replacements = 0;
  el.cellInteractive = () => {
    if (armed) { armed = false; replacements++; el.data = { ...data, values: [[8, 9]] }; }
    return true;
  };
  await el.updateComplete;
  el.addEventListener('lr-selection-change', () => { armed = true; });
  dispatch('pointerdown'); dispatch('pointerup');
  expect(replacements).to.equal(1);
  expect(counts()).to.deep.equal({ selections: 1, activations: 0 });
});

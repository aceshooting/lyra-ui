import { expect, fixture, html } from '@open-wc/testing';
import './heatmap.js';
import type { LyraHeatmap } from './heatmap.js';

it('redraws rectangular focus cells when a scratch canvas cannot allocate a context', async () => {
  const heatmap = await fixture<LyraHeatmap>(html`<lr-heatmap cell-size="12" row-height="40"
    cell-radius="2"
    .data=${{
      kind: 'matrix', rowLabels: ['First', 'Second'], colLabels: ['A', 'B'],
      values: [[1, 2], [3, 4]],
    }}
    .selectedCell=${{ row: 0, col: 0 }}
    .annotations=${[{ row: 1, col: 1, label: 'Check' }]}
  ></lr-heatmap>`);
  const canvas = heatmap.shadowRoot!.querySelector<HTMLCanvasElement>('[part="canvas"]')!;
  const internals = heatmap as unknown as {
    focusedCell: { row: number; col: number };
    drawMatrix(): void;
    repaintMatrixFocusCell(pos: { row: number; col: number }): void;
  };
  internals.focusedCell = { row: 0, col: 0 };
  internals.drawMatrix();
  const previous = canvas.toDataURL();
  internals.focusedCell = { row: 1, col: 1 };
  const original = HTMLCanvasElement.prototype.getContext;
  let deniedContexts = 0;
  HTMLCanvasElement.prototype.getContext = function (
    this: HTMLCanvasElement, ...args: Parameters<HTMLCanvasElement['getContext']>
  ) {
    if (this !== canvas) { deniedContexts++; return null; }
    return original.apply(this, args);
  } as HTMLCanvasElement['getContext'];
  try {
    internals.repaintMatrixFocusCell({ row: 0, col: 0 });
    internals.repaintMatrixFocusCell({ row: 1, col: 1 });
  } finally {
    HTMLCanvasElement.prototype.getContext = original;
  }
  const fallback = canvas.toDataURL();
  expect(deniedContexts).to.be.greaterThan(0);
  expect(fallback).to.not.equal(previous);
  internals.drawMatrix();
  expect(fallback).to.equal(canvas.toDataURL());
});

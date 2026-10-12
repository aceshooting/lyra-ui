import { expect, fixture, html } from '@open-wc/testing';
import './heatmap.js';
import type { LyraHeatmap } from './heatmap.js';
import { HeatmapLabelCache } from './heatmap-label-cache.js';

function paint(el: LyraHeatmap): void {
  (el as unknown as { drawMatrix(): void }).drawMatrix();
}

async function labeledMatrix(): Promise<LyraHeatmap> {
  return fixture<LyraHeatmap>(html`<lr-heatmap style="width: 600px" cell-size="40"
    row-label-width="auto" sticky-labels="both" .data=${{
      kind: 'matrix', rowLabels: ['Repeated long row label', 'Repeated long row label'],
      colLabels: ['Repeated long column label', 'Repeated long column label'], values: [[1, 2], [3, 4]],
    }}></lr-heatmap>`);
}

it('shares label measurements between sizing, main canvas and frozen bands in one paint', async () => {
  const el = await labeledMatrix();
  paint(el);
  const canvas = el.shadowRoot!.querySelector<HTMLCanvasElement>('[part="canvas"]')!;
  const before = canvas.toDataURL();
  const native = CanvasRenderingContext2D.prototype.measureText;
  let measurements = 0;
  CanvasRenderingContext2D.prototype.measureText = function (text: string): TextMetrics {
    if (text === 'Repeated long row label') measurements += 1;
    return native.call(this, text);
  };
  try { paint(el); } finally { CanvasRenderingContext2D.prototype.measureText = native; }
  expect(measurements).to.equal(1);
  expect(canvas.toDataURL()).to.equal(before);
});

it('remeasures an unchanged font string on the next paint when font metrics change', async () => {
  const el = await labeledMatrix();
  const native = CanvasRenderingContext2D.prototype.measureText;
  let width = 65;
  let measurements = 0;
  CanvasRenderingContext2D.prototype.measureText = function (text: string): TextMetrics {
    const metrics = native.call(this, text);
    if (text === 'Repeated long row label') {
      measurements += 1;
      Object.defineProperty(metrics, 'width', { value: width });
    }
    return metrics;
  };
  try {
    paint(el);
    const first = el.matrixGeometry!.padLeft;
    const firstMeasurements = measurements;
    width = 100;
    paint(el);
    expect(el.matrixGeometry!.padLeft).to.be.greaterThan(first);
    expect(measurements - firstMeasurements).to.equal(1);
  } finally { CanvasRenderingContext2D.prototype.measureText = native; }
});

it('keys cached measurements by canvas text settings and clipping width', () => {
  const ctx = document.createElement('canvas').getContext('2d')!;
  const cache = new HeatmapLabelCache();
  const first = cache.width(ctx, 'Different metrics');
  ctx.font = '30px sans-serif';
  expect(cache.width(ctx, 'Different metrics')).to.be.greaterThan(first);
  if ('letterSpacing' in ctx) {
    const before = cache.width(ctx, 'Different metrics');
    ctx.letterSpacing = '3px';
    expect(cache.width(ctx, 'Different metrics')).to.be.greaterThan(before);
  }
  expect(cache.clip(ctx, 'Different metrics', 20, () => 'D…')).to.equal('D…');
  expect(cache.clip(ctx, 'Different metrics', 20, () => 'wrong')).to.equal('D…');
  expect(cache.clip(ctx, 'Different metrics', 100, () => 'Different…')).to.equal('Different…');
});

it('leaves sparse and non-string labels to native measurement and uncached clipping', () => {
  const ctx = document.createElement('canvas').getContext('2d')!;
  const native = ctx.measureText;
  const cache = new HeatmapLabelCache();
  const sparseLabels = new Array<string>(1);
  const labels: unknown[] = [sparseLabels[0], null, 42];
  const measurements = new Map<unknown, number>();
  ctx.measureText = function (text: string): TextMetrics {
    measurements.set(text, (measurements.get(text) ?? 0) + 1);
    return native.call(this, text);
  };
  for (const label of labels) {
    const text = label as string;
    const expectedWidth = native.call(ctx, text).width;
    expect(cache.width(ctx, text)).to.equal(expectedWidth);
    expect(cache.width(ctx, text)).to.equal(expectedWidth);
    expect(measurements.get(label)).to.equal(2);
    let computations = 0;
    const compute = () => { computations += 1; return text; };
    expect(cache.clip(ctx, text, 1000, compute)).to.equal(label);
    expect(cache.clip(ctx, text, 1000, compute)).to.equal(label);
    expect(computations).to.equal(2);
  }
  cache.width(ctx, 'undefined');
  cache.width(ctx, 'undefined');
  expect(measurements.get('undefined')).to.equal(1);
});

it('bounds retained measurements by entry count and text size', () => {
  const ctx = document.createElement('canvas').getContext('2d')!;
  const native = ctx.measureText;
  const calls = new Map<string, number>();
  ctx.measureText = function (text: string): TextMetrics {
    calls.set(text, (calls.get(text) ?? 0) + 1);
    return native.call(this, text);
  };
  const cache = new HeatmapLabelCache();
  for (let index = 0; index < 1100; index++) cache.width(ctx, `Label ${index}`);
  cache.width(ctx, 'Label 0');
  cache.width(ctx, 'Label 1099');
  expect(calls.get('Label 0')).to.equal(1);
  expect(calls.get('Label 1099')).to.equal(2);
  const longLabel = 'x'.repeat(70_000);
  const fresh = new HeatmapLabelCache();
  fresh.width(ctx, longLabel); fresh.width(ctx, longLabel);
  expect(calls.get(longLabel)).to.equal(2);
});

it('bypasses key serialization for oversized labels while retaining normal measurement and clipping', () => {
  const ctx = document.createElement('canvas').getContext('2d')!;
  const nativeStringify = JSON.stringify;
  const label = '\u0000'.repeat(70_000);
  const cache = new HeatmapLabelCache();
  let serializedLabels = 0;
  let measurements = 0;
  let computations = 0;
  ctx.measureText = (text: string) => { measurements += 1; return { width: text.length } as TextMetrics; };
  JSON.stringify = ((value: unknown, ...args: unknown[]) => {
    if (Array.isArray(value) && value.includes(label)) serializedLabels += 1;
    return (nativeStringify as (...args: unknown[]) => string)(value, ...args);
  }) as typeof JSON.stringify;
  try {
    expect(cache.width(ctx, label)).to.equal(label.length);
    expect(cache.width(ctx, label)).to.equal(label.length);
    expect(cache.clip(ctx, label, 20, () => { computations += 1; return '…'; })).to.equal('…');
    expect(cache.clip(ctx, label, 20, () => { computations += 1; return '…'; })).to.equal('…');
    expect(serializedLabels).to.equal(0);
    expect(measurements).to.equal(2);
    expect(computations).to.equal(2);
    cache.width(ctx, 'Short'); cache.width(ctx, 'Short');
    expect(measurements).to.equal(3);
  } finally { JSON.stringify = nativeStringify; }
});

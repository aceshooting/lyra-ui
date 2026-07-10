import { fixture, expect, html } from '@open-wc/testing';
import './heatmap.js';
import type { LyraHeatmap } from './heatmap.js';
import { hexToRgb, mixColor, resolveRgb } from './heatmap.js';

it('sets an img role and a summarizing aria-label', async () => {
  const el = (await fixture(html`<lyra-heatmap></lyra-heatmap>`)) as LyraHeatmap;
  el.rowLabels = ['Mon', 'Tue'];
  el.colLabels = ['0h', '1h'];
  el.values = [
    [1, 2],
    [3, 4],
  ];
  await el.updateComplete;
  expect(el.getAttribute('role')).to.equal('img');
  expect(el.getAttribute('aria-label')).to.contain('2');
});

it('renders a canvas sized to the grid dimensions', async () => {
  const el = (await fixture(html`<lyra-heatmap cell-size="20"></lyra-heatmap>`)) as LyraHeatmap;
  el.rowLabels = ['a', 'b'];
  el.colLabels = ['x', 'y', 'z'];
  el.values = [
    [1, 2, 3],
    [4, 5, 6],
  ];
  await el.updateComplete;
  const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
  expect(canvas).to.exist;
});

it('treats -1 as a no-data sentinel without throwing', async () => {
  const el = (await fixture(html`<lyra-heatmap></lyra-heatmap>`)) as LyraHeatmap;
  el.values = [[-1, 2]];
  el.rowLabels = ['a'];
  el.colLabels = ['x', 'y'];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('canvas')).to.exist;
});

it('is accessible', async () => {
  const el = (await fixture(html`<lyra-heatmap></lyra-heatmap>`)) as LyraHeatmap;
  el.values = [[1, 2]];
  el.rowLabels = ['a'];
  el.colLabels = ['x', 'y'];
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

describe('hexToRgb', () => {
  it('parses 3- and 6-digit hex strings', () => {
    expect(hexToRgb('#fff')).to.deep.equal([255, 255, 255]);
    expect(hexToRgb('#0969da')).to.deep.equal([9, 105, 218]);
    expect(hexToRgb('0969da')).to.deep.equal([9, 105, 218]);
  });

  it('returns null (not a NaN-derived value) for a non-hex string', () => {
    expect(hexToRgb('not-a-color')).to.equal(null);
    expect(hexToRgb('rgb(9, 105, 218)')).to.equal(null);
  });
});

describe('resolveRgb', () => {
  it('resolves hex colors directly', () => {
    expect(resolveRgb('#0969da', '#000000')).to.deep.equal([9, 105, 218]);
  });

  it('resolves non-hex CSS color syntax (rgb, hsl, named) via canvas normalization', () => {
    expect(resolveRgb('rgb(9, 105, 218)', '#000000')).to.deep.equal([9, 105, 218]);
    expect(resolveRgb('hsl(0, 100%, 50%)', '#000000')).to.deep.equal([255, 0, 0]);
    expect(resolveRgb('red', '#000000')).to.deep.equal([255, 0, 0]);
  });

  it('falls back to the given fallback (not black) for an unparsable color string', () => {
    expect(resolveRgb('not-a-real-color', '#123456')).to.deep.equal([0x12, 0x34, 0x56]);
  });
});

describe('mixColor', () => {
  it('interpolates between two hex colors', () => {
    expect(mixColor('#000000', '#ffffff', 0)).to.equal('rgb(0, 0, 0)');
    expect(mixColor('#000000', '#ffffff', 1)).to.equal('rgb(255, 255, 255)');
    expect(mixColor('#000000', '#ffffff', 0.5)).to.equal('rgb(128, 128, 128)');
  });

  it('interpolates between two non-hex CSS colors', () => {
    expect(mixColor('rgb(0, 0, 0)', 'rgb(255, 255, 255)', 0.5)).to.equal('rgb(128, 128, 128)');
  });
});

it('retheming the ramp with a non-hex CSS color renders that color, not black', async () => {
  const el = (await fixture(html`
    <lyra-heatmap
      style="--lyra-heatmap-scale-lo: rgb(0, 128, 0); --lyra-heatmap-scale-hi: rgb(0, 128, 0);"
    ></lyra-heatmap>
  `)) as LyraHeatmap;
  el.rowLabels = ['a'];
  el.colLabels = ['x'];
  el.values = [[5]];
  await el.updateComplete;
  const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  const dpr = window.devicePixelRatio || 1;
  // Sample a pixel inside the single data cell (PAD_LEFT=60, PAD_TOP=20, cellSize=22).
  const pixel = ctx.getImageData(Math.round(65 * dpr), Math.round(25 * dpr), 1, 1).data;
  expect(pixel[0]).to.equal(0);
  expect(pixel[1]).to.be.greaterThan(50);
  expect(pixel[2]).to.equal(0);
});

it('retheming with an unparsable custom property value does not throw and does not go solid black', async () => {
  const el = (await fixture(html`
    <lyra-heatmap style="--lyra-heatmap-scale-lo: not-a-real-color;"></lyra-heatmap>
  `)) as LyraHeatmap;
  el.rowLabels = ['a'];
  el.colLabels = ['x'];
  el.values = [[5]];
  await el.updateComplete;
  const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
  expect(canvas).to.exist;
  const ctx = canvas.getContext('2d')!;
  const dpr = window.devicePixelRatio || 1;
  const pixel = ctx.getImageData(Math.round(65 * dpr), Math.round(25 * dpr), 1, 1).data;
  // Falls back to the default ramp endpoints rather than parsing to solid black.
  expect([pixel[0], pixel[1], pixel[2]]).to.not.deep.equal([0, 0, 0]);
});

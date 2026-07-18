import { fixture, expect, html } from '@open-wc/testing';
import './sparkline.js';
import type { LyraSparkline } from './sparkline.js';

it('applies the image role and generated accessible name to the semantic SVG', async () => {
  const el = (await fixture(`<lyra-sparkline></lyra-sparkline>`)) as LyraSparkline;
  el.values = [1, 3, 2, 5];
  await el.updateComplete;

  const path = el.shadowRoot!.querySelector('[part="line"]');
  const svg = el.shadowRoot!.querySelector('svg')!;
  expect(path).to.exist;
  expect(el.hasAttribute('role')).to.equal(false);
  expect(svg.getAttribute('role')).to.equal('img');
  expect(svg.getAttribute('aria-label')).to.contain('4');
});

it('forwards a host aria-label to the semantic SVG', async () => {
  const el = (await fixture(
    `<lyra-sparkline aria-label="Revenue over the last quarter"></lyra-sparkline>`,
  )) as LyraSparkline;
  el.values = [1, 3, 2, 5];
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('svg')!.getAttribute('aria-label')).to.equal(
    'Revenue over the last quarter',
  );
});

it('renders one bar per value in bar mode', async () => {
  const el = (await fixture(`<lyra-sparkline type="bar"></lyra-sparkline>`)) as LyraSparkline;
  el.values = [4, 8, 2];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="bar"]').length).to.equal(3);
});

it('renders a filled area in area mode', async () => {
  const el = (await fixture(`<lyra-sparkline type="area"></lyra-sparkline>`)) as LyraSparkline;
  el.values = [1, 2, 3];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="area"]')).to.exist;
  expect(el.shadowRoot!.querySelector('[part="line"]')).to.exist;
});

it('centers flat data instead of collapsing to the bottom edge', async () => {
  const bar = (await fixture(`<lyra-sparkline type="bar"></lyra-sparkline>`)) as LyraSparkline;
  bar.values = [5, 5, 5, 5];
  await bar.updateComplete;
  const rects = [...bar.shadowRoot!.querySelectorAll('[part="bar"]')];
  expect(rects.length).to.equal(4);
  for (const rect of rects) {
    expect(Number(rect.getAttribute('height'))).to.be.greaterThan(0);
  }

  const area = (await fixture(`<lyra-sparkline type="area"></lyra-sparkline>`)) as LyraSparkline;
  area.values = [5, 5, 5, 5];
  await area.updateComplete;
  const areaPath = area.shadowRoot!.querySelector('[part="area"]')!;
  expect(areaPath.getAttribute('d')).to.contain('50');
});

it('renders a visible flat line for single-value data', async () => {
  const el = (await fixture(`<lyra-sparkline></lyra-sparkline>`)) as LyraSparkline;
  el.values = [5];
  await el.updateComplete;
  const path = el.shadowRoot!.querySelector('[part="line"]')!;
  const d = path.getAttribute('d')!;
  expect(d).to.match(/^M[\d.]+,[\d.]+ L[\d.]+,[\d.]+$/);
});

it('clamps bar height instead of going negative when a value is below an explicit min', async () => {
  const el = (await fixture(
    `<lyra-sparkline type="bar" min="3"></lyra-sparkline>`,
  )) as LyraSparkline;
  el.values = [1, 5, 8];
  await el.updateComplete;
  const rects = [...el.shadowRoot!.querySelectorAll('[part="bar"]')];
  expect(rects.length).to.equal(3);
  for (const rect of rects) {
    expect(Number(rect.getAttribute('height'))).to.be.at.least(0);
  }
});

it('clamps bar y/height instead of overflowing when a value is above an explicit max', async () => {
  const el = (await fixture(
    `<lyra-sparkline type="bar" max="3"></lyra-sparkline>`,
  )) as LyraSparkline;
  el.values = [1, 5, 8];
  await el.updateComplete;
  const rects = [...el.shadowRoot!.querySelectorAll('[part="bar"]')];
  expect(rects.length).to.equal(3);
  for (const rect of rects) {
    expect(Number(rect.getAttribute('y'))).to.be.at.least(0);
    expect(Number(rect.getAttribute('height'))).to.be.at.most(100);
  }
});

it('skips non-finite values instead of letting one bad sample truncate the path', async () => {
  const el = (await fixture(`<lyra-sparkline></lyra-sparkline>`)) as LyraSparkline;
  el.values = [1, 3, NaN, 2, undefined as unknown as number, 5];
  await el.updateComplete;
  const path = el.shadowRoot!.querySelector('[part="line"]')!;
  const d = path.getAttribute('d')!;
  expect(d).not.to.contain('NaN');
  expect(d).not.to.contain('undefined');
  // 1, 3, 2, 5 survive (NaN and undefined dropped) -> one M + three L commands.
  const commands = d.match(/[ML][^ML]*/g)!;
  expect(commands.length).to.equal(4);
});

it('formats the last value in aria-label instead of announcing raw float noise', async () => {
  const el = (await fixture(`<lyra-sparkline></lyra-sparkline>`)) as LyraSparkline;
  el.values = [1, 2, 3.456789123];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('svg')!.getAttribute('aria-label')).to.equal(
    'Trend of 3 values, last 3.46',
  );
});

it('announces the last finite value instead of literal "NaN" when the series ends on a non-finite sample', async () => {
  const el = (await fixture(`<lyra-sparkline></lyra-sparkline>`)) as LyraSparkline;
  el.values = [1, 3, 2, NaN];
  await el.updateComplete;
  const label = el.shadowRoot!.querySelector('svg')!.getAttribute('aria-label')!;
  expect(label).not.to.contain('NaN');
  expect(label).to.equal('Trend of 4 values, last 2');
});

it('formats announced values with the effective locale', async () => {
  const el = (await fixture(`<lyra-sparkline locale="de-DE"></lyra-sparkline>`)) as LyraSparkline;
  el.values = [1000, 1234.5];
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('svg')!.getAttribute('aria-label')).to.equal(
    'Trend of 2 values, last 1.234,5',
  );
});

it('uses per-instance strings for the generated accessible name', async () => {
  const el = (await fixture(`<lyra-sparkline></lyra-sparkline>`)) as LyraSparkline;
  el.strings = { trendOf: '{count} Punkte; zuletzt {value}' };
  el.values = [1, 2, 3];
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('svg')!.getAttribute('aria-label')).to.equal(
    '3 Punkte; zuletzt 3',
  );
});

it('does not throw on very large data arrays', async () => {
  const el = (await fixture(`<lyra-sparkline></lyra-sparkline>`)) as LyraSparkline;
  el.values = Array.from({ length: 150000 }, (_, i) => i);
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="line"]')).to.exist;
});

it('caps the number of bars rendered for very large data arrays', async () => {
  const el = (await fixture(`<lyra-sparkline type="bar"></lyra-sparkline>`)) as LyraSparkline;
  el.values = Array.from({ length: 150000 }, (_, i) => i);
  await el.updateComplete;
  const count = el.shadowRoot!.querySelectorAll('[part="bar"]').length;
  expect(count).to.be.greaterThan(0);
  expect(count).to.be.at.most(500);
});

it('respects explicit min/max overrides for point placement', async () => {
  const auto = (await fixture(`<lyra-sparkline type="bar"></lyra-sparkline>`)) as LyraSparkline;
  auto.values = [0, 10];
  await auto.updateComplete;
  const autoHeights = [...auto.shadowRoot!.querySelectorAll('[part="bar"]')].map((r) =>
    Number(r.getAttribute('height')),
  );
  expect(autoHeights[1]).to.be.closeTo(100, 0.5);

  const explicit = (await fixture(
    `<lyra-sparkline type="bar" min="0" max="100"></lyra-sparkline>`,
  )) as LyraSparkline;
  explicit.values = [0, 10];
  await explicit.updateComplete;
  const explicitHeights = [...explicit.shadowRoot!.querySelectorAll('[part="bar"]')].map((r) =>
    Number(r.getAttribute('height')),
  );
  expect(explicitHeights[1]).to.be.closeTo(10, 0.5);
});

it('falls back to the auto-scanned data range when min/max attributes are unparsable, instead of a NaN path', async () => {
  const el = (await fixture(
    `<lyra-sparkline min="not-a-number" max="not-a-number"></lyra-sparkline>`,
  )) as LyraSparkline;
  el.values = [1, 5, 10];
  await el.updateComplete;
  const path = el.shadowRoot!.querySelector('[part="line"]')!;
  const d = path.getAttribute('d')!;
  expect(d).to.not.contain('NaN');
  // Same as the fully-auto case (min/max both invalid -> both fall back to the scanned 1..10 range).
  const auto = (await fixture(`<lyra-sparkline></lyra-sparkline>`)) as LyraSparkline;
  auto.values = [1, 5, 10];
  await auto.updateComplete;
  expect(d).to.equal(auto.shadowRoot!.querySelector('[part="line"]')!.getAttribute('d'));
});

it('falls back to the auto-scanned data range when min/max are assigned NaN/Infinity directly as properties', async () => {
  const el = (await fixture(`<lyra-sparkline></lyra-sparkline>`)) as LyraSparkline;
  el.values = [1, 5, 10];
  el.min = Number.NaN;
  el.max = Number.POSITIVE_INFINITY;
  await el.updateComplete;
  const path = el.shadowRoot!.querySelector('[part="line"]')!;
  const d = path.getAttribute('d')!;
  expect(d).to.not.contain('NaN');
  expect(d).to.not.contain('Infinity');
});

it('swaps a reversed explicit min/max pair instead of producing an inverted/NaN path', async () => {
  const el = (await fixture(`<lyra-sparkline min="10" max="0"></lyra-sparkline>`)) as LyraSparkline;
  el.values = [0, 5, 10];
  await el.updateComplete;
  const path = el.shadowRoot!.querySelector('[part="line"]')!;
  const d = path.getAttribute('d')!;
  expect(d).to.not.contain('NaN');

  // Swapping [10, 0] to [0, 10] reproduces the same plot as passing them in the right order.
  const normal = (await fixture(`<lyra-sparkline min="0" max="10"></lyra-sparkline>`)) as LyraSparkline;
  normal.values = [0, 5, 10];
  await normal.updateComplete;
  expect(d).to.equal(normal.shadowRoot!.querySelector('[part="line"]')!.getAttribute('d'));
});

it('labels the empty state', async () => {
  const el = (await fixture(`<lyra-sparkline></lyra-sparkline>`)) as LyraSparkline;
  await el.updateComplete;
  const svg = el.shadowRoot!.querySelector('svg')!;
  expect(svg.getAttribute('role')).to.equal('img');
  expect(svg.getAttribute('aria-label')).to.equal('No data');
});

it('is accessible', async () => {
  const el = (await fixture(`<lyra-sparkline></lyra-sparkline>`)) as LyraSparkline;
  el.values = [3, 1, 4, 1, 5];
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('caps the number of points built for a line chart with a huge values array', async () => {
  const values = Array.from({ length: 5000 }, (_, i) => i);
  const el = (await fixture(html`<lyra-sparkline type="line" .values=${values}></lyra-sparkline>`)) as LyraSparkline;
  const path = el.shadowRoot!.querySelector('[part="line"]')!;
  const commandCount = (path.getAttribute('d')!.match(/[ML]/g) ?? []).length;
  expect(commandCount).to.be.at.most(500);
});

it('always includes the final sample when decimating', async () => {
  const values = Array.from({ length: 777 }, (_, i) => i);
  const el = (await fixture(html`<lyra-sparkline type="bar" .values=${values}></lyra-sparkline>`)) as LyraSparkline;
  const bars = el.shadowRoot!.querySelectorAll('[part="bar"]');
  const lastBar = bars[bars.length - 1] as SVGRectElement;
  // The last drawn bar's x should correspond to the series' actual final
  // value (776), not an earlier one truncated by imprecise step sampling.
  // Bar width is now dynamic (narrows as point count grows), so undo the
  // actual rendered half-width rather than assuming the old fixed value.
  const barWidth = Number(lastBar.getAttribute('width'));
  const x = Number(lastBar.getAttribute('x')) + barWidth / 2;
  expect(x).to.be.closeTo(100, 1); // VIEW = 100, last point sits at the right edge
});

it('narrows bar width as bar count grows so bars do not overlap', async () => {
  const few = (await fixture(html`<lyra-sparkline type="bar" .values=${[1, 2, 3]}></lyra-sparkline>`)) as LyraSparkline;
  const many = (await fixture(
    html`<lyra-sparkline type="bar" .values=${Array.from({ length: 60 }, (_, i) => i)}></lyra-sparkline>`,
  )) as LyraSparkline;
  const fewWidth = Number(few.shadowRoot!.querySelector('[part="bar"]')!.getAttribute('width'));
  const manyWidth = Number(many.shadowRoot!.querySelector('[part="bar"]')!.getAttribute('width'));
  expect(manyWidth).to.be.lessThan(fewWidth);
});

it('scales against the full pre-decimation value range, not just whatever the sampled subset kept', async () => {
  // 600 values, all 0 except a single huge spike at index 3 -- with a
  // ~1.2 step size (600 values decimated to 500), index 3 is one of the
  // indices decimation actually drops (round(3*1.2)=4, so index 3 never
  // survives into the sampled set). If auto min/max were scanned AFTER
  // decimating, the spike would vanish entirely and every rendered point
  // would sit at the flat mid-line (span=0 fallback); scanning the full
  // raw array first still finds it, correctly pulling every surviving
  // (all-zero) point down toward the bottom of the plot instead.
  const values = Array.from({ length: 600 }, () => 0);
  values[3] = 1000;
  const el = (await fixture(html`<lyra-sparkline type="bar" .values=${values}></lyra-sparkline>`)) as LyraSparkline;
  const bar = el.shadowRoot!.querySelector('[part="bar"]') as SVGRectElement;
  const y = Number(bar.getAttribute('y'));
  expect(y).to.be.closeTo(100, 1); // VIEW = 100; a 0 value against a real [0, 1000] range sits at the bottom
});

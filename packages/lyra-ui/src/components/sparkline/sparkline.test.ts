import { fixture, expect } from '@open-wc/testing';
import './sparkline.js';
import type { LyraSparkline } from './sparkline.js';

it('renders a line path and an aria-label from values', async () => {
  const el = (await fixture(`<lyra-sparkline></lyra-sparkline>`)) as LyraSparkline;
  el.values = [1, 3, 2, 5];
  await el.updateComplete;

  const path = el.shadowRoot!.querySelector('[part="line"]');
  expect(path).to.exist;
  expect(el.getAttribute('role')).to.equal('img');
  expect(el.getAttribute('aria-label')).to.contain('4');
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

it('labels the empty state', async () => {
  const el = (await fixture(`<lyra-sparkline></lyra-sparkline>`)) as LyraSparkline;
  await el.updateComplete;
  expect(el.getAttribute('aria-label')).to.equal('No data');
});

it('is accessible', async () => {
  const el = (await fixture(`<lyra-sparkline></lyra-sparkline>`)) as LyraSparkline;
  el.values = [3, 1, 4, 1, 5];
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

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

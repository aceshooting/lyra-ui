import { expect, fixture, html } from '@open-wc/testing';
import type { LyraSparkline } from './sparkline.class.js';
import './sparkline.js';

function path(element: LyraSparkline): string | null {
  return element.shadowRoot!.querySelector('[part="line"]')?.getAttribute('d') ?? null;
}

it('renders an unsupported appearance as solid and recovers gradient and line presentations without changing data', async () => {
  const element = await fixture<LyraSparkline>(html`<lr-sparkline data="1 3 2" appearance="solid"></lr-sparkline>`);
  const line = path(element), label = element.shadowRoot!.querySelector('svg')!.getAttribute('aria-label');
  element.setAttribute('appearance', 'unsupported');
  await element.updateComplete;
  expect(path(element)).to.equal(line);
  expect(element.shadowRoot!.querySelectorAll('[part="fill"]').length).to.equal(1);
  expect(element.shadowRoot!.querySelectorAll('linearGradient').length).to.equal(0);
  element.appearance = 'gradient';
  await element.updateComplete;
  expect(element.shadowRoot!.querySelectorAll('linearGradient').length).to.equal(1);
  expect(path(element)).to.equal(line);
  element.appearance = 'line';
  await element.updateComplete;
  expect(element.shadowRoot!.querySelectorAll('[part="fill"]').length).to.equal(0);
  expect(path(element)).to.equal(line);
  expect(element.shadowRoot!.querySelector('svg')!.getAttribute('aria-label')).to.equal(label);
});

it('renders an unsupported curve as linear and restores the requested step geometry', async () => {
  const element = await fixture<LyraSparkline>(html`<lr-sparkline data="1 3 2" curve="linear"></lr-sparkline>`);
  const linear = path(element);
  expect(linear?.startsWith('M')).to.equal(true);
  element.curve = 'step';
  await element.updateComplete;
  const step = path(element);
  expect(step).not.to.equal(linear);
  element.setAttribute('curve', 'unsupported');
  await element.updateComplete;
  expect(path(element)).to.equal(linear);
  element.curve = 'step';
  await element.updateComplete;
  expect(path(element)).to.equal(step);
  expect(element.shadowRoot!.querySelector('svg')!.getAttribute('role')).to.equal('img');
});

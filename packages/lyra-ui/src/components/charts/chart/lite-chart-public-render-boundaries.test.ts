import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { resetMouse } from '../../../../test/wtr-mouse.js';
import type { LyraLiteChart } from './lite-chart.class.js';
import './lite-chart.js';

async function marks(element: LyraLiteChart, count: number, measurableCount = count): Promise<SVGGraphicsElement[]> {
  await element.updateComplete;
  await waitUntil(() => {
    const nodes = [...element.shadowRoot!.querySelectorAll<SVGGraphicsElement>('[part="bar"], [part="point"]')];
    return nodes.length === count && nodes.filter(node => {
      const box = node.getBoundingClientRect();
      return box.width > 0 && box.height > 0;
    }).length >= measurableCount;
  }, 'lite-chart marks did not receive their allocation');
  return [...element.shadowRoot!.querySelectorAll<SVGGraphicsElement>('[part="bar"], [part="point"]')];
}

afterEach(async () => resetMouse());

it('replaces rounded-bar native titles with category synchronization and restores them on group removal', async () => {
  const host = await fixture<HTMLDivElement>(html`<div style="inline-size:500px">
    <lr-lite-chart rounded-bars sync-group="rounded" height="10rem" .labels=${['Alpha', 'Beta']}
      .datasets=${[{ label: 'First', data: [3, 7] }]}></lr-lite-chart>
    <lr-lite-chart rounded-bars sync-group="rounded" height="10rem" .labels=${['Beta', 'Alpha']}
      .datasets=${[{ label: 'Second', data: [70, 30] }]}></lr-lite-chart>
  </div>`);
  const [first, second] = [...host.querySelectorAll<LyraLiteChart>('lr-lite-chart')];
  if (!first || !second) throw new Error('Synchronized charts missing');
  const firstMarks = await marks(first, 2);
  await marks(second, 2);
  await waitUntil(() => first.shadowRoot!.querySelectorAll('[part="bar"] title').length === 0 && second.shadowRoot!.querySelectorAll('[part="bar"] title').length === 0);
  expect(firstMarks.every(mark => mark.localName === 'path')).to.equal(true);
  await focusByKeyboard(firstMarks[0] as unknown as HTMLElement);
  await waitUntil(() => second.shadowRoot!.querySelector('[part="sync-tooltip"]')?.textContent?.includes('30') === true);
  expect(second.shadowRoot!.querySelector('[part="sync-tooltip"]')?.textContent).to.include('Alpha');
  expect(second.shadowRoot!.querySelectorAll('[part="sync-crosshair"]').length).to.equal(1);
  await sendKeys({ press: 'ArrowRight' });
  await waitUntil(() => second.shadowRoot!.querySelector('[part="sync-tooltip"]')?.textContent?.includes('70') === true);
  expect(second.shadowRoot!.querySelector('[part="sync-tooltip"]')?.textContent).to.include('Beta');
  first.syncGroup = '';
  await first.updateComplete;
  await waitUntil(() => first.shadowRoot!.querySelectorAll('[part="bar"] title').length === 2 && second.shadowRoot!.querySelector('[part="sync-tooltip"]') === null);
  expect(first.shadowRoot!.querySelectorAll('[part="sync-crosshair"]').length).to.equal(0);
  expect(first.exportData('csv')).to.include('Alpha,3');
});

it('keeps a square-root zero endpoint finite beside a negative bar and activates its original zero value', async () => {
  const element = await fixture<LyraLiteChart>(html`<lr-lite-chart type="bar" scale="sqrt"
    style="inline-size:500px;block-size:240px" .labels=${['Negative', 'Zero']}
    .datasets=${[{ label: 'Signed', data: [-4, 0] }]}></lr-lite-chart>`);
  const bars = await marks(element, 2, 1);
  expect(Number(bars[0]!.getAttribute('height'))).to.be.greaterThan(0);
  for (const bar of bars) {
    for (const name of ['x', 'y', 'width', 'height']) expect(Number.isFinite(Number(bar.getAttribute(name)))).to.equal(true);
    expect(Number(bar.getAttribute('height'))).to.be.at.least(0);
  }
  expect(Number(bars[1]!.getAttribute('height'))).to.equal(0);
  const activations: unknown[] = [];
  element.addEventListener('lr-datum-activate', event => activations.push(event.detail));
  await focusByKeyboard(bars[1] as unknown as HTMLElement);
  await sendKeys({ press: 'Enter' });
  await waitUntil(() => activations.length === 1);
  expect(activations[0]).to.deep.include({ datasetIndex: 0, index: 1, label: 'Zero', value: 0, kind: 'bar' });
});

it('renders logarithmic subnormal values with bounded finite ticks and preserves exact exported values', async () => {
  const values = [Number.MIN_VALUE, Number.MIN_VALUE * 2, Number.MIN_VALUE * 3];
  const element = await fixture<LyraLiteChart>(html`<lr-lite-chart type="line" scale="logarithmic" without-zero-baseline
    style="inline-size:500px;block-size:240px" .labels=${['First', 'Middle', 'Last']}
    .datasets=${[{ label: 'Subnormal', data: values }]}></lr-lite-chart>`);
  const points = await marks(element, 3);
  const ys = points.map(point => Number(point.getAttribute('cy')));
  expect(ys.every(Number.isFinite)).to.equal(true);
  expect(ys[0]).to.be.greaterThan(ys[1]!);
  expect(ys[1]).to.be.greaterThan(ys[2]!);
  const geometry = [...element.shadowRoot!.querySelectorAll('[d], [x], [y], [cx], [cy]')]
    .map(node => ['d', 'x', 'y', 'cx', 'cy'].map(name => node.getAttribute(name) ?? '').join(' ')).join(' ');
  expect(geometry).not.to.match(/NaN|Infinity/);
  const ticks = element.shadowRoot!.querySelectorAll('[part="grid-line"]');
  expect(ticks.length).to.be.greaterThan(1);
  expect(ticks.length).to.be.at.most(8);
  const csv = element.exportData('csv');
  for (let index = 0; index < values.length; index++) expect(csv).to.include(`${['First', 'Middle', 'Last'][index]},${values[index]}`);
});

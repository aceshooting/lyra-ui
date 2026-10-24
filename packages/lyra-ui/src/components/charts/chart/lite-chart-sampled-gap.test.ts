import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { LyraLiteChart } from './lite-chart.class.js';
import './lite-chart.js';

const labels = Array.from({ length: 7 }, (_, index) => `Source ${index}`);

function paths(element: LyraLiteChart): string[] {
  return [...element.shadowRoot!.querySelectorAll<SVGPathElement>('[part="line"]')].map(path => path.getAttribute('d') ?? '');
}

function commands(path: string): { moves: number; lines: number } {
  return { moves: (path.match(/M/g) ?? []).length, lines: (path.match(/L/g) ?? []).length };
}

for (const gap of [null, Number.NaN]) {
  it(`keeps an omitted ${gap === null ? 'null' : 'non-finite'} row from reconnecting sampled line endpoints`, async () => {
    const values = [1, 2, 3, gap, 5, 6, 7];
    const element = await fixture<LyraLiteChart>(html`<lr-lite-chart type="line" with-data-table max-records="2"
      style="inline-size:400px" .labels=${labels} .datasets=${[{ label: 'Signal', data: values }]}
    ></lr-lite-chart>`);
    await waitUntil(() => element.shadowRoot!.querySelectorAll('[part="point"]').length === 2);
    expect([...element.shadowRoot!.querySelectorAll('[part="point"]')].map(point => point.getAttribute('data-index')))
      .to.deep.equal(['0', '6']);
    expect(commands(paths(element)[0]!)).to.deep.equal({ moves: 2, lines: 0 });
    expect(element.shadowRoot!.querySelectorAll('[part="data-list"] li').length).to.equal(2);
    expect(element.shadowRoot!.querySelectorAll('[part="data-truncation"]').length).to.equal(1);
    const csv = element.exportData('csv');
    expect(csv.split('\r\n').length).to.equal(8);
    for (const label of labels) expect(csv).to.include(label);
    const selected: unknown[] = [];
    element.addEventListener('lr-point-activate', event => selected.push((event as CustomEvent).detail));
    const first = element.shadowRoot!.querySelector<SVGCircleElement>('[part="point"]')!;
    await focusByKeyboard(first as unknown as HTMLElement);
    await sendKeys({ press: 'ArrowRight' });
    await waitUntil(() => element.shadowRoot!.activeElement?.getAttribute('data-index') === '6');
    await sendKeys({ press: 'Enter' });
    await waitUntil(() => selected.length === 1);
    expect(selected).to.deep.equal([{ datasetIndex: 0, index: 6, label: 'Source 6', value: 7 }]);
    element.datasets = [{ label: 'Signal', data: [1, 2, 3, 4, 5, 6, 7] }];
    await element.updateComplete;
    expect(commands(paths(element)[0]!)).to.deep.equal({ moves: 1, lines: 1 });
  });
}

it('breaks only the sampled series whose omitted interval contains a gap', async () => {
  const element = await fixture<LyraLiteChart>(html`<lr-lite-chart type="line" with-data-table max-records="4"
    style="inline-size:400px" .labels=${labels}
    .datasets=${[{ label: 'Gapped', data: [1, 2, null, 4, 5, 6, 7] }, { label: 'Continuous', data: [7, 6, 5, 4, 3, 2, 1] }]}
  ></lr-lite-chart>`);
  await waitUntil(() => element.shadowRoot!.querySelectorAll('[part="point"]').length === 4);
  expect(paths(element).map(commands)).to.deep.equal([{ moves: 2, lines: 0 }, { moves: 1, lines: 1 }]);
  expect([...element.shadowRoot!.querySelectorAll('[part="point"]')].map(point => [point.getAttribute('data-dataset-index'), point.getAttribute('data-index')]))
    .to.deep.equal([['0', '0'], ['0', '6'], ['1', '0'], ['1', '6']]);
  expect(element.shadowRoot!.querySelectorAll('tbody tr').length).to.equal(2);
  element.datasets = [{ label: 'Gapped', data: [1, 2, 3, 4, 5, 6, 7] }, { label: 'Continuous', data: [7, 6, 5, 4, null, 2, 1] }];
  await element.updateComplete;
  expect(paths(element).map(commands)).to.deep.equal([{ moves: 1, lines: 1 }, { moves: 2, lines: 0 }]);
});

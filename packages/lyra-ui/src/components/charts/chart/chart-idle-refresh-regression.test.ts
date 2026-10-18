import { expect, fixture, html, waitUntil, aTimeout } from '@open-wc/testing';
import { LyraChart } from './chart.js';

it('commits hidden streamed table rows to the DOM when held idle work flushes', async () => {
  const chart = await fixture<LyraChart>(html`<lr-chart without-animation without-legend
    .labels=${['First']}
    .datasets=${[{ label: 'Series', data: [10] }]}
  ></lr-chart>`);
  await waitUntil(() => chart.chart !== undefined);
  await aTimeout(0);
  await chart.updateComplete;
  const request = Object.getOwnPropertyDescriptor(window, 'requestIdleCallback');
  const cancel = Object.getOwnPropertyDescriptor(window, 'cancelIdleCallback');
  let held: (() => void) | undefined;
  Object.defineProperty(window, 'requestIdleCallback', { configurable: true, value: (callback: () => void) => { held = callback; return 1; } });
  Object.defineProperty(window, 'cancelIdleCallback', { configurable: true, value: () => {} });
  try {
    chart.appendData('Newest', [42]);
    await chart.updateComplete;
    expect(held !== undefined).to.equal(true);
    expect(chart.shadowRoot!.querySelector('tbody')!.textContent).not.to.contain('Newest');
    held!();
    await chart.updateComplete;
    expect(chart.shadowRoot!.querySelector('tbody')!.textContent).to.contain('Newest');
    expect(chart.shadowRoot!.querySelector('tbody')!.textContent).to.contain('42');
  } finally {
    if (request) Object.defineProperty(window, 'requestIdleCallback', request); else Reflect.deleteProperty(window, 'requestIdleCallback');
    if (cancel) Object.defineProperty(window, 'cancelIdleCallback', cancel); else Reflect.deleteProperty(window, 'cancelIdleCallback');
  }
});

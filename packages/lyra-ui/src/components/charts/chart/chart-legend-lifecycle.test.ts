import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraChart } from './chart.class.js';
import './chart.js';

const buttons = (chart: LyraChart): HTMLButtonElement[] => [...chart.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part~="legend-item"]')];
async function mount(mode: 'datum' | 'dataset'): Promise<LyraChart> {
  const chart = await fixture<LyraChart>(html`<lr-chart type="doughnut" legend-mode=${mode} without-animation
    style="inline-size:320px;block-size:320px" .labels=${['A', 'B', 'C']}
    .datasets=${[{ label: 'First', data: [5, 3, 2] }, { label: 'Second', data: [2, 3, 5] }]}></lr-chart>`);
  await waitUntil(() => !!chart.chart, 'Chart.js initializes', { timeout: 5000 });
  await chart.updateComplete;
  expect(chart.legendMode).to.equal(mode);
  expect(buttons(chart).map(button => button.textContent!.trim())).to.deep.equal(mode === 'datum' ? ['A', 'B', 'C'] : ['First', 'Second']);
  return chart;
}

for (const mode of ['datum', 'dataset'] as const) {
  for (const interruption of ['disconnect', 'replace data'] as const) {
    it(`cancels a ${mode} legend proposal when its listener triggers ${interruption}, then accepts a current proposal`, async () => {
      const chart = await mount(mode);
      const parent = chart.parentNode!;
      const request = mode === 'datum' ? 'lr-datum-visibility-change-request' : 'lr-legend-visibility-change-request';
      const committed = mode === 'datum' ? 'lr-datum-visibility-change' : 'lr-legend-visibility-change';
      const previousHidden = mode === 'datum' ? chart.hiddenDatums : chart.hiddenDatasets;
      let requests = 0, commits = 0;
      const errors: string[] = [];
      const onError = (event: ErrorEvent): void => { errors.push(event.message); event.preventDefault(); };
      chart.addEventListener(request, () => {
        requests++;
        if (interruption === 'disconnect') chart.remove();
        else { chart.datasets = [{ label: 'Fresh', data: [9] }]; chart.labels = ['Fresh']; }
      }, { once: true });
      chart.addEventListener(committed, () => { commits++; });
      window.addEventListener('error', onError);
      try { buttons(chart)[1]!.click(); }
      finally { window.removeEventListener('error', onError); }
      expect(requests).to.equal(1);
      expect(errors).to.deep.equal([]);
      expect(commits).to.equal(0);
      expect(mode === 'datum' ? chart.hiddenDatums : chart.hiddenDatasets).to.equal(previousHidden);
      if (interruption === 'disconnect') parent.append(chart);
      await chart.updateComplete;
      await waitUntil(() => !!chart.chart, 'current chart is available', { timeout: 5000 });
      await chart.updateComplete;
      expect(buttons(chart).length).to.be.greaterThan(0);
      buttons(chart)[0]!.click(); await chart.updateComplete;
      expect(commits).to.equal(1);
      expect(mode === 'datum' ? chart.hiddenDatums : chart.hiddenDatasets).to.deep.equal([0]);
      expect(buttons(chart)[0]!.getAttribute('aria-pressed')).to.equal('false');
    });
  }
}

for (const retirement of ['shorter data', 'cartesian type', 'disconnect'] as const) {
  it(`ignores an old datum button after ${retirement}`, async () => {
    const chart = await mount('datum');
    const stale = buttons(chart)[2]!;
    let requests = 0, commits = 0;
    chart.addEventListener('lr-datum-visibility-change-request', () => { requests++; });
    chart.addEventListener('lr-datum-visibility-change', () => { commits++; });
    if (retirement === 'shorter data') { chart.datasets = [{ label: 'Fresh', data: [9] }]; chart.labels = ['Fresh']; }
    else if (retirement === 'cartesian type') chart.type = 'bar';
    else chart.remove();
    await chart.updateComplete;
    if (retirement === 'cartesian type') await waitUntil(() => buttons(chart).length === 2);
    expect(stale.isConnected).to.equal(false);
    stale.click();
    expect(requests).to.equal(0); expect(commits).to.equal(0);
    expect(chart.hiddenDatums).to.deep.equal([]);
  });
}

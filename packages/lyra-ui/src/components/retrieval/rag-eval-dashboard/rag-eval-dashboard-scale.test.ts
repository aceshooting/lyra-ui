import { expect, fixture, html } from '@open-wc/testing';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
import { collectionTruncationWarningKey } from '../../../internal/collection-snapshot.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import './rag-eval-dashboard.js';
import type { LyraRagEvalDashboard } from './rag-eval-dashboard.class.js';
it('retains newest runs and reserves the selected facet within 500 controls', async () => {
  expectDevWarning(collectionTruncationWarningKey('lr-rag-eval-dashboard', 'runs'));
  const runs = Array.from({ length: 12000 }, (_, i) => ({ id: `r${i}`, label: `Run ${i}`, slice: `Slice ${i}`, metrics: { score: i } }));
  const host = await fixture<LyraRagEvalDashboard>(html`<lr-rag-eval-dashboard without-chart .runs=${runs} .metrics=${[{ id: 'score', label: 'Score', category: 'system' }]} slice="Slice 11999"></lr-rag-eval-dashboard>`);
  expect(host.runs.at(-1)?.id).to.equal('r11999');
  expect(host.shadowRoot!.querySelectorAll('[data-slice]').length).to.be.at.most(500);
  expect(host.shadowRoot!.querySelector('[data-slice="Slice 11999"]')?.getAttribute('aria-pressed')).to.equal('true');
  expect((host.shadowRoot!.querySelector('lr-stat') as HTMLElement & { value: string }).value).to.equal('11,999');
  expect(host.shadowRoot!.querySelector('[part="slices-limit"]')?.textContent ?? '').to.contain('499');
  recordScaleMeasurement('lr-rag-eval-dashboard', 'n=12000 selected facet', { facets: host.shadowRoot!.querySelectorAll('[data-slice]').length, runs: host.shadowRoot!.querySelectorAll('[part="run"]').length });
});
it('reuses canonical slice filtering and latest values on presentation updates', async () => {
  const host = await fixture<LyraRagEvalDashboard>(html`<lr-rag-eval-dashboard without-chart .runs=${Array.from({ length: 600 }, (_, i) => ({ id: `r${i}`, label: `Run ${i}`, metrics: { score: i }, slice: 'A' }))} .metrics=${[{ id: 'score', label: 'Score', category: 'system' }]}></lr-rag-eval-dashboard>`);
  const seam = host as unknown as { slices(...args: unknown[]): unknown; filteredRuns(...args: unknown[]): unknown; latestValue(...args: unknown[]): unknown };
  let derivations = 0;
  for (const key of ['slices', 'filteredRuns', 'latestValue'] as const) { const original = seam[key]; seam[key] = function (...args) { derivations++; return original.apply(this, args); }; }
  host.label = 'Renamed'; host.requestUpdate(); await host.updateComplete;
  expect(derivations).to.equal(0);
  recordScaleMeasurement('lr-rag-eval-dashboard', 'n=600 presentation refresh', { derivations });
  host.strings = { ragEvalDashboardAllSlices: 'Every slice' }; host.requestUpdate(); await host.updateComplete;
  expect(host.shadowRoot!.querySelector('[data-slice=""]')?.textContent).to.contain('Every slice');
  expect(derivations).to.equal(0);
  host.runs = [{ id: 'replacement', label: 'Replacement', slice: 'B', metrics: { score: 42 } }];
  host.slice = 'B'; host.requestUpdate(); await host.updateComplete;
  expect(host.shadowRoot!.querySelectorAll('[data-slice]').length).to.equal(2);
  expect((host.shadowRoot!.querySelector('lr-stat') as HTMLElement & { value: string }).value).to.equal('42');
  host.runs = []; await host.updateComplete;
  expect(host.shadowRoot!.querySelectorAll('[part="run"]').length).to.equal(0);
});

it('bounds distinct slice controls independently of history length', async () => {
  const host = await fixture<LyraRagEvalDashboard>(html`<lr-rag-eval-dashboard without-chart .runs=${Array.from({ length: 600 }, (_, i) => ({ id: `r${i}`, label: `Run ${i}`, slice: `S${i}`, metrics: {} }))} slice="S599"></lr-rag-eval-dashboard>`);
  expect(host.shadowRoot!.querySelectorAll('[data-slice]').length).to.equal(500);
  expect(host.shadowRoot!.querySelector('[data-slice="S599"]')?.getAttribute('aria-pressed')).to.equal('true');
});

it('keeps metric values from the full admitted slice outside the history window', async () => {
  const runs = Array.from({ length: 600 }, (_, i) => ({ id: `r${i}`, label: `Run ${i}`, slice: 'A', metrics: i === 0 ? { score: 7 } : {} }));
  const host = await fixture<LyraRagEvalDashboard>(html`<lr-rag-eval-dashboard without-chart .runs=${runs} .metrics=${[{ id: 'score', label: 'Score', category: 'system' }]} slice="A"></lr-rag-eval-dashboard>`);
  expect(host.shadowRoot!.querySelectorAll('[part="run"]').length).to.equal(500);
  expect((host.shadowRoot!.querySelector('lr-stat') as HTMLElement & { value: string }).value).to.equal('7');
});

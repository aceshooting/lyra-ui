import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import './histogram.js';
import { binnedBuckets, type LyraHistogram } from './histogram.js';

it('bins its values and renders a bar-chart Chart.js instance', async () => {
  const el = (await fixture(html`<lr-histogram bins="5"></lr-histogram>`)) as LyraHistogram;
  el.values = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null, 'chart never initialized', { timeout: 2000 });
  expect((el as any).chart.config.type).to.equal('bar');
  expect((el as any).chart.data.labels.length).to.equal(5);
});

it('locks .type to "bar" — assigning a different value at runtime (e.g. via a `type="line"` attribute) is a no-op', async () => {
  const el = (await fixture(html`<lr-histogram></lr-histogram>`)) as LyraHistogram;
  (el as any).type = 'line';
  expect(el.type).to.equal('bar');
});

it('normalizes unsafe HTML `bins` values before they reach the binning pass', () => {
  const el = document.createElement('lr-histogram') as LyraHistogram;

  el.setAttribute('bins', String(Number.MAX_SAFE_INTEGER));
  expect(el.bins).to.equal(1_000);

  el.setAttribute('bins', '3.9');
  expect(el.bins).to.equal(3);

  el.setAttribute('bins', 'Infinity');
  expect(el.bins).to.equal(0);

  el.values = [0, 1];
  el.bins = Number.MAX_SAFE_INTEGER;
  expect(binnedBuckets(el)).to.have.length(1_000);
});

it('memoizes the binning pass, reusing the same bucket array while `values`/`bins` are unchanged', async () => {
  const el = (await fixture(html`<lr-histogram bins="5"></lr-histogram>`)) as LyraHistogram;
  el.values = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);

  const first = binnedBuckets(el);
  const second = binnedBuckets(el);
  expect(second).to.equal(first);

  el.values = [...el.values, 11];
  const third = binnedBuckets(el);
  expect(third).to.not.equal(first);

  el.bins = 3;
  const fourth = binnedBuckets(el);
  expect(fourth).to.not.equal(third);
});

it('is accessible', async () => {
  const el = (await fixture(html`<lr-histogram aria-label="Response-time distribution"></lr-histogram>`)) as LyraHistogram;
  el.values = [1, 2, 3];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);
  expect(el.shadowRoot!.querySelector('canvas')!.getAttribute('aria-label')).to.equal('Response-time distribution');
  expect(el.shadowRoot!.querySelectorAll('[role]')).to.have.length(1);
  await expect(el).to.be.accessible();
});

it('redraws its derived labels and counts when values change after initialization', async () => {
  const el = (await fixture(html`<lr-histogram bins="2"></lr-histogram>`)) as LyraHistogram;
  el.values = [0, 1, 2, 3];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);

  el.values = [0, 0, 0, 10];
  await el.updateComplete;

  expect((el as any).chart.data.datasets[0].data).to.deep.equal([3, 1]);
});

it('visually hides the fallback data table via the sr-only sheet when show-data-table is off', async () => {
  const el = (await fixture(html`<lr-histogram></lr-histogram>`)) as LyraHistogram;
  el.values = [1, 2, 3];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);

  const table = el.shadowRoot!.querySelector('[part="data-table"] table') as HTMLTableElement;
  expect(table.classList.contains('sr-only')).to.be.true;
  // Proves the `.sr-only` class is actually backed by the shared a11y stylesheet (not just present
  // as a dead class name) -- without `srOnly` in `static styles`, this rule never applies and the
  // table would render fully visible despite carrying the class. `width`/`height` are intentionally
  // not asserted here: a `<table>` in the default auto layout algorithm treats a CSS `width` as a
  // minimum suggestion and grows to fit its content regardless, so those two sr-only properties
  // don't reliably reflect on a table element even when the rule is correctly applied.
  const computed = getComputedStyle(table);
  expect(computed.position).to.equal('absolute');
  expect(computed.overflow).to.equal('hidden');
  expect(computed.margin).to.equal('-1px');

  el.showDataTable = true;
  await el.updateComplete;
  expect(table.classList.contains('sr-only')).to.be.false;
});

it('can shrink to a 320px allocation with a long series label', async () => {
  const wrapper = await fixture(html`
    <div style="display: flex; inline-size: 320px;">
      <lr-histogram label="A deliberately long translated frequency distribution label"></lr-histogram>
    </div>
  `);
  const el = wrapper.querySelector('lr-histogram') as LyraHistogram;
  el.values = [1, 2, 3, 4, 5];
  await el.updateComplete;
  await waitUntil(() => (el as any).chart != null);

  expect(getComputedStyle(el).minInlineSize).to.equal('0px');
  expect(el.getBoundingClientRect().width).to.be.at.most(320);
});

it('invalidates localized bucket labels when the effective locale changes', async () => {
  const el = (await fixture(html`
    <lr-histogram locale="en-US" .values=${[1000, 2000]} bins="2"></lr-histogram>
  `)) as LyraHistogram;
  const english = binnedBuckets(el)[0]!.label;
  el.locale = 'de-DE';
  await el.updateComplete;
  const german = binnedBuckets(el)[0]!.label;
  expect(german).to.not.equal(english);
  expect(german).to.contain('1.000');
});

it('allows a strings override to reach the histogram dataset label', async () => {
  const el = (await fixture(html`
    <lr-histogram .values=${[1, 2]} .strings=${{ histogramFrequency: 'Häufigkeit' }}></lr-histogram>
  `)) as LyraHistogram;
  expect(el.datasets[0]?.label).to.equal('Häufigkeit');
});

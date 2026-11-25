import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { setReducedMotion } from '../../../lyra-ui/test/wtr-media.js';
import { createCatalog, initialCatalog } from '../../src/catalog.js';
import { chartExtraRoles } from '../../src/catalogs/charts-extra.js';
import { LyraGenViewElement } from '../../src/gen-view.js';
import type { LyraGenNode, LyraGenView } from '../../src/types.js';

interface UpdatingElement extends HTMLElement { readonly updateComplete: Promise<boolean> }
const catalog = createCatalog({ ...initialCatalog, id: 'charts-extra-qualification', components: { ...initialCatalog.components, ...chartExtraRoles } });

/** Authored independently of the reviewed examples; every chart role needs one (checked below). */
const scenarios: Readonly<Record<string, LyraGenNode>> = {
  'donut-chart': { id: 'subject', type: 'donut-chart', props: { label: 'Spend by service', labels: ['Compute', 'Storage', 'Network'], datasets: [{ label: 'Spend', data: [620, 240, 90] }], legendDisplay: 'value-percentage', withDataTable: true } },
  'radial-chart': { id: 'subject', type: 'radial-chart', props: { label: 'Alerts by severity', labels: ['Critical', 'High', 'Medium', 'Low'], datasets: [{ label: 'Alerts', data: [3, 9, 14, 21] }] } },
  'radar-chart': { id: 'subject', type: 'radar-chart', props: { label: 'Vendor comparison', labels: ['Price', 'Quality', 'Speed', 'Support'], datasets: [{ label: 'Vendor A', data: [3, 4, 5, 2], fill: true }, { label: 'Vendor B', data: [4, 3, 3, 5] }], min: 0, max: 5 } },
  'horizontal-bar': { id: 'subject', type: 'horizontal-bar', props: { label: 'Errors by region', labels: ['Europe', 'Americas', 'Asia Pacific'], datasets: [{ label: 'Client', data: [12, 30, 8], stack: 'all' }, { label: 'Server', data: [4, 9, 2], stack: 'all' }], stacked: true, xLabel: 'Errors' } },
  'bar-list': { id: 'subject', type: 'bar-list', props: { label: 'Top referrers', items: [{ label: 'search', value: 2400 }, { label: 'newsletter', value: 1100, variant: 'brand' }, { label: 'social', value: 380 }], sort: 'descending' } },
  'radial-bar': { id: 'subject', type: 'radial-bar', props: { label: 'Sprint goals', max: 100, withLegend: true, segments: [{ label: 'Features', value: 70, variant: 'success' }, { label: 'Bugs', value: 40, variant: 'danger' }] } },
  'bubble-chart': { id: 'subject', type: 'bubble-chart', props: { label: 'Accounts by usage and spend', xLabel: 'Seats', yLabel: 'Spend', datasets: [{ label: 'Accounts', points: [{ x: 10, y: 1200, r: 6 }, { x: 45, y: 5200, r: 12, label: 'Initech' }] }] } },
  'category-bar': { id: 'subject', type: 'category-bar', props: { label: 'Team capacity', values: [22, 8, 6], variants: ['brand', 'danger', 'neutral'], marker: 30, withLabels: true } },
  tracker: { id: 'subject', type: 'tracker', props: { label: 'Test run results', categories: [{ id: 'ok', color: 'var(--lr-color-success)', label: 'Passed' }, { id: 'fail', color: 'var(--lr-color-danger)', label: 'Failed' }], items: [
    { id: 'r1', categoryId: 'ok', label: 'Run 1' }, { id: 'r2', categoryId: 'ok', label: 'Run 2' }, { id: 'r3', categoryId: 'fail', label: 'Run 3', marker: true }, { id: 'r4', categoryId: 'ok', label: 'Run 4' },
  ], withLegend: true, markerLabel: 'Retried' } },
  chord: { id: 'subject', type: 'chord', props: { label: 'Messages between services', entities: [{ id: 'api', label: 'API' }, { id: 'jobs', label: 'Jobs' }, { id: 'db', label: 'Database' }], matrix: [[0, 12, 30], [12, 0, 18], [30, 18, 0]], withDataTable: true } },
};

/** Properties the trusted adapter sets on each profile role, never generated. */
const adapted: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {
  'horizontal-bar': { indexAxis: 'y' },
};

async function mount(root: LyraGenNode, dir: 'ltr' | 'rtl' = 'ltr'): Promise<{ host: LyraGenViewElement; subject: UpdatingElement }> {
  const document: LyraGenView = { version: '1', catalog: { id: catalog.id, version: catalog.version }, surfaceId: 'charts-extra-qualification', revision: 0, root };
  const wrapper = await fixture<HTMLDivElement>(html`<div dir=${dir}><lr-gen-view .catalog=${catalog} .document=${document}></lr-gen-view></div>`);
  const host = wrapper.querySelector<LyraGenViewElement>('lr-gen-view')!;
  await waitUntil(() => host.status === 'ready' || host.status === 'error', 'Chart role settled', { timeout: 5000 });
  expect(host.status).to.equal('ready');
  const subject = host.shadowRoot!.querySelector<UpdatingElement>('[data-gen-id="subject"]');
  expect(subject !== null).to.equal(true);
  await subject!.updateComplete;
  return { host, subject: subject! };
}

describe('extra chart roles rendered qualification', () => {
  it('keeps an explicit populated scenario for every chart role', () => {
    expect(Object.keys(scenarios).sort()).to.deep.equal(Object.keys(chartExtraRoles).sort());
  });

  for (const [role, root] of Object.entries(scenarios)) {
    it(`renders populated ${role} with its trusted tag and accessible semantics in LTR and RTL`, async () => {
      for (const dir of ['ltr', 'rtl'] as const) {
        const { host, subject } = await mount(root, dir);
        expect(subject.localName).to.equal(chartExtraRoles[role]!.tag);
        for (const [key, value] of Object.entries({ ...root.props, ...adapted[role] })) expect(Reflect.get(subject, key), key).to.deep.equal(value);
        await expect(host).to.be.accessible();
      }
    });
  }

  it('paints tracker cells from the generated theme tokens', async () => {
    const { subject } = await mount(scenarios['tracker']!);
    await waitUntil(() => (subject.shadowRoot?.querySelectorAll('[part~="cell"]').length ?? 0) === 4, 'Tracker cells rendered');
    const cells = [...subject.shadowRoot!.querySelectorAll<HTMLElement>('[part~="cell"]')];
    const colors = cells.map(cell => getComputedStyle(cell).backgroundColor);
    expect(colors.every(color => color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent')).to.equal(true);
    expect(colors[0]).to.equal(colors[1]);
    expect(colors[0]).not.to.equal(colors[2]);
  });

  it('settles every chart role under reduced motion', async () => {
    await setReducedMotion('reduce');
    try {
      for (const root of Object.values(scenarios)) {
        const { host } = await mount(root);
        await expect(host).to.be.accessible();
      }
    } finally { await setReducedMotion('no-preference'); }
  });
});

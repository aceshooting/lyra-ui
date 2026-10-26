import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { mountLiveDashboard, type DashboardExampleOptions } from '../../examples/dashboard.js';
import { HostQueryRegistry, type DashboardQueryResult } from '../../src/live-data.js';

const labels: DashboardExampleOptions['labels'] = {
  title: 'Records', table: 'Records', chart: 'Values', note: 'Note', refresh: 'Refresh', cancel: 'Cancel', pin: 'Pin', unpin: 'Unpin', category: 'Category', value: 'Value', sharedFilter: 'Filter', previous: 'Previous', next: 'Next', overview: 'Overview', back: 'Back', navigationDenied: 'Unavailable',
  detail: row => row.c0, page: page => String(page.shownOffset), selection: ids => ids.join(', '), queue: metrics => String(metrics.items), provenance: () => 'Provenance', layoutError: () => 'Unavailable', status: snapshot => snapshot.status,
};

it('composes viewer-authorized citations for current page/filter values and clears revoked source controls', async () => {
  const registry = new HostQueryRegistry();
  let mode: 'ready' | 'partial' | 'missing' | 'dangling' = 'ready';
  let available = true;
  const activated: string[] = [];
  registry.register('records', { maxBytes: 5000, maxRows: 100, authorize: () => true, execute: async parameters => {
    const name = parameters['category'] ? 'Filtered' : Number(parameters['offset']) ? 'Second' : 'First';
    const result: DashboardQueryResult = { data: [{ c0: name, c1: name === 'First' ? 10 : 20 }],
      sources: [{ id: name, label: `${name} source`, updatedAt: 1 }],
      ...(mode === 'missing' ? {} : { lineage: { '/0/c1': mode === 'dangling' ? 'absent' : name } }),
      partial: mode === 'partial',
    };
    return result;
  } });
  const root = await fixture<HTMLElement>(html`<section></section>`);
  const dashboard = mountLiveDashboard(root, { registry, context: { viewerId: 'viewer', tenantId: 'tenant', authorizationRevision: '1' }, query: 'records', labels, authorizeDrilldown: () => true, pageSize: 1, totalRows: 2,
    sources: { available: () => available, activate: source => { activated.push(source.id); }, label: 'Sources des valeurs', unverified: 'Non vérifié', citation: source => `Consulter ${source.label}` },
  });
  const button = () => dashboard.valueSources.querySelector<HTMLButtonElement>('button')!;
  try {
    await dashboard.ready; await dashboard.refresh();
    expect(dashboard.valueSources.textContent).to.include('First: 10');
    expect(button().textContent).to.equal('Consulter First source'); button().click();
    expect(activated).to.deep.equal(['First']);
    expect(await dashboard.drilldown('First')).to.equal(true);
    expect(dashboard.detailSources.textContent).to.include('Consulter First source');
    expect(await dashboard.back()).to.equal(true);
    root.querySelector<HTMLButtonElement>('[data-action="next"]')!.click();
    await waitUntil(() => dashboard.valueSources.textContent?.includes('Second: 20') ?? false);
    expect(dashboard.valueSources.querySelector('[data-value-pointer]')!.getAttribute('data-value-pointer')).to.equal('/0/c1');
    button().click(); expect(activated).to.deep.equal(['First', 'Second']);
    const filter = root.querySelector<HTMLInputElement>('input[name="category"]')!;
    filter.value = 'Filtered'; filter.dispatchEvent(new Event('change', { bubbles: true }));
    await waitUntil(() => button()?.textContent === 'Consulter Filtered source');
    button().click(); expect(activated.at(-1)).to.equal('Filtered');
    mode = 'partial'; await dashboard.refresh();
    expect(dashboard.status.textContent).to.equal('partial');
    expect(button().textContent).to.equal('Consulter Filtered source');
    const detached = button();
    for (const next of ['missing', 'dangling'] as const) {
      mode = next; await dashboard.refresh();
      expect(dashboard.valueSources.querySelectorAll('button').length).to.equal(0);
      expect(dashboard.valueSources.querySelector('[data-unverified]')!.textContent).to.equal('Non vérifié');
    }
    detached.click(); expect(activated).to.deep.equal(['First', 'Second', 'Filtered']);
    mode = 'ready'; await dashboard.refresh();
    const denied = button(); available = false; denied.click();
    expect(activated).to.deep.equal(['First', 'Second', 'Filtered']);
    expect(dashboard.valueSources.querySelector('[data-unverified]')!.textContent).to.equal('Non vérifié');
    available = true; dashboard.refreshSources(); expect(button().textContent).to.equal('Consulter Filtered source');
    const revoked = button(); dashboard.live.revoke(); revoked.click();
    expect(dashboard.valueSources.textContent).to.equal('');
    expect(activated).to.deep.equal(['First', 'Second', 'Filtered']);
  } finally { dashboard.dispose(); }
});

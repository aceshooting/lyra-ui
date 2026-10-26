import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { registerLyraLocale } from '@aceshooting/lyra-ui/localization.js';
import { focusByKeyboard } from '../../../lyra-ui/test/wtr-focus.js';
import { setReducedMotion } from '../../../lyra-ui/test/wtr-media.js';
import { initialCatalog, createCatalog } from '../../src/catalog.js';
import { LyraGenViewElement } from '../../src/gen-view.js';
import { resolveReferences } from '../../src/references.js';
import type { LyraGenAction, LyraGenCatalog, LyraGenNode, LyraGenView } from '../../src/types.js';

interface UpdatableElement extends HTMLElement { readonly updateComplete: Promise<boolean> }

const table: LyraGenNode = {
  id: 'records', type: 'table', props: {
    caption: 'Monthly results',
    columns: [{ key: 'c0', label: 'Month', sortable: true }, { key: 'c1', label: 'Orders', sortable: true }],
    rows: [{ c0: 'February', c1: 12 }, { c0: 'January', c1: 5 }],
  },
};
const chart: LyraGenNode = {
  id: 'trend', type: 'chart', props: {
    label: 'Orders by month', labels: ['January', 'February'],
    datasets: [{ label: 'Orders', data: [5, 12] }], withDataTable: true, withLegend: true,
  },
};

function documentFor(root: LyraGenNode, catalog: LyraGenCatalog = initialCatalog, revision = 0): LyraGenView {
  return { version: '1', catalog: { id: catalog.id, version: catalog.version }, surfaceId: 'qualification', revision, root };
}

function composition(): LyraGenNode {
  return {
    id: 'report', type: 'stack', children: [
      { id: 'heading', type: 'heading', text: 'Order review' },
      { id: 'summary', type: 'text', text: 'Review the monthly results before submitting your note.' },
      {
        id: 'feedback', type: 'form', props: { ariaLabel: 'Report feedback' }, children: [
          { id: 'note', type: 'input', props: { label: 'Review note', hint: 'Include an observation.', name: 'note' }, bindings: { value: '/note' } },
          { id: 'submit', type: 'button', props: { type: 'submit' }, text: 'Save review' },
        ],
      },
      table, chart,
    ],
  };
}

function query<T extends Element = HTMLElement>(root: ParentNode, selector: string): T {
  const result = root.querySelector<T>(selector);
  expect(result !== null, `Expected rendered ${selector}`).to.equal(true);
  if (!result) throw new Error(`Missing rendered ${selector}`);
  return result;
}

function activeElement(): Element | null {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active;
}

async function settled(host: LyraGenViewElement): Promise<void> {
  await host.updateComplete;
  await waitUntil(() => host.shadowRoot?.querySelector('[part="loading"]') === null, 'All generated components loaded', { timeout: 5000 });
  await host.updateComplete;
  for (const child of host.shadowRoot?.querySelectorAll<UpdatableElement>('*') ?? []) {
    if ('updateComplete' in child) await child.updateComplete;
  }
}

async function mount(root = composition(), catalog = initialCatalog): Promise<LyraGenViewElement> {
  const host = await fixture<LyraGenViewElement>(html`<lr-gen-view .catalog=${catalog} .document=${documentFor(root, catalog)} .bindingState=${{ note: '' }}></lr-gen-view>`);
  await settled(host);
  return host;
}

describe('generated composition qualification', () => {
  it('renders a populated form, table, chart alternative, and literal text with accessible names', async () => {
    const host = await mount();
    const root = host.shadowRoot!;
    expect(query(root, 'h2').textContent).to.equal('Order review');
    expect(query(root, 'form').getAttribute('aria-label')).to.equal('Report feedback');
    const input = query(root, 'lr-input');
    const nativeInput = query<HTMLInputElement>(input.shadowRoot!, 'input');
    expect(Array.from(nativeInput.labels ?? []).some(label => label.textContent?.includes('Review note'))).to.equal(true);
    const results = query(root, 'lr-table');
    expect(results.shadowRoot?.querySelectorAll('tbody tr').length).to.equal(2);
    expect(results.shadowRoot?.querySelector('caption')?.textContent).to.contain('Monthly results');
    expect(Array.from(results.shadowRoot!.querySelectorAll('tbody [part="cell"]'), cell => cell.textContent?.trim())).to.deep.equal(['February', '12', 'January', '5']);
    const trend = query(root, 'lr-lite-chart');
    expect(trend.shadowRoot?.querySelectorAll('[part="bar"]').length).to.equal(2);
    expect(trend.shadowRoot?.querySelector('svg')?.getAttribute('aria-label')).to.equal('Orders by month');
    expect(trend.shadowRoot?.querySelector('[part="data-table"]')?.textContent).to.contain('February');
    await expect(host).to.be.accessible();
  });

  it('keeps the edited input and keyboard focus through incremental text and data revisions', async () => {
    const host = await mount();
    const control = query<UpdatableElement>(host.shadowRoot!, 'lr-input');
    const nativeInput = query<HTMLInputElement>(control.shadowRoot!, 'input');
    await focusByKeyboard(nativeInput);
    const state = oneEvent(host, 'lr-gen-state-change');
    await sendKeys({ type: 'Check the February total' });
    await state;
    expect(nativeInput.value).to.equal('Check the February total');

    const original = composition();
    const changed: LyraGenNode = {
      ...original,
      children: original.children!.map(node => node.id === 'summary'
        ? { ...node, text: 'The analysis is complete. Review the updated total.' }
        : node.id === 'records' ? { ...table, props: { ...table.props, rows: [{ c0: 'February', c1: 14 }] } } : node),
    };
    host.document = documentFor(changed, initialCatalog, 1);
    await settled(host);
    expect(query(host.shadowRoot!, 'lr-input') === control).to.equal(true);
    expect(activeElement() === nativeInput).to.equal(true);
    expect(nativeInput.value).to.equal('Check the February total');
    expect(host.shadowRoot!.textContent).to.contain('analysis is complete');
    expect(query(host.shadowRoot!, 'lr-table').shadowRoot?.querySelectorAll('tbody tr').length).to.equal(1);
    expect(Array.from(query(host.shadowRoot!, 'lr-table').shadowRoot!.querySelectorAll('tbody [part="cell"]'), cell => cell.textContent?.trim())).to.deep.equal(['February', '14']);
    await sendKeys({ type: '!' });
    expect(nativeInput.value).to.equal('Check the February total!');
  });

  it('submits edited form state once through a keyboard activated host-authorized action', async () => {
    const catalog = createCatalog({ ...initialCatalog, actions: { save: { payload: { type: 'object', properties: { note: { type: 'string' } }, required: ['note'], additionalProperties: false } } } });
    const form: LyraGenNode = {
      id: 'review', type: 'form', props: { ariaLabel: 'Review feedback' }, action: { name: 'save' },
      children: [
        { id: 'note', type: 'input', props: { label: 'Note', name: 'note' }, bindings: { value: '/note' } },
        { id: 'save', type: 'button', props: { type: 'submit' }, text: 'Save' },
      ],
    };
    const host = await mount(form, catalog);
    host.enabledActions = ['save'];
    const nativeInput = query<HTMLInputElement>(query(host.shadowRoot!, 'lr-input').shadowRoot!, 'input');
    await focusByKeyboard(nativeInput);
    const state = oneEvent(host, 'lr-gen-state-change');
    await sendKeys({ type: 'Approved after review' });
    await state;
    await focusByKeyboard(query<HTMLElement>(query(host.shadowRoot!, 'lr-button').shadowRoot!, 'button'));
    let count = 0;
    host.addEventListener('lr-gen-action', () => { count += 1; });
    const action = oneEvent(host, 'lr-gen-action');
    await sendKeys({ press: 'Enter' });
    const event = await action as CustomEvent<LyraGenAction>;
    expect(event.detail.name).to.equal('save');
    expect(event.detail.payload).to.deep.equal({ note: 'Approved after review' });
    expect(count).to.equal(1);
    await expect(host).to.be.accessible();
  });

  for (const locale of [
    { lang: 'en', dir: 'ltr', heading: 'Monthly orders', label: 'Orders', empty: 'No generated view to display.', filter: 'Filter rows', chartData: 'Chart data', bar: '{series}, {label}: {value}', mark: '{series}, {label}: {value} ({index} of {total})' },
    { lang: 'fr', dir: 'ltr', heading: 'Commandes mensuelles', label: 'Commandes', empty: 'Aucun contenu généré à afficher.', filter: 'Filtrer les lignes', chartData: 'Données du graphique', bar: '{series}, {label} : {value}', mark: '{series}, {label} : {value} ({index} sur {total})' },
    { lang: 'ar', dir: 'rtl', heading: 'الطلبات الشهرية', label: 'الطلبات', empty: 'لا يوجد عرض مولّد لعرضه.', filter: 'تصفية الصفوف', chartData: 'بيانات المخطط', bar: '{series}، {label}: {value}', mark: '{series}، {label}: {value} ({index} من {total})' },
  ] as const) {
    it(`preserves caller text and inherited ${locale.lang} semantics with real keyboard table navigation`, async () => {
      registerLyraLocale(locale.lang, {
        genViewEmpty: locale.empty,
        tableFilterLabel: locale.filter,
        tableFilterPlaceholder: locale.filter,
        chartData: locale.chartData,
        liteChartBarLabel: locale.bar,
        liteChartMarkSummary: locale.mark,
      });
      const host = await mount({ id: 'locale', type: 'stack', children: [
        { id: 'title', type: 'heading', text: locale.heading },
        { ...table, props: { ...table.props, caption: locale.label } }, chart,
      ] });
      host.parentElement!.lang = locale.lang;
      host.parentElement!.dir = locale.dir;
      await settled(host);
      expect(query(host.shadowRoot!, 'h2').textContent).to.equal(locale.heading);
      const grid = query<UpdatableElement>(host.shadowRoot!, 'lr-table');
      expect(getComputedStyle(grid).direction).to.equal(locale.dir);
      await waitUntil(() => query(host.shadowRoot!, 'lr-lite-chart').shadowRoot?.querySelector('[part="data-list"]')?.getAttribute('aria-label') === locale.chartData);
      const headers = grid.shadowRoot!.querySelectorAll<HTMLElement>('[part="header-cell"]');
      expect(headers.length).to.equal(2);
      await focusByKeyboard(headers[0]!);
      await sendKeys({ press: locale.dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight' });
      await grid.updateComplete;
      expect(activeElement() === headers[1]).to.equal(true);
      expect(headers[1]!.getAttribute('tabindex')).to.equal('0');
      await expect(host).to.be.accessible();
      host.document = undefined;
      await settled(host);
      expect(query(host.shadowRoot!, '[part="empty"]').textContent).to.equal(locale.empty);
    });
  }

  it('renders fallback and application locale messages without translating caller content', async () => {
    const host = await fixture<LyraGenViewElement>(html`<lr-gen-view lang="qaa-QM"></lr-gen-view>`);
    await host.updateComplete;
    expect(query(host.shadowRoot!, '[part="empty"]').textContent).to.equal('No generated view to display.');
    registerLyraLocale('qaa-QM', { genViewEmpty: 'Aucun contenu généré.' });
    await waitUntil(() => host.shadowRoot?.textContent?.includes('Aucun contenu généré.') === true);
    host.strings = { genViewEmpty: 'Application empty-state message' };
    await host.updateComplete;
    expect(query(host.shadowRoot!, '[part="empty"]').textContent).to.equal('Application empty-state message');
    await expect(host).to.be.accessible();
  });

  it('contains long translated text, controls, tables, and charts in a 320px allocation', async () => {
    const longText = 'Vérification des résultats mensuels et des observations. '.repeat(14);
    const root = composition();
    const host = await mount({ ...root, children: root.children!.map(node => node.id === 'summary' ? { ...node, text: longText } : node) });
    host.style.inlineSize = '320px';
    host.style.maxInlineSize = '100%';
    await settled(host);
    const surface = query<HTMLElement>(host.shadowRoot!, '[part="surface"]');
    expect(Math.round(host.getBoundingClientRect().width)).to.equal(320);
    expect(surface.scrollWidth).to.be.at.most(surface.clientWidth + 1);
    for (const tag of ['lr-input', 'lr-table', 'lr-lite-chart']) {
      expect(query(host.shadowRoot!, tag).getBoundingClientRect().width, `${tag} allocation`).to.be.at.most(321);
    }
    expect(query(host.shadowRoot!, 'p').textContent).to.equal(longText);
    await expect(host).to.be.accessible();
  });

  it('honors reduced motion on a generated skeleton while preserving its accessible loading label', async () => {
    await setReducedMotion('no-preference');
    try {
      const host = await mount({ id: 'skeleton', type: 'skeleton', props: { label: 'Preparing monthly report', effect: 'pulse' } });
      const skeleton = query(host.shadowRoot!, 'lr-skeleton');
      const indicator = query(skeleton.shadowRoot!, '[part~="indicator"]');
      expect(getComputedStyle(indicator).animationName).to.equal('lr-skeleton-pulse');
      await setReducedMotion('reduce');
      await waitUntil(() => getComputedStyle(indicator).animationName === 'none');
      expect(skeleton.getAttribute('label') ?? (skeleton as HTMLElement & { label?: string }).label).to.equal('Preparing monthly report');
      await expect(host).to.be.accessible();
    } finally {
      await setReducedMotion('no-preference');
    }
  });

  it('fails closed on catalog mismatch, unavailable actions, and unresolved host references, then recovers', async () => {
    const host = await mount({ id: 'safe', type: 'text', text: 'Current authorized content' });
    const rejected: LyraGenView[] = [
      { ...documentFor({ id: 'mismatch', type: 'text', text: 'Wrong catalog content' }), catalog: { id: 'unavailable', version: '1' } },
      documentFor({ id: 'action', type: 'button', text: 'Unavailable action', action: { name: 'not-authorized' } }),
      documentFor({ id: 'reference', type: 'input', props: { label: 'Unavailable record', value: { $ref: '@data:missing#/value' } } }),
    ];
    const resolution = resolveReferences({ $ref: '@data:missing#/value' }, { data: new Map() });
    expect(resolution.ok).to.equal(false);
    for (const candidate of rejected) {
      host.document = candidate;
      await settled(host);
      expect(query(host.shadowRoot!, '[part="error"]').textContent).to.equal('This generated view cannot be displayed.');
      expect(host.shadowRoot!.querySelectorAll('button,lr-button,lr-input').length).to.equal(0);
      await expect(host).to.be.accessible();
    }
    host.document = documentFor({ id: 'safe', type: 'text', text: 'Recovered authorized content' }, initialCatalog, 1);
    await settled(host);
    expect(host.shadowRoot!.textContent).to.contain('Recovered authorized content');
    expect(host.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
  });

  it('localizes a rejected lazy component, conceals technical errors, and recovers with another catalog', async () => {
    const catalog = createCatalog({
      id: 'qualification-failure', version: '1',
      components: { report: { tag: 'lr-qualification-failure', properties: {}, text: true, minimumBlockSize: '12rem', load: async () => { throw new Error('Internal loader details must stay private'); } } },
    });
    const host = await mount({ id: 'report', type: 'report', text: 'Failed content' }, catalog);
    expect(query(host.shadowRoot!, '[part="error"]').textContent).to.equal('This component could not be loaded.');
    expect(host.shadowRoot!.textContent).to.not.contain('Internal loader details');
    expect(host.shadowRoot!.querySelectorAll('lr-qualification-failure').length).to.equal(0);
    await expect(host).to.be.accessible();
    host.catalog = initialCatalog;
    host.document = documentFor({ id: 'recovered', type: 'text', text: 'Report is available again' }, initialCatalog, 1);
    await settled(host);
    expect(query(host.shadowRoot!, 'p').textContent).to.equal('Report is available again');
  });

  it('discards detached lazy completions and starts a fresh load when the same surface reconnects', async () => {
    const completions: Array<() => void> = [];
    const catalog = createCatalog({
      id: 'qualification-reconnect', version: '1',
      components: {
        report: {
          tag: 'lr-qualification-reconnect', properties: {}, text: true,
          load: () => new Promise<void>(resolve => { completions.push(resolve); }),
        },
      },
    });
    const host = await fixture<LyraGenViewElement>(html`<lr-gen-view .catalog=${catalog} .document=${documentFor({ id: 'report', type: 'report', text: 'Ready after reconnect' }, catalog)}></lr-gen-view>`);
    await waitUntil(() => completions.length === 1);
    expect(query(host.shadowRoot!, '[part="loading"]').textContent).to.equal('Loading component…');
    const parent = host.parentElement!;
    host.remove();
    completions[0]!();
    await Promise.resolve();
    await Promise.resolve();
    expect(host.shadowRoot!.querySelectorAll('lr-qualification-reconnect').length).to.equal(0);
    if (!customElements.get('lr-qualification-reconnect')) customElements.define('lr-qualification-reconnect', class extends HTMLElement {});
    parent.append(host);
    await waitUntil(() => completions.length === 2);
    expect(host.shadowRoot!.querySelectorAll('[part="loading"]').length).to.equal(1);
    completions[1]!();
    await settled(host);
    expect(query(host.shadowRoot!, 'lr-qualification-reconnect').textContent).to.equal('Ready after reconnect');
    expect(host.shadowRoot!.querySelectorAll('[part="loading"]').length).to.equal(0);
    await expect(host).to.be.accessible();
  });
});

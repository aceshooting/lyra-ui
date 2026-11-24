import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { createCatalog } from '../../src/catalog.js';
import { LyraGenViewElement } from '../../src/gen-view.js';
import type { LyraGenQueryRequest } from '../../src/gen-view.class.js';
import type { LyraGenView } from '../../src/types.js';

class Total extends HTMLElement { value = 0; }
customElements.define('gen-query-total', Total);
class Picker extends HTMLElement { value = ''; label = ''; }
customElements.define('gen-query-picker', Picker);

const catalog = createCatalog({ id: 'queries', version: '1', components: {
  stack: { tag: 'div', properties: {}, children: true },
  picker: { tag: 'gen-query-picker', properties: { value: { type: 'string', maxLength: 32 }, label: { type: 'string', maxLength: 64 } }, accessibleName: { required: true, properties: ['label'] }, bindings: { value: { event: 'change', property: 'value' } } },
  total: { tag: 'gen-query-total', properties: { value: { type: 'number', minimum: 0, maximum: 1e9 } } },
}, queries: { revenue: { params: { type: 'object', properties: { region: { type: 'string', enum: ['eu', 'us'] } }, required: ['region'], additionalProperties: false }, result: { type: 'object', properties: { total: { type: 'number', minimum: 0, maximum: 1e9 } }, required: ['total'], additionalProperties: false } } } });
const document: LyraGenView = { version: '1', catalog: { id: 'queries', version: '1' }, surfaceId: 'q', revision: 0, root: { id: 'root', type: 'stack', children: [
  { id: 'region', type: 'picker', props: { label: 'Region', value: 'eu' }, bindings: { value: '/region' } },
  { id: 'sum', type: 'total', props: { value: 0 }, dataQuery: { name: 'revenue', paramReads: { region: '/region' } }, liveReads: { value: '/total' } },
] } };
const deferred = <T>() => { let resolve!: (value: T) => void; let reject!: (reason: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

describe('generated view data queries', () => {
  it('runs a declared query from state, re-runs and aborts on parameter change, and keeps the last result on failure', async () => {
    const calls: { request: LyraGenQueryRequest; reply: ReturnType<typeof deferred<unknown>> }[] = [];
    const provider = (request: LyraGenQueryRequest): Promise<unknown> => { const reply = deferred<unknown>(); calls.push({ request, reply }); return reply.promise; };
    const element = await fixture<LyraGenViewElement>(html`<lr-gen-view .catalog=${catalog} .queryProvider=${provider} .document=${document}></lr-gen-view>`);
    await waitUntil(() => calls.length === 1, 'first query run');
    expect(calls[0]!.request.name).to.equal('revenue');
    expect(calls[0]!.request.params).to.deep.equal({ region: 'eu' });
    await waitUntil(() => element.status === 'ready');
    const sum = element.elementForNode('sum') as Total;
    expect(sum.part.contains('query-pending')).to.equal(true);
    calls[0]!.reply.resolve({ total: 120 });
    await waitUntil(() => sum.value === 120, 'first result shown');
    expect(sum.part.contains('query-pending')).to.equal(false);

    const picker = element.elementForNode('region') as Picker;
    picker.value = 'us';
    picker.dispatchEvent(new Event('change'));
    await waitUntil(() => calls.length === 2, 're-run on parameter change');
    expect(calls[1]!.request.params).to.deep.equal({ region: 'us' });
    picker.value = 'eu';
    picker.dispatchEvent(new Event('change'));
    await waitUntil(() => calls.length === 3, 'superseding run');
    expect(calls[1]!.request.signal.aborted).to.equal(true);
    calls[1]!.reply.resolve({ total: 999 });
    calls[2]!.reply.reject(new Error('Backend detail must stay private'));
    await waitUntil(() => sum.part.contains('query-failed'), 'failure is marked');
    expect(sum.value).to.equal(120);
    expect(element.shadowRoot!.textContent).not.to.contain('Backend detail');
  });

  it('shows props and asks nothing without a provider, and rejects invalid results', async () => {
    const element = await fixture<LyraGenViewElement>(html`<lr-gen-view .catalog=${catalog} .document=${document}></lr-gen-view>`);
    await waitUntil(() => element.status === 'ready');
    expect((element.elementForNode('sum') as Total).value).to.equal(0);
    let resolveResult!: (value: unknown) => void;
    element.queryProvider = () => new Promise(resolve => { resolveResult = resolve; });
    await waitUntil(() => resolveResult !== undefined);
    resolveResult({ total: -5 });
    await waitUntil(() => element.elementForNode('sum')!.part.contains('query-failed'));
    expect((element.elementForNode('sum') as Total).value).to.equal(0);
  });
});

describe('generated view repeat', () => {
  const listDocument: LyraGenView = { version: '1', catalog: { id: 'queries', version: '1' }, surfaceId: 'list', revision: 0, root: { id: 'root', type: 'stack', children: [
    { id: 'list', type: 'stack', repeat: { items: '/hosts', key: '/name' }, children: [{ id: 'host', type: 'total', props: { value: 0 }, itemReads: { value: '/load' } }] },
  ] } };
  const ids = (element: LyraGenViewElement): string[] => [...element.shadowRoot!.querySelectorAll<HTMLElement>('[data-gen-id^="host@"]')].map(node => node.dataset['genId']!);

  it('renders one keyed item per live array entry and keeps element identity across reorder and updates', async () => {
    const element = await fixture<LyraGenViewElement>(html`<lr-gen-view .catalog=${catalog} .liveData=${{ hosts: [{ name: 'web-1', load: 40 }, { name: 'web 2', load: 70 }] }} .document=${listDocument}></lr-gen-view>`);
    await waitUntil(() => element.status === 'ready');
    expect(ids(element)).to.deep.equal(['host@sweb-1', 'host@sweb_00202']);
    const first = element.elementForNode('host@sweb-1') as Total;
    expect(first.value).to.equal(40);
    element.liveData = { hosts: [{ name: 'web 2', load: 75 }, { name: 'web-1', load: 45 }, { name: 'web-1', load: 99 }, { name: 'db-1', load: 'bad' }] };
    await waitUntil(() => ids(element).length === 3);
    expect(ids(element)).to.deep.equal(['host@sweb_00202', 'host@sweb-1', 'host@sdb-1']);
    expect(element.elementForNode('host@sweb-1') === first).to.equal(true);
    expect(first.value).to.equal(45);
    expect((element.elementForNode('host@sdb-1') as Total).value).to.equal(0);
    element.liveData = {};
    await waitUntil(() => ids(element).length === 0);
  });
});

describe('generated view conditions and computed values', () => {
  const exprCatalog = createCatalog({ id: 'expr', version: '1', components: {
    stack: { tag: 'div', properties: {}, children: true },
    picker: { tag: 'gen-query-picker', properties: { value: { type: 'string', maxLength: 32 }, label: { type: 'string', maxLength: 64 } }, accessibleName: { required: true, properties: ['label'] }, bindings: { value: { event: 'change', property: 'value' } } },
    label: { tag: 'gen-query-total', properties: { value: { type: 'string', maxLength: 64 }, disabled: { type: 'boolean' } } },
  } });
  const exprDocument: LyraGenView = { version: '1', catalog: { id: 'expr', version: '1' }, surfaceId: 'expr', revision: 0, root: { id: 'root', type: 'stack', children: [
    { id: 'mode', type: 'picker', props: { label: 'Mode', value: 'simple' }, bindings: { value: '/mode' } },
    { id: 'advanced', type: 'label', props: { value: 'Advanced settings' }, visible: { source: 'state', pointer: '/mode', op: 'equals', value: 'advanced' } },
    { id: 'submit', type: 'label', props: { value: 'Submit' }, checks: [{ source: 'live', pointer: '/quota/left', op: 'gt', value: 0 }] },
    { id: 'total', type: 'label', props: { value: '-' }, computes: { value: { fn: 'formatNumber', arg: { source: 'live', pointer: '/revenue' } } } },
  ] } };

  it('hides by state, disables by failing checks and formats computed values, keeping element identity', async () => {
    const element = await fixture<LyraGenViewElement>(html`<lr-gen-view lang="en" .catalog=${exprCatalog} .liveData=${{ quota: { left: 0 }, revenue: 1234567.5 }} .document=${exprDocument}></lr-gen-view>`);
    await waitUntil(() => element.status === 'ready');
    const advanced = element.elementForNode('advanced')!;
    expect(advanced.hidden).to.equal(true);
    expect(Reflect.get(element.elementForNode('submit')!, 'disabled')).to.equal(true);
    expect((element.elementForNode('total') as Total).value).to.equal('1,234,567.5');
    const picker = element.elementForNode('mode') as Picker;
    picker.value = 'advanced';
    picker.dispatchEvent(new Event('change'));
    await waitUntil(() => !advanced.hidden, 'shown when the state matches');
    expect(element.elementForNode('advanced') === advanced).to.equal(true);
    element.liveData = { quota: { left: 3 }, revenue: 'not a number' };
    await waitUntil(() => Reflect.get(element.elementForNode('submit')!, 'disabled') !== true, 'enabled when checks pass');
    expect((element.elementForNode('total') as Total).value).to.equal('-');
  });
});

describe('generated view per-node accessibility', () => {
  it('maps label, description, live and hidden onto the rendered element', async () => {
    const a11yCatalog = createCatalog({ id: 'a11y', version: '1', components: {
      stack: { tag: 'div', properties: {}, children: true },
      figure: { tag: 'gen-query-picker', properties: { label: { type: 'string', maxLength: 64 } }, accessibleName: { required: true, properties: ['label'] } },
      note: { tag: 'p', properties: {}, text: true },
    } });
    const document: LyraGenView = { version: '1', catalog: { id: 'a11y', version: '1' }, surfaceId: 'a11y', revision: 0, root: { id: 'root', type: 'stack', children: [
      { id: 'chart', type: 'figure', a11y: { label: 'Revenue by month', description: 'Twelve monthly totals.' } },
      { id: 'status', type: 'note', text: 'Updated', a11y: { live: 'polite' } },
      { id: 'flourish', type: 'note', text: '★', a11y: { hidden: true } },
    ] } };
    const element = await fixture<LyraGenViewElement>(html`<lr-gen-view .catalog=${a11yCatalog} .document=${document}></lr-gen-view>`);
    await waitUntil(() => element.status === 'ready');
    const chart = element.elementForNode('chart') as Picker;
    expect(chart.label).to.equal('Revenue by month');
    expect(chart.getAttribute('aria-description')).to.equal('Twelve monthly totals.');
    expect(element.elementForNode('status')!.getAttribute('aria-live')).to.equal('polite');
    expect(element.elementForNode('flourish')!.getAttribute('aria-hidden')).to.equal('true');
  });
});

describe('generated view streaming preview', () => {
  it('renders an inert preview without readiness, marks open nodes and keeps elements when the commit arrives', async () => {
    const previewCatalog = createCatalog({ id: 'preview', version: '1', components: {
      stack: { tag: 'div', properties: {}, children: true },
      note: { tag: 'p', properties: {}, text: true },
    } });
    const finalView: LyraGenView = { version: '1', catalog: { id: 'preview', version: '1' }, surfaceId: 'stream', revision: 3, root: { id: 'root', type: 'stack', children: [{ id: 'a', type: 'note', text: 'First' }, { id: 'b', type: 'note', text: 'Second' }] } };
    const partialView: LyraGenView = { ...finalView, root: { id: 'root', type: 'stack', children: [{ id: 'a', type: 'note', text: 'First' }] } };
    const element = await fixture<LyraGenViewElement>(html`<lr-gen-view .catalog=${previewCatalog}></lr-gen-view>`);
    let ready = 0;
    element.addEventListener('lr-gen-ready', () => ready++);
    element.partial = { view: partialView, partialNodes: ['root'], sequence: 1, receivedCodeUnits: 40 };
    await waitUntil(() => element.elementForNode('a') !== undefined || element.shadowRoot!.querySelector('[data-gen-id="a"]') !== null, 'preview renders');
    const root = element.shadowRoot!.querySelector<HTMLElement>('[data-gen-id="root"]')!;
    const first = element.shadowRoot!.querySelector<HTMLElement>('[data-gen-id="a"]')!;
    expect(root.part.contains('partial')).to.equal(true);
    expect(root.getAttribute('aria-busy')).to.equal('true');
    expect(element.shadowRoot!.querySelector<HTMLElement>('[part="surface"]')!.inert).to.equal(true);
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(ready).to.equal(0);
    element.document = finalView;
    await waitUntil(() => element.status === 'ready', 'commit becomes ready');
    expect(ready).to.equal(1);
    expect(element.elementForNode('a') === first).to.equal(true);
    expect(root.part.contains('partial')).to.equal(false);
    expect(root.hasAttribute('aria-busy')).to.equal(false);
    expect(element.shadowRoot!.querySelector<HTMLElement>('[part="surface"]')!.inert).to.equal(false);
    expect(element.elementForNode('b')?.textContent).to.equal('Second');
  });
});

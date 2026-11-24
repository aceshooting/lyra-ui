import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { createCatalog } from '../../src/catalog.js';
import { LyraGenViewElement } from '../../src/gen-view.js';
import type { LyraGenReady } from '../../src/gen-view.class.js';
import type { LyraGenNode, LyraGenView } from '../../src/types.js';

/** A read target whose value lives in a property, like a library meter or stat. */
class ReadTarget extends HTMLElement { value = ''; }
customElements.define('gen-read-target', ReadTarget);

const catalog = createCatalog({ id: 'changes', version: '1', components: {
  group: { tag: 'div', properties: {}, children: true },
  text: { tag: 'p', properties: {}, text: true },
  field: { tag: 'input', properties: { value: { type: 'string', maxLength: 10 }, ariaLabel: { type: 'string' } }, accessibleName: { required: true, properties: ['ariaLabel'] }, bindings: { value: { event: 'input', property: 'value' } } },
  out: { tag: 'gen-read-target', properties: { value: { type: 'string', maxLength: 2 } } }
} });
const view = (children: LyraGenNode[], revision: number): LyraGenView => ({ version: '1', surfaceId: 'changes', revision, catalog: { id: 'changes', version: '1' }, root: { id: 'root', type: 'group', children } });
const text = (id: string, value = id): LyraGenNode => ({ id, type: 'text', text: value });
const node = (element: LyraGenViewElement, id: string): HTMLElement => element.shadowRoot!.querySelector<HTMLElement>(`[data-gen-id="${id}"]`)!;

describe('generated view revision changes', () => {
  it('reports added, changed and removed nodes and marks the latest ones with the changed part', async () => {
    const element = await fixture<LyraGenViewElement>(html`<lr-gen-view .catalog=${catalog}></lr-gen-view>`);
    let ready = oneEvent(element, 'lr-gen-ready');
    element.document = view([text('a'), text('b')], 0);
    expect((await ready as CustomEvent<LyraGenReady>).detail).to.deep.equal({ surfaceId: 'changes', revision: 0 });
    expect(node(element, 'a').part.contains('changed')).to.equal(false);

    ready = oneEvent(element, 'lr-gen-ready');
    element.document = view([text('a'), text('c'), text('b', 'B edited')], 1);
    const second = (await ready as CustomEvent<LyraGenReady>).detail;
    expect(second.changes).to.deep.equal({ added: ['c'], changed: ['b'], removed: [] });
    expect(['a', 'b', 'c'].map(id => node(element, id).part.contains('changed'))).to.deep.equal([false, true, true]);

    ready = oneEvent(element, 'lr-gen-ready');
    element.document = view([text('a'), text('b', 'B edited')], 2);
    const third = (await ready as CustomEvent<LyraGenReady>).detail;
    expect(third.changes).to.deep.equal({ added: [], changed: [], removed: ['c'] });
    expect(node(element, 'b').part.contains('changed')).to.equal(false);
  });

  it('starts without changes when the surface identity changes', async () => {
    const element = await fixture<LyraGenViewElement>(html`<lr-gen-view .catalog=${catalog} .document=${view([text('a')], 0)}></lr-gen-view>`);
    await waitUntil(() => element.status === 'ready');
    const ready = oneEvent(element, 'lr-gen-ready');
    element.document = { ...view([text('a'), text('b')], 0), surfaceId: 'other' };
    expect((await ready as CustomEvent<LyraGenReady>).detail).to.deep.equal({ surfaceId: 'other', revision: 0 });
  });
});

describe('generated view node lookup', () => {
  it('maps node ids to their stable rendered elements across revisions and reorders', async () => {
    const element = await fixture<LyraGenViewElement>(html`<lr-gen-view .catalog=${catalog} .document=${view([text('a'), text('b')], 0)}></lr-gen-view>`);
    await waitUntil(() => element.status === 'ready');
    const a = element.elementForNode('a')!;
    expect(a.dataset['genId']).to.equal('a');
    expect(a.dataset['genType']).to.equal('text');
    expect(element.elementForNode('missing') === undefined).to.equal(true);
    const ready = oneEvent(element, 'lr-gen-ready');
    element.document = view([text('b'), text('a', 'A edited')], 1);
    await ready;
    expect(element.elementForNode('a') === a).to.equal(true);
    expect(a.textContent).to.equal('A edited');
    expect(element.shadowRoot!.querySelector('[data-gen-id="root"]')!.firstElementChild === element.elementForNode('b')).to.equal(true);
    element.document = view([text('b')], 2);
    await waitUntil(() => element.elementForNode('a') === undefined);
  });
});

describe('generated view live data', () => {
  it('shows host-published live values without a revision and falls back to props when invalid', async () => {
    const element = await fixture<LyraGenViewElement>(html`<lr-gen-view .catalog=${catalog} .liveData=${{ cpu: { label: '61' } }} .document=${view([
      { id: 'shown', type: 'out', props: { value: '-' }, liveReads: { value: '/cpu/label' } }
    ], 0)}></lr-gen-view>`);
    await waitUntil(() => element.status === 'ready');
    const shown = node(element, 'shown') as ReadTarget;
    expect(shown.value).to.equal('61');
    let ready = 0;
    element.addEventListener('lr-gen-ready', () => ready++);
    element.liveData = { cpu: { label: '74' } };
    await waitUntil(() => shown.value === '74');
    element.liveData = { cpu: { label: 'far too long' } };
    await waitUntil(() => shown.value === '-');
    element.liveData = {};
    await element.updateComplete;
    expect(shown.value).to.equal('-');
    expect(ready).to.equal(0);
    expect(element.elementForNode('shown') === shown).to.equal(true);
  });
});

describe('generated view state reads', () => {
  it('renders a read property from bound state live and falls back to props when the value violates its schema', async () => {
    const element = await fixture<LyraGenViewElement>(html`<lr-gen-view .catalog=${catalog} .document=${view([
      { id: 'limit', type: 'field', props: { ariaLabel: 'Limit', value: '10' }, bindings: { value: '/limit' } },
      { id: 'shown', type: 'out', props: { value: '-' }, reads: { value: '/limit' } }
    ], 0)}></lr-gen-view>`);
    await waitUntil(() => element.status === 'ready');
    const field = node(element, 'limit') as HTMLInputElement;
    const shown = node(element, 'shown') as ReadTarget;
    expect(shown.value).to.equal('10');
    let changes = 0;
    element.addEventListener('lr-gen-ready', () => changes++);
    field.value = '42';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    await waitUntil(() => shown.value === '42');
    field.value = '12345';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    await waitUntil(() => shown.value === '-');
    expect(element.status).to.equal('ready');
    // Local edits re-render the same revision; they publish no new readiness.
    expect(changes).to.equal(0);
  });

  it('leaves the generated property untouched when no reads are declared', async () => {
    const element = await fixture<LyraGenViewElement>(html`<lr-gen-view .catalog=${catalog} .document=${view([
      { id: 'limit', type: 'field', props: { ariaLabel: 'Limit', value: '10' }, bindings: { value: '/limit' } },
      { id: 'shown', type: 'out', props: { value: '-' } }
    ], 0)}></lr-gen-view>`);
    await waitUntil(() => element.status === 'ready');
    const field = node(element, 'limit') as HTMLInputElement;
    field.value = '42';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    await element.updateComplete;
    expect((node(element, 'shown') as ReadTarget).value).to.equal('-');
  });
});

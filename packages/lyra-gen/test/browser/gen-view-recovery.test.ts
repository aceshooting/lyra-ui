import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { createCatalog } from '../../src/catalog.js';
import { LyraGenViewElement } from '../../src/gen-view.js';
import type { JsonValue, LyraGenCatalog, LyraGenNode, LyraGenView } from '../../src/types.js';

function catalogWith(prepare: (props: Readonly<Record<string, JsonValue>>) => void): LyraGenCatalog {
  return createCatalog({ id: 'recovery', version: '1', components: {
    group: { tag: 'div', properties: {}, children: true },
    item: { tag: 'p', properties: { title: { type: 'string' }, rows: { type: 'array', items: { type: 'array', items: { type: 'number' } } } }, prepareProperties: props => { prepare(props); return props; } },
  } });
}
function view(source: LyraGenCatalog, revision: number, children: LyraGenNode[]): LyraGenView {
  return { version: '1', surfaceId: 'recovery', revision, catalog: { id: source.id, version: source.version }, root: { id: 'root', type: 'group', children } };
}
const item = (id: string, title: string, rows: number[][] = [[1, 2], [3, 4]]): LyraGenNode => ({ id, type: 'item', props: { title, rows } });
const settled = async (element: LyraGenViewElement, status: string): Promise<void> => {
  await element.updateComplete;
  await waitUntil(() => element.status === status, `Generated view becomes ${status}`, { timeout: 5000 });
};

describe('generated view recovery and preparation caching', () => {
  it('recovers every node of a component type after a later revision prepares cleanly', async () => {
    const catalog = catalogWith(props => { if (props['title'] === 'bad') throw new Error('Adapter failure'); });
    const element = await fixture<LyraGenViewElement>(html`<lr-gen-view .catalog=${catalog} .document=${view(catalog, 0, [item('a', 'good'), item('b', 'bad')])}></lr-gen-view>`);
    await settled(element, 'error');
    element.document = view(catalog, 1, [item('a', 'good'), item('b', 'fixed')]);
    await settled(element, 'ready');
    for (const id of ['a', 'b']) {
      const rendered = element.shadowRoot!.querySelector(`[data-gen-id="${id}"]`)!;
      expect(rendered.getAttribute('part')).not.to.equal('error');
      expect(rendered.getAttribute('data-gen-type')).to.equal('item');
    }
  });

  it('recovers after a lowered limit is restored when a data failure preceded it', async () => {
    let fail = true;
    const catalog = catalogWith(() => { if (fail) throw new Error('Adapter failure'); });
    const element = await fixture<LyraGenViewElement>(html`<lr-gen-view .catalog=${catalog} .document=${view(catalog, 0, [item('a', 'one')])}></lr-gen-view>`);
    await settled(element, 'error');
    fail = false;
    element.limits = { maxStringLength: 4096 };
    await settled(element, 'ready');
    expect(element.shadowRoot!.querySelector('[data-gen-id="a"]')?.getAttribute('part')).not.to.equal('error');
  });

  it('keeps module-load failures sticky across documents', async () => {
    const catalog = createCatalog({ id: 'recovery-load', version: '1', components: {
      group: { tag: 'div', properties: {}, children: true },
      item: { tag: 'p', properties: { title: { type: 'string' } }, load: async () => { throw new Error('Import failure'); } },
    } });
    const source = (revision: number): LyraGenView => view(catalog, revision, [{ id: 'a', type: 'item', props: { title: `r${revision}` } }]);
    const element = await fixture<LyraGenViewElement>(html`<lr-gen-view .catalog=${catalog} .document=${source(0)}></lr-gen-view>`);
    await settled(element, 'error');
    element.document = source(1);
    await element.updateComplete;
    await settled(element, 'error');
    expect(element.shadowRoot!.querySelector('[data-gen-id="a"]')?.getAttribute('part')).to.equal('error');
  });

  it('does not re-prepare on a state-only render and re-prepares when a nested value changes', async () => {
    let prepared = 0;
    const catalog = catalogWith(() => { prepared++; });
    const element = await fixture<LyraGenViewElement>(html`<lr-gen-view .catalog=${catalog} .document=${view(catalog, 0, [item('a', 'one')])}></lr-gen-view>`);
    await settled(element, 'ready');
    const initial = prepared;
    expect(initial).to.be.greaterThan(0);
    element.requestUpdate();
    await element.updateComplete;
    expect(prepared).to.equal(initial);
    element.document = view(catalog, 1, [item('a', 'one')]);
    await settled(element, 'ready');
    expect(prepared).to.equal(initial);
    element.document = view(catalog, 2, [item('a', 'one', [[1, 2], [3, 5]])]);
    await settled(element, 'ready');
    expect(prepared).to.be.greaterThan(initial);
  });
});

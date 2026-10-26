import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { focusByKeyboard } from '../../../lyra-ui/test/wtr-focus.js';
import { createCatalog } from '../../src/catalog.js';
import { LyraGenViewElement } from '../../src/gen-view.js';
import type { LyraGenCatalog, LyraGenNode, LyraGenView } from '../../src/types.js';

const count = 512;
const tick = async () => { await new Promise<void>(resolve => requestAnimationFrame(() => resolve())); await Promise.resolve(); };
function catalog(prepare: () => void): LyraGenCatalog {
  return createCatalog({ id: 'sliced', version: '1', components: {
    group: { tag: 'div', properties: {}, children: true },
    item: { tag: 'p', properties: { title: { type: 'string' } }, text: true, prepareProperties: props => { prepare(); return props; } },
    field: { tag: 'input', properties: { value: { type: 'string' }, name: { type: 'string' } }, bindings: { value: { property: 'value', event: 'input' } } },
    form: { tag: 'form', properties: {}, children: true },
    action: { tag: 'button', properties: {}, text: true, events: ['click'] },
  }, actions: { save: { payload: { type: 'null' } } } });
}
function view(source: LyraGenCatalog, revision: number, large = false): LyraGenView {
  const children: LyraGenNode[] = [
    { id: 'form', type: 'form', children: [{ id: 'field', type: 'field', props: { name: 'name', value: 'Original' }, bindings: { value: '/name' } }] },
    { id: 'action', type: 'action', text: 'Save', action: { name: 'save', payload: null } },
    { id: 'copy', type: 'item', props: { title: `Revision ${revision}` }, text: `Revision ${revision}` },
  ];
  if (large) for (let index = 0; index < count; index++) children.push({ id: `item-${index}`, type: 'item', props: { title: `${revision}:${index}` }, text: `Item ${index}` });
  return { version: '1', surfaceId: 'sliced', revision, catalog: { id: source.id, version: source.version }, root: { id: 'root', type: 'group', children } };
}
function node<T extends HTMLElement = HTMLElement>(element: LyraGenViewElement, id: string): T {
  const result = element.shadowRoot!.querySelector<T>(`[data-gen-id="${id}"]`);
  if (!result) throw new Error(`Missing node ${id}`);
  return result;
}
async function began(prepared: () => number): Promise<void> {
  for (let frame = 0; frame < 60 && prepared() === 0; frame++) await tick();
  expect(prepared()).to.be.greaterThan(0);
  expect(prepared()).to.be.lessThan(count);
}

let created: DeferredChild[] = [];
class DeferredChild extends HTMLElement {
  finish!: () => void;
  readonly updateComplete = new Promise<boolean>(resolve => { this.finish = () => resolve(true); });
  constructor() { super(); created.push(this); }
}
customElements.define('gen-sliced-child', DeferredChild);

describe('generated view cooperative rendering', () => {
  it('prepares large revisions across frames and preserves live form identity, focus and edits until atomic commit', async () => {
    let prepared = 0;
    const source = catalog(() => prepared++);
    const element = await fixture<LyraGenViewElement>(html`<lr-gen-view .catalog=${source} .document=${view(source, 0)}></lr-gen-view>`);
    const field = node<HTMLInputElement>(element, 'field');
    const form = node<HTMLFormElement>(element, 'form');
    await focusByKeyboard(field);
    field.setSelectionRange(1, 4);
    prepared = 0;
    const ready = oneEvent(element, 'lr-gen-ready');
    element.document = view(source, 1, true);
    await began(() => prepared);
    expect(element.status).to.equal('loading');
    expect(node(element, 'copy').textContent).to.equal('Revision 0');
    expect(element.shadowRoot!.querySelectorAll('[data-gen-id]').length).to.equal(5);
    expect(node(element, 'field') === field).to.equal(true);
    expect(element.shadowRoot!.activeElement === field).to.equal(true);
    field.value = 'Edited while preparing';
    field.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    field.setSelectionRange(2, 7);
    await ready;
    expect(node(element, 'copy').textContent).to.equal('Revision 1');
    expect(node(element, 'field') === field).to.equal(true);
    expect(node(element, 'form') === form).to.equal(true);
    expect(field.form === form).to.equal(true);
    expect(field.value).to.equal('Edited while preparing');
    expect(element.shadowRoot!.activeElement === field).to.equal(true);
    expect([field.selectionStart, field.selectionEnd]).to.deep.equal([2, 7]);
    expect(element.shadowRoot!.querySelectorAll('[data-gen-id]').length).to.equal(count + 5);
  });

  it('cancels superseded preparation without connecting its nodes or emitting stale actions and readiness', async () => {
    let prepared = 0;
    const source = catalog(() => prepared++);
    const element = await fixture<LyraGenViewElement>(html`<lr-gen-view .catalog=${source} .document=${view(source, 0)}></lr-gen-view>`);
    const revisions: number[] = [];
    let actions = 0;
    element.addEventListener('lr-gen-ready', event => revisions.push(event.detail.revision));
    element.addEventListener('lr-gen-action', () => actions++);
    prepared = 0;
    element.document = view(source, 1, true);
    await began(() => prepared);
    node(element, 'action').click();
    expect(actions).to.equal(0);
    element.document = view(source, 2);
    await waitUntil(() => element.status === 'ready', 'Replacement becomes ready');
    expect(revisions).to.deep.equal([2]);
    expect(node(element, 'copy').textContent).to.equal('Revision 2');
    expect(element.shadowRoot!.querySelectorAll('[data-gen-id]').length).to.equal(5);
    node(element, 'action').click();
    expect(actions).to.equal(1);
  });

  it('cancels a pending frame on disconnect, settles updateComplete, and resumes the latest document on reconnect', async () => {
    let prepared = 0;
    const source = catalog(() => prepared++);
    const element = await fixture<LyraGenViewElement>(html`<lr-gen-view .catalog=${source} .document=${view(source, 0)}></lr-gen-view>`);
    const parent = element.parentNode!;
    prepared = 0;
    element.document = view(source, 1, true);
    await began(() => prepared);
    const update = element.updateComplete;
    element.remove();
    await update;
    const stopped = prepared;
    await tick();
    await tick();
    expect(prepared).to.equal(stopped);
    expect(element.status).to.equal('interrupted');
    expect(node(element, 'copy').textContent).to.equal('Revision 0');
    const ready = oneEvent(element, 'lr-gen-ready');
    parent.appendChild(element);
    await ready;
    expect(element.status).to.equal('ready');
    expect(node(element, 'copy').textContent).to.equal('Revision 1');
  });

  it('constructs new children detached across frames and waits for child updates after one complete attachment', async () => {
    let prepared = 0;
    const base = catalog(() => prepared++);
    const source = createCatalog({ ...base, components: { ...base.components, item: { ...base.components['item']!, tag: 'gen-sliced-child' } } });
    const element = await fixture<LyraGenViewElement>(html`<lr-gen-view .catalog=${source}></lr-gen-view>`);
    created = [];
    const ready = oneEvent(element, 'lr-gen-ready');
    element.document = view(source, 0, true);
    let completed = false;
    const update = element.updateComplete.then(() => { completed = true; });
    await began(() => prepared);
    expect(completed).to.equal(false);
    expect(created.every(child => !child.isConnected)).to.equal(true);
    expect(element.shadowRoot!.querySelectorAll('[data-gen-id]').length).to.equal(0);
    const batches = [prepared];
    let previous = prepared;
    while (!completed) {
      await tick();
      batches.push(prepared - previous);
      previous = prepared;
    }
    await update;
    expect(Math.max(...batches)).to.be.at.most(64);
    expect(batches.filter(batch => batch > 0).length).to.be.greaterThan(1);
    expect(created.length).to.equal(count + 1);
    expect(created.every(child => child.isConnected)).to.equal(true);
    expect(element.status).to.equal('loading');
    for (const child of created) child.finish();
    await ready;
    expect(element.status).to.equal('ready');
  });

  it('rejects an invalid last node before any constructor or preparation is run', async () => {
    let prepared = 0;
    const source = catalog(() => prepared++);
    const element = await fixture<LyraGenViewElement>(html`<lr-gen-view .catalog=${source}></lr-gen-view>`);
    const valid = view(source, 0, true);
    element.document = { ...valid, root: { ...valid.root, children: [...valid.root.children!, { id: 'invalid', type: 'missing' }] } };
    await element.updateComplete;
    expect(element.status).to.equal('error');
    expect(prepared).to.equal(0);
    expect(element.shadowRoot!.querySelectorAll('[data-gen-id]').length).to.equal(0);
  });


  it('ignores a superseded loader rejection while preparing a replacement revision', async () => {
    let prepared = 0;
    let reject!: (reason: Error) => void;
    const loading = new Promise<void>((_resolve, no) => { reject = no; });
    const base = catalog(() => prepared++);
    const source = createCatalog({ ...base, components: { ...base.components, slow: { tag: 'p', properties: {}, load: () => loading } } });
    const initial = { ...view(source, 0), root: { id: 'slow', type: 'slow' } };
    const element = await fixture<LyraGenViewElement>(html`<lr-gen-view .catalog=${source} .document=${initial}></lr-gen-view>`);
    let errors = 0;
    const revisions: number[] = [];
    element.addEventListener('lr-gen-error', () => errors++);
    element.addEventListener('lr-gen-ready', event => revisions.push(event.detail.revision));
    const ready = oneEvent(element, 'lr-gen-ready');
    element.document = view(source, 1, true);
    await began(() => prepared);
    reject(new Error('Obsolete loader failure'));
    await ready;
    expect(errors).to.equal(0);
    expect(revisions).to.deep.equal([1]);
    expect(element.status).to.equal('ready');
  });


  it('snapshots adapter property records before yielding so later host mutation cannot bypass admission', async () => {
    let prepared = 0;
    let adapted: Record<string, unknown> | undefined;
    const base = catalog(() => prepared++);
    const source = createCatalog({ ...base, components: { ...base.components, item: {
      ...base.components['item']!,
      prepareProperties: props => {
        prepared++;
        const result = { ...props };
        if (props['title'] === 'Revision 1') adapted = result;
        return result;
      },
    } } });
    const element = await fixture<LyraGenViewElement>(html`<lr-gen-view .catalog=${source} .document=${view(source, 0)}></lr-gen-view>`);
    prepared = 0;
    const ready = oneEvent(element, 'lr-gen-ready');
    element.document = view(source, 1, true);
    await began(() => prepared);
    expect(adapted !== undefined).to.equal(true);
    adapted!['title'] = 'Changed after preparation';
    await ready;
    expect(node(element, 'copy').title).to.equal('Revision 1');
  });

});

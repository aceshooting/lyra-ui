import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { createCatalog, initialCatalog } from '../../src/catalog.js';
import { LyraGenViewElement } from '../../src/gen-view.js';
import type { LyraGenReady } from '../../src/gen-view.class.js';
import type { LyraGenCatalog, LyraGenNode, LyraGenView } from '../../src/types.js';

function view(root: LyraGenNode, catalog: LyraGenCatalog, revision = 0): LyraGenView {
  return { version: '1', surfaceId: 'readiness', revision, catalog: { id: catalog.id, version: catalog.version }, root };
}
function deferred() {
  let resolve!: () => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const tick = async () => { await new Promise<void>(resolve => requestAnimationFrame(() => resolve())); await Promise.resolve(); };

class DelayedChild extends HTMLElement {
  readonly completion = deferred();
  get updateComplete() { return this.completion.promise.then(() => true); }
}
customElements.define('gen-readiness-child', DelayedChild);

describe('generated view public readiness', () => {
  it('waits for the trusted loader and generated child update before publishing readiness', async () => {
    const loaded = deferred();
    const catalog = createCatalog({ id: 'readiness', version: '1', components: { slow: { tag: 'gen-readiness-child', properties: {}, load: () => loaded.promise } } });
    const element = await fixture<LyraGenViewElement>(html`<lr-gen-view .catalog=${catalog} .document=${view({ id: 'slow', type: 'slow' }, catalog)}></lr-gen-view>`);
    const events: LyraGenReady[] = [];
    element.addEventListener('lr-gen-ready', event => events.push(event.detail));
    expect(element.status).to.equal('loading');
    expect(element.busy).to.equal(true);
    expect(element.getAttribute('aria-busy')).to.equal('true');
    loaded.resolve();
    await waitUntil(() => element.shadowRoot!.querySelector('gen-readiness-child') !== null);
    const child = element.shadowRoot!.querySelector<DelayedChild>('gen-readiness-child')!;
    expect(element.status).to.equal('loading');
    expect(events.length).to.equal(0);
    const ready = oneEvent(element, 'lr-gen-ready');
    child.completion.resolve();
    expect((await ready as CustomEvent<LyraGenReady>).detail).to.deep.equal({ surfaceId: 'readiness', revision: 0 });
    expect(element.status).to.equal('ready');
    expect(element.busy).to.equal(false);
    expect(element.getAttribute('aria-busy')).to.equal('false');
    expect(events.length).to.equal(1);
  });

  it('keeps loader errors distinct from readiness and never exposes technical error text', async () => {
    const loaded = deferred();
    const catalog = createCatalog({ id: 'readiness', version: '1', components: { slow: { tag: 'div', properties: {}, load: () => loaded.promise } } });
    const element = await fixture<LyraGenViewElement>(html`<lr-gen-view .catalog=${catalog} .document=${view({ id: 'slow', type: 'slow' }, catalog)}></lr-gen-view>`);
    let ready = 0;
    element.addEventListener('lr-gen-ready', () => ready++);
    loaded.reject(new Error('Technical detail must remain private'));
    await waitUntil(() => element.status === 'error');
    expect(element.busy).to.equal(false);
    expect(element.getAttribute('aria-busy')).to.equal('false');
    expect(element.shadowRoot!.textContent).not.to.contain('Technical detail');
    expect(ready).to.equal(0);
  });

  it('keeps a rejected child update in error with a localized fallback and no ready event', async () => {
    const catalog = createCatalog({ id: 'readiness', version: '1', components: { slow: { tag: 'gen-readiness-child', properties: {} } } });
    const element = await fixture<LyraGenViewElement>(html`<lr-gen-view .catalog=${catalog} .document=${view({ id: 'slow', type: 'slow' }, catalog)}></lr-gen-view>`);
    const child = element.shadowRoot!.querySelector<DelayedChild>('gen-readiness-child')!;
    let ready = 0;
    element.addEventListener('lr-gen-ready', () => ready++);
    child.completion.reject(new Error('Private child failure'));
    await waitUntil(() => element.status === 'error' && element.shadowRoot!.querySelector('[part="error"]') !== null);
    expect(element.shadowRoot!.querySelector('[part="error"]')?.textContent).to.equal('This component could not be loaded.');
    expect(ready).to.equal(0);
    element.requestUpdate();
    await element.updateComplete;
    expect(element.status).to.equal('error');
    expect(ready).to.equal(0);
  });

  it('does not publish a superseded revision after its pending child finishes', async () => {
    const catalog = createCatalog({ id: 'readiness', version: '1', components: { slow: { tag: 'gen-readiness-child', properties: {} }, text: initialCatalog.components['text']! } });
    const element = await fixture<LyraGenViewElement>(html`<lr-gen-view .catalog=${catalog} .document=${view({ id: 'slow', type: 'slow' }, catalog)}></lr-gen-view>`);
    const child = element.shadowRoot!.querySelector<DelayedChild>('gen-readiness-child')!;
    const revisions: number[] = [];
    element.addEventListener('lr-gen-ready', event => revisions.push(event.detail.revision));
    element.document = view({ id: 'text', type: 'text', text: 'Replacement' }, catalog, 1);
    child.completion.resolve();
    const ready = oneEvent(element, 'lr-gen-ready');
    await ready;
    await tick();
    expect(revisions).to.deep.equal([1]);
    expect(element.status).to.equal('ready');
  });

  it('does not publish detached work and resumes the same unfinished revision on reconnect', async () => {
    const catalog = createCatalog({ id: 'readiness', version: '1', components: { slow: { tag: 'gen-readiness-child', properties: {} } } });
    const element = await fixture<LyraGenViewElement>(html`<lr-gen-view .catalog=${catalog} .document=${view({ id: 'slow', type: 'slow' }, catalog)}></lr-gen-view>`);
    const parent = element.parentNode!;
    const child = element.shadowRoot!.querySelector<DelayedChild>('gen-readiness-child')!;
    let count = 0;
    element.addEventListener('lr-gen-ready', () => count++);
    element.remove();
    child.completion.resolve();
    await tick();
    expect(element.status).to.equal('interrupted');
    expect(element.busy).to.equal(false);
    expect(count).to.equal(0);
    const ready = oneEvent(element, 'lr-gen-ready');
    parent.appendChild(element);
    await ready;
    expect(element.status).to.equal('ready');
    expect(count).to.equal(1);
    element.remove();
    parent.appendChild(element);
    await element.updateComplete;
    await tick();
    expect(count).to.equal(1);
  });

  it('emits once for each accepted rendered revision without duplicates from repeated bindings or local edits', async () => {
    const root: LyraGenNode = { id: 'field', type: 'input', props: { label: 'Field', value: '' }, bindings: { value: '/field' } };
    const element = await fixture<LyraGenViewElement>(html`<lr-gen-view></lr-gen-view>`);
    const revisions: number[] = [];
    element.addEventListener('lr-gen-ready', event => revisions.push(event.detail.revision));
    const source = view(root, initialCatalog);
    let ready = oneEvent(element, 'lr-gen-ready');
    element.document = source;
    await ready;
    const input = element.shadowRoot!.querySelector<HTMLElement & { value: string }>('[data-gen-id="field"]')!;
    input.value = 'Edit';
    input.dispatchEvent(new CustomEvent('lr-input', { bubbles: true, composed: true }));
    await element.updateComplete;
    await tick();
    element.document = source;
    element.requestUpdate();
    await element.updateComplete;
    await tick();
    element.document = structuredClone(source);
    await element.updateComplete;
    await tick();
    expect(revisions).to.deep.equal([0]);
    ready = oneEvent(element, 'lr-gen-ready');
    element.document = view({ ...root, props: { ...root.props, hint: 'Updated' } }, initialCatalog, 1);
    await ready;
    expect(revisions).to.deep.equal([0, 1]);
    expect(input.value).to.equal('Edit');
  });
});

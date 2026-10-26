import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { focusByKeyboard } from '../../../lyra-ui/test/wtr-focus.js';
import { createCatalog, initialCatalog } from '../../src/catalog.js';
import { LyraGenViewElement } from '../../src/gen-view.js';
import type { LyraGenStateChange } from '../../src/gen-view.class.js';
import type { LyraGenCatalog, LyraGenNode, LyraGenView } from '../../src/types.js';

interface Control extends HTMLElement { value: string; updateComplete: Promise<boolean> }
const field = (id: string, value = ''): LyraGenNode => ({ id, type: 'input', props: { label: id, value, name: id }, bindings: { value: `/${id}` } });
function view(root: LyraGenNode, catalog = initialCatalog, revision = 0): LyraGenView {
  return { version: '1', surfaceId: 'forms', revision, catalog: { id: catalog.id, version: catalog.version }, root };
}
function node<T extends HTMLElement = HTMLElement>(element: LyraGenViewElement, id: string): T {
  const result = element.shadowRoot!.querySelector<T>(`[data-gen-id="${id}"]`);
  if (!result) throw new Error(`Missing node ${id}`);
  return result;
}
async function mounted(root: LyraGenNode, catalog = initialCatalog): Promise<LyraGenViewElement> {
  const element = await fixture<LyraGenViewElement>(html`<lr-gen-view .document=${view(root, catalog)} .catalog=${catalog}></lr-gen-view>`);
  await waitUntil(() => [...element.shadowRoot!.querySelectorAll('[part="loading"]')].length === 0, 'Generated modules loaded', { timeout: 5000 });
  await element.updateComplete;
  return element;
}
async function edit(element: LyraGenViewElement, id: string, value: string): Promise<LyraGenStateChange> {
  const control = node<Control>(element, id);
  control.value = value;
  await control.updateComplete;
  const event = oneEvent(element, 'lr-gen-state-change');
  control.dispatchEvent(new CustomEvent('lr-input', { bubbles: true, composed: true, detail: { value } }));
  const changed = await event;
  await element.updateComplete;
  return (changed as CustomEvent<LyraGenStateChange>).detail;
}
function actionCatalog(confirm = false): LyraGenCatalog {
  return createCatalog({ ...initialCatalog, actions: { save: { payload: { type: 'null' }, confirm } } });
}

describe('generated view state and host actions', () => {
  it('retains dirty values and keyed controls when a sibling changes', async () => {
    const root: LyraGenNode = { id: 'root', type: 'stack', children: [field('name', 'Original'), { id: 'note', type: 'text', text: 'Before' }] };
    const element = await mounted(root);
    const original = node(element, 'name');
    const detail = await edit(element, 'name', 'User value');
    expect(detail.dirty).to.deep.equal(['/name']);
    element.document = view({ ...root, children: [field('name', 'Model changed'), { id: 'note', type: 'text', text: 'After' }] }, initialCatalog, 1);
    await element.updateComplete;
    expect(node(element, 'name') === original).to.equal(true);
    expect(node<Control>(element, 'name').value).to.equal('User value');
    expect(node(element, 'note').textContent).to.equal('After');
  });

  it('preserves focused native selection when keyed controls reorder', async () => {
    const note: LyraGenNode = { id: 'note', type: 'text', text: 'Note' };
    const element = await mounted({ id: 'root', type: 'stack', children: [note, field('name', 'Selection')] });
    const control = node<Control>(element, 'name');
    await control.updateComplete;
    const native = control.shadowRoot!.querySelector('input')!;
    await focusByKeyboard(native);
    native.setSelectionRange(1, 4);
    element.document = view({ id: 'root', type: 'stack', children: [field('name', 'Selection'), note] }, initialCatalog, 1);
    await element.updateComplete;
    expect(node(element, 'name') === control).to.equal(true);
    expect(control.shadowRoot!.activeElement === native).to.equal(true);
    expect(native.selectionStart).to.equal(1);
    expect(native.selectionEnd).to.equal(4);
  });

  it('publishes controlled proposals and restores host values', async () => {
    const element = await mounted(field('name', 'Default'));
    element.controlled = true;
    element.bindingState = { name: 'Host' };
    await element.updateComplete;
    expect((await edit(element, 'name', 'Proposal')).values).to.deep.equal({ name: 'Proposal' });
    expect(node<Control>(element, 'name').value).to.equal('Host');
    element.bindingState = { name: 'Accepted' };
    await element.updateComplete;
    expect(node<Control>(element, 'name').value).to.equal('Accepted');
  });

  it('rejects bound state outside the catalog schema', async () => {
    const element = await mounted(field('name'));
    element.bindingState = { name: { html: '<script>no</script>' } };
    await element.updateComplete;
    expect(element.shadowRoot!.querySelector('[part="error"]')?.textContent).to.equal('This generated view cannot be displayed.');
    expect(element.shadowRoot!.querySelector('[data-gen-id="name"]') === null).to.equal(true);
  });

  it('rejects conflicting documents that reuse a revision', async () => {
    const element = await mounted({ id: 'copy', type: 'text', text: 'First' });
    element.document = view({ id: 'copy', type: 'text', text: 'Conflict' });
    await element.updateComplete;
    expect(element.shadowRoot!.querySelector('[part="error"]') !== null).to.equal(true);
  });

  it('resets only the requested form and restores initial values', async () => {
    const element = await mounted({ id: 'root', type: 'stack', children: [
      { id: 'first', type: 'form', props: { ariaLabel: 'First' }, children: [field('a', 'Default A')] },
      { id: 'second', type: 'form', props: { ariaLabel: 'Second' }, children: [field('b', 'Default B')] },
    ] });
    await edit(element, 'a', 'Edited A');
    await edit(element, 'b', 'Edited B');
    const pending = oneEvent(element, 'lr-gen-state-change');
    node<HTMLFormElement>(element, 'first').reset();
    const result = await pending as CustomEvent<LyraGenStateChange>;
    await element.updateComplete;
    expect(result.detail.values).to.deep.equal({ a: 'Default A', b: 'Edited B' });
    expect(result.detail.dirty).to.deep.equal(['/b']);
    expect(node<Control>(element, 'a').value).to.equal('Default A');
    expect(node<Control>(element, 'b').value).to.equal('Edited B');
  });

  it('uses native form validity before emitting a bound submit payload', async () => {
    const catalog = createCatalog({ ...initialCatalog, actions: { save: { payload: { type: 'object', properties: { name: { type: 'string', minLength: 1 } }, required: ['name'] } } } });
    const element = await mounted({ id: 'form', type: 'form', props: { ariaLabel: 'Entry' }, action: { name: 'save' }, children: [{ ...field('name'), props: { label: 'Name', value: '', required: true, name: 'name' } }] }, catalog);
    const form = node<HTMLFormElement>(element, 'form');
    await node<Control>(element, 'name').updateComplete;
    expect(form.checkValidity()).to.equal(false);
    let actions = 0;
    element.addEventListener('lr-gen-action', () => actions++);
    form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
    expect(actions).to.equal(0);
    await edit(element, 'name', 'Valid');
    expect(form.checkValidity()).to.equal(true);
    const requested = oneEvent(element, 'lr-gen-action');
    form.requestSubmit();
    const result = await requested as CustomEvent;
    expect(result.detail.payload).to.deep.equal({ name: 'Valid' });
    expect(result.detail.surfaceId).to.equal('forms');
    expect(result.detail.revision).to.equal(0);
    expect(actions).to.equal(1);
  });

  it('submits only enabled fields belonging to the submitting form', async () => {
    const catalog = createCatalog({ ...initialCatalog, actions: { save: { payload: { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] } } } });
    const element = await mounted({ id: 'root', type: 'stack', children: [
      { id: 'first', type: 'form', props: { ariaLabel: 'First' }, action: { name: 'save' }, children: [field('a', 'Allowed'), { ...field('disabled', 'Excluded'), props: { label: 'Disabled', value: 'Excluded', disabled: true } }] },
      { id: 'second', type: 'form', props: { ariaLabel: 'Second' }, children: [field('b', 'Private to second form')] },
    ] }, catalog);
    const requested = oneEvent(element, 'lr-gen-action');
    node<HTMLFormElement>(element, 'first').requestSubmit();
    expect((await requested as CustomEvent).detail.payload).to.deep.equal({ a: 'Allowed' });
  });

  it('cancels a confirmation when uncontrolled bound values change', async () => {
    const catalog = actionCatalog(true);
    const element = await mounted({ id: 'root', type: 'stack', children: [field('name'), { id: 'save', type: 'button', text: 'Save', action: { name: 'save', payload: null } }] }, catalog);
    let approve: ((value: boolean) => void) | undefined;
    let signal: AbortSignal | undefined;
    let actions = 0;
    element.addEventListener('lr-gen-action', () => actions++);
    element.confirmAction = (_action, received) => { signal = received; return new Promise<boolean>(resolve => { approve = resolve; }); };
    await element.updateComplete;
    node(element, 'save').click();
    await waitUntil(() => approve !== undefined);
    await edit(element, 'name', 'Changed');
    expect(signal?.aborted).to.equal(true);
    approve!(true);
    await Promise.resolve();
    expect(actions).to.equal(0);
  });

  it('requires host confirmation and ignores an approval after a pending document change', async () => {
    const catalog = actionCatalog(true);
    const root: LyraGenNode = { id: 'save', type: 'button', text: 'Save', action: { name: 'save', payload: null } };
    const element = await mounted(root, catalog);
    let actions = 0;
    element.addEventListener('lr-gen-action', () => actions++);
    const denied = oneEvent(element, 'lr-gen-error');
    node(element, 'save').click();
    await denied;
    expect(actions).to.equal(0);
    let approve: ((value: boolean) => void) | undefined;
    let signal: AbortSignal | undefined;
    element.confirmAction = (_action, received) => { signal = received; return new Promise<boolean>(resolve => { approve = resolve; }); };
    await element.updateComplete;
    node(element, 'save').click();
    await waitUntil(() => approve !== undefined);
    element.document = view({ ...root, text: 'New revision' }, catalog, 1);
    approve!(true);
    await element.updateComplete;
    expect(actions).to.equal(0);
    expect(signal?.aborted).to.equal(true);
  });

  it('emits a typed action only after affirmative host confirmation', async () => {
    const catalog = actionCatalog(true);
    const element = await mounted({ id: 'save', type: 'button', text: 'Save', action: { name: 'save', payload: null } }, catalog);
    element.confirmAction = () => true;
    await element.updateComplete;
    const requested = oneEvent(element, 'lr-gen-action');
    node(element, 'save').click();
    expect((await requested as CustomEvent).detail).to.deep.equal({ surfaceId: 'forms', nodeId: 'save', revision: 0, name: 'save', payload: null });
  });
});

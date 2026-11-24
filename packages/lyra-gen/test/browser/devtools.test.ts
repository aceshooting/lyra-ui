import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../lyra-ui/test/wtr-focus.js';
import { createCatalog } from '../../src/catalog.js';
import '../../src/gen-view.js';
import { LyraGenDevtoolsElement, LYRA_GEN_INSPECTED_ATTRIBUTE } from '../../src/devtools.js';
import type { LyraGenViewElement } from '../../src/gen-view.class.js';
import type { LyraGenNode, LyraGenView } from '../../src/types.js';

const secretNode: LyraGenNode = { id: 'token', type: 'secret', props: { value: '' }, bindings: { value: '/token' } };
const catalog = createCatalog({
  id: 'devtools', version: '1',
  components: {
    stack: { tag: 'div', properties: {}, children: true },
    text: { tag: 'p', properties: {}, text: true },
    name: { tag: 'input', properties: { value: { type: 'string' } }, fieldPurpose: 'general', bindings: { value: { event: 'input', property: 'value' } } },
    secret: { tag: 'input', properties: { value: { type: 'string' } }, fieldPurpose: 'secret', bindings: { value: { event: 'input', property: 'value' } } },
  },
  fieldPolicy: { approvedFields: [{ surfaceId: 'inspect', node: secretNode, purpose: 'secret', allowSensitive: true }] },
});
const root: LyraGenNode = {
  id: 'root', type: 'stack', children: [
    { id: 'intro', type: 'text', text: 'Hello' },
    { id: 'name', type: 'name', props: { value: '' }, bindings: { value: '/name' } },
    secretNode,
  ],
};
const view = (revision = 0, node: LyraGenNode = root): LyraGenView => ({ version: '1', surfaceId: 'inspect', revision, catalog: { id: catalog.id, version: catalog.version }, root: node });

async function setup() {
  const wrapper = await fixture<HTMLElement>(html`<div>
    <lr-gen-view .catalog=${catalog} .document=${view()} .bindingState=${{ name: 'Ada', token: 'initial-secret' }} .liveData=${{ price: 3 }}></lr-gen-view>
    <lr-gen-devtools></lr-gen-devtools>
  </div>`);
  const target = wrapper.querySelector<LyraGenViewElement>('lr-gen-view')!;
  const inspector = wrapper.querySelector<LyraGenDevtoolsElement>('lr-gen-devtools')!;
  inspector.target = target;
  await waitUntil(() => target.status === 'ready');
  await inspector.updateComplete;
  return { wrapper, target, inspector };
}
const shadow = (element: LyraGenDevtoolsElement) => element.shadowRoot!;
const panelText = (element: LyraGenDevtoolsElement) => shadow(element).querySelector('[part="panel"]')!.textContent ?? '';
const showTab = async (element: LyraGenDevtoolsElement, tab: LyraGenDevtoolsElement['tab']) => { element.tab = tab; await element.updateComplete; };
const typeInto = (target: LyraGenViewElement, id: string, value: string) => {
  const input = target.elementForNode(id) as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
};

describe('lr-gen-devtools', () => {
  it('registers and renders an accessible tree for the target', async () => {
    const { inspector } = await setup();
    expect(inspector).to.be.instanceOf(LyraGenDevtoolsElement);
    const tree = shadow(inspector).querySelector('[role="tree"]')!;
    const items = [...tree.querySelectorAll('[role="treeitem"]')];
    expect(items.map(item => item.getAttribute('data-node-id'))).to.deep.equal(['root', 'intro', 'name', 'token']);
    expect(items[0]!.getAttribute('aria-expanded')).to.equal('true');
    expect(items[1]!.getAttribute('aria-level')).to.equal('2');
    expect(items[1]!.hasAttribute('aria-expanded')).to.equal(false);
    expect(items.filter(item => item.getAttribute('tabindex') === '0').length).to.equal(1);
    await expect(inspector).to.be.accessible();
    for (const tab of ['revision', 'state', 'live', 'events', 'catalog'] as const) {
      await showTab(inspector, tab);
      await expect(inspector).to.be.accessible();
    }
  });

  it('selects and collapses nodes from the keyboard, highlighting without touching generated properties', async () => {
    const { target, inspector } = await setup();
    const first = shadow(inspector).querySelector<HTMLElement>('[role="treeitem"][data-node-id="root"]')!;
    await focusByKeyboard(first);
    await sendKeys({ press: 'ArrowDown' });
    await inspector.updateComplete;
    await sendKeys({ press: 'Enter' });
    await inspector.updateComplete;
    expect(inspector.selectedNodeId).to.equal('intro');
    const paragraph = target.elementForNode('intro')!;
    expect(paragraph.hasAttribute(LYRA_GEN_INSPECTED_ATTRIBUTE)).to.equal(true);
    expect(paragraph.textContent).to.equal('Hello');
    await waitUntil(() => shadow(inspector).querySelector('[part="highlight"]') !== null);
    expect(shadow(inspector).querySelector('[data-node-id="intro"]')!.getAttribute('aria-selected')).to.equal('true');
    await sendKeys({ press: 'ArrowDown' });
    await inspector.updateComplete;
    await sendKeys({ press: ' ' });
    await inspector.updateComplete;
    expect(inspector.selectedNodeId).to.equal('name');
    expect(paragraph.hasAttribute(LYRA_GEN_INSPECTED_ATTRIBUTE)).to.equal(false);
    expect(target.elementForNode('name')!.hasAttribute(LYRA_GEN_INSPECTED_ATTRIBUTE)).to.equal(true);
    await sendKeys({ press: 'Home' });
    await inspector.updateComplete;
    await sendKeys({ press: 'ArrowLeft' });
    await inspector.updateComplete;
    expect([...shadow(inspector).querySelectorAll('[role="treeitem"]')].length).to.equal(1);
    expect(shadow(inspector).querySelector('[data-node-id="root"]')!.getAttribute('aria-expanded')).to.equal('false');
    await sendKeys({ press: 'ArrowRight' });
    await inspector.updateComplete;
    expect([...shadow(inspector).querySelectorAll('[role="treeitem"]')].length).to.equal(4);
    await sendKeys({ press: 'Escape' });
    await inspector.updateComplete;
    expect(inspector.selectedNodeId).to.equal(undefined);
    expect(target.elementForNode('name')!.hasAttribute(LYRA_GEN_INSPECTED_ATTRIBUTE)).to.equal(false);
  });

  it('swaps tree expansion arrows under RTL', async () => {
    const { wrapper, inspector } = await setup();
    wrapper.dir = 'rtl';
    await inspector.updateComplete;
    const first = shadow(inspector).querySelector<HTMLElement>('[role="treeitem"][data-node-id="root"]')!;
    await focusByKeyboard(first);
    await sendKeys({ press: 'ArrowRight' });
    await inspector.updateComplete;
    expect(shadow(inspector).querySelector('[data-node-id="root"]')!.getAttribute('aria-expanded')).to.equal('false');
    await sendKeys({ press: 'ArrowLeft' });
    await inspector.updateComplete;
    expect(shadow(inspector).querySelector('[data-node-id="root"]')!.getAttribute('aria-expanded')).to.equal('true');
  });

  it('switches tabs with arrow keys and shows revision changes, state, live data and roles', async () => {
    const { target, inspector } = await setup();
    const tab = shadow(inspector).querySelector<HTMLElement>('#tab-tree')!;
    await focusByKeyboard(tab);
    await sendKeys({ press: 'ArrowRight' });
    await inspector.updateComplete;
    expect(inspector.tab).to.equal('revision');
    expect(shadow(inspector).activeElement?.id).to.equal('tab-revision');
    target.document = view(1, { ...root, children: [...root.children!.slice(1), { id: 'extra', type: 'text', text: 'New' }] });
    await waitUntil(() => panelText(inspector).includes('extra'));
    expect(panelText(inspector)).to.contain('intro');
    await showTab(inspector, 'state');
    expect(panelText(inspector)).to.contain('Ada');
    await showTab(inspector, 'live');
    expect(panelText(inspector)).to.contain('"price": 3');
    await showTab(inspector, 'catalog');
    expect(panelText(inspector)).to.contain('devtools@1');
    expect(panelText(inspector)).to.contain('secret');
  });

  it('never displays values bound by sensitive field purposes', async () => {
    const { target, inspector } = await setup();
    await showTab(inspector, 'state');
    expect(panelText(inspector)).to.not.contain('initial-secret');
    expect(panelText(inspector)).to.contain('[redacted]');
    typeInto(target, 'token', 'typed-secret');
    typeInto(target, 'name', 'Grace');
    await inspector.updateComplete;
    expect(panelText(inspector)).to.not.contain('typed-secret');
    expect(panelText(inspector)).to.contain('Grace');
    expect(panelText(inspector)).to.contain('/name');
    await showTab(inspector, 'events');
    expect(panelText(inspector)).to.contain('lr-gen-state-change');
    expect(panelText(inspector)).to.not.contain('typed-secret');
    expect(panelText(inspector)).to.not.contain('initial-secret');
    expect(shadow(inspector).querySelector('time')?.getAttribute('datetime')).to.match(/^\d{4}-/u);
    inspector.selectedNodeId = 'token';
    await showTab(inspector, 'tree');
    expect(panelText(inspector)).to.not.contain('typed-secret');
  });

  it('bounds the event log and is read-only toward the target', async () => {
    const { target, inspector } = await setup();
    inspector.logCapacity = 3;
    const actions: Event[] = [];
    target.addEventListener('lr-gen-action', event => actions.push(event));
    for (let index = 0; index < 6; index++) typeInto(target, 'name', `v${index}`);
    await showTab(inspector, 'events');
    expect(shadow(inspector).querySelectorAll('tbody tr').length).to.equal(3);
    expect(panelText(inspector)).to.contain('v5');
    expect(panelText(inspector)).to.not.contain('"v0"');
    expect(actions.length).to.equal(0);
    expect(target.bindingState).to.deep.equal({ name: 'Ada', token: 'initial-secret' });
    inspector.clearLog();
    await inspector.updateComplete;
    expect(shadow(inspector).querySelectorAll('tbody tr').length).to.equal(0);
  });

  it('removes the inspection mark and its listeners on disconnect and on target change', async () => {
    const { target, inspector } = await setup();
    inspector.selectedNodeId = 'intro';
    await inspector.updateComplete;
    const paragraph = target.elementForNode('intro')!;
    expect(paragraph.hasAttribute(LYRA_GEN_INSPECTED_ATTRIBUTE)).to.equal(true);
    inspector.remove();
    expect(paragraph.hasAttribute(LYRA_GEN_INSPECTED_ATTRIBUTE)).to.equal(false);
    typeInto(target, 'name', 'after-disconnect');
    document.body.append(inspector);
    await inspector.updateComplete;
    expect(paragraph.hasAttribute(LYRA_GEN_INSPECTED_ATTRIBUTE)).to.equal(true);
    await showTab(inspector, 'events');
    expect(panelText(inspector)).to.not.contain('after-disconnect');
    inspector.target = undefined;
    await inspector.updateComplete;
    expect(paragraph.hasAttribute(LYRA_GEN_INSPECTED_ATTRIBUTE)).to.equal(false);
    expect(shadow(inspector).textContent).to.contain('No generated view is connected.');
    inspector.remove();
  });
});

import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './tab-group.js';
import './tab.js';
import './tab-panel.js';
import type { LyraTabGroup } from './tab-group.class.js';
import type { LyraTab } from './tab.class.js';

interface Descriptor {
  slotName: string;
  label: string;
  disabled: boolean;
  inert: boolean;
  element: LyraTab;
}
interface Reconciliation {
  tabs: Descriptor[];
  syncTabs(): void;
  syncElementActiveState(): void;
  willUpdate(changed: Map<string, unknown>): void;
}

async function mount(count: number) {
  const names = Array.from({ length: count }, (_, index) => `reconcile-${index}`);
  const group = await fixture<LyraTabGroup>(html`<lr-tab-group>
    ${names.map(name => html`<lr-tab panel=${name}>${name}</lr-tab>`)}
    ${[...names].reverse().map(name => html`<lr-tab-panel name=${name}>${name} content</lr-tab-panel>`)}
  </lr-tab-group>`);
  await waitUntil(() => group.shadowRoot!.querySelectorAll('[part="tab"]').length === count);
  return { group, names, model: group as unknown as Reconciliation };
}

for (const count of [32, 64]) {
  it(`matches ${count} reversed panels with linear name reads`, async () => {
    const { group, names, model } = await mount(count);
    const panels = [...group.querySelectorAll('lr-tab-panel')];
    let reads = 0;
    const originals = panels.map(panel => panel.getAttribute);
    panels.forEach((panel, index) => {
      panel.getAttribute = function (name: string) {
        if (name === 'name') reads++;
        return originals[index]!.call(this, name);
      };
    });
    try { model.syncTabs(); }
    finally { panels.forEach((panel, index) => { panel.getAttribute = originals[index]!; }); }
    expect(model.tabs.map(tab => tab.slotName)).to.deep.equal(names);
    expect(panels.map(panel => panel.slot)).to.deep.equal([...names].reverse());
    expect(reads).to.be.at.most(count * 4);
  });
}

it('mirrors active descriptor identity with linear element reads', async () => {
  const { group, names, model } = await mount(64);
  group.active = names.at(-1)!;
  await group.updateComplete;
  let reads = 0;
  const descriptors = model.tabs.map(tab => Object.getOwnPropertyDescriptor(tab, 'element')!);
  model.tabs.forEach((tab, index) => Object.defineProperty(tab, 'element', {
    configurable: true, enumerable: true,
    get() { reads++; return descriptors[index]!.value as LyraTab; },
  }));
  try { model.syncElementActiveState(); }
  finally { model.tabs.forEach((tab, index) => Object.defineProperty(tab, 'element', descriptors[index]!)); }
  expect([...group.querySelectorAll('lr-tab[active]')].map(tab => tab.getAttribute('panel'))).to.deep.equal([names.at(-1)]);
  expect([...group.querySelectorAll('lr-tab-panel[active]')].map(panel => panel.getAttribute('name'))).to.deep.equal([names.at(-1)]);
  expect(reads).to.be.at.most(names.length * 2);
});

it('repairs a removed active descriptor in former order with linear name reads', async () => {
  const { group, names, model } = await mount(64);
  group.active = names[16]!;
  await group.updateComplete;
  const previous = model.tabs;
  const live = previous.filter(tab => tab.slotName !== group.active).reverse();
  let reads = 0;
  const descriptors = live.map(tab => Object.getOwnPropertyDescriptor(tab, 'slotName')!);
  live.forEach((tab, index) => Object.defineProperty(tab, 'slotName', {
    configurable: true, enumerable: true,
    get() { reads++; return descriptors[index]!.value as string; },
  }));
  const events: string[] = [];
  group.addEventListener('lr-tab-hide', event => events.push(`hide:${(event as CustomEvent<{ name: string }>).detail.name}`));
  group.addEventListener('lr-tab-show', event => events.push(`show:${(event as CustomEvent<{ name: string }>).detail.name}`));
  try {
    model.tabs = live;
    model.willUpdate(new Map([['tabs', previous]]));
  } finally {
    live.forEach((tab, index) => Object.defineProperty(tab, 'slotName', descriptors[index]!));
  }
  expect(group.active).to.equal(names[17]);
  expect(events).to.deep.equal([`hide:${names[16]}`, `show:${names[17]}`]);
  expect(reads).to.be.at.most(names.length * 8);
});

it('keeps the first duplicate descriptor and panel projection while mirroring all named panels', async () => {
  const group = await fixture<LyraTabGroup>(html`<lr-tab-group active="same">
    <lr-tab panel="same">First label</lr-tab><lr-tab panel="same">Second label</lr-tab>
    <lr-tab-panel name="same" id="first">First panel</lr-tab-panel>
    <lr-tab-panel name="same" id="second">Second panel</lr-tab-panel>
  </lr-tab-group>`);
  await waitUntil(() => group.shadowRoot!.querySelectorAll('[part="tab"]').length === 1);
  const model = group as unknown as Reconciliation;
  expect(model.tabs.map(tab => tab.label)).to.deep.equal(['First label']);
  expect(group.querySelector('#first')!.getAttribute('slot')).to.equal('same');
  expect(group.querySelector('#second')!.getAttribute('slot')).to.equal(null);
  expect(group.querySelectorAll('lr-tab[active]').length).to.equal(1);
  expect(group.querySelectorAll('lr-tab-panel[active]').length).to.equal(2);
});

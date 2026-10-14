import { expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import './tab-group.js';
import './tab.js';
import './tab-panel.js';
import type { LyraTabGroup } from './tab-group.class.js';
import type { LyraTab } from './tab.class.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';

function names(group: LyraTabGroup): string[] {
  return [...group.shadowRoot!.querySelectorAll('[role="tab"]')]
    .map(button => button.getAttribute('aria-label')!);
}

for (const rich of [false, true]) {
  it(`makes ${rich ? 'rich' : 'plain'} first-mount tabs available to show() after one updateComplete`, async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div></div>`);
    const group = document.createElement('lr-tab-group');
    group.innerHTML = rich
      ? '<lr-tab panel="first"><span>First label</span></lr-tab><lr-tab panel="second"><span>Second label</span></lr-tab>'
      : '<lr-tab panel="first">First label</lr-tab><lr-tab panel="second">Second label</lr-tab>';
    group.insertAdjacentHTML('beforeend', '<lr-tab-panel name="first">First body</lr-tab-panel><lr-tab-panel name="second">Second body</lr-tab-panel>');
    wrapper.append(group);
    await group.updateComplete;
    expect(names(group)).to.deep.equal(['First label', 'Second label']);
    const events: string[] = [];
    group.addEventListener('lr-tab-hide', event => events.push(`hide:${event.detail.name}`));
    group.addEventListener('lr-tab-show', event => events.push(`show:${event.detail.name}`));
    group.show('second');
    expect(group.active).to.equal('second');
    await group.updateComplete;
    expect(group.shadowRoot!.querySelector('[role="tab"][aria-selected="true"]')?.getAttribute('data-slot')).to.equal('second');
    expect(events).to.deep.equal(['hide:first', 'show:second']);
  });
}

it('makes a dynamically appended upgraded rich tab available after one updateComplete', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`<div><lr-tab-group>
    <lr-tab panel="first">First label</lr-tab><lr-tab-panel name="first">First body</lr-tab-panel>
  </lr-tab-group></div>`);
  const group = wrapper.querySelector<LyraTabGroup>('lr-tab-group')!;
  await waitUntil(() => names(group).includes('First label'));
  const addition = document.createElement('lr-tab');
  addition.panel = 'second';
  addition.innerHTML = '<span>Second label</span>';
  const panel = document.createElement('lr-tab-panel');
  panel.name = 'second';
  panel.textContent = 'Second body';
  wrapper.append(addition, panel);
  await Promise.all([addition.updateComplete, panel.updateComplete]);
  group.append(addition, panel);
  await group.updateComplete;
  group.show('second');
  expect(group.active).to.equal('second');
  await group.updateComplete;
  expect(names(group)).to.deep.equal(['First label', 'Second label']);
  expect(group.shadowRoot!.querySelector('[role="tab"][aria-selected="true"]')?.getAttribute('data-slot')).to.equal('second');
});

async function mountReadyDescriptors() {
  const wrapper = await fixture<HTMLDivElement>(html`<div>
    <lr-tab panel="purchase-order"><span>Purchase order</span></lr-tab>
    <lr-tab panel="direct">Direct text</lr-tab>
    <lr-tab><span aria-hidden="true">◆</span><span>Unnamed visible</span></lr-tab>
    <lr-tab><span hidden>Hidden unnamed</span><span inert>Inert unnamed</span>
      <span style="display: none">CSS hidden unnamed</span></lr-tab>
    <lr-tab panel="filtered"><span>Visible name
      <span hidden>Hidden branch</span><span inert>Inert branch</span>
      <span aria-hidden="true">Decorative branch</span>
      <span style="display: none">CSS hidden branch</span></span></lr-tab>
    <lr-tab-panel name="purchase-order">First body</lr-tab-panel>
    <lr-tab-panel name="direct">Second body</lr-tab-panel>
  </div>`);
  await Promise.all([...wrapper.children].map(child => (child as LyraTab).updateComplete));
  const group = document.createElement('lr-tab-group');
  group.setAttribute('aria-label', 'Order tabs');
  group.append(...wrapper.children);
  wrapper.append(group);
  await group.updateComplete;
  await nextFrame();
  return { wrapper, group };
}

it('names already-upgraded rich named and unnamed descriptors after their first projection', async () => {
  const { group } = await mountReadyDescriptors();
  expect(names(group)).to.deep.equal([
    'Purchase order', 'Direct text', 'Unnamed visible', 'Visible name',
  ]);
  group.show('direct');
  await group.updateComplete;
  group.show('purchase-order');
  await group.updateComplete;
  expect(names(group)[0]).to.equal('Purchase order');
  group.remove();
  document.body.append(group);
  await group.updateComplete;
  await nextFrame();
  expect(names(group)).to.deep.equal([
    'Purchase order', 'Direct text', 'Unnamed visible', 'Visible name',
  ]);
  group.remove();
});

it('enrols already-upgraded rich additions and rechecks hidden unnamed content without churn', async () => {
  const { wrapper, group } = await mountReadyDescriptors();
  const staging = document.createElement('div');
  staging.innerHTML = '<lr-tab panel="later"><span>Later named</span></lr-tab><lr-tab><span>Later unnamed</span></lr-tab>';
  wrapper.append(staging);
  await Promise.all([...staging.children].map(child => (child as LyraTab).updateComplete));
  group.append(...staging.children);
  staging.remove();
  await nextFrame();
  await group.updateComplete;
  expect(names(group)).to.include.members(['Later named', 'Later unnamed']);
  const hidden = group.children[3]!.querySelector('span')!;
  hidden.removeAttribute('hidden');
  await waitUntil(() => names(group).includes('Hidden unnamed'));
  hidden.setAttribute('hidden', '');
  await waitUntil(() => !names(group).includes('Hidden unnamed'));
  await nextFrame();
  await nextFrame();
  expect(names(group)).not.to.include('CSS hidden unnamed');
});

it('restores the latest author slot of an omitted unnamed descriptor on release', async () => {
  const { group } = await mountReadyDescriptors();
  const omitted = group.children[3]!;
  omitted.setAttribute('slot', 'latest-author-slot');
  await nextFrame();
  omitted.remove();
  await nextFrame();
  expect(omitted.getAttribute('slot')).to.equal('latest-author-slot');
});

it('keeps unresolved and excluded descriptor layout out of document extent and hit testing', async () => {
  const baseline = document.documentElement.scrollHeight;
  const baselineWidth = document.documentElement.scrollWidth;
  const { group } = await mountReadyDescriptors();
  const omitted = group.children[3]!;
  const branch = omitted.querySelector<HTMLElement>('span')!;
  branch.hidden = false;
  branch.setAttribute('aria-hidden', 'true');
  branch.style.position = 'absolute';
  branch.style.insetBlockStart = '10000px';
  branch.style.inlineSize = '10000px';
  branch.style.blockSize = '10000px';
  await nextFrame();
  await group.updateComplete;
  expect(names(group)).not.to.include('Hidden unnamed');
  expect(document.documentElement.scrollHeight).to.be.at.most(Math.max(baseline, window.innerHeight));
  expect(document.documentElement.scrollWidth).to.be.at.most(Math.max(baselineWidth, window.innerWidth));
  const rectangle = group.getBoundingClientRect();
  const target = document.elementFromPoint(rectangle.left + 1, rectangle.top + 1);
  expect(target === branch).to.equal(false);
});

it('settles a final-projection unnamed CSS rejection until consumer content changes', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`<div>
    <style>lr-tab-group::part(tab) { --projected-label-display: none; }</style>
    <lr-tab><span style="display: var(--projected-label-display, inline)">Context label</span></lr-tab>
  </div>`);
  const tab = wrapper.querySelector<LyraTab>('lr-tab')!;
  await tab.updateComplete;
  const group = document.createElement('lr-tab-group');
  const model = group as unknown as { syncTabs(): void };
  const original = model.syncTabs;
  let reads = 0;
  model.syncTabs = () => { reads++; original(); };
  group.append(tab);
  wrapper.append(group);
  await nextFrame();
  await nextFrame();
  await waitUntil(() => names(group).length === 0);
  expect(names(group)).to.deep.equal([]);
  await nextFrame();
  expect(names(group)).to.deep.equal([]);
  const settledReads = reads;
  await nextFrame();
  await nextFrame();
  expect(reads).to.equal(settledReads);
  expect(reads).to.be.at.most(5);
  tab.querySelector<HTMLElement>('span')!.style.removeProperty('display');
  await waitUntil(() => names(group).includes('Context label'));
  model.syncTabs = original;
});

it('preserves active selection and focus while an author slot or panel identity is restaged', async () => {
  const { group } = await mountReadyDescriptors();
  const tab = group.querySelector<LyraTab>('lr-tab[panel="purchase-order"]')!;
  const button = group.shadowRoot!.querySelector<HTMLButtonElement>('[role="tab"]')!;
  await focusByKeyboard(button);
  const events: string[] = [];
  group.addEventListener('lr-tab-hide', () => events.push('hide'));
  group.addEventListener('lr-tab-show', () => events.push('show'));
  tab.slot = 'latest-active-author-slot';
  await nextFrame();
  await nextFrame();
  expect(group.active).to.equal('purchase-order');
  expect(group.shadowRoot!.activeElement?.getAttribute('data-slot')).to.equal('purchase-order');
  expect(events).to.deep.equal([]);
  tab.panel = 'renamed-order';
  group.querySelector('lr-tab-panel[name="purchase-order"]')!.setAttribute('name', 'renamed-order');
  await waitUntil(() => group.active === 'renamed-order');
  expect(group.shadowRoot!.activeElement?.getAttribute('data-slot')).to.equal('renamed-order');
  expect(events).to.deep.equal([]);
});

it('rearms an unresolved child update after disconnect and adoption', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`<div></div>`);
  const tab = document.createElement('lr-tab');
  tab.panel = 'delayed';
  tab.innerHTML = '<span>Delayed label</span>';
  const updating = tab as unknown as { scheduleUpdate(): void | Promise<void> };
  const original = updating.scheduleUpdate;
  let release!: () => void;
  const delayed = new Promise<void>(resolve => { release = resolve; });
  updating.scheduleUpdate = async () => { await delayed; await original.call(tab); };
  const group = document.createElement('lr-tab-group');
  group.append(tab);
  wrapper.append(group);
  let oldReadySettled = false;
  const oldReady = group.updateComplete.then(() => { oldReadySettled = true; });
  await waitUntil(() => tab.assignedSlot?.parentElement?.hasAttribute('data-descriptor-staging') === true);
  expect(oldReadySettled).to.equal(false);
  expect(names(group)).to.deep.equal([]);
  group.remove();
  await oldReady;
  expect(oldReadySettled).to.equal(true);
  const frame = document.createElement('iframe');
  wrapper.append(frame);
  try {
    frame.contentDocument!.body.append(group);
    const newReady = group.updateComplete;
    release();
    await newReady;
    expect(names(group)).to.include('Delayed label');
  } finally {
    release();
    updating.scheduleUpdate = original;
    group.remove();
    frame.remove();
  }
});

it('normalizes an invalid active key after an all-hidden initial staging batch settles', async () => {
  const group = await fixture<LyraTabGroup>(html`<lr-tab-group active="absent">
    <lr-tab><span hidden>Hidden label</span></lr-tab>
  </lr-tab-group>`);
  await waitUntil(() => group.active === '');
  expect(names(group)).to.deep.equal([]);
});

it('repairs a removed active tab in former order while a rich addition is being staged', async () => {
  const { wrapper, group } = await mountReadyDescriptors();
  const removed = group.querySelector<LyraTab>('lr-tab[panel="purchase-order"]')!;
  await focusByKeyboard(group.shadowRoot!.querySelector<HTMLButtonElement>('[role="tab"]')!);
  const addition = document.createElement('lr-tab');
  addition.panel = 'replacement';
  addition.innerHTML = '<span>Replacement label</span>';
  wrapper.append(addition);
  await addition.updateComplete;
  const events: string[] = [];
  group.addEventListener('lr-tab-hide', () => events.push('hide'));
  group.addEventListener('lr-tab-show', () => events.push('show'));
  removed.remove();
  group.append(addition);
  await waitUntil(() => group.active === 'direct');
  await group.updateComplete;
  expect(group.shadowRoot!.activeElement?.getAttribute('data-slot')).to.equal('direct');
  expect(events).to.deep.equal(['hide', 'show']);
  expect(removed.slot).to.equal('nav');
  expect(removed.querySelector<HTMLElement>('span')!.inert).to.equal(false);
  expect(names(group)).to.include('Replacement label');
});

it('renders unregistered descriptor light DOM and refreshes it after child registration', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`<div></div>`);
  const frame = document.createElement('iframe');
  const groupModule = new URL('./tab-group.ts', import.meta.url).href;
  const tabModule = new URL('./tab.ts', import.meta.url).href;
  frame.srcdoc = `<style>lr-tab[data-upgrade-label]:not(:defined) > span { display: none; }</style>
    <lr-tab-group aria-label="Late registrations">
    <lr-tab panel="named"><span>Unregistered named</span></lr-tab>
    <lr-tab><span>Unregistered unnamed</span></lr-tab>
    <lr-tab data-upgrade-label><span>Upgrade reveal</span></lr-tab>
    </lr-tab-group><script type="module">
      window.tabDefinitionSubscriptions = 0;
      window.originalWhenDefined = customElements.whenDefined;
      customElements.whenDefined = function(name) {
        if (name === 'lr-tab') window.tabDefinitionSubscriptions++;
        return window.originalWhenDefined.call(this, name);
      };
      await import(${JSON.stringify(groupModule)});
    </script>`;
  wrapper.append(frame);
  try {
    await waitUntil(() => !!frame.contentWindow?.customElements.get('lr-tab-group'));
    const group = frame.contentDocument!.querySelector('lr-tab-group') as LyraTabGroup;
    await group.updateComplete;
    expect(names(group)).to.have.length(2);
    expect(frame.contentWindow!.customElements.get('lr-tab')).to.equal(undefined);
    expect(names(group)).to.deep.equal(['Unregistered named', 'Unregistered unnamed']);
    for (let index = 0; index < 3; index++) {
      group.querySelector('lr-tab[panel="named"] span')!.textContent = `Updated named ${index}`;
      await nextFrame();
    }
    const telemetry = frame.contentWindow as unknown as { tabDefinitionSubscriptions: number };
    expect(telemetry.tabDefinitionSubscriptions).to.equal(1);
    const script = frame.contentDocument!.createElement('script');
    script.type = 'module';
    script.textContent = `await import(${JSON.stringify(tabModule)});`;
    frame.contentDocument!.body.append(script);
    await waitUntil(() => !!frame.contentWindow?.customElements.get('lr-tab'));
    await waitUntil(() => names(group).includes('Upgrade reveal'));
    expect(names(group)).to.deep.equal(['Updated named 2', 'Unregistered unnamed', 'Upgrade reveal']);
  } finally {
    const telemetry = frame.contentWindow as unknown as { originalWhenDefined?: CustomElementRegistry['whenDefined'] };
    if (telemetry.originalWhenDefined)
      frame.contentWindow!.customElements.whenDefined = telemetry.originalWhenDefined;
    frame.remove();
  }
});

it('uses identical empty first-render staging markup across independently allocated groups', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`<div><lr-tab-group></lr-tab-group><lr-tab-group></lr-tab-group></div>`);
  const groups = [...wrapper.querySelectorAll<LyraTabGroup>('lr-tab-group')];
  expect(groups[0]!.shadowRoot!.querySelector('[data-descriptor-staging]')!.outerHTML)
    .to.equal(groups[1]!.shadowRoot!.querySelector('[data-descriptor-staging]')!.outerHTML);
});

it('releases detached descriptor references after the final removal batch settles', async () => {
  const { group } = await mountReadyDescriptors();
  group.replaceChildren();
  await nextFrame();
  await nextFrame();
  const bookkeeping = group as unknown as {
    restoredSlotWrites: Map<Element, string | null>;
    restoredSourceInertWrites: Map<Element, string | null>;
  };
  expect(bookkeeping.restoredSlotWrites.size).to.equal(0);
  expect(bookkeeping.restoredSourceInertWrites.size).to.equal(0);
  expect(names(group)).to.deep.equal([]);
});

it('completes its render after adoption into a connected document without a browsing context', async () => {
  const { group } = await mountReadyDescriptors();
  const destination = document.implementation.createHTMLDocument();
  destination.body.append(group);
  try {
    expect(group.ownerDocument.defaultView).to.equal(null);
    let settled = false;
    const ready = group.updateComplete.then(() => { settled = true; });
    await waitUntil(() => settled, 'render completion needs no unavailable document timer');
    await ready;
  } finally {
    group.remove();
  }
});

it('settles a no-op descriptor class mutation followed by an active render', async () => {
  const { group } = await mountReadyDescriptors();
  group.querySelector('lr-tab[panel="purchase-order"]')!.classList.add('consumer-decoration');
  group.active = 'direct';
  try {
    let settled = false;
    const ready = group.updateComplete.then(() => { settled = true; });
    await waitUntil(() => settled, 'an ordinary active render must not leave projection work pending');
    await ready;
    expect(group.active).to.equal('direct');
    expect(group.shadowRoot!.querySelector('[role="tab"][aria-selected="true"]')?.getAttribute('data-slot')).to.equal('direct');
    expect(names(group)[0]).to.equal('Purchase order');
  } finally {
    group.remove();
  }
});

it('cancels pending projection work on disconnect and safely resumes after adoption', async () => {
  const { wrapper, group } = await mountReadyDescriptors();
  const omitted = group.children[3]!;
  omitted.setAttribute('slot', 'adopted-author-slot');
  await nextFrame();
  const model = group as unknown as { queueProjectionReconciliation(): void; syncTabs(): void };
  const original = model.syncTabs;
  let lateReads = 0;
  model.syncTabs = () => { lateReads++; original(); };
  model.queueProjectionReconciliation();
  group.remove();
  await nextFrame();
  expect(lateReads).to.equal(0);
  expect(omitted.getAttribute('slot')).to.equal('adopted-author-slot');
  const frame = document.createElement('iframe');
  wrapper.append(frame);
  try {
    frame.contentDocument!.body.append(group);
    await nextFrame();
    await nextFrame();
    expect(names(group)).to.include('Purchase order');
    group.remove();
    await nextFrame();
    expect(omitted.getAttribute('slot')).to.equal('adopted-author-slot');
  } finally {
    model.syncTabs = original;
    group.remove();
    frame.remove();
  }
});

for (const count of [32, 64]) {
  it(`coalesces ${count} rich descriptor assignments without provisional tab names`, async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div>
      ${Array.from({ length: count }, (_, index) => html`<lr-tab panel=${`key-${index}`}><span>${`Label ${index}`}</span></lr-tab>`)}
    </div>`);
    await Promise.all([...wrapper.children].map(child => (child as LyraTab).updateComplete));
    const group = document.createElement('lr-tab-group');
    const model = group as unknown as { syncTabs(): void };
    const original = model.syncTabs;
    let reads = 0;
    model.syncTabs = () => { reads++; original(); };
    group.append(...wrapper.children);
    wrapper.append(group);
    const observed: string[] = [];
    const observer = new MutationObserver(() => observed.push(...names(group)));
    observer.observe(group.shadowRoot!, { childList: true, subtree: true, attributes: true });
    try {
      await waitUntil(() => names(group).length === count);
      await nextFrame();
      expect(reads).to.be.at.most(5);
      expect(observed.some(name => name.startsWith('key-'))).to.equal(false);
      expect(names(group)).to.deep.equal(Array.from({ length: count }, (_, index) => `Label ${index}`));
    } finally {
      observer.disconnect();
      model.syncTabs = original;
    }
  });
}

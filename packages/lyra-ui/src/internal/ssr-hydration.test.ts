import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import { html as litHtml } from 'lit';
import { LyraElement } from './lyra-element.js';
import { tag } from './prefix.js';
import '../components/conversation/chat-composer/chat-composer.js';
import '../components/conversation/thread-list/thread-list.js';
import '../components/conversation/usage-badge/usage-badge.js';
import '../components/data/tree/tree-item.js';
import '../components/forms/color-picker/color-picker.js';
import '../components/media/avatar/avatar.js';
import '../components/overlays/kbd/kbd.js';
import '../components/utility/icon/icon.js';

/**
 * Mounts `markup` the way a browser mounts a server-rendered page: the parser attaches the
 * declarative shadow root *before* the custom element upgrades, which is the one signal
 * `seedFirstRenderState()` uses to tell a hydrating mount from a browser-only one. The shadow
 * root's contents do not matter here (Lit renders into it either way) -- only that one exists by
 * the time `connectedCallback()` runs, exactly as it does on a real hydrated page.
 *
 * A test may not use `@lit-labs/ssr-client`: importing its hydrate support would change how every
 * other element in the suite renders. `pnpm test:hydration` covers the real end-to-end contract by
 * rendering each tag through `@lit-labs/ssr` and hydrating it in Chromium.
 */
async function mountServerRendered<T extends HTMLElement>(markup: string): Promise<T> {
  const container = (await fixture(html`<div></div>`)) as HTMLDivElement & {
    setHTMLUnsafe(value: string): void;
  };
  container.setHTMLUnsafe(`${markup}`);
  return container.firstElementChild as T;
}

const SERVER_SHADOW = '<template shadowrootmode="open"></template>';

class DemoSeed extends LyraElement {
  renders = 0;
  seeds = 0;
  slotted = false;
  protected override willUpdate(): void {
    this.seedFirstRenderState(() => {
      this.seeds++;
      this.slotted = this.children.length > 0;
      this.requestUpdate();
    });
  }
  render() {
    this.renders++;
    return litHtml`<span>${this.slotted ? 'slotted' : 'empty'}</span>`;
  }
}
customElements.define(tag('demo-seed'), DemoSeed);

it('seeds light-DOM state before the first render on a browser-only mount', async () => {
  const el = (await fixture(html`<lr-demo-seed><span>child</span></lr-demo-seed>`)) as DemoSeed;

  // One render, already correct: the whole point of seeding early is that declaratively slotted
  // content never flashes the fallback for a frame.
  expect(el.renders).to.equal(1);
  expect(el.seeds).to.equal(1);
  expect(el.shadowRoot?.textContent).to.contain('slotted');
});

it('defers light-DOM state to the update after a server-rendered first render', async () => {
  const el = await mountServerRendered<DemoSeed>(
    `<lr-demo-seed>${SERVER_SHADOW}<span>child</span></lr-demo-seed>`,
  );
  await el.updateComplete;

  // The first render has to reproduce what a server (which is handed no children at all) produced,
  // or hydration throws the entire server-rendered subtree away.
  expect(el.renders).to.equal(1);
  expect(el.shadowRoot?.textContent).to.contain('empty');

  // The deferred seed's `requestUpdate()` runs inside a `.then()` chained off this same
  // `updateComplete` promise -- it and this line are both consumers of that one already-settled
  // promise, so re-reading `el.updateComplete` here resolves immediately without reflecting the
  // new pending update, and how many further microtask ticks it needs before the second render is
  // observable differs by engine (Firefox needs more than Chromium/WebKit). Wait on the actual
  // condition instead of a fixed tick count.
  await waitUntil(() => el.renders === 2);
  expect(el.renders).to.equal(2);
  expect(el.seeds).to.equal(1);
  expect(el.shadowRoot?.textContent).to.contain('slotted');
});

it('stops deferring once the element has hydrated', async () => {
  const el = await mountServerRendered<DemoSeed>(
    `<lr-demo-seed>${SERVER_SHADOW}<span>child</span></lr-demo-seed>`,
  );
  await el.updateComplete;
  await waitUntil(() => el.seeds === 1);
  el.remove();
  document.body.append(el);
  await el.updateComplete;

  // A reconnect is not a hydration: the deferral is a one-shot for the very first render.
  expect(el.seeds).to.equal(1);
  expect(el.shadowRoot?.textContent).to.contain('slotted');
});

it('renders lr-avatar initials first and adopts the slotted glyph after hydration', async () => {
  const el = await mountServerRendered(
    `<lr-avatar label="Ada">${SERVER_SHADOW}<span slot="icon">AD</span></lr-avatar>`,
  );
  await el.updateComplete;
  expect(el.shadowRoot?.querySelectorAll('[part="initials"]').length).to.equal(1);

  await waitUntil(() => el.shadowRoot?.querySelectorAll('[part="initials"]').length === 0);
  expect(el.shadowRoot?.querySelectorAll('[part="initials"]').length).to.equal(0);
  expect(el.shadowRoot?.querySelector('[part="icon"]')?.hasAttribute('hidden')).to.be.false;
});

it('renders lr-kbd key caps first and adopts slotted content after hydration', async () => {
  const el = await mountServerRendered(
    `<lr-kbd keys="mod+k">${SERVER_SHADOW}<span>Custom</span></lr-kbd>`,
  );
  await el.updateComplete;
  expect(el.shadowRoot?.querySelectorAll('[part="key"]').length).to.be.greaterThan(0);

  await waitUntil(() => el.shadowRoot?.querySelectorAll('[part="key"]').length === 0);
  expect(el.shadowRoot?.querySelectorAll('[part="key"]').length).to.equal(0);
  // The outer [part="base"] survives the switch -- only the branch inside it is replaced.
  expect(el.shadowRoot?.querySelectorAll('[part="base"]').length).to.equal(1);
});

it('renders lr-usage-badge inert first and adopts slotted content after hydration', async () => {
  // `hasInteractiveTooltip` requires both display content (here, the immediately-available
  // `summary` attribute) and tooltip content (the `details` slot, only detected once the deferred
  // hydration seed runs) -- slotted content alone never flips it, matching lr-avatar/lr-chat-composer
  // above, whose slots gate a single condition each.
  const el = await mountServerRendered(
    `<lr-usage-badge summary="Custom">${SERVER_SHADOW}<span slot="details">More</span></lr-usage-badge>`,
  );
  await el.updateComplete;
  expect(el.shadowRoot?.querySelector('[part="base"]')?.hasAttribute('role')).to.be.false;

  await waitUntil(
    () => el.shadowRoot?.querySelector('[part="base"]')?.getAttribute('role') === 'group',
  );
  expect(el.shadowRoot?.querySelector('[part="base"]')?.getAttribute('role')).to.equal('group');
});

it('renders lr-thread-list data mode first and adopts slotted rows after hydration', async () => {
  const el = await mountServerRendered(
    `<lr-thread-list>${SERVER_SHADOW}<div>Row</div></lr-thread-list>`,
  );
  await el.updateComplete;
  expect(el.shadowRoot?.querySelector('[part="base"]')?.getAttribute('role')).to.equal('region');

  // See the equivalent wait above: the deferred hydration update can need more microtask ticks on
  // some engines than others before it's actually observable, so wait on the actual DOM condition.
  await waitUntil(() => !el.shadowRoot?.querySelector('[part="base"]')?.hasAttribute('role'));
  expect(el.shadowRoot?.querySelector('[part="base"]')?.hasAttribute('role')).to.be.false;
  expect(el.shadowRoot?.querySelector('[part="list"]')?.getAttribute('role')).to.equal('list');
});

it('renders the lr-tree-item label attribute first and adopts the slot after hydration', async () => {
  const el = await mountServerRendered(
    `<lr-tree-item label="Fallback">${SERVER_SHADOW}Slotted label</lr-tree-item>`,
  );
  await el.updateComplete;
  expect(el.shadowRoot?.querySelector('[part="label"]')?.textContent).to.contain('Fallback');
  expect(el.shadowRoot?.querySelectorAll('[part="label"] slot').length).to.equal(0);

  await waitUntil(() => el.shadowRoot?.querySelectorAll('[part="label"] slot').length === 1);
  expect(el.shadowRoot?.querySelectorAll('[part="label"] slot').length).to.equal(1);
});

it('renders lr-color-picker without the eyedropper first and adds it after hydration', async () => {
  const el = await mountServerRendered(
    `<lr-color-picker inline>${SERVER_SHADOW}<span slot="label">Brand</span></lr-color-picker>`,
  );
  await el.updateComplete;
  expect(el.shadowRoot?.querySelectorAll('[part~="eyedropper-button"]').length).to.equal(0);
  expect(el.shadowRoot?.querySelector('[part~="label"]')?.hasAttribute('hidden')).to.be.true;

  await waitUntil(
    () => !el.shadowRoot?.querySelector('[part~="label"]')?.hasAttribute('hidden'),
  );
  expect(el.shadowRoot?.querySelector('[part~="label"]')?.hasAttribute('hidden')).to.be.false;
});

it('renders lr-chat-composer without adornment slots first and adopts them after hydration', async () => {
  const el = await mountServerRendered(
    `<lr-chat-composer>${SERVER_SHADOW}<span slot="start">Add</span></lr-chat-composer>`,
  );
  await el.updateComplete;
  expect(el.shadowRoot?.querySelector('[part="start"]')?.hasAttribute('hidden')).to.be.true;

  await waitUntil(
    () => !el.shadowRoot?.querySelector('[part="start"]')?.hasAttribute('hidden'),
  );
  expect(el.shadowRoot?.querySelector('[part="start"]')?.hasAttribute('hidden')).to.be.false;
});

it('keeps lr-icon custom-content slot outside the svg so it survives HTML parsing', async () => {
  const el = (await fixture(html`<lr-icon><path d="M0 0h24v24H0z"></path></lr-icon>`)) as HTMLElement;
  await el.updateComplete;

  const slot = el.shadowRoot?.querySelector('slot');
  // Serialized inside <svg>, an HTML parser builds the slot in the SVG namespace instead: an inert
  // element that assigns nothing and has no assignedNodes() to call from updated(). render()'s
  // outer `class="semantic-owner"` wrapper means the slot's parent is that span, not the shadow
  // root directly -- the invariant this test cares about is that the parent isn't (or isn't inside)
  // the svg, matching the test's own title.
  expect(slot instanceof HTMLSlotElement).to.be.true;
  expect(slot?.parentElement?.localName).to.not.equal('svg');
  expect(slot?.closest('svg')).to.equal(null);
  expect(slot?.assignedNodes({ flatten: true }).length).to.be.greaterThan(0);
  // The cloned copy -- not the slot -- is what actually paints, inside the component-owned svg.
  expect(el.shadowRoot?.querySelectorAll('svg [data-lr-custom-copy]').length).to.equal(1);
});

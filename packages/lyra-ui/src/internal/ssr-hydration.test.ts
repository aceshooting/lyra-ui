import { setFlagUrlResolver } from '../components/media/flag/flag.class.js';
import { fixtureCleanup, fixture, expect, html, waitUntil } from '@open-wc/testing';
import { html as litHtml } from 'lit';
import { LyraElement } from './lyra-element.js';
import { tag } from './prefix.js';
import '../components/lr-chat-composer.js';
import '../components/lr-thread-list.js';
import '../components/lr-usage-badge.js';
import '../components/lr-tree-item.js';
import '../components/lr-button.js';
import '../components/lr-checkbox-group.js';
import '../components/lr-code-editor.js';
import '../components/lr-color-picker.js';
import '../components/lr-locale-picker.js';
import '../components/lr-time-input.js';
import '../components/lr-phone-input.js';
import '../components/lr-radio-group.js';
import '../components/lr-slider.js';
import '../components/lr-token-input.js';
import '../components/lr-avatar.js';
import '../components/lr-kbd.js';
import '../components/lr-icon.js';
import '../components/lr-tab-group.js';
import '../components/lr-tab.js';
import '../components/lr-tab-panel.js';
import '../components/lr-format-number.js';
import '../components/lr-format-date.js';

const TEST_FLAG_SRC = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 2"%3E%3Cpath fill="%23005" d="M0 0h3v2H0z"/%3E%3Cpath fill="white" d="M1 0h1v2H1zM0 .5h3v1H0z"/%3E%3C/svg%3E';
before(() => setFlagUrlResolver(async () => TEST_FLAG_SRC));
after(() => {
  fixtureCleanup();
  setFlagUrlResolver(null);
});

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
async function mountServerRendered<T extends LyraElement = LyraElement>(markup: string): Promise<T> {
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
  override render() {
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

it('keeps the lr-color-picker label exposed until its slot is resolved at hydration', async () => {
  const authored = await mountServerRendered(
    `<lr-color-picker inline>${SERVER_SHADOW}<span slot="label">Brand</span></lr-color-picker>`,
  );
  await authored.updateComplete;
  const label = (el: LyraElement) => el.shadowRoot?.querySelector('[part~="label"]');
  expect(authored.shadowRoot?.querySelectorAll('[part~="eyedropper-button"]').length).to.equal(0);
  expect(label(authored)?.hasAttribute('hidden')).to.be.false;

  const empty = await mountServerRendered(`<lr-color-picker inline>${SERVER_SHADOW}</lr-color-picker>`);
  await empty.updateComplete;
  expect(label(empty)?.hasAttribute('hidden')).to.be.false;

  await waitUntil(() => label(empty)?.hasAttribute('hidden'));
  expect(label(authored)?.hasAttribute('hidden')).to.be.false;
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

it('renders lr-button start adornment collapsed first and reveals it after hydration', async () => {
  const el = await mountServerRendered(
    `<lr-button>${SERVER_SHADOW}<span slot="start">S</span>Save</lr-button>`,
  );
  await el.updateComplete;
  expect(el.shadowRoot?.querySelector('[part~="start"]')?.hasAttribute('hidden')).to.be.true;

  await waitUntil(
    () => !el.shadowRoot?.querySelector('[part~="start"]')?.hasAttribute('hidden'),
  );
  expect(el.shadowRoot?.querySelector('[part~="start"]')?.hasAttribute('hidden')).to.be.false;
});

it('renders lr-checkbox-group hint exposed first, keeping authored content and collapsing an empty slot after hydration', async () => {
  const authored = await mountServerRendered(
    `<lr-checkbox-group>${SERVER_SHADOW}<span slot="hint">Pick one</span></lr-checkbox-group>`,
  );
  const empty = await mountServerRendered(`<lr-checkbox-group>${SERVER_SHADOW}</lr-checkbox-group>`);
  await Promise.all([authored.updateComplete, empty.updateComplete]);
  const part = (el: LyraElement) => el.shadowRoot?.querySelector('[part~="hint"]');
  expect(part(authored)?.hasAttribute('hidden')).to.be.false;
  expect(part(empty)?.hasAttribute('hidden')).to.be.false;

  await waitUntil(() => part(empty)?.hasAttribute('hidden'));
  expect(part(authored)?.hasAttribute('hidden')).to.be.false;
});

it('renders lr-radio-group hint exposed first, keeping authored content and collapsing an empty slot after hydration', async () => {
  const authored = await mountServerRendered(
    `<lr-radio-group>${SERVER_SHADOW}<span slot="hint">Pick one</span></lr-radio-group>`,
  );
  const empty = await mountServerRendered(`<lr-radio-group>${SERVER_SHADOW}</lr-radio-group>`);
  await Promise.all([authored.updateComplete, empty.updateComplete]);
  const part = (el: LyraElement) => el.shadowRoot?.querySelector('[part~="hint"]');
  expect(part(authored)?.hasAttribute('hidden')).to.be.false;
  expect(part(empty)?.hasAttribute('hidden')).to.be.false;

  await waitUntil(() => part(empty)?.hasAttribute('hidden'));
  expect(part(authored)?.hasAttribute('hidden')).to.be.false;
});

it('renders lr-slider hint exposed first, keeping authored content and collapsing an empty slot after hydration', async () => {
  const authored = await mountServerRendered(
    `<lr-slider>${SERVER_SHADOW}<span slot="hint">Range</span></lr-slider>`,
  );
  const empty = await mountServerRendered(`<lr-slider>${SERVER_SHADOW}</lr-slider>`);
  await Promise.all([authored.updateComplete, empty.updateComplete]);
  const part = (el: LyraElement) => el.shadowRoot?.querySelector('[part~="hint"]');
  expect(part(authored)?.hasAttribute('hidden')).to.be.false;
  expect(part(empty)?.hasAttribute('hidden')).to.be.false;

  await waitUntil(() => part(empty)?.hasAttribute('hidden'));
  expect(part(authored)?.hasAttribute('hidden')).to.be.false;
});

it('renders lr-time-input start exposed first, keeping authored content and collapsing an empty slot after hydration', async () => {
  const authored = await mountServerRendered(
    `<lr-time-input>${SERVER_SHADOW}<span slot="start">S</span></lr-time-input>`,
  );
  const empty = await mountServerRendered(`<lr-time-input>${SERVER_SHADOW}</lr-time-input>`);
  await Promise.all([authored.updateComplete, empty.updateComplete]);
  const part = (el: LyraElement) => el.shadowRoot?.querySelector('[part~="start"]');
  expect(part(authored)?.hasAttribute('hidden')).to.be.false;
  expect(part(empty)?.hasAttribute('hidden')).to.be.false;

  await waitUntil(() => part(empty)?.hasAttribute('hidden'));
  expect(part(authored)?.hasAttribute('hidden')).to.be.false;
});

it('renders lr-locale-picker hint exposed first, keeping authored content and collapsing an empty slot after hydration', async () => {
  const authored = await mountServerRendered(
    `<lr-locale-picker>${SERVER_SHADOW}<span slot="hint">Pick a locale</span></lr-locale-picker>`,
  );
  const empty = await mountServerRendered(`<lr-locale-picker>${SERVER_SHADOW}</lr-locale-picker>`);
  await Promise.all([authored.updateComplete, empty.updateComplete]);
  const hint = (el: LyraElement) => el.shadowRoot?.querySelector('[part="hint"]');
  expect(hint(authored)?.hasAttribute('hidden')).to.be.false;
  expect(hint(empty)?.hasAttribute('hidden')).to.be.false;

  await waitUntil(() => hint(empty)?.hasAttribute('hidden'));
  expect(hint(authored)?.hasAttribute('hidden')).to.be.false;
});

it('keeps the lr-phone-input country-prefix exposed until its slot is resolved at hydration', async () => {
  const authored = await mountServerRendered(
    `<lr-phone-input>${SERVER_SHADOW}<span slot="country-prefix">+1</span></lr-phone-input>`,
  );
  const empty = await mountServerRendered(`<lr-phone-input>${SERVER_SHADOW}</lr-phone-input>`);
  await Promise.all([authored.updateComplete, empty.updateComplete]);
  const prefix = (el: LyraElement) => el.shadowRoot?.querySelector('[part="country-prefix"]');
  expect(prefix(authored)?.hasAttribute('hidden')).to.be.false;
  expect(prefix(empty)?.hasAttribute('hidden')).to.be.false;

  await waitUntil(() => prefix(empty)?.hasAttribute('hidden'));
  expect(prefix(authored)?.hasAttribute('hidden')).to.be.false;
});

it('renders lr-token-input start adornment exposed first, keeping authored content and collapsing an empty slot after hydration', async () => {
  const authored = await mountServerRendered(
    `<lr-token-input>${SERVER_SHADOW}<span slot="start">S</span></lr-token-input>`,
  );
  const empty = await mountServerRendered(`<lr-token-input>${SERVER_SHADOW}</lr-token-input>`);
  await Promise.all([authored.updateComplete, empty.updateComplete]);
  const start = (el: LyraElement) => el.shadowRoot?.querySelector('[part="start"]');
  expect(start(authored)?.hasAttribute('hidden')).to.be.false;
  expect(start(empty)?.hasAttribute('hidden')).to.be.false;

  await waitUntil(() => start(empty)?.hasAttribute('hidden'));
  expect(start(authored)?.hasAttribute('hidden')).to.be.false;
});

it('renders lr-code-editor hint exposed first, keeping authored content and collapsing an empty slot after hydration', async () => {
  const authored = await mountServerRendered(
    `<lr-code-editor>${SERVER_SHADOW}<span slot="hint">Type code</span></lr-code-editor>`,
  );
  const empty = await mountServerRendered(`<lr-code-editor>${SERVER_SHADOW}</lr-code-editor>`);
  await Promise.all([authored.updateComplete, empty.updateComplete]);
  const part = (el: LyraElement) => el.shadowRoot?.querySelector('[part~="hint"]');
  expect(part(authored)?.hasAttribute('hidden')).to.be.false;
  expect(part(empty)?.hasAttribute('hidden')).to.be.false;

  await waitUntil(() => part(empty)?.hasAttribute('hidden'));
  expect(part(authored)?.hasAttribute('hidden')).to.be.false;
});

it('keeps the lr-tab-group server-selected tab through hydration instead of the first tab', async () => {
  const el = await mountServerRendered<LyraElement & { active: string }>(
    `<lr-tab-group active="preview">${SERVER_SHADOW}<lr-tab panel="input">Input</lr-tab>` +
      '<lr-tab panel="preview">Preview</lr-tab><lr-tab-panel name="input">A</lr-tab-panel>' +
      '<lr-tab-panel name="preview">B</lr-tab-panel></lr-tab-group>',
  );
  await el.updateComplete;
  expect(el.active).to.equal('preview');
  await waitUntil(() => el.shadowRoot?.querySelectorAll('[part="tab"]').length === 2);
  await el.updateComplete;
  expect(el.active).to.equal('preview');
  expect(el.getAttribute('active')).to.equal('preview');
});

it('formats in the server locale first, then commits an ancestor lang after hydration', async () => {
  const wrapper = await mountServerRendered(
    `<p lang="de"><lr-format-number value="1234.5">${SERVER_SHADOW}</lr-format-number>` +
      `<lr-format-date date="2024-03-05T12:00:00Z" month="long" time-zone="UTC">${SERVER_SHADOW}</lr-format-date></p>`,
  );
  const number = wrapper.querySelector<LyraElement>('lr-format-number')!;
  const date = wrapper.querySelector<LyraElement>('lr-format-date')!;
  await Promise.all([number.updateComplete, date.updateComplete]);
  const text = (el: LyraElement) => el.shadowRoot!.textContent!.trim();
  expect([text(number), text(date)]).to.deep.equal(['1,234.5', 'March']);

  await waitUntil(() => text(number) === '1.234,5' && text(date) === 'März');
  // An explicit host locale is visible to the server too, so it renders correctly at once.
  const explicit = await mountServerRendered(`<lr-format-number lang="de" value="1234.5">${SERVER_SHADOW}</lr-format-number>`);
  await explicit.updateComplete;
  expect(text(explicit)).to.equal('1.234,5');
});

it('keeps lr-icon custom-content slot outside the svg so it survives HTML parsing', async () => {
  const el = await fixture<LyraElement>(html`<lr-icon><path d="M0 0h24v24H0z"></path></lr-icon>`);
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

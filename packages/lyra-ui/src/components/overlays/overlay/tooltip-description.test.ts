import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import { accessibleName } from '../../../../test/accessible-name.js';
import type { LyraTooltip } from './tooltip.class.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './tooltip.js';
import '../../forms/select/select.js';

/**
 * The description relationship is only exposed to assistive technology on the element that
 * actually receives focus. Read it back the same way a browser does: an explicitly assigned
 * element-reference list wins, otherwise the serialized ID references resolved inside the node's
 * own root.
 */
function describedByElements(node: HTMLElement): Element[] {
  const reflected = (node as HTMLElement & { ariaDescribedByElements?: Element[] | null })
    .ariaDescribedByElements;
  if (reflected) return [...reflected];
  const value = node.getAttribute('aria-describedby');
  if (!value) return [];
  const root = node.getRootNode() as Document | ShadowRoot;
  return value
    .trim()
    .split(/\s+/)
    .flatMap((id) => {
      const target = root.getElementById?.(id) ?? null;
      return target ? [target] : [];
    });
}

/** The node that would actually take focus, across the composed tree. */
function deepActive(): Element | null {
  let active: Element | null = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active;
}

it('describes the focused control inside a custom-element trigger with its own shadow root', async () => {
  const el = await fixture<LyraTooltip>(html`
    <lr-tooltip show-delay="0">
      Choose a fruit
      <lr-select slot="trigger" label="Fruit" hint="Pick one">
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    </lr-tooltip>
  `);
  const select = el.querySelector('lr-select') as HTMLElement & { updateComplete: Promise<unknown> };
  await select.updateComplete;
  await focusByKeyboard(select);
  await el.updateComplete;
  await select.updateComplete;

  const description = el.querySelector('[data-lyra-tooltip-description]')!;
  const focused = deepActive() as HTMLElement;
  expect(focused.localName).to.equal('button');
  expect(el.hasAttribute('open')).to.be.true;

  const described = describedByElements(focused);
  expect(described.map((node) => node.id)).to.contain(description.id);
  // The trigger's own hint relationship must survive gaining a tooltip description.
  expect(described.some((node) => node.getAttribute('part')?.split(/\s+/).includes('hint'))).to.be.true;
});

it('describes the focused control inside a plain custom-element trigger', async () => {
  const tagName = 'test-tooltip-shadow-trigger';
  if (!customElements.get(tagName)) {
    customElements.define(
      tagName,
      class extends HTMLElement {
        constructor() {
          super();
          this.attachShadow({ mode: 'open', delegatesFocus: true }).innerHTML =
            '<button type="button">Help</button>';
        }
      },
    );
  }
  const el = await fixture<LyraTooltip>(html`
    <lr-tooltip show-delay="0">
      Helpful text
      <test-tooltip-shadow-trigger slot="trigger"></test-tooltip-shadow-trigger>
    </lr-tooltip>
  `);
  const wrapper = el.querySelector(tagName) as HTMLElement;
  const inner = wrapper.shadowRoot!.querySelector('button')!;
  await focusByKeyboard(inner);
  await el.updateComplete;

  const description = el.querySelector('[data-lyra-tooltip-description]')!;
  expect(el.hasAttribute('open')).to.be.true;
  expect(describedByElements(inner).map((node) => node.id)).to.contain(description.id);

  await el.hide();
  await el.updateComplete;
  expect(describedByElements(inner).map((node) => node.id)).to.contain(description.id);
  inner.blur();
  await el.updateComplete;
  expect(describedByElements(inner)).to.be.empty;
});

it('describes a light-DOM focusable inside a custom-element trigger', async () => {
  const tagName = 'test-tooltip-light-trigger';
  if (!customElements.get(tagName)) {
    customElements.define(tagName, class extends HTMLElement {});
  }
  const el = await fixture<LyraTooltip>(html`
    <lr-tooltip show-delay="0">
      Helpful text
      <test-tooltip-light-trigger slot="trigger">
        <button type="button" aria-describedby="light-trigger-help">Help</button>
      </test-tooltip-light-trigger>
      <span id="light-trigger-help" hidden>Existing</span>
    </lr-tooltip>
  `);
  const inner = el.querySelector('button')!;
  await focusByKeyboard(inner);
  await waitUntil(() => el.open);
  expect(deepActive() === inner, 'the light-DOM button holds focus').to.be.true;

  const description = el.querySelector('[data-lyra-tooltip-description]')!;
  const ids = describedByElements(inner).map((node) => node.id);
  expect(ids).to.contain(description.id);
  expect(ids).to.contain('light-trigger-help');

  inner.blur();
  await el.hide();
  await el.updateComplete;
  expect(describedByElements(inner).map((node) => node.id)).to.deep.equal(['light-trigger-help']);
});

it('keeps describing its trigger after its children are replaced wholesale', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div><button id="replaced-content-trigger">Save</button><lr-tooltip for="replaced-content-trigger" show-delay="0">Tip</lr-tooltip></div>
  `);
  const el = wrapper.querySelector('lr-tooltip') as LyraTooltip;
  const button = wrapper.querySelector('button')!;
  await el.updateComplete;
  el.textContent = 'Saved 2 min ago';
  await focusByKeyboard(button);
  await waitUntil(
    () => describedByElements(button).some((node) => node.isConnected && node.textContent === 'Saved 2 min ago'),
    'the trigger lost its tooltip description',
  );
});

it('ignores unrelated document mutations while closed', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div><button id="idle-identity-trigger">Save</button><lr-tooltip for="idle-identity-trigger">Tip</lr-tooltip></div>
  `);
  const el = wrapper.querySelector('lr-tooltip') as LyraTooltip;
  await el.updateComplete;
  const internals = el as unknown as { syncTriggerA11y(): void };
  const original = internals.syncTriggerA11y;
  let syncs = 0;
  internals.syncTriggerA11y = function (this: LyraTooltip) {
    syncs += 1;
    original.call(this);
  };
  wrapper.append(document.createElement('span'));
  await new Promise((resolve) => requestAnimationFrame(resolve));
  expect(syncs).to.equal(0);
});

it('skips content inspection for an unrelated ancestor style write while closed, yet reacts to a visibility change', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div><button id="gated-trigger">Save</button><lr-tooltip for="gated-trigger">Tip</lr-tooltip></div>
  `);
  const el = wrapper.querySelector('lr-tooltip') as LyraTooltip;
  await el.updateComplete;
  const internals = el as unknown as { updateInteractiveContent(): void };
  const original = internals.updateInteractiveContent;
  let inspections = 0;
  internals.updateInteractiveContent = function (this: LyraTooltip) {
    inspections += 1;
    original.call(this);
  };
  // The first batch always matters: it opts the observer in and its rebind records the baseline.
  wrapper.style.setProperty('--prime', '1');
  await waitUntil(() => inspections > 0, 'the first batch never inspected content');
  await new Promise((resolve) => requestAnimationFrame(resolve));
  inspections = 0;
  // A custom-property or class write is part of the presentation key (a closed tooltip's hidden
  // content cannot rule it out), so the unrelated write here is a plain inline style.
  wrapper.style.color = 'red';
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await new Promise((resolve) => requestAnimationFrame(resolve));
  expect(inspections, 'an ancestor style write that cannot change visibility inspected content').to.equal(0);
  wrapper.style.display = 'none';
  await waitUntil(() => inspections > 0);
});

/** Flat-tree text of a shadow subtree: assigned nodes replace a slot, else its fallback renders. */
function flatText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  if (node instanceof HTMLSlotElement) {
    const assigned = node.assignedNodes();
    return (assigned.length > 0 ? assigned : Array.from(node.childNodes)).map(flatText).join('');
  }
  return Array.from(node.childNodes).map(flatText).join('');
}

describe('content property beside a named trigger and whitespace-only default content', () => {
  it('paints and describes with content when the default slot holds only template whitespace', async () => {
    const el = await fixture<LyraTooltip>(html`
      <lr-tooltip manual content="Explains the tag">
        <button type="button" slot="trigger">Tag</button>
      </lr-tooltip>
    `);
    await el.updateComplete;
    const defaultSlot = el.shadowRoot!.querySelector<HTMLSlotElement>('[part~="body"] slot:not([name])')!;
    expect(defaultSlot.assignedNodes().length, 'fixture keeps the whitespace text assigned').to.be.greaterThan(0);
    const description = el.querySelector('[data-lyra-tooltip-description]');
    await focusByKeyboard(el.querySelector('button')!);
    await el.show();
    await el.updateComplete;
    const body = el.shadowRoot!.querySelector<HTMLElement>('[part~="body"]')!;
    expect(flatText(body).trim()).to.equal('Explains the tag');
    expect(description?.textContent).to.equal('Explains the tag');
    await expect(el).to.be.accessible();
  });

  it('switches back to slotted content once real nodes are assigned, and to content when they leave', async () => {
    const el = await fixture<LyraTooltip>(html`
      <lr-tooltip manual content="Fallback text">
        <button type="button" slot="trigger">Tag</button>
      </lr-tooltip>
    `);
    await el.show();
    const body = el.shadowRoot!.querySelector<HTMLElement>('[part~="body"]')!;
    const description = () => el.querySelector('[data-lyra-tooltip-description]')?.textContent;
    const rich = document.createElement('strong');
    rich.textContent = 'Slotted text';
    el.append(rich);
    await waitUntil(() => description() === 'Slotted text', 'slotted text describes the trigger');
    await el.updateComplete;
    expect(flatText(body).trim()).to.equal('Slotted text');
    rich.remove();
    await waitUntil(() => description() === 'Fallback text', 'content describes again once the element leaves');
    await el.updateComplete;
    expect(flatText(body).trim()).to.equal('Fallback text');
  });
});

it('keeps an icon trigger named while closed and releases only its own relationships on mode changes', async () => {
  const el = await fixture<LyraTooltip>(html`
    <lr-tooltip label-mode="label" content="Edit" manual>
      <button aria-labelledby="file-name" aria-describedby="hint"></button>
    </lr-tooltip>
  `);
  const button = el.querySelector('button')!;
  const proxy = el.querySelector('[data-lyra-tooltip-description]')!;
  await waitUntil(() => button.getAttribute('aria-labelledby') === `file-name ${proxy.id}`);
  expect(proxy.textContent).to.equal('Edit');
  await expect(el).to.be.accessible();
  expect(accessibleName(button)).to.equal('Edit');
  expect(button.getAttribute('aria-describedby')).to.equal('hint');
  await el.show();
  await el.hide();
  expect(button.getAttribute('aria-labelledby')).to.equal(`file-name ${proxy.id}`);
  el.setAttribute('label-mode', 'none');
  await el.updateComplete;
  await el.show();
  expect(button.getAttribute('aria-labelledby')).to.equal('file-name');
  expect(button.getAttribute('aria-describedby')).to.equal('hint');
  el.removeAttribute('label-mode');
  await el.updateComplete;
  expect(button.getAttribute('aria-describedby')).to.equal(`hint ${proxy.id}`);
  await el.hide();
  expect(button.getAttribute('aria-describedby')).to.equal('hint');
});

it('preserves a shadow control’s own label when a closed tooltip moves between interaction owners', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div>
      <span id="title">Document</span>
      <div id="edit" aria-labelledby="title"></div>
      <button id="other"></button>
      <lr-tooltip for="edit" label-mode="label" content="Edit"></lr-tooltip>
    </div>
  `);
  const el = wrapper.querySelector('lr-tooltip')!;
  const host = wrapper.querySelector<HTMLElement>('#edit')!;
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = '<span id="title">File</span><button aria-labelledby="title"></button>';
  let control = root.querySelector('button')!;
  const other = wrapper.querySelector<HTMLElement>('#other')!;
  const proxy = el.querySelector('[data-lyra-tooltip-description]')!;
  await focusByKeyboard(control);
  await waitUntil(() => control.ariaLabelledByElements?.includes(proxy) === true);
  expect(control.ariaLabelledByElements?.map(node => node.textContent)).to.deep.equal(['File', 'Edit']);
  expect(host.getAttribute('aria-labelledby')).to.equal(`title ${proxy.id}`);
  expect(control.hasAttribute('aria-describedby')).to.be.false;
  const replacement = control.cloneNode(false) as HTMLButtonElement;
  replacement.setAttribute('aria-labelledby', 'title');
  control.replaceWith(replacement);
  await waitUntil(() => replacement.ariaLabelledByElements?.includes(proxy) === true);
  expect(control.getAttribute('aria-labelledby')).to.equal('title');
  control = replacement;
  el.for = 'other';
  await el.updateComplete;
  expect(host.getAttribute('aria-labelledby')).to.equal('title');
  expect(control.getAttribute('aria-labelledby')).to.equal('title');
  expect(other.getAttribute('aria-labelledby')).to.equal(proxy.id);
  const slotted = document.createElement('button');
  slotted.slot = 'trigger';
  el.append(slotted);
  await waitUntil(() => slotted.getAttribute('aria-labelledby') === proxy.id);
  expect(other.hasAttribute('aria-labelledby')).to.be.false;
  el.remove();
  expect(slotted.hasAttribute('aria-labelledby')).to.be.false;
  wrapper.append(el);
  await waitUntil(() => slotted.getAttribute('aria-labelledby') === proxy.id);
});

it('names the native button of a custom trigger that upgrades while the tooltip is closed', async () => {
  const el = await fixture<LyraTooltip>(html`
    <lr-tooltip label-mode="label" content="Print">
      <test-tooltip-late-label-trigger slot="trigger" tabindex="0"></test-tooltip-late-label-trigger>
    </lr-tooltip>
  `);
  const trigger = el.querySelector('test-tooltip-late-label-trigger')!;
  const proxy = el.querySelector('[data-lyra-tooltip-description]')!;
  await waitUntil(() => trigger.getAttribute('aria-labelledby') === proxy.id);
  if (!customElements.get(trigger.localName)) {
    customElements.define(trigger.localName, class extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' }).append(document.createElement('button'));
      }
    });
  }
  const button = trigger.shadowRoot!.querySelector('button')!;
  await waitUntil(() => button.ariaLabelledByElements?.includes(proxy) === true);
  expect(el.open).to.be.false;
});

it('moves the active default description when a wrapper replaces its native focus control', async () => {
  const el = await fixture<LyraTooltip>(html`
    <lr-tooltip content="Print" manual><div slot="trigger"></div></lr-tooltip>
  `);
  const root = el.querySelector('div')!.attachShadow({ mode: 'open' });
  root.innerHTML = '<span id="hint">Device</span><button aria-describedby="hint">Printer</button>';
  const previous = root.querySelector('button')!;
  const proxy = el.querySelector('[data-lyra-tooltip-description]')!;
  await el.show();
  expect(describedByElements(previous).map(element => element.id)).to.deep.equal(['hint', proxy.id]);
  const replacement = document.createElement('button');
  previous.replaceWith(replacement);
  await waitUntil(() => describedByElements(replacement).includes(proxy));
  expect(previous.getAttribute('aria-describedby')).to.equal('hint');
  await el.hide();
  expect(replacement.hasAttribute('aria-describedby')).to.be.false;
});

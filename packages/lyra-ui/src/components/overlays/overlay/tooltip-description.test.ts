import { fixture, expect, html } from '@open-wc/testing';
import type { LyraTooltip } from './tooltip.class.js';
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
  select.focus();
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
  inner.focus();
  await el.updateComplete;

  const description = el.querySelector('[data-lyra-tooltip-description]')!;
  expect(el.hasAttribute('open')).to.be.true;
  expect(describedByElements(inner).map((node) => node.id)).to.contain(description.id);

  await el.hide();
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
  // A light-DOM focusable is never retargeted onto the wrapper, so the non-bubbling `focus` event
  // does not reach the trigger listener -- open it the way `manual`/`click` triggers do instead.
  inner.focus();
  await el.show();
  await el.updateComplete;
  expect(deepActive() === inner, 'the light-DOM button holds focus').to.be.true;

  const description = el.querySelector('[data-lyra-tooltip-description]')!;
  const ids = describedByElements(inner).map((node) => node.id);
  expect(ids).to.contain(description.id);
  expect(ids).to.contain('light-trigger-help');

  await el.hide();
  await el.updateComplete;
  expect(describedByElements(inner).map((node) => node.id)).to.deep.equal(['light-trigger-help']);
});

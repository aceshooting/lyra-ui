import { fixture, expect, html } from '@open-wc/testing';
import './widget.js';
import type { LyraWidget } from './widget.js';
import { styles } from './widget.styles.js';

// A stand-in for a slotted component (e.g. lyra-combobox) whose real
// focusable target lives inside its own shadow root rather than the host
// tag's light-DOM subtree.
class WidgetTestShadowInput extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const input = document.createElement('input');
    input.type = 'text';
    root.appendChild(input);
  }
}
customElements.define('widget-test-shadow-input', WidgetTestShadowInput);

it('renders label and sublabel in the header', async () => {
  const el = (await fixture(
    html`<lyra-widget label="Load profile" sublabel="Last 7 days">content</lyra-widget>`,
  )) as LyraWidget;
  expect(el.shadowRoot!.querySelector('[part="label"]')!.textContent).to.equal('Load profile');
  expect(el.shadowRoot!.querySelector('[part="sublabel"]')!.textContent).to.equal('Last 7 days');
});

it('truncates long label/sublabel text instead of wrapping and growing the header', async () => {
  const longText =
    'A very long widget title that is guaranteed to overflow a narrow fixed-width panel and get ellipsis-truncated';
  const el = (await fixture(
    html`<lyra-widget label=${longText} sublabel=${longText} style="max-inline-size: 8rem;">content</lyra-widget>`,
  )) as LyraWidget;
  const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
  const sublabel = el.shadowRoot!.querySelector('[part="sublabel"]') as HTMLElement;
  const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLElement;

  expect(label.scrollWidth, 'sanity check: label text actually overflows its box').to.be.greaterThan(
    label.clientWidth,
  );
  expect(sublabel.scrollWidth, 'sanity check: sublabel text actually overflows its box').to.be.greaterThan(
    sublabel.clientWidth,
  );
  expect(getComputedStyle(label).textOverflow).to.equal('ellipsis');
  expect(getComputedStyle(sublabel).textOverflow).to.equal('ellipsis');
  expect(getComputedStyle(label).whiteSpace).to.equal('nowrap');
  expect(getComputedStyle(sublabel).whiteSpace).to.equal('nowrap');

  // A single line per part (label + sublabel stacked) instead of the header
  // growing to wrap the long text -- each part's rendered height stays
  // within one line-height of its own font-size.
  expect(label.getBoundingClientRect().height).to.be.lessThanOrEqual(
    parseFloat(getComputedStyle(label).fontSize) * 2,
  );
  expect(sublabel.getBoundingClientRect().height).to.be.lessThanOrEqual(
    parseFloat(getComputedStyle(sublabel).fontSize) * 2,
  );
  expect(header).to.exist;
});

it('hides the actions wrapper when no actions content is slotted, shows it once slotted', async () => {
  const el = (await fixture(html`<lyra-widget label="x">content</lyra-widget>`)) as LyraWidget;
  const actions = el.shadowRoot!.querySelector('[part="actions"]') as HTMLElement;
  const actionsSlot = el.shadowRoot!.querySelector('slot[name="actions"]') as HTMLSlotElement;
  expect(actions.hasAttribute('hidden')).to.be.true;
  expect(actionsSlot.assignedElements().length).to.equal(0);

  const button = document.createElement('button');
  button.slot = 'actions';
  el.appendChild(button);
  actionsSlot.dispatchEvent(new Event('slotchange'));
  await el.updateComplete;

  expect(actions.hasAttribute('hidden')).to.be.false;
  expect(actionsSlot.assignedElements().length).to.equal(1);

  el.removeChild(button);
  actionsSlot.dispatchEvent(new Event('slotchange'));
  await el.updateComplete;

  expect(actions.hasAttribute('hidden')).to.be.true;
});

it('renders the actions wrapper visible on first paint when actions content is present before upgrade', async () => {
  const el = (await fixture(
    html`<lyra-widget label="x"><button slot="actions">Refresh</button>content</lyra-widget>`,
  )) as LyraWidget;
  const actions = el.shadowRoot!.querySelector('[part="actions"]') as HTMLElement;
  expect(actions.hasAttribute('hidden')).to.be.false;
});

it('does not render the collapse or fullscreen buttons unless opted in', async () => {
  const el = (await fixture(html`<lyra-widget label="x">content</lyra-widget>`)) as LyraWidget;
  expect(el.shadowRoot!.querySelector('[part="collapse-button"]')).to.not.exist;
  expect(el.shadowRoot!.querySelector('[part="fullscreen-button"]')).to.not.exist;
});

it('toggles collapsed on collapse-button click and emits lyra-collapse-change', async () => {
  const el = (await fixture(html`<lyra-widget label="x" collapsible>content</lyra-widget>`)) as LyraWidget;
  let detail: unknown;
  el.addEventListener('lyra-collapse-change', (e) => (detail = (e as CustomEvent).detail));

  (el.shadowRoot!.querySelector('[part="collapse-button"]') as HTMLButtonElement).click();
  await el.updateComplete;

  expect(el.collapsed).to.be.true;
  expect(detail).to.be.true;
  expect(el.shadowRoot!.querySelector('[part="body"]')!.hasAttribute('hidden')).to.be.true;
});

it('reflects the collapse-button aria-expanded and aria-label with the collapsed state', async () => {
  const el = (await fixture(html`<lyra-widget label="x" collapsible>content</lyra-widget>`)) as LyraWidget;
  const btn = el.shadowRoot!.querySelector('[part="collapse-button"]') as HTMLButtonElement;
  expect(btn.getAttribute('aria-expanded')).to.equal('true');
  expect(btn.getAttribute('aria-label')).to.equal('Collapse panel');

  btn.click();
  await el.updateComplete;

  expect(btn.getAttribute('aria-expanded')).to.equal('false');
  expect(btn.getAttribute('aria-label')).to.equal('Expand panel');
});

it('rotates the wrapping [part="collapse-button"] itself, not the inner svg, per the icons.ts rotation contract', async () => {
  // internal/icons.ts documents: "callers needing 'up'/'left'/'open' etc.
  // rotate the wrapping part element via CSS transform: rotate(...), not the svg."
  const el = (await fixture(html`<lyra-widget label="x" collapsible>content</lyra-widget>`)) as LyraWidget;
  const btn = el.shadowRoot!.querySelector('[part="collapse-button"]') as HTMLElement;
  const svgEl = btn.querySelector('svg') as unknown as HTMLElement;

  expect(getComputedStyle(btn).transform).to.not.equal('none');
  expect(getComputedStyle(svgEl).transform).to.equal('none');
});

it('animates the collapse-button rotation via the CSS transition, not an instant snap', async () => {
  const el = (await fixture(html`<lyra-widget label="x" collapsible>content</lyra-widget>`)) as LyraWidget;
  const btn = el.shadowRoot!.querySelector('[part="collapse-button"]') as HTMLElement;

  expect(getComputedStyle(btn).transitionProperty).to.include('transform');
});

it('toggles fullscreen on fullscreen-button click, locking scroll and adding a backdrop', async () => {
  const el = (await fixture(html`<lyra-widget label="x" expandable>content</lyra-widget>`)) as LyraWidget;

  (el.shadowRoot!.querySelector('[part="fullscreen-button"]') as HTMLButtonElement).click();
  await el.updateComplete;

  expect(el.fullscreen).to.be.true;
  expect(el.hasAttribute('fullscreen')).to.be.true;
  expect(document.documentElement.style.overflow).to.equal('hidden');
  expect(el.shadowRoot!.querySelector('[part="backdrop"]')).to.exist;

  (el.shadowRoot!.querySelector('[part="fullscreen-button"]') as HTMLButtonElement).click();
  await el.updateComplete;

  expect(el.fullscreen).to.be.false;
  expect(document.documentElement.style.overflow).to.equal('');
  expect(el.shadowRoot!.querySelector('[part="backdrop"]')).to.not.exist;
});

it('reflects the fullscreen-button aria-pressed and aria-label with the fullscreen state', async () => {
  const el = (await fixture(html`<lyra-widget label="x" expandable>content</lyra-widget>`)) as LyraWidget;
  const btn = el.shadowRoot!.querySelector('[part="fullscreen-button"]') as HTMLButtonElement;
  expect(btn.getAttribute('aria-pressed')).to.equal('false');
  expect(btn.getAttribute('aria-label')).to.equal('Expand to fullscreen');

  btn.click();
  await el.updateComplete;

  expect(btn.getAttribute('aria-pressed')).to.equal('true');
  expect(btn.getAttribute('aria-label')).to.equal('Exit fullscreen');
});

it('exits fullscreen on Escape and returns focus to the trigger button', async () => {
  const el = (await fixture(html`<lyra-widget label="x" expandable>content</lyra-widget>`)) as LyraWidget;
  const btn = el.shadowRoot!.querySelector('[part="fullscreen-button"]') as HTMLButtonElement;
  btn.click();
  await el.updateComplete;
  expect(el.fullscreen).to.be.true;

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  await el.updateComplete;

  expect(el.fullscreen).to.be.false;
  expect(el.shadowRoot!.activeElement).to.equal(el.shadowRoot!.querySelector('[part="fullscreen-button"]'));
});

it('exits fullscreen on Escape even when entered by setting the fullscreen property directly (not via the button click)', async () => {
  const el = (await fixture(html`<lyra-widget label="x" expandable>content</lyra-widget>`)) as LyraWidget;
  el.fullscreen = true;
  await el.updateComplete;
  expect(el.fullscreen).to.be.true;

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  await el.updateComplete;

  expect(el.fullscreen).to.be.false;
});

it('exits fullscreen on backdrop click', async () => {
  const el = (await fixture(html`<lyra-widget label="x" expandable>content</lyra-widget>`)) as LyraWidget;
  (el.shadowRoot!.querySelector('[part="fullscreen-button"]') as HTMLButtonElement).click();
  await el.updateComplete;

  (el.shadowRoot!.querySelector('[part="backdrop"]') as HTMLElement).click();
  await el.updateComplete;

  expect(el.fullscreen).to.be.false;
});

it('releases the scroll lock on disconnect while fullscreen', async () => {
  const el = (await fixture(html`<lyra-widget label="x" expandable>content</lyra-widget>`)) as LyraWidget;
  (el.shadowRoot!.querySelector('[part="fullscreen-button"]') as HTMLButtonElement).click();
  await el.updateComplete;
  expect(document.documentElement.style.overflow).to.equal('hidden');

  el.remove();

  expect(document.documentElement.style.overflow).to.equal('');
});

it('restores the scroll lock and keydown trap when reparented while still fullscreen', async () => {
  const el = (await fixture(html`<lyra-widget label="x" expandable>content</lyra-widget>`)) as LyraWidget;
  (el.shadowRoot!.querySelector('[part="fullscreen-button"]') as HTMLButtonElement).click();
  await el.updateComplete;
  expect(document.documentElement.style.overflow).to.equal('hidden');

  const otherContainer = document.createElement('div');
  document.body.appendChild(otherContainer);
  otherContainer.appendChild(el); // reparenting an already-connected node fires disconnectedCallback then connectedCallback synchronously
  expect(el.fullscreen).to.be.true;
  expect(document.documentElement.style.overflow).to.equal('hidden');

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  await el.updateComplete;

  expect(el.fullscreen).to.be.false;
  expect(document.documentElement.style.overflow).to.equal('');

  otherContainer.remove();
});

it('is accessible in both default and fullscreen-expandable states', async () => {
  const el = (await fixture(
    html`<lyra-widget label="Load profile" collapsible expandable>content</lyra-widget>`,
  )) as LyraWidget;
  await expect(el).to.be.accessible();

  (el.shadowRoot!.querySelector('[part="fullscreen-button"]') as HTMLButtonElement).click();
  await el.updateComplete;
  expect(el.fullscreen).to.be.true;

  await expect(el).to.be.accessible();
});

it('marks the fullscreen panel with dialog semantics and clears them on exit', async () => {
  const el = (await fixture(
    html`<lyra-widget label="Load profile" expandable>content</lyra-widget>`,
  )) as LyraWidget;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.hasAttribute('role')).to.be.false;
  expect(base.hasAttribute('aria-modal')).to.be.false;

  (el.shadowRoot!.querySelector('[part="fullscreen-button"]') as HTMLButtonElement).click();
  await el.updateComplete;

  expect(base.getAttribute('role')).to.equal('dialog');
  expect(base.getAttribute('aria-modal')).to.equal('true');
  expect(base.getAttribute('aria-label')).to.equal('Load profile');

  (el.shadowRoot!.querySelector('[part="fullscreen-button"]') as HTMLButtonElement).click();
  await el.updateComplete;

  expect(base.hasAttribute('role')).to.be.false;
  expect(base.hasAttribute('aria-modal')).to.be.false;
});

it('falls back to a generic aria-label for the fullscreen dialog when no label is set', async () => {
  const el = (await fixture(html`<lyra-widget expandable>content</lyra-widget>`)) as LyraWidget;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  (el.shadowRoot!.querySelector('[part="fullscreen-button"]') as HTMLButtonElement).click();
  await el.updateComplete;

  expect(base.getAttribute('aria-label')).to.equal('Fullscreen panel');
});

it('traps Tab focus inside the fullscreen panel, wrapping last->first and first->last', async () => {
  const el = (await fixture(
    html`<lyra-widget label="x" collapsible expandable>content</lyra-widget>`,
  )) as LyraWidget;
  const collapseBtn = el.shadowRoot!.querySelector('[part="collapse-button"]') as HTMLButtonElement;
  const fullscreenBtn = el.shadowRoot!.querySelector('[part="fullscreen-button"]') as HTMLButtonElement;

  fullscreenBtn.click();
  await el.updateComplete;
  expect(el.fullscreen).to.be.true;

  // fullscreen-button is the last focusable (no slotted actions/body content
  // here); Tab from it must wrap to the first, collapse-button.
  fullscreenBtn.focus();
  const tabForward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  document.dispatchEvent(tabForward);
  await el.updateComplete;
  expect(tabForward.defaultPrevented).to.be.true;
  expect(el.shadowRoot!.activeElement).to.equal(collapseBtn);

  // Shift+Tab from the first focusable must wrap to the last.
  const tabBackward = new KeyboardEvent('keydown', {
    key: 'Tab',
    shiftKey: true,
    bubbles: true,
    cancelable: true,
  });
  document.dispatchEvent(tabBackward);
  await el.updateComplete;
  expect(tabBackward.defaultPrevented).to.be.true;
  expect(el.shadowRoot!.activeElement).to.equal(fullscreenBtn);
});

it('traps Tab/Shift+Tab at a slotted element whose focusable target lives in its own shadow root', async () => {
  const el = (await fixture(
    html`<lyra-widget label="x" expandable>
      <widget-test-shadow-input slot="actions"></widget-test-shadow-input>
      content
    </lyra-widget>`,
  )) as LyraWidget;
  const fullscreenBtn = el.shadowRoot!.querySelector('[part="fullscreen-button"]') as HTMLButtonElement;
  fullscreenBtn.click();
  await el.updateComplete;

  const shadowHost = el.querySelector('widget-test-shadow-input') as WidgetTestShadowInput;
  const input = shadowHost.shadowRoot!.querySelector('input') as HTMLInputElement;

  // The shadow input is the first focusable element; Shift+Tab from it must
  // wrap to the last (the fullscreen button), not leak past the widget.
  input.focus();
  const shiftTab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
  document.dispatchEvent(shiftTab);
  await el.updateComplete;
  expect(shiftTab.defaultPrevented).to.be.true;
  expect(el.shadowRoot!.activeElement).to.equal(fullscreenBtn);

  // Tab from the last focusable (fullscreen button) must wrap back to the
  // shadow input.
  fullscreenBtn.focus();
  const tabForward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  document.dispatchEvent(tabForward);
  await el.updateComplete;
  expect(tabForward.defaultPrevented).to.be.true;
  expect(shadowHost.shadowRoot!.activeElement).to.equal(input);
});

it('prevents Tab from doing anything when fullscreen has no focusable elements at all', async () => {
  const el = (await fixture(html`<lyra-widget label="x">content</lyra-widget>`)) as LyraWidget;
  el.fullscreen = true;
  await el.updateComplete;

  const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  document.dispatchEvent(tab);

  expect(tab.defaultPrevented).to.be.true;
});

it('does not intercept a forward Tab press that is not leaving the last focusable element', async () => {
  const el = (await fixture(
    html`<lyra-widget label="x" collapsible expandable>content</lyra-widget>`,
  )) as LyraWidget;
  (el.shadowRoot!.querySelector('[part="fullscreen-button"]') as HTMLButtonElement).click();
  await el.updateComplete;

  const collapseBtn = el.shadowRoot!.querySelector('[part="collapse-button"]') as HTMLButtonElement;
  collapseBtn.focus();
  const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  document.dispatchEvent(tab);

  expect(tab.defaultPrevented).to.be.false;
});

it("excludes a collapsed body's slotted focusable content from the fullscreen tab trap", async () => {
  const el = (await fixture(
    html`<lyra-widget label="x" collapsible collapsed expandable><button>inner</button></lyra-widget>`,
  )) as LyraWidget;
  const collapseBtn = el.shadowRoot!.querySelector('[part="collapse-button"]') as HTMLButtonElement;
  const fullscreenBtn = el.shadowRoot!.querySelector('[part="fullscreen-button"]') as HTMLButtonElement;

  fullscreenBtn.click();
  await el.updateComplete;
  expect(el.fullscreen).to.be.true;

  // The slotted button lives in the collapsed (display:none) body, so
  // fullscreen-button must be the last focusable element -- Tab from it
  // wraps to collapse-button, not to the hidden slotted button.
  fullscreenBtn.focus();
  const tabForward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  document.dispatchEvent(tabForward);
  await el.updateComplete;
  expect(tabForward.defaultPrevented).to.be.true;
  expect(el.shadowRoot!.activeElement).to.equal(collapseBtn);
});

it('reclaims focus inside the fullscreen panel when collapsing hides the currently focused body content', async () => {
  const el = (await fixture(
    html`<lyra-widget label="x" collapsible expandable><button id="inner">inner</button></lyra-widget>`,
  )) as LyraWidget;
  const fullscreenBtn = el.shadowRoot!.querySelector('[part="fullscreen-button"]') as HTMLButtonElement;
  const collapseBtn = el.shadowRoot!.querySelector('[part="collapse-button"]') as HTMLButtonElement;

  fullscreenBtn.click();
  await el.updateComplete;
  expect(el.fullscreen).to.be.true;

  const inner = el.querySelector('#inner') as HTMLButtonElement;
  inner.focus();
  expect((el.shadowRoot!.activeElement ?? document.activeElement) === inner).to.be.true;

  el.collapsed = true;
  await el.updateComplete;

  // Focus must land on a still-connected focusable element inside the
  // shadow root (the collapse-button, the first focusable in this case)
  // rather than escaping the modal focus trap out to document.body. (Boolean
  // comparisons rather than direct chai `.to.equal(domNode)` here -- this
  // test environment can hang trying to build a failure diff for two DOM
  // element references, so failures must resolve through a plain boolean.)
  expect(document.activeElement !== document.body).to.be.true;
  expect(el.shadowRoot!.activeElement === collapseBtn).to.be.true;
});

it('moves focus into the panel when fullscreen is entered', async () => {
  const el = (await fixture(
    html`<lyra-widget label="x" collapsible expandable>content</lyra-widget>`,
  )) as LyraWidget;
  const collapseBtn = el.shadowRoot!.querySelector('[part="collapse-button"]') as HTMLButtonElement;

  el.fullscreen = true;
  await el.updateComplete;

  // collapse-button is the first focusable element (no actions slotted);
  // entering fullscreen must move focus there even though nothing was
  // clicked to trigger it.
  expect(el.shadowRoot!.activeElement).to.equal(collapseBtn);
});

it('focuses the panel base as a fallback when fullscreen has no focusable elements', async () => {
  const el = (await fixture(html`<lyra-widget label="x">content</lyra-widget>`)) as LyraWidget;

  el.fullscreen = true;
  await el.updateComplete;

  expect(el.shadowRoot!.activeElement).to.equal(el.shadowRoot!.querySelector('[part="base"]'));
});

it('links the collapse-button to the body region it controls via aria-controls', async () => {
  const el = (await fixture(html`<lyra-widget label="x" collapsible>content</lyra-widget>`)) as LyraWidget;
  const btn = el.shadowRoot!.querySelector('[part="collapse-button"]') as HTMLButtonElement;
  const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;

  expect(btn.getAttribute('aria-controls')).to.equal(body.id);
  expect(body.id).to.not.equal('');
});

it('does not intercept Tab when not fullscreen', async () => {
  const el = (await fixture(html`<lyra-widget label="x" collapsible>content</lyra-widget>`)) as LyraWidget;
  const collapseBtn = el.shadowRoot!.querySelector('[part="collapse-button"]') as HTMLButtonElement;
  collapseBtn.focus();

  const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  document.dispatchEvent(tab);

  expect(tab.defaultPrevented).to.be.false;
});

it('exposes the fullscreen scrim color as a retheme-able custom property', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.include('--lyra-widget-overlay-color: rgb(0 0 0 / 0.5)');
  expect(css).to.include('background: var(--lyra-widget-overlay-color)');
});

it('disables the collapse/fullscreen icon rotate transition under reduced motion', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.include('transition: transform var(--lyra-transition-fast);');
  expect(css).to.include(
    "@media (prefers-reduced-motion: reduce) { [part='collapse-button'], [part='fullscreen-button'] { transition: none !important; } }",
  );
});

it('applies a custom fullscreen-inset while fullscreen', async () => {
  const el = (await fixture(
    html`<lyra-widget expandable fullscreen fullscreen-inset="0 0 0 240px"><p>Body</p></lyra-widget>`,
  )) as LyraWidget;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.style.getPropertyValue('--lyra-widget-fullscreen-inset')).to.equal('0 0 0 240px');
});

it('falls back to the default inset when fullscreen-inset is unset', async () => {
  const el = (await fixture(
    html`<lyra-widget expandable fullscreen><p>Body</p></lyra-widget>`,
  )) as LyraWidget;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.style.getPropertyValue('--lyra-widget-fullscreen-inset')).to.equal('');
});

it('reflects the compact attribute', async () => {
  const el = (await fixture(html`<lyra-widget compact><p>Body</p></lyra-widget>`)) as LyraWidget;
  expect(el.hasAttribute('compact')).to.be.true;
});

it('applies tighter header/body padding when compact', async () => {
  const normal = (await fixture(
    html`<lyra-widget label="x"><p>Body</p></lyra-widget>`,
  )) as LyraWidget;
  const compact = (await fixture(
    html`<lyra-widget label="x" compact><p>Body</p></lyra-widget>`,
  )) as LyraWidget;

  expect(compact.hasAttribute('compact')).to.be.true;

  const normalHeader = normal.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
  const compactHeader = compact.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
  const normalBody = normal.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
  const compactBody = compact.shadowRoot!.querySelector('[part="body"]') as HTMLElement;

  const normalHeaderStyle = getComputedStyle(normalHeader);
  const compactHeaderStyle = getComputedStyle(compactHeader);
  const normalBodyStyle = getComputedStyle(normalBody);
  const compactBodyStyle = getComputedStyle(compactBody);

  // The compact `--lyra-space-xs`/`--lyra-space-s` padding renders strictly
  // smaller than the default `--lyra-space-s`/`--lyra-space-m` padding.
  expect(
    parseFloat(compactHeaderStyle.paddingBlockStart),
    'compact header padding should render smaller than the default',
  ).to.be.lessThan(parseFloat(normalHeaderStyle.paddingBlockStart));
  expect(
    parseFloat(compactHeaderStyle.paddingInlineStart),
    'compact header padding should render smaller than the default',
  ).to.be.lessThan(parseFloat(normalHeaderStyle.paddingInlineStart));
  expect(
    parseFloat(compactBodyStyle.paddingBlockStart),
    'compact body padding should render smaller than the default',
  ).to.be.lessThan(parseFloat(normalBodyStyle.paddingBlockStart));
  expect(
    parseFloat(compactBodyStyle.paddingInlineStart),
    'compact body padding should render smaller than the default',
  ).to.be.lessThan(parseFloat(normalBodyStyle.paddingInlineStart));
});

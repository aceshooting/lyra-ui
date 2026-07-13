import { fixture, expect, oneEvent, html, aTimeout } from '@open-wc/testing';
import './tabs.js';
import type { LyraTabs } from './tabs.js';

const basic = () => html`
  <lyra-tabs>
    <div slot="input" label="Input">Raw input</div>
    <div slot="preview" label="Preview">Rendered preview</div>
    <div slot="settings" label="Settings">Settings form</div>
  </lyra-tabs>
`;

function tabButtons(el: LyraTabs): HTMLButtonElement[] {
  return [...el.shadowRoot!.querySelectorAll('[part="tab"]')] as HTMLButtonElement[];
}

function panels(el: LyraTabs): HTMLElement[] {
  return [...el.shadowRoot!.querySelectorAll('[part="panel"]')] as HTMLElement[];
}

function press(target: HTMLElement, key: string): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, composed: true }));
}

it('is accessible with no panel children (empty state)', async () => {
  const el = (await fixture(html`<lyra-tabs></lyra-tabs>`)) as LyraTabs;
  expect(tabButtons(el).length).to.equal(0);
  await expect(el).to.be.accessible();
});

it('is accessible with populated tabs', async () => {
  const el = (await fixture(basic())) as LyraTabs;
  await expect(el).to.be.accessible();
});

it('builds one tab per direct child that has both slot and label, defaulting active to the first', async () => {
  const el = (await fixture(basic())) as LyraTabs;
  const buttons = tabButtons(el);
  expect(buttons.map((b) => b.textContent?.trim())).to.deep.equal(['Input', 'Preview', 'Settings']);
  expect(el.active).to.equal('input');
  expect(buttons[0].getAttribute('aria-selected')).to.equal('true');
  expect(buttons[1].getAttribute('aria-selected')).to.equal('false');
});

it('a child with no label attribute never produces a tab or a rendered panel', async () => {
  const el = (await fixture(html`
    <lyra-tabs>
      <div slot="input" label="Input">Raw input</div>
      <div slot="preview">No label -- should be invisible</div>
    </lyra-tabs>
  `)) as LyraTabs;
  const buttons = tabButtons(el);
  expect(buttons.length).to.equal(1);
  expect(panels(el).length).to.equal(1);
  const unlabeled = el.querySelector('[slot="preview"]') as HTMLElement;
  // Never assigned to any rendered <slot>, since this component only ever
  // renders a named slot for tabs that made it into the `tabs` state.
  expect(unlabeled.assignedSlot).to.be.null;
});

it('only the active panel is visible; the others are hidden', async () => {
  const el = (await fixture(basic())) as LyraTabs;
  const [input, preview, settings] = panels(el);
  expect(input.hidden).to.be.false;
  expect(preview.hidden).to.be.true;
  expect(settings.hidden).to.be.true;
});

it('roving tabindex: only the active tab button is tabindex="0"', async () => {
  const el = (await fixture(basic())) as LyraTabs;
  const buttons = tabButtons(el);
  expect(buttons.map((b) => b.getAttribute('tabindex'))).to.deep.equal(['0', '-1', '-1']);
});

it('each tab button aria-controls its own panel, and each panel is aria-labelledby its tab', async () => {
  const el = (await fixture(basic())) as LyraTabs;
  const [inputTab, previewTab] = tabButtons(el);
  const [inputPanel, previewPanel] = panels(el);
  expect(inputTab.getAttribute('aria-controls')).to.equal(inputPanel.id);
  expect(previewTab.getAttribute('aria-controls')).to.equal(previewPanel.id);
  expect(inputPanel.getAttribute('aria-labelledby')).to.equal(inputTab.id);
});

it('clicking a tab activates it and fires lyra-tabs-change with the tab id', async () => {
  const el = (await fixture(basic())) as LyraTabs;
  const listener = oneEvent(el, 'lyra-tabs-change');
  tabButtons(el)[1].click();
  const event = await listener;
  expect((event as CustomEvent<{ tabId: string }>).detail).to.deep.equal({ tabId: 'preview' });
  expect(el.active).to.equal('preview');
  await el.updateComplete;
  expect(panels(el)[1].hidden).to.be.false;
  expect(panels(el)[0].hidden).to.be.true;
});

it('clicking the already-active tab is a no-op: no event, no change', async () => {
  const el = (await fixture(basic())) as LyraTabs;
  let fired = false;
  el.addEventListener('lyra-tabs-change', () => (fired = true));
  tabButtons(el)[0].click();
  await el.updateComplete;
  expect(fired).to.be.false;
  expect(el.active).to.equal('input');
});

it('a disabled child renders its tab, but clicking it never activates it', async () => {
  const el = (await fixture(html`
    <lyra-tabs>
      <div slot="input" label="Input">Raw input</div>
      <div slot="preview" label="Preview" disabled>Rendered preview</div>
    </lyra-tabs>
  `)) as LyraTabs;
  const buttons = tabButtons(el);
  expect(buttons.length).to.equal(2);
  expect(buttons[1].getAttribute('aria-disabled')).to.equal('true');
  expect(buttons[1].getAttribute('tabindex')).to.equal('-1');

  let fired = false;
  el.addEventListener('lyra-tabs-change', () => (fired = true));
  buttons[1].click();
  await el.updateComplete;
  expect(fired).to.be.false;
  expect(el.active).to.equal('input');
});

it('active defaults to the first non-disabled tab when the first tab is disabled', async () => {
  const el = (await fixture(html`
    <lyra-tabs>
      <div slot="input" label="Input" disabled>Raw input</div>
      <div slot="preview" label="Preview">Rendered preview</div>
    </lyra-tabs>
  `)) as LyraTabs;
  expect(el.active).to.equal('preview');
});

it('honors an explicit active attribute that points at a valid, enabled tab', async () => {
  const el = (await fixture(html`
    <lyra-tabs active="settings">
      <div slot="input" label="Input">Raw input</div>
      <div slot="preview" label="Preview">Rendered preview</div>
      <div slot="settings" label="Settings">Settings form</div>
    </lyra-tabs>
  `)) as LyraTabs;
  expect(el.active).to.equal('settings');
  expect(panels(el)[2].hidden).to.be.false;
});

it('falls back to the first enabled tab when active points at a disabled or unknown tab', async () => {
  const el = (await fixture(html`
    <lyra-tabs active="preview">
      <div slot="input" label="Input">Raw input</div>
      <div slot="preview" label="Preview" disabled>Rendered preview</div>
      <div slot="settings" label="Settings">Settings form</div>
    </lyra-tabs>
  `)) as LyraTabs;
  expect(el.active).to.equal('input');

  el.active = 'does-not-exist';
  await el.updateComplete;
  expect(el.active).to.equal('input');
});

it('ArrowRight moves focus and selection to the next tab, wrapping from the last back to the first', async () => {
  const el = (await fixture(basic())) as LyraTabs;
  const buttons = tabButtons(el);

  press(buttons[0], 'ArrowRight');
  await el.updateComplete;
  expect(el.active).to.equal('preview');
  expect(el.shadowRoot!.activeElement).to.equal(tabButtons(el)[1]);

  press(tabButtons(el)[1], 'ArrowRight');
  await el.updateComplete;
  expect(el.active).to.equal('settings');

  press(tabButtons(el)[2], 'ArrowRight');
  await el.updateComplete;
  expect(el.active).to.equal('input');
});

it('ArrowLeft moves focus and selection to the previous tab, wrapping from the first to the last', async () => {
  const el = (await fixture(basic())) as LyraTabs;
  press(tabButtons(el)[0], 'ArrowLeft');
  await el.updateComplete;
  expect(el.active).to.equal('settings');
});

it('ArrowRight skips a disabled tab', async () => {
  const el = (await fixture(html`
    <lyra-tabs>
      <div slot="input" label="Input">Raw input</div>
      <div slot="preview" label="Preview" disabled>Rendered preview</div>
      <div slot="settings" label="Settings">Settings form</div>
    </lyra-tabs>
  `)) as LyraTabs;
  press(tabButtons(el)[0], 'ArrowRight');
  await el.updateComplete;
  expect(el.active).to.equal('settings');
});

it('swaps ArrowLeft/ArrowRight under dir="rtl", matching lyra-split/lyra-tree physical-direction handling', async () => {
  const el = (await fixture(html`
    <lyra-tabs dir="rtl">
      <div slot="input" label="Input">Raw input</div>
      <div slot="preview" label="Preview">Rendered preview</div>
      <div slot="settings" label="Settings">Settings form</div>
    </lyra-tabs>
  `)) as LyraTabs;
  const buttons = tabButtons(el);

  press(buttons[0], 'ArrowLeft');
  await el.updateComplete;
  expect(el.active).to.equal('preview');

  press(tabButtons(el)[1], 'ArrowRight');
  await el.updateComplete;
  expect(el.active).to.equal('input');
});

it('Home and End jump to the first and last enabled tabs', async () => {
  const el = (await fixture(basic())) as LyraTabs;
  const buttons = tabButtons(el);

  press(buttons[1], 'End');
  await el.updateComplete;
  expect(el.active).to.equal('settings');

  press(tabButtons(el)[2], 'Home');
  await el.updateComplete;
  expect(el.active).to.equal('input');
});

it('emits lyra-tabs-change on keyboard-driven activation too', async () => {
  const el = (await fixture(basic())) as LyraTabs;
  const listener = oneEvent(el, 'lyra-tabs-change');
  press(tabButtons(el)[0], 'ArrowRight');
  const event = await listener;
  expect((event as CustomEvent<{ tabId: string }>).detail).to.deep.equal({ tabId: 'preview' });
});

it('picks up a tab added dynamically after connect', async () => {
  const el = (await fixture(basic())) as LyraTabs;
  const extra = document.createElement('div');
  extra.setAttribute('slot', 'extra');
  extra.setAttribute('label', 'Extra');
  extra.textContent = 'Extra content';
  el.appendChild(extra);

  await aTimeout(0);
  await el.updateComplete;

  expect(tabButtons(el).map((b) => b.dataset.slot)).to.deep.equal(['input', 'preview', 'settings', 'extra']);
});

it('picks up a disabled attribute toggled on an already-rendered child', async () => {
  const el = (await fixture(basic())) as LyraTabs;
  const child = el.querySelector('[slot="preview"]')!;
  child.setAttribute('disabled', '');

  await aTimeout(0);
  await el.updateComplete;

  const buttons = tabButtons(el);
  expect(buttons[1].getAttribute('aria-disabled')).to.equal('true');
});

it('a mutation on a nested descendant (not a direct child) never forces a tabs recompute', async () => {
  const el = (await fixture(html`
    <lyra-tabs>
      <div slot="input" label="Input"><button disabled>nested</button></div>
      <div slot="preview" label="Preview">Rendered preview</div>
    </lyra-tabs>
  `)) as LyraTabs;
  await el.updateComplete;

  let updateCount = 0;
  const originalUpdated = (el as unknown as { updated: (changed: Map<string, unknown>) => void }).updated.bind(el);
  (el as unknown as { updated: (changed: Map<string, unknown>) => void }).updated = (changed) => {
    updateCount++;
    originalUpdated(changed);
  };

  // Matches attributeFilter (`disabled`) but the button is a grandchild, not
  // a direct child -- a panel is free to churn its own content without the
  // tabs strip resyncing/re-rendering on every unrelated mutation.
  el.querySelector('button')!.removeAttribute('disabled');

  await aTimeout(50);
  expect(updateCount).to.equal(0);
});

it('reassigns active when the currently-active child is removed', async () => {
  const el = (await fixture(basic())) as LyraTabs;
  expect(el.active).to.equal('input');
  el.querySelector('[slot="input"]')!.remove();

  await aTimeout(0);
  await el.updateComplete;

  expect(el.active).to.equal('preview');
  expect(tabButtons(el).length).to.equal(2);
});

it('keeps real keyboard focus on the active tab when a tab BEFORE it is removed', async () => {
  const el = (await fixture(basic())) as LyraTabs;
  tabButtons(el)[1].click();
  await el.updateComplete;
  tabButtons(el)[1].focus();
  expect(el.active).to.equal('preview');
  expect(el.shadowRoot!.activeElement).to.equal(tabButtons(el)[1]);

  el.querySelector('[slot="input"]')!.remove();
  await aTimeout(0);
  await el.updateComplete;

  const focused = el.shadowRoot!.activeElement as HTMLButtonElement | null;
  expect(el.active).to.equal('preview');
  expect(focused?.dataset.slot).to.equal('preview');
  expect(focused?.getAttribute('aria-selected')).to.equal('true');
});

it('does not steal focus by reassigning it when the invalid-active correction happens with focus elsewhere', async () => {
  const el = (await fixture(basic())) as LyraTabs;
  const outside = document.createElement('button');
  document.body.appendChild(outside);
  outside.focus();

  el.querySelector('[slot="input"]')!.remove();

  await aTimeout(0);
  await el.updateComplete;

  expect(el.active).to.equal('preview');
  expect(document.activeElement).to.equal(outside);
  outside.remove();
});

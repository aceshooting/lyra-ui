import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import './node-palette.js';
import type { LyraNodePalette, PaletteItem } from './node-palette.js';
import { FLOW_PALETTE_MIME_TYPE } from '../../data/flow-canvas/flow-canvas.js';

const items: PaletteItem[] = [
  { type: 'http-request', label: 'HTTP Request', category: 'Data', keywords: ['fetch', 'api'] },
  { type: 'transform', label: 'Transform', category: 'Data' },
  { type: 'email', label: 'Send Email', category: 'Actions', disabled: true },
  { type: 'webhook', label: 'Webhook', category: 'Actions' },
];

it('defaults to empty items and label', async () => {
  const el = (await fixture(html`<lr-node-palette></lr-node-palette>`)) as LyraNodePalette;
  expect(el.items).to.deep.equal([]);
  expect(el.label).to.equal('');
});

it('names the listbox via label, with a host aria-label winning over both label and the localized default', async () => {
  const el = (await fixture(html`<lr-node-palette .items=${items}></lr-node-palette>`)) as LyraNodePalette;
  await el.updateComplete;
  const listbox = el.shadowRoot!.querySelector('[role="listbox"]')!;
  expect(listbox.getAttribute('aria-label')).to.equal('Node palette');

  el.label = 'Workflow nodes';
  await el.updateComplete;
  expect(listbox.getAttribute('aria-label')).to.equal('Workflow nodes');

  el.setAttribute('aria-label', 'Automation blocks');
  await el.updateComplete;
  expect(el.accessibleLabel).to.equal('Automation blocks');
  expect(listbox.getAttribute('aria-label')).to.equal('Automation blocks');
});

it('renders one item per entry, grouped by category in first-appearance order', async () => {
  const el = (await fixture(html`<lr-node-palette .items=${items}></lr-node-palette>`)) as LyraNodePalette;
  await el.updateComplete;
  const headers = el.shadowRoot!.querySelectorAll('[part="group-header"]');
  expect(Array.from(headers).map((h) => h.textContent)).to.deep.equal(['Data', 'Actions']);
  expect(el.shadowRoot!.querySelectorAll('[part="item"]').length).to.equal(4);
});

it('filters on label, keywords, and category, case-folded', async () => {
  const el = (await fixture(html`<lr-node-palette .items=${items}></lr-node-palette>`)) as LyraNodePalette;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
  input.value = 'API';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await el.updateComplete;
  const labels = Array.from(el.shadowRoot!.querySelectorAll('[part="item-label"]')).map((n) => n.textContent);
  expect(labels).to.deep.equal(['HTTP Request']);
});

it('renders nodePaletteEmpty when the filter matches nothing', async () => {
  const el = (await fixture(html`<lr-node-palette .items=${items}></lr-node-palette>`)) as LyraNodePalette;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
  input.value = 'nonexistent';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="empty"]')!.textContent).to.equal('No matching nodes.');
});

it('ArrowDown from the search field moves real DOM focus to the first enabled item', async () => {
  const el = (await fixture(html`<lr-node-palette .items=${items}></lr-node-palette>`)) as LyraNodePalette;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await waitUntil(() => el.shadowRoot!.activeElement?.getAttribute('part') === 'item');
  expect((el.shadowRoot!.activeElement as HTMLElement).textContent).to.include('HTTP Request');
});

it('ArrowUp from the first item returns focus to the search field', async () => {
  const el = (await fixture(html`<lr-node-palette .items=${items}></lr-node-palette>`)) as LyraNodePalette;
  await el.updateComplete;
  const firstItem = el.shadowRoot!.querySelector('[part="item"]') as HTMLElement;
  firstItem.focus();
  firstItem.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
  expect(el.shadowRoot!.activeElement).to.equal(el.shadowRoot!.querySelector('input'));
});

it('Enter on an item emits lr-palette-place and lr-select with the same type/item', async () => {
  const el = (await fixture(html`<lr-node-palette .items=${items}></lr-node-palette>`)) as LyraNodePalette;
  await el.updateComplete;
  let placeDetail: { type: string } | undefined;
  let selectDetail: { item: PaletteItem } | undefined;
  el.addEventListener('lr-palette-place', (e) => (placeDetail = (e as CustomEvent).detail));
  el.addEventListener('lr-select', (e) => (selectDetail = (e as CustomEvent).detail));
  (el.shadowRoot!.querySelector('[part="item"]') as HTMLElement).dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
  );
  expect(placeDetail).to.deep.equal({ type: 'http-request' });
  expect(selectDetail?.item.type).to.equal('http-request');
});

it('click on an item emits the same pair of events', async () => {
  const el = (await fixture(html`<lr-node-palette .items=${items}></lr-node-palette>`)) as LyraNodePalette;
  await el.updateComplete;
  let fired = false;
  el.addEventListener('lr-palette-place', () => (fired = true));
  (el.shadowRoot!.querySelector('[part="item"]') as HTMLElement).click();
  expect(fired).to.be.true;
});

it('a disabled item is not draggable, not roving-focusable, and does not place on click', async () => {
  const el = (await fixture(html`<lr-node-palette .items=${items}></lr-node-palette>`)) as LyraNodePalette;
  await el.updateComplete;
  const disabledItem = el.shadowRoot!.querySelectorAll('[part="item"]')[2] as HTMLElement; // "Send Email"
  expect(disabledItem.getAttribute('draggable')).to.equal('false');
  expect(disabledItem.getAttribute('tabindex')).to.equal('-1');
  let fired = false;
  el.addEventListener('lr-palette-place', () => (fired = true));
  disabledItem.click();
  expect(fired).to.be.false;
});

it('dragstart on an enabled item writes the FLOW_PALETTE_MIME_TYPE payload plus a text/plain fallback', async () => {
  const el = (await fixture(html`<lr-node-palette .items=${items}></lr-node-palette>`)) as LyraNodePalette;
  await el.updateComplete;
  const item = el.shadowRoot!.querySelector('[part="item"]') as HTMLElement;
  const dataTransfer = new DataTransfer();
  item.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer }));
  expect(JSON.parse(dataTransfer.getData(FLOW_PALETTE_MIME_TYPE))).to.deep.equal({ type: 'http-request' });
  expect(dataTransfer.getData('text/plain')).to.equal('HTTP Request');
  // effectAllowed isn't asserted here: Chromium silently discards writes to it for a synthetic
  // (non-native) DragEvent dispatch, unlike setData/getData which work fine -- an environment
  // limitation of testing HTML5 DnD via dispatchEvent(), not something the implementation controls.
});

it('every item carries the sr-only drag hint via aria-describedby', async () => {
  const el = (await fixture(html`<lr-node-palette .items=${items}></lr-node-palette>`)) as LyraNodePalette;
  await el.updateComplete;
  const item = el.shadowRoot!.querySelector('[part="item"]') as HTMLElement;
  const hintId = item.getAttribute('aria-describedby')!;
  expect(el.shadowRoot!.getElementById(hintId)!.textContent).to.equal('Drag to the canvas, or press Enter to place');
});

it('dims a disabled item through the shared disabled-opacity token', async () => {
  const wrapper = (await fixture(
    html`<div style="--lr-theme-opacity-disabled: 0.25">
      <lr-node-palette .items=${items}></lr-node-palette>
    </div>`,
  )) as HTMLElement;
  const el = wrapper.querySelector('lr-node-palette') as LyraNodePalette;
  await el.updateComplete;
  const disabledItem = el.shadowRoot!.querySelectorAll('[part="item"]')[2] as HTMLElement;
  expect(disabledItem.getAttribute('aria-disabled')).to.equal('true');
  expect(getComputedStyle(disabledItem).opacity).to.equal('0.25');
});

it('is accessible with items, groups, and a disabled item', async () => {
  const el = (await fixture(html`<lr-node-palette .items=${items}></lr-node-palette>`)) as LyraNodePalette;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

import { fixture, expect, html, waitUntil, oneEvent } from '@open-wc/testing';
import { LitElement, type PropertyValues } from 'lit';
import './node-palette.js';
import type { LyraNodePalette, PaletteItem } from './node-palette.js';
import { FLOW_PALETTE_MIME_TYPE } from '../../data/flow-canvas/flow-canvas.js';
import { styles } from './node-palette.styles.js';

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
  const groups = [...el.shadowRoot!.querySelectorAll('[role="group"]')];
  expect(groups.length).to.equal(2);
  expect(groups[0]!.getAttribute('aria-labelledby')).to.equal(headers[0]!.id);
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
  // Deriving safe primitives (tagName + part attribute) instead of comparing DOM Element
  // references directly -- a direct `.to.equal()` of two live nodes would, on a future
  // regression where focus lands somewhere else, throw DataCloneError while
  // @web/test-runner-mocha serializes the failure via structuredClone, silently hanging the
  // whole test session instead of failing this one assertion normally.
  expect(el.shadowRoot!.activeElement?.tagName).to.equal('INPUT');
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('search');
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
  expect(disabledItem.hasAttribute('aria-describedby')).to.be.false;
  let fired = false;
  el.addEventListener('lr-palette-place', () => (fired = true));
  disabledItem.click();
  expect(fired).to.be.false;
});

it('steps over disabled rows when moving focus through the enabled roving list', async () => {
  const el = (await fixture(html`<lr-node-palette .items=${items}></lr-node-palette>`)) as LyraNodePalette;
  const second = el.shadowRoot!.querySelectorAll<HTMLElement>('[part="item"]')[1]!;
  second.focus();
  second.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement?.textContent).to.contain('Webhook');
});

it('hides arbitrary item icons from the accessible name', async () => {
  const el = (await fixture(
    html`<lr-node-palette .items=${[{ type: 'x', label: 'Node', icon: html`Icon text` }]}></lr-node-palette>`,
  )) as LyraNodePalette;
  expect(el.shadowRoot!.querySelector('[part="item-icon"]')!.getAttribute('aria-hidden')).to.equal('true');
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

it('keeps the search and compact item at the live hit-area token override', async () => {
  const el = (await fixture(
    html`<lr-node-palette
      style="--lr-icon-button-size: 52px; inline-size: 32px"
      .items=${[{ type: 'x', label: 'X' }]}
    ></lr-node-palette>`,
  )) as LyraNodePalette;
  for (const part of ['search', 'item']) {
    const target = el.shadowRoot!.querySelector(`[part="${part}"]`) as HTMLElement;
    const bounds = target.getBoundingClientRect();
    expect(bounds.width, part).to.be.at.least(52);
    expect(bounds.height, part).to.be.at.least(52);
  }
});

it('chains updated() to super.updated() so a mixin layered under LyraElement would still run', async () => {
  // No shared mixin actually overrides updated() today, so the only way to prove the chain is
  // live (rather than grepping source text for the call) is to patch the base-class hook itself
  // -- the exact hook a future mixin would extend -- and confirm it actually fires. Same pattern
  // as branch-picker.test.ts's identical check.
  const hadOwn = Object.prototype.hasOwnProperty.call(LitElement.prototype, 'updated');
  const original = (LitElement.prototype as unknown as { updated?: (changed: PropertyValues) => void }).updated;
  let called = false;
  (LitElement.prototype as unknown as { updated: (changed: PropertyValues) => void }).updated = function (
    this: LitElement,
    changed: PropertyValues,
  ) {
    called = true;
    original?.call(this, changed);
  };
  try {
    const el = (await fixture(html`<lr-node-palette></lr-node-palette>`)) as LyraNodePalette;
    await el.updateComplete;
    expect(called).to.be.true;
  } finally {
    if (hadOwn) {
      (LitElement.prototype as unknown as { updated: unknown }).updated = original;
    } else {
      delete (LitElement.prototype as unknown as { updated?: unknown }).updated;
    }
  }
});

describe('localization', () => {
  it('localizes the search field, listbox, empty state, and drag hint via .strings', async () => {
    const el = (await fixture(html`
      <lr-node-palette
        .strings=${{
          search: 'Rechercher',
          nodePalettePlaceholder: 'Rechercher des nœuds…',
          nodePaletteLabel: 'Palette de nœuds',
          nodePaletteEmpty: 'Aucun nœud correspondant.',
          nodePaletteDragHint: 'Faites glisser vers le canevas, ou appuyez sur Entrée',
        }}
      ></lr-node-palette>
    `)) as LyraNodePalette;
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
    expect(input.getAttribute('aria-label')).to.equal('Rechercher');
    expect(input.getAttribute('placeholder')).to.equal('Rechercher des nœuds…');
    expect(el.shadowRoot!.querySelector('[role="listbox"]')!.getAttribute('aria-label')).to.equal('Palette de nœuds');
    expect(el.shadowRoot!.querySelector('[part="empty"]')!.textContent).to.equal('Aucun nœud correspondant.');
    expect(el.shadowRoot!.querySelector('span.sr-only')!.textContent).to.equal(
      'Faites glisser vers le canevas, ou appuyez sur Entrée',
    );
  });

  it('recomputes locale-aware search matches when the effective locale changes', async () => {
    const el = (await fixture(
      html`<lr-node-palette
        locale="en"
        .items=${[{ type: 'city', label: 'İzmir' }]}
      ></lr-node-palette>`,
    )) as LyraNodePalette;
    const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
    input.value = 'iz';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="item"]')).to.have.length(0);

    el.locale = 'tr';
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="item"]')).to.have.length(1);
    expect(el.shadowRoot!.querySelector('[part="item-label"]')!.textContent).to.equal('İzmir');
  });
});

it('is accessible with items, groups, and a disabled item', async () => {
  const el = (await fixture(html`<lr-node-palette .items=${items}></lr-node-palette>`)) as LyraNodePalette;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('never announces the initial item count on mount, but does announce a later filter change', async () => {
  const el = (await fixture(html`<lr-node-palette .items=${items}></lr-node-palette>`)) as LyraNodePalette;
  await el.updateComplete;
  const liveRegionText = () => el.shadowRoot!.querySelector('[part="live-region"]')!.textContent ?? '';
  expect(liveRegionText()).to.equal('');
  // Real timer, margined past the Announcer's default 500ms throttle -- long enough for a
  // regression that re-introduces an unguarded mount announcement to actually flush and fail
  // this assertion, per this repo's "no fake timers under wtr" testing convention.
  await new Promise((r) => setTimeout(r, 600));
  expect(liveRegionText()).to.equal('');

  const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
  input.value = 'API';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await el.updateComplete;
  await new Promise((r) => setTimeout(r, 600));
  expect(liveRegionText()).to.include('1');
});

it('localizes the whole filtered-result announcement and formats its count with the effective locale', async () => {
  const el = (await fixture(html`
    <lr-node-palette
      lang="ar-u-nu-arab"
      .items=${items}
      .strings=${{
        nodePaletteResultCount: '{count} نتيجة',
        nodePaletteResultCountPlural: '{count} نتائج',
      }}
    ></lr-node-palette>
  `)) as LyraNodePalette;
  await el.updateComplete;

  const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
  input.value = 'Data';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await el.updateComplete;
  await new Promise((r) => setTimeout(r, 600));

  expect(el.shadowRoot!.querySelector('[part="live-region"]')!.textContent).to.equal('٢ نتائج');
});

it('gives the search field a focus-visible ring and resets the native search-cancel glyph', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/\[part='search'\]:focus-visible\s*\{[^}]*outline:/);
  expect(css).to.match(/\[part='search'\]::-webkit-search-cancel-button/);
});

it("renders the search field's ::placeholder in the shared quiet-text token's color instead of the UA default", async () => {
  const el = (await fixture(
    html`<lr-node-palette style="--lr-color-text-quiet: rgb(12, 34, 56)"></lr-node-palette>`,
  )) as LyraNodePalette;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector('[part="search"]') as HTMLInputElement;
  expect(getComputedStyle(input, '::placeholder').color).to.equal('rgb(12, 34, 56)');
});

it('bridges the search field\'s native focus/blur across the shadow boundary as lr-node-palette focus/blur', async () => {
  const el = (await fixture(html`<lr-node-palette .items=${items}></lr-node-palette>`)) as LyraNodePalette;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
  const focusListener = oneEvent(el, 'focus');
  input.dispatchEvent(new FocusEvent('focus'));
  await focusListener;
  const blurListener = oneEvent(el, 'blur');
  input.dispatchEvent(new FocusEvent('blur'));
  await blurListener;
});

it("wraps the item hover/focus-visible rule in :where() so a consumer's ::part(item):hover wins without !important", async () => {
  const el = (await fixture(html`<lr-node-palette .items=${items}></lr-node-palette>`)) as LyraNodePalette;
  // jsdom/browser test runners don't synthesize a real :hover pseudo-class from a dispatched
  // event, so assert via the internal rule's specificity instead -- a :where()-wrapped selector
  // has the same *matching* semantics as the unwrapped form but zero specificity contribution
  // from the wrapped parts, so it loses (rather than beats) a consumer's own
  // `::part(item):hover` override. Same technique as attachment-trigger.test.ts's identical
  // "trigger-button hover specificity" check.
  // Chromium's CSSOM normalizes attribute-selector quoting to double quotes in cssText, unlike
  // the single-quoted form the source stylesheet is authored with.
  const internalRule = (el.shadowRoot!.adoptedStyleSheets ?? [])
    .flatMap((sheet) => Array.from(sheet.cssRules))
    .map((rule) => rule.cssText)
    .find((text) => text.includes(':hover') && text.includes('[part="item"]') && text.includes('background'));
  expect(internalRule?.includes(':where(')).to.be.true;
});

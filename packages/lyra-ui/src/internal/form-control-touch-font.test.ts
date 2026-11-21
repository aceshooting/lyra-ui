import { expect, fixture, html } from '@open-wc/testing';
import type { LitElement } from 'lit';
import { tag } from './prefix.js';
import { forceCoarsePointer } from '../../test/coarse-pointer-media.js';
import '../components/lr-input.js';
import '../components/lr-number-input.js';
import '../components/lr-textarea.js';
import '../components/lr-select.js';
import '../components/lr-combobox.js';
import '../components/lr-date-input.js';
import '../components/lr-phone-input.js';
import '../components/lr-token-input.js';
import '../components/lr-otp-input.js';
import '../components/lr-color-picker.js';
import '../components/lr-emoji-picker.js';
import '../components/lr-pagination.js';
import '../components/lr-data-grid.js';
import '../components/lr-table.js';
import '../components/lr-command-palette.js';

/** Each text-entry control and the native surface whose computed size mobile Safari reads. */
const SURFACES = [
  ['input', '[part="input"]'],
  ['number-input', '[part="input"]'],
  ['textarea', '[part="textarea"]'],
  ['select', '[part="trigger"]'],
  ['combobox', '[part="combobox-input"]'],
  ['date-input', '[part="input"]'],
  ['phone-input', '[part="input"]'],
  ['token-input', '[part="input"]'],
  ['otp-input', '[part="control"]'],
  ['color-picker', '[part~="input"]'],
  ['emoji-picker', '[part="search"]'],
  ['pagination', '[part="page-input"]'],
  ['pagination', '[part="page-size"]'],
  ['data-grid', '[part="search"]'],
  ['data-grid', '[part="page-size"]'],
  ['table', '[part="filter"]'],
  ['command-palette', '[part="input"]'],
] as const;

/** Per-host setup that renders the surface (data views and the palette render it on demand). */
const SETUP: Partial<Record<string, (el: LitElement & Record<string, unknown>) => void>> = {
  pagination: (el) => {
    Object.assign(el, { format: 'compact', total: 200, pageSizeOptions: [10, 20] });
    el.style.setProperty('--lr-pagination-font-size', '12px');
  },
  'data-grid': (el) => Object.assign(el, {
    label: 'Rows', withSearch: true, paginate: true, columns: [{ field: 'name', label: 'Name' }], rows: [{ name: 'A' }],
  }),
  table: (el) => Object.assign(el, {
    filterable: true, columns: [{ key: 'name', label: 'Name', cell: (r: { name: string }) => r.name }], rows: [{ name: 'A' }],
  }),
  'command-palette': (el) => Object.assign(el, { open: true }),
};

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

async function mount(name: string, size = 's'): Promise<LitElement> {
  const container = await fixture<HTMLDivElement>(html`<div></div>`);
  const el = document.createElement(tag(name)) as LitElement;
  if (!(name in SETUP)) el.setAttribute('size', size);
  // Surfaces that inherit their size (otp-input, emoji-picker) read the page font, so start small.
  el.style.fontSize = '12px';
  if (name === 'color-picker') el.setAttribute('inline', '');
  if (name === 'table' || name === 'data-grid') el.setAttribute('aria-label', 'Rows');
  SETUP[name]?.(el as LitElement & Record<string, unknown>);
  container.append(el);
  await el.updateComplete;
  return el;
}

function fontSize(el: LitElement, selector: string): number {
  const surface = el.shadowRoot!.querySelector(selector);
  expect(surface, `${el.localName} ${selector}`).to.exist;
  return parseFloat(getComputedStyle(surface!).fontSize);
}

for (const [name, selector] of SURFACES) {
  it(`${name} ${selector} floors its editable surface at 16px under a coarse pointer only`, async () => {
    const el = await mount(name);
    const fine = fontSize(el, selector);
    expect(fine, 'fine pointer keeps the authored size').to.be.below(16);
    const restore = forceCoarsePointer(el);
    try {
      await frame();
      expect(fontSize(el, selector)).to.equal(16);
      el.style.setProperty('--lr-form-control-touch-font-size-min', '0px');
      await frame();
      expect(fontSize(el, selector), 'a 0px floor restores the authored size').to.equal(fine);
      el.style.setProperty('--lr-form-control-touch-font-size-min', '20px');
      await frame();
      expect(fontSize(el, selector)).to.equal(20);
    } finally {
      restore();
    }
  });
}

it('keeps an authored size above the floor under a coarse pointer', async () => {
  const el = await mount('input', 'm');
  el.style.setProperty('--lr-input-font-size', '1.5rem');
  const restore = forceCoarsePointer(el);
  try {
    await frame();
    expect(fontSize(el, '[part="input"]')).to.equal(24);
  } finally {
    restore();
  }
});

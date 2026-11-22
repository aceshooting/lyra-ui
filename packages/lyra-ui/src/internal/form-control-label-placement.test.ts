import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LitElement } from 'lit';
import { tag } from './prefix.js';
import { expectDevWarning } from '../../test/expected-dev-warnings.js';
import '../components/lr-input.js';
import '../components/lr-textarea.js';
import '../components/lr-select.js';
import '../components/lr-option.js';
import '../components/lr-combobox.js';
import '../components/lr-date-input.js';
import '../components/lr-time-input.js';
import '../components/lr-phone-input.js';
import '../components/lr-token-input.js';
import '../components/lr-locale-picker.js';
import '../components/lr-code-editor.js';
import '../components/lr-otp-input.js';
import '../components/lr-signature-pad.js';
import '../components/lr-country-picker.js';
import '../components/lr-currency-picker.js';
import '../components/lr-time-zone-picker.js';
import '../components/lr-unit-picker.js';
import '../components/lr-model-select.js';
import '../components/lr-voice-picker.js';
import '../components/lr-color-picker.js';

const NAMES = [
  'input', 'textarea', 'select', 'combobox', 'date-input', 'time-input', 'phone-input', 'token-input',
  'locale-picker', 'code-editor', 'otp-input', 'signature-pad', 'country-picker', 'currency-picker',
  'time-zone-picker', 'unit-picker', 'model-select', 'voice-picker', 'color-picker',
] as const;

type Placed = LitElement & { labelPlacement: string };

/** Per-control attributes that keep the fixture free of optional peers (no flag resolver here). */
const EXTRA_ATTRIBUTES: Partial<Record<string, Record<string, string>>> = {
  'locale-picker': { 'without-flags': '' },
};

/** The shadow root holding `[part~="form-control"]`: the host's own, or, for a control that
 *  composes an inner field (the catalog pickers), that field's. */
async function controlRoot(el: Placed): Promise<ShadowRoot> {
  const own = el.shadowRoot!;
  if (own.querySelector('[part~="form-control"]')) return own;
  const inner = [...own.querySelectorAll<LitElement>('*')]
    .find((node) => node.shadowRoot?.querySelector('[part~="form-control"]'))!;
  await inner.updateComplete;
  expect(inner.getAttribute('label-placement'), 'forwarded to the inner field').to.equal(el.getAttribute('label-placement'));
  return inner.shadowRoot!;
}

async function mount(name: string, width: number, dir: 'ltr' | 'rtl' = 'ltr', placement = 'start', setup?: (el: Placed) => void) {
  const wrapper = await fixture<HTMLDivElement>(html`<div dir=${dir} style="inline-size: ${width}px"></div>`);
  const el = document.createElement(tag(name)) as Placed;
  el.setAttribute('label', 'Shipping reference');
  el.setAttribute('hint', 'As printed on the label');
  if (placement) el.setAttribute('label-placement', placement);
  for (const [attribute, value] of Object.entries(EXTRA_ATTRIBUTES[name] ?? {})) el.setAttribute(attribute, value);
  setup?.(el);
  wrapper.append(el);
  await el.updateComplete;
  const root = await controlRoot(el);
  const control = root.querySelector<HTMLElement>('[part~="form-control"]')!;
  const label = root.querySelector<HTMLElement>('[part~="form-control-label"]')!.getBoundingClientRect();
  const field = [...control.children]
    .filter((child) => !child.matches('[part~="form-control-label"], [part~="hint"], [part~="error"], [data-form-control-row]'))
    .map((child) => child.getBoundingClientRect())
    .find((rect) => rect.width > 1 && rect.height > 1)!;
  const hint = root.querySelector<HTMLElement>('[part~="hint"]')!;
  return { el, root, control, label, field, hintStart: contentStart(hint, dir) };
}

/** Inline-start edge of a row's content box, past its inline-start padding. */
function contentStart(row: HTMLElement, dir: 'ltr' | 'rtl'): number {
  return row.getBoundingClientRect()[dir === 'ltr' ? 'left' : 'right'] +
    (dir === 'ltr' ? 1 : -1) * parseFloat(getComputedStyle(row).paddingInlineStart);
}

for (const name of NAMES) {
  it(`${name} places the label in an inline-start column with the hint under the field, in LTR and RTL`, async () => {
    for (const dir of ['ltr', 'rtl'] as const) {
      const { el, label, field, hintStart } = await mount(name, 640, dir);
      expect(el.labelPlacement, `${dir} property`).to.equal('start');
      if (dir === 'ltr') expect(label.right, 'label before the field').to.be.at.most(field.left);
      else expect(label.left, 'label before the field (RTL)').to.be.at.least(field.right);
      expect(label.top, 'same row').to.be.below(field.bottom);
      expect(Math.abs(hintStart - (dir === 'ltr' ? field.left : field.right)), `${dir} hint aligned`).to.be.below(1);
      await expect(el).to.be.accessible();
    }
  });

  it(`${name} returns the label above the field in a narrow allocation and by default`, async () => {
    for (const [width, placement] of [[280, 'start'], [640, '']] as const) {
      const { el, label, field } = await mount(name, width, 'ltr', placement);
      expect(label.bottom, `${width}px ${placement || 'default'}`).to.be.at.most(field.top);
      expect(el.labelPlacement).to.equal(placement || 'top');
    }
  });
}

/** Inline extent of the label's own text, and how many lines it wraps onto. */
function labelText(root: ShadowRoot): { width: number; lines: number } {
  const range = document.createRange();
  range.selectNodeContents(root.querySelector('[part~="form-control-label"]')!);
  const rects = [...range.getClientRects()].filter((rect) => rect.width > 0);
  return { width: range.getBoundingClientRect().width, lines: new Set(rects.map((rect) => Math.round(rect.top))).size };
}

it('every control sizes a content-sized start column (auto) to the label text, and still collapses when narrow', async () => {
  const long = 'Preferred shipping reference number';
  for (const name of NAMES) {
    const auto = (el: Placed) => {
      el.setAttribute('label', long);
      el.style.setProperty('--lr-form-control-label-inline-size', 'auto');
    };
    const { root, control, label, field } = await mount(name, 640, 'ltr', 'start', auto);
    const text = labelText(root);
    const padding = parseFloat(getComputedStyle(root.querySelector('[part~="form-control-label"]')!).paddingInlineStart) +
      parseFloat(getComputedStyle(root.querySelector('[part~="form-control-label"]')!).paddingInlineEnd);
    expect(text.lines, `${name}: one line`).to.equal(1);
    expect(label.width, `${name}: wider than the 30% column`).to.be.above(640 * 0.3);
    expect(Math.abs(label.width - text.width - padding), `${name}: column fits the text`).to.be.below(1.5);
    expect(Math.abs(field.left - label.right - parseFloat(getComputedStyle(control).columnGap)), `${name}: field follows the gap`).to.be.below(1);
    const narrow = await mount(name, 280, 'ltr', 'start', auto);
    expect(narrow.label.bottom, `${name}: collapses above the field`).to.be.at.most(narrow.field.top);
  }
});

it('every control spaces a label above the field by --lr-form-control-label-gap', async () => {
  for (const name of NAMES) {
    for (const gap of [13, 29]) {
      const { label, field } = await mount(name, 640, 'ltr', '', (el) => el.style.setProperty('--lr-form-control-label-gap', `${gap}px`));
      expect(field.top - label.bottom, `${name} ${gap}px`).to.be.closeTo(gap, 0.75);
    }
  }
});

it('every control keeps the hint under the field when the start label is hidden or absent', async () => {
  for (const name of NAMES) {
    for (const hide of ['label-display', 'no-label'] as const) {
      // lr-color-picker has no label-display member.
      if (hide === 'label-display' && name === 'color-picker') continue;
      const { field, hintStart } = await mount(name, 640, 'ltr', 'start', (el) => {
        if (hide === 'label-display') el.setAttribute('label-display', 'hidden');
        else el.removeAttribute('label');
      });
      expect(Math.abs(hintStart - field.left), `${name} ${hide}: hint starts with the field`).to.be.below(1);
    }
  }
});

it('aligns a start label with the first line of a tall field instead of centring it', async () => {
  /** Block centre of the label's text line, past its top padding. */
  const textMiddle = (root: ShadowRoot, label: DOMRect) => {
    const top = label.top + parseFloat(getComputedStyle(root.querySelector('[part~="form-control-label"]')!).paddingBlockStart);
    return (top + label.bottom) / 2;
  };
  for (const name of ['textarea', 'code-editor', 'signature-pad'] as const) {
    const { root, label, field } = await mount(name, 640, 'ltr', 'start', (el) => {
      if (name === 'textarea') el.setAttribute('rows', '8');
    });
    expect(field.height, `${name} is tall`).to.be.above(label.height * 3);
    expect(textMiddle(root, label) - field.top, `${name} label near the top`).to.be.below(field.height / 4);
  }
  const { root, label, field } = await mount('input', 640);
  expect(Math.abs(textMiddle(root, label) - (field.top + field.bottom) / 2), 'single-line field stays level').to.be.below(1.5);
});

/** A status row (`data-form-control-row`) spans the wrapper and starts its text under the field. */
function expectFullRowUnderField(row: HTMLElement, control: HTMLElement, field: DOMRect): void {
  const rect = row.getBoundingClientRect();
  expect(Math.abs(rect.width - control.getBoundingClientRect().width), 'full row').to.be.below(1);
  expect(Math.abs(contentStart(row, 'ltr') - field.left), 'aligned under the field').to.be.below(1);
}

it('model-select wraps its catalog-limit notice into a full row instead of a column', async () => {
  expectDevWarning('lyra-collection-truncated:lr-model-select:catalog');
  const { root, control, field } = await mount('model-select', 640, 'ltr', 'start', (el) => {
    (el as Placed & { catalog: unknown[] }).catalog = Array.from({ length: 2000 }, (_, i) => ({ id: `id${i}`, label: `Row ${i}` }));
  });
  expectFullRowUnderField(root.querySelector<HTMLElement>('[part="limit"]')!, control, field);
});

it('locale-picker wraps its load status into a full row under the field', async () => {
  const { el, root, control, field } = await mount('locale-picker', 640, 'ltr', 'start', (picker) => {
    Object.assign(picker, { open: true, locale: 'en', value: 'en', locales: ['en', 'fr'] });
  });
  (el as Placed & { localeLoader: () => Promise<void> }).localeLoader = () => new Promise<void>(() => {});
  root.querySelector<HTMLElement>('[part="option"][data-value="fr"]')!.click();
  await waitUntil(() => root.querySelector('[part="load-status"]'));
  expectFullRowUnderField(root.querySelector<HTMLElement>('[part="load-status"]')!, control, field);
});

import { expect, fixture, html } from '@open-wc/testing';
import { unsafeStatic, html as staticHtml } from 'lit/static-html.js';
import { focusAfterPointer, focusByKeyboard } from '../../../../test/wtr-focus.js';
import '../../lr-input.js';
import '../../lr-number-input.js';
import '../../lr-time-input.js';
import '../../lr-textarea.js';
import '../../lr-select.js';
import '../../lr-combobox.js';
import '../../lr-date-input.js';
import '../../lr-phone-input.js';
import '../../lr-token-input.js';
import '../../lr-locale-picker.js';

type Field = HTMLElement & { updateComplete: Promise<unknown>; reportValidity(): boolean };

/** Every field-shaped control: the bordered surface and the element that takes focus. */
const FIELDS = [
  { tag: 'lr-input', surface: '[part~="input-wrapper"]', focus: '[part="input"]' },
  { tag: 'lr-number-input', surface: '[part~="input-wrapper"]', focus: '[part="input"]' },
  { tag: 'lr-time-input', surface: '[part~="time-input"]', focus: '[part="segment"]' },
  { tag: 'lr-textarea', surface: '[part~="textarea"]', focus: '[part="textarea"]' },
  { tag: 'lr-select', surface: '[part="trigger"]', focus: '[part="trigger"]' },
  { tag: 'lr-combobox', surface: '[part~="combobox"]', focus: '[part~="combobox-input"]' },
  { tag: 'lr-date-input', surface: '[part~="input-wrapper"]', focus: '[part="input"]' },
  { tag: 'lr-phone-input', surface: '[part~="input-wrapper"]', focus: '[part="input"]' },
  { tag: 'lr-token-input', surface: '[part~="input-wrapper"]', focus: '[part="input"]' },
  { tag: 'lr-locale-picker', surface: '[part="trigger"]', focus: '[part="trigger"]' },
] as const;

const markup = (tag: string) =>
  tag === 'lr-locale-picker'
    ? staticHtml`<${unsafeStatic(tag)} required without-flags label="Field"></${unsafeStatic(tag)}>`
    : staticHtml`<${unsafeStatic(tag)} required label="Field"></${unsafeStatic(tag)}>`;

async function invalidField(tag: string, wrapperStyle = ''): Promise<{ el: Field; away: HTMLElement }> {
  const root = await fixture<HTMLElement>(html`
    <div data-lr-theme-scope style="--lr-transition-fast: 0s; ${wrapperStyle}">
      ${markup(tag)}
      <button type="button">Away</button>
      <span style="color: var(--lr-color-danger)">reference</span>
    </div>
  `);
  const el = root.querySelector<Field>(tag)!;
  await el.updateComplete;
  el.reportValidity();
  await focusAfterPointer(root.querySelector('button')!);
  await el.updateComplete;
  return { el, away: root.querySelector('span')! };
}

const border = (el: HTMLElement, selector: string) =>
  getComputedStyle(el.shadowRoot!.querySelector(selector)!).borderTopColor;

describe('field-shaped controls paint the shared invalid border', () => {
  it('paints the danger edge on every field once it is user-invalid', async () => {
    const paints: string[] = [];
    let danger = '';
    for (const field of FIELDS) {
      const { el, away } = await invalidField(field.tag);
      danger = getComputedStyle(away).color;
      paints.push(`${field.tag}: ${border(el, field.surface)}`);
    }
    expect(paints).to.deep.equal(FIELDS.map((field) => `${field.tag}: ${danger}`));
  });

  it('honours --lr-form-control-invalid-border-color from an ancestor on every field', async () => {
    const paints: string[] = [];
    for (const field of FIELDS) {
      const { el } = await invalidField(field.tag, '--lr-form-control-invalid-border-color: rgb(1, 2, 3);');
      paints.push(`${field.tag}: ${border(el, field.surface)}`);
    }
    expect(paints).to.deep.equal(FIELDS.map((field) => `${field.tag}: rgb(1, 2, 3)`));
  });

  it('yields the invalid edge to the focus edge while the field holds focus', async () => {
    const paints: string[] = [];
    for (const field of FIELDS) {
      const { el } = await invalidField(field.tag, '--lr-form-control-invalid-border-color: rgb(1, 2, 3);');
      await focusByKeyboard(el.shadowRoot!.querySelector<HTMLElement>(field.focus)!);
      await el.updateComplete;
      paints.push(`${field.tag}: ${border(el, field.surface) === 'rgb(1, 2, 3)'}`);
    }
    expect(paints).to.deep.equal(FIELDS.map((field) => `${field.tag}: false`));
  });

  it('keeps a pristine required field on its resting edge', async () => {
    const paints: string[] = [];
    for (const field of FIELDS) {
      const root = await fixture<HTMLElement>(html`
        <div style="--lr-form-control-invalid-border-color: rgb(1, 2, 3)">
          ${markup(field.tag)}
        </div>
      `);
      const el = root.querySelector<Field>(field.tag)!;
      await el.updateComplete;
      paints.push(`${field.tag}: ${border(el, field.surface) === 'rgb(1, 2, 3)'}`);
    }
    expect(paints).to.deep.equal(FIELDS.map((field) => `${field.tag}: false`));
  });
});

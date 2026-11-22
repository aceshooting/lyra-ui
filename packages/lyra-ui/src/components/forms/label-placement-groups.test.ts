import { expect, fixture, html } from '@open-wc/testing';
import type { LitElement } from 'lit';
import '../lr-slider.js';
import '../lr-radio-group.js';
import '../lr-radio.js';
import '../lr-checkbox-group.js';
import '../lr-checkbox.js';
import '../lr-input.js';
import '../lr-number-input.js';
import '../lr-locale-picker.js';

type Placed = LitElement & { labelPlacement: string };

const MARKUP: Record<string, (placement: string) => ReturnType<typeof html>> = {
  slider: (placement) => html`<lr-slider label="Volume" hint="Master level" label-placement=${placement} value="40"></lr-slider>`,
  'radio-group': (placement) => html`<lr-radio-group label="Volume" hint="Master level" label-placement=${placement}>
      <lr-radio value="a">A</lr-radio><lr-radio value="b">B</lr-radio></lr-radio-group>`,
  'checkbox-group': (placement) => html`<lr-checkbox-group label="Volume" hint="Master level" label-placement=${placement}>
      <lr-checkbox value="a">A</lr-checkbox><lr-checkbox value="b">B</lr-checkbox></lr-checkbox-group>`,
};

const PARTS: Record<string, { label: string; field: string }> = {
  slider: { label: '[part~="label"]', field: '[part~="base"]' },
  'radio-group': { label: '[part~="form-control-label"]', field: '[part~="radios"]' },
  'checkbox-group': { label: '[part~="form-control-label"]', field: '[part~="options"]' },
};

async function mount(name: string, width: number, dir: 'ltr' | 'rtl', placement: string) {
  const wrapper = await fixture<HTMLDivElement>(html`<div dir=${dir} style="inline-size: ${width}px"></div>`);
  const host = await fixture<Placed>(MARKUP[name]!(placement), { parentNode: wrapper });
  await host.updateComplete;
  const root = host.shadowRoot!;
  const label = root.querySelector(PARTS[name]!.label)!.getBoundingClientRect();
  const field = root.querySelector(PARTS[name]!.field)!.getBoundingClientRect();
  const hint = root.querySelector('[part~="hint"]') as HTMLElement;
  const hintStart = dir === 'ltr'
    ? hint.getBoundingClientRect().left + parseFloat(getComputedStyle(hint).paddingInlineStart)
    : hint.getBoundingClientRect().right - parseFloat(getComputedStyle(hint).paddingInlineStart);
  return { host, label, field, hintStart };
}

for (const name of Object.keys(MARKUP)) {
  it(`${name} places the label in an inline-start column with the hint under the field, LTR and RTL`, async () => {
    for (const dir of ['ltr', 'rtl'] as const) {
      const { host, label, field, hintStart } = await mount(name, 640, dir, 'start');
      expect(host.labelPlacement).to.equal('start');
      expect(host.getAttribute('label-placement')).to.equal('start');
      if (dir === 'ltr') expect(label.right, 'label before the field').to.be.at.most(field.left + 0.5);
      else expect(label.left, 'label before the field (RTL)').to.be.at.least(field.right - 0.5);
      expect(label.top, 'same row').to.be.below(field.bottom);
      expect(Math.abs(hintStart - (dir === 'ltr' ? field.left : field.right)), `${dir} hint aligned`).to.be.below(1);
      await expect(host).to.be.accessible();
    }
  });

  it(`${name} keeps the label above the field by default and when narrow`, async () => {
    for (const [width, placement] of [[640, 'top'], [260, 'start']] as const) {
      const { host, label, field } = await mount(name, width, 'ltr', placement);
      expect(label.bottom, `${width}px ${placement}`).to.be.at.most(field.top + 0.5);
      expect(host.labelPlacement).to.equal(placement);
    }
    const bare = document.createElement(name === 'slider' ? 'lr-slider' : `lr-${name}`) as Placed;
    document.body.append(bare);
    await bare.updateComplete;
    expect(bare.labelPlacement).to.equal('top');
    expect(bare.hasAttribute('label-placement'), 'default is not reflected').to.be.false;
    bare.remove();
  });
}

it('checkbox-group keeps its accessible name in the label-beside layout', async () => {
  const { host } = await mount('checkbox-group', 640, 'ltr', 'start');
  const fieldset = host.shadowRoot!.querySelector('fieldset')!;
  const labelId = fieldset.getAttribute('aria-labelledby')!;
  expect(host.shadowRoot!.getElementById(labelId)!.textContent).to.contain('Volume');
  host.setAttribute('aria-label', 'Host name');
  await host.updateComplete;
  expect(fieldset.hasAttribute('aria-labelledby'), 'a host aria-label still wins').to.be.false;
});

it('slider label inherits the surrounding size by default and opts into the form-control label size', async () => {
  const input = await fixture<LitElement>(html`<lr-input label="L"></lr-input>`);
  const slider = await fixture<LitElement>(html`<lr-slider label="L" style="font-size: 23px"></lr-slider>`);
  const size = (el: LitElement, part: string) => getComputedStyle(el.shadowRoot!.querySelector(part)!).fontSize;
  expect(size(slider, '[part~="label"]')).to.equal('23px');
  const matched = await fixture<LitElement>(
    html`<lr-slider label="L" style="--lr-form-control-label-font-size: var(--lr-font-size-md-sm)"></lr-slider>`,
  );
  expect(size(matched, '[part~="label"]')).to.equal(size(input, '[part~="form-control-label"]'));
  const themed = await fixture<LitElement>(html`<lr-slider label="L" style="--lr-form-control-label-font-size: 20px"></lr-slider>`);
  expect(size(themed, '[part~="label"]')).to.equal('20px');
});

it('slider with-value + value-placement="label" shows the raw number until value-display="formatted"', async () => {
  const fmt = (v: number) => `${v} percent`;
  const text = async (display?: string) => {
    const el = await fixture<LitElement & { valueFormatter?: (v: number) => string }>(
      html`<lr-slider label="V" value="40" with-value value-placement="label" .valueFormatter=${fmt} value-display=${display ?? 'numeric'}></lr-slider>`,
    );
    await el.updateComplete;
    return el.shadowRoot!.querySelector('[part="value"]')!.textContent!.trim();
  };
  expect(await text()).to.equal('40');
  expect(await text('formatted')).to.equal('40 percent');
});

it('checkbox-group separates the row and column gap of wrapped options and falls back to the shared gap', async () => {
  const mountGroup = async (style: string) => {
    const el = await fixture<LitElement>(html`<lr-checkbox-group orientation="horizontal" style=${style}>
      <lr-checkbox value="a">A</lr-checkbox></lr-checkbox-group>`);
    return getComputedStyle(el.shadowRoot!.querySelector('[part~="options"]')!);
  };
  const base = await mountGroup('');
  expect(base.rowGap).to.equal(base.columnGap);
  const shared = await mountGroup('--lr-checkbox-group-option-gap: 7px');
  expect([shared.rowGap, shared.columnGap]).to.deep.equal(['7px', '7px']);
  const split = await mountGroup('--lr-checkbox-group-option-gap: 7px; --lr-checkbox-group-option-row-gap: 3px; --lr-checkbox-group-option-column-gap: 11px');
  expect([split.rowGap, split.columnGap]).to.deep.equal(['3px', '11px']);
});

it('form-control labels read --lr-form-control-label-line-height and inherit it by default', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`<div style="line-height: 30px"><lr-input label="L"></lr-input></div>`);
  const input = wrapper.querySelector('lr-input') as LitElement;
  const part = '[part~="form-control-label"]';
  expect(getComputedStyle(input.shadowRoot!.querySelector(part)!).lineHeight).to.equal('30px');
  const themed = await fixture<LitElement>(html`<lr-input label="L" style="--lr-form-control-label-line-height: 22px"></lr-input>`);
  expect(getComputedStyle(themed.shadowRoot!.querySelector(part)!).lineHeight).to.equal('22px');
});

it('lr-input and lr-number-input read --lr-input-font-variant-numeric on the native field', async () => {
  for (const name of ['lr-input', 'lr-number-input']) {
    const host = await fixture<HTMLElement>(html`<div style="font-variant-numeric: oldstyle-nums"></div>`);
    const make = (style: string) => {
      const el = document.createElement(name) as LitElement;
      el.setAttribute('style', style);
      host.append(el);
      return el;
    };
    const plain = make('');
    const tabular = make('--lr-input-font-variant-numeric: tabular-nums');
    await Promise.all([plain.updateComplete, tabular.updateComplete]);
    const read = (el: LitElement) => getComputedStyle(el.shadowRoot!.querySelector('[part="input"]')!).fontVariantNumeric;
    expect(read(plain), `${name} default inherits`).to.equal('oldstyle-nums');
    expect(read(tabular), `${name} token`).to.equal('tabular-nums');
  }
});

it('locale-picker trigger radius is independent of the listbox and options radius', async () => {
  const el = await fixture<LitElement & { open: boolean }>(
    html`<lr-locale-picker without-flags style="--lr-locale-picker-radius: 2px; --lr-locale-picker-trigger-radius: 14px"></lr-locale-picker>`,
  );
  el.open = true;
  await el.updateComplete;
  const radius = (selector: string) => getComputedStyle(el.shadowRoot!.querySelector(selector)!).borderTopLeftRadius;
  expect(radius('[part~="trigger"]')).to.equal('14px');
  expect(radius('[part~="listbox"]')).to.equal('2px');
  const plain = await fixture<LitElement>(html`<lr-locale-picker without-flags style="--lr-locale-picker-radius: 5px"></lr-locale-picker>`);
  expect(getComputedStyle(plain.shadowRoot!.querySelector('[part~="trigger"]')!).borderTopLeftRadius, 'falls back to the shared radius').to.equal('5px');
});

import { expect, fixture, html } from '@open-wc/testing';
import type { LitElement } from 'lit';
import { tag } from './prefix.js';
import '../components/lr-input.js';
import '../components/lr-textarea.js';
import '../components/lr-select.js';
import '../components/lr-option.js';
import '../components/lr-combobox.js';
import '../components/lr-date-input.js';

const NAMES = ['input', 'textarea', 'select', 'combobox', 'date-input'] as const;

async function mount(name: string, width: number, dir: 'ltr' | 'rtl' = 'ltr', placement = 'start') {
  const wrapper = await fixture<HTMLDivElement>(html`<div dir=${dir} style="inline-size: ${width}px"></div>`);
  const el = document.createElement(tag(name)) as LitElement & { labelPlacement: string };
  el.setAttribute('label', 'Shipping reference');
  el.setAttribute('hint', 'As printed on the label');
  if (placement) el.setAttribute('label-placement', placement);
  el.style.display = 'block';
  wrapper.append(el);
  await el.updateComplete;
  const root = el.shadowRoot!;
  const control = root.querySelector<HTMLElement>('[part~="form-control"]')!;
  const label = root.querySelector<HTMLElement>('[part~="form-control-label"]')!.getBoundingClientRect();
  const field = [...control.children]
    .filter((child) => !child.matches('[part~="form-control-label"], [part~="hint"], [part~="error"]'))
    .map((child) => child.getBoundingClientRect())
    .find((rect) => rect.width > 1 && rect.height > 1)!;
  const hint = root.querySelector<HTMLElement>('[part~="hint"]')!;
  const hintStart = hint.getBoundingClientRect()[dir === 'ltr' ? 'left' : 'right'] +
    (dir === 'ltr' ? 1 : -1) * parseFloat(getComputedStyle(hint).paddingInlineStart);
  return { el, label, field, hintStart };
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

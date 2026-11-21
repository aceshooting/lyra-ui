import { expect, fixture, html } from '@open-wc/testing';
import type { LitElement } from 'lit';
import { tag } from '../../internal/prefix.js';
import '../lr-checkbox.js';
import '../lr-radio.js';
import '../lr-radio-group.js';
import '../lr-switch.js';

function label(el: LitElement): CSSStyleDeclaration {
  return getComputedStyle(el.shadowRoot!.querySelector('[part="label"]')!);
}

async function mount(name: string, style = ''): Promise<LitElement> {
  const wrapper = await fixture<HTMLDivElement>(html`<div style=${style}></div>`);
  const host = document.createElement(name === 'radio' ? tag('radio-group') : tag(name));
  const el = (name === 'radio' ? document.createElement(tag('radio')) : host) as LitElement;
  el.textContent = 'Label';
  if (name === 'radio') host.append(el);
  wrapper.append(host);
  await (host as LitElement).updateComplete;
  await el.updateComplete;
  return el;
}

for (const name of ['checkbox', 'radio', 'switch']) {
  it(`${name} label reads --lr-${name}-label-font-size and -color, inherited from a wrapper`, async () => {
    const unset = label(await mount(name));
    expect(unset.fontSize, 'unset keeps the md-sm label size').to.equal('14px');
    const themed = label(
      await mount(name, `--lr-${name}-label-font-size: 12px; --lr-${name}-label-color: rgb(1, 2, 3)`),
    );
    expect(themed.fontSize).to.equal('12px');
    expect(themed.color).to.equal('rgb(1, 2, 3)');
  });
}

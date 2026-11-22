import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../../lr-filter-bar.js';
import '../../lr-select.js';
import '../../lr-combobox.js';
import '../../lr-dropdown.js';
import '../../lr-dropdown-item.js';
import '../../lr-date-input.js';
import '../../lr-input.js';
import '../../lr-button.js';
import type { LyraFilterBar, LyraFilterBarFilterDefinition } from '../../lr-filter-bar.js';

const options = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }];
const filters: LyraFilterBarFilterDefinition[] = [
  { filterId: 'select', label: 'Select', type: 'select', options },
  { filterId: 'combo', label: 'Combo', type: 'combobox', options, size: 's' },
  { filterId: 'date', label: 'Date', type: 'date' },
  { filterId: 'text', label: 'Text', type: 'text', size: 'l' },
  { filterId: 'menu', label: 'Menu', type: 'checkbox-menu', options },
];

async function mount(style: string): Promise<LyraFilterBar> {
  const el = await fixture<LyraFilterBar>(html`<lr-filter-bar style=${style} .filters=${filters}></lr-filter-bar>`);
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="filter-control"]').length >= 5
    && el.shadowRoot!.querySelector('.checkbox-menu lr-button') !== null, 'every filter control renders');
  await el.updateComplete;
  return el;
}

const controls = (el: LyraFilterBar): HTMLElement[] => [
  ...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="filter-control"], .checkbox-menu lr-button, [part="reset-button"]'),
].filter((control) => control.localName.includes('-') && control.localName !== 'lr-dropdown');
const height = (control: HTMLElement): string => getComputedStyle(control).getPropertyValue('--lr-form-control-height').trim();

describe('lr-filter-bar control height and font tokens', () => {
  it('gives every filter type and the reset button one height and field font size', async () => {
    const el = await mount('--lr-filter-bar-control-height: 30px; --lr-filter-bar-control-font-size: 19px');
    const all = controls(el);
    expect(all.length).to.be.at.least(5);
    expect(all.filter((control) => height(control) === '').map((control) => control.localName)).to.deep.equal([]);
    expect(all.map(height)).to.deep.equal(all.map(() => '30px'));
    const input = el.shadowRoot!.querySelector('lr-input')!;
    expect(getComputedStyle(input.shadowRoot!.querySelector('[part="input"]')!).fontSize).to.equal('19px');
    const wrapper = input.shadowRoot!.querySelector('[part~="input-wrapper"]')!;
    expect(wrapper.getBoundingClientRect().height).to.be.closeTo(30, 0.5);
    const trigger = el.shadowRoot!.querySelector('.checkbox-menu lr-button')!;
    expect(getComputedStyle(trigger.shadowRoot!.querySelector('[part~="base"]')!).fontSize).to.equal('19px');
    for (const name of ['--_lr-select-font-size', '--_lr-combobox-font-size', '--_lr-date-input-font-size']) {
      expect(all.some((control) => getComputedStyle(control).getPropertyValue(name).trim() === '19px'), name).to.equal(true);
    }
  });

  it('keeps each control on its own tier and an ancestor font token while unset', async () => {
    const el = await mount('--lr-input-font-size: 21px');
    const byId = (id: string) => el.shadowRoot!.querySelector<HTMLElement>(`[part~="field-${id}"] [part="filter-control"]`)!;
    const plain = document.createElement('lr-input');
    plain.size = 'l';
    el.parentElement!.append(plain);
    await plain.updateComplete;
    expect(height(byId('text'))).to.equal(height(plain));
    plain.size = 'm';
    await plain.updateComplete;
    expect(height(byId('select'))).to.equal(height(plain));
    const input = el.shadowRoot!.querySelector('lr-input')!;
    expect(getComputedStyle(input.shadowRoot!.querySelector('[part="input"]')!).fontSize).to.equal('21px');
  });
});

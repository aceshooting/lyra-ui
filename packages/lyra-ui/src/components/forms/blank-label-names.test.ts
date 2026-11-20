// A blank or whitespace-only caller label never becomes an empty accessible name: the control
// falls back to its visible label or the localized default instead.
import { expect, fixture, html } from '@open-wc/testing';
import '../lr-checkbox.js';
import '../lr-switch.js';
import '../lr-radio.js';
import '../lr-select.js';
import '../lr-time-range.js';
import '../lr-slider.js';
import '../lr-toggle-group.js';
import '../lr-toggle.js';
import '../lr-icon-button.js';

const BLANKS = ['   ', ' \t '];

describe('whitespace-only host aria-label', () => {
  for (const blank of BLANKS) {
    const name = JSON.stringify(blank);

    it(`checkbox and switch keep their visible label naming for ${name}`, async () => {
      const hosts = [
        await fixture<HTMLElement>(html`<lr-checkbox aria-label=${blank}>Visible</lr-checkbox>`),
        await fixture<HTMLElement>(html`<lr-switch aria-label=${blank}>Visible</lr-switch>`),
      ];
      for (const host of hosts) {
        const owner = host.shadowRoot!.querySelector<HTMLElement>('[role]')!;
        const tag = host.localName;
        expect(owner.hasAttribute('aria-label'), tag).to.equal(false);
        expect(owner.getAttribute('aria-labelledby'), tag).to.equal(`${tag.slice(3)}-label`);
      }
    });

    it(`radio omits an empty aria-label for ${name}`, async () => {
      const el = await fixture<HTMLElement>(html`<lr-radio value="a" aria-label=${blank}>A</lr-radio>`);
      expect(el.shadowRoot!.querySelector('[role="radio"]')!.hasAttribute('aria-label')).to.equal(false);
    });

    it(`select, slider, toggle-group, time-range and icon-button fall back for ${name}`, async () => {
      const select = await fixture<HTMLElement>(html`<lr-select aria-label=${blank} placeholder="  "></lr-select>`);
      expect(select.shadowRoot!.querySelector('[role="combobox"], [role="button"]')!.getAttribute('aria-label'))
        .to.equal('Select');

      const slider = await fixture<HTMLElement>(html`<lr-slider aria-label=${blank} label="  "></lr-slider>`);
      expect(slider.shadowRoot!.querySelector('[role="slider"]')!.getAttribute('aria-label')).to.equal('Slider');

      const group = await fixture<HTMLElement>(
        html`<lr-toggle-group aria-label=${blank} label="   "><lr-toggle value="a">A</lr-toggle></lr-toggle-group>`,
      );
      expect(group.shadowRoot!.querySelector('[role="group"]')!.hasAttribute('aria-label')).to.equal(false);

      const range = await fixture<HTMLElement>(html`<lr-time-range aria-label=${blank}></lr-time-range>`);
      expect(range.shadowRoot!.querySelector('[part="base"]')!.hasAttribute('aria-label')).to.equal(false);

      const button = await fixture<HTMLElement>(
        html`<lr-icon-button icon="star" aria-label=${blank} label="  "></lr-icon-button>`,
      );
      expect(button.shadowRoot!.querySelector('button')!.getAttribute('aria-label')).to.equal('Button');
    });
  }
});

describe('explicitly empty host aria-label', () => {
  it('stays an explicit opt-out on checkbox and icon-button', async () => {
    const box = await fixture<HTMLElement>(html`<lr-checkbox aria-label="">Visible</lr-checkbox>`);
    const owner = box.shadowRoot!.querySelector('[role="checkbox"]')!;
    expect(owner.getAttribute('aria-label')).to.equal('');
    expect(owner.hasAttribute('aria-labelledby')).to.equal(false);
    const button = await fixture<HTMLElement>(html`<lr-icon-button icon="star" aria-label=""></lr-icon-button>`);
    expect(button.shadowRoot!.querySelector('button')!.getAttribute('aria-label')).to.equal('');
  });
});

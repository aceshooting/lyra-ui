import { expect, html, waitUntil } from '@open-wc/testing';
import type { TemplateResult } from 'lit';
import { headerFixture, hitBelongsTo, hitId, pointOverSibling } from '../../../test/top-layer-header.js';
import '../lr-country-picker.js';
import '../lr-currency-picker.js';
import '../lr-time-zone-picker.js';
import '../lr-unit-picker.js';
import type { LyraCatalogPickerBase } from './catalog-picker-base.js';
import type { LyraSelect } from './select/select.class.js';

const NO_MOTION = '--lr-transition-fast: 0ms';
const cases: Array<[string, (topLayer: boolean) => TemplateResult]> = [
  ['lr-country-picker', (on) => html`<lr-country-picker data-lr-theme-scope style=${NO_MOTION} ?top-layer=${on}
    label="Country" .countries=${['FR', 'DE', 'IT', 'ES', 'PT']}></lr-country-picker>`],
  ['lr-currency-picker', (on) => html`<lr-currency-picker data-lr-theme-scope style=${NO_MOTION} ?top-layer=${on}
    label="Currency" .currencies=${['EUR', 'USD', 'GBP', 'JPY', 'CHF']}></lr-currency-picker>`],
  ['lr-time-zone-picker', (on) => html`<lr-time-zone-picker data-lr-theme-scope style=${NO_MOTION} ?top-layer=${on}
    label="Zone" .timeZones=${['Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'UTC', 'America/New_York']}></lr-time-zone-picker>`],
  ['lr-unit-picker', (on) => html`<lr-unit-picker data-lr-theme-scope style=${NO_MOTION} ?top-layer=${on}
    label="Unit" .units=${['meter', 'kilogram', 'second', 'liter', 'byte']}></lr-unit-picker>`],
];

async function mount(template: TemplateResult, name: string) {
  const { wrapper, sibling } = await headerFixture(template);
  const el = wrapper.querySelector<LyraCatalogPickerBase>(name)!;
  await el.updateComplete;
  const child = el.shadowRoot!.querySelector<LyraSelect<false>>('lr-select')!;
  await child.updateComplete;
  const listbox = child.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!;
  child.open = true;
  await child.updateComplete;
  await waitUntil(() => child.open && listbox.getBoundingClientRect().height > 0 && listbox.style.left !== '', 'the listbox is placed');
  return { el, child, sibling, listbox };
}

for (const [name, template] of cases) {
  describe(`top-layer on ${name}`, () => {
    it('defaults off, beneath a higher sibling', async () => {
      const { el, child, sibling, listbox } = await mount(template(false), name);
      expect(el.topLayer).to.equal(false);
      const [x, y] = pointOverSibling(listbox, sibling);
      expect(listbox.matches(':popover-open')).to.equal(false);
      expect(hitId(x, y)).to.equal('sibling');
      child.open = false;
    });

    it('paints above the higher sibling when opted in, and releases when unset', async () => {
      const { el, child, sibling, listbox } = await mount(template(true), name);
      expect(el.hasAttribute('top-layer'), 'the property reflects').to.equal(true);
      await waitUntil(() => listbox.matches(':popover-open'), 'the listbox is promoted');
      const [x, y] = pointOverSibling(listbox, sibling);
      expect(hitBelongsTo(el, x, y), 'the listbox wins the hit test over the sibling').to.equal(true);
      el.topLayer = false;
      await waitUntil(() => !listbox.matches(':popover-open'), 'turning it off releases the top layer');
      expect(child.open).to.equal(true);
      expect(el.hasAttribute('top-layer')).to.equal(false);
      child.open = false;
    });
  });
}

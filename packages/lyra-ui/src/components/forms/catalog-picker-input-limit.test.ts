import { expect, fixture } from '@open-wc/testing';
import { AnnouncementSinkController } from '../../internal/announcer.js';
import type { LyraCatalogPickerBase } from './catalog-picker-base.js';
import './country-picker/country-picker.js';
import './currency-picker/currency-picker.js';
import './unit-picker/unit-picker.js';
import './time-zone-picker/time-zone-picker.js';

for (const config of [
  { tag: 'lr-country-picker', property: 'countries', code: 'US' },
  { tag: 'lr-currency-picker', property: 'currencies', code: 'USD' },
  { tag: 'lr-unit-picker', property: 'units', code: 'meter' },
  { tag: 'lr-time-zone-picker', property: 'timeZones', code: 'UTC' },
]) {
  it(`${config.tag} renders its unregistered English catalog notice`, async () => {
    const host = document.createElement(config.tag) as LyraCatalogPickerBase;
    host.lang = 'en';
    Reflect.set(host, config.property, Array.from({ length: 1025 }, () => config.code));
    await fixture(host);
    expect(host.shadowRoot!.querySelector('[part="limit"]')?.textContent?.trim()).to.equal('Some catalog entries were omitted because an input limit was reached.');
  });
  it(`${config.tag} discloses original catalog loss, preserves rebinds and clears replacements`, async () => {
    const host = document.createElement(config.tag) as LyraCatalogPickerBase;
    host.strings = { catalogPickerInputLimit: 'Catalog omitted' };
    Reflect.set(host, config.property, Array.from({ length: 1025 }, () => config.code));
    const spoken: string[] = [];
    const original = AnnouncementSinkController.prototype.announce;
    AnnouncementSinkController.prototype.announce = function(message, politeness) {
      if ((this as unknown as { host: HTMLElement }).host === host && message) spoken.push(message);
      original.call(this, message, politeness);
    };
    try {
      await fixture(host);
      expect(host.shadowRoot!.querySelector('[part="limit"]')?.textContent?.trim()).to.equal('Catalog omitted');
      expect(spoken).to.deep.equal([]);
      const snapshot = Reflect.get(host, config.property);
      Reflect.set(host, config.property, snapshot);
      await host.updateComplete;
      expect(host.shadowRoot!.querySelector('[part="limit"]')?.textContent?.trim()).to.equal('Catalog omitted');
      expect(spoken).to.deep.equal([]);
      Reflect.set(host, config.property, [config.code]);
      await host.updateComplete;
      expect(host.shadowRoot!.querySelectorAll('[part="limit"]').length).to.equal(0);
      Reflect.set(host, config.property, Array.from({ length: 1025 }, () => config.code));
      await host.updateComplete;
      expect(spoken).to.deep.equal(['Catalog omitted']);
      host.requestUpdate(); await host.updateComplete;
      const parent = host.parentNode!; host.remove(); parent.append(host); await host.updateComplete;
      expect(spoken).to.deep.equal(['Catalog omitted']);
      Reflect.set(host, config.property, undefined); await host.updateComplete;
      expect(host.shadowRoot!.querySelectorAll('[part="limit"]').length).to.equal(0);
      Reflect.set(host, config.property, []); await host.updateComplete;
      expect(host.shadowRoot!.querySelectorAll('[part="limit"]').length).to.equal(0);
    } finally { AnnouncementSinkController.prototype.announce = original; }
  });
}

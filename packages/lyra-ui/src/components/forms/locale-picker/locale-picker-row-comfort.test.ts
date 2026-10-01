import { expect, fixture, fixtureCleanup, html, waitUntil } from '@open-wc/testing';
import { sendKeys, setViewport } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { getLyraLocale, setLyraLocale } from '../../../localization.js';
import { setFlagUrlResolver } from '../../media/flag/flag.class.js';
import './locale-picker.js';
import type { LyraLocalePicker } from './locale-picker.class.js';

const CATALOG = [
  { tag: 'en', label: 'English' },
  { tag: 'fr', label: 'français' },
  { tag: 'ja', label: '日本語' },
];

function rows(el: LyraLocalePicker): HTMLElement[] {
  return [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="option"]')];
}

describe('lr-locale-picker comfortable option rows', () => {
  before(() => setFlagUrlResolver(async () => 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3C/svg%3E'));
  after(() => { fixtureCleanup(); setFlagUrlResolver(null); });

  for (const size of ['m', 's']) {
    for (const direction of ['ltr', 'rtl']) {
      it(`retains a medium row floor with a ${size} trigger, small inherited text and ${direction}`, async () => {
        const wrapper = await fixture<HTMLDivElement>(html`<div dir=${direction} style="font-size:12px">
          <lr-locale-picker open size=${size} trigger-display="flag" option-display="label"
            value="en" .locales=${CATALOG}></lr-locale-picker>
        </div>`);
        const el = wrapper.querySelector<LyraLocalePicker>('lr-locale-picker')!;
        await el.updateComplete;
        const minimum = matchMedia('(hover: none), (pointer: coarse)').matches ? 44 : 36;
        expect(rows(el).length).to.equal(CATALOG.length);
        for (const row of rows(el)) {
          expect(row.getBoundingClientRect().height).to.be.at.least(minimum);
          expect(getComputedStyle(row).textAlign).to.equal('start');
        }
        expect(el.shadowRoot!.querySelectorAll('[part="option-flag"]').length).to.equal(CATALOG.length);
        expect(el.shadowRoot!.querySelectorAll('[part="option-tag"]').length).to.equal(0);
        expect(rows(el).map((row) => row.textContent!.trim())).to.deep.equal(CATALOG.map((entry) => entry.label));
        expect(rows(el)[0]!.getAttribute('aria-selected')).to.equal('true');
        expect(getComputedStyle(rows(el)[0]!).borderTopColor).not.to.equal('rgba(0, 0, 0, 0)');
        el.style.setProperty('--lr-theme-form-control-height-m', '48px');
        expect(rows(el)[0]!.getBoundingClientRect().height).to.be.at.least(48);
        el.style.removeProperty('--lr-theme-form-control-height-m');
        expect(rows(el)[0]!.getBoundingClientRect().height).to.be.at.least(minimum);
      });
    }
  }

  it('grows beyond the floor for larger text and the optional tag line', async () => {
    const el = await fixture<LyraLocalePicker>(html`<lr-locale-picker open style="font-size:32px"
      .locales=${CATALOG}></lr-locale-picker>`);
    for (const row of rows(el)) {
      expect(row.getBoundingClientRect().height).to.be.greaterThan(36);
      expect(row.scrollHeight).to.be.at.most(row.clientHeight);
    }
  });

  for (const direction of ['ltr', 'rtl']) {
    it(`keeps the last comfortable row keyboard-reachable in a 320px ${direction} viewport`, async () => {
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const previousLocale = getLyraLocale();
      try {
        await setViewport({ width: 320, height: 480 });
        const wrapper = await fixture<HTMLDivElement>(html`<div dir=${direction}
          style="position:fixed;inset-inline-start:8px;top:8px;font-size:12px">
          <lr-locale-picker top-layer trigger-display="flag" option-display="label" label="Language"
            .locales=${Array.from({ length: 18 }, (_, index) => ({ tag: index === 17 ? 'en' : `en-x-row${index}`, label: `Language ${index}` }))}
          ></lr-locale-picker>
        </div>`);
        const el = wrapper.querySelector<LyraLocalePicker>('lr-locale-picker')!;
        const trigger = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="trigger"]')!;
        const listbox = el.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!;
        await focusByKeyboard(trigger);
        await sendKeys({ press: 'ArrowDown' });
        await waitUntil(() => getComputedStyle(listbox).visibility === 'visible');
        expect(listbox.scrollHeight).to.be.greaterThan(listbox.clientHeight);
        await sendKeys({ press: 'End' });
        await el.updateComplete;
        const last = rows(el).at(-1)!;
        await waitUntil(() => last.getBoundingClientRect().bottom <= listbox.getBoundingClientRect().bottom + 1);
        const bounds = listbox.getBoundingClientRect();
        expect(bounds.left).to.be.at.least(-1);
        expect(bounds.right).to.be.at.most(321);
        expect(bounds.bottom).to.be.at.most(481);
        expect(listbox.scrollTop).to.be.greaterThan(0);
        expect(el.shadowRoot!.activeElement === trigger).to.equal(true);
        expect(trigger.getAttribute('aria-activedescendant')).to.equal(last.id);
        expect(last.hasAttribute('data-active')).to.equal(true);
        await expect(el).to.be.accessible();
        await sendKeys({ press: 'Enter' });
        await el.updateComplete;
        expect(el.value).to.equal('en');
        expect(el.open).to.equal(false);
        expect(el.shadowRoot!.activeElement === trigger).to.equal(true);
      } finally {
        fixtureCleanup();
        setLyraLocale(previousLocale);
        await setViewport(viewport);
      }
    });
  }
});

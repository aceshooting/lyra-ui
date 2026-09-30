import { expect, fixture, fixtureCleanup, html, waitUntil } from '@open-wc/testing';
import { sendKeys, setViewport } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import { getLyraLocale, setLyraLocale } from '../../../localization.js';
import { setFlagUrlResolver } from '../../media/flag/flag.class.js';
import './locale-picker.js';
import type { LyraLocalePicker } from './locale-picker.class.js';

describe('locale load retry placement', () => {
  before(() => setFlagUrlResolver(async () => 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3C/svg%3E'));
  after(() => { fixtureCleanup(); setFlagUrlResolver(null); });

  for (const [direction, edge, width, fontSize] of [
    ['ltr', 'top', 320, '32px'],
    ['rtl', 'top', 320, '32px'],
    ['ltr', 'bottom', 1024, '16px'],
    ['rtl', 'bottom', 1024, '16px'],
  ] as const) {
    it(`keeps Retry reachable with a flag trigger and multiline guidance in ${direction} at ${edge}, ${width}px`, async () => {
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const rootFont = document.documentElement.style.fontSize;
      const previousLocale = getLyraLocale();
      let el: LyraLocalePicker | undefined;
      let finishRetry: (() => void) | undefined;
      try {
        await setViewport({ width, height: 800 });
        document.documentElement.style.fontSize = fontSize;
        setLyraLocale('en');
        const wrapper = await fixture<HTMLDivElement>(html`<div dir=${direction}
          style=${`position:fixed;inset-inline-start:8px;${edge}:8px;inline-size:${width === 320 ? 280 : 360}px`}>
          <lr-locale-picker top-layer locale="en" value="en" trigger-display="flag"
            label="Interface language preferences"
            hint="Your language choice applies to interface controls and messages."
            error-text="Check the selected language before continuing."
            .strings=${{ statusError: 'The language could not be loaded. You can try again.', retry: 'Try again' }}
            .locales=${['en', 'fr']}></lr-locale-picker>
        </div>`);
        el = wrapper.querySelector<LyraLocalePicker>('lr-locale-picker')!;
        const picker = el;
        const retryCompletion = new Promise<void>((resolve) => { finishRetry = resolve; });
        const loadedTags: string[] = [];
        picker.localeLoader = (tag) => {
          loadedTags.push(tag);
          return loadedTags.length === 1 ? Promise.reject(new Error('not rendered')) : retryCompletion;
        };
        const trigger = picker.shadowRoot!.querySelector<HTMLButtonElement>('[part="trigger"]')!;
        const listbox = picker.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!;
        await focusByKeyboard(trigger);
        await sendKeys({ press: 'ArrowDown' });
        await waitUntil(() => getComputedStyle(listbox).visibility === 'visible' && listbox.style.left !== '');
        const initialBounds = listbox.getBoundingClientRect();
        await sendKeys({ press: 'End' });
        await sendKeys({ press: 'Enter' });
        await waitUntil(() => picker.shadowRoot!.querySelector('[part="load-retry"]') !== null);
        const formControl = picker.shadowRoot!.querySelector<HTMLElement>('[part="form-control"]')!;
        const clearOfGuidance = () => {
          const panel = listbox.getBoundingClientRect();
          const control = formControl.getBoundingClientRect();
          return getComputedStyle(listbox).visibility === 'visible' &&
            (edge === 'top' ? panel.top >= control.bottom - 1 : panel.bottom <= control.top + 1);
        };
        await waitUntil(clearOfGuidance, 'the popup places outside the entire failure guidance');
        expect(picker.open).to.equal(true);
        expect(picker.value).to.equal('en');
        expect(getLyraLocale()).to.equal('en');
        expect(picker.shadowRoot!.activeElement === trigger).to.equal(true);
        const failureBounds = listbox.getBoundingClientRect();
        expect(Math.abs(failureBounds.width - initialBounds.width), 'the wider wrapper does not enlarge the popup').to.be.at.most(1);
        const initialEdge = direction === 'ltr' ? initialBounds.left : initialBounds.right;
        const failureEdge = direction === 'ltr' ? failureBounds.left : failureBounds.right;
        expect(Math.abs(failureEdge - initialEdge), 'the popup keeps its alignment with the compact trigger').to.be.at.most(1);
        expect(failureBounds.left).to.be.at.least(-1);
        expect(failureBounds.right).to.be.at.most(width + 1);
        await expect(picker).to.be.accessible();
        await sendKeys({ press: 'Escape' });
        await picker.updateComplete;
        expect(picker.open).to.equal(false);
        expect(picker.shadowRoot!.activeElement === trigger).to.equal(true);
        await sendKeys({ press: 'ArrowDown' });
        await waitUntil(() => picker.open && clearOfGuidance());
        const retry = picker.shadowRoot!.querySelector<HTMLButtonElement>('[part="load-retry"]')!;
        const bounds = retry.getBoundingClientRect();
        const point: [number, number] = [Math.round(bounds.left + bounds.width / 2), Math.round(bounds.top + bounds.height / 2)];
        expect(picker.shadowRoot!.elementFromPoint(...point)?.closest('[part="load-retry"]') === retry,
          'the reopened top-layer popup does not intercept Retry').to.equal(true);
        await sendMouse({ type: 'click', position: point });
        await waitUntil(() => loadedTags.length === 2);
        expect(loadedTags).to.deep.equal(['fr', 'fr']);
        expect(picker.value).to.equal('en');
        expect(getLyraLocale()).to.equal('en');
        finishRetry!();
        await waitUntil(() => picker.value === 'fr');
      } finally {
        finishRetry?.();
        el?.remove();
        await resetMouse();
        setLyraLocale(previousLocale);
        document.documentElement.style.fontSize = rootFont;
        await setViewport(viewport);
      }
    });
  }
});

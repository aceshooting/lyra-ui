import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './date-picker.js';
import type { LyraDatePicker } from './date-picker.class.js';

describe('readonly date-picker period navigation', () => {
  for (const view of ['months', 'years', 'decades'] as const) {
    it(`keeps ${view} navigable without changing the selection, then permits editing after unlock`, async () => {
      const el = await fixture<LyraDatePicker>(html`
        <lr-date-picker readonly .view=${view} value="2026-07-15" today="2026-07-15"></lr-date-picker>
      `);
      const events: string[] = [];
      for (const name of ['input', 'change', 'lr-input', 'lr-change']) {
        el.addEventListener(name, () => events.push(name));
      }
      const grid = el.shadowRoot!.querySelector('[part="view-grid"]')!;
      expect(grid.getAttribute('aria-readonly')).to.equal('true');
      const initial = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-view-start][tabindex="0"]')!;
      const start = initial.dataset['viewStart'];
      await focusByKeyboard(initial);
      await sendKeys({ press: 'ArrowRight' });
      await waitUntil(() => {
        const active = el.shadowRoot!.activeElement as HTMLElement | null;
        return active?.dataset['viewStart'] !== undefined && active.dataset['viewStart'] !== start;
      }, 'readonly period navigation moves keyboard focus');
      expect(el.shadowRoot!.querySelectorAll('[data-view-start][tabindex="0"]').length).to.equal(1);
      await expect(el).to.be.accessible();

      for (let remaining = 3; el.view !== 'days' && remaining > 0; remaining--) {
        await sendKeys({ press: 'Enter' });
        await el.updateComplete;
      }
      expect(el.view).to.equal('days');
      expect(el.shadowRoot!.querySelector('[part="grid"]')!.getAttribute('aria-readonly')).to.equal('true');
      const day = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-date][tabindex="0"]')!;
      const nextValue = day.dataset['date'];
      expect(nextValue).to.be.a('string').and.not.equal('2026-07-15');
      await focusByKeyboard(day);
      await sendKeys({ press: 'Enter' });
      await el.updateComplete;
      expect(el.value).to.equal('2026-07-15');
      expect(events).to.deep.equal([]);

      el.readonly = false;
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('[part="grid"]')!.getAttribute('aria-readonly')).to.equal('false');
      await sendKeys({ press: 'Enter' });
      await el.updateComplete;
      expect(el.value).to.equal(nextValue);
      expect(events).to.deep.equal(['input', 'lr-input', 'change', 'lr-change']);
    });
  }
});

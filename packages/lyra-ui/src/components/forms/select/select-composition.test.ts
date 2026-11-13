import { expect, fixture, html } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './select.js';
import '../combobox/option.js';
import type { LyraSelect } from './select.js';

describe('select input-method composition', () => {
  for (const [name, marker] of [
    ['composition state', { isComposing: true }],
    ['legacy composition code', { keyCode: 229 }],
  ] as const) {
    it(`ignores ${name} navigation and commits, then resumes ordinary keyboard selection`, async () => {
      const el = await fixture<LyraSelect>(html`
        <lr-select label="Fruit" value="a">
          <lr-option value="a">Apple</lr-option><lr-option value="b">Banana</lr-option>
          <lr-option value="c">Cherry</lr-option>
        </lr-select>
      `);
      const trigger = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="trigger"]')!;
      const edits: string[] = [];
      for (const name of ['input', 'change', 'lr-input', 'lr-change']) el.addEventListener(name, () => edits.push(name));
      await focusByKeyboard(trigger);
      for (const key of ['ArrowDown', 'b', 'Enter']) {
        const event = new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true, ...marker });
        trigger.dispatchEvent(event);
        await el.updateComplete;
        expect(event.defaultPrevented, key).to.equal(false);
        expect(el.open, key).to.equal(false);
        expect(el.value, key).to.equal('a');
      }
      await el.show();
      const active = () => el.shadowRoot!.querySelector('[part="option"][data-active]')?.getAttribute('data-value');
      expect(active()).to.equal('a');
      try {
        for (const key of ['ArrowDown', 'b', 'Enter', 'Escape']) {
          const event = new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true, ...marker });
          trigger.dispatchEvent(event);
          await el.updateComplete;
          expect(event.defaultPrevented, key).to.equal(false);
          expect(el.open, key).to.equal(true);
          expect(active(), key).to.equal('a');
          expect(el.value, key).to.equal('a');
        }
        expect(edits).to.deep.equal([]);
        expect(el.shadowRoot!.activeElement === trigger).to.equal(true);
        await sendKeys({ press: 'End' });
        await el.updateComplete;
        expect(active()).to.equal('c');
        await sendKeys({ press: 'Enter' });
        await el.updateComplete;
        expect(el.value).to.equal('c');
        expect(el.open).to.equal(false);
        expect(edits).to.deep.equal(['input', 'lr-input', 'change', 'lr-change']);
      } finally {
        await el.hide();
      }
    });
  }
});

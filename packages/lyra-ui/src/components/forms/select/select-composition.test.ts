import { expect, fixture, html } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import '../../lr-select.js';
import '../../lr-option.js';
import type { LyraSelect } from '../../lr-select.js';

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

describe('select printable type-ahead', () => {
  for (const open of [false, true]) {
    it(`consumes typed characters while ${open ? 'open' : 'closed'} and preserves neighboring editable text`, async () => {
      const text = 'Selected text in the document';
      const host = await fixture<HTMLElement>(html`
        <section>
          <div contenteditable="true">${text}</div>
          <lr-select value="a" label="Fruit">
            <lr-option value="a">Apple</lr-option>
            <lr-option value="b">Banana</lr-option>
          </lr-select>
        </section>
      `);
      const editable = host.querySelector<HTMLElement>('[contenteditable]')!;
      const select = host.querySelector<LyraSelect>('lr-select')!;
      const trigger = select.shadowRoot!.querySelector<HTMLButtonElement>('[part="trigger"]')!;
      await focusByKeyboard(editable);
      const selection = host.ownerDocument.getSelection()!;
      selection.selectAllChildren(editable);
      expect(selection.toString()).to.equal(text);
      await sendKeys({ press: 'Tab' });
      expect(select.shadowRoot!.activeElement === trigger).to.equal(true);
      if (open) await select.show();
      const consumed: boolean[] = [];
      select.addEventListener('keydown', event => { consumed.push(event.defaultPrevented); });
      try {
        for (const modifier of [{ ctrlKey: true }, { altKey: true }, { metaKey: true }]) {
          trigger.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'b', bubbles: true, composed: true, cancelable: true, ...modifier,
          }));
        }
        await sendKeys({ press: 'b' });
        await select.updateComplete;
        expect(editable.textContent).to.equal(text);
        expect(consumed).to.deep.equal([false, false, false, true]);
        expect(select.value).to.equal(open ? 'a' : 'b');
        if (open) {
          expect(select.shadowRoot!.querySelector('[part="option"][data-active]')?.getAttribute('data-value')).to.equal('b');
          await sendKeys({ press: 'Enter' });
          await select.updateComplete;
          expect(select.value).to.equal('b');
        }
      } finally {
        await select.hide();
      }
    });
  }
});

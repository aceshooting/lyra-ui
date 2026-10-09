import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import '../../overlays/overlay/dropdown.js';
import '../../layout/menu/menu.js';
import '../../layout/menu/menu-item.js';
import './message-actions.js';
import '../message-feedback/message-feedback.js';
import type { LyraMessageActions } from './message-actions.js';
import type { LyraMessageFeedback } from '../message-feedback/message-feedback.js';

describe('slotted feedback editor navigation', () => {
  for (const dir of ['ltr', 'rtl']) {
    for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End']) {
      it(`keeps ${key} in the ${dir} comment editor`, async () => {
        const toolbar = await fixture<LyraMessageActions>(html`
          <lr-message-actions dir=${dir} .controls=${['regenerate']}>
            <lr-message-feedback .detail=${{ commentable: true }}></lr-message-feedback>
          </lr-message-actions>
        `);
        const feedback = toolbar.querySelector<LyraMessageFeedback>('lr-message-feedback')!;
        await feedback.updateComplete;
        feedback.shadowRoot!.querySelector<HTMLButtonElement>('[part="down-button"]')!.click();
        await feedback.updateComplete;
        await toolbar.updateComplete;
        const comment = feedback.shadowRoot!.querySelector<HTMLTextAreaElement>('[part="comment"]')!;
        comment.focus();
        comment.value = 'Keep editing';
        comment.setSelectionRange(4, 4);
        const event = new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true });
        comment.dispatchEvent(event);
        expect(event.defaultPrevented).to.be.false;
        expect(feedback.shadowRoot!.activeElement === comment).to.be.true;
        expect(comment.selectionStart).to.equal(4);
      });
    }
  }
});

it('leaves keys an open slotted menu handled with that menu', async () => {
  const toolbar = await fixture<LyraMessageActions>(html`
    <lr-message-actions .controls=${['regenerate', 'edit']}>
      <lr-dropdown style="--lr-transition-fast:0ms">
        <button slot="trigger" type="button">More</button>
        <lr-menu label="More">
          <lr-menu-item value="a">A</lr-menu-item>
          <lr-menu-item value="b">B</lr-menu-item>
        </lr-menu>
      </lr-dropdown>
    </lr-message-actions>
  `);
  const dropdown = toolbar.querySelector('lr-dropdown') as HTMLElement & { open: boolean };
  const [first, last] = [...toolbar.querySelectorAll<HTMLElement>('lr-menu-item')];
  dropdown.open = true;
  // The popup stays visibility-hidden, so unfocusable, until positioned; the menu then takes focus.
  await waitUntil(() => document.activeElement === first, 'the opened menu took focus');
  last!.focus();
  await sendKeys({ press: 'Home' });
  await waitUntil(() => document.activeElement !== last, 'Home moved focus');
  expect(document.activeElement === first, 'Home stays inside the menu').to.be.true;
  expect(dropdown.open).to.be.true;
});

it('leaves caret keys to a slotted text field', async () => {
  const toolbar = await fixture<LyraMessageActions>(html`
    <lr-message-actions .controls=${['regenerate']}><input value="hello" /></lr-message-actions>
  `);
  await toolbar.updateComplete;
  const input = toolbar.querySelector('input')!;
  input.focus();
  input.setSelectionRange(2, 2);
  const event = new KeyboardEvent('keydown', { key: 'Home', bubbles: true, composed: true, cancelable: true });
  input.dispatchEvent(event);
  expect(event.defaultPrevented).to.be.false;
  expect(document.activeElement === input).to.be.true;
});

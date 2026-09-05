import { fixture, expect, html } from '@open-wc/testing';
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

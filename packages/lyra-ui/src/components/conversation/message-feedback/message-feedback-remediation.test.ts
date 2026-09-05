import { fixture, expect, html } from '@open-wc/testing';
import './message-feedback.js';
import type { LyraMessageFeedback } from './message-feedback.js';

describe('pending feedback settlement focus', () => {
  for (const settle of ['finalizePendingSubmit', 'revertPendingSubmit'] as const) {
    for (const timing of ['before', 'after'] as const) {
      it(`preserves outside focus moved ${timing} ${settle}`, async () => {
        const wrapper = await fixture<HTMLDivElement>(html`<div>
          <lr-message-feedback .detail=${{ commentable: true }}></lr-message-feedback>
          <button id="outside">Other work</button>
        </div>`);
        const feedback = wrapper.querySelector<LyraMessageFeedback>('lr-message-feedback')!;
        const outside = wrapper.querySelector<HTMLButtonElement>('#outside')!;
        let submissionId = '';
        feedback.addEventListener('lr-feedback-submit', (event) => {
          event.preventDefault();
          submissionId = (event as CustomEvent<{ submissionId: string }>).detail.submissionId;
        });
        feedback.shadowRoot!.querySelector<HTMLButtonElement>('[part="down-button"]')!.click();
        await feedback.updateComplete;
        const submit = feedback.shadowRoot!.querySelector<HTMLButtonElement>('[part="submit-button"]')!;
        submit.focus();
        submit.click();
        await feedback.updateComplete;
        expect(feedback.pending).to.be.true;
        if (timing === 'before') outside.focus();
        expect(feedback[settle](submissionId)).to.be.true;
        if (timing === 'after') outside.focus();
        await feedback.updateComplete;
        await Promise.resolve();
        expect(feedback.pending).to.be.false;
        expect(document.activeElement === outside).to.be.true;
        expect(feedback.shadowRoot!.querySelector('[part="panel"]')!.hasAttribute('data-open')).to.equal(settle === 'revertPendingSubmit');
      });
    }
  }
});

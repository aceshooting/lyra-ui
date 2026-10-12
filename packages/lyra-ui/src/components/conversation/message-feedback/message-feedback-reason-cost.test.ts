import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './message-feedback.js';
import type { LyraMessageFeedback, MessageFeedbackSubmitDetail } from './message-feedback.js';
import type { LyraChip } from '../../overlays/chip/chip.class.js';
import { measureArrayProbeReads } from '../../../../test/array-probe-reads.js';

it('renders selected reason membership with linear work while retaining submitted selection order', async () => {
  const reasons = Array.from({ length: 128 }, (_, index) => ({ id: `reason-cost-${index}`, label: `Reason ${index}` }));
  const feedback = await fixture<LyraMessageFeedback>(html`<lr-message-feedback .detail=${{ reasons }}></lr-message-feedback>`);
  feedback.shadowRoot!.querySelector<HTMLButtonElement>('[part="down-button"]')!.click();
  await feedback.updateComplete;
  expect(feedback.shadowRoot!.querySelector('[part="panel"]')!.getAttribute('aria-hidden')).to.equal('false');
  const seam = feedback as unknown as { selectedReasonIds: string[] };
  const selected = reasons.map((reason) => reason.id).reverse();
  seam.selectedReasonIds = selected;
  const measured = measureArrayProbeReads((array) => array === selected, () => feedback.render());
  await feedback.updateComplete;
  const chips = [...feedback.shadowRoot!.querySelectorAll<LyraChip>('lr-chip')];
  await Promise.all(chips.map((chip) => chip.updateComplete));
  expect(chips.length).to.equal(reasons.length);
  expect(chips.every((chip) => chip.selected)).to.equal(true);
  expect(chips.map((chip) => chip.textContent!.trim())).to.deep.equal(reasons.map((reason) => reason.label));
  const submitted = oneEvent(feedback, 'lr-feedback-submit-request');
  feedback.shadowRoot!.querySelector<HTMLButtonElement>('[part="submit-button"]')!.click();
  const detail = (await submitted).detail as MessageFeedbackSubmitDetail;
  expect(detail.reasonIds).to.deep.equal(selected);
  expect(detail.rating).to.equal('down');
  expect(measured.reads).to.be.at.most(reasons.length * 4);
});

it('preserves first reason labels and prunes removed selections before submitting', async () => {
  const feedback = await fixture<LyraMessageFeedback>(html`<lr-message-feedback .detail=${{ reasons: [
    { id: 'first', label: 'First label' }, { id: 'second', label: 'Second label' },
    { id: 'first', label: 'Duplicate label' }, { id: ' ', label: 'Blank identity' },
  ] }}></lr-message-feedback>`);
  feedback.shadowRoot!.querySelector<HTMLButtonElement>('[part="down-button"]')!.click();
  await feedback.updateComplete;
  const chips = [...feedback.shadowRoot!.querySelectorAll<LyraChip>('lr-chip')];
  await Promise.all(chips.map((chip) => chip.updateComplete));
  expect(chips.map((chip) => chip.textContent!.trim())).to.deep.equal(['First label', 'Second label']);
  chips[1]!.click();
  chips[0]!.click();
  await feedback.updateComplete;
  feedback.detail = { reasons: [{ id: 'first', label: 'Updated first' }] };
  await feedback.updateComplete;
  const remaining = feedback.shadowRoot!.querySelector<LyraChip>('lr-chip')!;
  await remaining.updateComplete;
  expect(remaining.selected).to.equal(true);
  expect(remaining.textContent!.trim()).to.equal('Updated first');
  const submitted = oneEvent(feedback, 'lr-feedback-submit-request');
  feedback.shadowRoot!.querySelector<HTMLButtonElement>('[part="submit-button"]')!.click();
  expect(((await submitted).detail as MessageFeedbackSubmitDetail).reasonIds).to.deep.equal(['first']);
});

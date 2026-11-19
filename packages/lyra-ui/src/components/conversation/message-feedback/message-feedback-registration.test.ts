import { expect, fixture, html } from '@open-wc/testing';
import { tag } from '../../../internal/prefix.js';
import './message-feedback.js';
import type { LyraMessageFeedback } from './message-feedback.class.js';

it('registers optional children only when their controls are rendered', async () => {
  const el = await fixture(html`<lr-message-feedback></lr-message-feedback>`) as LyraMessageFeedback;
  expect(Boolean(customElements.get(tag('chip')))).to.equal(false);
  el.detail = { commentable: true };
  await el.updateComplete;
  expect(Boolean(customElements.get(tag('chip')))).to.equal(false);
  el.detail = { reasons: [{ id: 'clear', label: 'Clear' }] };
  await el.updateComplete;
  const chip = el.shadowRoot!.querySelector('lr-chip')!;
  expect(chip.matches(':defined')).to.equal(true);
  expect(chip.textContent?.trim()).to.equal('Clear');
});

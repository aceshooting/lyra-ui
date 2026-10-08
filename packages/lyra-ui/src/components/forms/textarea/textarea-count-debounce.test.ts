import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './textarea.js';
import type { LyraTextarea } from './textarea.class.js';

it('announces only the latest character count after consecutive native keyboard edits', async () => {
  const el = await fixture<LyraTextarea>(html`<lr-textarea with-count aria-label="Notes"></lr-textarea>`);
  el.strings = { textareaCharacterCount: '{count} characters' };
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector<HTMLTextAreaElement>('textarea')!;
  const sink = document.querySelector<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`)!;
  await focusByKeyboard(input);
  await sendKeys({ type: 'a' });
  // wait-reason: lets the count-announcement debounce elapse so the next edit supersedes a fired announcement
  await aTimeout(120);
  await sendKeys({ type: 'bc' });
  await el.updateComplete;
  expect(el.value).to.equal('abc');
  expect(sink.childElementCount).to.equal(0);
  await waitUntil(() => sink.childElementCount === 1, 'latest count was not announced', { timeout: 1800 });
  expect(Array.from(sink.children, child => child.textContent)).to.deep.equal(['3 characters']);
});

import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';
import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './typing-indicator.js';
import type { LyraTypingIndicator } from './typing-indicator.js';

it('restores localized naming on removed label and accepts later caller copy', async () => {
  const el = await fixture<LyraTypingIndicator>(html`<lr-typing-indicator label="Caller copy" .strings=${{ thinking: 'Working now' }}></lr-typing-indicator>`);
  el.removeAttribute('label');
  await el.updateComplete;
  expect(el.label).to.equal(null);
  expect(el.getAttribute('aria-label')).to.equal('Working now');
  el.setAttribute('label', '');
  await el.updateComplete;
  expect(el.label).to.equal('');
  expect(el.getAttribute('aria-label')).to.equal('Working now');
  el.setAttribute('label', 'Again');
  await el.updateComplete;
  expect(el.getAttribute('aria-label')).to.equal('Again');
});

it('announces its label through the shared polite sink on mount and on label change', async () => {
  const sinkText = () =>
    [...document.querySelectorAll(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"] > *`)].map((node) => node.textContent);
  const el = await fixture<LyraTypingIndicator>(html`<lr-typing-indicator label="Drafting"></lr-typing-indicator>`);
  await waitUntil(() => sinkText().includes('Drafting'), 'the mount is announced');
  el.label = 'Searching';
  await waitUntil(() => sinkText().includes('Searching'), 'a label change is announced');
});

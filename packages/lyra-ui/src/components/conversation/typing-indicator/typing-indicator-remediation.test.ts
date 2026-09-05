import { expect, fixture, html } from '@open-wc/testing';
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

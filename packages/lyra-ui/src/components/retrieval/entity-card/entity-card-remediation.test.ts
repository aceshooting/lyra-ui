import { expect, fixture, html } from '@open-wc/testing';
import './entity-card.js';
import type { LyraEntityCard } from './entity-card.js';

it('updates the existing heading level override on attribute changes alone', async () => {
  const el = await fixture<LyraEntityCard>(html`<lr-entity-card
    .entity=${{ id: 'a', label: 'Alpha' }}
  ></lr-entity-card>`);
  const level = () => el.shadowRoot!.querySelector('[role="heading"]')!.getAttribute('aria-level');
  expect(level()).to.equal('3');
  for (const value of ['2', '4', '', null, '1']) {
    if (value === null) el.removeAttribute('aria-level');
    else el.setAttribute('aria-level', value);
    await el.updateComplete;
    expect(level()).to.equal(value || '3');
  }
  el.removeAttribute('aria-level');
  await el.updateComplete;
  expect(level()).to.equal('3');
});

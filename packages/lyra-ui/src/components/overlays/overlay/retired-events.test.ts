import { expect, fixture, html } from '@open-wc/testing';
import { captureDeprecationWarnings } from '../../../../test/expected-deprecations.js';
import '../chip/chip.js';
import '../../layout/page/page.js';
import type { LyraChip } from '../chip/chip.class.js';
import type { LyraPage } from '../../layout/page/page.class.js';

it('chip proposes the canonical detail before mutation and retains veto without the old notification', async () => {
  const el = await fixture<LyraChip>(html`<lr-chip toggleable value="one">One</lr-chip>`);
  let oldEvents = 0;
  let proposed: unknown;
  el.addEventListener('lr-chip-select', () => oldEvents++);
  const veto = (event: Event) => {
    proposed = (event as CustomEvent).detail;
    expect(el.selected).to.equal(false);
    event.preventDefault();
  };
  el.addEventListener('lr-chip-toggle-request', veto);
  await captureDeprecationWarnings([], async () => {
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part="toggle-button"]')!.click();
    await el.updateComplete;
    expect(proposed).to.deep.equal({ value: 'one', selected: true });
    expect(el.selected).to.equal(false);
    expect(oldEvents).to.equal(0);
    el.removeEventListener('lr-chip-toggle-request', veto);
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part="toggle-button"]')!.click();
    await el.updateComplete;
    expect(el.selected).to.equal(true);
    expect(oldEvents).to.equal(0);
  });
});

it('page canonical navigation request remains cancellable without the old notification', async () => {
  const el = await fixture<LyraPage>(html`<lr-page><p>Main content</p></lr-page>`);
  let oldEvents = 0;
  el.addEventListener('lr-nav-toggle', () => oldEvents++);
  const veto = (event: Event) => event.preventDefault();
  el.addEventListener('lr-nav-toggle-request', veto);
  el.showNavigation();
  expect(el.navOpen).to.equal(false);
  expect(oldEvents).to.equal(0);
  el.removeEventListener('lr-nav-toggle-request', veto);
  el.showNavigation();
  expect(el.navOpen).to.equal(true);
  expect(oldEvents).to.equal(0);
});

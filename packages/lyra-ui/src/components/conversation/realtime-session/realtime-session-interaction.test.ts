import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './realtime-session.js';

it('projects the host description onto the region and follows text edits', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div><p id="help">Description</p>
    <lr-realtime-session aria-describedby="help"></lr-realtime-session></div>`);
  const el = wrapper.querySelector('lr-realtime-session')!;
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  const description = wrapper.querySelector('p')!;
  const text = () => (base.ariaDescribedByElements ?? (base.getAttribute('aria-describedby') ?? '').split(/\s+/)
    .map(id => el.shadowRoot!.getElementById(id))).map(node => node?.textContent).join('');
  await waitUntil(() => text() === 'Description');
  description.textContent = 'Changed';
  await waitUntil(() => text() === 'Changed');
});

it('falls back to a localized name for whitespace-only overrides', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-realtime-session']>(html`<lr-realtime-session
    aria-label="  " label="   " .strings=${{ realtimeSessionLabel: 'Localized name' }}></lr-realtime-session>`);
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Localized name');
  el.setAttribute('aria-label', '  Named control  ');
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')?.trim()).to.equal('Named control');
});

it('configures recording and transcript controls and restores their defaults', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-realtime-session']>(html`<lr-realtime-session></lr-realtime-session>`);
  const capture = el.shadowRoot!.querySelector('lr-push-to-talk')!;
  const feed = el.shadowRoot!.querySelector('lr-transcript-feed')!;
  const values = () => [capture.mode, capture.deviceId, capture.mimeType, capture.timesliceMs, capture.maxDurationMs,
    capture.withoutTimer, capture.audioConstraints, feed.follow, feed.withTimestamps, feed.formatTimestamp, feed.maxRenderedEntries];
  const defaults = ['hold', '', '', 0, 0, false, undefined, true, false, undefined, 500];
  expect(values()).to.deep.equal(defaults);
  const formatTimestamp = () => 'Now';
  const audioConstraints = { echoCancellation: true };
  el.captureOptions = { mode: 'toggle', deviceId: 'chosen', mimeType: 'audio/webm', timesliceMs: 500, maxDurationMs: 10000,
    withoutTimer: true, audioConstraints };
  el.transcriptOptions = { follow: false, withTimestamps: true, formatTimestamp, maxRenderedEntries: 20 };
  await el.updateComplete;
  expect(values()).to.deep.equal(['toggle','chosen','audio/webm',500,10000,true,audioConstraints,false,true,formatTimestamp,20]);
  el.captureOptions = undefined;
  el.transcriptOptions = undefined;
  await el.updateComplete;
  expect(values()).to.deep.equal(defaults);
});

it('disables all built-in session actions in every connection state', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-realtime-session']>(html`<lr-realtime-session>
    <button slot="controls">Help</button></lr-realtime-session>`);
  const actions: string[] = [];
  for (const name of ['lr-connect', 'lr-disconnect', 'lr-mute-change', 'lr-interrupt']) {
    el.addEventListener(name, () => actions.push(name));
  }
  const capture = el.shadowRoot!.querySelector('lr-push-to-talk')!;
  for (const state of ['disconnected', 'connected'] as const) {
    el.state = state;
    el.setAttribute('disabled','');
    await el.updateComplete;
    const buttons = Array.from(el.shadowRoot!.querySelectorAll('button'));
    expect(buttons.length).to.equal(state === 'connected' ? 3 : 1);
    expect(buttons.every(button => button.disabled)).to.equal(true);
    for (const button of buttons) button.click();
    expect(capture.disabled).to.equal(true);
    el.removeAttribute('disabled');
    await el.updateComplete;
    expect(buttons.every(button => !button.disabled)).to.equal(true);
    expect(capture.disabled).to.equal(state !== 'connected');
  }
  expect(actions).to.deep.equal([]);
  expect(el.querySelector('button')!.disabled).to.equal(false);
});

it('projects authored label references onto the inner region through reconnect', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div><p id="region-name">Region name</p>
    <lr-realtime-session aria-labelledby="region-name"></lr-realtime-session></div>`);
  const el = wrapper.querySelector('lr-realtime-session')!;
  await el.updateComplete;
  const region = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  const name = () => (region.ariaLabelledByElements ?? (region.getAttribute('aria-labelledby') ?? '').split(/\s+/)
    .map(id => el.shadowRoot!.getElementById(id))).map(node => node?.textContent).join('');
  expect(name()).to.equal('Region name');
  el.remove();
  expect(name()).to.equal('');
  wrapper.append(el);
  await waitUntil(() => name() === 'Region name');
  el.removeAttribute('aria-labelledby');
  await waitUntil(() => name() === '');
});

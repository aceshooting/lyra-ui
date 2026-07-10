import { fixture, expect, html } from '@open-wc/testing';
import './time-range.js';
import type { LyraTimeRange } from './time-range.js';

it('reflects start/end as the range fill width', async () => {
  const el = (await fixture(
    html`<lyra-time-range min="0" max="100" start="20" end="80"></lyra-time-range>`,
  )) as LyraTimeRange;
  const range = el.shadowRoot!.querySelector('[part="range"]') as HTMLElement;
  expect(range.style.insetInlineStart).to.equal('20%');
  expect(range.style.inlineSize).to.equal('60%');
});

it('moves the start handle with ArrowRight and emits lyra-input then lyra-change', async () => {
  const el = (await fixture(
    html`<lyra-time-range min="0" max="100" start="20" end="80" step="5"></lyra-time-range>`,
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
  expect(startHandle.getAttribute('role')).to.equal('slider');
  // lyra-input/lyra-change are emitted synchronously from the keydown/keyup
  // handlers, so the listener must be attached before dispatch (matches the
  // convention used by lyra-split's keyboard-step tests).
  let inputDetail: { start: number; end: number } | undefined;
  el.addEventListener('lyra-input', (e) => (inputDetail = (e as CustomEvent).detail));
  startHandle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  expect(inputDetail!.start).to.equal(25);
  let changeDetail: { start: number; end: number } | undefined;
  el.addEventListener('lyra-change', (e) => (changeDetail = (e as CustomEvent).detail));
  startHandle.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true }));
  expect(changeDetail!.start).to.equal(25);
});

it('never lets the start handle pass the end handle', async () => {
  const el = (await fixture(
    html`<lyra-time-range min="0" max="100" start="78" end="80" step="5"></lyra-time-range>`,
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector('[part="handle-start"]') as HTMLElement;
  startHandle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await el.updateComplete;
  expect(el.start).to.equal(80);
});

it('is accessible', async () => {
  const el = (await fixture(
    html`<lyra-time-range min="0" max="100" start="20" end="80"></lyra-time-range>`,
  )) as LyraTimeRange;
  await expect(el).to.be.accessible();
});

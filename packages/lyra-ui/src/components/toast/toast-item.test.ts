import { fixture, expect, oneEvent, html } from '@open-wc/testing';
import './toast-item.js';
import type { LyraToastItem } from './toast-item.js';

it('emits lifecycle events and uses an assertive role for danger', async () => {
  const el = (await fixture(
    html`<lyra-toast-item variant="danger" duration="0">boom</lyra-toast-item>`,
  )) as LyraToastItem;

  await oneEvent(el, 'lyra-show');
  expect(el.getAttribute('role')).to.equal('alert');

  setTimeout(() => void el.hide());
  await oneEvent(el, 'lyra-after-hide');
  expect(el.isConnected).to.be.false;
});

it('uses a polite role for neutral/brand/success', async () => {
  const el = (await fixture(
    html`<lyra-toast-item variant="success" duration="0">ok</lyra-toast-item>`,
  )) as LyraToastItem;
  await oneEvent(el, 'lyra-show');
  expect(el.getAttribute('role')).to.equal('status');
});

it('auto-dismisses after its duration', async () => {
  const el = (await fixture(
    html`<lyra-toast-item duration="10">bye</lyra-toast-item>`,
  )) as LyraToastItem;
  await oneEvent(el, 'lyra-after-hide');
  expect(el.isConnected).to.be.false;
});

it('is accessible', async () => {
  const el = (await fixture(
    html`<lyra-toast-item variant="brand" duration="0">hello</lyra-toast-item>`,
  )) as LyraToastItem;
  await oneEvent(el, 'lyra-show');
  await expect(el).to.be.accessible();
});

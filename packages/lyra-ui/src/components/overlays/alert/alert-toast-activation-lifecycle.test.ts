import { aTimeout, expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import './alert.js';
import '../toast/toast.js';
import type { LyraAlert } from './alert.class.js';

it('settles a toast removed before activation without announcing a stale show', async () => {
  const el = await fixture<LyraAlert>(html`<lr-alert style="--lr-transition-fast:0ms;--lr-transition-medium:0ms">Notice</lr-alert>`);
  let shows = 0;
  let settled = false;
  el.addEventListener('lr-show', () => { shows += 1; });
  const completion = el.toast().then(() => { settled = true; });
  el.remove();
  await waitUntil(() => settled, 'removed pending toast did not settle');
  await completion;
  await aTimeout(30);
  expect(shows).to.equal(0);
  expect(el.open).to.equal(false);
});

it('retires a toast activation when the alert moves directly outside its owning region', async () => {
  const el = await fixture<LyraAlert>(html`<lr-alert style="--lr-transition-fast:0ms;--lr-transition-medium:0ms">Notice</lr-alert>`);
  const destination = await fixture<HTMLDivElement>(html`<div></div>`);
  let shows = 0;
  let settled = false;
  el.addEventListener('lr-show', () => { shows += 1; });
  const completion = el.toast().then(() => { settled = true; });
  destination.append(el);
  await waitUntil(() => settled, 'reparented pending toast did not settle');
  await completion;
  await aTimeout(30);
  expect(el.parentElement === destination).to.equal(true);
  expect(shows).to.equal(0);
  expect(el.open).to.equal(false);
});

it('can toast the same alert after an early cancelled activation without losing hide completion', async () => {
  const el = await fixture<LyraAlert>(html`<lr-alert style="--lr-transition-fast:0ms;--lr-transition-medium:0ms">Notice</lr-alert>`);
  const first = el.toast();
  el.remove();
  await first;
  const shown = oneEvent(el, 'lr-after-show');
  const second = el.toast();
  await shown;
  expect(el.open).to.equal(true);
  const hidden = oneEvent(el, 'lr-after-hide');
  await el.hide();
  await hidden;
  await second;
  expect(el.open).to.equal(false);
  expect(el.isConnected).to.equal(false);
});

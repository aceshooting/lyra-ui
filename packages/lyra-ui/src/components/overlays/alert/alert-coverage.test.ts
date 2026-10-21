import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './alert.js';
import type { LyraAlert } from './alert.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import {
  TOAST_REGION_ENQUEUE,
  TOAST_REGION_SET_ACTIVE,
  type ToastRegionController,
  type ToastRegionEntry,
} from '../toast/toast-region-protocol.js';

const motionless = '--lr-transition-fast:0ms;--lr-transition-medium:0ms;--lr-duration-fast:0ms;';

/** A region that implements only the enqueue/active half of the toast-region protocol. */
class AlertCoverageRegion extends HTMLElement {
  [TOAST_REGION_ENQUEUE](entry: ToastRegionEntry): void {
    if (entry.parentElement !== this) this.append(entry);
    entry[TOAST_REGION_SET_ACTIVE](this as unknown as ToastRegionController, true);
  }
}
customElements.define('alert-coverage-region', AlertCoverageRegion);

afterEach(() => {
  document.querySelectorAll('lr-alert').forEach((alert) => alert.remove());
});

// Keep first in the file: it needs lr-toast to be unregistered so toast() defers its own enqueue.
it('removes and settles a toast whose vetoed show is owned by a region without a reject hook', async () => {
  expect(customElements.get('lr-toast')).to.equal(undefined);
  const wrapper = await fixture<HTMLDivElement>(html`
    <div><alert-coverage-region></alert-coverage-region><lr-alert style=${motionless}>Notice</lr-alert></div>
  `);
  const region = wrapper.querySelector('alert-coverage-region') as AlertCoverageRegion;
  const el = wrapper.querySelector('lr-alert') as LyraAlert;
  await el.updateComplete;
  el.addEventListener('lr-show', (event) => event.preventDefault());

  const completion = el.toast();
  region[TOAST_REGION_ENQUEUE](el);
  await completion;

  expect(el.open).to.equal(false);
  expect(el.isConnected).to.equal(false);
  expect(region.childElementCount).to.equal(0);
});

it('settles a toast whose show listener vetoes it and detaches the alert', async () => {
  await import('../toast/toast.js');
  const el = await fixture<LyraAlert>(html`<lr-alert style=${motionless}>Detached by listener</lr-alert>`);
  el.addEventListener('lr-show', (event) => {
    event.preventDefault();
    el.remove();
  });

  await el.toast();

  expect(el.open).to.equal(false);
  expect(el.isConnected).to.equal(false);
});

it('returns focus to the previously focused control when a focused alert is queued behind a full region', async () => {
  await import('../toast/toast.js');
  const wrapper = await fixture<HTMLDivElement>(html`
    <div>
      <button id="outside">Outside</button>
      <lr-alert open closable style=${motionless}>Focused</lr-alert>
      <lr-toast></lr-toast>
    </div>
  `);
  const region = wrapper.querySelector('lr-toast') as HTMLElement & {
    [TOAST_REGION_ENQUEUE](entry: HTMLElement): void;
  };
  const el = wrapper.querySelector('lr-alert') as LyraAlert;
  await el.updateComplete;
  const close = el.shadowRoot!.querySelector<HTMLElement>('[part~="close-button"]')!;
  await focusByKeyboard(wrapper.querySelector<HTMLElement>('#outside')!);
  // Script focus straight from the outside control, so it is the alert's remembered return target.
  close.focus();
  expect(el.shadowRoot!.activeElement === close).to.equal(true);

  for (let index = 0; index < 3; index += 1) {
    const filler = document.createElement('lr-alert') as LyraAlert;
    filler.textContent = `Filler ${index}`;
    region[TOAST_REGION_ENQUEUE](filler);
  }
  region[TOAST_REGION_ENQUEUE](el);

  await waitUntil(() => document.activeElement?.id === 'outside', 'focus returns to the control focused before the alert');
  expect(el.hasAttribute('data-toast-queued')).to.equal(true);
});

it('restores focus inside a toast alert that is re-parented out of its region', async () => {
  await import('../toast/toast.js');
  const destination = await fixture<HTMLDivElement>(html`<div></div>`);
  const el = await fixture<LyraAlert>(html`<lr-alert closable style=${motionless}>Moved</lr-alert>`);
  const completion = el.toast();
  await waitUntil(() => el.open && el.parentElement?.localName === 'lr-toast', 'toast shown in its region');
  const close = el.shadowRoot!.querySelector<HTMLElement>('[part~="close-button"]')!;
  await focusByKeyboard(close);
  expect(el.shadowRoot!.activeElement === close).to.equal(true);

  destination.append(el);
  await completion;

  await waitUntil(() => el.shadowRoot!.activeElement === close, 'focus is restored to the moved alert');
  expect(el.parentElement === destination).to.equal(true);
});

it('settles a toast lifecycle when the alert is moved into a document with no browsing context', async () => {
  await import('../toast/toast.js');
  const el = await fixture<LyraAlert>(html`<lr-alert style=${motionless}>Elsewhere</lr-alert>`);
  const completion = el.toast();
  await waitUntil(() => el.open && el.parentElement?.localName === 'lr-toast', 'toast shown in its region');

  const detached = document.implementation.createHTMLDocument('detached');
  detached.body.append(el);
  await completion;

  expect(el.ownerDocument === detached).to.equal(true);
  el.remove();
});

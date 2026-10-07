import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
import { defineElement } from '../../../internal/prefix.js';
import { LyraToast } from './toast.class.js';
import { LyraToastItem } from './toast-item.class.js';

it('keeps declarative items when the item tag is defined before the region tag', async () => {
  expect(!customElements.get('lr-toast') && !customElements.get('lr-toast-item'), 'both tags start undefined').to.equal(true);
  const region = await fixture<HTMLElement>(html`<lr-toast><lr-toast-item duration="0">Saved</lr-toast-item></lr-toast>`);
  defineElement('toast-item', LyraToastItem);
  await aTimeout(0);
  defineElement('toast', LyraToast);
  const item = region.querySelector<LyraToastItem>('lr-toast-item');
  expect(item?.parentElement === region, 'the item is still in its region').to.equal(true);
  await waitUntil(() => item!.hasAttribute('data-visible'), 'the declarative item was never shown');
});

import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './thread-list.js';
import type { LyraThreadList } from './thread-list.js';

it('treats an explicitly empty slot attribute as default thread content', async () => {
  const el = await fixture<LyraThreadList>(html`<lr-thread-list><lr-conversation-item slot="" label="Thread"></lr-conversation-item></lr-thread-list>`);
  const item = el.querySelector('lr-conversation-item')!;
  await waitUntil(() => item.getAttribute('role') === 'listitem', 'default slotted thread should belong to the list');
  expect(el.shadowRoot!.querySelector('[part="list"]')?.getAttribute('role')).to.equal('list');
  item.setAttribute('slot', 'empty');
  await waitUntil(() => item.getAttribute('role') === null, 'moving out of default slot should release its generated role');
  const parent = el.parentElement!;
  el.remove();
  item.setAttribute('slot', '');
  parent.append(el);
  await el.updateComplete;
  await waitUntil(() => item.getAttribute('role') === 'listitem');
});

import { expect, fixture, html } from '@open-wc/testing';
import './prompt-queue.js';
import type { LyraPromptQueue, PromptQueueItem } from './prompt-queue.class.js';

it('omits revoked opaque rows and keeps later valid queue entries renderable', async () => {
  const revoked = Proxy.revocable({ id: 'hidden', value: 'Must be omitted' }, {});
  revoked.revoke();
  const rows = [
    { id: 'first', value: 'First draft' },
    revoked.proxy,
    { id: 'last', value: 'Last draft' },
  ] as unknown as PromptQueueItem[];
  const el = (await fixture(html`<lr-prompt-queue .items=${rows}></lr-prompt-queue>`)) as LyraPromptQueue;

  const rendered = [...el.shadowRoot!.querySelectorAll('[part~="item"]')];
  expect(rendered).to.have.lengthOf(2);
  expect([...el.shadowRoot!.querySelectorAll('lr-textarea')].map((editor) => (editor as HTMLElement & { value: string }).value)).to.deep.equal(['First draft', 'Last draft']);
});

it('keeps a valid row when its attachments collection is revoked and still projects a valid sibling attachment', async () => {
  const revokedAttachments = Proxy.revocable([], {});
  revokedAttachments.revoke();
  const rows = [
    { id: 'without-attachments', value: 'Keep this prompt', attachments: revokedAttachments.proxy },
    { id: 'with-attachment', value: 'Keep this file prompt', attachments: [{ id: 'doc', name: 'notes.txt' }] },
  ] as unknown as PromptQueueItem[];
  const el = (await fixture(html`<lr-prompt-queue .items=${rows}></lr-prompt-queue>`)) as LyraPromptQueue;

  expect(el.shadowRoot!.querySelectorAll('[part~="item"]')).to.have.lengthOf(2);
  expect([...el.shadowRoot!.querySelectorAll('[part="attachment"]')].map((part) => part.textContent?.trim())).to.deep.equal(['notes.txt']);
  expect([...el.shadowRoot!.querySelectorAll('lr-textarea')].map((editor) => (editor as HTMLElement & { value: string }).value)).to.deep.equal(['Keep this prompt', 'Keep this file prompt']);
});

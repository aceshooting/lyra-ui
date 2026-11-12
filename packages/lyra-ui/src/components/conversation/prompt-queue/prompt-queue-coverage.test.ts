import { expect, fixture, html } from '@open-wc/testing';
import './prompt-queue.js';
import type { LyraPromptQueue, PromptQueueItem } from './prompt-queue.class.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';

for (const selector of ['[part="editor"]', '[data-action="send"]']) {
  it(`retains focus in the queue region when disabling the focused ${selector}`, async () => {
    const items = [{ id: 'first', value: 'First draft' }, { id: 'second', value: 'Second draft' }];
    const el = await fixture<LyraPromptQueue>(html`<lr-prompt-queue .items=${items}></lr-prompt-queue>`);
    const control = el.shadowRoot!.querySelector<HTMLElement>(selector)!;
    await focusByKeyboard(control);
    expect(el.shadowRoot!.activeElement === control).to.equal(true);
    let requests = 0;
    el.addEventListener('lr-queue-change', () => { requests++; });
    el.addEventListener('lr-send-now', () => { requests++; });
    el.disabled = true;
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('base');
    expect(requests).to.equal(0);
    expect(el.items).to.deep.equal(items);
    el.disabled = false;
    await el.updateComplete;
    await focusByKeyboard(el.shadowRoot!.querySelector<HTMLElement>(selector)!);
    expect(el.shadowRoot!.activeElement?.closest('[data-id]')?.getAttribute('data-id')).to.equal('first');
  });
}

it('moves focus to the region when every pager is disabled and preserves the current page', async () => {
  const items = Array.from({ length: 41 }, (_, index) => ({ id: `q${index}`, value: `Prompt ${index}` }));
  const el = await fixture<LyraPromptQueue>(html`<lr-prompt-queue .items=${items}></lr-prompt-queue>`);
  const next = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-page-action="next"]')!;
  await focusByKeyboard(next);
  next.click();
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement?.getAttribute('data-page-action')).to.equal('next');
  expect(el.shadowRoot!.querySelector('[data-id]')?.getAttribute('data-id')).to.equal('q20');
  el.disabled = true;
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('base');
  expect([...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[data-page-action]')].every(button => button.disabled)).to.equal(true);
  el.disabled = false;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[data-id]')?.getAttribute('data-id')).to.equal('q20');
});

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

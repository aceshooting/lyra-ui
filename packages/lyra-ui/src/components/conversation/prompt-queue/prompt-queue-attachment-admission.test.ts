import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import type { PromptQueueItem, LyraPromptQueue } from './prompt-queue.class.js';
import './prompt-queue.js';

it('omits malformed attachments while retaining localized names and immutable send-now data', async () => {
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  const named = { id: 'named', name: '<b>notes.txt</b>' };
  const attachments = [null, 'invalid', [], { id: '', name: 'invalid' }, { id: 'invalid', name: 42 },
    revoked.proxy, { id: 'untitled', name: '' }, named];
  const element = await fixture<LyraPromptQueue>(html`<lr-prompt-queue readonly
    .items=${[{ id: 'draft', value: 'Keep this prompt', attachments }] as unknown as PromptQueueItem[]}
    .strings=${{ attachmentUntitledFile: 'Unnamed attachment' }}
  ></lr-prompt-queue>`);
  expect(element.shadowRoot!.querySelectorAll('[part="item"]').length).to.equal(1);
  expect(Array.from(element.shadowRoot!.querySelectorAll('[part="attachment"]'), node => node.textContent?.trim()))
    .to.deep.equal(['Unnamed attachment', '<b>notes.txt</b>']);
  expect(element.shadowRoot!.querySelectorAll('[part="attachment"] b').length).to.equal(0);
  named.name = 'Changed after assignment';
  element.requestUpdate();
  await element.updateComplete;
  const sent = oneEvent(element, 'lr-send-now');
  element.shadowRoot!.querySelector<HTMLElement>('[data-action="send"]')!.click();
  const event = await sent;
  expect(event.detail.item.value).to.equal('Keep this prompt');
  expect(event.detail.item.attachments).to.deep.equal([
    { id: 'untitled', name: '' }, { id: 'named', name: '<b>notes.txt</b>' },
  ]);
  expect(Object.isFrozen(event.detail.item.attachments)).to.equal(true);
  expect(event.bubbles && event.composed).to.equal(true);
  expect(element.shadowRoot!.querySelector('[part="attachment"]')?.textContent?.trim()).to.equal('Unnamed attachment');
});

function invalidLengthAttachments(): unknown[] {
  return new Proxy([], { getOwnPropertyDescriptor(target, key) {
    const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
    return key === 'length' && descriptor ? { ...descriptor, value: -1 } : descriptor;
  } });
}

for (const kind of ['not an array', 'invalid length'] as const) {
  it(`keeps a prompt with ${kind} attachment data and admits a subsequent valid assignment`, async () => {
    const attachments = kind === 'not an array' ? { id: 'not-a-sequence', name: 'ignored' } : invalidLengthAttachments();
    const element = await fixture<LyraPromptQueue>(html`<lr-prompt-queue readonly
      .items=${[{ id: 'draft', value: 'Retained prompt', attachments }] as unknown as PromptQueueItem[]}
    ></lr-prompt-queue>`);
    expect(element.shadowRoot!.querySelector('[part="value"]')?.textContent).to.equal('Retained prompt');
    expect(element.shadowRoot!.querySelectorAll('[part="attachments"]').length).to.equal(0);
    const sent = oneEvent(element, 'lr-send-now');
    element.shadowRoot!.querySelector<HTMLElement>('[data-action="send"]')!.click();
    expect(Object.hasOwn((await sent).detail.item, 'attachments')).to.equal(false);
    element.items = [{ id: 'replacement', value: 'Valid prompt', attachments: [{ id: 'file', name: 'recovered.txt' }] }];
    await element.updateComplete;
    expect(element.shadowRoot!.querySelector('[part="attachment"]')?.textContent?.trim()).to.equal('recovered.txt');
    const recovered = oneEvent(element, 'lr-send-now');
    element.shadowRoot!.querySelector<HTMLElement>('[data-action="send"]')!.click();
    expect((await recovered).detail.item.attachments).to.deep.equal([{ id: 'file', name: 'recovered.txt' }]);
  });
}

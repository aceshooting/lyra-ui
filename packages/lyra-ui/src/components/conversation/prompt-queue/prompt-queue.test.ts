import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './prompt-queue.js';
import type {
  LyraPromptQueue,
  PromptQueueChangeDetail,
  PromptQueueItem,
} from './prompt-queue.class.js';

const items: PromptQueueItem[] = [
  { id: 'one', value: 'First follow-up' },
  { id: 'two', value: 'Second follow-up' },
];

it('renders an editable ordered queue', async () => {
  const el = (await fixture(html`<lr-prompt-queue .items=${items}></lr-prompt-queue>`)) as LyraPromptQueue;
  expect(el.shadowRoot!.querySelectorAll('[part~="item"]')).to.have.lengthOf(2);
  expect(el.shadowRoot!.querySelectorAll('lr-textarea')).to.have.lengthOf(2);
  expect(el.shadowRoot!.querySelector('[part="list"]')?.getAttribute('role')).to.equal('list');
});

it('emits the complete reordered value without mutating the controlled items property', async () => {
  const el = (await fixture(html`<lr-prompt-queue .items=${items}></lr-prompt-queue>`)) as LyraPromptQueue;
  const changed = oneEvent(el, 'lr-queue-change');
  (el.shadowRoot!.querySelector('[data-action="down"]') as HTMLElement).click();
  const event = await changed as CustomEvent<PromptQueueChangeDetail>;
  expect(event.detail.items.map((item) => item.id)).to.deep.equal(['two', 'one']);
  expect(el.items.map((item) => item.id)).to.deep.equal(['one', 'two']);
  expect(event.detail.reason).to.equal('reorder');
});

it('emits edit, remove, and send-now requests with stable ids', async () => {
  const el = (await fixture(html`<lr-prompt-queue .items=${items}></lr-prompt-queue>`)) as LyraPromptQueue;

  const edited = oneEvent(el, 'lr-queue-change');
  el.shadowRoot!.querySelector('lr-textarea')!.dispatchEvent(
    new CustomEvent('lr-input', { bubbles: true, composed: true, detail: { value: 'Edited' } }),
  );
  const editEvent = await edited as CustomEvent<PromptQueueChangeDetail>;
  expect(editEvent.detail.items[0]?.value).to.equal('Edited');
  expect(editEvent.detail.reason).to.equal('edit');

  const removed = oneEvent(el, 'lr-queue-change');
  (el.shadowRoot!.querySelector('[data-action="remove"]') as HTMLElement).click();
  const removeEvent = await removed as CustomEvent<PromptQueueChangeDetail>;
  expect(removeEvent.detail.items.map((item) => item.id)).to.deep.equal(['two']);
  expect(removeEvent.detail.reason).to.equal('remove');

  const sent = oneEvent(el, 'lr-send-now');
  (el.shadowRoot!.querySelector('[data-action="send"]') as HTMLElement).click();
  const sendEvent = await sent as CustomEvent<{ item: PromptQueueItem }>;
  expect(sendEvent.detail.item.id).to.equal('one');
});

it('honors editable="false" and is accessible while populated', async () => {
  const el = (await fixture(
    html`<lr-prompt-queue editable="false" .items=${items}></lr-prompt-queue>`,
  )) as LyraPromptQueue;
  expect(el.editable).to.be.false;
  expect(el.shadowRoot!.querySelectorAll('lr-textarea')).to.have.lengthOf(0);
  expect(el.shadowRoot!.querySelectorAll('[part="value"]')).to.have.lengthOf(2);
  await expect(el).to.be.accessible();
});

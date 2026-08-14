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

it('moves focus to the equivalent action on the nearest survivor after controlled removal', async () => {
  const controlledItems: PromptQueueItem[] = [
    { id: 'one', value: 'First follow-up' },
    { id: 'two', value: 'Second follow-up' },
    { id: 'three', value: 'Third follow-up' },
  ];
  const el = (await fixture(
    html`<lr-prompt-queue .items=${controlledItems}></lr-prompt-queue>`,
  )) as LyraPromptQueue;
  el.addEventListener('lr-queue-change', (event) => {
    el.items = event.detail.items;
  });
  const removeActions = el.shadowRoot!.querySelectorAll<HTMLElement>('[data-action="remove"]');
  removeActions[1]!.focus();
  removeActions[1]!.click();
  await el.updateComplete;

  const focusedAction = el.shadowRoot!.activeElement as HTMLElement | null;
  expect(focusedAction?.getAttribute('data-action')).to.equal('remove');
  expect(focusedAction?.closest('[data-id]')?.getAttribute('data-id')).to.equal('three');
});

it('uses the nearest enabled action when the equivalent action becomes disabled after removal', async () => {
  const controlledItems: PromptQueueItem[] = [
    { id: 'one', value: 'First follow-up' },
    { id: 'two', value: 'Second follow-up' },
    { id: 'three', value: 'Third follow-up' },
  ];
  const el = (await fixture(
    html`<lr-prompt-queue .items=${controlledItems}></lr-prompt-queue>`,
  )) as LyraPromptQueue;
  el.addEventListener('lr-queue-change', (event) => {
    el.items = event.detail.items;
  });
  const middleDown = el.shadowRoot!.querySelectorAll<HTMLElement>('[data-action="down"]')[1]!;
  middleDown.focus();
  el.shadowRoot!.querySelectorAll<HTMLElement>('[data-action="remove"]')[1]!.click();
  await el.updateComplete;

  const focusedAction = el.shadowRoot!.activeElement as HTMLElement | null;
  expect(focusedAction?.getAttribute('data-action')).to.equal('up');
  expect(focusedAction?.closest('[data-id]')?.getAttribute('data-id')).to.equal('three');
});

it('moves focus from an editor to the nearest enabled row action when editable becomes false', async () => {
  const el = (await fixture(
    html`<lr-prompt-queue .items=${items}></lr-prompt-queue>`,
  )) as LyraPromptQueue;
  const editor = el.shadowRoot!.querySelector('lr-textarea') as HTMLElement & {
    updateComplete: Promise<unknown>;
  };
  await editor.updateComplete;
  editor.focus();

  el.editable = false;
  await el.updateComplete;

  const focusedAction = el.shadowRoot!.activeElement as HTMLElement | null;
  expect(focusedAction?.getAttribute('data-action')).to.equal('down');
  expect(focusedAction?.closest('[data-id]')?.getAttribute('data-id')).to.equal('one');
});

it('moves focus to the queue region when controlled removal empties the queue', async () => {
  const el = (await fixture(
    html`<lr-prompt-queue .items=${[items[0]!]}></lr-prompt-queue>`,
  )) as LyraPromptQueue;
  el.addEventListener('lr-queue-change', (event) => {
    el.items = event.detail.items;
  });
  const removeAction = el.shadowRoot!.querySelector<HTMLElement>('[data-action="remove"]')!;
  removeAction.focus();
  removeAction.click();
  await el.updateComplete;

  expect(el.items).to.have.lengthOf(0);
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('base');
});

it('does not steal external focus when a controlled update removes an unfocused row', async () => {
  const wrapper = await fixture(html`
    <div>
      <button id="outside">Outside</button>
      <lr-prompt-queue .items=${items}></lr-prompt-queue>
    </div>
  `);
  const el = wrapper.querySelector('lr-prompt-queue') as LyraPromptQueue;
  wrapper.querySelector<HTMLElement>('#outside')!.focus();
  el.items = [items[1]!];
  await el.updateComplete;

  expect(el.ownerDocument.activeElement?.id).to.equal('outside');
});

it('applies per-instance strings to the queue label', async () => {
  const el = (await fixture(
    html`<lr-prompt-queue
      .items=${items}
      .strings=${{ promptQueueLabel: 'Invites en attente' }}
    ></lr-prompt-queue>`,
  )) as LyraPromptQueue;
  expect(el.shadowRoot!.querySelector('[part="base"]')?.getAttribute('aria-label')).to.equal(
    'Invites en attente',
  );
  expect(el.shadowRoot!.querySelector('[part="heading"]')?.textContent?.trim()).to.equal(
    'Invites en attente',
  );
});

it('localizes the editable item label as a whole template with a locale-formatted index', async () => {
  const el = (await fixture(html`
    <lr-prompt-queue
      lang="ar"
      .items=${items}
      .strings=${{ promptQueueItemLabel: 'ITEM {index}' }}
    ></lr-prompt-queue>
  `)) as LyraPromptQueue;
  const textarea = el.shadowRoot!.querySelector('lr-textarea') as HTMLElement & { label: string };
  expect(textarea.label).to.equal(`ITEM ${new Intl.NumberFormat('ar').format(1)}`);
});

it('gives every repeated action a row-contextual accessible name', async () => {
  const el = (await fixture(html`<lr-prompt-queue .items=${items}></lr-prompt-queue>`)) as LyraPromptQueue;
  const names = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[data-action="send"]')].map((button) =>
    button.getAttribute('aria-label'),
  );
  expect(names).to.deep.equal(['Send now, queued prompt 1', 'Send now, queued prompt 2']);
  expect(new Set(names).size).to.equal(items.length);

  const removeNames = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[data-action="remove"]')].map((button) =>
    button.getAttribute('aria-label'),
  );
  expect(removeNames).to.deep.equal(['Remove, queued prompt 1', 'Remove, queued prompt 2']);
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

it('applies per-instance localized strings', async () => {
  const el = (await fixture(html`<lr-prompt-queue
    .strings=${{ promptQueueLabel: 'Localized prompt backlog' }}
  ></lr-prompt-queue>`)) as LyraPromptQueue;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Localized prompt backlog');
});

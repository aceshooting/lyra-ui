import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { LyraConversationItem } from '../conversation-item/conversation-item.class.js';
import type { LyraThreadList } from './thread-list.js';
import './thread-list.js';

it('moves native Home and End across slotted threads while skipping hidden and inert endpoints', async () => {
  const element = await fixture<LyraThreadList>(html`<lr-thread-list>
    <lr-conversation-item conversation-id="hidden" label="Hidden" hidden></lr-conversation-item>
    <lr-conversation-item conversation-id="first" label="First"></lr-conversation-item>
    <lr-conversation-item conversation-id="middle" label="Unavailable" inert></lr-conversation-item>
    <lr-conversation-item conversation-id="last" label="Last"></lr-conversation-item>
    <lr-conversation-item conversation-id="inert" label="Inert endpoint" inert></lr-conversation-item>
  </lr-thread-list>`);
  const first = element.itemElement('first')!, last = element.itemElement('last')!;
  await Promise.all([first.updateComplete, last.updateComplete]);
  const firstButton = first.shadowRoot!.querySelector<HTMLElement>('[part="select-button"]')!;
  const lastButton = last.shadowRoot!.querySelector<HTMLElement>('[part="select-button"]')!;
  await focusByKeyboard(firstButton);
  await sendKeys({ press: 'End' });
  await waitUntil(() => last.shadowRoot!.activeElement === lastButton, 'End reaches the last available slotted row');
  await sendKeys({ press: 'ArrowDown' });
  expect(last.shadowRoot!.activeElement === lastButton).to.equal(true);
  await sendKeys({ press: 'Home' });
  await waitUntil(() => first.shadowRoot!.activeElement === firstButton, 'Home reaches the first available slotted row');
  await sendKeys({ press: 'ArrowUp' });
  expect(first.shadowRoot!.activeElement === firstButton).to.equal(true);
  await sendKeys({ press: 'ArrowDown' });
  await waitUntil(() => last.shadowRoot!.activeElement === lastButton, 'arrow navigation skips the inert middle row');
});

it('preserves native search editing before ArrowDown enters the first available slotted thread', async () => {
  const element = await fixture<LyraThreadList>(html`<lr-thread-list searchable>
    <lr-conversation-item conversation-id="hidden" label="Hidden" hidden></lr-conversation-item>
    <lr-conversation-item conversation-id="available" label="Available"></lr-conversation-item>
  </lr-thread-list>`);
  const input = element.shadowRoot!.querySelector<HTMLInputElement>('[part="search-input"]')!;
  const available = element.itemElement('available')!;
  await available.updateComplete;
  const button = available.shadowRoot!.querySelector<HTMLElement>('[part="select-button"]')!;
  await focusByKeyboard(input);
  input.value = 'draft'; input.setSelectionRange(2, 2);
  await sendKeys({ press: 'ArrowLeft' });
  expect(element.shadowRoot!.activeElement === input).to.equal(true);
  expect(input.selectionStart).to.equal(1);
  expect(input.value).to.equal('draft');
  await sendKeys({ press: 'ArrowDown' });
  await waitUntil(() => available.shadowRoot!.activeElement === button, 'search navigation reaches a visible slotted thread');
});

it('excludes named-slot rows from lookup and keyboard boundaries until they join the default slot', async () => {
  const element = await fixture<LyraThreadList>(html`<lr-thread-list>
    <div><lr-conversation-item conversation-id="first" label="First"></lr-conversation-item></div>
    <lr-conversation-item conversation-id="last" label="Last"></lr-conversation-item>
    <lr-conversation-item slot="unassigned" conversation-id="outside" label="Outside"></lr-conversation-item>
  </lr-thread-list>`);
  const first = element.itemElement('first')!, last = element.itemElement('last')!;
  const outside = element.querySelector<LyraConversationItem>('lr-conversation-item[slot="unassigned"]')!;
  await Promise.all([first.updateComplete, last.updateComplete, outside.updateComplete]);
  expect(element.itemElement('outside') === null).to.equal(true);
  await focusByKeyboard(first.shadowRoot!.querySelector<HTMLElement>('[part="select-button"]')!);
  await sendKeys({ press: 'End' });
  await waitUntil(() => last.shadowRoot!.activeElement?.getAttribute('part') === 'select-button');
  outside.slot = '';
  await waitUntil(() => outside.assignedSlot?.name === '');
  expect(element.itemElement('outside') === outside).to.equal(true);
  await sendKeys({ press: 'End' });
  await waitUntil(() => outside.shadowRoot!.activeElement?.getAttribute('part') === 'select-button');
});

it('respects a slotted row action that consumes End and navigates when an arrow is unhandled', async () => {
  const element = await fixture<LyraThreadList>(html`<lr-thread-list>
    <lr-conversation-item conversation-id="first" label="First"><button slot="actions">Row action</button></lr-conversation-item>
    <lr-conversation-item conversation-id="last" label="Last"></lr-conversation-item>
  </lr-thread-list>`);
  const first = element.itemElement('first')!, last = element.itemElement('last')!;
  await Promise.all([first.updateComplete, last.updateComplete]);
  const action = first.querySelector<HTMLButtonElement>('button')!;
  action.addEventListener('keydown', event => { if (event.key === 'End') event.preventDefault(); });
  await focusByKeyboard(action);
  await sendKeys({ press: 'End' });
  expect(document.activeElement === action).to.equal(true);
  await sendKeys({ press: 'ArrowDown' });
  await waitUntil(() => last.shadowRoot!.activeElement?.getAttribute('part') === 'select-button');
  await sendKeys({ press: 'ArrowUp' });
  await waitUntil(() => first.shadowRoot!.activeElement?.getAttribute('part') === 'select-button');
});

it('renders ungrouped source order when custom grouping has no callback and groups after one is supplied', async () => {
  const threads = [{ id: 'second', title: 'Second', project: 'beta' }, { id: 'first', title: 'First', project: 'alpha' }];
  const element = await fixture<LyraThreadList>(html`<lr-thread-list style="block-size:400px" grouping="custom" .threads=${threads}></lr-thread-list>`);
  await waitUntil(() => element.itemElement('first') !== null);
  const list = element.shadowRoot!.querySelector('lr-virtual-list')!;
  const labels = () => list.renderedRows.flatMap(row => [...row.querySelectorAll<HTMLElement>('[part="group-label"]')].map(label => label.textContent));
  const ids = () => list.renderedRows.flatMap(row => [...row.querySelectorAll('lr-conversation-item')].map(item => item.conversationId));
  expect(labels()).to.deep.equal([]);
  expect(ids()).to.deep.equal(['second', 'first']);
  element.groupBy = thread => threads.find(value => value.id === thread.id)!.project;
  await element.updateComplete; await list.updateComplete;
  await waitUntil(() => labels().length === 2);
  expect(labels()).to.deep.equal(['beta', 'alpha']);
  expect(ids()).to.deep.equal(['second', 'first']);
});

it('passes the first day of an older month to the authored date formatter for its group label', async () => {
  const received: number[][] = [];
  const formatDate = (date: Date) => {
    received.push([date.getFullYear(), date.getMonth(), date.getDate()]);
    return `Archive ${date.getFullYear()} / ${date.getMonth() + 1}`;
  };
  const element = await fixture<LyraThreadList>(html`<lr-thread-list style="block-size:400px" .formatDate=${formatDate}
    .threads=${[{ id: 'old', title: 'Older conversation', timestamp: new Date(2020, 1, 15) }]}></lr-thread-list>`);
  await waitUntil(() => element.itemElement('old') !== null);
  const list = element.shadowRoot!.querySelector('lr-virtual-list')!;
  const labels = list.renderedRows.flatMap(row => [...row.querySelectorAll<HTMLElement>('[part="group-label"]')].map(label => label.textContent));
  expect(labels).to.deep.equal(['Archive 2020 / 2']);
  expect(received).to.deep.equal([[2020, 1, 1]]);
  expect(element.itemElement('old')!.label).to.equal('Older conversation');
});

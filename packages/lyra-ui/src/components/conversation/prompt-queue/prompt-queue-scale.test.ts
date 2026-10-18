import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import { sinkTexts } from '../../../../test/announcements.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import { LyraPromptQueue, type PromptQueueItem, type PromptQueueChangeDetail } from './prompt-queue.js';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
import { collectionTruncationWarningKey } from '../../../internal/collection-snapshot.js';
expectDevWarning(collectionTruncationWarningKey('lr-prompt-queue', 'items'));

it('shares a ten-thousand attachment inspection budget across one queue assignment', () => {
  let reads = 0;
  const attachments = new Proxy(new Array(10_000), {
    getOwnPropertyDescriptor(target, key) {
      if (typeof key === 'string' && /^\d+$/.test(key)) {
        reads++;
        return { configurable: true, enumerable: true, value: { id: 'doc', name: 'Document' } };
      }
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
  // One hundred rows each expose 10,000 logical positions; no million-object allocation.
  const el = new LyraPromptQueue();
  el.items = Array.from({ length: 100 }, (_, index) => ({ id: `q${index}`, value: 'Prompt', attachments }));
  const admitted = (el as unknown as { effectiveItems: readonly PromptQueueItem[] }).effectiveItems;
  expect(reads).to.be.at.most(10_000);
  recordScaleMeasurement('lr-prompt-queue', 'n=1000000 logical attachment positions', { inspected: reads, retained: admitted.reduce((sum, item) => sum + (item.attachments?.length ?? 0), 0) });
  expect(admitted.reduce((sum, item) => sum + (item.attachments?.length ?? 0), 0)).to.equal(10_000);
});

it('reuses untouched frozen records and attachment arrays in complete emitted proposals', async () => {
  const items = Array.from({ length: 3 }, (_, index) => ({ id: `q${index}`, value: 'Prompt', attachments: [{ id: `d${index}`, name: 'Document' }] }));
  const el = await fixture<LyraPromptQueue>(html`<lr-prompt-queue .items=${items}></lr-prompt-queue>`);
  const editor = el.shadowRoot!.querySelector('[part="editor"]')!;
  const emitEdit = async (value: string) => {
    const pending = oneEvent(el, 'lr-queue-change');
    editor.dispatchEvent(new CustomEvent('lr-input', { detail: { value }, bubbles: true, composed: true }));
    return (await pending as CustomEvent<PromptQueueChangeDetail>).detail;
  };
  const first = await emitEdit('First');
  el.items = first.items;
  await el.updateComplete;
  const second = await emitEdit('Second');
  expect(second.items.map(item => item.id)).to.deep.equal(['q0', 'q1', 'q2']);
  expect(first.items[1] === second.items[1]).to.equal(true);
  expect(first.items[0]!.attachments === second.items[0]!.attachments).to.equal(true);
  expect(first.items[0] === second.items[0]).to.equal(false);
  expect(Object.isFrozen(second.items[1])).to.equal(true);
  expect(Object.isFrozen(second.items[0]!.attachments)).to.equal(true);
});

it('pages admitted rows and exposes the last of ten thousand prompts without mounting them all', async () => {
  const rows = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `q${index}`, value: `Prompt ${index}` }));
  const el = await fixture<LyraPromptQueue>(html`<lr-prompt-queue .items=${rows(100)}></lr-prompt-queue>`);
  expect(el.shadowRoot!.querySelectorAll('[part="item"]').length).to.be.at.most(20);
  el.items = rows(10_000);
  await el.updateComplete;
  el.shadowRoot!.querySelector<HTMLButtonElement>('[data-page-action="last"]')!.click();
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[data-id="q9999"]') !== null).to.equal(true);
  expect(el.shadowRoot!.querySelectorAll('[part="editor"]').length).to.be.at.most(20);
  const proposal = oneEvent(el, 'lr-queue-change');
  el.shadowRoot!.querySelector('[data-id="q9999"] [part="editor"]')!.dispatchEvent(new CustomEvent('lr-input', { detail: { value: 'Last edited' }, bubbles: true, composed: true }));
  const detail = (await proposal as CustomEvent<PromptQueueChangeDetail>).detail;
  expect(detail.items.length).to.equal(10_000);
  recordScaleMeasurement('lr-prompt-queue', 'n=10000 last page edit', { mountedEditors: el.shadowRoot!.querySelectorAll('[part="editor"]').length, proposalRows: detail.items.length });
  expect(detail.items[9999]!.value).to.equal('Last edited');
  el.items = rows(1);
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[data-id="q0"]') !== null).to.equal(true);
});

it('previews at most fifty retained attachments per row', async () => {
  const attachments = Array.from({ length: 100 }, (_, index) => ({ id: `d${index}`, name: `Document ${index}` }));
  const el = await fixture<LyraPromptQueue>(html`<lr-prompt-queue .items=${[{ id: 'q', value: 'Prompt', attachments }]}></lr-prompt-queue>`);
  expect(el.shadowRoot!.querySelectorAll('[part="attachment"]').length).to.equal(50);
  expect(el.shadowRoot!.querySelector('[part="attachment-limit"]')?.textContent).to.include('50 of 100 retained attachments');
  const pending = oneEvent(el, 'lr-send-now');
  el.shadowRoot!.querySelector<HTMLElement>('[data-action="send"]')!.click();
  expect((await pending as CustomEvent<{ item: PromptQueueItem }>).detail.item.attachments?.length).to.equal(100);
});

it('keeps an unaccepted editor draft across pages and follows a focused accepted boundary reorder', async () => {
  const items = Array.from({ length: 21 }, (_, index) => ({ id: `q${index}`, value: `Prompt ${index}` }));
  const el = await fixture<LyraPromptQueue>(html`<lr-prompt-queue .items=${items}></lr-prompt-queue>`);
  const editor = el.shadowRoot!.querySelector('[data-id="q0"] [part="editor"]')!;
  editor.dispatchEvent(new CustomEvent('lr-input', { detail: { value: 'Unaccepted draft' }, bubbles: true, composed: true }));
  el.shadowRoot!.querySelector<HTMLButtonElement>('[data-page-action="next"]')!.click();
  await el.updateComplete;
  el.shadowRoot!.querySelector<HTMLButtonElement>('[data-page-action="previous"]')!.click();
  await el.updateComplete;
  expect((el.shadowRoot!.querySelector('[data-id="q0"] [part="editor"]') as HTMLElement & { value: string }).value).to.equal('Unaccepted draft');
  el.addEventListener('lr-queue-change', event => { el.items = event.detail.items; });
  const down = el.shadowRoot!.querySelector<HTMLElement>('[data-id="q19"] [data-action="down"]')!;
  await focusByKeyboard(down);
  down.click();
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement?.closest('[data-id]')?.getAttribute('data-id')).to.equal('q19');
  expect(el.shadowRoot!.querySelector('[part="page-status"]')?.textContent).to.include('2 of 2');
});

it('discloses aggregate attachment loss quietly on mount and announces later input loss', async () => {
  const attachments = Array.from({ length: 10_001 }, (_, index) => ({ id: `d${index}`, name: 'Document' }));
  const el = await fixture<LyraPromptQueue>(html`<lr-prompt-queue .items=${[{ id: 'q', value: 'Prompt', attachments }]}></lr-prompt-queue>`);
  expect(el.shadowRoot!.querySelector('[part="input-limit"]')?.textContent).to.include('Some queued prompts or attachments were omitted');
  expect(sinkTexts().some(text => text.includes('Some queued prompts or attachments were omitted'))).to.equal(false);
  el.strings = { promptQueueInputLimit: 'Queue input omitted', promptQueueAttachmentLimit: '{shown}/{total} attachments' };
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="attachment-limit"]')?.textContent).to.equal('50/10,000 attachments');
  el.items = [{ id: 'safe', value: 'Safe' }];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="input-limit"]') === null).to.equal(true);
  el.items = Array.from({ length: 10_001 }, (_, index) => ({ id: `q${index}`, value: 'Prompt' }));
  await el.updateComplete;
  expect(sinkTexts()).to.include('Queue input omitted');
  el.disabled = true;
  await el.updateComplete;
  el.shadowRoot!.querySelector<HTMLButtonElement>('[data-page-action="last"]')!.click();
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[data-id="q0"]') !== null).to.equal(true);
  el.disabled = false;
  el.readonly = true;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="editor"]').length).to.equal(0);
});

it('counts invalid attachment positions against the shared inspection allowance without invoking accessors', () => {
  let getters = 0;
  const invalid = new Array(10_000);
  for (let index = 0; index < invalid.length; index++) Object.defineProperty(invalid, index, { get() { getters++; return { id: 'bad', name: 'Bad' }; } });
  const el = new LyraPromptQueue();
  el.items = [{ id: 'a', value: 'A', attachments: invalid }, { id: 'b', value: 'B', attachments: [{ id: 'safe', name: 'Safe' }] }];
  const rows = (el as unknown as { effectiveItems: readonly PromptQueueItem[] }).effectiveItems;
  expect(getters).to.equal(0);
  expect(rows.length).to.equal(2);
  expect(rows[1]!.attachments?.length).to.equal(0);
});

it('keeps focus in the queue when replacement removes its focused pager', async () => {
  const el = await fixture<LyraPromptQueue>(html`<lr-prompt-queue .items=${Array.from({ length: 21 }, (_, index) => ({ id: `q${index}`, value: `Prompt ${index}` }))}></lr-prompt-queue>`);
  await focusByKeyboard(el.shadowRoot!.querySelector<HTMLButtonElement>('[data-page-action="next"]')!);
  el.items = [];
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('base');
});


it('moves endpoint pager focus to an enabled control in both directions', async () => {
  const el = await fixture<LyraPromptQueue>(html`<lr-prompt-queue .items=${Array.from({ length: 21 }, (_, index) => ({ id: `q${index}`, value: `Prompt ${index}` }))}></lr-prompt-queue>`);
  for (const action of ['next', 'previous']) {
    const button = el.shadowRoot!.querySelector<HTMLButtonElement>(`[data-page-action="${action}"]`)!;
    await focusByKeyboard(button);
    button.click();
    await el.updateComplete;
    const focused = el.shadowRoot!.activeElement as HTMLButtonElement | null;
    expect(focused?.hasAttribute('data-page-action')).to.equal(true);
    expect(focused?.disabled).to.equal(false);
  }
});

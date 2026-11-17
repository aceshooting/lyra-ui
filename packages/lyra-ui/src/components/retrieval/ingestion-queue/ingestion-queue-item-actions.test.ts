import { expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
import { deepActiveElementIn } from '../../../internal/active-element.js';
import { composedContains } from '../../../internal/overlay-stack.js';
import './ingestion-queue.js';
import type { LyraIngestionQueue, IngestionQueueItem, IngestionQueueSourceQuery } from './ingestion-queue.class.js';
import type { LyraPageSource, LyraSourceRecord } from '../../../data-sources.js';
import type { LyraVirtualList } from '../../layout/virtual-list/virtual-list.class.js';

type Action = { readonly type: 'retry' | 'cancel'; readonly disabled?: boolean } |
  { readonly type: 'custom'; readonly id: string; readonly label: string; readonly disabled?: boolean };
type PresentedItem = Omit<IngestionQueueItem, 'stage'> & {
  stage: IngestionQueueItem['stage'] | 'custom';
  customStage?: { readonly id: string; readonly label: string; readonly showProgress?: boolean };
  actions?: readonly Action[];
};
type PresentedSource = LyraPageSource<PresentedItem, IngestionQueueSourceQuery>;
interface ActionDetail { readonly itemId: string; readonly actionId: string; }

expectDevWarning('lyra-ingestion-action-limit:lr-ingestion-queue');

const resume: Action = { type: 'custom', id: 'resume', label: 'Resume' };

function item(id: string, actions?: readonly Action[], stage: PresentedItem['stage'] = 'custom'): PresentedItem {
  return { id, document: { id: `doc-${id}`, name: `Document ${id}` }, stage,
    ...(stage === 'custom' ? { customStage: { id: 'paused', label: 'Paused' } } : {}), actions };
}

function publish(el: LyraIngestionQueue, items: readonly PresentedItem[]): void {
  Object.assign(el, { items });
}

function buttons(el: LyraIngestionQueue): HTMLButtonElement[] {
  const root = el.shadowRoot!;
  const virtual = root.querySelector<LyraVirtualList>('lr-virtual-list');
  return [...root.querySelectorAll<HTMLButtonElement>('[part="item-action-button"]'),
    ...(virtual?.shadowRoot?.querySelectorAll<HTMLButtonElement>('[part="item-action-button"]') ?? [])];
}

function action(el: LyraIngestionQueue, label: string): HTMLButtonElement {
  const found = buttons(el).find(button => button.textContent?.trim() === label);
  expect(found !== undefined, `a visible ${label} action renders`).to.equal(true);
  return found!;
}

function observe(el: LyraIngestionQueue): ActionDetail[] {
  const details: ActionDetail[] = [];
  el.addEventListener('lr-item-action', event => details.push((event as CustomEvent<ActionDetail>).detail));
  return details;
}

function record(value: PresentedItem): LyraSourceRecord<PresentedItem> {
  return { key: value.id, order: 0, value };
}

function source(value: PresentedItem): PresentedSource {
  return { revision: 1, query: async () => ({ total: 1, rows: [record(value)] }),
    lookup: async keys => keys.includes(value.id) ? [record(value)] : [], locate: async key => key === value.id ? 0 : null };
}

async function settle(el: LyraIngestionQueue): Promise<void> {
  await el.updateComplete;
  const virtual = el.shadowRoot!.querySelector<LyraVirtualList>('lr-virtual-list');
  if (virtual) await virtual.updateComplete;
  await nextFrame();
}

describe('ingestion queue declarative row actions', () => {
  it('preserves existing retry/cancel defaults and payloads when action descriptors are unset', async () => {
    const el = await fixture<LyraIngestionQueue>(html`<lr-ingestion-queue></lr-ingestion-queue>`);
    publish(el, [{ ...item('failed', undefined, 'failed'), attempts: 2 }, item('upload', undefined, 'uploading')]);
    await settle(el);
    const retries: unknown[] = [];
    const cancels: unknown[] = [];
    el.addEventListener('lr-retry', event => retries.push(event.detail));
    el.addEventListener('lr-cancel', event => cancels.push(event.detail));
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part="retry-button"]')!.click();
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part="cancel-button"]')!.click();
    expect(retries).to.deep.equal([{ itemId: 'failed', attempt: 3 }]);
    expect(cancels).to.deep.equal([{ itemId: 'upload' }]);
    expect(buttons(el).length).to.equal(0);
  });

  it('treats an explicit empty list as no actions and never creates ineligible built-in actions', async () => {
    const el = await fixture<LyraIngestionQueue>(html`<lr-ingestion-queue></lr-ingestion-queue>`);
    publish(el, [item('active', [], 'uploading'), item('queued', [{ type: 'retry' }], 'queued'), item('done', [{ type: 'cancel' }], 'done')]);
    await settle(el);
    expect(el.shadowRoot!.querySelectorAll('[part="item-actions"] button').length).to.equal(0);
    publish(el, [item('active', undefined, 'uploading')]);
    await settle(el);
    expect(el.shadowRoot!.querySelectorAll('[part="cancel-button"]').length).to.equal(1);
  });

  it('replaces defaults with ordered built-in/custom descriptors and emits one immutable controlled custom intent', async () => {
    const wrapper = await fixture<HTMLElement>(html`<div><lr-ingestion-queue></lr-ingestion-queue></div>`);
    const el = wrapper.querySelector('lr-ingestion-queue')!;
    const entry = item('failed', [{ type: 'custom', id: 'retry', label: 'Review first' }, { type: 'retry', disabled: true }], 'failed');
    publish(el, [entry]);
    await settle(el);
    const received: CustomEvent<ActionDetail>[] = [];
    let legacyRetries = 0;
    wrapper.addEventListener('lr-item-action', event => received.push(event as CustomEvent<ActionDetail>));
    el.addEventListener('lr-retry', () => { legacyRetries++; });
    expect(el.shadowRoot!.querySelector<HTMLButtonElement>('[part="retry-button"]')!.disabled).to.equal(true);
    action(el, 'Review first').click();
    expect(received.length).to.equal(1);
    expect(received[0]!.detail).to.deep.equal({ itemId: 'failed', actionId: 'retry' });
    expect(Object.isFrozen(received[0]!.detail)).to.equal(true);
    expect([received[0]!.bubbles, received[0]!.composed, received[0]!.cancelable]).to.deep.equal([true, true, false]);
    expect(legacyRetries).to.equal(0);
    expect(el.items[0]!.id).to.equal('failed');
    expect(el.items[0]!.stage).to.equal('failed');
  });

  it('rejects a retained action immediately after revocation, disablement or same-id replacement and permits the newly admitted action', async () => {
    for (const change of ['hidden', 'disabled', 'replacement'] as const) {
      const el = await fixture<LyraIngestionQueue>(html`<lr-ingestion-queue></lr-ingestion-queue>`);
      publish(el, [item('same', [resume])]);
      await settle(el);
      const old = action(el, 'Resume');
      const details = observe(el);
      const next = change === 'hidden' ? item('same', []) : change === 'disabled'
        ? item('same', [{ ...resume, disabled: true }]) : {
          ...item('same', [resume]), document: { id: 'replacement-document', name: 'Replacement document' },
        };
      publish(el, [next]);
      old.click();
      expect(details.length, `${change} is effective before repaint`).to.equal(0);
      await settle(el);
      if (change === 'disabled') expect(action(el, 'Resume').disabled).to.equal(true);
      if (change === 'hidden') expect(buttons(el).length).to.equal(0);
      if (change === 'replacement') expect(el.shadowRoot!.querySelector('[part="item-name"]')?.textContent).to.equal('Replacement document');
      publish(el, [item('same', [{ type: 'custom', id: 'reselect', label: 'Reselect' }])]);
      await settle(el);
      action(el, 'Reselect').click();
      expect(details).to.deep.equal([{ itemId: 'same', actionId: 'reselect' }]);
    }
  });

  it('retires provider actions synchronously and ignores a superseded pending page before admitting the current source', async () => {
    const el = await fixture<LyraIngestionQueue>(html`<lr-ingestion-queue></lr-ingestion-queue>`);
    Object.assign(el, { dataSource: source(item('first', [resume])) });
    await waitUntil(() => el.sourceTotal === 1);
    await settle(el);
    const old = action(el, 'Resume');
    const details = observe(el);
    let release: ((result: { total: number; rows: readonly LyraSourceRecord<PresentedItem>[] }) => void) | undefined;
    const pending: PresentedSource = { ...source(item('obsolete', [resume])),
      query: () => new Promise(resolve => { release = resolve; }) };
    Object.assign(el, { dataSource: pending });
    old.click();
    expect(details.length).to.equal(0);
    await waitUntil(() => release !== undefined);
    Object.assign(el, { dataSource: source(item('current', [{ type: 'custom', id: 'reselect', label: 'Reselect' }])) });
    release!({ total: 1, rows: [record(item('obsolete', [resume]))] });
    await waitUntil(() => el.shadowRoot!.querySelector('[part="item-name"]')?.textContent === 'Document current');
    await settle(el);
    old.click();
    expect(details.length).to.equal(0);
    expect(el.shadowRoot!.textContent).not.to.include('Document obsolete');
    action(el, 'Reselect').click();
    expect(details).to.deep.equal([{ itemId: 'current', actionId: 'reselect' }]);
  });

  it('renders custom actions and forwards their public styling part through virtualized rows', async () => {
    const wrapper = await fixture<HTMLElement>(html`<div>
      <style>lr-ingestion-queue::part(item-action-button) { color: rgb(17, 34, 51); }</style>
      <lr-ingestion-queue virtualize-at="1"></lr-ingestion-queue>
    </div>`);
    const el = wrapper.querySelector('lr-ingestion-queue')!;
    publish(el, [item('one', [resume]), item('two', [{ type: 'custom', id: 'reselect', label: 'Reselect' }])]);
    await settle(el);
    expect(el.shadowRoot!.querySelectorAll('lr-virtual-list').length).to.equal(1);
    await waitUntil(() => buttons(el).length === 2, 'both virtualized row actions are mounted');
    const details = observe(el);
    expect(getComputedStyle(action(el, 'Resume')).color).to.equal('rgb(17, 34, 51)');
    action(el, 'Reselect').click();
    expect(details).to.deep.equal([{ itemId: 'two', actionId: 'reselect' }]);
    await expect(el).to.be.accessible();
  });

  it('repairs a removed action focus to a surviving action without reclaiming external focus', async () => {
    const wrapper = await fixture<HTMLElement>(html`<div><lr-ingestion-queue></lr-ingestion-queue><button id="outside-queue" type="button">Outside</button></div>`);
    const el = wrapper.querySelector('lr-ingestion-queue')!;
    const reselect: Action = { type: 'custom', id: 'reselect', label: 'Reselect' };
    publish(el, [item('one', [resume, reselect])]);
    await settle(el);
    await focusByKeyboard(action(el, 'Resume'));
    publish(el, [item('one', [reselect])]);
    await settle(el);
    expect(deepActiveElementIn(document)?.textContent?.trim()).to.equal('Reselect');
    await focusByKeyboard(wrapper.querySelector<HTMLButtonElement>('#outside-queue')!);
    publish(el, [item('one', [resume])]);
    await settle(el);
    expect(deepActiveElementIn(document)?.id).to.equal('outside-queue');
  });

  it('omits unsafe, duplicate and malformed action entries without invoking label accessors', async () => {
    let reads = 0;
    const hostile = { type: 'custom', id: 'unsafe' };
    Object.defineProperty(hostile, 'label', { enumerable: true, get() { reads++; throw new Error('action label getter must not run'); } });
    const descriptors = [hostile, , { type: 'custom', id: 'wrong-disabled', label: 'Must stay inert', disabled: 'false' }, resume,
      { type: 'custom', id: 'resume', label: 'Duplicate resume' }, null];
    const el = await fixture<LyraIngestionQueue>(html`<lr-ingestion-queue></lr-ingestion-queue>`);
    publish(el, [item('one', descriptors as readonly Action[])]);
    await settle(el);
    expect(reads).to.equal(0);
    expect(buttons(el).map(button => button.textContent?.trim())).to.deep.equal(['Resume']);
    const details = observe(el);
    action(el, 'Resume').click();
    expect(details).to.deep.equal([{ itemId: 'one', actionId: 'resume' }]);
  });

  it('retires retained built-in retry and cancel controls before repaint after descriptor revocation, disablement or occurrence replacement', async () => {
    for (const type of ['retry', 'cancel'] as const) {
      for (const change of ['hidden', 'disabled', 'replacement'] as const) {
        const stage = type === 'retry' ? 'failed' : 'uploading';
        const original: Action = { type };
        const el = await fixture<LyraIngestionQueue>(html`<lr-ingestion-queue></lr-ingestion-queue>`);
        publish(el, [{ ...item('same', [original], stage), attempts: 2 }]);
        await settle(el);
        const retained = el.shadowRoot!.querySelector<HTMLButtonElement>(`[part="${type}-button"]`)!;
        const received: unknown[] = [];
        el.addEventListener(`lr-${type}`, event => received.push((event as CustomEvent<unknown>).detail));
        const descriptors = change === 'hidden' ? [] : change === 'disabled' ? [{ type, disabled: true }] : [original];
        publish(el, [{ ...item('same', descriptors, stage), attempts: 2,
          ...(change === 'replacement' ? { document: { id: 'replacement', name: 'A replacement occurrence' } } : {}) }]);
        retained.click();
        expect(received.length, `${type}/${change} is rejected before repaint`).to.equal(0);
        await settle(el);

        publish(el, [{ ...item('same', [original], stage), attempts: 2 }]);
        await settle(el);
        el.shadowRoot!.querySelector<HTMLButtonElement>(`[part="${type}-button"]`)!.click();
        expect(received, `${type}/${change} permits a fresh eligible occurrence`).to.deep.equal([
          type === 'retry' ? { itemId: 'same', attempt: 3 } : { itemId: 'same' },
        ]);
      }
    }
  });

  it('fails malformed explicit action lists closed on known stages without restoring retry or cancel defaults', async () => {
    for (const stage of ['queued', 'failed'] as const) {
      let reads = 0;
      const unsafeAction = { type: stage === 'failed' ? 'retry' : 'cancel' };
      Object.defineProperty(unsafeAction, 'disabled', { enumerable: true, get() { reads++; throw new Error('disabled getter must not run'); } });
      const unsafeItem = item('unsafe-list', undefined, stage);
      Object.defineProperty(unsafeItem, 'actions', { enumerable: true, get() { reads++; throw new Error('actions getter must not run'); } });
      const el = await fixture<LyraIngestionQueue>(html`<lr-ingestion-queue></lr-ingestion-queue>`);
      publish(el, [
        item('wrong-list', { invalid: true } as unknown as readonly Action[], stage),
        item('unsafe-action', [unsafeAction as Action], stage),
        unsafeItem,
      ]);
      await settle(el);
      expect(reads, stage).to.equal(0);
      expect(el.shadowRoot!.querySelectorAll('[part="item-actions"] button').length, stage).to.equal(0);

      publish(el, [item('omitted', undefined, stage)]);
      await settle(el);
      const type = stage === 'failed' ? 'retry' : 'cancel';
      expect(el.shadowRoot!.querySelectorAll(`[part="${type}-button"]`).length, 'omission retains the documented default').to.equal(1);
    }
  });

  it('never reclaims focus moved outside after action removal schedules an update, even transiently', async () => {
    const wrapper = await fixture<HTMLElement>(html`<div><lr-ingestion-queue></lr-ingestion-queue><button id="newer-focus-destination" type="button">Outside</button></div>`);
    const el = wrapper.querySelector('lr-ingestion-queue')!;
    const reselect: Action = { type: 'custom', id: 'reselect', label: 'Reselect' };
    publish(el, [item('one', [resume, reselect])]);
    await settle(el);
    await focusByKeyboard(action(el, 'Resume'));
    let externalFocusStarted = false;
    const reclaimed: string[] = [];
    const trackFocus = (): void => {
      const active = deepActiveElementIn(document);
      if (!active || active === document.body || active === document.documentElement) return;
      if (!composedContains(el, active)) externalFocusStarted = true;
      else if (externalFocusStarted) reclaimed.push(active.textContent?.trim() ?? active.localName);
    };
    document.addEventListener('focusin', trackFocus, true);
    try {
      publish(el, [item('one', [reselect])]);
      // The helper focuses an external sentinel synchronously before its real Tab awaits;
      // record transient reclamation so its final target focus cannot hide a stale repair.
      await focusByKeyboard(wrapper.querySelector<HTMLButtonElement>('#newer-focus-destination')!);
      await settle(el);
      await nextFrame();
      expect(externalFocusStarted).to.equal(true);
      expect(reclaimed, 'no delayed repair re-enters the queue after newer external focus').to.deep.equal([]);
      expect(deepActiveElementIn(document)?.id).to.equal('newer-focus-destination');
    } finally {
      document.removeEventListener('focusin', trackFocus, true);
    }
  });

  it('bounds action inspection to a prefix and visibly discloses the retained action count', async () => {
    const descriptors: Action[] = Array.from({ length: 32 }, (_, index) => ({ type: 'custom', id: `action-${index}`, label: `Action ${index}` }));
    let tailReads = 0;
    Object.defineProperty(descriptors, 32, { get() { tailReads++; throw new Error('the uninspected tail must not be read'); } });
    const el = await fixture<LyraIngestionQueue>(html`<lr-ingestion-queue
      .strings=${{ ingestionQueueActionLimit: '{count}/{total} available for {label}' }}></lr-ingestion-queue>`);
    publish(el, [item('bounded', descriptors)]);
    await settle(el);
    expect(tailReads).to.equal(0);
    expect(buttons(el).length).to.equal(32);
    expect(el.shadowRoot!.querySelector('[part="item-action-limit"]')?.textContent).to.include('32/33 available for Document bounded');
  });

  it('ignores irrelevant custom-stage metadata before it can spend known-stage action text budget or reflect hostile descriptors', async () => {
    const oversized = { ...item('queued', [resume], 'queued'), customStage: { id: 'irrelevant', label: 'x'.repeat(65_536 - 'irrelevant'.length) } };
    let irrelevantReads = 0;
    const unsafe = new Proxy(item('failed', [resume], 'failed'), {
      getOwnPropertyDescriptor(target, key) {
        if (key === 'customStage') { irrelevantReads++; throw new Error('irrelevant custom metadata must not be inspected'); }
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    const el = await fixture<LyraIngestionQueue>(html`<lr-ingestion-queue></lr-ingestion-queue>`);
    publish(el, [oversized, unsafe]);
    await settle(el);
    expect(irrelevantReads).to.equal(0);
    expect([...el.shadowRoot!.querySelectorAll('[part="item-stage"]')].map(stage => stage.textContent?.trim())).to.deep.equal(['Queued', 'Failed']);
    expect(buttons(el).map(button => button.textContent?.trim())).to.deep.equal(['Resume', 'Resume']);
  });
});

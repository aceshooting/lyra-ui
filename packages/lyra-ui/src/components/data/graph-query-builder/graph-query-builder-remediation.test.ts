import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './graph-query-builder.js';
import type { GraphQuery, LyraGraphQueryBuilder } from './graph-query-builder.js';
import type { LyraSelect } from '../../forms/select/select.class.js';

function query(): GraphQuery {
  return { startId: 'start', endId: '', relationshipTypes: ['knows'], nodeTypes: ['person'], direction: 'both', minHops: 1, maxHops: 1 };
}

for (const part of ['min-hops', 'max-hops']) {
  it(`contains all select aliases while a real ${part} choice emits one full query`, async () => {
    const el = await fixture<LyraGraphQueryBuilder>(html`<lr-graph-query-builder style="--lr-transition-fast:0ms" .value=${query()}></lr-graph-query-builder>`);
    const events: Array<{ type: string; hostOwned: boolean; detail: unknown }> = [];
    for (const type of ['input', 'change', 'lr-input', 'lr-change', 'lr-show', 'lr-after-show', 'lr-hide', 'lr-after-hide']) {
      el.addEventListener(type, (event) => events.push({ type, hostOwned: event.composedPath()[0] === el, detail: (event as CustomEvent).detail }));
    }
    const select = el.shadowRoot!.querySelector<LyraSelect>(`[part="${part}"]`)!;
    const trigger = select.shadowRoot!.querySelector<HTMLButtonElement>('[role="combobox"]')!;
    const shown = oneEvent(select, 'lr-after-show');
    trigger.focus();
    trigger.click();
    await shown;
    await sendKeys({ press: 'End' });
    const hidden = oneEvent(select, 'lr-after-hide');
    await sendKeys({ press: 'Enter' });
    await hidden;
    await el.updateComplete;

    expect(events.map((event) => event.type)).to.deep.equal(['lr-input']);
    expect(events[0]!.hostOwned).to.equal(true);
    expect(events[0]!.detail).to.deep.equal({ value: el.value });
    expect(Object.isFrozen(events[0]!.detail)).to.equal(true);
    expect(el.value[part === 'min-hops' ? 'minHops' : 'maxHops']).to.equal(6);
    el.value = query();
    await el.updateComplete;
    expect(events.length, 'programmatic assignments stay silent').to.equal(1);
  });
}

function unavailableActiveElement(root: ShadowRoot): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(root, 'activeElement');
  Object.defineProperty(root, 'activeElement', {
    configurable: true,
    get() { throw new TypeError('Unavailable activeElement'); },
  });
  return () => {
    if (descriptor) Object.defineProperty(root, 'activeElement', descriptor);
    else Reflect.deleteProperty(root, 'activeElement');
  };
}

it('renders saved-query updates when the shadow-root activeElement getter is unavailable', async () => {
  const el = await fixture<LyraGraphQueryBuilder>(html`<lr-graph-query-builder></lr-graph-query-builder>`);
  const restore = unavailableActiveElement(el.shadowRoot!);
  let rejected = false;
  try {
    el.savedQueries = [{ id: 'saved', name: 'Saved query', query: query() }];
    try { await el.updateComplete; } catch { rejected = true; }
  } finally {
    restore();
  }
  expect(rejected, 'the saved-query update resolves').to.equal(false);
  expect(el.shadowRoot!.querySelectorAll('[data-query-id="saved"]').length).to.equal(1);
});

for (const group of ['relationship', 'node-type']) {
  it(`removes a real ${group} chip and emits its query when focus observation is unavailable`, async () => {
    const el = await fixture<LyraGraphQueryBuilder>(html`<lr-graph-query-builder
      .value=${query()}
      .relationshipTypeOptions=${[{ value: 'knows', label: 'Knows' }]}
      .nodeTypeOptions=${[{ value: 'person', label: 'Person' }]}
    ></lr-graph-query-builder>`);
    const chip = el.shadowRoot!.querySelector<HTMLElement>(`[part="${group}-chips"] lr-chip`)!;
    const remove = chip.shadowRoot!.querySelector<HTMLButtonElement>('[part="remove-button"]')!;
    const restore = unavailableActiveElement(el.shadowRoot!);
    const events: unknown[] = [];
    let errors = 0;
    const onError = (event: ErrorEvent): void => {
      if (event.message.includes('Unavailable activeElement')) {
        errors++;
        event.preventDefault();
      }
    };
    window.addEventListener('error', onError);
    el.addEventListener('lr-input', (event) => events.push(event.detail));
    try {
      remove.click();
      await el.updateComplete;
    } finally {
      restore();
      window.removeEventListener('error', onError);
    }
    expect(errors, 'removal does not throw from its handler').to.equal(0);
    expect(el.value[group === 'relationship' ? 'relationshipTypes' : 'nodeTypes'].length).to.equal(0);
    expect(events).to.deep.equal([{ value: el.value }]);
    expect(el.shadowRoot!.querySelectorAll(`[part="${group}-chips"] lr-chip`).length).to.equal(0);
  });
}

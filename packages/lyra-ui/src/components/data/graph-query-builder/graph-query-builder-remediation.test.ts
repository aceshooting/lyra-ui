import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './graph-query-builder.js';
import type { GraphQuery, LyraGraphQueryBuilder } from './graph-query-builder.js';
import type { LyraSelect } from '../../forms/select/select.class.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { hoverUntilMatched, resetMouse } from '../../../../test/wtr-mouse.js';

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

async function watchedBuilder(): Promise<{ el: LyraGraphQueryBuilder; leaked: string[] }> {
  const el = await fixture<LyraGraphQueryBuilder>(html`<lr-graph-query-builder
    style="--lr-transition-fast:0ms"
    .value=${{ ...query(), startId: '' }}
    .relationshipTypeOptions=${[{ value: 'knows' }, { value: 'likes' }]}
    .nodeTypeOptions=${[{ value: 'person' }, { value: 'place' }]}
  ><input slot="actions"></lr-graph-query-builder>`);
  const leaked: string[] = [];
  for (const type of ['input', 'change', 'lr-input', 'lr-change', 'lr-activate', 'lr-show', 'lr-after-show', 'lr-hide', 'lr-after-hide', 'lr-clear', 'lr-filter', 'lr-invalid']) {
    el.addEventListener(type, (event) => {
      if (event.composedPath()[0] !== el) leaked.push(type);
    });
  }
  return { el, leaked };
}

for (const name of ['start-input', 'end-input', 'save-name-input']) {
  it(`contains every child event while typing in ${name}`, async () => {
    const { el, leaked } = await watchedBuilder();
    await focusByKeyboard(el.shadowRoot!.querySelector<HTMLElement>(`[part="${name}"]`)!.shadowRoot!.querySelector('input')!);
    await sendKeys({ type: 'x' });
    await sendKeys({ press: 'Tab' });
    await el.updateComplete;
    expect(leaked).to.deep.equal([]);
    if (name !== 'save-name-input') expect(el.value[name === 'start-input' ? 'startId' : 'endId']).to.equal('x');
  });
}

for (const [name, key, field, expected] of [
  ['direction', 'Home', 'direction', 'out'],
  ['relationship-picker', 'End', 'relationshipTypes', ['knows', 'likes']],
  ['node-type-picker', 'End', 'nodeTypes', ['person', 'place']],
] as const) {
  it(`contains every child event for a real ${name} choice`, async () => {
    const { el, leaked } = await watchedBuilder();
    const select = el.shadowRoot!.querySelector<LyraSelect>(`[part="${name}"]`)!;
    const trigger = select.shadowRoot!.querySelector<HTMLButtonElement>('[role="combobox"]')!;
    const shown = oneEvent(select, 'lr-after-show');
    await focusByKeyboard(trigger);
    trigger.click();
    await shown;
    await sendKeys({ press: key });
    const hidden = oneEvent(select, 'lr-after-hide');
    await sendKeys({ press: 'Enter' });
    await hidden;
    await el.updateComplete;
    expect(leaked).to.deep.equal([]);
    expect(el.value[field]).to.deep.equal(expected);
  });
}

it('lets events from slotted actions reach the host', async () => {
  const { el, leaked } = await watchedBuilder();
  await focusByKeyboard(el.querySelector('input')!);
  await sendKeys({ type: 'y' });
  expect(leaked).to.deep.equal(['input']);
});

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

it('treats re-assigning the same value, options or saved queries as no change', async () => {
  const value = query();
  const options = [{ value: 'knows' }];
  const saved = [{ id: 's1', name: 'Saved', query: query() }];
  const el = await fixture<LyraGraphQueryBuilder>(html`<lr-graph-query-builder .value=${value} .relationshipTypeOptions=${options} .nodeTypeOptions=${options} .savedQueries=${saved}></lr-graph-query-builder>`);
  el.value = value;
  el.relationshipTypeOptions = options;
  el.nodeTypeOptions = options;
  el.savedQueries = saved;
  expect(el.isUpdatePending).to.equal(false);
});

it('keeps both path edits that land before the next render', async () => {
  const el = await fixture<LyraGraphQueryBuilder>(html`<lr-graph-query-builder .value=${query()}></lr-graph-query-builder>`);
  for (const [part, value] of [['start-input', 'a'], ['end-input', 'b']]) {
    el.shadowRoot!.querySelector(`[part="${part}"]`)!.dispatchEvent(new CustomEvent('lr-input', { detail: { value }, bubbles: true, composed: true }));
  }
  expect([el.value.startId, el.value.endId]).to.deep.equal(['a', 'b']);
});

it('keeps a disabled Save at rest under the pointer and mixes Run hover from its own fill', async () => {
  const el = await fixture<LyraGraphQueryBuilder>(html`<lr-graph-query-builder
    style="--lr-transition-fast: 0s; --lr-graph-query-builder-run-bg: rgb(0, 128, 0); --lr-color-mix-hover: 0%"
    .value=${query()}
  ></lr-graph-query-builder>`);
  const [save, run] = ['save-button', 'run-button'].map((name) => el.shadowRoot!.querySelector<HTMLButtonElement>(`[part="${name}"]`)!);
  const resting = getComputedStyle(save!).backgroundColor;
  try {
    await hoverUntilMatched(save!, 'disabled save hovered');
    const saveHover = getComputedStyle(save!).backgroundColor;
    await hoverUntilMatched(run!, 'run hovered');
    const probe = document.createElement('i');
    probe.style.background = 'color-mix(in oklab, rgb(0, 128, 0), black 0%)';
    el.after(probe);
    expect([save!.disabled, saveHover, getComputedStyle(run!).backgroundColor]).to.deep.equal([true, resting, getComputedStyle(probe).backgroundColor]);
  } finally {
    await resetMouse();
  }
});

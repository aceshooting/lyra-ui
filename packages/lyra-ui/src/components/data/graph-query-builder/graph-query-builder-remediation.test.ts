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
    const el = await fixture<LyraGraphQueryBuilder>(html`<lr-graph-query-builder data-lr-theme-scope style="--lr-transition-fast:0ms" .value=${query()}></lr-graph-query-builder>`);
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

    expect(events.map((event) => event.type)).to.deep.equal(['input', 'lr-input', 'change', 'lr-change']);
    for (const event of events) {
      expect(event.hostOwned, `${event.type} originates on the aggregate host`).to.equal(true);
      if (event.type.startsWith('lr-')) {
        expect(event.detail).to.deep.equal({ value: el.value });
        expect(Object.isFrozen(event.detail)).to.equal(true);
      } else {
        expect(event.detail).to.equal(undefined);
      }
    }
    expect(el.value[part === 'min-hops' ? 'minHops' : 'maxHops']).to.equal(6);
    el.value = query();
    await el.updateComplete;
    expect(events.length, 'programmatic assignments stay silent').to.equal(4);
  });
}

async function watchedBuilder(): Promise<{ el: LyraGraphQueryBuilder; leaked: string[] }> {
  const el = await fixture<LyraGraphQueryBuilder>(html`<lr-graph-query-builder data-lr-theme-scope
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
  const el = await fixture<LyraGraphQueryBuilder>(html`<lr-graph-query-builder data-lr-theme-scope
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

it('contains the owned pickers\' request and overflow events', async () => {
  const el = await fixture<LyraGraphQueryBuilder>(html`<lr-graph-query-builder .value=${query()}></lr-graph-query-builder>`);
  const leaked: string[] = [];
  const names = ['lr-change-request', 'lr-create', 'lr-retry-request', 'lr-source-error', 'lr-chip-change', 'lr-overflow-toggle'];
  for (const name of names) el.addEventListener(name, () => leaked.push(name));
  const inner = el.shadowRoot!.querySelector('lr-select, lr-combobox, input, button')!;
  for (const name of names) inner.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true, cancelable: true }));
  expect(leaked).to.deep.equal([]);
});

it('exposes the saved-queries heading at a configurable level', async () => {
  const el = await fixture<LyraGraphQueryBuilder>(html`<lr-graph-query-builder></lr-graph-query-builder>`);
  const label = () => el.shadowRoot!.querySelector('[part="saved-queries-label"]')!;
  expect([label().getAttribute('role'), label().getAttribute('aria-level')]).to.deep.equal(['heading', '3']);
  el.headingLevel = '2';
  await el.updateComplete;
  expect(label().getAttribute('aria-level')).to.equal('2');
  el.headingLevel = 'none';
  await el.updateComplete;
  expect(label().hasAttribute('role')).to.equal(false);
  expect(label().hasAttribute('aria-level')).to.equal(false);
});

it('describes the form error before the hint in the rendered order', async () => {
  const el = await fixture<LyraGraphQueryBuilder>(html`<lr-graph-query-builder hint="Pick a node" error-text="Missing node"></lr-graph-query-builder>`);
  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  const roles = (base.getAttribute('aria-describedby') ?? '').split(' ').map(id => el.shadowRoot!.getElementById(id)?.getAttribute('part'));
  expect(roles).to.deep.equal(['error', 'hint']);
  expect([...base.querySelectorAll('[part="hint"], [part="error"]')].map(node => node.getAttribute('part'))).to.deep.equal(roles);
});

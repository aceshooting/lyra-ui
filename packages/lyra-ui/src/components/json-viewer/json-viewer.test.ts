import { fixture, expect, oneEvent, html } from '@open-wc/testing';
import './json-viewer.js';
import type { LyraJsonViewer } from './json-viewer.js';

const sample = {
  name: 'Ada Lovelace',
  age: 36,
  active: true,
  bio: null,
  tags: ['mathematician', 'writer'],
  address: { city: 'London', country: 'UK' },
};

async function withData(data: unknown): Promise<LyraJsonViewer> {
  const el = (await fixture(html`<lyra-json-viewer></lyra-json-viewer>`)) as LyraJsonViewer;
  el.data = data;
  await el.updateComplete;
  return el;
}

it('renders object keys and primitive values with typed parts', async () => {
  const el = await withData(sample);
  const keys = Array.from(el.shadowRoot!.querySelectorAll('[part="key"]')).map((k) => k.textContent);
  expect(keys).to.include.members(['name', 'age', 'active', 'bio', 'tags', 'address']);

  const values = el.shadowRoot!.querySelectorAll('[part="value"]');
  const stringValue = Array.from(values).find((v) => v.textContent === '"Ada Lovelace"');
  expect(stringValue).to.exist;
  expect(stringValue!.getAttribute('data-type')).to.equal('string');

  const numberValue = Array.from(values).find((v) => v.textContent === '36');
  expect(numberValue!.getAttribute('data-type')).to.equal('number');

  const boolValue = Array.from(values).find((v) => v.textContent === 'true');
  expect(boolValue!.getAttribute('data-type')).to.equal('boolean');

  const nullValue = Array.from(values).find((v) => v.textContent === 'null');
  expect(nullValue!.getAttribute('data-type')).to.equal('null');
});

it('renders nested arrays and objects with bracket parts', async () => {
  const el = await withData(sample);
  const brackets = Array.from(el.shadowRoot!.querySelectorAll('[part="bracket"]')).map((b) => b.textContent);
  expect(brackets).to.include('{');
  expect(brackets).to.include('}');
  expect(brackets).to.include('[');
  expect(brackets).to.include(']');
});

it('everything is expanded by default when collapsed-depth is unset', async () => {
  const el = await withData(sample);
  // "London" only appears in the rendered tree once `address` (depth 1) is expanded.
  const values = Array.from(el.shadowRoot!.querySelectorAll('[part="value"]')).map((v) => v.textContent);
  expect(values).to.include('"London"');
});

it('collapsed-depth="0" collapses the top-level node immediately', async () => {
  const el = await withData(sample);
  el.collapsedDepth = 0;
  await el.updateComplete;

  // Collapsed root shows a preview instead of rendering any nested keys/values.
  expect(el.shadowRoot!.querySelector('[part="key"]')).to.not.exist;
  expect(el.shadowRoot!.querySelector('.preview')).to.exist;
});

it('collapsed-depth collapses nodes at or beyond that depth but leaves shallower ones expanded', async () => {
  const el = await withData(sample);
  el.collapsedDepth = 1;
  await el.updateComplete;

  // Top-level (depth 0) keys are visible...
  const keys = Array.from(el.shadowRoot!.querySelectorAll('[part="key"]')).map((k) => k.textContent);
  expect(keys).to.include('address');
  // ...but address's own children (depth 1) start collapsed.
  const values = Array.from(el.shadowRoot!.querySelectorAll('[part="value"]')).map((v) => v.textContent);
  expect(values).to.not.include('"London"');
});

it('toggles a node open/closed on clicking its toggle button', async () => {
  const el = await withData(sample);
  el.collapsedDepth = 0;
  await el.updateComplete;

  const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement;
  expect(toggle.getAttribute('aria-expanded')).to.equal('false');

  toggle.click();
  await el.updateComplete;
  expect(toggle.getAttribute('aria-expanded')).to.equal('true');
  expect(el.shadowRoot!.querySelector('[part="key"]')!.textContent).to.equal('name');

  toggle.click();
  await el.updateComplete;
  expect(toggle.getAttribute('aria-expanded')).to.equal('false');
});

it('hides the toggle button for leaf/empty nodes but keeps its layout box', async () => {
  const el = await withData({ empty: {} });
  await el.updateComplete;
  const toggles = el.shadowRoot!.querySelectorAll('[part="toggle"]');
  // root (has entries) + the empty object's own placeholder toggle
  expect(toggles.length).to.equal(2);
  expect((toggles[1] as HTMLElement).hasAttribute('hidden')).to.be.true;
});

it('renders an empty object/array as a bare pair of brackets with no item count', async () => {
  const el = await withData({ emptyObject: {}, emptyArray: [] });
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('.preview')).to.not.exist;
});

it('shows an item/key count preview only for a collapsed, non-empty container', async () => {
  const el = await withData(sample);
  el.collapsedDepth = 0;
  await el.updateComplete;
  const preview = el.shadowRoot!.querySelector('.preview');
  expect(preview!.textContent).to.equal('6 keys');
});

it('does not render a copy button by default', async () => {
  const el = await withData(sample);
  expect(el.shadowRoot!.querySelector('[part="copy-button"]')).to.not.exist;
});

it('renders a top-level copy button when copyable, and emits lyra-copy with the full JSON on click', async () => {
  const el = await withData(sample);
  el.copyable = true;
  await el.updateComplete;

  const toolbarButton = el.shadowRoot!.querySelector('[part="toolbar"] [part="copy-button"]') as HTMLButtonElement;
  expect(toolbarButton).to.exist;

  setTimeout(() => toolbarButton.click());
  const event = await oneEvent(el, 'lyra-copy');
  expect(event.detail.text).to.equal(JSON.stringify(sample, null, 2));
});

it('renders per-node copy buttons when copyable, and copies just that node on click', async () => {
  const el = await withData(sample);
  el.copyable = true;
  await el.updateComplete;

  const nodeButtons = Array.from(el.shadowRoot!.querySelectorAll('[part="copy-button"]'));
  // toolbar button + one per rendered row.
  expect(nodeButtons.length).to.be.greaterThan(1);

  const ageRow = Array.from(el.shadowRoot!.querySelectorAll('.row')).find((row) =>
    row.querySelector('[part="key"]')?.textContent === 'age',
  ) as HTMLElement;
  const copyBtn = ageRow.querySelector('[part="copy-button"]') as HTMLButtonElement;

  setTimeout(() => copyBtn.click());
  const event = await oneEvent(el, 'lyra-copy');
  expect(event.detail.text).to.equal('36');
});

it('fires lyra-copy even when navigator.clipboard is unavailable', async () => {
  const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });

  try {
    const el = await withData(sample);
    el.copyable = true;
    await el.updateComplete;
    const toolbarButton = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement;

    setTimeout(() => toolbarButton.click());
    const event = await oneEvent(el, 'lyra-copy');
    expect(event.detail.text).to.equal(JSON.stringify(sample, null, 2));
  } finally {
    if (original) Object.defineProperty(navigator, 'clipboard', original);
  }
});

it('copies the literal string "undefined" when the root data is undefined', async () => {
  const el = await withData(undefined);
  el.copyable = true;
  await el.updateComplete;

  const toolbarButton = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement;
  setTimeout(() => toolbarButton.click());
  const event = await oneEvent(el, 'lyra-copy');
  expect(event.detail.text).to.equal('undefined');
});

it('highlights matching keys/values with data-match when search is set', async () => {
  const el = await withData(sample);
  el.search = 'ada';
  await el.updateComplete;

  const match = el.shadowRoot!.querySelector('[part="value"][data-match]');
  expect(match).to.exist;
  expect(match!.textContent).to.equal('"Ada Lovelace"');
});

it('auto-expands ancestors of a match even under a collapsing collapsed-depth', async () => {
  const el = await withData(sample);
  el.collapsedDepth = 0;
  el.search = 'london';
  await el.updateComplete;

  // Root is forced open by the match living inside `address`, and `address`
  // itself is forced open too, so the matching value is actually rendered.
  const match = Array.from(el.shadowRoot!.querySelectorAll('[part="value"]')).find(
    (v) => v.textContent === '"London"',
  );
  expect(match).to.exist;
  expect(match!.hasAttribute('data-match')).to.be.true;
});

it('matches keys as well as values', async () => {
  const el = await withData(sample);
  el.search = 'address';
  await el.updateComplete;

  const keyMatch = Array.from(el.shadowRoot!.querySelectorAll('[part="key"]')).find(
    (k) => k.textContent === 'address',
  );
  expect(keyMatch!.hasAttribute('data-match')).to.be.true;
});

it('does not highlight anything when search is empty', async () => {
  const el = await withData(sample);
  el.search = '';
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[data-match]')).to.not.exist;
});

it('preserves manual toggle overrides across a data reassignment with the same shape', async () => {
  const el = await withData(sample);
  el.collapsedDepth = 0;
  await el.updateComplete;

  const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement;
  toggle.click();
  await el.updateComplete;
  expect(toggle.getAttribute('aria-expanded')).to.equal('true');

  el.data = { ...sample, age: 37 };
  await el.updateComplete;

  const toggleAfter = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement;
  expect(toggleAfter.getAttribute('aria-expanded')).to.equal('true');
});

it('renders a self-referencing value without a stack overflow, showing a circular marker instead of recursing', async () => {
  const o: Record<string, unknown> = { name: 'root' };
  o.self = o;
  const el = await withData(o);

  // The `self` key itself is rendered exactly once -- recursing into it
  // again (and again...) would either blow the stack or render it an
  // unbounded number of times.
  const keys = Array.from(el.shadowRoot!.querySelectorAll('[part="key"]')).map((k) => k.textContent);
  expect(keys.filter((k) => k === 'self')).to.have.length(1);

  const values = Array.from(el.shadowRoot!.querySelectorAll('[part="value"]')).map((v) => v.textContent);
  expect(values).to.include('Circular reference');

  const marker = Array.from(el.shadowRoot!.querySelectorAll('[part="value"]')).find(
    (v) => v.textContent === 'Circular reference',
  );
  expect(marker!.getAttribute('data-type')).to.equal('circular');

  // The circular node has no children to toggle -- it renders as a leaf.
  const selfRow = Array.from(el.shadowRoot!.querySelectorAll('.row')).find(
    (row) => row.querySelector('[part="key"]')?.textContent === 'self',
  ) as HTMLElement;
  expect((selfRow.querySelector('[part="toggle"]') as HTMLElement).hasAttribute('hidden')).to.be.true;
});

it('renders a bigint value via String() instead of throwing from JSON.stringify', async () => {
  const el = await withData({ count: 10n });
  const values = Array.from(el.shadowRoot!.querySelectorAll('[part="value"]')).map((v) => v.textContent);
  expect(values).to.include('10');
});

it('copies a bigint value without throwing, downgrading it to a plain string', async () => {
  const el = await withData({ count: 10n });
  el.copyable = true;
  await el.updateComplete;

  const toolbarButton = el.shadowRoot!.querySelector('[part="toolbar"] [part="copy-button"]') as HTMLButtonElement;
  setTimeout(() => toolbarButton.click());
  const event = await oneEvent(el, 'lyra-copy');
  expect(event.detail.text).to.equal(JSON.stringify({ count: '10' }, null, 2));
});

it('does not re-walk the data tree to recompute search state on a toggle-only re-render', async () => {
  let accesses = 0;
  const trackedChild = new Proxy(
    { value: 'no match here' },
    {
      get(target, prop, receiver) {
        accesses++;
        return Reflect.get(target, prop, receiver);
      },
    },
  );
  const el = (await fixture(html`<lyra-json-viewer></lyra-json-viewer>`)) as LyraJsonViewer;
  // "hidden" (depth 1) starts collapsed from this very first render (data,
  // collapsed-depth, and search are all assigned before the first await, so
  // Lit batches them into one update) -- normal rendering never descends
  // into it, so any access to trackedChild can only come from the search
  // walk itself, which -- unlike rendering -- traverses the whole tree
  // regardless of what's currently expanded.
  el.data = { other: { a: 1 }, hidden: { nested: trackedChild } };
  el.collapsedDepth = 1;
  el.search = 'no-match-anywhere';
  await el.updateComplete;

  const accessesAfterFirstRender = accesses;
  // Sanity check: the initial search walk did reach into the collapsed
  // subtree, so the counter is a meaningful signal for the assertion below.
  expect(accessesAfterFirstRender).to.be.greaterThan(0);

  // "other" (not "hidden") is toggled, so `data`/`search` are unchanged --
  // this is an `expandedOverrides`-only re-render.
  const otherRow = Array.from(el.shadowRoot!.querySelectorAll('.row')).find(
    (row) => row.querySelector('[part="key"]')?.textContent === 'other',
  ) as HTMLElement;
  const toggle = otherRow.querySelector('[part="toggle"]') as HTMLButtonElement;
  toggle.click();
  await el.updateComplete;

  expect(accesses).to.equal(accessesAfterFirstRender);
});

it('prunes stale expandedOverrides entries once their path no longer exists after a data reassignment', async () => {
  const el = await withData({ old: { deep: { x: 1 } } });
  el.collapsedDepth = 0;
  await el.updateComplete;

  const rootToggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement;
  rootToggle.click();
  await el.updateComplete;

  const oldToggle = (
    Array.from(el.shadowRoot!.querySelectorAll('.row')).find(
      (row) => row.querySelector('[part="key"]')?.textContent === 'old',
    ) as HTMLElement
  ).querySelector('[part="toggle"]') as HTMLButtonElement;
  oldToggle.click();
  await el.updateComplete;
  expect(oldToggle.getAttribute('aria-expanded')).to.equal('true');

  // Remove the "old" key entirely -- its ["old"] override has nothing left
  // to apply to.
  el.data = { fresh: 1 };
  await el.updateComplete;

  // Reintroduce an unrelated "old" node that coincidentally reuses the
  // exact same path key ('["old"]'). If the stale override had survived,
  // this brand-new node would render already-expanded despite
  // collapsed-depth="0" defaulting everything closed.
  el.data = { old: { other: 2 } };
  await el.updateComplete;

  const newOldToggle = (
    Array.from(el.shadowRoot!.querySelectorAll('.row')).find(
      (row) => row.querySelector('[part="key"]')?.textContent === 'old',
    ) as HTMLElement
  ).querySelector('[part="toggle"]') as HTMLButtonElement;
  expect(newOldToggle.getAttribute('aria-expanded')).to.equal('false');
});

it('gives each per-node copy button a distinct aria-label naming its own key', async () => {
  const el = await withData(sample);
  el.copyable = true;
  await el.updateComplete;

  const ageButton = (
    Array.from(el.shadowRoot!.querySelectorAll('.row')).find(
      (row) => row.querySelector('[part="key"]')?.textContent === 'age',
    ) as HTMLElement
  ).querySelector('[part="copy-button"]') as HTMLButtonElement;
  const nameButton = (
    Array.from(el.shadowRoot!.querySelectorAll('.row')).find(
      (row) => row.querySelector('[part="key"]')?.textContent === 'name',
    ) as HTMLElement
  ).querySelector('[part="copy-button"]') as HTMLButtonElement;

  expect(ageButton.getAttribute('aria-label')).to.equal('Copy age');
  expect(nameButton.getAttribute('aria-label')).to.equal('Copy name');
  expect(ageButton.getAttribute('aria-label')).to.not.equal(nameButton.getAttribute('aria-label'));
});

it('renders a root primitive with no key label', async () => {
  const el = await withData('just a string');
  const value = el.shadowRoot!.querySelector('[part="value"]');
  expect(value!.textContent).to.equal('"just a string"');
  expect(el.shadowRoot!.querySelector('[part="key"]')).to.not.exist;
});

it('respects max-height by setting the scoped custom property on the base part', async () => {
  const el = await withData(sample);
  el.maxHeight = '10rem';
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.style.getPropertyValue('--lyra-json-viewer-max-height')).to.equal('10rem');
});

it('is accessible with a populated, expanded tree', async () => {
  const el = await withData(sample);
  await expect(el).to.be.accessible();
});

it('is accessible with copyable buttons and a collapsed root', async () => {
  const el = await withData(sample);
  el.copyable = true;
  el.collapsedDepth = 0;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('is accessible with an empty/default (undefined) value', async () => {
  const el = (await fixture(html`<lyra-json-viewer></lyra-json-viewer>`)) as LyraJsonViewer;
  await expect(el).to.be.accessible();
});

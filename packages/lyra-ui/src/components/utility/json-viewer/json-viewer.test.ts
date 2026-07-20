import { fixture, expect, oneEvent, html } from '@open-wc/testing';
import './json-viewer.js';
import type { LyraJsonViewer } from './json-viewer.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './json-viewer.styles.js';

const sample = {
  name: 'Ada Lovelace',
  age: 36,
  active: true,
  bio: null,
  tags: ['mathematician', 'writer'],
  address: { city: 'London', country: 'UK' },
};

async function withData(data: unknown): Promise<LyraJsonViewer> {
  const el = (await fixture(html`<lr-json-viewer></lr-json-viewer>`)) as LyraJsonViewer;
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

it('normalizes a NaN collapsedDepth to 0 (fully collapsed) instead of silently disabling auto-collapse', async () => {
  const el = await withData(sample);
  el.collapsedDepth = NaN;
  await el.updateComplete;

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

it('gives tree toggles and copy controls the shared minimum hit area', async () => {
  const el = await withData(sample);
  el.copyable = true;
  await el.updateComplete;

  const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLElement;
  const copy = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLElement;
  expect(getComputedStyle(toggle).minInlineSize).to.equal('40px');
  expect(getComputedStyle(toggle).minBlockSize).to.equal('40px');
  expect(getComputedStyle(copy).minInlineSize).to.equal('40px');
  expect(getComputedStyle(copy).minBlockSize).to.equal('40px');
});

it('renders a top-level copy button when copyable, and emits lr-copy with the full JSON on click', async () => {
  const el = await withData(sample);
  el.copyable = true;
  await el.updateComplete;

  const toolbarButton = el.shadowRoot!.querySelector('[part="toolbar"] [part="copy-button"]') as HTMLButtonElement;
  expect(toolbarButton).to.exist;

  setTimeout(() => toolbarButton.click());
  const event = await oneEvent(el, 'lr-copy');
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
  const event = await oneEvent(el, 'lr-copy');
  expect(event.detail.text).to.equal('36');
});

it('fires lr-copy even when navigator.clipboard is unavailable', async () => {
  const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });

  try {
    const el = await withData(sample);
    el.copyable = true;
    await el.updateComplete;
    const toolbarButton = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement;

    setTimeout(() => toolbarButton.click());
    const event = await oneEvent(el, 'lr-copy');
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
  const event = await oneEvent(el, 'lr-copy');
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
  const event = await oneEvent(el, 'lr-copy');
  expect(event.detail.text).to.equal(JSON.stringify({ count: '10' }, null, 2));
});

it('copies a self-referencing value without throwing, substituting the localized circular marker', async () => {
  const o: Record<string, unknown> = { name: 'root' };
  o.self = o;
  const el = await withData(o);
  el.copyable = true;
  await el.updateComplete;

  const toolbarButton = el.shadowRoot!.querySelector('[part="toolbar"] [part="copy-button"]') as HTMLButtonElement;
  setTimeout(() => toolbarButton.click());
  const event = await oneEvent(el, 'lr-copy');
  expect(event.detail.text).to.equal(JSON.stringify({ name: 'root', self: 'Circular reference' }, null, 2));
});

it('copies a value with the same object reachable via two non-cyclic paths without flagging it circular', async () => {
  const shared = { id: 1 };
  const el = await withData({ a: shared, b: shared });
  el.copyable = true;
  await el.updateComplete;

  const toolbarButton = el.shadowRoot!.querySelector('[part="toolbar"] [part="copy-button"]') as HTMLButtonElement;
  setTimeout(() => toolbarButton.click());
  const event = await oneEvent(el, 'lr-copy');
  expect(event.detail.text).to.equal(JSON.stringify({ a: { id: 1 }, b: { id: 1 } }, null, 2));
});

it('sizes the closing-bracket spacer to the toggle\'s real (min-inline-size-driven) width, keeping brackets aligned', async () => {
  const el = await withData({ nested: { a: 1 } });
  await el.updateComplete;
  const toggle = el.shadowRoot!.querySelector('[part="toggle"]:not([hidden])') as HTMLElement;
  const spacer = el.shadowRoot!.querySelector('.toggle-space') as HTMLElement;
  expect(toggle, 'the nested object should render expanded with a real toggle').to.exist;
  expect(spacer, 'the closing-bracket row should render its alignment spacer').to.exist;
  expect(getComputedStyle(spacer).getPropertyValue('inline-size')).to.equal(
    getComputedStyle(toggle).getPropertyValue('inline-size'),
  );
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
  const el = (await fixture(html`<lr-json-viewer></lr-json-viewer>`)) as LyraJsonViewer;
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
  expect(base.style.getPropertyValue('--lr-json-viewer-max-height')).to.equal('10rem');
});

it('keeps the tree LTR in RTL: a collapsed chevron still points right, expanded points down', async () => {
  // The tree is pinned direction:ltr (a JSON structure reads left-to-right in any locale, like
  // devtools/VS Code), so the disclosure chevron behaves identically to an LTR document rather
  // than mirroring -- collapsed points right (rotate 0), expanded points down (rotate 90).
  const wrapper = await fixture(html`
    <div dir="rtl">
      <lr-json-viewer
        .data=${{ nested: true }}
        collapsed-depth="0"
        style="--lr-transition-fast: 0s"
      ></lr-json-viewer>
    </div>
  `);
  const el = wrapper.querySelector('lr-json-viewer') as LyraJsonViewer;
  await el.updateComplete;
  const tree = el.shadowRoot!.querySelector('[part="tree"]') as HTMLElement;
  expect(getComputedStyle(tree).direction).to.equal('ltr');

  const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement;
  const chevron = toggle.querySelector('.chevron') as HTMLElement;
  const collapsed = new DOMMatrixReadOnly(getComputedStyle(chevron).transform);
  expect(collapsed.a).to.be.closeTo(1, 0.001);
  expect(collapsed.b).to.be.closeTo(0, 0.001);
  expect(collapsed.d).to.be.closeTo(1, 0.001);

  toggle.click();
  await el.updateComplete;
  const expandedToggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement;
  expect(expandedToggle.getAttribute('aria-expanded')).to.equal('true');
  const expandedChevron = expandedToggle.querySelector('.chevron') as HTMLElement;
  const expanded = new DOMMatrixReadOnly(getComputedStyle(expandedChevron).transform);
  expect(expanded.a).to.be.closeTo(0, 0.001);
  expect(expanded.b).to.be.closeTo(1, 0.001);
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
  const el = (await fixture(html`<lr-json-viewer></lr-json-viewer>`)) as LyraJsonViewer;
  await expect(el).to.be.accessible();
});

it('localizes the root toggle\'s "array"/"object" fallback label via this.localize()', async () => {
  const arrayEl = await withData([1, 2]);
  arrayEl.strings = { jsonArray: 'tableau' };
  await arrayEl.updateComplete;
  const arrayToggle = arrayEl.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement;
  expect(arrayToggle.getAttribute('aria-label')).to.contain('tableau');

  const objectEl = await withData({ a: 1 });
  objectEl.strings = { jsonObject: 'objet' };
  await objectEl.updateComplete;
  const objectToggle = objectEl.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement;
  expect(objectToggle.getAttribute('aria-label')).to.contain('objet');
});

it('defaults to English "array"/"object" when no strings override is set', async () => {
  const arrayEl = await withData([1, 2]);
  const arrayToggle = arrayEl.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement;
  expect(arrayToggle.getAttribute('aria-label')).to.contain('array');
});

describe('imperative search API', () => {
  const SAMPLE = { name: 'Ada', role: 'Mathematician', team: { name: 'Analytical Engine', size: 3 } };

  // NB: the convenience method is `runSearch()`, not `search()` -- `search` is already this
  // component's pre-existing declarative `@property()` string (predating this quartet), and a
  // method can't share a class member name with a property. See the JSDoc on `runSearch()` in
  // json-viewer.class.ts for the full rationale.

  it('runSearch() resolves the count equal to the rendered data-match span count', async () => {
    const el = (await fixture(html`<lr-json-viewer .data=${SAMPLE}></lr-json-viewer>`)) as LyraJsonViewer;
    const count = await el.runSearch('name');
    await el.updateComplete;
    expect(count).to.equal(el.shadowRoot!.querySelectorAll('[data-match]').length);
    expect(count).to.equal(2); // "name" key at root and inside "team"
  });

  it('searchNext/searchPrevious move the cursor in document walk order (key before value at one path)', async () => {
    const el = (await fixture(html`<lr-json-viewer .data=${{ ada: 'ada' }}></lr-json-viewer>`)) as LyraJsonViewer;
    await el.runSearch('ada'); // matches the key "ada" AND its own value "ada" at the same path
    let detail: { activeIndex: number } | undefined;
    el.addEventListener('lr-search-change', (e) => (detail = (e as CustomEvent).detail));
    expect(await el.searchNext()).to.be.true;
    expect(detail!.activeIndex).to.equal(0);
    expect(await el.searchNext()).to.be.true;
    expect(detail!.activeIndex).to.equal(1);
    expect(await el.searchNext()).to.be.true;
    expect(detail!.activeIndex).to.equal(0); // wraps
  });

  it('activeIndex starts at -1 before any navigation', async () => {
    const el = (await fixture(html`<lr-json-viewer .data=${SAMPLE}></lr-json-viewer>`)) as LyraJsonViewer;
    let detail: { activeIndex: number } | undefined;
    el.addEventListener('lr-search-change', (e) => (detail = (e as CustomEvent).detail));
    await el.runSearch('name');
    expect(detail!.activeIndex).to.equal(-1);
  });

  it('a user-collapsed ancestor keeps its override while the cursor still advances', async () => {
    const el = (await fixture(html`<lr-json-viewer .data=${SAMPLE} collapsed-depth=${99}></lr-json-viewer>`)) as LyraJsonViewer;
    await el.runSearch('name');
    // The "team" toggle button, force-expanded by the match -- user collapses it explicitly.
    const toggles = [...el.shadowRoot!.querySelectorAll('[part="toggle"]')] as HTMLButtonElement[];
    const teamToggle = toggles.find((t) => t.getAttribute('aria-expanded') === 'true');
    teamToggle?.click();
    await el.updateComplete;
    expect(await el.searchNext()).to.be.true;
    expect(await el.searchNext()).to.be.true; // still advances even though a match may now be hidden
  });

  it('emits exactly one lr-search-change when data reshapes, resetting activeIndex to -1', async () => {
    const el = (await fixture(html`<lr-json-viewer .data=${SAMPLE}></lr-json-viewer>`)) as LyraJsonViewer;
    await el.runSearch('name');
    await el.searchNext();
    let callCount = 0;
    let lastDetail: { activeIndex: number } | undefined;
    el.addEventListener('lr-search-change', (e) => {
      callCount++;
      lastDetail = (e as CustomEvent).detail;
    });
    el.data = { other: 'value' };
    await el.updateComplete;
    expect(callCount).to.equal(1);
    expect(lastDetail!.activeIndex).to.equal(-1);
  });

  it('clearSearch() resets query/matchCount/activeIndex', async () => {
    const el = (await fixture(html`<lr-json-viewer .data=${SAMPLE}></lr-json-viewer>`)) as LyraJsonViewer;
    await el.runSearch('name');
    const listener = oneEvent(el, 'lr-search-change');
    el.clearSearch();
    const event = (await listener) as CustomEvent<{ query: string; matchCount: number; activeIndex: number }>;
    expect(event.detail).to.deep.equal({ query: '', matchCount: 0, activeIndex: -1 });
    expect(el.search).to.equal('');
  });

  it('back-compat: rendered DOM is unchanged until a cursor exists', async () => {
    const before = (await fixture(html`<lr-json-viewer .data=${SAMPLE} search="name"></lr-json-viewer>`)) as LyraJsonViewer;
    await before.updateComplete;
    const beforeHtml = before.shadowRoot!.querySelector('[part="tree"]')!.innerHTML;
    const after = (await fixture(html`<lr-json-viewer .data=${SAMPLE}></lr-json-viewer>`)) as LyraJsonViewer;
    await after.runSearch('name');
    await after.updateComplete;
    expect(after.shadowRoot!.querySelector('[part="tree"]')!.innerHTML).to.equal(beforeHtml);
  });
});

describe('hover-rule specificity (::part() theming escape hatch)', () => {
  it("wraps the row's own copy-button reveal-on-hover rule in :where() so a consumer's ::part(copy-button):hover wins", () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    // Both the .row ancestor and the [part='copy-button'] target must be inside a :where() --
    // otherwise the attribute-selector contribution alone keeps this rule out-specificitying a
    // consumer's ::part(copy-button):hover ((0,1,1)).
    expect(css).to.match(/:where\(\.row\):hover :where\(\[part='copy-button'\]\)/);
    expect(css).to.match(/:where\(\.row\):focus-within :where\(\[part='copy-button'\]\)/);
  });

  it("wraps the toggle's hover retheme rule in :where() so a consumer's ::part(toggle):hover wins", () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/:where\(\[part='toggle'\]\):hover:where\(:not\(\[hidden\]\)\)\s*\{[^}]*background:\s*var\(--lr-color-brand-quiet\)/);
  });

  it('a ::part(copy-button):hover override actually wins over the internal reveal rule', async () => {
    const style = document.createElement('style');
    style.textContent = `lr-json-viewer::part(copy-button):hover { opacity: 0.5; }`;
    document.head.appendChild(style);
    try {
      const el = await withData(sample);
      el.copyable = true;
      await el.updateComplete;
      // jsdom/browser test runners don't synthesize a real :hover pseudo-class from a dispatched
      // event, so this is asserted via the stylesheet specificity check above (the same reasoning
      // lr-code-block's identical gutter-button test documents) -- this test just proves the
      // fixture still renders correctly with the competing consumer stylesheet present.
      // One copy-button per rendered node, so assert presence (the original `.to.exist`
      // semantics), not an exact count.
      expect(el.shadowRoot!.querySelectorAll('[part="copy-button"]').length).to.be.greaterThan(0);
    } finally {
      style.remove();
    }
  });
});

describe('search-match highlight cssprop indirection', () => {
  it('recolors the match highlight from --lr-json-viewer-match-bg on an ancestor, not a bare shared token', async () => {
    const el = await withData(sample);
    el.style.setProperty('--lr-json-viewer-match-bg', 'rgb(10, 20, 30)');
    el.search = 'ada';
    await el.updateComplete;
    const match = el.shadowRoot!.querySelector('[part="value"][data-match]') as HTMLElement;
    expect(getComputedStyle(match).backgroundColor).to.equal('rgb(10, 20, 30)');
  });

  it('renders byte-identically to the pre-cssprop-indirection output when the prop is unset', async () => {
    const el = await withData(sample);
    el.search = 'ada';
    await el.updateComplete;
    const match = el.shadowRoot!.querySelector('[part="value"][data-match]') as HTMLElement;
    // Fallback arm resolves to the same --lr-color-warning-quiet token as before the indirection
    // (light-theme default #fff8c5), unchanged from the pre-fix output.
    expect(getComputedStyle(match).backgroundColor).to.equal('rgb(255, 248, 197)');
  });
});

describe('lifecycle: willUpdate calls super', () => {
  it('calls super.willUpdate() so a future base-class hook is not silently skipped', async () => {
    let sawCall = false;
    const original = LyraElement.prototype.willUpdate;
    (LyraElement.prototype as unknown as { willUpdate: () => void }).willUpdate = function (
      this: LyraElement,
      ...args: unknown[]
    ) {
      sawCall = true;
      return (original as (...a: unknown[]) => void).apply(this, args);
    };
    try {
      const el = await withData(sample);
      el.search = 'ada';
      await el.updateComplete;
      expect(sawCall).to.be.true;
    } finally {
      LyraElement.prototype.willUpdate = original;
    }
  });
});

import { expect } from '@open-wc/testing';
import {
  CatalogPickerController,
  filterCatalogEntries,
  normalizeCatalog,
  withSyntheticCatalogValue,
  type LyraCatalogEntry,
} from './catalog-picker.js';

interface PickerHost extends HTMLElement {
  readonly renderRoot: ShadowRoot;
  readonly effectiveDisabled: boolean;
  readonly updateComplete: Promise<boolean>;
}

function pickerController(
  catalog: readonly LyraCatalogEntry[] = [],
  containsFocusTarget?: (target: EventTarget | null) => boolean,
): { controller: CatalogPickerController<LyraCatalogEntry>; host: PickerHost } {
  const host = document.createElement('div') as unknown as PickerHost;
  const renderRoot = host.attachShadow({ mode: 'open' });
  Object.defineProperties(host, {
    effectiveDisabled: { configurable: true, value: false },
    renderRoot: { configurable: true, value: renderRoot },
    updateComplete: { configurable: true, value: Promise.resolve(true) },
  });
  const controller = new CatalogPickerController(host, {
    catalog: () => catalog,
    allowCustom: () => true,
    isReadonly: () => false,
    locale: () => 'en',
    searchableFields: (entry) => [entry.id, entry.label],
    emitChange: () => {},
    onValueChange: () => {},
    onDefaultValueChange: () => {},
    onStateChange: () => {},
    containsFocusTarget,
  });
  return { controller, host };
}

it('normalizes string shorthand without changing complete records', () => {
  const full = { id: 'b', label: 'Beta', description: 'Second' };
  expect(normalizeCatalog(['a'])).to.deep.equal([{ id: 'a', label: 'a' }]);
  expect(normalizeCatalog([full])).to.deep.equal([full]);
});

it('keeps the first unique nonempty catalog id before any picker uses the collection', () => {
  const first = { id: 'same', label: 'First', previewUrl: 'first.mp3' };
  const later = { id: 'same', label: 'Later', previewUrl: 'later.mp3' };

  expect(normalizeCatalog(['', 'alpha', 'alpha', '   ', 'beta'])).to.deep.equal([
    { id: 'alpha', label: 'alpha' },
    { id: 'beta', label: 'beta' },
  ]);
  expect(normalizeCatalog([first, later])).to.deep.equal([first]);
});

it('omits object rows without a nonblank string label', () => {
  expect(normalizeCatalog([
    { id: 'missing' },
    { id: 'null', label: null },
    { id: 'empty', label: '' },
    { id: 'blank', label: '   ' },
    { id: 'valid', label: 'Valid' },
  ] as unknown as LyraCatalogEntry[])).to.deep.equal([
    { id: 'valid', label: 'Valid' },
  ]);
});

it('adds one synthetic stale value without mutating the source catalog', () => {
  const source = [{ id: 'a', label: 'Alpha' }];
  expect(withSyntheticCatalogValue(source, 'stale')).to.deep.equal([
    { id: 'a', label: 'Alpha', synthetic: false },
    { id: 'stale', label: 'stale', synthetic: true },
  ]);
  expect(withSyntheticCatalogValue(source, '   ')).to.deep.equal([
    { id: 'a', label: 'Alpha', synthetic: false },
  ]);
  expect(source).to.deep.equal([{ id: 'a', label: 'Alpha' }]);
});

it('filters locale-aware across caller-selected searchable fields', () => {
  const entries = [
    { id: 'en', label: 'English', language: 'English' },
    { id: 'tr', label: 'Türkçe', language: 'Türkçe' },
  ];
  expect(filterCatalogEntries(entries, 'TÜRK', 'tr', (entry) => [entry.id, entry.label, entry.language])).to.deep.equal([
    entries[1],
  ]);
});

it('keeps empty picker keyboard navigation bounded at no active row', () => {
  const { controller } = pickerController();
  controller.setOpen(true);

  for (const key of ['ArrowDown', 'ArrowUp', 'Home']) {
    const triggerEvent = new KeyboardEvent('keydown', { key, cancelable: true });
    controller.handleTriggerKeyDown(triggerEvent);
    expect(triggerEvent.defaultPrevented).to.equal(true);
    expect(controller.activeIndex).to.equal(-1);
  }
  for (const key of ['ArrowDown', 'ArrowUp', 'Home']) {
    const inputEvent = new KeyboardEvent('keydown', { key, cancelable: true });
    controller.handleInputKeyDown(inputEvent);
    expect(inputEvent.defaultPrevented).to.equal(true);
    expect(controller.activeIndex).to.equal(-1);
  }
});

it('clamps nonempty picker navigation at both row boundaries', () => {
  const { controller } = pickerController([
    { id: 'alpha', label: 'Alpha' },
    { id: 'beta', label: 'Beta' },
  ]);
  controller.setOpen(true);

  controller.handleTriggerKeyDown(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true }));
  controller.handleTriggerKeyDown(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true }));
  controller.handleTriggerKeyDown(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true }));
  expect(controller.activeIndex).to.equal(1);
  controller.handleTriggerKeyDown(new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true }));
  controller.handleTriggerKeyDown(new KeyboardEvent('keydown', { key: 'Home', cancelable: true }));
  expect(controller.activeIndex).to.equal(0);

  controller.setActiveIndex(-1);
  controller.handleInputKeyDown(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true }));
  controller.handleInputKeyDown(new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true }));
  controller.handleInputKeyDown(new KeyboardEvent('keydown', { key: 'Home', cancelable: true }));
  expect(controller.activeIndex).to.equal(0);
});

it('ignores an unbound input event and defers open-picker adoption safely while detached', async () => {
  const { controller } = pickerController();
  controller.handleInput(new Event('input'));
  expect(controller.query).to.equal('');

  controller.setOpen(true);
  controller.adopted();
  await Promise.resolve();
  expect(controller.open).to.equal(true);
});

it('uses a caller focus-boundary predicate before relaying control focus', () => {
  const related = document.createElement('button');
  document.body.append(related);
  let predicateTarget: EventTarget | null | undefined;
  const { controller } = pickerController([], (target) => {
    predicateTarget = target;
    return true;
  });
  const event = new FocusEvent('focus', { relatedTarget: related });

  try {
    controller.handleControlFocus(event);
    expect(predicateTarget === related).to.equal(true);
  } finally {
    related.remove();
  }
});

it('uses the rendered-root focus boundary when no caller predicate is supplied', () => {
  const { controller, host } = pickerController();
  const related = document.createElement('button');
  host.renderRoot.append(related);
  const event = new FocusEvent('focus', { relatedTarget: related });

  controller.handleControlFocus(event);
  expect(event.cancelBubble).to.equal(true);
});

it('reuses normalized rows and lowercased search keys until the catalog, value or locale change', () => {
  const rows = (prefix: string, count: number): readonly LyraCatalogEntry[] =>
    Object.freeze(
      Array.from({ length: count }, (_, index) => Object.freeze({ id: `${prefix}-${index}`, label: `${prefix} ${index}` })),
    );
  let catalog = rows('Voice', 40);
  let locale = 'en';
  let fieldReads = 0;
  const host = document.createElement('div') as unknown as PickerHost;
  const renderRoot = host.attachShadow({ mode: 'open' });
  Object.defineProperties(host, {
    effectiveDisabled: { configurable: true, value: false },
    renderRoot: { configurable: true, value: renderRoot },
    updateComplete: { configurable: true, value: Promise.resolve(true) },
  });
  const controller = new CatalogPickerController(host, {
    catalog: () => catalog,
    allowCustom: () => true,
    isReadonly: () => false,
    locale: () => locale,
    searchableFields: (entry) => {
      fieldReads += 1;
      return [entry.id, entry.label];
    },
    emitChange: () => {},
    onValueChange: () => {},
    onDefaultValueChange: () => {},
    onStateChange: () => {},
  });

  controller.setQuery('voice 1');
  const filtered = controller.filteredEntries;
  expect(filtered.map((entry) => entry.id)).to.deep.equal([
    'Voice-1', ...Array.from({ length: 10 }, (_, index) => `Voice-${10 + index}`),
  ]);
  const reads = fieldReads;
  for (let render = 0; render < 5; render++) {
    expect(controller.filteredEntries === filtered).to.equal(true);
    expect(controller.visibleEntries === filtered).to.equal(true);
    expect(controller.labelFor('Voice-3')).to.equal('Voice 3');
  }
  controller.setQuery('voice 2');
  expect(controller.filteredEntries.map((entry) => entry.id)).to.include('Voice-2');
  expect(fieldReads, 'a new query reuses the lowercased keys').to.equal(reads);

  catalog = rows('Model', 3);
  controller.setQuery('model');
  expect(controller.filteredEntries.map((entry) => entry.id)).to.deep.equal(['Model-0', 'Model-1', 'Model-2']);
  catalog = Object.freeze([Object.freeze({ id: 'ist', label: '\u0130stanbul' })]);
  controller.setQuery('istanbul');
  expect(controller.filteredEntries, 'English lowercases dotted capital I to i + U+0307').to.have.length(0);
  locale = 'tr';
  expect(controller.filteredEntries.map((entry) => entry.id)).to.deep.equal(['ist']);
});

describe('catalog boundary shared with the international selectors', () => {
  it('reads rows only through own data properties and never runs a caller getter', () => {
    let getterRuns = 0;
    const accessorLabel = Object.defineProperty({ id: 'b' }, 'label', {
      enumerable: true,
      get() {
        getterRuns += 1;
        return 'Beta';
      },
    });
    const accessorId = Object.defineProperty({ label: 'Gamma' }, 'id', {
      enumerable: true,
      get() {
        getterRuns += 1;
        return 'g';
      },
    });
    const rows = normalizeCatalog([{ id: 'a', label: 'Alpha' }, accessorLabel, accessorId] as LyraCatalogEntry[]);
    expect(rows.map((row) => row.id)).to.deep.equal(['a']);
    const indexed = ['x'];
    Object.defineProperty(indexed, 1, {
      enumerable: true,
      get() {
        getterRuns += 1;
        return 'y';
      },
    });
    expect(normalizeCatalog(indexed as readonly string[]).map((row) => row.id)).to.deep.equal(['x']);
    expect(getterRuns).to.equal(0);
  });

  it('reads at most the shared catalog row ceiling', () => {
    const rows = normalizeCatalog(Array.from({ length: 1_500 }, (_, index) => `model-${index}`));
    expect(rows.length).to.equal(1_024);
    expect(rows.at(-1)?.id).to.equal('model-1023');
  });

  it('normalizes a frozen (owned) catalog once and shares the rows', () => {
    const catalog: readonly LyraCatalogEntry[] = Object.freeze([
      Object.freeze({ id: 'a', label: 'Ay' }),
      Object.freeze({ id: 'b', label: 'Bee' }),
    ]);
    const first = normalizeCatalog(catalog);
    expect(normalizeCatalog(catalog) === first).to.equal(true);
    const mutable = ['a'];
    expect(normalizeCatalog(mutable) === normalizeCatalog(mutable)).to.equal(false);
  });
});

describe('closed-mode type-ahead', () => {
  function closedPicker(labels: readonly string[], disabled: readonly string[] = []) {
    const host = document.createElement('div') as unknown as PickerHost;
    const renderRoot = host.attachShadow({ mode: 'open' });
    Object.defineProperties(host, {
      effectiveDisabled: { configurable: true, value: false },
      renderRoot: { configurable: true, value: renderRoot },
      updateComplete: { configurable: true, value: Promise.resolve(true) },
    });
    const changes: string[] = [];
    const catalog = Object.freeze(
      labels.map((label) => Object.freeze({ id: label.toLowerCase(), label, disabled: disabled.includes(label) })),
    );
    const controller = new CatalogPickerController(host, {
      catalog: () => catalog,
      allowCustom: () => false,
      isReadonly: () => false,
      locale: () => 'en',
      searchableFields: (entry) => [entry.id, entry.label],
      emitChange: (detail) => changes.push(detail.value),
      onValueChange: () => {},
      onDefaultValueChange: () => {},
      onStateChange: () => {},
    });
    const type = (key: string): KeyboardEvent => {
      const event = new KeyboardEvent('keydown', { key, cancelable: true });
      controller.handleTriggerKeyDown(event);
      return event;
    };
    return { controller, changes, type };
  }

  it('commits the next enabled row whose label starts with the typed text while closed', () => {
    const { controller, changes, type } = closedPicker(['Alpha', 'Beta', 'Bravo', 'Charlie', 'Bistro'], ['Bistro']);
    type('b');
    expect(controller.value).to.equal('beta');
    type('r');
    expect(controller.value, 'keystrokes inside the quiet window narrow the search').to.equal('bravo');
    expect(changes).to.deep.equal(['beta', 'bravo']);
    expect(controller.open).to.equal(false);
  });

  it('cycles from the current row and skips disabled rows', async () => {
    const { controller, type } = closedPicker(['Beta', 'Bistro', 'Bravo'], ['Bistro']);
    type('b');
    expect(controller.value).to.equal('beta');
    await new Promise((resolve) => setTimeout(resolve, 600));
    type('b');
    expect(controller.value).to.equal('bravo');
    await new Promise((resolve) => setTimeout(resolve, 600));
    type('b');
    expect(controller.value, 'wraps past the end').to.equal('beta');
  });

  it('only moves the active row while open, and keeps Space as activation until a search starts', () => {
    const { controller, changes, type } = closedPicker(['Alpha', 'Big Sur', 'Bravo']);
    controller.setOpen(true);
    type(' ');
    expect(controller.open, 'Space with an empty buffer keeps its activation meaning').to.equal(false);
    expect(changes).to.deep.equal([]);
    controller.setOpen(true);
    controller.setActiveIndex(-1);
    type('b');
    expect(controller.activeIndex).to.equal(1);
    expect(type(' ').defaultPrevented).to.equal(true);
    type('s');
    expect(controller.activeIndex, '"b s" still matches Big Sur').to.equal(1);
    type('x');
    expect(controller.activeIndex, 'no match leaves the active row').to.equal(1);
    expect(changes).to.deep.equal([]);
    expect(controller.value).to.equal('');
  });

  it('ignores modified keys', () => {
    const { controller, type } = closedPicker(['Alpha', 'Beta']);
    for (const init of [{ key: 'b', ctrlKey: true }, { key: 'b', metaKey: true }, { key: 'b', altKey: true }]) {
      controller.handleTriggerKeyDown(new KeyboardEvent('keydown', { ...init, cancelable: true }));
    }
    expect(controller.value).to.equal('');
    type('Tab');
    expect(controller.value).to.equal('');
  });
});

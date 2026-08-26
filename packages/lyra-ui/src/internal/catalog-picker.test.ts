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
  });
  const controller = new CatalogPickerController(host, {
    catalog: () => catalog,
    allowCustom: () => true,
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

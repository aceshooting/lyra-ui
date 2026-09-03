import { expect } from '@open-wc/testing';
import {
  CatalogPickerController,
  type LyraCatalogEntry,
} from './catalog-picker.js';

interface PickerHost extends HTMLElement {
  readonly renderRoot: ShadowRoot;
  readonly effectiveDisabled: boolean;
}

interface PickerFixture {
  controller: CatalogPickerController<LyraCatalogEntry>;
  host: PickerHost;
  control: HTMLElement;
}

function createPicker(owner: Document, allowCustom = false): PickerFixture {
  const host = owner.createElement('div') as unknown as PickerHost;
  const root = host.attachShadow({ mode: 'open' });
  const control = owner.createElement(allowCustom ? 'input' : 'button');
  control.setAttribute('part', allowCustom ? 'combobox-input' : 'trigger');
  if (allowCustom) control.setAttribute('role', 'combobox');
  const listbox = owner.createElement('div');
  listbox.setAttribute('part', 'listbox');
  listbox.setAttribute('role', 'listbox');
  root.append(control, listbox);
  Object.defineProperties(host, {
    effectiveDisabled: { configurable: true, value: false },
    renderRoot: { configurable: true, value: root },
  });
  return {
    controller: new CatalogPickerController(host, {
      catalog: () => [
        { id: 'alpha', label: 'Alpha' },
        { id: 'beta', label: 'Beta' },
      ],
      allowCustom: () => allowCustom,
      isReadonly: () => false,
      locale: () => 'en',
      searchableFields: (entry) => [entry.id, entry.label],
      emitChange: () => {},
      onValueChange: () => {},
      onDefaultValueChange: () => {},
      onStateChange: () => {},
    }),
    host,
    control,
  };
}

function openPicker(picker: PickerFixture): void {
  picker.controller.setOpen(true);
  picker.controller.updated(true);
}

function dispatchEscape(owner: Document): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: 'Escape',
    bubbles: true,
    cancelable: true,
    composed: true,
  });
  owner.dispatchEvent(event);
  return event;
}

function dispatchOutsidePointer(owner: Document): void {
  const PointerEventConstructor = owner.defaultView?.PointerEvent ?? PointerEvent;
  owner.body.dispatchEvent(
    new PointerEventConstructor('pointerdown', { bubbles: true, composed: true }),
  );
}

function removePicker(picker: PickerFixture): void {
  picker.controller.disconnected();
  picker.host.remove();
}

it('keeps one nonmodal overlay per opening and routes Escape/outside dismissal to the topmost picker', () => {
  const lower = createPicker(document);
  const upper = createPicker(document);
  document.body.append(lower.host, upper.host);

  try {
    openPicker(lower);
    openPicker(upper);
    const overlay = (upper.controller as unknown as { overlay?: object }).overlay;
    upper.controller.updated(true);
    expect((upper.controller as unknown as { overlay?: object }).overlay).to.equal(overlay);

    const escape = dispatchEscape(document);
    expect(escape.defaultPrevented).to.equal(true);
    expect(upper.controller.open).to.equal(false);
    expect(lower.controller.open).to.equal(true);

    openPicker(upper);
    dispatchOutsidePointer(document);
    expect(upper.controller.open).to.equal(false);
    expect(lower.controller.open).to.equal(true);

    dispatchOutsidePointer(document);
    expect(lower.controller.open).to.equal(false);
  } finally {
    removePicker(upper);
    removePicker(lower);
  }
});

it('preserves focus return and native Tab behavior for open catalog popups', () => {
  const closed = createPicker(document);
  const free = createPicker(document, true);
  document.body.append(closed.host, free.host);

  try {
    closed.control.focus();
    openPicker(closed);
    dispatchEscape(document);
    expect(closed.controller.open).to.equal(false);
    expect(closed.host.renderRoot.activeElement).to.equal(closed.control);

    free.control.focus();
    openPicker(free);
    const tab = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
      composed: true,
    });
    free.control.dispatchEvent(tab);
    expect(tab.defaultPrevented).to.equal(false);
    expect(free.controller.open).to.equal(true);
  } finally {
    removePicker(free);
    removePicker(closed);
  }
});

it('moves outside dismissal to the adopted owner document and cleans up through reconnect', async () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const frameDocument = frame.contentDocument;
  if (!frameDocument) throw new Error('The iframe document was unavailable.');
  const picker = createPicker(document);
  document.body.append(picker.host);

  try {
    openPicker(picker);
    frameDocument.body.append(frameDocument.adoptNode(picker.host));
    picker.controller.adopted();
    await Promise.resolve();

    dispatchEscape(document);
    dispatchOutsidePointer(document);
    expect(picker.controller.open).to.equal(true);

    dispatchOutsidePointer(frameDocument);
    expect(picker.controller.open).to.equal(false);

    picker.controller.disconnected();
    picker.host.remove();
    expect(picker.controller.open).to.equal(false);
    frameDocument.body.append(picker.host);
    picker.controller.connected(true);
    openPicker(picker);
    dispatchOutsidePointer(frameDocument);
    expect(picker.controller.open).to.equal(false);
  } finally {
    removePicker(picker);
    frame.remove();
  }
});

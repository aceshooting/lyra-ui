import { fixture, expect, oneEvent, html, waitUntil } from '@open-wc/testing';
import { resetMouse, sendKeys, sendMouse } from '@web/test-runner-commands';
import './voice-picker.js';
import type { LyraVoicePicker } from './voice-picker.js';
import { styles } from './voice-picker.styles.js';

const CATALOG = ['alloy', 'verse'];
const OBJECT_CATALOG = [
  {
    id: 'aria',
    label: 'Aria',
    language: 'en-US',
    description: 'Warm, narrative',
    previewUrl: 'https://example.test/aria.mp3',
  },
  { id: 'sage', label: 'Sage', language: 'en-GB' },
];
const SILENT_AUDIO_DATA_URL =
  'data:audio/wav;base64,UklGRiUAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQEAAACA';
const PREVIEW_CATALOG = [
  { ...OBJECT_CATALOG[0]!, previewUrl: SILENT_AUDIO_DATA_URL },
  OBJECT_CATALOG[1]!,
  {
    id: 'nova',
    label: 'Nova',
    previewUrl: SILENT_AUDIO_DATA_URL,
  },
];

function trigger(el: LyraVoicePicker): HTMLButtonElement {
  return el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
}
function input(el: LyraVoicePicker): HTMLInputElement {
  return el.shadowRoot!.querySelector('[part="combobox-input"]') as HTMLInputElement;
}
interface VoicePickerEditingFacade {
  readonly input: HTMLInputElement | null;
  selectionStart: number | null;
  selectionEnd: number | null;
  selectionDirection: 'forward' | 'backward' | 'none' | null;
  select(): void;
  setSelectionRange(start: number | null, end: number | null, direction?: 'forward' | 'backward' | 'none'): void;
  setRangeText(replacement: string): void;
  setRangeText(replacement: string, start: number, end: number, selectMode?: SelectionMode): void;
}
function rows(el: LyraVoicePicker): NodeListOf<HTMLElement> {
  return el.shadowRoot!.querySelectorAll('[part="option"]');
}
function previewButton(el: LyraVoicePicker): HTMLButtonElement {
  return el.shadowRoot!.querySelector('[part="preview-button"]') as HTMLButtonElement;
}
function listbox(el: LyraVoicePicker): HTMLElement {
  return el.shadowRoot!.querySelector('[part="listbox"]') as HTMLElement;
}

function syntheticRow(el: LyraVoicePicker): HTMLElement {
  const row = Array.from(rows(el)).find((candidate) => candidate.hasAttribute('data-synthetic'));
  if (!row) throw new Error('Expected a synthetic stale-value row.');
  return row;
}

function resolvedColor(el: LyraVoicePicker, value: string): string {
  const probe = document.createElement('span');
  probe.style.color = value;
  el.shadowRoot!.append(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}

/** Polls until `read()` satisfies `until`, or throws once `timeoutMs` elapses -- same idiom as
 *  internal/positioner.test.ts's/lr-menu's identical helper, for waiting out place()'s async
 *  computePosition. */
async function waitFor<T>(read: () => T, until: (v: T) => boolean, timeoutMs = 2000): Promise<T> {
  const start = performance.now();
  for (;;) {
    const value = read();
    if (until(value)) return value;
    if (performance.now() - start > timeoutMs) throw new Error(`waitFor timed out after ${timeoutMs}ms`);
    await new Promise((r) => requestAnimationFrame(() => r(null)));
  }
}

/**
 * Stubs `HTMLMediaElement.play()` for the duration of a test so internal-preview playback timing is
 * deterministic instead of racing a real (always-unreachable, since `example.test` never resolves)
 * network load -- returns a restore function that must be called (e.g. from a `finally`) to put the
 * original back before the next test.
 */
function stubMediaPlay(impl: () => Promise<void>): () => void {
  const proto = HTMLMediaElement.prototype;
  const original = proto.play;
  proto.play = impl;
  return () => {
    proto.play = original;
  };
}

// -- Mode selection (mirrors lr-model-select) ------------------------------

it('renders a closed dropdown when catalog is non-empty and allow-custom is unset', async () => {
  const el = (await fixture(html`<lr-voice-picker .catalog=${CATALOG}></lr-voice-picker>`)) as LyraVoicePicker;
  expect(trigger(el) != null).to.equal(true);
  expect((el.shadowRoot!.querySelector('[part="combobox-input"]')) === null).to.be.true;
});

it('renders a free-text input when catalog is empty/undefined or allow-custom is set', async () => {
  const el = (await fixture(html`<lr-voice-picker></lr-voice-picker>`)) as LyraVoicePicker;
  expect(input(el) != null).to.equal(true);

  const el2 = (await fixture(
    html`<lr-voice-picker allow-custom .catalog=${CATALOG}></lr-voice-picker>`
  )) as LyraVoicePicker;
  expect(input(el2) != null).to.equal(true);
});

it('keeps focus and pristine invalid semantics through live mode changes', async () => {
  const el = (await fixture(
    html`<lr-voice-picker required .catalog=${CATALOG}></lr-voice-picker>`
  )) as LyraVoicePicker;
  trigger(el).focus();
  expect(el.shadowRoot!.activeElement === trigger(el)).to.equal(true);

  el.allowCustom = true;
  await el.updateComplete;
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement === input(el)).to.equal(true);
  expect(input(el).getAttribute('aria-invalid')).to.equal('false');

  el.allowCustom = false;
  await el.updateComplete;
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement === trigger(el)).to.equal(true);
  expect(trigger(el).getAttribute('aria-invalid')).to.equal('false');
});

it('keeps both picker modes inside an exact 320px RTL allocation with long unbroken content', async () => {
  const long = 'VoiceIdentifierWithoutNaturalBreaks'.repeat(12);
  const catalog = [{ id: long, label: long, language: long, description: long }];
  const container = (await fixture(html`
    <div dir="rtl" style="display:grid;gap:var(--lr-space-s);inline-size:320px">
      <lr-voice-picker
        provider=${long}
        label=${long}
        hint=${long}
        error-text=${long}
        value=${long}
        .catalog=${catalog}
      ></lr-voice-picker>
      <lr-voice-picker
        allow-custom
        provider=${long}
        label=${long}
        hint=${long}
        error-text=${long}
        value=${long}
        .catalog=${catalog}
      ></lr-voice-picker>
    </div>
  `)) as HTMLDivElement;
  const pickers = Array.from(container.querySelectorAll('lr-voice-picker'));
  const dropdown = pickers[0]!;
  const custom = pickers[1]!;
  dropdown.open = true;
  custom.click();
  await Promise.all([dropdown.updateComplete, custom.updateComplete]);

  expect(Math.round(container.getBoundingClientRect().width)).to.equal(320);
  expect(rows(dropdown).length).to.equal(1);
  expect(rows(custom).length).to.equal(1);
  expect(input(custom).value).to.equal(long);
  // The fixed listboxes are independently viewport-clamped popovers, so this allocation check
  // deliberately measures only the inline field chrome rather than treating an owned popup as
  // parent overflow.
  for (const [picker, control] of [
    [dropdown, trigger(dropdown)],
    [custom, custom.shadowRoot!.querySelector('[part="combobox"]') as HTMLElement],
  ] as const) {
    expect(Math.round(picker.getBoundingClientRect().width)).to.equal(320);
    expect(control.scrollWidth).to.be.at.most(control.clientWidth + 1);
    for (const part of picker.shadowRoot!.querySelectorAll<HTMLElement>(
      '[part="form-control-label"], [part="hint"], [part="error"]',
    )) {
      expect(part.scrollWidth).to.be.at.most(part.clientWidth + 1);
    }
  }
});

it('forwards selection and range editing in free-text mode while synchronizing form state', async () => {
  const form = (await fixture(html`
    <form>
      <lr-voice-picker name="voice" required value="verse"></lr-voice-picker>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-voice-picker') as LyraVoicePicker;
  const facade = el as unknown as LyraVoicePicker & VoicePickerEditingFacade;
  const native = input(el);
  const valueEvents: string[] = [];
  el.addEventListener('input', (event) => valueEvents.push(event.type));
  el.addEventListener('change', (event) => valueEvents.push(event.type));

  expect(facade.input === native).to.be.true;
  facade.select();
  expect(facade.selectionStart).to.equal(0);
  expect(facade.selectionEnd).to.equal('verse'.length);

  facade.setSelectionRange(1, 4, 'forward');
  expect(facade.selectionStart).to.equal(1);
  expect(facade.selectionEnd).to.equal(4);
  expect(facade.selectionDirection).to.equal('forward');

  facade.selectionStart = 0;
  facade.selectionEnd = native.value.length;
  facade.selectionDirection = 'backward';
  expect(native.selectionStart).to.equal(0);
  expect(native.selectionEnd).to.equal('verse'.length);
  expect(native.selectionDirection).to.equal('backward');

  facade.setRangeText('', 0, native.value.length, 'end');
  expect(el.value).to.equal('');
  expect(el.validity.valueMissing).to.be.true;
  expect(new FormData(form).get('voice')).to.equal('');

  facade.setRangeText('custom-voice');
  expect(el.value).to.equal('custom-voice');
  expect(el.validity.valid).to.be.true;
  expect(new FormData(form).get('voice')).to.equal('custom-voice');
  expect(valueEvents).to.deep.equal([]);
});

it('keeps the free-text editing facade inert outside free-text mode and before render', async () => {
  const closed = (await fixture(html`
    <lr-voice-picker value="verse" .catalog=${CATALOG}></lr-voice-picker>
  `)) as LyraVoicePicker;
  const closedFacade = closed as unknown as LyraVoicePicker & VoicePickerEditingFacade;
  const detached = document.createElement('lr-voice-picker') as LyraVoicePicker & VoicePickerEditingFacade;

  for (const facade of [closedFacade, detached]) {
    expect(facade.input === null).to.be.true;
    expect(facade.selectionStart).to.equal(null);
    expect(facade.selectionEnd).to.equal(null);
    expect(facade.selectionDirection).to.equal(null);
    expect(() => {
      facade.selectionStart = 0;
      facade.selectionEnd = 0;
      facade.selectionDirection = 'forward';
      facade.select();
      facade.setSelectionRange(0, 0);
      facade.setRangeText('ignored');
    }).to.not.throw();
  }
  expect(closed.value).to.equal('verse');
});

it('renders object-catalog rows with a language/description second line', async () => {
  const el = (await fixture(html`<lr-voice-picker .catalog=${OBJECT_CATALOG}></lr-voice-picker>`)) as LyraVoicePicker;
  el.open = true;
  await el.updateComplete;
  const meta = rows(el)[0]!.querySelector('[part="option-meta"]')!;
  expect(meta.textContent).to.equal('en-US · Warm, narrative');
});

it('fails closed when a hostile catalog container hides its length', async () => {
  const catalog = new Proxy([], {
    get(target, key, receiver) {
      if (key === 'length') throw new Error('unreadable catalog length');
      return Reflect.get(target, key, receiver);
    },
  });
  const el = (await fixture(html`
    <lr-voice-picker .catalog=${catalog}></lr-voice-picker>
  `)) as LyraVoicePicker;

  expect(el.catalog).to.deep.equal([]);
  expect(Object.isFrozen(el.catalog)).to.be.true;
  expect(input(el).getAttribute('role')).to.equal('combobox');
});

it('treats non-array and sparse catalogs as safe empty snapshots', async () => {
  const el = (await fixture(html`<lr-voice-picker></lr-voice-picker>`)) as LyraVoicePicker;

  (el as unknown as { catalog: unknown }).catalog = { 0: 'not-an-array', length: 1 };
  await el.updateComplete;
  expect(el.catalog).to.equal(undefined);
  expect(input(el).getAttribute('role')).to.equal('combobox');

  const sparse = new Array<string>(2);
  (el as unknown as { catalog: unknown }).catalog = sparse;
  await el.updateComplete;
  expect(el.catalog).to.deep.equal([]);
  expect(Object.isFrozen(el.catalog)).to.equal(true);
});

it('retains valid mixed catalog rows around descriptor traps and accessor-only fields', async () => {
  const hostileEntry = new Proxy({}, {
    getOwnPropertyDescriptor(): never {
      throw new Error('unreadable entry descriptor');
    },
  });
  const accessorEntry = {};
  Object.defineProperties(accessorEntry, {
    id: { configurable: true, enumerable: true, get: () => 'accessor-id' },
    label: { configurable: true, enumerable: true, value: 'Accessor label' },
  });
  const source = [
    'alloy',
    { id: 'skipped', label: 'Skipped' },
    { id: 'aria', label: 'Aria' },
    'verse',
    42,
    hostileEntry,
    accessorEntry,
  ];
  const catalog = new Proxy(source, {
    getOwnPropertyDescriptor(target, key) {
      if (key === '1') throw new Error('unreadable catalog entry');
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
  const el = (await fixture(html`
    <lr-voice-picker .catalog=${catalog as never}></lr-voice-picker>
  `)) as LyraVoicePicker;

  expect(el.catalog?.map((entry) => typeof entry === 'string' ? entry : entry.id)).to.deep.equal([
    'alloy',
    'aria',
    'verse',
  ]);
  expect(Object.isFrozen(el.catalog)).to.be.true;
});

it('a value not present in catalog renders as a synthetic stale row with the not-in-catalog badge', async () => {
  const el = (await fixture(
    html`<lr-voice-picker .catalog=${CATALOG} value="retired-voice"></lr-voice-picker>`
  )) as LyraVoicePicker;
  el.open = true;
  await el.updateComplete;
  const stale = syntheticRow(el);
  expect(stale.querySelector('[part="option-badge"]')!.textContent).to.equal('not in catalog');
});

it('renders a malformed (blank-id) catalog row as an inert trailing option instead of dropping it silently', async () => {
  const el = (await fixture(
    html`<lr-voice-picker
      .catalog=${[...OBJECT_CATALOG, { id: '   ', label: 'Ghost voice' }]}
      value="aria"
    ></lr-voice-picker>`,
  )) as LyraVoicePicker;
  el.open = true;
  await el.updateComplete;
  const optionRows = Array.from(rows(el));
  const malformedRow = optionRows.find((row) => row.getAttribute('data-value') === '');
  expect(malformedRow === undefined).to.be.false;
  expect(malformedRow!.textContent).to.contain('Ghost voice');
  expect(malformedRow!.getAttribute('aria-selected')).to.equal('false');
  expect(malformedRow!.hasAttribute('data-synthetic')).to.be.false;
});

describe('open and synthetic stale-row theme cssprops', () => {
  it('inherits independent open and synthetic stale-row longhands from an ancestor', async () => {
    const wrapper = (await fixture(html`
      <div
        style="
          --lr-voice-picker-open-border-color: rgb(1, 2, 3);
          --lr-voice-picker-option-synthetic-border-style: dotted;
          --lr-voice-picker-option-synthetic-border-color: rgb(4, 5, 6);
          --lr-voice-picker-option-synthetic-font-style: normal;
        "
      >
        <lr-voice-picker value="retired-voice" .catalog=${CATALOG}></lr-voice-picker>
      </div>
    `)) as HTMLDivElement;
    const el = wrapper.querySelector('lr-voice-picker') as LyraVoicePicker;
    el.open = true;
    await el.updateComplete;
    const stale = syntheticRow(el);
    const label = stale.querySelector('[part="option-label"]') as HTMLElement;

    expect(getComputedStyle(trigger(el)).borderTopColor).to.equal('rgb(1, 2, 3)');
    expect(getComputedStyle(stale).borderTopStyle).to.equal('dotted');
    expect(getComputedStyle(stale).borderTopColor).to.equal('rgb(4, 5, 6)');
    expect(getComputedStyle(label).fontStyle).to.equal('normal');
  });

  it('retains the existing shared-token fallback values when no hooks are set', async () => {
    const el = (await fixture(html`
      <lr-voice-picker value="retired-voice" .catalog=${CATALOG}></lr-voice-picker>
    `)) as LyraVoicePicker;
    el.open = true;
    await el.updateComplete;
    const stale = syntheticRow(el);
    const label = stale.querySelector('[part="option-label"]') as HTMLElement;

    expect(getComputedStyle(trigger(el)).borderTopColor).to.equal(
      resolvedColor(el, 'var(--lr-color-brand)'),
    );
    expect(getComputedStyle(stale).borderTopStyle).to.equal('dashed');
    expect(getComputedStyle(stale).borderTopColor).to.equal(
      resolvedColor(el, 'var(--lr-color-border)'),
    );
    expect(getComputedStyle(label).fontStyle).to.equal('italic');
  });

  it('keeps one picker instance’s hooks from changing a sibling instance', async () => {
    const wrapper = (await fixture(html`
      <div>
        <lr-voice-picker
          style="
            --lr-voice-picker-open-border-color: rgb(1, 2, 3);
            --lr-voice-picker-option-synthetic-border-style: dotted;
            --lr-voice-picker-option-synthetic-border-color: rgb(4, 5, 6);
            --lr-voice-picker-option-synthetic-font-style: normal;
          "
          value="retired-voice"
          .catalog=${CATALOG}
        ></lr-voice-picker>
        <lr-voice-picker value="retired-voice" .catalog=${CATALOG}></lr-voice-picker>
      </div>
    `)) as HTMLDivElement;
    const pickers = Array.from(wrapper.querySelectorAll('lr-voice-picker'));
    const themed = pickers[0]!;
    const defaulted = pickers[1]!;
    themed.open = true;
    defaulted.open = true;
    await Promise.all([themed.updateComplete, defaulted.updateComplete]);
    const themedStale = syntheticRow(themed);
    const defaultedStale = syntheticRow(defaulted);
    const themedLabel = themedStale.querySelector('[part="option-label"]') as HTMLElement;
    const defaultedLabel = defaultedStale.querySelector('[part="option-label"]') as HTMLElement;

    expect(getComputedStyle(trigger(themed)).borderTopColor).to.equal('rgb(1, 2, 3)');
    expect(getComputedStyle(themedStale).borderTopStyle).to.equal('dotted');
    expect(getComputedStyle(themedStale).borderTopColor).to.equal('rgb(4, 5, 6)');
    expect(getComputedStyle(themedLabel).fontStyle).to.equal('normal');
    expect(getComputedStyle(trigger(defaulted)).borderTopColor).to.equal(
      resolvedColor(defaulted, 'var(--lr-color-brand)'),
    );
    expect(getComputedStyle(defaultedStale).borderTopStyle).to.equal('dashed');
    expect(getComputedStyle(defaultedStale).borderTopColor).to.equal(
      resolvedColor(defaulted, 'var(--lr-color-border)'),
    );
    expect(getComputedStyle(defaultedLabel).fontStyle).to.equal('italic');
  });
});

describe('row state feedback on the already-selected option', () => {
  const THREE_VOICES = ['alloy', 'verse', 'sage'];
  const centerOf = (node: Element): [number, number] => {
    const rect = node.getBoundingClientRect();
    return [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)];
  };

  /** Polls a pointer-driven condition for up to 500ms, reporting whether it ever held. Pointer
   *  state lands a variable number of frames after the mouse command resolves, per engine. */
  const settle = async (holds: () => boolean): Promise<boolean> => {
    for (let attempt = 0; attempt < 25; attempt++) {
      if (holds()) return true;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return holds();
  };

  const openWithSelectedMiddleRow = async (): Promise<LyraVoicePicker> => {
    const el = (await fixture(html`
      <lr-voice-picker
        value="verse"
        .catalog=${THREE_VOICES}
        style="--lr-transition-fast: 0s; --lr-voice-picker-option-active-bg: rgb(1, 2, 3);"
      ></lr-voice-picker>
    `)) as LyraVoicePicker;
    el.open = true;
    await el.updateComplete;
    // The listbox is placed by the Floating UI positioner a tick after the open render, so a
    // getBoundingClientRect() taken before that points the pointer at the pre-placement box.
    await new Promise((resolve) => setTimeout(resolve, 50));
    return el;
  };

  it('keeps the active-descendant highlight visible after arrowing onto the selected row', async () => {
    const el = await openWithSelectedMiddleRow();
    // Driven through the component's own ArrowDown handling rather than by hand-stamping
    // [data-active], so this covers the rendered aria-activedescendant highlight itself.
    let active: HTMLElement | null = null;
    for (let step = 0; step < 5; step++) {
      trigger(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      await el.updateComplete;
      active = el.shadowRoot!.querySelector<HTMLElement>('[part="option"][data-active]');
      if (active?.getAttribute('aria-selected') === 'true') break;
    }
    expect(active?.getAttribute('aria-selected'), 'arrowing reached the selected row').to.equal('true');
    expect(
      getComputedStyle(active!).backgroundColor,
      'aria-activedescendant highlight on the selected row',
    ).to.equal('rgb(1, 2, 3)');
  });

  /** Hovers and presses one row of a freshly opened listbox, returning both computed backgrounds
   *  (or null when the engine never put the pointer over the row). One fixture per row on purpose:
   *  releasing the button over an option commits that option and closes the listbox. */
  const measureRow = async (
    pick: (rows: HTMLElement[]) => HTMLElement,
  ): Promise<{ hover: string; press: string } | null> => {
    const el = await openWithSelectedMiddleRow();
    const row = pick(Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>('[part="option"]')));
    const resting = getComputedStyle(row).backgroundColor;
    try {
      await sendMouse({ type: 'move', position: centerOf(row) });
      // Earlier pointer tests in this file can leave Firefox with no document hover state at all
      // until a real pointer entry; an unverified reading would report the fixed cascade as broken
      // again, so report 'no pointer' rather than a background.
      if (!(await settle(() => row.matches(':hover')))) return null;
      await settle(() => getComputedStyle(row).backgroundColor !== resting);
      const hover = getComputedStyle(row).backgroundColor;
      await sendMouse({ type: 'down' });
      await settle(() => getComputedStyle(row).backgroundColor !== hover);
      return { hover, press: getComputedStyle(row).backgroundColor };
    } finally {
      await sendMouse({ type: 'up' });
      await resetMouse();
      el.remove();
    }
  };

  it('hovers and presses the selected row exactly like an unselected one', async function () {
    const control = await measureRow((rows) => rows.find((row) => row.getAttribute('aria-selected') !== 'true')!);
    const selected = await measureRow((rows) => rows.find((row) => row.getAttribute('aria-selected') === 'true')!);
    if (control === null || selected === null) {
      this.skip();
    }
    expect(control.hover, 'an unselected row hovers to the row tint').to.equal('rgb(1, 2, 3)');
    expect(selected.hover, 'hovered selected row').to.equal(control.hover);
    // Compared against the unselected row rather than asserted absolutely: an option cancels its own
    // mousedown, and Firefox suppresses :active for a cancelled activation while Chromium keeps it.
    // Equality is the contract either way -- the selected row must not be the only one without
    // pressed feedback.
    expect(selected.press, 'pressed selected row').to.equal(control.press);
  });
});

// -- Selection / lr-change ---------------------------------------------

it('selecting a closed-dropdown option commits value and emits lr-change with inCatalog true', async () => {
  const el = (await fixture(html`<lr-voice-picker .catalog=${CATALOG}></lr-voice-picker>`)) as LyraVoicePicker;
  trigger(el).click();
  await el.updateComplete;
  const changePromise = oneEvent(el, 'lr-change');
  (rows(el)[1] as HTMLElement).click();
  const ev = await changePromise;
  expect(ev.detail).to.deep.equal({ value: 'verse', inCatalog: true });
  expect(el.value).to.equal('verse');
});

it('emits native input/change events after adoption into a document without a window', async () => {
  const el = (await fixture(html`<lr-voice-picker .catalog=${CATALOG}></lr-voice-picker>`)) as LyraVoicePicker;
  const detachedDocument = document.implementation.createHTMLDocument('detached');
  detachedDocument.body.append(detachedDocument.adoptNode(el));
  try {
    expect(el.ownerDocument === detachedDocument).to.equal(true);
    expect(detachedDocument.defaultView).to.equal(null);
    const events: Event[] = [];
    el.addEventListener('input', (event) => events.push(event));
    el.addEventListener('change', (event) => events.push(event));

    const changed = oneEvent(el, 'lr-change');
    rows(el)[0]!.click();
    await changed;

    expect(events.map((event) => event.type)).to.deep.equal(['input', 'change']);
    expect(events.every((event) => event.constructor === Event && event.bubbles && event.composed)).to.be.true;
  } finally {
    el.remove();
  }
});

describe('shared catalog-picker native event relays', () => {
  async function expectFocusContract(
    wrapper: HTMLElement,
    el: LyraVoicePicker,
    control: HTMLElement,
  ): Promise<void> {
    const before = document.createElement('button');
    const after = document.createElement('button');
    wrapper.prepend(before);
    wrapper.append(after);
    const nativeEvents: FocusEvent[] = [];
    const aliases: string[] = [];
    wrapper.addEventListener('focus', (event) => nativeEvents.push(event as FocusEvent));
    wrapper.addEventListener('blur', (event) => nativeEvents.push(event as FocusEvent));
    wrapper.addEventListener('lr-focus', () => aliases.push('lr-focus'));
    wrapper.addEventListener('lr-blur', () => aliases.push('lr-blur'));

    before.focus();
    control.focus();
    after.focus();

    expect(nativeEvents.map((event) => event.type)).to.deep.equal(['focus', 'blur']);
    expect(nativeEvents.every((event) => event instanceof FocusEvent)).to.be.true;
    expect(nativeEvents.every((event) => event.target === el && event.bubbles && event.composed)).to.be.true;
    expect(nativeEvents[0]!.relatedTarget === before).to.be.true;
    expect(nativeEvents[1]!.relatedTarget === after).to.be.true;
    // v9 dropped the v8 lr-focus/lr-blur compatibility aliases -- only the native pair remains.
    expect(aliases).to.deep.equal([]);
  }

  it('relays exactly one native focus/blur pair, and never lr-focus/lr-blur, in both modes', async () => {
    const closedWrapper = await fixture<HTMLElement>(html`
      <div><lr-voice-picker .catalog=${CATALOG}></lr-voice-picker></div>
    `);
    const closed = closedWrapper.querySelector('lr-voice-picker') as LyraVoicePicker;
    await expectFocusContract(closedWrapper, closed, trigger(closed));

    const freeWrapper = await fixture<HTMLElement>(html`<div><lr-voice-picker></lr-voice-picker></div>`);
    const free = freeWrapper.querySelector('lr-voice-picker') as LyraVoicePicker;
    await expectFocusContract(freeWrapper, free, input(free));
  });

  it('preserves the free-text InputEvent payload without a shadow duplicate', async () => {
    const wrapper = await fixture<HTMLElement>(html`<div><lr-voice-picker></lr-voice-picker></div>`);
    const el = wrapper.querySelector('lr-voice-picker') as LyraVoicePicker;
    const control = input(el);
    const events: InputEvent[] = [];
    wrapper.addEventListener('input', (event) => events.push(event as InputEvent));

    control.value = 'a';
    control.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        composed: true,
        data: 'a',
        inputType: 'insertText',
        isComposing: true,
      }),
    );

    expect(events).to.have.lengthOf(1);
    expect(events[0] instanceof InputEvent).to.be.true;
    expect(events[0]!.target === el && events[0]!.bubbles && events[0]!.composed).to.be.true;
    expect(events[0]!.data).to.equal('a');
    expect(events[0]!.inputType).to.equal('insertText');
    expect(events[0]!.isComposing).to.be.true;
  });
});

it('free-text filtering also matches language and description', async () => {
  const el = (await fixture(
    html`<lr-voice-picker allow-custom .catalog=${OBJECT_CATALOG}></lr-voice-picker>`
  )) as LyraVoicePicker;
  const el2 = input(el);
  el2.focus();
  el2.value = 'narrative';
  el2.dispatchEvent(new Event('input', { bubbles: true }));
  await el.updateComplete;
  expect(rows(el).length).to.equal(1);
  expect(rows(el)[0]!.dataset['value']).to.equal('aria');
});

// -- Preview -----------------------------------------------------------

it('the standalone preview-button previews the committed value and is disabled with no candidate', async () => {
  const el = (await fixture(html`<lr-voice-picker .catalog=${CATALOG}></lr-voice-picker>`)) as LyraVoicePicker;
  expect(previewButton(el).disabled).to.be.true; // no value yet

  el.value = 'alloy';
  await el.updateComplete;
  expect(previewButton(el).disabled).to.be.false;
  expect(previewButton(el).getAttribute('aria-label')).to.equal('Preview alloy');
});

it('gives the standalone preview-button the shared minimum tappable size', async () => {
  const el = (await fixture(
    html`<lr-voice-picker .catalog=${CATALOG} value="alloy"></lr-voice-picker>`
  )) as LyraVoicePicker;
  await el.updateComplete;
  const btn = previewButton(el);
  expect(getComputedStyle(btn).minInlineSize).to.equal('40px');
  expect(getComputedStyle(btn).minBlockSize).to.equal('40px');
});

describe('size', () => {
  it('defaults to the shared medium tier and reflects plain-HTML size assignments', async () => {
    const defaultPicker = (await fixture(
      html`<lr-voice-picker .catalog=${CATALOG}></lr-voice-picker>`
    )) as LyraVoicePicker;
    expect(defaultPicker.size).to.equal('m');

    const smallPicker = (await fixture(
      html`<lr-voice-picker size="s" .catalog=${CATALOG}></lr-voice-picker>`
    )) as LyraVoicePicker;
    expect(smallPicker.size).to.equal('s');
    expect(smallPicker.getAttribute('size')).to.equal('s');
  });

  it('renders both picker modes on the shared six-tier control-height ladder', async () => {
    const expected: Record<string, string> = {
      '2xs': '20px',
      xs: '24px',
      s: '30px',
      m: '40px',
      l: '48px',
      xl: '56px',
    };

    for (const [size, height] of Object.entries(expected)) {
      const closed = (await fixture(
        html`<lr-voice-picker size=${size} .catalog=${CATALOG}></lr-voice-picker>`
      )) as LyraVoicePicker;
      const freeText = (await fixture(
        html`<lr-voice-picker size=${size}></lr-voice-picker>`
      )) as LyraVoicePicker;
      const combobox = freeText.shadowRoot!.querySelector('[part="combobox"]') as HTMLElement;
      expect(getComputedStyle(trigger(closed)).minBlockSize, `closed size=${size}`).to.equal(height);
      expect(getComputedStyle(combobox).minBlockSize, `free-text size=${size}`).to.equal(height);
    }
  });

  it('accepts small/medium/large as rendered aliases of s/m/l', async () => {
    const heightAt = async (size: string): Promise<string> => {
      const el = (await fixture(
        html`<lr-voice-picker size=${size} .catalog=${CATALOG}></lr-voice-picker>`
      )) as LyraVoicePicker;
      return getComputedStyle(trigger(el)).minBlockSize;
    };

    expect(await heightAt('small')).to.equal(await heightAt('s'));
    expect(await heightAt('medium')).to.equal(await heightAt('m'));
    expect(await heightAt('large')).to.equal(await heightAt('l'));
    expect(await heightAt('small')).to.not.equal(await heightAt('m'));
  });

  it('keeps compact preview actions at the hit-area floor and grows them with large tiers', async () => {
    const compact = (await fixture(
      html`<lr-voice-picker size="2xs" value="alloy" .catalog=${CATALOG}></lr-voice-picker>`
    )) as LyraVoicePicker;
    const extraLarge = (await fixture(
      html`<lr-voice-picker size="xl" value="alloy" .catalog=${CATALOG}></lr-voice-picker>`
    )) as LyraVoicePicker;

    expect(getComputedStyle(previewButton(compact)).blockSize).to.equal('40px');
    expect(getComputedStyle(previewButton(extraLarge)).blockSize).to.equal('56px');
  });
});

it('inherits component-scoped gap and radius hooks across both modes and the compact/large tiers', async () => {
  const wrapper = (await fixture(html`
    <div style="--lr-voice-picker-gap:13px;--lr-voice-picker-radius:17px">
      <lr-voice-picker
        size="2xs"
        value="aria"
        .catalog=${OBJECT_CATALOG}
      ></lr-voice-picker>
      <lr-voice-picker
        size="xl"
        value="aria"
        allow-custom
        .catalog=${OBJECT_CATALOG}
      ></lr-voice-picker>
    </div>
  `)) as HTMLDivElement;
  const pickers = Array.from(wrapper.querySelectorAll('lr-voice-picker')) as LyraVoicePicker[];
  const closed = pickers[0]!;
  const freeText = pickers[1]!;
  closed.open = true;
  freeText.open = true;
  await Promise.all([closed.updateComplete, freeText.updateComplete]);

  for (const picker of [closed, freeText]) {
    const control = picker.shadowRoot!.querySelector(
      picker === closed ? '[part="trigger"]' : '[part="combobox"]',
    ) as HTMLElement;
    const controlRow = picker.shadowRoot!.querySelector('.control-row') as HTMLElement;
    const option = rows(picker)[0]!;
    const optionPreview = option.querySelector('[part="option-preview"]') as HTMLElement;

    expect(getComputedStyle(controlRow).gap).to.equal('13px');
    expect(getComputedStyle(control).gap).to.equal('13px');
    expect(getComputedStyle(option).gap).to.equal('13px');
    for (const rounded of [control, previewButton(picker), listbox(picker), option, optionPreview]) {
      expect(getComputedStyle(rounded).borderTopLeftRadius).to.equal('17px');
    }
  }
});

it('clicking preview fires cancelable lr-preview-request with the resolved previewUrl', async () => {
  const el = (await fixture(
    html`<lr-voice-picker .catalog=${OBJECT_CATALOG} value="aria"></lr-voice-picker>`
  )) as LyraVoicePicker;
  const reqPromise = oneEvent(el, 'lr-preview-request');
  previewButton(el).click();
  const ev = await reqPromise;
  expect(ev.detail).to.deep.equal({
    voiceId: 'aria',
    previewUrl: 'https://example.test/aria.mp3',
  });
  expect(ev.cancelable).to.be.true;
});

it('an unprevented request with a previewUrl plays through an internal <audio>, firing lr-preview-change, and the same voice toggles it off', async () => {
  const restore = stubMediaPlay(() => Promise.resolve());
  try {
    const el = (await fixture(
      html`<lr-voice-picker .catalog=${OBJECT_CATALOG} value="aria"></lr-voice-picker>`
    )) as LyraVoicePicker;
    const changePromise = oneEvent(el, 'lr-preview-change');
    previewButton(el).click();
    const ev = await changePromise;
    expect(ev.detail).to.deep.equal({ voiceId: 'aria' });
    expect(previewButton(el).getAttribute('aria-pressed')).to.equal('true');

    const stopPromise = oneEvent(el, 'lr-preview-change');
    previewButton(el).click(); // same voice -- toggles off, no new lr-preview-request
    const stopEv = await stopPromise;
    expect(stopEv.detail).to.deep.equal({ voiceId: null });
    expect(previewButton(el).getAttribute('aria-pressed')).to.equal('false');
  } finally {
    restore();
  }
});

it('publishes internal preview start only after the current play() promise fulfills', async () => {
  let resolvePlay!: () => void;
  const restore = stubMediaPlay(
    () =>
      new Promise<void>((resolve) => {
        resolvePlay = resolve;
      }),
  );
  try {
    const el = (await fixture(
      html`<lr-voice-picker .catalog=${OBJECT_CATALOG} value="aria"></lr-voice-picker>`,
    )) as LyraVoicePicker;
    const changes: Array<string | null> = [];
    el.addEventListener('lr-preview-change', (event) => changes.push(event.detail.voiceId));

    previewButton(el).click();
    await Promise.resolve();
    await el.updateComplete;
    expect(changes).to.deep.equal([]);
    expect(previewButton(el).getAttribute('aria-pressed')).to.equal('false');

    const started = oneEvent(el, 'lr-preview-change');
    resolvePlay();
    expect((await started).detail).to.deep.equal({ voiceId: 'aria' });
    await el.updateComplete;
    expect(changes).to.deep.equal(['aria']);
    expect(previewButton(el).getAttribute('aria-pressed')).to.equal('true');
  } finally {
    restore();
  }
});

it('keeps a rejected pending play silent and never exposes a false playing state', async () => {
  const restore = stubMediaPlay(() => Promise.reject(new Error('play blocked')));
  try {
    const el = (await fixture(
      html`<lr-voice-picker .catalog=${OBJECT_CATALOG} value="aria"></lr-voice-picker>`,
    )) as LyraVoicePicker;
    const changes: Array<string | null> = [];
    el.addEventListener('lr-preview-change', (event) => changes.push(event.detail.voiceId));

    previewButton(el).click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await el.updateComplete;

    expect(changes).to.deep.equal([]);
    expect(previewButton(el).getAttribute('aria-pressed')).to.equal('false');
    expect((el as unknown as { audioEl?: HTMLAudioElement }).audioEl === undefined).to.be.true;
  } finally {
    restore();
  }
});

it('contains a synchronous media play failure without publishing a preview state', async () => {
  const restore = stubMediaPlay(() => {
    throw new Error('play threw synchronously');
  });
  try {
    const el = (await fixture(
      html`<lr-voice-picker .catalog=${OBJECT_CATALOG} value="aria"></lr-voice-picker>`,
    )) as LyraVoicePicker;
    const changes: Array<string | null> = [];
    el.addEventListener('lr-preview-change', (event) => changes.push(event.detail.voiceId));

    expect(() => previewButton(el).click()).to.not.throw();
    await el.updateComplete;
    expect(changes).to.deep.equal([]);
    expect((el as unknown as { audioEl?: HTMLAudioElement }).audioEl === undefined).to.be.true;
    expect(previewButton(el).getAttribute('aria-pressed')).to.equal('false');
  } finally {
    restore();
  }
});

it('publishes a start immediately followed by a stop when a genuine audio error arrives before play() settles', async () => {
  let resolvePlay: (() => void) | undefined;
  const restore = stubMediaPlay(
    () =>
      new Promise<void>((resolve) => {
        resolvePlay = resolve;
      }),
  );
  try {
    const el = (await fixture(
      html`<lr-voice-picker .catalog=${OBJECT_CATALOG} value="aria"></lr-voice-picker>`,
    )) as LyraVoicePicker;
    const sequence: Array<string | null> = [];
    el.addEventListener('lr-preview-change', (event) => sequence.push(event.detail.voiceId));

    previewButton(el).click();
    await el.updateComplete;
    const audio = (el as unknown as { audioEl?: HTMLAudioElement }).audioEl;
    expect(audio === undefined).to.be.false;
    audio!.dispatchEvent(new Event('error'));

    expect(sequence).to.deep.equal(['aria', null]);
    expect(previewButton(el).getAttribute('aria-pressed')).to.equal('false');
    expect((el as unknown as { audioEl?: HTMLAudioElement }).audioEl === undefined).to.be.true;
  } finally {
    resolvePlay?.();
    restore();
  }
});

it('retires the playing voice before dispatching a prevented request for another candidate', async () => {
  const restore = stubMediaPlay(() => Promise.resolve());
  try {
    const el = (await fixture(
      html`<lr-voice-picker .catalog=${PREVIEW_CATALOG} value="aria"></lr-voice-picker>`,
    )) as LyraVoicePicker;
    const started = oneEvent(el, 'lr-preview-change');
    previewButton(el).click();
    await started;

    el.open = true;
    await el.updateComplete;
    const sequence: string[] = [];
    el.addEventListener('lr-preview-change', (event) => sequence.push(`preview:${event.detail.voiceId}`));
    el.addEventListener('lr-preview-request', (event) => {
      if (event.detail.voiceId === 'nova') {
        sequence.push('request:nova');
        event.preventDefault();
      }
    });

    const novaPreview = rows(el)[2]!.querySelector('[part="option-preview"]') as HTMLElement;
    novaPreview.click();
    await el.updateComplete;

    expect(sequence).to.deep.equal(['preview:null', 'request:nova']);
    expect((el as unknown as { audioEl?: HTMLAudioElement }).audioEl === undefined).to.be.true;
    expect(previewButton(el).getAttribute('aria-pressed')).to.equal('false');
  } finally {
    restore();
  }
});

it('retires the playing voice before committing a no-preview candidate', async () => {
  const restore = stubMediaPlay(() => Promise.resolve());
  try {
    const el = (await fixture(
      html`<lr-voice-picker .catalog=${PREVIEW_CATALOG} value="aria"></lr-voice-picker>`,
    )) as LyraVoicePicker;
    const started = oneEvent(el, 'lr-preview-change');
    previewButton(el).click();
    await started;

    el.open = true;
    await el.updateComplete;
    const sequence: string[] = [];
    el.addEventListener('lr-preview-change', (event) => sequence.push(`preview:${event.detail.voiceId}`));
    el.addEventListener('lr-change', (event) => sequence.push(`value:${event.detail.value}`));
    rows(el)[1]!.click();
    await el.updateComplete;

    expect(sequence).to.deep.equal(['preview:null', 'value:sage']);
    expect(el.value).to.equal('sage');
    expect((el as unknown as { audioEl?: HTMLAudioElement }).audioEl === undefined).to.be.true;

    const requested = oneEvent(el, 'lr-preview-request');
    previewButton(el).click();
    expect((await requested).detail).to.deep.equal({ voiceId: 'sage', previewUrl: undefined });
    expect((el as unknown as { audioEl?: HTMLAudioElement }).audioEl === undefined).to.be.true;
  } finally {
    restore();
  }
});

it('retires the playing voice before catalog replacement changes the rendered candidate', async () => {
  const restore = stubMediaPlay(() => Promise.resolve());
  try {
    const el = (await fixture(
      html`<lr-voice-picker .catalog=${PREVIEW_CATALOG} value="aria"></lr-voice-picker>`,
    )) as LyraVoicePicker;
    const started = oneEvent(el, 'lr-preview-change');
    previewButton(el).click();
    await started;
    const changes: Array<string | null> = [];
    el.addEventListener('lr-preview-change', (event) => changes.push(event.detail.voiceId));

    el.catalog = [OBJECT_CATALOG[1]!];
    await el.updateComplete;

    expect(changes).to.deep.equal([null]);
    expect((el as unknown as { audioEl?: HTMLAudioElement }).audioEl === undefined).to.be.true;
    expect(previewButton(el).getAttribute('aria-pressed')).to.equal('false');
  } finally {
    restore();
  }
});

it('retires a different row preview when the committed value is reassigned unchanged', async () => {
  const restore = stubMediaPlay(() => Promise.resolve());
  try {
    const el = (await fixture(
      html`<lr-voice-picker .catalog=${PREVIEW_CATALOG} value="sage"></lr-voice-picker>`,
    )) as LyraVoicePicker;
    el.open = true;
    await el.updateComplete;
    const changes: Array<string | null> = [];
    el.addEventListener('lr-preview-change', (event) => changes.push(event.detail.voiceId));

    const ariaPreview = rows(el)[0]!.querySelector('[part="option-preview"]') as HTMLElement;
    ariaPreview.click();
    await waitUntil(() => changes.length === 1, 'the row preview never started');

    el.value = 'sage';
    await el.updateComplete;

    expect(changes).to.deep.equal(['aria', null]);
    expect((el as unknown as { audioEl?: HTMLAudioElement }).audioEl === undefined).to.be.true;
  } finally {
    restore();
  }
});

it('retires a row preview when closing hides it while no option is keyboard-active', async () => {
  const restore = stubMediaPlay(() => Promise.resolve());
  try {
    const el = (await fixture(
      html`<lr-voice-picker .catalog=${PREVIEW_CATALOG} value="sage"></lr-voice-picker>`,
    )) as LyraVoicePicker;
    el.open = true;
    await el.updateComplete;
    const changes: Array<string | null> = [];
    el.addEventListener('lr-preview-change', (event) => changes.push(event.detail.voiceId));

    const ariaPreview = rows(el)[0]!.querySelector('[part="option-preview"]') as HTMLElement;
    ariaPreview.click();
    await waitUntil(() => changes.length === 1, 'the row preview never started');
    trigger(el).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    await el.updateComplete;

    expect(changes).to.deep.equal(['aria', null]);
    expect(el.open).to.be.false;
    expect((el as unknown as { audioEl?: HTMLAudioElement }).audioEl === undefined).to.be.true;
  } finally {
    restore();
  }
});

it('retires a row preview when free-text filtering removes it with no active descendant', async () => {
  const restore = stubMediaPlay(() => Promise.resolve());
  try {
    const el = (await fixture(
      html`<lr-voice-picker
        allow-custom
        .catalog=${PREVIEW_CATALOG}
        value="sage"
      ></lr-voice-picker>`,
    )) as LyraVoicePicker;
    const editor = input(el);
    editor.focus();
    editor.value = '';
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    const changes: Array<string | null> = [];
    el.addEventListener('lr-preview-change', (event) => changes.push(event.detail.voiceId));

    const ariaRow = Array.from(rows(el)).find((row) => row.dataset['value'] === 'aria')!;
    (ariaRow.querySelector('[part="option-preview"]') as HTMLElement).click();
    await waitUntil(() => changes.length === 1, 'the filtered row preview never started');
    editor.value = 'nova';
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;

    expect(Array.from(rows(el), (row) => row.dataset['value'])).to.deep.equal(['nova']);
    expect(changes).to.deep.equal(['aria', null]);
    expect((el as unknown as { audioEl?: HTMLAudioElement }).audioEl === undefined).to.be.true;
  } finally {
    restore();
  }
});

it('retires a row preview when a live mode switch restores a filter that hides it', async () => {
  const restore = stubMediaPlay(() => Promise.resolve());
  try {
    const el = (await fixture(
      html`<lr-voice-picker
        allow-custom
        .catalog=${PREVIEW_CATALOG}
        value="sage"
      ></lr-voice-picker>`,
    )) as LyraVoicePicker;
    const editor = input(el);
    editor.focus();
    editor.value = 'nova';
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    expect(Array.from(rows(el), (row) => row.dataset['value'])).to.deep.equal(['nova']);

    el.allowCustom = false;
    await el.updateComplete;
    await el.updateComplete;
    expect(Array.from(rows(el), (row) => row.dataset['value'])).to.deep.equal([
      'aria',
      'sage',
      'nova',
    ]);
    const changes: Array<string | null> = [];
    el.addEventListener('lr-preview-change', (event) => changes.push(event.detail.voiceId));
    const ariaPreview = rows(el)[0]!.querySelector('[part="option-preview"]') as HTMLElement;
    ariaPreview.click();
    await waitUntil(() => changes.length === 1, 'the closed-mode row preview never started');

    el.allowCustom = true;
    await el.updateComplete;
    await el.updateComplete;

    expect(Array.from(rows(el), (row) => row.dataset['value'])).to.deep.equal(['nova']);
    expect(changes).to.deep.equal(['aria', null]);
    expect((el as unknown as { audioEl?: HTMLAudioElement }).audioEl === undefined).to.be.true;
  } finally {
    restore();
  }
});

it('preventDefault()ing lr-preview-request suppresses internal playback entirely', async () => {
  const el = (await fixture(
    html`<lr-voice-picker .catalog=${OBJECT_CATALOG} value="aria"></lr-voice-picker>`
  )) as LyraVoicePicker;
  el.addEventListener('lr-preview-request', (e) => e.preventDefault());
  let changed = false;
  el.addEventListener('lr-preview-change', () => (changed = true));
  previewButton(el).click();
  await el.updateComplete;
  expect(changed).to.be.false;
  expect(previewButton(el).getAttribute('aria-pressed')).to.equal('false');
});

it('a voice with no previewUrl still fires the request event but never plays internally', async () => {
  const el = (await fixture(
    html`<lr-voice-picker .catalog=${OBJECT_CATALOG} value="sage"></lr-voice-picker>`
  )) as LyraVoicePicker;
  const reqPromise = oneEvent(el, 'lr-preview-request');
  previewButton(el).click();
  const ev = await reqPromise;
  expect(ev.detail).to.deep.equal({ voiceId: 'sage', previewUrl: undefined });
  await el.updateComplete;
  expect(previewButton(el).getAttribute('aria-pressed')).to.equal('false');
});

it('preview=false renders no preview affordances at all', async () => {
  const el = (await fixture(
    html`<lr-voice-picker .catalog=${OBJECT_CATALOG} value="aria"></lr-voice-picker>`
  )) as LyraVoicePicker;
  el.preview = false;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="preview-button"]').length).to.equal(0);
  el.open = true;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="option-preview"]').length).to.equal(0);
});

it('accepts preview="false" as a plain-HTML attribute string, not just a property binding', async () => {
  const el = (await fixture(
    html`<lr-voice-picker preview="false" .catalog=${OBJECT_CATALOG} value="aria"></lr-voice-picker>`
  )) as LyraVoicePicker;
  expect(el.preview).to.be.false;
  expect(el.shadowRoot!.querySelectorAll('[part="preview-button"]').length).to.equal(0);
});

it('per-row option-preview icons are pointer-only (tabindex=-1, aria-hidden) and preview that specific row', async () => {
  const el = (await fixture(html`<lr-voice-picker .catalog=${OBJECT_CATALOG}></lr-voice-picker>`)) as LyraVoicePicker;
  el.open = true;
  await el.updateComplete;
  const icon = rows(el)[0]!.querySelector('[part="option-preview"]') as HTMLElement;
  expect(icon.getAttribute('tabindex')).to.equal('-1');
  expect(icon.getAttribute('aria-hidden')).to.equal('true');

  const reqPromise = oneEvent(el, 'lr-preview-request');
  icon.click();
  const ev = await reqPromise;
  expect(ev.detail.voiceId).to.equal('aria');
});

it('keeps a closed picker open and pristine when real Tab moves from its trigger to the preview action', async () => {
  const wrapper = (await fixture(html`
    <div>
      <lr-voice-picker required .catalog=${PREVIEW_CATALOG}></lr-voice-picker>
      <button id="after-closed" type="button">After</button>
    </div>
  `)) as HTMLDivElement;
  const el = wrapper.querySelector('lr-voice-picker') as LyraVoicePicker;
  const after = wrapper.querySelector('#after-closed') as HTMLButtonElement;
  let boundaryBlurs = 0;
  el.addEventListener('blur', (event) => {
    if (event instanceof FocusEvent) boundaryBlurs++;
  });

  trigger(el).focus();
  trigger(el).click();
  await el.updateComplete;
  await sendKeys({ press: 'ArrowDown' });
  await el.updateComplete;
  const activeDescendant = trigger(el).getAttribute('aria-activedescendant');
  expect(activeDescendant).to.not.equal('');

  await sendKeys({ press: 'Tab' });
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement === previewButton(el)).to.be.true;
  expect(previewButton(el).disabled).to.be.false;
  expect(previewButton(el).getAttribute('aria-label')).to.equal('Preview Aria');
  expect(el.open).to.be.true;
  expect(trigger(el).getAttribute('aria-activedescendant')).to.equal(activeDescendant);
  expect((el as unknown as { touched: boolean }).touched).to.be.false;
  expect(boundaryBlurs).to.equal(0);

  const requested = oneEvent(el, 'lr-preview-request');
  el.addEventListener('lr-preview-request', (event) => event.preventDefault(), { once: true });
  previewButton(el).click();
  expect((await requested).detail.voiceId).to.equal('aria');

  await sendKeys({ press: 'Tab' });
  await el.updateComplete;
  expect(document.activeElement === after).to.be.true;
  expect(el.open).to.be.false;
  expect((el as unknown as { touched: boolean }).touched).to.be.true;
  expect(boundaryBlurs).to.equal(1);
});

it('keeps a free-text picker open and pristine when real Tab moves from its input to the preview action', async () => {
  const wrapper = (await fixture(html`
    <div>
      <lr-voice-picker
        required
        allow-custom
        value="aria"
        .catalog=${PREVIEW_CATALOG}
      ></lr-voice-picker>
      <button id="after-free-text" type="button">After</button>
    </div>
  `)) as HTMLDivElement;
  const el = wrapper.querySelector('lr-voice-picker') as LyraVoicePicker;
  const after = wrapper.querySelector('#after-free-text') as HTMLButtonElement;
  let boundaryBlurs = 0;
  el.addEventListener('blur', (event) => {
    if (event instanceof FocusEvent) boundaryBlurs++;
  });

  input(el).focus();
  await el.updateComplete;
  await sendKeys({ press: 'ArrowDown' });
  await el.updateComplete;
  const activeDescendant = input(el).getAttribute('aria-activedescendant');
  expect(activeDescendant).to.not.equal('');

  await sendKeys({ press: 'Tab' });
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement === previewButton(el)).to.be.true;
  expect(el.open).to.be.true;
  expect(input(el).getAttribute('aria-activedescendant')).to.equal(activeDescendant);
  expect((el as unknown as { touched: boolean }).touched).to.be.false;
  expect(boundaryBlurs).to.equal(0);

  await sendKeys({ press: 'Tab' });
  await el.updateComplete;
  expect(document.activeElement === after).to.be.true;
  expect(el.open).to.be.false;
  expect((el as unknown as { touched: boolean }).touched).to.be.true;
  expect(boundaryBlurs).to.equal(1);
});

// -- Form association (mirrors lr-model-select) ----------------------------

it('is form-associated: participates in FormData and required validity', async () => {
  const form = (await fixture(html`
    <form>
      <lr-voice-picker name="voice" required .catalog=${CATALOG}></lr-voice-picker>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-voice-picker') as LyraVoicePicker;
  expect(el.checkValidity()).to.be.false;
  el.value = 'alloy';
  expect(el.checkValidity()).to.be.true;
  expect(new FormData(form).get('voice')).to.equal('alloy');
});

// -- Empty / no-match copy -----------------------------------------------

it('shows the localized no-voices message for an empty catalog, and the shared no-matches message for a free-text miss', async () => {
  const el = (await fixture(html`<lr-voice-picker .catalog=${[]}></lr-voice-picker>`)) as LyraVoicePicker;
  await el.updateComplete;
  expect(input(el) != null).to.equal(true); // empty catalog falls back to free text, same as model-select

  const withCatalog = (await fixture(
    html`<lr-voice-picker allow-custom .catalog=${CATALOG}></lr-voice-picker>`
  )) as LyraVoicePicker;
  const el2 = input(withCatalog);
  el2.focus();
  el2.value = 'zzz-no-match';
  el2.dispatchEvent(new Event('input', { bubbles: true }));
  await withCatalog.updateComplete;
  expect(withCatalog.shadowRoot!.querySelector('[part="empty"]')!.textContent).to.equal('No matches');
});

// -- Accessibility -------------------------------------------------------

it('renders initial slotted label content in the standard form-control frame', async () => {
  const el = (await fixture(html`
    <lr-voice-picker .catalog=${CATALOG}>
      <span slot="label">Spoken voice</span>
    </lr-voice-picker>
  `)) as LyraVoicePicker;
  const frame = el.shadowRoot!.querySelector<HTMLElement>('[part="form-control"]');
  const label = el.shadowRoot!.querySelector<HTMLLabelElement>('[part="form-control-label"]')!;
  const labelSlot = label.querySelector<HTMLSlotElement>('slot[name="label"]')!;

  expect(frame?.getAttribute('part')).to.equal('form-control');
  expect(label.hidden).to.be.false;
  expect(labelSlot.assignedElements().length).to.equal(1);
  expect(labelSlot.assignedElements()[0]?.textContent?.trim()).to.equal('Spoken voice');
  expect(label.htmlFor).to.equal(trigger(el).id);
  expect(trigger(el).hasAttribute('aria-label')).to.be.false;
});

it('updates free-text label and accessible-name fallback when slotted label content is added and removed', async () => {
  const el = (await fixture(html`
    <lr-voice-picker allow-custom placeholder="Choose a voice"></lr-voice-picker>
  `)) as LyraVoicePicker;
  const label = el.shadowRoot!.querySelector<HTMLLabelElement>('[part="form-control-label"]')!;
  const labelSlot = label.querySelector<HTMLSlotElement>('slot[name="label"]')!;
  expect(label.hidden).to.be.true;
  expect(input(el).getAttribute('aria-label')).to.equal('Choose a voice');

  const added = oneEvent(labelSlot, 'slotchange');
  const slotted = document.createElement('span');
  slotted.slot = 'label';
  slotted.textContent = 'Narration voice';
  el.append(slotted);
  await added;
  await el.updateComplete;

  expect(label.hidden).to.be.false;
  expect(label.htmlFor).to.equal(input(el).id);
  expect(input(el).hasAttribute('aria-label')).to.be.false;

  const removed = oneEvent(labelSlot, 'slotchange');
  slotted.remove();
  await removed;
  await el.updateComplete;

  expect(label.hidden).to.be.true;
  expect(input(el).getAttribute('aria-label')).to.equal('Choose a voice');
});

it('keeps an explicit host aria-label ahead of slotted label content', async () => {
  const el = (await fixture(html`
    <lr-voice-picker aria-label="Output voice" .catalog=${CATALOG}>
      <span slot="label">Voice</span>
    </lr-voice-picker>
  `)) as LyraVoicePicker;

  expect(trigger(el).getAttribute('aria-label')).to.equal('Output voice');
});

it('is accessible in closed-dropdown mode with a selected value', async () => {
  const el = (await fixture(
    html`<lr-voice-picker .catalog=${OBJECT_CATALOG} value="aria" label="Voice"></lr-voice-picker>`
  )) as LyraVoicePicker;
  await expect(el).to.be.accessible();
});

it('is accessible in free-text mode', async () => {
  const el = (await fixture(html`<lr-voice-picker allow-custom label="Voice"></lr-voice-picker>`)) as LyraVoicePicker;
  await expect(el).to.be.accessible();
});

// -- Localization --------------------------------------------------------

it('localizes the fallback accessible name and preview labels via this.localize()', async () => {
  const el = (await fixture(html`
    <lr-voice-picker
      .catalog=${CATALOG}
      value="alloy"
      .strings=${{ voice: 'Voix', voicePickerPreview: 'Écouter {name}' }}
    ></lr-voice-picker>
  `)) as LyraVoicePicker;
  expect(trigger(el).getAttribute('aria-label')).to.equal('Voix');
  expect(previewButton(el).getAttribute('aria-label')).to.equal('Écouter alloy');
});

// -- Available-space clamping (internal/positioner.js's place()) ------------

it("declares [part='listbox']'s max-block-size/max-inline-size/min-inline-size against place()'s published --lr-positioner-available-* custom properties, mirroring lr-menu's/lr-combobox's identical clamp", () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  const listboxBlock = /\[part=['"]?listbox['"]?\]\s*\{([^}]+)\}/.exec(css);
  expect(listboxBlock, 'expected a [part="listbox"] rule').to.not.equal(null);
  const body = listboxBlock![1];
  expect(body).to.match(/max-block-size:\s*min\([^;]*var\(--lr-positioner-available-block-size/);
  expect(body).to.match(/max-inline-size:\s*min\([^;]*var\(--lr-positioner-available-inline-size/);
  expect(body).to.match(/min-inline-size:\s*min\([^;]*var\(--lr-positioner-available-inline-size/);
});

it("actually applies place()'s available-space custom properties onto the rendered listbox once open, not just declaring them in CSS", async () => {
  const el = (await fixture(html`<lr-voice-picker .catalog=${CATALOG}></lr-voice-picker>`)) as LyraVoicePicker;
  trigger(el).click();
  await el.updateComplete;
  await waitFor(
    () => listbox(el).style.getPropertyValue('--lr-positioner-available-block-size'),
    (v) => v !== ''
  );
  expect(listbox(el).style.getPropertyValue('--lr-positioner-available-inline-size')).to.not.equal('');
});

// -- Attribute converters -------------------------------------------------

it('the spellcheck attribute converter parses the literal string "false" as false, matching the native attribute', async () => {
  const el = (await fixture(
    html`<lr-voice-picker spellcheck="false" .catalog=${CATALOG}></lr-voice-picker>`
  )) as LyraVoicePicker;
  expect(el.spellcheck).to.be.false;
});
// toAttribute() (the converse direction) is unreachable here: Lit only invokes a property's
// converter.toAttribute() when that property declares `reflect: true` (see
// @lit/reactive-element's reactive-element.js, `_$changeProperty`/`__propertyToAttribute`), and
// `spellcheck` doesn't -- identical to `<lr-model-select>`'s and `<lr-textarea>`'s own
// `spellcheckConverter`, whose test suites likewise never exercise it. Not a bug to fix here.

// -- ElementInternals passthrough -----------------------------------------

it('exposes form/labels/validity/validationMessage/willValidate by delegating to the internal ElementInternals', async () => {
  const form = (await fixture(html`
    <form>
      <lr-voice-picker name="voice" required .catalog=${CATALOG}></lr-voice-picker>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-voice-picker') as LyraVoicePicker;
  expect(el.form === form).to.equal(true);
  // Assert labels.length (a number), never the NodeList itself: a *failing* chai assertion whose
  // `actual` is a DOM node/NodeList hangs the whole wtr session (wtr ships `err.actual` verbatim in
  // its session-finished message, which is serialized with structuredClone() -- DataCloneError on
  // any DOM value, so no result is ever reported and the run dies at testsFinishTimeout).
  expect(el.labels.length).to.equal(0); // no associated <label for> in this fixture
  expect(el.validity.valueMissing).to.be.true;
  expect(el.validationMessage.length).to.be.greaterThan(0);
  expect(el.willValidate).to.be.true;
});

// -- ElementInternals availability guard -----------------------------------
//
// `attachInternals()` itself is guarded by `typeof this.attachInternals === 'function'`
// so construction doesn't throw in a DOM implementation that exposes form-associated
// custom elements but not `attachInternals()` (e.g. a downstream Vitest + happy-dom
// suite). wtr+Chromium always implements `attachInternals`, so deleting it from the
// prototype simulates the *shape* of an unsupporting environment but cannot prove
// which branch of the guard actually ran -- both the real and the fallback internals
// report the same `form`/`checkValidity()` values for an unattached element. This test
// documents the contract (construction never throws, the public surface stays usable)
// rather than proving the guard fires.
it('does not throw when constructed in an environment without attachInternals, and keeps checkValidity()/form usable', () => {
  const original = HTMLElement.prototype.attachInternals;
  // @ts-expect-error -- simulating an environment that lacks ElementInternals entirely
  delete HTMLElement.prototype.attachInternals;
  try {
    let el: LyraVoicePicker | undefined;
    expect(() => {
      el = document.createElement('lr-voice-picker') as LyraVoicePicker;
    }).to.not.throw();
    expect(el!.checkValidity()).to.be.true;
    expect(el!.form === null).to.equal(true);
  } finally {
    HTMLElement.prototype.attachInternals = original;
  }
});

// -- value/name property edge cases ----------------------------------------

it('the value setter falls back to an empty string for a nullish assignment', async () => {
  const el = (await fixture(html`<lr-voice-picker .catalog=${CATALOG}></lr-voice-picker>`)) as LyraVoicePicker;
  (el as unknown as { value: string | null }).value = null;
  expect(el.value).to.equal('');
});

it('the name setter falls back to empty string for a nullish assignment and clears the attribute when set back to empty', async () => {
  const el = (await fixture(
    html`<lr-voice-picker name="voice" .catalog=${CATALOG}></lr-voice-picker>`
  )) as LyraVoicePicker;
  expect(el.getAttribute('name')).to.equal('voice'); // if(this._name) setAttribute branch, from markup
  el.name = '';
  expect(el.hasAttribute('name')).to.be.false; // else removeAttribute branch
  expect(el.name).to.equal('');
  (el as unknown as { name: string | null }).name = null;
  expect(el.name).to.equal('');
  expect(el.hasAttribute('name')).to.be.false;
});

it('normalizes a nullish defaultValue write and clears the reflected default for a clean control', async () => {
  const el = (await fixture(
    html`<lr-voice-picker value="alloy" .catalog=${CATALOG}></lr-voice-picker>`
  )) as LyraVoicePicker;
  await el.updateComplete;

  (el as unknown as { defaultValue: string | null }).defaultValue = null;
  await el.updateComplete;

  expect(el.defaultValue).to.equal('');
  expect(el.value).to.equal('');
  expect(el.hasAttribute('value')).to.be.false;
});

it('normalizes an explicitly empty value attribute to the canonical absent default', async () => {
  const el = (await fixture(
    html`<lr-voice-picker value="" .catalog=${CATALOG}></lr-voice-picker>`,
  )) as LyraVoicePicker;
  await el.updateComplete;

  expect(el.defaultValue).to.equal('');
  expect(el.value).to.equal('');
  expect(el.hasAttribute('value')).to.be.false;
});

it('mounting with no initial value never schedules an update after the first update completes', async () => {
  // `defaultValue` uses `useDefault: true`, which marks it "changed" on the component's very
  // first update even when no consumer ever assigned it. A post-commit `updated()` correction
  // that mutates the `value` attribute for that default empty case would fire on every ordinary
  // mount and trip Lit's "scheduled an update after an update completed" warning -- exactly the
  // failure `WTR_STRICT_CONSOLE=1` (the CI/full-engine config) turns into a hard test failure.
  const originalWarn = console.warn;
  const calls: unknown[][] = [];
  console.warn = (...args: unknown[]) => calls.push(args);
  try {
    const el = (await fixture(html`<lr-voice-picker .catalog=${CATALOG}></lr-voice-picker>`)) as LyraVoicePicker;
    await el.updateComplete;
    // Give any wrongly-scheduled follow-up update a full microtask/task turn to actually fire.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(el.hasAttribute('value')).to.be.false;
    expect(calls.flat().join(' ')).to.not.contain('scheduled an update');
  } finally {
    console.warn = originalWarn;
  }
});

// -- disabled setter / effectiveDisabled guards -----------------------------

it('the disabled setter toggles the attribute and closes an open dropdown', async () => {
  const el = (await fixture(html`<lr-voice-picker .catalog=${CATALOG}></lr-voice-picker>`)) as LyraVoicePicker;
  trigger(el).click();
  await el.updateComplete;
  expect(el.open).to.be.true;

  el.disabled = true;
  await el.updateComplete;
  expect(el.hasAttribute('disabled')).to.be.true;
  expect(el.open, 'disabling closes an open dropdown').to.be.false;

  el.disabled = false;
  await el.updateComplete;
  expect(el.hasAttribute('disabled')).to.be.false;
});

it('does not open when disabled', async () => {
  const el = (await fixture(html`<lr-voice-picker disabled .catalog=${CATALOG}></lr-voice-picker>`)) as LyraVoicePicker;
  // A native `disabled` button suppresses the synthetic-click algorithm entirely (`.click()` is a
  // no-op), which would never actually reach `onTriggerClick`'s own effectiveDisabled guard --
  // dispatch the click event directly (as the shadow-DOM `@click` binding itself would receive it
  // from e.g. a stylus/AT-driven activation) to exercise that guard deterministically.
  trigger(el).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it('forwards host .click() to the trigger button in closed-dropdown mode, since HTMLElement.prototype.click() is otherwise a no-op on a custom element', async () => {
  const el = (await fixture(html`<lr-voice-picker .catalog=${CATALOG}></lr-voice-picker>`)) as LyraVoicePicker;
  expect(el.open).to.be.false;
  el.click();
  await el.updateComplete;
  expect(el.open).to.be.true;
});

it('forwards host .click() to the combobox input in free-text mode', async () => {
  const el = (await fixture(html`<lr-voice-picker allow-custom></lr-voice-picker>`)) as LyraVoicePicker;
  let relayedClicks = 0;
  el.addEventListener('click', () => (relayedClicks += 1));
  expect(el.open).to.be.false;
  el.click();
  await el.updateComplete;
  expect(el.open).to.be.true;
  expect(relayedClicks, 'voice-picker retains its focus-only free-text host click').to.equal(0);
});

it('clicking an open trigger closes it (toggle)', async () => {
  const el = (await fixture(html`<lr-voice-picker .catalog=${CATALOG}></lr-voice-picker>`)) as LyraVoicePicker;
  trigger(el).click();
  await el.updateComplete;
  expect(el.open).to.be.true;
  trigger(el).click();
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it('blurring an already-closed trigger is a harmless no-op', async () => {
  const el = (await fixture(html`<lr-voice-picker .catalog=${CATALOG}></lr-voice-picker>`)) as LyraVoicePicker;
  expect(el.open).to.be.false;
  trigger(el).dispatchEvent(new FocusEvent('blur', { bubbles: true }));
  await el.updateComplete;
  expect(el.open).to.be.false;
});

// -- Form lifecycle callbacks (mirrors lr-model-select) ---------------------

it('restores the declared default value on form.reset()', async () => {
  const form = (await fixture(html`
    <form>
      <lr-voice-picker name="voice" value="alloy" .catalog=${CATALOG}></lr-voice-picker>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-voice-picker') as LyraVoicePicker;
  await el.updateComplete;
  el.value = 'verse';
  await el.updateComplete;
  form.reset();
  expect(el.value).to.equal('alloy');
});

it('formStateRestoreCallback sets the value directly for autofill/bfcache restoration, ignoring non-string state', async () => {
  const el = (await fixture(html`<lr-voice-picker .catalog=${CATALOG}></lr-voice-picker>`)) as LyraVoicePicker;
  el.formStateRestoreCallback('alloy', 'restore');
  expect(el.value).to.equal('alloy');
  el.formStateRestoreCallback(null);
  expect(el.value).to.equal('');
});

it('temporarily disables via an ancestor fieldset without mutating the disabled property, and closes an open dropdown', async () => {
  const form = (await fixture(html`
    <form>
      <fieldset>
        <lr-voice-picker name="voice" value="alloy" .catalog=${CATALOG}></lr-voice-picker>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-voice-picker') as LyraVoicePicker;
  const fieldset = form.querySelector('fieldset') as HTMLFieldSetElement;
  await el.updateComplete;
  el.open = true;
  await el.updateComplete;
  expect(el.open).to.be.true;

  fieldset.disabled = true;
  await el.updateComplete;
  expect(el.disabled, 'fieldset state must not mutate the public property').to.be.false;
  expect(el.effectiveDisabled).to.be.true;
  expect(el.open, 'formDisabledCallback closes an open dropdown').to.be.false;
  expect(trigger(el).disabled).to.be.true;

  fieldset.disabled = false;
  await el.updateComplete;
  expect(el.effectiveDisabled).to.be.false;
});

it('checkValidity/reportValidity delegate to the internal ElementInternals', async () => {
  const form = (await fixture(html`
    <form>
      <lr-voice-picker name="voice" required .catalog=${CATALOG}></lr-voice-picker>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-voice-picker') as LyraVoicePicker;
  expect(el.reportValidity()).to.be.false;
  el.value = 'alloy';
  expect(el.reportValidity()).to.be.true;
});

// -- Free-text Enter commit (commitFreeText) --------------------------------

it('commits a highlighted suggestion with Enter in free-text mode, emitting lr-change with inCatalog true', async () => {
  const el = (await fixture(
    html`<lr-voice-picker allow-custom .catalog=${CATALOG}></lr-voice-picker>`
  )) as LyraVoicePicker;
  const inp = input(el);
  inp.focus();
  await el.updateComplete;
  inp.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  const changePromise = oneEvent(el, 'lr-change');
  inp.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    })
  );
  const ev = await changePromise;
  expect(ev.detail).to.deep.equal({ value: 'alloy', inCatalog: true });
});

it('commits raw typed text not in the catalog when allow-custom is set, with inCatalog false', async () => {
  const el = (await fixture(
    html`<lr-voice-picker allow-custom .catalog=${CATALOG}></lr-voice-picker>`
  )) as LyraVoicePicker;
  const inp = input(el);
  inp.focus();
  inp.value = 'my-custom-voice';
  inp.dispatchEvent(new Event('input', { bubbles: true }));
  await el.updateComplete;
  const changePromise = oneEvent(el, 'lr-change');
  inp.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    })
  );
  const ev = await changePromise;
  expect(ev.detail).to.deep.equal({
    value: 'my-custom-voice',
    inCatalog: false,
  });
});

// -- previewCandidateId / labelFor edge cases --------------------------------

it("previewCandidateId (and the trigger's aria-activedescendant) tracks the highlighted row while navigating open", async () => {
  const el = (await fixture(
    html`<lr-voice-picker .catalog=${CATALOG} value="alloy"></lr-voice-picker>`
  )) as LyraVoicePicker;
  const btn = trigger(el);
  btn.click();
  await el.updateComplete;
  btn.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect(btn.getAttribute('aria-activedescendant')).to.not.equal('');
  expect(previewButton(el).getAttribute('aria-label')).to.equal('Preview alloy');

  btn.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect(previewButton(el).getAttribute('aria-label')).to.equal('Preview verse');
});

it('retires playback before active-option navigation changes the visible preview candidate', async () => {
  const restore = stubMediaPlay(() => Promise.resolve());
  try {
    const el = (await fixture(
      html`<lr-voice-picker .catalog=${PREVIEW_CATALOG} value="aria"></lr-voice-picker>`,
    )) as LyraVoicePicker;
    const started = oneEvent(el, 'lr-preview-change');
    previewButton(el).click();
    await started;

    el.open = true;
    await el.updateComplete;
    const btn = trigger(el);
    const move = () =>
      btn.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          bubbles: true,
          cancelable: true,
        }),
      );
    const changes: Array<string | null> = [];
    el.addEventListener('lr-preview-change', (event) => changes.push(event.detail.voiceId));

    move();
    await el.updateComplete;
    expect(changes).to.deep.equal([]);
    expect(previewButton(el).getAttribute('aria-label')).to.equal('Stop preview');
    expect(previewButton(el).getAttribute('aria-pressed')).to.equal('true');

    move();
    await el.updateComplete;
    expect(changes).to.deep.equal([null]);
    expect(previewButton(el).getAttribute('aria-label')).to.equal('Preview Sage');
    expect(previewButton(el).getAttribute('aria-pressed')).to.equal('false');
  } finally {
    restore();
  }
});

it('uses the committed voice as the preview candidate when keyboard navigation has no matching row', async () => {
  const el = (await fixture(
    html`<lr-voice-picker allow-custom .catalog=${OBJECT_CATALOG} value="aria"></lr-voice-picker>`
  )) as LyraVoicePicker;
  const inp = input(el);
  inp.focus();
  inp.value = 'no matching voice';
  inp.dispatchEvent(new Event('input', { bubbles: true }));
  await el.updateComplete;
  expect(rows(el).length).to.equal(0);

  const navigation = new KeyboardEvent('keydown', {
    key: 'ArrowUp',
    bubbles: true,
    cancelable: true,
  });
  inp.dispatchEvent(navigation);
  await el.updateComplete;
  expect(navigation.defaultPrevented).to.be.true;
  expect(previewButton(el).getAttribute('aria-label')).to.equal('Preview Aria');

  const requested = oneEvent(el, 'lr-preview-request');
  previewButton(el).click();
  expect((await requested).detail.voiceId).to.equal('aria');
});

it('labelFor falls back to the raw id when there is no catalog to look up a label from', async () => {
  const el = (await fixture(html`<lr-voice-picker value="raw-id"></lr-voice-picker>`)) as LyraVoicePicker;
  expect(input(el).value).to.equal('raw-id');
});

// -- Preview guards and edge cases -------------------------------------------

it('the per-row preview icon is a no-op for an entry with an empty id (defensive requestPreview guard)', async () => {
  const catalog = [{ id: '', label: 'Untitled', previewUrl: 'https://example.test/x.mp3' }];
  const el = (await fixture(html`<lr-voice-picker .catalog=${catalog}></lr-voice-picker>`)) as LyraVoicePicker;
  el.open = true;
  await el.updateComplete;
  let requested = false;
  el.addEventListener('lr-preview-request', () => (requested = true));
  const icon = rows(el)[0]!.querySelector('[part="option-preview"]') as HTMLElement;
  icon.click();
  await el.updateComplete;
  expect(requested).to.be.false;
});

it('a previewUrl with a disallowed scheme is silently dropped by safeMediaSrc -- no internal playback', async () => {
  const catalog = [{ id: 'x', label: 'X', previewUrl: 'javascript:alert(1)' }];
  const el = (await fixture(
    html`<lr-voice-picker .catalog=${catalog} value="x"></lr-voice-picker>`
  )) as LyraVoicePicker;
  const reqPromise = oneEvent(el, 'lr-preview-request');
  let changed = false;
  el.addEventListener('lr-preview-change', () => (changed = true));
  previewButton(el).click();
  await reqPromise;
  await el.updateComplete;
  expect(changed).to.be.false;
  expect(previewButton(el).getAttribute('aria-pressed')).to.equal('false');
});

it('stopping an active internal preview via the standalone button releases the <audio> element', async () => {
  // Real playback against a fake domain can fail (and auto-release the resource) before a second
  // click gets a chance to. Resolve play() deterministically so the published active state and its
  // explicit terminal stop can both be observed.
  const restore = stubMediaPlay(() => Promise.resolve());
  try {
    const el = (await fixture(
      html`<lr-voice-picker .catalog=${OBJECT_CATALOG} value="aria"></lr-voice-picker>`
    )) as LyraVoicePicker;
    const startPromise = oneEvent(el, 'lr-preview-change');
    previewButton(el).click();
    await startPromise;
    expect(previewButton(el).getAttribute('aria-pressed')).to.equal('true');

    const stopPromise = oneEvent(el, 'lr-preview-change');
    previewButton(el).click(); // audioEl is still set after fulfilled playback -- cleanup branch
    const stopEv = await stopPromise;
    expect(stopEv.detail).to.deep.equal({ voiceId: null });
    expect(previewButton(el).getAttribute('aria-pressed')).to.equal('false');
  } finally {
    restore();
  }
});

it('a pending play rejection after the same candidate was canceled stays silent', async () => {
  let rejectPlay!: (e: unknown) => void;
  const pending = new Promise<void>((_resolve, reject) => {
    rejectPlay = reject;
  });
  const restore = stubMediaPlay(() => pending);
  try {
    const el = (await fixture(
      html`<lr-voice-picker .catalog=${OBJECT_CATALOG} value="aria"></lr-voice-picker>`
    )) as LyraVoicePicker;
    const changes: Array<string | null> = [];
    el.addEventListener('lr-preview-change', (event) => changes.push(event.detail.voiceId));
    previewButton(el).click();
    await Promise.resolve();

    previewButton(el).click(); // cancel the same still-pending target synchronously

    // The stale promise now rejects after its resource was released. Neither the pending attempt
    // nor its cancellation was ever public playing state, so neither may publish a change.
    rejectPlay(new Error('network unreachable'));
    await new Promise((r) => setTimeout(r, 0));
    expect(changes).to.deep.equal([]);
    expect((el as unknown as { audioEl?: HTMLAudioElement }).audioEl === undefined).to.be.true;
    expect(previewButton(el).getAttribute('aria-pressed')).to.equal('false');
  } finally {
    restore();
  }
});

it('ignores a stale play fulfillment after the pending candidate was superseded', async () => {
  let resolvePlay!: () => void;
  const restore = stubMediaPlay(
    () =>
      new Promise<void>((resolve) => {
        resolvePlay = resolve;
      }),
  );
  try {
    const el = (await fixture(
      html`<lr-voice-picker .catalog=${OBJECT_CATALOG} value="aria"></lr-voice-picker>`,
    )) as LyraVoicePicker;
    const changes: Array<string | null> = [];
    el.addEventListener('lr-preview-change', (event) => changes.push(event.detail.voiceId));
    previewButton(el).click();
    await Promise.resolve();

    el.value = 'sage';
    await el.updateComplete;
    resolvePlay();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(changes).to.deep.equal([]);
    expect(el.value).to.equal('sage');
    expect(previewButton(el).getAttribute('aria-pressed')).to.equal('false');
    expect((el as unknown as { audioEl?: HTMLAudioElement }).audioEl === undefined).to.be.true;
  } finally {
    restore();
  }
});

it("clicking the same row's preview icon again stops it (per-row toggle)", async () => {
  const restore = stubMediaPlay(() => Promise.resolve());
  try {
    const el = (await fixture(html`<lr-voice-picker .catalog=${OBJECT_CATALOG}></lr-voice-picker>`)) as LyraVoicePicker;
    el.open = true;
    await el.updateComplete;
    const icon = rows(el)[0]!.querySelector('[part="option-preview"]') as HTMLElement;

    const startPromise = oneEvent(el, 'lr-preview-change');
    icon.click();
    await startPromise;

    const stopPromise = oneEvent(el, 'lr-preview-change');
    icon.click();
    const stopEv = await stopPromise;
    expect(stopEv.detail).to.deep.equal({ voiceId: null });
  } finally {
    restore();
  }
});

it('the standalone preview button handler no-ops when there is no candidate (defensive -- the button is otherwise always disabled in that case)', async () => {
  const el = (await fixture(html`<lr-voice-picker .catalog=${CATALOG}></lr-voice-picker>`)) as LyraVoicePicker;
  let requested = false;
  el.addEventListener('lr-preview-request', () => (requested = true));
  (el as unknown as { onPreviewButtonClick: () => void }).onPreviewButtonClick();
  expect(requested).to.be.false;
});

// -- Shared listbox click guards ---------------------------------------------

it('direct open writes cannot reopen an effectively disabled picker', async () => {
  const el = (await fixture(html`<lr-voice-picker .catalog=${CATALOG}></lr-voice-picker>`)) as LyraVoicePicker;
  el.open = true;
  await el.updateComplete;
  const firstRow = rows(el)[0]!;
  let changed = false;
  el.addEventListener('lr-change', () => (changed = true));

  el.disabled = true;
  el.open = true;
  expect(el.open).to.be.false;
  firstRow.click();
  await el.updateComplete;
  expect(changed).to.be.false;
  expect(el.value).to.equal('');
  expect(el.hasAttribute('open')).to.be.false;
});

it('rejects a same-task direct open write after a fieldset becomes disabled', async () => {
  const fieldset = (await fixture(html`
    <fieldset>
      <lr-voice-picker .catalog=${CATALOG}></lr-voice-picker>
    </fieldset>
  `)) as HTMLFieldSetElement;
  const el = fieldset.querySelector('lr-voice-picker') as LyraVoicePicker;

  fieldset.disabled = true;
  el.open = true;

  expect(el.open).to.be.false;
  await el.updateComplete;
  expect(el.effectiveDisabled).to.be.true;
  expect(el.hasAttribute('open')).to.be.false;
});

it('the listbox click handler ignores clicks outside an option row (e.g. the empty-state message)', async () => {
  const el = (await fixture(
    html`<lr-voice-picker allow-custom .catalog=${CATALOG}></lr-voice-picker>`
  )) as LyraVoicePicker;
  const inp = input(el);
  inp.focus();
  inp.value = 'zzz-no-match';
  inp.dispatchEvent(new Event('input', { bubbles: true }));
  await el.updateComplete;
  const empty = el.shadowRoot!.querySelector('[part="empty"]') as HTMLElement;
  let changed = false;
  el.addEventListener('lr-change', () => (changed = true));
  empty.click();
  await el.updateComplete;
  expect(changed).to.be.false;
});

it('clicking a listbox row in free-text mode selects via the filtered-entries branch', async () => {
  const el = (await fixture(
    html`<lr-voice-picker allow-custom .catalog=${CATALOG}></lr-voice-picker>`
  )) as LyraVoicePicker;
  const inp = input(el);
  inp.focus();
  await el.updateComplete;
  const changePromise = oneEvent(el, 'lr-change');
  (rows(el)[1] as HTMLElement).click();
  const ev = await changePromise;
  expect(ev.detail).to.deep.equal({ value: 'verse', inCatalog: true });
});

// -- provider badge -----------------------------------------------------

it('renders the provider badge in closed-dropdown mode', async () => {
  const el = (await fixture(
    html`<lr-voice-picker provider="elevenlabs" .catalog=${CATALOG}></lr-voice-picker>`
  )) as LyraVoicePicker;
  expect(el.shadowRoot!.querySelector('[part="provider-badge"]')!.textContent).to.equal('elevenlabs');
});

it('renders the provider badge in free-text mode', async () => {
  const el = (await fixture(
    html`<lr-voice-picker provider="elevenlabs" allow-custom></lr-voice-picker>`
  )) as LyraVoicePicker;
  expect(el.shadowRoot!.querySelector('[part="provider-badge"]')!.textContent).to.equal('elevenlabs');
});

// -- aria-describedby / aria-required / aria-invalid / autocomplete ---------

it('wires aria-describedby on the closed trigger to the rendered hint/error ids', async () => {
  const el = (await fixture(
    html`<lr-voice-picker hint="Pick a voice" error-text="Required" .catalog=${CATALOG}></lr-voice-picker>`
  )) as LyraVoicePicker;
  const describedBy = trigger(el).getAttribute('aria-describedby') ?? '';
  expect(describedBy).to.contain('error');
  expect(describedBy).to.contain('hint');
});

it('wires aria-describedby on the free-text combobox input to the rendered hint/error ids', async () => {
  const el = (await fixture(
    html`<lr-voice-picker allow-custom hint="Pick a voice" error-text="Required"></lr-voice-picker>`
  )) as LyraVoicePicker;
  const describedBy = input(el).getAttribute('aria-describedby') ?? '';
  expect(describedBy).to.contain('error');
  expect(describedBy).to.contain('hint');
});

it('marks the closed trigger aria-invalid once a required, empty picker is touched (blurred)', async () => {
  const el = (await fixture(html`<lr-voice-picker required .catalog=${CATALOG}></lr-voice-picker>`)) as LyraVoicePicker;
  expect(trigger(el).getAttribute('aria-invalid')).to.equal('false');
  trigger(el).click();
  await el.updateComplete;
  trigger(el).dispatchEvent(new FocusEvent('blur', { bubbles: true }));
  await el.updateComplete;
  expect(trigger(el).getAttribute('aria-invalid')).to.equal('true');
  expect(el.hasAttribute('data-invalid')).to.be.true;
});

it("reflects required/touched-invalid state onto the free-text input's aria-required/aria-invalid", async () => {
  const el = (await fixture(html`<lr-voice-picker allow-custom required></lr-voice-picker>`)) as LyraVoicePicker;
  const inp = input(el);
  expect(inp.getAttribute('aria-required')).to.equal('true');
  expect(inp.getAttribute('aria-invalid')).to.equal('false');
  inp.focus();
  await el.updateComplete;
  inp.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
  await el.updateComplete;
  expect(inp.getAttribute('aria-invalid')).to.equal('true');
});

describe('touched state — blur guard against platform-forced blur', () => {
  it('does not mark touched from a blur caused by the trigger itself becoming disabled', async () => {
    // Regression test for the same disabled-forced-blur behavior (see lr-input's identical fix).
    // The browser force-blurs a focused native control when it becomes disabled -- not a user
    // interaction -- so onControlBlur() unconditionally marking `touched = true` for it could reenter an
    // in-flight update and trip Lit's dev-mode "scheduled an update after an update completed"
    // warning for a state flip nothing observable needed (a disabled control is barred from
    // validation regardless). Proven observably here: re-enabling afterwards must still see the
    // field as untouched, not retroactively user-invalid from a blur the user never caused.
    const el = (await fixture(
      html`<lr-voice-picker required .catalog=${CATALOG}></lr-voice-picker>`
    )) as LyraVoicePicker;
    const isTouched = () => (el as unknown as { touched: boolean }).touched;
    trigger(el).focus();
    await new Promise((resolve) => setTimeout(resolve, 0));

    el.disabled = true;
    expect(isTouched(), 'a disable-forced blur must not mark touched').to.be.false;
    await el.updateComplete;
    el.disabled = false;
    await el.updateComplete;
    expect(isTouched(), 'still not touched after re-enabling').to.be.false;

    // A genuine user-driven blur (not caused by disablement) still marks touched, unchanged.
    trigger(el).dispatchEvent(new Event('blur', { bubbles: true }));
    expect(isTouched(), 'a real blur still marks touched').to.be.true;
  });

  it('does not mark touched from a blur caused by the free-text combobox input itself becoming disabled', async () => {
    // Same regression, for the free-text mode's internal <input> (onControlBlur).
    const el = (await fixture(html`<lr-voice-picker allow-custom required></lr-voice-picker>`)) as LyraVoicePicker;
    const isTouched = () => (el as unknown as { touched: boolean }).touched;
    input(el).focus();
    await new Promise((resolve) => setTimeout(resolve, 0));

    el.disabled = true;
    expect(isTouched(), 'a disable-forced blur must not mark touched').to.be.false;
    await el.updateComplete;
    el.disabled = false;
    await el.updateComplete;
    expect(isTouched(), 'still not touched after re-enabling').to.be.false;

    input(el).dispatchEvent(new Event('blur', { bubbles: true }));
    expect(isTouched(), 'a real blur still marks touched').to.be.true;
  });
});

it('omits the autocomplete attribute entirely when autocomplete is cleared', async () => {
  const el = (await fixture(html`<lr-voice-picker allow-custom autocomplete=""></lr-voice-picker>`)) as LyraVoicePicker;
  expect(input(el).hasAttribute('autocomplete')).to.be.false;
});

/** Render the max-inline-size declared on `selector` (read off the element's own applied stylesheets)
 *  into the component's shadow scope with the viewport-clamp token pinned to a tiny value, returning
 *  its resolved computed value. Wired to --lr-popover-viewport-clamp the min() collapses to that
 *  pinned value; a leftover 92vw/90vw literal would resolve to something else. */
function renderedClamp(el: HTMLElement, selector: string): string {
  const normalize = (text: string) => text.replace(/"/g, "'");
  let declared = '';
  for (const sheet of el.shadowRoot!.adoptedStyleSheets) {
    for (const rule of sheet.cssRules) {
      if (
        rule instanceof CSSStyleRule &&
        normalize(rule.selectorText) === normalize(selector) &&
        rule.style.maxInlineSize
      ) {
        declared = rule.style.maxInlineSize;
      }
    }
  }
  const probe = document.createElement('span');
  probe.style.display = 'block';
  probe.style.setProperty('--lr-popover-viewport-clamp', '10px');
  probe.style.maxInlineSize = declared;
  el.shadowRoot!.appendChild(probe);
  const value = getComputedStyle(probe).maxInlineSize;
  probe.remove();
  return value;
}

it('clamps its floating surface width through the shared popover-viewport-clamp token', async () => {
  const el = (await fixture(html`<lr-voice-picker></lr-voice-picker>`)) as HTMLElement;
  await (el as HTMLElement & { updateComplete?: Promise<unknown> }).updateComplete;
  expect(renderedClamp(el, "[part='listbox']")).to.equal('10px');
});

it("colors the combobox-input's placeholder text instead of leaving the UA default", async () => {
  const el = (await fixture(
    html`<lr-voice-picker allow-custom placeholder="Choose a voice"></lr-voice-picker>`,
  )) as LyraVoicePicker;
  const input = el.shadowRoot!.querySelector<HTMLInputElement>('[part="combobox-input"]')!;
  const probe = document.createElement('span');
  probe.style.color = 'var(--lr-color-text-quiet)';
  el.shadowRoot!.append(probe);
  const expectedColor = getComputedStyle(probe).color;
  probe.remove();

  expect(getComputedStyle(input, '::placeholder').color).to.equal(expectedColor);
});

// -- Hover feedback (mouse users get the same 'this is clickable' cue keyboard focus gives) ------

it('renders hover treatment on the trigger and standalone preview button', async () => {
  const el = await fixture<LyraVoicePicker>(html`
    <lr-voice-picker
      value="aria"
      style="--lr-color-brand: rgb(1, 2, 3); --lr-color-brand-quiet: rgb(4, 5, 6)"
      .catalog=${OBJECT_CATALOG}
    ></lr-voice-picker>
  `);
  const targets = [
    { element: trigger(el), property: 'borderTopColor', expected: 'rgb(1, 2, 3)' },
    { element: previewButton(el), property: 'backgroundColor', expected: 'rgb(4, 5, 6)' },
  ] as const;

  for (const { element, property, expected } of targets) {
    element.scrollIntoView({ block: 'center' });
    const rect = element.getBoundingClientRect();
    try {
      await sendMouse({
        type: 'move',
        position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
      });
      await waitUntil(
        () => getComputedStyle(element)[property] === expected,
        `${element.getAttribute('part')} never painted its hover treatment`,
      );
    } finally {
      await resetMouse();
    }
  }
});

// -- overflow-x pinned alongside the listbox's overflow-y (phantom-scrollbar guard) ---------------

it("pins overflow-x alongside overflow-y on the listbox so the horizontal axis never computes to an implicit 'auto'", async () => {
  const el = (await fixture(html`<lr-voice-picker .catalog=${CATALOG}></lr-voice-picker>`)) as LyraVoicePicker;
  trigger(el).click();
  await el.updateComplete;
  expect(getComputedStyle(listbox(el)).overflowX).to.not.equal('visible');
});

// -- Keyboard, pointer, focus and slot contracts ----------------------------
// Closed-dropdown mode (a non-empty catalog with allow-custom unset) drives the trigger button;
// setting allow-custom switches the same component to the free-text combobox input.

describe('closed-dropdown keyboard contract', () => {
  const open = async (el: LyraVoicePicker): Promise<void> => {
    trigger(el).focus();
    trigger(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await el.updateComplete;
  };
  const press = async (el: LyraVoicePicker, key: string): Promise<KeyboardEvent> => {
    const event = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
    });
    trigger(el).dispatchEvent(event);
    await el.updateComplete;
    return event;
  };
  const active = (el: LyraVoicePicker): number => (el as unknown as { activeIndex: number }).activeIndex;

  it('ArrowDown opens the closed listbox, then walks down and clamps at the last row', async () => {
    const el = (await fixture(html`<lr-voice-picker .catalog=${CATALOG}></lr-voice-picker>`)) as LyraVoicePicker;
    expect(el.open).to.be.false;
    await open(el);
    expect(el.open).to.be.true;
    expect(active(el)).to.equal(-1);
    await press(el, 'ArrowDown');
    expect(active(el)).to.equal(0);
    await press(el, 'ArrowDown');
    expect(active(el)).to.equal(1);
    await press(el, 'ArrowDown');
    expect(active(el), 'clamps at rows.length - 1').to.equal(1);
  });

  it('ArrowUp opens the closed listbox, then walks up and clamps at the first row', async () => {
    const el = (await fixture(html`<lr-voice-picker .catalog=${CATALOG}></lr-voice-picker>`)) as LyraVoicePicker;
    trigger(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    await el.updateComplete;
    expect(el.open, 'ArrowUp on a closed picker opens it rather than moving').to.be.true;
    await press(el, 'End');
    expect(active(el)).to.equal(1);
    await press(el, 'ArrowUp');
    expect(active(el)).to.equal(0);
    await press(el, 'ArrowUp');
    expect(active(el), 'clamps at 0').to.equal(0);
  });

  it('Home and End jump to the first and last row, and only while open', async () => {
    const el = (await fixture(html`<lr-voice-picker .catalog=${CATALOG}></lr-voice-picker>`)) as LyraVoicePicker;
    const closed = await press(el, 'Home');
    expect(closed.defaultPrevented, 'Home is inert while closed').to.be.false;
    expect(el.open).to.be.false;
    await open(el);
    const end = await press(el, 'End');
    expect(end.defaultPrevented).to.be.true;
    expect(active(el)).to.equal(1);
    const home = await press(el, 'Home');
    expect(home.defaultPrevented).to.be.true;
    expect(active(el)).to.equal(0);
  });

  it('Enter and Space commit the active row, and close without committing when there is none', async () => {
    const el = (await fixture(html`<lr-voice-picker .catalog=${CATALOG}></lr-voice-picker>`)) as LyraVoicePicker;
    await open(el);
    const dismissed = await press(el, 'Enter');
    expect(dismissed.defaultPrevented).to.be.true;
    expect(el.open, 'Enter with no active row just closes').to.be.false;
    expect(el.value).to.equal('');

    await open(el);
    await press(el, 'ArrowDown');
    const changed = oneEvent(el, 'lr-change');
    const committed = await press(el, ' ');
    expect(committed.defaultPrevented).to.be.true;
    expect((await changed).detail).to.deep.equal({
      value: 'alloy',
      inCatalog: true,
    });
    expect(el.value).to.equal('alloy');
    expect(el.open).to.be.false;
  });

  it('Escape closes an open listbox and is inert while already closed', async () => {
    const el = (await fixture(html`<lr-voice-picker .catalog=${CATALOG}></lr-voice-picker>`)) as LyraVoicePicker;
    const inert = await press(el, 'Escape');
    expect(inert.defaultPrevented).to.be.false;
    await open(el);
    const dismiss = await press(el, 'Escape');
    expect(dismiss.defaultPrevented).to.be.true;
    expect(el.open).to.be.false;
  });

  it('ignores an unhandled key entirely', async () => {
    const el = (await fixture(html`<lr-voice-picker .catalog=${CATALOG}></lr-voice-picker>`)) as LyraVoicePicker;
    await open(el);
    const tab = await press(el, 'Tab');
    expect(tab.defaultPrevented).to.be.false;
    expect(el.open).to.be.true;
  });
});

describe('free-text keyboard contract', () => {
  const freeText = (): Promise<LyraVoicePicker> =>
    fixture(html`<lr-voice-picker .catalog=${CATALOG} allow-custom></lr-voice-picker>`) as Promise<LyraVoicePicker>;
  const press = async (el: LyraVoicePicker, key: string): Promise<KeyboardEvent> => {
    const event = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
    });
    input(el).dispatchEvent(event);
    await el.updateComplete;
    return event;
  };
  const active = (el: LyraVoicePicker): number => (el as unknown as { activeIndex: number }).activeIndex;

  it('ArrowDown/ArrowUp open the suggestion list before they move within it', async () => {
    const el = await freeText();
    expect(el.open).to.be.false;
    await press(el, 'ArrowDown');
    expect(el.open).to.be.true;
    await press(el, 'ArrowDown');
    expect(active(el)).to.equal(0);
    await press(el, 'ArrowUp');
    expect(active(el)).to.equal(0);

    const second = await freeText();
    await press(second, 'ArrowUp');
    expect(second.open, 'ArrowUp also opens from closed').to.be.true;
  });

  it('Home and End bound the active suggestion while open', async () => {
    const el = await freeText();
    const closed = await press(el, 'End');
    expect(closed.defaultPrevented).to.be.false;
    await press(el, 'ArrowDown');
    const end = await press(el, 'End');
    expect(end.defaultPrevented).to.be.true;
    expect(active(el)).to.equal(1);
    const home = await press(el, 'Home');
    expect(home.defaultPrevented).to.be.true;
    expect(active(el)).to.equal(0);
  });

  it('Enter commits the typed text and Escape restores the committed label', async () => {
    const el = await freeText();
    input(el).value = 'custom-voice';
    input(el).dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    const changed = oneEvent(el, 'lr-change');
    const commit = await press(el, 'Enter');
    expect(commit.defaultPrevented).to.be.true;
    expect((await changed).detail).to.deep.equal({
      value: 'custom-voice',
      inCatalog: false,
    });

    input(el).dispatchEvent(new Event('focus', { bubbles: true }));
    await el.updateComplete;
    input(el).value = 'half-typed';
    input(el).dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    const escape = await press(el, 'Escape');
    expect(escape.defaultPrevented).to.be.true;
    expect(el.open).to.be.false;
    expect(input(el).value, 'Escape reverts to the committed value').to.equal('custom-voice');
  });

  it('Enter and Escape are inert while the list is closed', async () => {
    const el = await freeText();
    const enter = await press(el, 'Enter');
    const escape = await press(el, 'Escape');
    expect(enter.defaultPrevented).to.be.false;
    expect(escape.defaultPrevented).to.be.false;
  });
});

it('focus() and blur() reach the trigger in closed-dropdown mode', async () => {
  const el = (await fixture(html`<lr-voice-picker .catalog=${CATALOG}></lr-voice-picker>`)) as LyraVoicePicker;
  el.focus();
  expect(el.shadowRoot!.activeElement === trigger(el)).to.equal(true);
  el.blur();
  expect(el.shadowRoot!.activeElement !== trigger(el)).to.equal(true);
});

it('focus() and blur() reach the text input in free-text mode', async () => {
  const el = (await fixture(
    html`<lr-voice-picker .catalog=${CATALOG} allow-custom></lr-voice-picker>`
  )) as LyraVoicePicker;
  el.focus();
  expect(el.shadowRoot!.activeElement === input(el)).to.equal(true);
  el.blur();
  expect(el.shadowRoot!.activeElement !== input(el)).to.equal(true);
});

it('a pointerdown outside the host closes an open listbox, while one inside it does not', async () => {
  const el = (await fixture(html`<lr-voice-picker .catalog=${CATALOG}></lr-voice-picker>`)) as LyraVoicePicker;
  trigger(el).click();
  await el.updateComplete;
  expect(el.open).to.be.true;

  trigger(el).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
  await el.updateComplete;
  expect(el.open, 'a pointerdown on the host stays open').to.be.true;

  document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it('keeps outside dismissal working after an open catalog refresh', async () => {
  const el = (await fixture(html`<lr-voice-picker .catalog=${CATALOG}></lr-voice-picker>`)) as LyraVoicePicker;
  trigger(el).click();
  await el.updateComplete;
  expect(el.open).to.be.true;

  el.catalog = ['alloy'];
  await el.updateComplete;
  expect(rows(el).length).to.equal(1);

  document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it('disconnects and reconnects an open picker without stranding popup state or cleanup', async () => {
  const el = (await fixture(
    html`<lr-voice-picker open .catalog=${CATALOG}></lr-voice-picker>`,
  )) as LyraVoicePicker;
  await el.updateComplete;
  const parent = el.parentElement!;

  el.remove();
  expect(el.open, 'disconnect resets transient open state').to.be.false;

  parent.append(el);
  await el.updateComplete;
  trigger(el).click();
  await el.updateComplete;
  expect(el.open, 'the reconnected picker can open normally').to.be.true;

  document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
  await el.updateComplete;
  expect(el.open, 'the reconnected picker owns a live outside-pointer listener').to.be.false;
});

it('mousedown on the combobox shell focuses the input without letting the shell take selection', async () => {
  const el = (await fixture(
    html`<lr-voice-picker .catalog=${CATALOG} allow-custom></lr-voice-picker>`
  )) as LyraVoicePicker;
  const shell = el.shadowRoot!.querySelector('[part="combobox"]') as HTMLElement;
  const event = new MouseEvent('mousedown', {
    bubbles: true,
    cancelable: true,
  });
  shell.dispatchEvent(event);
  await el.updateComplete;
  expect(event.defaultPrevented).to.be.true;
  expect(el.shadowRoot!.activeElement === input(el)).to.equal(true);
});

it('preserves the native caret-placement default for a trusted mousedown on the editable input', async () => {
  const el = (await fixture(
    html`<lr-voice-picker .catalog=${CATALOG} allow-custom value="abcdefghij"></lr-voice-picker>`
  )) as LyraVoicePicker;
  const nativeInput = input(el);
  nativeInput.focus();
  nativeInput.setSelectionRange(0, nativeInput.value.length);
  let trustedMouseDown: MouseEvent | undefined;
  nativeInput.addEventListener('mousedown', (event) => {
    if (event.isTrusted) trustedMouseDown = event;
  });

  const rect = nativeInput.getBoundingClientRect();
  await sendMouse({
    type: 'click',
    position: [Math.round(rect.right - 4), Math.round(rect.top + rect.height / 2)],
  });

  expect(trustedMouseDown?.defaultPrevented).to.equal(false);
  expect(nativeInput.selectionStart).to.equal(nativeInput.selectionEnd);
});

it('mousedown on the combobox shell is inert while disabled', async () => {
  const el = (await fixture(
    html`<lr-voice-picker .catalog=${CATALOG} allow-custom disabled></lr-voice-picker>`
  )) as LyraVoicePicker;
  const shell = el.shadowRoot!.querySelector('[part="combobox"]') as HTMLElement;
  const event = new MouseEvent('mousedown', {
    bubbles: true,
    cancelable: true,
  });
  shell.dispatchEvent(event);
  await el.updateComplete;
  expect(event.defaultPrevented).to.be.false;
});

it('mousedown on a listbox option is prevented so the control keeps focus, but not on the listbox chrome', async () => {
  const el = (await fixture(html`<lr-voice-picker .catalog=${CATALOG}></lr-voice-picker>`)) as LyraVoicePicker;
  trigger(el).click();
  await el.updateComplete;

  const onOption = new MouseEvent('mousedown', {
    bubbles: true,
    cancelable: true,
  });
  rows(el)[0]!.dispatchEvent(onOption);
  expect(onOption.defaultPrevented).to.be.true;

  const onChrome = new MouseEvent('mousedown', {
    bubbles: true,
    cancelable: true,
  });
  listbox(el).dispatchEvent(onChrome);
  expect(onChrome.defaultPrevented).to.be.false;
});

it('tracks slotted hint and error content through slotchange', async () => {
  const el = (await fixture(html`
    <lr-voice-picker .catalog=${CATALOG}>
      <span slot="hint">Pick a narrator</span>
      <span slot="error">Required</span>
    </lr-voice-picker>
  `)) as LyraVoicePicker;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="hint"]')).to.exist;
  expect(el.shadowRoot!.querySelector('[part="error"]')).to.exist;

  el.querySelector('[slot="hint"]')!.remove();
  el.querySelector('[slot="error"]')!.remove();
  const hint = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
  const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
  await waitUntil(() => hint.hidden && error.hidden, 'removing slotted hint/error must collapse both wrappers');
  expect(trigger(el).hasAttribute('aria-describedby')).to.be.false;
});

it('an ended event from a superseded audio element does not stop the current preview', async () => {
  const restore = stubMediaPlay(() => Promise.resolve());
  try {
    const el = (await fixture(
      html`<lr-voice-picker .catalog=${OBJECT_CATALOG} value="aria"></lr-voice-picker>`
    )) as LyraVoicePicker;
    previewButton(el).click();
    await el.updateComplete;
    const current = (el as unknown as { audioEl?: HTMLAudioElement }).audioEl!;
    expect(current != null).to.equal(true);

    const stale = new Audio();
    stale.addEventListener('ended', (el as unknown as { onAudioEnded: (e: Event) => void }).onAudioEnded);
    stale.dispatchEvent(new Event('ended'));
    await el.updateComplete;
    expect(previewButton(el).getAttribute('aria-pressed'), 'a stale ended event is ignored').to.equal('true');

    current.dispatchEvent(new Event('ended'));
    await el.updateComplete;
    expect(previewButton(el).getAttribute('aria-pressed')).to.equal('false');
  } finally {
    restore();
  }
});

// Not every engine ships CustomStateSet, and `:state()` landed after it in some of them -- these
// guards are why the shared form-associated suite has the same pair, and a test without them fails
// on WebKit rather than reporting an unsupported feature.
const supportsCustomStates = (() => {
  try {
    return typeof CustomStateSet === 'function';
  } catch {
    return false;
  }
})();
const supportsStateSelector = (() => {
  try {
    document.createElement('div').matches(':state(x)');
    return true;
  } catch {
    return false;
  }
})();

describe('validity custom states', () => {
  it('publishes required/optional and valid/invalid, matchable with :state()', async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(
      html`<lr-voice-picker label="Voice" .catalog=${CATALOG}></lr-voice-picker>`
    )) as LyraVoicePicker;
    await el.updateComplete;
    expect(el.matches(':state(optional)'), 'pristine and not required').to.be.true;
    expect(el.matches(':state(required)')).to.be.false;
    expect(el.matches(':state(valid)')).to.be.true;
    expect(el.matches(':state(invalid)')).to.be.false;

    el.required = true;
    await el.updateComplete;
    expect(el.matches(':state(required)')).to.be.true;
    expect(el.matches(':state(optional)')).to.be.false;
    expect(el.matches(':state(invalid)')).to.be.true;
    expect(el.matches(':state(valid)')).to.be.false;

    el.value = 'verse';
    await el.updateComplete;
    expect(el.matches(':state(valid)')).to.be.true;
    expect(el.matches(':state(invalid)')).to.be.false;
  });

  it('withholds user-valid/user-invalid until the user has actually interacted', async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(
      html`<lr-voice-picker label="Voice" required .catalog=${CATALOG}></lr-voice-picker>`
    )) as LyraVoicePicker;
    await el.updateComplete;
    // A pristine required picker really is invalid -- but painting it red before the user has done
    // anything is hostile, which is exactly what the user-* pair exists to prevent.
    expect(el.matches(':state(invalid)')).to.be.true;
    expect(el.matches(':state(user-invalid)')).to.be.false;
    expect(el.matches(':state(user-valid)')).to.be.false;

    trigger(el).focus();
    trigger(el).blur();
    await el.updateComplete;
    expect(el.matches(':state(user-invalid)')).to.be.true;
    expect(el.matches(':state(user-valid)')).to.be.false;

    el.value = 'verse';
    await el.updateComplete;
    expect(el.matches(':state(user-valid)')).to.be.true;
    expect(el.matches(':state(user-invalid)')).to.be.false;
  });

  it('counts a reportValidity() call — what a submit attempt runs — as interaction', async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(
      html`<lr-voice-picker label="Voice" required .catalog=${CATALOG}></lr-voice-picker>`
    )) as LyraVoicePicker;
    await el.updateComplete;
    expect(el.matches(':state(user-invalid)')).to.be.false;
    el.reportValidity();
    expect(el.matches(':state(user-invalid)'), 'synchronously, not on the next Lit update').to.be.true;
  });

  it('goes pristine again after a form reset', async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const form = await fixture<HTMLFormElement>(
      html`<form>
        <lr-voice-picker name="voice" label="Voice" required .catalog=${CATALOG}></lr-voice-picker>
      </form>`
    );
    const el = form.querySelector('lr-voice-picker') as LyraVoicePicker;
    await el.updateComplete;
    el.reportValidity();
    expect(el.matches(':state(user-invalid)')).to.be.true;
    form.reset();
    await el.updateComplete;
    expect(el.matches(':state(user-invalid)')).to.be.false;
    expect(el.matches(':state(invalid)'), 'still invalid, just no longer "the user saw it"').to.be.true;
  });
});

describe('setCustomValidity()', () => {
  it('treats a nullish custom-validity message as a request to clear it', async () => {
    const el = (await fixture(
      html`<lr-voice-picker label="Voice" .catalog=${CATALOG}></lr-voice-picker>`
    )) as LyraVoicePicker;
    el.setCustomValidity('Rejected by the server.');
    expect(el.validity.customError).to.be.true;

    (el as unknown as { setCustomValidity(message: string | null | undefined): void }).setCustomValidity(undefined);
    expect(el.validity.customError).to.be.false;
    expect(el.validationMessage).to.equal('');
  });

  it('blocks form submission with a consumer-supplied error, and reports it as validationMessage', async () => {
    const form = await fixture<HTMLFormElement>(
      html`<form>
        <lr-voice-picker name="voice" label="Voice" .catalog=${CATALOG}></lr-voice-picker>
      </form>`
    );
    const el = form.querySelector('lr-voice-picker') as LyraVoicePicker;
    await el.updateComplete;
    let submits = 0;
    // Registered before any requestSubmit() below, so a successful submission can never navigate
    // the test page.
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submits += 1;
    });
    expect(el.checkValidity(), 'valid before the custom error').to.be.true;

    el.setCustomValidity('That voice is no longer offered.');
    expect(el.validity.customError).to.be.true;
    expect(el.checkValidity()).to.be.false;
    expect(el.validationMessage).to.equal('That voice is no longer offered.');
    expect(form.checkValidity()).to.be.false;
    form.requestSubmit();
    expect(submits, 'a custom error blocks submission').to.equal(0);

    el.setCustomValidity('');
    expect(el.validity.customError).to.be.false;
    expect(el.validationMessage).to.equal('');
    form.requestSubmit();
    expect(submits, 'submission is unblocked once the custom error is cleared').to.equal(1);
  });

  it('keeps a custom error through an intrinsic revalidation', async () => {
    const el = (await fixture(
      html`<lr-voice-picker label="Voice" required .catalog=${CATALOG}></lr-voice-picker>`
    )) as LyraVoicePicker;
    await el.updateComplete;
    el.setCustomValidity('Rejected by the server.');
    expect(el.validity.customError).to.be.true;

    // Committing a value re-runs updateValidity() -- the traffic that would otherwise wipe the
    // consumer's error out on every change.
    el.value = 'verse';
    await el.updateComplete;
    expect(el.validity.valueMissing, 'the intrinsic error cleared').to.be.false;
    expect(el.validity.customError, 'the custom error survived the recomputation').to.be.true;
    expect(el.validationMessage).to.equal('Rejected by the server.');
    expect(el.checkValidity()).to.be.false;
  });

  it('keeps a custom error across a form reset, matching native setCustomValidity semantics', async () => {
    // Native `form.reset()` restores a control's value and pristine-ness, but never clears a
    // consumer-set custom error -- only another `setCustomValidity('')` does. This control matches.
    const form = await fixture<HTMLFormElement>(
      html`<form>
        <lr-voice-picker name="voice" label="Voice" value="verse" .catalog=${CATALOG}></lr-voice-picker>
      </form>`
    );
    const el = form.querySelector('lr-voice-picker') as LyraVoicePicker;
    await el.updateComplete;
    el.value = 'alloy';
    el.setCustomValidity('That voice is not enabled for your account.');

    form.reset();
    await el.updateComplete;
    expect(el.value, 'the reset restored the declarative default').to.equal('verse');
    expect(el.validity.customError, 'the custom error outlives the reset').to.be.true;
    expect(el.validationMessage).to.equal('That voice is not enabled for your account.');
    expect(el.checkValidity()).to.be.false;
  });

  it('restores the computed validity when a custom error is cleared, rather than forcing the control valid', async () => {
    const el = (await fixture(
      html`<lr-voice-picker label="Voice" required .catalog=${CATALOG}></lr-voice-picker>`
    )) as LyraVoicePicker;
    await el.updateComplete;
    expect(el.validity.valueMissing, 'required and empty to begin with').to.be.true;

    el.setCustomValidity('Rejected by the server.');
    expect(el.validity.customError).to.be.true;

    el.setCustomValidity('');
    expect(el.validity.customError).to.be.false;
    expect(el.validity.valueMissing, 'an empty required picker still has no value').to.be.true;
    expect(el.checkValidity(), 'clearing the custom error must not force the control valid').to.be.false;
    expect(el.validationMessage.length, 'the intrinsic message is republished').to.be.greaterThan(0);
  });

  it('publishes a custom error through the validity custom states', async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(
      html`<lr-voice-picker label="Voice" .catalog=${CATALOG} value="verse"></lr-voice-picker>`
    )) as LyraVoicePicker;
    await el.updateComplete;
    expect(el.matches(':state(valid)'), 'valid before the custom error').to.be.true;

    el.setCustomValidity('Rejected by the server.');
    expect(el.matches(':state(invalid)'), 'synchronously, not on the next Lit update').to.be.true;
    expect(el.matches(':state(valid)')).to.be.false;
    expect(el.matches(':state(user-invalid)'), 'still pristine until the user has a turn').to.be.false;

    el.reportValidity();
    expect(el.matches(':state(user-invalid)'), 'a reported validation counts as interaction').to.be.true;

    el.setCustomValidity('');
    expect(el.matches(':state(valid)')).to.be.true;
    expect(el.matches(':state(user-valid)')).to.be.true;
    expect(el.matches(':state(user-invalid)')).to.be.false;
  });
});

it('paints the shared required marker on the label, and lets a consumer retune or suppress it', async () => {
  const el = (await fixture(html`
    <lr-voice-picker label="Voice" required .catalog=${CATALOG}></lr-voice-picker>
  `)) as LyraVoicePicker;
  await el.updateComplete;
  const label = el.shadowRoot!.querySelector('[part="form-control-label"]') as HTMLElement;
  expect(getComputedStyle(label, '::after').content).to.contain('*');

  // The three knobs the shared sheet publishes are what make the glyph translatable, retunable and
  // suppressible -- a hardcoded `content: ' *'` left a consumer nowhere to say any of that.
  el.style.setProperty('--lr-form-control-required-content', '" (required)"');
  el.style.setProperty('--lr-form-control-required-color', 'rgb(1, 2, 3)');
  await el.updateComplete;
  expect(getComputedStyle(label, '::after').content).to.contain('required');
  expect(getComputedStyle(label, '::after').color).to.equal('rgb(1, 2, 3)');

  el.style.setProperty('--lr-form-control-required-content', '""');
  await el.updateComplete;
  expect(getComputedStyle(label, '::after').content.replace(/["']/g, '')).to.equal('');
});

it('leaves the required marker off an optional picker', async () => {
  const el = (await fixture(html`
    <lr-voice-picker label="Voice" .catalog=${CATALOG}></lr-voice-picker>
  `)) as LyraVoicePicker;
  await el.updateComplete;
  const label = el.shadowRoot!.querySelector('[part="form-control-label"]') as HTMLElement;
  expect(getComputedStyle(label, '::after').content).to.not.contain('*');
});

it('bars constraint validation while disabled, natively and in the published states', async function () {
  if (!supportsCustomStates || !supportsStateSelector) this.skip();
  const el = (await fixture(html`
    <lr-voice-picker label="Voice" required disabled .catalog=${CATALOG}></lr-voice-picker>
  `)) as LyraVoicePicker;
  await el.updateComplete;
  // A native `<input required disabled>` matches neither `:valid` nor `:invalid`; publishing
  // `invalid`/`user-invalid` from one is what painted every disabled required field red.
  expect(el.checkValidity(), 'a barred control reports no violation').to.be.true;
  expect(el.matches(':state(invalid)')).to.be.false;
  expect(el.matches(':state(user-invalid)')).to.be.false;
  expect(el.matches(':state(valid)')).to.be.false;
  expect(el.matches(':state(required)'), 'required/optional describe the attribute, not the outcome').to.be.true;

  el.disabled = false;
  await el.updateComplete;
  expect(el.checkValidity()).to.be.false;
  expect(el.matches(':state(invalid)')).to.be.true;
});

it('emits a cancelable lr-invalid alias whose cancellation cancels the native invalid event', async () => {
  const el = (await fixture(html`
    <lr-voice-picker label="Voice" required .catalog=${CATALOG}></lr-voice-picker>
  `)) as LyraVoicePicker;
  await el.updateComplete;
  const aliases: CustomEvent[] = [];
  const nativePrevented: boolean[] = [];
  el.addEventListener('lr-invalid', (event) => aliases.push(event as CustomEvent));
  // Registered after the alias relay's own constructor-installed `invalid` listener, so it reads
  // the native event exactly as the relay left it.
  el.addEventListener('invalid', (event) => nativePrevented.push(event.defaultPrevented));

  expect(el.checkValidity()).to.be.false;
  expect(aliases).to.have.lengthOf(1);
  expect(aliases[0]!.cancelable, 'lr-invalid is a real veto point').to.be.true;
  expect(nativePrevented).to.deep.equal([false]);

  el.addEventListener('lr-invalid', (event) => event.preventDefault(), {
    once: true,
  });
  expect(el.checkValidity()).to.be.false;
  expect(nativePrevented, 'preventDefault() on lr-invalid suppresses the native validation bubble').to.deep.equal([
    false,
    true,
  ]);
});

/**
 * Mounts `markup` the way a browser mounts a server-rendered page: the parser attaches the
 * declarative shadow root *before* the custom element upgrades, which is the one signal
 * `seedFirstRenderState()` uses to tell a hydrating mount from a browser-only one. Mirrors
 * `src/internal/ssr-hydration.test.ts`'s own helper (a test may not import
 * `@lit-labs/ssr-client`: that would change how every other element in the suite renders).
 */
async function mountServerRendered(markup: string): Promise<LyraVoicePicker> {
  const container = (await fixture(html`<div></div>`)) as HTMLDivElement & {
    setHTMLUnsafe(value: string): void;
  };
  container.setHTMLUnsafe(markup);
  return container.firstElementChild as LyraVoicePicker;
}

const SERVER_SHADOW = '<template shadowrootmode="open"></template>';

it('keeps authored hint/error progressively visible while hydration reconciles slot presence', async () => {
  const el = await mountServerRendered(
    `<lr-voice-picker>${SERVER_SHADOW}<span slot="hint">Pick a voice</span><span slot="error">Required</span></lr-voice-picker>`,
  );
  await el.updateComplete;

  // The server cannot inspect light DOM, so it progressively exposes named-slot wrappers. The
  // first browser pass must preserve that visibility instead of replacing the server subtree.
  const hint = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
  const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
  expect(hint.hidden).to.be.false;
  expect(error.hidden).to.be.false;

  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="hint"]') === hint).to.be.true;
  expect(el.shadowRoot!.querySelector('[part="error"]') === error).to.be.true;
  expect(hint.hidden).to.be.false;
  expect(error.hidden).to.be.false;
});

it('still seeds slotted hint/error state synchronously on an ordinary browser-only mount', async () => {
  const el = (await fixture(html`
    <lr-voice-picker>
      <span slot="hint">Pick a voice</span>
      <span slot="error">Nope</span>
    </lr-voice-picker>
  `)) as LyraVoicePicker;

  // No flash of the fallback: a browser-only mount answers the light-DOM question before its
  // first render, exactly as before.
  expect(el.shadowRoot!.querySelector('[part="hint"]')!.hasAttribute('hidden')).to.equal(false);
  expect(el.shadowRoot!.querySelector('[part="error"]')!.hasAttribute('hidden')).to.equal(false);
});

describe('explicitly empty host aria-label', () => {
  it('keeps the closed-mode trigger explicitly unnamed instead of substituting the generic fallback', async () => {
    const explicit = (await fixture(
      html`<lr-voice-picker aria-label="" .catalog=${CATALOG}></lr-voice-picker>`,
    )) as LyraVoicePicker;
    await explicit.updateComplete;
    const trigger = explicit.shadowRoot!.querySelector('[part="trigger"]')!;
    expect(trigger.hasAttribute('aria-label')).to.equal(true);
    expect(trigger.getAttribute('aria-label')).to.equal('');

    const omitted = (await fixture(
      html`<lr-voice-picker .catalog=${CATALOG}></lr-voice-picker>`,
    )) as LyraVoicePicker;
    await omitted.updateComplete;
    expect(omitted.shadowRoot!.querySelector('[part="trigger"]')!.getAttribute('aria-label')).to.equal('Voice');
  });

  it('keeps the free-text combobox input explicitly unnamed instead of substituting the generic fallback', async () => {
    const explicit = (await fixture(
      html`<lr-voice-picker allow-custom aria-label="" .catalog=${CATALOG}></lr-voice-picker>`,
    )) as LyraVoicePicker;
    await explicit.updateComplete;
    const input = explicit.shadowRoot!.querySelector('[part="combobox-input"]')!;
    expect(input.hasAttribute('aria-label')).to.equal(true);
    expect(input.getAttribute('aria-label')).to.equal('');

    const omitted = (await fixture(
      html`<lr-voice-picker allow-custom .catalog=${CATALOG}></lr-voice-picker>`,
    )) as LyraVoicePicker;
    await omitted.updateComplete;
    expect(omitted.shadowRoot!.querySelector('[part="combobox-input"]')!.getAttribute('aria-label')).to.equal(
      'Voice',
    );
  });
});

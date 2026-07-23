import { fixture, expect, oneEvent, html } from '@open-wc/testing';
import './voice-picker.js';
import type { LyraVoicePicker } from './voice-picker.js';
import { styles } from './voice-picker.styles.js';

const CATALOG = ['alloy', 'verse'];
const OBJECT_CATALOG = [
  { id: 'aria', label: 'Aria', language: 'en-US', description: 'Warm, narrative', previewUrl: 'https://example.test/aria.mp3' },
  { id: 'sage', label: 'Sage', language: 'en-GB' },
];

function trigger(el: LyraVoicePicker): HTMLButtonElement {
  return el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
}
function input(el: LyraVoicePicker): HTMLInputElement {
  return el.shadowRoot!.querySelector('[part="combobox-input"]') as HTMLInputElement;
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
  expect(trigger(el)).to.exist;
  expect(el.shadowRoot!.querySelector('[part="combobox-input"]')).to.be.null;
});

it('renders a free-text input when catalog is empty/undefined or allow-custom is set', async () => {
  const el = (await fixture(html`<lr-voice-picker></lr-voice-picker>`)) as LyraVoicePicker;
  expect(input(el)).to.exist;

  const el2 = (await fixture(
    html`<lr-voice-picker allow-custom .catalog=${CATALOG}></lr-voice-picker>`,
  )) as LyraVoicePicker;
  expect(input(el2)).to.exist;
});

it('renders object-catalog rows with a language/description second line', async () => {
  const el = (await fixture(
    html`<lr-voice-picker .catalog=${OBJECT_CATALOG}></lr-voice-picker>`,
  )) as LyraVoicePicker;
  el.open = true;
  await el.updateComplete;
  const meta = rows(el)[0].querySelector('[part="option-meta"]')!;
  expect(meta.textContent).to.equal('en-US · Warm, narrative');
});

it('a value not present in catalog renders as a synthetic stale row with the not-in-catalog badge', async () => {
  const el = (await fixture(
    html`<lr-voice-picker .catalog=${CATALOG} value="retired-voice"></lr-voice-picker>`,
  )) as LyraVoicePicker;
  el.open = true;
  await el.updateComplete;
  const stale = [...rows(el)].find((r) => r.dataset.value === 'retired-voice')!;
  expect(stale.querySelector('[part="option-badge"]')!.textContent).to.equal('not in catalog');
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

it('free-text filtering also matches language and description', async () => {
  const el = (await fixture(
    html`<lr-voice-picker allow-custom .catalog=${OBJECT_CATALOG}></lr-voice-picker>`,
  )) as LyraVoicePicker;
  const el2 = input(el);
  el2.focus();
  el2.value = 'narrative';
  el2.dispatchEvent(new Event('input', { bubbles: true }));
  await el.updateComplete;
  expect(rows(el).length).to.equal(1);
  expect(rows(el)[0].dataset.value).to.equal('aria');
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
  const el = (await fixture(html`<lr-voice-picker .catalog=${CATALOG} value="alloy"></lr-voice-picker>`)) as LyraVoicePicker;
  await el.updateComplete;
  const btn = previewButton(el);
  expect(getComputedStyle(btn).minInlineSize).to.equal('40px');
  expect(getComputedStyle(btn).minBlockSize).to.equal('40px');
});

it('clicking preview fires cancelable lr-preview-request with the resolved previewUrl', async () => {
  const el = (await fixture(
    html`<lr-voice-picker .catalog=${OBJECT_CATALOG} value="aria"></lr-voice-picker>`,
  )) as LyraVoicePicker;
  const reqPromise = oneEvent(el, 'lr-preview-request');
  previewButton(el).click();
  const ev = await reqPromise;
  expect(ev.detail).to.deep.equal({ voiceId: 'aria', previewUrl: 'https://example.test/aria.mp3' });
  expect(ev.cancelable).to.be.true;
});

it('an unprevented request with a previewUrl plays through an internal <audio>, firing lr-preview-change, and the same voice toggles it off', async () => {
  const restore = stubMediaPlay(() => Promise.resolve());
  try {
    const el = (await fixture(
      html`<lr-voice-picker .catalog=${OBJECT_CATALOG} value="aria"></lr-voice-picker>`,
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

it('preventDefault()ing lr-preview-request suppresses internal playback entirely', async () => {
  const el = (await fixture(
    html`<lr-voice-picker .catalog=${OBJECT_CATALOG} value="aria"></lr-voice-picker>`,
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
    html`<lr-voice-picker .catalog=${OBJECT_CATALOG} value="sage"></lr-voice-picker>`,
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
    html`<lr-voice-picker .catalog=${OBJECT_CATALOG} value="aria"></lr-voice-picker>`,
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
    html`<lr-voice-picker preview="false" .catalog=${OBJECT_CATALOG} value="aria"></lr-voice-picker>`,
  )) as LyraVoicePicker;
  expect(el.preview).to.be.false;
  expect(el.shadowRoot!.querySelectorAll('[part="preview-button"]').length).to.equal(0);
});

it('per-row option-preview icons are pointer-only (tabindex=-1, aria-hidden) and preview that specific row', async () => {
  const el = (await fixture(
    html`<lr-voice-picker .catalog=${OBJECT_CATALOG}></lr-voice-picker>`,
  )) as LyraVoicePicker;
  el.open = true;
  await el.updateComplete;
  const icon = rows(el)[0].querySelector('[part="option-preview"]') as HTMLElement;
  expect(icon.getAttribute('tabindex')).to.equal('-1');
  expect(icon.getAttribute('aria-hidden')).to.equal('true');

  const reqPromise = oneEvent(el, 'lr-preview-request');
  icon.click();
  const ev = await reqPromise;
  expect(ev.detail.voiceId).to.equal('aria');
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
  expect(input(el)).to.exist; // empty catalog falls back to free text, same as model-select

  const withCatalog = (await fixture(
    html`<lr-voice-picker allow-custom .catalog=${CATALOG}></lr-voice-picker>`,
  )) as LyraVoicePicker;
  const el2 = input(withCatalog);
  el2.focus();
  el2.value = 'zzz-no-match';
  el2.dispatchEvent(new Event('input', { bubbles: true }));
  await withCatalog.updateComplete;
  expect(withCatalog.shadowRoot!.querySelector('[part="empty"]')!.textContent).to.equal('No matches');
});

// -- Accessibility -------------------------------------------------------

it('is accessible in closed-dropdown mode with a selected value', async () => {
  const el = (await fixture(
    html`<lr-voice-picker .catalog=${OBJECT_CATALOG} value="aria" label="Voice"></lr-voice-picker>`,
  )) as LyraVoicePicker;
  await expect(el).to.be.accessible();
});

it('is accessible in free-text mode', async () => {
  const el = (await fixture(
    html`<lr-voice-picker allow-custom label="Voice"></lr-voice-picker>`,
  )) as LyraVoicePicker;
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
    (v) => v !== '',
  );
  expect(listbox(el).style.getPropertyValue('--lr-positioner-available-inline-size')).to.not.equal('');
});

// -- Attribute converters -------------------------------------------------

it('the spellcheck attribute converter parses the literal string "false" as false, matching the native attribute', async () => {
  const el = (await fixture(
    html`<lr-voice-picker spellcheck="false" .catalog=${CATALOG}></lr-voice-picker>`,
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
    <form><lr-voice-picker name="voice" required .catalog=${CATALOG}></lr-voice-picker></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-voice-picker') as LyraVoicePicker;
  expect(el.form).to.equal(form);
  // Assert labels.length (a number), never the NodeList itself: a *failing* chai assertion whose
  // `actual` is a DOM node/NodeList hangs the whole wtr session (wtr ships `err.actual` verbatim in
  // its session-finished message, which is serialized with structuredClone() -- DataCloneError on
  // any DOM value, so no result is ever reported and the run dies at testsFinishTimeout).
  expect(el.labels.length).to.equal(0); // no associated <label for> in this fixture
  expect(el.validity.valueMissing).to.be.true;
  expect(el.validationMessage.length).to.be.greaterThan(0);
  expect(el.willValidate).to.be.true;
});

// -- value/name property edge cases ----------------------------------------

it('the value setter falls back to an empty string for a nullish assignment', async () => {
  const el = (await fixture(html`<lr-voice-picker .catalog=${CATALOG}></lr-voice-picker>`)) as LyraVoicePicker;
  (el as unknown as { value: string | null }).value = null;
  expect(el.value).to.equal('');
});

it('the name setter falls back to empty string for a nullish assignment and clears the attribute when set back to empty', async () => {
  const el = (await fixture(
    html`<lr-voice-picker name="voice" .catalog=${CATALOG}></lr-voice-picker>`,
  )) as LyraVoicePicker;
  expect(el.getAttribute('name')).to.equal('voice'); // if(this._name) setAttribute branch, from markup
  el.name = '';
  expect(el.hasAttribute('name')).to.be.false; // else removeAttribute branch
  expect(el.name).to.equal('');
  (el as unknown as { name: string | null }).name = null;
  expect(el.name).to.equal('');
  expect(el.hasAttribute('name')).to.be.false;
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
  const el = (await fixture(
    html`<lr-voice-picker disabled .catalog=${CATALOG}></lr-voice-picker>`,
  )) as LyraVoicePicker;
  // A native `disabled` button suppresses the synthetic-click algorithm entirely (`.click()` is a
  // no-op), which would never actually reach `onTriggerClick`'s own effectiveDisabled guard --
  // dispatch the click event directly (as the shadow-DOM `@click` binding itself would receive it
  // from e.g. a stylus/AT-driven activation) to exercise that guard deterministically.
  trigger(el).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it("forwards host .click() to the trigger button in closed-dropdown mode, since HTMLElement.prototype.click() is otherwise a no-op on a custom element", async () => {
  const el = (await fixture(html`<lr-voice-picker .catalog=${CATALOG}></lr-voice-picker>`)) as LyraVoicePicker;
  expect(el.open).to.be.false;
  el.click();
  await el.updateComplete;
  expect(el.open).to.be.true;
});

it('forwards host .click() to the combobox input in free-text mode', async () => {
  const el = (await fixture(html`<lr-voice-picker allow-custom></lr-voice-picker>`)) as LyraVoicePicker;
  expect(el.open).to.be.false;
  el.click();
  await el.updateComplete;
  expect(el.open).to.be.true;
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
    <form><lr-voice-picker name="voice" value="alloy" .catalog=${CATALOG}></lr-voice-picker></form>
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
    <form><lr-voice-picker name="voice" required .catalog=${CATALOG}></lr-voice-picker></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-voice-picker') as LyraVoicePicker;
  expect(el.reportValidity()).to.be.false;
  el.value = 'alloy';
  expect(el.reportValidity()).to.be.true;
});

// -- Free-text Enter commit (commitFreeText) --------------------------------

it('commits a highlighted suggestion with Enter in free-text mode, emitting lr-change with inCatalog true', async () => {
  const el = (await fixture(
    html`<lr-voice-picker allow-custom .catalog=${CATALOG}></lr-voice-picker>`,
  )) as LyraVoicePicker;
  const inp = input(el);
  inp.focus();
  await el.updateComplete;
  inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await el.updateComplete;
  const changePromise = oneEvent(el, 'lr-change');
  inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  const ev = await changePromise;
  expect(ev.detail).to.deep.equal({ value: 'alloy', inCatalog: true });
});

it('commits raw typed text not in the catalog when allow-custom is set, with inCatalog false', async () => {
  const el = (await fixture(
    html`<lr-voice-picker allow-custom .catalog=${CATALOG}></lr-voice-picker>`,
  )) as LyraVoicePicker;
  const inp = input(el);
  inp.focus();
  inp.value = 'my-custom-voice';
  inp.dispatchEvent(new Event('input', { bubbles: true }));
  await el.updateComplete;
  const changePromise = oneEvent(el, 'lr-change');
  inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  const ev = await changePromise;
  expect(ev.detail).to.deep.equal({ value: 'my-custom-voice', inCatalog: false });
});

// -- previewCandidateId / labelFor edge cases --------------------------------

it("previewCandidateId (and the trigger's aria-activedescendant) tracks the highlighted row while navigating open", async () => {
  const el = (await fixture(
    html`<lr-voice-picker .catalog=${CATALOG} value="alloy"></lr-voice-picker>`,
  )) as LyraVoicePicker;
  const btn = trigger(el);
  btn.click();
  await el.updateComplete;
  btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(btn.getAttribute('aria-activedescendant')).to.not.equal('');
  expect(previewButton(el).getAttribute('aria-label')).to.equal('Preview alloy');

  btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(previewButton(el).getAttribute('aria-label')).to.equal('Preview verse');
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
  const icon = rows(el)[0].querySelector('[part="option-preview"]') as HTMLElement;
  icon.click();
  await el.updateComplete;
  expect(requested).to.be.false;
});

it('a previewUrl with a disallowed scheme is silently dropped by safeMediaSrc -- no internal playback', async () => {
  const catalog = [{ id: 'x', label: 'X', previewUrl: 'javascript:alert(1)' }];
  const el = (await fixture(
    html`<lr-voice-picker .catalog=${catalog} value="x"></lr-voice-picker>`,
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
  // Real playback against a fake domain can fail (and auto-release the resource) before a second,
  // synchronous click gets a chance to -- stub play() so it never settles, making the explicit-stop
  // path (audioEl still set) deterministic.
  const restore = stubMediaPlay(() => new Promise(() => {}));
  try {
    const el = (await fixture(
      html`<lr-voice-picker .catalog=${OBJECT_CATALOG} value="aria"></lr-voice-picker>`,
    )) as LyraVoicePicker;
    const startPromise = oneEvent(el, 'lr-preview-change');
    previewButton(el).click();
    await startPromise;
    expect(previewButton(el).getAttribute('aria-pressed')).to.equal('true');

    const stopPromise = oneEvent(el, 'lr-preview-change');
    previewButton(el).click(); // audioEl is still set (play() never settled) -- exercises the cleanup branch
    const stopEv = await stopPromise;
    expect(stopEv.detail).to.deep.equal({ voiceId: null });
    expect(previewButton(el).getAttribute('aria-pressed')).to.equal('false');
  } finally {
    restore();
  }
});

it('a play() rejection that resolves after the preview was already stopped is a no-op (does not resurrect state)', async () => {
  let rejectPlay!: (e: unknown) => void;
  const pending = new Promise<void>((_resolve, reject) => {
    rejectPlay = reject;
  });
  const restore = stubMediaPlay(() => pending);
  try {
    const el = (await fixture(
      html`<lr-voice-picker .catalog=${OBJECT_CATALOG} value="aria"></lr-voice-picker>`,
    )) as LyraVoicePicker;
    const startPromise = oneEvent(el, 'lr-preview-change');
    previewButton(el).click();
    await startPromise;

    const stopPromise = oneEvent(el, 'lr-preview-change');
    previewButton(el).click(); // explicit stop -- clears audioEl synchronously
    await stopPromise;

    // The stale play() promise now rejects, after the resource was already released by the
    // explicit stop above -- onAudioLoadFailure must see audioEl already undefined and no-op.
    let unexpectedChange = false;
    el.addEventListener('lr-preview-change', () => (unexpectedChange = true));
    rejectPlay(new Error('network unreachable'));
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(unexpectedChange, 'a stale rejection must not emit another preview-change').to.be.false;
    expect(previewButton(el).getAttribute('aria-pressed')).to.equal('false');
  } finally {
    restore();
  }
});

it("clicking the same row's preview icon again stops it (per-row toggle)", async () => {
  const restore = stubMediaPlay(() => Promise.resolve());
  try {
    const el = (await fixture(
      html`<lr-voice-picker .catalog=${OBJECT_CATALOG}></lr-voice-picker>`,
    )) as LyraVoicePicker;
    el.open = true;
    await el.updateComplete;
    const icon = rows(el)[0].querySelector('[part="option-preview"]') as HTMLElement;

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

it('the listbox click handler no-ops when effectiveDisabled (defensive; normally unreachable via the disabled trigger)', async () => {
  const el = (await fixture(html`<lr-voice-picker .catalog=${CATALOG}></lr-voice-picker>`)) as LyraVoicePicker;
  el.disabled = true; // el.open is false here, so the setter's own hide() call is a no-op
  el.open = true; // bypasses show()'s effectiveDisabled guard by setting the property directly
  await el.updateComplete;
  let changed = false;
  el.addEventListener('lr-change', () => (changed = true));
  (rows(el)[0] as HTMLElement).click();
  await el.updateComplete;
  expect(changed).to.be.false;
  expect(el.value).to.equal('');
});

it('the listbox click handler ignores clicks outside an option row (e.g. the empty-state message)', async () => {
  const el = (await fixture(
    html`<lr-voice-picker allow-custom .catalog=${CATALOG}></lr-voice-picker>`,
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
    html`<lr-voice-picker allow-custom .catalog=${CATALOG}></lr-voice-picker>`,
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
    html`<lr-voice-picker provider="elevenlabs" .catalog=${CATALOG}></lr-voice-picker>`,
  )) as LyraVoicePicker;
  expect(el.shadowRoot!.querySelector('[part="provider-badge"]')!.textContent).to.equal('elevenlabs');
});

it('renders the provider badge in free-text mode', async () => {
  const el = (await fixture(
    html`<lr-voice-picker provider="elevenlabs" allow-custom></lr-voice-picker>`,
  )) as LyraVoicePicker;
  expect(el.shadowRoot!.querySelector('[part="provider-badge"]')!.textContent).to.equal('elevenlabs');
});

// -- aria-describedby / aria-required / aria-invalid / autocomplete ---------

it('wires aria-describedby on the closed trigger to the rendered hint/error ids', async () => {
  const el = (await fixture(
    html`<lr-voice-picker hint="Pick a voice" error-text="Required" .catalog=${CATALOG}></lr-voice-picker>`,
  )) as LyraVoicePicker;
  const describedBy = trigger(el).getAttribute('aria-describedby') ?? '';
  expect(describedBy).to.contain('error');
  expect(describedBy).to.contain('hint');
});

it('wires aria-describedby on the free-text combobox input to the rendered hint/error ids', async () => {
  const el = (await fixture(
    html`<lr-voice-picker allow-custom hint="Pick a voice" error-text="Required"></lr-voice-picker>`,
  )) as LyraVoicePicker;
  const describedBy = input(el).getAttribute('aria-describedby') ?? '';
  expect(describedBy).to.contain('error');
  expect(describedBy).to.contain('hint');
});

it('marks the closed trigger aria-invalid once a required, empty picker is touched (blurred)', async () => {
  const el = (await fixture(
    html`<lr-voice-picker required .catalog=${CATALOG}></lr-voice-picker>`,
  )) as LyraVoicePicker;
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

it('omits the autocomplete attribute entirely when autocomplete is cleared', async () => {
  const el = (await fixture(
    html`<lr-voice-picker allow-custom autocomplete=""></lr-voice-picker>`,
  )) as LyraVoicePicker;
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

it("colors the combobox-input's placeholder text instead of leaving the UA default", () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/\[part='combobox-input'\]::placeholder\s*\{[^}]*color:\s*var\(--lr-color-text-quiet\)/);
});

// -- Hover feedback (mouse users get the same 'this is clickable' cue keyboard focus gives) ------

it('gives the trigger a hover state', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/\[part='trigger'\]:hover/);
});

it('gives the standalone preview-button a hover state', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/\[part='preview-button'\]:hover/);
});

// -- overflow-x pinned alongside the listbox's overflow-y (phantom-scrollbar guard) ---------------

it("pins overflow-x alongside overflow-y on the listbox so the horizontal axis never computes to an implicit 'auto'", async () => {
  const el = (await fixture(html`<lr-voice-picker .catalog=${CATALOG}></lr-voice-picker>`)) as LyraVoicePicker;
  trigger(el).click();
  await el.updateComplete;
  expect(getComputedStyle(listbox(el)).overflowX).to.not.equal('visible');
});

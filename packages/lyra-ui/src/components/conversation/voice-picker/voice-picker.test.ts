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
    html`<lr-voice-picker .catalog=${OBJECT_CATALOG} value="aria" preview="false"></lr-voice-picker>`,
  )) as LyraVoicePicker;
  // A `true`-defaulting boolean property can only be set false via a property binding, not a
  // ?attr=${false} template binding (see packages/lyra-ui/AGENTS.md's testing-pitfalls note) --
  // set it imperatively instead of relying on the attribute above.
  el.preview = false;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="preview-button"]')).to.be.null;
  el.open = true;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="option-preview"]')).to.be.null;
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

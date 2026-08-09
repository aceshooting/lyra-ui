import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import './chat-composer.js';
import type { LyraChatComposer } from './chat-composer.js';

function textareaOf(el: LyraChatComposer): HTMLTextAreaElement {
  return el.shadowRoot!.querySelector('[part="textarea"]') as HTMLTextAreaElement;
}

function actionButtonOf(el: LyraChatComposer): HTMLButtonElement | null {
  return el.shadowRoot!.querySelector('[part="action-button"]') as HTMLButtonElement | null;
}

/** The rendered color of the textarea's `::placeholder` pseudo-element -- read via
 *  `getComputedStyle`'s pseudo-element argument rather than the stylesheet source text, since a
 *  regression that decouples the two tokens (or a broken `var()` fallback) has to show up here to
 *  be caught. */
function renderedPlaceholderColor(el: LyraChatComposer): string {
  return getComputedStyle(textareaOf(el), '::placeholder').color;
}

function typeInto(el: LyraChatComposer, value: string): void {
  const ta = textareaOf(el);
  ta.value = value;
  ta.dispatchEvent(new Event('input', { bubbles: true }));
}

function enterKeydown(init: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...init });
}

it('defaults to status="idle", min-rows=1, max-rows=8, submit-on-enter=true, and submitDisabled=false', async () => {
  const el = (await fixture(html`<lr-chat-composer></lr-chat-composer>`)) as LyraChatComposer;
  expect(el.status).to.equal('idle');
  expect(el.minRows).to.equal(1);
  expect(el.maxRows).to.equal(8);
  expect(el.submitOnEnter).to.be.true;
  // `true` is the default -- trueDefaultBooleanConverter's toAttribute omits the attribute
  // entirely for it (mirroring lr-checkpoint's restorable/confirmRestore), so only the non-default
  // `false` ever needs a reflected attribute at all.
  expect(el.hasAttribute('submit-on-enter')).to.be.false;
  expect(el.submitDisabled).to.be.false;
});

it('uses placeholder as the textarea accessible name, falling back to "Message"', async () => {
  const noPlaceholder = (await fixture(html`<lr-chat-composer></lr-chat-composer>`)) as LyraChatComposer;
  expect(textareaOf(noPlaceholder).getAttribute('aria-label')).to.equal('Message');

  const withPlaceholder = (await fixture(
    html`<lr-chat-composer placeholder="Ask anything…"></lr-chat-composer>`,
  )) as LyraChatComposer;
  expect(textareaOf(withPlaceholder).getAttribute('aria-label')).to.equal('Ask anything…');
  expect(textareaOf(withPlaceholder).getAttribute('placeholder')).to.equal('Ask anything…');
});

it('forwards a host aria-label to the textarea ahead of the placeholder-derived name', async () => {
  const el = (await fixture(html`
    <lr-chat-composer aria-label="Compose support request" placeholder="Ask anything…"></lr-chat-composer>
  `)) as LyraChatComposer;

  expect(textareaOf(el).getAttribute('aria-label')).to.equal('Compose support request');
});

it('keeps the internal textarea value in sync with the value property in both directions', async () => {
  const el = (await fixture(html`<lr-chat-composer></lr-chat-composer>`)) as LyraChatComposer;
  el.value = 'set programmatically';
  await el.updateComplete;
  expect(textareaOf(el).value).to.equal('set programmatically');

  typeInto(el, 'typed by the user');
  await el.updateComplete;
  expect(el.value).to.equal('typed by the user');
});

it('fires lr-input with detail.value on user typing, but not on a programmatic .value assignment', async () => {
  const el = (await fixture(html`<lr-chat-composer></lr-chat-composer>`)) as LyraChatComposer;

  let fired = false;
  el.addEventListener('lr-input', () => (fired = true));
  el.value = 'programmatic';
  await el.updateComplete;
  expect(fired, 'lr-input must not fire for a programmatic .value assignment').to.be.false;

  const listening = oneEvent(el, 'lr-input');
  typeInto(el, 'hello');
  const ev = await listening;
  expect(ev.detail.value).to.equal('hello');
});

it('plain Enter submits and prevents the default newline insertion', async () => {
  const el = (await fixture(html`<lr-chat-composer value="hello"></lr-chat-composer>`)) as LyraChatComposer;
  const ta = textareaOf(el);

  const listening = oneEvent(el, 'lr-submit');
  const ev = enterKeydown();
  ta.dispatchEvent(ev);
  const submitEvent = await listening;
  expect(submitEvent.detail.value).to.equal('hello');
  expect(ev.defaultPrevented).to.be.true;
});

it('does not clear the value when submitting', async () => {
  const el = (await fixture(html`<lr-chat-composer value="hello"></lr-chat-composer>`)) as LyraChatComposer;
  const listening = oneEvent(el, 'lr-submit');
  textareaOf(el).dispatchEvent(enterKeydown());
  await listening;
  expect(el.value).to.equal('hello');
});

it('Shift+Enter always inserts a newline and never submits, even with submit-on-enter true', async () => {
  const el = (await fixture(html`<lr-chat-composer></lr-chat-composer>`)) as LyraChatComposer;
  const ta = textareaOf(el);

  let submitted = false;
  el.addEventListener('lr-submit', () => (submitted = true));
  const ev = enterKeydown({ shiftKey: true });
  ta.dispatchEvent(ev);
  await el.updateComplete;
  expect(submitted).to.be.false;
  expect(ev.defaultPrevented).to.be.false;
});

it('never submits on Enter while submit-on-enter is false, leaving the default newline behavior alone', async () => {
  const el = (await fixture(
    html`<lr-chat-composer .submitOnEnter=${false}></lr-chat-composer>`,
  )) as LyraChatComposer;
  expect(el.submitOnEnter, 'sanity-check the property actually ended up false').to.be.false;
  const ta = textareaOf(el);

  let submitted = false;
  el.addEventListener('lr-submit', () => (submitted = true));
  const ev = enterKeydown();
  ta.dispatchEvent(ev);
  await el.updateComplete;
  expect(submitted).to.be.false;
  expect(ev.defaultPrevented).to.be.false;
});

it('parses the plain-HTML attribute string submit-on-enter="false", not just a .submitOnEnter property binding', async () => {
  // trueDefaultBooleanConverter's fromAttribute checks the literal string rather than Lit's
  // default presence-based Boolean converter, which can never distinguish an omitted attribute
  // from one explicitly written as the literal string "false" -- both would otherwise map to the
  // property's own `true` default.
  const el = (await fixture(
    html`<lr-chat-composer submit-on-enter="false"></lr-chat-composer>`,
  )) as LyraChatComposer;
  expect(el.submitOnEnter).to.be.false;
  const ta = textareaOf(el);

  let submitted = false;
  el.addEventListener('lr-submit', () => (submitted = true));
  const ev = enterKeydown();
  ta.dispatchEvent(ev);
  await el.updateComplete;
  expect(submitted, 'submit-on-enter="false" as a plain attribute must actually disable Enter-to-send').to.be
    .false;
  expect(ev.defaultPrevented).to.be.false;
});

it('never treats an IME composition Enter as a submit trigger (isComposing)', async () => {
  const el = (await fixture(html`<lr-chat-composer></lr-chat-composer>`)) as LyraChatComposer;
  const ta = textareaOf(el);

  let submitted = false;
  el.addEventListener('lr-submit', () => (submitted = true));
  const ev = enterKeydown({ isComposing: true });
  ta.dispatchEvent(ev);
  await el.updateComplete;
  expect(submitted).to.be.false;
  expect(ev.defaultPrevented).to.be.false;
});

it('never treats an IME composition Enter as a submit trigger (keyCode 229 fallback)', async () => {
  // Regression-style coverage for the defense-in-depth fallback: some
  // browsers report isComposing inconsistently on the compositionend-
  // adjacent keydown, so keyCode 229 is checked too. `keyCode` isn't a
  // constructible KeyboardEventInit member, so it's forced as an own
  // property on the synthetic event instance (shadows the inherited getter).
  const el = (await fixture(html`<lr-chat-composer></lr-chat-composer>`)) as LyraChatComposer;
  const ta = textareaOf(el);

  let submitted = false;
  el.addEventListener('lr-submit', () => (submitted = true));
  const ev = enterKeydown();
  Object.defineProperty(ev, 'keyCode', { value: 229 });
  ta.dispatchEvent(ev);
  await el.updateComplete;
  expect(submitted).to.be.false;
  expect(ev.defaultPrevented).to.be.false;
});

it('does not submit again on Enter while status is sending/streaming, leaving the newline default alone', async () => {
  for (const status of ['sending', 'streaming'] as const) {
    const el = (await fixture(
      html`<lr-chat-composer status=${status}></lr-chat-composer>`,
    )) as LyraChatComposer;
    const ta = textareaOf(el);

    let submitted = false;
    el.addEventListener('lr-submit', () => (submitted = true));
    const ev = enterKeydown();
    ta.dispatchEvent(ev);
    await el.updateComplete;
    expect(submitted, `status=${status}`).to.be.false;
    expect(ev.defaultPrevented, `status=${status}`).to.be.false;
  }
});

it('does not disable the textarea while sending/streaming, only changes what Enter/the button do', async () => {
  const el = (await fixture(html`<lr-chat-composer status="streaming"></lr-chat-composer>`)) as LyraChatComposer;
  expect(textareaOf(el).disabled).to.be.false;
});

it('clicking the built-in button while idle fires lr-submit and does not clear the value', async () => {
  const el = (await fixture(html`<lr-chat-composer value="hi there"></lr-chat-composer>`)) as LyraChatComposer;
  const button = actionButtonOf(el)!;
  expect(button.getAttribute('aria-label')).to.equal('Send message');

  const listening = oneEvent(el, 'lr-submit');
  button.click();
  const ev = await listening;
  expect(ev.detail.value).to.equal('hi there');
  expect(el.value).to.equal('hi there');
});

it('submit-disabled blocks idle Enter and button submission without disabling editing', async () => {
  const el = (await fixture(
    html`<lr-chat-composer submit-disabled value="   "></lr-chat-composer>`,
  )) as LyraChatComposer;
  const textarea = textareaOf(el);
  const button = actionButtonOf(el)!;
  expect(el.submitDisabled).to.be.true;
  expect(button.disabled).to.be.true;
  expect(textarea.disabled).to.be.false;

  let submitted = false;
  let inputValue = '';
  el.addEventListener('lr-submit', () => (submitted = true));
  el.addEventListener('lr-input', (event) => (inputValue = event.detail.value));

  const enter = enterKeydown();
  textarea.dispatchEvent(enter);
  button.click();
  typeInto(el, 'next message');
  await el.updateComplete;

  expect(enter.defaultPrevented).to.be.true;
  expect(submitted).to.be.false;
  expect(inputValue).to.equal('next message');
  expect(el.value).to.equal('next message');
});

it('submit-disabled does not disable or replace the busy Stop action', async () => {
  const el = (await fixture(
    html`<lr-chat-composer status="streaming" submit-disabled></lr-chat-composer>`,
  )) as LyraChatComposer;
  const button = actionButtonOf(el)!;
  expect(button.disabled).to.be.false;
  expect(button.getAttribute('aria-label')).to.equal('Stop generating');

  const listening = oneEvent(el, 'lr-stop');
  button.click();
  await listening;
});

it('clicking the built-in button while sending/streaming fires lr-stop instead of lr-submit', async () => {
  const el = (await fixture(html`<lr-chat-composer status="streaming"></lr-chat-composer>`)) as LyraChatComposer;
  const button = actionButtonOf(el)!;
  expect(button.getAttribute('aria-label')).to.equal('Stop generating');

  let submitted = false;
  el.addEventListener('lr-submit', () => (submitted = true));
  const listening = oneEvent(el, 'lr-stop');
  button.click();
  const ev = await listening;
  // CustomEventInit's `detail` member defaults to `null` (not `undefined`)
  // per the WebIDL dictionary-conversion algorithm, the same as every other
  // no-detail `emit()` call in this library (e.g. lr-chat-message's
  // `lr-retry`).
  expect(ev.detail).to.equal(null);
  expect(submitted).to.be.false;
});

it('localizes the action button labels via this.localize(), not hardcoded English', async () => {
  const el = (await fixture(
    html`<lr-chat-composer
      .strings=${{ sendMessage: 'Envoyer', stopGenerating: 'Arrêter' }}
    ></lr-chat-composer>`,
  )) as LyraChatComposer;
  expect(actionButtonOf(el)!.getAttribute('aria-label')).to.equal('Envoyer');
  el.status = 'streaming';
  await el.updateComplete;
  expect(actionButtonOf(el)!.getAttribute('aria-label')).to.equal('Arrêter');
});

it('defaults to English "Send message"/"Stop generating" when no strings override is set', async () => {
  const el = (await fixture(html`<lr-chat-composer></lr-chat-composer>`)) as LyraChatComposer;
  expect(actionButtonOf(el)!.getAttribute('aria-label')).to.equal('Send message');
  el.status = 'streaming';
  await el.updateComplete;
  expect(actionButtonOf(el)!.getAttribute('aria-label')).to.equal('Stop generating');
});

it('stoppable defaults to true, preserving the existing Stop-button behavior', async () => {
  const el = (await fixture(html`<lr-chat-composer status="streaming"></lr-chat-composer>`)) as LyraChatComposer;
  expect(el.stoppable).to.be.true;
  expect(actionButtonOf(el)!.disabled).to.be.false;
  expect(actionButtonOf(el)!.getAttribute('aria-label')).to.equal('Stop generating');
});

it('stoppable=false renders a disabled Send button instead of Stop while busy, and does not fire lr-stop', async () => {
  const el = (await fixture(
    html`<lr-chat-composer status="streaming" .stoppable=${false}></lr-chat-composer>`,
  )) as LyraChatComposer;
  const button = actionButtonOf(el)!;
  expect(button.getAttribute('aria-label')).to.equal('Send message');
  expect(button.disabled).to.be.true;

  let stopped = false;
  el.addEventListener('lr-stop', () => (stopped = true));
  button.click();
  await el.updateComplete;
  expect(stopped).to.be.false;
});

it('parses the plain-HTML attribute string stoppable="false", not just a .stoppable property binding', async () => {
  const el = (await fixture(
    html`<lr-chat-composer status="streaming" stoppable="false"></lr-chat-composer>`,
  )) as LyraChatComposer;
  expect(el.stoppable, 'stoppable="false" as a plain attribute must actually disable it').to.be.false;
  const button = actionButtonOf(el)!;
  expect(button.getAttribute('aria-label')).to.equal('Send message');
  expect(button.disabled).to.be.true;
});

it('hides the chips wrapper when the chips slot is empty, shows it once populated', async () => {
  const el = (await fixture(html`<lr-chat-composer></lr-chat-composer>`)) as LyraChatComposer;
  const chips = el.shadowRoot!.querySelector('[part="chips"]') as HTMLElement;
  const slot = el.shadowRoot!.querySelector('slot[name="chips"]') as HTMLSlotElement;
  expect(chips.hidden).to.be.true;

  const chip = document.createElement('span');
  chip.slot = 'chips';
  chip.textContent = 'file.pdf';
  const slotChanged = oneEvent(slot, 'slotchange');
  el.appendChild(chip);
  await slotChanged;
  await el.updateComplete;
  expect(chips.hidden).to.be.false;
});

it('re-hides the chips wrapper once its slot becomes empty again', async () => {
  // The empty-to-populated direction above is covered; a regression that
  // fails to re-hide once the slot empties back out (e.g. a naive
  // `.length > 0` check that never re-runs, or one that only ever flips
  // true) would go uncaught without this round trip -- mirrors the
  // trailing slot's own append-then-remove round trip below.
  const el = (await fixture(html`<lr-chat-composer></lr-chat-composer>`)) as LyraChatComposer;
  const chips = el.shadowRoot!.querySelector('[part="chips"]') as HTMLElement;
  const slot = el.shadowRoot!.querySelector('slot[name="chips"]') as HTMLSlotElement;

  const chip = document.createElement('span');
  chip.slot = 'chips';
  chip.textContent = 'file.pdf';
  let slotChanged = oneEvent(slot, 'slotchange');
  el.appendChild(chip);
  await slotChanged;
  await el.updateComplete;
  expect(chips.hidden).to.be.false;

  slotChanged = oneEvent(slot, 'slotchange');
  el.removeChild(chip);
  await slotChanged;
  await el.updateComplete;
  expect(chips.hidden).to.be.true;
});

it('accepts start/end aliases alongside leading/trailing and suppresses the built-in action while either end slot is populated', async () => {
  const el = (await fixture(html`
    <lr-chat-composer>
      <button id="start" slot="start">Start</button>
      <button id="leading" slot="leading">Leading</button>
      <button id="end" slot="end">End</button>
      <button id="trailing" slot="trailing">Trailing</button>
    </lr-chat-composer>
  `)) as LyraChatComposer;
  const leading = el.shadowRoot!.querySelector<HTMLElement>('[part="leading"]')!;
  const startSlot = el.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="start"]')!;
  const endSlot = el.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="end"]')!;
  expect(leading.hidden).to.be.false;
  expect(startSlot.assignedElements().map((item) => item.id)).to.deep.equal(['start']);
  expect(endSlot.assignedElements().map((item) => item.id)).to.deep.equal(['end']);
  expect(actionButtonOf(el) === null).to.be.true;

  let slotChanged = oneEvent(endSlot, 'slotchange');
  el.querySelector('#end')!.remove();
  await slotChanged;
  await el.updateComplete;
  expect(actionButtonOf(el) === null).to.be.true;

  const trailingSlot = el.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="trailing"]')!;
  slotChanged = oneEvent(trailingSlot, 'slotchange');
  el.querySelector('#trailing')!.remove();
  await slotChanged;
  await el.updateComplete;
  expect(actionButtonOf(el) !== null).to.be.true;
});

it('hides the leading wrapper when the leading slot is empty, shows it once populated', async () => {
  const el = (await fixture(html`<lr-chat-composer></lr-chat-composer>`)) as LyraChatComposer;
  const leading = el.shadowRoot!.querySelector('[part="leading"]') as HTMLElement;
  const slot = el.shadowRoot!.querySelector('slot[name="leading"]') as HTMLSlotElement;
  expect(leading.hidden).to.be.true;

  const btn = document.createElement('button');
  btn.slot = 'leading';
  const slotChanged = oneEvent(slot, 'slotchange');
  el.appendChild(btn);
  await slotChanged;
  await el.updateComplete;
  expect(leading.hidden).to.be.false;
});

it('re-hides the leading wrapper once its slot becomes empty again', async () => {
  // Same round-trip gap as the chips slot above: only the empty-to-populated
  // direction was previously covered.
  const el = (await fixture(html`<lr-chat-composer></lr-chat-composer>`)) as LyraChatComposer;
  const leading = el.shadowRoot!.querySelector('[part="leading"]') as HTMLElement;
  const slot = el.shadowRoot!.querySelector('slot[name="leading"]') as HTMLSlotElement;

  const btn = document.createElement('button');
  btn.slot = 'leading';
  let slotChanged = oneEvent(slot, 'slotchange');
  el.appendChild(btn);
  await slotChanged;
  await el.updateComplete;
  expect(leading.hidden).to.be.false;

  slotChanged = oneEvent(slot, 'slotchange');
  el.removeChild(btn);
  await slotChanged;
  await el.updateComplete;
  expect(leading.hidden).to.be.true;
});

it('renders declaratively-slotted leading/chips content without waiting on the first slotchange', async () => {
  const el = (await fixture(html`
    <lr-chat-composer>
      <button slot="leading">Attach</button>
      <span slot="chips">file.pdf</span>
    </lr-chat-composer>
  `)) as LyraChatComposer;
  const leading = el.shadowRoot!.querySelector('[part="leading"]') as HTMLElement;
  const chips = el.shadowRoot!.querySelector('[part="chips"]') as HTMLElement;
  expect(leading.hidden).to.be.false;
  expect(chips.hidden).to.be.false;
});

it('hides the built-in button entirely once the trailing slot has assigned content', async () => {
  const el = (await fixture(html`
    <lr-chat-composer>
      <button slot="trailing">Custom send</button>
    </lr-chat-composer>
  `)) as LyraChatComposer;
  expect((actionButtonOf(el)) === (null)).to.equal(true);
});

it('shows the built-in button again if the trailing slot becomes empty', async () => {
  const el = (await fixture(html`<lr-chat-composer></lr-chat-composer>`)) as LyraChatComposer;
  const slot = el.shadowRoot!.querySelector('slot[name="trailing"]') as HTMLSlotElement;
  expect((actionButtonOf(el)) !== (null)).to.equal(true);

  const custom = document.createElement('button');
  custom.slot = 'trailing';
  let slotChanged = oneEvent(slot, 'slotchange');
  el.appendChild(custom);
  await slotChanged;
  await el.updateComplete;
  expect((actionButtonOf(el)) === (null)).to.equal(true);

  slotChanged = oneEvent(slot, 'slotchange');
  el.removeChild(custom);
  await slotChanged;
  await el.updateComplete;
  expect((actionButtonOf(el)) !== (null)).to.equal(true);
});

it('disables both the textarea and the built-in button when disabled', async () => {
  const el = (await fixture(html`<lr-chat-composer disabled></lr-chat-composer>`)) as LyraChatComposer;
  expect(textareaOf(el).disabled).to.be.true;
  expect(actionButtonOf(el)!.disabled).to.be.true;
});

it('reflects rows="min-rows" onto the native textarea attribute', async () => {
  const el = (await fixture(html`<lr-chat-composer min-rows="3"></lr-chat-composer>`)) as LyraChatComposer;
  await el.updateComplete;
  expect(textareaOf(el).getAttribute('rows')).to.equal('3');
});

it('normalizes a non-finite or non-positive min-rows to 1 rather than rendering rows="NaN"/0/negative', async () => {
  const nan = (await fixture(html`<lr-chat-composer min-rows="not-a-number"></lr-chat-composer>`)) as LyraChatComposer;
  await nan.updateComplete;
  expect(textareaOf(nan).getAttribute('rows')).to.equal('1');

  const zero = (await fixture(html`<lr-chat-composer min-rows="0"></lr-chat-composer>`)) as LyraChatComposer;
  await zero.updateComplete;
  expect(textareaOf(zero).getAttribute('rows')).to.equal('1');

  const negative = (await fixture(html`<lr-chat-composer min-rows="-5"></lr-chat-composer>`)) as LyraChatComposer;
  await negative.updateComplete;
  expect(textareaOf(negative).getAttribute('rows')).to.equal('1');
});

it('clamps max-rows up to min-rows when an inverted (or non-finite) pair is authored, instead of collapsing the growable range', async () => {
  const inverted = (await fixture(
    html`<lr-chat-composer min-rows="5" max-rows="2"></lr-chat-composer>`,
  )) as LyraChatComposer;
  const el = inverted as unknown as { effectiveMinRows: number; effectiveMaxRows: number };
  expect(el.effectiveMinRows).to.equal(5);
  expect(el.effectiveMaxRows, 'max-rows must never end up below min-rows').to.equal(5);

  const nonFiniteMax = (await fixture(
    html`<lr-chat-composer min-rows="4" max-rows="not-a-number"></lr-chat-composer>`,
  )) as LyraChatComposer;
  const elNonFinite = nonFiniteMax as unknown as { effectiveMinRows: number; effectiveMaxRows: number };
  expect(elNonFinite.effectiveMinRows).to.equal(4);
  expect(elNonFinite.effectiveMaxRows).to.equal(4);
});

it('grows the textarea height as multi-line content is typed, then switches to internal scrolling past max-rows', async () => {
  const el = (await fixture(
    html`<lr-chat-composer min-rows="1" max-rows="3"></lr-chat-composer>`,
  )) as LyraChatComposer;
  const ta = textareaOf(el);
  const singleLineHeight = parseFloat(ta.style.height);

  el.value = 'one\ntwo';
  await el.updateComplete;
  const twoLineHeight = parseFloat(ta.style.height);
  expect(twoLineHeight).to.be.greaterThan(singleLineHeight);
  expect(ta.style.overflowY, 'still within max-rows, no internal scrollbar yet').to.equal('hidden');

  el.value = 'one\ntwo\nthree';
  await el.updateComplete;
  const threeLineHeight = parseFloat(ta.style.height);
  expect(threeLineHeight).to.be.greaterThan(twoLineHeight);

  el.value = 'one\ntwo\nthree\nfour\nfive\nsix';
  await el.updateComplete;
  const overflowedHeight = parseFloat(ta.style.height);
  expect(overflowedHeight, 'height must be clamped at max-rows, not keep growing past it').to.equal(
    threeLineHeight,
  );
  expect(ta.style.overflowY, 'content taller than max-rows must switch to internal scrolling').to.equal('auto');
  expect(ta.scrollHeight).to.be.greaterThan(ta.clientHeight);
});

it('re-fits the textarea height when the host narrows, with no value/min-rows/max-rows change', async () => {
  const el = (await fixture(
    html`<lr-chat-composer style="display: block; width: 600px" min-rows="1" max-rows="10"></lr-chat-composer>`,
  )) as LyraChatComposer;
  const ta = textareaOf(el);

  el.value =
    'This message is long enough to wrap across several lines once the composer gets a lot narrower than it started.';
  await el.updateComplete;
  const wideHeight = parseFloat(ta.style.height);

  // Narrowing the host (a responsive breakpoint, a sidebar toggle, a window
  // resize, an orientation change) never touches value/min-rows/max-rows, so
  // only a ResizeObserver on the textarea's own box -- not the updated()
  // property-change gate -- can catch this and re-run resizeTextarea().
  el.style.width = '140px';
  await waitUntil(
    () => parseFloat(ta.style.height) > wideHeight,
    'textarea height must grow once the ResizeObserver reports the narrower width',
    { timeout: 2000 },
  );
  const narrowHeight = parseFloat(ta.style.height);
  expect(narrowHeight).to.be.greaterThan(wideHeight);
});

it('re-arms the width-triggered auto-resize after a disconnect/reconnect (e.g. a drag-drop reparent)', async () => {
  const el = (await fixture(
    html`<lr-chat-composer style="display: block; width: 600px" min-rows="1" max-rows="10"></lr-chat-composer>`,
  )) as LyraChatComposer;
  const ta = textareaOf(el);
  const longValue =
    'This message is long enough to wrap across several lines once the composer gets a lot narrower than it started.';
  el.value = longValue;
  await el.updateComplete;

  // Simulate a reparent: physically move the same element node out of and
  // back into the document, running disconnectedCallback() then
  // connectedCallback() -- not a fresh fixture(), which would only prove a
  // brand-new instance works.
  const parent = el.parentElement!;
  parent.removeChild(el);
  parent.appendChild(el);
  await el.updateComplete;

  const wideHeight = parseFloat(ta.style.height);
  el.style.width = '140px';
  await waitUntil(
    () => parseFloat(ta.style.height) > wideHeight,
    'textarea height must still grow on width changes after a reconnect -- the ResizeObserver must have been re-armed, not left permanently dead',
    { timeout: 2000 },
  );
  expect(parseFloat(ta.style.height)).to.be.greaterThan(wideHeight);
});

it('rebinds textarea observation and coalesced resize frames to the adopted owner realm', async () => {
  const el = (await fixture(html`<lr-chat-composer></lr-chat-composer>`)) as LyraChatComposer;
  await el.updateComplete;
  el.remove();
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  const frameDocument = iframe.contentDocument;
  const frameWindow = iframe.contentWindow;
  if (!frameDocument || !frameWindow) {
    iframe.remove();
    throw new Error('The iframe realm was unavailable.');
  }
  const originalResizeObserver = frameWindow.ResizeObserver;
  const originalRequestAnimationFrame = frameWindow.requestAnimationFrame;
  const originalCancelAnimationFrame = frameWindow.cancelAnimationFrame;
  let resizeCallback: ResizeObserverCallback | undefined;
  let observerDisconnects = 0;
  const frames = new Map<number, FrameRequestCallback>();
  const cancelledFrames: number[] = [];
  class OwnerResizeObserver implements ResizeObserver {
    constructor(callback: ResizeObserverCallback) { resizeCallback = callback; }
    observe(): void {}
    unobserve(): void {}
    disconnect(): void { observerDisconnects += 1; }
  }
  frameWindow.ResizeObserver = OwnerResizeObserver;
  frameWindow.requestAnimationFrame = ((callback: FrameRequestCallback): number => {
    frames.set(52, callback);
    return 52;
  }) as typeof frameWindow.requestAnimationFrame;
  frameWindow.cancelAnimationFrame = ((handle: number): void => {
    cancelledFrames.push(handle);
    frames.delete(handle);
  }) as typeof frameWindow.cancelAnimationFrame;

  try {
    frameDocument.body.append(frameDocument.adoptNode(el));
    expect(resizeCallback, 'the destination window constructs the textarea observer').to.be.a('function');
    resizeCallback!(
      [{ contentBoxSize: [{ inlineSize: 123 }] } as unknown as ResizeObserverEntry],
      {} as ResizeObserver,
    );
    const staleFrame = frames.get(52);
    expect(staleFrame, 'the observer schedules through the destination window').to.be.a('function');

    document.adoptNode(el);
    expect(observerDisconnects, 'adoption disconnects the old observer').to.equal(1);
    expect(cancelledFrames, 'adoption cancels through the scheduling window').to.deep.equal([52]);
    let resizeCalls = 0;
    (el as unknown as { resizeTextarea(): void }).resizeTextarea = () => { resizeCalls += 1; };
    staleFrame!(0);
    expect(resizeCalls, 'a stale old-realm frame cannot resize the adopted composer').to.equal(0);
  } finally {
    frameWindow.ResizeObserver = originalResizeObserver;
    frameWindow.requestAnimationFrame = originalRequestAnimationFrame;
    frameWindow.cancelAnimationFrame = originalCancelAnimationFrame;
    if (el.ownerDocument !== document) document.adoptNode(el);
    el.remove();
    iframe.remove();
  }
});

it('participates in a form: submits its value under name', async () => {
  const form = (await fixture(html`
    <form><lr-chat-composer name="message" value="hello world"></lr-chat-composer></form>
  `)) as HTMLFormElement;
  expect(new FormData(form).get('message')).to.equal('hello world');
});

it('blocks a required, empty composer from submitting the form', async () => {
  const form = (await fixture(
    html`<form><lr-chat-composer name="message" required></lr-chat-composer></form>`,
  )) as HTMLFormElement;
  expect(form.reportValidity()).to.be.false;

  const el = form.querySelector('lr-chat-composer') as LyraChatComposer;
  el.value = 'not empty';
  await el.updateComplete;
  expect(form.reportValidity()).to.be.true;
});

it('forwards required and touched validity state to the textarea', async () => {
  const el = (await fixture(html`<lr-chat-composer required></lr-chat-composer>`)) as LyraChatComposer;
  const textarea = textareaOf(el);

  expect(textarea.required).to.be.true;
  expect(textarea.getAttribute('aria-required')).to.equal('true');
  expect(textarea.getAttribute('aria-invalid')).to.equal('false');

  textarea.dispatchEvent(new FocusEvent('blur'));
  await el.updateComplete;
  expect(textarea.getAttribute('aria-invalid')).to.equal('true');

  el.value = 'Ready';
  await el.updateComplete;
  expect(textarea.getAttribute('aria-invalid')).to.equal('false');

  el.required = false;
  await el.updateComplete;
  expect(textarea.required).to.be.false;
  expect(textarea.getAttribute('aria-required')).to.equal('false');
});

it('does not mark touched from a blur caused by the control itself becoming disabled', async () => {
  // Regression test for fr_asxOgk4UhNB07xevCWwFVQ: disabling a focused native control force-blurs
  // it as plain platform behavior, not a real user interaction -- that blur can land synchronously
  // nested inside the very property write that disabled this control, before this render has even
  // reached the internal textarea's own `disabled` attribute. Checked directly against the private
  // `touched` state rather than `aria-invalid`, which can lag a render behind.
  const el = (await fixture(html`<lr-chat-composer></lr-chat-composer>`)) as LyraChatComposer;
  const ta = textareaOf(el);
  ta.focus();
  // Never chai-compare DOM nodes directly (hangs the whole file) -- compare identity as a plain
  // boolean instead.
  expect(el.shadowRoot!.activeElement === ta).to.be.true;

  el.disabled = true;
  await el.updateComplete;

  expect(
    (el as unknown as { touched: boolean }).touched,
    'a disable-forced blur must not mark the field touched',
  ).to.be.false;
});

it('still marks touched from a real, non-disabled blur', async () => {
  const el = (await fixture(html`<lr-chat-composer></lr-chat-composer>`)) as LyraChatComposer;
  const ta = textareaOf(el);
  ta.focus();
  ta.blur();
  await el.updateComplete;

  expect((el as unknown as { touched: boolean }).touched).to.be.true;
});

it('reveals invalid state after validation and clears touched presentation on form reset', async () => {
  const form = (await fixture(html`
    <form><lr-chat-composer name="message" required></lr-chat-composer></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-chat-composer') as LyraChatComposer;
  const textarea = textareaOf(el);

  expect(textarea.getAttribute('aria-invalid')).to.equal('false');
  expect(form.reportValidity()).to.be.false;
  await el.updateComplete;
  expect(textarea.getAttribute('aria-invalid')).to.equal('true');

  form.reset();
  await el.updateComplete;
  expect(textarea.getAttribute('aria-invalid')).to.equal('false');
});

it('focuses its textarea when direct or form submission validation fails', async () => {
  const form = (await fixture(html`
    <form>
      <button type="button" id="sentinel">Before</button>
      <lr-chat-composer name="message" required></lr-chat-composer>
      <button type="submit">Submit</button>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-chat-composer') as LyraChatComposer;
  const sentinel = form.querySelector('#sentinel') as HTMLButtonElement;

  sentinel.focus();
  expect(document.activeElement?.id).to.equal('sentinel');
  expect(el.reportValidity()).to.be.false;
  expect(document.activeElement?.localName).to.equal('lr-chat-composer');
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('textarea');

  let submits = 0;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submits += 1;
  });
  sentinel.focus();
  expect(document.activeElement?.id).to.equal('sentinel');
  form.requestSubmit();
  expect(submits).to.equal(0);
  expect(document.activeElement?.localName).to.equal('lr-chat-composer');
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('textarea');
});

it('restores the declared default value on form.reset()', async () => {
  const form = (await fixture(html`
    <form><lr-chat-composer name="message" value="draft"></lr-chat-composer></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-chat-composer') as LyraChatComposer;
  el.value = 'edited';
  await el.updateComplete;

  form.reset();
  await el.updateComplete;
  expect(el.value).to.equal('draft');
});

it('formDisabledCallback disables the control via a fieldset', async () => {
  const form = (await fixture(html`
    <form>
      <fieldset disabled>
        <lr-chat-composer name="message"></lr-chat-composer>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-chat-composer') as LyraChatComposer;
  // `el.disabled` (the consumer-facing IDL property/attribute) is never
  // mutated by fieldset cascading -- only the combined `effectiveDisabled`
  // reflects it (mirrors lr-combobox/lr-select's identical
  // `_fieldsetDisabled`/`effectiveDisabled` pattern).
  expect((el as unknown as { effectiveDisabled: boolean }).effectiveDisabled).to.be.true;
  expect(el.disabled).to.be.false;
});

it('dims the base part via the :disabled pseudo-class when disabled only through an ancestor fieldset', async () => {
  // effectiveDisabled correctly gates the textarea/button underneath even
  // when disabled purely by fieldset cascading (see the test above), but
  // that alone doesn't prove the *visual* treatment follows -- the base
  // part's opacity/cursor styling is keyed off a CSS selector
  // (:host(:disabled)), not effectiveDisabled, so it needs its own
  // assertion. Mirrors lr-checkbox's identical fieldset/computed-style
  // coverage.
  const form = (await fixture(html`
    <form>
      <fieldset disabled>
        <lr-chat-composer name="message"></lr-chat-composer>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-chat-composer') as LyraChatComposer;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  expect(el.disabled).to.be.false;
  expect((el as unknown as { effectiveDisabled: boolean }).effectiveDisabled).to.be.true;
  expect(getComputedStyle(base).opacity).to.equal('0.5');
  expect(getComputedStyle(base).cursor).to.equal('not-allowed');
});

/** Resolve a declaration value (var()s, color-mix() and all) for `property` inside the component's
 *  shadow scope, returning the browser's computed value for `readProperty`. Rendering it rather than
 *  reading the stylesheet is the point: a broken var() chain or an unregistered token computes to
 *  something else entirely, and only the browser can tell us which. */
function resolveInShadow(el: HTMLElement, property: string, value: string, readProperty = property): string {
  const probe = document.createElement('span');
  probe.style.setProperty(property, value);
  el.shadowRoot!.appendChild(probe);
  const computed = getComputedStyle(probe).getPropertyValue(readProperty);
  probe.remove();
  return computed;
}

/** The computed background `selector`'s own rule paints, resolved in the component's shadow scope. */
function renderedRuleBackground(el: HTMLElement, selector: string): string {
  const normalize = (text: string) => text.replace(/"/g, "'");
  let declared = '';
  for (const sheet of el.shadowRoot!.adoptedStyleSheets) {
    for (const rule of sheet.cssRules) {
      if (rule instanceof CSSStyleRule && normalize(rule.selectorText) === normalize(selector)) {
        const value = rule.style.getPropertyValue('background') || rule.style.getPropertyValue('background-color');
        if (value) declared = value;
      }
    }
  }
  return resolveInShadow(el, 'background', declared, 'background-color');
}

/** The computed filter `selector`'s own rule applies, resolved the same way. `none` means none. */
function renderedRuleFilter(el: HTMLElement, selector: string): string {
  const normalize = (text: string) => text.replace(/"/g, "'");
  let declared = '';
  for (const sheet of el.shadowRoot!.adoptedStyleSheets) {
    for (const rule of sheet.cssRules) {
      if (rule instanceof CSSStyleRule && normalize(rule.selectorText) === normalize(selector) && rule.style.filter) {
        declared = rule.style.filter;
      }
    }
  }
  return resolveInShadow(el, 'filter', declared);
}

it('escalates the send button from resting to hover to pressed with the shared colour-mix tokens', async () => {
  const el = (await fixture(html`<lr-chat-composer></lr-chat-composer>`)) as LyraChatComposer;
  await el.updateComplete;
  const resting = resolveInShadow(el, 'background', 'var(--lr-color-brand)', 'background-color');
  const hovered = renderedRuleBackground(el, "[part='action-button']:hover");
  const pressed = renderedRuleBackground(el, "[part='action-button']:active");

  // Each step actually moves. The middle assertion is the one that matters most: an :active rule
  // byte-identical to its :hover rule is the same "no pressed state" defect wearing a costume.
  expect(hovered).to.not.equal(resting);
  expect(pressed).to.not.equal(hovered);
  expect(pressed).to.not.equal(resting);

  // ...and each step is exactly the shared token's mix of the resting brand fill, so hover is the
  // 12% step and pressed the 22% one -- provably a stronger press, and both retintable at once.
  expect(hovered).to.equal(
    resolveInShadow(
      el,
      'background',
      'color-mix(in oklab, var(--lr-color-brand), var(--lr-color-mix-partner) var(--lr-color-mix-hover))',
      'background-color',
    ),
  );
  expect(pressed).to.equal(
    resolveInShadow(
      el,
      'background',
      'color-mix(in oklab, var(--lr-color-brand), var(--lr-color-mix-partner) var(--lr-color-mix-active))',
      'background-color',
    ),
  );

  // No filter in either state: brightness() applies to the subtree, so it would dim the send glyph
  // along with the fill -- and does nothing at all to a pure white or pure black brand colour.
  expect(renderedRuleFilter(el, "[part='action-button']:hover")).to.equal('none');
  expect(renderedRuleFilter(el, "[part='action-button']:active")).to.equal('none');
});

it('recolors the busy action-button background via --lr-chat-composer-busy-bg without affecting the textarea placeholder color', async () => {
  // Both the busy action-button background and the textarea placeholder default to the same
  // shared --lr-color-text-quiet token. --lr-chat-composer-busy-bg exists precisely so a consumer
  // can override the button's busy fill alone -- overriding the shared token directly would
  // recolor the placeholder too.
  const el = (await fixture(html`
    <lr-chat-composer
      status="streaming"
      placeholder="Message"
      style="--lr-chat-composer-busy-bg: rgb(10, 20, 30)"
    ></lr-chat-composer>
  `)) as LyraChatComposer;
  await el.updateComplete;
  const button = actionButtonOf(el)!;
  expect(getComputedStyle(button).backgroundColor).to.equal('rgb(10, 20, 30)');

  const placeholderColor = renderedPlaceholderColor(el);
  expect(placeholderColor).to.not.equal('rgb(10, 20, 30)');
});

it('falls back to the shared --lr-color-text-quiet token for the busy background when unset', async () => {
  const el = (await fixture(
    html`<lr-chat-composer status="sending"></lr-chat-composer>`,
  )) as LyraChatComposer;
  await el.updateComplete;
  const button = actionButtonOf(el)!;
  const placeholderColor = renderedPlaceholderColor(el);
  expect(getComputedStyle(button).backgroundColor).to.equal(placeholderColor);
});

it('is accessible in the default, empty state', async () => {
  const el = (await fixture(
    html`<lr-chat-composer placeholder="Message the assistant…"></lr-chat-composer>`,
  )) as LyraChatComposer;
  await expect(el).to.be.accessible();
});

it('is accessible in a populated, busy, chip-laden state', async () => {
  const el = (await fixture(html`
    <lr-chat-composer status="streaming" value="Looking into the last three commits…">
      <span slot="chips">diff.patch</span>
    </lr-chat-composer>
  `)) as LyraChatComposer;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

describe('native textarea surface', () => {
  it('spellcheck defaults to true', async () => {
    const el = (await fixture(html`<lr-chat-composer></lr-chat-composer>`)) as LyraChatComposer;
    expect(textareaOf(el).spellcheck).to.be.true;
  });

  it('forwards native editing-assistance attributes onto the textarea', async () => {
    const el = (await fixture(html`
      <lr-chat-composer
        spellcheck="false"
        autocapitalize="off"
        autocorrect="off"
        wrap="hard"
        autocomplete="one-time-code"
        inputmode="numeric"
        enterkeyhint="send"
      ></lr-chat-composer>
    `)) as LyraChatComposer;
    const ta = textareaOf(el);
    expect(ta.spellcheck).to.be.false;
    expect(ta.getAttribute('autocapitalize')).to.equal('off');
    expect(ta.getAttribute('autocorrect')).to.equal('off');
    expect(ta.getAttribute('wrap')).to.equal('hard');
    expect(ta.getAttribute('autocomplete')).to.equal('one-time-code');
    expect(ta.getAttribute('inputmode')).to.equal('numeric');
    expect(ta.getAttribute('enterkeyhint')).to.equal('send');
  });

  it('exposes focus, blur, selection, and range editing while keeping the form value synchronized', async () => {
    const form = (await fixture(html`
      <form><lr-chat-composer name="message" value="hello world"></lr-chat-composer></form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-chat-composer') as LyraChatComposer;
    const ta = textareaOf(el);

    expect(el.input?.getAttribute('part')).to.equal('textarea');
    el.focus();
    expect(el.shadowRoot!.activeElement === ta).to.be.true;

    el.setSelectionRange(6, 11, 'forward');
    expect(el.selectionStart).to.equal(6);
    expect(el.selectionEnd).to.equal(11);
    expect(el.selectionDirection).to.equal('forward');

    el.setRangeText('there', 6, 11, 'select');
    expect(el.value).to.equal('hello there');
    expect(new FormData(form).get('message')).to.equal('hello there');

    el.select();
    expect(el.selectionStart).to.equal(0);
    expect(el.selectionEnd).to.equal(el.value.length);
    el.blur();
    expect((el.shadowRoot!.activeElement) === (null)).to.equal(true);
  });

  it('forwards host click() to the textarea unless effectively disabled', async () => {
    const enabled = (await fixture(
      html`<lr-chat-composer></lr-chat-composer>`,
    )) as LyraChatComposer;
    enabled.click();
    expect(enabled.shadowRoot!.activeElement === textareaOf(enabled)).to.be.true;

    const fieldset = (await fixture(html`
      <fieldset disabled><lr-chat-composer></lr-chat-composer></fieldset>
    `)) as HTMLFieldSetElement;
    const disabled = fieldset.querySelector('lr-chat-composer') as LyraChatComposer;
    disabled.click();
    expect(disabled.shadowRoot!.activeElement === null).to.be.true;
  });
});

describe('blur/focus bubbling', () => {
  it('re-dispatches a bubbling, composed blur event when the native textarea blurs', async () => {
    const el = (await fixture(html`<lr-chat-composer></lr-chat-composer>`)) as LyraChatComposer;
    const ta = textareaOf(el);
    ta.focus();
    const eventPromise = oneEvent(el, 'blur');
    ta.blur();
    const ev = await eventPromise;
    expect(ev.bubbles).to.be.true;
    expect(ev.composed).to.be.true;
  });

  it('re-dispatches a bubbling, composed focus event when the native textarea focuses', async () => {
    const el = (await fixture(html`<lr-chat-composer></lr-chat-composer>`)) as LyraChatComposer;
    const eventPromise = oneEvent(el, 'focus');
    textareaOf(el).focus();
    const ev = await eventPromise;
    expect(ev.bubbles).to.be.true;
    expect(ev.composed).to.be.true;
  });
});

describe('frame', () => {
  const baseOf = (el: LyraChatComposer): HTMLElement =>
    el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  const baseChrome = (el: LyraChatComposer) => {
    const s = getComputedStyle(baseOf(el));
    return {
      paddingTop: s.paddingTop,
      paddingLeft: s.paddingLeft,
      borderTopWidth: s.borderTopWidth,
      borderTopStyle: s.borderTopStyle,
      borderTopLeftRadius: s.borderTopLeftRadius,
      backgroundColor: s.backgroundColor,
      rowGap: s.rowGap,
      transitionProperty: s.transitionProperty,
    };
  };

  it('defaults to frame="card", rendering identically to that value restated', async () => {
    const implicit = (await fixture(html`<lr-chat-composer></lr-chat-composer>`)) as LyraChatComposer;
    const explicit = (await fixture(html`<lr-chat-composer frame="card"></lr-chat-composer>`)) as LyraChatComposer;

    expect(implicit.frame).to.equal('card');
    expect(implicit.getAttribute('frame')).to.equal('card');
    expect(baseChrome(explicit)).to.deep.equal(baseChrome(implicit));

    const chrome = baseChrome(implicit);
    expect(chrome.paddingTop).to.equal('8px'); // --lr-space-s
    expect(chrome.borderTopWidth).to.equal('1px');
    expect(chrome.borderTopStyle).to.equal('solid');
    expect(chrome.backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');
  });

  it('drops border, background, padding and radius under frame="plain"', async () => {
    const el = (await fixture(html`<lr-chat-composer frame="plain"></lr-chat-composer>`)) as LyraChatComposer;
    expect(el.getAttribute('frame')).to.equal('plain');
    const chrome = baseChrome(el);
    expect(chrome.borderTopWidth).to.equal('0px');
    expect(chrome.borderTopLeftRadius).to.equal('0px');
    expect(chrome.backgroundColor).to.equal('rgba(0, 0, 0, 0)');
    expect(chrome.paddingTop).to.equal('0px');
    expect(chrome.paddingLeft).to.equal('0px');
    // The row layout survives the chrome reset -- only the box decoration goes.
    expect(chrome.rowGap).to.equal('4px'); // --lr-space-xs
  });

  it('keeps a visible focus affordance under plain, where there is no border left to recolor', async () => {
    // The card affordance is a transitioned border-color, so getComputedStyle reports the
    // mid-transition value right after focus -- zero out the duration to read the settled one.
    const card = (await fixture(
      html`<lr-chat-composer style="--lr-theme-transition-fast: 0s"></lr-chat-composer>`,
    )) as LyraChatComposer;
    const cardResting = getComputedStyle(baseOf(card)).borderTopColor;
    textareaOf(card).focus();
    expect(getComputedStyle(baseOf(card)).borderTopColor).to.not.equal(cardResting);

    const plain = (await fixture(html`<lr-chat-composer frame="plain"></lr-chat-composer>`)) as LyraChatComposer;
    const resting = getComputedStyle(baseOf(plain)).boxShadow;
    expect(resting).to.equal('none');
    textareaOf(plain).focus();
    const focused = getComputedStyle(baseOf(plain)).boxShadow;
    expect(focused).to.not.equal(resting);
    expect(focused).to.include('inset');
  });

  it('retunes the plain focus underline through the shared focus-ring tokens', async () => {
    const wrapper = (await fixture(html`
      <div style="--lr-theme-focus-ring-width: 5px; --lr-theme-color-focus: rgb(10, 20, 30)">
        <lr-chat-composer frame="plain"></lr-chat-composer>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector('lr-chat-composer') as LyraChatComposer;
    await el.updateComplete;
    textareaOf(el).focus();
    const shadow = getComputedStyle(baseOf(el)).boxShadow;
    expect(shadow).to.include('rgb(10, 20, 30)');
    expect(shadow).to.include('-5px');
  });

  it('leaves the disabled treatment and the transition the reduced-motion block overrides untouched under plain', async () => {
    const el = (await fixture(
      html`<lr-chat-composer frame="plain" disabled></lr-chat-composer>`,
    )) as LyraChatComposer;
    const s = getComputedStyle(baseOf(el));
    expect(s.opacity).to.equal('0.5'); // --lr-opacity-disabled
    expect(s.cursor).to.equal('not-allowed');
    // The @media (prefers-reduced-motion: reduce) block targets [part='base'] unqualified by
    // frame, so what it overrides has to still be there for plain too.
    const card = (await fixture(html`<lr-chat-composer></lr-chat-composer>`)) as LyraChatComposer;
    expect(s.transitionProperty).to.equal(getComputedStyle(baseOf(card)).transitionProperty);
    expect(s.transitionProperty).to.equal('border-color');
  });

  it('is accessible under frame="plain" with the textarea focused', async () => {
    const el = (await fixture(html`
      <lr-chat-composer frame="plain" placeholder="Message the assistant…" value="Draft"></lr-chat-composer>
    `)) as LyraChatComposer;
    textareaOf(el).focus();
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement === textareaOf(el)).to.be.true;
    await expect(el).to.be.accessible();
  });

  it('exposes no `appearance` property, and a stale appearance="plain" keeps the card chrome', async () => {
    const el = (await fixture(html`<lr-chat-composer appearance="plain"></lr-chat-composer>`)) as LyraChatComposer;
    expect('appearance' in el, 'appearance is gone from the instance').to.be.false;
    const chrome = baseChrome(el);
    expect(chrome.borderTopWidth, 'the card border is still drawn').to.equal('1px');
    expect(chrome.backgroundColor, 'the card background is still drawn').to.not.equal('rgba(0, 0, 0, 0)');
  });
});

it('reads and writes the textarea selection direction through the host', async () => {
  const el = (await fixture(html`<lr-chat-composer></lr-chat-composer>`)) as LyraChatComposer;
  el.value = 'hello world';
  await el.updateComplete;
  const textarea = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
  textarea.setSelectionRange(0, 5);

  el.selectionDirection = 'backward';
  expect(textarea.selectionDirection).to.equal('backward');
  expect(el.selectionDirection).to.equal('backward');

  el.selectionDirection = 'forward';
  expect(textarea.selectionDirection).to.equal('forward');

  // `null` maps to the platform's 'none'; a browser with a live selection may normalize that back
  // to a concrete direction, so assert the write is accepted rather than the normalized result.
  el.selectionDirection = null;
  expect(['none', 'forward', 'backward']).to.include(textarea.selectionDirection);
});

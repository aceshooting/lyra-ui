import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import './chat-composer.js';
import type { LyraChatComposer } from './chat-composer.js';

function textareaOf(el: LyraChatComposer): HTMLTextAreaElement {
  return el.shadowRoot!.querySelector('[part="textarea"]') as HTMLTextAreaElement;
}

function actionButtonOf(el: LyraChatComposer): HTMLButtonElement | null {
  return el.shadowRoot!.querySelector('[part="action-button"]') as HTMLButtonElement | null;
}

function typeInto(el: LyraChatComposer, value: string): void {
  const ta = textareaOf(el);
  ta.value = value;
  ta.dispatchEvent(new Event('input', { bubbles: true }));
}

function enterKeydown(init: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...init });
}

it('defaults to status="idle", min-rows=1, max-rows=8, submit-on-enter=true', async () => {
  const el = (await fixture(html`<lyra-chat-composer></lyra-chat-composer>`)) as LyraChatComposer;
  expect(el.status).to.equal('idle');
  expect(el.minRows).to.equal(1);
  expect(el.maxRows).to.equal(8);
  expect(el.submitOnEnter).to.be.true;
  expect(el.hasAttribute('submit-on-enter')).to.be.true;
});

it('uses placeholder as the textarea accessible name, falling back to "Message"', async () => {
  const noPlaceholder = (await fixture(html`<lyra-chat-composer></lyra-chat-composer>`)) as LyraChatComposer;
  expect(textareaOf(noPlaceholder).getAttribute('aria-label')).to.equal('Message');

  const withPlaceholder = (await fixture(
    html`<lyra-chat-composer placeholder="Ask anything…"></lyra-chat-composer>`,
  )) as LyraChatComposer;
  expect(textareaOf(withPlaceholder).getAttribute('aria-label')).to.equal('Ask anything…');
  expect(textareaOf(withPlaceholder).getAttribute('placeholder')).to.equal('Ask anything…');
});

it('forwards a host aria-label to the textarea ahead of the placeholder-derived name', async () => {
  const el = (await fixture(html`
    <lyra-chat-composer aria-label="Compose support request" placeholder="Ask anything…"></lyra-chat-composer>
  `)) as LyraChatComposer;

  expect(textareaOf(el).getAttribute('aria-label')).to.equal('Compose support request');
});

it('keeps the internal textarea value in sync with the value property in both directions', async () => {
  const el = (await fixture(html`<lyra-chat-composer></lyra-chat-composer>`)) as LyraChatComposer;
  el.value = 'set programmatically';
  await el.updateComplete;
  expect(textareaOf(el).value).to.equal('set programmatically');

  typeInto(el, 'typed by the user');
  await el.updateComplete;
  expect(el.value).to.equal('typed by the user');
});

it('fires lyra-input with detail.value on user typing, but not on a programmatic .value assignment', async () => {
  const el = (await fixture(html`<lyra-chat-composer></lyra-chat-composer>`)) as LyraChatComposer;

  let fired = false;
  el.addEventListener('lyra-input', () => (fired = true));
  el.value = 'programmatic';
  await el.updateComplete;
  expect(fired, 'lyra-input must not fire for a programmatic .value assignment').to.be.false;

  const listening = oneEvent(el, 'lyra-input');
  typeInto(el, 'hello');
  const ev = await listening;
  expect(ev.detail.value).to.equal('hello');
});

it('plain Enter submits and prevents the default newline insertion', async () => {
  const el = (await fixture(html`<lyra-chat-composer value="hello"></lyra-chat-composer>`)) as LyraChatComposer;
  const ta = textareaOf(el);

  const listening = oneEvent(el, 'lyra-submit');
  const ev = enterKeydown();
  ta.dispatchEvent(ev);
  const submitEvent = await listening;
  expect(submitEvent.detail.value).to.equal('hello');
  expect(ev.defaultPrevented).to.be.true;
});

it('does not clear the value when submitting', async () => {
  const el = (await fixture(html`<lyra-chat-composer value="hello"></lyra-chat-composer>`)) as LyraChatComposer;
  const listening = oneEvent(el, 'lyra-submit');
  textareaOf(el).dispatchEvent(enterKeydown());
  await listening;
  expect(el.value).to.equal('hello');
});

it('Shift+Enter always inserts a newline and never submits, even with submit-on-enter true', async () => {
  const el = (await fixture(html`<lyra-chat-composer></lyra-chat-composer>`)) as LyraChatComposer;
  const ta = textareaOf(el);

  let submitted = false;
  el.addEventListener('lyra-submit', () => (submitted = true));
  const ev = enterKeydown({ shiftKey: true });
  ta.dispatchEvent(ev);
  await el.updateComplete;
  expect(submitted).to.be.false;
  expect(ev.defaultPrevented).to.be.false;
});

it('never submits on Enter while submit-on-enter is false, leaving the default newline behavior alone', async () => {
  // The property defaults to true and reflects, so there is no *string*
  // attribute value that means "false" (matching native boolean-attribute
  // semantics -- presence alone is what matters, e.g. `disabled="false"` is
  // still disabled). A `?submit-on-enter=${false}` binding just omits the
  // attribute, which leaves the property at its true default. Setting the
  // property directly is the correct way to get `false` from a template.
  const el = (await fixture(
    html`<lyra-chat-composer .submitOnEnter=${false}></lyra-chat-composer>`,
  )) as LyraChatComposer;
  expect(el.submitOnEnter, 'sanity-check the property actually ended up false').to.be.false;
  const ta = textareaOf(el);

  let submitted = false;
  el.addEventListener('lyra-submit', () => (submitted = true));
  const ev = enterKeydown();
  ta.dispatchEvent(ev);
  await el.updateComplete;
  expect(submitted).to.be.false;
  expect(ev.defaultPrevented).to.be.false;
});

it('never treats an IME composition Enter as a submit trigger (isComposing)', async () => {
  const el = (await fixture(html`<lyra-chat-composer></lyra-chat-composer>`)) as LyraChatComposer;
  const ta = textareaOf(el);

  let submitted = false;
  el.addEventListener('lyra-submit', () => (submitted = true));
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
  const el = (await fixture(html`<lyra-chat-composer></lyra-chat-composer>`)) as LyraChatComposer;
  const ta = textareaOf(el);

  let submitted = false;
  el.addEventListener('lyra-submit', () => (submitted = true));
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
      html`<lyra-chat-composer status=${status}></lyra-chat-composer>`,
    )) as LyraChatComposer;
    const ta = textareaOf(el);

    let submitted = false;
    el.addEventListener('lyra-submit', () => (submitted = true));
    const ev = enterKeydown();
    ta.dispatchEvent(ev);
    await el.updateComplete;
    expect(submitted, `status=${status}`).to.be.false;
    expect(ev.defaultPrevented, `status=${status}`).to.be.false;
  }
});

it('does not disable the textarea while sending/streaming, only changes what Enter/the button do', async () => {
  const el = (await fixture(html`<lyra-chat-composer status="streaming"></lyra-chat-composer>`)) as LyraChatComposer;
  expect(textareaOf(el).disabled).to.be.false;
});

it('clicking the built-in button while idle fires lyra-submit and does not clear the value', async () => {
  const el = (await fixture(html`<lyra-chat-composer value="hi there"></lyra-chat-composer>`)) as LyraChatComposer;
  const button = actionButtonOf(el)!;
  expect(button.getAttribute('aria-label')).to.equal('Send message');

  const listening = oneEvent(el, 'lyra-submit');
  button.click();
  const ev = await listening;
  expect(ev.detail.value).to.equal('hi there');
  expect(el.value).to.equal('hi there');
});

it('clicking the built-in button while sending/streaming fires lyra-stop instead of lyra-submit', async () => {
  const el = (await fixture(html`<lyra-chat-composer status="streaming"></lyra-chat-composer>`)) as LyraChatComposer;
  const button = actionButtonOf(el)!;
  expect(button.getAttribute('aria-label')).to.equal('Stop generating');

  let submitted = false;
  el.addEventListener('lyra-submit', () => (submitted = true));
  const listening = oneEvent(el, 'lyra-stop');
  button.click();
  const ev = await listening;
  // CustomEventInit's `detail` member defaults to `null` (not `undefined`)
  // per the WebIDL dictionary-conversion algorithm, the same as every other
  // no-detail `emit()` call in this library (e.g. lyra-chat-message's
  // `lyra-retry`).
  expect(ev.detail).to.equal(null);
  expect(submitted).to.be.false;
});

it('localizes the action button labels via this.localize(), not hardcoded English', async () => {
  const el = (await fixture(
    html`<lyra-chat-composer
      .strings=${{ sendMessage: 'Envoyer', stopGenerating: 'Arrêter' }}
    ></lyra-chat-composer>`,
  )) as LyraChatComposer;
  expect(actionButtonOf(el)!.getAttribute('aria-label')).to.equal('Envoyer');
  el.status = 'streaming';
  await el.updateComplete;
  expect(actionButtonOf(el)!.getAttribute('aria-label')).to.equal('Arrêter');
});

it('defaults to English "Send message"/"Stop generating" when no strings override is set', async () => {
  const el = (await fixture(html`<lyra-chat-composer></lyra-chat-composer>`)) as LyraChatComposer;
  expect(actionButtonOf(el)!.getAttribute('aria-label')).to.equal('Send message');
  el.status = 'streaming';
  await el.updateComplete;
  expect(actionButtonOf(el)!.getAttribute('aria-label')).to.equal('Stop generating');
});

it('stoppable defaults to true, preserving the existing Stop-button behavior', async () => {
  const el = (await fixture(html`<lyra-chat-composer status="streaming"></lyra-chat-composer>`)) as LyraChatComposer;
  expect(el.stoppable).to.be.true;
  expect(actionButtonOf(el)!.disabled).to.be.false;
  expect(actionButtonOf(el)!.getAttribute('aria-label')).to.equal('Stop generating');
});

it('stoppable=false renders a disabled Send button instead of Stop while busy, and does not fire lyra-stop', async () => {
  const el = (await fixture(
    html`<lyra-chat-composer status="streaming" .stoppable=${false}></lyra-chat-composer>`,
  )) as LyraChatComposer;
  const button = actionButtonOf(el)!;
  expect(button.getAttribute('aria-label')).to.equal('Send message');
  expect(button.disabled).to.be.true;

  let stopped = false;
  el.addEventListener('lyra-stop', () => (stopped = true));
  button.click();
  await el.updateComplete;
  expect(stopped).to.be.false;
});

it('hides the chips wrapper when the chips slot is empty, shows it once populated', async () => {
  const el = (await fixture(html`<lyra-chat-composer></lyra-chat-composer>`)) as LyraChatComposer;
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
  const el = (await fixture(html`<lyra-chat-composer></lyra-chat-composer>`)) as LyraChatComposer;
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

it('hides the leading wrapper when the leading slot is empty, shows it once populated', async () => {
  const el = (await fixture(html`<lyra-chat-composer></lyra-chat-composer>`)) as LyraChatComposer;
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
  const el = (await fixture(html`<lyra-chat-composer></lyra-chat-composer>`)) as LyraChatComposer;
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
    <lyra-chat-composer>
      <button slot="leading">Attach</button>
      <span slot="chips">file.pdf</span>
    </lyra-chat-composer>
  `)) as LyraChatComposer;
  const leading = el.shadowRoot!.querySelector('[part="leading"]') as HTMLElement;
  const chips = el.shadowRoot!.querySelector('[part="chips"]') as HTMLElement;
  expect(leading.hidden).to.be.false;
  expect(chips.hidden).to.be.false;
});

it('hides the built-in button entirely once the trailing slot has assigned content', async () => {
  const el = (await fixture(html`
    <lyra-chat-composer>
      <button slot="trailing">Custom send</button>
    </lyra-chat-composer>
  `)) as LyraChatComposer;
  expect(actionButtonOf(el)).to.equal(null);
});

it('shows the built-in button again if the trailing slot becomes empty', async () => {
  const el = (await fixture(html`<lyra-chat-composer></lyra-chat-composer>`)) as LyraChatComposer;
  const slot = el.shadowRoot!.querySelector('slot[name="trailing"]') as HTMLSlotElement;
  expect(actionButtonOf(el)).to.not.equal(null);

  const custom = document.createElement('button');
  custom.slot = 'trailing';
  let slotChanged = oneEvent(slot, 'slotchange');
  el.appendChild(custom);
  await slotChanged;
  await el.updateComplete;
  expect(actionButtonOf(el)).to.equal(null);

  slotChanged = oneEvent(slot, 'slotchange');
  el.removeChild(custom);
  await slotChanged;
  await el.updateComplete;
  expect(actionButtonOf(el)).to.not.equal(null);
});

it('disables both the textarea and the built-in button when disabled', async () => {
  const el = (await fixture(html`<lyra-chat-composer disabled></lyra-chat-composer>`)) as LyraChatComposer;
  expect(textareaOf(el).disabled).to.be.true;
  expect(actionButtonOf(el)!.disabled).to.be.true;
});

it('reflects rows="min-rows" onto the native textarea attribute', async () => {
  const el = (await fixture(html`<lyra-chat-composer min-rows="3"></lyra-chat-composer>`)) as LyraChatComposer;
  await el.updateComplete;
  expect(textareaOf(el).getAttribute('rows')).to.equal('3');
});

it('grows the textarea height as multi-line content is typed, then switches to internal scrolling past max-rows', async () => {
  const el = (await fixture(
    html`<lyra-chat-composer min-rows="1" max-rows="3"></lyra-chat-composer>`,
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
    html`<lyra-chat-composer style="display: block; width: 600px" min-rows="1" max-rows="10"></lyra-chat-composer>`,
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
    html`<lyra-chat-composer style="display: block; width: 600px" min-rows="1" max-rows="10"></lyra-chat-composer>`,
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

it('participates in a form: submits its value under name', async () => {
  const form = (await fixture(html`
    <form><lyra-chat-composer name="message" value="hello world"></lyra-chat-composer></form>
  `)) as HTMLFormElement;
  expect(new FormData(form).get('message')).to.equal('hello world');
});

it('blocks a required, empty composer from submitting the form', async () => {
  const form = (await fixture(
    html`<form><lyra-chat-composer name="message" required></lyra-chat-composer></form>`,
  )) as HTMLFormElement;
  expect(form.reportValidity()).to.be.false;

  const el = form.querySelector('lyra-chat-composer') as LyraChatComposer;
  el.value = 'not empty';
  await el.updateComplete;
  expect(form.reportValidity()).to.be.true;
});

it('forwards required and touched validity state to the textarea', async () => {
  const el = (await fixture(html`<lyra-chat-composer required></lyra-chat-composer>`)) as LyraChatComposer;
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

it('reveals invalid state after validation and clears touched presentation on form reset', async () => {
  const form = (await fixture(html`
    <form><lyra-chat-composer name="message" required></lyra-chat-composer></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-chat-composer') as LyraChatComposer;
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
      <lyra-chat-composer name="message" required></lyra-chat-composer>
      <button type="submit">Submit</button>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-chat-composer') as LyraChatComposer;
  const sentinel = form.querySelector('#sentinel') as HTMLButtonElement;

  sentinel.focus();
  expect(document.activeElement?.id).to.equal('sentinel');
  expect(el.reportValidity()).to.be.false;
  expect(document.activeElement?.localName).to.equal('lyra-chat-composer');
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
  expect(document.activeElement?.localName).to.equal('lyra-chat-composer');
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('textarea');
});

it('restores the declared default value on form.reset()', async () => {
  const form = (await fixture(html`
    <form><lyra-chat-composer name="message" value="draft"></lyra-chat-composer></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-chat-composer') as LyraChatComposer;
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
        <lyra-chat-composer name="message"></lyra-chat-composer>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-chat-composer') as LyraChatComposer;
  // `el.disabled` (the consumer-facing IDL property/attribute) is never
  // mutated by fieldset cascading -- only the combined `effectiveDisabled`
  // reflects it (mirrors lyra-combobox/lyra-select's identical
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
  // assertion. Mirrors lyra-checkbox's identical fieldset/computed-style
  // coverage.
  const form = (await fixture(html`
    <form>
      <fieldset disabled>
        <lyra-chat-composer name="message"></lyra-chat-composer>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-chat-composer') as LyraChatComposer;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  expect(el.disabled).to.be.false;
  expect((el as unknown as { effectiveDisabled: boolean }).effectiveDisabled).to.be.true;
  expect(getComputedStyle(base).opacity).to.equal('0.5');
  expect(getComputedStyle(base).cursor).to.equal('not-allowed');
});

it('is accessible in the default, empty state', async () => {
  const el = (await fixture(
    html`<lyra-chat-composer placeholder="Message the assistant…"></lyra-chat-composer>`,
  )) as LyraChatComposer;
  await expect(el).to.be.accessible();
});

it('is accessible in a populated, busy, chip-laden state', async () => {
  const el = (await fixture(html`
    <lyra-chat-composer status="streaming" value="Looking into the last three commits…">
      <span slot="chips">diff.patch</span>
    </lyra-chat-composer>
  `)) as LyraChatComposer;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

describe('native textarea surface', () => {
  it('spellcheck defaults to true', async () => {
    const el = (await fixture(html`<lyra-chat-composer></lyra-chat-composer>`)) as LyraChatComposer;
    expect(textareaOf(el).spellcheck).to.be.true;
  });

  it('forwards native editing-assistance attributes onto the textarea', async () => {
    const el = (await fixture(html`
      <lyra-chat-composer
        spellcheck="false"
        autocapitalize="off"
        autocorrect="off"
        wrap="hard"
        autocomplete="one-time-code"
        inputmode="numeric"
        enterkeyhint="send"
      ></lyra-chat-composer>
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
      <form><lyra-chat-composer name="message" value="hello world"></lyra-chat-composer></form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lyra-chat-composer') as LyraChatComposer;
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
    expect(el.shadowRoot!.activeElement).to.equal(null);
  });
});

describe('blur/focus bubbling', () => {
  it('re-dispatches a bubbling, composed blur event when the native textarea blurs', async () => {
    const el = (await fixture(html`<lyra-chat-composer></lyra-chat-composer>`)) as LyraChatComposer;
    const ta = textareaOf(el);
    ta.focus();
    const eventPromise = oneEvent(el, 'blur');
    ta.blur();
    const ev = await eventPromise;
    expect(ev.bubbles).to.be.true;
    expect(ev.composed).to.be.true;
  });

  it('re-dispatches a bubbling, composed focus event when the native textarea focuses', async () => {
    const el = (await fixture(html`<lyra-chat-composer></lyra-chat-composer>`)) as LyraChatComposer;
    const eventPromise = oneEvent(el, 'focus');
    textareaOf(el).focus();
    const ev = await eventPromise;
    expect(ev.bubbles).to.be.true;
    expect(ev.composed).to.be.true;
  });
});

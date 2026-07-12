import { fixture, expect, html, oneEvent } from '@open-wc/testing';
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

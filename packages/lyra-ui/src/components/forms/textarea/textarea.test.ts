import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import type { PropertyValues } from 'lit';
import './textarea.js';
import type { LyraTextarea } from './textarea.js';
import { styles } from './textarea.styles.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';
import { LyraElement } from '../../../internal/lyra-element.js';

it('emits one cancelable lr-invalid alias when a validity check fails', async () => {
  const el = await fixture<LyraTextarea>(html`<lr-textarea required aria-label="Notes"></lr-textarea>`);
  const aliases: CustomEvent[] = [];
  el.addEventListener('lr-invalid', (event) => aliases.push(event as CustomEvent));

  expect(el.checkValidity()).to.be.false;
  expect(aliases).to.have.lengthOf(1);
  expect(aliases[0].target).to.equal(el);
  expect(aliases[0].bubbles && aliases[0].composed).to.be.true;
  expect(aliases[0].cancelable).to.be.true;
});

it('forwards preventDefault() on lr-invalid to the native invalid event', async () => {
  // Cancelling the alias has to cancel the event it aliases, or an app that wires `lr-invalid` to
  // its own error banner has no way to suppress the browser's validation bubble alongside it. The
  // host's alias listener is installed in the constructor, so it runs before this recorder and its
  // preventDefault() is already visible here.
  const el = await fixture<LyraTextarea>(html`<lr-textarea required aria-label="Notes"></lr-textarea>`);
  el.addEventListener('lr-invalid', (event) => event.preventDefault());
  const natives: Event[] = [];
  el.addEventListener('invalid', (event) => natives.push(event));

  expect(el.checkValidity()).to.be.false;
  expect(natives).to.have.lengthOf(1);
  expect(natives[0].cancelable, 'the native invalid event is cancelable').to.be.true;
  expect(natives[0].defaultPrevented).to.be.true;
});

it('leaves the native invalid event alone when the lr-invalid alias is not cancelled', async () => {
  const el = await fixture<LyraTextarea>(html`<lr-textarea required aria-label="Notes"></lr-textarea>`);
  const natives: Event[] = [];
  el.addEventListener('invalid', (event) => natives.push(event));

  expect(el.checkValidity()).to.be.false;
  expect(natives).to.have.lengthOf(1);
  expect(natives[0].defaultPrevented).to.be.false;
});

it('bars constraint validation while disabled, fieldset-disabled or readonly', async () => {
  // Native <textarea required disabled>/<textarea required readonly> match neither :valid nor
  // :invalid; a barred lyra control must not raise valueMissing or publish
  // :state(invalid)/:state(user-invalid) either.
  const el = await fixture<LyraTextarea>(
    html`<lr-textarea required aria-label="Notes" disabled></lr-textarea>`,
  );
  expect(el.validity.valueMissing, 'disabled + required').to.be.false;
  expect(el.validity.valid).to.be.true;
  expect(el.matches(':state(invalid)'), 'disabled must not be :state(invalid)').to.be.false;
  el.reportValidity();
  expect(el.matches(':state(user-invalid)'), 'disabled must not be :state(user-invalid)').to.be.false;

  el.disabled = false;
  await el.updateComplete;
  expect(el.validity.valueMissing, 'enabled again').to.be.true;
  expect(el.matches(':state(invalid)')).to.be.true;

  el.readonly = true;
  await el.updateComplete;
  expect(el.validity.valueMissing, 'readonly + required').to.be.false;
  expect(el.matches(':state(invalid)'), 'readonly must not be :state(invalid)').to.be.false;

  const form = await fixture<HTMLFormElement>(html`
    <form>
      <fieldset disabled>
        <lr-textarea required aria-label="Nested" name="nested"></lr-textarea>
      </fieldset>
    </form>
  `);
  const nested = form.querySelector('lr-textarea') as LyraTextarea;
  await nested.updateComplete;
  expect(nested.disabled, 'a fieldset never mutates the control own disabled').to.be.false;
  expect(nested.validity.valueMissing, 'fieldset-disabled + required').to.be.false;
  expect(nested.matches(':state(invalid)')).to.be.false;
});

it('falls back from an invalid runtime resize value without injecting declarations', async () => {
  const el = await fixture<LyraTextarea>(html`<lr-textarea></lr-textarea>`);
  el.resize = 'both;position:fixed' as unknown as LyraTextarea['resize'];
  await el.updateComplete;
  const textarea = el.shadowRoot!.querySelector('textarea')!;
  expect(textarea.style.resize).to.equal('vertical');
  expect(textarea.style.position).to.equal('');
  el.resize = 'both';
  await el.updateComplete;
  expect(textarea.style.resize).to.equal('both');
});

it('reflects the pinned Web Awesome resize property', async () => {
  const el = await fixture<LyraTextarea>(html`<lr-textarea></lr-textarea>`);
  el.resize = 'horizontal';
  await el.updateComplete;
  expect(el.getAttribute('resize')).to.equal('horizontal');
});

it('gives the textarea field hover feedback matching the keyboard focus-visible cue', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/\[part='textarea'\]:hover\s*\{[^}]*border-color:/);
});

it('forwards host click to the textarea and suppresses it while effectively disabled', async () => {
  const form = (await fixture(html`
    <form><fieldset><lr-textarea></lr-textarea></fieldset></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-textarea') as LyraTextarea;
  const fieldset = form.querySelector('fieldset') as HTMLFieldSetElement;
  const textarea = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
  let clicks = 0;
  textarea.addEventListener('click', () => clicks++);

  el.click();
  expect(clicks).to.equal(1);
  fieldset.disabled = true;
  el.click();
  expect(clicks).to.equal(1);
});

it('calls super.willUpdate so a future LyraElement/mixin lifecycle hook stays wired in', async () => {
  // Monkey-patch LyraElement.prototype.willUpdate (the established pattern, e.g. checkbox.test.ts)
  // to prove LyraTextarea's own willUpdate() override actually calls super.willUpdate(...) rather
  // than shadowing it silently.
  const proto = LyraElement.prototype as unknown as { willUpdate: (changed: PropertyValues) => void };
  const original = proto.willUpdate;
  let called = false;
  proto.willUpdate = function (this: LyraElement, changed: PropertyValues): void {
    called = true;
    original.call(this, changed);
  };
  try {
    const el = (await fixture(html`<lr-textarea></lr-textarea>`)) as LyraTextarea;
    await el.updateComplete;
    expect(called).to.be.true;
  } finally {
    proto.willUpdate = original;
  }
});

it('defaults to the mapped rows=4, resize="vertical", editable, and an empty value', async () => {
  const el = (await fixture(html`<lr-textarea></lr-textarea>`)) as LyraTextarea;
  const textarea = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
  expect(el.rows).to.equal(4);
  expect(el.resize).to.equal('vertical');
  expect(el.value).to.equal('');
  expect(el.readonly).to.equal(false);
  expect(el.hasAttribute('readonly')).to.equal(false);
  expect(textarea.readOnly).to.equal(false);
});

it('reflects rows/placeholder onto the native textarea', async () => {
  const el = (await fixture(html`<lr-textarea rows="6" placeholder="Notes"></lr-textarea>`)) as LyraTextarea;
  const textarea = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
  expect(textarea.rows).to.equal(6);
  expect(textarea.placeholder).to.equal('Notes');
});

it('applies resize onto the native textarea', async () => {
  const el = (await fixture(html`<lr-textarea resize="none"></lr-textarea>`)) as LyraTextarea;
  const textarea = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
  expect(getComputedStyle(textarea).resize).to.equal('none');
});

it('updates value and fires lr-input on user typing', async () => {
  const el = (await fixture(html`<lr-textarea></lr-textarea>`)) as LyraTextarea;
  const textarea = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
  textarea.value = 'hello';
  setTimeout(() => textarea.dispatchEvent(new Event('input', { bubbles: true })));
  const ev = await oneEvent(el, 'lr-input');
  expect(ev.detail).to.deep.equal({ value: 'hello' });
  expect(el.value).to.equal('hello');
});

it('relays exactly one native InputEvent payload and one Event change plus their typed aliases', async () => {
  const el = (await fixture(html`<lr-textarea></lr-textarea>`)) as LyraTextarea;
  const textarea = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
  const seen: Array<{ type: string; event: Event }> = [];
  for (const type of ['input', 'lr-input', 'change', 'lr-change']) {
    el.addEventListener(type, (event) => seen.push({ type, event }));
  }
  textarea.value = 'hello';
  textarea.dispatchEvent(new InputEvent('input', {
    bubbles: true,
    composed: true,
    data: 'o',
    inputType: 'insertText',
    isComposing: true,
  }));
  textarea.dispatchEvent(new Event('change', { bubbles: true, composed: true }));

  expect(seen.map(({ type }) => type)).to.deep.equal(['input', 'lr-input', 'change', 'lr-change']);
  const inputEvent = seen[0].event as InputEvent;
  expect(inputEvent instanceof InputEvent).to.be.true;
  expect(inputEvent.target === el && inputEvent.bubbles && inputEvent.composed).to.be.true;
  expect(inputEvent.data).to.equal('o');
  expect(inputEvent.inputType).to.equal('insertText');
  expect(inputEvent.isComposing).to.be.true;
  expect(seen[2].event.constructor === Event).to.be.true;
  expect(seen[2].event.target === el && seen[2].event.bubbles && seen[2].event.composed).to.be.true;
  expect(seen[1].event instanceof CustomEvent).to.be.true;
  expect(seen[3].event instanceof CustomEvent).to.be.true;
});

it('fires lr-change on native change (blur-after-edit timing)', async () => {
  const el = (await fixture(html`<lr-textarea></lr-textarea>`)) as LyraTextarea;
  const textarea = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
  textarea.value = 'committed';
  setTimeout(() => textarea.dispatchEvent(new Event('change', { bubbles: true })));
  const ev = await oneEvent(el, 'lr-change');
  expect(ev.detail).to.deep.equal({ value: 'committed' });
});

it('participates in native form validation via required', async () => {
  const el = (await fixture(html`<lr-textarea required name="notes"></lr-textarea>`)) as LyraTextarea;
  expect(el.checkValidity()).to.be.false;
  el.value = 'filled in';
  expect(el.checkValidity()).to.be.true;
});

describe('readonly', () => {
  it('reactively reflects and forwards readonly while preserving focus and selection', async () => {
    const el = (await fixture(html`
      <lr-textarea readonly value="selectable text"></lr-textarea>
    `)) as LyraTextarea;
    const textarea = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;

    expect(el.readonly).to.equal(true);
    expect(el.hasAttribute('readonly')).to.equal(true);
    expect(textarea.readOnly).to.equal(true);
    expect(textarea.disabled).to.equal(false);

    el.focus();
    el.setSelectionRange(0, 10);
    expect(el.shadowRoot!.activeElement?.id).to.equal('textarea');
    expect(el.selectionStart).to.equal(0);
    expect(el.selectionEnd).to.equal(10);

    el.readonly = false;
    await el.updateComplete;
    expect(el.hasAttribute('readonly')).to.equal(false);
    expect(textarea.readOnly).to.equal(false);
  });

  it('submits readonly values while suspending and restoring required and length validity', async () => {
    const form = (await fixture(html`
      <form>
        <lr-textarea name="notes" value="abc" minlength="5" required readonly></lr-textarea>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-textarea') as LyraTextarea;

    expect(new FormData(form).get('notes')).to.equal('abc');
    expect(el.effectiveDisabled).to.equal(false);
    expect(el.validity.valid).to.equal(true);

    el.readonly = false;
    await el.updateComplete;
    expect(el.validity.tooShort).to.equal(true);

    el.readonly = true;
    await el.updateComplete;
    expect(el.validity.valid).to.equal(true);

    el.value = '';
    expect(el.validity.valid).to.equal(true);
    el.readonly = false;
    await el.updateComplete;
    expect(el.validity.valueMissing).to.equal(true);
  });

  it('keeps programmatic range edits form-synchronized and silent while readonly', async () => {
    const form = (await fixture(html`
      <form><lr-textarea name="notes" value="hello world" readonly></lr-textarea></form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-textarea') as LyraTextarea;
    const seen: string[] = [];
    for (const name of ['input', 'change', 'lr-input', 'lr-change']) {
      el.addEventListener(name, () => seen.push(name));
    }

    el.setRangeText('there', 6, 11);
    expect(el.value).to.equal('hello there');
    expect(new FormData(form).get('notes')).to.equal('hello there');
    expect(seen).to.deep.equal([]);
  });
});

describe('length constraints', () => {
  it('forwards minlength/maxlength onto the native textarea', async () => {
    const el = (await fixture(html`<lr-textarea minlength="2" maxlength="8"></lr-textarea>`)) as LyraTextarea;
    const native = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    expect(el.minlength).to.equal(2);
    expect(el.maxlength).to.equal(8);
    expect(native.minLength).to.equal(2);
    expect(native.maxLength).to.equal(8);
  });

  it('bridges tooLong to the host validity', async () => {
    const el = (await fixture(html`<lr-textarea maxlength="3"></lr-textarea>`)) as LyraTextarea;
    const native = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    native.focus();
    native.value = 'abcdef';
    native.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;

    expect(el.validity.tooLong).to.equal(true);
    expect(el.checkValidity()).to.equal(false);
  });

  it('bridges tooShort to the host validity', async () => {
    const el = (await fixture(html`<lr-textarea minlength="5"></lr-textarea>`)) as LyraTextarea;
    const native = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    native.focus();
    native.value = 'ab';
    native.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;

    expect(el.validity.tooShort).to.equal(true);
    expect(el.checkValidity()).to.equal(false);
    // Native `minlength` never fires on an empty value -- an empty optional field stays valid.
    native.value = '';
    native.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    expect(el.validity.tooShort).to.equal(false);
    expect(el.checkValidity()).to.equal(true);
  });

  it('reports a programmatically assigned over-length value as invalid, despite the native dirty-value flag', async () => {
    const el = (await fixture(html`<lr-textarea maxlength="3"></lr-textarea>`)) as LyraTextarea;
    el.value = 'abcdef';
    expect(el.validity.tooLong).to.equal(true);
    expect(el.checkValidity()).to.equal(false);
    el.value = 'ab';
    expect(el.validity.tooLong).to.equal(false);
    expect(el.checkValidity()).to.equal(true);
  });

  it('recomputes validity when maxlength narrows below the current value without a value write', async () => {
    const el = (await fixture(html`<lr-textarea value="abcdef"></lr-textarea>`)) as LyraTextarea;
    expect(el.checkValidity()).to.equal(true);
    el.maxlength = 3;
    await el.updateComplete;
    expect(el.validity.tooLong).to.equal(true);
    expect(el.checkValidity()).to.equal(false);
  });

  it('keeps the localized required message and reports required + empty ahead of any length check', async () => {
    const el = (await fixture(html`<lr-textarea required minlength="5"></lr-textarea>`)) as LyraTextarea;
    el.strings = { fieldRequired: 'Ce champ est obligatoire.' };
    expect(el.validity.valueMissing).to.equal(true);
    expect(el.validity.tooShort).to.equal(false);
    expect(el.validationMessage).to.equal('This field is required.');
    el.value = '';
    expect(el.validationMessage).to.equal('Ce champ est obligatoire.');
  });

  it('unset regression: renders and validates exactly as before when minlength/maxlength are unset', async () => {
    const el = (await fixture(html`<lr-textarea></lr-textarea>`)) as LyraTextarea;
    const native = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    expect(el.minlength).to.equal(undefined);
    expect(el.maxlength).to.equal(undefined);
    expect(native.hasAttribute('minlength')).to.equal(false);
    expect(native.hasAttribute('maxlength')).to.equal(false);
    // -1 is the native "no limit" sentinel for an absent minlength/maxlength.
    expect(native.minLength).to.equal(-1);
    expect(native.maxLength).to.equal(-1);

    el.value = 'a value far longer than any plausible default limit would ever allow';
    expect(el.checkValidity()).to.equal(true);
    expect(el.validity.tooLong).to.equal(false);
    expect(el.validity.tooShort).to.equal(false);
    expect(el.validationMessage).to.equal('');
  });
});

it('is accessible', async () => {
  const el = (await fixture(html`<lr-textarea placeholder="Notes"></lr-textarea>`)) as LyraTextarea;
  await expect(el).to.be.accessible();
});

it('is accessible with a populated label/hint/errorText (the parts never rendered by the bare-placeholder case above)', async () => {
  const el = (await fixture(
    html`<lr-textarea label="Notes" hint="Keep it short" error-text="Required" required></lr-textarea>`,
  )) as LyraTextarea;
  await expect(el).to.be.accessible();
});

describe('label/hint/error chrome', () => {
  it('renders no chrome when label/hint/errorText are unset (today\'s exact bare output)', async () => {
    const el = (await fixture(html`<lr-textarea></lr-textarea>`)) as LyraTextarea;
    const label = el.shadowRoot!.querySelector('[part="form-control-label"]') as HTMLElement;
    const hint = el.shadowRoot!.querySelector('[part~="hint"]') as HTMLElement;
    const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
    expect(label.hidden).to.be.true;
    expect(hint.hidden).to.be.true;
    expect(error.hidden).to.be.true;
  });

  it('renders label/hint/errorText text and un-hides the matching parts', async () => {
    const el = (await fixture(
      html`<lr-textarea label="Notes" hint="Keep it short" error-text="Required"></lr-textarea>`,
    )) as LyraTextarea;
    const label = el.shadowRoot!.querySelector('[part="form-control-label"]') as HTMLElement;
    const hint = el.shadowRoot!.querySelector('[part~="hint"]') as HTMLElement;
    const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
    expect(label.hidden).to.be.false;
    expect(label.textContent).to.contain('Notes');
    expect(hint.hidden).to.be.false;
    expect(hint.textContent).to.contain('Keep it short');
    expect(error.hidden).to.be.false;
    expect(error.textContent).to.contain('Required');
    const textarea = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea.getAttribute('aria-describedby')).to.equal(`${error.id} ${hint.id}`);
    expect(textarea.getAttribute('aria-invalid')).to.equal('true');
  });

  it('supports label, hint, and error slots with same-shadow description ids', async () => {
    const el = (await fixture(html`
      <lr-textarea>
        <span slot="label">Slotted notes</span>
        <span slot="hint">Slotted hint</span>
        <span slot="error">Slotted error</span>
      </lr-textarea>
    `)) as LyraTextarea;
    await el.updateComplete;
    const textarea = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    const hint = el.shadowRoot!.querySelector('[part~="hint"]') as HTMLElement;
    const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
    expect((el.shadowRoot!.querySelector('[part="form-control-label"]') as HTMLElement).hidden).to.be.false;
    expect(hint.hidden).to.be.false;
    expect(error.hidden).to.be.false;
    expect(textarea.getAttribute('aria-describedby')).to.equal(`${error.id} ${hint.id}`);
  });

  it('shows a required asterisk on the label only when required', async () => {
    const el = (await fixture(html`<lr-textarea label="Notes" required></lr-textarea>`)) as LyraTextarea;
    const label = el.shadowRoot!.querySelector('[part="form-control-label"]') as HTMLElement;
    expect(getComputedStyle(label, '::after').content).to.contain('*');
  });
});

describe('accessibleLabel', () => {
  it('falls back to placeholder, then the localized default, when unset', async () => {
    const noLabel = (await fixture(html`<lr-textarea></lr-textarea>`)) as LyraTextarea;
    const withPlaceholder = (await fixture(html`<lr-textarea placeholder="Code"></lr-textarea>`)) as LyraTextarea;
    const ta1 = noLabel.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    const ta2 = withPlaceholder.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    expect(ta1.getAttribute('aria-label')).to.equal('Text');
    expect(ta2.getAttribute('aria-label')).to.equal('Code');
  });

  it('aria-label host attribute takes precedence over label and placeholder', async () => {
    const el = (await fixture(
      html`<lr-textarea label="Notes" placeholder="ph" aria-label="Custom name"></lr-textarea>`,
    )) as LyraTextarea;
    const ta = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    expect(ta.getAttribute('aria-label')).to.equal('Custom name');
  });

  it('preserves an explicitly empty host aria-label instead of applying a fallback', async () => {
    const el = (await fixture(html`
      <lr-textarea label="Notes" placeholder="ph" aria-label=""></lr-textarea>
    `)) as LyraTextarea;
    const ta = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    expect(ta.getAttribute('aria-label')).to.equal('');
  });

  it('routes the default textbox name through localization overrides', async () => {
    const el = (await fixture(html`
      <lr-textarea .strings=${{ textareaLabel: 'Texte multiligne' }}></lr-textarea>
    `)) as LyraTextarea;
    const ta = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    expect(ta.getAttribute('aria-label')).to.equal('Texte multiligne');
  });
});

describe('resize="auto"', () => {
  it('accepts "auto" as a resize value and sets native CSS resize to none (no manual handle)', async () => {
    const el = (await fixture(html`<lr-textarea resize="auto"></lr-textarea>`)) as LyraTextarea;
    const ta = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    expect(getComputedStyle(ta).resize).to.equal('none');
  });

  it('grows the textarea block-size to fit typed content that exceeds the initial rows', async () => {
    const el = (await fixture(html`<lr-textarea resize="auto" rows="1"></lr-textarea>`)) as LyraTextarea;
    const ta = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    const initialHeight = ta.getBoundingClientRect().height;
    ta.value = 'line one\nline two\nline three\nline four\nline five';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    expect(ta.getBoundingClientRect().height).to.be.greaterThan(initialHeight);
  });

  it('grows after a programmatic value assignment', async () => {
    const el = (await fixture(html`<lr-textarea resize="auto" rows="1"></lr-textarea>`)) as LyraTextarea;
    const ta = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    const initialHeight = ta.getBoundingClientRect().height;
    el.value = 'line one\nline two\nline three\nline four';
    await el.updateComplete;
    expect(ta.getBoundingClientRect().height).to.be.greaterThan(initialHeight);
  });

  it('respects --lr-textarea-max-block-size and scrolls overflow', async () => {
    const el = (await fixture(html`
      <lr-textarea resize="auto" rows="1" style="--lr-textarea-max-block-size: 3rem"></lr-textarea>
    `)) as LyraTextarea;
    const ta = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    ta.value = Array.from({ length: 20 }, (_, index) => `line ${index}`).join('\n');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    const max = parseFloat(getComputedStyle(ta).maxBlockSize);
    expect(ta.getBoundingClientRect().height).to.be.at.most(max + 0.5);
    expect(getComputedStyle(ta).overflowY).to.equal('auto');
  });

  it('re-fits wrapped content when the component allocation narrows', async () => {
    const el = (await fixture(html`
      <lr-textarea
        resize="auto"
        rows="1"
        style="inline-size: 24rem"
        .value=${'wrapped content '.repeat(30)}
      ></lr-textarea>
    `)) as LyraTextarea;
    const ta = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const wideHeight = ta.getBoundingClientRect().height;
    el.style.inlineSize = '8rem';
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    expect(ta.getBoundingClientRect().height).to.be.greaterThan(wideHeight);
  });

  it('keeps auto-grow working after a reparent (disconnect + reconnect) with no property change in between', async () => {
    const el = (await fixture(html`
      <lr-textarea
        resize="auto"
        rows="1"
        style="inline-size: 24rem"
        .value=${'wrapped content '.repeat(30)}
      ></lr-textarea>
    `)) as LyraTextarea;
    const ta = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const wideHeight = ta.getBoundingClientRect().height;

    // A drag-drop reparent (or a repeat() re-key, or a tab panel detach/reattach) fires
    // disconnectedCallback then connectedCallback on this same element instance, with no Lit
    // update in between -- exactly the sequence that used to leave the ResizeObserver disarmed.
    const parent = el.parentElement!;
    parent.removeChild(el);
    parent.appendChild(el);

    el.style.inlineSize = '8rem';
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    expect(ta.getBoundingClientRect().height).to.be.greaterThan(wideHeight);
  });
});

describe('native editing-attribute passthrough', () => {
  it('spellcheck defaults to true (matching the native element default)', async () => {
    const el = (await fixture(html`<lr-textarea></lr-textarea>`)) as LyraTextarea;
    const ta = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    expect(ta.spellcheck).to.be.true;
  });

  it('forwards spellcheck=false, autocapitalize, autocorrect, wrap, autocomplete, inputmode, and enterkeyhint', async () => {
    const el = (await fixture(html`
      <lr-textarea
        spellcheck="false"
        autocapitalize="off"
        autocorrect="off"
        wrap="hard"
        autocomplete="one-time-code"
        inputmode="numeric"
        enterkeyhint="done"
      ></lr-textarea>
    `)) as LyraTextarea;
    const ta = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    expect(ta.spellcheck).to.be.false;
    expect(ta.getAttribute('autocapitalize')).to.equal('off');
    expect(ta.getAttribute('autocorrect')).to.equal('off');
    expect(ta.getAttribute('wrap')).to.equal('hard');
    expect(ta.getAttribute('autocomplete')).to.equal('one-time-code');
    expect(ta.getAttribute('inputmode')).to.equal('numeric');
    expect(ta.getAttribute('enterkeyhint')).to.equal('done');
  });
});

describe('input / setRangeText()', () => {
  it('exposes the native textarea via the public input getter', async () => {
    const el = (await fixture(html`<lr-textarea></lr-textarea>`)) as LyraTextarea;
    expect(el.input).to.equal(el.shadowRoot!.querySelector('textarea'));
  });

  it('setRangeText splices text at the given range and updates value', async () => {
    const el = (await fixture(html`<lr-textarea></lr-textarea>`)) as LyraTextarea;
    el.value = 'hello world';
    await el.updateComplete;
    el.setRangeText('there', 6, 11);
    expect(el.value).to.equal('hello there');
  });

  it('forwards selection getters, setters, select(), and setSelectionRange()', async () => {
    const el = (await fixture(html`<lr-textarea></lr-textarea>`)) as LyraTextarea;
    el.value = 'alpha beta';
    await el.updateComplete;
    el.setSelectionRange(1, 5, 'forward');
    expect(el.selectionStart).to.equal(1);
    expect(el.selectionEnd).to.equal(5);
    expect(el.selectionDirection).to.equal('forward');
    el.selectionStart = 2;
    el.selectionEnd = 4;
    expect(el.input!.selectionStart).to.equal(2);
    expect(el.input!.selectionEnd).to.equal(4);
    el.select();
    expect(el.selectionStart).to.equal(0);
    expect(el.selectionEnd).to.equal(el.value.length);
  });

  it('forwards focus() and blur() to the native textarea', async () => {
    const el = (await fixture(html`<lr-textarea></lr-textarea>`)) as LyraTextarea;
    el.focus();
    expect(el.shadowRoot!.activeElement === el.input).to.be.true;
    el.blur();
    expect(el.shadowRoot!.activeElement).to.equal(null);
  });

  it('keeps the form value synchronized after setRangeText()', async () => {
    const form = (await fixture(html`
      <form><lr-textarea name="notes" value="hello world"></lr-textarea></form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-textarea') as LyraTextarea;
    el.setRangeText('there', 6, 11);
    expect(new FormData(form).get('notes')).to.equal('hello there');
  });
});

describe('forwarding getters/setters/methods before first render', () => {
  it('returns null / no-ops instead of throwing when called before the native textarea has rendered', () => {
    const el = document.createElement('lr-textarea') as LyraTextarea;
    expect(el.input).to.equal(null);
    expect(el.selectionStart).to.equal(null);
    expect(el.selectionEnd).to.equal(null);
    expect(() => {
      el.selectionStart = 2;
    }).to.not.throw();
    expect(() => {
      el.selectionEnd = 4;
    }).to.not.throw();
    expect(() => el.setRangeText('x')).to.not.throw();
    expect(el.value).to.equal('');
  });

  it('onInput/onChange no-op if somehow invoked before the native textarea has rendered', () => {
    const el = document.createElement('lr-textarea') as LyraTextarea;
    const handlers = el as unknown as { onInput: () => void; onChange: () => void };
    expect(() => handlers.onInput()).to.not.throw();
    expect(() => handlers.onChange()).to.not.throw();
    expect(el.value).to.equal('');
  });
});

it('sets selectionDirection via the property setter', async () => {
  const el = (await fixture(html`<lr-textarea></lr-textarea>`)) as LyraTextarea;
  el.value = 'alpha beta';
  await el.updateComplete;
  el.setSelectionRange(1, 5);
  el.selectionDirection = 'backward';
  expect(el.input!.selectionDirection).to.equal('backward');
});

it('normalizes a nullish selectionDirection assignment to "none" before forwarding to the native textarea', async () => {
  const el = (await fixture(html`<lr-textarea></lr-textarea>`)) as LyraTextarea;
  el.value = 'alpha beta';
  await el.updateComplete;
  const ta = el.input!;
  // Chromium normalizes an explicit 'none' straight back to 'forward' on readback (a native
  // quirk, reproducible by setting `ta.selectionDirection` directly too), so round-tripping
  // through the getter can't prove the fallback ran -- spy on the native setter itself instead to
  // confirm the literal value our code forwards.
  const nativeDescriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'selectionDirection')!;
  let written: string | undefined;
  Object.defineProperty(ta, 'selectionDirection', {
    configurable: true,
    get: nativeDescriptor.get,
    set(value: string) {
      written = value;
      nativeDescriptor.set!.call(this, value);
    },
  });
  try {
    el.selectionDirection = null;
    expect(written).to.equal('none');
  } finally {
    delete (ta as unknown as Record<string, unknown>).selectionDirection;
  }
});

it('setRangeText() replaces the current selection when called with no start/end (native single-arg overload)', async () => {
  const el = (await fixture(html`<lr-textarea></lr-textarea>`)) as LyraTextarea;
  el.value = 'hello world';
  await el.updateComplete;
  el.setSelectionRange(0, 5); // select "hello"
  el.setRangeText('goodbye');
  expect(el.value).to.equal('goodbye world');
});

it('resets touched state (re-hiding aria-invalid) via form.reset(), even when the restored value is still invalid', async () => {
  const form = (await fixture(html`
    <form><lr-textarea name="notes" required></lr-textarea></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-textarea') as LyraTextarea;
  const ta = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
  ta.dispatchEvent(new Event('blur')); // touched -> true; required + empty -> invalid
  await el.updateComplete;
  expect(ta.getAttribute('aria-invalid')).to.equal('true');

  form.reset(); // restores the (still-empty) default value -- still invalid, but no longer touched
  await el.updateComplete;
  expect(el.value).to.equal('');
  expect(ta.getAttribute('aria-invalid')).to.equal('false');
});

describe('switching resize away from "auto"', () => {
  it('tears down the resize observer and clears inline auto-grow sizing when switching away from resize="auto"', async () => {
    const el = (await fixture(html`<lr-textarea resize="auto" rows="1"></lr-textarea>`)) as LyraTextarea;
    const ta = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    ta.value = 'line one\nline two\nline three';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    expect(ta.style.blockSize).to.not.equal('');

    el.resize = 'vertical';
    await el.updateComplete;

    expect(ta.style.blockSize).to.equal('');
    expect(ta.style.overflowY).to.equal('');
    expect(getComputedStyle(ta).resize).to.equal('vertical');
  });

  it('re-fits when only rows changes while resize="auto" (no value/resize change in the same update)', async () => {
    const el = (await fixture(html`<lr-textarea resize="auto" rows="1"></lr-textarea>`)) as LyraTextarea;
    const ta = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    await el.updateComplete;
    const heightAtRows1 = ta.getBoundingClientRect().height;

    el.rows = 6; // only `rows` changes this update
    await el.updateComplete;

    expect(ta.getBoundingClientRect().height).to.be.greaterThan(heightAtRows1);
  });

  it('cancels an already-pending resize-refit animation frame when a new width-change delivery arrives before it fires', async () => {
    const el = (await fixture(html`
      <lr-textarea resize="auto" rows="1" style="inline-size: 24rem"></lr-textarea>
    `)) as LyraTextarea;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    // Seeds a fake pending raf id so the next real width-change delivery finds `resizeRaf`
    // already set -- the ResizeObserver's own per-frame coalescing (only the latest width is
    // ever reported per rendering opportunity) combined with the spec-guaranteed
    // requestAnimationFrame-before-ResizeObserver delivery ordering within a frame make it
    // impractical to force two genuinely overlapping deliveries through real timing alone.
    const fakeRafId = requestAnimationFrame(() => {});
    (el as unknown as { resizeRaf?: number; resizeRafOwner?: Window }).resizeRaf = fakeRafId;
    (el as unknown as { resizeRafOwner?: Window }).resizeRafOwner = window;

    const originalCancel = window.cancelAnimationFrame;
    let canceledId: number | undefined;
    window.cancelAnimationFrame = function (id: number): void {
      canceledId = id;
      originalCancel.call(window, id);
    };
    try {
      el.style.inlineSize = '8rem';
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      expect(canceledId).to.equal(fakeRafId);
    } finally {
      window.cancelAnimationFrame = originalCancel;
    }
  });
});

describe('blur/focus bubbling', () => {
  it('relays exactly one native focus/blur pair plus one prefixed alias pair', async () => {
    const el = (await fixture(html`<lr-textarea></lr-textarea>`)) as LyraTextarea;
    const ta = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    const nativeEvents: FocusEvent[] = [];
    const aliases: string[] = [];
    el.addEventListener('focus', (event) => nativeEvents.push(event as FocusEvent));
    el.addEventListener('blur', (event) => nativeEvents.push(event as FocusEvent));
    el.addEventListener('lr-focus', () => aliases.push('lr-focus'));
    el.addEventListener('lr-blur', () => aliases.push('lr-blur'));

    ta.focus();
    ta.blur();

    expect(nativeEvents.map((event) => event.type)).to.deep.equal(['focus', 'blur']);
    expect(nativeEvents.every((event) => event instanceof FocusEvent)).to.be.true;
    expect(nativeEvents.every((event) => event.target === el && event.bubbles && event.composed)).to.be.true;
    expect(aliases).to.deep.equal(['lr-focus', 'lr-blur']);
  });
});

// -- 8.0 surface: size / appearance / with-count / wrappers / scrollPosition -

describe('lr-textarea size', () => {
  const fieldOf = (el: LyraTextarea) => el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;

  it('defaults to size "m" and reflects the attribute', async () => {
    const el = await fixture<LyraTextarea>(html`<lr-textarea aria-label="Notes"></lr-textarea>`);
    expect(el.size).to.equal('m');
    expect(el.getAttribute('size')).to.equal('m');
    const sized = await fixture<LyraTextarea>(html`<lr-textarea size="s" aria-label="Notes"></lr-textarea>`);
    expect(sized.size).to.equal('s');
    expect(sized.getAttribute('size')).to.equal('s');
  });

  it('leaves the committed padding/font-size untouched at the default tier and tightens them at "xs"', async () => {
    const mEl = await fixture<LyraTextarea>(html`<lr-textarea aria-label="a"></lr-textarea>`);
    const xsEl = await fixture<LyraTextarea>(html`<lr-textarea size="xs" aria-label="b"></lr-textarea>`);
    const m = getComputedStyle(fieldOf(mEl));
    const xs = getComputedStyle(fieldOf(xsEl));
    // The default tier's values now come from the shared form-control ladder rather than this
    // component's own copy of the scale, so they match lr-input's `m` tier exactly.
    expect(m.paddingTop).to.equal('12px');
    expect(m.fontSize).to.equal('16px');
    expect(parseFloat(xs.paddingTop)).to.be.below(parseFloat(m.paddingTop));
    expect(parseFloat(xs.fontSize)).to.be.below(parseFloat(m.fontSize));
  });
});

describe('lr-textarea appearance', () => {
  const fieldOf = (el: LyraTextarea) => el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
  const TRANSPARENT = 'rgba(0, 0, 0, 0)';

  it('defaults to mapped "outlined", reflected, keeping the committed border only', async () => {
    const el = await fixture<LyraTextarea>(html`<lr-textarea aria-label="Notes"></lr-textarea>`);
    expect(el.appearance).to.equal('outlined');
    expect(el.getAttribute('appearance')).to.equal('outlined');
    const cs = getComputedStyle(fieldOf(el));
    expect(cs.backgroundColor).to.equal(TRANSPARENT);
    expect(cs.borderTopColor).to.not.equal(TRANSPARENT);
  });

  it('renders each other appearance distinctly', async () => {
    const outlined = await fixture<LyraTextarea>(html`<lr-textarea appearance="outlined" aria-label="a"></lr-textarea>`);
    const filled = await fixture<LyraTextarea>(html`<lr-textarea appearance="filled" aria-label="b"></lr-textarea>`);
    const plain = await fixture<LyraTextarea>(html`<lr-textarea appearance="plain" aria-label="c"></lr-textarea>`);
    const accent = await fixture<LyraTextarea>(html`<lr-textarea appearance="accent" aria-label="d"></lr-textarea>`);
    expect(getComputedStyle(fieldOf(outlined)).backgroundColor).to.equal(TRANSPARENT);
    expect(getComputedStyle(fieldOf(filled)).borderTopColor).to.equal(TRANSPARENT);
    expect(getComputedStyle(fieldOf(plain)).backgroundColor).to.equal(TRANSPARENT);
    expect(getComputedStyle(fieldOf(plain)).borderTopColor).to.equal(TRANSPARENT);
    expect(getComputedStyle(fieldOf(accent)).borderTopColor).to.not.equal(
      getComputedStyle(fieldOf(outlined)).borderTopColor,
    );
  });

  it('exposes --lr-textarea-fill/--lr-textarea-border-color without a ::part() rule', async () => {
    const el = await fixture<LyraTextarea>(html`<lr-textarea aria-label="Notes"></lr-textarea>`);
    el.style.setProperty('--lr-textarea-fill', 'rgb(1, 2, 3)');
    el.style.setProperty('--lr-textarea-border-color', 'rgb(4, 5, 6)');
    await el.updateComplete;
    const cs = getComputedStyle(fieldOf(el));
    expect(cs.backgroundColor).to.equal('rgb(1, 2, 3)');
    expect(cs.borderTopColor).to.equal('rgb(4, 5, 6)');
  });
});

describe('lr-textarea wrapper parts', () => {
  it('wraps the native textarea in a textarea-wrapper part', async () => {
    const el = await fixture<LyraTextarea>(html`<lr-textarea aria-label="Notes"></lr-textarea>`);
    const wrapper = el.shadowRoot!.querySelector('[part~="textarea-wrapper"]') as HTMLElement;
    expect(el.shadowRoot!.querySelectorAll('[part~="textarea-wrapper"]').length).to.equal(1);
    expect(wrapper.querySelectorAll('textarea').length).to.equal(1);
  });

  it('keeps the footer part out of the layout until with-count is set', async () => {
    const el = await fixture<LyraTextarea>(html`<lr-textarea aria-label="Notes"></lr-textarea>`);
    const footer = el.shadowRoot!.querySelector('[part="footer"]') as HTMLElement;
    expect(el.shadowRoot!.querySelectorAll('[part="footer"]').length).to.equal(1);
    expect(getComputedStyle(footer).display).to.equal('none');
    el.withCount = true;
    await el.updateComplete;
    expect(getComputedStyle(footer).display).to.not.equal('none');
  });
});

describe('lr-textarea with-count', () => {
  const countOf = (el: LyraTextarea) => el.shadowRoot!.querySelector('[part="count"]') as HTMLElement;

  it('renders no count element by default', async () => {
    const el = await fixture<LyraTextarea>(html`<lr-textarea value="abc" aria-label="Notes"></lr-textarea>`);
    expect(el.withCount).to.be.false;
    expect(el.shadowRoot!.querySelectorAll('[part="count"]').length).to.equal(0);
  });

  it('counts characters, and switches to a remaining-characters readout under maxlength', async () => {
    const el = await fixture<LyraTextarea>(
      html`<lr-textarea with-count value="abcd" aria-label="Notes"></lr-textarea>`,
    );
    expect(el.getAttribute('with-count')).to.equal('');
    el.strings = {
      textareaCharacterCount: { one: '{count} caractère', other: '{count} caractères' },
      textareaCharactersRemaining: { one: '{count} restant', other: '{count} restants' },
    };
    await el.updateComplete;
    expect(countOf(el).textContent!.trim()).to.equal('4 caractères');

    el.maxlength = 10;
    await el.updateComplete;
    expect(countOf(el).textContent!.trim()).to.equal('6 restants');

    el.value = 'abcdefghi';
    await el.updateComplete;
    expect(countOf(el).textContent!.trim()).to.equal('1 restant');
  });

  it('never reports a negative remaining count for a script-assigned over-length value', async () => {
    const el = await fixture<LyraTextarea>(
      html`<lr-textarea with-count maxlength="3" aria-label="Notes"></lr-textarea>`,
    );
    el.strings = { textareaCharactersRemaining: '{count} left' };
    el.value = 'abcdef';
    await el.updateComplete;
    expect(countOf(el).textContent!.trim()).to.equal('0 left');
  });

  it('ignores an unparseable maxlength attribute rather than rendering NaN', async () => {
    const el = await fixture<LyraTextarea>(
      html`<lr-textarea with-count value="ab" maxlength="oops" aria-label="Notes"></lr-textarea>`,
    );
    el.strings = { textareaCharacterCount: '{count} chars' };
    await el.updateComplete;
    expect(countOf(el).textContent!.trim()).to.equal('2 chars');
  });

  it('keeps both shadow count copies out of the accessibility tree and pre-mounts a polite sink', async () => {
    const el = await fixture<LyraTextarea>(
      html`<lr-textarea with-count value="ab" aria-label="Notes"></lr-textarea>`,
    );
    expect(countOf(el).getAttribute('aria-hidden')).to.equal('true');
    const mirror = el.shadowRoot!.querySelector('.count-announcement') as HTMLElement;
    expect(mirror.getAttribute('aria-hidden')).to.equal('true');
    expect(el.shadowRoot!.querySelector('[aria-live], [role="status"]') === null).to.be.true;
    const sink = document.querySelector<HTMLElement>(
      `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`,
    )!;
    expect(Boolean(sink), 'the sink is mounted before typing starts').to.be.true;
    expect(sink.childElementCount).to.equal(0);
  });

  it('is accessible with the count rendered', async () => {
    const el = await fixture<LyraTextarea>(
      html`<lr-textarea with-count maxlength="20" value="ab" label="Notes"></lr-textarea>`,
    );
    expect(el.shadowRoot!.querySelectorAll('[part="count"]').length).to.equal(1);
    await expect(el).to.be.accessible();
  });
});

describe('lr-textarea resize="horizontal"', () => {
  it('forwards the horizontal resize mode to the native textarea', async () => {
    const el = await fixture<LyraTextarea>(html`<lr-textarea aria-label="Notes"></lr-textarea>`);
    el.resize = 'horizontal';
    await el.updateComplete;
    const textarea = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea.style.resize).to.equal('horizontal');
    expect(getComputedStyle(textarea).resize).to.equal('horizontal');
  });
});

describe('lr-textarea scrollPosition()', () => {
  it('reads back the native scroll offsets and writes each axis independently', async () => {
    const el = await fixture<LyraTextarea>(
      html`<lr-textarea rows="2" value="a\nb\nc\nd\ne\nf\ng\nh\ni\nj" aria-label="Notes"></lr-textarea>`,
    );
    const textarea = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    expect(el.scrollPosition()).to.deep.equal({ top: 0, left: 0 });
    el.scrollPosition({ top: 12 });
    expect(textarea.scrollTop).to.equal(12);
    expect(el.scrollPosition()!.top).to.equal(12);
    el.scrollPosition({ left: 0 });
    expect(el.scrollPosition()!.left).to.equal(0);
    expect(el.scrollPosition({ top: 4 })).to.equal(undefined);
    expect(textarea.scrollTop).to.equal(4);
  });
});

describe('lr-textarea with-count live announcement', () => {
  it('appends the count to the light-DOM polite sink once typing pauses', async () => {
    const el = await fixture<LyraTextarea>(
      html`<lr-textarea with-count aria-label="Notes"></lr-textarea>`,
    );
    el.strings = { textareaCharacterCount: '{count} chars' };
    await el.updateComplete;
    const mirror = el.shadowRoot!.querySelector('.count-announcement') as HTMLElement;
    const sink = document.querySelector<HTMLElement>(
      `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`,
    )!;
    const textarea = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = 'abc';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    // Still silent immediately after the keystroke -- announcing per character would talk over
    // the character just typed.
    expect(mirror.textContent!.trim()).to.equal('');
    expect(sink.childElementCount).to.equal(0);
    await new Promise((resolve) => setTimeout(resolve, 1400));
    await el.updateComplete;
    expect(mirror.textContent!.trim()).to.equal('3 chars');
    expect(Array.from(sink.children, (child) => child.textContent)).to.deep.equal(['3 chars']);
  });

  it('keeps a debounced count silent while the textarea host is hidden', async () => {
    const el = await fixture<LyraTextarea>(
      html`<lr-textarea hidden with-count aria-label="Notes"></lr-textarea>`,
    );
    const sink = document.querySelector<HTMLElement>(
      `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`,
    )!;
    const textarea = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;

    textarea.value = 'abc';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 1400));

    expect(sink.childElementCount).to.equal(0);
  });

  it('releases on disconnect and reconnects without replaying the last count', async () => {
    const el = await fixture<LyraTextarea>(
      html`<lr-textarea with-count aria-label="Notes"></lr-textarea>`,
    );
    const selector = `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`;
    expect(document.querySelector(selector) !== null).to.be.true;

    el.remove();
    expect(document.querySelector(selector) === null).to.be.true;

    document.body.append(el);
    const sink = document.querySelector<HTMLElement>(selector)!;
    expect(Boolean(sink)).to.be.true;
    expect(sink.childElementCount).to.equal(0);
    el.remove();
  });

  it('rebinds resize observation, animation frames, and count timers to an adopted realm', async () => {
    const frame = document.createElement('iframe');
    const loaded = oneEvent(frame, 'load');
    frame.srcdoc = '<!doctype html><html><body></body></html>';
    document.body.append(frame);
    await loaded;

    const frameWindow = frame.contentWindow!;
    const frameDocument = frame.contentDocument!;
    const originalFrameResizeObserver = frameWindow.ResizeObserver;
    const originalFrameRequestAnimationFrame = frameWindow.requestAnimationFrame;
    const originalFrameCancelAnimationFrame = frameWindow.cancelAnimationFrame;
    const originalFrameSetTimeout = frameWindow.setTimeout;
    const originalFrameClearTimeout = frameWindow.clearTimeout;
    const originalParentRequestAnimationFrame = window.requestAnimationFrame;
    const originalParentSetTimeout = window.setTimeout;
    let resizeCallback: ResizeObserverCallback | undefined;
    let frameObserverConstructions = 0;
    let frameAnimationFrames = 0;
    let frameAnimationCancels = 0;
    let frameCountTimers = 0;
    let frameTimerClears = 0;
    let parentAnimationFrames = 0;
    let parentCountTimers = 0;

    class TrackingResizeObserver implements ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        frameObserverConstructions += 1;
        resizeCallback = callback;
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }

    frameWindow.ResizeObserver = TrackingResizeObserver;
    frameWindow.requestAnimationFrame = (() => {
      frameAnimationFrames += 1;
      return 71;
    }) as typeof frameWindow.requestAnimationFrame;
    frameWindow.cancelAnimationFrame = ((handle: number) => {
      if (handle === 71) frameAnimationCancels += 1;
    }) as typeof frameWindow.cancelAnimationFrame;
    frameWindow.setTimeout = ((handler: TimerHandler, timeout?: number) => {
      if (timeout === 1000) frameCountTimers += 1;
      return 72;
    }) as typeof frameWindow.setTimeout;
    frameWindow.clearTimeout = ((handle?: number) => {
      if (handle === 72) frameTimerClears += 1;
    }) as typeof frameWindow.clearTimeout;
    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      parentAnimationFrames += 1;
      return originalParentRequestAnimationFrame(callback);
    }) as typeof window.requestAnimationFrame;
    window.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
      if (timeout === 1000) parentCountTimers += 1;
      return originalParentSetTimeout(handler, timeout, ...args);
    }) as typeof window.setTimeout;

    let el: LyraTextarea | undefined;
    try {
      // Render in the defining realm before adoption so Lit's constructed styles are installed.
      el = await fixture<LyraTextarea>(html`
        <lr-textarea resize="auto" with-count aria-label="Notes"></lr-textarea>
      `);
      el.remove();
      frameDocument.body.append(frameDocument.adoptNode(el));
      await el.updateComplete;
      expect(frameObserverConstructions).to.equal(1);

      const textarea = el.input!;
      textarea.value = 'abc';
      textarea.dispatchEvent(new frameWindow.InputEvent('input', { bubbles: true }));
      expect(frameCountTimers).to.equal(1);
      expect(parentCountTimers).to.equal(0);

      resizeCallback?.(
        [{ contentRect: { width: 999 } } as ResizeObserverEntry],
        {} as ResizeObserver,
      );
      expect(frameAnimationFrames).to.equal(1);
      expect(parentAnimationFrames).to.equal(0);

      el.remove();
      expect(frameTimerClears).to.equal(1);
      expect(frameAnimationCancels).to.equal(1);
    } finally {
      el?.remove();
      frameWindow.ResizeObserver = originalFrameResizeObserver;
      frameWindow.requestAnimationFrame = originalFrameRequestAnimationFrame;
      frameWindow.cancelAnimationFrame = originalFrameCancelAnimationFrame;
      frameWindow.setTimeout = originalFrameSetTimeout;
      frameWindow.clearTimeout = originalFrameClearTimeout;
      window.requestAnimationFrame = originalParentRequestAnimationFrame;
      window.setTimeout = originalParentSetTimeout;
      frame.remove();
    }
  });
});

describe('lr-textarea unset-regression for the 8.0 opt-ins', () => {
  it('renders the committed DOM and field styling when size/appearance/with-count are left alone', async () => {
    const el = await fixture<LyraTextarea>(html`<lr-textarea value="abc" aria-label="Notes"></lr-textarea>`);
    const textarea = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    expect(el.shadowRoot!.querySelectorAll('[part="count"]').length).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('[aria-live]').length).to.equal(0);
    expect(getComputedStyle(el.shadowRoot!.querySelector('[part="footer"]') as HTMLElement).display).to.equal('none');
    const cs = getComputedStyle(textarea);
    expect(cs.paddingTop).to.equal('12px');
    expect(cs.fontSize).to.equal('16px');
    expect(cs.borderTopWidth).to.equal('1px');
    expect(textarea.style.resize).to.equal('vertical');
  });
});

describe('lr-textarea — the shared size ladder and pill', () => {
  const field = (el: LyraTextarea) => el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;

  it('renders the Web Awesome size spellings at the same geometry as the canonical steps', async () => {
    for (const [alias, step] of [['small', 's'], ['medium', 'm'], ['large', 'l']] as const) {
      const aliasEl = await fixture<LyraTextarea>(
        html`<lr-textarea size=${alias} aria-label="Notes"></lr-textarea>`,
      );
      const stepEl = await fixture<LyraTextarea>(
        html`<lr-textarea size=${step} aria-label="Notes"></lr-textarea>`,
      );
      expect(getComputedStyle(field(aliasEl)).fontSize, `size=${alias} font-size`).to.equal(
        getComputedStyle(field(stepEl)).fontSize,
      );
      expect(getComputedStyle(field(aliasEl)).paddingTop, `size=${alias} padding`).to.equal(
        getComputedStyle(field(stepEl)).paddingTop,
      );
    }
  });

  it('rounds the field to a pill, and leaves the corner radius alone when pill is unset', async () => {
    const plain = await fixture<LyraTextarea>(html`<lr-textarea aria-label="Notes"></lr-textarea>`);
    expect(plain.pill).to.equal(false);
    expect(getComputedStyle(field(plain)).borderTopLeftRadius).to.equal('6px');

    const pilled = await fixture<LyraTextarea>(html`<lr-textarea pill aria-label="Notes"></lr-textarea>`);
    expect(pilled.pill).to.equal(true);
    expect(pilled.getAttribute('pill')).to.equal('');
    expect(getComputedStyle(field(pilled)).borderTopLeftRadius).to.equal('999px');
  });
});

it('is accessible with the pill treatment applied', async () => {
  const el = await fixture<LyraTextarea>(
    html`<lr-textarea pill label="Notes" hint="Optional"></lr-textarea>`,
  );
  await expect(el).to.be.accessible();
});

describe('lr-textarea mapped Textarea parity surface', () => {
  it('forwards autofocus/title and exposes defaultValue reset semantics', async () => {
    const form = await fixture<HTMLFormElement>(html`
      <form><lr-textarea name="notes" value="seed" autofocus title="Notes editor"></lr-textarea></form>
    `);
    const el = form.querySelector('lr-textarea') as LyraTextarea;
    const native = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    expect(native.autofocus).to.be.true;
    expect(native.title).to.equal('Notes editor');
    expect(el.defaultValue).to.equal('seed');
    el.value = 'edited';
    form.reset();
    expect(el.value).to.equal('seed');
  });

  it('accepts default-value as an attribute alias for the supported defaultValue reset IDL', async () => {
    const form = await fixture<HTMLFormElement>(html`
      <form><lr-textarea name="notes" default-value="seed"></lr-textarea></form>
    `);
    const el = form.querySelector('lr-textarea') as LyraTextarea;
    expect(el.defaultValue).to.equal('seed');
    expect(el.value).to.equal('seed');

    el.value = 'edited';
    form.reset();
    expect(el.value).to.equal('seed');
  });

  it('accepts filled/help-text and with-label/with-hint SSR aliases', async () => {
    const el = (await fixture(html`
      <lr-textarea filled help-text="Alias hint" with-label with-hint></lr-textarea>
    `)) as LyraTextarea & { filled: boolean; helpText: string; withLabel: boolean; withHint: boolean };
    expect(el.filled).to.be.true;
    expect((el.shadowRoot!.querySelector('[part~="label"]') as HTMLElement).hidden).to.be.false;
    expect((el.shadowRoot!.querySelector('[part~="hint"]') as HTMLElement).hidden).to.be.false;
    expect(el.shadowRoot!.querySelector('[part~="hint"]')?.textContent).to.contain('Alias hint');
  });

  it('accepts help-text slot and exports form-control-input/adjuster part aliases', async () => {
    const el = await fixture<LyraTextarea>(html`
      <lr-textarea><span slot="help-text">Slotted help</span></lr-textarea>
    `);
    expect(el.shadowRoot!.querySelector('[part~="form-control-input"]')).to.exist;
    expect(el.shadowRoot!.querySelector('[part~="textarea-adjuster"]')).to.exist;
    expect(el.shadowRoot!.querySelector('[part~="form-control-help-text"]')).to.exist;
    const help = el.shadowRoot!.querySelector('slot[name="help-text"]') as HTMLSlotElement;
    expect(help.assignedElements()[0]?.textContent).to.equal('Slotted help');
  });

  it('keeps a boolean autocorrect read while accepting both upstream write vocabularies', async () => {
    const el = (await fixture(html`<lr-textarea></lr-textarea>`)) as LyraTextarea & {
      inputmode: string;
      enterkeyhint: string;
    };
    el.autocorrect = false;
    el.inputmode = 'text';
    el.enterkeyhint = 'done';
    await el.updateComplete;
    const native = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    expect(el.autocorrect).to.equal(false);
    expect(native.getAttribute('autocorrect')).to.equal('off');
    expect(el.inputMode).to.equal('text');
    expect(el.enterKeyHint).to.equal('done');

    el.setAttribute('autocorrect', 'on');
    await el.updateComplete;
    expect(el.autocorrect).to.equal(true);
    expect(native.getAttribute('autocorrect')).to.equal('on');

    const shoelaceWrite = el as unknown as { autocorrect: boolean | string };
    shoelaceWrite.autocorrect = 'off';
    await el.updateComplete;
    expect(el.autocorrect).to.equal(false);
    expect(native.getAttribute('autocorrect')).to.equal('off');
    shoelaceWrite.autocorrect = 'sentences';
    await el.updateComplete;
    expect(el.autocorrect).to.equal(true);
    expect(native.getAttribute('autocorrect')).to.equal('on');

    el.removeAttribute('autocorrect');
    await el.updateComplete;
    expect(el.autocorrect, 'attribute removal restores the true default').to.equal(true);
    expect(native.hasAttribute('autocorrect'), 'the native control resumes its browser default').to.equal(false);
  });

  it('reflects the blank custom state across live value changes', async () => {
    const el = await fixture<LyraTextarea>(html`<lr-textarea></lr-textarea>`);
    expect(el.matches(':state(blank)')).to.be.true;
    el.value = 'note';
    await el.updateComplete;
    expect(el.matches(':state(blank)')).to.be.false;
  });
});

it('mirrors the lowercase IDL aliases of the native input hints', async () => {
  const el = (await fixture(html`<lr-textarea label="Notes"></lr-textarea>`)) as LyraTextarea;
  expect(el.inputmode).to.equal('');
  expect(el.enterkeyhint).to.equal('');

  el.inputmode = 'numeric';
  el.enterkeyhint = 'send';
  await el.updateComplete;
  expect(el.inputMode).to.equal('numeric');
  expect(el.enterKeyHint).to.equal('send');
  expect(el.inputmode).to.equal('numeric');
  expect(el.enterkeyhint).to.equal('send');

  el.inputmode = null as unknown as string;
  el.enterkeyhint = null as unknown as string;
  await el.updateComplete;
  expect(el.inputmode).to.equal('');
  expect(el.enterkeyhint).to.equal('');
});

import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import type { PropertyValues } from 'lit';
import './textarea.js';
import type { LyraTextarea } from './textarea.js';
import { styles } from './textarea.styles.js';
import { LyraElement } from '../../../internal/lyra-element.js';

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

it('defaults to rows=3, resize="vertical", editable, and an empty value', async () => {
  const el = (await fixture(html`<lr-textarea></lr-textarea>`)) as LyraTextarea;
  const textarea = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
  expect(el.rows).to.equal(3);
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

it('also emits composed native-style input and change events', async () => {
  const el = (await fixture(html`<lr-textarea></lr-textarea>`)) as LyraTextarea;
  const textarea = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
  const seen: string[] = [];
  el.addEventListener('input', (event) => { expect(event.composed).to.be.true; seen.push(event.type); });
  el.addEventListener('change', (event) => { expect(event.composed).to.be.true; seen.push(event.type); });
  textarea.value = 'hello';
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.dispatchEvent(new Event('change', { bubbles: true }));
  expect(seen).to.deep.equal(['input', 'change']);
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
    const hint = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
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
    const hint = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
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
    const hint = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
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
    (el as unknown as { resizeRaf?: number }).resizeRaf = fakeRafId;

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
  it('re-dispatches a bubbling, composed blur event when the native textarea blurs', async () => {
    const el = (await fixture(html`<lr-textarea></lr-textarea>`)) as LyraTextarea;
    const ta = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    ta.focus();
    const eventPromise = oneEvent(el, 'blur');
    ta.blur();
    const ev = await eventPromise;
    expect(ev.bubbles).to.be.true;
    expect(ev.composed).to.be.true;
  });

  it('re-dispatches a bubbling, composed focus event when the native textarea focuses', async () => {
    const el = (await fixture(html`<lr-textarea></lr-textarea>`)) as LyraTextarea;
    const ta = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    const eventPromise = oneEvent(el, 'focus');
    ta.focus();
    const ev = await eventPromise;
    expect(ev.bubbles).to.be.true;
    expect(ev.composed).to.be.true;
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
    expect(m.paddingTop).to.equal('8px');
    expect(m.fontSize).to.equal('14px');
    expect(parseFloat(xs.paddingTop)).to.be.below(parseFloat(m.paddingTop));
    expect(parseFloat(xs.fontSize)).to.be.below(parseFloat(m.fontSize));
  });
});

describe('lr-textarea appearance', () => {
  const fieldOf = (el: LyraTextarea) => el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
  const TRANSPARENT = 'rgba(0, 0, 0, 0)';

  it('defaults to "filled-outlined", reflected, keeping the committed fill + border', async () => {
    const el = await fixture<LyraTextarea>(html`<lr-textarea aria-label="Notes"></lr-textarea>`);
    expect(el.appearance).to.equal('filled-outlined');
    expect(el.getAttribute('appearance')).to.equal('filled-outlined');
    const cs = getComputedStyle(fieldOf(el));
    expect(cs.backgroundColor).to.not.equal(TRANSPARENT);
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
    const wrapper = el.shadowRoot!.querySelector('[part="textarea-wrapper"]') as HTMLElement;
    expect(el.shadowRoot!.querySelectorAll('[part="textarea-wrapper"]').length).to.equal(1);
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

  it('keeps the visible count out of the accessibility tree and announces it politely', async () => {
    const el = await fixture<LyraTextarea>(
      html`<lr-textarea with-count value="ab" aria-label="Notes"></lr-textarea>`,
    );
    expect(countOf(el).getAttribute('aria-hidden')).to.equal('true');
    const live = el.shadowRoot!.querySelector('[aria-live="polite"]') as HTMLElement;
    expect(el.shadowRoot!.querySelectorAll('[aria-live="polite"]').length).to.equal(1);
    expect(live.textContent!.trim()).to.equal('');
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
  it('republishes the count to the polite live region once typing pauses', async () => {
    const el = await fixture<LyraTextarea>(
      html`<lr-textarea with-count aria-label="Notes"></lr-textarea>`,
    );
    el.strings = { textareaCharacterCount: '{count} chars' };
    await el.updateComplete;
    const live = el.shadowRoot!.querySelector('[aria-live="polite"]') as HTMLElement;
    const textarea = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = 'abc';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    // Still silent immediately after the keystroke -- announcing per character would talk over
    // the character just typed.
    expect(live.textContent!.trim()).to.equal('');
    await new Promise((resolve) => setTimeout(resolve, 1400));
    await el.updateComplete;
    expect(live.textContent!.trim()).to.equal('3 chars');
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
    expect(cs.paddingTop).to.equal('8px');
    expect(cs.fontSize).to.equal('14px');
    expect(cs.borderTopWidth).to.equal('1px');
    expect(textarea.style.resize).to.equal('vertical');
  });
});

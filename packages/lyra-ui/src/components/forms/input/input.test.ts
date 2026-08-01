import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './input.js';
import '../button/button.js';
import type { LyraInput } from './input.class.js';
import { styles } from './input.styles.js';

describe('lr-input', () => {
  it('defaults to type="text" with an empty value', async () => {
    const el = (await fixture(html`<lr-input></lr-input>`)) as LyraInput;
    expect(el.type).to.equal('text');
    expect(el.value).to.equal('');
    const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
    expect(input.type).to.equal('text');
  });

  it('defaults to size "m" and reflects a size attribute', async () => {
    const defaultEl = (await fixture(html`<lr-input></lr-input>`)) as LyraInput;
    expect(defaultEl.size).to.equal('m');
    const el = (await fixture(html`<lr-input size="s"></lr-input>`)) as LyraInput;
    expect(el.getAttribute('size')).to.equal('s');
    expect(el.size).to.equal('s');
  });

  it('forwards placeholder/autocomplete/min/max/step onto the native input', async () => {
    const el = (await fixture(
      html`<lr-input type="number" placeholder="Qty" autocomplete="off" min="1" max="10" step="2"></lr-input>`,
    )) as LyraInput;
    const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
    expect(input.placeholder).to.equal('Qty');
    expect(input.autocomplete).to.equal('off');
    expect(input.min).to.equal('1');
    expect(input.max).to.equal('10');
    expect(input.step).to.equal('2');
  });

  it('forwards editing-assistance attributes and exposes native-style input/change events', async () => {
    const el = (await fixture(html`
      <lr-input spellcheck="false" autocapitalize="off" autocorrect="off" inputmode="email" enterkeyhint="done"></lr-input>
    `)) as LyraInput;
    const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
    expect(input.spellcheck).to.be.false;
    expect(input.getAttribute('autocapitalize')).to.equal('off');
    expect(input.getAttribute('autocorrect')).to.equal('off');
    expect(input.getAttribute('inputmode')).to.equal('email');
    expect(input.getAttribute('enterkeyhint')).to.equal('done');
    const seen: string[] = [];
    el.addEventListener('input', (event) => { seen.push(event.type); });
    el.addEventListener('change', (event) => { seen.push(event.type); });
    input.value = 'x';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(seen).to.deep.equal(['input', 'change']);
  });

  it('relays one native InputEvent with its editing payload and typed alias', async () => {
    const el = (await fixture(html`<lr-input></lr-input>`)) as LyraInput;
    const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
    const nativeEvents: InputEvent[] = [];
    const aliases: CustomEvent[] = [];
    el.addEventListener('input', (event) => nativeEvents.push(event as InputEvent));
    el.addEventListener('lr-input', (event) => aliases.push(event as CustomEvent));

    input.value = 'x';
    input.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      composed: true,
      data: 'x',
      inputType: 'insertText',
    }));

    expect(nativeEvents).to.have.length(1);
    expect(nativeEvents[0] instanceof InputEvent).to.be.true;
    expect(nativeEvents[0].target === el).to.be.true;
    expect(nativeEvents[0].data).to.equal('x');
    expect(nativeEvents[0].inputType).to.equal('insertText');
    expect(aliases).to.have.length(1);
    expect(aliases[0].detail).to.deep.equal({ value: 'x' });
  });

  it('exposes exactly one native focus/blur pair plus lr aliases', async () => {
    const el = (await fixture(html`<lr-input></lr-input>`)) as LyraInput;
    const nativeEvents: FocusEvent[] = [];
    const aliases: string[] = [];
    for (const type of ['focus', 'blur']) {
      el.addEventListener(type, (event) => nativeEvents.push(event as FocusEvent));
    }
    for (const type of ['lr-focus', 'lr-blur']) {
      el.addEventListener(type, () => aliases.push(type));
    }

    el.focus();
    el.blur();

    expect(nativeEvents.map((event) => event.type)).to.deep.equal(['focus', 'blur']);
    expect(nativeEvents.every((event) => event instanceof FocusEvent)).to.be.true;
    expect(nativeEvents.every((event) => event.target === el)).to.be.true;
    expect(aliases).to.deep.equal(['lr-focus', 'lr-blur']);
  });

  it('updates value and fires lr-input on user typing', async () => {
    const el = (await fixture(html`<lr-input></lr-input>`)) as LyraInput;
    const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
    input.value = 'hello';
    setTimeout(() => input.dispatchEvent(new Event('input', { bubbles: true })));
    const ev = await oneEvent(el, 'lr-input');
    expect(ev.detail).to.deep.equal({ value: 'hello' });
    expect(el.value).to.equal('hello');
  });

  it('fires lr-change on the native change timing', async () => {
    const el = (await fixture(html`<lr-input></lr-input>`)) as LyraInput;
    const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
    input.value = 'hello';
    setTimeout(() => input.dispatchEvent(new Event('change', { bubbles: true })));
    const ev = await oneEvent(el, 'lr-change');
    expect(ev.detail).to.deep.equal({ value: 'hello' });
  });

  describe('adornments and clearable input', () => {
    it('renders start/end adornment slots inside the input wrapper', async () => {
      const el = (await fixture(html`
        <lr-input aria-label="Search"><span slot="start">⌕</span><kbd slot="end">⌘K</kbd></lr-input>
      `)) as LyraInput;
      const start = el.shadowRoot!.querySelector('[part="start"]') as HTMLElement;
      const end = el.shadowRoot!.querySelector('[part="end"]') as HTMLElement;
      expect(start.hidden).to.be.false;
      expect(end.hidden).to.be.false;
      expect(start.querySelector('slot')!.assignedElements()).to.have.length(1);
      expect(end.querySelector('slot')!.assignedElements()).to.have.length(1);
    });

    it('clears text/search values with native and typed events, then restores input focus', async () => {
      for (const type of ['text', 'search'] as const) {
        const el = (await fixture(html`
          <lr-input type=${type} clearable value="query" aria-label="Search"></lr-input>
        `)) as LyraInput;
        const native = el.shadowRoot!.querySelector('input') as HTMLInputElement;
        const button = el.shadowRoot!.querySelector('[part="clear-button"]') as HTMLButtonElement;
        expect(el.clearable, type).to.be.true;
        expect(button.getAttribute('aria-label'), type).to.equal('Clear');
        const seen: string[] = [];
        for (const name of ['input', 'lr-input', 'change', 'lr-change', 'lr-clear']) {
          el.addEventListener(name, () => seen.push(name));
        }
        button.click();
        await el.updateComplete;
        expect(el.value, type).to.equal('');
        expect(native.value, type).to.equal('');
        expect(seen, type).to.deep.equal(['input', 'lr-input', 'change', 'lr-change', 'lr-clear']);
        expect(el.shadowRoot!.activeElement?.id, type).to.equal('input');
        expect(el.shadowRoot!.querySelector('[part="clear-button"]'), type).to.not.exist;
      }
    });

    it('keeps clear disabled for disabled/read-only inputs and limits it to text/search types', async () => {
      const disabled = (await fixture(html`
        <lr-input clearable disabled value="query"></lr-input>
      `)) as LyraInput;
      expect((disabled.shadowRoot!.querySelector('[part="clear-button"]') as HTMLButtonElement).disabled).to.be.true;

      const readonly = (await fixture(html`
        <lr-input clearable readonly value="query"></lr-input>
      `)) as LyraInput;
      expect(readonly.readonly).to.be.true;
      expect((readonly.shadowRoot!.querySelector('input') as HTMLInputElement).readOnly).to.be.true;
      expect((readonly.shadowRoot!.querySelector('[part="clear-button"]') as HTMLButtonElement).disabled).to.be.true;

      const email = (await fixture(html`
        <lr-input type="email" clearable value="user@example.com"></lr-input>
      `)) as LyraInput;
      expect(email.shadowRoot!.querySelector('[part="clear-button"]')).to.not.exist;
    });

    it('onClear() guard: no-ops when disabled, read-only, or the value is already empty', async () => {
      const el = (await fixture(html`<lr-input clearable value="query"></lr-input>`)) as LyraInput;
      const handlers = el as unknown as { onClear: () => void };
      let clearCount = 0;
      el.addEventListener('lr-clear', () => { clearCount += 1; });

      el.disabled = true;
      handlers.onClear();
      expect(el.value).to.equal('query');
      el.disabled = false;

      el.readonly = true;
      handlers.onClear();
      expect(el.value).to.equal('query');
      el.readonly = false;

      el.value = '';
      handlers.onClear();
      expect(clearCount).to.equal(0);
    });

    it('is accessible with populated adornments and a clear action', async () => {
      const el = await fixture(html`
        <lr-input clearable value="query" aria-label="Search">
          <span slot="start" aria-hidden="true">⌕</span>
          <span slot="end" aria-hidden="true">⌘K</span>
        </lr-input>
      `);
      expect(el.shadowRoot!.querySelector('[part="clear-button"]')).to.exist;
      await expect(el).to.be.accessible();
    });
  });

  describe('label/hint/error chrome', () => {
    it('renders no chrome by default', async () => {
      const el = (await fixture(html`<lr-input></lr-input>`)) as LyraInput;
      const label = el.shadowRoot!.querySelector('[part="form-control-label"]') as HTMLElement;
      expect(label.hidden).to.be.true;
    });

    it('shows label/hint/error text and wires aria-describedby', async () => {
      const el = (await fixture(
        html`<lr-input label="Email" hint="We'll never share it." error-text="Required"></lr-input>`,
      )) as LyraInput;
      const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
      expect(input.getAttribute('aria-describedby')).to.equal('input-error input-hint');
    });
  });

  describe('accessibleLabel', () => {
    it('falls back to placeholder', async () => {
      const el = (await fixture(html`<lr-input placeholder="Search"></lr-input>`)) as LyraInput;
      const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
      expect(input.getAttribute('aria-label')).to.equal('Search');
    });

    it('a host aria-label wins over label and placeholder', async () => {
      const el = (await fixture(
        html`<lr-input aria-label="Search field" label="Query" placeholder="Type here"></lr-input>`,
      )) as LyraInput;
      const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
      expect(input.getAttribute('aria-label')).to.equal('Search field');
    });
  });

  describe('type="password"', () => {
    it('renders a password-toggle button that flips the native input type and passwordVisible', async () => {
      const el = (await fixture(
        html`<lr-input type="password" password-toggle label="Password"></lr-input>`,
      )) as LyraInput;
      const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
      const toggle = el.shadowRoot!.querySelector('[part="password-toggle"]') as HTMLButtonElement;
      expect(input.type).to.equal('password');
      toggle.click();
      await el.updateComplete;
      expect(el.passwordVisible).to.be.true;
      expect(input.type).to.equal('text');
      toggle.click();
      await el.updateComplete;
      expect(el.passwordVisible).to.be.false;
      expect(input.type).to.equal('password');
    });

    it('omits the password-toggle button for every other type', async () => {
      const el = (await fixture(html`<lr-input type="email" password-toggle></lr-input>`)) as LyraInput;
      expect(el.shadowRoot!.querySelectorAll('[part="password-toggle"]').length).to.equal(0);
    });
  });

  describe('type="search"', () => {
    it('is a valid LyraInputType and forwards straight through to a native type="search" input, unlike password/number/email it has no special-cased behavior', async () => {
      const el = (await fixture(html`<lr-input></lr-input>`)) as LyraInput;
      // A real, typed property assignment (not a template attribute string), so this line only
      // compiles once 'search' is a member of the exported `LyraInputType` union.
      el.type = 'search';
      await el.updateComplete;
      expect(el.type).to.equal('search');
      const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
      expect(input.type).to.equal('search');
      expect(el.shadowRoot!.querySelectorAll('[part="password-toggle"]').length).to.equal(0);
    });

    it('supports typing and emits lr-input like every other plain-text type', async () => {
      const el = (await fixture(html`<lr-input type="search"></lr-input>`)) as LyraInput;
      const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
      input.value = 'workflows';
      setTimeout(() => input.dispatchEvent(new Event('input', { bubbles: true })));
      const ev = await oneEvent(el, 'lr-input');
      expect(ev.detail).to.deep.equal({ value: 'workflows' });
      expect(el.value).to.equal('workflows');
    });
  });

  describe('validity', () => {
    it('type="email" rejects a malformed address via native constraint validation', async () => {
      const el = (await fixture(html`<lr-input type="email"></lr-input>`)) as LyraInput;
      el.value = 'not-an-email';
      expect(el.checkValidity()).to.be.false;
      el.value = 'ada@example.com';
      expect(el.checkValidity()).to.be.true;
    });

    it('type="number" enforces min/max/step', async () => {
      const el = (await fixture(
        html`<lr-input type="number" min="1" max="10" step="1"></lr-input>`,
      )) as LyraInput;
      el.value = '99';
      expect(el.checkValidity()).to.be.false;
      el.value = '5';
      expect(el.checkValidity()).to.be.true;
    });

    it('required + empty is invalid, matching every other FormAssociated control', async () => {
      const el = (await fixture(html`<lr-input required></lr-input>`)) as LyraInput;
      expect(el.checkValidity()).to.be.false;
      el.value = 'anything';
      expect(el.checkValidity()).to.be.true;
    });

    it('type="number" rejects a non-numeric value silently sanitized away by the native input', async () => {
      const el = (await fixture(html`<lr-input type="number"></lr-input>`)) as LyraInput;
      el.value = 'not-a-number';
      expect(el.checkValidity()).to.be.false;
    });

    it('recomputes validity when max narrows below the current value without a value write', async () => {
      const el = (await fixture(
        html`<lr-input type="number" max="10" value="5"></lr-input>`,
      )) as LyraInput;
      expect(el.checkValidity()).to.be.true;
      el.max = 3;
      await el.updateComplete;
      expect(el.checkValidity()).to.be.false;
    });

    it('does not reassign native.value (and reset the caret) when it already agrees with the reactive value', async () => {
      // Regression test for an unconditional `native.value = this.value` write on every keystroke:
      // even when the two already agree, reassigning `.value` moves the caret to the end in every
      // browser, so a user editing in the middle of a number got bounced to the end on every keypress.
      const el = (await fixture(html`<lr-input value="12345"></lr-input>`)) as LyraInput;
      const native = el.shadowRoot!.querySelector('input') as HTMLInputElement;
      native.setSelectionRange(2, 2);
      native.dispatchEvent(new Event('input', { bubbles: true }));
      await el.updateComplete;
      expect(native.selectionStart).to.equal(2);
    });

    it('forwards minlength/maxlength/pattern onto the native input', async () => {
      const el = (await fixture(
        html`<lr-input minlength="2" maxlength="8" pattern="[a-z]+"></lr-input>`,
      )) as LyraInput;
      const native = el.shadowRoot!.querySelector('input') as HTMLInputElement;
      expect(el.minlength).to.equal(2);
      expect(el.maxlength).to.equal(8);
      expect(el.pattern).to.equal('[a-z]+');
      expect(native.minLength).to.equal(2);
      expect(native.maxLength).to.equal(8);
      expect(native.pattern).to.equal('[a-z]+');
    });

    it('bridges tooLong to the host validity', async () => {
      const el = (await fixture(html`<lr-input maxlength="3"></lr-input>`)) as LyraInput;
      const native = el.shadowRoot!.querySelector('input') as HTMLInputElement;
      native.focus();
      native.value = 'abcdef';
      native.dispatchEvent(new Event('input', { bubbles: true }));
      await el.updateComplete;

      expect(el.validity.tooLong).to.equal(true);
      expect(el.checkValidity()).to.equal(false);
    });

    it('bridges tooShort to the host validity', async () => {
      const el = (await fixture(html`<lr-input minlength="5"></lr-input>`)) as LyraInput;
      const native = el.shadowRoot!.querySelector('input') as HTMLInputElement;
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

    it('bridges patternMismatch to the host validity', async () => {
      const el = (await fixture(html`<lr-input pattern="[a-z]+"></lr-input>`)) as LyraInput;
      const native = el.shadowRoot!.querySelector('input') as HTMLInputElement;
      native.focus();
      native.value = 'ABC123';
      native.dispatchEvent(new Event('input', { bubbles: true }));
      await el.updateComplete;

      expect(el.validity.patternMismatch).to.equal(true);
      expect(el.checkValidity()).to.equal(false);
      native.value = 'abc';
      native.dispatchEvent(new Event('input', { bubbles: true }));
      await el.updateComplete;
      expect(el.validity.patternMismatch).to.equal(false);
      expect(el.checkValidity()).to.equal(true);
    });

    it('reports a programmatically assigned over-length value as invalid, despite the native dirty-value flag', async () => {
      const el = (await fixture(html`<lr-input maxlength="3"></lr-input>`)) as LyraInput;
      el.value = 'abcdef';
      expect(el.validity.tooLong).to.equal(true);
      expect(el.checkValidity()).to.equal(false);
      el.value = 'ab';
      expect(el.validity.tooLong).to.equal(false);
      expect(el.checkValidity()).to.equal(true);
    });

    it('recomputes validity when maxlength narrows below the current value without a value write', async () => {
      const el = (await fixture(html`<lr-input value="abcdef"></lr-input>`)) as LyraInput;
      expect(el.checkValidity()).to.equal(true);
      el.maxlength = 3;
      await el.updateComplete;
      expect(el.validity.tooLong).to.equal(true);
      expect(el.checkValidity()).to.equal(false);
    });

    it('leaves maxlength inert on type="number", exactly as the platform does', async () => {
      // The platform ignores minlength/maxlength on number/time, so the script-value supplement
      // must ignore them there too rather than being stricter than the control it wraps --
      // otherwise `lr-number-input` would reject values a native <input type="number"> accepts.
      const numeric = (await fixture(
        html`<lr-input type="number" maxlength="3"></lr-input>`,
      )) as LyraInput;
      numeric.value = '123456';
      expect(numeric.validity.tooLong).to.equal(false);
      expect(numeric.checkValidity()).to.equal(true);

      // The same limit and the same value length on a text input is the contrasting case that
      // proves the assertion above is about the type, not about the constraint being unwired.
      const text = (await fixture(html`<lr-input type="text" maxlength="3"></lr-input>`)) as LyraInput;
      text.value = '123456';
      expect(text.validity.tooLong).to.equal(true);
      expect(text.checkValidity()).to.equal(false);
    });

    it('unset regression: renders and validates exactly as before when minlength/maxlength/pattern are unset', async () => {
      const el = (await fixture(html`<lr-input></lr-input>`)) as LyraInput;
      const native = el.shadowRoot!.querySelector('input') as HTMLInputElement;
      expect(el.minlength).to.equal(undefined);
      expect(el.maxlength).to.equal(undefined);
      expect(el.pattern).to.equal(undefined);
      expect(native.hasAttribute('minlength')).to.equal(false);
      expect(native.hasAttribute('maxlength')).to.equal(false);
      expect(native.hasAttribute('pattern')).to.equal(false);
      // -1 / '' are the native "no constraint" sentinels for the absent attributes.
      expect(native.minLength).to.equal(-1);
      expect(native.maxLength).to.equal(-1);
      expect(native.pattern).to.equal('');

      el.value = 'a value far longer than any plausible default limit would ever allow';
      expect(el.checkValidity()).to.equal(true);
      expect(el.validity.tooLong).to.equal(false);
      expect(el.validity.tooShort).to.equal(false);
      expect(el.validity.patternMismatch).to.equal(false);
      expect(el.validationMessage).to.equal('');
    });

    it('accepts step="any" instead of coercing to NaN and blocking decimals', async () => {
      const el = (await fixture(
        html`<lr-input type="number" step="any" value="1.5"></lr-input>`,
      )) as LyraInput;
      const native = el.shadowRoot!.querySelector('input') as HTMLInputElement;
      expect(native.getAttribute('step')).to.equal('any');
      expect(el.checkValidity()).to.be.true;
    });
  });

  describe('touched state', () => {
    it('reportValidity() on an untouched required input marks it invalid', async () => {
      const el = (await fixture(html`<lr-input required></lr-input>`)) as LyraInput;
      const native = el.shadowRoot!.querySelector('input') as HTMLInputElement;
      expect(native.getAttribute('aria-invalid')).to.equal('false');
      el.reportValidity();
      await el.updateComplete;
      expect(native.getAttribute('aria-invalid')).to.equal('true');
    });

    it('clears touched (and aria-invalid) on form reset', async () => {
      const form = (await fixture(html`
        <form><lr-input name="x" required></lr-input></form>
      `)) as HTMLFormElement;
      const el = form.querySelector('lr-input') as LyraInput;
      const native = el.shadowRoot!.querySelector('input') as HTMLInputElement;
      native.dispatchEvent(new Event('blur', { bubbles: true }));
      await el.updateComplete;
      expect(native.getAttribute('aria-invalid')).to.equal('true');
      form.reset();
      await el.updateComplete;
      expect(native.getAttribute('aria-invalid')).to.equal('false');
    });
  });

  describe('.strings override', () => {
    it('localizes the required-field validation message (the pre-first-render fallback path, before the native input mounts)', () => {
      // updateValidity()'s `!native` branch -- the base mixin's plain required-and-empty check,
      // used only before the internal native <input> has rendered -- is the one call site that
      // actually reaches this.localize('fieldRequired'); once rendered, validity delegates to the
      // native input's own (unlocalized) validationMessage instead, so this must observe the
      // pre-render window specifically rather than going through fixture() (which already awaits
      // the first render).
      const el = document.createElement('lr-input') as LyraInput;
      el.strings = { fieldRequired: 'Ce champ est obligatoire.' };
      el.required = true;
      expect(el.validationMessage).to.equal('Ce champ est obligatoire.');
    });

    it('localizes the default accessible-name fallback', async () => {
      const el = (await fixture(html`<lr-input></lr-input>`)) as LyraInput;
      el.strings = { inputLabel: 'Texte' };
      await el.updateComplete;
      const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
      expect(input.getAttribute('aria-label')).to.equal('Texte');
    });

    it('localizes the password-toggle button labels', async () => {
      const el = (await fixture(html`<lr-input type="password" password-toggle></lr-input>`)) as LyraInput;
      el.strings = { showPassword: 'Afficher', hidePassword: 'Masquer' };
      await el.updateComplete;
      const toggle = el.shadowRoot!.querySelector('[part="password-toggle"]') as HTMLButtonElement;
      expect(toggle.getAttribute('aria-label')).to.equal('Afficher');
      toggle.click();
      await el.updateComplete;
      expect(toggle.getAttribute('aria-label')).to.equal('Masquer');
    });

    it('localizes the sanitized-away (badInput) validation message', async () => {
      const el = (await fixture(html`<lr-input type="number"></lr-input>`)) as LyraInput;
      el.strings = { valueInvalid: 'Valeur invalide.' };
      el.value = 'not-a-number';
      await el.updateComplete;
      expect(el.validationMessage).to.equal('Valeur invalide.');
    });

    it('localizes the clear-button accessible name', async () => {
      const el = (await fixture(
        html`<lr-input clearable value="query" aria-label="Search"></lr-input>`,
      )) as LyraInput;
      el.strings = { clear: 'Effacer' };
      await el.updateComplete;
      const button = el.shadowRoot!.querySelector('[part="clear-button"]') as HTMLButtonElement;
      expect(button.getAttribute('aria-label')).to.equal('Effacer');
    });
  });

  describe('selection API passthrough', () => {
    it('forwards selectionStart/selectionEnd getters and setters to the native input', async () => {
      const el = (await fixture(html`<lr-input value="hello world"></lr-input>`)) as LyraInput;
      el.selectionStart = 2;
      el.selectionEnd = 5;
      const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
      expect(input.selectionStart).to.equal(2);
      expect(input.selectionEnd).to.equal(5);
      expect(el.selectionStart).to.equal(2);
      expect(el.selectionEnd).to.equal(5);
    });

    it('forwards setSelectionRange() to the native input', async () => {
      const el = (await fixture(html`<lr-input value="hello world"></lr-input>`)) as LyraInput;
      el.setSelectionRange(1, 4, 'backward');
      const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
      expect(input.selectionStart).to.equal(1);
      expect(input.selectionEnd).to.equal(4);
      expect(input.selectionDirection).to.equal('backward');
    });

    it('forwards setRangeText() to the native input and syncs the reactive value', async () => {
      const el = (await fixture(html`<lr-input value="hello world"></lr-input>`)) as LyraInput;
      el.setRangeText('there', 6, 11);
      expect(el.value).to.equal('hello there');
      const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
      expect(input.value).to.equal('hello there');
    });

    it('setRangeText() replaces the current selection when called with no start/end (native single-arg overload)', async () => {
      const el = (await fixture(html`<lr-input value="hello world"></lr-input>`)) as LyraInput;
      el.setSelectionRange(0, 5); // select "hello"
      el.setRangeText('goodbye');
      expect(el.value).to.equal('goodbye world');
      const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
      expect(input.value).to.equal('goodbye world');
    });

    it('normalizes a nullish selectionStart/selectionEnd assignment to 0 on the native input', async () => {
      const el = (await fixture(html`<lr-input value="hello world"></lr-input>`)) as LyraInput;
      const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
      el.selectionStart = null;
      el.selectionEnd = null;
      expect(input.selectionStart).to.equal(0);
      expect(input.selectionEnd).to.equal(0);
    });

    it('exposes the native input via the public input getter', async () => {
      const el = (await fixture(html`<lr-input></lr-input>`)) as LyraInput;
      expect(el.input).to.equal(el.shadowRoot!.querySelector('input'));
    });

    it('forwards focus() and blur() to the native input', async () => {
      const el = (await fixture(html`<lr-input></lr-input>`)) as LyraInput;
      el.focus();
      expect(el.shadowRoot!.activeElement === el.input).to.be.true;
      el.blur();
      expect(el.shadowRoot!.activeElement).to.equal(null);
    });

    it('forwards select() to select the full native input value', async () => {
      const el = (await fixture(html`<lr-input value="hello world"></lr-input>`)) as LyraInput;
      el.select();
      expect(el.selectionStart).to.equal(0);
      expect(el.selectionEnd).to.equal(el.value.length);
    });
  });

  describe('forwarding getters/setters/methods before first render', () => {
    it('returns null / no-ops instead of throwing when called before the native input has rendered', () => {
      const el = document.createElement('lr-input') as LyraInput;
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

    it('onInput/onChange no-op if somehow invoked before the native input has rendered', () => {
      const el = document.createElement('lr-input') as LyraInput;
      const handlers = el as unknown as { onInput: () => void; onChange: () => void };
      let seen = 0;
      el.addEventListener('lr-input', () => { seen += 1; });
      el.addEventListener('lr-change', () => { seen += 1; });
      handlers.onInput();
      handlers.onChange();
      expect(el.value).to.equal('');
      expect(seen).to.equal(0);
    });
  });

  it('is accessible', async () => {
    const el = await fixture(html`<lr-input label="Name"></lr-input>`);
    await expect(el).to.be.accessible();
  });

  it('is accessible as type="password" with the toggle rendered', async () => {
    const el = await fixture(html`<lr-input type="password" password-toggle label="Password"></lr-input>`);
    expect(el.shadowRoot!.querySelectorAll('[part="password-toggle"]').length).to.equal(1);
    await expect(el).to.be.accessible();
  });

  it('gives the password-toggle button a :hover treatment', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/\[part='password-toggle'\]:hover\s*\{[^}]+\}/);
  });

  it('resets native appearance unconditionally for search, and restyles (not suppresses) the time picker indicator', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    // Previously gated behind :host([clearable]) -- the common non-clearable case kept the glyph.
    expect(css).to.match(/\[part='input'\]\[type='search'\]::-webkit-search-cancel-button/);
    expect(css).to.not.match(
      /:host\(\[clearable\]\) \[part='input'\]\[type='search'\]::-webkit-search-cancel-button/,
    );
    expect(css).to.match(
      /\[part='input'\]\[type='time'\]::-webkit-calendar-picker-indicator\s*\{[^}]*cursor:\s*pointer/,
    );
  });

  it('supports size="2xs": tighter padding/font-size than xs, and the ladder\'s tightest floor', async () => {
    const el = (await fixture(html`<lr-input size="2xs" aria-label="Name"></lr-input>`)) as LyraInput;
    const xsEl = (await fixture(html`<lr-input size="xs" aria-label="Name"></lr-input>`)) as LyraInput;
    const field = (host: LyraInput) => host.shadowRoot!.querySelector('[part="input"]') as HTMLElement;
    const row = (host: LyraInput) => host.shadowRoot!.querySelector('[part="input-wrapper"]') as HTMLElement;
    expect(parseFloat(getComputedStyle(field(el)).fontSize)).to.be.lessThan(
      parseFloat(getComputedStyle(field(xsEl)).fontSize),
    );
    expect(parseFloat(getComputedStyle(row(el)).paddingInlineStart)).to.be.lessThan(
      parseFloat(getComputedStyle(row(xsEl)).paddingInlineStart),
    );
    expect(getComputedStyle(row(el)).minBlockSize).to.equal('20px');
  });

  it('reflects size="2xs" as a host attribute', async () => {
    const el = (await fixture(html`<lr-input size="2xs"></lr-input>`)) as LyraInput;
    expect(el.size).to.equal('2xs');
    expect(el.getAttribute('size')).to.equal('2xs');
  });

  describe('exact-height escape hatch', () => {
    const wrapper = (el: LyraInput) =>
      el.shadowRoot!.querySelector('[part="input-wrapper"]') as HTMLElement;

    it('keeps the per-size min-height floor when --lr-input-control-height is unset', async () => {
      const mEl = (await fixture(html`<lr-input aria-label="Name"></lr-input>`)) as LyraInput;
      const sEl = (await fixture(html`<lr-input size="s" aria-label="Name"></lr-input>`)) as LyraInput;
      expect(getComputedStyle(wrapper(mEl)).minBlockSize).to.equal('40px');
      expect(getComputedStyle(wrapper(sEl)).minBlockSize).to.equal('30px');
    });

    it('pins an exact control height with no ::part() rule, at the default and non-default sizes', async () => {
      const mEl = (await fixture(html`<lr-input aria-label="Name"></lr-input>`)) as LyraInput;
      mEl.style.setProperty('--lr-input-control-height', '44px');
      await mEl.updateComplete;
      expect(getComputedStyle(wrapper(mEl)).blockSize).to.equal('44px');
      expect(getComputedStyle(wrapper(mEl)).minBlockSize).to.equal('44px');

      const sEl = (await fixture(html`<lr-input size="s" aria-label="Name"></lr-input>`)) as LyraInput;
      sEl.style.setProperty('--lr-input-control-height', '44px');
      await sEl.updateComplete;
      expect(getComputedStyle(wrapper(sEl)).blockSize).to.equal('44px');
    });
  });

  describe('gap/radius custom properties', () => {
    const wrapper = (el: LyraInput) =>
      el.shadowRoot!.querySelector('[part="input-wrapper"]') as HTMLElement;

    it('exposes --lr-input-gap and --lr-input-radius, defaulting to the pre-existing literals', async () => {
      const el = (await fixture(html`<lr-input aria-label="Name"></lr-input>`)) as LyraInput;
      const cs = getComputedStyle(wrapper(el));
      expect(cs.gap).to.equal('4px');
      expect(cs.borderRadius).to.equal('6px');
    });

    it('retunes the input-wrapper gap and corner radius with no ::part() rule', async () => {
      const el = (await fixture(html`<lr-input aria-label="Name"></lr-input>`)) as LyraInput;
      el.style.setProperty('--lr-input-gap', '12px');
      el.style.setProperty('--lr-input-radius', '3px');
      await el.updateComplete;
      const cs = getComputedStyle(wrapper(el));
      expect(cs.gap).to.equal('12px');
      expect(cs.borderRadius).to.equal('3px');
    });

    it('keeps the gap constant across tiers while the radius follows the shared ladder', async () => {
      const wrapperOf = (host: LyraInput) =>
        host.shadowRoot!.querySelector('[part="input-wrapper"]') as HTMLElement;
      const mEl = (await fixture(html`<lr-input aria-label="Name"></lr-input>`)) as LyraInput;
      const xsEl = (await fixture(html`<lr-input size="xs" aria-label="Name"></lr-input>`)) as LyraInput;
      // The adornment gap is deliberately outside the ladder -- it never varied by tier.
      expect(getComputedStyle(wrapperOf(mEl)).gap).to.equal('4px');
      expect(getComputedStyle(wrapperOf(xsEl)).gap).to.equal('4px');
      // The radius does vary: a 6px corner on a 24px-tall control reads as a lozenge.
      expect(getComputedStyle(wrapperOf(mEl)).borderTopLeftRadius).to.equal('6px');
      expect(getComputedStyle(wrapperOf(xsEl)).borderTopLeftRadius).to.equal('2px');
    });
  });
});

it('dims the input-wrapper chrome via the :disabled pseudo-class when disabled directly or only through an ancestor fieldset', async () => {
  // :host([disabled]) alone only ever matches a directly-set disabled attribute -- a form-
  // associated custom element (FormAssociated mixin, `static formAssociated = true`) is also
  // :disabled when an ancestor <fieldset disabled> cascades into it, and only :host(:disabled)
  // tracks that. Mirrors lr-date-input's/lr-radio's identical fix.
  const direct = (await fixture(html`<lr-input disabled></lr-input>`)) as LyraInput;
  const directWrapper = direct.shadowRoot!.querySelector('[part="input-wrapper"]') as HTMLElement;
  expect(getComputedStyle(directWrapper).opacity).to.equal(
    getComputedStyle(directWrapper).getPropertyValue('--lr-opacity-disabled').trim(),
  );
  expect(getComputedStyle(directWrapper).cursor).to.equal('not-allowed');

  const form = (await fixture(html`
    <form><fieldset disabled><lr-input></lr-input></fieldset></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-input') as LyraInput;
  const wrapper = el.shadowRoot!.querySelector('[part="input-wrapper"]') as HTMLElement;
  expect(el.hasAttribute('disabled'), 'the host attribute must not be mutated by fieldset cascading').to.be.false;
  expect(getComputedStyle(wrapper).opacity).to.equal(
    getComputedStyle(wrapper).getPropertyValue('--lr-opacity-disabled').trim(),
  );
  expect(getComputedStyle(wrapper).cursor).to.equal('not-allowed');
});

it('forwards host click to the native input and suppresses it while effectively disabled', async () => {
  const form = (await fixture(html`
    <form><fieldset><lr-input></lr-input></fieldset></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-input') as LyraInput;
  const fieldset = form.querySelector('fieldset') as HTMLFieldSetElement;
  const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
  let clicks = 0;
  input.addEventListener('click', () => clicks++);

  el.click();
  expect(clicks).to.equal(1);
  fieldset.disabled = true;
  el.click();
  expect(clicks).to.equal(1);
});

// -- Slotted supporting text ------------------------------------------------

it('tracks slotted hint and error content through slotchange', async () => {
  const el = (await fixture(html`
    <lr-input label="Name">
      <span slot="hint">Full legal name</span>
      <span slot="error">Required</span>
    </lr-input>
  `)) as LyraInput;
  await el.updateComplete;
  const flags = el as unknown as { hasHintSlot: boolean; hasErrorSlot: boolean };
  expect(flags.hasHintSlot).to.be.true;
  expect(flags.hasErrorSlot).to.be.true;

  el.querySelector('[slot="hint"]')!.remove();
  el.querySelector('[slot="error"]')!.remove();
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  await el.updateComplete;
  expect(flags.hasHintSlot).to.be.false;
  expect(flags.hasErrorSlot).to.be.false;
});

// -- 8.0 surface: appearance / pill / spin buttons / picker + step methods ---

describe('lr-input appearance', () => {
  const wrapper = (el: LyraInput) => el.shadowRoot!.querySelector('[part="input-wrapper"]') as HTMLElement;
  const TRANSPARENT = 'rgba(0, 0, 0, 0)';

  it('defaults to appearance="filled-outlined" and reflects it', async () => {
    const el = (await fixture(html`<lr-input aria-label="Name"></lr-input>`)) as LyraInput;
    expect(el.appearance).to.equal('filled-outlined');
    expect(el.getAttribute('appearance')).to.equal('filled-outlined');
  });

  it('keeps the committed fill + border rendering at the default appearance', async () => {
    const el = (await fixture(html`<lr-input aria-label="Name"></lr-input>`)) as LyraInput;
    const cs = getComputedStyle(wrapper(el));
    expect(cs.backgroundColor).to.not.equal(TRANSPARENT);
    expect(cs.borderTopColor).to.not.equal(TRANSPARENT);
  });

  it('renders "outlined" with no fill and "filled" with no border colour', async () => {
    const outlined = (await fixture(html`<lr-input appearance="outlined" aria-label="a"></lr-input>`)) as LyraInput;
    const filled = (await fixture(html`<lr-input appearance="filled" aria-label="b"></lr-input>`)) as LyraInput;
    expect(getComputedStyle(wrapper(outlined)).backgroundColor).to.equal(TRANSPARENT);
    expect(getComputedStyle(wrapper(outlined)).borderTopColor).to.not.equal(TRANSPARENT);
    expect(getComputedStyle(wrapper(filled)).borderTopColor).to.equal(TRANSPARENT);
    expect(getComputedStyle(wrapper(filled)).backgroundColor).to.not.equal(TRANSPARENT);
  });

  it('renders "plain" with neither fill nor border, and "accent" tinted away from "outlined"', async () => {
    const plain = (await fixture(html`<lr-input appearance="plain" aria-label="a"></lr-input>`)) as LyraInput;
    const accent = (await fixture(html`<lr-input appearance="accent" aria-label="b"></lr-input>`)) as LyraInput;
    const outlined = (await fixture(html`<lr-input appearance="outlined" aria-label="c"></lr-input>`)) as LyraInput;
    expect(getComputedStyle(wrapper(plain)).backgroundColor).to.equal(TRANSPARENT);
    expect(getComputedStyle(wrapper(plain)).borderTopColor).to.equal(TRANSPARENT);
    expect(getComputedStyle(wrapper(accent)).borderTopColor).to.not.equal(
      getComputedStyle(wrapper(outlined)).borderTopColor,
    );
    expect(getComputedStyle(wrapper(accent)).backgroundColor).to.not.equal(TRANSPARENT);
  });

  it('exposes --lr-input-fill/--lr-input-border-color as retheme knobs without a ::part() rule', async () => {
    const el = (await fixture(html`<lr-input aria-label="Name"></lr-input>`)) as LyraInput;
    el.style.setProperty('--lr-input-fill', 'rgb(1, 2, 3)');
    el.style.setProperty('--lr-input-border-color', 'rgb(4, 5, 6)');
    await el.updateComplete;
    const cs = getComputedStyle(wrapper(el));
    expect(cs.backgroundColor).to.equal('rgb(1, 2, 3)');
    expect(cs.borderTopColor).to.equal('rgb(4, 5, 6)');
  });

  it('draws a pill-shaped control row when pill is set, and the default radius otherwise', async () => {
    const plainEl = (await fixture(html`<lr-input aria-label="a"></lr-input>`)) as LyraInput;
    const pillEl = (await fixture(html`<lr-input pill aria-label="b"></lr-input>`)) as LyraInput;
    expect(plainEl.pill).to.be.false;
    expect(pillEl.pill).to.be.true;
    expect(pillEl.getAttribute('pill')).to.equal('');
    expect(getComputedStyle(wrapper(plainEl)).borderRadius).to.equal('6px');
    expect(getComputedStyle(wrapper(pillEl)).borderRadius).to.equal('999px');
  });
});

describe('lr-input without-spin-buttons', () => {
  const nativeOf = (el: LyraInput) => el.shadowRoot!.querySelector('input') as HTMLInputElement;

  it('leaves the browser spin buttons in place by default', async () => {
    const el = (await fixture(html`<lr-input type="number" aria-label="Qty"></lr-input>`)) as LyraInput;
    expect(el.withoutSpinButtons).to.be.false;
    expect(getComputedStyle(nativeOf(el)).appearance).to.not.equal('textfield');
  });

  it('suppresses them when without-spin-buttons is set', async () => {
    const el = (await fixture(
      html`<lr-input type="number" without-spin-buttons aria-label="Qty"></lr-input>`,
    )) as LyraInput;
    expect(el.withoutSpinButtons).to.be.true;
    expect(getComputedStyle(nativeOf(el)).appearance).to.equal('textfield');
  });
});

describe('lr-input password-toggle opt-in', () => {
  it('renders no toggle for type="password" until password-toggle is set', async () => {
    const el = (await fixture(html`<lr-input type="password" label="Password"></lr-input>`)) as LyraInput;
    expect(el.passwordToggle).to.be.false;
    expect(el.shadowRoot!.querySelectorAll('[part="password-toggle"]').length).to.equal(0);
  });

  it('renders the toggle once opted in, and it still flips the native type', async () => {
    const el = (await fixture(
      html`<lr-input type="password" password-toggle label="Password"></lr-input>`,
    )) as LyraInput;
    const toggle = el.shadowRoot!.querySelector('[part="password-toggle"]') as HTMLButtonElement;
    expect(el.shadowRoot!.querySelectorAll('[part="password-toggle"]').length).to.equal(1);
    toggle.click();
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('input') as HTMLInputElement).type).to.equal('text');
  });

  it('never renders the toggle for a non-password type even when opted in', async () => {
    const el = (await fixture(html`<lr-input type="email" password-toggle></lr-input>`)) as LyraInput;
    expect(el.shadowRoot!.querySelectorAll('[part="password-toggle"]').length).to.equal(0);
  });
});

describe('lr-input autofocus', () => {
  it('omits the native autofocus attribute by default and forwards it when set', async () => {
    const plainEl = (await fixture(html`<lr-input aria-label="a"></lr-input>`)) as LyraInput;
    expect(plainEl.autofocus).to.be.false;
    expect((plainEl.shadowRoot!.querySelector('input') as HTMLInputElement).hasAttribute('autofocus')).to.be.false;

    const el = (await fixture(html`<lr-input autofocus aria-label="b"></lr-input>`)) as LyraInput;
    expect(el.autofocus).to.be.true;
    expect((el.shadowRoot!.querySelector('input') as HTMLInputElement).hasAttribute('autofocus')).to.be.true;
  });
});

describe('lr-input showPicker() / stepUp() / stepDown()', () => {
  it('delegates showPicker() to the native input', async () => {
    const el = (await fixture(html`<lr-input type="time" aria-label="Start"></lr-input>`)) as LyraInput;
    const native = el.shadowRoot!.querySelector('input') as HTMLInputElement;
    let calls = 0;
    (native as unknown as { showPicker: () => void }).showPicker = () => { calls += 1; };
    el.showPicker();
    expect(calls).to.equal(1);
  });

  it('never throws without user activation, while disabled, or for a type with no picker', async () => {
    const el = (await fixture(html`<lr-input aria-label="a"></lr-input>`)) as LyraInput;
    el.showPicker();
    const disabled = (await fixture(html`<lr-input type="time" disabled aria-label="b"></lr-input>`)) as LyraInput;
    let calls = 0;
    const native = disabled.shadowRoot!.querySelector('input') as HTMLInputElement;
    (native as unknown as { showPicker: () => void }).showPicker = () => { calls += 1; };
    disabled.showPicker();
    expect(calls).to.equal(0);
  });

  it('steps the value by `step` and keeps the component value in sync', async () => {
    const el = (await fixture(
      html`<lr-input type="number" value="4" min="0" max="10" step="2" aria-label="Qty"></lr-input>`,
    )) as LyraInput;
    el.stepUp();
    expect(el.value).to.equal('6');
    el.stepUp(2);
    expect(el.value).to.equal('10');
    el.stepDown();
    expect(el.value).to.equal('8');
    expect((el.shadowRoot!.querySelector('input') as HTMLInputElement).value).to.equal('8');
  });

  it('clamps at the declared bounds and stays silent (no input/change events)', async () => {
    const el = (await fixture(
      html`<lr-input type="number" value="9" min="0" max="10" step="1" aria-label="Qty"></lr-input>`,
    )) as LyraInput;
    const seen: string[] = [];
    el.addEventListener('input', () => seen.push('input'));
    el.addEventListener('change', () => seen.push('change'));
    el.stepUp(5);
    expect(el.value).to.equal('10');
    expect(seen).to.deep.equal([]);
  });

  it('is inert while disabled or readonly, and for a non-steppable type', async () => {
    const disabled = (await fixture(
      html`<lr-input type="number" value="1" disabled aria-label="a"></lr-input>`,
    )) as LyraInput;
    disabled.stepUp();
    expect(disabled.value).to.equal('1');

    const readonlyEl = (await fixture(
      html`<lr-input type="number" value="1" readonly aria-label="b"></lr-input>`,
    )) as LyraInput;
    readonlyEl.stepUp();
    expect(readonlyEl.value).to.equal('1');

    const text = (await fixture(html`<lr-input value="abc" aria-label="c"></lr-input>`)) as LyraInput;
    text.stepUp();
    expect(text.value).to.equal('abc');
  });
});

describe('lr-input setCustomValidity()', () => {
  // Inherited from the `FormAssociated` mixin, but exercised here too: this component overrides
  // `updateValidity()` to bridge the internal native input's own ValidityState, which is a
  // different write path than the mixin's default and could have dropped the custom layer.
  it('blocks form submission with a consumer-supplied error, and reports it as validationMessage', async () => {
    const form = (await fixture(html`
      <form><lr-input name="q" value="hi" aria-label="Query"></lr-input></form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-input') as LyraInput;
    let submits = 0;
    form.addEventListener('submit', (e) => { e.preventDefault(); submits += 1; });
    expect(el.checkValidity(), 'valid before the custom error').to.be.true;

    el.setCustomValidity('That name is taken.');
    expect(el.validity.customError).to.be.true;
    expect(el.validationMessage).to.equal('That name is taken.');
    form.requestSubmit();
    expect(submits, 'a custom error blocks submission').to.equal(0);

    el.setCustomValidity('');
    form.requestSubmit();
    expect(submits, 'submission is unblocked once the custom error is cleared').to.equal(1);
  });

  it('survives the native-validity bridge re-running, and a form reset', async () => {
    const form = (await fixture(html`
      <form><lr-input name="q" value="a" aria-label="Query"></lr-input></form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-input') as LyraInput;
    el.setCustomValidity('Rejected by the server.');

    el.value = 'abc';
    await el.updateComplete;
    expect(el.validity.customError, 'the custom error survived updateValidity()').to.be.true;

    form.reset();
    await el.updateComplete;
    expect(el.value, 'the reset restored the declarative default').to.equal('a');
    expect(el.validity.customError, 'the custom error outlives the reset').to.be.true;
    expect(el.validationMessage).to.equal('Rejected by the server.');
  });

  it('restores the computed validity when cleared, rather than forcing the control valid', async () => {
    const el = (await fixture(html`<lr-input required aria-label="Query"></lr-input>`)) as LyraInput;
    expect(el.validity.valueMissing, 'required and empty to begin with').to.be.true;

    el.setCustomValidity('Rejected by the server.');
    expect(el.validity.customError).to.be.true;

    el.setCustomValidity('');
    expect(el.validity.customError).to.be.false;
    expect(el.validity.valueMissing, 'an empty required field is still missing a value').to.be.true;
    expect(el.checkValidity(), 'clearing must not force the control valid').to.be.false;
    expect(el.validationMessage.length, 'the intrinsic message is republished').to.be.greaterThan(0);
  });
});

describe('lr-input implicit form submission', () => {
  const enterOn = (el: LyraInput, init: KeyboardEventInit = {}) =>
    (el.shadowRoot!.querySelector('input') as HTMLInputElement).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true, cancelable: true, ...init }),
    );

  it('submits the ancestor form when Enter is pressed in the field', async () => {
    const form = (await fixture(html`
      <form><lr-input name="q" value="hi" aria-label="Query"></lr-input></form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-input') as LyraInput;
    let submits = 0;
    form.addEventListener('submit', (e) => { e.preventDefault(); submits += 1; });
    enterOn(el);
    expect(submits).to.equal(1);
  });

  it('runs the form\'s constraint validation, so an invalid required field blocks submission', async () => {
    const form = (await fixture(html`
      <form><lr-input name="q" required aria-label="Query"></lr-input></form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-input') as LyraInput;
    let submits = 0;
    form.addEventListener('submit', (e) => { e.preventDefault(); submits += 1; });
    enterOn(el);
    expect(submits).to.equal(0);
    expect(el.validity.valueMissing).to.be.true;
  });

  it('never submits while disabled or readonly', async () => {
    const form = (await fixture(html`
      <form>
        <lr-input id="d" name="a" value="x" disabled aria-label="a"></lr-input>
        <lr-input id="r" name="b" value="x" readonly aria-label="b"></lr-input>
      </form>
    `)) as HTMLFormElement;
    let submits = 0;
    form.addEventListener('submit', (e) => { e.preventDefault(); submits += 1; });
    enterOn(form.querySelector('#d') as LyraInput);
    enterOn(form.querySelector('#r') as LyraInput);
    expect(submits).to.equal(0);
  });

  it('never submits on an IME composition Enter, nor when the keydown was already defaultPrevented', async () => {
    const form = (await fixture(html`
      <form><lr-input name="q" value="hi" aria-label="Query"></lr-input></form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-input') as LyraInput;
    let submits = 0;
    form.addEventListener('submit', (e) => { e.preventDefault(); submits += 1; });
    enterOn(el, { isComposing: true });
    expect(submits).to.equal(0);

    // Capture on the host runs before the internal input's own listener.
    const veto = (e: Event): void => e.preventDefault();
    el.addEventListener('keydown', veto, true);
    enterOn(el);
    el.removeEventListener('keydown', veto, true);
    expect(submits).to.equal(0);

    enterOn(el);
    expect(submits).to.equal(1);
  });

  it('submits through an lr-button submitter, which requestSubmit() itself would reject', async () => {
    const form = (await fixture(html`
      <form>
        <lr-input name="q" value="hi" aria-label="Query"></lr-input>
        <lr-button id="go" type="submit" name="action" value="save">Go</lr-button>
      </form>
    `)) as HTMLFormElement;
    let submits = 0;
    let submitterName = '';
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      submits += 1;
      // lr-button routes its own submission through a transient named native submitter, so the
      // name proves the button was activated rather than the form being submitted behind it.
      submitterName = ((e as SubmitEvent).submitter as HTMLButtonElement | null)?.name ?? '';
    });
    enterOn(form.querySelector('lr-input') as LyraInput);
    expect(submits).to.equal(1);
    expect(submitterName, 'the lr-button was the submitter').to.equal('action');
  });

  it('names the form\'s first enabled native submit button as SubmitEvent.submitter', async () => {
    const form = (await fixture(html`
      <form>
        <lr-input name="q" value="hi" aria-label="Query"></lr-input>
        <button type="submit" id="off" disabled>Off</button>
        <button type="submit" id="go">Go</button>
      </form>
    `)) as HTMLFormElement;
    let submitterId = '';
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      submitterId = ((e as SubmitEvent).submitter as HTMLElement | null)?.id ?? '';
    });
    enterOn(form.querySelector('lr-input') as LyraInput);
    expect(submitterId).to.equal('go');
  });

  it('never submits on a modifier-held Enter', async () => {
    const form = (await fixture(html`
      <form><lr-input name="q" value="hi" aria-label="Query"></lr-input></form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-input') as LyraInput;
    let submits = 0;
    form.addEventListener('submit', (e) => { e.preventDefault(); submits += 1; });
    enterOn(el, { shiftKey: true });
    enterOn(el, { ctrlKey: true });
    enterOn(el, { altKey: true });
    enterOn(el, { metaKey: true });
    expect(submits).to.equal(0);
    enterOn(el);
    expect(submits, 'a bare Enter still submits').to.equal(1);
  });

  it('leaves a form-less input alone and ignores non-Enter keys', async () => {
    const el = (await fixture(html`<lr-input value="hi" aria-label="Query"></lr-input>`)) as LyraInput;
    enterOn(el);
    const form = (await fixture(html`
      <form><lr-input name="q" value="hi" aria-label="Query"></lr-input></form>
    `)) as HTMLFormElement;
    let submits = 0;
    form.addEventListener('submit', (e) => { e.preventDefault(); submits += 1; });
    (form.querySelector('lr-input') as LyraInput).shadowRoot!
      .querySelector('input')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, composed: true, cancelable: true }));
    expect(submits).to.equal(0);
  });
});

describe('lr-input unset-regression for the 8.0 opt-ins', () => {
  it('renders the committed control row when appearance/pill/password-toggle/without-spin-buttons/autofocus are left alone', async () => {
    const el = (await fixture(html`<lr-input value="abc" aria-label="Name"></lr-input>`)) as LyraInput;
    const wrapper = el.shadowRoot!.querySelector('[part="input-wrapper"]') as HTMLElement;
    const native = el.shadowRoot!.querySelector('input') as HTMLInputElement;
    expect(el.shadowRoot!.querySelectorAll('[part="password-toggle"]').length).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('[part="stepper-up"]').length).to.equal(0);
    expect(native.hasAttribute('autofocus')).to.be.false;
    expect(native.hasAttribute('data-without-spin-buttons')).to.be.false;
    const cs = getComputedStyle(wrapper);
    expect(cs.borderTopWidth).to.equal('1px');
    expect(cs.borderRadius).to.equal('6px');
    expect(cs.minBlockSize).to.equal('40px');
    // The control row is the only element between the wrapper and the end adornment, exactly as
    // before renderControls() existed.
    expect(wrapper.querySelectorAll('button').length).to.equal(0);
  });
});

describe('lr-input clear-button spelling parity', () => {
  // Web Awesome spells this `with-clear`, Shoelace `clearable`. Accepting only one of the two
  // makes a mechanical `wa-` -> `lr-` rename drop the clear button with no error at all, which is
  // the exact failure mode the migration table exists to prevent.
  it('renders the clear button for either upstream spelling', async () => {
    for (const markup of [
      html`<lr-input type="search" clearable value="query" aria-label="Search"></lr-input>`,
      html`<lr-input type="search" with-clear value="query" aria-label="Search"></lr-input>`,
    ]) {
      const el = (await fixture(markup)) as LyraInput;
      expect(el.shadowRoot!.querySelector('[part="clear-button"]'), el.outerHTML).to.exist;
    }
  });

  it('leaves the clear button absent when neither spelling is set', async () => {
    const el = (await fixture(
      html`<lr-input type="search" value="query" aria-label="Search"></lr-input>`,
    )) as LyraInput;
    expect(el.shadowRoot!.querySelector('[part="clear-button"]')).to.not.exist;
  });
});

describe('lr-input — the shared size ladder', () => {
  const wrapper = (el: LyraInput) =>
    el.shadowRoot!.querySelector('[part="input-wrapper"]') as HTMLElement;
  const height = (el: LyraInput) => wrapper(el).getBoundingClientRect().height;

  // The same guarantee lr-button makes: a migrating consumer's `size="small"` must land on the
  // `s` tier's geometry exactly, not merely parse.
  it('renders the Web Awesome size spellings at the same geometry as the canonical steps', async () => {
    for (const [alias, step] of [['small', 's'], ['medium', 'm'], ['large', 'l']] as const) {
      const aliasEl = (await fixture(
        html`<lr-input size=${alias} aria-label="Name"></lr-input>`,
      )) as LyraInput;
      const stepEl = (await fixture(
        html`<lr-input size=${step} aria-label="Name"></lr-input>`,
      )) as LyraInput;
      expect(height(aliasEl), `size=${alias} height`).to.equal(height(stepEl));
      const aliasInput = aliasEl.shadowRoot!.querySelector('[part="input"]') as HTMLElement;
      const stepInput = stepEl.shadowRoot!.querySelector('[part="input"]') as HTMLElement;
      expect(getComputedStyle(aliasInput).fontSize, `size=${alias} font-size`).to.equal(
        getComputedStyle(stepInput).fontSize,
      );
      expect(getComputedStyle(aliasInput).paddingTop, `size=${alias} padding-block`).to.equal(
        getComputedStyle(stepInput).paddingTop,
      );
    }
  });

  // The ladder's whole promise: an input and a button of the same tier sit at the same height in
  // a toolbar row. Before 8.0.0 the l and xl tiers overshot their own floor by 2px and 5px.
  it('sits at the shared form-control height at every tier', async () => {
    const expected: Record<string, number> = { '2xs': 20, xs: 24, s: 30, m: 40, l: 48, xl: 56 };
    for (const [size, px] of Object.entries(expected)) {
      const el = (await fixture(html`<lr-input size=${size} aria-label="Name"></lr-input>`)) as LyraInput;
      expect(height(el), `size=${size}`).to.equal(px);
    }
  });
});

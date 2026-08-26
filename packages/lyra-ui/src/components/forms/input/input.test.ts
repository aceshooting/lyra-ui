import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import './input.js';
import '../button/button.js';
import type { LyraInput } from './input.class.js';
import { styles } from './input.styles.js';

describe('lr-input', () => {
  it('applies the documented resting action color to clear and password actions', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div style="--lr-input-action-color: rgb(1, 2, 3)">
        <lr-input type="password" password-toggle value="secret"></lr-input>
        <lr-input clearable value="clear me"></lr-input>
      </div>
    `);
    const password = wrapper.querySelector<LyraInput>('lr-input[type="password"]');
    const clearable = wrapper.querySelector<LyraInput>('lr-input[clearable]');
    if (!password || !clearable) throw new Error('Both input action fixtures were not rendered.');
    for (const [el, part] of [
      [password, 'password-toggle'],
      [clearable, 'clear-button'],
    ] as const) {
      const action = el.shadowRoot!.querySelector<HTMLElement>(`[part~="${part}"]`)!;
      expect(getComputedStyle(action).color, part).to.equal('rgb(1, 2, 3)');
    }
  });

  it('uses the component-scoped focus border hook inherited from an ancestor', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div style="--lr-input-focus-border-color: rgb(1, 2, 3)">
        <lr-input aria-label="Name"></lr-input>
      </div>
    `);
    const el = wrapper.querySelector('lr-input') as LyraInput;
    el.shadowRoot!.querySelector<HTMLInputElement>('[part="input"]')!.focus();
    const row = el.shadowRoot!.querySelector<HTMLElement>('[part~="input-wrapper"]')!;
    expect(getComputedStyle(row).borderTopColor).to.equal('rgb(1, 2, 3)');
  });

  it('emits one cancelable lr-invalid for a failed check and stays silent once valid', async () => {
    const el = (await fixture(html`<lr-input required aria-label="Name"></lr-input>`)) as LyraInput;
    const aliases: CustomEvent[] = [];
    el.addEventListener('lr-invalid', (event) => aliases.push(event as CustomEvent));

    expect(el.checkValidity()).to.be.false;
    expect(aliases).to.have.lengthOf(1);
    const alias = aliases[0];
    if (!alias) throw new Error('The invalid alias was not emitted.');
    expect(alias.target === el).to.equal(true);
    expect(alias.bubbles && alias.composed).to.be.true;
    expect(alias.cancelable).to.be.true;

    el.value = 'Ada';
    expect(el.checkValidity()).to.be.true;
    expect(aliases).to.have.lengthOf(1);
  });

  it('forwards preventDefault() on lr-invalid to the native invalid event', async () => {
    // The alias is only a real veto point if cancelling it cancels the event it aliases -- the
    // native `invalid` is what the platform reads for its own validation bubble and for
    // reportValidity()'s focus/scroll, and it is dispatched by the platform, so cancelling a copy
    // can only mean cancelling the original. The host's own alias listener is installed in the
    // constructor, so it runs before the recorder registered here and its preventDefault() is
    // already visible on the event this listener receives.
    const el = (await fixture(html`<lr-input required aria-label="Name"></lr-input>`)) as LyraInput;
    el.addEventListener('lr-invalid', (event) => event.preventDefault());
    const natives: Event[] = [];
    el.addEventListener('invalid', (event) => natives.push(event));

    expect(el.checkValidity()).to.be.false;
    expect(natives).to.have.lengthOf(1);
    const native = natives[0];
    if (!native) throw new Error('The native invalid event was not emitted.');
    expect(native.cancelable, 'the native invalid event is cancelable').to.be.true;
    expect(native.defaultPrevented).to.be.true;
  });

  it('leaves the native invalid event alone when the alias is not cancelled', async () => {
    const el = (await fixture(html`<lr-input required aria-label="Name"></lr-input>`)) as LyraInput;
    const natives: Event[] = [];
    el.addEventListener('invalid', (event) => natives.push(event));

    expect(el.checkValidity()).to.be.false;
    expect(natives).to.have.lengthOf(1);
    const native = natives[0];
    if (!native) throw new Error('The native invalid event was not emitted.');
    expect(native.defaultPrevented).to.be.false;
  });

  it('bars constraint validation while disabled, fieldset-disabled or readonly', async () => {
    // A native <input required disabled> and <input required readonly> match neither :valid nor
    // :invalid, so a barred lyra control must not raise valueMissing or publish
    // :state(invalid)/:state(user-invalid) either -- otherwise the documented
    // `lr-input:state(user-invalid) { ... }` error styling paints every disabled required field.
    const el = (await fixture(
      html`<lr-input required aria-label="Name" disabled></lr-input>`,
    )) as LyraInput;
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

    el.readonly = false;
    await el.updateComplete;
    const form = (await fixture(html`
      <form>
        <fieldset disabled>
          <lr-input required aria-label="Nested" name="nested"></lr-input>
        </fieldset>
      </form>
    `)) as HTMLFormElement;
    const nested = form.querySelector('lr-input') as LyraInput;
    await nested.updateComplete;
    expect(nested.disabled, 'a fieldset never mutates the control own disabled').to.be.false;
    expect(nested.validity.valueMissing, 'fieldset-disabled + required').to.be.false;
    expect(nested.matches(':state(invalid)')).to.be.false;
  });

  it('defaults to type="text" with an empty value', async () => {
    const el = (await fixture(html`<lr-input></lr-input>`)) as LyraInput;
    expect(el.type).to.equal('text');
    expect(el.value).to.equal('');
    const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
    expect(input.type).to.equal('text');
  });

  it('reflects the pinned Web Awesome type property', async () => {
    const el = (await fixture(html`<lr-input></lr-input>`)) as LyraInput;
    el.type = 'email';
    await el.updateComplete;
    expect(el.getAttribute('type')).to.equal('email');
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

  it('forwards name and a host-supplied id onto the native input, keeping the label in sync', async () => {
    const el = (await fixture(
      html`<lr-input name="username" id="username-field"></lr-input>`,
    )) as LyraInput;
    const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
    const label = el.shadowRoot!.querySelector('label') as HTMLLabelElement;
    expect(input.name).to.equal('username');
    expect(input.id).to.equal('username-field');
    expect(label.htmlFor).to.equal('username-field');
  });

  it('leaves the native input id/name/label at their unset defaults with no host id/name', async () => {
    const el = (await fixture(html`<lr-input></lr-input>`)) as LyraInput;
    const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
    const label = el.shadowRoot!.querySelector('label') as HTMLLabelElement;
    expect(input.id).to.equal('input');
    expect(input.hasAttribute('name')).to.be.false;
    expect(label.htmlFor).to.equal('input');
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
    const nativeEvent = nativeEvents[0];
    if (!nativeEvent) throw new Error('The native input event was not relayed.');
    expect(nativeEvent instanceof InputEvent).to.be.true;
    expect(nativeEvent.target === el).to.be.true;
    expect(nativeEvent.data).to.equal('x');
    expect(nativeEvent.inputType).to.equal('insertText');
    expect(aliases).to.have.length(1);
    const alias = aliases[0];
    if (!alias) throw new Error('The input alias was not emitted.');
    expect(alias.detail).to.deep.equal({ value: 'x' });
  });

  it('exposes exactly one native focus/blur pair, and never lr-focus/lr-blur', async () => {
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
    // v9 dropped the v8 lr-focus/lr-blur compatibility aliases -- only the native pair remains.
    expect(aliases).to.deep.equal([]);
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
        expect((el.shadowRoot!.querySelector('[part="clear-button"]')) == null, type).to.be.true;
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
      expect((email.shadowRoot!.querySelector('[part="clear-button"]')) == null).to.be.true;
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

    it('does not mark touched from a blur caused by the control itself becoming disabled', async () => {
      // Regression test: the browser force-blurs a focused
      // descendant when a form-associated custom element's own `disabled` state becomes true --
      // confirmed via a captured marker showing the native `blur` event firing synchronously
      // inside the `disabled` property setter, before Lit's own async re-render has even reached
      // the internal native <input>'s own `disabled` attribute. That is not a user interaction:
      // onBlur() unconditionally marking `touched = true` for it was, depending on exactly when in
      // the update cycle the blur landed, capable of reentering an in-flight update and tripping
      // Lit's dev-mode "scheduled an update after an update completed" warning for a state flip
      // nothing observable needed in that instant (a disabled control is barred from validation
      // regardless). Proven observably here: re-enabling afterwards must still see the field as
      // untouched, not retroactively user-invalid from a blur the user never actually caused.
      const el = (await fixture(html`<lr-input required></lr-input>`)) as LyraInput;
      const native = el.shadowRoot!.querySelector('input') as HTMLInputElement;
      const isTouched = () => (el as unknown as { touched: boolean }).touched;
      native.focus();
      await new Promise((resolve) => setTimeout(resolve, 0));

      el.disabled = true;
      expect(isTouched(), 'a disable-forced blur must not mark touched').to.be.false;
      await el.updateComplete;
      el.disabled = false;
      await el.updateComplete;
      expect(isTouched(), 'still not touched after re-enabling').to.be.false;

      // A genuine user-driven blur (not caused by disablement) still marks touched, unchanged.
      native.dispatchEvent(new Event('blur', { bubbles: true }));
      expect(isTouched(), 'a real blur still marks touched').to.be.true;
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
      expect((el.input) === (el.shadowRoot!.querySelector('input'))).to.equal(true);
    });

    it('forwards focus() and blur() to the native input', async () => {
      const el = (await fixture(html`<lr-input></lr-input>`)) as LyraInput;
      el.focus();
      expect(el.shadowRoot!.activeElement === el.input).to.be.true;
      el.blur();
      expect((el.shadowRoot!.activeElement) === (null)).to.equal(true);
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
      expect((el.input) === (null)).to.equal(true);
      expect(el.valueAsDate).to.equal(null);
      expect(Number.isNaN(el.valueAsNumber)).to.equal(true);
      expect(el.selectionStart).to.equal(null);
      expect(el.selectionEnd).to.equal(null);
      expect(() => {
        el.valueAsDate = new Date(Date.UTC(2026, 0, 1));
        el.valueAsNumber = 42;
        el.selectionStart = 2;
      }).to.not.throw();
      expect(() => {
        el.selectionEnd = 4;
      }).to.not.throw();
      expect(() => el.setRangeText('x')).to.not.throw();
      expect(() => el.showPicker()).to.not.throw();
      expect(() => el.stepUp()).to.not.throw();
      expect(() => el.stepDown()).to.not.throw();
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

  it('gives the password-toggle button a :hover treatment, guarded by :not(:disabled)', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/\[part='password-toggle'\]:not\(:disabled\):hover\s*\{[^}]+\}/);
  });

  it('gives the clear-button the same :hover treatment, also guarded by :not(:disabled)', () => {
    // A disabled password-toggle/clear-button must not out-hover the input-wrapper's own
    // :host(:disabled) dimming -- mirrors button.styles.ts's established
    // `[part~='base']:not(:disabled):hover` pattern.
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/\[part='clear-button'\]:not\(:disabled\):hover\s*\{[^}]+\}/);
  });

  it('guards the shared password-toggle/clear-button :active press feedback with :not(:disabled)', () => {
    // Without the guard, a disabled action button still paints the pressed fill/text-color under
    // a real pointerdown, contradicting the input-wrapper's own :host(:disabled) opacity dimming
    // for the very same button. Mirrors button.styles.ts's established
    // `[part~='base']:not(:disabled):active` pattern.
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(
      /\[part='password-toggle'\]:not\(:disabled\):active,\s*\[part='clear-button'\]:not\(:disabled\):active\s*\{[^}]+\}/,
    );
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
    expect(css).to.match(/\[type='time'\]:not\(:disabled\):hover::-webkit-calendar-picker-indicator/);
    expect(css).to.match(/\[type='time'\]:not\(:disabled\):active::-webkit-calendar-picker-indicator/);
    expect(css).to.match(/\[type='time'\]:not\(:disabled\):focus-visible::-webkit-calendar-picker-indicator/);
  });

  it('renders canonical focus-ring and distinct pressed tokens on the native time indicator', async () => {
    const el = await fixture<LyraInput>(html`
      <lr-input
        type="time"
        aria-label="Start time"
        style="
          --lr-focus-ring-color: rgb(1, 2, 3);
          --lr-input-time-picker-active-bg: rgb(4, 5, 6);
          --lr-transition-fast: 0ms;
        "
      ></lr-input>
    `);
    const input = el.input!;
    input.focus();
    expect(getComputedStyle(input).getPropertyValue('--lr-focus-ring-color').trim()).to.equal('rgb(1, 2, 3)');

    const bounds = input.getBoundingClientRect();
    await sendMouse({
      type: 'move',
      position: [Math.round(bounds.left + bounds.width / 2), Math.round(bounds.top + bounds.height / 2)],
    });
    await sendMouse({ type: 'down' });
    try {
      await waitUntil(() => input.matches(':active'), 'native time input did not enter its pressed state');
      expect(getComputedStyle(input).getPropertyValue('--lr-input-time-picker-active-bg').trim())
        .to.equal('rgb(4, 5, 6)');
    } finally {
      await sendMouse({ type: 'up' });
      await resetMouse();
    }
  });

  it('normalizes unsupported attribute and property types before native validity and chrome branch', async () => {
    const el = await fixture<LyraInput>(html`
      <lr-input type="unsupported" clearable minlength="3" value="x"></lr-input>
    `);
    let native = el.shadowRoot!.querySelector<HTMLInputElement>('[part="input"]')!;
    expect(el.type).to.equal('text');
    expect(el.getAttribute('type')).to.equal('text');
    expect(native.type).to.equal('text');
    expect(el.shadowRoot!.querySelector('[part="clear-button"]')).not.to.equal(null);

    el.type = 'also-unsupported' as LyraInput['type'];
    el.value = 'x';
    await el.updateComplete;
    native = el.shadowRoot!.querySelector<HTMLInputElement>('[part="input"]')!;
    expect(el.type).to.equal('text');
    expect(native.type).to.equal('text');
    expect(el.validity.tooShort).to.equal(true);
  });

  it('supports size="2xs": tighter padding/font-size than xs, and the ladder\'s tightest floor', async () => {
    const el = (await fixture(html`<lr-input size="2xs" aria-label="Name"></lr-input>`)) as LyraInput;
    const xsEl = (await fixture(html`<lr-input size="xs" aria-label="Name"></lr-input>`)) as LyraInput;
    const field = (host: LyraInput) => host.shadowRoot!.querySelector('[part="input"]') as HTMLElement;
    const row = (host: LyraInput) => host.shadowRoot!.querySelector('[part~="input-wrapper"]') as HTMLElement;
    expect(parseFloat(getComputedStyle(field(el)).fontSize)).to.be.lessThan(
      parseFloat(getComputedStyle(field(xsEl)).fontSize),
    );
    expect(parseFloat(getComputedStyle(row(el)).paddingInlineStart)).to.be.lessThan(
      parseFloat(getComputedStyle(row(xsEl)).paddingInlineStart),
    );
    expect(getComputedStyle(row(el)).minBlockSize).to.equal('20px');
  });

  it('keeps m and up on the 40px hit-area floor, but yields to a smaller tier\'s own control height below that', async () => {
    // Below m, --lr-form-control-height is smaller than the 40px --lr-icon-button-size: the clear
    // button's own icon+padding content (not the floor being widened here) still exceeds a 2xs/xs
    // field's bare control height, so this is a smaller, tier-scaled jump rather than none at all --
    // m and up are untouched because their own control height already covers the 40px target.
    // 2xs/xs land on this content-driven height rather than a round --lr-form-control-height
    // token, so it's subject to ordinary cross-engine font-metric rounding (observed up to ~1.5px
    // under Firefox); closeTo matches this file's other rect-measurement assertions (see e.g.
    // scroll-lock.test.ts, positioner.test.ts).
    const expected: Record<string, number> = { '2xs': 29, xs: 29, s: 32, m: 42, l: 48, xl: 56 };
    for (const [size, height] of Object.entries(expected)) {
      const el = (await fixture(html`
        <lr-input size=${size} clearable value="content" aria-label="Name"></lr-input>
      `)) as LyraInput;
      const row = el.shadowRoot!.querySelector<HTMLElement>('[part~="input-wrapper"]')!;
      expect(row.getBoundingClientRect().height, `size=${size}`).to.be.closeTo(height, 2);
    }
  });

  it('scales the clear-button hit-area floor with the active size tier, instead of forcing every undersized field open to the same flat height (bug)', async () => {
    for (const size of ['2xs', 'xs', 's']) {
      const empty = (await fixture(html`<lr-input size=${size} clearable aria-label="Name"></lr-input>`)) as LyraInput;
      const filled = (await fixture(html`
        <lr-input size=${size} clearable value="content" aria-label="Name"></lr-input>
      `)) as LyraInput;
      const emptyHeight = empty.shadowRoot!.querySelector<HTMLElement>('[part~="input-wrapper"]')!.getBoundingClientRect().height;
      const filledHeight = filled.shadowRoot!.querySelector<HTMLElement>('[part~="input-wrapper"]')!.getBoundingClientRect().height;
      // Before the fix, every tier below m was floored to the exact same ~42px the instant the
      // clear button appeared, regardless of the field's own height -- i.e. the jump equalled
      // 42 - emptyHeight for every one of them. A tier-scaled floor must jump by strictly less.
      const previousUnscaledJump = 42 - emptyHeight;
      expect(
        filledHeight - emptyHeight,
        `size=${size}: the clear button's hit-area floor must yield to this smaller tier's own ` +
          'control height, not force the same jump every undersized tier saw under the flat 40px floor',
      ).to.be.lessThan(previousUnscaledJump);
    }
  });

  it('contains long RTL action/adornment content in an exact 320px allocation', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div dir="rtl" style="inline-size: 320px; max-inline-size: 320px">
        <lr-input
          clearable
          value="content"
          label="InternationalizedUnbrokenFieldLabelThatMustRemainInsideTheAllocation"
          hint="Supporting copy wraps within the same narrow allocation."
        >
          <span slot="start">VeryLongLeadingAdornment</span>
          <span slot="end">VeryLongTrailingAdornment</span>
        </lr-input>
      </div>
    `);
    const el = wrapper.querySelector('lr-input') as LyraInput;
    expect(wrapper.scrollWidth).to.be.at.most(wrapper.clientWidth);
    expect(el.getBoundingClientRect().width).to.be.at.most(wrapper.getBoundingClientRect().width);
  });

  it('reflects size="2xs" as a host attribute', async () => {
    const el = (await fixture(html`<lr-input size="2xs"></lr-input>`)) as LyraInput;
    expect(el.size).to.equal('2xs');
    expect(el.getAttribute('size')).to.equal('2xs');
  });

  describe('exact-height escape hatch', () => {
    const wrapper = (el: LyraInput) =>
      el.shadowRoot!.querySelector('[part~="input-wrapper"]') as HTMLElement;

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
      el.shadowRoot!.querySelector('[part~="input-wrapper"]') as HTMLElement;

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
        host.shadowRoot!.querySelector('[part~="input-wrapper"]') as HTMLElement;
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
  const directWrapper = direct.shadowRoot!.querySelector('[part~="input-wrapper"]') as HTMLElement;
  expect(getComputedStyle(directWrapper).opacity).to.equal(
    getComputedStyle(directWrapper).getPropertyValue('--lr-opacity-disabled').trim(),
  );
  expect(getComputedStyle(directWrapper).cursor).to.equal('not-allowed');

  const form = (await fixture(html`
    <form><fieldset disabled><lr-input></lr-input></fieldset></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-input') as LyraInput;
  const wrapper = el.shadowRoot!.querySelector('[part~="input-wrapper"]') as HTMLElement;
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

it('preserves rendered hint/error behavior while shared slot presence changes', async () => {
  const el = (await fixture(html`
    <lr-input label="Name">
      <span slot="hint">Full legal name</span>
      <span slot="error">Required</span>
    </lr-input>
  `)) as LyraInput;
  await el.updateComplete;
  const hint = el.shadowRoot!.querySelector('[part~="hint"]') as HTMLElement;
  const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
  expect(hint.hidden).to.be.false;
  expect(error.hidden).to.be.false;

  el.querySelector('[slot="hint"]')!.remove();
  el.querySelector('[slot="error"]')!.remove();
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  await el.updateComplete;
  expect(hint.hidden).to.be.true;
  expect(error.hidden).to.be.true;
});

// -- 8.0 surface: appearance / pill / spin buttons / picker + step methods ---

describe('lr-input appearance', () => {
  const wrapper = (el: LyraInput) => el.shadowRoot!.querySelector('[part~="input-wrapper"]') as HTMLElement;
  const TRANSPARENT = 'rgba(0, 0, 0, 0)';

  it('defaults to the mapped appearance="outlined" and reflects it', async () => {
    const el = (await fixture(html`<lr-input aria-label="Name"></lr-input>`)) as LyraInput;
    expect(el.appearance).to.equal('outlined');
    expect(el.getAttribute('appearance')).to.equal('outlined');
  });

  it('keeps the mapped border-only rendering at the default appearance', async () => {
    const el = (await fixture(html`<lr-input aria-label="Name"></lr-input>`)) as LyraInput;
    const cs = getComputedStyle(wrapper(el));
    expect(cs.backgroundColor).to.equal(TRANSPARENT);
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

  it('tolerates a missing picker API and a platform picker rejection', async () => {
    const el = (await fixture(html`<lr-input type="time" aria-label="Start"></lr-input>`)) as LyraInput;
    const native = el.shadowRoot!.querySelector('input') as HTMLInputElement;
    const prototype = HTMLInputElement.prototype as HTMLInputElement & { showPicker?: () => void };
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'showPicker');

    if (descriptor?.configurable) {
      try {
        Reflect.deleteProperty(prototype, 'showPicker');
        expect(() => el.showPicker()).to.not.throw();
      } finally {
        Object.defineProperty(prototype, 'showPicker', descriptor);
      }
    }

    Object.defineProperty(native, 'showPicker', {
      configurable: true,
      value: () => { throw new DOMException('Picker blocked', 'NotAllowedError'); },
    });
    expect(() => el.showPicker()).to.not.throw();
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
    el.stepUp(0);
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
    const wrapper = el.shadowRoot!.querySelector('[part~="input-wrapper"]') as HTMLElement;
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
    expect((el.shadowRoot!.querySelector('[part="clear-button"]')) == null).to.be.true;
  });
});

describe('lr-input — the shared size ladder', () => {
  const wrapper = (el: LyraInput) =>
    el.shadowRoot!.querySelector('[part~="input-wrapper"]') as HTMLElement;
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

describe('lr-input mapped Input parity surface', () => {
  it('supports the remaining mapped native types and title passthrough', async () => {
    for (const type of ['date', 'datetime-local', 'tel', 'url'] as const) {
      const el = (await fixture(html`<lr-input type=${type} title="Edit value"></lr-input>`)) as LyraInput;
      expect(el.type).to.equal(type);
      const native = el.shadowRoot!.querySelector('input') as HTMLInputElement;
      expect(native.type).to.equal(type);
      expect(native.title).to.equal('Edit value');
    }
  });

  it('keeps a boolean autocorrect read while accepting both upstream write vocabularies', async () => {
    const el = (await fixture(html`<lr-input></lr-input>`)) as LyraInput & {
      inputmode: string;
      enterkeyhint: string;
    };
    el.autocorrect = false;
    el.inputmode = 'email';
    el.enterkeyhint = 'done';
    await el.updateComplete;
    const native = el.shadowRoot!.querySelector('input') as HTMLInputElement;
    expect(el.autocorrect).to.equal(false);
    expect(native.getAttribute('autocorrect')).to.equal('off');
    expect(el.inputMode).to.equal('email');
    expect(el.enterKeyHint).to.equal('done');
    el.setAttribute('autocorrect', 'on');
    el.inputMode = 'url';
    el.enterKeyHint = 'go';
    await el.updateComplete;
    expect(el.autocorrect).to.equal(true);
    expect(native.getAttribute('autocorrect')).to.equal('on');
    expect(el.inputmode).to.equal('url');
    expect(el.enterkeyhint).to.equal('go');

    el.inputmode = null as unknown as string;
    el.enterkeyhint = null as unknown as string;
    await el.updateComplete;
    expect(el.inputMode).to.equal('');
    expect(el.enterKeyHint).to.equal('');

    const shoelaceWrite = el as unknown as { autocorrect: boolean | 'off' | 'on' };
    shoelaceWrite.autocorrect = 'off';
    await el.updateComplete;
    expect(el.autocorrect).to.equal(false);
    expect(native.getAttribute('autocorrect')).to.equal('off');
    shoelaceWrite.autocorrect = 'on';
    await el.updateComplete;
    expect(el.autocorrect).to.equal(true);
    expect(native.getAttribute('autocorrect')).to.equal('on');

    el.removeAttribute('autocorrect');
    await el.updateComplete;
    expect(el.autocorrect, 'attribute removal restores the true default').to.equal(true);
    expect(native.hasAttribute('autocorrect'), 'the native control resumes its browser default').to.equal(false);
  });

  it('accepts filled/no-spin-buttons and prefix/suffix/help-text aliases', async () => {
    const el = (await fixture(html`
      <lr-input filled no-spin-buttons help-text="Alias hint" type="number" with-label>
        <span slot="prefix">P</span><span slot="suffix">S</span>
      </lr-input>
    `)) as LyraInput & { filled: boolean; noSpinButtons: boolean; helpText: string; withLabel: boolean };
    const native = el.shadowRoot!.querySelector('input') as HTMLInputElement;
    expect(el.filled).to.be.true;
    expect(el.noSpinButtons).to.be.true;
    expect(native.hasAttribute('data-without-spin-buttons')).to.be.true;
    const prefix = el.shadowRoot!.querySelector('slot[part="prefix"]') as HTMLSlotElement;
    const suffix = el.shadowRoot!.querySelector('slot[part="suffix"]') as HTMLSlotElement;
    expect(prefix.assignedElements()[0]?.textContent).to.equal('P');
    expect(suffix.assignedElements()[0]?.textContent).to.equal('S');
    expect(el.shadowRoot!.querySelector('[part~="form-control-help-text"]')).to.exist;
    expect(el.shadowRoot!.querySelector('[part~="hint"]')?.textContent).to.contain('Alias hint');
    expect((el.shadowRoot!.querySelector('[part~="label"]') as HTMLElement).hidden).to.be.false;
  });

  it('exports mapped icon slots and nested part aliases', async () => {
    const el = (await fixture(html`
      <lr-input type="password" password-toggle value="secret" clearable>
        <span slot="show-password-icon">show</span>
        <span slot="hide-password-icon">hide</span>
        <span slot="clear-icon">clear</span>
      </lr-input>
    `)) as LyraInput;
    const toggle = el.shadowRoot!.querySelector('[part~="password-toggle-button"]') as HTMLButtonElement;
    const show = toggle.querySelector('slot[name="show-password-icon"]') as HTMLSlotElement;
    expect(show.assignedElements()[0]?.textContent).to.equal('show');
    expect(el.shadowRoot!.querySelector('[part~="form-control-input"]')).to.exist;
    toggle.click();
    await el.updateComplete;
    const hide = toggle.querySelector('slot[name="hide-password-icon"]') as HTMLSlotElement;
    expect(hide.assignedElements()[0]?.textContent).to.equal('hide');

    el.type = 'text';
    await el.updateComplete;
    const clear = el.shadowRoot!.querySelector('slot[name="clear-icon"]') as HTMLSlotElement;
    expect(clear.assignedElements()[0]?.textContent).to.equal('clear');
  });

  it('exposes native valueAsDate/valueAsNumber without emitting edit events', async () => {
    const el = (await fixture(html`<lr-input type="date"></lr-input>`)) as LyraInput & {
      valueAsDate: Date | null;
      valueAsNumber: number;
    };
    let edits = 0;
    el.addEventListener('input', () => { edits += 1; });
    el.valueAsNumber = Date.UTC(2024, 0, 2);
    expect(el.value).to.equal('2024-01-02');
    expect(el.valueAsDate?.toISOString().slice(0, 10)).to.equal('2024-01-02');
    expect(edits).to.equal(0);
  });

  it('accepts default-value as a reset alias and reflects the blank custom state', async () => {
    const form = await fixture<HTMLFormElement>(html`
      <form><lr-input name="q" default-value="seed"></lr-input></form>
    `);
    const el = form.querySelector('lr-input') as LyraInput;
    await el.updateComplete;
    expect(el.defaultValue).to.equal('seed');
    expect(el.value).to.equal('seed');
    expect(el.matches(':state(blank)')).to.be.false;
    el.value = '';
    await el.updateComplete;
    expect(el.matches(':state(blank)')).to.be.true;
    form.reset();
    await el.updateComplete;
    expect(el.value).to.equal('seed');

    el.removeAttribute('default-value');
    await el.updateComplete;
    expect(el.defaultValue).to.equal('');
  });
});

describe('lr-input native value views', () => {
  it('round-trips valueAsDate and valueAsNumber through the native input', async () => {
    const el = (await fixture(html`<lr-input type="date"></lr-input>`)) as LyraInput;
    expect(el.valueAsDate).to.equal(null);
    expect(Number.isNaN(el.valueAsNumber)).to.equal(true);

    el.valueAsDate = new Date(Date.UTC(2024, 4, 17));
    await el.updateComplete;
    expect(el.value).to.equal('2024-05-17');
    expect(el.valueAsDate?.toISOString()).to.equal('2024-05-17T00:00:00.000Z');
    expect(el.valueAsNumber).to.equal(Date.UTC(2024, 4, 17));

    el.valueAsDate = null;
    await el.updateComplete;
    expect(el.value).to.equal('');

    const number = (await fixture(html`<lr-input type="number"></lr-input>`)) as LyraInput;
    number.valueAsNumber = 42;
    await number.updateComplete;
    expect(number.value).to.equal('42');
    expect(number.valueAsNumber).to.equal(42);

    // A programmatic `value` write must be visible to the native views without a re-render.
    number.value = '7';
    expect(number.valueAsNumber).to.equal(7);
  });
});

it('inherits public row geometry and paint hooks across size, appearance, and pill fallbacks', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div style="--lr-input-control-min-height: 47px; --lr-input-padding-inline: 17px; --lr-input-font-size: 18px; --lr-input-gap: 13px; --lr-input-radius: 21px; --lr-input-fill: rgb(1, 2, 3); --lr-input-border-color: rgb(4, 5, 6)">
      <lr-input size="xs" appearance="filled" pill>
        <span slot="start">start</span>
      </lr-input>
    </div>
  `);
  const el = wrapper.querySelector('lr-input') as LyraInput;
  const row = el.shadowRoot!.querySelector('[part~="input-wrapper"]') as HTMLElement;
  const input = el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
  const computed = getComputedStyle(row);
  expect(computed.minBlockSize).to.equal('47px');
  expect(computed.paddingInlineStart).to.equal('17px');
  expect(computed.gap).to.equal('13px');
  expect(computed.borderTopLeftRadius).to.equal('21px');
  expect(computed.backgroundColor).to.equal('rgb(1, 2, 3)');
  expect(computed.borderTopColor).to.equal('rgb(4, 5, 6)');
  expect(getComputedStyle(input).fontSize).to.equal('18px');
});

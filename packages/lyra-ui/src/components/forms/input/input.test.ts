import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './input.js';
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
      const el = (await fixture(html`<lr-input type="password" label="Password"></lr-input>`)) as LyraInput;
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
      const el = (await fixture(html`<lr-input type="email"></lr-input>`)) as LyraInput;
      expect(el.shadowRoot!.querySelector('[part="password-toggle"]')).to.be.null;
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
      expect(el.shadowRoot!.querySelector('[part="password-toggle"]')).to.be.null;
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
      const el = (await fixture(html`<lr-input type="password"></lr-input>`)) as LyraInput;
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
  });

  it('is accessible', async () => {
    const el = await fixture(html`<lr-input label="Name"></lr-input>`);
    await expect(el).to.be.accessible();
  });

  it('is accessible as type="password"', async () => {
    const el = await fixture(html`<lr-input type="password" label="Password"></lr-input>`);
    await expect(el).to.be.accessible();
  });

  it('gives the password-toggle button a :hover treatment', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/\[part='password-toggle'\]:hover\s*\{[^}]+\}/);
  });

  it('resets native appearance unconditionally for search/number, and restyles (not suppresses) the time picker indicator', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    // Previously gated behind :host([clearable]) -- the common non-clearable case kept the glyph.
    expect(css).to.match(/\[part='input'\]\[type='search'\]::-webkit-search-cancel-button/);
    expect(css).to.not.match(
      /:host\(\[clearable\]\) \[part='input'\]\[type='search'\]::-webkit-search-cancel-button/,
    );
    expect(css).to.match(/\[part='input'\]\[type='number'\]\s*\{[^}]*appearance:\s*textfield/);
    expect(css).to.match(/\[part='input'\]\[type='number'\]::-webkit-outer-spin-button/);
    expect(css).to.match(
      /\[part='input'\]\[type='time'\]::-webkit-calendar-picker-indicator\s*\{[^}]*cursor:\s*pointer/,
    );
  });

  it('supports size="2xs": tighter padding/font-size than xs, no min-block-size floor (matches xs\'s own contract)', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(
      /:host\(\[size='2xs'\]\)\s*\{[^}]*--lr-input-padding-block:\s*var\(--lr-size-0-0625rem\);[^}]*--lr-input-padding-inline:\s*var\(--lr-space-2xs\);[^}]*--lr-input-font-size:\s*var\(--lr-font-size-2xs\);/,
    );
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

    it('declares --lr-input-gap/--lr-input-radius on :host and consumes them once on [part="input-wrapper"]', () => {
      const css = styles.cssText.replace(/\s+/g, ' ');
      expect(css).to.match(/:host \{[^}]*--lr-input-gap: var\(--lr-space-xs\);/);
      expect(css).to.match(/:host \{[^}]*--lr-input-radius: var\(--lr-radius\);/);
      expect(css).to.match(/\[part='input-wrapper'\] \{[^}]*gap: var\(--lr-input-gap\);/);
      expect(css).to.match(/\[part='input-wrapper'\] \{[^}]*border-radius: var\(--lr-input-radius\);/);
    });
  });
});

import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { html as staticHtml, unsafeStatic } from 'lit/static-html.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import '../../lr-input.js';
import '../../lr-number-input.js';
import '../../lr-time-input.js';
import '../../lr-native-time-input.js';
import '../../lr-code-editor.js';
import '../../lr-otp-input.js';
import '../../lr-phone-input.js';
import '../../lr-signature-pad.js';
import '../../lr-textarea.js';
import '../../lr-time-range.js';
import '../../lr-token-input.js';
import type { LyraTimeInput } from './time-input.class.js';
import type { LyraTokenInput } from '../token-input/token-input.class.js';

type Updating = HTMLElement & { updateComplete: Promise<unknown> };

const fields = [
  ['lr-input', '[part="input"]', 'Text', 'inputLabel'],
  ['lr-textarea', '[part="textarea"]', 'Text', 'textareaLabel'],
  ['lr-code-editor', '[part="textarea"]', 'Code editor', 'codeEditorLabel'],
  ['lr-otp-input', '[part="control"]', 'Verification code', 'otpInputLabel'],
  ['lr-phone-input', '[part="input"]', 'Phone', 'phoneInputLabel'],
  ['lr-signature-pad', '[part="surface"]', 'Signature', 'signaturePadLabel'],
  ['lr-time-input', '[role="group"]', 'Time', 'timeInputLabel'],
  ['lr-token-input', '[part="input"]', 'Tokens', 'tokenInputLabel'],
] as const;

function part(el: HTMLElement, selector: string): HTMLElement {
  return el.shadowRoot!.querySelector<HTMLElement>(selector)!;
}

describe('text control accessible names', () => {
  for (const [tag, selector, name] of fields) {
    it(`uses the fallback for a whitespace-only ${tag} label`, async () => {
      const element = unsafeStatic(tag);
      const el = await fixture<Updating>(
        staticHtml`<${element} aria-label="   " label="   "></${element}>`,
      );
      expect(part(el, selector).getAttribute('aria-label')).to.equal(name);
    });

    it(`lets the visible ${tag} label name the control when the override is whitespace`, async () => {
      const element = unsafeStatic(tag);
      const el = await fixture<Updating>(
        staticHtml`<${element} aria-label="   " label="Visible name"></${element}>`,
      );
      const control = part(el, selector);
      expect(control.getAttribute('aria-label')).to.equal(null);
      const id = control.getAttribute('aria-labelledby');
      const label = id ? el.shadowRoot!.getElementById(id) : (control as HTMLInputElement).labels?.item(0);
      expect(label?.textContent?.trim()).to.equal('Visible name');
    });
  }

  it('routes the token label fallback through the string override and preserves an explicit empty name', async () => {
    const el = await fixture<LyraTokenInput>(html`<lr-token-input .strings=${{ tokenInputLabel: 'Recipients' }}></lr-token-input>`);
    const control = part(el, '[part="input"]');
    expect(control.getAttribute('aria-label')).to.equal('Recipients');
    el.setAttribute('aria-label', '');
    await el.updateComplete;
    expect(control.getAttribute('aria-label')).to.equal('');
  });

  it('preserves explicit empty accessible names on text, time, and signature controls', async () => {
    const wrapper = await fixture(html`<div>
      <lr-input aria-label="" label="Name"></lr-input>
      <lr-time-input aria-label="" label="Time"></lr-time-input>
      <lr-signature-pad aria-label="" label="Signature"></lr-signature-pad>
      <lr-code-editor aria-label="" label="Code"></lr-code-editor>
    </div>`);
    expect(part(wrapper.querySelector('lr-input')!, '[part="input"]').getAttribute('aria-label')).to.equal('');
    const time = part(wrapper.querySelector('lr-time-input')!, '[role="group"]');
    expect(time.getAttribute('aria-label')).to.equal('');
    expect(time.hasAttribute('aria-labelledby')).to.equal(false);
    const signature = part(wrapper.querySelector('lr-signature-pad')!, '[part="surface"]');
    expect(signature.getAttribute('aria-label')).to.equal('');
    expect(signature.hasAttribute('aria-labelledby')).to.equal(false);
    const editor = wrapper.querySelector('lr-code-editor')!;
    const field = part(editor, '[part="textarea"]');
    expect(field.getAttribute('aria-label')).to.equal('');
    editor.removeAttribute('aria-label');
    editor.accessibleLabel = 'Source';
    await editor.updateComplete;
    expect(field.getAttribute('aria-label')).to.equal('Source');
  });

  for (const [tag, selector, english, key] of fields) {
    it(`restores the localized name of ${tag} after removing an explicit override`, async () => {
      const element = unsafeStatic(tag);
      const el = await fixture<Updating>(staticHtml`<${element}></${element}>`);
      const control = part(el, selector);
      expect(control.getAttribute('aria-label')).to.equal(english);
      Object.assign(el, { strings: { [key]: 'Localized name' } });
      el.setAttribute('aria-label', 'Customer field');
      await el.updateComplete;
      expect(control.getAttribute('aria-label')).to.equal('Customer field');
      el.removeAttribute('aria-label');
      await el.updateComplete;
      expect(control.getAttribute('aria-label')).to.equal('Localized name');
    });
  }

  it('uses localized handle names only for whitespace and absent labels', async () => {
    const el = await fixture<Updating>(
      html`<lr-time-range start-label="  " end-label=""></lr-time-range>`,
    );
    const start = part(el, '[part="handle-start"]');
    const end = part(el, '[part="handle-end"]');
    expect(start.getAttribute('aria-label')).to.equal('Range start');
    expect(end.getAttribute('aria-label')).to.equal('');
    el.removeAttribute('end-label');
    await el.updateComplete;
    expect(end.getAttribute('aria-label')).to.equal('Range end');
  });
});

describe('shared field rendering', () => {
  for (const [tag, selector] of fields) {
    it(`keeps ${tag} supporting descriptions in rendered error-first order`, async () => {
      const element = unsafeStatic(tag);
      const el = await fixture<Updating>(
        staticHtml`<${element}><span slot="hint">Hint copy</span><span slot="error">Error copy</span></${element}>`,
      );
      const error = part(el, '[part="error"]');
      const hint = part(el, '[part~="hint"]');
      const ids = part(el, selector).getAttribute('aria-describedby')?.split(' ');
      expect(ids?.slice(0, 2)).to.deep.equal([error.id, hint.id]);
      expect(Boolean(error.compareDocumentPosition(hint) & Node.DOCUMENT_POSITION_FOLLOWING)).to.equal(true);
      expect(getComputedStyle(error).display).not.to.equal('none');
      expect(getComputedStyle(hint).display).not.to.equal('none');
    });
  }

  for (const [tag, selector] of [
    ['lr-token-input', '[part~="input-wrapper"]'],
    ['lr-code-editor', '[part="editor"]'],
    ['lr-phone-input', '[part="input-wrapper"]'],
    ['lr-signature-pad', '[part="surface"]'],
  ] as const) {
    it(`applies the shared field radius to ${tag}`, async () => {
      const element = unsafeStatic(tag);
      const el = await fixture<Updating>(
        staticHtml`<${element} style="--lr-theme-form-control-radius: 13px"></${element}>`,
      );
      expect(getComputedStyle(part(el, selector)).borderStartStartRadius).to.equal('13px');
    });
  }

  it('lets RTL prose find its own direction and keeps numeric and code entry LTR', async () => {
    const wrapper = await fixture(html`<div dir="rtl">
      <lr-input value="Latine"></lr-input>
      <lr-number-input value="1234"></lr-number-input>
      <lr-code-editor value="const n = 1234;"></lr-code-editor>
      <lr-phone-input></lr-phone-input>
    </div>`);
    const input = part(wrapper.querySelector('lr-input')!, '[part="input"]');
    expect(getComputedStyle(input).direction).to.equal('ltr');
    const control = wrapper.querySelector('lr-input')!;
    control.value = 'مرحبا';
    await control.updateComplete;
    expect(getComputedStyle(input).direction).to.equal('rtl');
    control.setAttribute('dir', 'ltr');
    expect(getComputedStyle(input).direction).to.equal('ltr');
    control.setAttribute('dir', 'rtl');
    expect(getComputedStyle(input).direction).to.equal('rtl');
    for (const [tag, selector] of [
      ['lr-number-input', '[part="input"]'],
      ['lr-code-editor', '[part="textarea"]'],
      ['lr-phone-input', '[part="input"]'],
    ]) {
      expect(getComputedStyle(part(wrapper.querySelector(tag!)!, selector!)).direction).to.equal('ltr');
    }
  });

  it('keeps empty text and native time fields in the surrounding direction', async () => {
    const wrapper = await fixture(html`<div dir="rtl">
      <lr-input placeholder="you@example.com"></lr-input>
      <lr-native-time-input value="09:30"></lr-native-time-input>
    </div>`);
    const time = part(wrapper.querySelector('lr-native-time-input')!, '[part="input"]');
    // Engines paint native time fields left to right whatever the computed direction; the field's
    // directionality still decides where the platform places its picker indicator.
    expect(time.matches(':dir(rtl)')).to.equal(true);
    const control = wrapper.querySelector('lr-input')!;
    const input = part(control, '[part="input"]');
    expect(getComputedStyle(input).direction).to.equal('rtl');
    control.value = 'Latine';
    await control.updateComplete;
    expect(getComputedStyle(input).direction).to.equal('ltr');
    control.value = '';
    await control.updateComplete;
    expect(getComputedStyle(input).direction).to.equal('rtl');
  });

  it('uses the shared transition for time segments and both input actions', async () => {
    const wrapper = await fixture(html`<div style="--lr-transition-interactive: opacity 123ms">
      <lr-time-input value="11:30" with-clear></lr-time-input>
      <lr-input type="password" value="abc" password-toggle></lr-input>
      <lr-input id="clearable" value="abc" clearable></lr-input>
    </div>`);
    for (const [tag, selector] of [
      ['lr-time-input', '[part="segment"]'],
      ['lr-time-input', '[part="expand-button"]'],
      ['lr-time-input', '[part="clear-button"]'],
      ['#clearable', '[part="clear-button"]'],
      ['lr-input', '[part="password-toggle"]'],
    ]) {
      expect(getComputedStyle(part(wrapper.querySelector(tag!)!, selector!)).transitionProperty).to.equal('opacity');
    }
  });

  for (const [format, value, required, names] of [
    ['24', '10:15', false, ['minute', 'hour']],
    ['12', '22:15:30', true, ['hour', 'minute', 'second', 'dayPeriod']],
  ] as const) {
    it(`commits a cleared ${format}-hour time only after all visible segments are empty`, async () => {
      const el = await fixture<LyraTimeInput>(html`
        <lr-time-input hour-format=${format} value=${value} ?required=${required}></lr-time-input>
      `);
      const events: string[] = [];
      for (const type of ['input', 'lr-input', 'change', 'lr-change', 'lr-clear']) {
        el.addEventListener(type, () => events.push(type));
      }
      const erase = (name: string) => part(el, `[data-segment="${name}"]`).dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }),
      );
      for (const name of names.slice(0, -1)) {
        await focusByKeyboard(part(el, `[data-segment="${name}"]`));
        erase(name);
        el.blur();
        expect(el.value).to.equal('');
        expect(el.validity.badInput).to.equal(true);
        expect(events.splice(0)).to.deep.equal(['input', 'lr-input']);
      }
      const last = names[names.length - 1]!;
      erase(last);
      expect(el.validity.badInput).to.equal(false);
      expect(el.validity.valueMissing).to.equal(required);
      expect(events.splice(0)).to.deep.equal(['input', 'lr-input', 'change', 'lr-change']);
      erase(last);
      expect(events).to.deep.equal(['input', 'lr-input']);
      el.hourFormat = '12';
      await el.updateComplete;
      expect(part(el, '[data-segment="dayPeriod"]').hasAttribute('aria-valuenow')).to.equal(false);
    });
  }

  it('starts a new time commit after recompletion, reset, restoration and programmatic writes', async () => {
    const el = await fixture<LyraTimeInput>(html`<lr-time-input hour-format="24"></lr-time-input>`);
    const changes: string[] = [];
    el.addEventListener('lr-change', event => changes.push(event.detail.value));
    const key = (name: string, value: string) => part(el, `[data-segment="${name}"]`).dispatchEvent(
      new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }),
    );
    for (const replace of [() => { el.value = ''; }, () => el.formResetCallback(), () => el.formStateRestoreCallback('')]) {
      el.value = '12:30';
      key('minute', 'Delete');
      replace();
      key('hour', 'Delete');
      expect(changes).to.deep.equal([]);
    }
    el.value = '12:30';
    key('minute', 'Delete');
    key('minute', '5');
    key('hour', 'Delete');
    key('minute', 'Delete');
    expect(changes).to.deep.equal(['12:05', '']);
  });

  it('bounds the opted-in token DOM while preserving the whole value', async () => {
    const tokens = Array.from({ length: 600 }, (_, index) => `token ${index}`);
    const el = await fixture<LyraTokenInput>(html`<lr-token-input max-tokens-visible="200" .value=${tokens}></lr-token-input>`);
    expect(el.value).to.have.length(600);
    expect(el.shadowRoot!.querySelectorAll('[part~="token"]').length).to.equal(200);
    expect(part(el, '[part="token-overflow"]').textContent).to.contain('400');
  });
});

describe('live fieldset disablement', () => {
  it('stops relaying telephone focus if the fieldset is disabled during capture', async () => {
    const fieldset = await fixture<HTMLFieldSetElement>(html`<fieldset><lr-phone-input></lr-phone-input></fieldset>`);
    const phone = fieldset.querySelector('lr-phone-input')!;
    await phone.updateComplete;
    const events: string[] = [];
    fieldset.addEventListener('focus', event => events.push(event.type));
    phone.input!.addEventListener('focus', () => { fieldset.disabled = true; }, { capture: true, once: true });
    await focusByKeyboard(phone.input!);
    expect(fieldset.disabled).to.equal(true);
    expect(events).to.deep.equal([]);
  });

  it('stops a pending textarea key event as soon as the parent fieldset is disabled', async () => {
    const fieldset = await fixture<HTMLFieldSetElement>(html`<fieldset><lr-textarea></lr-textarea></fieldset>`);
    const el = fieldset.querySelector('lr-textarea')!;
    await el.updateComplete;
    const events: string[] = [];
    fieldset.addEventListener('keydown', event => events.push(event.key));
    fieldset.disabled = true;
    el.input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }));
    expect(events).to.deep.equal([]);
  });

  it('discards the draft and preserves committed tokens when readonly blocks editing', async () => {
    const el = await fixture<LyraTokenInput>(html`<lr-token-input .value=${['saved']}></lr-token-input>`);
    const draft = el.shadowRoot!.querySelector<HTMLInputElement>('[part="input"]')!;
    draft.value = 'pending';
    draft.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(draft.value).to.equal('pending');
    const requests: string[] = [];
    for (const type of ['lr-token-add-request', 'lr-token-remove-request', 'change']) {
      el.addEventListener(type, () => requests.push(type));
    }
    el.readonly = true;
    draft.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="remove"]')!.click();
    await el.updateComplete;
    expect(el.value).to.deep.equal(['saved']);
    expect(draft.value).to.equal('');
    expect(requests).to.deep.equal([]);
  });
});

describe('native selection forwarding', () => {
  for (const tag of ['lr-input', 'lr-textarea', 'lr-phone-input', 'lr-token-input'] as const) {
    it(`exposes nullable selection on ${tag} before connecting and forwards edits after render`, async () => {
      const host = document.createElement(tag);
      host.selectionStart = 2;
      host.selectionEnd = 3;
      host.selectionDirection = 'backward';
      expect([host.selectionStart, host.selectionEnd, host.selectionDirection]).to.deep.equal([null, null, null]);

      const holder = await fixture<HTMLElement>(html`<div></div>`);
      holder.append(host);
      await host.updateComplete;
      const field = host.shadowRoot!.querySelector<HTMLInputElement | HTMLTextAreaElement>('input:not([type="hidden"]), textarea')!;
      field.value = '12345';
      host.setSelectionRange(1, 4, 'backward');
      expect([host.selectionStart, host.selectionEnd, host.selectionDirection]).to.deep.equal([1, 4, 'backward']);
      host.selectionStart = 2;
      host.selectionEnd = 3;
      host.selectionDirection = 'forward';
      expect([field.selectionStart, field.selectionEnd, field.selectionDirection]).to.deep.equal([2, 3, 'forward']);
      host.select();
      expect([field.selectionStart, field.selectionEnd]).to.deep.equal([0, 5]);
    });
  }
});

describe('text control native and theme options', () => {
  it('forwards editing assistance to both token fields and omits unset native attributes', async () => {
    const el = await fixture<LyraTokenInput>(html`
      <lr-token-input editable autocomplete="off" inputmode="email" enterkeyhint="done"
        .value=${['alpha']}></lr-token-input>
    `);
    const token = part(el, '[part~="token-label"]');
    token.dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', bubbles: true, cancelable: true }));
    await el.updateComplete;
    const fields = [part(el, '[part="input"]'), part(el, '[part="token-editor"]')];
    for (const [attribute, value] of [['autocomplete', 'off'], ['inputmode', 'email'], ['enterkeyhint', 'done']] as const) {
      for (const input of fields) expect(input.getAttribute(attribute)).to.equal(value);
      el.removeAttribute(attribute);
    }
    await el.updateComplete;
    for (const input of fields) {
      for (const attribute of ['autocomplete', 'inputmode', 'enterkeyhint']) {
        expect(input.hasAttribute(attribute)).to.equal(false);
      }
    }
  });

  for (const [tag, selector, pseudo] of [
    ['lr-textarea', '[part="textarea"]', '::placeholder'],
    ['lr-phone-input', '[part="input"]', '::placeholder'],
    ['lr-token-input', '[part="input"]', '::placeholder'],
    ['lr-otp-input', '[part~="placeholder-mask"]', null],
  ] as const) {
    it(`themes the ${tag} placeholder color`, async () => {
      const element = unsafeStatic(tag);
      const el = await fixture<Updating>(tag === 'lr-otp-input'
        ? staticHtml`<${element} with-mask></${element}>`
        : staticHtml`<${element} placeholder="Hint"></${element}>`);
      const before = getComputedStyle(part(el, selector), pseudo).color;
      el.style.setProperty(`--${tag}-placeholder-color`, 'rgb(12, 34, 56)');
      expect(before).not.to.equal('rgb(12, 34, 56)');
      expect(getComputedStyle(part(el, selector), pseudo).color).to.equal('rgb(12, 34, 56)');
    });
  }
});

describe('field theme overrides', () => {
  for (const [tag, selector] of [
    ['lr-token-input', '[part~="input-wrapper"]'], ['lr-phone-input', '[part="input-wrapper"]'],
    ['lr-code-editor', '[part="editor"]'], ['lr-otp-input', '[part~="segment"]'],
    ['lr-signature-pad', '[part="surface"]'],
  ] as const) {
    it(`applies the shared invalid border to ${tag} after interaction`, async () => {
      const element = unsafeStatic(tag);
      const root = await fixture<HTMLElement>(staticHtml`
        <div><${element} required style="--lr-form-control-invalid-border-color: rgb(75, 20, 65)"></${element}><button type="button">Away</button></div>
      `);
      const el = root.firstElementChild as Updating & {reportValidity(): boolean};
      expect(el.reportValidity()).to.equal(false);
      // The invalid edge yields to the focus edge, and reportValidity() may focus the field. Move
      // focus by keyboard: a pointer press could land on the signature surface and draw a stroke.
      await focusByKeyboard(root.querySelector('button')!);
      await el.updateComplete;
      await waitUntil(() => getComputedStyle(part(el, selector)).borderTopColor === 'rgb(75, 20, 65)');
    });
  }

  it('paints both the code editor and its scrollable gutter with the editor fill', async () => {
    const el = await fixture<HTMLElement>(html`
      <lr-code-editor style="--lr-code-editor-fill: rgb(25, 41, 58)"></lr-code-editor>
    `);
    for (const name of ['editor', 'gutter']) {
      expect(getComputedStyle(part(el, `[part="${name}"]`)).backgroundColor).to.equal('rgb(25, 41, 58)');
    }
  });

  it('uses the shared field geometry for the code textarea and gutter', async () => {
    const el = await fixture<HTMLElement>(html`
      <lr-code-editor size="s" style="--lr-form-control-padding-inline: 19px; --lr-form-control-font-size: 17px"></lr-code-editor>
    `);
    for (const selector of ['[part="gutter"]', 'textarea']) {
      const style = getComputedStyle(part(el, selector));
      expect(style.paddingTop).to.equal('19px');
      expect(style.fontSize).to.equal('17px');
    }
  });
});

for (const tag of ['lr-textarea', 'lr-code-editor']) {
  it(`keeps ${tag} editable if resize observation cannot attach`, async () => {
    const Observer = window.ResizeObserver;
    window.ResizeObserver = class extends Observer {
      override observe(target: Element, options?: ResizeObserverOptions): void {
        if (target.matches('textarea, .editor-measure')) throw new Error('Observation unavailable');
        super.observe(target, options);
      }
    };
    try {
      const element = unsafeStatic(tag);
      const el = await fixture<Updating & { value: string }>(
        staticHtml`<${element} resize="auto"></${element}>`,
      );
      el.value = 'first\nsecond';
      await el.updateComplete;
      const textarea = el.shadowRoot!.querySelector('textarea')!;
      expect(textarea.value).to.equal(el.value);
      expect(textarea.clientHeight).to.be.at.least(textarea.scrollHeight - 1);
    } finally {
      window.ResizeObserver = Observer;
    }
  });
}

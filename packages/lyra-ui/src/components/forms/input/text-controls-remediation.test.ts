import { expect, fixture, html } from '@open-wc/testing';
import { html as staticHtml, unsafeStatic } from 'lit/static-html.js';
import './input.js';
import './number-input.js';
import './time-input.js';
import '../code-editor/code-editor.js';
import '../otp-input/otp-input.js';
import '../phone-input/phone-input.js';
import '../signature-pad/signature-pad.js';
import '../textarea/textarea.js';
import '../time-range/time-range.js';
import '../token-input/token-input.js';
import type { LyraTimeInput } from './time-input.class.js';
import type { LyraTokenInput } from '../token-input/token-input.class.js';

type Updating = HTMLElement & { updateComplete: Promise<unknown> };

const fields = [
  ['lr-input', '[part="input"]', 'Text'],
  ['lr-textarea', '[part="textarea"]', 'Text'],
  ['lr-code-editor', '[part="textarea"]', 'Code editor'],
  ['lr-otp-input', '[part="control"]', 'Verification code'],
  ['lr-phone-input', '[part="input"]', 'Phone'],
  ['lr-signature-pad', '[part="surface"]', 'Signature'],
  ['lr-time-input', '[role="group"]', 'Time'],
  ['lr-token-input', '[part="input"]', 'Tokens'],
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
    ['lr-token-input', '[part="input-wrapper"]'],
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

  it('emits one change pair when a segment edit clears the committed time', async () => {
    const el = await fixture<LyraTimeInput>(
      html`<lr-time-input hour-format="24" value="10:15"></lr-time-input>`,
    );
    const events: string[] = [];
    for (const type of ['input', 'lr-input', 'change', 'lr-change']) {
      el.addEventListener(type, () => events.push(`${type}:${el.value}`));
    }
    const minute = part(el, '[data-segment="minute"]');
    for (const key of ['Backspace', 'Delete']) {
      minute.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    }
    expect(el.value).to.equal('');
    expect(events.filter(event => event.includes('change'))).to.deep.equal(['change:', 'lr-change:']);
    expect(events.slice(0, 4)).to.deep.equal(['input:', 'lr-input:', 'change:', 'lr-change:']);
  });

  it('bounds the default token DOM while preserving the whole value', async () => {
    const tokens = Array.from({ length: 600 }, (_, index) => `token ${index}`);
    const el = await fixture<LyraTokenInput>(html`<lr-token-input .value=${tokens}></lr-token-input>`);
    expect(el.value).to.have.length(600);
    expect(el.shadowRoot!.querySelectorAll('[part="token"]').length).to.equal(200);
    expect(part(el, '[part="token-overflow"]').textContent).to.contain('400');
  });
});

describe('text control native and theme options', () => {
  it('forwards editing assistance to both token fields and omits unset native attributes', async () => {
    const el = await fixture<LyraTokenInput>(html`
      <lr-token-input editable autocomplete="off" inputmode="email" enterkeyhint="done"
        .value=${['alpha']}></lr-token-input>
    `);
    const token = part(el, '[part="token-label"]');
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

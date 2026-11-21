import { expect, fixture, html } from '@open-wc/testing';
import { LyraElement } from './lyra-element.js';
import { defineElement, tag } from './prefix.js';
import '../components/lr-button.js';
import '../components/lr-input.js';
import '../components/lr-textarea.js';
import '../components/lr-select.js';
import '../components/lr-combobox.js';
import '../components/lr-emoji-picker.js';
import '../components/lr-color-picker.js';
import '../components/lr-locale-picker.js';
import '../components/lr-rubric-form.js';
import '../components/lr-signature-pad.js';
import '../components/lr-code-editor.js';
import '../components/lr-slider.js';
import '../components/lr-toggle.js';
import '../components/lr-otp-input.js';
import '../components/lr-checkbox.js';
import '../components/lr-token-input.js';
import '../components/lr-time-range.js';
import '../components/lr-icon-button.js';
import '../components/lr-swatch-picker.js';
import '../components/lr-date-input.js';
import '../components/lr-date-picker.js';
import '../components/lr-radio.js';
import '../components/lr-time-input.js';
import '../components/lr-switch.js';
import '../components/lr-phone-input.js';
import '../components/lr-country-picker.js';
import '../components/lr-model-select.js';

/** Each delegating control and the internal element its `focus()` forwards to. */
const TARGETS = [
  ['button', '[part~="base"]'],
  ['input', '[part="input"]'],
  ['textarea', '[part="textarea"]'],
  ['select', '[part="trigger"]'],
  ['combobox', '[part="combobox-input"]'],
] as const;

class NeverRenders extends LyraElement {
  calls = 0;
  protected override shouldUpdate(): boolean {
    return false;
  }
  override focus(options?: FocusOptions): void {
    if (this.deferFocusUntilRendered(options)) return;
    this.calls += 1;
  }
}
defineElement('focus-never-renders-probe', NeverRenders);

async function container(): Promise<HTMLDivElement> {
  return fixture<HTMLDivElement>(html`<div></div>`);
}

for (const [name, selector] of TARGETS) {
  it(`${name} honours focus() called before its first render`, async () => {
    const el = document.createElement(tag(name)) as LyraElement;
    (await container()).append(el);
    el.focus();
    el.focus({ preventScroll: true });
    await el.updateComplete;
    await Promise.resolve();
    expect(document.activeElement === el, 'host is the active element').to.be.true;
    expect(el.shadowRoot!.activeElement === el.shadowRoot!.querySelector(selector), 'inner target').to.be.true;
  });
}

it('keeps a disabled control unfocused when focus() was queued before render', async () => {
  const el = document.createElement(tag('input')) as LyraElement;
  el.setAttribute('disabled', '');
  (await container()).append(el);
  el.focus();
  await el.updateComplete;
  await Promise.resolve();
  expect(document.activeElement === el).to.be.false;
});

it('drops a queued focus when the control disconnects before its first render', async () => {
  const host = await container();
  const el = document.createElement(tag('button')) as LyraElement;
  el.textContent = 'Save';
  host.append(el);
  el.focus();
  el.remove();
  host.append(el);
  await el.updateComplete;
  await Promise.resolve();
  expect(document.activeElement === el).to.be.false;
});

it('replays a queued focus once even when the element never renders', async () => {
  const el = document.createElement(tag('focus-never-renders-probe')) as NeverRenders;
  (await container()).append(el);
  el.focus();
  await el.updateComplete;
  await Promise.resolve();
  await Promise.resolve();
  expect(el.calls).to.equal(1);
});

/** Every other delegating form control: a pre-render focus() is queued, then lands inside it. */
const QUEUED = [
  'emoji-picker', 'color-picker', 'locale-picker', 'signature-pad', 'code-editor', 'slider', 'toggle',
  'otp-input', 'checkbox', 'token-input', 'time-range', 'icon-button', 'date-input', 'date-picker',
  'time-input', 'switch', 'phone-input', 'country-picker', 'model-select',
];
for (const name of QUEUED) {
  it(`${name} applies a focus() queued before its first render`, async () => {
    const el = document.createElement(tag(name)) as LyraElement;
    if ('label' in el) el.setAttribute('label', 'Field');
    else el.textContent = 'Field';
    // Flag glyphs need an optional peer this suite does not install.
    if (name === 'locale-picker') el.setAttribute('without-flags', '');
    (await container()).append(el);
    el.focus();
    await el.updateComplete;
    await Promise.resolve();
    expect(document.activeElement === el, 'host contains focus').to.be.true;
  });
}

/** Controls whose focus target needs content: the queued call replays without a target. */
for (const name of ['rubric-form', 'swatch-picker', 'radio']) {
  it(`${name} replays a queued focus() harmlessly when it has nothing to focus`, async () => {
    const el = document.createElement(tag(name)) as LyraElement;
    (await container()).append(el);
    el.focus();
    await el.updateComplete;
    await Promise.resolve();
    expect(el.hasUpdated).to.be.true;
  });
}

it('blur() before the first render cancels a queued focus', async () => {
  const el = document.createElement(tag('button')) as LyraElement;
  el.textContent = 'Save';
  (await container()).append(el);
  el.focus();
  el.blur();
  await el.updateComplete;
  await Promise.resolve();
  expect(document.activeElement === el).to.be.false;
  expect(Object.prototype.hasOwnProperty.call(el, 'blur'), 'no instance blur left behind').to.be.false;
});

it('a queued focus never steals focus that moved elsewhere before the first render', async () => {
  const host = await container();
  const other = document.createElement('input');
  host.append(other);
  const el = document.createElement(tag('input')) as LyraElement;
  host.append(el);
  el.focus();
  other.focus();
  await el.updateComplete;
  await Promise.resolve();
  expect(document.activeElement === other).to.be.true;
});

it('a first update that throws drops the queued focus without an extra rejection', async () => {
  class ThrowsOnRender extends LyraElement {
    calls = 0;
    protected override update(changed: Map<PropertyKey, unknown>): void {
      super.update(changed);
      throw new Error('render failed');
    }
    override focus(options?: FocusOptions): void {
      if (this.deferFocusUntilRendered(options)) return;
      this.calls += 1;
    }
  }
  defineElement('focus-throws-probe', ThrowsOnRender);
  const unhandled: unknown[] = [];
  const onUnhandled = (event: PromiseRejectionEvent): void => {
    unhandled.push(event.reason);
    event.preventDefault();
  };
  const onError = (event: ErrorEvent): void => event.preventDefault();
  window.addEventListener('unhandledrejection', onUnhandled);
  window.addEventListener('error', onError);
  try {
    const el = document.createElement(tag('focus-throws-probe')) as ThrowsOnRender;
    (await container()).append(el);
    el.focus();
    await el.updateComplete.catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(el.calls).to.equal(0);
    expect(unhandled.length, 'unhandled rejections').to.equal(0);
  } finally {
    window.removeEventListener('unhandledrejection', onUnhandled);
    window.removeEventListener('error', onError);
  }
});

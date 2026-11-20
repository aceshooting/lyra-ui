import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LitElement } from 'lit';
import { tag } from './prefix.js';
import '../components/lr-checkbox.js';
import '../components/lr-switch.js';
import '../components/lr-checkbox-group.js';
import '../components/lr-radio-group.js';
import '../components/lr-slider.js';
import '../components/lr-code-editor.js';
import '../components/lr-otp-input.js';
import '../components/lr-date-input.js';
import '../components/lr-phone-input.js';
import '../components/lr-time-input.js';
import '../components/lr-rubric-form.js';
import '../components/lr-graph-query-builder.js';
import '../components/lr-known-date.js';
import '../components/lr-select.js';
import '../components/lr-combobox.js';

for (const name of ['checkbox', 'switch', 'checkbox-group', 'radio-group', 'slider', 'code-editor',
  'otp-input', 'date-input', 'phone-input', 'time-input', 'rubric-form', 'graph-query-builder', 'known-date']) {
  it(`${name} keeps supporting slots visible across reassignment and reconnect`, async () => {
    const container = await fixture<HTMLDivElement>(html`<div></div>`);
    const control = document.createElement(tag(name)) as LitElement;
    const hint = document.createElement('span');
    hint.slot = 'hint';
    hint.textContent = 'Supporting text';
    control.append(hint);
    container.append(control);
    await control.updateComplete;
    const visible = (slotName: string): boolean => {
      const slot = control.shadowRoot?.querySelector(`slot[name="${slotName}"]`);
      return Boolean(slot && !slot.closest('[hidden]'));
    };
    await waitUntil(() => visible('hint'));
    hint.slot = 'error';
    await waitUntil(() => visible('error') && !visible('hint'));
    control.remove();
    hint.slot = 'hint';
    container.append(control);
    await control.updateComplete;
    await waitUntil(() => visible('hint') && !visible('error'));
    hint.remove();
    await waitUntil(() => !visible('hint'));
  });
}

for (const name of ['select', 'combobox']) {
  it(`${name} preserves shared chrome tokens and hides empty support text`, async () => {
    const container = await fixture<HTMLDivElement>(html`<div></div>`);
    const control = document.createElement(tag(name)) as LitElement & { label: string; hint: string; errorText: string };
    control.style.setProperty('--lr-space-xs', '7px');
    control.style.setProperty('--lr-font-size-sm', '13px');
    control.label = 'Choice';
    control.hint = 'Supporting text';
    control.errorText = 'Review this choice';
    container.append(control);
    await control.updateComplete;
    const hint = control.shadowRoot!.querySelector<HTMLElement>('[part~="hint"]')!;
    const error = control.shadowRoot!.querySelector<HTMLElement>('[part~="error"]')!;
    expect(hint.id).to.equal(`${name}-hint`);
    expect(error.id).to.equal(`${name}-error`);
    expect(getComputedStyle(hint).marginBlockStart).to.equal('7px');
    expect(getComputedStyle(error).fontSize).to.equal('13px');
    if (name === 'select') {
      expect(hint.part.contains('form-control-help-text')).to.equal(true);
      expect(hint.querySelector('slot[name="help-text"]') !== null).to.equal(true);
    }
    control.hint = '';
    control.errorText = '';
    await control.updateComplete;
    expect(getComputedStyle(hint).display).to.equal('none');
    expect(getComputedStyle(error).display).to.equal('none');
  });
}

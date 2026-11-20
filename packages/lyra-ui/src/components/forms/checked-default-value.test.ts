import { expect, fixture, html } from '@open-wc/testing';
import '../lr-checkbox.js';
import '../lr-switch.js';
import '../lr-radio.js';
import '../lr-radio-button.js';
import type { LyraElement } from '../../internal/lyra-element.js';

type CheckedControl = LyraElement & { checked: boolean; defaultChecked: boolean; value: string | null; defaultValue: string | null; name: string };

for (const name of ['lr-checkbox', 'lr-switch', 'lr-radio', 'lr-radio-button']) {
  it(`${name} keeps defaultValue, submitted value, and reset semantics in sync`, async () => {
    const form = await fixture<HTMLFormElement>(html`<form></form>`);
    const control = document.createElement(name) as CheckedControl;
    control.name = 'choice'; control.defaultChecked = true;
    control.defaultValue = 'initial';
    form.append(control); await control.updateComplete;
    expect(control.value).to.equal('initial');
    expect(new FormData(form).get('choice')).to.equal('initial');
    let changes = 0;
    control.addEventListener('lr-change', () => { changes++; });
    control.defaultValue = 'replacement'; await control.updateComplete;
    expect(control.value).to.equal('replacement');
    expect(control.getAttribute('value')).to.equal('replacement');
    expect(new FormData(form).get('choice')).to.equal('replacement');
    control.checked = false; await control.updateComplete;
    expect(new FormData(form).has('choice')).to.equal(false);
    form.reset(); await control.updateComplete;
    expect(control.checked).to.equal(true);
    expect(control.defaultValue).to.equal('replacement');
    expect(new FormData(form).get('choice')).to.equal('replacement');
    control.defaultValue = null; await control.updateComplete;
    expect(control.value).to.equal('on');
    expect(control.defaultValue).to.equal('on');
    // Radio options retain their reflected default; standalone check controls omit it.
    expect(control.getAttribute('value')).to.equal(name.startsWith('lr-radio') ? 'on' : null);
    expect(new FormData(form).get('choice')).to.equal('on');
    expect(changes).to.equal(0);
  });
}

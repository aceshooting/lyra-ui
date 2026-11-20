import { expect, fixture } from '@open-wc/testing';
import type { LyraElement } from '../../../internal/lyra-element.js';
import '../../lr-select.js';
import '../../lr-combobox.js';
import '../../lr-radio-group.js';
import '../../lr-checkbox.js';
import '../../lr-checkbox-group.js';
import '../../lr-switch.js';
import '../../lr-slider.js';

for (const name of ['select', 'combobox', 'radio-group', 'checkbox', 'checkbox-group', 'switch', 'slider']) {
  it(`${name} presents its error before its hint on the role owner`, async () => {
    const host = await fixture<LyraElement>(`<lr-${name} hint="Guidance" error-text="Problem"></lr-${name}>`);
    const root = host.shadowRoot!;
    const ids = root.querySelector('[aria-describedby]')!.getAttribute('aria-describedby')!.split(/\s+/);
    expect(ids.map(id => root.getElementById(id)?.textContent?.trim())).to.deep.equal(['Problem', 'Guidance']);
    const messages = root.querySelectorAll('[part~="error"], [part~="hint"]');
    expect(Array.from(messages, node => node.textContent?.trim())).to.deep.equal(['Problem', 'Guidance']);
  });
}

for (const name of ['combobox', 'checkbox-group']) {
  it(`${name} exposes the help-text alias alongside its authored hint`, async () => {
    const host = await fixture<LyraElement>(`<lr-${name} help-text="Help"><span slot="help-text">More</span></lr-${name}>`);
    const hint = host.shadowRoot!.querySelector<HTMLElement>('[part~="hint"]')!;
    expect(hint.hidden).to.equal(false);
    expect(hint.textContent?.trim()).to.equal('Help');
    expect(hint.querySelector<HTMLSlotElement>('[name="help-text"]')!.assignedElements()[0]?.textContent).to.equal('More');
  });
}

it('omits the select active descendant until navigation identifies an option', async () => {
  const select = await fixture<LyraElement>('<lr-select><lr-option value="one">One</lr-option></lr-select>');
  expect(select.shadowRoot!.querySelector('[role="combobox"]')!.hasAttribute('aria-activedescendant')).to.equal(false);
});

it('aligns switch help and errors with the label in both writing directions', async () => {
  const control = await fixture<LyraElement>('<lr-switch hint="Hint" error-text="Error" style="--width:60px;--lr-switch-gap:13px">Label</lr-switch>');
  for (const dir of ['ltr', 'rtl']) {
    control.dir = dir;
    await control.updateComplete;
    const edge = dir === 'ltr' ? 'left' : 'right';
    const bounds = (part: string) => control.shadowRoot!.querySelector(`[part~="${part}"]`)!.getBoundingClientRect()[edge];
    expect(bounds('hint')).to.be.closeTo(bounds('label'), 1);
    expect(bounds('error')).to.be.closeTo(bounds('label'), 1);
  }
});

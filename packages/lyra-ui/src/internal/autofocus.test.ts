import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../components/forms/combobox/combobox.js';
import '../components/forms/checkbox/checkbox.js';
import '../components/forms/switch/switch.js';
import '../components/forms/radio/radio.js';
import '../components/forms/radio/radio-group.js';
import '../components/forms/button/button.js';
import '../components/forms/date-picker/date-input.js';
import type { LyraCombobox } from '../components/forms/combobox/combobox.js';
import type { LyraCheckbox } from '../components/forms/checkbox/checkbox.js';
import type { LyraSwitch } from '../components/forms/switch/switch.js';
import type { LyraRadio } from '../components/forms/radio/radio.js';
import type { LyraRadioGroup } from '../components/forms/radio/radio-group.js';
import type { LyraButton } from '../components/forms/button/button.js';
import type { LyraDateInput } from '../components/forms/date-picker/date-input.js';

/**
 * Regression coverage for {@link LyraElement}'s centralized `autofocus` handling
 * (`firstUpdated()` in `lyra-element.ts`). The native `autofocus` attribute is otherwise silently
 * inert on every Lyra component: `LyraElement` never sets `shadowRootOptions.delegatesFocus`, so
 * the shadow host itself is never a native autofocus candidate -- even though every component
 * below already has an `override focus()` that correctly forwards to its real internal target.
 *
 * `<lr-otp-input>` (and `<lr-input>`/`<lr-textarea>`/`<lr-select>`/`<lr-slider>`) manage `autofocus`
 * themselves by forwarding it onto their own internal native control, and are deliberately excluded
 * from this central path (see `hasOwnAutofocusAccessor` in `lyra-element.ts`); their own test files
 * cover that behavior.
 */
describe('global autofocus (LyraElement.firstUpdated)', () => {
  it('focuses the internal filter input of an autofocus lr-combobox after first render', async () => {
    const el = await fixture<LyraCombobox>(
      html`<lr-combobox label="Pick" autofocus></lr-combobox>`
    );
    const expected = el.shadowRoot!.querySelector('[part="combobox-input"]');
    expect(expected).to.not.equal(null);
    await waitUntil(() => el.shadowRoot!.activeElement === expected);
    expect(el.shadowRoot!.activeElement).to.equal(expected);
  });

  it('focuses the internal control of an autofocus lr-checkbox after first render', async () => {
    const el = await fixture<LyraCheckbox>(html`<lr-checkbox autofocus>Accept</lr-checkbox>`);
    const expected = el.shadowRoot!.querySelector('[part~="base"]');
    expect(expected).to.not.equal(null);
    await waitUntil(() => el.shadowRoot!.activeElement === expected);
    expect(el.shadowRoot!.activeElement).to.equal(expected);
  });

  it('never focuses a disabled autofocus lr-checkbox', async () => {
    const el = await fixture<LyraCheckbox>(
      html`<lr-checkbox autofocus disabled>Accept</lr-checkbox>`
    );
    await aTimeout(0);
    expect(el.shadowRoot!.activeElement).to.equal(null);
    expect(document.activeElement).to.not.equal(el);
  });

  it('focuses the internal control of an autofocus lr-switch after first render', async () => {
    const el = await fixture<LyraSwitch>(html`<lr-switch autofocus>Enable</lr-switch>`);
    const expected = el.shadowRoot!.querySelector('[part~="base"]');
    expect(expected).to.not.equal(null);
    await waitUntil(() => el.shadowRoot!.activeElement === expected);
    expect(el.shadowRoot!.activeElement).to.equal(expected);
  });

  it('focuses the checked option of an autofocus lr-radio-group after first render', async () => {
    const group = await fixture<LyraRadioGroup>(html`
      <lr-radio-group label="Choice" autofocus>
        <lr-radio value="a">A</lr-radio>
        <lr-radio value="b" checked>B</lr-radio>
      </lr-radio-group>
    `);
    const [, b] = [...group.querySelectorAll('lr-radio')] as LyraRadio[];
    if (!b) throw new Error('Expected the checked radio.');
    const expected = b.shadowRoot!.querySelector('[part~="base"]');
    expect(expected).to.not.equal(null);
    await waitUntil(() => b.shadowRoot!.activeElement === expected);
    expect(b.shadowRoot!.activeElement).to.equal(expected);
  });

  it('focuses the native control of an autofocus lr-button after first render', async () => {
    const el = await fixture<LyraButton>(html`<lr-button autofocus>Go</lr-button>`);
    const expected = el.shadowRoot!.querySelector('[part~="base"]');
    expect(expected).to.not.equal(null);
    await waitUntil(() => el.shadowRoot!.activeElement === expected);
    expect(el.shadowRoot!.activeElement).to.equal(expected);
  });

  it('never focuses a disabled autofocus lr-button', async () => {
    const el = await fixture<LyraButton>(html`<lr-button autofocus disabled>Go</lr-button>`);
    await aTimeout(0);
    expect(el.shadowRoot!.activeElement).to.equal(null);
  });

  it('focuses the internal text field of an autofocus lr-date-input after first render', async () => {
    const el = await fixture<LyraDateInput>(html`<lr-date-input autofocus></lr-date-input>`);
    const expected = el.shadowRoot!.querySelector('input[part="input"]');
    expect(expected).to.not.equal(null);
    await waitUntil(() => el.shadowRoot!.activeElement === expected);
    expect(el.shadowRoot!.activeElement).to.equal(expected);
  });

  it('never focuses a control with no autofocus attribute', async () => {
    const el = await fixture<LyraCheckbox>(html`<lr-checkbox>Accept</lr-checkbox>`);
    await aTimeout(0);
    expect(el.shadowRoot!.activeElement).to.equal(null);
    expect(document.activeElement).to.not.equal(el);
  });
});

import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-otp-input.js';
import '../../lr-code-editor.js';
import '../../lr-emoji-picker.js';
import type { LyraEmojiPicker } from '../emoji-picker/emoji-picker.class.js';

type Updating = HTMLElement & { updateComplete: Promise<unknown> };

/** Each control and the element that carries its stateful `aria-invalid`. */
const CONTROLS = [
  { tag: 'lr-otp-input', invalidTarget: '[part~="input"], input' },
  { tag: 'lr-code-editor', invalidTarget: 'textarea' },
  { tag: 'lr-emoji-picker', invalidTarget: '[part="grid"]' },
] as const;

describe('a native submit marks an untouched required field interacted', () => {
  it('sets the inner aria-invalid on every control once a submit attempt fails', async () => {
    const form = await fixture<HTMLFormElement>(html`
      <form @submit=${(event: Event) => event.preventDefault()}>
        <lr-otp-input required label="Code"></lr-otp-input>
        <lr-code-editor required label="Source"></lr-code-editor>
        <lr-emoji-picker required label="Reaction" .loadGroups=${() => Promise.resolve(null)}></lr-emoji-picker>
      </form>
    `);
    const elements = CONTROLS.map((control) => form.querySelector<Updating>(control.tag)!);
    await Promise.all(elements.map((el) => el.updateComplete));
    const read = () =>
      CONTROLS.map((control, index) => {
        const el = elements[index]!;
        const target = el.shadowRoot!.querySelector(control.invalidTarget);
        return `${control.tag}: ${target?.getAttribute('aria-invalid')} ${el.hasAttribute('data-invalid')}`;
      });
    expect(read()).to.deep.equal(CONTROLS.map((control) => `${control.tag}: false false`));

    form.requestSubmit();
    await Promise.all(elements.map((el) => el.updateComplete));
    expect(read()).to.deep.equal(CONTROLS.map((control) => `${control.tag}: true ${control.tag !== 'lr-emoji-picker'}`));
    expect((elements[2] as LyraEmojiPicker).validity.valueMissing).to.equal(true);
  });
});

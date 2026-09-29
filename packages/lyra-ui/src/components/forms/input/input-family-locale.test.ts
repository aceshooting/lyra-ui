import { expect, fixture, html } from '@open-wc/testing';
import { expectLocaleFallback } from '../../../../test/expected-locale-fallbacks.js';
import './input.js';
import '../../../translations/de/forms.js';
import type { LyraInput } from './input.class.js';

// This test module has its own browser realm and deliberately imports only the forms catalog.
describe('lr-input with the German forms catalog', () => {
  beforeEach(() => {
    // The cross-family required-field message is deliberately outside this forms-only import.
    expectLocaleFallback('de', ['fieldRequired']);
  });

  it('renders translated password actions and preserves the English fallback and caller override', async () => {
    const input = await fixture<LyraInput>(html`<lr-input lang="de" type="password" password-toggle></lr-input>`);
    const native = input.shadowRoot!.querySelector<HTMLInputElement>('input')!;
    const toggle = input.shadowRoot!.querySelector<HTMLButtonElement>('[part="password-toggle"]')!;
    expect(native.getAttribute('aria-label')).to.equal('Text');
    expect(toggle.getAttribute('aria-label')).to.equal('Passwort anzeigen');
    toggle.click();
    await input.updateComplete;
    expect(toggle.getAttribute('aria-label')).to.equal('Passwort ausblenden');

    input.lang = 'en';
    await input.updateComplete;
    expect(toggle.getAttribute('aria-label')).to.equal('Hide password');
    input.strings = { hidePassword: 'Conceal secret', inputLabel: 'Secret' };
    await input.updateComplete;
    expect(toggle.getAttribute('aria-label')).to.equal('Conceal secret');
    expect(native.getAttribute('aria-label')).to.equal('Secret');
  });

  it('reports and displays the translated match failure', async () => {
    const form = await fixture<HTMLFormElement>(html`
      <form lang="de">
        <lr-input id="family-password" aria-label="Passwort" value="first"></lr-input>
        <lr-input id="family-confirm" aria-label="Bestätigen" match="family-password" value="second"></lr-input>
      </form>
    `);
    const confirm = form.querySelector<LyraInput>('#family-confirm')!;
    expect(confirm.checkValidity()).to.equal(false);
    expect(confirm.validationMessage).to.equal('Die Werte stimmen nicht überein.');
    confirm.errorText = confirm.validationMessage;
    await confirm.updateComplete;
    const error = confirm.shadowRoot!.querySelector<HTMLElement>('[part="error"]')!;
    expect(error.textContent?.trim()).to.equal('Die Werte stimmen nicht überein.');
    expect(error.hidden).to.equal(false);
    confirm.value = 'first';
    await confirm.updateComplete;
    expect(confirm.checkValidity()).to.equal(true);
  });
});

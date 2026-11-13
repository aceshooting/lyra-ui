import { expect, fixture, html } from '@open-wc/testing';
import type { LyraButton } from './button.class.js';
import './button.js';

describe('button custom validity assigned while validation is barred', () => {
  for (const mode of ['disabled', 'fieldset', 'loading', 'link'] as const) {
    it(`retains and clears consumer errors across ${mode} transitions and form reset`, async () => {
      const form = await fixture<HTMLFormElement>(html`<form><fieldset>
        <lr-button type="submit">Continue</lr-button></fieldset></form>`);
      const button = form.querySelector('lr-button') as LyraButton;
      const fieldset = form.querySelector('fieldset')!;
      const setBarred = async (barred: boolean): Promise<void> => {
        if (mode === 'disabled') button.disabled = barred;
        else if (mode === 'fieldset') fieldset.disabled = barred;
        else if (mode === 'loading') button.loading = barred;
        else button.href = barred ? '#destination' : undefined;
        await button.updateComplete;
      };
      await setBarred(true);
      button.setCustomValidity('Approval required');
      await button.updateComplete;
      expect(button.getAttribute('custom-error')).to.equal('Approval required');
      expect(button.validity.valid).to.equal(true);
      expect(button.validationMessage).to.equal('');
      expect(form.checkValidity()).to.equal(true);
      form.reset();
      await button.updateComplete;
      await setBarred(false);
      expect(button.validity.customError).to.equal(true);
      expect(button.validationMessage).to.equal('Approval required');
      expect(form.checkValidity()).to.equal(false);
      await setBarred(true);
      button.setCustomValidity('');
      await button.updateComplete;
      expect(button.hasAttribute('custom-error')).to.equal(false);
      await setBarred(false);
      expect(button.validity.customError).to.equal(false);
      expect(button.validationMessage).to.equal('');
      expect(form.checkValidity()).to.equal(true);
    });
  }
});

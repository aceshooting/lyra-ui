import { expect, fixture, html } from '@open-wc/testing';
import type { LyraButton } from './button.js';
import './button.js';

const states = [
  ['null', () => null],
  ['File', () => new File(['old action'], 'action.txt')],
  ['FormData', () => { const data = new FormData(); data.set('action', 'old action'); return data; }],
] as const;

for (const reason of ['restore', 'autocomplete'] as const) {
  for (const [name, createState] of states) {
    it(`clears an unsupported ${name} submitter state during ${reason} without erasing custom validity`, async () => {
      const form = await fixture<HTMLFormElement>(html`
        <form><lr-button name="action" value="publish" required>Publish</lr-button></form>
      `);
      const button = form.querySelector<LyraButton>('lr-button')!;
      let changes = 0;
      for (const event of ['input', 'change', 'lr-input', 'lr-change']) button.addEventListener(event, () => changes++);
      button.setCustomValidity('Approval is required');

      button.formStateRestoreCallback(createState(), reason);
      await button.updateComplete;
      expect(button.value).to.equal('');
      expect(button.validity.valueMissing).to.equal(true);
      expect(button.validity.customError).to.equal(true);
      expect(button.validationMessage).to.equal('Approval is required');
      expect(new FormData(form).has('action')).to.equal(false);

      button.formStateRestoreCallback('draft', reason);
      await button.updateComplete;
      expect(button.value).to.equal('draft');
      expect(button.validity.valueMissing).to.equal(false);
      expect(button.validity.customError).to.equal(true);
      expect(new FormData(form).has('action')).to.equal(false);
      button.resetValidity();
      expect(button.validity.valid).to.equal(true);
      expect(changes).to.equal(0);
    });
  }
}

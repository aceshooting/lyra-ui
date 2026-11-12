import { expect, fixture } from '@open-wc/testing';
import type { LyraInputShared } from './input-shared.js';
import './input.js';
import './number-input.js';
import './native-time-input.js';

for (const tag of ['lr-input', 'lr-number-input', 'lr-native-time-input']) {
  describe(`${tag} required transitions`, () => {
    for (const initiallyRequired of [true, false]) {
      for (const binding of ['property', 'attribute']) {
        it(`updates form validity after ${binding} required changes from ${initiallyRequired}`, async () => {
          const form = await fixture<HTMLFormElement>(`<form><${tag} name="entry" aria-label="Entry" ${initiallyRequired ? 'required' : ''}></${tag}></form>`);
          const control = form.querySelector(tag) as LyraInputShared;
          await control.updateComplete;
          form.addEventListener('invalid', event => event.preventDefault(), true);
          expect(control.validity.valueMissing).to.equal(initiallyRequired);
          let submits = 0;
          form.addEventListener('submit', event => { event.preventDefault(); submits++; });

          for (const required of [!initiallyRequired, initiallyRequired, !initiallyRequired]) {
            if (binding === 'property') control.required = required;
            else control.toggleAttribute('required', required);
            await control.updateComplete;
            expect(control.validity.valueMissing, 'the form sees the rendered constraint without a control validity refresh').to.equal(required);
            expect(control.matches(':state(required)')).to.equal(required);
            expect(control.matches(':state(invalid)')).to.equal(required);
            expect(form.reportValidity()).to.equal(!required);
            const before = submits;
            form.requestSubmit();
            expect(submits - before, 'native form submission follows the updated constraint').to.equal(required ? 0 : 1);
          }
        });
      }
    }

    it('preserves a custom validation error while required is removed and restored', async () => {
      const form = await fixture<HTMLFormElement>(`<form><${tag} required aria-label="Entry"></${tag}></form>`);
      const control = form.querySelector(tag) as LyraInputShared;
      await control.updateComplete;
      form.addEventListener('invalid', event => event.preventDefault(), true);
      control.setCustomValidity('Review this entry');
      for (const required of [false, true, false]) {
        control.required = required;
        await control.updateComplete;
        expect(control.validity.customError).to.equal(true);
        expect(control.validationMessage).to.equal('Review this entry');
        expect(form.reportValidity()).to.equal(false);
      }
      control.setCustomValidity('');
      expect(form.reportValidity()).to.equal(true);
    });
  });
}

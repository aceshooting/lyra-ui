import { fixture, expect, html } from '@open-wc/testing';
import { LyraElement } from './lyra-element.js';
import { FormAssociated } from './form-associated.js';
import { tag } from './prefix.js';
import { LyraTextarea } from '../components/forms/textarea/textarea.js';

class Ctl extends FormAssociated(LyraElement) {
  render() {
    return html``;
  }
}
customElements.define(tag('demo-ctl'), Ctl);

it('submits its value via the form and restores the constructed default value on reset', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form><lr-demo-ctl name="x" value="hello"></lr-demo-ctl></form>
  `);
  const ctl = form.querySelector('lr-demo-ctl') as unknown as Ctl;
  expect(new FormData(form).get('x')).to.equal('hello');

  ctl.value = 'changed';
  form.reset();
  expect(ctl.value).to.equal('hello');
  expect(new FormData(form).get('x')).to.equal('hello');
});

it('does not let a user/programmatic value change become the reset default (true native `defaultValue` semantics)', async () => {
  // Regression test: only the *content attribute* (construction-time/
  // declarative) feeds the reset default. Without a
  // `value` attribute, no amount of later `.value =` assignment — however
  // many, or however "first" — may become what `form.reset()` restores to,
  // exactly like a plain native `<input>` with no `value` attribute.
  const form = await fixture<HTMLFormElement>(html`<form><lr-demo-ctl name="x"></lr-demo-ctl></form>`);
  const ctl = form.querySelector('lr-demo-ctl') as unknown as Ctl;
  ctl.value = 'first-user-edit';
  ctl.value = 'second-user-edit';
  form.reset();
  expect(ctl.value).to.equal('');
});

it('reflects disabled and required as attributes', async () => {
  const ctl = (await fixture(html`<lr-demo-ctl></lr-demo-ctl>`)) as unknown as Ctl;
  ctl.disabled = true;
  ctl.required = true;
  await (ctl as unknown as LyraElement).updateComplete;
  expect((ctl as unknown as HTMLElement).hasAttribute('disabled')).to.be.true;
  expect((ctl as unknown as HTMLElement).hasAttribute('required')).to.be.true;
});

it('marks the control invalid via ElementInternals while required and empty, valid once filled', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form><lr-demo-ctl name="x" required></lr-demo-ctl></form>
  `);
  const ctl = form.querySelector('lr-demo-ctl') as unknown as Ctl;
  expect(form.reportValidity()).to.be.false;
  expect((ctl as unknown as HTMLElement).matches(':invalid')).to.be.true;

  ctl.value = 'hello';
  expect(form.reportValidity()).to.be.true;
  expect((ctl as unknown as HTMLElement).matches(':valid')).to.be.true;
});

it('restores the constructed default value on form.reset(), not blank', async () => {
  const form = await fixture<HTMLFormElement>(
    html`<form><lr-demo-ctl name="x" value="2026-07-15"></lr-demo-ctl></form>`,
  );
  const ctl = form.querySelector('lr-demo-ctl') as unknown as Ctl;
  ctl.value = 'changed';
  form.reset();
  expect(ctl.value).to.equal('2026-07-15');
});

it('cascades disablement from an ancestor <fieldset disabled> via formDisabledCallback', async () => {
  const form = await fixture<HTMLFormElement>(
    html`<form><fieldset><lr-demo-ctl name="x"></lr-demo-ctl></fieldset></form>`,
  );
  const ctl = form.querySelector('lr-demo-ctl') as unknown as Ctl;
  const fieldset = form.querySelector('fieldset')!;
  expect(ctl.effectiveDisabled).to.be.false;

  fieldset.disabled = true;
  expect(ctl.effectiveDisabled).to.be.true;

  fieldset.disabled = false;
  expect(ctl.effectiveDisabled).to.be.false;
});

it('reflects a property-assigned `name` to the content attribute so form submission can key on it', async () => {
  const ctl = (await fixture(html`<lr-demo-ctl></lr-demo-ctl>`)) as unknown as Ctl;
  ctl.name = 'quantity';
  expect((ctl as unknown as HTMLElement).getAttribute('name')).to.equal('quantity');
  ctl.name = '';
  expect((ctl as unknown as HTMLElement).hasAttribute('name')).to.be.false;
  ctl.setFormValue('updated');
  expect(ctl.value).to.equal('updated');
});

it('submits an empty string, not a missing field, before `value` is ever assigned', async () => {
  const form = document.createElement('form');
  const ctl = document.createElement(tag('demo-ctl')) as unknown as Ctl;
  form.appendChild(ctl as unknown as Node);
  ctl.name = 'quantity';
  document.body.appendChild(form);
  const data = new FormData(form);
  expect(data.has('quantity')).to.be.true;
  expect(data.get('quantity')).to.equal('');
  form.remove();
});

it('updates constraint validity synchronously when `required` is assigned, with no await', () => {
  const ctl = document.createElement(tag('demo-ctl')) as unknown as Ctl;
  document.body.appendChild(ctl as unknown as Node);
  ctl.required = true;
  expect(ctl.checkValidity()).to.be.false;
  ctl.required = false;
  expect(ctl.checkValidity()).to.be.true;
  (ctl as unknown as HTMLElement).remove();
});

it('applies `disabled` synchronously to its attribute, FormData entry, and barred validity state', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form><lr-demo-ctl name="quantity" required></lr-demo-ctl></form>
  `);
  const ctl = form.querySelector('lr-demo-ctl') as unknown as Ctl;
  const host = ctl as unknown as HTMLElement;
  expect(ctl.checkValidity()).to.be.false;
  expect(new FormData(form).has('quantity')).to.be.true;

  ctl.disabled = true;
  expect(host.hasAttribute('disabled')).to.be.true;
  expect(new FormData(form).has('quantity')).to.be.false;
  expect(ctl.checkValidity()).to.be.true;

  ctl.disabled = false;
  expect(host.hasAttribute('disabled')).to.be.false;
  expect(new FormData(form).get('quantity')).to.equal('');
  expect(ctl.checkValidity()).to.be.false;
});

it('restores its own explicit `disabled` after an ancestor fieldset re-enables, instead of forcing it false', async () => {
  const ctl = (await fixture(html`<lr-demo-ctl disabled></lr-demo-ctl>`)) as unknown as Ctl;
  const withFormDisabledCallback = ctl as unknown as { formDisabledCallback(d: boolean): void };
  expect(ctl.disabled).to.be.true;
  withFormDisabledCallback.formDisabledCallback(true);
  expect(ctl.effectiveDisabled).to.be.true;
  withFormDisabledCallback.formDisabledCallback(false);
  expect(ctl.effectiveDisabled).to.be.true; // own explicit disabled still applies
  expect(ctl.disabled).to.be.true; // never force-cleared by the fieldset
});

it('exposes native-like form ownership, label, and constraint-validation state', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form id="owner">
      <label id="caption" for="control">Quantity</label>
      <lr-demo-ctl id="control" name="quantity" required></lr-demo-ctl>
    </form>
  `);
  const ctl = form.querySelector('lr-demo-ctl') as unknown as Ctl & {
    form: HTMLFormElement | null;
    labels: NodeList;
    validity: ValidityState;
    validationMessage: string;
    willValidate: boolean;
  };

  expect(ctl.form?.id).to.equal('owner');
  // Assert labels.length (a number), never the NodeList itself: a *failing* chai assertion whose
  // `actual` is a DOM node/NodeList hangs the whole wtr session (wtr ships `err.actual` verbatim in
  // its session-finished message, which is serialized with structuredClone() -- DataCloneError on
  // any DOM value, so no result is ever reported and the run dies at testsFinishTimeout).
  expect(ctl.labels.length).to.equal(1);
  expect((ctl.labels.item(0) as HTMLElement | null)?.id).to.equal('caption');
  expect(ctl.validity.valueMissing).to.be.true;
  expect(ctl.validationMessage).to.equal('This field is required.');
  expect(ctl.willValidate).to.be.true;

  ctl.disabled = true;
  expect(ctl.willValidate).to.be.false;
});

it('restores a string state synchronously without emitting a user event', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form><lr-demo-ctl name="quantity" value="initial"></lr-demo-ctl></form>
  `);
  const ctl = form.querySelector('lr-demo-ctl') as unknown as Ctl & {
    formStateRestoreCallback(state: string | File | FormData | null, mode?: 'restore' | 'autocomplete'): void;
  };

  ctl.value = 'changed';
  ctl.formStateRestoreCallback('restored', 'restore');

  expect(ctl.value).to.equal('restored');
  expect(new FormData(form).get('quantity')).to.equal('restored');
  expect(ctl.checkValidity()).to.be.true;
});

// `createFallbackInternals()` (the hand-rolled, inert `ElementInternals` substitute defined in
// this file) only ever runs when `this.attachInternals()` is missing, returns falsy, or throws --
// never in this repo's real Chromium test environment, where `attachInternals()` is natively
// implemented. Driven through the real `<lr-textarea>` component (not the local `Ctl` demo class
// above) so this proves the fallback actually integrates with a production component's own
// render/validity plumbing, not just the mixin in isolation. `<lr-textarea>` is one of the few
// `FormAssociated` consumers that does not override `updateValidity()`, so its validity behavior
// is exactly the base mixin's own required-and-empty check.
//
// Stubbing is scoped to `LyraTextarea.prototype` (rather than the global `HTMLElement.prototype`,
// as several component-level "attachInternals guard" tests elsewhere in this repo do for their own
// hand-rolled fallbacks) so it cannot leak into any other custom element constructed while these
// tests run. The stub is always removed in a `finally` block, even if an assertion above throws.
describe('fallback ElementInternals when attachInternals() is unavailable', () => {
  it('constructs without throwing, and threads required+empty through a working validity/checkValidity/reportValidity, when attachInternals() throws', async () => {
    const proto = LyraTextarea.prototype as unknown as { attachInternals: () => ElementInternals };
    const original = proto.attachInternals;
    proto.attachInternals = () => {
      throw new DOMException('attachInternals is not supported', 'NotSupportedError');
    };
    try {
      // The try/catch in the mixin's constructor (form-associated.ts:138-143) must swallow the
      // failure and install the fallback instead of letting construction itself throw.
      let bare: LyraTextarea | undefined;
      expect(() => {
        bare = document.createElement(tag('textarea')) as unknown as LyraTextarea;
      }).to.not.throw();
      // No flags set -> valid, proving the fallback's checkValidity()/reportValidity() reflect
      // validity.valid correctly rather than being permanently broken.
      expect(bare!.checkValidity()).to.be.true;
      expect(bare!.reportValidity()).to.be.true;

      // Drive a fully-rendered instance through required+empty -> invalid -> filled -> valid, to
      // prove setValidity() on the fallback actually threads flags through the validity getters
      // (form-associated.ts:55-61), not just that construction didn't crash.
      const el = await fixture<LyraTextarea>(html`<lr-textarea required name="notes"></lr-textarea>`);
      expect(el.validity.valueMissing).to.be.true;
      expect(el.checkValidity()).to.be.false;
      expect(el.reportValidity()).to.be.false;
      expect(el.internals.checkValidity()).to.be.false;
      expect(el.internals.reportValidity()).to.be.false;
      expect(el.internals.validationMessage).to.equal('This field is required.');

      // Assigning `.value` drives `setFormValue()` and must not throw even though the fallback's
      // own `setFormValue()` is a no-op.
      expect(() => {
        el.value = 'filled in';
      }).to.not.throw();
      expect(el.validity.valueMissing).to.be.false;
      expect(el.checkValidity()).to.be.true;
      expect(el.reportValidity()).to.be.true;
      expect(el.internals.validationMessage).to.equal('');

      // Inert defaults documented on createFallbackInternals().
      expect(el.internals.form).to.equal(null);
      expect(el.internals.labels.length).to.equal(0);
      expect(el.form).to.equal(null);
      expect(el.labels.length).to.equal(0);
      // `states` (the CustomStateSet substitute) is a documented no-op -- safe to call, never
      // reflects anything back.
      expect(el.internals.states.has('checked')).to.be.false;
      expect(() => {
        el.internals.states.add('checked');
      }).to.not.throw();
      expect(el.internals.states.delete('checked')).to.be.false;
    } finally {
      proto.attachInternals = original;
    }
  });

  it('falls back the same way when attachInternals() returns a falsy value instead of throwing (form-associated.ts:140)', async () => {
    const proto = LyraTextarea.prototype as unknown as { attachInternals: () => ElementInternals };
    const original = proto.attachInternals;
    // Returns `undefined` *without* throwing -- exercises the `internals ?? createFallbackInternals()`
    // branch directly, distinct from the try/catch branch covered above.
    proto.attachInternals = () => undefined as unknown as ElementInternals;
    try {
      let bare: LyraTextarea | undefined;
      expect(() => {
        bare = document.createElement(tag('textarea')) as unknown as LyraTextarea;
      }).to.not.throw();
      expect(bare!.checkValidity()).to.be.true;
      expect(bare!.reportValidity()).to.be.true;

      const el = await fixture<LyraTextarea>(html`<lr-textarea required name="notes"></lr-textarea>`);
      expect(el.validity.valueMissing).to.be.true;
      expect(el.checkValidity()).to.be.false;
      expect(el.internals.checkValidity()).to.be.false;

      expect(() => {
        el.value = 'filled in';
      }).to.not.throw();
      expect(el.validity.valueMissing).to.be.false;
      expect(el.checkValidity()).to.be.true;

      expect(el.internals.form).to.equal(null);
      expect(el.internals.labels.length).to.equal(0);
      expect(el.form).to.equal(null);
      expect(el.labels.length).to.equal(0);
    } finally {
      proto.attachInternals = original;
    }
  });
});

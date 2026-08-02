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

it('accepts a string form-owner assignment while keeping reads element-valued', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`
    <div>
      <form id="external-owner"></form>
      <lr-demo-ctl name="quantity" value="4"></lr-demo-ctl>
    </div>
  `);
  const form = wrapper.querySelector('form')!;
  const ctl = wrapper.querySelector('lr-demo-ctl') as unknown as Ctl & {
    form: string | HTMLFormElement | null;
    getForm(): HTMLFormElement | null;
  };

  ctl.form = 'external-owner';

  expect((ctl as unknown as HTMLElement).getAttribute('form')).to.equal('external-owner');
  expect((ctl.form as HTMLFormElement | null)?.id).to.equal('external-owner');
  expect(ctl.getForm()?.id).to.equal('external-owner');
  expect(new FormData(form).get('quantity')).to.equal('4');

  ctl.form = null;
  expect((ctl as unknown as HTMLElement).hasAttribute('form')).to.be.false;
  expect(ctl.form).to.equal(null);
  expect(ctl.getForm()).to.equal(null);
});

it('keeps live value dirty while the reflected default changes, then resets to the current default', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form><lr-demo-ctl name="quantity" value="initial"></lr-demo-ctl></form>
  `);
  const ctl = form.querySelector('lr-demo-ctl') as unknown as Ctl & { defaultValue: string };
  const host = ctl as unknown as HTMLElement;
  expect(ctl.defaultValue).to.equal('initial');

  ctl.value = 'live-edit';
  ctl.defaultValue = 'new-default';
  expect(host.getAttribute('value')).to.equal('new-default');
  expect(ctl.value).to.equal('live-edit');
  expect(new FormData(form).get('quantity')).to.equal('live-edit');

  form.reset();
  expect(ctl.value).to.equal('new-default');
  expect(ctl.defaultValue).to.equal('new-default');

  // Reset clears the dirty flag, so a later default change updates the live value too.
  ctl.defaultValue = 'latest-default';
  expect(ctl.value).to.equal('latest-default');
  expect(new FormData(form).get('quantity')).to.equal('latest-default');
});

it('treats direct value-attribute mutation as a default change without overwriting a dirty live value', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form><lr-demo-ctl name="quantity" value="initial"></lr-demo-ctl></form>
  `);
  const ctl = form.querySelector('lr-demo-ctl') as unknown as Ctl & { defaultValue: string };
  const host = ctl as unknown as HTMLElement;

  ctl.value = 'live-edit';
  host.setAttribute('value', 'attribute-default');
  expect(ctl.defaultValue).to.equal('attribute-default');
  expect(ctl.value).to.equal('live-edit');

  form.reset();
  expect(ctl.value).to.equal('attribute-default');
});

it('maps the reflected custom-error property to custom validity without losing intrinsic validity', async () => {
  const ctl = (await fixture(html`<lr-demo-ctl required></lr-demo-ctl>`)) as unknown as Ctl & {
    customError: string | null;
  };
  const host = ctl as unknown as HTMLElement;

  ctl.customError = 'Rejected by the server.';
  expect(host.getAttribute('custom-error')).to.equal('Rejected by the server.');
  expect(ctl.validity.customError).to.be.true;
  expect(ctl.validationMessage).to.equal('Rejected by the server.');

  ctl.customError = null;
  expect(host.hasAttribute('custom-error')).to.be.false;
  expect(ctl.validity.customError).to.be.false;
  expect(ctl.validity.valueMissing).to.be.true;
  expect(ctl.validationMessage).to.equal('This field is required.');
});

it('emits exactly one bubbling, composed, non-cancelable lr-invalid alias for a failed check', async () => {
  const ctl = (await fixture(html`<lr-demo-ctl required></lr-demo-ctl>`)) as unknown as Ctl;
  const aliases: CustomEvent[] = [];
  (ctl as unknown as HTMLElement).addEventListener('lr-invalid', (event) => aliases.push(event as CustomEvent));

  // A composed synthetic event from inside the shadow tree is retargeted to the host. The relay
  // must inspect the original composed-path target rather than mistaking that retargeting for the
  // FACE host's own native invalid notification.
  const inner = document.createElement('input');
  (ctl.renderRoot as ShadowRoot).append(inner);
  inner.dispatchEvent(new Event('invalid', { composed: true }));
  expect(aliases.length).to.equal(0);

  expect(ctl.checkValidity()).to.be.false;

  expect(aliases.length).to.equal(1);
  expect(aliases[0]?.target).to.equal(ctl);
  expect(aliases[0]?.bubbles).to.be.true;
  expect(aliases[0]?.composed).to.be.true;
  expect(aliases[0]?.cancelable).to.be.false;
});

it('restores a string state synchronously without emitting a user event', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form><lr-demo-ctl name="quantity" value="initial"></lr-demo-ctl></form>
  `);
  const ctl = form.querySelector('lr-demo-ctl') as unknown as Ctl & {
    formStateRestoreCallback(
      state: string | File | FormData | null,
      reason: 'autocomplete' | 'restore',
    ): void;
  };

  ctl.value = 'changed';
  ctl.formStateRestoreCallback('restored', 'restore');

  expect(ctl.value).to.equal('restored');
  expect(new FormData(form).get('quantity')).to.equal('restored');
  expect(ctl.checkValidity()).to.be.true;
});

describe('setCustomValidity()', () => {
  it('marks the control invalid with a `customError` flag carrying the supplied message', async () => {
    const form = await fixture<HTMLFormElement>(html`<form><lr-demo-ctl name="x"></lr-demo-ctl></form>`);
    const ctl = form.querySelector('lr-demo-ctl') as unknown as Ctl;
    expect(ctl.checkValidity()).to.be.true;

    ctl.setCustomValidity('That username is already taken.');

    expect(ctl.validity.customError).to.be.true;
    expect(ctl.validity.valid).to.be.false;
    expect(ctl.validationMessage).to.equal('That username is already taken.');
    expect(ctl.checkValidity()).to.be.false;
    expect(form.checkValidity()).to.be.false;
    expect((ctl as unknown as HTMLElement).matches(':invalid')).to.be.true;
  });

  it("clears on '' by restoring the control's own computed validity, never by forcing it valid", async () => {
    const ctl = (await fixture(html`<lr-demo-ctl required></lr-demo-ctl>`)) as unknown as Ctl;
    // Intrinsically invalid to begin with: required and empty.
    expect(ctl.validity.valueMissing).to.be.true;

    ctl.setCustomValidity('Rejected by the server.');
    expect(ctl.validity.customError).to.be.true;
    expect(ctl.validationMessage).to.equal('Rejected by the server.');

    ctl.setCustomValidity('');
    expect(ctl.validity.customError).to.be.false;
    // The intrinsic violation must come back, message and all -- not a blanket "valid".
    expect(ctl.validity.valueMissing).to.be.true;
    expect(ctl.validity.valid).to.be.false;
    expect(ctl.validationMessage).to.equal('This field is required.');
    expect(ctl.checkValidity()).to.be.false;

    ctl.value = 'filled in';
    expect(ctl.validity.valid).to.be.true;
    expect(ctl.validationMessage).to.equal('');
  });

  it('resetValidity() clears the custom layer and recomputes intrinsic validity', async () => {
    const ctl = (await fixture(html`<lr-demo-ctl required></lr-demo-ctl>`)) as unknown as Ctl;
    ctl.setCustomValidity('Rejected by the server.');
    expect(ctl.validity.customError).to.be.true;

    ctl.resetValidity();

    expect(ctl.validity.customError).to.be.false;
    expect(ctl.validity.valueMissing).to.be.true;
    expect(ctl.validationMessage).to.equal('This field is required.');
  });

  it('survives every intrinsic validity recomputation until explicitly cleared', async () => {
    const ctl = (await fixture(html`<lr-demo-ctl required></lr-demo-ctl>`)) as unknown as Ctl;
    ctl.setCustomValidity('Rejected by the server.');

    // Each of these drives `updateValidity()` -> `[SET_ANCHORED_VALIDITY](flags, message)`, which
    // must layer the custom error back on top instead of overwriting it.
    ctl.value = 'filled in';
    expect(ctl.validity.customError).to.be.true;
    expect(ctl.validationMessage).to.equal('Rejected by the server.');

    ctl.required = false;
    expect(ctl.validity.customError).to.be.true;

    ctl.value = 'changed again';
    expect(ctl.validity.customError).to.be.true;
    expect(ctl.checkValidity()).to.be.false;

    ctl.setCustomValidity('');
    expect(ctl.validity.valid).to.be.true;
    expect(ctl.validationMessage).to.equal('');
  });

  it('stacks on top of an intrinsic violation, with the custom message winning', async () => {
    const ctl = (await fixture(html`<lr-demo-ctl required></lr-demo-ctl>`)) as unknown as Ctl;
    ctl.setCustomValidity('Rejected by the server.');
    expect(ctl.validity.valueMissing).to.be.true;
    expect(ctl.validity.customError).to.be.true;
    expect(ctl.validationMessage).to.equal('Rejected by the server.');
  });

  it('survives a form reset, exactly like a native control', async () => {
    const form = await fixture<HTMLFormElement>(
      html`<form><lr-demo-ctl name="x" value="start"></lr-demo-ctl></form>`,
    );
    const ctl = form.querySelector('lr-demo-ctl') as unknown as Ctl;
    ctl.setCustomValidity('Rejected by the server.');
    ctl.value = 'edited';
    form.reset();
    expect(ctl.value).to.equal('start');
    expect(ctl.validity.customError).to.be.true;
    expect(ctl.validationMessage).to.equal('Rejected by the server.');
  });

  it("changes nothing while never called, and an '' call is a no-op", async () => {
    const ctl = (await fixture(html`<lr-demo-ctl></lr-demo-ctl>`)) as unknown as Ctl;
    expect(ctl.validity.customError).to.be.false;
    expect(ctl.validity.valid).to.be.true;
    ctl.setCustomValidity('');
    expect(ctl.validity.customError).to.be.false;
    expect(ctl.validity.valid).to.be.true;
    expect(ctl.validationMessage).to.equal('');
    expect(ctl.checkValidity()).to.be.true;
  });

  it('reaches a real component that recomputes validity from a native input on every change (lr-textarea)', async () => {
    const el = await fixture<LyraTextarea>(html`<lr-textarea name="notes" minlength="5"></lr-textarea>`);
    el.setCustomValidity('Rejected by the server.');
    expect(el.validity.customError).to.be.true;
    expect(el.checkValidity()).to.be.false;

    // `lr-textarea`'s own `updateValidity()` override calls `[SET_ANCHORED_VALIDITY]` several
    // times per change; none of those may drop the consumer's custom error.
    el.value = 'ok';
    await el.updateComplete;
    expect(el.validity.customError).to.be.true;
    expect(el.validity.tooShort).to.be.true;
    expect(el.validationMessage).to.equal('Rejected by the server.');

    el.value = 'long enough';
    await el.updateComplete;
    expect(el.validity.customError).to.be.true;
    expect(el.checkValidity()).to.be.false;

    el.setCustomValidity('');
    expect(el.validity.valid).to.be.true;
    expect(el.checkValidity()).to.be.true;
    expect(el.validationMessage).to.equal('');
  });
});

// `internals.states` (CustomStateSet) reached Chromium 125 / Safari 17.4 / Firefox 126. The mixin
// no-ops where it is missing, so these assertions are skipped rather than failed on an older engine.
const supportsCustomStates = (() => {
  try {
    return typeof CustomStateSet === 'function';
  } catch {
    return false;
  }
})();

describe('validity custom states', () => {
  it('exposes required/optional and valid/invalid, kept in sync with validity', async function () {
    if (!supportsCustomStates) this.skip();
    const ctl = (await fixture(html`<lr-demo-ctl></lr-demo-ctl>`)) as unknown as Ctl;
    expect(ctl.internals.states.has('optional')).to.be.true;
    expect(ctl.internals.states.has('required')).to.be.false;
    expect(ctl.internals.states.has('valid')).to.be.true;
    expect(ctl.internals.states.has('invalid')).to.be.false;

    ctl.required = true;
    expect(ctl.internals.states.has('required')).to.be.true;
    expect(ctl.internals.states.has('optional')).to.be.false;
    expect(ctl.internals.states.has('invalid')).to.be.true;
    expect(ctl.internals.states.has('valid')).to.be.false;

    ctl.value = 'filled in';
    expect(ctl.internals.states.has('valid')).to.be.true;
    expect(ctl.internals.states.has('invalid')).to.be.false;
  });

  it('withholds user-valid/user-invalid until the user has actually interacted', async function () {
    if (!supportsCustomStates) this.skip();
    const ctl = (await fixture(html`<lr-demo-ctl required></lr-demo-ctl>`)) as unknown as Ctl;
    const host = ctl as unknown as HTMLElement;
    expect(ctl.internals.states.has('invalid')).to.be.true;
    expect(ctl.internals.states.has('user-invalid')).to.be.false;
    expect(ctl.internals.states.has('user-valid')).to.be.false;

    host.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    expect(ctl.internals.states.has('user-invalid')).to.be.true;
    expect(ctl.internals.states.has('user-valid')).to.be.false;

    ctl.value = 'filled in';
    expect(ctl.internals.states.has('user-valid')).to.be.true;
    expect(ctl.internals.states.has('user-invalid')).to.be.false;
  });

  it('counts a reportValidity() call — what a submit attempt runs — as interaction', async function () {
    if (!supportsCustomStates) this.skip();
    const ctl = (await fixture(html`<lr-demo-ctl required></lr-demo-ctl>`)) as unknown as Ctl;
    expect(ctl.internals.states.has('user-invalid')).to.be.false;
    ctl.reportValidity();
    expect(ctl.internals.states.has('user-invalid')).to.be.true;
  });

  it('goes pristine again after a form reset', async function () {
    if (!supportsCustomStates) this.skip();
    const form = await fixture<HTMLFormElement>(
      html`<form><lr-demo-ctl name="x" required></lr-demo-ctl></form>`,
    );
    const ctl = form.querySelector('lr-demo-ctl') as unknown as Ctl;
    (ctl as unknown as HTMLElement).dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    expect(ctl.internals.states.has('user-invalid')).to.be.true;
    form.reset();
    expect(ctl.internals.states.has('user-invalid')).to.be.false;
    expect(ctl.internals.states.has('invalid')).to.be.true;
  });

  it('treats a blur (focusout) as interaction, like native :user-invalid', async function () {
    if (!supportsCustomStates) this.skip();
    const ctl = (await fixture(html`<lr-demo-ctl required></lr-demo-ctl>`)) as unknown as Ctl;
    const host = ctl as unknown as HTMLElement;
    expect(ctl.internals.states.has('user-invalid')).to.be.false;
    host.dispatchEvent(new Event('focusout', { bubbles: true, composed: true }));
    expect(ctl.internals.states.has('user-invalid')).to.be.true;
  });

  it('reflects a custom error in the invalid state and matches :state() in CSS', async function () {
    if (!supportsCustomStates) this.skip();
    const ctl = (await fixture(html`<lr-demo-ctl></lr-demo-ctl>`)) as unknown as Ctl;
    const host = ctl as unknown as HTMLElement;
    ctl.setCustomValidity('Rejected by the server.');
    expect(ctl.internals.states.has('invalid')).to.be.true;
    expect(ctl.internals.states.has('valid')).to.be.false;

    let supportsStateSelector = true;
    try {
      document.createElement('div').matches(':state(x)');
    } catch {
      supportsStateSelector = false;
    }
    if (supportsStateSelector) {
      expect(host.matches(':state(invalid)')).to.be.true;
      expect(host.matches(':state(optional)')).to.be.true;
    }

    ctl.setCustomValidity('');
    expect(ctl.internals.states.has('valid')).to.be.true;
  });

  it('keeps a real component in sync too (lr-textarea)', async function () {
    if (!supportsCustomStates) this.skip();
    const el = await fixture<LyraTextarea>(html`<lr-textarea required name="notes"></lr-textarea>`);
    expect(el.internals.states.has('required')).to.be.true;
    expect(el.internals.states.has('invalid')).to.be.true;
    el.value = 'filled in';
    await el.updateComplete;
    expect(el.internals.states.has('valid')).to.be.true;
    expect(el.internals.states.has('invalid')).to.be.false;
  });
});

// `createFallbackInternals()` (the hand-rolled, inert `ElementInternals` substitute defined in
// this file) only ever runs when `this.attachInternals()` is missing, returns falsy, or throws --
// never in this repo's real Chromium test environment, where `attachInternals()` is natively
// implemented. Driven through the real `<lr-textarea>` component (not the local `Ctl` demo class
// above) so this proves the fallback actually integrates with a production component's own
// render/validity plumbing, not just the mixin in isolation. `<lr-textarea>`'s own
// `updateValidity()` override answers the required-and-empty case first and with the same
// localized message as the base mixin, so the flows exercised below are the base mixin's own
// behavior reaching a real component unchanged.
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
      // `states` (the CustomStateSet substitute) is a real Set-backed store: it can't drive CSS
      // `:state()` matching in an environment with no ElementInternals, but every component that
      // reads its own states back (`internals.states.has(...)`) behaves identically to a browser.
      expect(el.internals.states.has('checked')).to.be.false;
      expect(() => {
        el.internals.states.add('checked');
      }).to.not.throw();
      expect(el.internals.states.has('checked')).to.be.true;
      expect(el.internals.states.delete('checked')).to.be.true;
      expect(el.internals.states.has('checked')).to.be.false;
      // The mixin's own validity states are maintained through the fallback as well.
      expect(el.internals.states.has('required')).to.be.true;
      expect(el.internals.states.has('valid')).to.be.true;
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

  it('threads setCustomValidity() through the fallback with the same layering as a real ElementInternals', async () => {
    const proto = LyraTextarea.prototype as unknown as { attachInternals: () => ElementInternals };
    const original = proto.attachInternals;
    proto.attachInternals = () => {
      throw new DOMException('attachInternals is not supported', 'NotSupportedError');
    };
    try {
      const el = await fixture<LyraTextarea>(html`<lr-textarea required name="notes"></lr-textarea>`);
      el.setCustomValidity('Rejected by the server.');
      expect(el.validity.customError).to.be.true;
      expect(el.validity.valueMissing).to.be.true;
      expect(el.validationMessage).to.equal('Rejected by the server.');
      expect(el.checkValidity()).to.be.false;

      el.value = 'filled in';
      await el.updateComplete;
      expect(el.validity.customError).to.be.true;
      expect(el.checkValidity()).to.be.false;

      el.setCustomValidity('');
      expect(el.validity.customError).to.be.false;
      expect(el.checkValidity()).to.be.true;
      expect(el.validationMessage).to.equal('');
      expect(el.internals.states.has('valid')).to.be.true;
      expect(el.internals.states.has('invalid')).to.be.false;
    } finally {
      proto.attachInternals = original;
    }
  });
});

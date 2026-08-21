import { fixture, expect, html } from '@open-wc/testing';
import { nothing } from 'lit';
import { LyraElement } from './lyra-element.js';
import {
  createStringArrayFormDataState,
  FormAssociated,
  isBarredFromValidation,
  readStringArrayFormDataState,
  stringFormValueAdapter,
  type FormValueAdapter,
} from './form-associated.js';
import { isEmptyFormValue } from '../utilities/form-associated.js';
import { SET_ANCHORED_VALIDITY } from './anchored-validity.js';
import { tag } from './prefix.js';
import { LyraTextarea } from '../components/forms/textarea/textarea.js';
import '../components/forms/checkbox/checkbox.js';
import '../components/forms/select/select.js';
import '../components/overlays/rating/rating.js';
import type { LyraCheckbox } from '../components/forms/checkbox/checkbox.js';
import type { LyraSelect } from '../components/forms/select/select.js';
import type { LyraRating } from '../components/overlays/rating/rating.js';

class Ctl extends FormAssociated(LyraElement) {
  render() {
    return html``;
  }
}
customElements.define(tag('demo-ctl'), Ctl);

/** A mixin consumer that carries the (non-mixin) `readonly` property every editable wrapper has. */
class ReadonlyCtl extends FormAssociated(LyraElement) {
  static properties = { readonly: { type: Boolean, reflect: true } };
  readonly = false;
  render() {
    return html``;
  }
}
customElements.define(tag('demo-readonly-ctl'), ReadonlyCtl);

/**
 * A mixin consumer shaped like `<lr-input>`: its constraints live on an inner native input that
 * Lit writes on its own async cycle, and its `updateValidity()` override reads that input back.
 */
class NativeCtl extends FormAssociated(LyraElement) {
  static properties = { pattern: { reflect: true } };
  pattern = '';
  render() {
    return html`<input pattern=${this.pattern || nothing} .value=${this.value} />`;
  }
  protected updateValidity(): void {
    const native = this.renderRoot?.querySelector('input');
    if (!native) return;
    native.value = this.value;
    const validity = native.validity;
    this[SET_ANCHORED_VALIDITY](
      validity.valid ? {} : { patternMismatch: validity.patternMismatch },
      native.validationMessage,
    );
  }
}
customElements.define(tag('demo-native-ctl'), NativeCtl);

// --- non-string value types through the same mixin ----------------------------------------------
//
// The mixin is generic over its value type; these two demo elements are the proof, and they are
// deliberately defined here rather than by converting a shipped control: the point under test is
// the PRIMITIVE (every guarantee the string case has, reached by a `Date` and a `string[]`), not a
// migration. `Date | null` covers a value with no useful "empty" instance and a non-trivial
// attribute round-trip; `string[]` covers a value for which `=== ''` is not merely wrong but not
// even type-correct, and which needs a session state shaped differently from its submission entry.

const isoDateAdapter: FormValueAdapter<Date | null> = {
  empty: null,
  toFormValue: (value) => value?.toISOString() ?? null,
  isEmpty: (value) => value === null,
  fromAttribute: (attribute) => {
    const parsed = new Date(attribute);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  },
  toAttribute: (value) => value?.toISOString() ?? null,
  fromFormState: (state) => (typeof state === 'string' && state ? new Date(state) : null),
};

class DateCtl extends FormAssociated(LyraElement, isoDateAdapter) {
  render() {
    return html``;
  }
}
customElements.define(tag('demo-date-ctl'), DateCtl);

const EMPTY_TAGS: readonly string[] = Object.freeze([]);

const tagListAdapter: FormValueAdapter<readonly string[]> = {
  empty: EMPTY_TAGS,
  // One submission entry keyed by the control's own `name` (a joined string), but a name-independent
  // FormData for the restored state -- exactly the split `toFormState` exists for.
  toFormValue: (value) => (value.length > 0 ? value.join(',') : null),
  toFormState: (value) => createStringArrayFormDataState('value', value),
  isEmpty: (value) => value.length === 0,
  fromAttribute: (attribute) => attribute.split(',').filter((entry) => entry !== ''),
  toAttribute: (value) => (value.length > 0 ? value.join(',') : null),
  fromFormState: (state) => readStringArrayFormDataState(state),
};

it('restores string-array state from a foreign-realm FormData without accepting lookalikes', () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  try {
    const frameWindow = frame.contentWindow!;
    const foreignState = new frameWindow.FormData();
    foreignState.append('old-name', 'alpha');
    foreignState.append('old-name', 'beta');
    expect(foreignState instanceof FormData, 'not the ambient-realm brand').to.be.false;
    expect(readStringArrayFormDataState(foreignState)).to.deep.equal(['alpha', 'beta']);

    const withFile = new frameWindow.FormData();
    withFile.append('value', new frameWindow.File(['unsafe'], 'value.txt'));
    expect(readStringArrayFormDataState(withFile), 'non-string entries still fail closed').to.deep.equal([]);

    const lookalike = {
      [Symbol.toStringTag]: 'FormData',
      values: () => ['spoofed'],
    } as unknown as FormData;
    expect(readStringArrayFormDataState(lookalike), 'a branded-looking object is not FormData').to.deep.equal([]);

    const runtime = globalThis as unknown as { FormData?: typeof FormData };
    const NativeFormData = runtime.FormData;
    try {
      runtime.FormData = undefined;
      expect(
        readStringArrayFormDataState(foreignState),
        'without a brand-checking intrinsic, restoration fails closed',
      ).to.deep.equal([]);
    } finally {
      runtime.FormData = NativeFormData;
    }
  } finally {
    frame.remove();
  }
});

class TagsCtl extends FormAssociated(LyraElement, tagListAdapter) {
  render() {
    return html``;
  }
}
customElements.define(tag('demo-tags-ctl'), TagsCtl);

const objectValueAdapter: FormValueAdapter<object> = {
  empty: Object.freeze({}),
  toFormValue: () => 'object',
  fromAttribute: () => Object.freeze({}),
  toAttribute: () => null,
};

class ObjectCtl extends FormAssociated(LyraElement, objectValueAdapter) {
  render() {
    return html``;
  }
}
customElements.define(tag('demo-object-ctl'), ObjectCtl);

const minimalAdapter: FormValueAdapter<unknown> = {
  empty: null,
  toFormValue: (value) => (value === null ? null : String(value)),
};

class MinimalAdapterCtl extends FormAssociated(LyraElement, minimalAdapter) {
  render() {
    return html``;
  }
}
customElements.define(tag('demo-minimal-adapter-ctl'), MinimalAdapterCtl);

it('supplies lossless defaults for every optional form-value adapter hook', async () => {
  const ctl = (await fixture(html`
    <lr-demo-minimal-adapter-ctl value="seed"></lr-demo-minimal-adapter-ctl>
  `)) as unknown as MinimalAdapterCtl;
  const host = ctl as unknown as HTMLElement;

  expect(ctl.value).to.equal('seed');
  ctl.defaultValue = 42;
  expect(host.getAttribute('value')).to.equal('42');

  ctl.formStateRestoreCallback('restored', 'restore');
  expect(ctl.value).to.equal('restored');

  ctl.formStateRestoreCallback(new FormData(), 'restore');
  expect(ctl.value).to.equal(null);
});

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

it('does not redundantly requestUpdate() from formDisabledCallback when it merely echoes the element\'s own disabled attribute change', async () => {
  // Regression test: the browser invokes formDisabledCallback() not
  // only for ancestor <fieldset disabled> cascading (its doc comment's stated purpose) but also
  // whenever the element's OWN `disabled` content attribute is added/removed directly. The
  // platform fires it as a second, separate custom-element reaction to the same
  // toggleAttribute('disabled', ...) call that also drives the `disabled` property setter. That
  // setter already calls updateValidity()/syncValidityStates()/requestUpdate() for the same
  // transition, so formDisabledCallback's own unconditional, unguarded requestUpdate() was pure
  // redundant work reacting to a change it did not need to react to -- and, being a second
  // independent call site, capable of landing inside a different in-flight update's
  // updated()/hostUpdated() window and tripping Lit's dev-mode "scheduled an update after an
  // update completed" warning with nothing behavioral to show for it. It must stay a no-op
  // whenever the fieldset-cascade signal it received doesn't change the overall effectiveDisabled
  // outcome -- own `disabled` already accounts for it.
  //
  // The rising edge (false -> true) is the one that matters here: it is what a
  // `?disabled=${true}` lit-html binding produces, and the shape the update race actually needs
  // (own `disabled` and `value` changing together on a control that already has a completed
  // render behind it). It must cost exactly the one requestUpdate() the `disabled` setter itself
  // already made.
  const ctl = (await fixture(html`<lr-demo-ctl></lr-demo-ctl>`)) as unknown as Ctl;
  const host = ctl as unknown as HTMLElement;
  await ctl.updateComplete;

  let updateRequests = 0;
  const requestUpdate = ctl.requestUpdate.bind(ctl);
  (ctl as unknown as { requestUpdate: typeof requestUpdate }).requestUpdate = (
    ...args: Parameters<typeof requestUpdate>
  ) => {
    updateRequests += 1;
    return requestUpdate(...args);
  };

  // A real attribute mutation, exactly like a `?disabled=${true}` lit-html boolean-attribute
  // binding would perform -- this is what triggers formDisabledCallback as a second reaction,
  // in an engine-dependent order relative to attributeChangedCallback (Chromium delivers
  // attributeChangedCallback first; Firefox and WebKit were observed delivering
  // formDisabledCallback first). The _reflectingDisabledAttribute guard is order-independent, so
  // both edges cost exactly one requestUpdate() regardless of engine.
  host.toggleAttribute('disabled', true);
  expect(ctl.effectiveDisabled).to.be.true;
  expect(updateRequests, 'own disabled attribute change requests exactly one update').to.equal(1);

  host.toggleAttribute('disabled', false);
  expect(ctl.effectiveDisabled).to.be.false;
  expect(updateRequests, 'clearing it also requests exactly one more update').to.equal(2);
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

it('honors a per-instance fieldRequired string through the shared form mixin', async () => {
  const ctl = (await fixture(html`
    <lr-demo-ctl
      required
      .strings=${{ fieldRequired: 'Choose a value.' }}
    ></lr-demo-ctl>
  `)) as unknown as Ctl;
  await ctl.updateComplete;
  expect(ctl.validationMessage).to.equal('Choose a value.');
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
  const ctl = wrapper.querySelector('lr-demo-ctl') as Ctl;

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

it('keeps the mixin validity method, property, and reflected attribute in one clearing transaction', async () => {
  const ctl = (await fixture(html`<lr-demo-ctl></lr-demo-ctl>`)) as unknown as Ctl & {
    customError: string | null;
  };
  const host = ctl as unknown as HTMLElement;

  ctl.setCustomValidity('Rejected by the server.');
  expect(ctl.customError).to.equal('Rejected by the server.');
  expect(host.getAttribute('custom-error')).to.equal('Rejected by the server.');

  ctl.setCustomValidity('');
  expect(ctl.customError).to.equal(null);
  expect(host.hasAttribute('custom-error')).to.equal(false);

  ctl.customError = 'Rejected again.';
  ctl.resetValidity();
  expect(ctl.customError).to.equal(null);
  expect(host.hasAttribute('custom-error')).to.equal(false);

  ctl.customError = '';
  expect(ctl.customError).to.equal(null);
  expect(host.hasAttribute('custom-error')).to.equal(false);
});

it('keeps direct-FACE validity methods and reflected custom-error state atomic across families', async () => {
  const controls = [
    await fixture<LyraCheckbox>(html`<lr-checkbox>Accept</lr-checkbox>`),
    await fixture<LyraSelect>(html`<lr-select label="Fruit"></lr-select>`),
    await fixture<LyraRating>(html`<lr-rating aria-label="Score"></lr-rating>`),
  ];

  for (const control of controls) {
    control.setCustomValidity('Rejected by the server.');
    expect(control.customError).to.equal('Rejected by the server.');
    expect(control.getAttribute('custom-error')).to.equal('Rejected by the server.');

    control.setCustomValidity('');
    expect(control.customError).to.equal(null);
    expect(control.hasAttribute('custom-error')).to.equal(false);

    control.customError = 'Rejected again.';
    control.resetValidity();
    expect(control.customError).to.equal(null);
    expect(control.hasAttribute('custom-error')).to.equal(false);

    control.customError = '';
    expect(control.customError).to.equal(null);
    expect(control.hasAttribute('custom-error')).to.equal(false);
  }
});

it('emits exactly one bubbling, composed, cancelable lr-invalid alias for a failed check', async () => {
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
  expect(aliases[0]?.cancelable).to.be.true;
});

it('lets a cancelled lr-invalid suppress the native invalid default (the browser validation bubble)', async () => {
  const ctl = (await fixture(html`<lr-demo-ctl required></lr-demo-ctl>`)) as unknown as Ctl;
  const host = ctl as unknown as HTMLElement;
  let nativeCancelable: boolean | undefined;
  let nativeDefaultPrevented: boolean | undefined;
  host.addEventListener('invalid', (event) => {
    nativeCancelable = event.cancelable;
    nativeDefaultPrevented = event.defaultPrevented;
  });
  host.addEventListener('lr-invalid', (event) => event.preventDefault());

  expect(ctl.reportValidity()).to.be.false;

  expect(nativeCancelable, 'the native invalid event is cancelable').to.be.true;
  expect(nativeDefaultPrevented, 'cancelling lr-invalid cancels the native invalid').to.be.true;
});

it('leaves the native invalid event alone when nothing cancels the alias', async () => {
  const ctl = (await fixture(html`<lr-demo-ctl required></lr-demo-ctl>`)) as unknown as Ctl;
  const host = ctl as unknown as HTMLElement;
  let nativeDefaultPrevented: boolean | undefined;
  host.addEventListener('invalid', (event) => {
    nativeDefaultPrevented = event.defaultPrevented;
  });

  expect(ctl.checkValidity()).to.be.false;

  expect(nativeDefaultPrevented, 'an uncancelled alias must not cancel the native event').to.be.false;
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

// A control barred from constraint validation matches NEITHER `:valid` NOR `:invalid` natively
// (verified against a real `<input required disabled>` / `<input required readonly>` in Chromium),
// so the six custom states must go quiet the same way rather than painting a disabled required
// field with the documented `:state(user-invalid)` error styling.
describe('barred from constraint validation', () => {
  it('honors platform willValidate from a genuine foreign-realm ElementInternals only', () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    try {
      const frameWindow = frame.contentWindow!;
      const frameDocument = frame.contentDocument!;
      // Construct the class with the iframe's Function intrinsic so its constructor realm, not
      // only its HTMLElement base class, is genuinely foreign in every engine.
      const ForeignValidationControl = frameWindow.Function(`
        return class extends HTMLElement {
          static formAssociated = true;
          faceInternals = this.attachInternals();
        };
      `)() as CustomElementConstructor;
      frameWindow.customElements.define('x-foreign-validation-control', ForeignValidationControl);

      const fieldset = frameDocument.createElement('fieldset');
      fieldset.disabled = true;
      const control = frameDocument.createElement('x-foreign-validation-control') as HTMLElement & {
        faceInternals: ElementInternals;
      };
      fieldset.append(control);
      frameDocument.body.append(fieldset);
      expect(control.faceInternals instanceof frameWindow.ElementInternals, 'the creator-realm brand').to.be.true;
      expect(control.faceInternals instanceof ElementInternals, 'not the ambient-realm brand').to.be.false;
      expect(control.faceInternals.willValidate, 'barred by the disabled fieldset').to.be.false;
      expect(isBarredFromValidation({}, control.faceInternals)).to.be.true;

      const lookalike = { willValidate: false } as ElementInternals;
      expect(isBarredFromValidation({}, lookalike), 'a fallback/lookalike cannot suppress validation').to.be.false;

      const runtime = globalThis as unknown as { ElementInternals?: typeof ElementInternals };
      const NativeElementInternals = runtime.ElementInternals;
      try {
        runtime.ElementInternals = undefined;
        expect(
          isBarredFromValidation({}, control.faceInternals),
          'without a brand-checking intrinsic, local constraint validation remains enabled',
        ).to.be.false;
      } finally {
        runtime.ElementInternals = NativeElementInternals;
      }
    } finally {
      frame.remove();
    }
  });

  it('drops the intrinsic violation and both validity states while the control is disabled', async function () {
    if (!supportsCustomStates) this.skip();
    const ctl = (await fixture(html`<lr-demo-ctl required></lr-demo-ctl>`)) as unknown as Ctl;
    const host = ctl as unknown as HTMLElement;
    host.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    expect(ctl.internals.states.has('user-invalid'), 'user-invalid before disabling').to.be.true;

    ctl.disabled = true;
    expect(ctl.validity.valueMissing, 'valueMissing while disabled').to.be.false;
    expect(ctl.validity.valid, 'validity.valid while disabled').to.be.true;
    expect(ctl.internals.states.has('invalid'), 'invalid while disabled').to.be.false;
    expect(ctl.internals.states.has('user-invalid'), 'user-invalid while disabled').to.be.false;
    expect(ctl.internals.states.has('valid'), 'valid while disabled').to.be.false;
    expect(ctl.internals.states.has('user-valid'), 'user-valid while disabled').to.be.false;
    // `required`/`optional` describe the attribute, not the validation outcome, and stay published.
    expect(ctl.internals.states.has('required'), 'required while disabled').to.be.true;

    ctl.disabled = false;
    expect(ctl.validity.valueMissing, 'valueMissing once re-enabled').to.be.true;
    expect(ctl.internals.states.has('invalid'), 'invalid once re-enabled').to.be.true;
    expect(ctl.internals.states.has('user-invalid'), 'user-invalid once re-enabled').to.be.true;
  });

  it('re-runs validity when an ancestor <fieldset disabled> toggles', async function () {
    if (!supportsCustomStates) this.skip();
    const form = await fixture<HTMLFormElement>(html`
      <form><fieldset><lr-demo-ctl name="x" required></lr-demo-ctl></fieldset></form>
    `);
    const ctl = form.querySelector('lr-demo-ctl') as unknown as Ctl;
    const fieldset = form.querySelector('fieldset')!;
    expect(ctl.internals.states.has('invalid'), 'invalid to begin with').to.be.true;

    fieldset.disabled = true;
    expect(ctl.effectiveDisabled, 'effectiveDisabled').to.be.true;
    expect(ctl.validity.valueMissing, 'valueMissing under a disabled fieldset').to.be.false;
    expect(ctl.internals.states.has('invalid'), 'invalid under a disabled fieldset').to.be.false;

    fieldset.disabled = false;
    expect(ctl.validity.valueMissing, 'valueMissing once the fieldset re-enables').to.be.true;
    expect(ctl.internals.states.has('invalid'), 'invalid once the fieldset re-enables').to.be.true;
  });

  it('bars a `readonly` control through the shared predicate, without each wrapper copy-pasting it', async function () {
    if (!supportsCustomStates) this.skip();
    const ctl = (await fixture(
      html`<lr-demo-readonly-ctl required readonly></lr-demo-readonly-ctl>`,
    )) as unknown as ReadonlyCtl;
    expect(isBarredFromValidation(ctl), 'isBarredFromValidation()').to.be.true;
    expect(ctl.validity.valueMissing, 'valueMissing while readonly').to.be.false;
    expect(ctl.checkValidity(), 'checkValidity() while readonly').to.be.true;
    expect(ctl.internals.states.has('invalid'), 'invalid while readonly').to.be.false;

    ctl.readonly = false;
    // The platform reads the reflected `readonly` *attribute* when it answers `willValidate`, and
    // Lit reflects on its own update cycle -- so the control is writable again one render later.
    await (ctl as unknown as LyraElement).updateComplete;
    expect(ctl.validity.valueMissing, 'valueMissing once writable').to.be.true;
    expect(ctl.internals.states.has('invalid'), 'invalid once writable').to.be.true;
  });

  it('reaches <lr-rating readonly>, whose validity never barred on readonly at all', async function () {
    if (!supportsCustomStates) this.skip();
    const rating = await fixture<LyraRating>(
      html`<lr-rating required readonly aria-label="Score"></lr-rating>`,
    );
    expect(rating.validity.valueMissing, 'valueMissing while readonly').to.be.false;
    expect(rating.checkValidity(), 'checkValidity() while readonly').to.be.true;
    expect(rating.matches(':state(invalid)'), ':state(invalid) while readonly').to.be.false;

    rating.readonly = false;
    await rating.updateComplete;
    expect(rating.validity.valueMissing, 'valueMissing once writable').to.be.true;
    expect(rating.matches(':state(invalid)'), ':state(invalid) once writable').to.be.true;
  });

  it('reaches the direct-ElementInternals controls (lr-checkbox, lr-select, lr-rating)', async function () {
    if (!supportsCustomStates) this.skip();
    const checkbox = await fixture<LyraCheckbox>(html`<lr-checkbox required>Accept</lr-checkbox>`);
    const select = await fixture<LyraSelect>(html`<lr-select required label="Fruit"></lr-select>`);
    const rating = await fixture<LyraRating>(html`<lr-rating required aria-label="Score"></lr-rating>`);
    for (const control of [checkbox, select, rating]) {
      expect(control.matches(':state(invalid)'), `${control.localName} invalid to begin with`).to.be.true;
      control.disabled = true;
      await control.updateComplete;
      expect(control.validity.valueMissing, `${control.localName} valueMissing while disabled`).to.be.false;
      expect(control.matches(':state(invalid)'), `${control.localName} invalid while disabled`).to.be.false;
      expect(control.matches(':state(valid)'), `${control.localName} valid while disabled`).to.be.false;
      control.disabled = false;
      await control.updateComplete;
      expect(control.matches(':state(invalid)'), `${control.localName} invalid once re-enabled`).to.be.true;
    }
  });
});

describe('checkValidity()/reportValidity()', () => {
  it('answers from constraints assigned in the same synchronous block, not the previous Lit cycle', async () => {
    const ctl = (await fixture(html`<lr-demo-native-ctl></lr-demo-native-ctl>`)) as unknown as NativeCtl;
    ctl.value = 'abc';
    ctl.pattern = '[0-9]+';

    expect(ctl.checkValidity(), 'checkValidity() after a same-tick constraint change').to.be.false;
    expect(ctl.validity.patternMismatch, 'patternMismatch').to.be.true;

    ctl.value = '123';
    expect(ctl.checkValidity(), 'checkValidity() once the value matches').to.be.true;
  });

  it('recomputes for reportValidity() too', async () => {
    const ctl = (await fixture(html`<lr-demo-native-ctl></lr-demo-native-ctl>`)) as unknown as NativeCtl;
    ctl.value = 'abc';
    ctl.pattern = '[0-9]+';
    expect(ctl.reportValidity(), 'reportValidity() after a same-tick constraint change').to.be.false;
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

  it('does not treat focusout while disabled as interaction after re-enabling', async function () {
    if (!supportsCustomStates) this.skip();
    const ctl = (await fixture(html`<lr-demo-ctl required></lr-demo-ctl>`)) as unknown as Ctl;
    const host = ctl as unknown as HTMLElement;

    ctl.disabled = true;
    host.dispatchEvent(new Event('focusout', { bubbles: true, composed: true }));
    ctl.disabled = false;

    expect(ctl.internals.states.has('user-invalid')).to.be.false;
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

// A control whose value is a `Date` or a `string[]` must get EVERY guarantee the string control
// has, from the same one implementation -- that is the whole point of parameterising the mixin
// rather than hand-rolling `ElementInternals` a nineteenth time. Each block below re-asserts a
// specific guarantee named in the mixin's own contract.
describe('a non-string value type through the same mixin', () => {
  describe('Date-valued', () => {
    it('parses the reflected `value` attribute into the reset default and submits the serialized form', async () => {
      const form = await fixture<HTMLFormElement>(html`
        <form><lr-demo-date-ctl name="due" value="2026-01-02T03:04:05.000Z"></lr-demo-date-ctl></form>
      `);
      const ctl = form.querySelector('lr-demo-date-ctl') as unknown as DateCtl;

      expect(ctl.defaultValue?.toISOString()).to.equal('2026-01-02T03:04:05.000Z');
      expect(ctl.value?.toISOString()).to.equal('2026-01-02T03:04:05.000Z');
      expect(new FormData(form).get('due')).to.equal('2026-01-02T03:04:05.000Z');
    });

    it('restores the constructed default on form.reset(), and keeps a dirty live value until then', async () => {
      const form = await fixture<HTMLFormElement>(html`
        <form><lr-demo-date-ctl name="due" value="2026-01-02T03:04:05.000Z"></lr-demo-date-ctl></form>
      `);
      const ctl = form.querySelector('lr-demo-date-ctl') as unknown as DateCtl;

      ctl.value = new Date('2030-06-07T08:09:10.000Z');
      expect(new FormData(form).get('due')).to.equal('2030-06-07T08:09:10.000Z');

      // A default change must not overwrite a dirty live value (the string case's rule, unchanged).
      ctl.defaultValue = new Date('2027-02-03T00:00:00.000Z');
      expect((ctl as unknown as HTMLElement).getAttribute('value')).to.equal('2027-02-03T00:00:00.000Z');
      expect(ctl.value?.toISOString()).to.equal('2030-06-07T08:09:10.000Z');

      form.reset();
      expect(ctl.value?.toISOString()).to.equal('2027-02-03T00:00:00.000Z');
    });

    it('reports valueMissing from the adapter`s emptiness, never from `=== ""`', async () => {
      const ctl = (await fixture(html`<lr-demo-date-ctl required></lr-demo-date-ctl>`)) as unknown as DateCtl;
      expect(ctl.value).to.equal(null);
      expect(ctl.validity.valueMissing, 'valueMissing while unset').to.be.true;
      expect(ctl.validationMessage).to.equal('This field is required.');

      ctl.value = new Date('2026-01-02T03:04:05.000Z');
      expect(ctl.validity.valueMissing, 'valueMissing once filled').to.be.false;
      expect(ctl.checkValidity()).to.be.true;

      // A null assignment falls back to the adapter's empty value, exactly as `next ?? ''` does.
      ctl.value = null;
      expect(ctl.value).to.equal(null);
      expect(ctl.validity.valueMissing, 'valueMissing once cleared again').to.be.true;
    });

    it('omits the control from FormData entirely when its empty value serializes to null', async () => {
      const form = await fixture<HTMLFormElement>(html`
        <form><lr-demo-date-ctl name="due"></lr-demo-date-ctl></form>
      `);
      expect(new FormData(form).has('due')).to.be.false;
    });

    it('keeps the barred-validation short-circuit and the synchronous `disabled`/`required` accessors', async () => {
      const form = await fixture<HTMLFormElement>(html`
        <form><lr-demo-date-ctl name="due" required></lr-demo-date-ctl></form>
      `);
      const ctl = form.querySelector('lr-demo-date-ctl') as unknown as DateCtl;
      const host = ctl as unknown as HTMLElement;
      expect(ctl.checkValidity(), 'invalid to begin with').to.be.false;

      ctl.disabled = true;
      expect(host.hasAttribute('disabled'), 'disabled reflected synchronously').to.be.true;
      expect(ctl.validity.valueMissing, 'valueMissing while barred').to.be.false;
      expect(ctl.checkValidity(), 'checkValidity() while barred').to.be.true;

      ctl.disabled = false;
      expect(ctl.checkValidity(), 'invalid again once unbarred').to.be.false;
      ctl.required = false;
      expect(ctl.checkValidity(), 'valid once optional, with no await').to.be.true;
    });

    it('restores a serialized state through the adapter, and survives setCustomValidity across a reset', async () => {
      const form = await fixture<HTMLFormElement>(html`
        <form><lr-demo-date-ctl name="due" value="2026-01-02T03:04:05.000Z"></lr-demo-date-ctl></form>
      `);
      const ctl = form.querySelector('lr-demo-date-ctl') as unknown as DateCtl & {
        formStateRestoreCallback(state: string | File | FormData | null, reason: 'restore'): void;
      };

      ctl.formStateRestoreCallback('2031-12-25T00:00:00.000Z', 'restore');
      expect(ctl.value?.toISOString()).to.equal('2031-12-25T00:00:00.000Z');

      ctl.setCustomValidity('Rejected by the server.');
      form.reset();
      expect(ctl.value?.toISOString(), 'reset restores the default').to.equal('2026-01-02T03:04:05.000Z');
      expect(ctl.validity.customError, 'the custom error survives a reset').to.be.true;
      expect(ctl.validationMessage).to.equal('Rejected by the server.');

      ctl.setCustomValidity('');
      expect(ctl.validity.valid).to.be.true;
    });
  });

  describe('string[]-valued', () => {
    it('treats an empty array as missing for `required`, and a populated one as present', async () => {
      const ctl = (await fixture(html`<lr-demo-tags-ctl required></lr-demo-tags-ctl>`)) as unknown as TagsCtl;
      expect(ctl.value.length).to.equal(0);
      expect(ctl.validity.valueMissing, 'valueMissing while empty').to.be.true;
      expect(ctl.validationMessage).to.equal('This field is required.');

      ctl.value = ['alpha', 'beta'];
      expect(ctl.validity.valueMissing, 'valueMissing once populated').to.be.false;
      expect(ctl.checkValidity()).to.be.true;

      ctl.value = [];
      expect(ctl.validity.valueMissing, 'valueMissing once emptied again').to.be.true;
    });

    it('round-trips through the `value` attribute and submits one entry keyed by `name`', async () => {
      const form = await fixture<HTMLFormElement>(html`
        <form><lr-demo-tags-ctl name="tags" value="alpha,beta"></lr-demo-tags-ctl></form>
      `);
      const ctl = form.querySelector('lr-demo-tags-ctl') as unknown as TagsCtl;
      expect([...ctl.defaultValue]).to.deep.equal(['alpha', 'beta']);
      expect([...ctl.value]).to.deep.equal(['alpha', 'beta']);
      expect(new FormData(form).get('tags')).to.equal('alpha,beta');

      ctl.value = ['gamma'];
      expect(new FormData(form).get('tags')).to.equal('gamma');

      form.reset();
      expect([...ctl.value]).to.deep.equal(['alpha', 'beta']);
    });

    it('restores from the FormData state shape `toFormState` persisted, not from the submission entry', async () => {
      const ctl = (await fixture(html`<lr-demo-tags-ctl name="tags"></lr-demo-tags-ctl>`)) as unknown as TagsCtl & {
        formStateRestoreCallback(state: string | File | FormData | null, reason: 'restore'): void;
      };
      ctl.formStateRestoreCallback(createStringArrayFormDataState('value', ['one', 'two']), 'restore');
      expect([...ctl.value]).to.deep.equal(['one', 'two']);

      // A wrongly-shaped state fails closed to the empty value rather than throwing.
      ctl.formStateRestoreCallback('not-a-form-data', 'restore');
      expect([...ctl.value]).to.deep.equal([]);
    });

    it('removes the `value` attribute when the default serializes to null instead of writing an empty one', async () => {
      const ctl = (await fixture(
        html`<lr-demo-tags-ctl value="alpha"></lr-demo-tags-ctl>`,
      )) as unknown as TagsCtl;
      const host = ctl as unknown as HTMLElement;
      expect(host.getAttribute('value')).to.equal('alpha');
      ctl.defaultValue = [];
      expect(host.hasAttribute('value')).to.be.false;
      expect([...ctl.defaultValue]).to.deep.equal([]);
    });

    it('publishes the same validity custom states, gated on the same interaction signal', async function () {
      if (!supportsCustomStates) this.skip();
      const ctl = (await fixture(html`<lr-demo-tags-ctl required></lr-demo-tags-ctl>`)) as unknown as TagsCtl;
      const host = ctl as unknown as HTMLElement;
      expect(ctl.internals.states.has('required')).to.be.true;
      expect(ctl.internals.states.has('invalid')).to.be.true;
      expect(ctl.internals.states.has('user-invalid'), 'pristine control').to.be.false;

      host.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      expect(ctl.internals.states.has('user-invalid')).to.be.true;

      ctl.value = ['alpha'];
      expect(ctl.internals.states.has('user-valid')).to.be.true;
      expect(ctl.internals.states.has('user-invalid')).to.be.false;
    });
  });

  it('never mutates the shared empty value across instances', async () => {
    const first = (await fixture(html`<lr-demo-tags-ctl></lr-demo-tags-ctl>`)) as unknown as TagsCtl;
    const second = (await fixture(html`<lr-demo-tags-ctl></lr-demo-tags-ctl>`)) as unknown as TagsCtl;
    first.value = ['alpha'];
    expect([...second.value], 'the second instance still starts empty').to.deep.equal([]);
  });
});

describe('the default (string) adapter', () => {
  it('states the exact behaviour the mixin shipped with, so the default path stays a no-op', () => {
    expect(stringFormValueAdapter.empty).to.equal('');
    expect(stringFormValueAdapter.toFormValue('hello')).to.equal('hello');
    expect(stringFormValueAdapter.isEmpty('')).to.be.true;
    expect(stringFormValueAdapter.isEmpty('0')).to.be.false;
    expect(stringFormValueAdapter.fromAttribute('hello')).to.equal('hello');
    expect(stringFormValueAdapter.toAttribute('')).to.equal('');
    expect(stringFormValueAdapter.fromFormState('hello')).to.equal('hello');
    expect(stringFormValueAdapter.fromFormState(null)).to.equal('');
    expect(stringFormValueAdapter.fromFormState(new FormData())).to.equal('');
  });

  it('is what an adapter-less mixin application still uses -- the string control is unchanged', async () => {
    const form = await fixture<HTMLFormElement>(html`<form><lr-demo-ctl name="x" required></lr-demo-ctl></form>`);
    const ctl = form.querySelector('lr-demo-ctl') as unknown as Ctl;
    // Present as "" from construction (the native-<input> guarantee), and missing for `required`.
    expect(new FormData(form).get('x')).to.equal('');
    expect(ctl.validity.valueMissing).to.be.true;
    ctl.value = '0';
    expect(ctl.validity.valueMissing, '"0" is a real value, not emptiness').to.be.false;
  });
});

describe('isEmptyFormValue()', () => {
  it('answers emptiness for the value shapes a form control actually carries', () => {
    expect(isEmptyFormValue(null), 'null').to.be.true;
    expect(isEmptyFormValue(undefined), 'undefined').to.be.true;
    expect(isEmptyFormValue(''), 'empty string').to.be.true;
    expect(isEmptyFormValue([]), 'empty array').to.be.true;
    expect(isEmptyFormValue({}), 'empty plain object').to.be.true;

    expect(isEmptyFormValue('x'), 'non-empty string').to.be.false;
    expect(isEmptyFormValue(['x']), 'non-empty array').to.be.false;
    expect(isEmptyFormValue({ a: 1 }), 'non-empty plain object').to.be.false;
    // A real value, however falsy or however key-less: `0`/`false` are choices a user made, and
    // `Object.keys()` reports 0 for a populated FormData/Map/Set, so those are never key-counted.
    expect(isEmptyFormValue(0), 'zero').to.be.false;
    expect(isEmptyFormValue(false), 'false').to.be.false;
    expect(isEmptyFormValue(new Date(0)), 'the epoch Date').to.be.false;
    const populated = new FormData();
    populated.append('a', '1');
    expect(isEmptyFormValue(populated), 'a populated FormData').to.be.false;
    expect(isEmptyFormValue(new FormData()), 'an empty FormData is not key-counted').to.be.false;
    expect(isEmptyFormValue(new Map([['a', 1]])), 'a populated Map').to.be.false;
  });

  it('recognizes foreign-realm plain objects without key-counting class instances', () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    try {
      const frameWindow = frame.contentWindow!;
      const empty = frameWindow.JSON.parse('{}') as Record<string, unknown>;
      const populated = frameWindow.JSON.parse('{"answer":42}') as Record<string, unknown>;
      const ForeignValue = frameWindow.Function('return class Value {}')() as new () => object;
      expect(Object.getPrototypeOf(empty) === Object.prototype, 'not the ambient Object prototype').to.be.false;
      expect(isEmptyFormValue(empty), 'foreign empty plain object').to.be.true;
      expect(isEmptyFormValue(populated), 'foreign populated plain object').to.be.false;
      expect(isEmptyFormValue(new ForeignValue()), 'foreign class instance').to.be.false;
    } finally {
      frame.remove();
    }
  });

  it('treats values with hostile array-length, prototype, or own-key reflection as non-empty', () => {
    const hostileArray = new Proxy([], {
      get(target, property, receiver) {
        if (property === 'length') throw new Error('length trap');
        return Reflect.get(target, property, receiver);
      },
    });
    const hostilePrototype = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw new Error('prototype trap');
        },
      },
    );
    const hostileOwnKeys = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error('ownKeys trap');
        },
      },
    );

    expect(() => isEmptyFormValue(hostileArray)).to.not.throw();
    expect(() => isEmptyFormValue(hostilePrototype)).to.not.throw();
    expect(() => isEmptyFormValue(hostileOwnKeys)).to.not.throw();
    expect(isEmptyFormValue(hostileArray), 'uninspectable array').to.be.false;
    expect(isEmptyFormValue(hostilePrototype), 'uninspectable prototype').to.be.false;
    expect(isEmptyFormValue(hostileOwnKeys), 'uninspectable own keys').to.be.false;
  });

  it('keeps required mixin validity operational when its default emptiness adapter sees a hostile value', async () => {
    const control = (await fixture(
      html`<lr-demo-object-ctl required></lr-demo-object-ctl>`,
    )) as unknown as ObjectCtl;
    const hostile = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw new Error('prototype trap');
        },
      },
    );

    expect(() => {
      control.value = hostile;
    }).to.not.throw();
    expect(control.validity.valueMissing).to.be.false;
    expect(control.checkValidity()).to.be.true;
  });
});

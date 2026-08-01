import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import type { PropertyValues } from 'lit';
import './switch.js';
import type { LyraSwitch } from './switch.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import { LyraElement } from '../../../internal/lyra-element.js';

it('exposes namespaced geometry custom properties', async () => {
  // Reads the real computed custom-property cascade on a rendered instance instead of
  // substring-matching the exported stylesheet source, which would still pass even if the
  // declarations lived on a selector that never actually applied to the host.
  const el = (await fixture(html`<lr-switch>Label</lr-switch>`)) as LyraSwitch;
  const computed = getComputedStyle(el);
  expect(computed.getPropertyValue('--lr-switch-track-inline-size').trim()).to.not.equal('');
  expect(computed.getPropertyValue('--lr-switch-track-block-size').trim()).to.not.equal('');
  expect(computed.getPropertyValue('--lr-switch-thumb-offset').trim()).to.not.equal('');
  expect(computed.getPropertyValue('--track-inline-size').trim()).to.equal('');
  expect(computed.getPropertyValue('--track-block-size').trim()).to.equal('');
  expect(computed.getPropertyValue('--thumb-offset').trim()).to.equal('');
});

it('gives the switch track hover and press feedback matching the keyboard focus-visible cue', async () => {
  // Rendered results, not stylesheet text. This shipped as a filter: brightness() lift on
  // [part='base'] -- which faded the LABEL along with the track, because a filter applies to the
  // whole subtree -- and a source match could not tell the difference.
  // --lr-transition-fast is zeroed: the track transitions its background, so reading
  // getComputedStyle one frame after the pointer arrives would otherwise catch the INTERPOLATED
  // colour -- still the resting one at t=0 -- and report a working hover as broken.
  const el = (await fixture(
    html`<lr-switch style="--lr-transition-fast: 0s">Label</lr-switch>`,
  )) as LyraSwitch;
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const track = el.shadowRoot!.querySelector('[part="track"]') as HTMLElement;
  const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
  const restingTrack = getComputedStyle(track).backgroundColor;
  const restingLabel = getComputedStyle(label).color;
  const rect = base.getBoundingClientRect();
  const position: [number, number] = [
    Math.round(rect.left + rect.width / 2),
    Math.round(rect.top + rect.height / 2),
  ];
  try {
    await sendMouse({ type: 'move', position });
    const hovered = getComputedStyle(track).backgroundColor;
    expect(hovered, 'hovered track vs resting').to.not.equal(restingTrack);
    expect(getComputedStyle(base).filter, 'no subtree filter').to.equal('none');
    expect(getComputedStyle(label).color, 'the label must not move with the track').to.equal(restingLabel);
    await sendMouse({ type: 'down' });
    expect(getComputedStyle(track).backgroundColor, 'pressed vs hovered').to.not.equal(hovered);
  } finally {
    await sendMouse({ type: 'up' });
    await resetMouse();
  }
});

it('moves the checked track under the pointer too, away from its own brand fill', async () => {
  const el = (await fixture(
    html`<lr-switch checked style="--lr-transition-fast: 0s">Label</lr-switch>`,
  )) as LyraSwitch;
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const track = el.shadowRoot!.querySelector('[part="track"]') as HTMLElement;
  const resting = getComputedStyle(track).backgroundColor;
  const rect = base.getBoundingClientRect();
  try {
    await sendMouse({
      type: 'move',
      position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
    });
    expect(getComputedStyle(track).backgroundColor, 'checked hover vs checked resting').to.not.equal(resting);
  } finally {
    await resetMouse();
  }
});

it('forwards host click() to the internal control, toggling checked', async () => {
  const el = (await fixture(html`<lr-switch>Label</lr-switch>`)) as LyraSwitch;
  expect(el.checked).to.be.false;

  const event = oneEvent(el, 'lr-change');
  el.click();
  const result = await event;
  expect(result.detail.checked).to.be.true;
  expect(el.checked).to.be.true;
});

it('does not toggle on host click() while disabled', async () => {
  const el = (await fixture(html`<lr-switch disabled>Label</lr-switch>`)) as LyraSwitch;
  el.click();
  expect(el.checked).to.be.false;
});

describe('ElementInternals availability', () => {
  it('does not throw when constructed in an environment without a real ElementInternals implementation (e.g. a downstream Vitest + happy-dom suite)', () => {
    const original = HTMLElement.prototype.attachInternals;
    // @ts-expect-error -- simulating an environment that lacks ElementInternals entirely
    delete HTMLElement.prototype.attachInternals;
    try {
      let el: LyraSwitch | undefined;
      expect(() => {
        el = document.createElement('lr-switch') as LyraSwitch;
      }).to.not.throw();
      // Confirm the fallback keeps the rest of the public surface usable rather than merely
      // swallowing the constructor error.
      expect(el!.checkValidity()).to.be.true;
      expect(el!.form).to.equal(null);
    } finally {
      HTMLElement.prototype.attachInternals = original;
    }
  });
});

it('calls super.willUpdate so a future LyraElement/mixin lifecycle hook stays wired in', async () => {
  // Monkey-patch LyraElement.prototype.willUpdate (the established pattern, e.g. checkbox.test.ts)
  // to prove LyraSwitch's own willUpdate() override actually calls super.willUpdate(...) rather
  // than shadowing it silently.
  const proto = LyraElement.prototype as unknown as { willUpdate: (changed: PropertyValues) => void };
  const original = proto.willUpdate;
  let called = false;
  proto.willUpdate = function (this: LyraElement, changed: PropertyValues): void {
    called = true;
    original.call(this, changed);
  };
  try {
    const el = (await fixture(html`<lr-switch>Label</lr-switch>`)) as LyraSwitch;
    await el.updateComplete;
    expect(called).to.be.true;
  } finally {
    proto.willUpdate = original;
  }
});

it('defaults to unchecked with role="switch" and aria-checked="false"', async () => {
  const el = (await fixture(html`<lr-switch>Label</lr-switch>`)) as LyraSwitch;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(el.checked).to.be.false;
  expect(base.getAttribute('role')).to.equal('switch');
  expect(base.getAttribute('aria-checked')).to.equal('false');
});

it('reflects checked to the attribute and to aria-checked', async () => {
  const el = (await fixture(html`<lr-switch>Label</lr-switch>`)) as LyraSwitch;
  el.checked = true;
  await el.updateComplete;
  expect(el.hasAttribute('checked')).to.be.true;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('aria-checked')).to.equal('true');
});

it('toggles and emits lr-change with detail.checked on click', async () => {
  const el = (await fixture(html`<lr-switch>Label</lr-switch>`)) as LyraSwitch;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  setTimeout(() => base.click());
  let ev = await oneEvent(el, 'lr-change');
  expect(ev.detail.checked).to.be.true;
  expect(el.checked).to.be.true;

  setTimeout(() => base.click());
  ev = await oneEvent(el, 'lr-change');
  expect(ev.detail.checked).to.be.false;
  expect(el.checked).to.be.false;
});

describe('native form event contract', () => {
  /** Records the ordered event-name sequence a single activation produces on the host, so the
   *  assertions below can prove both that the native pair fires *and* that it fires in the
   *  native order (`input` before `change`) with the `lr-change` compatibility alias last --
   *  matching `<lr-checkbox>`'s established sequence. */
  const recordSequence = (el: LyraSwitch): string[] => {
    const seen: string[] = [];
    for (const name of ['input', 'change', 'lr-change']) {
      el.addEventListener(name, (event) => seen.push(event.type));
    }
    return seen;
  };

  it('emits input, change and lr-change in that order on a pointer click', async () => {
    const el = (await fixture(html`<lr-switch>Label</lr-switch>`)) as LyraSwitch;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const seen = recordSequence(el);

    base.click();
    expect(seen).to.deep.equal(['input', 'change', 'lr-change']);
    expect(el.checked).to.be.true;
  });

  it('emits input and change on Space and on Enter keydown', async () => {
    const el = (await fixture(html`<lr-switch>Label</lr-switch>`)) as LyraSwitch;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const seen = recordSequence(el);

    base.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    expect(seen).to.deep.equal(['input', 'change', 'lr-change']);

    base.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    expect(seen).to.deep.equal(['input', 'change', 'lr-change', 'input', 'change', 'lr-change']);
    expect(el.checked).to.be.false;
  });

  it('emits input and change from the programmatic host click() activation path', async () => {
    const el = (await fixture(html`<lr-switch>Label</lr-switch>`)) as LyraSwitch;
    const seen = recordSequence(el);

    el.click();
    expect(seen).to.deep.equal(['input', 'change', 'lr-change']);
  });

  it('makes input and change bubbling, composed and non-cancelable', async () => {
    const el = (await fixture(html`<lr-switch>Label</lr-switch>`)) as LyraSwitch;

    const inputPromise = oneEvent(el, 'input');
    el.click();
    const inputEvent = await inputPromise;
    expect(inputEvent.bubbles).to.be.true;
    expect(inputEvent.composed).to.be.true;
    expect(inputEvent.cancelable).to.be.false;

    const changePromise = oneEvent(el, 'change');
    el.click();
    const changeEvent = await changePromise;
    expect(changeEvent.bubbles).to.be.true;
    expect(changeEvent.composed).to.be.true;
    expect(changeEvent.cancelable).to.be.false;
  });

  it('emits neither input nor change while disabled, nor for a programmatic .checked assignment', async () => {
    const el = (await fixture(html`<lr-switch disabled>Label</lr-switch>`)) as LyraSwitch;
    const seen = recordSequence(el);

    el.click();
    el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }),
    );
    expect(seen).to.deep.equal([]);

    el.disabled = false;
    await el.updateComplete;
    el.checked = true;
    await el.updateComplete;
    expect(seen).to.deep.equal([]);
  });

  it('emits neither input nor change from form.reset() or session-state restoration', async () => {
    const form = (await fixture(html`
      <form><lr-switch name="notify" checked>Notify me</lr-switch></form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-switch') as LyraSwitch;
    const seen = recordSequence(el);

    form.reset();
    el.formStateRestoreCallback('checked');
    expect(seen).to.deep.equal([]);
  });
});

it('toggles on Space and Enter keydown', async () => {
  const el = (await fixture(html`<lr-switch>Label</lr-switch>`)) as LyraSwitch;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  setTimeout(() =>
    base.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })),
  );
  let ev = await oneEvent(el, 'lr-change');
  expect(ev.detail.checked).to.be.true;

  setTimeout(() =>
    base.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })),
  );
  ev = await oneEvent(el, 'lr-change');
  expect(ev.detail.checked).to.be.false;
});

it('preventDefault()s the Space keydown so the page does not scroll', async () => {
  const el = (await fixture(html`<lr-switch>Label</lr-switch>`)) as LyraSwitch;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const ev = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
  base.dispatchEvent(ev);
  expect(ev.defaultPrevented).to.be.true;
});

it('ignores click and keydown activation while disabled, and is not focusable', async () => {
  const el = (await fixture(html`<lr-switch disabled>Label</lr-switch>`)) as LyraSwitch;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('tabindex')).to.equal('-1');
  expect(base.getAttribute('aria-disabled')).to.equal('true');

  let fired = false;
  el.addEventListener('lr-change', () => (fired = true));
  base.click();
  base.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
  expect(fired).to.be.false;
  expect(el.checked).to.be.false;
});

it('is focusable (tabindex 0) when enabled', async () => {
  const el = (await fixture(html`<lr-switch>Label</lr-switch>`)) as LyraSwitch;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('tabindex')).to.equal('0');
});

it('exposes explicit false aria-required/aria-disabled states by default', async () => {
  const el = (await fixture(html`<lr-switch>Label</lr-switch>`)) as LyraSwitch;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('aria-required')).to.equal('false');
  expect(base.getAttribute('aria-disabled')).to.equal('false');
});

it('sets aria-required when required', async () => {
  const el = (await fixture(html`<lr-switch required>Label</lr-switch>`)) as LyraSwitch;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('aria-required')).to.equal('true');
});

it('forwards focus() and blur() to the internal switch control', async () => {
  const el = (await fixture(html`<lr-switch>Label</lr-switch>`)) as LyraSwitch;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  el.focus();
  expect(el.shadowRoot!.activeElement === base).to.be.true;
  el.blur();
  expect(el.shadowRoot!.activeElement).to.equal(null);
});

it('re-dispatches the internal control focus/blur as bubbling, composed host-level events', async () => {
  const el = (await fixture(html`<lr-switch>Label</lr-switch>`)) as LyraSwitch;

  const focusPromise = oneEvent(el, 'focus');
  el.focus();
  const focusEvent = await focusPromise;
  expect(focusEvent.bubbles).to.be.true;
  expect(focusEvent.composed).to.be.true;
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('base');

  const blurPromise = oneEvent(el, 'blur');
  el.blur();
  const blurEvent = await blurPromise;
  expect(blurEvent.bubbles).to.be.true;
  expect(blurEvent.composed).to.be.true;
  expect(el.shadowRoot!.activeElement).to.equal(null);
});

it('reflects aria-invalid on the inner switch only after the field has been interacted with once', async () => {
  const el = (await fixture(html`<lr-switch required>Label</lr-switch>`)) as LyraSwitch;
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('aria-invalid')).to.equal('false');

  base.dispatchEvent(new FocusEvent('blur'));
  await el.updateComplete;
  expect(base.getAttribute('aria-invalid')).to.equal('true');

  el.checked = true;
  await el.updateComplete;
  expect(base.getAttribute('aria-invalid')).to.equal('false');
});

it('hides the label part when the default slot has no real content', async () => {
  const el = (await fixture(html`<lr-switch></lr-switch>`)) as LyraSwitch;
  const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
  expect(label.hidden).to.be.true;
});

it('shows the label part for plain slotted text (a text node, not an element)', async () => {
  const el = (await fixture(html`<lr-switch>Enable notifications</lr-switch>`)) as LyraSwitch;
  const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
  expect(label.hidden).to.be.false;
});

it('forwards a host aria-label onto the inner role="switch" element', async () => {
  const el = (await fixture(
    html`<lr-switch aria-label="Enable notifications"></lr-switch>`,
  )) as LyraSwitch;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('aria-label')).to.equal('Enable notifications');
});

it('does not set an empty aria-label on the inner element when the host has none', async () => {
  const el = (await fixture(html`<lr-switch>Label</lr-switch>`)) as LyraSwitch;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.hasAttribute('aria-label')).to.be.false;
});

it('participates in a form: submits value under name only when checked', async () => {
  const form = (await fixture(html`
    <form><lr-switch name="notify" value="yes">Notify me</lr-switch></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-switch') as LyraSwitch;

  expect(new FormData(form).get('notify')).to.equal(null);

  el.checked = true;
  await el.updateComplete;
  expect(new FormData(form).get('notify')).to.equal('yes');

  el.checked = false;
  await el.updateComplete;
  expect(new FormData(form).get('notify')).to.equal(null);
});

it('updates form value and validity synchronously when checked changes', async () => {
  const form = (await fixture(html`
    <form><lr-switch name="notify" value="yes" required>Notify me</lr-switch></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-switch') as LyraSwitch;

  expect(el.checkValidity()).to.be.false;

  el.checked = true;
  expect(new FormData(form).get('notify')).to.equal('yes');
  expect(el.checkValidity()).to.be.true;

  el.checked = false;
  expect(new FormData(form).get('notify')).to.equal(null);
  expect(el.checkValidity()).to.be.false;
});

it('updates the submitted value synchronously when value changes', async () => {
  const form = (await fixture(html`
    <form><lr-switch name="notify" value="yes" checked>Notify me</lr-switch></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-switch') as LyraSwitch;

  el.value = 'updated';
  expect(new FormData(form).get('notify')).to.equal('updated');
});

it('updates validity synchronously when required changes', async () => {
  const el = (await fixture(html`
    <lr-switch name="terms">Agree</lr-switch>
  `)) as LyraSwitch;

  expect(el.checkValidity()).to.be.true;
  el.required = true;
  expect(el.checkValidity()).to.be.false;
  el.required = false;
  expect(el.checkValidity()).to.be.true;
});

describe('validationMessage localization', () => {
  it('defaults to the built-in English validationMessage for a required, unchecked control', async () => {
    const el = (await fixture(html`<lr-switch required>Agree</lr-switch>`)) as LyraSwitch;
    expect(el.validationMessage).to.equal('Please turn this on.');
  });

  it('localizes the validationMessage via this.localize() when .strings overrides switchRequired', async () => {
    const el = (await fixture(html`
      <lr-switch required .strings=${{ switchRequired: 'Veuillez activer ceci.' }}>Agree</lr-switch>
    `)) as LyraSwitch;
    expect(el.validationMessage).to.equal('Veuillez activer ceci.');

    el.checked = true;
    expect(el.validationMessage).to.equal('');
  });
});

it('submits under a programmatically assigned name in the same tick', async () => {
  const form = (await fixture(html`
    <form><lr-switch value="yes" checked>Notify me</lr-switch></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-switch') as LyraSwitch;

  el.name = 'first';
  expect(el.getAttribute('name')).to.equal('first');
  expect(new FormData(form).get('first')).to.equal('yes');

  el.name = 'second';
  const renamed = new FormData(form);
  expect(renamed.has('first')).to.be.false;
  expect(renamed.get('second')).to.equal('yes');

  el.name = '';
  expect(el.hasAttribute('name')).to.be.false;
  expect(el.name).to.equal('');
  expect(new FormData(form).has('second')).to.be.false;

  el.setAttribute('name', 'from-attribute');
  expect(el.name).to.equal('from-attribute');
  expect(new FormData(form).get('from-attribute')).to.equal('yes');
  el.removeAttribute('name');
  expect(el.name).to.equal('');
  expect(new FormData(form).has('from-attribute')).to.be.false;
});

it('uses "on" as the default form value', async () => {
  const form = (await fixture(html`
    <form><lr-switch name="notify" checked>Notify me</lr-switch></form>
  `)) as HTMLFormElement;
  expect(new FormData(form).get('notify')).to.equal('on');
});

it('blocks a required, unchecked switch from submitting the form', async () => {
  const form = (await fixture(html`
    <form><lr-switch name="terms" required>Agree</lr-switch></form>
  `)) as HTMLFormElement;
  expect(form.reportValidity()).to.be.false;

  const el = form.querySelector('lr-switch') as LyraSwitch;
  el.checked = true;
  await el.updateComplete;
  expect(form.reportValidity()).to.be.true;
});

it('focuses the inner switch after direct and submit-driven validity reporting', async () => {
  const form = (await fixture(html`
    <form>
      <button type="button">Before switch</button>
      <lr-switch name="terms" required>Agree</lr-switch>
    </form>
  `)) as HTMLFormElement;
  const sentinel = form.querySelector('button') as HTMLButtonElement;
  const el = form.querySelector('lr-switch') as LyraSwitch;
  let submitCount = 0;
  form.addEventListener('submit', (event) => {
    submitCount += 1;
    event.preventDefault();
  });

  sentinel.focus();
  expect(el.reportValidity()).to.be.false;
  expect(document.activeElement?.localName).to.equal('lr-switch');
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('base');

  sentinel.focus();
  form.requestSubmit();
  expect(submitCount).to.equal(0);
  expect(document.activeElement?.localName).to.equal('lr-switch');
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('base');
});

it('applies and removes explicit disabled form state synchronously', async () => {
  const form = (await fixture(html`
    <form>
      <lr-switch id="submitted" name="notify" value="yes" checked>Notify me</lr-switch>
      <lr-switch id="invalid" name="terms" required>Agree</lr-switch>
    </form>
  `)) as HTMLFormElement;
  const submitted = form.querySelector('#submitted') as LyraSwitch;
  const invalid = form.querySelector('#invalid') as LyraSwitch;

  expect(new FormData(form).get('notify')).to.equal('yes');
  expect(invalid.checkValidity()).to.be.false;

  submitted.disabled = true;
  invalid.disabled = true;
  expect(submitted.hasAttribute('disabled')).to.be.true;
  expect(invalid.hasAttribute('disabled')).to.be.true;
  expect(new FormData(form).has('notify')).to.be.false;
  expect(invalid.checkValidity()).to.be.true;

  submitted.disabled = false;
  invalid.disabled = false;
  expect(submitted.hasAttribute('disabled')).to.be.false;
  expect(invalid.hasAttribute('disabled')).to.be.false;
  expect(new FormData(form).get('notify')).to.equal('yes');
  expect(invalid.checkValidity()).to.be.false;
});

it('restores the declared default checked state on form.reset()', async () => {
  const form = (await fixture(html`
    <form><lr-switch name="notify" value="yes" checked required>Notify me</lr-switch></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-switch') as LyraSwitch;
  expect(el.checked).to.be.true;

  el.checked = false;
  await el.updateComplete;
  expect(el.checked).to.be.false;
  expect(new FormData(form).get('notify')).to.equal(null);
  expect(el.checkValidity()).to.be.false;

  form.reset();
  expect(el.checked, 'reset must restore the declared default, not blank/false').to.be.true;
  expect(new FormData(form).get('notify')).to.equal('yes');
  expect(el.checkValidity()).to.be.true;
});

it('resets to unchecked via form.reset() when no default was declared', async () => {
  const form = (await fixture(html`
    <form><lr-switch name="notify">Notify me</lr-switch></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-switch') as LyraSwitch;
  el.checked = true;
  await el.updateComplete;
  expect(new FormData(form).get('notify')).to.equal('on');

  form.reset();
  expect(el.checked).to.be.false;
  expect(new FormData(form).get('notify')).to.equal(null);
});

it('does not turn a pre-connect checked property assignment into the reset default', async () => {
  const form = document.createElement('form');
  const el = document.createElement('lr-switch') as LyraSwitch;
  el.checked = true;
  form.append(el);
  document.body.append(form);
  await el.updateComplete;

  form.reset();
  expect(el.checked).to.be.false;
  form.remove();
});

it('temporarily disables through a fieldset without overwriting the author disabled state', async () => {
  const form = (await fixture(html`
    <form>
      <fieldset>
        <lr-switch name="notify" value="yes" checked>Notify me</lr-switch>
        <lr-switch name="always-disabled" value="yes" checked disabled>Always disabled</lr-switch>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-switch') as LyraSwitch;
  const explicitlyDisabled = form.querySelector('[name="always-disabled"]') as LyraSwitch;
  const fieldset = form.querySelector('fieldset') as HTMLFieldSetElement;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  expect(el.disabled).to.be.false;
  expect(el.effectiveDisabled).to.be.false;
  expect(new FormData(form).get('notify')).to.equal('yes');

  fieldset.disabled = true;
  await Promise.all([el.updateComplete, explicitlyDisabled.updateComplete]);
  expect(el.disabled, 'fieldset state must not mutate the public property').to.be.false;
  expect(el.hasAttribute('disabled')).to.be.false;
  expect(el.effectiveDisabled).to.be.true;
  expect(base.getAttribute('tabindex')).to.equal('-1');
  expect(base.getAttribute('aria-disabled')).to.equal('true');
  expect(getComputedStyle(base).cursor).to.equal('not-allowed');
  expect(new FormData(form).get('notify')).to.equal(null);

  base.click();
  expect(el.checked, 'inherited disabled state blocks activation').to.be.true;

  fieldset.disabled = false;
  await Promise.all([el.updateComplete, explicitlyDisabled.updateComplete]);
  expect(el.disabled).to.be.false;
  expect(el.effectiveDisabled).to.be.false;
  expect(base.getAttribute('tabindex')).to.equal('0');
  expect(base.getAttribute('aria-disabled')).to.equal('false');
  expect(new FormData(form).get('notify')).to.equal('yes');

  expect(explicitlyDisabled.disabled, 'an explicit disabled state survives the fieldset cycle').to.be.true;
  expect(explicitlyDisabled.effectiveDisabled).to.be.true;
  expect(new FormData(form).get('always-disabled')).to.equal(null);
});

it('is accessible in the default (unchecked, unlabeled) state', async () => {
  const el = (await fixture(html`<lr-switch aria-label="Enable notifications"></lr-switch>`)) as LyraSwitch;
  await expect(el).to.be.accessible();
});

it('is accessible in a checked, labeled, required state', async () => {
  const el = (await fixture(
    html`<lr-switch checked required>Enable notifications</lr-switch>`,
  )) as LyraSwitch;
  await expect(el).to.be.accessible();
});

it('is accessible with a populated hint/errorText (the parts never rendered by the cases above)', async () => {
  const el = (await fixture(
    html`<lr-switch hint="You can change this later" error-text="Required" required
      >Enable notifications</lr-switch
    >`,
  )) as LyraSwitch;
  await expect(el).to.be.accessible();
});

describe('hint/error chrome', () => {
  it('renders no hint/error chrome when hint/errorText are unset (today\'s exact bare output)', async () => {
    const el = (await fixture(html`<lr-switch>Enable notifications</lr-switch>`)) as LyraSwitch;
    const hint = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
    const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
    expect(hint.hidden).to.be.true;
    expect(error.hidden).to.be.true;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.hasAttribute('aria-describedby')).to.be.false;
  });

  it('renders hint/errorText text and un-hides the matching parts', async () => {
    const el = (await fixture(
      html`<lr-switch hint="You can change this later" error-text="Required">Enable notifications</lr-switch>`,
    )) as LyraSwitch;
    const hint = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
    const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
    expect(hint.hidden).to.be.false;
    expect(hint.textContent).to.contain('You can change this later');
    expect(error.hidden).to.be.false;
    expect(error.textContent).to.contain('Required');
  });

  it('wires aria-describedby on the inner switch to the rendered error/hint ids', async () => {
    const el = (await fixture(
      html`<lr-switch hint="Hint text" error-text="Err text">Enable notifications</lr-switch>`,
    )) as LyraSwitch;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute('aria-describedby')).to.equal('switch-error switch-hint');
  });

  it('supports slotted hint/error content in place of the text props, without disturbing the default-slot label', async () => {
    const el = (await fixture(html`
      <lr-switch>
        Enable notifications
        <span slot="hint">Slotted hint</span>
        <span slot="error">Slotted error</span>
      </lr-switch>
    `)) as LyraSwitch;
    const hint = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
    const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
    const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
    expect(hint.hidden).to.be.false;
    expect(error.hidden).to.be.false;
    expect(label.hidden).to.be.false;
  });

  it('does not treat a slotted hint/error-only switch (no default-slot text) as having a label', async () => {
    const el = (await fixture(html`
      <lr-switch>
        <span slot="hint">Slotted hint</span>
      </lr-switch>
    `)) as LyraSwitch;
    const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
    expect(label.hidden).to.be.true;
  });
});

it('exposes checkValidity()/reportValidity() through ElementInternals', async () => {
  const el = (await fixture(html`<lr-switch required>Label</lr-switch>`)) as LyraSwitch;
  await el.updateComplete;
  expect(el.checkValidity(), 'required and unchecked is invalid').to.be.false;
  expect(el.reportValidity()).to.be.false;
  el.checked = true;
  await el.updateComplete;
  expect(el.checkValidity()).to.be.true;
  expect(el.reportValidity()).to.be.true;
});


// -- Degraded-DOM form-association fallback ---------------------------------

describe('ElementInternals fallback (lr-switch)', () => {
  /** Mirrors a DOM implementation without form-association support (a consumer's happy-dom/Vitest
   *  suite). `attachInternals()` is browser-only, so the component swaps in inert no-op internals
   *  rather than throwing at construction -- every member has to answer, and value changes must
   *  still work with form participation simply unavailable. */
  const withoutAttachInternals = async (
    impl: undefined | (() => never),
    assertion: (el: LyraSwitch) => void | Promise<void>,
  ): Promise<void> => {
    const proto = HTMLElement.prototype as unknown as { attachInternals?: unknown };
    const original = proto.attachInternals;
    if (impl === undefined) delete proto.attachInternals;
    else proto.attachInternals = impl;
    try {
      const el = (await fixture(html`<lr-switch>Label</lr-switch>`)) as LyraSwitch;
      await el.updateComplete;
      await assertion(el);
    } finally {
      proto.attachInternals = original;
    }
  };

  it('answers inertly when attachInternals is missing', async () => {
    await withoutAttachInternals(undefined, async (el) => {
      const internals = (el as unknown as { internals: ElementInternals }).internals;
      expect(internals.form).to.be.null;
      expect(internals.willValidate).to.be.false;
      expect(internals.validationMessage).to.equal('');
      expect(internals.checkValidity()).to.be.true;
      expect(internals.reportValidity()).to.be.true;
      expect(() => internals.setFormValue('x')).to.not.throw();
      expect(() => internals.setValidity({}, '')).to.not.throw();
      el.checked = true;
      await el.updateComplete;
    });
  });

  it('answers inertly when attachInternals throws', async () => {
    await withoutAttachInternals(
      () => {
        throw new DOMException('unsupported');
      },
      (el) => {
        const internals = (el as unknown as { internals: ElementInternals }).internals;
        expect(internals.willValidate).to.be.false;
        expect(internals.reportValidity()).to.be.true;
        expect(internals.checkValidity()).to.be.true;
      },
    );
  });
});

describe('size', () => {
  async function trackOf(markup: unknown): Promise<DOMRect> {
    const el = (await fixture(markup as never)) as LyraSwitch;
    await el.updateComplete;
    const track = el.shadowRoot!.querySelector('[part="track"]') as HTMLElement;
    return track.getBoundingClientRect();
  }

  it('defaults to the "m" tier and reflects it', async () => {
    const el = (await fixture(html`<lr-switch>Label</lr-switch>`)) as LyraSwitch;
    await el.updateComplete;
    expect(el.size).to.equal('m');
    expect(el.getAttribute('size')).to.equal('m');
  });

  it('grows the rendered track from size="s" to size="l"', async () => {
    const small = await trackOf(html`<lr-switch size="s">Label</lr-switch>`);
    const large = await trackOf(html`<lr-switch size="l">Label</lr-switch>`);
    expect(large.width).to.be.greaterThan(small.width);
    expect(large.height).to.be.greaterThan(small.height);
  });

  it('renders "small"/"large" at the same geometry as "s"/"l"', async () => {
    const s = await trackOf(html`<lr-switch size="s">Label</lr-switch>`);
    const small = await trackOf(html`<lr-switch size="small">Label</lr-switch>`);
    const l = await trackOf(html`<lr-switch size="l">Label</lr-switch>`);
    const large = await trackOf(html`<lr-switch size="large">Label</lr-switch>`);
    expect(small.width).to.be.closeTo(s.width, 0.5);
    expect(large.width).to.be.closeTo(l.width, 0.5);
  });

  it('keeps the thumb inside the track and travelling its full width at every tier', async () => {
    let previous = 0;
    for (const size of ['2xs', 'xs', 's', 'm', 'l', 'xl'] as const) {
      const el = (await fixture(html`<lr-switch size=${size} checked>Label</lr-switch>`)) as LyraSwitch;
      await el.updateComplete;
      const track = (el.shadowRoot!.querySelector('[part="track"]') as HTMLElement).getBoundingClientRect();
      const thumb = (el.shadowRoot!.querySelector('[part="thumb"]') as HTMLElement).getBoundingClientRect();
      expect(thumb.height, `${size} thumb fits`).to.be.lessThan(track.height);
      expect(thumb.right, `${size} thumb stays inside`).to.be.at.most(track.right + 0.5);
      expect(track.width, `${size} track grows with the tier`).to.be.greaterThan(previous);
      previous = track.width;
    }
  });

  it('is accessible at a non-default tier', async () => {
    const el = (await fixture(html`<lr-switch size="l">Label</lr-switch>`)) as LyraSwitch;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});

// `internals.states` (CustomStateSet) reached Chromium 125 / Safari 17.4 / Firefox 126, and the
// `:state()` SELECTOR landed separately from the API. Both are guarded because the helper no-ops
// where either is missing -- an unguarded assertion fails on WebKit rather than skipping.
const supportsCustomStates = (() => {
  try {
    return typeof CustomStateSet === 'function';
  } catch {
    return false;
  }
})();
const supportsStateSelector = (() => {
  try {
    document.createElement('div').matches(':state(x)');
    return true;
  } catch {
    return false;
  }
})();

describe('lr-switch validity custom states', () => {
  it('publishes required/optional and valid/invalid from the first render', async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(html`<lr-switch required>Notifications</lr-switch>`)) as LyraSwitch;
    await el.updateComplete;
    expect(el.matches(':state(required)'), 'required').to.be.true;
    expect(el.matches(':state(optional)'), 'optional').to.be.false;
    expect(el.matches(':state(invalid)'), 'invalid').to.be.true;
    expect(el.matches(':state(valid)'), 'valid').to.be.false;

    const optional = (await fixture(html`<lr-switch>Notifications</lr-switch>`)) as LyraSwitch;
    await optional.updateComplete;
    expect(optional.matches(':state(optional)')).to.be.true;
    expect(optional.matches(':state(valid)')).to.be.true;
  });

  it('withholds user-valid/user-invalid until the user has actually interacted', async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(html`<lr-switch required>Notifications</lr-switch>`)) as LyraSwitch;
    await el.updateComplete;
    expect(el.matches(':state(user-invalid)'), 'pristine required must not read as an error').to.be
      .false;

    el.click();
    await el.updateComplete;
    expect(el.checked).to.be.true;
    expect(el.matches(':state(valid)')).to.be.true;
    expect(el.matches(':state(user-valid)'), 'user-valid after a real toggle').to.be.true;
  });

  it('counts a reportValidity() call -- what a submit attempt runs -- as interaction', async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(html`<lr-switch required>Notifications</lr-switch>`)) as LyraSwitch;
    await el.updateComplete;
    expect(el.matches(':state(user-invalid)')).to.be.false;
    el.reportValidity();
    expect(el.matches(':state(user-invalid)')).to.be.true;
  });

  it('goes pristine again after a form reset', async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const form = await fixture<HTMLFormElement>(
      html`<form><lr-switch name="notify" required>Notifications</lr-switch></form>`,
    );
    const el = form.querySelector('lr-switch') as LyraSwitch;
    await el.updateComplete;
    el.reportValidity();
    expect(el.matches(':state(user-invalid)')).to.be.true;
    form.reset();
    await el.updateComplete;
    expect(el.matches(':state(user-invalid)'), 'reset returns the control to pristine').to.be.false;
    expect(el.matches(':state(invalid)')).to.be.true;
  });
});

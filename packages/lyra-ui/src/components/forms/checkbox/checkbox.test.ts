import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import type { PropertyValues } from 'lit';
import './checkbox.js';
import type { LyraCheckbox } from './checkbox.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

it('emits one cancelable lr-invalid alias when a validity check fails', async () => {
  const el = (await fixture(html`<lr-checkbox required>Accept</lr-checkbox>`)) as LyraCheckbox;
  const aliases: CustomEvent[] = [];
  el.addEventListener('lr-invalid', (event) => aliases.push(event as CustomEvent));
  // Registered after the component's own constructor-time relay, so it observes the native event
  // once the alias has had its turn at it.
  const natives: Event[] = [];
  el.addEventListener('invalid', (event) => natives.push(event));

  expect(el.checkValidity()).to.be.false;
  expect(aliases).to.have.lengthOf(1);
  expect(aliases[0].target).to.equal(el);
  expect(aliases[0].bubbles && aliases[0].composed).to.be.true;
  expect(aliases[0].cancelable).to.be.true;
  // Nothing cancelled it, so the browser's own validation UI stays enabled.
  expect(natives).to.have.lengthOf(1);
  expect(natives[0].defaultPrevented).to.be.false;
});

it('cancels the native invalid event when the lr-invalid alias is cancelled', async () => {
  const el = (await fixture(html`<lr-checkbox required>Accept</lr-checkbox>`)) as LyraCheckbox;
  el.addEventListener('lr-invalid', (event) => event.preventDefault());
  const natives: Event[] = [];
  el.addEventListener('invalid', (event) => natives.push(event));

  expect(el.checkValidity()).to.be.false;
  expect(natives).to.have.lengthOf(1);
  expect(natives[0].defaultPrevented).to.be.true;
});

it('defaults to unchecked with role="checkbox" and aria-checked="false"', async () => {
  const el = (await fixture(html`<lr-checkbox>Label</lr-checkbox>`)) as LyraCheckbox;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(el.checked).to.be.false;
  expect(base.getAttribute('role')).to.equal('checkbox');
  expect(base.getAttribute('aria-checked')).to.equal('false');
});

it('reflects the pinned Web Awesome value property', async () => {
  const el = (await fixture(html`<lr-checkbox>Label</lr-checkbox>`)) as LyraCheckbox;
  el.value = 'newsletter';
  await el.updateComplete;
  expect(el.getAttribute('value')).to.equal('newsletter');
});

it('keeps live checked out of the default attribute while updating aria-checked', async () => {
  const el = (await fixture(html`<lr-checkbox>Label</lr-checkbox>`)) as LyraCheckbox;
  el.checked = true;
  await el.updateComplete;
  expect(el.hasAttribute('checked')).to.be.false;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(base.getAttribute('aria-checked')).to.equal('true');
});

it('toggles and emits lr-change with detail.checked on click', async () => {
  const el = (await fixture(html`<lr-checkbox>Label</lr-checkbox>`)) as LyraCheckbox;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;

  setTimeout(() => base.click());
  let ev = await oneEvent(el, 'lr-change');
  expect(ev.detail.checked).to.be.true;
  expect(el.checked).to.be.true;

  setTimeout(() => base.click());
  ev = await oneEvent(el, 'lr-change');
  expect(ev.detail.checked).to.be.false;
  expect(el.checked).to.be.false;
});

it('toggles on Space but not Enter, matching the native checkbox keyboard contract', async () => {
  const el = (await fixture(html`<lr-checkbox>Label</lr-checkbox>`)) as LyraCheckbox;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;

  setTimeout(() =>
    base.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })),
  );
  let ev = await oneEvent(el, 'lr-change');
  expect(ev.detail.checked).to.be.true;

  let changes = 0;
  el.addEventListener('lr-change', () => (changes += 1));
  const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  base.dispatchEvent(enterEvent);
  expect(changes).to.equal(0);
  expect(enterEvent.defaultPrevented).to.be.false;
  expect(el.checked).to.be.true;
});

it('accepts WA hint and Shoelace help-text spellings on one accessible hint surface', async () => {
  const wa = (await fixture(html`<lr-checkbox hint="WA hint">Choice</lr-checkbox>`)) as LyraCheckbox;
  const sl = (await fixture(html`
    <lr-checkbox help-text="Shoelace hint">Choice</lr-checkbox>
  `)) as LyraCheckbox & { helpText: string };
  const slotted = (await fixture(html`
    <lr-checkbox>
      Choice
      <span slot="help-text">Slotted help</span>
    </lr-checkbox>
  `)) as LyraCheckbox;

  for (const [el, text] of [[wa, 'WA hint'], [sl, 'Shoelace hint'], [slotted, 'Slotted help']] as const) {
    await el.updateComplete;
    const hint = el.shadowRoot!.querySelector('[part~="hint"]') as HTMLElement;
    const control = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement & {
      ariaDescribedByElements?: Element[] | null;
    };
    expect(hint.hidden, text).to.be.false;
    const distributed = [...hint.querySelectorAll('slot')]
      .flatMap((slot) => slot.assignedNodes({ flatten: true }))
      .map((node) => node.textContent ?? '')
      .join('');
    expect(`${hint.textContent ?? ''}${distributed}`, text).to.contain(text);
    if ('ariaDescribedByElements' in control) {
      expect(control.ariaDescribedByElements, `${text} relationship`).to.include(hint);
    } else {
      expect(control.getAttribute('aria-describedby'), `${text} fallback`).to.contain(hint.id);
    }
    await expect(el).to.be.accessible();
  }
});

it('exports additive WA/Shoelace control and state part aliases', async () => {
  const checked = (await fixture(html`<lr-checkbox checked>Checked</lr-checkbox>`)) as LyraCheckbox;
  const control = checked.shadowRoot!.querySelector('[part~="control"]') as HTMLElement;
  const checkedIcon = checked.shadowRoot!.querySelector('[part~="checked-icon"]') as SVGElement;
  expect(control.getAttribute('part')!.split(/\s+/)).to.include.members([
    'box', 'control', 'control--checked',
  ]);
  expect(checkedIcon.getAttribute('part')!.split(/\s+/)).to.include.members([
    'checkmark', 'checked-icon',
  ]);

  checked.indeterminate = true;
  await checked.updateComplete;
  const mixedControl = checked.shadowRoot!.querySelector('[part~="control"]') as HTMLElement;
  const mixedIcon = checked.shadowRoot!.querySelector('[part~="indeterminate-icon"]') as SVGElement;
  expect(mixedControl.getAttribute('part')!.split(/\s+/)).to.include('control--indeterminate');
  expect(mixedIcon.getAttribute('part')!.split(/\s+/)).to.include.members([
    'checkmark', 'indeterminate-icon',
  ]);
});

it('accepts Shoelace default-checked while retaining native dirty checked semantics', async () => {
  const form = (await fixture(html`
    <form><lr-checkbox default-checked>Choice</lr-checkbox></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-checkbox') as LyraCheckbox;
  await el.updateComplete;
  expect(el.checked).to.be.true;
  expect(el.defaultChecked).to.be.true;

  el.checked = false;
  el.setAttribute('default-checked', '');
  await el.updateComplete;
  expect(el.checked, 'changing the default must not overwrite dirty live state').to.be.false;
  form.reset();
  expect(el.checked, 'reset uses the Shoelace-spelled default').to.be.true;
});

it('emits exactly one native Event pair and one prefixed alias pair for user toggles', async () => {
  const el = (await fixture(html`<lr-checkbox>Label</lr-checkbox>`)) as LyraCheckbox;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  const observed: Array<{ name: string; event: Event }> = [];
  for (const name of ['input', 'lr-input', 'change', 'lr-change']) {
    el.addEventListener(name, (event) => {
      observed.push({ name, event });
      expect(event.bubbles, `${name} bubbles`).to.be.true;
      expect(event.composed, `${name} is composed`).to.be.true;
    });
  }

  base.click();

  expect(observed.map(({ name }) => name)).to.deep.equal(['input', 'lr-input', 'change', 'lr-change']);
  expect(observed[0].event.constructor === Event).to.be.true;
  expect(observed[2].event.constructor === Event).to.be.true;
  expect(observed[0].event.target === el && observed[2].event.target === el).to.be.true;
  expect(observed[1].event instanceof CustomEvent).to.be.true;
  expect((observed[1].event as CustomEvent).detail).to.deep.equal({ checked: true });
});

it('preventDefault()s the Space keydown so the page does not scroll', async () => {
  const el = (await fixture(html`<lr-checkbox>Label</lr-checkbox>`)) as LyraCheckbox;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  const ev = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
  base.dispatchEvent(ev);
  expect(ev.defaultPrevented).to.be.true;
});

it('ignores click and keydown activation while disabled, and is not focusable', async () => {
  const el = (await fixture(html`<lr-checkbox disabled>Label</lr-checkbox>`)) as LyraCheckbox;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
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
  const el = (await fixture(html`<lr-checkbox>Label</lr-checkbox>`)) as LyraCheckbox;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(base.getAttribute('tabindex')).to.equal('0');
});

it('renders explicit false states for aria-required and aria-disabled', async () => {
  const el = (await fixture(html`<lr-checkbox>Label</lr-checkbox>`)) as LyraCheckbox;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(base.getAttribute('aria-required')).to.equal('false');
  expect(base.getAttribute('aria-disabled')).to.equal('false');
});

it('sets aria-required when required', async () => {
  const el = (await fixture(html`<lr-checkbox required>Label</lr-checkbox>`)) as LyraCheckbox;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(base.getAttribute('aria-required')).to.equal('true');
});

it('hides the label part when the default slot has no real content', async () => {
  const el = (await fixture(html`<lr-checkbox></lr-checkbox>`)) as LyraCheckbox;
  const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
  expect(label.hidden).to.be.true;
});

it('shows the label part for plain slotted text (a text node, not an element)', async () => {
  const el = (await fixture(html`<lr-checkbox>Accept terms</lr-checkbox>`)) as LyraCheckbox;
  const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
  expect(label.hidden).to.be.false;
});

it('forwards a host aria-label onto the inner role="checkbox" element', async () => {
  const el = (await fixture(
    html`<lr-checkbox aria-label="Subscribe to updates"></lr-checkbox>`,
  )) as LyraCheckbox;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(base.getAttribute('aria-label')).to.equal('Subscribe to updates');
});

it('does not set an empty aria-label on the inner element when the host has none', async () => {
  const el = (await fixture(html`<lr-checkbox>Label</lr-checkbox>`)) as LyraCheckbox;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(base.hasAttribute('aria-label')).to.be.false;
});

it('preserves an explicitly empty host aria-label on the internal checkbox role', async () => {
  const el = (await fixture(html`<lr-checkbox aria-label="">Visible label</lr-checkbox>`)) as LyraCheckbox;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(base.hasAttribute('aria-label')).to.be.true;
  expect(base.getAttribute('aria-label')).to.equal('');
});

describe('aria-describedby forwarding', () => {
  it('resolves host description ids onto the inner role="checkbox" element', async () => {
    const el = (await fixture(html`
      <div>
        <span id="description">This option is unavailable during maintenance.</span>
        <lr-checkbox aria-describedby="description">Advanced mode</lr-checkbox>
      </div>
    `)) as HTMLElement;
    const checkbox = el.querySelector('lr-checkbox') as LyraCheckbox;
    const description = el.querySelector('#description')!;
    const base = checkbox.shadowRoot!.querySelector('[part~="base"]') as HTMLElement & {
      ariaDescribedByElements?: Element[];
    };
    if ('ariaDescribedByElements' in base) {
      expect(base.ariaDescribedByElements?.length).to.equal(1);
      expect(base.ariaDescribedByElements?.[0]).to.equal(description);
      expect(base.getAttribute('aria-describedby')).to.equal('');
    } else {
      expect(base.getAttribute('aria-describedby')).to.equal('description');
    }
  });

  it('updates forwarding when the host description attribute is added, changed, or removed', async () => {
    const wrapper = await fixture(html`
      <div>
        <span id="first-description">First description</span>
        <span id="second-description">Second description</span>
        <lr-checkbox>Advanced mode</lr-checkbox>
      </div>
    `);
    const checkbox = wrapper.querySelector('lr-checkbox') as LyraCheckbox;
    const first = wrapper.querySelector('#first-description')!;
    const second = wrapper.querySelector('#second-description')!;
    const base = checkbox.shadowRoot!.querySelector('[part~="base"]') as HTMLElement & {
      ariaDescribedByElements?: Element[];
    };
    expect(base.hasAttribute('aria-describedby')).to.be.false;

    checkbox.setAttribute('aria-describedby', 'first-description');
    await checkbox.updateComplete;
    if ('ariaDescribedByElements' in base) {
      expect(base.ariaDescribedByElements).to.deep.equal([first]);
    } else {
      expect(base.getAttribute('aria-describedby')).to.equal('first-description');
    }

    checkbox.setAttribute('aria-describedby', 'second-description');
    await checkbox.updateComplete;
    if ('ariaDescribedByElements' in base) {
      expect(base.ariaDescribedByElements).to.deep.equal([second]);
    } else {
      expect(base.getAttribute('aria-describedby')).to.equal('second-description');
    }

    checkbox.removeAttribute('aria-describedby');
    await checkbox.updateComplete;
    if ('ariaDescribedByElements' in base) {
      expect(base.ariaDescribedByElements ?? []).to.deep.equal([]);
    } else {
      expect(base.hasAttribute('aria-describedby')).to.be.false;
    }
  });
});

describe('indeterminate', () => {
  it('reflects aria-checked="mixed" regardless of the underlying checked value', async () => {
    const el = (await fixture(html`<lr-checkbox indeterminate>Label</lr-checkbox>`)) as LyraCheckbox;
    const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
    expect(base.getAttribute('aria-checked')).to.equal('mixed');

    el.checked = true;
    await el.updateComplete;
    expect(base.getAttribute('aria-checked'), 'indeterminate still wins over checked').to.equal('mixed');
  });

  it('does not itself affect the checked value', async () => {
    const el = (await fixture(html`<lr-checkbox indeterminate>Label</lr-checkbox>`)) as LyraCheckbox;
    expect(el.checked).to.be.false;
  });

  it('is cleared by a user toggle (click), matching native input semantics', async () => {
    const el = (await fixture(html`<lr-checkbox indeterminate>Label</lr-checkbox>`)) as LyraCheckbox;
    const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;

    setTimeout(() => base.click());
    await oneEvent(el, 'lr-change');
    expect(el.indeterminate).to.be.false;
    expect(el.checked).to.be.true;
  });

  it('is cleared by a user toggle (keyboard)', async () => {
    const el = (await fixture(html`<lr-checkbox indeterminate>Label</lr-checkbox>`)) as LyraCheckbox;
    const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;

    setTimeout(() =>
      base.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })),
    );
    await oneEvent(el, 'lr-change');
    expect(el.indeterminate).to.be.false;
  });

  it('is not cleared by a programmatic checked assignment', async () => {
    const el = (await fixture(html`<lr-checkbox indeterminate>Label</lr-checkbox>`)) as LyraCheckbox;
    el.checked = true;
    await el.updateComplete;
    expect(el.indeterminate).to.be.true;
  });
});

it('participates in a form: submits value under name only when checked', async () => {
  const form = (await fixture(html`
    <form><lr-checkbox name="notify" value="yes">Notify me</lr-checkbox></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-checkbox') as LyraCheckbox;

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
    <form><lr-checkbox name="notify" value="yes" required>Notify me</lr-checkbox></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-checkbox') as LyraCheckbox;

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
    <form><lr-checkbox name="notify" value="yes" checked>Notify me</lr-checkbox></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-checkbox') as LyraCheckbox;

  el.value = 'updated';
  expect(new FormData(form).get('notify')).to.equal('updated');
});

it('updates validity synchronously when required changes', async () => {
  const el = (await fixture(html`
    <lr-checkbox name="terms">Agree</lr-checkbox>
  `)) as LyraCheckbox;

  expect(el.checkValidity()).to.be.true;
  el.required = true;
  expect(el.checkValidity()).to.be.false;
  el.required = false;
  expect(el.checkValidity()).to.be.true;
});

it('submits under a programmatically assigned name in the same tick', async () => {
  const form = (await fixture(html`
    <form><lr-checkbox value="yes" checked>Notify me</lr-checkbox></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-checkbox') as LyraCheckbox;

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

it('reflects a click toggle in FormData synchronously, with no await', async () => {
  // Every other form test in this file awaits `updateComplete` (or an
  // `oneEvent`-mediated microtask) before reading `FormData` -- that never
  // exercises whether a *synchronous* reader (e.g. this component's own
  // `lr-change` listener, or a submit handler that reads FormData
  // immediately) sees current data right after the click that changed it.
  const form = (await fixture(html`
    <form><lr-checkbox name="notify" value="yes">Notify me</lr-checkbox></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-checkbox') as LyraCheckbox;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;

  base.click();
  expect(new FormData(form).get('notify')).to.equal('yes');

  base.click();
  expect(new FormData(form).get('notify')).to.equal(null);
});

it('reflects a keyboard toggle in FormData synchronously, with no await', async () => {
  const form = (await fixture(html`
    <form><lr-checkbox name="notify" value="yes">Notify me</lr-checkbox></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-checkbox') as LyraCheckbox;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;

  base.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
  expect(new FormData(form).get('notify')).to.equal('yes');
});

it('uses "on" as the default form value', async () => {
  const form = (await fixture(html`
    <form><lr-checkbox name="notify" checked>Notify me</lr-checkbox></form>
  `)) as HTMLFormElement;
  expect(new FormData(form).get('notify')).to.equal('on');
});

it('blocks a required, unchecked checkbox from submitting the form', async () => {
  const form = (await fixture(html`
    <form><lr-checkbox name="terms" required>Agree</lr-checkbox></form>
  `)) as HTMLFormElement;
  expect(form.reportValidity()).to.be.false;

  const el = form.querySelector('lr-checkbox') as LyraCheckbox;
  el.checked = true;
  await el.updateComplete;
  expect(form.reportValidity()).to.be.true;
});

it('focuses its inner control when direct or form submission validation fails', async () => {
  const form = (await fixture(html`
    <form>
      <button type="button" id="sentinel">Before</button>
      <lr-checkbox name="terms" required>Agree</lr-checkbox>
      <button type="submit">Submit</button>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-checkbox') as LyraCheckbox;
  const sentinel = form.querySelector('#sentinel') as HTMLButtonElement;

  sentinel.focus();
  expect(el.reportValidity()).to.be.false;
  expect(document.activeElement?.localName).to.equal('lr-checkbox');
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('base checkbox');

  let submits = 0;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submits += 1;
  });
  sentinel.focus();
  form.requestSubmit();
  expect(submits).to.equal(0);
  expect(document.activeElement?.localName).to.equal('lr-checkbox');
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('base checkbox');
});

it('does not force focus when the native invalid event is canceled', async () => {
  const form = (await fixture(html`
    <form>
      <button type="button" id="cancel-sentinel">Before</button>
      <lr-checkbox name="terms" required>Agree</lr-checkbox>
    </form>
  `)) as HTMLFormElement;
  const sentinel = form.querySelector('button') as HTMLButtonElement;
  const el = form.querySelector('lr-checkbox') as LyraCheckbox;
  el.addEventListener('invalid', (event) => event.preventDefault());

  sentinel.focus();
  expect(el.reportValidity()).to.be.false;
  expect(document.activeElement?.localName).to.equal('button');
  expect((document.activeElement as HTMLElement | null)?.id).to.equal('cancel-sentinel');
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal(undefined);
});

it('applies and removes explicit disabled form state synchronously', async () => {
  const form = (await fixture(html`
    <form>
      <lr-checkbox id="submitted" name="notify" value="yes" checked>Notify me</lr-checkbox>
      <lr-checkbox id="invalid" name="terms" required>Agree</lr-checkbox>
    </form>
  `)) as HTMLFormElement;
  const submitted = form.querySelector('#submitted') as LyraCheckbox;
  const invalid = form.querySelector('#invalid') as LyraCheckbox;

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
    <form><lr-checkbox name="notify" value="yes" checked required>Notify me</lr-checkbox></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-checkbox') as LyraCheckbox;
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
    <form><lr-checkbox name="notify">Notify me</lr-checkbox></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-checkbox') as LyraCheckbox;
  el.checked = true;
  await el.updateComplete;
  expect(new FormData(form).get('notify')).to.equal('on');

  form.reset();
  expect(el.checked).to.be.false;
  expect(new FormData(form).get('notify')).to.equal(null);
});

it('clears touched invalid styling on form.reset()', async () => {
  const form = (await fixture(html`
    <form><lr-checkbox name="terms" required>Agree</lr-checkbox></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-checkbox') as LyraCheckbox;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;

  base.dispatchEvent(new FocusEvent('blur'));
  await el.updateComplete;
  expect(el.hasAttribute('data-invalid')).to.be.true;
  expect(base.getAttribute('aria-invalid')).to.equal('true');

  form.reset();
  await el.updateComplete;
  expect(el.hasAttribute('data-invalid')).to.be.false;
  expect(base.getAttribute('aria-invalid')).to.equal('false');
});

it('does not turn a pre-connect checked property assignment into the reset default', async () => {
  const form = document.createElement('form');
  const el = document.createElement('lr-checkbox') as LyraCheckbox;
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
        <lr-checkbox name="notify" value="yes" checked>Notify me</lr-checkbox>
        <lr-checkbox name="always-disabled" value="yes" checked disabled>Always disabled</lr-checkbox>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-checkbox') as LyraCheckbox;
  const explicitlyDisabled = form.querySelector('[name="always-disabled"]') as LyraCheckbox;
  const fieldset = form.querySelector('fieldset') as HTMLFieldSetElement;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;

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

describe('validity styling', () => {
  it('does not reflect aria-invalid/data-invalid before the control has been touched', async () => {
    const el = (await fixture(html`<lr-checkbox required>Agree</lr-checkbox>`)) as LyraCheckbox;
    const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
    expect(base.getAttribute('aria-invalid')).to.equal('false');
    expect(el.hasAttribute('data-invalid')).to.be.false;
  });

  it('reflects aria-invalid and data-invalid once a required, unchecked control is blurred', async () => {
    const el = (await fixture(html`<lr-checkbox required>Agree</lr-checkbox>`)) as LyraCheckbox;
    const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;

    base.dispatchEvent(new FocusEvent('blur'));
    expect(el.hasAttribute('data-invalid'), 'data-invalid is synchronous').to.be.true;
    await el.updateComplete;
    expect(base.getAttribute('aria-invalid')).to.equal('true');

    el.checked = true;
    expect(el.hasAttribute('data-invalid')).to.be.false;
    await el.updateComplete;
    expect(base.getAttribute('aria-invalid')).to.equal('false');
  });

  it('never reflects aria-invalid/data-invalid on a non-required, touched control', async () => {
    const el = (await fixture(html`<lr-checkbox>Agree</lr-checkbox>`)) as LyraCheckbox;
    const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
    base.dispatchEvent(new FocusEvent('blur'));
    await el.updateComplete;
    expect(base.getAttribute('aria-invalid')).to.equal('false');
    expect(el.hasAttribute('data-invalid')).to.be.false;
  });
});

describe('validationMessage localization', () => {
  it('defaults to the built-in English validationMessage for a required, unchecked control', async () => {
    const el = (await fixture(html`<lr-checkbox required>Agree</lr-checkbox>`)) as LyraCheckbox;
    expect(el.validationMessage).to.equal('Please check this box if you want to continue.');
  });

  it('localizes the validationMessage via this.localize() when .strings overrides checkboxRequired', async () => {
    const el = (await fixture(html`
      <lr-checkbox required .strings=${{ checkboxRequired: 'Veuillez cocher cette case pour continuer.' }}
        >Agree</lr-checkbox
      >
    `)) as LyraCheckbox;
    expect(el.validationMessage).to.equal('Veuillez cocher cette case pour continuer.');

    el.checked = true;
    expect(el.validationMessage).to.equal('');
  });
});

it('un-hides the label part when a slotted element mutates its own text content in place', async () => {
  // `slotchange` only fires when the *set* of distributed nodes changes --
  // never for an already-slotted node mutating its own text in place -- so
  // this exercises the `labelObserver` MutationObserver fallback rather than
  // `onSlotChange`.
  const el = (await fixture(html`<lr-checkbox></lr-checkbox>`)) as LyraCheckbox;
  const assigned = el.ownerDocument.createTextNode(' ');
  el.append(assigned);
  await new Promise((resolve) => setTimeout(resolve, 0));
  await el.updateComplete;
  const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
  expect(label.hidden).to.be.true;

  assigned.data = 'Accept terms';
  // The MutationObserver callback runs in a separate microtask checkpoint;
  // give it (and the resulting re-render) a real turn of the event loop.
  await new Promise((resolve) => setTimeout(resolve, 0));
  await el.updateComplete;

  expect(label.hidden).to.be.false;
});

it('tracks visual label presence through a forwarding slot without exposing its fallback', async () => {
  const wrapper = (await fixture(html`<div></div>`)) as HTMLDivElement;
  const assigned = wrapper.ownerDocument.createTextNode(' ');
  wrapper.append(assigned);
  const root = wrapper.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <lr-checkbox aria-label="Explicit checkbox name">
      <slot><span>Unrendered fallback</span></slot>
    </lr-checkbox>
  `;
  const el = root.querySelector('lr-checkbox') as LyraCheckbox;
  await el.updateComplete;
  const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  const settle = async (): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await el.updateComplete;
  };

  await settle();
  expect(label.hidden, 'an empty assignment suppresses both itself and slot fallback').to.be.true;
  expect(base.getAttribute('aria-label')).to.equal('Explicit checkbox name');

  assigned.data = 'Forwarded checkbox label';
  await settle();
  expect(label.hidden).to.be.false;

  assigned.data = ' ';
  await settle();
  expect(label.hidden).to.be.true;

  const visual = wrapper.ownerDocument.createElement('span');
  visual.setAttribute('aria-label', 'Screen-reader override');
  assigned.replaceWith(visual);
  await settle();
  expect(label.hidden, 'an element-only visual such as an icon keeps the wrapper').to.be.false;

  visual.textContent = 'Decorative visual glyph';
  visual.setAttribute('aria-hidden', ' TRUE ');
  await settle();
  expect(label.hidden, 'aria-hidden content can still be intentionally visual').to.be.false;

  visual.removeAttribute('aria-hidden');
  visual.style.display = 'none';
  await settle();
  expect(label.hidden, 'real assigned elements retain visual slot presence').to.be.false;

  visual.style.removeProperty('display');
  visual.hidden = true;
  await settle();
  expect(label.hidden).to.be.false;

  visual.hidden = false;
  await settle();
  expect(label.hidden).to.be.false;
  expect(base.getAttribute('aria-label'), 'consumer host naming remains authoritative').to.equal(
    'Explicit checkbox name',
  );
});

it('constructs its label observer in the adopted owner realm', async () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const frameWindow = frame.contentWindow!;
  const frameDocument = frame.contentDocument!;
  const observerDescriptor = Object.getOwnPropertyDescriptor(frameWindow, 'MutationObserver');
  const NativeMutationObserver = frameWindow.MutationObserver;
  let constructions = 0;
  let adoptedTarget: LyraCheckbox | undefined;
  let labelHostObservations = 0;
  class TrackingMutationObserver extends NativeMutationObserver {
    constructor(callback: MutationCallback) {
      super(callback);
      constructions += 1;
    }
    override observe(target: Node, options?: MutationObserverInit): void {
      if (
        target === adoptedTarget &&
        options?.childList &&
        options.characterData &&
        options.subtree
      ) labelHostObservations += 1;
      super.observe(target, options);
    }
  }
  Object.defineProperty(frameWindow, 'MutationObserver', {
    configurable: true,
    value: TrackingMutationObserver,
  });
  const el = (await fixture(html`<lr-checkbox><span>Parent label</span></lr-checkbox>`)) as LyraCheckbox;
  adoptedTarget = el;
  el.remove();
  try {
    frameDocument.body.append(frameDocument.adoptNode(el));
    await el.updateComplete;
    expect(
      constructions,
      'the base observer and label observer both use the adopted realm',
    ).to.be.greaterThan(1);
    expect(labelHostObservations, 'the adopted-realm label observer binds the checkbox host').to.be.greaterThan(0);
    expect(
      (el.shadowRoot!.querySelector('[part="label"]') as HTMLElement).hidden,
    ).to.be.false;
  } finally {
    el.remove();
    if (observerDescriptor) {
      Object.defineProperty(frameWindow, 'MutationObserver', observerDescriptor);
    } else {
      delete (frameWindow as Window & { MutationObserver?: typeof MutationObserver }).MutationObserver;
    }
    frame.remove();
  }
});

it('does not emit native or prefixed value events for a programmatic .checked assignment', async () => {
  const el = (await fixture(html`<lr-checkbox>Label</lr-checkbox>`)) as LyraCheckbox;
  const fired: string[] = [];
  for (const name of ['input', 'lr-input', 'change', 'lr-change']) {
    el.addEventListener(name, () => fired.push(name));
  }
  el.checked = true;
  await el.updateComplete;
  expect(fired).to.deep.equal([]);
});

it('forwards focus/blur and relays exactly one native pair plus prefixed aliases', async () => {
  const el = (await fixture(html`<lr-checkbox>Label</lr-checkbox>`)) as LyraCheckbox;
  const nativeEvents: FocusEvent[] = [];
  const aliases: string[] = [];
  el.addEventListener('focus', (event) => nativeEvents.push(event as FocusEvent));
  el.addEventListener('blur', (event) => nativeEvents.push(event as FocusEvent));
  el.addEventListener('lr-focus', () => aliases.push('lr-focus'));
  el.addEventListener('lr-blur', () => aliases.push('lr-blur'));

  el.focus();
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('base checkbox');
  el.blur();
  expect(el.shadowRoot!.activeElement).to.equal(null);
  expect(nativeEvents.map((event) => event.type)).to.deep.equal(['focus', 'blur']);
  expect(nativeEvents.every((event) => event instanceof FocusEvent)).to.be.true;
  expect(nativeEvents.every((event) => event.target === el && event.bubbles && event.composed)).to.be.true;
  expect(aliases).to.deep.equal(['lr-focus', 'lr-blur']);
});

it('forwards host click() to the internal control, toggling checked', async () => {
  const el = (await fixture(html`<lr-checkbox>Label</lr-checkbox>`)) as LyraCheckbox;
  expect(el.checked).to.be.false;

  const event = oneEvent(el, 'lr-change');
  el.click();
  const result = await event;
  expect(result.detail.checked).to.be.true;
  expect(el.checked).to.be.true;
});

it('does not toggle on host click() while disabled', async () => {
  const el = (await fixture(html`<lr-checkbox disabled>Label</lr-checkbox>`)) as LyraCheckbox;
  el.click();
  expect(el.checked).to.be.false;
});

describe('ElementInternals availability', () => {
  it('does not throw when constructed in an environment without a real ElementInternals implementation (e.g. a downstream Vitest + happy-dom suite)', () => {
    const original = HTMLElement.prototype.attachInternals;
    // @ts-expect-error -- simulating an environment that lacks ElementInternals entirely
    delete HTMLElement.prototype.attachInternals;
    try {
      let el: LyraCheckbox | undefined;
      expect(() => {
        el = document.createElement('lr-checkbox') as LyraCheckbox;
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
  // Monkey-patch LyraElement.prototype.willUpdate (the established pattern, e.g. stat.test.ts) to
  // prove LyraCheckbox's own willUpdate() override actually calls super.willUpdate(...) rather
  // than shadowing it silently.
  const proto = LyraElement.prototype as unknown as { willUpdate: (changed: PropertyValues) => void };
  const original = proto.willUpdate;
  let called = false;
  proto.willUpdate = function (this: LyraElement, changed: PropertyValues): void {
    called = true;
    original.call(this, changed);
  };
  try {
    const el = (await fixture(html`<lr-checkbox>Label</lr-checkbox>`)) as LyraCheckbox;
    await el.updateComplete;
    expect(called).to.be.true;
  } finally {
    proto.willUpdate = original;
  }
});

describe('checked-state cssprop escape hatch', () => {
  // Same probe idiom as lr-source-picker's identical checked-state cssprop test: resolve a raw
  // declaration inside the same shadow root so the comparison format (rgb(...)) always matches
  // getComputedStyle's, rather than comparing a raw custom-property string against it.
  function resolvedInShadow(el: LyraCheckbox, declaration: string, property: string): string {
    const probe = document.createElement('span');
    probe.setAttribute('style', declaration);
    el.shadowRoot!.appendChild(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  }

  it('renders byte-identical to --lr-color-brand when --lr-checkbox-checked-bg/-border are unset', async () => {
    const el = (await fixture(html`<lr-checkbox checked>Label</lr-checkbox>`)) as LyraCheckbox;
    const box = el.shadowRoot!.querySelector('[part~="box"]') as HTMLElement;
    expect(getComputedStyle(box).backgroundColor).to.equal(
      resolvedInShadow(el, 'background: var(--lr-color-brand)', 'background-color'),
    );
    expect(getComputedStyle(box).borderTopColor).to.equal(
      resolvedInShadow(el, 'border-color: var(--lr-color-brand)', 'border-top-color'),
    );
  });

  it('retints just the checked/indeterminate fill through --lr-checkbox-checked-bg/-border instead of the shared --lr-color-brand token', async () => {
    const el = (await fixture(
      html`<lr-checkbox checked style="--lr-checkbox-checked-bg: rgb(1, 2, 3); --lr-checkbox-checked-border: rgb(4, 5, 6);"></lr-checkbox>`,
    )) as LyraCheckbox;
    const box = el.shadowRoot!.querySelector('[part~="box"]') as HTMLElement;
    expect(getComputedStyle(box).backgroundColor).to.equal('rgb(1, 2, 3)');
    expect(getComputedStyle(box).borderTopColor).to.equal('rgb(4, 5, 6)');
  });
});

it('is accessible in the default (unchecked, unlabeled) state', async () => {
  const el = (await fixture(html`<lr-checkbox aria-label="Subscribe to updates"></lr-checkbox>`)) as LyraCheckbox;
  await expect(el).to.be.accessible();
});

it('is accessible in a checked, labeled, required state', async () => {
  const el = (await fixture(
    html`<lr-checkbox checked required>Subscribe to updates</lr-checkbox>`,
  )) as LyraCheckbox;
  await expect(el).to.be.accessible();
});

it('is accessible in an indeterminate, labeled state', async () => {
  const el = (await fixture(html`<lr-checkbox indeterminate>Select all</lr-checkbox>`)) as LyraCheckbox;
  await expect(el).to.be.accessible();
});

it('publishes --lr-checkbox-label-indent and drives the real label offset from it', async () => {
  const el = (await fixture(html`<lr-checkbox value="a">A</lr-checkbox>`)) as LyraCheckbox;
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;

  // Published, so a consumer aligning their own per-option hint text under the label no longer has
  // to re-derive `min(--lr-icon-button-size, 1.75rem) + --lr-space-s` by reading the shadow styles.
  expect(getComputedStyle(el).getPropertyValue('--lr-checkbox-label-indent').trim()).to.not.equal('');

  // 1.75rem box + 0.5rem gap === 2.25rem === 36px.
  expect(label.getBoundingClientRect().left - base.getBoundingClientRect().left).to.be.closeTo(36, 0.5);

  // The published value and the rendered geometry cannot drift: retuning it moves the label.
  el.style.setProperty('--lr-checkbox-label-indent', '4rem');
  expect(label.getBoundingClientRect().left - base.getBoundingClientRect().left).to.be.closeTo(64, 0.5);
});

it('exposes checkValidity()/reportValidity() through ElementInternals', async () => {
  const el = (await fixture(html`<lr-checkbox required>Label</lr-checkbox>`)) as LyraCheckbox;
  await el.updateComplete;
  expect(el.checkValidity(), 'required and unchecked is invalid').to.be.false;
  expect(el.reportValidity()).to.be.false;
  el.checked = true;
  await el.updateComplete;
  expect(el.checkValidity()).to.be.true;
  expect(el.reportValidity()).to.be.true;
});


// -- Degraded-DOM form-association fallback ---------------------------------

describe('ElementInternals fallback (lr-checkbox)', () => {
  /** Mirrors a DOM implementation without form-association support (a consumer's happy-dom/Vitest
   *  suite). `attachInternals()` is browser-only, so the component swaps in inert no-op internals
   *  rather than throwing at construction -- every member has to answer, and value changes must
   *  still work with form participation simply unavailable. */
  const withoutAttachInternals = async (
    impl: undefined | (() => never),
    assertion: (el: LyraCheckbox) => void | Promise<void>,
  ): Promise<void> => {
    const proto = HTMLElement.prototype as unknown as { attachInternals?: unknown };
    const original = proto.attachInternals;
    if (impl === undefined) delete proto.attachInternals;
    else proto.attachInternals = impl;
    try {
      const el = (await fixture(html`<lr-checkbox>Label</lr-checkbox>`)) as LyraCheckbox;
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
  async function boxOf(markup: unknown): Promise<DOMRect> {
    const el = (await fixture(markup as never)) as LyraCheckbox;
    await el.updateComplete;
    const box = el.shadowRoot!.querySelector('[part~="box"]') as HTMLElement;
    return box.getBoundingClientRect();
  }

  it('defaults to the "m" tier and reflects it', async () => {
    const el = (await fixture(html`<lr-checkbox>Label</lr-checkbox>`)) as LyraCheckbox;
    await el.updateComplete;
    expect(el.size).to.equal('m');
    expect(el.getAttribute('size')).to.equal('m');
  });

  it('grows the rendered box from size="s" to size="l"', async () => {
    const small = await boxOf(html`<lr-checkbox size="s">Label</lr-checkbox>`);
    const large = await boxOf(html`<lr-checkbox size="l">Label</lr-checkbox>`);
    expect(large.width).to.be.greaterThan(small.width);
    expect(large.height).to.be.greaterThan(small.height);
  });

  it('renders "small"/"large" at the same geometry as "s"/"l"', async () => {
    const s = await boxOf(html`<lr-checkbox size="s">Label</lr-checkbox>`);
    const small = await boxOf(html`<lr-checkbox size="small">Label</lr-checkbox>`);
    const l = await boxOf(html`<lr-checkbox size="l">Label</lr-checkbox>`);
    const large = await boxOf(html`<lr-checkbox size="large">Label</lr-checkbox>`);
    expect(small.width).to.be.closeTo(s.width, 0.5);
    expect(large.width).to.be.closeTo(l.width, 0.5);
  });

  it('keeps the rendered label indent in step with the box at every tier', async () => {
    // The published --lr-checkbox-label-indent promises "box floor + gap"; measure that the label
    // really starts there rather than trusting the declaration, and that the promise survives every
    // tier now that the box is no longer a constant.
    let previous = 0;
    for (const size of ['2xs', 'xs', 's', 'm', 'l', 'xl'] as const) {
      const el = (await fixture(html`<lr-checkbox size=${size}>Label</lr-checkbox>`)) as LyraCheckbox;
      await el.updateComplete;
      const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
      const box = el.shadowRoot!.querySelector('[part~="box"]') as HTMLElement;
      const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
      const gap = Number.parseFloat(getComputedStyle(base).columnGap);
      const boxWidth = box.getBoundingClientRect().width;
      const measured = label.getBoundingClientRect().left - base.getBoundingClientRect().left;
      expect(measured, `${size} indent`).to.be.closeTo(boxWidth + gap, 0.5);
      expect(boxWidth, `${size} box grows with the tier`).to.be.greaterThan(previous);
      previous = boxWidth;
    }
  });

  it('is accessible at a non-default tier', async () => {
    const el = (await fixture(html`<lr-checkbox size="l">Label</lr-checkbox>`)) as LyraCheckbox;
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

describe('lr-checkbox validity custom states', () => {
  it('publishes required/optional and valid/invalid from the first render', async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(html`<lr-checkbox required>Terms</lr-checkbox>`)) as LyraCheckbox;
    await el.updateComplete;
    expect(el.matches(':state(required)'), 'required').to.be.true;
    expect(el.matches(':state(optional)'), 'optional').to.be.false;
    expect(el.matches(':state(invalid)'), 'invalid').to.be.true;
    expect(el.matches(':state(valid)'), 'valid').to.be.false;

    const optional = (await fixture(html`<lr-checkbox>Terms</lr-checkbox>`)) as LyraCheckbox;
    await optional.updateComplete;
    expect(optional.matches(':state(optional)')).to.be.true;
    expect(optional.matches(':state(required)')).to.be.false;
    expect(optional.matches(':state(valid)')).to.be.true;
  });

  it('withholds user-valid/user-invalid until the user has actually interacted', async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(html`<lr-checkbox required>Terms</lr-checkbox>`)) as LyraCheckbox;
    await el.updateComplete;
    expect(el.matches(':state(invalid)')).to.be.true;
    expect(el.matches(':state(user-invalid)'), 'pristine required must not read as an error').to.be
      .false;
    expect(el.matches(':state(user-valid)')).to.be.false;

    el.click();
    await el.updateComplete;
    expect(el.checked).to.be.true;
    expect(el.matches(':state(valid)')).to.be.true;
    expect(el.matches(':state(user-valid)'), 'user-valid after a real toggle').to.be.true;
    expect(el.matches(':state(user-invalid)')).to.be.false;
  });

  it('counts a reportValidity() call -- what a submit attempt runs -- as interaction', async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(html`<lr-checkbox required>Terms</lr-checkbox>`)) as LyraCheckbox;
    await el.updateComplete;
    expect(el.matches(':state(user-invalid)')).to.be.false;
    el.reportValidity();
    expect(el.matches(':state(user-invalid)')).to.be.true;
  });

  it('goes pristine again after a form reset', async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const form = await fixture<HTMLFormElement>(
      html`<form><lr-checkbox name="terms" required>Terms</lr-checkbox></form>`,
    );
    const el = form.querySelector('lr-checkbox') as LyraCheckbox;
    await el.updateComplete;
    el.reportValidity();
    expect(el.matches(':state(user-invalid)')).to.be.true;
    form.reset();
    await el.updateComplete;
    expect(el.matches(':state(user-invalid)'), 'reset returns the control to pristine').to.be.false;
    expect(el.matches(':state(invalid)'), 'still intrinsically invalid, just not user-invalid').to.be
      .true;
  });
});

describe('lr-checkbox hover and press feedback', () => {
  const centerOf = (node: Element): [number, number] => {
    const rect = node.getBoundingClientRect();
    return [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)];
  };

  it('rings the box while pressed, on top of the hover border it already carries', async () => {
    // The box's fill IS the state readout (surface unchecked, brand checked), so the pressed
    // treatment is a ring rather than a tint -- asserted on the rendered box, since a stylesheet
    // match cannot tell a ring that paints from one behind a selector that never matches.
    const el = (await fixture(
      html`<lr-checkbox style="--lr-transition-fast: 0s">Terms</lr-checkbox>`,
    )) as LyraCheckbox;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
    const box = el.shadowRoot!.querySelector('[part~="box"]') as HTMLElement;
    const restingBorder = getComputedStyle(box).borderTopColor;
    expect(getComputedStyle(box).boxShadow, 'no ring at rest').to.equal('none');
    try {
      await sendMouse({ type: 'move', position: centerOf(base) });
      expect(getComputedStyle(box).borderTopColor, 'hover moves the border').to.not.equal(restingBorder);
      expect(getComputedStyle(box).boxShadow, 'hover alone must not ring').to.equal('none');
      await sendMouse({ type: 'down' });
      expect(getComputedStyle(box).boxShadow, 'pressed rings the box').to.not.equal('none');
    } finally {
      await sendMouse({ type: 'up' });
      await resetMouse();
    }
  });
});

describe('lr-checkbox setCustomValidity()', () => {
  it('blocks form submission and becomes the validationMessage', async () => {
    const form = (await fixture(html`
      <form><lr-checkbox name="terms" value="yes" checked>Agree</lr-checkbox></form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-checkbox') as LyraCheckbox;
    let submits = 0;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submits += 1;
    });

    form.requestSubmit();
    expect(submits, 'an otherwise-valid checkbox submits').to.equal(1);

    el.setCustomValidity('That box is spoken for');
    expect(el.validationMessage).to.equal('That box is spoken for');
    expect(el.validity.customError, 'customError').to.be.true;
    expect(el.checkValidity()).to.be.false;

    form.requestSubmit();
    expect(submits, 'a custom error blocks submission').to.equal(1);
  });

  it('survives an intrinsic revalidation', async () => {
    const el = (await fixture(html`<lr-checkbox required>Agree</lr-checkbox>`)) as LyraCheckbox;
    el.setCustomValidity('Server says no');
    el.checked = true; // clears valueMissing and re-runs the intrinsic recompute
    expect(el.validity.valueMissing, 'valueMissing cleared').to.be.false;
    expect(el.validity.customError, 'custom error survives the recompute').to.be.true;
    expect(el.validationMessage).to.equal('Server says no');
  });

  // Native `setCustomValidity()` is sticky: `form.reset()` restores values, never the custom
  // error, which only another `setCustomValidity('')` clears. Matching that here.
  it('keeps the custom error across a form reset', async () => {
    const form = (await fixture(html`
      <form><lr-checkbox name="terms">Agree</lr-checkbox></form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-checkbox') as LyraCheckbox;
    el.setCustomValidity('Server says no');
    form.reset();
    await el.updateComplete;
    expect(el.validity.customError).to.be.true;
    expect(el.validationMessage).to.equal('Server says no');
  });

  it('resetValidity() restores computed validity rather than forcing the control valid', async () => {
    const el = (await fixture(html`<lr-checkbox required>Agree</lr-checkbox>`)) as LyraCheckbox;
    el.setCustomValidity('Server says no');
    el.resetValidity();
    expect(el.validity.customError, 'custom error cleared').to.be.false;
    expect(
      el.validity.valueMissing,
      'an empty custom error must not force a still-empty required control valid',
    ).to.be.true;
    expect(el.checkValidity()).to.be.false;
    expect(el.validationMessage).to.not.equal('');
    el.checked = true;
    expect(el.checkValidity()).to.be.true;
  });

  it('drives the valid/invalid custom states', async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(html`<lr-checkbox>Agree</lr-checkbox>`)) as LyraCheckbox;
    await el.updateComplete;
    expect(el.matches(':state(valid)'), 'valid before').to.be.true;
    el.setCustomValidity('Server says no');
    expect(el.matches(':state(invalid)'), 'invalid while a custom error is set').to.be.true;
    expect(el.matches(':state(valid)')).to.be.false;
    el.setCustomValidity('');
    expect(el.matches(':state(valid)'), 'valid again once cleared').to.be.true;
  });
});

it('shows the hint region when hint content arrives only through the slot', async () => {
  const el = (await fixture(html`
    <lr-checkbox>Subscribe<span slot="hint">We never share it</span></lr-checkbox>
  `)) as LyraCheckbox;
  await el.updateComplete;
  const hint = el.shadowRoot!.querySelector('[part~="hint"]') as HTMLElement;
  expect(hint.hasAttribute('hidden')).to.equal(false);

  el.querySelector('[slot="hint"]')!.remove();
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await el.updateComplete;
  expect(hint.hasAttribute('hidden')).to.equal(true);
});

it('bars constraint validation while disabled, like a native disabled required control', async () => {
  const el = (await fixture(html`<lr-checkbox required disabled>Accept</lr-checkbox>`)) as LyraCheckbox;
  await el.updateComplete;
  expect(el.validity.valueMissing, 'a barred control raises no violation').to.be.false;
  expect(el.checkValidity()).to.be.true;

  el.disabled = false;
  await el.updateComplete;
  expect(el.validity.valueMissing, 'the violation returns once it is enforceable again').to.be.true;
});

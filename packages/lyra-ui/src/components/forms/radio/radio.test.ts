import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './radio.js';
import './radio-group.js';
import type { LyraRadio } from './radio.js';
import type { LyraRadioGroup } from './radio-group.js';

it('renders radio semantics and explicit false states', async () => {
  const el = (await fixture(html`<lr-radio>One</lr-radio>`)) as LyraRadio;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('role')).to.equal('radio');
  expect(base.getAttribute('aria-checked')).to.equal('false');
  expect(base.getAttribute('aria-disabled')).to.equal('false');
  expect(base.getAttribute('aria-required')).to.equal('false');
  await expect(el).to.be.accessible();
});

it('selects and emits native-style events', async () => {
  const el = (await fixture(html`<lr-radio value="a">A</lr-radio>`)) as LyraRadio;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const events: string[] = [];
  for (const name of ['input', 'change', 'lr-change']) el.addEventListener(name, () => events.push(name));
  base.click();
  expect(el.checked).to.be.true;
  expect(events).to.deep.equal(['input', 'change', 'lr-change']);
});

it('reflects non-empty and empty name/value property writes without collapsing through an empty attribute', async () => {
  const el = (await fixture(html`<lr-radio>One</lr-radio>`)) as LyraRadio;

  el.name = 'choice';
  el.value = 'alpha';
  expect(el.name).to.equal('choice');
  expect(el.getAttribute('name')).to.equal('choice');
  expect(el.value).to.equal('alpha');
  expect(el.getAttribute('value')).to.equal('alpha');

  el.name = '';
  el.value = '';
  await el.updateComplete;
  expect(el.name).to.equal('');
  expect(el.hasAttribute('name')).to.be.false;
  expect(el.value).to.equal('');
  expect(el.getAttribute('value')).to.equal('');
});

it('canonicalizes a declarative empty name attribute to omission', async () => {
  const el = (await fixture(html`<lr-radio name="">One</lr-radio>`)) as LyraRadio;
  await el.updateComplete;

  expect(el.name).to.equal('');
  expect(el.hasAttribute('name')).to.be.false;

  el.setAttribute('name', '');
  await el.updateComplete;
  expect(el.name).to.equal('');
  expect(el.hasAttribute('name')).to.be.false;
});

it('re-emits internal focus and blur as bubbling, composed host events', async () => {
  const el = (await fixture(html`<lr-radio>One</lr-radio>`)) as LyraRadio;
  const events: CustomEvent[] = [];
  el.addEventListener('focus', (event) => {
    if (event instanceof CustomEvent) events.push(event);
  });
  el.addEventListener('blur', (event) => {
    if (event instanceof CustomEvent) events.push(event);
  });

  el.focus();
  el.blur();

  expect(events.map((event) => event.type)).to.deep.equal(['focus', 'blur']);
  expect(events.every((event) => event.target === el)).to.be.true;
  expect(events.every((event) => event.bubbles && event.composed)).to.be.true;
});

it('forwards a host-level click() to the internal base control, like lr-button', async () => {
  // A generic form-submit helper, test utility, or automation script that calls
  // `.click()` on the host element (rather than clicking rendered pixels inside
  // its shadow DOM) must still toggle selection.
  const el = (await fixture(html`<lr-radio value="a">A</lr-radio>`)) as LyraRadio;
  await el.updateComplete;

  el.click();

  expect(el.checked).to.be.true;
});

it('moves selection and DOM focus when arrow navigation is used', async () => {
  const group = (await fixture(html`
    <lr-radio-group label="Choice">
      <lr-radio value="a">A</lr-radio>
      <lr-radio value="b">B</lr-radio>
    </lr-radio-group>
  `)) as LyraRadioGroup;
  const radios = [...group.querySelectorAll('lr-radio')] as LyraRadio[];
  const firstBase = radios[0].shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const secondBase = radios[1].shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  radios[0].checked = true;
  firstBase.focus();
  const eventPromise = oneEvent(group, 'lr-change');
  firstBase.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true, cancelable: true }));
  const event = await eventPromise;
  expect(event.detail.value).to.equal('b');
  expect(radios[1].checked).to.be.true;
  expect(radios[1].shadowRoot!.activeElement === secondBase).to.be.true;
  await expect(group).to.be.accessible();
});

it('swaps ArrowLeft/ArrowRight under dir="rtl" so "forward" follows reading direction', async () => {
  const group = (await fixture(html`
    <lr-radio-group label="Choice" dir="rtl">
      <lr-radio value="a">A</lr-radio>
      <lr-radio value="b">B</lr-radio>
    </lr-radio-group>
  `)) as LyraRadioGroup;
  const radios = [...group.querySelectorAll('lr-radio')] as LyraRadio[];
  const firstBase = radios[0].shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const secondBase = radios[1].shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  radios[0].checked = true;
  firstBase.focus();

  // ArrowLeft is "forward" under RTL -- the mirror image of ArrowRight's LTR meaning
  // exercised above.
  const forwardEvent = oneEvent(group, 'lr-change');
  firstBase.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, composed: true, cancelable: true }),
  );
  expect((await forwardEvent).detail.value).to.equal('b');
  expect(radios[1].checked).to.be.true;
  expect(radios[1].shadowRoot!.activeElement === secondBase).to.be.true;

  // ArrowRight is "backward" under RTL, so it should return selection/focus to the first radio.
  const backwardEvent = oneEvent(group, 'lr-change');
  secondBase.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true, cancelable: true }),
  );
  expect((await backwardEvent).detail.value).to.equal('a');
  expect(radios[0].checked).to.be.true;
  expect(radios[0].shadowRoot!.activeElement === firstBase).to.be.true;
});

it('uses roving tabindex: only the checked (or first enabled) radio is a Tab stop', async () => {
  const group = (await fixture(html`
    <lr-radio-group label="Choice">
      <lr-radio value="a">A</lr-radio>
      <lr-radio value="b">B</lr-radio>
    </lr-radio-group>
  `)) as LyraRadioGroup;
  await group.updateComplete;
  const radios = [...group.querySelectorAll('lr-radio')] as LyraRadio[];
  const base = (r: LyraRadio) => r.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base(radios[0]).tabIndex).to.equal(0);
  expect(base(radios[1]).tabIndex).to.equal(-1);

  base(radios[1]).click();
  await group.updateComplete;
  expect(base(radios[0]).tabIndex).to.equal(-1);
  expect(base(radios[1]).tabIndex).to.equal(0);
});

it('exposes an accessible name for the radiogroup from its visible label', async () => {
  const group = (await fixture(html`
    <lr-radio-group label="Choice">
      <lr-radio value="a">A</lr-radio>
    </lr-radio-group>
  `)) as LyraRadioGroup;
  const base = group.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const labelId = base.getAttribute('aria-labelledby');
  expect(labelId).to.be.ok;
  expect(group.shadowRoot!.getElementById(labelId!)?.textContent).to.contain('Choice');
});

it('restores the declarative default-checked state on form reset', async () => {
  const form = (await fixture(html`
    <form>
      <lr-radio name="choice" value="a" checked>A</lr-radio>
      <lr-radio name="choice" value="b">B</lr-radio>
    </form>
  `)) as HTMLFormElement;
  const [a, b] = [...form.querySelectorAll('lr-radio')] as LyraRadio[];
  expect(a.checked).to.be.true;

  b.checked = true;
  a.checked = false;
  expect(a.checked).to.be.false;
  expect(b.checked).to.be.true;

  form.reset();
  expect(a.checked, 'a restores its declarative checked default').to.be.true;
  expect(b.checked, 'b restores its (unchecked) declarative default').to.be.false;
});

it('exposes native form validity/focus APIs and restores serialized checked state', async () => {
  const form = (await fixture(html`
    <form><lr-radio name="choice" value="a" required>A</lr-radio></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-radio') as LyraRadio;

  expect(el.form).to.equal(form);
  expect(el.validity.valueMissing).to.be.true;
  expect(el.validationMessage).to.equal('Please select an option.');
  expect(el.willValidate).to.be.true;

  el.formStateRestoreCallback('checked', 'restore');
  await el.updateComplete;
  expect(el.checked).to.be.true;
  expect(el.validity.valid).to.be.true;
  expect(new FormData(form).get('choice')).to.equal('a');

  el.focus({ preventScroll: true });
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('base');
  el.blur();
  expect(el.shadowRoot!.activeElement).to.equal(null);

  el.formStateRestoreCallback('unchecked', 'autocomplete');
  expect(el.checked).to.be.false;
});

it('temporarily disables a bare radio through an ancestor fieldset without overwriting the author disabled state', async () => {
  const form = (await fixture(html`
    <form>
      <fieldset>
        <lr-radio value="a">A</lr-radio>
        <lr-radio value="b" disabled>B</lr-radio>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const [a, b] = [...form.querySelectorAll('lr-radio')] as LyraRadio[];
  const fieldset = form.querySelector('fieldset') as HTMLFieldSetElement;

  expect(a.effectiveDisabled).to.be.false;
  expect(b.disabled).to.be.true;

  // No `await` before these assertions: `formDisabledCallback` fires
  // synchronously when the fieldset's `disabled` property is set.
  fieldset.disabled = true;
  expect(a.effectiveDisabled, 'an ancestor fieldset must reach a bare lr-radio').to.be.true;
  expect(a.disabled, 'fieldset state must never mutate the public disabled property').to.be.false;
  expect(a.hasAttribute('disabled'), 'the host attribute must not be mutated either').to.be.false;
  expect(b.disabled, 'an already-explicitly-disabled radio is unaffected').to.be.true;
  expect(b.effectiveDisabled).to.be.true;

  fieldset.disabled = false;
  expect(a.effectiveDisabled, 'must not be permanently stuck disabled once the fieldset re-enables').to.be.false;
  expect(a.disabled).to.be.false;
  expect(b.disabled, 'an explicit disabled state survives the fieldset cycle').to.be.true;
  expect(b.effectiveDisabled).to.be.true;

  await Promise.all([a.updateComplete, b.updateComplete]);
  const aBase = a.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(aBase.getAttribute('aria-disabled')).to.equal('false');
  expect(aBase.getAttribute('tabindex')).to.equal('0');
});

it('dims the base part via the :disabled pseudo-class when disabled only through an ancestor fieldset', async () => {
  // effectiveDisabled correctly gates the internal control's functional
  // disabling even when disabled purely by fieldset cascading (see the test
  // above), but that alone doesn't prove the *visual* treatment follows --
  // the base part's opacity/cursor styling is keyed off a CSS selector
  // (:host(:disabled)), not effectiveDisabled, so it needs its own
  // assertion. Mirrors lr-checkbox's identical fieldset/computed-style
  // coverage.
  const form = (await fixture(html`
    <form>
      <fieldset disabled>
        <lr-radio value="a">A</lr-radio>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-radio') as LyraRadio;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  expect(el.disabled).to.be.false;
  expect(el.effectiveDisabled).to.be.true;
  expect(getComputedStyle(base).opacity).to.equal('0.5');
  expect(getComputedStyle(base).cursor).to.equal('not-allowed');
});

it('cascades fieldset-disabled state down to radios nested inside a lr-radio-group', async () => {
  const form = (await fixture(html`
    <form>
      <fieldset>
        <lr-radio-group label="Choice">
          <lr-radio value="a">A</lr-radio>
          <lr-radio value="b">B</lr-radio>
        </lr-radio-group>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const group = form.querySelector('lr-radio-group') as LyraRadioGroup;
  const [a, b] = [...group.querySelectorAll('lr-radio')] as LyraRadio[];
  const fieldset = form.querySelector('fieldset') as HTMLFieldSetElement;
  await group.updateComplete;

  expect(a.effectiveDisabled).to.be.false;
  expect(b.effectiveDisabled).to.be.false;

  fieldset.disabled = true;
  expect(a.effectiveDisabled, 'fieldset state must reach radios nested inside a radio-group').to.be.true;
  expect(b.effectiveDisabled).to.be.true;
  expect(a.disabled, 'fieldset state must never mutate the public disabled property').to.be.false;

  fieldset.disabled = false;
  expect(a.effectiveDisabled).to.be.false;
  expect(b.effectiveDisabled).to.be.false;
});

it('wires hint/error text to aria-describedby on the radiogroup', async () => {
  const group = (await fixture(html`
    <lr-radio-group label="Choice">
      <lr-radio value="a">A</lr-radio>
    </lr-radio-group>
  `)) as LyraRadioGroup;
  const base = group.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.hasAttribute('aria-describedby')).to.be.false;

  group.hint = 'Pick one';
  await group.updateComplete;
  const hintId = group.shadowRoot!.querySelector('[part="hint"]')!.id;
  expect(hintId).to.be.ok;
  expect(base.getAttribute('aria-describedby')).to.equal(hintId);

  group.errorText = 'Selection required';
  await group.updateComplete;
  const errorId = group.shadowRoot!.querySelector('[part="error"]')!.id;
  expect(errorId).to.be.ok;
  expect(base.getAttribute('aria-describedby')).to.equal(`${hintId} ${errorId}`);
});

it('renders a required-asterisk on the radiogroup label', async () => {
  const group = (await fixture(html`
    <lr-radio-group label="Choice" required>
      <lr-radio value="a">A</lr-radio>
    </lr-radio-group>
  `)) as LyraRadioGroup;
  const label = group.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
  const after = getComputedStyle(label, '::after');
  expect(after.content).to.contain('*');
});

it('treats required as a group constraint that becomes valid when any owned radio is selected', async () => {
  const form = (await fixture(html`
    <form>
      <lr-radio-group name="choice" label="Choice" required>
        <lr-radio value="a">A</lr-radio>
        <lr-radio value="b">B</lr-radio>
      </lr-radio-group>
    </form>
  `)) as HTMLFormElement;
  const group = form.querySelector('lr-radio-group') as LyraRadioGroup;
  const radios = [...group.querySelectorAll('lr-radio')] as LyraRadio[];
  const base = group.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  expect(base.getAttribute('aria-required')).to.equal('true');
  expect(form.checkValidity(), 'an empty required group is invalid').to.be.false;

  radios[1].click();
  expect(radios[1].checked).to.be.true;
  expect(form.checkValidity(), 'one checked option satisfies the whole group').to.be.true;
  expect(radios.every((radio) => radio.validity.valid)).to.be.true;
});

it('normalizes declarative, programmatic, restored, and reset state to one checked radio', async () => {
  const form = (await fixture(html`
    <form>
      <lr-radio-group name="choice">
        <lr-radio value="a" checked>A</lr-radio>
        <lr-radio value="b" checked>B</lr-radio>
      </lr-radio-group>
    </form>
  `)) as HTMLFormElement;
  const group = form.querySelector('lr-radio-group') as LyraRadioGroup;
  const [a, b] = [...group.querySelectorAll('lr-radio')] as LyraRadio[];
  await group.updateComplete;

  expect([a, b].filter((radio) => radio.checked).length, 'declarative state').to.equal(1);

  a.checked = true;
  expect(a.checked, 'the latest programmatic selection wins').to.be.true;
  expect(b.checked).to.be.false;

  b.formStateRestoreCallback('checked', 'restore');
  expect(a.checked).to.be.false;
  expect(b.checked, 'restored state is normalized through the owner').to.be.true;

  form.reset();
  expect([a, b].filter((radio) => radio.checked).length, 'reset state').to.equal(1);
});

it('owns only radios in its default option slot, excluding support subtrees and nested groups', async () => {
  const outer = (await fixture(html`
    <lr-radio-group name="outer" disabled required>
      <lr-radio value="outer" name="author">Outer</lr-radio>
      <div slot="hint"><lr-radio value="helper" name="helper-name">Helper</lr-radio></div>
      <lr-radio-group name="inner">
        <lr-radio value="inner" name="inner-name">Inner</lr-radio>
      </lr-radio-group>
    </lr-radio-group>
  `)) as LyraRadioGroup;
  const outerRadio = outer.querySelector(':scope > lr-radio') as LyraRadio;
  const helper = outer.querySelector('[slot="hint"] lr-radio') as LyraRadio;
  const inner = outer.querySelector(':scope > lr-radio-group lr-radio') as LyraRadio;
  await outer.updateComplete;

  expect(outerRadio.effectiveDisabled).to.be.true;
  expect(outerRadio.name).to.equal('outer');
  expect(helper.effectiveDisabled, 'a support-slot control remains standalone').to.be.false;
  expect(helper.name).to.equal('helper-name');
  expect(inner.effectiveDisabled, 'a nested group owns its own radio').to.be.false;
  expect(inner.name).to.equal('inner');

  helper.click();
  expect(helper.checked, 'an excluded support radio still selects itself').to.be.true;
});

it('exposes exactly one aggregate lr-change shape when an owned radio is clicked or Space-activated', async () => {
  const group = (await fixture(html`
    <lr-radio-group label="Choice">
      <lr-radio value="a">A</lr-radio>
      <lr-radio value="b">B</lr-radio>
    </lr-radio-group>
  `)) as LyraRadioGroup;
  const [a, b] = [...group.querySelectorAll('lr-radio')] as LyraRadio[];
  const events: CustomEvent[] = [];
  group.addEventListener('lr-change', (event) => events.push(event as CustomEvent));

  a.click();
  (b.shadowRoot!.querySelector('[part="base"]') as HTMLElement).dispatchEvent(
    new KeyboardEvent('keydown', { key: ' ', bubbles: true, composed: true, cancelable: true }),
  );

  expect(events.length).to.equal(2);
  expect(events.every((event) => event.target === group)).to.be.true;
  expect(events.map((event) => event.detail.value)).to.deep.equal(['a', 'b']);
  expect(events.map((event) => event.detail.radio)).to.deep.equal([a, b]);
});

it('emits only the aggregate alias to a capture listener registered before group connect', async () => {
  const group = document.createElement('lr-radio-group') as LyraRadioGroup;
  const radio = document.createElement('lr-radio') as LyraRadio;
  radio.value = 'a';
  radio.textContent = 'A';
  group.append(radio);
  const events: CustomEvent[] = [];
  group.addEventListener('lr-change', (event) => events.push(event as CustomEvent), {
    capture: true,
  });
  const wrapper = await fixture(html`<div></div>`);
  wrapper.append(group);
  await group.updateComplete;
  const radioEvents: CustomEvent[] = [];
  radio.addEventListener('lr-change', (event) => radioEvents.push(event as CustomEvent));

  radio.click();

  expect(events).to.have.length(1);
  expect(events[0]!.target).to.equal(group);
  expect(events[0]!.detail).to.deep.equal({ value: 'a', radio });
  expect(radioEvents).to.have.length(0);
});

it('switches between standalone and new-group lr-change ownership without waiting a microtask', async () => {
  const wrapper = await fixture(html`
    <div>
      <lr-radio-group id="source">
        <lr-radio value="a">A</lr-radio>
      </lr-radio-group>
      <lr-radio-group id="destination"></lr-radio-group>
    </div>
  `);
  const source = wrapper.querySelector('#source') as LyraRadioGroup;
  const destination = wrapper.querySelector('#destination') as LyraRadioGroup;
  const radio = source.querySelector('lr-radio') as LyraRadio;
  await Promise.all([source.updateComplete, destination.updateComplete]);
  const radioEvents: CustomEvent[] = [];
  const sourceEvents: CustomEvent[] = [];
  const destinationEvents: CustomEvent[] = [];
  radio.addEventListener('lr-change', (event) => radioEvents.push(event as CustomEvent));
  source.addEventListener('lr-change', (event) => sourceEvents.push(event as CustomEvent));
  destination.addEventListener('lr-change', (event) =>
    destinationEvents.push(event as CustomEvent));

  radio.remove();
  radio.click();
  expect(radioEvents).to.have.length(1);
  expect(radioEvents[0]!.detail).to.deep.equal({ checked: true, value: 'a' });
  expect(sourceEvents).to.have.length(0);

  radio.checked = false;
  destination.append(radio);
  radio.click();

  expect(radioEvents).to.have.length(1);
  expect(sourceEvents).to.have.length(0);
  expect(destinationEvents).to.have.length(1);
  expect(destinationEvents[0]!.target).to.equal(destination);
  expect(destinationEvents[0]!.detail).to.deep.equal({ value: 'a', radio });
});

it('honors disabled-group membership and releases imposed state during synchronous reparenting', async () => {
  const wrapper = await fixture(html`
    <div>
      <lr-radio-group disabled></lr-radio-group>
      <lr-radio value="a">A</lr-radio>
    </div>
  `);
  const group = wrapper.querySelector('lr-radio-group') as LyraRadioGroup;
  const radio = wrapper.querySelector('lr-radio') as LyraRadio;
  const radioEvents: CustomEvent[] = [];
  const groupEvents: CustomEvent[] = [];
  radio.addEventListener('lr-change', (event) => radioEvents.push(event as CustomEvent));
  group.addEventListener('lr-change', (event) => groupEvents.push(event as CustomEvent));

  group.append(radio);
  expect(radio.effectiveDisabled).to.be.true;
  radio.click();
  expect(radio.checked).to.be.false;
  expect(radioEvents).to.have.length(0);
  expect(groupEvents).to.have.length(0);

  await new Promise((resolve) => queueMicrotask(resolve));
  await Promise.all([group.updateComplete, radio.updateComplete]);
  expect(radio.effectiveDisabled).to.be.true;

  radio.remove();
  expect(radio.effectiveDisabled).to.be.false;
  radio.click();
  expect(radio.checked).to.be.true;
  expect(radioEvents).to.have.length(1);
  expect(groupEvents).to.have.length(0);
});

it('synchronously reconciles both groups when a checked radio moves between named required groups', async () => {
  const form = (await fixture(html`
    <form>
      <lr-radio-group name="source" required>
        <lr-radio name="author-name" value="a" checked>A</lr-radio>
        <lr-radio value="b">B</lr-radio>
      </lr-radio-group>
      <lr-radio-group name="destination" required></lr-radio-group>
    </form>
  `)) as HTMLFormElement;
  const [source, destination] = [...form.querySelectorAll('lr-radio-group')] as LyraRadioGroup[];
  const [moved, remaining] = [...source.querySelectorAll('lr-radio')] as LyraRadio[];
  await Promise.all([source.updateComplete, destination.updateComplete]);
  expect(form.checkValidity()).to.be.true;

  destination.append(moved);

  expect(moved.name).to.equal('destination');
  expect(moved.effectiveRequired).to.be.true;
  expect(remaining.effectiveRequired).to.be.true;
  expect(remaining.validity.valueMissing).to.be.true;
  expect(form.checkValidity()).to.be.false;
  await Promise.all([source.updateComplete, destination.updateComplete, moved.updateComplete, remaining.updateComplete]);
  expect(
    remaining.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-required'),
  ).to.equal('true');
  expect(
    remaining.shadowRoot!.querySelector('[part="base"]')!.getAttribute('tabindex'),
  ).to.equal('0');
});

it('releases group-imposed state while its group is disconnected and reapplies it on reconnect', async () => {
  const wrapper = await fixture(html`
    <div>
      <lr-radio-group name="group-name" disabled required>
        <lr-radio name="author-name" value="a">A</lr-radio>
      </lr-radio-group>
    </div>
  `);
  const group = wrapper.querySelector('lr-radio-group') as LyraRadioGroup;
  const radio = group.querySelector('lr-radio') as LyraRadio;
  await Promise.all([group.updateComplete, radio.updateComplete]);
  expect(radio.effectiveDisabled).to.be.true;
  expect(radio.name).to.equal('group-name');

  group.remove();
  expect(radio.effectiveDisabled).to.be.false;
  expect(radio.effectiveRequired).to.be.false;
  expect(radio.name).to.equal('author-name');

  wrapper.append(group);
  expect(radio.effectiveDisabled).to.be.true;
  expect(radio.name).to.equal('group-name');
});

it('restores author-provided names when a group name clears or a radio leaves its ownership', async () => {
  const group = (await fixture(html`
    <lr-radio-group name="group-name">
      <lr-radio name="author-name" value="a">A</lr-radio>
    </lr-radio-group>
  `)) as LyraRadioGroup;
  const radio = group.querySelector('lr-radio') as LyraRadio;
  await group.updateComplete;
  expect(radio.name).to.equal('group-name');

  group.name = '';
  await group.updateComplete;
  expect(radio.name).to.equal('author-name');
  expect(radio.getAttribute('name')).to.equal('author-name');

  group.name = 'second-group-name';
  await group.updateComplete;
  expect(radio.name).to.equal('second-group-name');

  radio.remove();
  await new Promise((resolve) => queueMicrotask(resolve));
  await radio.updateComplete;
  expect(radio.name).to.equal('author-name');
  expect(radio.getAttribute('name')).to.equal('author-name');
});

it('keeps the author name through a direct move between already-connected named groups', async () => {
  const root = await fixture(html`
    <div>
      <lr-radio-group name="destination"></lr-radio-group>
      <lr-radio-group name="source">
        <lr-radio name="author-name" value="a">A</lr-radio>
      </lr-radio-group>
    </div>
  `);
  const [destination, source] = [...root.querySelectorAll('lr-radio-group')] as LyraRadioGroup[];
  const radio = source.querySelector('lr-radio') as LyraRadio;
  destination.append(radio);
  await new Promise((resolve) => setTimeout(resolve, 0));
  await Promise.all([destination.updateComplete, source.updateComplete, radio.updateComplete]);
  expect(radio.name).to.equal('destination');

  destination.name = '';
  await destination.updateComplete;
  expect(radio.name).to.equal('author-name');
});

it('clears group-imposed disabled/required on every radio when turned back off', async () => {
  const group = (await fixture(html`
    <lr-radio-group label="Choice" disabled required>
      <lr-radio value="a">A</lr-radio>
      <lr-radio value="b">B</lr-radio>
    </lr-radio-group>
  `)) as LyraRadioGroup;
  const radios = [...group.querySelectorAll('lr-radio')] as LyraRadio[];
  expect(radios[0].effectiveDisabled).to.be.true;
  expect(
    radios.every((radio) => !radio.effectiveRequired),
    'disabled radios do not own an active form-validity constraint',
  ).to.be.true;
  expect(group.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-required')).to.equal('true');

  group.disabled = false;
  group.required = false;
  await group.updateComplete;
  await new Promise((resolve) => queueMicrotask(resolve));
  expect(radios[0].effectiveDisabled).to.be.false;
  expect(radios[1].effectiveDisabled).to.be.false;
  expect(radios[0].effectiveRequired).to.be.false;
  expect(radios[1].effectiveRequired).to.be.false;
});

it('does not move or select from keyboard while the group or fieldset is disabled', async () => {
  const form = (await fixture(html`
    <form><fieldset>
      <lr-radio-group label="Choice">
        <lr-radio value="a" checked>A</lr-radio>
        <lr-radio value="b">B</lr-radio>
      </lr-radio-group>
    </fieldset></form>
  `)) as HTMLFormElement;
  const group = form.querySelector('lr-radio-group') as LyraRadioGroup;
  const fieldset = form.querySelector('fieldset') as HTMLFieldSetElement;
  const [a, b] = [...group.querySelectorAll('lr-radio')] as LyraRadio[];
  a.checked = true;

  group.disabled = true;
  await group.updateComplete;
  a.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }));
  expect(a.checked).to.be.true;
  expect(b.checked).to.be.false;

  group.disabled = false;
  fieldset.disabled = true;
  await group.updateComplete;
  a.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, composed: true }));
  expect(a.checked).to.be.true;
  expect(b.checked).to.be.false;
});

it('reconciles appended and removed radios and releases group-imposed state', async () => {
  const group = (await fixture(html`
    <lr-radio-group name="choice" required disabled>
      <lr-radio value="a">A</lr-radio>
    </lr-radio-group>
  `)) as LyraRadioGroup;
  group.name = 'choice';
  const removed = group.querySelector('lr-radio') as LyraRadio;
  const added = document.createElement('lr-radio') as LyraRadio;
  added.value = 'b';
  added.textContent = 'B';
  const slot = group.shadowRoot!.querySelector('slot:not([name])') as HTMLSlotElement;
  const appended = oneEvent(slot, 'slotchange');
  group.append(added);
  await appended;
  await added.updateComplete;
  await group.updateComplete;

  expect(group.querySelectorAll('lr-radio').length).to.equal(2);
  expect(group.name).to.equal('choice');
  expect(group.getAttribute('name')).to.equal('choice');
  expect(added.effectiveDisabled).to.be.true;
  expect(
    added.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-required'),
    'disabled radios do not own the group validity constraint',
  ).to.equal('false');
  expect(added.shadowRoot!.querySelector('[part="base"]')!.getAttribute('tabindex')).to.equal('-1');

  const removedEvent = oneEvent(slot, 'slotchange');
  removed.remove();
  await removedEvent;
  await removed.updateComplete;
  await group.updateComplete;
  expect(removed.effectiveDisabled).to.be.false;
  expect(removed.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-required')).to.equal('false');
  expect(removed.shadowRoot!.querySelector('[part="base"]')!.getAttribute('tabindex')).to.equal('0');
});

it('floors the circle with min-* sizing instead of hard-sizing it, so the indicator can never overflow the tap target', async () => {
  const el = (await fixture(html`<lr-radio checked aria-label="One"></lr-radio>`)) as LyraRadio;
  await el.updateComplete;
  const circle = el.shadowRoot!.querySelector('[part="circle"]') as HTMLElement;

  // Default tokens at the default "m" tier:
  // min(--lr-icon-button-size 2.5rem, --lr-form-control-height 2.5rem * 0.7) === 1.75rem === 28px,
  // comfortably above the WCAG 2.2 SC 2.5.8 24x24 minimum. For a label-less radio the circle *is*
  // the whole tap target -- [part='base'] contributes no box of its own.
  const floored = circle.getBoundingClientRect();
  expect(floored.width).to.be.closeTo(28, 0.5);
  expect(floored.height).to.be.closeTo(28, 0.5);

  // A hard `inline-size`/`block-size` cannot grow for its own content: enlarging the dot would clip
  // it and leave the circle at 28px. `min-inline-size`/`min-block-size` (the form <lr-checkbox>'s
  // [part='box'] already uses) is a floor, so the circle grows to contain the indicator instead.
  el.style.setProperty('--lr-radio-dot-size', '3rem');
  const grown = circle.getBoundingClientRect();
  expect(grown.width).to.be.at.least(48);
  expect(grown.height).to.be.at.least(48);
});

it('publishes --lr-radio-label-indent and drives the real label offset from it', async () => {
  const el = (await fixture(html`<lr-radio value="a">A</lr-radio>`)) as LyraRadio;
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;

  // Published, so a consumer aligning their own per-option hint text no longer has to re-derive
  // `min(--lr-icon-button-size, 1.75rem) + --lr-space-s` by reading the shadow styles.
  expect(getComputedStyle(el).getPropertyValue('--lr-radio-label-indent').trim()).to.not.equal('');

  // 1.75rem circle + 0.5rem gap === 2.25rem === 36px.
  expect(label.getBoundingClientRect().left - base.getBoundingClientRect().left).to.be.closeTo(36, 0.5);

  // The published value and the rendered geometry cannot drift: retuning it moves the label.
  el.style.setProperty('--lr-radio-label-indent', '4rem');
  expect(label.getBoundingClientRect().left - base.getBoundingClientRect().left).to.be.closeTo(64, 0.5);
});

describe('checked-state cssprop escape hatch', () => {
  // Same probe idiom as lr-checkbox's/lr-source-picker's identical checked-state cssprop test:
  // resolve a raw declaration inside the same shadow root so the comparison format (rgb(...))
  // always matches getComputedStyle's, rather than comparing a raw custom-property string
  // against it.
  function resolvedInShadow(el: LyraRadio, declaration: string, property: string): string {
    const probe = document.createElement('span');
    probe.setAttribute('style', declaration);
    el.shadowRoot!.appendChild(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  }

  it('renders byte-identical to --lr-color-brand when --lr-radio-checked-border-color/-dot-color are unset', async () => {
    const el = (await fixture(html`<lr-radio checked>A</lr-radio>`)) as LyraRadio;
    const circle = el.shadowRoot!.querySelector('[part="circle"]') as HTMLElement;
    const dot = el.shadowRoot!.querySelector('[part="dot"]') as HTMLElement;
    expect(getComputedStyle(circle).borderTopColor).to.equal(
      resolvedInShadow(el, 'border-color: var(--lr-color-brand)', 'border-top-color'),
    );
    expect(getComputedStyle(dot).backgroundColor).to.equal(
      resolvedInShadow(el, 'background: var(--lr-color-brand)', 'background-color'),
    );
  });

  it('retints just the checked border/dot fill through --lr-radio-checked-border-color/-dot-color instead of the shared --lr-color-brand token', async () => {
    const el = (await fixture(
      html`<lr-radio
        checked
        style="--lr-radio-checked-border-color: rgb(4, 5, 6); --lr-radio-checked-dot-color: rgb(1, 2, 3);"
        >A</lr-radio
      >`,
    )) as LyraRadio;
    const circle = el.shadowRoot!.querySelector('[part="circle"]') as HTMLElement;
    const dot = el.shadowRoot!.querySelector('[part="dot"]') as HTMLElement;
    expect(getComputedStyle(circle).borderTopColor).to.equal('rgb(4, 5, 6)');
    expect(getComputedStyle(dot).backgroundColor).to.equal('rgb(1, 2, 3)');
  });
});

it('is accessible as a label-less radio named only by aria-label', async () => {
  const el = (await fixture(html`<lr-radio checked aria-label="Only option"></lr-radio>`)) as LyraRadio;
  await expect(el).to.be.accessible();
});

describe('lifecycle: attachInternals guard', () => {
  it('degrades gracefully instead of throwing when ElementInternals is unavailable', async () => {
    const original = (globalThis as { ElementInternals?: unknown }).ElementInternals;
    // @ts-expect-error -- deliberately simulating an environment (e.g. happy-dom) with no
    // ElementInternals implementation at all.
    delete (globalThis as { ElementInternals?: unknown }).ElementInternals;
    try {
      expect(() => document.createElement('lr-radio')).to.not.throw();
      const el = (await fixture(html`<lr-radio value="a">A</lr-radio>`)) as LyraRadio;
      await el.updateComplete;
      expect(el.shadowRoot!.querySelectorAll('[part="base"]').length).to.equal(1);
      expect(() => el.click()).to.not.throw();
    } finally {
      (globalThis as { ElementInternals?: unknown }).ElementInternals = original;
    }
  });

  it('degrades gracefully instead of throwing when the native attachInternals() call itself throws', async () => {
    // Scoped to just this tag -- default lyra-radio fixtures render no other
    // form-associated shadow children, but scope defensively anyway.
    const original = HTMLElement.prototype.attachInternals;
    HTMLElement.prototype.attachInternals = function (this: HTMLElement) {
      if (this.tagName.toLowerCase() === 'lr-radio') {
        throw new DOMException('attachInternals is not supported', 'NotSupportedError');
      }
      return original.call(this);
    };
    try {
      expect(() => document.createElement('lr-radio')).to.not.throw();
      const el = (await fixture(html`<lr-radio value="a">A</lr-radio>`)) as LyraRadio;
      await el.updateComplete;
      expect(el.shadowRoot!.querySelectorAll('[part="base"]').length).to.equal(1);
      expect(() => el.click()).to.not.throw();
    } finally {
      HTMLElement.prototype.attachInternals = original;
    }
  });
});

describe('validationMessage localization', () => {
  it('defaults to the built-in English validationMessage for a required, unselected radio', async () => {
    const el = (await fixture(html`<lr-radio required value="a">A</lr-radio>`)) as LyraRadio;
    expect(el.validationMessage).to.equal('Please select an option.');
  });

  it('localizes the validationMessage via this.localize() when .strings overrides radioRequired', async () => {
    const el = (await fixture(html`
      <lr-radio required value="a" .strings=${{ radioRequired: 'Veuillez sélectionner une option.' }}
        >A</lr-radio
      >
    `)) as LyraRadio;
    expect(el.validationMessage).to.equal('Veuillez sélectionner une option.');

    el.checked = true;
    expect(el.validationMessage).to.equal('');
  });
});

// -- Degraded-DOM form-association fallback ---------------------------------

describe('inert ElementInternals fallback', () => {
  /** `<lr-radio>` guards on the *global* `ElementInternals` being defined at all, then on
   *  `attachInternals()` throwing -- a browser without form-association support, or a polyfill
   *  substitute. Both paths must yield inert internals rather than throwing at construction. */
  const withGlobalRemoved = async (assertion: (el: LyraRadio) => void): Promise<void> => {
    const scope = globalThis as { ElementInternals?: unknown };
    const original = scope.ElementInternals;
    delete scope.ElementInternals;
    try {
      const el = (await fixture(html`<lr-radio value="a">A</lr-radio>`)) as LyraRadio;
      await el.updateComplete;
      assertion(el);
    } finally {
      scope.ElementInternals = original;
    }
  };

  it('falls back when the ElementInternals global is absent entirely', async () => {
    await withGlobalRemoved((el) => {
      const internals = (el as unknown as { internals: ElementInternals }).internals;
      expect(internals.form).to.be.null;
      expect(internals.willValidate).to.be.false;
      expect(internals.validationMessage).to.equal('');
      expect(internals.checkValidity()).to.be.true;
      expect(internals.reportValidity()).to.be.true;
      expect(() => internals.setFormValue('a')).to.not.throw();
      expect(() => internals.setValidity({}, '')).to.not.throw();
    });
  });

  it('falls back when attachInternals throws', async () => {
    const proto = HTMLElement.prototype as unknown as { attachInternals?: unknown };
    const original = proto.attachInternals;
    proto.attachInternals = () => {
      throw new DOMException('unsupported');
    };
    try {
      const el = (await fixture(html`<lr-radio value="a">A</lr-radio>`)) as LyraRadio;
      await el.updateComplete;
      const internals = (el as unknown as { internals: ElementInternals }).internals;
      expect(internals.checkValidity()).to.be.true;
      expect(internals.reportValidity()).to.be.true;
    } finally {
      proto.attachInternals = original;
    }
  });
});

it('fires input and change for arrow-key selection, matching click and Space', async () => {
  const group = (await fixture(html`
    <lr-radio-group label="Size">
      <lr-radio value="s">S</lr-radio>
      <lr-radio value="m">M</lr-radio>
    </lr-radio-group>
  `)) as LyraRadioGroup;
  const radios = [...group.querySelectorAll('lr-radio')] as LyraRadio[];
  const firstBase = radios[0]!.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  radios[0]!.checked = true;
  firstBase.focus();

  const seen: string[] = [];
  for (const type of ['input', 'change', 'lr-change']) group.addEventListener(type, () => seen.push(type));

  const pending = oneEvent(group, 'lr-change');
  firstBase.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true, cancelable: true }),
  );
  await pending;

  expect(radios[1]!.checked, 'arrow navigation moves the selection').to.be.true;
  // Native <input type=radio> fires input+change on arrow navigation; a consumer bound to the
  // native-mirroring events must not silently miss keyboard selection.
  expect(seen).to.include('input');
  expect(seen).to.include('change');
  expect(seen).to.include('lr-change');
});

describe('size', () => {
  async function circleOf(markup: unknown): Promise<DOMRect> {
    const el = (await fixture(markup as never)) as LyraRadio;
    await el.updateComplete;
    const circle = el.shadowRoot!.querySelector('[part="circle"]') as HTMLElement;
    return circle.getBoundingClientRect();
  }

  it('defaults to the "m" tier and reflects it', async () => {
    const el = (await fixture(html`<lr-radio value="a">Alpha</lr-radio>`)) as LyraRadio;
    await el.updateComplete;
    expect(el.size).to.equal('m');
    expect(el.getAttribute('size')).to.equal('m');
  });

  it('grows the rendered circle from size="s" to size="l"', async () => {
    const small = await circleOf(html`<lr-radio size="s" value="a">Alpha</lr-radio>`);
    const large = await circleOf(html`<lr-radio size="l" value="a">Alpha</lr-radio>`);
    expect(large.width).to.be.greaterThan(small.width);
    expect(large.height).to.be.greaterThan(small.height);
  });

  it('renders "small"/"large" at the same geometry as "s"/"l"', async () => {
    const s = await circleOf(html`<lr-radio size="s" value="a">Alpha</lr-radio>`);
    const small = await circleOf(html`<lr-radio size="small" value="a">Alpha</lr-radio>`);
    const l = await circleOf(html`<lr-radio size="l" value="a">Alpha</lr-radio>`);
    const large = await circleOf(html`<lr-radio size="large" value="a">Alpha</lr-radio>`);
    expect(small.width).to.be.closeTo(s.width, 0.5);
    expect(large.width).to.be.closeTo(l.width, 0.5);
  });

  it('keeps the selected dot inside the circle at every tier', async () => {
    let previousCircle = 0;
    for (const size of ['2xs', 'xs', 's', 'm', 'l', 'xl'] as const) {
      const el = (await fixture(
        html`<lr-radio size=${size} value="a" checked>Alpha</lr-radio>`,
      )) as LyraRadio;
      await el.updateComplete;
      const circle = (el.shadowRoot!.querySelector('[part="circle"]') as HTMLElement).getBoundingClientRect();
      const dot = (el.shadowRoot!.querySelector('[part="dot"]') as HTMLElement).getBoundingClientRect();
      expect(dot.width, `${size} dot fits`).to.be.lessThan(circle.width);
      expect(dot.width, `${size} dot visible`).to.be.greaterThan(0);
      expect(circle.width, `${size} circle grows with the tier`).to.be.greaterThan(previousCircle);
      previousCircle = circle.width;
    }
  });

  it('is accessible at a non-default tier', async () => {
    const el = (await fixture(html`<lr-radio size="l" value="a">Alpha</lr-radio>`)) as LyraRadio;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});

describe('pill', () => {
  it('defaults to false and reflects when set', async () => {
    const el = (await fixture(html`<lr-radio value="a">Alpha</lr-radio>`)) as LyraRadio;
    await el.updateComplete;
    expect(el.pill).to.equal(false);
    expect(el.hasAttribute('pill')).to.equal(false);
    el.pill = true;
    await el.updateComplete;
    expect(el.hasAttribute('pill')).to.equal(true);
  });

  it('leaves the indicator fully round, which it already is', async () => {
    const el = (await fixture(html`<lr-radio pill value="a">Alpha</lr-radio>`)) as LyraRadio;
    await el.updateComplete;
    const circle = el.shadowRoot!.querySelector('[part="circle"]') as HTMLElement;
    const radius = Number.parseFloat(getComputedStyle(circle).borderStartStartRadius);
    expect(radius).to.be.at.least(circle.getBoundingClientRect().width / 2);
  });
});

describe('lr-radio-group size', () => {
  async function group(size: string): Promise<LyraRadioGroup> {
    const el = (await fixture(html`
      <lr-radio-group name="plan" label="Plan" size=${size}>
        <lr-radio value="a">Alpha</lr-radio>
        <lr-radio value="b">Bravo</lr-radio>
        <lr-radio value="c">Charlie</lr-radio>
      </lr-radio-group>
    `)) as LyraRadioGroup;
    await el.updateComplete;
    return el;
  }

  it('defaults to the "m" tier and reflects it', async () => {
    const el = (await fixture(html`<lr-radio-group name="plan" label="Plan"></lr-radio-group>`)) as LyraRadioGroup;
    await el.updateComplete;
    expect(el.size).to.equal('m');
    expect(el.getAttribute('size')).to.equal('m');
  });

  it('grows the rendered group box from size="s" to size="l"', async () => {
    const small = await group('s');
    const large = await group('l');
    expect(large.getBoundingClientRect().height).to.be.greaterThan(small.getBoundingClientRect().height);
  });

  it('renders "small"/"large" at the same geometry as "s"/"l"', async () => {
    const s = await group('s');
    const small = await group('small');
    const l = await group('l');
    const large = await group('large');
    expect(small.getBoundingClientRect().height).to.be.closeTo(s.getBoundingClientRect().height, 0.5);
    expect(large.getBoundingClientRect().height).to.be.closeTo(l.getBoundingClientRect().height, 0.5);
  });

  it('leaves an explicitly-sized option alone', async () => {
    const el = (await fixture(html`
      <lr-radio-group name="plan" label="Plan" size="l">
        <lr-radio value="a" size="s">Alpha</lr-radio>
      </lr-radio-group>
    `)) as LyraRadioGroup;
    await el.updateComplete;
    const circle = el.querySelector('lr-radio')!.shadowRoot!.querySelector('[part="circle"]') as HTMLElement;
    const standalone = (await fixture(html`<lr-radio size="s">Alpha</lr-radio>`)) as HTMLElement;
    const standaloneCircle = standalone.shadowRoot!.querySelector('[part="circle"]') as HTMLElement;
    expect(circle.getBoundingClientRect().width).to.be.closeTo(
      standaloneCircle.getBoundingClientRect().width,
      0.5,
    );
  });

  it('is accessible at a non-default tier', async () => {
    const el = await group('l');
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

describe('lr-radio validity custom states', () => {
  it('publishes required/optional and valid/invalid from the first render', async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(html`<lr-radio required value="a">One</lr-radio>`)) as LyraRadio;
    await el.updateComplete;
    expect(el.matches(':state(required)'), 'required').to.be.true;
    expect(el.matches(':state(optional)'), 'optional').to.be.false;
    expect(el.matches(':state(invalid)'), 'invalid').to.be.true;
    expect(el.matches(':state(valid)'), 'valid').to.be.false;

    const optional = (await fixture(html`<lr-radio value="a">One</lr-radio>`)) as LyraRadio;
    await optional.updateComplete;
    expect(optional.matches(':state(optional)')).to.be.true;
    expect(optional.matches(':state(valid)')).to.be.true;
  });

  it('reads an owning required group as required, not just its own attribute', async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const group = (await fixture(html`
      <lr-radio-group required name="pick" label="Pick">
        <lr-radio value="a">One</lr-radio>
        <lr-radio value="b">Two</lr-radio>
      </lr-radio-group>
    `)) as LyraRadioGroup;
    await group.updateComplete;
    const first = group.querySelector('lr-radio') as LyraRadio;
    expect(first.hasAttribute('required'), 'no attribute of its own').to.be.false;
    expect(first.matches(':state(required)'), 'required through the group').to.be.true;
    expect(first.matches(':state(optional)')).to.be.false;
  });

  it('withholds user-valid/user-invalid until the user has actually interacted', async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(html`<lr-radio required value="a">One</lr-radio>`)) as LyraRadio;
    await el.updateComplete;
    expect(el.matches(':state(user-invalid)'), 'pristine required must not read as an error').to.be
      .false;
    expect(el.matches(':state(user-valid)')).to.be.false;

    el.click();
    await el.updateComplete;
    expect(el.checked).to.be.true;
    expect(el.matches(':state(valid)')).to.be.true;
    expect(el.matches(':state(user-valid)'), 'user-valid after a real selection').to.be.true;
  });

  it('goes pristine again after a form reset', async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const form = await fixture<HTMLFormElement>(
      html`<form><lr-radio name="pick" required value="a">One</lr-radio></form>`,
    );
    const el = form.querySelector('lr-radio') as LyraRadio;
    await el.updateComplete;
    el.click();
    await el.updateComplete;
    expect(el.matches(':state(user-valid)')).to.be.true;
    form.reset();
    await el.updateComplete;
    expect(el.matches(':state(user-valid)'), 'reset returns the control to pristine').to.be.false;
    expect(el.matches(':state(user-invalid)')).to.be.false;
    expect(el.matches(':state(invalid)'), 'unchecked again, so intrinsically invalid').to.be.true;
  });
});

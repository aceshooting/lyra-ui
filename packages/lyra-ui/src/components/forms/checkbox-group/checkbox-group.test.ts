import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './checkbox-group.js';
import '../checkbox/checkbox.js';
import type { LyraCheckboxGroup } from './checkbox-group.js';
import type { LyraCheckbox } from '../checkbox/checkbox.js';
import { styles } from './checkbox-group.styles.js';

it('collects checked children and emits a group change', async () => {
  const el = (await fixture(html`<lr-checkbox-group name="topics"><lr-checkbox value="a">A</lr-checkbox><lr-checkbox value="b">B</lr-checkbox></lr-checkbox-group>`)) as LyraCheckboxGroup;
  const boxes = el.querySelectorAll('lr-checkbox');
  const event = oneEvent(el, 'lr-change');
  (boxes[0] as HTMLElement).shadowRoot!.querySelector('[part="base"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  const result = await event;
  expect(result.detail.value).to.deep.equal(['a']);
});

it('reports required validity when no box is checked', async () => {
  const el = (await fixture(html`<lr-checkbox-group required><lr-checkbox>A</lr-checkbox></lr-checkbox-group>`)) as LyraCheckboxGroup;
  expect(el.checkValidity()).to.be.false;
});

it('is accessible', async () => {
  const el = await fixture(html`<lr-checkbox-group label="Topics"><lr-checkbox>A</lr-checkbox></lr-checkbox-group>`);
  await expect(el).to.be.accessible();
});

it('uses the semibold font-weight design token for the label instead of a hardcoded value', () => {
  expect(styles.cssText).to.include('var(--lr-font-weight-semibold)');
  expect(styles.cssText).to.not.match(/\[part='form-control-label'\]\s*\{[^}]*font-weight:\s*600/);
});

it('actually renders the legend with the semibold font-weight token, not just declares it in the stylesheet source', async () => {
  const el = (await fixture(html`<lr-checkbox-group label="Topics"><lr-checkbox>A</lr-checkbox></lr-checkbox-group>`)) as LyraCheckboxGroup;
  const legend = el.shadowRoot!.querySelector('[part="form-control-label"]') as HTMLElement;
  // Compares against the token's own resolved value rather than a hardcoded '600', same idiom as
  // notebook-viewer.test.ts's identical semibold-token assertion.
  expect(getComputedStyle(legend).fontWeight).to.equal(
    getComputedStyle(legend).getPropertyValue('--lr-font-weight-semibold').trim(),
  );
});

describe('ElementInternals availability', () => {
  it('does not throw when constructed in an environment without a real ElementInternals implementation (e.g. a downstream Vitest + happy-dom suite)', () => {
    const original = HTMLElement.prototype.attachInternals;
    // @ts-expect-error -- simulating an environment that lacks ElementInternals entirely
    delete HTMLElement.prototype.attachInternals;
    try {
      let el: LyraCheckboxGroup | undefined;
      expect(() => {
        el = document.createElement('lr-checkbox-group') as LyraCheckboxGroup;
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

describe('validationMessage localization', () => {
  it('defaults to the built-in English validationMessage when required with nothing checked', async () => {
    const el = (await fixture(
      html`<lr-checkbox-group required><lr-checkbox>A</lr-checkbox></lr-checkbox-group>`,
    )) as LyraCheckboxGroup;
    expect(el.validationMessage).to.equal('Select at least one option.');
  });

  it('localizes the validationMessage via this.localize() when .strings overrides checkboxGroupRequired', async () => {
    const el = (await fixture(html`
      <lr-checkbox-group required .strings=${{ checkboxGroupRequired: 'Sélectionnez au moins une option.' }}>
        <lr-checkbox>A</lr-checkbox>
      </lr-checkbox-group>
    `)) as LyraCheckboxGroup;
    expect(el.validationMessage).to.equal('Sélectionnez au moins une option.');

    (el.querySelectorAll('lr-checkbox')[0] as HTMLElement).shadowRoot!.querySelector('[part="base"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(el.validationMessage).to.equal('');
  });
});

it('cascades fieldset-disabled state to children through an internal channel, never their own disabled property', async () => {
  const form = (await fixture(html`
    <form>
      <fieldset>
        <lr-checkbox-group>
          <lr-checkbox value="a">A</lr-checkbox>
          <lr-checkbox value="b" disabled>B</lr-checkbox>
        </lr-checkbox-group>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const group = form.querySelector('lr-checkbox-group') as LyraCheckboxGroup;
  const fieldset = form.querySelector('fieldset') as HTMLFieldSetElement;
  const [a, b] = [...group.querySelectorAll('lr-checkbox')] as LyraCheckbox[];
  await group.updateComplete;

  expect(group.effectiveDisabled).to.be.false;
  expect(a.effectiveDisabled).to.be.false;
  expect(b.disabled, 'the explicitly-disabled checkbox starts disabled').to.be.true;

  // No `await` before these assertions: `formDisabledCallback` fires
  // synchronously when the fieldset's `disabled` property is set, and the
  // internal `setGroupDisabled()` propagation runs synchronously from
  // within it -- this is the "same tick" this bug class requires.
  fieldset.disabled = true;
  expect(group.effectiveDisabled, 'the group reflects inherited fieldset state').to.be.true;
  expect(a.effectiveDisabled, 'a plain child reflects the inherited state via the internal channel').to.be.true;
  expect(a.disabled, 'the anti-pattern this guards against: fieldset state must never mutate a child\'s own disabled property').to.be.false;
  expect(a.hasAttribute('disabled'), 'the child host attribute must not be mutated either').to.be.false;
  expect(b.disabled, 'an already-explicitly-disabled child is unaffected').to.be.true;
  expect(b.effectiveDisabled).to.be.true;

  fieldset.disabled = false;
  expect(group.effectiveDisabled).to.be.false;
  expect(a.effectiveDisabled, 'a plain child must not be permanently stuck disabled after the group re-enables').to.be.false;
  expect(a.disabled).to.be.false;
  expect(b.disabled, 'the explicitly-disabled child remains disabled after the fieldset cycle').to.be.true;
  expect(b.effectiveDisabled).to.be.true;

  await Promise.all([a.updateComplete, b.updateComplete]);
  const aBase = a.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const bBase = b.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(aBase.getAttribute('aria-disabled')).to.equal('false');
  expect(bBase.getAttribute('aria-disabled')).to.equal('true');
});

it('reflects a programmatically assigned name synchronously and rebuilds the group FormData in the same tick', async () => {
  const form = (await fixture(html`
    <form><lr-checkbox-group><lr-checkbox value="a" checked>A</lr-checkbox></lr-checkbox-group></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-checkbox-group') as LyraCheckboxGroup;
  await el.updateComplete;

  // No `await` before these assertions: the `name` setter must synchronously reflect the host
  // attribute and rebuild the group's `FormData` entries before any same-tick native form API runs.
  el.name = 'topics';
  expect(el.getAttribute('name')).to.equal('topics');
  expect(new FormData(form).getAll('topics')).to.deep.equal(['a']);

  el.name = 'subjects';
  const renamed = new FormData(form);
  expect(renamed.has('topics'), 'the old name must not still hold entries').to.be.false;
  expect(renamed.getAll('subjects')).to.deep.equal(['a']);

  el.name = '';
  expect(el.hasAttribute('name')).to.be.false;
  expect(new FormData(form).has('subjects')).to.be.false;
});

it('recomputes validity synchronously when required changes, with no await', async () => {
  const el = (await fixture(html`<lr-checkbox-group><lr-checkbox value="a">A</lr-checkbox></lr-checkbox-group>`)) as LyraCheckboxGroup;
  await el.updateComplete;
  expect(el.checkValidity()).to.be.true;

  el.required = true;
  expect(el.hasAttribute('required')).to.be.true;
  expect(el.checkValidity(), 'no box is checked, so a required group must be invalid immediately').to.be.false;

  el.required = false;
  expect(el.checkValidity()).to.be.true;
});

it('reflects its own disabled property synchronously and propagates it to children in the same tick', async () => {
  const el = (await fixture(html`
    <lr-checkbox-group>
      <lr-checkbox value="a">A</lr-checkbox>
      <lr-checkbox value="b" disabled>B</lr-checkbox>
    </lr-checkbox-group>
  `)) as LyraCheckboxGroup;
  const [a, b] = [...el.querySelectorAll('lr-checkbox')] as LyraCheckbox[];
  await el.updateComplete;
  expect(el.effectiveDisabled).to.be.false;
  expect(a.effectiveDisabled).to.be.false;

  // No `await`: setting `disabled` directly (not via an ancestor fieldset) must synchronously
  // reflect the host attribute and propagate to children through the internal
  // `setGroupDisabled()` channel before any Lit update runs.
  el.disabled = true;
  expect(el.hasAttribute('disabled'), 'the host attribute must be set synchronously').to.be.true;
  expect(el.effectiveDisabled).to.be.true;
  expect(a.effectiveDisabled, 'a plain child reflects the group state synchronously').to.be.true;
  expect(a.disabled, 'the group must never mutate a child\'s own disabled property').to.be.false;
  expect(b.disabled, 'an already explicitly-disabled child is unaffected').to.be.true;
  expect(b.effectiveDisabled).to.be.true;

  el.disabled = false;
  expect(el.hasAttribute('disabled')).to.be.false;
  expect(el.effectiveDisabled).to.be.false;
  expect(a.effectiveDisabled).to.be.false;
  expect(b.disabled, 'the explicitly-disabled child remains disabled').to.be.true;
});

it('reacts to hint/error slot content added after the initial render, not just at first paint', async () => {
  const el = (await fixture(html`<lr-checkbox-group><lr-checkbox>A</lr-checkbox></lr-checkbox-group>`)) as LyraCheckboxGroup;
  const hintPart = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
  const errorPart = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
  expect(hintPart.hasAttribute('hidden')).to.be.true;
  expect(errorPart.hasAttribute('hidden')).to.be.true;

  const hintSpan = document.createElement('span');
  hintSpan.slot = 'hint';
  hintSpan.textContent = 'Pick at least one';
  el.appendChild(hintSpan);
  const errorSpan = document.createElement('span');
  errorSpan.slot = 'error';
  errorSpan.textContent = 'Selection required';
  el.appendChild(errorSpan);

  // Native slotchange fires asynchronously (a queued microtask); wait for it and the ensuing update.
  await new Promise((resolve) => setTimeout(resolve, 0));
  await el.updateComplete;

  expect(hintPart.hasAttribute('hidden')).to.be.false;
  expect(errorPart.hasAttribute('hidden')).to.be.false;
});

it('warns when `value` is assigned from outside, because the children are the only source of truth', async () => {
  const el = (await fixture(html`<lr-checkbox-group name="topics"><lr-checkbox value="a">A</lr-checkbox><lr-checkbox value="b">B</lr-checkbox></lr-checkbox-group>`)) as LyraCheckboxGroup;
  await el.updateComplete;
  const calls: unknown[][] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => calls.push(args);
  try {
    el.value = ['a'];
  } finally {
    console.warn = originalWarn;
  }
  expect(calls.some((args) => String(args[0]).includes('`value`'))).to.be.true;
  // The assignment is discarded by the next sync(), exactly as the warning says.
  (el.querySelectorAll('lr-checkbox')[1] as HTMLElement).shadowRoot!.querySelector('[part="base"]')!
    .dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(el.value).to.deep.equal(['b']);
});

it('warns when two children share a value, because their FormData entries are indistinguishable', async () => {
  const calls: unknown[][] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => calls.push(args);
  let el: LyraCheckboxGroup;
  try {
    el = (await fixture(html`<lr-checkbox-group name="topics"><lr-checkbox>A</lr-checkbox><lr-checkbox>B</lr-checkbox><lr-checkbox>C</lr-checkbox></lr-checkbox-group>`)) as LyraCheckboxGroup;
    await el.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 0));
  } finally {
    console.warn = originalWarn;
  }
  expect(calls.some((args) => String(args[0]).includes('"on"'))).to.be.true;
  // Warned once per duplicated value, not once per sync().
  expect(calls.filter((args) => String(args[0]).includes('"on"')).length).to.equal(1);
});

it('does not warn for the normal children-drive-value flow', async () => {
  const calls: unknown[][] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => calls.push(args);
  let el: LyraCheckboxGroup;
  try {
    el = (await fixture(html`<lr-checkbox-group name="topics"><lr-checkbox value="a">A</lr-checkbox><lr-checkbox value="b">B</lr-checkbox></lr-checkbox-group>`)) as LyraCheckboxGroup;
    await el.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 0));
    (el.querySelectorAll('lr-checkbox')[0] as HTMLElement).shadowRoot!.querySelector('[part="base"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await el.updateComplete;
  } finally {
    console.warn = originalWarn;
  }
  expect(el!.value).to.deep.equal(['a']);
  expect(calls).to.deep.equal([]);
});

it('consumes child native-style events before emitting one group event surface', async () => {
  const el = (await fixture(html`
    <lr-checkbox-group><lr-checkbox value="a">A</lr-checkbox></lr-checkbox-group>
  `)) as LyraCheckboxGroup;
  const events: Array<{ type: string; target: EventTarget | null; detail: unknown }> = [];
  el.addEventListener('input', (event) => events.push({
    type: event.type,
    target: event.target,
    detail: (event as CustomEvent).detail,
  }));
  el.addEventListener('change', (event) => events.push({
    type: event.type,
    target: event.target,
    detail: (event as CustomEvent).detail,
  }));
  el.addEventListener('lr-change', (event) => events.push({
    type: event.type,
    target: event.target,
    detail: (event as CustomEvent).detail,
  }));

  (el.querySelector('lr-checkbox')!.shadowRoot!.querySelector('[part="base"]') as HTMLElement).click();

  expect(events.map(({ type }) => type)).to.deep.equal(['input', 'change', 'lr-change']);
  expect(events.every(({ target }) => target === el)).to.be.true;
  expect(events.map(({ detail }) => detail)).to.deep.equal([
    { value: ['a'] },
    { value: ['a'] },
    { value: ['a'] },
  ]);
});

it('syncs value and FormData silently when a child is checked or renamed programmatically', async () => {
  const form = (await fixture(html`
    <form>
      <lr-checkbox-group name="picks"><lr-checkbox value="a">A</lr-checkbox></lr-checkbox-group>
    </form>
  `)) as HTMLFormElement;
  const group = form.querySelector('lr-checkbox-group') as LyraCheckboxGroup;
  const child = form.querySelector('lr-checkbox') as LyraCheckbox;
  const events: Event[] = [];
  group.addEventListener('input', (event) => events.push(event));
  group.addEventListener('change', (event) => events.push(event));
  group.addEventListener('lr-change', (event) => events.push(event));

  child.checked = true;
  await child.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 0));
  await group.updateComplete;

  expect(group.value).to.deep.equal(['a']);
  expect(new FormData(form).getAll('picks')).to.deep.equal(['a']);

  child.value = 'b';
  await child.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 0));
  await group.updateComplete;

  expect(group.value).to.deep.equal(['b']);
  expect(new FormData(form).getAll('picks')).to.deep.equal(['b']);
  expect(events, 'programmatic child changes are silent').to.deep.equal([]);
});

it('disconnects child observation and reconciles current child state when reconnected', async () => {
  const container = await fixture(html`
    <div>
      <lr-checkbox-group name="picks"><lr-checkbox value="a">A</lr-checkbox></lr-checkbox-group>
    </div>
  `);
  const group = container.querySelector('lr-checkbox-group') as LyraCheckboxGroup;
  const child = group.querySelector('lr-checkbox') as LyraCheckbox;

  group.remove();
  child.checked = true;
  await child.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(group.value, 'a disconnected group has no active child observer').to.deep.equal([]);

  container.append(group);
  await group.updateComplete;
  expect(group.value).to.deep.equal(['a']);
});

it('owns only checkboxes whose closest checkbox group is itself', async () => {
  const form = (await fixture(html`
    <form>
      <lr-checkbox-group name="outer">
        <lr-checkbox value="outer" checked>Outer</lr-checkbox>
        <lr-checkbox-group name="inner">
          <lr-checkbox value="inner" checked>Inner</lr-checkbox>
        </lr-checkbox-group>
      </lr-checkbox-group>
    </form>
  `)) as HTMLFormElement;
  const group = form.querySelector('lr-checkbox-group') as LyraCheckboxGroup;

  await group.updateComplete;

  expect(group.value).to.deep.equal(['outer']);
  expect(new FormData(form).getAll('outer')).to.deep.equal(['outer']);
});

it('does not treat a nested group support slot as outer support content', async () => {
  const outer = (await fixture(html`
    <lr-checkbox-group>
      <lr-checkbox value="outer">Outer</lr-checkbox>
      <lr-checkbox-group>
        <span slot="label">Inner label</span>
        <span slot="hint">Inner hint</span>
        <span slot="error">Inner error</span>
        <lr-checkbox value="inner">Inner</lr-checkbox>
      </lr-checkbox-group>
    </lr-checkbox-group>
  `)) as LyraCheckboxGroup;
  await outer.updateComplete;

  expect((outer.shadowRoot!.querySelector('[part="form-control-label"]') as HTMLElement).hidden).to.be.true;
  expect((outer.shadowRoot!.querySelector('[part="hint"]') as HTMLElement).hidden).to.be.true;
  expect((outer.shadowRoot!.querySelector('[part="error"]') as HTMLElement).hidden).to.be.true;
});

it('keeps an option whose non-top-level wrapper has an inert slot attribute', async () => {
  const group = (await fixture(html`
    <lr-checkbox-group>
      <div>
        <span slot="hint"><lr-checkbox value="option" checked>Option</lr-checkbox></span>
      </div>
    </lr-checkbox-group>
  `)) as LyraCheckboxGroup;
  await group.updateComplete;

  expect(group.value).to.deep.equal(['option']);
  group.disabled = true;
  expect((group.querySelector('lr-checkbox') as LyraCheckbox).effectiveDisabled).to.be.true;
});

it('excludes checkboxes under named support-slot subtrees while preserving default-slot wrappers', async () => {
  const form = (await fixture(html`
    <form>
      <lr-checkbox-group name="topics" required>
        <div slot="label"><lr-checkbox value="label" checked>Label helper</lr-checkbox></div>
        <div slot="hint"><lr-checkbox value="hint" checked>Hint helper</lr-checkbox></div>
        <div slot="error"><lr-checkbox value="error" checked>Error helper</lr-checkbox></div>
        <div data-options><lr-checkbox value="option" checked>Option</lr-checkbox></div>
      </lr-checkbox-group>
    </form>
  `)) as HTMLFormElement;
  const group = form.querySelector('lr-checkbox-group') as LyraCheckboxGroup;
  const named = [...group.querySelectorAll('[slot] lr-checkbox')] as LyraCheckbox[];
  const option = group.querySelector('[data-options] lr-checkbox') as LyraCheckbox;
  await group.updateComplete;

  expect(group.value).to.deep.equal(['option']);
  expect(new FormData(form).getAll('topics')).to.deep.equal(['option']);
  expect(group.checkValidity()).to.be.true;

  group.disabled = true;
  expect(option.effectiveDisabled, 'a checkbox wrapped in the default options slot is owned').to.be.true;
  expect(named.every((box) => !box.effectiveDisabled), 'support-slot checkboxes are not group controls').to.be.true;

  group.disabled = false;
  option.checked = false;
  await option.updateComplete;
  await group.updateComplete;
  expect(group.value).to.deep.equal([]);
  expect(new FormData(form).getAll('topics')).to.deep.equal([]);
  expect(group.checkValidity()).to.be.false;
});

it('reconciles controllers, disablement, form state, and event ownership when a wrapper changes slots', async () => {
  const form = (await fixture(html`
    <form>
      <lr-checkbox-group name="topics" required>
        <div data-wrapper><lr-checkbox value="option" checked>Option</lr-checkbox></div>
      </lr-checkbox-group>
    </form>
  `)) as HTMLFormElement;
  const group = form.querySelector('lr-checkbox-group') as LyraCheckboxGroup;
  const wrapper = group.querySelector('[data-wrapper]') as HTMLElement;
  const option = wrapper.querySelector('lr-checkbox') as LyraCheckbox;
  await group.updateComplete;

  group.disabled = true;
  expect(option.effectiveDisabled).to.be.true;

  wrapper.slot = 'hint';
  await new Promise((resolve) => setTimeout(resolve, 0));
  await Promise.all([group.updateComplete, option.updateComplete]);
  expect(option.effectiveDisabled, 'leaving the options slot releases group disablement').to.be.false;

  group.disabled = false;
  expect(group.value).to.deep.equal([]);
  expect(new FormData(form).getAll('topics')).to.deep.equal([]);
  expect(group.checkValidity()).to.be.false;

  const events: Event[] = [];
  group.addEventListener('input', (event) => events.push(event));
  group.addEventListener('change', (event) => events.push(event));
  group.addEventListener('lr-change', (event) => events.push(event));
  option.click();
  expect(events.map((event) => event.type)).to.deep.equal(['input', 'change', 'lr-change']);
  expect(events.every((event) => event.target === option), 'support-slot child events pass through unchanged').to.be.true;
  expect(group.value, 'a support-slot event is not translated into group state').to.deep.equal([]);

  option.checked = true;
  option.value = 'renamed';
  await option.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 0));
  await group.updateComplete;
  expect(group.value, 'removed child controllers cannot silently resync the group').to.deep.equal([]);

  wrapper.removeAttribute('slot');
  await new Promise((resolve) => setTimeout(resolve, 0));
  await group.updateComplete;
  expect(group.value).to.deep.equal(['renamed']);
  expect(new FormData(form).getAll('topics')).to.deep.equal(['renamed']);
  expect(group.checkValidity()).to.be.true;

  option.value = 'updated';
  await option.updateComplete;
  await group.updateComplete;
  expect(group.value, 'default-slot wrappers regain programmatic child observation').to.deep.equal(['updated']);
  expect(new FormData(form).getAll('topics')).to.deep.equal(['updated']);
});

it('does not consume or translate events emitted by a nested checkbox group', async () => {
  const outer = (await fixture(html`
    <lr-checkbox-group>
      <lr-checkbox value="outer" checked>Outer</lr-checkbox>
      <lr-checkbox-group>
        <lr-checkbox value="inner">Inner</lr-checkbox>
      </lr-checkbox-group>
    </lr-checkbox-group>
  `)) as LyraCheckboxGroup;
  const inner = outer.querySelector('lr-checkbox-group') as LyraCheckboxGroup;
  const events: Array<{ type: string; target: EventTarget | null }> = [];
  outer.addEventListener('input', (event) => events.push({ type: event.type, target: event.target }));
  outer.addEventListener('change', (event) => events.push({ type: event.type, target: event.target }));
  outer.addEventListener('lr-change', (event) => events.push({ type: event.type, target: event.target }));

  (inner.querySelector('lr-checkbox')!.shadowRoot!.querySelector('[part="base"]') as HTMLElement).click();

  expect(outer.value).to.deep.equal(['outer']);
  expect(events.map(({ type }) => type)).to.deep.equal(['input', 'change', 'lr-change']);
  expect(events.every(({ target }) => target === inner)).to.be.true;
});

it('settles its public and form values after child defaults are restored on form reset', async () => {
  const form = (await fixture(html`
    <form>
      <lr-checkbox-group name="topics" required>
        <lr-checkbox value="a" checked>A</lr-checkbox>
        <lr-checkbox value="b">B</lr-checkbox>
      </lr-checkbox-group>
    </form>
  `)) as HTMLFormElement;
  const group = form.querySelector('lr-checkbox-group') as LyraCheckboxGroup;
  const [a, b] = [...group.querySelectorAll('lr-checkbox')] as LyraCheckbox[];
  a.checked = false;
  b.checked = true;
  b.shadowRoot!.querySelector('[part="base"]')!.dispatchEvent(
    new Event('change', { bubbles: true, composed: true }),
  );

  form.reset();
  await a.updateComplete;
  await b.updateComplete;
  await group.updateComplete;

  expect(a.checked).to.be.true;
  expect(b.checked).to.be.false;
  expect(group.value).to.deep.equal(['a']);
  expect(new FormData(form).getAll('topics')).to.deep.equal(['a']);
  expect(group.checkValidity()).to.be.true;
});

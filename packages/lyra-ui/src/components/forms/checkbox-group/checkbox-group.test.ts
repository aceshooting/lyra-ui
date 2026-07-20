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
  expect(styles.cssText).to.not.match(/\[part='label'\]\s*\{[^}]*font-weight:\s*600/);
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

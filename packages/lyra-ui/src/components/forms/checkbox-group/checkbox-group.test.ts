import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import './checkbox-group.js';
import '../checkbox/checkbox.js';
import type { LyraCheckboxGroup } from './checkbox-group.js';
import type { LyraCheckbox } from '../checkbox/checkbox.js';
import { styles } from './checkbox-group.styles.js';

it('lets a consumer retint the invalid options border independently', async () => {
  const el = (await fixture(html`
    <lr-checkbox-group style="--lr-checkbox-group-invalid-border: rgb(1, 2, 3)">
      <lr-checkbox>A</lr-checkbox>
    </lr-checkbox-group>
  `)) as LyraCheckboxGroup;
  el.setAttribute('data-invalid', '');
  const options = el.shadowRoot!.querySelector('[part~="options"]') as HTMLElement;
  expect(getComputedStyle(options).borderTopColor).to.equal('rgb(1, 2, 3)');
});

it('applies required and disabled states when server rendering provides no light-DOM query API', () => {
  const el = document.createElement('lr-checkbox-group') as LyraCheckboxGroup;
  let requiredError = '';
  let disabledError = '';
  let wasMissing = false;
  let wasBarred = false;

  Object.defineProperty(el, 'querySelectorAll', { configurable: true, value: undefined });
  try {
    try {
      el.required = true;
    } catch (error) {
      requiredError = error instanceof Error ? error.message : String(error);
    }
    wasMissing = el.validity.valueMissing;

    try {
      el.disabled = true;
    } catch (error) {
      disabledError = error instanceof Error ? error.message : String(error);
    }
    wasBarred = !el.validity.valueMissing;
  } finally {
    delete (el as unknown as { querySelectorAll?: ParentNode['querySelectorAll'] }).querySelectorAll;
  }

  expect(requiredError, 'the required setter must not require browser light-DOM traversal').to.equal('');
  expect(disabledError, 'the disabled setter must not require browser light-DOM traversal').to.equal('');
  expect(wasMissing, 'required still computes the empty-group violation').to.be.true;
  expect(wasBarred, 'disabled still bars the required violation').to.be.true;
});

it('collects checked children and emits a group change', async () => {
  const el = (await fixture(html`<lr-checkbox-group name="topics"><lr-checkbox value="a">A</lr-checkbox><lr-checkbox value="b">B</lr-checkbox></lr-checkbox-group>`)) as LyraCheckboxGroup;
  const boxes = el.querySelectorAll('lr-checkbox');
  const event = oneEvent(el, 'lr-change');
  (boxes[0] as HTMLElement).shadowRoot!.querySelector('[part~="base"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
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

it('recreates its child observer in the adopted owner realm and ignores the stale callback', async () => {
  const el = (await fixture(html`
    <lr-checkbox-group><lr-checkbox value="a">A</lr-checkbox></lr-checkbox-group>
  `)) as LyraCheckboxGroup;
  await el.updateComplete;
  el.remove();
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const frameDocument = frame.contentDocument;
  const frameWindow = frame.contentWindow;
  if (!frameDocument || !frameWindow) {
    frame.remove();
    throw new Error('The iframe realm was unavailable.');
  }
  const originalMutationObserver = frameWindow.MutationObserver;
  let groupCallback: MutationCallback | undefined;
  let groupObservations = 0;
  let groupDisconnects = 0;
  class OwnerMutationObserver implements MutationObserver {
    private readonly callback: MutationCallback;
    private observesGroup = false;
    constructor(callback: MutationCallback) { this.callback = callback; }
    observe(target: Node, options?: MutationObserverInit): void {
      if (target !== el || !options?.attributeFilter?.includes('checked')) return;
      this.observesGroup = true;
      groupObservations += 1;
      groupCallback = this.callback;
    }
    takeRecords(): MutationRecord[] { return []; }
    disconnect(): void { if (this.observesGroup) groupDisconnects += 1; }
  }
  frameWindow.MutationObserver = OwnerMutationObserver;

  try {
    frameDocument.adoptNode(el);
    expect(groupObservations, 'detached adoption must not arm an observer').to.equal(0);
    frameDocument.body.append(el);
    await el.updateComplete;
    expect(groupObservations, 'the destination window observes the group').to.equal(1);
    expect(groupCallback).to.be.a('function');
    const staleCallback = groupCallback!;

    document.adoptNode(el);
    document.body.append(el);
    await el.updateComplete;
    expect(groupDisconnects, 'adoption disconnects the destination observer').to.equal(1);

    let requestedUpdates = 0;
    const requestUpdate = el.requestUpdate.bind(el);
    (el as unknown as { requestUpdate(): void }).requestUpdate = () => {
      requestedUpdates += 1;
      requestUpdate();
    };
    staleCallback([{ type: 'childList' } as MutationRecord], {} as MutationObserver);
    expect(requestedUpdates, 'a callback retained by the old realm is inert after reconnect').to.equal(0);
  } finally {
    frameWindow.MutationObserver = originalMutationObserver;
    if (el.ownerDocument !== document) document.adoptNode(el);
    el.remove();
    frame.remove();
  }
});

it('accepts an owned checkbox-shaped event target from another realm without instanceof', async () => {
  const el = (await fixture(html`<lr-checkbox-group></lr-checkbox-group>`)) as LyraCheckboxGroup;
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const frameDocument = frame.contentDocument;
  if (!frameDocument) {
    frame.remove();
    throw new Error('The iframe realm was unavailable.');
  }
  const foreignCheckbox = frameDocument.createElement('lr-checkbox');
  const internals = el as unknown as {
    ownsCheckbox(target: Element): boolean;
    isOwnedCheckbox(target: EventTarget | null): boolean;
  };
  const ownsCheckbox = internals.ownsCheckbox.bind(el);
  internals.ownsCheckbox = (target) => target === foreignCheckbox;

  try {
    expect(internals.isOwnedCheckbox(foreignCheckbox)).to.be.true;
  } finally {
    internals.ownsCheckbox = ownsCheckbox;
    frame.remove();
  }
});

it('uses its native fieldset/legend as the sole named group landmark', async () => {
  const el = (await fixture(html`
    <lr-checkbox-group label="Visible label" aria-label="Explicit group name">
      <lr-checkbox>A</lr-checkbox>
    </lr-checkbox-group>
  `)) as LyraCheckboxGroup;
  const fieldset = el.shadowRoot!.querySelector('fieldset') as HTMLFieldSetElement;
  const options = el.shadowRoot!.querySelector('[part~="options"]') as HTMLElement;

  expect(fieldset.getAttribute('aria-label')).to.equal('Explicit group name');
  expect(fieldset.getAttribute('role'), 'the native fieldset keeps its implicit group role').to.equal(null);
  expect(options.getAttribute('role'), 'the option layout must not create a duplicate group landmark').to.equal(null);
  expect(options.hasAttribute('aria-label')).to.be.false;
  expect(options.hasAttribute('aria-labelledby')).to.be.false;
  await expect(el).to.be.accessible();
});

it('uses the semibold font-weight design token for the label instead of a hardcoded value', () => {
  expect(styles.cssText).to.include('var(--lr-font-weight-semibold)');
  expect(styles.cssText).to.not.match(/\[part='form-control-label'\]\s*\{[^}]*font-weight:\s*600/);
});

it('actually renders the legend with the semibold font-weight token, not just declares it in the stylesheet source', async () => {
  const el = (await fixture(html`<lr-checkbox-group label="Topics"><lr-checkbox>A</lr-checkbox></lr-checkbox-group>`)) as LyraCheckboxGroup;
  const legend = el.shadowRoot!.querySelector('[part~="form-control-label"]') as HTMLElement;
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
      expect((el!.form) === (null)).to.equal(true);
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

    (el.querySelectorAll('lr-checkbox')[0] as HTMLElement).shadowRoot!.querySelector('[part~="base"]')!
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
  const aBase = a.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  const bBase = b.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
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
  const hintPart = el.shadowRoot!.querySelector('[part~="hint"]') as HTMLElement;
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
  (el.querySelectorAll('lr-checkbox')[1] as HTMLElement).shadowRoot!.querySelector('[part~="base"]')!
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
    (el.querySelectorAll('lr-checkbox')[0] as HTMLElement).shadowRoot!.querySelector('[part~="base"]')!
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

  (el.querySelector('lr-checkbox')!.shadowRoot!.querySelector('[part~="base"]') as HTMLElement).click();

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

  expect((outer.shadowRoot!.querySelector('[part~="form-control-label"]') as HTMLElement).hidden).to.be.true;
  expect((outer.shadowRoot!.querySelector('[part~="hint"]') as HTMLElement).hidden).to.be.true;
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

  (inner.querySelector('lr-checkbox')!.shadowRoot!.querySelector('[part~="base"]') as HTMLElement).click();

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
  b.shadowRoot!.querySelector('[part~="base"]')!.dispatchEvent(
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

describe('form state restoration', () => {
  it('restores repeated FormData values silently and preserves duplicate-value cardinality', async () => {
    const originalWarn = console.warn;
    const warnings: unknown[][] = [];
    console.warn = (...args: unknown[]) => warnings.push(args);
    let form: HTMLFormElement;
    try {
      form = (await fixture(html`
        <form>
          <lr-checkbox-group name="topics">
            <lr-checkbox value="same">First duplicate</lr-checkbox>
            <lr-checkbox value="same">Second duplicate</lr-checkbox>
            <lr-checkbox value="other" checked>Other</lr-checkbox>
          </lr-checkbox-group>
        </form>
      `)) as HTMLFormElement;
    } finally {
      console.warn = originalWarn;
    }
    expect(warnings).to.have.lengthOf(1);
    const group = form.querySelector('lr-checkbox-group') as LyraCheckboxGroup;
    const boxes = [...group.querySelectorAll('lr-checkbox')] as LyraCheckbox[];
    let changes = 0;
    group.addEventListener('change', () => changes++);
    group.addEventListener('lr-change', () => changes++);
    const state = new FormData();
    state.append('topics', 'same');
    state.append('topics', 'other');

    group.formStateRestoreCallback(state, 'restore');
    await group.updateComplete;

    expect(boxes.map((box) => box.checked)).to.deep.equal([true, false, true]);
    expect(group.value).to.deep.equal(['same', 'other']);
    expect(new FormData(form).getAll('topics')).to.deep.equal(['same', 'other']);
    expect(changes, 'browser restoration is not a user edit').to.equal(0);
  });

  it('defers an early FormData restore until checkbox children are available', async () => {
    const group = document.createElement('lr-checkbox-group') as LyraCheckboxGroup;
    group.name = 'topics';
    const state = new FormData();
    state.append('topics', 'b');
    group.formStateRestoreCallback(state, 'restore');
    group.innerHTML = `
      <lr-checkbox value="a" checked>A</lr-checkbox>
      <lr-checkbox value="b">B</lr-checkbox>
    `;
    document.body.append(group);
    try {
      await group.updateComplete;
      await new Promise((resolve) => setTimeout(resolve, 0));
      await group.updateComplete;
      const boxes = [...group.querySelectorAll('lr-checkbox')] as LyraCheckbox[];
      expect(boxes.map((box) => box.checked)).to.deep.equal([false, true]);
      expect(group.value).to.deep.equal(['b']);
    } finally {
      group.remove();
    }
  });

  it('clears to a safe empty selection for malformed non-FormData state', async () => {
    const group = (await fixture(html`
      <lr-checkbox-group name="topics">
        <lr-checkbox value="a" checked>A</lr-checkbox>
      </lr-checkbox-group>
    `)) as LyraCheckboxGroup;

    expect(() => group.formStateRestoreCallback('not FormData', 'restore')).not.to.throw();
    expect(group.value).to.deep.equal([]);
    expect((group.querySelector('lr-checkbox') as LyraCheckbox).checked).to.be.false;
  });
});

// -- Form-association surface and its degraded-DOM fallback ------------------

it('exposes the native validity surface through ElementInternals', async () => {
  const el = (await fixture(html`
    <lr-checkbox-group label="Toppings" required>
      <lr-checkbox value="a">A</lr-checkbox>
      <lr-checkbox value="b">B</lr-checkbox>
    </lr-checkbox-group>
  `)) as LyraCheckboxGroup;
  await el.updateComplete;
  expect(el.willValidate, 'a form-associated control participates in validation').to.be.true;
  expect(el.validity.valueMissing, 'required with nothing checked is missing').to.be.true;
  expect(el.checkValidity()).to.be.false;
  expect(el.reportValidity()).to.be.false;

  (el.querySelector('lr-checkbox') as LyraCheckbox).click();
  await el.updateComplete;
  expect(el.validity.valid).to.be.true;
  expect(el.reportValidity()).to.be.true;
});

describe('ElementInternals fallback', () => {
  /** A DOM implementation without form-association support (e.g. a consumer's happy-dom suite):
   *  the component must still construct and answer inertly rather than throwing on import. */
  const withoutAttachInternals = async (
    impl: undefined | (() => never),
    assertion: (el: LyraCheckboxGroup) => void,
  ): Promise<void> => {
    const proto = HTMLElement.prototype as unknown as { attachInternals?: unknown };
    const original = proto.attachInternals;
    if (impl === undefined) delete proto.attachInternals;
    else proto.attachInternals = impl;
    try {
      const el = (await fixture(html`
        <lr-checkbox-group label="Toppings"><lr-checkbox value="a">A</lr-checkbox></lr-checkbox-group>
      `)) as LyraCheckboxGroup;
      await el.updateComplete;
      assertion(el);
    } finally {
      proto.attachInternals = original;
    }
  };

  it('answers inertly when attachInternals is missing', async () => {
    await withoutAttachInternals(undefined, (el) => {
      expect((el.form) === null).to.equal(true);
      expect(el.willValidate).to.be.false;
      expect(el.validationMessage).to.equal('');
      expect(el.checkValidity()).to.be.true;
      expect(el.reportValidity()).to.be.true;
      expect(el.validity).to.deep.equal({});
    });
  });

  it('answers inertly when attachInternals throws', async () => {
    await withoutAttachInternals(
      () => {
        throw new DOMException('unsupported');
      },
      (el) => {
        expect(el.willValidate).to.be.false;
        expect(el.reportValidity()).to.be.true;
      },
    );
  });

  it('keeps value/validity writes as no-ops instead of throwing', async () => {
    await withoutAttachInternals(undefined, (el) => {
      const box = el.querySelector('lr-checkbox') as LyraCheckbox;
      expect(() => box.click()).to.not.throw();
    });
  });
});

describe('size', () => {
  async function group(size: string): Promise<LyraCheckboxGroup> {
    const el = (await fixture(html`
      <lr-checkbox-group name="pick" label="Pick some" size=${size}>
        <lr-checkbox value="a">Alpha</lr-checkbox>
        <lr-checkbox value="b">Bravo</lr-checkbox>
        <lr-checkbox value="c">Charlie</lr-checkbox>
      </lr-checkbox-group>
    `)) as LyraCheckboxGroup;
    await el.updateComplete;
    return el;
  }

  it('defaults to the "m" tier and reflects it', async () => {
    const el = (await fixture(html`<lr-checkbox-group name="pick" label="Pick"></lr-checkbox-group>`)) as LyraCheckboxGroup;
    await el.updateComplete;
    expect(el.size).to.equal('m');
    expect(el.getAttribute('size')).to.equal('m');
  });

  it('grows the rendered group box from size="s" to size="l"', async () => {
    const small = await group('s');
    const large = await group('l');
    const smallOptions = (small.shadowRoot!.querySelector('[part~="options"]') as HTMLElement).getBoundingClientRect();
    const largeOptions = (large.shadowRoot!.querySelector('[part~="options"]') as HTMLElement).getBoundingClientRect();
    expect(largeOptions.height).to.be.greaterThan(smallOptions.height);
    expect(large.getBoundingClientRect().height).to.be.greaterThan(small.getBoundingClientRect().height);
  });

  it('propagates its size to every owned checkbox, including dynamic children', async () => {
    const el = await group('l');
    const initial = [...el.querySelectorAll('lr-checkbox')] as LyraCheckbox[];
    expect(initial.map((box) => box.size)).to.deep.equal(['l', 'l', 'l']);

    const added = document.createElement('lr-checkbox') as LyraCheckbox;
    added.value = 'd';
    added.textContent = 'Delta';
    el.append(added);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await added.updateComplete;
    expect(added.size).to.equal('l');

    el.size = 's';
    await el.updateComplete;
    await Promise.all([...el.querySelectorAll('lr-checkbox')].map((box) => box.updateComplete));
    expect([...el.querySelectorAll('lr-checkbox')].map((box) => box.size)).to.deep.equal(['s', 's', 's', 's']);
  });

  it('renders "small"/"large" at the same geometry as "s"/"l"', async () => {
    const s = await group('s');
    const small = await group('small');
    const l = await group('l');
    const large = await group('large');
    expect(small.getBoundingClientRect().height).to.be.closeTo(s.getBoundingClientRect().height, 0.5);
    expect(large.getBoundingClientRect().height).to.be.closeTo(l.getBoundingClientRect().height, 0.5);
  });

  it('keeps group size authoritative over an option-level size', async () => {
    const el = (await fixture(html`
      <lr-checkbox-group name="pick" label="Pick some" size="l">
        <lr-checkbox value="a" size="s">Alpha</lr-checkbox>
      </lr-checkbox-group>
    `)) as LyraCheckboxGroup;
    await el.updateComplete;
    expect((el.querySelector('lr-checkbox') as LyraCheckbox).size).to.equal('l');
  });

  it('restores group size when an owned option is resized later', async () => {
    const el = (await fixture(html`
      <lr-checkbox-group name="pick" label="Pick" size="l">
        <lr-checkbox value="a">Alpha</lr-checkbox>
      </lr-checkbox-group>
    `)) as LyraCheckboxGroup;
    const option = el.querySelector('lr-checkbox') as LyraCheckbox;
    option.size = 's';
    await new Promise((resolve) => setTimeout(resolve, 0));
    await option.updateComplete;
    expect(option.size).to.equal('l');
  });

  it('is accessible at a non-default tier', async () => {
    const el = await group('l');
    await expect(el).to.be.accessible();
  });
});

describe('orientation and mapped aliases', () => {
  it('defaults vertical, reflects orientation, and exports form-control-input on the options node', async () => {
    const el = (await fixture(html`
      <lr-checkbox-group label="Topics">
        <lr-checkbox value="a">A</lr-checkbox>
        <lr-checkbox value="b">B</lr-checkbox>
      </lr-checkbox-group>
    `)) as LyraCheckboxGroup & { orientation: 'horizontal' | 'vertical' };
    const options = el.shadowRoot!.querySelector('[part~="options"]') as HTMLElement;
    expect(el.orientation).to.equal('vertical');
    expect(el.getAttribute('orientation')).to.equal('vertical');
    expect(options.getAttribute('part')!.split(/\s+/)).to.include.members(['options', 'form-control-input']);
    expect(getComputedStyle(options).flexDirection).to.equal('column');

    el.orientation = 'horizontal';
    await el.updateComplete;
    expect(getComputedStyle(options).flexDirection).to.equal('row');
    await expect(el).to.be.accessible();
  });

  it('uses the WA --gap hook for real option spacing', async () => {
    const el = (await fixture(html`
      <lr-checkbox-group label="Topics" style="--gap: 37px">
        <lr-checkbox value="a">A</lr-checkbox>
        <lr-checkbox value="b">B</lr-checkbox>
      </lr-checkbox-group>
    `)) as LyraCheckboxGroup;
    const options = el.shadowRoot!.querySelector('[part~="options"]') as HTMLElement;
    expect(getComputedStyle(options).gap).to.equal('37px');
  });

  it('honors with-label/with-hint SSR presence hints', async () => {
    const el = (await fixture(html`
      <lr-checkbox-group with-label with-hint>
        <lr-checkbox value="a">A</lr-checkbox>
      </lr-checkbox-group>
    `)) as LyraCheckboxGroup;
    expect((el.shadowRoot!.querySelector('[part~="form-control-label"]') as HTMLElement).hidden).to.be.false;
    expect((el.shadowRoot!.querySelector('[part~="hint"]') as HTMLElement).hidden).to.be.false;
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

describe('lr-checkbox-group validity custom states', () => {
  const requiredGroup = () => html`
    <lr-checkbox-group name="topics" required label="Topics">
      <lr-checkbox value="a">A</lr-checkbox>
      <lr-checkbox value="b">B</lr-checkbox>
    </lr-checkbox-group>
  `;

  it('publishes required/optional and valid/invalid from the first render', async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(requiredGroup())) as LyraCheckboxGroup;
    await el.updateComplete;
    expect(el.matches(':state(required)'), 'required').to.be.true;
    expect(el.matches(':state(optional)'), 'optional').to.be.false;
    expect(el.matches(':state(invalid)'), 'invalid').to.be.true;
    expect(el.matches(':state(valid)'), 'valid').to.be.false;
  });

  it('withholds user-valid/user-invalid until a child checkbox is actually toggled', async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(requiredGroup())) as LyraCheckboxGroup;
    await el.updateComplete;
    expect(el.matches(':state(user-invalid)'), 'pristine required must not read as an error').to.be
      .false;

    const box = el.querySelector('lr-checkbox') as LyraCheckbox;
    box.click();
    await el.updateComplete;
    expect(el.matches(':state(valid)')).to.be.true;
    expect(el.matches(':state(user-valid)'), 'user-valid after a real toggle').to.be.true;
  });

  it('counts a reportValidity() call -- what a submit attempt runs -- as interaction', async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(requiredGroup())) as LyraCheckboxGroup;
    await el.updateComplete;
    expect(el.matches(':state(user-invalid)')).to.be.false;
    el.reportValidity();
    expect(el.matches(':state(user-invalid)')).to.be.true;
  });
});

describe('lr-checkbox-group setCustomValidity()', () => {
  it('blocks form submission and becomes the validationMessage', async () => {
    const form = (await fixture(html`
      <form>
        <lr-checkbox-group name="topics" label="Topics">
          <lr-checkbox value="a" checked>A</lr-checkbox>
        </lr-checkbox-group>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-checkbox-group') as LyraCheckboxGroup;
    let submits = 0;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submits += 1;
    });

    form.requestSubmit();
    expect(submits, 'an otherwise-valid group submits').to.equal(1);

    el.setCustomValidity('Pick at least one supported topic');
    expect(el.validationMessage).to.equal('Pick at least one supported topic');
    expect(el.validity.customError, 'customError').to.be.true;
    expect(el.checkValidity()).to.be.false;

    form.requestSubmit();
    expect(submits, 'a custom error blocks submission').to.equal(1);
  });

  it('survives an intrinsic revalidation', async () => {
    const el = (await fixture(html`
      <lr-checkbox-group name="topics" required label="Topics">
        <lr-checkbox value="a">A</lr-checkbox>
      </lr-checkbox-group>
    `)) as LyraCheckboxGroup;
    el.setCustomValidity('Server says no');
    (el.querySelector('lr-checkbox') as LyraCheckbox).click();
    await el.updateComplete;
    expect(el.value).to.deep.equal(['a']);
    expect(el.validity.valueMissing, 'valueMissing cleared').to.be.false;
    expect(el.validity.customError, 'custom error survives the recompute').to.be.true;
    expect(el.validationMessage).to.equal('Server says no');
  });

  // Native `setCustomValidity()` is sticky: `form.reset()` restores values, never the custom
  // error, which only another `setCustomValidity('')` clears. Matching that here.
  it('keeps the custom error across a form reset', async () => {
    const form = (await fixture(html`
      <form>
        <lr-checkbox-group name="topics" label="Topics">
          <lr-checkbox value="a">A</lr-checkbox>
        </lr-checkbox-group>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-checkbox-group') as LyraCheckboxGroup;
    el.setCustomValidity('Server says no');
    form.reset();
    await el.updateComplete;
    expect(el.validity.customError).to.be.true;
    expect(el.validationMessage).to.equal('Server says no');
  });

  it('restores the computed validity when cleared, rather than forcing the group valid', async () => {
    const el = (await fixture(html`
      <lr-checkbox-group name="topics" required label="Topics">
        <lr-checkbox value="a">A</lr-checkbox>
      </lr-checkbox-group>
    `)) as LyraCheckboxGroup;
    el.setCustomValidity('Server says no');
    el.setCustomValidity('');
    expect(el.validity.customError, 'custom error cleared').to.be.false;
    expect(
      el.validity.valueMissing,
      'an empty custom error must not force a still-empty required group valid',
    ).to.be.true;
    expect(el.checkValidity()).to.be.false;
    expect(el.validationMessage).to.not.equal('');
    (el.querySelector('lr-checkbox') as LyraCheckbox).click();
    await el.updateComplete;
    expect(el.checkValidity()).to.be.true;
  });

  it('drives the valid/invalid custom states', async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(html`
      <lr-checkbox-group name="topics" label="Topics">
        <lr-checkbox value="a">A</lr-checkbox>
      </lr-checkbox-group>
    `)) as LyraCheckboxGroup;
    await el.updateComplete;
    expect(el.matches(':state(valid)'), 'valid before').to.be.true;
    el.setCustomValidity('Server says no');
    expect(el.matches(':state(invalid)'), 'invalid while a custom error is set').to.be.true;
    expect(el.matches(':state(valid)')).to.be.false;
    el.setCustomValidity('');
    expect(el.matches(':state(valid)'), 'valid again once cleared').to.be.true;
  });
});

it('bars constraint validation while disabled, like a native disabled required control', async () => {
  const el = (await fixture(html`
    <lr-checkbox-group required disabled label="Topics">
      <lr-checkbox value="a">A</lr-checkbox>
    </lr-checkbox-group>
  `)) as LyraCheckboxGroup;
  await el.updateComplete;
  expect(el.validity.valueMissing, 'a barred group raises no violation').to.be.false;
  expect(el.checkValidity()).to.be.true;

  el.disabled = false;
  await el.updateComplete;
  expect(el.validity.valueMissing, 'the violation returns once it is enforceable again').to.be.true;
});

describe('touched state and blur', () => {
  it('marks touched on a real blur', async () => {
    const el = (await fixture(html`<lr-checkbox-group><lr-checkbox value="a">A</lr-checkbox></lr-checkbox-group>`)) as LyraCheckboxGroup;
    const internal = el as unknown as { touched: boolean };
    const box = el.querySelector('lr-checkbox') as LyraCheckbox;
    box.focus();
    expect(internal.touched, 'not yet touched before any blur').to.be.false;
    box.blur();
    expect(internal.touched, 'a real blur marks the group touched').to.be.true;
  });

  it('does not mark touched from a blur the platform forces when a focused child checkbox becomes disabled', async () => {
    const el = (await fixture(html`<lr-checkbox-group><lr-checkbox value="a">A</lr-checkbox></lr-checkbox-group>`)) as LyraCheckboxGroup;
    const internal = el as unknown as { touched: boolean };
    const box = el.querySelector('lr-checkbox') as LyraCheckbox;
    box.focus();
    expect(document.activeElement === box, 'the checkbox must actually hold focus for this test to be meaningful').to.be.true;

    // Disabling a focused checkbox is plain native HTML behavior -- the browser force-blurs it,
    // the same way it force-blurs a focused native input/select/textarea/button that becomes
    // disabled. That is not a real user interaction. Whether this exact nested shape reliably
    // force-blurs on every engine is not asserted as a precondition (confirmed on Chromium;
    // Firefox/WebKit were observed not always doing so for a checkbox nested inside a group) --
    // only the regression contract below: whichever way an engine behaves, the group must not end
    // up touched from it.
    box.disabled = true;
    try {
      await waitUntil(() => document.activeElement !== box, undefined, { timeout: 1000 });
    } catch {
      /* This engine does not force-blur this shape; touched staying false is still what matters. */
    }
    expect(internal.touched, 'a platform-forced blur from disabling must not mark the group touched').to.be.false;
  });

  it('does not mark touched from a blur the platform forces when an ancestor fieldset disables a focused child checkbox', async () => {
    // Unlike the element's own `disabled` attribute (previous test, consistent across engines),
    // whether an ancestor <fieldset disabled> cascading to a focused custom checkbox ALSO
    // force-blurs it is engine-dependent -- confirmed empirically (see lr-checkbox's own
    // equivalent test) that Chromium does, but Firefox and WebKit do not force-blur for the
    // fieldset-cascade path specifically. So this does not assert the blur itself as a
    // precondition, only the regression contract: whichever way this engine behaves, the group
    // must not end up touched from it.
    const form = (await fixture(html`
      <form>
        <fieldset>
          <lr-checkbox-group><lr-checkbox value="a">A</lr-checkbox></lr-checkbox-group>
        </fieldset>
      </form>
    `)) as HTMLFormElement;
    const group = form.querySelector('lr-checkbox-group') as LyraCheckboxGroup;
    const internal = group as unknown as { touched: boolean };
    const fieldset = form.querySelector('fieldset') as HTMLFieldSetElement;
    const box = group.querySelector('lr-checkbox') as LyraCheckbox;
    box.focus();
    expect(document.activeElement === box).to.be.true;

    fieldset.disabled = true;
    expect(internal.touched, 'a fieldset-cascaded disable-forced blur must not mark the group touched').to.be.false;
  });
});

it('renders the required marker from the shared themeable rule, not a literal span', async () => {
  const el = (await fixture(html`
    <lr-checkbox-group required label="Topics"><lr-checkbox value="a">A</lr-checkbox></lr-checkbox-group>
  `)) as LyraCheckboxGroup;
  await el.updateComplete;
  const label = el.shadowRoot!.querySelector('[part~="form-control-label"]') as HTMLElement;
  expect(getComputedStyle(label, '::after').content).to.contain('*');
  expect(label.querySelector('span[aria-hidden]'), 'no hand-rolled glyph element').to.equal(null);

  el.style.setProperty('--lr-form-control-required-content', "''");
  await el.updateComplete;
  expect(getComputedStyle(label, '::after').content).to.not.contain('*');
});

it('contains long horizontal options in an exact 320px RTL allocation', async () => {
  const long = 'LocalizedUnbrokenCheckboxGroupOption'.repeat(32);
  const wrapper = await fixture<HTMLElement>(html`
    <div dir="rtl" style="inline-size:320px;max-inline-size:320px;overflow:auto">
      <lr-checkbox-group
        orientation="horizontal"
        label=${long}
        hint=${long}
        style="max-inline-size:100%"
      >
        <lr-checkbox value="a">${long}</lr-checkbox>
        <lr-checkbox value="b">${long}</lr-checkbox>
      </lr-checkbox-group>
    </div>
  `);
  const group = wrapper.querySelector('lr-checkbox-group') as LyraCheckboxGroup;
  const options = group.shadowRoot!.querySelector<HTMLElement>('[part~="options"]')!;
  expect(wrapper.scrollWidth).to.be.at.most(wrapper.clientWidth);
  expect(options.scrollWidth).to.be.at.most(options.clientWidth);
});

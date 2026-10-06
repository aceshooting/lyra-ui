import { expect, fixture, html } from '@open-wc/testing';
import {
  isImplicitSubmission,
  isNativeSubmitter,
  findImplicitSubmitter,
  findDefaultButton,
  submitFormImplicitly,
  submitOnEnter,
} from './submit-on-enter.js';
import '../components/forms/button/button.js';
import type { LyraButton } from '../components/forms/button/button.class.js';

const enterEvent = (init: KeyboardEventInit = {}): KeyboardEvent =>
  new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true, cancelable: true, ...init });

/** Counts `submit` events and cancels them, so a real submission can never navigate the test page. */
function countSubmits(form: HTMLFormElement): () => number {
  let submits = 0;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submits += 1;
  });
  return () => submits;
}

// -- isImplicitSubmission() -----------------------------------------------

it('accepts only a bare, un-vetoed, non-composing Enter', () => {
  expect(isImplicitSubmission(enterEvent()), 'a bare Enter').to.be.true;
  expect(isImplicitSubmission(new KeyboardEvent('keydown', { key: 'a' })), 'a non-Enter key').to.be.false;
});

it('rejects Enter held with any modifier — that is a shortcut, not implicit submission', () => {
  for (const modifier of ['shiftKey', 'ctrlKey', 'altKey', 'metaKey'] as const) {
    expect(isImplicitSubmission(enterEvent({ [modifier]: true })), modifier).to.be.false;
  }
});

it('rejects an IME composition Enter, including the keyCode 229 fallback', () => {
  expect(isImplicitSubmission(enterEvent({ isComposing: true })), 'isComposing').to.be.false;
  expect(isImplicitSubmission(enterEvent({ keyCode: 229 })), 'keyCode 229').to.be.false;
});

it('rejects a keydown a listener above it already vetoed', () => {
  const event = enterEvent();
  event.preventDefault();
  expect(isImplicitSubmission(event)).to.be.false;
});

// -- findImplicitSubmitter() ----------------------------------------------

it('resolves the first enabled submit control, skipping disabled ones and non-submit buttons', async () => {
  const form = (await fixture(html`
    <form>
      <input name="q" />
      <button type="button" id="plain">Plain</button>
      <button type="submit" id="off" disabled>Off</button>
      <button type="submit" id="go">Go</button>
      <button type="submit" id="later">Later</button>
    </form>
  `)) as HTMLFormElement;
  expect(findImplicitSubmitter(form)?.id).to.equal('go');
});

it('resolves an lr-button[type=submit] as the submitter, even though it is not a native one', async () => {
  const form = (await fixture(html`
    <form><input name="q" /><lr-button id="go" type="submit">Go</lr-button></form>
  `)) as HTMLFormElement;
  expect(findImplicitSubmitter(form)?.id).to.equal('go');
});

it('returns null when the form has no submit control at all', async () => {
  const form = (await fixture(html`
    <form><input name="q" /><button type="button">Plain</button></form>
  `)) as HTMLFormElement;
  expect(findImplicitSubmitter(form)).to.equal(null);
});

it('recognizes foreign-created native submit controls after adoption', () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  try {
    const frameDocument = frame.contentDocument!;
    const frameWindow = frame.contentWindow!;
    const foreignForm = frameDocument.createElement('form');
    foreignForm.innerHTML = `
      <input name="q">
      <button type="submit" id="off" disabled>Off</button>
      <input type="submit" id="go" value="Go">
    `;
    const foreignSubmitter = foreignForm.querySelector('#go')!;
    expect(foreignSubmitter instanceof frameWindow.HTMLInputElement, 'the creator-realm brand').to.be.true;
    expect(foreignSubmitter instanceof HTMLInputElement, 'not the ambient-realm brand').to.be.false;

    const adoptedForm = document.adoptNode(foreignForm);
    document.body.append(adoptedForm);
    expect(findImplicitSubmitter(adoptedForm)?.id).to.equal('go');
    adoptedForm.remove();
  } finally {
    frame.remove();
  }
});

it('classifies native controls structurally when ambient element constructors are unavailable', () => {
  const inertDocument = document.implementation.createHTMLDocument('form realm');
  const form = inertDocument.createElement('form');
  form.innerHTML = '<input name="q"><button type="submit" id="go">Go</button>';
  const runtime = globalThis as unknown as {
    HTMLButtonElement?: typeof HTMLButtonElement;
    HTMLInputElement?: typeof HTMLInputElement;
  };
  const NativeButton = runtime.HTMLButtonElement;
  const NativeInput = runtime.HTMLInputElement;
  try {
    runtime.HTMLButtonElement = undefined;
    runtime.HTMLInputElement = undefined;
    expect(findImplicitSubmitter(form)?.id).to.equal('go');
  } finally {
    runtime.HTMLButtonElement = NativeButton;
    runtime.HTMLInputElement = NativeInput;
  }
});

it('rejects a button-shaped element outside the HTML namespace', () => {
  const foreignButton = document.createElementNS('http://www.w3.org/2000/svg', 'button');
  Object.defineProperty(foreignButton, 'type', { configurable: true, value: 'submit' });

  expect(isNativeSubmitter(foreignButton)).to.be.false;
});

it('treats a submitter as enabled when the DOM cannot evaluate :disabled', async () => {
  const form = (await fixture(html`
    <form><button id="go" type="submit">Go</button></form>
  `)) as HTMLFormElement;
  const button = form.querySelector('button')!;
  Object.defineProperty(button, 'matches', {
    configurable: true,
    value() {
      throw new DOMException('Selector unsupported', 'NotSupportedError');
    },
  });

  expect(findImplicitSubmitter(form)?.id).to.equal('go');
});

// -- HTML implicit submission: the default button decides ----------------
// The HTML Standard's steps: the default button is the FIRST submit button in tree order. When it
// exists, implicit submission clicks it only if it is not disabled; a disabled default button
// means nothing is submitted. Only a form with no submit button at all falls back to submitting
// from the form itself, and then only while at most one field blocks implicit submission.

it('resolves the default button as the first submit control, whatever its disabled state', async () => {
  const form = (await fixture(html`
    <form>
      <input name="q" />
      <button type="button" id="plain">Plain</button>
      <button type="submit" id="off" disabled>Off</button>
      <button type="submit" id="go">Go</button>
    </form>
  `)) as HTMLFormElement;
  expect(findDefaultButton(form)?.id).to.equal('off');
});

it('submits nothing when the default button is disabled, even with a later enabled submit button', async () => {
  const form = (await fixture(html`
    <form>
      <input id="field" name="q" value="hi" />
      <button type="submit" id="save" disabled>Save</button>
      <button type="submit" id="delete" formaction="/delete">Delete</button>
    </form>
  `)) as HTMLFormElement;
  const submits = countSubmits(form);
  let deleteClicks = 0;
  form.querySelector('#delete')!.addEventListener('click', () => deleteClicks++);

  expect(submitOnEnter(form.querySelector('#field') as HTMLInputElement, enterEvent())).to.be.false;
  expect(submits()).to.equal(0);
  expect(deleteClicks, 'a later submit button is never activated in its place').to.equal(0);
});

it('submits nothing when the only submit button is disabled, even from a single field', async () => {
  const form = (await fixture(html`
    <form><input id="field" name="q" value="hi" /><button type="submit" disabled>Save</button></form>
  `)) as HTMLFormElement;
  const submits = countSubmits(form);

  expect(submitOnEnter(form.querySelector('#field') as HTMLInputElement, enterEvent())).to.be.false;
  expect(submits(), 'the form has a default button, so the no-button fallback never applies').to.equal(0);
});

it('treats a default button disabled by its fieldset as blocking implicit submission', async () => {
  const form = (await fixture(html`
    <form>
      <input id="field" name="q" value="hi" />
      <fieldset disabled><button type="submit" id="save">Save</button></fieldset>
      <button type="submit" id="other">Other</button>
    </form>
  `)) as HTMLFormElement;
  const submits = countSubmits(form);

  expect(submitOnEnter(form.querySelector('#field') as HTMLInputElement, enterEvent())).to.be.false;
  expect(submits()).to.equal(0);
});

it('treats a disabled lr-button default button as blocking implicit submission', async () => {
  const form = (await fixture(html`
    <form>
      <input id="field" name="q" value="hi" />
      <lr-button id="save" type="submit" disabled>Save</lr-button>
      <button type="submit" id="other">Other</button>
    </form>
  `)) as HTMLFormElement;
  await (form.querySelector('#save') as LyraButton).updateComplete;
  const submits = countSubmits(form);

  expect(submitOnEnter(form.querySelector('#field') as HTMLInputElement, enterEvent())).to.be.false;
  expect(submits()).to.equal(0);
});

it('activates an enabled default button even when a later submit button is disabled', async () => {
  const form = (await fixture(html`
    <form>
      <input id="field" name="q" value="hi" />
      <button type="submit" id="first">First</button>
      <button type="submit" id="second" disabled>Second</button>
    </form>
  `)) as HTMLFormElement;
  let submitterId: string | null = null;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submitterId = ((event as SubmitEvent).submitter as HTMLElement | null)?.id ?? null;
  });

  expect(submitOnEnter(form.querySelector('#field') as HTMLInputElement, enterEvent())).to.be.true;
  expect(submitterId).to.equal('first');
});

it('submitFormImplicitly runs the same default-button steps without a keystroke', async () => {
  const blocked = (await fixture(html`
    <form><input name="q" /><button type="submit" disabled>Save</button><button type="submit">Next</button></form>
  `)) as HTMLFormElement;
  const blockedSubmits = countSubmits(blocked);
  expect(submitFormImplicitly(blocked)).to.be.false;
  expect(blockedSubmits()).to.equal(0);

  const open = (await fixture(html`
    <form><input name="q" /><button type="submit" id="go" name="intent" value="go">Go</button></form>
  `)) as HTMLFormElement;
  let submitterId: string | null = null;
  const order: string[] = [];
  open.addEventListener('submit', (event) => {
    event.preventDefault();
    order.push('submit');
    submitterId = ((event as SubmitEvent).submitter as HTMLElement | null)?.id ?? null;
  });
  expect(submitFormImplicitly(open, { beforeSubmit: () => order.push('before') })).to.be.true;
  expect(order.join(',')).to.equal('before,submit');
  expect(submitterId).to.equal('go');

  const crowded = (await fixture(html`
    <form><input name="a" /><input name="b" /></form>
  `)) as HTMLFormElement;
  const crowdedSubmits = countSubmits(crowded);
  expect(submitFormImplicitly(crowded)).to.be.false;
  expect(crowdedSubmits()).to.equal(0);
});

// -- submitOnEnter() ------------------------------------------------------

it('submits through the native submit button, naming it as SubmitEvent.submitter', async () => {
  const form = (await fixture(html`
    <form><input id="field" name="q" value="hi" /><button type="submit" id="go">Go</button></form>
  `)) as HTMLFormElement;
  const field = form.querySelector('#field') as HTMLInputElement;
  let submitter: HTMLElement | null = null;
  let submits = 0;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submits += 1;
    submitter = (event as SubmitEvent).submitter as HTMLElement | null;
    // Compare an id, never the node itself -- a DOM node as chai's actual/expected hangs the file.
  });

  expect(submitOnEnter(field, enterEvent()), 'reports that it submitted').to.be.true;
  expect(submits).to.equal(1);
  expect(submitter && (submitter as HTMLElement).id).to.equal('go');
});

it('submits the platform form owner even when it is not an ancestor', async () => {
  const container = (await fixture(html`
    <div>
      <form id="external-owner"><button type="submit" id="go">Go</button></form>
      <input id="field" name="q" form="external-owner" value="hi" />
    </div>
  `)) as HTMLDivElement;
  const form = container.querySelector('form')!;
  const field = container.querySelector('#field') as HTMLInputElement;
  const submits = countSubmits(form);

  expect(field.closest('form')).to.equal(null);
  expect(field.form?.id).to.equal('external-owner');
  expect(submitOnEnter(field, enterEvent())).to.be.true;
  expect(submits()).to.equal(1);
});

it('falls back to a custom host ancestor when no form-owner API exists', async () => {
  const form = (await fixture(html`
    <form><implicit-submit-host id="field"></implicit-submit-host><button type="submit">Go</button></form>
  `)) as HTMLFormElement;
  const host = form.querySelector('implicit-submit-host') as HTMLElement;
  const submits = countSubmits(form);

  expect(submitOnEnter(host, enterEvent())).to.be.true;
  expect(submits()).to.equal(1);
});

it('contains throwing form-owner APIs and hostile returned owners', () => {
  const throwingMethod = Object.assign(document.createElement('div'), {
    getForm(): unknown {
      throw new Error('form owner unavailable');
    },
  });

  const throwingProperty = document.createElement('div');
  Object.defineProperty(throwingProperty, 'form', {
    configurable: true,
    get() {
      throw new Error('form property unavailable');
    },
  });

  const hostileOwner = new Proxy({}, {
    get(_target, property) {
      if (property === 'namespaceURI') throw new Error('owner identity unavailable');
      return undefined;
    },
  });
  const hostileMethod = Object.assign(document.createElement('div'), {
    getForm: () => hostileOwner,
  });

  expect(submitOnEnter(throwingMethod, enterEvent())).to.be.false;
  expect(submitOnEnter(throwingProperty, enterEvent())).to.be.false;
  expect(submitOnEnter(hostileMethod, enterEvent())).to.be.false;
});

it('does not fall back to an ancestor when an explicit form owner is unresolved', async () => {
  const form = (await fixture(html`
    <form>
      <input id="field" name="q" form="missing-owner" value="hi" />
      <button type="submit">Go</button>
    </form>
  `)) as HTMLFormElement;
  const field = form.querySelector('#field') as HTMLInputElement;
  const submits = countSubmits(form);

  expect(field.form).to.equal(null);
  expect(submitOnEnter(field, enterEvent())).to.be.false;
  expect(submits()).to.equal(0);
});

it('clicks an lr-button submitter instead of handing it to requestSubmit(), which would throw', async () => {
  const form = (await fixture(html`
    <form><input id="field" name="q" value="hi" /><lr-button id="go" type="submit">Go</lr-button></form>
  `)) as HTMLFormElement;
  const field = form.querySelector('#field') as HTMLInputElement;
  const submits = countSubmits(form);
  const button = form.querySelector('#go') as LyraButton;
  await button.updateComplete;

  expect(submitOnEnter(field, enterEvent())).to.be.true;
  expect(submits(), 'the custom submitter routed through its own click()').to.equal(1);
});

it('never submits on a held modifier, during IME composition, or after a veto', async () => {
  const form = (await fixture(html`
    <form><input id="field" name="q" value="hi" /><button type="submit">Go</button></form>
  `)) as HTMLFormElement;
  const field = form.querySelector('#field') as HTMLInputElement;
  const submits = countSubmits(form);

  expect(submitOnEnter(field, enterEvent({ shiftKey: true }))).to.be.false;
  expect(submitOnEnter(field, enterEvent({ metaKey: true }))).to.be.false;
  expect(submitOnEnter(field, enterEvent({ isComposing: true }))).to.be.false;
  const vetoed = enterEvent();
  vetoed.preventDefault();
  expect(submitOnEnter(field, vetoed)).to.be.false;
  expect(submits()).to.equal(0);

  expect(submitOnEnter(field, enterEvent()), 'a bare Enter still submits').to.be.true;
  expect(submits()).to.equal(1);
});

it('submits a submit-button-less form only while the pressed control is its one blocking field', async () => {
  const alone = (await fixture(html`
    <form><input id="only" name="q" value="hi" /></form>
  `)) as HTMLFormElement;
  const aloneSubmits = countSubmits(alone);
  expect(submitOnEnter(alone.querySelector('#only') as HTMLInputElement, enterEvent())).to.be.true;
  expect(aloneSubmits(), 'one text field and no submit button still submits, as native does').to.equal(1);

  const crowded = (await fixture(html`
    <form><input id="a" name="a" /><input id="b" name="b" /></form>
  `)) as HTMLFormElement;
  const crowdedSubmits = countSubmits(crowded);
  expect(submitOnEnter(crowded.querySelector('#a') as HTMLInputElement, enterEvent())).to.be.false;
  expect(crowdedSubmits(), 'two blocking fields and no submit button never submits, as native does').to.equal(0);
});

it('does not count a non-input native control as an implicit-submission blocker', async () => {
  const form = (await fixture(html`
    <form><input id="field" name="q" /><select name="scope"><option>All</option></select></form>
  `)) as HTMLFormElement;
  const submits = countSubmits(form);

  expect(submitOnEnter(form.querySelector('#field') as HTMLInputElement, enterEvent())).to.be.true;
  expect(submits()).to.equal(1);
});

it('preserves submitter and blocking-field semantics for foreign-created controls after adoption', () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  try {
    const frameDocument = frame.contentDocument!;

    const foreignForm = frameDocument.createElement('form');
    foreignForm.innerHTML = `
      <input id="field" name="q">
      <button type="submit" id="go" name="intent" value="save">Go</button>
    `;
    const adoptedForm = document.adoptNode(foreignForm);
    document.body.append(adoptedForm);
    const field = adoptedForm.querySelector('#field') as HTMLInputElement;
    let submitterId: string | null = null;
    adoptedForm.addEventListener('submit', (event) => {
      event.preventDefault();
      submitterId = ((event as SubmitEvent).submitter as HTMLElement | null)?.id ?? null;
    });

    expect(submitOnEnter(field, enterEvent())).to.be.true;
    expect(submitterId).to.equal('go');
    adoptedForm.remove();

    const foreignCrowded = frameDocument.createElement('form');
    foreignCrowded.innerHTML = '<input id="a" name="a"><input name="b">';
    const adoptedCrowded = document.adoptNode(foreignCrowded);
    document.body.append(adoptedCrowded);
    const submits = countSubmits(adoptedCrowded);

    expect(submitOnEnter(adoptedCrowded.querySelector('#a') as HTMLInputElement, enterEvent())).to.be.false;
    expect(submits()).to.equal(0);
    adoptedCrowded.remove();
  } finally {
    frame.remove();
  }
});

it('runs the form\'s own constraint validation, so an invalid field blocks the submission', async () => {
  const form = (await fixture(html`
    <form><input id="field" name="q" required /><button type="submit">Go</button></form>
  `)) as HTMLFormElement;
  const submits = countSubmits(form);
  submitOnEnter(form.querySelector('#field') as HTMLInputElement, enterEvent());
  expect(submits()).to.equal(0);
});

it('leaves a form-less host alone rather than throwing', async () => {
  const orphan = (await fixture(html`<input id="lonely" />`)) as HTMLInputElement;
  expect(submitOnEnter(orphan, enterEvent())).to.be.false;
});

it('runs beforeSubmit ahead of the submission, and not at all when nothing is submitted', async () => {
  const form = (await fixture(html`
    <form><input id="field" name="q" value="hi" /><button type="submit">Go</button></form>
  `)) as HTMLFormElement;
  const order: string[] = [];
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    order.push('submit');
  });
  const field = form.querySelector('#field') as HTMLInputElement;

  submitOnEnter(field, enterEvent(), { beforeSubmit: () => order.push('before') });
  expect(order.join(',')).to.equal('before,submit');

  submitOnEnter(field, enterEvent({ isComposing: true }), { beforeSubmit: () => order.push('never') });
  expect(order.join(','), 'a rejected keystroke commits nothing').to.equal('before,submit');
});

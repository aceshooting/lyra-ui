import { expect, fixture, html } from '@open-wc/testing';
import { isImplicitSubmission, findImplicitSubmitter, submitOnEnter } from './submit-on-enter.js';
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

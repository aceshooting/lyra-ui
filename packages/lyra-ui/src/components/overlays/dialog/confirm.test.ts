import { expect, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { confirm, type ConfirmOptions } from './confirm.js';
import { registerLyraLocale, setLyraLocale } from '../../../internal/localization.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import '../../lr-dialog.js';
import type { LyraDialog } from '../../lr-dialog.js';
import type { LyraButton } from '../../lr-button.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';

function getMountedDialog(): LyraDialog {
  const dialog = [...document.querySelectorAll<LyraDialog>('lr-dialog')].at(-1);
  if (!dialog) throw new Error('expected confirm() to mount an lr-dialog');
  return dialog;
}

async function removed(): Promise<void> {
  const dialogs = [...document.querySelectorAll<LyraDialog>('lr-dialog')];
  await Promise.all(dialogs.map(async (dialog) => {
    if (!dialog.isConnected) return;
    await oneEvent(dialog, 'lr-after-hide');
    expect(dialog.isConnected, 'confirmation is removed when its exit lifecycle completes').to.equal(false);
  }));
  expect(document.querySelectorAll('lr-dialog').length).to.equal(0);
}

afterEach(removed);

/** A host `click()` on lr-button forwards to its rendered control, so wait for the first render. */
async function press(button: LyraButton): Promise<void> {
  await button.updateComplete;
  button.click();
}

function footerButtons(dialog: LyraDialog): [LyraButton, LyraButton] {
  // The actions carry slot="footer" directly (no wrapping element).
  const buttons = Array.from(dialog.querySelectorAll<LyraButton>('lr-button[slot="footer"]'));
  const cancelButton = buttons[0];
  const confirmButton = buttons[1];
  if (!cancelButton || !confirmButton) {
    throw new Error('expected confirm() to render cancel and confirm footer buttons');
  }
  return [cancelButton, confirmButton];
}

it('resolves true and removes the dialog when the confirm button is clicked', async () => {
  const promise = confirm({ title: 'Proceed?' });
  const dialog = getMountedDialog();
  expect(dialog).to.exist;
  expect(dialog.open).to.be.true;

  await press(footerButtons(dialog)[1]); // [cancel, confirm]

  expect(await promise).to.be.true;
  await removed();
});

it('resolves false and removes the dialog when the cancel button is clicked', async () => {
  const promise = confirm({ title: 'Proceed?' });
  const dialog = getMountedDialog();

  await press(footerButtons(dialog)[0]);

  expect(await promise).to.be.false;
  await removed();
});

it('resolves false and removes the dialog on Escape', async () => {
  const promise = confirm({ title: 'Proceed?' });
  await getMountedDialog().updateComplete;

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

  expect(await promise).to.be.false;
  await removed();
});

it('resolves false and removes the dialog on a backdrop click', async () => {
  const promise = confirm({ title: 'Proceed?' });
  const dialog = getMountedDialog();
  await dialog.updateComplete;

  (dialog.shadowRoot!.querySelector('[part~="backdrop"]') as HTMLElement).click();

  expect(await promise).to.be.false;
  await removed();
});

it('plays the exit animation and emits lr-after-hide before removing the dialog', async () => {
  const promise = confirm({ title: 'Proceed?' });
  const dialog = getMountedDialog();
  await dialog.updateComplete;
  const afterHide = oneEvent(dialog, 'lr-after-hide');
  await press(footerButtons(dialog)[1]);
  expect(await promise).to.be.true;
  expect(dialog.isConnected, 'still mounted while animating out').to.equal(true);
  await afterHide;
  await removed();
});

for (const duration of ['0ms', '1200ms']) {
  it(`removes a confirmation after its configured ${duration} exit animation`, async () => {
    const result = confirm({ title: 'Proceed?' });
    const dialog = getMountedDialog();
    dialog.style.setProperty('--hide-duration', duration);
    await dialog.updateComplete;
    const removal = removed();
    await press(footerButtons(dialog)[1]);
    expect(await result).to.equal(true);
    await removal;
    await removed();
  });
}

it('renders no header close control, and both actions are registered lr-button elements', async () => {
  const promise = confirm({ title: 'Proceed?' });
  const dialog = getMountedDialog();
  await dialog.updateComplete;
  const hasCloseControl = dialog.shadowRoot!.querySelector('[part~="close-button"]') !== null;
  const [cancelButton, confirmButton] = footerButtons(dialog);
  const upgraded = [cancelButton, confirmButton].map((button) => button instanceof customElements.get('lr-button')!);
  const actions = [cancelButton.getAttribute('data-lr-confirm-action'), confirmButton.getAttribute('data-lr-confirm-action')];
  await press(cancelButton);
  expect(await promise).to.be.false;
  expect(hasCloseControl).to.equal(false);
  expect(upgraded).to.deep.equal([true, true]);
  expect(actions).to.deep.equal(['cancel', 'confirm']);
});

it('defaults cancelLabel to "Cancel" and confirmLabel to "Confirm"', async () => {
  const promise = confirm({ title: 'Proceed?' });
  const dialog = getMountedDialog();
  const [cancelButton, confirmButton] = footerButtons(dialog);
  expect(cancelButton.textContent).to.equal('Cancel');
  expect(confirmButton.textContent).to.equal('Confirm');

  await press(confirmButton);
  await promise;
});

it('honors custom confirmLabel/cancelLabel', async () => {
  const promise = confirm({ title: 'Proceed?', confirmLabel: 'Delete', cancelLabel: 'Keep' });
  const dialog = getMountedDialog();
  const [cancelButton, confirmButton] = footerButtons(dialog);
  expect(cancelButton.textContent).to.equal('Keep');
  expect(confirmButton.textContent).to.equal('Delete');

  await press(confirmButton);
  await promise;
});

it('falls through to a registered locale catalog for cancel/confirm when no label override is given', async () => {
  // ConfirmOptions has no `.strings`/`locale` field of its own -- the dialog is transient and
  // unparented at button-creation time, so the only way resolveLyraString() reaches a registered
  // catalog (rather than the hardcoded English default) is via the global active locale.
  // The catalog carries every key the transient dialog can read, not only the two this test
  // asserts on: strict-console platform lanes treat the dev-mode locale-fallback warning a
  // still-partial catalog triggers as fatal.
  registerLyraLocale('x-test-confirm', {
    cancel: 'Annuler',
    close: 'Fermer',
    confirm: 'Confirmer',
    fieldRequired: 'Requis',
  });
  setLyraLocale('x-test-confirm');

  try {
    const promise = confirm({ title: 'Proceed?' });
    const dialog = getMountedDialog();
    await dialog.updateComplete;
    const [cancelButton, confirmButton] = footerButtons(dialog);
    expect(cancelButton.textContent).to.equal('Annuler');
    expect(confirmButton.textContent).to.equal('Confirmer');

    await press(confirmButton);
    await promise;
  } finally {
    setLyraLocale('en');
  }
});

it('renders the description as body text when provided, omits it when not', async () => {
  const withDesc = confirm({ title: 'Proceed?', description: 'Are you sure?' });
  const dialogWithDesc = getMountedDialog();
  await dialogWithDesc.updateComplete;
  const description = dialogWithDesc.querySelector('p')!;
  expect(description.textContent).to.equal('Are you sure?');
  expect(getComputedStyle(description).marginBlockStart).to.equal('0px');

  await press(footerButtons(dialogWithDesc)[0]);
  await withDesc;

  const withoutDesc = confirm({ title: 'Proceed?' });
  const dialogWithoutDesc = getMountedDialog();
  expect((dialogWithoutDesc.querySelector('p')) == null).to.equal(true);
  await press(footerButtons(dialogWithoutDesc)[0]);
  await withoutDesc;
});

it('maps variant onto lr-button: brand by default, danger for destructive actions, cancel outlined', async () => {
  const neutral = confirm({ title: 'Proceed?' });
  const neutralDialog = getMountedDialog();
  const [neutralCancel, neutralConfirm] = footerButtons(neutralDialog);
  const neutralState = [neutralCancel.variant, neutralCancel.appearance, neutralConfirm.variant, neutralConfirm.appearance];
  await press(neutralCancel);
  await neutral;
  expect(neutralState).to.deep.equal(['neutral', 'outlined', 'brand', 'accent']);

  const danger = confirm({ title: 'Delete?', variant: 'danger' });
  const dangerDialog = getMountedDialog();
  const dangerState = footerButtons(dangerDialog)[1].variant;
  await press(footerButtons(dangerDialog)[0]);
  await danger;
  expect(dangerState).to.equal('danger');
});

it('applies --lr-button-* tokens to its actions', async () => {
  const promise = confirm({ title: 'Proceed?', className: 'x-themed-confirm' });
  const dialog = getMountedDialog();
  const style = document.createElement('style');
  style.textContent = '.x-themed-confirm { --lr-button-font-weight: 300; }';
  document.head.append(style);
  try {
    const [cancelButton, confirmButton] = footerButtons(dialog);
    await dialog.updateComplete;
    await cancelButton.updateComplete;
    await confirmButton.updateComplete;
    const weights = [cancelButton, confirmButton].map((button) =>
      getComputedStyle(button.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!).fontWeight,
    );
    expect(weights).to.deep.equal(['300', '300']);
  } finally {
    style.remove();
    await press(footerButtons(dialog)[0]);
    await promise;
  }
});

// 10.0.0 removed the `tone` alias for `variant`; a stale `tone` must stay inert.
it('no longer honors the removed "tone" spelling, rendering the neutral variant instead', async () => {
  const promise = confirm({ title: 'Delete?', tone: 'danger' } as unknown as ConfirmOptions);
  const dialog = getMountedDialog();
  const variant = footerButtons(dialog)[1].variant;
  await press(footerButtons(dialog)[0]);
  await promise;
  expect(variant).to.equal('brand');
});

it('renders the title as the dialog header title, which names the dialog', async () => {
  const promise = confirm({ title: 'Delete conversation?' });
  const dialog = getMountedDialog();
  await dialog.updateComplete;

  const heading = dialog.shadowRoot!.querySelector<HTMLElement>('[part~="heading"]')!;
  const panel = dialog.shadowRoot!.querySelector<HTMLElement>('[part~="panel"]')!;
  const headingText = heading.textContent?.trim();
  const level = heading.getAttribute('aria-level');
  const labelledBy = panel.getAttribute('aria-labelledby');
  const headingId = heading.id;
  const lightHeadings = dialog.querySelectorAll('h1, h2, h3, h4, h5, h6').length;

  await press(footerButtons(dialog)[0]);
  await promise;
  expect(headingText).to.equal('Delete conversation?');
  expect(level).to.equal('2');
  expect(labelledBy).to.equal(headingId);
  expect(lightHeadings).to.equal(0);
});

it('forwards size, headingLevel and className to the dialog', async () => {
  const promise = confirm({ title: 'Delete?', size: 'l', headingLevel: '4', className: ' first  second ' });
  const dialog = getMountedDialog();
  await dialog.updateComplete;
  const state = {
    size: dialog.getAttribute('size'),
    level: dialog.shadowRoot!.querySelector('[part~="heading"]')!.getAttribute('aria-level'),
    classes: [...dialog.classList],
  };
  await press(footerButtons(dialog)[0]);
  await promise;
  expect(state).to.deep.equal({ size: 'l', level: '4', classes: ['first', 'second'] });
});

it('keeps the description defaults below application rules', async () => {
  const promise = confirm({ title: 'Delete?', description: 'Gone for good.', className: 'x-quiet-confirm' });
  const dialog = getMountedDialog();
  const style = document.createElement('style');
  style.textContent = '.x-quiet-confirm p { color: rgb(1, 2, 3); }';
  document.head.append(style);
  try {
    await dialog.updateComplete;
    const description = dialog.querySelector('p')!;
    expect([description.isConnected, dialog.className, getComputedStyle(description).color]).to.deep.equal([true, 'x-quiet-confirm', 'rgb(1, 2, 3)']);
  } finally {
    style.remove();
    await press(footerButtons(dialog)[0]);
    await promise;
  }
});

it('returns focus to the opener after it settles', async () => {
  const opener = document.createElement('button');
  opener.textContent = 'Open';
  document.body.append(opener);
  try {
    await focusByKeyboard(opener);
    const promise = confirm({ title: 'Proceed?' });
    const dialog = getMountedDialog();
    await dialog.updateComplete;
    await press(footerButtons(dialog)[1]);
    expect(await promise).to.equal(true);
    await removed();
    await waitUntil(() => document.activeElement === opener, 'focus returns to the opener');
  } finally {
    opener.remove();
  }
});

it('mounts exactly one dialog per call and fully cleans it up after resolving', async () => {
  const promise = confirm({ title: 'Proceed?' });
  expect(document.querySelectorAll('lr-dialog').length).to.equal(1);

  await press(footerButtons(getMountedDialog())[1]);
  await promise;
  await removed();
});

it('does not resolve a second time when both buttons are somehow activated', async () => {
  // dialog.close() is idempotent once already closed, so only the first
  // activation should ever settle the promise -- guards against a
  // double-resolve if a consumer's own code (or a flaky double-click)
  // fires a second close.
  const promise = confirm({ title: 'Proceed?' });
  const dialog = getMountedDialog();
  const [cancelButton, confirmButton] = footerButtons(dialog);

  await press(confirmButton);
  await press(cancelButton); // the dialog (and its buttons) is already removed by this point, but simulate a stray call
  dialog.close('cancel');

  expect(await promise).to.be.true;
});

it('waits for capture-phase close vetoes before settling or removing the dialog', async () => {
  const promise = confirm({ title: 'Proceed?' });
  const dialog = getMountedDialog();
  let settled = false;
  void promise.then(() => { settled = true; });
  const veto = (event: Event): void => event.preventDefault();
  document.addEventListener('lr-close-request', veto, { capture: true });
  try {
    await press(footerButtons(dialog)[1]);
    await new Promise<void>((resolve) => queueMicrotask(resolve));

    expect(settled).to.be.false;
    expect(dialog.isConnected).to.be.true;
    expect(dialog.open).to.be.true;
  } finally {
    document.removeEventListener('lr-close-request', veto, { capture: true });
  }

  await press(footerButtons(dialog)[1]);
  expect(await promise).to.be.true;
  await removed();
});

it('resolves false instead of hanging when the dialog is removed from the DOM by something other than a button', async () => {
  const promise = confirm({ title: 'Proceed?' });
  const dialog = getMountedDialog();
  await dialog.updateComplete;

  dialog.remove();

  expect(await promise).to.be.false;
});

it('is accessible while open', async () => {
  const promise = confirm({ title: 'Delete conversation?', description: 'This cannot be undone.' });
  const dialog = getMountedDialog();
  await dialog.updateComplete;
  await expect(dialog).to.be.accessible();

  await press(footerButtons(dialog)[0]);
  await promise;
});


it('accepts a body-mounted confirmation above a native modal using the native pointer', async () => {
  const native = document.createElement('dialog');
  native.innerHTML = '<button>Original action</button>';
  document.body.append(native);
  native.showModal();
  const result = confirm({ title: 'Confirm within native modal' });
  const dialog = getMountedDialog();
  let settled: boolean | undefined;
  void result.then(value => { settled = value; });
  try {
    await dialog.updateComplete;
    const action = footerButtons(dialog)[1];
    await waitUntil(() => action.getBoundingClientRect().width > 0);
    const bounds = action.getBoundingClientRect();
    await sendMouse({ type: 'click', position: [Math.round(bounds.x + bounds.width / 2), Math.round(bounds.y + bounds.height / 2)] });
    await waitUntil(() => settled !== undefined);
    expect(settled).to.equal(true);
    expect(native.open).to.equal(true);
    await removed();
  } finally {
    dialog.remove();
    native.close();
    native.remove();
    await resetMouse();
  }
});

it('dismisses only the confirmation on native Escape and removes its transient host', async () => {
  const native = document.createElement('dialog');
  native.innerHTML = '<button>Original action</button>';
  document.body.append(native);
  native.showModal();
  const result = confirm({ title: 'Dismiss within native modal' });
  const dialog = getMountedDialog();
  let settled: boolean | undefined;
  void result.then(value => { settled = value; });
  try {
    await dialog.updateComplete;
    await sendKeys({ press: 'Escape' });
    await waitUntil(() => settled !== undefined);
    expect(settled).to.equal(false);
    expect(native.open).to.equal(true);
    await removed();
  } finally {
    dialog.remove();
    native.close();
    native.remove();
  }
});

it('waits for its own close and exit events when slotted content dismisses', async () => {
  const result = confirm({ title: 'Continue?' });
  const dialog = getMountedDialog();
  await dialog.updateComplete;
  const child = footerButtons(dialog)[0];
  child.dispatchEvent(new CustomEvent('lr-close', { bubbles: true, detail: { reason: 'cancel' } }));
  child.dispatchEvent(new CustomEvent('lr-after-hide', { bubbles: true }));
  const connected = dialog.isConnected;
  if (connected) await dialog.close('confirm');
  expect(connected).to.equal(true);
  expect(await result).to.equal(true);
});

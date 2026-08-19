import { expect } from '@open-wc/testing';
import { confirm, type ConfirmOptions } from './confirm.js';
import { registerLyraLocale, setLyraLocale } from '../../../internal/localization.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import './dialog.js';
import type { LyraDialog } from './dialog.js';

function getMountedDialog(): LyraDialog {
  return document.querySelector('lr-dialog') as LyraDialog;
}

function footerButtons(dialog: LyraDialog): HTMLButtonElement[] {
  // The buttons themselves carry slot="footer" directly (no wrapping
  // element), so the selector targets that attribute on <button> itself.
  return Array.from(dialog.querySelectorAll('button[slot="footer"]'));
}

it('resolves true and removes the dialog when the confirm button is clicked', async () => {
  const promise = confirm({ title: 'Proceed?' });
  const dialog = getMountedDialog();
  expect(dialog).to.exist;
  expect(dialog.open).to.be.true;

  footerButtons(dialog)[1].click(); // [cancel, confirm]

  expect(await promise).to.be.true;
  expect((document.querySelector('lr-dialog')) == null).to.be.true;
});

it('resolves false and removes the dialog when the cancel button is clicked', async () => {
  const promise = confirm({ title: 'Proceed?' });
  const dialog = getMountedDialog();

  footerButtons(dialog)[0].click();

  expect(await promise).to.be.false;
  expect((document.querySelector('lr-dialog')) == null).to.be.true;
});

it('resolves false and removes the dialog on Escape', async () => {
  const promise = confirm({ title: 'Proceed?' });
  await getMountedDialog().updateComplete;

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

  expect(await promise).to.be.false;
  expect((document.querySelector('lr-dialog')) == null).to.be.true;
});

it('resolves false and removes the dialog on a backdrop click', async () => {
  const promise = confirm({ title: 'Proceed?' });
  const dialog = getMountedDialog();
  await dialog.updateComplete;

  (dialog.shadowRoot!.querySelector('[part~="backdrop"]') as HTMLElement).click();

  expect(await promise).to.be.false;
  expect((document.querySelector('lr-dialog')) == null).to.be.true;
});

it('defaults cancelLabel to "Cancel" and confirmLabel to "Confirm"', async () => {
  const promise = confirm({ title: 'Proceed?' });
  const dialog = getMountedDialog();
  const [cancelButton, confirmButton] = footerButtons(dialog);
  expect(cancelButton.textContent).to.equal('Cancel');
  expect(confirmButton.textContent).to.equal('Confirm');

  confirmButton.click();
  await promise;
});

it('honors custom confirmLabel/cancelLabel', async () => {
  const promise = confirm({ title: 'Proceed?', confirmLabel: 'Delete', cancelLabel: 'Keep' });
  const dialog = getMountedDialog();
  const [cancelButton, confirmButton] = footerButtons(dialog);
  expect(cancelButton.textContent).to.equal('Keep');
  expect(confirmButton.textContent).to.equal('Delete');

  confirmButton.click();
  await promise;
});

it('falls through to a registered locale catalog for cancel/confirm when no label override is given', async () => {
  // ConfirmOptions has no `.strings`/`locale` field of its own -- the dialog is transient and
  // unparented at button-creation time, so the only way resolveLyraString() reaches a registered
  // catalog (rather than the hardcoded English default) is via the global active locale.
  registerLyraLocale('x-test-confirm', {
    cancel: 'Annuler',
    confirm: 'Confirmer',
  });
  setLyraLocale('x-test-confirm');

  try {
    const promise = confirm({ title: 'Proceed?' });
    const dialog = getMountedDialog();
    await dialog.updateComplete;
    const [cancelButton, confirmButton] = footerButtons(dialog);
    expect(cancelButton.textContent).to.equal('Annuler');
    expect(confirmButton.textContent).to.equal('Confirmer');

    confirmButton.click();
    await promise;
  } finally {
    setLyraLocale('en');
  }
});

it('renders the description as body text when provided, omits it when not', async () => {
  const withDesc = confirm({ title: 'Proceed?', description: 'Are you sure?' });
  const dialogWithDesc = getMountedDialog();
  expect(dialogWithDesc.querySelector('p')?.textContent).to.equal('Are you sure?');
  footerButtons(dialogWithDesc)[0].click();
  await withDesc;

  const withoutDesc = confirm({ title: 'Proceed?' });
  const dialogWithoutDesc = getMountedDialog();
  expect((dialogWithoutDesc.querySelector('p')) == null).to.equal(true);
  footerButtons(dialogWithoutDesc)[0].click();
  await withoutDesc;
});

it('fills the confirm button with --lr-color-brand by default, --lr-color-danger when variant is "danger"', async () => {
  const neutral = confirm({ title: 'Proceed?' });
  const neutralDialog = getMountedDialog();
  const neutralConfirm = footerButtons(neutralDialog)[1];
  const neutralBackground = neutralConfirm.style.background;
  const neutralColor = neutralConfirm.style.color;
  footerButtons(neutralDialog)[0].click();
  await neutral;
  expect(neutralBackground).to.include('--lr-color-brand');
  expect(neutralColor).to.include('--lr-color-on-brand');

  const danger = confirm({ title: 'Delete?', variant: 'danger' });
  const dangerDialog = getMountedDialog();
  const dangerConfirm = footerButtons(dangerDialog)[1];
  const dangerBackground = dangerConfirm.style.background;
  const dangerColor = dangerConfirm.style.color;
  footerButtons(dangerDialog)[0].click();
  await danger;
  expect(dangerBackground).to.include('--lr-color-danger');
  expect(dangerColor).to.include('--lr-color-on-danger');
});

// 10.0.0 removed the `tone` alias for `variant`. It shipped as a one-major back-compat spelling
// and `variant` already won whenever both were set, so nothing that reads `variant` changes here
// -- but a stale `tone` left behind by a 9.x consumer must now be inert rather than quietly
// styling the confirm button as destructive. Asserting equivalence to a no-options confirm is
// deliberate: it survives any later retokenizing of the neutral button, which a hard-coded
// `--lr-color-brand` string would not.
async function confirmButtonStyle(options: ConfirmOptions): Promise<[string, string]> {
  const promise = confirm(options);
  const dialog = getMountedDialog();
  const confirmButton = footerButtons(dialog)[1]!;
  const style: [string, string] = [confirmButton.style.background, confirmButton.style.color];
  footerButtons(dialog)[0]!.click();
  await promise;
  return style;
}

it('no longer honors the removed "tone" spelling, rendering the neutral variant instead', async () => {
  const stale = { title: 'Delete?', tone: 'danger' } as unknown as ConfirmOptions;
  const [staleBackground, staleColor] = await confirmButtonStyle(stale);
  const [neutralBackground, neutralColor] = await confirmButtonStyle({ title: 'Delete?' });

  expect(staleBackground).to.not.include('--lr-color-danger');
  expect(staleColor).to.not.include('--lr-color-on-danger');
  expect(staleBackground).to.equal(neutralBackground);
  expect(staleColor).to.equal(neutralColor);
});

it('lets "variant" through untouched when a stale "tone" sits alongside it', async () => {
  const both = { title: 'Delete?', variant: 'danger', tone: 'neutral' } as unknown as ConfirmOptions;
  const [background, color] = await confirmButtonStyle(both);

  expect(background).to.include('--lr-color-danger');
  expect(color).to.include('--lr-color-on-danger');
});

it('uses the title as the dialog heading, which drives aria-label', async () => {
  const promise = confirm({ title: 'Delete conversation?' });
  const dialog = getMountedDialog();
  await dialog.updateComplete;

  const heading = dialog.querySelector('h2') as HTMLElement;
  expect(heading.textContent).to.equal('Delete conversation?');
  const panel = dialog.shadowRoot!.querySelector('[part~="panel"]') as HTMLElement;
  expect(panel.getAttribute('aria-label')).to.equal('Delete conversation?');

  footerButtons(dialog)[0].click();
  await promise;
});

it('mounts exactly one dialog per call and fully cleans it up after resolving', async () => {
  const promise = confirm({ title: 'Proceed?' });
  expect(document.querySelectorAll('lr-dialog').length).to.equal(1);

  footerButtons(getMountedDialog())[1].click();
  await promise;

  expect(document.querySelectorAll('lr-dialog').length).to.equal(0);
});

it('does not resolve a second time when both buttons are somehow activated', async () => {
  // dialog.close() is idempotent once already closed, so only the first
  // activation should ever settle the promise -- guards against a
  // double-resolve if a consumer's own code (or a flaky double-click)
  // fires a second close.
  const promise = confirm({ title: 'Proceed?' });
  const dialog = getMountedDialog();
  const [cancelButton, confirmButton] = footerButtons(dialog);

  confirmButton.click();
  cancelButton.click(); // the dialog (and its buttons) is already removed by this point, but simulate a stray call
  dialog.close('cancel');

  expect(await promise).to.be.true;
});

it('waits for capture-phase close vetoes before settling or removing the dialog', async () => {
  const promise = confirm({ title: 'Proceed?' });
  const dialog = getMountedDialog();
  let settled = false;
  void promise.then(() => { settled = true; });
  const veto = (event: Event): void => event.preventDefault();
  document.addEventListener('lr-close', veto, { capture: true });
  try {
    footerButtons(dialog)[1].click();
    await new Promise<void>((resolve) => queueMicrotask(resolve));

    expect(settled).to.be.false;
    expect(dialog.isConnected).to.be.true;
    expect(dialog.open).to.be.true;
  } finally {
    document.removeEventListener('lr-close', veto, { capture: true });
  }

  footerButtons(dialog)[1].click();
  expect(await promise).to.be.true;
  expect(dialog.isConnected).to.be.false;
});

it('resolves false instead of hanging when the dialog is removed from the DOM by something other than a button', async () => {
  const promise = confirm({ title: 'Proceed?' });
  const dialog = getMountedDialog();
  await dialog.updateComplete;

  dialog.remove();

  expect(await promise).to.be.false;
});

it('gives both action buttons the design-system focus ring instead of the raw UA outline', async () => {
  const promise = confirm({ title: 'Proceed?' });
  const dialog = getMountedDialog();
  await dialog.updateComplete;
  const [cancelButton, confirmButton] = footerButtons(dialog);

  try {
    const ringColor = getComputedStyle(dialog).getPropertyValue('--lr-focus-ring-color');
    expect(ringColor.trim(), 'the focus-ring token resolves for a light-DOM child of the dialog').to.not.equal('');

    for (const button of [cancelButton, confirmButton]) {
      button!.focus();
      const style = getComputedStyle(button!);
      expect(style.outlineStyle, 'a tokenized ring, not the browser default').to.equal('solid');
      expect(Number.parseFloat(style.outlineWidth)).to.be.greaterThan(0);
    }
  } finally {
    cancelButton!.click();
    await promise;
  }
});

it('shifts both action buttons on hover, so the pointer cursor is not the only interactivity signal', async () => {
  const promise = confirm({ title: 'Proceed?' });
  const dialog = getMountedDialog();
  await dialog.updateComplete;
  const [cancelButton, confirmButton] = footerButtons(dialog);

  try {
    await resetMouse();
    for (const button of [cancelButton!, confirmButton!]) {
      const resting = getComputedStyle(button).backgroundColor;
      const box = button.getBoundingClientRect();
      await sendMouse({
        type: 'move',
        position: [Math.round(box.left + box.width / 2), Math.round(box.top + box.height / 2)],
      });
      expect(
        getComputedStyle(button).backgroundColor,
        'hovering must visibly change the fill',
      ).to.not.equal(resting);
      await resetMouse();
    }
  } finally {
    await resetMouse();
    cancelButton!.click();
    await promise;
  }
});

it('is accessible while open', async () => {
  const promise = confirm({ title: 'Delete conversation?', description: 'This cannot be undone.' });
  const dialog = getMountedDialog();
  await dialog.updateComplete;
  await expect(dialog).to.be.accessible();

  footerButtons(dialog)[0].click();
  await promise;
});

import { expect } from '@open-wc/testing';
import { confirm } from './confirm.js';
import './dialog.js';
import type { LyraDialog } from './dialog.js';

function getMountedDialog(): LyraDialog {
  return document.querySelector('lyra-dialog') as LyraDialog;
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
  expect(document.querySelector('lyra-dialog')).to.not.exist;
});

it('resolves false and removes the dialog when the cancel button is clicked', async () => {
  const promise = confirm({ title: 'Proceed?' });
  const dialog = getMountedDialog();

  footerButtons(dialog)[0].click();

  expect(await promise).to.be.false;
  expect(document.querySelector('lyra-dialog')).to.not.exist;
});

it('resolves false and removes the dialog on Escape', async () => {
  const promise = confirm({ title: 'Proceed?' });
  await getMountedDialog().updateComplete;

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

  expect(await promise).to.be.false;
  expect(document.querySelector('lyra-dialog')).to.not.exist;
});

it('resolves false and removes the dialog on a backdrop click', async () => {
  const promise = confirm({ title: 'Proceed?' });
  const dialog = getMountedDialog();
  await dialog.updateComplete;

  (dialog.shadowRoot!.querySelector('[part="backdrop"]') as HTMLElement).click();

  expect(await promise).to.be.false;
  expect(document.querySelector('lyra-dialog')).to.not.exist;
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

it('renders the description as body text when provided, omits it when not', async () => {
  const withDesc = confirm({ title: 'Proceed?', description: 'Are you sure?' });
  const dialogWithDesc = getMountedDialog();
  expect(dialogWithDesc.querySelector('p')?.textContent).to.equal('Are you sure?');
  footerButtons(dialogWithDesc)[0].click();
  await withDesc;

  const withoutDesc = confirm({ title: 'Proceed?' });
  const dialogWithoutDesc = getMountedDialog();
  expect(dialogWithoutDesc.querySelector('p')).to.not.exist;
  footerButtons(dialogWithoutDesc)[0].click();
  await withoutDesc;
});

it('fills the confirm button with --lyra-color-brand by default, --lyra-color-danger when tone is "danger"', async () => {
  const neutral = confirm({ title: 'Proceed?' });
  const neutralDialog = getMountedDialog();
  const neutralConfirm = footerButtons(neutralDialog)[1];
  const neutralBackground = neutralConfirm.style.background;
  const neutralColor = neutralConfirm.style.color;
  footerButtons(neutralDialog)[0].click();
  await neutral;
  expect(neutralBackground).to.include('--lyra-color-brand');
  expect(neutralColor).to.include('--lyra-color-on-brand');

  const danger = confirm({ title: 'Delete?', tone: 'danger' });
  const dangerDialog = getMountedDialog();
  const dangerConfirm = footerButtons(dangerDialog)[1];
  const dangerBackground = dangerConfirm.style.background;
  const dangerColor = dangerConfirm.style.color;
  footerButtons(dangerDialog)[0].click();
  await danger;
  expect(dangerBackground).to.include('--lyra-color-danger');
  expect(dangerColor).to.include('--lyra-color-on-danger');
});

it('uses the title as the dialog heading, which drives aria-label', async () => {
  const promise = confirm({ title: 'Delete conversation?' });
  const dialog = getMountedDialog();
  await dialog.updateComplete;

  const heading = dialog.querySelector('h2') as HTMLElement;
  expect(heading.textContent).to.equal('Delete conversation?');
  const panel = dialog.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
  expect(panel.getAttribute('aria-label')).to.equal('Delete conversation?');

  footerButtons(dialog)[0].click();
  await promise;
});

it('mounts exactly one dialog per call and fully cleans it up after resolving', async () => {
  const promise = confirm({ title: 'Proceed?' });
  expect(document.querySelectorAll('lyra-dialog').length).to.equal(1);

  footerButtons(getMountedDialog())[1].click();
  await promise;

  expect(document.querySelectorAll('lyra-dialog').length).to.equal(0);
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

  footerButtons(dialog)[0].click();
  await promise;
});

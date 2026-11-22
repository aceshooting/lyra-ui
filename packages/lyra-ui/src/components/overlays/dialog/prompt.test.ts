import { expect, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { prompt } from './prompt.js';
import { registerLyraLocale, setLyraLocale } from '../../../internal/localization.js';
import { deepActiveElement } from '../../../internal/overlay-manager.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { LyraDialog } from '../../lr-dialog.js';
import type { LyraButton } from '../../lr-button.js';
import type { LyraInput } from '../../lr-input.js';

function getMountedDialog(): LyraDialog {
  const dialog = [...document.querySelectorAll<LyraDialog>('lr-dialog')].at(-1);
  if (!dialog) throw new Error('expected prompt() to mount an lr-dialog');
  return dialog;
}

async function removed(): Promise<void> {
  const dialogs = [...document.querySelectorAll<LyraDialog>('lr-dialog')];
  await Promise.all(dialogs.map(async (dialog) => {
    if (!dialog.isConnected) return;
    await oneEvent(dialog, 'lr-after-hide');
  }));
  expect(document.querySelectorAll('lr-dialog').length).to.equal(0);
}

afterEach(removed);

const fieldOf = (dialog: LyraDialog): LyraInput => dialog.querySelector<LyraInput>('lr-input')!;
const nativeOf = (field: LyraInput): HTMLInputElement => field.shadowRoot!.querySelector('input')!;

function actions(dialog: LyraDialog): [LyraButton, LyraButton] {
  const buttons = [...dialog.querySelectorAll<LyraButton>('lr-button[slot="footer"]')];
  if (buttons.length !== 2) throw new Error('expected cancel and confirm footer buttons');
  return [buttons[0]!, buttons[1]!];
}

async function press(button: LyraButton): Promise<void> {
  await button.updateComplete;
  button.click();
}

async function ready(dialog: LyraDialog): Promise<LyraInput> {
  await dialog.updateComplete;
  const field = fieldOf(dialog);
  await field.updateComplete;
  await waitUntil(() => deepActiveElement() === nativeOf(field), 'focus moves to the text field');
  return field;
}

it('renders a labelled field with the initial value and focuses it', async () => {
  const result = prompt({ title: 'Rename', label: 'Name', value: 'Draft' });
  const dialog = getMountedDialog();
  const field = await ready(dialog);
  const state = {
    label: field.label,
    value: nativeOf(field).value,
    heading: dialog.shadowRoot!.querySelector('[part~="heading"]')!.textContent!.trim(),
    actions: actions(dialog).map((button) => [button.textContent, button.getAttribute('data-lr-prompt-action')]),
  };
  await press(actions(dialog)[0]);
  expect(await result).to.equal(null);
  expect(state).to.deep.equal({
    label: 'Name',
    value: 'Draft',
    heading: 'Rename',
    actions: [['Cancel', 'cancel'], ['Confirm', 'confirm']],
  });
});

it('resolves the edited value from the confirm button and from Enter in the field', async () => {
  const first = prompt({ title: 'Rename', label: 'Name' });
  let dialog = getMountedDialog();
  await ready(dialog);
  await sendKeys({ type: 'Report' });
  await press(actions(dialog)[1]);
  expect(await first).to.equal('Report');
  await removed();

  const second = prompt({ title: 'Rename', label: 'Name', value: 'Q3' });
  dialog = getMountedDialog();
  await ready(dialog);
  await sendKeys({ type: ' final' });
  await sendKeys({ press: 'Enter' });
  expect(await second).to.equal('Q3 final');
});

it('resolves null on Escape, the backdrop and removal', async () => {
  const escaped = prompt({ title: 'Rename', label: 'Name', value: 'x' });
  await ready(getMountedDialog());
  await sendKeys({ press: 'Escape' });
  expect(await escaped).to.equal(null);
  await removed();

  const backdrop = prompt({ title: 'Rename', label: 'Name' });
  let dialog = getMountedDialog();
  await dialog.updateComplete;
  dialog.shadowRoot!.querySelector<HTMLElement>('[part~="backdrop"]')!.click();
  expect(await backdrop).to.equal(null);
  await removed();

  const detached = prompt({ title: 'Rename', label: 'Name' });
  dialog = getMountedDialog();
  await dialog.updateComplete;
  dialog.remove();
  expect(await detached).to.equal(null);
});

it('keeps the dialog open with the validate() message until the value passes', async () => {
  const seen: string[] = [];
  const result = prompt({
    title: 'Rename',
    label: 'Name',
    validate: (value) => {
      seen.push(value);
      return value.trim() ? null : 'Enter a name';
    },
  });
  const dialog = getMountedDialog();
  const field = await ready(dialog);
  await press(actions(dialog)[1]);
  await field.updateComplete;
  const blocked = {
    open: dialog.open,
    errorText: field.errorText,
    invalid: nativeOf(field).getAttribute('aria-invalid'),
    focused: deepActiveElement() === nativeOf(field),
  };
  await sendKeys({ type: 'A' });
  await field.updateComplete;
  const cleared = field.errorText;
  await sendKeys({ press: 'Enter' });
  expect(await result).to.equal('A');
  expect(blocked).to.deep.equal({ open: true, errorText: 'Enter a name', invalid: 'true', focused: true });
  expect(cleared).to.equal('');
  expect(seen).to.deep.equal(['', 'A']);
});

it('honors custom labels, placeholder, size, headingLevel and className', async () => {
  const result = prompt({
    title: 'Rename',
    label: 'Name',
    description: 'Shown in the sidebar.',
    placeholder: 'Untitled',
    confirmLabel: 'Save',
    cancelLabel: 'Keep',
    size: 's',
    headingLevel: '4',
    className: 'x-prompt',
  });
  const dialog = getMountedDialog();
  const field = await ready(dialog);
  const state = {
    labels: actions(dialog).map((button) => button.textContent),
    placeholder: nativeOf(field).placeholder,
    description: dialog.querySelector('p')!.textContent,
    size: dialog.getAttribute('size'),
    level: dialog.shadowRoot!.querySelector('[part~="heading"]')!.getAttribute('aria-level'),
    classes: [...dialog.classList],
  };
  await press(actions(dialog)[0]);
  await result;
  expect(state).to.deep.equal({
    labels: ['Keep', 'Save'],
    placeholder: 'Untitled',
    description: 'Shown in the sidebar.',
    size: 's',
    level: '4',
    classes: ['x-prompt'],
  });
});

it('localizes its default action labels through the active locale', async () => {
  registerLyraLocale('x-test-prompt', {
    cancel: 'Annuler',
    clear: 'Effacer',
    close: 'Fermer',
    confirm: 'Confirmer',
    fieldRequired: 'Requis',
    hidePassword: 'Masquer',
    inputLabel: 'Saisie',
    matchMismatch: 'Différent',
    showPassword: 'Afficher',
    valueInvalid: 'Invalide',
  });
  setLyraLocale('x-test-prompt');
  try {
    const result = prompt({ title: 'Renommer', label: 'Nom' });
    const dialog = getMountedDialog();
    await dialog.updateComplete;
    const labels = actions(dialog).map((button) => button.textContent);
    await press(actions(dialog)[0]);
    await result;
    expect(labels).to.deep.equal(['Annuler', 'Confirmer']);
  } finally {
    setLyraLocale('en');
  }
});

it('is accessible while open and returns focus to the opener', async () => {
  const opener = document.createElement('button');
  opener.textContent = 'Open';
  document.body.append(opener);
  try {
    await focusByKeyboard(opener);
    const result = prompt({ title: 'Rename', label: 'Name', description: 'Shown in the sidebar.' });
    const dialog = getMountedDialog();
    await ready(dialog);
    await expect(dialog).to.be.accessible();
    await press(actions(dialog)[1]);
    expect(await result).to.equal('');
    await removed();
    await waitUntil(() => document.activeElement === opener, 'focus returns to the opener');
  } finally {
    opener.remove();
  }
});

import { LyraDialog, type DialogCloseReason } from './dialog.class.js';
import { defineElement, tag } from '../../../internal/prefix.js';
import { LYRA_DEFAULT_cancel, LYRA_DEFAULT_confirm } from '../../../internal/default-strings/shared.generated.js';
import { resolveLyraString } from '../../../internal/localization-runtime.js';
import { LyraButton } from '../../forms/button/button.class.js';
import { LyraInput } from '../../forms/input/input.class.js';
import type { LyraSize } from '../../../internal/variants.js';
import type { LyraHeadingLevel } from '../../../internal/heading-level.js';

const PROMPT_DEFAULT_STRINGS = Object.freeze({
  cancel: LYRA_DEFAULT_cancel,
  confirm: LYRA_DEFAULT_confirm,
});

export interface PromptOptions {
  /** Dialog title, rendered as the dialog's own header title (`[part~="heading"]`), which also
   *  names the dialog. */
  title: string;
  /** Visible label of the text field, which also names it. */
  label: string;
  /** Optional supporting text rendered in the dialog body, above the field. */
  description?: string;
  /** Initial value of the text field. Defaults to `''`. */
  value?: string;
  /** Placeholder of the text field. */
  placeholder?: string;
  /** Called with the current value when the user submits (the confirm button or Enter in the
   *  field). Return a message to reject the value: the message renders as the field's error text,
   *  the field is marked invalid and keeps focus, and the dialog stays open. Return `null`,
   *  `undefined` or `''` to accept it. The message is shown as given, so localize it yourself. */
  validate?: (value: string) => string | null | undefined;
  /** Confirm button label. Defaults to the localized `'confirm'` message (`'Confirm'` in English). */
  confirmLabel?: string;
  /** Cancel button label. Defaults to the localized `'cancel'` message (`'Cancel'` in English). */
  cancelLabel?: string;
  /** Width tier of the dialog, forwarded to `<lr-dialog size>`. Defaults to `'m'`. */
  size?: LyraSize;
  /** Semantic level of the header title, forwarded to `<lr-dialog heading-level>`. Defaults to
   *  `'2'`; `'none'` renders visual-only title text. */
  headingLevel?: LyraHeadingLevel;
  /** Space-separated classes added to the transient `<lr-dialog>`, so application styles can
   *  scope `--lr-dialog-*`, `--lr-input-*` and `--lr-button-*` tokens to prompts. */
  className?: string;
}

// Zero-specificity defaults, so any application rule (for example through `className`) wins. A
// `<style>` element mounted inside the transient dialog is torn down with it.
const DESCRIPTION_ATTRIBUTE = `data-${tag('prompt-description')}`;
const ACTION_ATTRIBUTE = `data-${tag('prompt-action')}`;
const FIELD_ATTRIBUTE = `data-${tag('prompt-field')}`;
const PROMPT_STYLE = `:where([${DESCRIPTION_ATTRIBUTE}]) { margin: 0 0 var(--lr-space-m); color: var(--lr-color-text-quiet); }`;

function createAction(
  action: 'cancel' | 'confirm',
  label: string,
  onClick: () => void,
): LyraButton {
  const button = document.createElement(tag('button')) as LyraButton;
  button.variant = action === 'cancel' ? 'neutral' : 'brand';
  button.appearance = action === 'cancel' ? 'outlined' : 'accent';
  button.textContent = label;
  button.slot = 'footer';
  button.setAttribute(ACTION_ATTRIBUTE, action);
  button.addEventListener('click', onClick);
  return button;
}

/**
 * Ask for one line of text in a modal, resolving the submitted string, or `null` when the prompt
 * is dismissed -- Escape, a backdrop click, the cancel button and removal all resolve `null`. A
 * drop-in async replacement for `window.prompt()`, and the text-entry sibling of `confirm()`.
 *
 * The dialog holds one labelled `<lr-input>` that starts with `value` and receives focus when the
 * dialog opens. Submitting -- the confirm button, or Enter in the field -- runs `validate()` first;
 * a returned message renders as the field's error text, marks it invalid and keeps the dialog
 * open, and typing clears it again. Like `confirm()`, it mounts a transient `<lr-dialog>` for the
 * duration of the call and removes it after the exit animation, and every dismissal funnels
 * through the dialog's own `close()`/`lr-close` path. Veto through `lr-hide` or `lr-close-request`
 * to keep it open. Focus returns to the opener once it settles.
 *
 * Styling: the title is the dialog's own header title, so `--lr-dialog-heading-*` and
 * `::part(heading)` apply. The field is an `<lr-input data-lr-prompt-field>`, so every
 * `--lr-input-*` token applies. Both actions are `<lr-button>` elements in the `footer` slot
 * (cancel is `appearance="outlined"`, confirm is `appearance="accent"` with `variant="brand"`),
 * each carrying `data-lr-prompt-action="cancel" | "confirm"`. The description is a
 * `<p data-lr-prompt-description>` with zero-specificity defaults. `className` adds classes to the
 * dialog to scope those rules.
 *
 * @example
 * const name = await prompt({
 *   title: 'Rename conversation',
 *   label: 'Name',
 *   value: conversation.name,
 *   validate: (value) => (value.trim() ? null : 'Enter a name'),
 * });
 * if (name !== null) renameConversation(name);
 */
export function prompt(options: PromptOptions): Promise<string | null> {
  // The root re-exports this helper, so registration belongs to invocation rather than module
  // evaluation. This keeps a bare root import pure without making the synchronous API async.
  defineElement('dialog', LyraDialog);
  defineElement('button', LyraButton);
  defineElement('input', LyraInput);
  const {
    title,
    label,
    description,
    value,
    placeholder,
    validate,
    confirmLabel,
    cancelLabel,
    size,
    headingLevel,
    className,
  } = options;

  return new Promise<string | null>((resolve) => {
    const dialog = document.createElement(tag('dialog')) as LyraDialog;
    // Backdrop dismissal is opt-in on `<lr-dialog>`; this helper documents it as a cancel path.
    dialog.lightDismiss = true;
    // Cancel, Escape and the backdrop already dismiss, so the header carries only the title.
    dialog.withoutCloseButton = true;
    dialog.label = title;
    dialog.headingLevel = headingLevel ?? '2';
    if (size) dialog.size = size;
    if (className) dialog.classList.add(...className.split(/\s+/).filter(Boolean));

    const style = document.createElement('style');
    style.textContent = PROMPT_STYLE;
    dialog.append(style);
    if (description) {
      const desc = document.createElement('p');
      desc.textContent = description;
      desc.setAttribute(DESCRIPTION_ATTRIBUTE, '');
      dialog.append(desc);
    }

    const field = document.createElement(tag('input')) as LyraInput;
    field.label = label;
    field.value = value ?? '';
    if (placeholder) field.placeholder = placeholder;
    field.setAttribute(FIELD_ATTRIBUTE, '');
    dialog.append(field);

    // The value the accepted submission validated, so a late edit during the exit animation can
    // never change what the promise resolves with.
    let accepted: string | null = null;
    const submit = (): void => {
      if (!dialog.open) return;
      const current = field.value;
      const error = validate?.(current);
      if (error) {
        field.errorText = error;
        field.focus();
        return;
      }
      field.errorText = '';
      accepted = current;
      void dialog.close('confirm');
    };

    field.addEventListener('lr-input', () => {
      if (field.errorText) field.errorText = '';
    });
    field.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || event.isComposing || event.defaultPrevented) return;
      event.preventDefault();
      submit();
    });

    // The dialog's initial focus runs before the transient field has rendered its native control,
    // so its body-first search would find nothing and settle on the panel. Taking over that one
    // movement through the public veto hands focus to the field, which defers it to its native
    // control until that control has rendered.
    dialog.addEventListener('lr-initial-focus', (event) => {
      if (event.target !== dialog) return;
      event.preventDefault();
      field.focus();
    });
    dialog.addEventListener('lr-close', (event) => {
      if (event.target !== dialog) return;
      const reason = (event as CustomEvent<{ reason: DialogCloseReason }>).detail.reason;
      resolve(reason === 'confirm' ? (accepted ?? field.value) : null);
    });
    dialog.addEventListener('lr-after-hide', (event) => {
      if (event.target === dialog) dialog.remove();
    });

    dialog.append(
      createAction(
        'cancel',
        resolveLyraString(dialog, 'cancel', undefined, cancelLabel, undefined, PROMPT_DEFAULT_STRINGS),
        () => void dialog.close('cancel'),
      ),
      createAction(
        'confirm',
        resolveLyraString(dialog, 'confirm', undefined, confirmLabel, undefined, PROMPT_DEFAULT_STRINGS),
        submit,
      ),
    );

    dialog.open = true;
    document.body.appendChild(dialog);
  });
}

import { LyraDialog, type DialogCloseReason } from './dialog.class.js';
import { defineElement, tag } from '../../../internal/prefix.js';
import { LYRA_DEFAULT_cancel, LYRA_DEFAULT_confirm } from '../../../internal/default-strings.generated.js';
import { resolveLyraString } from '../../../internal/localization-runtime.js';

const CONFIRM_DEFAULT_STRINGS = Object.freeze({
  cancel: LYRA_DEFAULT_cancel,
  confirm: LYRA_DEFAULT_confirm,
});

export interface ConfirmOptions {
  /** Dialog title -- rendered as a slotted `<h2>`, which also drives the dialog's accessible name (see dialog.ts). */
  title: string;
  /** Optional supporting text rendered below the title. */
  description?: string;
  /** Confirm button label. Defaults to the localized `'confirm'` message (`'Confirm'` in English). */
  confirmLabel?: string;
  /** Cancel button label. Defaults to the localized `'cancel'` message (`'Cancel'` in English). */
  cancelLabel?: string;
  /** `'danger'` fills the confirm button with `--lr-color-danger` instead of `--lr-color-brand` -- for destructive actions. */
  tone?: 'neutral' | 'danger';
}

// Plain inline-styled <button>s, not a shared lr-button component -- none
// exists in this library yet. Every value below is still a --lr-* token
// reference, never a raw literal, same requirement as a component's own
// styles.ts. Each filled tone uses its matching on-color token so standalone
// light/dark fallbacks and a consumer's Web Awesome theme stay paired.
const BUTTON_BASE_STYLE =
  'font: inherit; font-size: var(--lr-font-size-md-sm); padding: var(--lr-space-xs) var(--lr-space-m); ' +
  'border-radius: var(--lr-radius); cursor: pointer; border: var(--lr-border-width-thin) solid var(--lr-color-border);';
const CANCEL_STYLE = 'background: var(--lr-color-surface); color: var(--lr-color-text);';
const CONFIRM_TONE_STYLE: Record<'neutral' | 'danger', string> = {
  neutral:
    'background: var(--lr-color-brand); color: var(--lr-color-on-brand); border-color: var(--lr-color-brand);',
  danger:
    'background: var(--lr-color-danger); color: var(--lr-color-on-danger); border-color: var(--lr-color-danger);',
};

function createButton(label: string, style: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.style.cssText = `${BUTTON_BASE_STYLE} ${style}`;
  button.addEventListener('click', onClick);
  return button;
}

/**
 * Show a confirmation modal, resolving `true` only when the confirm button
 * is pressed -- Escape, a backdrop click, and the cancel button all resolve
 * `false`. A drop-in replacement for `window.confirm()`.
 *
 * Mounts a transient `<lr-dialog>` for the duration of the call and
 * removes it once settled, rather than reusing a persistent page-level
 * region (contrast `lr-toast`'s `toaster.ts`): a confirmation modal has no
 * stacking/queueing concerns -- only one is ever meant to be open at a time
 * -- so a mount-and-remove per call keeps its lifetime trivially tied to the
 * returned promise, with nothing left mounted between calls.
 *
 * Every dismissal path (confirm button, cancel button, Escape, backdrop
 * click) funnels through `<lr-dialog>`'s own `close()`/`lr-dialog-close`
 * event, so there is exactly one place that resolves the promise and tears
 * the dialog down. Because that event is cancelable, a veto leaves this
 * promise pending and the transient dialog mounted until a later accepted
 * close.
 *
 * @example
 * const ok = await confirm({
 *   title: 'Delete conversation?',
 *   description: 'This cannot be undone.',
 *   confirmLabel: 'Delete',
 *   tone: 'danger',
 * });
 * if (ok) deleteConversation();
 */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  // The root re-exports this helper, so registration belongs to invocation rather than module
  // evaluation. This keeps a bare root import pure without making the synchronous API async.
  defineElement('dialog', LyraDialog);
  const { title, description, confirmLabel, cancelLabel, tone = 'neutral' } = options;

  return new Promise<boolean>((resolve) => {
    const dialog = document.createElement(tag('dialog')) as LyraDialog;
    // `<lr-dialog>` makes backdrop dismissal opt-in (matching `wa-dialog`), but this helper's
    // documented contract is that Escape, the backdrop and the cancel button all resolve `false`.
    dialog.lightDismiss = true;
    let settled = false;

    const heading = document.createElement('h2');
    heading.textContent = title;
    heading.style.cssText =
      'margin: 0 0 var(--lr-space-s) 0; font-size: var(--lr-size-1-0625rem); font-weight: var(--lr-font-weight-semibold);';
    dialog.appendChild(heading);

    if (description) {
      const desc = document.createElement('p');
      desc.textContent = description;
      desc.style.cssText = 'margin: var(--lr-space-xs) 0 0 0; color: var(--lr-color-text-quiet);';
      dialog.appendChild(desc);
    }

    dialog.addEventListener('lr-dialog-close', (event) => {
      // A close veto can be installed above this transient dialog (including a capture listener
      // on document). Settle only after the event has completed its entire propagation path so a
      // later bubble listener's preventDefault() is honored too.
      queueMicrotask(() => {
        if (settled || event.defaultPrevented) return;
        settled = true;
        const reason = (event as CustomEvent<DialogCloseReason>).detail;
        resolve(reason === 'confirm');
        dialog.remove();
      });
    });

    const cancelButton = createButton(
      resolveLyraString(dialog, 'cancel', undefined, cancelLabel, undefined, CONFIRM_DEFAULT_STRINGS),
      CANCEL_STYLE,
      () => dialog.close('cancel'),
    );
    cancelButton.slot = 'footer';
    const confirmButton = createButton(
      resolveLyraString(dialog, 'confirm', undefined, confirmLabel, undefined, CONFIRM_DEFAULT_STRINGS),
      CONFIRM_TONE_STYLE[tone],
      () => dialog.close('confirm'),
    );
    confirmButton.slot = 'footer';
    dialog.appendChild(cancelButton);
    dialog.appendChild(confirmButton);

    dialog.open = true;
    document.body.appendChild(dialog);
  });
}

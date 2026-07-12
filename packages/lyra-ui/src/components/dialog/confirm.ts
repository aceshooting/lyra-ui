import type { LyraDialog, DialogCloseReason } from './dialog.js';
import './dialog.js';

export interface ConfirmOptions {
  /** Dialog title -- rendered as a slotted `<h2>`, which also drives the dialog's accessible name (see dialog.ts). */
  title: string;
  /** Optional supporting text rendered below the title. */
  description?: string;
  /** Confirm button label. Defaults to `'Confirm'`. */
  confirmLabel?: string;
  /** Cancel button label. Defaults to `'Cancel'`. */
  cancelLabel?: string;
  /** `'danger'` fills the confirm button with `--lyra-color-danger` instead of `--lyra-color-brand` -- for destructive actions. */
  tone?: 'neutral' | 'danger';
}

// Plain inline-styled <button>s, not a shared lyra-button component -- none
// exists in this library yet. Every value below is still a --lyra-* token
// reference, never a raw literal, same requirement as a component's own
// styles.ts. --lyra-color-on-brand is documented (tokens.styles.ts) as the
// text color for *brand*-fill content specifically, but it's white in both
// light and dark themes and reads fine over the danger fill too, so the
// confirm button reuses it rather than introducing a redundant --lyra-color-
// on-danger token for one call site.
const BUTTON_BASE_STYLE =
  'font: inherit; font-size: 0.875rem; padding: var(--lyra-space-xs) var(--lyra-space-m); ' +
  'border-radius: var(--lyra-radius); cursor: pointer; border: 1px solid var(--lyra-color-border);';
const CANCEL_STYLE = 'background: var(--lyra-color-surface); color: var(--lyra-color-text);';
const CONFIRM_TONE_STYLE: Record<'neutral' | 'danger', string> = {
  neutral:
    'background: var(--lyra-color-brand); color: var(--lyra-color-on-brand); border-color: var(--lyra-color-brand);',
  danger:
    'background: var(--lyra-color-danger); color: var(--lyra-color-on-brand); border-color: var(--lyra-color-danger);',
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
 * Mounts a transient `<lyra-dialog>` for the duration of the call and
 * removes it once settled, rather than reusing a persistent page-level
 * region (contrast `lyra-toast`'s `toaster.ts`): a confirmation modal has no
 * stacking/queueing concerns -- only one is ever meant to be open at a time
 * -- so a mount-and-remove per call keeps its lifetime trivially tied to the
 * returned promise, with nothing left mounted between calls.
 *
 * Every dismissal path (confirm button, cancel button, Escape, backdrop
 * click) funnels through `<lyra-dialog>`'s own `close()`/`lyra-dialog-close`
 * event, so there is exactly one place that resolves the promise and tears
 * the dialog down.
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
  const { title, description, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'neutral' } = options;

  return new Promise<boolean>((resolve) => {
    const dialog = document.createElement('lyra-dialog') as LyraDialog;

    const heading = document.createElement('h2');
    heading.textContent = title;
    heading.style.cssText = 'margin: 0 0 var(--lyra-space-s) 0; font-size: 1.0625rem; font-weight: 600;';
    dialog.appendChild(heading);

    if (description) {
      const desc = document.createElement('p');
      desc.textContent = description;
      desc.style.cssText = 'margin: var(--lyra-space-xs) 0 0 0; color: var(--lyra-color-text-quiet);';
      dialog.appendChild(desc);
    }

    dialog.addEventListener('lyra-dialog-close', (e) => {
      const reason = (e as CustomEvent<DialogCloseReason>).detail;
      resolve(reason === 'confirm');
      dialog.remove();
    });

    const cancelButton = createButton(cancelLabel, CANCEL_STYLE, () => dialog.close('cancel'));
    cancelButton.slot = 'footer';
    const confirmButton = createButton(confirmLabel, CONFIRM_TONE_STYLE[tone], () => dialog.close('confirm'));
    confirmButton.slot = 'footer';
    dialog.appendChild(cancelButton);
    dialog.appendChild(confirmButton);

    dialog.open = true;
    document.body.appendChild(dialog);
  });
}

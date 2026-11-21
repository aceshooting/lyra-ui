import { LyraDialog, type DialogCloseReason } from './dialog.class.js';
import { defineElement, tag } from '../../../internal/prefix.js';
import { LYRA_DEFAULT_cancel, LYRA_DEFAULT_confirm } from '../../../internal/default-strings/shared.generated.js';
import { resolveLyraString } from '../../../internal/localization-runtime.js';
import { LyraButton } from '../../forms/button/button.class.js';
import type { LyraSize } from '../../../internal/variants.js';
import type { LyraHeadingLevel } from '../../../internal/heading-level.js';

const CONFIRM_DEFAULT_STRINGS = Object.freeze({
  cancel: LYRA_DEFAULT_cancel,
  confirm: LYRA_DEFAULT_confirm,
});

export interface ConfirmOptions {
  /** Dialog title, rendered as the dialog's own header title (`[part~="heading"]`), which also
   *  names the dialog. */
  title: string;
  /** Optional supporting text rendered in the dialog body. */
  description?: string;
  /** Confirm button label. Defaults to the localized `'confirm'` message (`'Confirm'` in English). */
  confirmLabel?: string;
  /** Cancel button label. Defaults to the localized `'cancel'` message (`'Cancel'` in English). */
  cancelLabel?: string;
  /** `'danger'` renders the confirm action as `<lr-button variant="danger">` instead of
   *  `variant="brand"` -- for destructive actions. */
  variant?: 'neutral' | 'danger';
  /** Width tier of the dialog, forwarded to `<lr-dialog size>`. Defaults to `'m'`. */
  size?: LyraSize;
  /** Semantic level of the header title, forwarded to `<lr-dialog heading-level>`. Defaults to
   *  `'2'`; `'none'` renders visual-only title text. */
  headingLevel?: LyraHeadingLevel;
  /** Space-separated classes added to the transient `<lr-dialog>`, so application styles can
   *  scope `--lr-dialog-*` and `--lr-button-*` tokens to confirmations. */
  className?: string;
}

// Zero-specificity defaults, so any application rule (for example through `className`) wins. A
// `<style>` element mounted inside the transient dialog is torn down with it.
const DESCRIPTION_ATTRIBUTE = `data-${tag('confirm-description')}`;
const ACTION_ATTRIBUTE = `data-${tag('confirm-action')}`;
const DESCRIPTION_STYLE = `:where([${DESCRIPTION_ATTRIBUTE}]) { margin: 0; color: var(--lr-color-text-quiet); }`;

function createAction(
  action: 'cancel' | 'confirm',
  label: string,
  variant: 'neutral' | 'brand' | 'danger',
  onClick: () => void,
): LyraButton {
  const button = document.createElement(tag('button')) as LyraButton;
  button.variant = variant;
  button.appearance = action === 'cancel' ? 'outlined' : 'accent';
  button.textContent = label;
  button.slot = 'footer';
  button.setAttribute(ACTION_ATTRIBUTE, action);
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
 * region (contrast `lr-toast`'s `toaster.ts`). Concurrent calls remain distinct dialogs in the
 * shared overlay stack, each with a lifetime tied to its own returned promise and nothing left
 * mounted after that request settles.
 *
 * Every dismissal path (confirm button, cancel button, Escape, backdrop
 * click) funnels through `<lr-dialog>`'s own `close()`/`lr-close`
 * event, so there is exactly one place that resolves the promise; the dialog
 * is removed after its exit animation. Veto through `lr-hide` or
 * `lr-close-request` to keep the confirmation open.
 *
 * Styling: the title is the dialog's own header title, so `--lr-dialog-heading-*` and
 * `::part(heading)` apply. Both actions are `<lr-button>` elements in the `footer` slot (cancel is
 * `appearance="outlined"`, confirm is `appearance="accent"` with `variant="brand"` or
 * `variant="danger"`), so every `--lr-button-*` token applies; each carries
 * `data-lr-confirm-action="cancel" | "confirm"`. The description is a `<p data-lr-confirm-description>`
 * with zero-specificity defaults. `className` adds classes to the dialog to scope those rules.
 *
 * @example
 * const ok = await confirm({
 *   title: 'Delete conversation?',
 *   description: 'This cannot be undone.',
 *   confirmLabel: 'Delete',
 *   variant: 'danger',
 * });
 * if (ok) deleteConversation();
 */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  // The root re-exports this helper, so registration belongs to invocation rather than module
  // evaluation. This keeps a bare root import pure without making the synchronous API async.
  defineElement('dialog', LyraDialog);
  defineElement('button', LyraButton);
  const { title, description, confirmLabel, cancelLabel, variant, size, headingLevel, className } = options;

  return new Promise<boolean>((resolve) => {
    const dialog = document.createElement(tag('dialog')) as LyraDialog;
    // `<lr-dialog>` makes backdrop dismissal opt-in (matching `wa-dialog`), but this helper's
    // documented contract is that Escape, the backdrop and the cancel button all resolve `false`.
    dialog.lightDismiss = true;
    // Cancel, Escape and the backdrop already dismiss, so the header carries only the title.
    dialog.withoutCloseButton = true;
    dialog.label = title;
    dialog.headingLevel = headingLevel ?? '2';
    if (size) dialog.size = size;
    if (className) dialog.classList.add(...className.split(/\s+/).filter(Boolean));

    if (description) {
      const descriptionStyle = document.createElement('style');
      descriptionStyle.textContent = DESCRIPTION_STYLE;
      const desc = document.createElement('p');
      desc.textContent = description;
      desc.setAttribute(DESCRIPTION_ATTRIBUTE, '');
      dialog.append(descriptionStyle, desc);
    }

    dialog.addEventListener('lr-close', (event) => {
      if (event.target === dialog) resolve((event as CustomEvent<{ reason: DialogCloseReason }>).detail.reason === 'confirm');
    });
    dialog.addEventListener('lr-after-hide', (event) => {
      if (event.target === dialog) dialog.remove();
    });

    dialog.append(
      createAction(
        'cancel',
        resolveLyraString(dialog, 'cancel', undefined, cancelLabel, undefined, CONFIRM_DEFAULT_STRINGS),
        'neutral',
        () => void dialog.close('cancel'),
      ),
      createAction(
        'confirm',
        resolveLyraString(dialog, 'confirm', undefined, confirmLabel, undefined, CONFIRM_DEFAULT_STRINGS),
        variant === 'danger' ? 'danger' : 'brand',
        () => void dialog.close('confirm'),
      ),
    );

    dialog.open = true;
    document.body.appendChild(dialog);
  });
}

import { html, nothing, type TemplateResult } from 'lit';

/** Shared supporting text with stable ids, slots and optional compatibility aliases. */
export function renderFormControlHintError(options: {
  idPrefix: string;
  hint: string | null | undefined;
  errorText: string | null | undefined;
  hasHint: boolean;
  hasError: boolean;
  helpTextSlot?: boolean;
}): TemplateResult {
  return html`<div id=${`${options.idPrefix}-error`} part="error" ?hidden=${!options.hasError}
    >${options.errorText}<slot name="error"></slot></div
  ><div id=${`${options.idPrefix}-hint`}
    part=${options.helpTextSlot ? 'hint form-control-help-text' : 'hint'}
    ?hidden=${!options.hasHint}
    >${options.hint}<slot name="hint"></slot>${options.helpTextSlot ? html`<slot name="help-text"></slot>` : nothing}</div>`;
}

/** What {@linkcode formControlSupportingState} reads from a control. */
export interface FormControlSupportingInput {
  /** The control's `SlotPresenceController` (or any `has(name)` answer). */
  presence: { has(name: string): boolean };
  /** Same prefix handed to {@linkcode renderFormControlHintError}; ids become `<prefix>-hint|error`. */
  idPrefix: string;
  hint?: string | null;
  helpText?: string | null;
  errorText?: string | null;
  /** Reserves hint space even when empty (`with-hint`). */
  withHint?: boolean;
  /**
   * Whether the control renders the `help-text` compatibility slot. Pass `false` when it does
   * not, so content assigned to that unrendered slot cannot reveal an empty hint. Default `true`.
   */
  helpTextSlot?: boolean;
  /** Extra ids appended after hint/error, for controls with their own description. */
  extraDescribedBy?: readonly (string | false | null | undefined)[];
}

/** Hint/error presence and the matching `aria-describedby`, computed once per render. */
export interface FormControlSupportingState {
  hasHint: boolean;
  hasError: boolean;
  hintId: string;
  errorId: string;
  /** Space-joined ids in DOM order (error, then hint, then extras); `undefined` when empty. */
  describedBy: string | undefined;
}

/**
 * The single computation of hint/error presence and `aria-describedby` that every form control
 * repeated beside {@linkcode renderFormControlHintError}. Error comes first, matching that
 * template's DOM order, so reading order and description order agree.
 */
export function formControlSupportingState(o: FormControlSupportingInput): FormControlSupportingState {
  const hasHint = o.presence.has('hint') || (o.helpTextSlot !== false && o.presence.has('help-text'))
    || (o.hint ?? '').length > 0 || (o.helpText ?? '').length > 0 || o.withHint === true;
  const hasError = o.presence.has('error') || (o.errorText ?? '').length > 0;
  const hintId = `${o.idPrefix}-hint`;
  const errorId = `${o.idPrefix}-error`;
  const ids = [hasError && errorId, hasHint && hintId, ...(o.extraDescribedBy ?? [])].filter(Boolean) as string[];
  return { hasHint, hasError, hintId, errorId, describedBy: ids.length > 0 ? ids.join(' ') : undefined };
}

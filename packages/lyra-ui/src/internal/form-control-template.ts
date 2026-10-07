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

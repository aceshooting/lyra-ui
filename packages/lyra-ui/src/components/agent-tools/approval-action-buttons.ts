import { html, type TemplateResult } from 'lit';

interface ApprovalButtonOptions {
  label: string;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}

/** Shared action chrome; each owner keeps its own decision and disabled-state policy. */
export function renderDenyAction(options: ApprovalButtonOptions): TemplateResult {
  return html`<lr-button
    part="deny-button"
    variant="neutral"
    appearance="outlined"
    type="button"
    ?loading=${options.loading}
    ?disabled=${options.disabled}
    exportparts="base:deny-button-base, button:deny-button-base, label:deny-button-label, start:deny-button-start, end:deny-button-end, spinner:deny-button-spinner"
    @click=${options.onClick}
  >${options.label}</lr-button>`;
}

export function renderApproveAction(
  options: ApprovalButtonOptions & { variant: 'brand' | 'danger' },
): TemplateResult {
  return html`<lr-button
    part="approve-button"
    variant=${options.variant}
    type="button"
    ?loading=${options.loading}
    ?disabled=${options.disabled}
    exportparts="base:approve-button-base, button:approve-button-base, label:approve-button-label, start:approve-button-start, end:approve-button-end, spinner:approve-button-spinner"
    @click=${options.onClick}
  >${options.label}</lr-button>`;
}

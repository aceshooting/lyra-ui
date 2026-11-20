import { html, nothing, type TemplateResult } from 'lit';
import { hostAriaLabel } from './a11y.js';
import { resolveAccessibleName } from './accessible-name.js';
import { HostDescriptionController } from './aria-controls.js';
import type { LyraElement } from './lyra-element.js';

/** A host that renders one labelled `role="group"` wrapper around its default slot. */
export interface LabeledGroupHost extends LyraElement {
  label: string;
  accessibleLabel: string | null;
}

/** Forwards the host's external `aria-describedby` to its `[part~="base"]` group wrapper. The host's
 *  `adoptedCallback` must call `adopted()` on the returned controller. */
export function labeledGroupDescription(host: LabeledGroupHost): HostDescriptionController {
  return new HostDescriptionController(host, () => host.renderRoot.querySelector<HTMLElement>('[part~="base"]'));
}

/** The group wrapper: an explicitly empty host `aria-label` or `accessibleLabel` leaves the group
 *  unnamed; otherwise the resolved accessible name (host label, then a non-blank `label`). */
export function renderLabeledGroup(host: LabeledGroupHost): TemplateResult {
  const name =
    hostAriaLabel(host) === '' || host.accessibleLabel === ''
      ? ''
      : resolveAccessibleName(host, host.label) ?? nothing;
  return html`<div part="base" role="group" aria-label=${name}><slot></slot></div>`;
}

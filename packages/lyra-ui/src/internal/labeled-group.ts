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

/** The group wrapper: a non-empty host `aria-label` names it first; an explicitly empty host
 *  `aria-label`, or an empty `accessibleLabel` without a host label, leaves the group unnamed;
 *  otherwise a non-blank `label` names it. `aliasPart` adds a second part token on the same node. */
export function renderLabeledGroup(host: LabeledGroupHost, aliasPart = ''): TemplateResult {
  const authored = hostAriaLabel(host);
  const name =
    authored === '' || (authored === null && host.accessibleLabel === '')
      ? ''
      : resolveAccessibleName(host, host.label) ?? nothing;
  const part = aliasPart ? `base ${aliasPart}` : 'base';
  return html`<div part=${part} role="group" aria-label=${name}><slot></slot></div>`;
}

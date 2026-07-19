import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './control-group.styles.js';

/**
 * `<lr-control-group>` — a responsive layout primitive for a row of mixed form
 * controls and action buttons (e.g. a segmented metric switcher beside a compact
 * select and an export button in a dashboard toolbar). Unlike `<lr-button-group>`
 * (a uniform-height row of `<lr-button>`s that stretches every child to the row's
 * full height), this centers children of differing intrinsic heights and does not
 * assume any particular child type.
 *
 * @customElement lr-control-group
 * @slot - Form controls, buttons, or any other action content.
 * @csspart base - The group wrapper (`role="group"`).
 * @cssprop --lr-control-group-gap - Gap between grouped controls.
 */
export class LyraControlGroup extends LyraElement {
  static styles = [LyraElement.styles, styles];

  /** Accessible name for the group, set as `aria-label` on the internal
   *  `role="group"` element. A plain `aria-label` attribute on the host itself is
   *  honored as a fallback when this is left unset, matching `<lr-button-group>`. */
  @property() label = '';

  render(): TemplateResult {
    const accessibleLabel = this.label || this.getAttribute('aria-label') || nothing;
    return html`<div part="base" role="group" aria-label=${accessibleLabel}><slot></slot></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-control-group': LyraControlGroup;
  }
}

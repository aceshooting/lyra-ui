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
 * `container-type: inline-size` (needed for the `@container` breakpoint below) is opt-in via
 * `responsive`, not automatic: unconditionally applying it made the group collapse to 0 inline
 * size whenever it sat as an ordinary flex-basis:auto child of a shrink-to-fit flex row -- exactly
 * this component's own toolbar-row use case. Set `responsive` when this group's own size instead
 * comes from a percentage width, grid track, or block-level parent.
 *
 * @customElement lr-control-group
 * @slot - Form controls, buttons, or any other action content.
 * @csspart base - The group wrapper (`role="group"`).
 * @cssprop [--lr-control-group-gap=var(--lr-space-xs)] - Gap between grouped controls.
 */
export class LyraControlGroup extends LyraElement {
  static styles = [LyraElement.styles, styles];

  /** Accessible name for the group, set as `aria-label` on the internal
   *  `role="group"` element. A plain `aria-label` attribute on the host itself is
   *  honored as a fallback when this is left unset, matching `<lr-button-group>`. */
  @property() label = '';

  /** Opts into the group's own `@container` narrow-allocation breakpoint (see the class doc) by
   *  making the host a CSS size-query container. Left unset (the default), the host uses
   *  `container-type: normal` instead: `container-type: inline-size` forces this element's own
   *  auto/content-based inline size to be computed as if it had no content, which silently
   *  collapses it to 0 width whenever it sits as an ordinary (`flex-basis: auto`) child of a
   *  shrink-to-fit flex row — exactly this component's own stated primary use case (a toolbar
   *  row of mixed controls). Set `responsive` only when the group's own size instead comes from
   *  somewhere else (a percentage width, a grid track, a block-level parent), where that failure
   *  mode does not apply and the narrow-allocation breakpoint is wanted. */
  @property({ type: Boolean, reflect: true }) responsive = false;

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

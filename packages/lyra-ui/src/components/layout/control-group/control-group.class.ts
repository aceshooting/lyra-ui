import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { hostAriaLabel } from '../../../internal/a11y.js';
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
 * The group fills a host that has been given a definite inline size, unconditionally. A percentage
 * inline size resolves as `auto` against a shrink-to-fit containing block, so that is a no-op for
 * the ordinary toolbar-in-a-flex-row case and only takes effect once an ancestor sizes the host --
 * the same unconditional-chain pattern `<lr-file-input>` uses.
 *
 * `container-type: inline-size` stays opt-in via `responsive`, because unconditionally applying it
 * made the group collapse to 0 inline size whenever it sat as an ordinary `flex-basis: auto` child
 * of a shrink-to-fit flex row -- exactly this component's own toolbar-row use case. Setting it makes
 * the host a size-query container that the consumer's own `@container` rules can target from their
 * slotted content; the component itself declares no breakpoint of its own.
 *
 * @customElement lr-control-group
 * @slot - Form controls, buttons, or any other action content.
 * @csspart base - The group wrapper (`role="group"`).
 * @cssprop [--lr-control-group-gap=var(--lr-space-xs)] - Gap between grouped controls.
 * @status stable
 * @since 4.0.0
 */
export class LyraControlGroup extends LyraElement {
  static override styles = [LyraElement.styles, styles];

  /** Accessible-name fallback for the internal `role="group"` element when the host has no
   *  `aria-label`; a present host attribute wins, including an explicitly empty value. */
  @property() label = '';

  /** Makes the host a CSS size-query container, so a consumer's own `@container` rules can react to
   *  this group's allocated width from their slotted content. The component declares no breakpoint
   *  of its own, and its fill behaviour does not depend on this.
   *
   *  Left unset (the default), the host uses `container-type: normal`, because
   *  `container-type: inline-size` forces this element's own auto/content-based inline size to be
   *  computed as if it had no content, which silently collapses it to 0 width whenever it sits as
   *  an ordinary (`flex-basis: auto`) child of a shrink-to-fit flex row — exactly this component's
   *  own stated primary use case (a toolbar row of mixed controls). Set `responsive` only when the
   *  group's own size instead comes from somewhere else (a percentage width, a grid track, a
   *  block-level parent), where that failure mode does not apply. */
  @property({ type: Boolean, reflect: true }) responsive = false;

  override render(): TemplateResult {
    const accessibleLabel = hostAriaLabel(this) ?? (this.label || nothing);
    return html`<div part="base" role="group" aria-label=${accessibleLabel}><slot></slot></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-control-group': LyraControlGroup;
  }
}

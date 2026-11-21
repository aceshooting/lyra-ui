import { html, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import type { Placement } from '@floating-ui/dom';
import { LyraElement } from '../../../internal/lyra-element.js';
import { declaredDefaultConverter } from '../../../internal/converters.js';
import { helpIcon } from '../../../internal/icons.js';
import { styles } from './help.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_details } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

/**
 * `<lr-help>` — a compact "?" explanation disclosure: an `<lr-icon-button>` trigger that opens
 * an `<lr-popover>` holding the slotted explanation. Place it beside a heading, a table header,
 * or in the `actions` slot of `<lr-stat>` and the `header-actions` slot of `<lr-card>`.
 *
 * The trigger is named by `label`, or by the localized `details` message when `label` is empty,
 * and never by colour or the glyph alone. A click or Enter/Space opens the explanation and pins it
 * until a second activation, Escape, or a click outside; keyboard focus alone also reveals it
 * without moving focus, following the tooltip pattern, while pointer focus does not. Escape closes
 * it through the shared overlay manager and keeps focus on the trigger.
 *
 * @customElement lr-help
 * @slot - The explanation shown in the popover.
 * @csspart trigger - The `<lr-icon-button>` trigger host.
 * @csspart trigger-control - The trigger's native button, forwarded from `<lr-icon-button>`.
 * @csspart popover - The `<lr-popover>` host.
 * @csspart popup - The positioned popup surface, forwarded from `<lr-popover>`.
 * @csspart content - The popup's content wrapper, forwarded from `<lr-popover>`.
 * @cssprop [--lr-help-icon-size=var(--lr-size-1em)] - Size of the "?" glyph inside the trigger.
 * @cssprop [--lr-help-max-inline-size=var(--lr-size-20rem)] - Maximum inline size of the
 *   explanation popup.
 * @status experimental
 * @since unreleased
 */
export class LyraHelp extends LyraElement {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    details: LYRA_DEFAULT_details,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** Accessible name of the trigger. Empty (the default) uses the localized `details` message. */
  @property() label = '';

  /** Preferred side of the explanation relative to the trigger; flips when space is short and
   *  mirrors under RTL. */
  @property({ reflect: true, converter: declaredDefaultConverter('top') })
  placement: Placement = 'top';

  override render(): TemplateResult {
    // The popup carries the trigger's name, so it never announces as a generic "Popover".
    const name = this.label || this.localize('details');
    return html`<lr-popover
      part="popover"
      exportparts="popup, content"
      trigger="click focus"
      placement=${this.placement}
      .accessibleLabel=${name}
      ><lr-icon-button
        slot="trigger"
        part="trigger"
        exportparts="button:trigger-control"
        aria-label=${name}
        ><span class="glyph" aria-hidden="true">${helpIcon()}</span></lr-icon-button
      ><slot></slot
    ></lr-popover>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-help': LyraHelp;
  }
}

import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { hostAriaLabel } from '../../../internal/a11y.js';
import { declaredDefaultConverter } from '../../../internal/converters.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './button-group.styles.js';

export type ButtonGroupOrientation = 'horizontal' | 'vertical';

/**
 * `<lr-button-group>` — a responsive grouping primitive for related actions.
 * It preserves the consumer's button elements and exposes the group semantics
 * on the element that owns the label. A host `aria-label` wins by attribute
 * presence, including an explicitly empty value.
 *
 * @customElement lr-button-group
 * @slot - Buttons or other action controls.
 * @csspart base - The group wrapper.
 * @cssprop [--lr-button-group-gap=var(--lr-space-2xs)] - Gap between grouped controls.
 * @status stable
 * @since 4.0.0
 */
export class LyraButtonGroup extends LyraElement {
  static override styles = [LyraElement.styles, styles];

  @property({ reflect: true,
    converter: declaredDefaultConverter<ButtonGroupOrientation>('horizontal'),
  }) orientation: ButtonGroupOrientation = 'horizontal';
  /** Accessible group-name fallback when the host `aria-label` is absent. */
  @property() label = '';

  override render(): TemplateResult {
    const accessibleLabel = hostAriaLabel(this) ?? (this.label || nothing);
    return html`<div part="base" role="group" aria-label=${accessibleLabel}><slot></slot></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-button-group': LyraButtonGroup;
  }
}

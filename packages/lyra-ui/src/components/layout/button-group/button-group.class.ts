import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './button-group.styles.js';

export type ButtonGroupOrientation = 'horizontal' | 'vertical';

/**
 * `<lr-button-group>` — a responsive grouping primitive for related actions.
 * It preserves the consumer's button elements and exposes the group semantics
 * on the element that owns the label.
 *
 * @customElement lr-button-group
 * @slot - Buttons or other action controls.
 * @csspart base - The group wrapper.
 * @cssprop [--lr-button-group-gap=var(--lr-space-2xs)] - Gap between grouped controls.
 */
export class LyraButtonGroup extends LyraElement {
  static styles = [LyraElement.styles, styles];

  @property({ reflect: true }) orientation: ButtonGroupOrientation = 'horizontal';
  @property() label = '';

  render(): TemplateResult {
    const accessibleLabel = this.label || this.getAttribute('aria-label') || nothing;
    return html`<div part="base" role="group" aria-label=${accessibleLabel}><slot></slot></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-button-group': LyraButtonGroup;
  }
}

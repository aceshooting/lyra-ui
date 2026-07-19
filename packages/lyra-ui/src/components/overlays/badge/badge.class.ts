import { html, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './badge.styles.js';

export type BadgeVariant = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';

/**
 * `<lr-badge>` — a compact status label.
 *
 * @customElement lr-badge
 * @slot - Badge content.
 * @csspart base - The badge surface.
 */
export class LyraBadge extends LyraElement {
  static styles = [LyraElement.styles, styles];
  @property({ reflect: true }) variant: BadgeVariant = 'neutral';
  render(): TemplateResult { return html`<span part="base"><slot></slot></span>`; }
}
declare global { interface HTMLElementTagNameMap { 'lr-badge': LyraBadge; } }

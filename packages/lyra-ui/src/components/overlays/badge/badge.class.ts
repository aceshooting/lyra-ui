import { html, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './badge.styles.js';

export type BadgeVariant = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';
export type BadgeSize = '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl';

/**
 * `<lr-badge>` — a compact status label.
 *
 * @customElement lr-badge
 * @slot - Badge content.
 * @csspart base - The badge surface.
 * @cssprop [--lr-badge-background=var(--lr-color-surface)] - The badge's background. Each non-neutral
 * `variant` sets it to that variant's `-quiet` tint.
 * @cssprop [--lr-badge-border=var(--lr-color-border)] - The badge's border color. Each non-neutral
 * `variant` sets it to that variant's loud color.
 * @cssprop [--lr-badge-color=var(--lr-color-text)] - The badge's text color. Each non-neutral
 * `variant` sets it to that variant's loud color.
 * @cssprop [--lr-badge-font-size=var(--lr-font-size-sm)] - The badge's label font size. Each `size`
 * sets it to that step's font size.
 * @cssprop [--lr-badge-padding-inline=var(--lr-space-s)] - The badge's inline padding. Each `size`
 * sets it to that step's inline padding.
 * @cssprop [--lr-badge-min-height=var(--lr-size-1-25rem)] - The badge's minimum block size. Each
 * `size` sets it to that step's minimum block size.
 */
export class LyraBadge extends LyraElement {
  static styles = [LyraElement.styles, styles];
  @property({ reflect: true }) variant: BadgeVariant = 'neutral';
  /** Visual density, matching `<lr-chip>`'s `2xs`–`xl` size scale. `m` preserves the original
   *  badge dimensions. */
  @property({ reflect: true }) size: BadgeSize = 'm';
  render(): TemplateResult { return html`<span part="base"><slot></slot></span>`; }
}
declare global { interface HTMLElementTagNameMap { 'lr-badge': LyraBadge; } }

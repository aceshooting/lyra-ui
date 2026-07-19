import { html, type TemplateResult, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { srOnly } from '../../../internal/a11y.js';
import { styles } from './skeleton.styles.js';

export type SkeletonVariant = 'text' | 'circle' | 'rect';
export type SkeletonEffect = 'pulse' | 'sheen';

/**
 * `<lr-skeleton>` — a loading placeholder. First-party invention, standing
 * in for the bespoke `animate-pulse` div most dashboards hand-roll.
 *
 * @customElement lr-skeleton
 * @csspart base - The placeholder shape.
 * @cssprop [--lr-transition-ambient=1.8s ease-in-out] - Animation duration and timing function
 *   shared by the pulse and sheen effects.
 * @cssprop [--lr-skeleton-w=100%] - Inline size of the placeholder.
 * @cssprop [--lr-skeleton-h=var(--lr-size-1em)] - Block size of the placeholder.
 */
export class LyraSkeleton extends LyraElement {
  static styles = [LyraElement.styles, styles, srOnly];

  @property({ reflect: true }) variant: SkeletonVariant = 'text';
  @property({ reflect: true }) effect: SkeletonEffect = 'pulse';
  @property() width?: string;
  @property() height?: string;

  /** Whether this placeholder exposes a localized status announcement. Disable for decorative
   *  members of a group whose loading state is announced once by a parent or sibling. */
  @property({ type: Boolean, reflect: true }) announce = true;

  /** Accessible name announced via `role="status"`. Override with a
   *  description of what is actually loading (e.g. "Loading chart"). */
  @property() label = 'Loading…';

  protected willUpdate(): void {
    if (this.announce) {
      this.setAttribute('role', 'status');
    } else {
      this.removeAttribute('role');
    }
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('width') || changed.has('height')) {
      if (this.width) {
        this.style.setProperty('--lr-skeleton-w', this.width);
      } else {
        this.style.removeProperty('--lr-skeleton-w');
      }
      if (this.height) {
        this.style.setProperty('--lr-skeleton-h', this.height);
      } else {
        this.style.removeProperty('--lr-skeleton-h');
      }
    }
  }

  render(): TemplateResult {
    const label = this.localize('loading', this.label === 'Loading…' ? undefined : this.label);
    return html`<span part="base"
      >${this.announce ? html`<span class="sr-only">${label}</span>` : ''}</span
    >`;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-skeleton': LyraSkeleton;
  }
}

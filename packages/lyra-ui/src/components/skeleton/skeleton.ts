import { html, type TemplateResult, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { styles } from './skeleton.styles.js';

export type SkeletonVariant = 'text' | 'circle' | 'rect';
export type SkeletonEffect = 'pulse' | 'sheen';

/**
 * `<lyra-skeleton>` — a loading placeholder. First-party invention; every
 * surveyed repo reinvents this as a bespoke `animate-pulse` div.
 *
 * @customElement lyra-skeleton
 * @csspart base - The placeholder shape.
 */
export class LyraSkeleton extends LyraElement {
  static styles = [LyraElement.styles, styles];

  @property({ reflect: true }) variant: SkeletonVariant = 'text';
  @property({ reflect: true }) effect: SkeletonEffect = 'pulse';
  @property() width?: string;
  @property() height?: string;

  protected willUpdate(): void {
    this.setAttribute('role', 'status');
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('width') || changed.has('height')) {
      const base = this.renderRoot.querySelector('[part="base"]') as HTMLElement | null;
      if (!base) return;
      if (this.width) base.style.setProperty('--lyra-skeleton-w', this.width);
      if (this.height) base.style.setProperty('--lyra-skeleton-h', this.height);
    }
  }

  render(): TemplateResult {
    return html`<span part="base"><span class="sr-only">Loading…</span></span>`;
  }
}

defineElement('skeleton', LyraSkeleton);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-skeleton': LyraSkeleton;
  }
}

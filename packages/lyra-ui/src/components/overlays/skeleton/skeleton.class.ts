import { html, type TemplateResult, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { srOnly } from '../../../internal/a11y.js';
import { styles } from './skeleton.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_loading } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type LyraSkeletonShape = 'text' | 'circle' | 'rect';
export type LyraSkeletonEffect = 'pulse' | 'sheen' | 'none';

/**
 * `<lr-skeleton>` — a loading placeholder mirroring the public Web Awesome/Shoelace skeleton
 * surface under the `lr-` prefix. It is decorative by default like both upstreams; `announce`
 * opts one placeholder into a localized status. An author-supplied host role remains authoritative;
 * the component adds/removes `role="status"` only when it owns that opt-in role. Geometry is
 * exposed as `shape`.
 *
 * @customElement lr-skeleton
 * @csspart base - Compatibility name for the placeholder shape.
 * @csspart indicator - The placeholder shape and animation surface. It is the same node as `base`.
 * @cssprop [--lr-transition-ambient=1.8s ease-in-out] - Animation duration and timing function
 *   shared by the pulse and sheen effects.
 * @cssprop [--lr-skeleton-w=100%] - Inline size of the placeholder.
 * @cssprop [--lr-skeleton-h=var(--lr-size-1em)] - Block size of the placeholder.
 * @cssprop [--lr-skeleton-color=var(--lr-color-border)] - Placeholder color.
 * @cssprop [--lr-skeleton-sheen-color=var(--lr-color-surface)] - Sheen highlight color.
 * @cssprop [--lr-skeleton-border-radius=var(--lr-radius)] - Text/rectangle corner radius.
 * @cssprop [--color=var(--lr-skeleton-color)] - Upstream-compatible placeholder color.
 * @cssprop [--sheen-color=var(--lr-skeleton-sheen-color)] - Upstream-compatible sheen color.
 * @cssprop [--border-radius=var(--lr-skeleton-border-radius)] - Shoelace-compatible corner radius.
 * @status stable
 * @since 4.0.0
 */
export class LyraSkeleton extends LyraElement {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    loading: LYRA_DEFAULT_loading,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles, srOnly];

  /** Placeholder geometry. This is named `shape` so it cannot be confused with semantic tone. */
  @property({ reflect: true, useDefault: true }) shape: LyraSkeletonShape = 'text';
  @property() effect: LyraSkeletonEffect = 'none';
  @property() width?: string;
  @property() height?: string;

  /** Opts this placeholder into a localized status announcement. Leave unset for decorative
   *  skeletons, including repeated members of a group whose loading state is announced once. */
  @property({ type: Boolean, reflect: true }) announce = false;

  /** Accessible name announced via `role="status"`. Absence uses the localized loading string;
   *  every supplied value, including the English fallback or an empty string, remains literal. */
  @property() label?: string;

  /** True only while this component, rather than the author, owns the current status role. */
  private ownsStatusRole = false;

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    const role = this.getAttribute('role');
    if (this.announce) {
      if (role === null) {
        this.setAttribute('role', 'status');
        this.ownsStatusRole = true;
      } else if (role !== 'status') {
        this.ownsStatusRole = false;
      }
    } else if (this.ownsStatusRole) {
      if (role === 'status') this.removeAttribute('role');
      this.ownsStatusRole = false;
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
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

  override render(): TemplateResult {
    const label = this.label === undefined ? this.localize('loading') : this.label;
    return html`<span part="base indicator" data-effect=${this.effect}
      >${this.announce ? html`<span class="sr-only">${label}</span>` : ''}</span
    >`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-skeleton': LyraSkeleton;
  }
}

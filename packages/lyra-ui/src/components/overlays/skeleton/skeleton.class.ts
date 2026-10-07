import { html, type TemplateResult, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import type { AnnouncementSink } from '../../../internal/announcer.js';
import { LyraElement } from '../../../internal/lyra-element.js';
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
 * opts one placeholder into a localized polite announcement through the shared light-DOM sink,
 * like `lr-callout` and `lr-empty`. The component never adds a host role; an author-supplied one
 * stays authoritative. Geometry is exposed as `shape`.
 *
 * @customElement lr-skeleton
 * @csspart base - Compatibility name for the placeholder shape.
 * @csspart indicator - The placeholder shape and animation surface. It is the same node as `base`.
 * @cssprop [--lr-transition-ambient=1.8s ease-in-out] - Animation duration and timing function
 *   shared by the pulse and sheen effects.
 * @cssprop [--lr-skeleton-w=100%] - Inline size of the placeholder.
 * @cssprop [--lr-skeleton-h=var(--lr-size-1em)] - Block size of the placeholder.
 * @cssprop [--lr-skeleton-color=var(--lr-color-neutral-fill-normal)] - Placeholder color.
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

  static override styles = [LyraElement.styles, styles];

  /** Placeholder geometry. This is named `shape` so it cannot be confused with semantic tone. */
  @property({ reflect: true, useDefault: true }) shape: LyraSkeletonShape = 'text';
  @property() effect: LyraSkeletonEffect = 'none';
  @property() width?: string;
  @property() height?: string;

  /** Opts this placeholder into announcing its `label` through the shared polite sink once it
   *  mounts (and again when `label` changes). Leave unset for decorative skeletons, including
   *  repeated members of a group whose loading state is announced once. */
  @property({ type: Boolean, reflect: true }) announce = false;

  /** Text announced when `announce` is set. Absence uses the localized loading string; every
   *  supplied value, including the English fallback, remains literal. */
  @property() label?: string;

  private sink?: AnnouncementSink;

  override disconnectedCallback(): void {
    this.sink?.release();
    this.sink = undefined;
    super.disconnectedCallback();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (!this.announce) {
      this.sink?.release();
      this.sink = undefined;
    } else if (changed.has('announce') || changed.has('label')) {
      // Loaded on first use: only an opted-in skeleton ever announces.
      void import('../../../internal/announcer.js').then(({ acquireAnnouncementSink }) => {
        if (!this.announce || !this.isConnected) return;
        this.sink ??= acquireAnnouncementSink('polite', { document: this.ownerDocument, source: this });
        // Text follows a frame after the sink mounts so assistive technology is already watching it.
        this.ownerDocument.defaultView?.requestAnimationFrame(() => {
          if (this.announce) this.sink?.announce(this.label ?? this.localize('loading'));
        });
      });
    }
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('width')) this.applySize('--lr-skeleton-w', this.width);
    if (changed.has('height')) this.applySize('--lr-skeleton-h', this.height);
  }

  /** `willUpdate` runs in SSR (no CSSOM there), so the server writes plain lengths into `style`. */
  private applySize(name: string, value?: string): void {
    if (typeof document === 'undefined') {
      if (value && /^[\w\s.%+*/(),-]+$/.test(value)) {
        this.setAttribute('style', [this.getAttribute('style'), `${name}:${value}`].filter(Boolean).join(';'));
      }
    } else if (value) {
      this.style.setProperty(name, value);
    } else {
      this.style.removeProperty(name);
    }
  }

  override render(): TemplateResult {
    return html`<span part="base indicator" data-effect=${this.effect}></span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-skeleton': LyraSkeleton;
  }
}

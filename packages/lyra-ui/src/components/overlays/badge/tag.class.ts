import { html, nothing, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { closeIcon } from '../../../internal/icons.js';
import { LyraBadge } from './badge.class.js';
import { styles as badgeStyles } from './badge.styles.js';
import { styles as tagStyles } from './tag.styles.js';

export interface LyraTagEventMap {
  'lr-remove': CustomEvent<undefined>;
}

/** `<lr-tag>` — the compact badge treatment with tag semantics: the same `variant`/`size`/
 * `appearance`/`pill`/`attention` surface as `<lr-badge>`, plus an optional remove affordance for
 * a tag standing in for a dismissible selection, filter, or keyword.
 *
 * Unlike `<lr-chip>` (a deliberately controlled component that only ever announces a remove
 * request), a removable tag removes *itself* on activation. `lr-remove` is the veto point for
 * that: cancel it with `preventDefault()` to keep the tag mounted and own the removal from your
 * own state instead.
 *
 * @customElement lr-tag
 * @slot - Tag content.
 * @slot start - Content placed before the label, typically an icon.
 * @slot end - Content placed after the label, typically an icon.
 * @event lr-remove - The remove button was activated (click, or Enter/Space while focused —
 * native `<button>` behavior). Cancelable: `preventDefault()` keeps the tag in the DOM, otherwise
 * the tag removes itself. Only rendered, and therefore only fired, while `withRemove` is set. The
 * event's `target` is the tag.
 * @csspart base - The tag surface.
 * @csspart start - Wrapper around the `start` slot. Hidden entirely while empty.
 * @csspart content - Wrapper around the default slot; the part that truncates with an ellipsis.
 * @csspart end - Wrapper around the `end` slot. Hidden entirely while empty.
 * @csspart remove-button - The remove affordance, only rendered while `withRemove`.
 * @cssprop [--lr-tag-remove-radius=var(--lr-badge-radius)] - Corner radius of the remove button,
 * defaulting to the tag's own corner so retuning one retunes both.
 * @cssprop [--lr-tag-remove-hover-background=color-mix(in srgb, currentColor 16%, transparent)] -
 * Background of the remove button on hover.
 */
export class LyraTag extends LyraBadge<LyraTagEventMap> {
  static override styles = [LyraElement.styles, badgeStyles, tagStyles];

  /** Renders the remove affordance. */
  @property({ attribute: 'with-remove', type: Boolean, reflect: true }) withRemove = false;

  // The remove button's accessible name is derived from the light-DOM label, which a consumer can
  // rewrite at any time without touching a reactive property -- nothing would otherwise re-render
  // the button and the name would go stale. Only wired while the button exists, so a bulk list of
  // plain tags pays nothing for it. Mirrors `<lr-chip>`'s identical label observer.
  private labelObserver?: MutationObserver;

  override connectedCallback(): void {
    super.connectedCallback();
    this.syncLabelObserver();
  }

  override disconnectedCallback(): void {
    this.labelObserver?.disconnect();
    this.labelObserver = undefined;
    super.disconnectedCallback();
  }

  private syncLabelObserver(): void {
    if (!this.withRemove || !this.isConnected || typeof MutationObserver === 'undefined') {
      this.labelObserver?.disconnect();
      this.labelObserver = undefined;
      return;
    }
    this.labelObserver ??= new MutationObserver(() => this.requestUpdate());
    this.labelObserver.observe(this, { childList: true, characterData: true, subtree: true });
  }

  // Only the default slot's own content names the remove button -- text living in the decorative
  // `start`/`end` slots must not leak into "Remove {label}". Restricting to Text and Element nodes
  // also excludes Comment nodes: when a consumer interpolates the label through a lit-html
  // expression rather than a static string, lit-html inserts a marker comment alongside the text
  // node, and that comment's own data is internal bookkeeping, not label content.
  private get labelText(): string {
    return Array.from(this.childNodes)
      .filter((node): node is Text | Element => {
        if (node.nodeType === Node.TEXT_NODE) return true;
        if (!(node instanceof Element)) return false;
        const slot = node.getAttribute('slot');
        return slot !== 'start' && slot !== 'end';
      })
      .map((node) => node.textContent ?? '')
      .join('')
      .trim();
  }

  private get accessibleRemoveLabel(): string {
    const hostLabel = this.getAttribute('aria-label');
    if (hostLabel) return hostLabel;
    const text = this.labelText;
    return text ? this.localize('removeWithContext', undefined, { label: text }) : this.localize('remove');
  }

  private onRemoveClick = (): void => {
    const event = this.emit('lr-remove', undefined, { cancelable: true });
    if (!event.defaultPrevented) this.remove();
  };

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('withRemove')) this.syncLabelObserver();
  }

  protected override renderTrailing(): unknown {
    if (!this.withRemove) return nothing;
    return html`<button
      part="remove-button"
      type="button"
      aria-label=${this.accessibleRemoveLabel}
      @click=${this.onRemoveClick}
    >
      ${closeIcon()}
    </button>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'lr-tag': LyraTag;
  }
}

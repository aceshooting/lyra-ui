import { html, nothing, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import {
  bindAccessibleTextObserver,
  composedAccessibleVisibleText,
} from '../../../internal/accessibility-visibility.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { closeIcon } from '../../../internal/icons.js';
import { variants } from '../../../internal/variants.styles.js';
import { LyraBadge, type BadgeVariant } from './badge.class.js';
import { styles as badgeStyles } from './badge.styles.js';
import { styles as tagStyles } from './tag.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_remove, LYRA_DEFAULT_removeWithContext } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


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
 * @slot - Tag content. A removable tag keeps its action name synchronized with visible accessible
 * label text through forwarding slots.
 * @slot start - Content placed before the label, typically an icon.
 * @slot end - Content placed after the label, typically an icon.
 * @event lr-remove - The remove button was activated (click, or Enter/Space while focused —
 * native `<button>` behavior). Cancelable: `preventDefault()` keeps the tag in the DOM, otherwise
 * the tag removes itself. Only rendered, and therefore only fired, while `withRemove` or its
 * Shoelace-compatible `removable` alias is set. The event's `target` is the tag.
 * @csspart base - The tag surface.
 * @csspart start - Wrapper around the `start` slot. Hidden entirely while empty.
 * @csspart content - Wrapper around the default slot; the part that truncates with an ellipsis.
 * @csspart end - Wrapper around the `end` slot. Hidden entirely while empty.
 * @csspart remove-button - The remove affordance, only rendered while `withRemove`.
 * @csspart remove-button__base - Shoelace-compatible alias for `remove-button`; both names are on
 *   the same node.
 * @cssprop [--lr-tag-remove-radius=var(--lr-badge-radius)] - Corner radius of the remove button,
 * defaulting to the tag's own corner so retuning one retunes both.
 * @cssprop [--lr-tag-remove-hover-background=color-mix(in srgb, currentColor 16%, transparent)] -
 * Background of the remove button on hover.
 * @status stable
 * @since 4.0.0
 */
export class LyraTag extends LyraBadge<LyraTagEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    remove: LYRA_DEFAULT_remove,
    removeWithContext: LYRA_DEFAULT_removeWithContext,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, variants, badgeStyles, tagStyles];

  private upstreamTextVariant = false;

  /** Adds Shoelace's `text` variant write spelling. It renders as a neutral plain tag while the
   * public read value remains Lyra's canonical `neutral` semantic palette. */
  override get variant(): BadgeVariant {
    return super.variant;
  }
  override set variant(value: BadgeVariant | 'primary' | 'text') {
    const text = value === 'text';
    const textChanged = text !== this.upstreamTextVariant;
    this.upstreamTextVariant = text;
    super.variant = text ? 'neutral' : value;
    if (textChanged) this.requestUpdate();
  }

  /** Renders the remove affordance. */
  @property({ attribute: 'with-remove', type: Boolean, reflect: true }) withRemove = false;

  /** Shoelace-compatible alias for `withRemove`. */
  @property({ type: Boolean })
  get removable(): boolean {
    return this.withRemove;
  }
  set removable(next: boolean) {
    const old = this.withRemove;
    this.withRemove = Boolean(next);
    this.requestUpdate('removable', old);
  }

  // The remove button's accessible name is derived from the light-DOM label, which a consumer can
  // rewrite at any time without touching a reactive property -- nothing would otherwise re-render
  // the button and the name would go stale. Only wired while the button exists, so a bulk list of
  // plain tags pays nothing for it. Mirrors `<lr-chip>`'s identical label observer.
  private labelObserver?: MutationObserver;
  // A server renderer cannot inspect projected light DOM. Cache the browser-derived label so a
  // hydrating mount can reproduce the server's bare remove name first, then add context without
  // replacing the action node on the corrective update.
  @state() private labelText = '';
  private readonly onLabelSlotChange = (event: Event): void => {
    const target = event.target as Element | null;
    if (target?.nodeType !== 1 || target.localName !== 'slot') return;
    this.bindLabelObserverTargets();
    if (this.withRemove) this.recomputeLabelText();
  };

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('slotchange', this.onLabelSlotChange);
    this.syncLabelObserver();
    if (this.hasUpdated) {
      if (this.withRemove) this.recomputeLabelText();
    } else {
      this.seedFirstRenderState(() => this.recomputeLabelText());
    }
  }

  override disconnectedCallback(): void {
    this.removeEventListener('slotchange', this.onLabelSlotChange);
    this.labelObserver?.disconnect();
    this.labelObserver = undefined;
    super.disconnectedCallback();
  }

  private syncLabelObserver(): void {
    const MutationObserverCtor = (this.ownerDocument as Document | undefined)?.defaultView
      ?.MutationObserver;
    if (!this.withRemove || !this.isConnected || !MutationObserverCtor) {
      this.labelObserver?.disconnect();
      this.labelObserver = undefined;
      return;
    }
    this.labelObserver ??= new MutationObserverCtor(() => {
      this.bindLabelObserverTargets();
      this.recomputeLabelText();
    });
    this.bindLabelObserverTargets();
  }

  // `'slot'` widens the shared content-node filter: only the default slot's content names the
  // remove button, so a light-DOM child moving to or from the decorative `start`/`end` slots
  // changes the name. Mirrors `<lr-chip>`'s identical binding.
  private bindLabelObserverTargets(): void {
    bindAccessibleTextObserver(this.labelObserver, this, ['slot']);
  }

  // Only the default slot's own content names the remove button -- text living in the decorative
  // `start`/`end` slots must not leak into "Remove {label}", which is what the node selection below
  // is for. The extraction itself is the library's shared `composedAccessibleVisibleText()`: it
  // walks slots, honors hidden/inert/`aria-hidden`/CSS-hidden branches, and counts only Text and
  // Element nodes. That last part matters here: when a consumer interpolates the label through a
  // lit-html expression rather than a static string, lit-html inserts a marker comment alongside
  // the text node, and that comment's own data is internal bookkeeping, not label content.
  private recomputeLabelText(): void {
    const renderRoot = (this as unknown as { renderRoot?: ParentNode }).renderRoot;
    const slot = renderRoot?.querySelector<HTMLSlotElement>('slot:not([name])');
    const lightDomNodes = (this as unknown as { childNodes?: NodeListOf<ChildNode> }).childNodes;
    const nodes = slot
      ? slot.assignedNodes({ flatten: true })
      : Array.from(lightDomNodes ?? []).filter((node) => {
          if (node.nodeType !== 1) return true;
          const slotName = (node as Element).getAttribute('slot');
          return slotName !== 'start' && slotName !== 'end';
        });
    this.labelText = nodes
      .map(composedAccessibleVisibleText)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private get accessibleRemoveLabel(): string {
    const hostLabel = this.getAttribute('aria-label');
    if (hostLabel !== null) return hostLabel;
    const text = this.labelText;
    return text ? this.localize('removeWithContext', undefined, { label: text }) : this.localize('remove');
  }

  private onRemoveClick = (): void => {
    const event = this.emit('lr-remove', undefined, { cancelable: true });
    if (!event.defaultPrevented) this.remove();
  };

  // Only ever present while `withRemove` -- see renderTrailing() below.
  @query('[part~="remove-button"]') private removeButtonEl?: HTMLButtonElement;

  /** Forwards host activation to the remove button, mirroring `<lr-button>`'s `click()` override.
   *  A no-op while `withRemove` is unset: there is no internal control to forward to. */
  override click(): void {
    this.removeButtonEl?.click();
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.toggleAttribute('data-upstream-text-variant', this.upstreamTextVariant);
    if (changed.has('withRemove')) {
      this.syncLabelObserver();
      if (this.withRemove && this.hasUpdated) this.recomputeLabelText();
    }
  }

  protected override renderTrailing(): unknown {
    if (!this.withRemove) return nothing;
    return html`<button
      part="remove-button remove-button__base"
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

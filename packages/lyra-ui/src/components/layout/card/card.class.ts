import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { activeElementIn } from '../../../internal/active-element.js';
import { hostAriaLabel } from '../../../internal/a11y.js';
import { declaredDefaultConverter } from '../../../internal/converters.js';
import {
  bindAccessibleTextObserver,
  composedAccessibilityText,
} from '../../../internal/accessibility-visibility.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { safeLinkHref } from '../../../internal/safe-url.js';
import type { LyraAppearance } from '../../../internal/variants.js';
import { styles } from './card.styles.js';

export type CardOrientation = 'horizontal' | 'vertical';

export interface LyraCardEventMap {
  'lr-card-activate': CustomEvent<null>;
}

/**
 * Anything in the composed path between the original event target and `[part='base']` that a user
 * would reasonably consider "the thing I clicked". A whole-card activation must not fire when the
 * user aimed at a slotted control inside the card -- the card is a *container*, so unlike
 * `<lr-chip>`'s `toggleable` (which forbids focusable children outright and can therefore carry
 * `role="button"`), it can only distinguish the two cases at event time.
 */
const NESTED_CONTROL_SELECTOR = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  'summary',
  'audio[controls]',
  'video[controls]',
  'label',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="switch"]',
  '[role="radio"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="tab"]',
  '[role="textbox"]',
  '[role="slider"]',
  '[role="spinbutton"]',
].join(',');

function isElementNode(value: EventTarget | undefined): value is Element {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { nodeType?: unknown }).nodeType === 1 &&
    typeof (value as { matches?: unknown }).matches === 'function'
  );
}

/**
 * `<lr-card>` — a generic, styled bordered content container: the "small bordered surface with
 * padding" idiom common to hero highlights, clickable grid tiles, and management-list items. A
 * direct `<lr-*>` counterpart to `<wa-card>`'s contract, staying slot-compatible with
 * `lr-result-card` where they overlap.
 *
 * The header is allocation-responsive: long or translated header content can shrink and wrap,
 * and the actions group moves onto another line when both no longer fit side by side.
 *
 * @customElement lr-card
 * @slot - The card body.
 * @slot header - Header row content, rendered above the body.
 * @slot media - Media content, rendered above the header or at logical start when horizontal.
 * @slot image - Shoelace-compatible alias for `media`.
 * @slot footer - Footer content, rendered below the body.
 * @slot actions - Horizontal-card actions; retained as the legacy header-actions alias vertically.
 * @slot header-actions - Controls rendered alongside the vertical header.
 * @slot footer-actions - Controls rendered alongside the vertical footer.
 * @csspart base - The outer container (a `<div>`, or a stretched `<a>` behind the consumer slots
 *   when `href` is set).
 * @csspart activation-button - The native whole-card action, rendered while `actionable`
 *   without `href`. It is a sibling of slotted controls, so actionable descendants are never
 *   nested inside another actionable role.
 * @csspart media - Wrapper around the `media` and `image` slots. Hidden entirely when empty.
 * @csspart image - Shoelace-compatible alias on the same wrapper as `media`.
 * @csspart header - Wrapper around the `header` slot and `actions`. Hidden entirely when both are empty.
 * @csspart actions - Wrapper around the `actions` and `header-actions` slots. Hidden entirely
 *   when both are empty.
 * @csspart body - Wrapper around the default slot.
 * @csspart footer - Wrapper around the `footer` and `footer-actions` slots. Hidden entirely when
 *   both are empty.
 * @event lr-card-activate - The whole card was activated (click, or Enter/Space on the native
 * `activation-button`). No detail. Only fired while `actionable` is set **without** `href`
 * -- with `href` the stretched native `<a>` is the activation. Never fired for an interaction that
 * originated in a slotted control (a button, link, input, or anything else focusable), so a card
 * can keep its own action buttons.
 * @cssprop [--spacing=var(--lr-space-m)] - Space around and between card sections.
 * @cssprop [--padding=var(--spacing,var(--lr-space-m))] - Shoelace-compatible section padding.
 * @cssprop [--border-color=var(--lr-color-border)] - Shoelace-compatible border color.
 * @cssprop [--border-radius=var(--lr-radius)] - Shoelace-compatible corner radius.
 * @cssprop [--border-width=var(--lr-border-width-thin)] - Shoelace-compatible border width.
 * @cssprop [--lr-card-filled-bg=var(--lr-color-brand-quiet)] - Filled appearance background.
 * @cssprop [--lr-card-filled-outlined-bg=var(--lr-color-brand-quiet)] - Filled-outlined background.
 * @cssprop [--lr-card-accent-border-color=var(--lr-color-brand)] - Accent stripe color.
 * @cssprop [--lr-card-interactive-hover-border-color=var(--lr-color-brand)] - Interactive hover border.
 * @cssprop [--lr-card-interactive-active-border-color=var(--lr-color-brand)] - Interactive pressed border.
 * @cssprop --lr-card-interactive-active-overlay - Interactive pressed overlay; defaults to the
 *   former transparent active mix.
 * @status stable
 * @since 4.0.0
 */
export class LyraCard extends LyraElement<LyraCardEventMap> {
  static override styles = [LyraElement.styles, styles];

  /** Visual treatment, mirroring `wa-card`'s `appearance` vocabulary. `'outlined'` (the default)
   *  is a bordered surface -- the common "small bordered surface with padding" idiom. */
  @property({ reflect: true,
    converter: declaredDefaultConverter<LyraAppearance>('outlined'),
  }) appearance: LyraAppearance = 'outlined';

  /** Section flow. Horizontal cards arrange media, body, and `actions` side by side. */
  @property({ reflect: true,
    converter: declaredDefaultConverter<CardOrientation>('vertical'),
  }) orientation: CardOrientation = 'vertical';

  /** SSR presence hints. Hydrated cards also detect populated slots automatically. */
  @property({ type: Boolean, attribute: 'with-header', reflect: true })
  withHeader = false;
  @property({ type: Boolean, attribute: 'with-header-actions', reflect: true })
  withHeaderActions = false;
  @property({ type: Boolean, attribute: 'with-media', reflect: true })
  withMedia = false;
  @property({ type: Boolean, attribute: 'with-footer', reflect: true })
  withFooter = false;
  @property({ type: Boolean, attribute: 'with-footer-actions', reflect: true })
  withFooterActions = false;

  /** Opt-in no-link whole-card action behavior: the hover/focus-visible treatment (border-color shift,
   *  `cursor: pointer`) plus, when `href` is **not** also set, real activation semantics --
   *  `[part='activation-button']` becomes the focusable native button, responds to Enter/Space,
   *  and emits `lr-card-activate`. With `href` set the stretched native `<a>` owns navigation and
   *  `lr-card-activate` is never fired. `false` (the default) reproduces today's exact static
   *  output: no button, no listeners, no events. */
  @property({ type: Boolean, reflect: true }) actionable = false;

  /** Accessible name forwarded to the native activation owner. The `aria-label` attribute/property
   *  applies by presence to the interactive button or linked anchor, including an explicitly empty
   *  value. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  /** When set, a real stretched `<a href=...>` renders behind the card's consumer slots for a
   *  whole-card link (e.g. a wide CTA tile). Slotted controls remain independent actions; clicks
   *  in noninteractive card content still follow the link. Unset (the default) renders a plain
   *  `<div>`. */
  @property() href?: string;

  /** Native anchor target, used only while `href` resolves to a link. Any target forces the
   *  `noopener noreferrer` security floor while preserving safe author `rel` tokens. */
  @property() target?: string;

  /** Author-settable relationship tokens. `opener` is always stripped; whenever `target` is set,
   *  the rendered link force-adds `noopener noreferrer` without discarding other tokens. */
  @property() rel?: string;

  private get resolvedRel(): string | undefined {
    const authored = (this.rel ?? '')
      .split(/\s+/)
      .filter((token) => token !== '' && token.toLowerCase() !== 'opener');
    const tokens = new Set(authored);
    if (this.target) {
      tokens.add('noopener');
      tokens.add('noreferrer');
    }
    return tokens.size > 0 ? [...tokens].join(' ') : undefined;
  }

  @state() private hasHeaderSlot = false;
  @state() private hasMediaSlot = false;
  @state() private hasImageSlot = false;
  @state() private hasFooterSlot = false;
  @state() private hasActionsSlot = false;
  @state() private hasHeaderActionsSlot = false;
  @state() private hasFooterActionsSlot = false;
  @state() private accessibleContentText = '';
  private contentObserver?: MutationObserver;
  private contentObserverDocument?: Document;
  private contentObserverGeneration = 0;
  private semanticFocusOrigin?: Element;

  private semanticOwner(): HTMLElement | null {
    const root = this.renderRoot;
    if (!root) return null;
    return (
      root.querySelector<HTMLElement>('a[part="base"]') ??
      root.querySelector<HTMLElement>('button[part="activation-button"]') ??
      root.querySelector<HTMLElement>('div[part="base"]')
    );
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('href') || changed.has('actionable')) {
      const previous = this.semanticOwner();
      const nextKind = safeLinkHref(this.href)
        ? 'a'
        : this.actionable
          ? 'button'
          : 'div';
      this.semanticFocusOrigin =
        previous !== null &&
        previous.localName !== nextKind &&
        activeElementIn(this.shadowRoot) === previous
          ? previous
          : undefined;
    }
    if (!this.hasUpdated) {
      this.hasHeaderSlot = Array.from(this.children).some(
        (el) => el.getAttribute('slot') === 'header'
      );
      this.hasMediaSlot = Array.from(this.children).some(
        (el) => el.getAttribute('slot') === 'media'
      );
      this.hasImageSlot = Array.from(this.children).some(
        (el) => el.getAttribute('slot') === 'image'
      );
      this.hasFooterSlot = Array.from(this.children).some(
        (el) => el.getAttribute('slot') === 'footer'
      );
      this.hasActionsSlot = Array.from(this.children).some(
        (el) => el.getAttribute('slot') === 'actions'
      );
      this.hasHeaderActionsSlot = Array.from(this.children).some(
        (el) => el.getAttribute('slot') === 'header-actions'
      );
      this.hasFooterActionsSlot = Array.from(this.children).some(
        (el) => el.getAttribute('slot') === 'footer-actions'
      );
      this.recomputeAccessibleContentText();
    }
    void changed;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const focusOrigin = this.semanticFocusOrigin;
    this.semanticFocusOrigin = undefined;
    if (!focusOrigin) return;
    this.scheduleAfterUpdate(() => {
      const internalActive = activeElementIn(this.shadowRoot);
      const documentActive = activeElementIn(this.ownerDocument);
      if (
        (internalActive !== null && internalActive !== focusOrigin) ||
        (documentActive !== null && documentActive !== this && documentActive !== this.ownerDocument.body)
      ) return;
      const target = this.semanticOwner();
      target?.focus();
    }, 'card-owner-focus');
  }

  private onHeaderSlotChange = (e: Event): void => {
    this.hasHeaderSlot =
      (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length >
      0;
  };
  private onMediaSlotChange = (e: Event): void => {
    this.hasMediaSlot =
      (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length >
      0;
  };
  private onImageSlotChange = (e: Event): void => {
    this.hasImageSlot =
      (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length >
      0;
  };
  private onFooterSlotChange = (e: Event): void => {
    this.hasFooterSlot =
      (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length >
      0;
  };
  private onActionsSlotChange = (e: Event): void => {
    this.hasActionsSlot =
      (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length >
      0;
  };
  private onHeaderActionsSlotChange = (e: Event): void => {
    this.hasHeaderActionsSlot =
      (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length >
      0;
  };
  private onFooterActionsSlotChange = (e: Event): void => {
    this.hasFooterActionsSlot =
      (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length >
      0;
  };

  /**
   * A card is a *container*, so it cannot forbid focusable children the way `<lr-chip>`'s
   * `toggleable` mode does -- which is exactly why `[part='base']` deliberately carries no
   * `role="button"` (axe-core's `nested-interactive` rule, which this library's own a11y gate
   * enforces, forbids a focusable descendant of a `role="button"` ancestor). The trade-off is that
   * "did the user aim at the card, or at a control inside it?" has to be answered at event time
   * instead: walk `composedPath()` from the original target up to the current card interaction
   * region and bail out if anything along the way is itself a control. `composedPath()` (rather
   * than `e.target`) is what makes this work through a slotted component's own shadow root -- a
   * click on `<lr-button>` retargets to the host, but its composed path still contains the
   * internal native `<button>`.
   */
  private originatesInNestedControl(
    e: Event,
    root: EventTarget | null
  ): boolean {
    for (const node of e.composedPath()) {
      if (node === root) return false;
      if (isElementNode(node) && node.matches(NESTED_CONTROL_SELECTOR))
        return true;
    }
    return false;
  }

  private onBaseClick = (e: Event): void => {
    const origin = e.composedPath()[0];
    if (
      isElementNode(origin) &&
      origin.getAttribute('part') === 'activation-button'
    ) {
      this.emit('lr-card-activate', null);
      return;
    }
    if (this.originatesInNestedControl(e, e.currentTarget)) return;
    this.emit('lr-card-activate', null);
  };

  private onLinkedContentClick = (e: Event): void => {
    if (e.defaultPrevented || this.originatesInNestedControl(e, e.currentTarget)) return;
    // Replace the proxy source click with the native anchor click. Without containment, both
    // composed events escape the card and one physical activation looks like two application
    // clicks even though navigation happens only once.
    e.stopPropagation();
    this.renderRoot
      .querySelector<HTMLAnchorElement>('a[part~="base"][href]')
      ?.click();
  };

  override connectedCallback(): void {
    super.connectedCallback();
    this.recomputeAccessibleContentText();
    this.armContentObserver();
  }

  private recomputeAccessibleContentText(): void {
    this.accessibleContentText = composedAccessibilityText(this.childNodes, { requireRendered: false })
      .replace(/\s+/g, ' ')
      .trim();
  }

  private armContentObserver(): void {
    const ownerDocument = this.ownerDocument;
    if (!this.isConnected) return;
    if (this.contentObserver && this.contentObserverDocument === ownerDocument) return;
    this.resetContentObserver();
    const MutationObserverCtor = ownerDocument.defaultView?.MutationObserver;
    if (!MutationObserverCtor) return;
    const generation = this.contentObserverGeneration;
    const observer = new MutationObserverCtor(() => {
      if (
        this.contentObserver !== observer ||
        this.contentObserverDocument !== ownerDocument ||
        this.contentObserverGeneration !== generation ||
        !this.isConnected ||
        this.ownerDocument !== ownerDocument
      ) {
        return;
      }
      this.recomputeAccessibleContentText();
    });
    this.contentObserver = observer;
    this.contentObserverDocument = ownerDocument;
    bindAccessibleTextObserver(observer, this, ['alt', 'aria-labelledby', 'slot']);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.semanticFocusOrigin = undefined;
    this.resetContentObserver();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.resetContentObserver();
  }

  private resetContentObserver(): void {
    this.contentObserverGeneration += 1;
    this.contentObserver?.disconnect();
    this.contentObserver = undefined;
    this.contentObserverDocument = undefined;
  }

  /** Activates the native whole-card owner: the linked anchor when `href` is safe, or the
   *  activation button while `actionable` is set without a link. Passive cards remain inert. */
  override click(): void {
    this.renderRoot
      .querySelector<HTMLAnchorElement | HTMLButtonElement>(
        'a[part~="base"], button[part~="activation-button"]'
      )
      ?.click();
  }

  override render(): TemplateResult {
    const hasMedia = this.withMedia || this.hasMediaSlot || this.hasImageSlot;
    const hasHeaderActions =
      this.withHeaderActions || this.hasHeaderActionsSlot || this.hasActionsSlot;
    const hasHeader = this.withHeader || this.hasHeaderSlot || hasHeaderActions;
    const hasFooterActions = this.withFooterActions || this.hasFooterActionsSlot;
    const hasFooter = this.withFooter || this.hasFooterSlot || hasFooterActions;
    const href = safeLinkHref(this.href);
    const activatable = this.actionable && !href;
    const accessibleLabel = hostAriaLabel(this) ?? this.accessibleLabel;
    const body = html`
      ${activatable
        ? html`<button
            part="activation-button"
            type="button"
            tabindex="0"
            aria-label=${accessibleLabel ?? (this.accessibleContentText || nothing)}
          ></button>`
        : nothing}
      <div part="media image" ?hidden=${!hasMedia}>
        <slot name="media" @slotchange=${this.onMediaSlotChange}></slot>
        <slot name="image" @slotchange=${this.onImageSlotChange}></slot>
      </div>
      <div part="header" ?hidden=${!hasHeader}>
        <slot name="header" @slotchange=${this.onHeaderSlotChange}></slot>
        <div part="actions" ?hidden=${!hasHeaderActions}>
          <slot name="actions" @slotchange=${this.onActionsSlotChange}></slot>
          <slot
            name="header-actions"
            @slotchange=${this.onHeaderActionsSlotChange}
          ></slot>
        </div>
      </div>
      <div part="body"><slot></slot></div>
      <div part="footer" ?hidden=${!hasFooter}>
        <slot name="footer" @slotchange=${this.onFooterSlotChange}></slot>
        <span class="footer-actions" ?hidden=${!hasFooterActions}>
          <slot
            name="footer-actions"
            @slotchange=${this.onFooterActionsSlotChange}
          ></slot>
        </span>
      </div>
    `;
    // With `href`, the `<a>` is already focusable and Enter-activated natively -- layering the
    // synthetic activation on top would double-fire. Everything below binds to `nothing` when the
    // card has not opted in, so the passive default renders byte-identically to before (mirrors
    // `<lr-chip>`'s `toggleable` gating).
    return href
      ? html`<div class="linked-shell">
          <a
            part="base"
            href=${href}
            target=${this.target || nothing}
            rel=${this.resolvedRel ?? nothing}
            data-actionable="true"
            aria-label=${accessibleLabel ?? nothing}
            aria-labelledby=${accessibleLabel === null ? 'linked-content' : nothing}
          ></a>
          <div id="linked-content" class="linked-content" @click=${this.onLinkedContentClick}>
            ${body}
          </div>
        </div>`
      : html`<div
          part="base"
          data-actionable=${activatable ? 'true' : nothing}
          tabindex=${!activatable && this.semanticFocusOrigin ? '-1' : nothing}
          @click=${activatable ? this.onBaseClick : nothing}
        >
          ${body}
        </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-card': LyraCard;
  }
}

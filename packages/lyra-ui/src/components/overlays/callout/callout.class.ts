import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import {
  acquireAnnouncementSink,
  type AnnouncementSink,
} from '../../../internal/announcer.js';
import { composedParentElement } from '../../../internal/active-element.js';
import { isAccessibilityVisible } from '../../../internal/accessibility-visibility.js';
import { composedAccessibilityText } from '../../../internal/announcement-text.js';
import {
  applyComposedFocusRepair,
  captureComposedFocusRepair,
  collectComposedFocusTargets,
} from '../../../internal/focus-navigation.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import {
  resolveHeadingLevel,
  type LyraHeadingLevel,
} from '../../../internal/heading-level.js';
import { SlotPresenceController } from '../../../internal/slot-presence-controller.js';
import type {
  LyraAppearance,
  LyraSize,
  LyraVariant,
} from '../../../internal/variants.js';
import {
  contextualSizes,
  contextualVariants,
} from '../../../internal/contextual-vocabulary.styles.js';
import { styles } from './callout.styles.js';
import {
  literalSetConverter,
  presenceTrueDefaultBooleanConverter as trueDefaultBooleanConverter,
} from '../../../internal/converters.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_calloutAnnouncementWithContext, LYRA_DEFAULT_close } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

/** The library's one semantic-tone vocabulary. */
export type CalloutVariant = LyraVariant;
/** The library's shared fill/border treatment vocabulary. */
export type CalloutAppearance = LyraAppearance;
/** The library's one size ladder, in either spelling. */
export type CalloutSize = LyraSize;
export interface LyraCalloutEventMap {
  'lr-close': CustomEvent<null>;
}

const CALLOUT_VARIANT = literalSetConverter<CalloutVariant>(
  ['brand', 'neutral', 'success', 'warning', 'danger'],
  'brand'
);
const CALLOUT_VARIANTS = new Set<CalloutVariant>([
  'brand',
  'neutral',
  'success',
  'warning',
  'danger',
]);
const CALLOUT_SIZE = literalSetConverter<CalloutSize>(
  ['2xs', 'xs', 's', 'm', 'l', 'xl', 'small', 'medium', 'large'],
  'm'
);
const CALLOUT_HEADING_LEVEL = literalSetConverter<LyraHeadingLevel>(
  ['1', '2', '3', '4', '5', '6', 'none'],
  '3'
);
const CALLOUT_APPEARANCES = new Set<CalloutAppearance>([
  'accent',
  'filled',
  'outlined',
  'filled-outlined',
  'plain',
]);
const normalizeCalloutAppearance = (
  value: unknown
): CalloutAppearance | undefined =>
  typeof value === 'string' &&
  CALLOUT_APPEARANCES.has(value as CalloutAppearance)
    ? (value as CalloutAppearance)
    : undefined;
const calloutAppearanceConverter = {
  fromAttribute: normalizeCalloutAppearance,
  toAttribute: (value: CalloutAppearance | undefined): string | null =>
    normalizeCalloutAppearance(value) ?? null,
};

function isComposedWithin(owner: Element, candidate: Element): boolean {
  let current: Element | null = candidate;
  while (current) {
    if (current === owner) return true;
    current = composedParentElement(current);
  }
  return false;
}

function nearestExternalFocusTarget(owner: Element): HTMLElement | null {
  const documentElement = owner.ownerDocument?.documentElement;
  if (!documentElement) return null;
  const targets = collectComposedFocusTargets(documentElement, {
    mode: 'programmatic',
  }).elements;
  const owned = targets
    .map((target, index) => (isComposedWithin(owner, target) ? index : -1))
    .filter((index) => index >= 0);
  if (owned.length === 0) return null;
  const first = owned[0]!;
  const last = owned[owned.length - 1]!;
  return (
    targets
      .slice(last + 1)
      .find((target) => !isComposedWithin(owner, target)) ??
    targets
      .slice(0, first)
      .reverse()
      .find((target) => !isComposedWithin(owner, target)) ??
    null
  );
}

/**
 * `<lr-callout>` — an inline message surface for status, warning, and error content.
 * Set `inline` for lightweight reactive status/error text: it removes the panel chrome while
 * preserving the accessible content, optional leading icon, and close action.
 * Initial content is not announced as a new live update. Once the first render and slot
 * distribution settle, later content updates are appended to a shared light-DOM polite sink, or
 * an assertive one for `variant="danger"`. Announcements normalize accessible heading/message
 * text, excluding icon and close chrome plus subtree-pruned descendants. A visibility-hidden
 * wrapper omits its own text but may contain a descendant that restores visibility; updates while
 * the host or a composed ancestor is hidden stay silent. A nested forwarding slot contributes its
 * flattened assigned text rather than fallback content, and later assignment or assigned-content
 * mutations are observed. A nonempty host/property accessible label prefixes the visible update as
 * context instead of replacing it; the complete order and punctuation come from the localized
 * `calloutAnnouncementWithContext` message. An explicitly empty host label still leaves visible
 * text live. Property and rich-slot headings default to semantic level 3; set `heading-level`
 * from `1`–`6` to fit the surrounding outline, or `none` for visual-only heading text.
 *
 * @customElement lr-callout
 * @slot - Message content.
 * @slot heading - Optional rich heading content; its wrapper owns the configured heading level.
 * @slot icon - Optional icon.
 * @event lr-close - The close action was accepted. Cancelable before the callout hides.
 * @attr inline - Uses the lightweight inline treatment without border, background, or panel padding.
 * @csspart base - The visible grid wrapper inside the host-owned callout surface.
 * @csspart icon - The icon wrapper.
 * @csspart content - The message content.
 * @csspart heading - The heading wrapper (`role="heading"` at the configured level unless opted out).
 * @csspart message - The message content wrapper.
 * @csspart close-button - The close button's interactive hit target, sized to the shared minimum
 *   tappable size (`--lr-icon-button-size`) in both the default panel and the compact `inline`
 *   variant.
 * @csspart close-icon - The close button's visible "×" glyph, independent of `close-button`'s hit
 *   target size -- shrinks in the `inline` variant while the hit target stays full-size.
 * @cssprop [--lr-callout-background=var(--lr-color-fill-quiet,var(--lr-color-brand-fill-quiet))] -
 *   The host surface's background: an inherited semantic quiet fill, with brand as the standalone
 *   fallback.
 * @cssprop [--lr-callout-border=var(--lr-color-fill-loud,var(--lr-color-brand-fill-loud))] - The
 *   host surface's border color.
 * @cssprop [--lr-callout-color=var(--lr-color-fill-loud,var(--lr-color-brand-fill-loud))] - The
 *   host surface's text color.
 * @cssprop [--lr-callout-close-hover-bg=var(--lr-color-brand-quiet)] - The close button's hover
 *   background, decoupled from `--lr-callout-background` so a consumer can retint one without
 *   affecting the other (e.g. keeping the hover fill visibly distinct from a `variant="brand"`
 *   panel, which shares the same default token).
 * @cssprop [--lr-callout-font-size=var(--lr-form-control-font-size,var(--lr-font-size-m))] - The callout's text size.
 *   Its private default follows the library's shared size ladder; an inherited or direct public
 *   value remains authoritative.
 * @cssprop [--lr-callout-padding=var(--lr-form-control-padding-inline,var(--lr-space-m))] - Padding of the panel, on
 *   both axes. Its private default follows the shared ladder's inline-padding knob: a panel's
 *   block rhythm is generous like a control's inline padding, not tight like its block padding
 *   (which exists to fit text inside a fixed control height). `inline` removes that private
 *   default entirely; an inherited or direct public value remains authoritative.
 * @cssprop [--lr-callout-gap=var(--lr-space-s)] - Space between the icon, the content, and the
 *   close action. Deliberately does not vary by `size`: it separates three adjacent boxes rather
 *   than setting the panel's density, and shrinking it at the small tiers only crowds them.
 * @status stable
 * @since 4.0.0
 */
export class LyraCallout extends LyraElement<LyraCalloutEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    calloutAnnouncementWithContext: LYRA_DEFAULT_calloutAnnouncementWithContext,
    close: LYRA_DEFAULT_close,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [
    LyraElement.styles,
    contextualVariants,
    contextualSizes,
    styles,
  ];

  /** Semantic palette. The property defaults to `brand` without forcing an attribute, allowing an
   *  unset nested callout to inherit its containing semantic context. Explicitly assigning
   *  `brand` reflects it, making the standalone default an intentional local override. Unsupported
   *  values normalize to `brand`. */
  private _variant: CalloutVariant = 'brand';

  @property({ reflect: true, useDefault: true, converter: CALLOUT_VARIANT })
  get variant(): CalloutVariant {
    return this._variant;
  }
  set variant(next: CalloutVariant) {
    const normalized = CALLOUT_VARIANT.normalizeReflected(
      this,
      'variant',
      next
    );
    const old = this._variant;
    if (old === normalized) return;
    this._variant = normalized;
    this.requestUpdate('variant', old);
  }

  /** How much of the active `variant` palette is spent on fill, border, and text. Unset preserves
   *  the established callout treatment; every explicit Web Awesome appearance is reflected and
   *  unsupported values normalize back to the omitted state. */
  private _appearance?: CalloutAppearance;

  @property({ reflect: true, converter: calloutAppearanceConverter })
  get appearance(): CalloutAppearance {
    return this._appearance as CalloutAppearance;
  }
  set appearance(next: CalloutAppearance) {
    const normalized = normalizeCalloutAppearance(next);
    if (
      this.hasAttribute('appearance') &&
      this.getAttribute('appearance') !== normalized
    ) {
      if (normalized === undefined) this.removeAttribute('appearance');
      else this.setAttribute('appearance', normalized);
    }
    const old = this._appearance;
    if (old === normalized) return;
    this._appearance = normalized;
    this.requestUpdate('appearance', old);
  }

  /** Visual density, on the library's shared ladder. The `m` property default is not reflected,
   *  so an unset nested callout inherits its containing size context. Both Web Awesome spellings
   *  are accepted (`s`/`small`, `m`/`medium`, `l`/`large`); unsupported values normalize to `m`. */
  private _size: CalloutSize = 'm';

  @property({ reflect: true, useDefault: true, converter: CALLOUT_SIZE })
  get size(): CalloutSize {
    return this._size;
  }
  set size(next: CalloutSize) {
    const normalized = CALLOUT_SIZE.normalizeReflected(this, 'size', next);
    const old = this._size;
    if (old === normalized) return;
    this._size = normalized;
    this.requestUpdate('size', old);
  }

  @property() heading = '';
  /** Semantic level of the visible property/slotted heading. Use `none` for visual-only text;
   *  invalid attributes and untyped writes normalize to reflected level 3. */
  private _headingLevel: LyraHeadingLevel = '3';

  @property({
    attribute: 'heading-level',
    reflect: true,
    converter: CALLOUT_HEADING_LEVEL,
  })
  get headingLevel(): LyraHeadingLevel {
    return this._headingLevel;
  }
  set headingLevel(next: LyraHeadingLevel) {
    const normalized = CALLOUT_HEADING_LEVEL.normalizeReflected(
      this,
      'heading-level',
      next
    );
    const old = this._headingLevel;
    if (old === normalized) return;
    this._headingLevel = normalized;
    this.requestUpdate('headingLevel', old);
  }
  @property({ type: Boolean, reflect: true }) closable = false;
  @property({ type: Boolean, reflect: true }) inline = false;

  @property({
    type: Boolean,
    reflect: true,
    converter: trueDefaultBooleanConverter,
  })
  open = true;
  @property({ attribute: 'accessible-label' }) accessibleLabel = '';
  private readonly slotPresence = new SlotPresenceController(this);
  private liveActive = false;
  private connectionGeneration = 0;
  private politeSink?: AnnouncementSink;
  private assertiveSink?: AnnouncementSink;
  private contentObserver?: MutationObserver;
  private lastAnnouncementText = '';

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('slotchange', this.onForwardedSlotChange);
    this.politeSink ??= acquireAnnouncementSink('polite', {
      document: this.ownerDocument,
      source: this,
    });
    this.assertiveSink ??= acquireAnnouncementSink('assertive', {
      document: this.ownerDocument,
      source: this,
    });
    const MutationObserverCtor =
      this.ownerDocument.defaultView?.MutationObserver;
    if (MutationObserverCtor) {
      this.contentObserver = new MutationObserverCtor((records) => {
        if (
          records.some(
            (record) =>
              !this.contains(record.target) ||
              this.isAnnouncementMutation(record)
          )
        ) {
          this.observeAnnouncementContent();
          this.announceCurrentContent();
        }
      });
      this.observeAnnouncementContent();
    }
    const generation = ++this.connectionGeneration;
    // Wait through the first slot-distribution paint and any update it schedules before arming;
    // otherwise initially slotted content could be mistaken for a later mutation.
    void this.updateComplete
      .then(() => {
        const view = this.ownerDocument?.defaultView;
        return typeof view?.requestAnimationFrame === 'function'
          ? new Promise<void>((resolve) =>
              view.requestAnimationFrame(() => resolve())
            )
          : Promise.resolve();
      })
      .then(() => this.updateComplete)
      .then(() => {
        if (this.isConnected && generation === this.connectionGeneration) {
          this.lastAnnouncementText = this.announcementText();
          this.liveActive = true;
        }
      });
  }

  override disconnectedCallback(): void {
    this.connectionGeneration += 1;
    this.liveActive = false;
    this.lastAnnouncementText = '';
    this.contentObserver?.disconnect();
    this.contentObserver = undefined;
    this.removeEventListener('slotchange', this.onForwardedSlotChange);
    this.politeSink?.release();
    this.politeSink = undefined;
    this.assertiveSink?.release();
    this.assertiveSink = undefined;
    super.disconnectedCallback();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (!this.liveActive || !this.open) return;
    if (
      changed.has('open') ||
      changed.has('heading') ||
      changed.has('accessibleLabel')
    ) {
      this.announceCurrentContent(changed.has('open'));
    }
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('open') && !this.open) {
      const repair = captureComposedFocusRepair(
        this,
        nearestExternalFocusTarget(this)
      );
      if (repair) applyComposedFocusRepair(repair);
    }
  }

  private isAnnouncementMutation(record: MutationRecord): boolean {
    if (record.target === this) {
      return (
        record.type === 'childList' ||
        (record.type === 'attributes' &&
          [
            'aria-hidden',
            'aria-label',
            'class',
            'hidden',
            'inert',
            'style',
          ].includes(record.attributeName ?? ''))
      );
    }
    let top: Node = record.target;
    while (top.parentNode && top.parentNode !== this) top = top.parentNode;
    if (top.parentNode !== this) return false;
    if (
      record.type === 'attributes' &&
      record.attributeName === 'slot' &&
      record.target === top
    ) {
      return true;
    }
    return this.isAnnouncementSlotNode(top);
  }

  private isAnnouncementSlotNode(node: Node): boolean {
    if (node.nodeType !== 1) return true;
    const slotName = (node as Element).getAttribute('slot');
    return slotName === null || slotName === '' || slotName === 'heading';
  }

  private announcementObservationOptions(): MutationObserverInit {
    return {
      attributes: true,
      attributeFilter: [
        'alt',
        'aria-hidden',
        'aria-label',
        'class',
        'hidden',
        'inert',
        'open',
        'slot',
        'style',
      ],
      characterData: true,
      childList: true,
      subtree: true,
    };
  }

  private announcementForwardingSlots(): HTMLSlotElement[] {
    return Array.from(this.querySelectorAll<HTMLSlotElement>('slot')).filter(
      (slot) => {
        let top: Node = slot;
        while (top.parentNode && top.parentNode !== this) top = top.parentNode;
        return top.parentNode === this && this.isAnnouncementSlotNode(top);
      }
    );
  }

  private observeAnnouncementContent(): void {
    const observer = this.contentObserver;
    if (!observer) return;
    observer.disconnect();
    const options = this.announcementObservationOptions();
    observer.observe(this, options);
    for (const slot of this.announcementForwardingSlots()) {
      if (slot.assignedNodes().length === 0) continue;
      for (const assigned of slot.assignedNodes({ flatten: true })) {
        observer.observe(assigned, options);
      }
    }
  }

  private onForwardedSlotChange = (event: Event): void => {
    const slot = event.target as HTMLSlotElement;
    if (!this.announcementForwardingSlots().includes(slot)) return;
    this.observeAnnouncementContent();
    this.announceCurrentContent();
  };

  private normalizedText(value: string | null | undefined): string {
    return (value ?? '').replace(/\s+/g, ' ').trim();
  }

  private resolvedAccessibleLabel(): string {
    const hostLabel = this.getAttribute('aria-label');
    return this.normalizedText(
      hostLabel !== null ? hostLabel : this.accessibleLabel
    );
  }

  private announcementText(): string {
    if (!isAccessibilityVisible(this)) return '';
    const hostLabel = this.getAttribute('aria-label');
    const context = this.normalizedText(
      hostLabel !== null ? hostLabel : this.accessibleLabel
    );
    const heading = [
      this.heading,
      ...Array.from(this.childNodes)
        .filter(
          (node) =>
            node.nodeType === 1 &&
            (node as Element).getAttribute('slot') === 'heading'
        )
        .map((node) => composedAccessibilityText(node)),
    ];
    const message = Array.from(this.childNodes)
      .filter((node) => {
        if (node.nodeType !== 1) return true;
        const slotName = (node as Element).getAttribute('slot');
        return slotName === null || slotName === '';
      })
      .map((node) => composedAccessibilityText(node));
    const content = this.normalizedText([...heading, ...message].join(' '));
    if (!context || context === content) return content;
    return content
      ? this.localize('calloutAnnouncementWithContext', undefined, {
          context,
          content,
        })
      : context;
  }

  private announceCurrentContent(force = false): void {
    if (!this.liveActive || !this.isConnected || !this.open) return;
    const text = this.announcementText();
    if (!force && text === this.lastAnnouncementText) return;
    this.lastAnnouncementText = text;
    (this.effectiveContextualVariant === 'danger'
      ? this.assertiveSink
      : this.politeSink
    )?.announce(text);
  }

  /** Resolve the same contextual tone that the inherited CSS vocabulary paints. An explicit local
   * attribute wins; otherwise the nearest composed semantic ancestor wins, with brand as the
   * standalone fallback. This remains live across moves, adoption, and reconnects. */
  private get effectiveContextualVariant(): CalloutVariant {
    if (this.hasAttribute('variant')) return this.variant;
    let ancestor = composedParentElement(this);
    while (ancestor) {
      const candidate = ancestor.getAttribute(
        'variant'
      ) as CalloutVariant | null;
      if (candidate && CALLOUT_VARIANTS.has(candidate)) return candidate;
      ancestor = composedParentElement(ancestor);
    }
    return 'brand';
  }
  private close = (): void => {
    const repair = captureComposedFocusRepair(
      this,
      nearestExternalFocusTarget(this)
    );
    const event = this.emit('lr-close', null, { cancelable: true });
    if (!event.defaultPrevented) {
      if (repair) applyComposedFocusRepair(repair);
      this.open = false;
    }
  };
  override render(): TemplateResult {
    if (!this.open) return html``;
    const label = this.resolvedAccessibleLabel() || undefined;
    const headingLevel = resolveHeadingLevel(this.headingLevel);
    return html`<div
      part="base"
      role=${label ? 'group' : nothing}
      aria-label=${label || nothing}
    >
      <span
        part="icon"
        aria-hidden="true"
        inert
        ?hidden=${!this.slotPresence.has('icon')}
        ><slot name="icon"></slot
      ></span>
      <div part="content">
        <div
          part="heading"
          role=${headingLevel ? 'heading' : nothing}
          aria-level=${headingLevel ?? nothing}
          ?hidden=${!this.heading && !this.slotPresence.has('heading')}
        >
          ${this.heading}<slot name="heading"></slot>
        </div>
        <div part="message"><slot></slot></div>
      </div>
      <button
        type="button"
        part="close-button"
        ?hidden=${!this.closable}
        aria-label=${this.localize('close')}
        @click=${this.close}
      >
        <span part="close-icon" aria-hidden="true" inert>×</span>
      </button>
    </div>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'lr-callout': LyraCallout;
  }
}

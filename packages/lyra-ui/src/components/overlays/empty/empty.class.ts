import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { acquireAnnouncementSink, type AnnouncementSink } from '../../../internal/announcer.js';
import {
  isAccessibilityVisible,
} from '../../../internal/accessibility-visibility.js';
import { composedAccessibilityText } from '../../../internal/announcement-text.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { resolveHeadingLevel, type LyraHeadingLevel } from '../../../internal/heading-level.js';
import { SlotPresenceController } from '../../../internal/slot-presence-controller.js';
import { styles } from './empty.styles.js';

/**
 * `<lr-empty>` — a generic empty/no-data state. First-party invention (no
 * Web Awesome equivalent); fills a gap common to dashboard-style apps.
 * Initial and reconnect content are not announced as new live updates. Later meaningful heading
 * or description changes are appended to Lyra's shared light-DOM polite announcement sink;
 * decorative icon and action slots, hidden/inert content, and unchanged accessible text are not.
 * A visibility-hidden wrapper omits its own text but can contain a visible override descendant.
 * Nested forwarding slots contribute flattened assigned heading/description text rather than
 * fallback content; later assignment and assigned-content mutations are observed without making
 * initial distribution live. Updates while the host or a composed ancestor is not
 * rendered/accessibility-visible stay silent. A host `aria-label` names the host only and does not
 * replace visible heading/description text in the announcement sink. Property and rich-slot
 * headings default to semantic level 3; set `heading-level` from `1`–`6` to fit the surrounding
 * outline, or `none` for visual-only heading text.
 *
 * @customElement lr-empty
 * @slot - Custom icon or illustration (defaults to none).
 * @slot heading - Rich heading content (overrides the `heading` attribute) inside the configured
 *   semantic heading wrapper.
 * @slot description - Rich description content (overrides the `description` attribute).
 * @slot actions - Buttons/links shown below the description.
 * @csspart base - The outer container.
 * @csspart icon - The wrapper around the default-slotted icon/illustration.
 * @csspart heading - The heading paragraph (`role="heading"` at the configured level unless opted out).
 * @csspart description - The description paragraph.
 * @csspart actions - The wrapper around the `actions`-slotted content.
 * @cssprop --lr-empty-compact-align - Cross-axis and text alignment used in compact mode;
 * set to `center` for dense but centered empty states.
 * @cssprop [--lr-empty-compact-padding=var(--lr-space-xs)] - Padding used in compact mode;
 * accepts any padding shorthand (e.g. `8px 2px`).
 * @cssprop [--lr-empty-compact-gap=var(--lr-space-2xs)] - Gap between the icon, title, and
 * description in compact mode.
 * @cssprop --lr-empty-compact-font-size - Heading font size used in compact mode. Unset by
 * default (no fallback), so the heading keeps its ordinary inherited font size until a consumer
 * opts in.
 * @status stable
 * @since 4.0.0
 */
export class LyraEmpty extends LyraElement {
  static override styles = [LyraElement.styles, styles];

  /** Short heading, e.g. "No results". */
  @property() heading = '';

  /** Semantic level of the visible property/slotted heading. Use `none` for visual-only text;
   *  invalid untyped values use level 3. */
  @property({ attribute: 'heading-level', reflect: true })
  headingLevel: LyraHeadingLevel = '3';

  /** Supporting copy, e.g. "Try a different search." */
  @property() description = '';

  /**
   * Compact rendering for use inside a constrained space (e.g. a widget body
   * or table cell) rather than as a full-page state: left-aligned, tighter
   * padding, and a lighter heading weight instead of the centered/spacious
   * default.
   */
  @property({ type: Boolean, reflect: true }) compact = false;

  // `[part='icon']:empty` never matches because the part always contains a
  // `<slot>` element (CSS `:empty` only ignores text/comment nodes). Track
  // real slot assignment in JS instead and key the CSS off these instead.
  private readonly slotPresence = new SlotPresenceController(this);
  private contentObserver?: MutationObserver;
  private announcementSink?: AnnouncementSink;
  private announcementsArmed = false;
  private announcementGeneration = 0;
  private lastAnnouncementText = '';

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('slotchange', this.onForwardedSlotChange);
    this.announcementSink ??= acquireAnnouncementSink('polite', {
      document: this.ownerDocument,
      source: this,
    });
    this.announcementsArmed = false;
    this.lastAnnouncementText = '';
    const generation = ++this.announcementGeneration;
    const MutationObserverCtor = this.ownerDocument.defaultView?.MutationObserver;
    if (MutationObserverCtor) {
      this.contentObserver = new MutationObserverCtor(() => {
        this.observeAnnouncementContent();
        this.scheduleAnnouncement();
      });
      this.observeAnnouncementContent();
    }

    // A property written while detached can leave a Lit update pending until reconnection. Wait
    // for that update and seed it as the new baseline before treating later mutations as live.
    void this.updateComplete.then(() => {
      if (!this.isConnected || generation !== this.announcementGeneration) return;
      this.lastAnnouncementText = this.announcementText();
      this.announcementsArmed = true;
    });
  }

  override disconnectedCallback(): void {
    this.announcementGeneration += 1;
    this.contentObserver?.disconnect();
    this.contentObserver = undefined;
    this.removeEventListener('slotchange', this.onForwardedSlotChange);
    this.announcementSink?.release();
    this.announcementSink = undefined;
    this.announcementsArmed = false;
    this.lastAnnouncementText = '';
    super.disconnectedCallback();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (
      this.announcementsArmed &&
      (changed.has('heading') || changed.has('description'))
    ) {
      this.announceCurrentContent();
    }
  }

  override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    // Resolve forwarding slots against their flattened assignment. During hydration this direct
    // wrapper correction waits until the server-equivalent first update has been observed.
    this.updateBrowserDerivedState(() => {
      this.reconcileSlotHidden(
        this.shadowRoot!.querySelector('slot:not([name])') as HTMLSlotElement,
        this.shadowRoot!.querySelector('[part="icon"]') as HTMLElement,
      );
      this.reconcileSlotHidden(
        this.shadowRoot!.querySelector('slot[name="actions"]') as HTMLSlotElement,
        this.shadowRoot!.querySelector('[part="actions"]') as HTMLElement,
      );
      this.reconcileSlotHidden(
        this.shadowRoot!.querySelector('slot[name="heading"]') as HTMLSlotElement,
        this.shadowRoot!.querySelector('[part="heading"]') as HTMLElement,
        this.heading.length > 0,
      );
      this.reconcileSlotHidden(
        this.shadowRoot!.querySelector('slot[name="description"]') as HTMLSlotElement,
        this.shadowRoot!.querySelector('[part="description"]') as HTMLElement,
        this.description.length > 0,
      );
    });
  }

  private reconcileSlotHidden(slot: HTMLSlotElement, wrapper: HTMLElement, hasFallbackContent = false): void {
    wrapper.toggleAttribute('hidden', !hasFallbackContent && slot.assignedElements({ flatten: true }).length === 0);
  }

  private announcementObservationOptions(): MutationObserverInit {
    return {
      attributes: true,
      attributeFilter: ['alt', 'aria-hidden', 'aria-label', 'class', 'hidden', 'inert', 'open', 'slot', 'style'],
      childList: true,
      characterData: true,
      subtree: true,
    };
  }

  private announcementForwardingSlots(): HTMLSlotElement[] {
    return Array.from(this.querySelectorAll<HTMLSlotElement>('slot')).filter((slot) => {
      let top: Node = slot;
      while (top.parentNode && top.parentNode !== this) top = top.parentNode;
      if (top.parentNode !== this || top.nodeType !== 1) return false;
      const slotName = (top as Element).getAttribute('slot');
      return slotName === 'heading' || slotName === 'description';
    });
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
    this.scheduleAnnouncement();
  };

  /** Light-DOM mutation delivery precedes the slotchange/Lit update that unhides the corresponding
   * heading or description wrapper. Reconcile those two wrappers from the already-current native
   * slot assignment before extracting text, so the observer's coalesced mutation batch produces
   * one complete announcement instead of an intermediate heading-only entry. */
  private scheduleAnnouncement(): void {
    if (!this.announcementsArmed) return;
    const headingSlot = this.shadowRoot?.querySelector<HTMLSlotElement>('slot[name="heading"]');
    const headingWrapper = this.shadowRoot?.querySelector<HTMLElement>('[part="heading"]');
    if (headingSlot && headingWrapper) {
      this.reconcileSlotHidden(headingSlot, headingWrapper, this.heading.length > 0);
    }
    const descriptionSlot = this.shadowRoot?.querySelector<HTMLSlotElement>('slot[name="description"]');
    const descriptionWrapper = this.shadowRoot?.querySelector<HTMLElement>('[part="description"]');
    if (descriptionSlot && descriptionWrapper) {
      this.reconcileSlotHidden(descriptionSlot, descriptionWrapper, this.description.length > 0);
    }
    this.announceCurrentContent();
  }

  private slotContent(name?: string): { assigned: boolean; text: string } {
    const selector = name ? `slot[name="${name}"]` : 'slot:not([name])';
    const slot = this.shadowRoot?.querySelector<HTMLSlotElement>(selector);
    return {
      // Native slot fallback is suppressed by direct assignment, even when the assigned branch is
      // empty or accessibility-hidden. Keep that fact separate from the flattened text extractor.
      assigned: (slot?.assignedNodes() ?? []).length > 0,
      text: (slot?.assignedNodes({ flatten: true }) ?? [])
        .map((node) => composedAccessibilityText(node))
        .join(' '),
    };
  }

  private announcementText(): string {
    if (!isAccessibilityVisible(this)) return '';
    const headingSlot = this.slotContent('heading');
    const descriptionSlot = this.slotContent('description');
    return [
      headingSlot.assigned ? headingSlot.text : this.heading,
      descriptionSlot.assigned ? descriptionSlot.text : this.description,
    ].join(' ').replace(/\s+/g, ' ').trim();
  }

  private announceCurrentContent(): void {
    if (!this.announcementsArmed || !this.isConnected) return;
    const text = this.announcementText();
    if (text === this.lastAnnouncementText) return;
    this.lastAnnouncementText = text;
    if (text) this.announcementSink?.announce(text);
  }

  override render(): TemplateResult {
    const hasHeading = this.slotPresence.has('heading') || this.heading.length > 0;
    const hasDescription = this.slotPresence.has('description') || this.description.length > 0;
    const headingLevel = resolveHeadingLevel(this.headingLevel);
    return html`
      <div part="base">
        <div part="icon" ?hidden=${!this.slotPresence.has()}><slot></slot></div>
        <p
          part="heading"
          role=${headingLevel ? 'heading' : nothing}
          aria-level=${headingLevel ?? nothing}
          ?hidden=${!hasHeading}
        >
          <slot name="heading">${this.heading}</slot>
        </p>
        <p part="description" ?hidden=${!hasDescription}>
          <slot name="description">${this.description}</slot>
        </p>
        <div part="actions" ?hidden=${!this.slotPresence.has('actions')}>
          <slot name="actions"></slot>
        </div>
      </div>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-empty': LyraEmpty;
  }
}

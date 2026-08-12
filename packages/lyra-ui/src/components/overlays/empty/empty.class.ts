import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { acquireAnnouncementSink, type AnnouncementSink } from '../../../internal/announcer.js';
import {
  isAccessibilityVisible,
} from '../../../internal/accessibility-visibility.js';
import { composedAccessibilityText } from '../../../internal/announcement-text.js';
import { LyraElement } from '../../../internal/lyra-element.js';
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
 * replace visible heading/description text in the announcement sink.
 *
 * @customElement lr-empty
 * @slot - Custom icon or illustration (defaults to none).
 * @slot heading - Rich heading content (overrides the `heading` attribute).
 * @slot description - Rich description content (overrides the `description` attribute).
 * @slot actions - Buttons/links shown below the description.
 * @csspart base - The outer container.
 * @csspart icon - The wrapper around the default-slotted icon/illustration.
 * @csspart heading - The heading paragraph.
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
  @state() private hasIcon = false;
  @state() private hasActions = false;
  @state() private hasHeadingSlot = false;
  @state() private hasDescriptionSlot = false;
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
        this.announceCurrentContent();
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

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    // Set from light-DOM children before the first render so the initial
    // paint is already correct — setting `hasIcon`/`hasActions` from
    // `firstUpdated` (after the update completes) would schedule a second,
    // wasted update (Lit's dev-mode "change-in-update" warning).
    if (!this.hasUpdated) {
      // An explicit `slot=""` still assigns to the default slot per the HTML
      // slot algorithm, so check the attribute's value rather than its mere
      // presence.
      this.hasIcon = Array.from(this.children).some((el) => !el.getAttribute('slot'));
      this.hasActions = Array.from(this.children).some((el) => el.getAttribute('slot') === 'actions');
      this.hasHeadingSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'heading');
      this.hasDescriptionSlot = Array.from(this.children).some(
        (el) => el.getAttribute('slot') === 'description',
      );
    }
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

  override firstUpdated(): void {
    // Fallback reconciliation against the fully-resolved slot assignment
    // (handles slot-forwarding — where `this.children` in `willUpdate` above
    // are forwarding `<slot>` elements rather than the real projected
    // content, e.g. a wrapper component's own default slot re-slotted into
    // ours — and any browser where `slotchange` doesn't fire for content
    // present at parse/upgrade time). This corrects the `hidden` attribute
    // on the wrapper elements directly rather than through
    // `hasIcon`/`hasActions`, so this one-shot correction doesn't need to
    // schedule and wait out a second Lit render pass; the reactive state is
    // left as `willUpdate` set it and continues to drive only the ongoing
    // `slotchange` path below.
    this.reconcileSlotHidden(
      this.shadowRoot!.querySelector('slot:not([name])') as HTMLSlotElement,
      this.shadowRoot!.querySelector('[part="icon"]') as HTMLElement,
    );
    this.reconcileSlotHidden(
      this.shadowRoot!.querySelector('slot[name="actions"]') as HTMLSlotElement,
      this.shadowRoot!.querySelector('[part="actions"]') as HTMLElement,
    );
    // Same fallback reconciliation as icon/actions above, but the heading and
    // description parts also fall back to the `heading`/`description`
    // attribute when nothing is slotted, so a forwarded-but-empty slot must
    // not collapse the part while that attribute still has text to show.
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
  }

  private reconcileSlotHidden(slot: HTMLSlotElement, wrapper: HTMLElement, hasFallbackContent = false): void {
    wrapper.toggleAttribute('hidden', !hasFallbackContent && slot.assignedElements({ flatten: true }).length === 0);
  }

  private onIconSlotChange = (e: Event): void => {
    const slot = e.target as HTMLSlotElement;
    this.hasIcon = slot.assignedElements({ flatten: true }).length > 0;
  };

  private onActionsSlotChange = (e: Event): void => {
    const slot = e.target as HTMLSlotElement;
    this.hasActions = slot.assignedElements({ flatten: true }).length > 0;
  };

  private onHeadingSlotChange = (e: Event): void => {
    const slot = e.target as HTMLSlotElement;
    this.hasHeadingSlot = slot.assignedElements({ flatten: true }).length > 0;
  };

  private onDescriptionSlotChange = (e: Event): void => {
    const slot = e.target as HTMLSlotElement;
    this.hasDescriptionSlot = slot.assignedElements({ flatten: true }).length > 0;
  };

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
    this.announceCurrentContent();
  };

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
    const hasHeading = this.hasHeadingSlot || this.heading.length > 0;
    const hasDescription = this.hasDescriptionSlot || this.description.length > 0;
    return html`
      <div part="base">
        <div part="icon" ?hidden=${!this.hasIcon}><slot @slotchange=${this.onIconSlotChange}></slot></div>
        <p part="heading" ?hidden=${!hasHeading}>
          <slot name="heading" @slotchange=${this.onHeadingSlotChange}>${this.heading}</slot>
        </p>
        <p part="description" ?hidden=${!hasDescription}>
          <slot name="description" @slotchange=${this.onDescriptionSlotChange}>${this.description}</slot>
        </p>
        <div part="actions" ?hidden=${!this.hasActions}>
          <slot name="actions" @slotchange=${this.onActionsSlotChange}></slot>
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

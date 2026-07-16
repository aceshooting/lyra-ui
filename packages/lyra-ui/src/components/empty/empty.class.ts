import { html, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { styles } from './empty.styles.js';

/**
 * `<lyra-empty>` — a generic empty/no-data state. First-party invention (no
 * Web Awesome equivalent); fills a gap common to dashboard-style apps.
 *
 * @customElement lyra-empty
 * @slot - Custom icon or illustration (defaults to none).
 * @slot heading - Rich heading content (overrides the `heading` attribute).
 * @slot description - Rich description content (overrides the `description` attribute).
 * @slot actions - Buttons/links shown below the description.
 * @csspart base - The outer container.
 * @csspart icon - The wrapper around the default-slotted icon/illustration.
 * @csspart heading - The heading paragraph.
 * @csspart description - The description paragraph.
 * @csspart actions - The wrapper around the `actions`-slotted content.
 * @cssprop --lyra-empty-compact-align - Cross-axis and text alignment used in compact mode;
 * set to `center` for dense but centered empty states.
 * @cssprop [--lyra-empty-compact-padding=var(--lyra-space-xs)] - Padding used in compact mode;
 * accepts any padding shorthand (e.g. `8px 2px`).
 */
export class LyraEmpty extends LyraElement {
  static styles = [LyraElement.styles, styles];

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

  protected willUpdate(): void {
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

  firstUpdated(): void {
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

  render(): TemplateResult {
    const hasHeading = this.hasHeadingSlot || this.heading.length > 0;
    const hasDescription = this.hasDescriptionSlot || this.description.length > 0;
    return html`
      <div part="base" role="status" aria-live="polite">
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
    'lyra-empty': LyraEmpty;
  }
}

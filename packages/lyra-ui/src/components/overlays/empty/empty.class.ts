import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { AnnouncementSinkController } from '../../../internal/announcer.js';
import { renderInertPresentation } from '../../../internal/inert-presentation.js';
import { composedAccessibilityText, isAccessibilityVisible } from '../../../internal/accessibility-visibility.js';
import { AccessibleTextController } from '../../../internal/accessible-text-controller.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { resolveHeadingLevel, type LyraHeadingLevel } from '../../../internal/heading-level.js';
import { SlotPresenceController } from '../../../internal/slot-presence-controller.js';
import {
  writeOptionalSize,
  optionalSizeConverter,
  type LyraSize,
} from '../../../internal/variants.js';
import { styles } from './empty.styles.js';

/**
 * `<lr-empty>` — a generic empty/no-data state. First-party invention (no
 * Web Awesome equivalent); fills a gap common to dashboard-style apps.
 * Initial and reconnect content are not announced as new live updates unless `announce` opts in;
 * with it set, the heading/description present when the empty state first mounts is announced once
 * through the same polite sink, while reconnection and adoption still stage the existing content
 * instead of replaying it. Later meaningful heading
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
 * Removing heading or description safely omits that text; explicit empty values remain empty and later values restore the corresponding content.
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
 * @cssprop [--lr-empty-padding=var(--lr-space-l)] - Padding used at the default density; accepts any
 * padding shorthand.
 * @cssprop [--lr-empty-gap=var(--lr-space-s)] - Gap between the icon, heading, and description at the
 * default density.
 * @cssprop [--lr-empty-icon-size=var(--lr-font-size-3xl)] - Font size of the icon/illustration
 * wrapper at the default density.
 * @cssprop [--lr-empty-compact-icon-size=var(--lr-font-size-m)] - Font size of the
 * icon/illustration wrapper at the compact density (`size="s"` and below).
 * @cssprop --lr-empty-compact-align - Cross-axis and text alignment used at the compact density
 * (`size="s"` and below); set to `center` for dense but centered empty states.
 * @cssprop [--lr-empty-compact-padding=var(--lr-space-xs)] - Padding used at the compact density;
 * accepts any padding shorthand (e.g. `8px 2px`).
 * @cssprop [--lr-empty-compact-gap=var(--lr-space-2xs)] - Gap between the icon, title, and
 * description at the compact density.
 * @cssprop --lr-empty-compact-font-size - Heading font size used at the compact density. Unset by
 * default, so it falls back to `--lr-empty-heading-font-size` and then to the ordinary inherited
 * font size.
 * @cssprop --lr-empty-heading-font-size - Heading font size at every density. Unset by default (no
 * fallback), so the heading inherits its font size; `--lr-empty-compact-font-size` wins at the
 * compact density.
 * @cssprop [--lr-empty-heading-font-weight=var(--lr-font-weight-semibold)] - Heading font weight at
 * every density. Unset, the default density is semibold and the compact density (`size="s"` and
 * below) is `var(--lr-font-weight-normal)`.
 * @cssprop [--lr-empty-heading-color=var(--lr-color-text)] - Heading colour at every density.
 * @cssprop [--lr-empty-description-color=var(--lr-color-text-quiet)] - Description colour at every
 * density.
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

  private _size?: LyraSize;
  /** Density on the library's one size ladder, in either spelling — `2xs`/`xs`/`s`/`m`/`l`/`xl`,
   *  or `small`/`medium`/`large`. `s` and the steps below it select the compact density, for use
   *  inside a constrained space (e.g. a widget body or table cell) rather than as a full-page
   *  state: left-aligned, tighter padding, and a lighter heading weight instead of the
   *  centered/spacious default. `m` and the steps above it keep the default density. Opt-in: with
   *  no size the empty state renders at the default density. Unsupported values normalize to the
   *  omitted state and remove the attribute. */
  @property({ reflect: true, converter: optionalSizeConverter })
  get size(): LyraSize | undefined {
    return this._size;
  }
  set size(next: LyraSize | undefined) {
    writeOptionalSize(this, this._size, next, value => { this._size = value; });
  }

  /** Opts this empty state into announcing the heading/description it already carries when it
   *  first mounts, through the same shared light-DOM polite sink later changes use. Leave unset
   *  for an empty state that is part of the page a user is arriving on: its text is read in
   *  document order and repeating it is noise. Set it where the empty state replaces a result set
   *  the user just asked for. This is read once, when the component first mounts -- a later
   *  reconnection or adoption stages the existing content again rather than replaying it, and
   *  later heading/description changes are announced either way. Remove any hand-added host `role="status"`/`role="alert"` once it is set --
   *  otherwise the initial text is announced twice, through the native role and again through the
   *  shared sink. */
  @property({ type: Boolean, reflect: true }) announce = false;

  // `[part='icon']:empty` never matches because the part always contains a
  // `<slot>` element (CSS `:empty` only ignores text/comment nodes). Track
  // real slot assignment in JS instead and key the CSS off these instead.
  private readonly slotPresence = new SlotPresenceController(this);
  private readonly contentText = new AccessibleTextController(
    this, ['heading', 'description'], () => this.announceCurrentContent(), [], true, false, false,
  );
  private readonly announcements = new AnnouncementSinkController(this, { eager: ['polite'] });
  private announcementsArmed = false;
  private initialContentAnnounced = false;
  private announcementGeneration = 0;
  private lastAnnouncementText = '';

  override connectedCallback(): void {
    super.connectedCallback();
    this.announcementsArmed = false;
    this.lastAnnouncementText = '';
    const generation = ++this.announcementGeneration;
    // A property written while detached can leave a Lit update pending until reconnection. Wait
    // for that update and seed it as the new baseline before treating later mutations as live.
    void this.updateComplete.then(() => {
      if (!this.isConnected || generation !== this.announcementGeneration) return;
      this.lastAnnouncementText = this.announcementText();
      this.contentText.bind();
      this.announcementsArmed = true;
      // Opted-in initial content goes through the one existing announcement path, so accessibility
      // visibility and slot-flattened text resolve exactly as they do for a later change. `force`
      // is required: the arming line above already recorded this exact text as the baseline, which
      // the deduplicating path would otherwise treat as a repeat.
      if (this.announce && !this.initialContentAnnounced) {
        this.initialContentAnnounced = true;
        this.announceCurrentContent(true);
      }
    });
  }

  override disconnectedCallback(): void {
    this.announcementGeneration += 1;
    this.announcementsArmed = false;
    this.lastAnnouncementText = '';
    super.disconnectedCallback();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.announceCurrentContent();
  }

  private slotContent(name: 'heading' | 'description'): { assigned: boolean; text: string } {
    const selector = `slot[name="${name}"]`;
    const slot = this.shadowRoot?.querySelector<HTMLSlotElement>(selector);
    return {
      // Native slot fallback is suppressed by direct assignment, even when the assigned branch is
      // empty or accessibility-hidden. Keep that fact separate from the flattened text extractor.
      assigned: (slot?.assignedNodes() ?? []).length > 0,
      text: (slot?.assignedNodes({ flatten: true }) ?? [])
        // The wrapper's `hidden` lags the slot assignment by a render, so it must not gate the text.
        .map((node) => composedAccessibilityText(node, { skipRootAncestorValidation: true, requireRendered: false }))
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

  private announceCurrentContent(force = false): void {
    if (!this.announcementsArmed || !this.isConnected) return;
    const text = this.announcementText();
    if (!force && text === this.lastAnnouncementText) return;
    this.lastAnnouncementText = text;
    if (text) this.announcements.announcePolite(text);
  }

  override render(): TemplateResult {
    const hasHeading = this.slotPresence.has('heading') || (this.heading ?? '').length > 0;
    const hasDescription = this.slotPresence.has('description') || (this.description ?? '').length > 0;
    const headingLevel = resolveHeadingLevel(this.headingLevel);
    return html`
      <div part="base">
        ${renderInertPresentation(html`<slot></slot>`, {
          part: 'icon',
          hidden: !this.slotPresence.has(),
        })}
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

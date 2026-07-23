import {
  html,
  nothing,
  svg,
  type TemplateResult,
  type SVGTemplateResult,
  type PropertyValues,
} from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { getDateTimeFormat } from '../../../internal/intl-cache.js';
import { styles } from './conversation-item.styles.js';
import { presenceTrueDefaultBooleanConverter as trueDefaultBooleanConverter, spellcheckConverter } from '../../../internal/converters.js';

export interface ConversationItemRenameDetail {
  title: string;
}

/** String-aware parsing for the native enumerated `spellcheck` attribute -- mirrors
 *  `<lr-textarea>`'s identical converter, since Lit's default boolean converter would otherwise
 *  treat the mere presence of `spellcheck="false"` as `true`. */

// Mirrors the shared icon set's viewBox/stroke conventions
// (internal/icons.ts's chevronIcon()/closeIcon()/etc.) without adding a
// pencil/edit glyph to that module -- it's off limits here -- so this
// one-off icon still reads as part of the same visual language as the rest
// of the library's inline icons. Same approach lr-checkbox's own local
// checkmark/indeterminate glyphs and lr-chat-message's local retryIcon()
// take for the identical reason.
const ICON_VIEW_BOX = '0 0 24 24';
const ICON_STROKE_WIDTH = '1.75';

function pencilIcon(): SVGTemplateResult {
  return svg`
    <svg
      width="1em"
      height="1em"
      viewBox=${ICON_VIEW_BOX}
      fill="none"
      stroke="currentColor"
      stroke-width=${ICON_STROKE_WIDTH}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    ><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>
  `;
}

/** `Intl.DateTimeFormat`-based absolute formatter -- clock time ("3:45 PM")
 *  for a timestamp that falls on the same calendar day as `now`, otherwise a
 *  calendar date ("Jul 10", or "Jul 10, 2024" once it's not the current
 *  year). Deliberately not a fuzzy "2 hours ago" relative string -- bucketed
 *  relative time (grouping a whole history list into "Today"/"Yesterday"/
 *  "Last 7 days" sections) belongs to the list level, not this single row's
 *  job. `formatTimestamp` overrides this
 *  entirely, mirroring `<lr-chat-message>`'s identical override hook. */
function defaultFormatTimestamp(date: Date, locale: string, now: Date = new Date()): string {
  // Shared per-locale+options formatter cache: this runs per row per render in a history
  // sidebar list, and constructing an `Intl.DateTimeFormat` per call is an ICU locale-data
  // lookup. `effectiveLocale` always resolves to a non-empty tag (it falls back to `'en'`),
  // so no empty-locale guard is needed.
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return getDateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(date);
  }
  const sameYear = date.getFullYear() === now.getFullYear();
  return getDateTimeFormat(
    locale,
    sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' },
  ).format(date);
}

export interface LyraConversationItemEventMap {
  'lr-select': CustomEvent<undefined>;
  'lr-rename': CustomEvent<ConversationItemRenameDetail>;
  blur: CustomEvent<undefined>;
  focus: CustomEvent<undefined>;
}
/**
 * `<lr-conversation-item>` — a selectable row representing one chat
 * session in a history sidebar list. Usable standalone or as the
 * `renderItem()` payload of a sibling virtualized-list component; this
 * module has no dependency on that (or any) other component.
 *
 * Takes `title`/`excerpt`/`timestamp` as individual primitive props rather
 * than one opaque bound object, deliberately consistent with how
 * `<lr-chat-message>` takes individual props instead of a single
 * `.message` blob -- every other component in this family follows that
 * shape, so this one does too even though a single bound `.session` object
 * would also have been a reasonable design.
 *
 * Identifying *which* session a `lr-select` click/keypress was about: this
 * reuses the platform's own `id` attribute (every element already has one)
 * rather than inventing a second, differently-named id-carrying prop --
 * consumers already have the event's `target`/`currentTarget` (and thus
 * `.id`), the same reasoning `<lr-attachment-chip>` documents for its own
 * identically-shaped choice. `lr-select` therefore carries no detail
 * payload at all.
 *
 * `role="button"` on `[part="option"]` so the item has valid semantics both
 * standalone and when placed in a larger history-list layout. A conversation
 * row activates one current session; it is not itself a listbox option and
 * therefore does not require a particular owner role.
 *
 * `role="button"` forbids focusable
 * descendants -- verified against axe-core's `nested-interactive` rule,
 * which flags it. That's why the rename button and the `actions` slot are
 * rendered as DOM *siblings* of `[part="option"]` (both inside
 * `[part="base"]`) rather than nested inside it: `[part="option"]` only ever
 * contains plain text/`<time>` content. The in-place rename `<input>` is the
 * same problem one level deeper -- it replaces the title *inside*
 * `[part="option"]` while renaming -- so `[part="option"]` sheds its
 * `role`/`tabindex`/`aria-current`/`aria-label` entirely for the duration
 * of an edit. A row mid-edit is a text field, so suspending the button
 * semantics is also the more accurate
 * description of what's on screen.
 *
 * Inline rename is a dedicated pencil/edit icon button (not a double-click
 * on the title) -- double-click has no keyboard/screen-reader equivalent
 * and would silently swallow the row's own single-click `lr-select`,
 * whereas a button is independently focusable, has its own accessible name,
 * and composes cleanly with click-to-select.
 *
 * @customElement lr-conversation-item
 * @slot actions - Overflow/icon-button controls (for example a pin/delete
 * button or a `lr-menu` trigger) rendered at the trailing edge of the row.
 * @slot leading - Non-interactive leading content such as an avatar, purpose icon, or status
 * indicator. It is rendered inside the selectable region before the title/excerpt content.
 * @slot content - Replaces the built-in title, excerpt, and meta content area with host-supplied
 * non-interactive row content.
 * @slot excerpt - Full override of the excerpt presentation (e.g. a search-hit snippet with `<mark>`
 *   highlighting). Wins over the `excerpt` property whenever it has assigned content, even if
 *   `excerpt` is also set. Only non-focusable content should be slotted here — see the `excerpt`
 *   property's own doc for why.
 * @slot meta - Small, non-focusable structured fields for the row (e.g. a day label, cost, request
 *   count) rendered below the title/excerpt. Entirely app-supplied; this component computes none of
 *   it. Only non-focusable content should be slotted here, for the same `nested-interactive` reason
 *   as `excerpt`.
 * @event lr-select - The row was activated: a click on `[part="option"]`
 * (i.e. outside the rename button and the `actions` slot), or Enter/Space
 * while it's focused -- in both cases only while not currently renaming. No
 * detail payload -- see the class doc's "Identifying which session" note.
 * @event lr-rename - An in-place rename was committed (Enter, or blur
 * while editing). `detail: { title }`. Does not mutate `title` itself --
 * this is a controlled component, the same convention
 * `<lr-chat-message>` follows by not clearing its own state on retry; the
 * consumer applies the new title once it's actually persisted. Not fired
 * when the trimmed draft is empty or unchanged from the original `title`
 * (that's treated as an implicit cancel).
 * @event blur - Re-dispatched from the in-place rename input as a bubbling, composed event.
 * @event focus - Re-dispatched from the in-place rename input as a bubbling, composed event.
 * @csspart base - The outer row wrapper (plain, no ARIA role) laying out `[part="option"]`, the rename button, and `actions`.
 * @csspart active-indicator - A decorative inline indicator rendered only while the row is active.
 * @csspart option - The selectable region (`role="button"`, removed while renaming -- see the class doc). Wraps `content` and `timestamp`.
 * @csspart leading - The wrapper around the `leading` slot, inside `option`. Always rendered, but `hidden` while that slot is empty.
 * @csspart content - Wrapper around the title and excerpt.
 * @csspart title - The title text, shown while not renaming.
 * @csspart title-input - The in-place rename `<input>`, shown only while renaming.
 * @csspart rename-button - The pencil/edit affordance that starts a rename (only rendered while `editable` and not already renaming).
 * @csspart excerpt - The last-message preview snippet. Only rendered when `excerpt` is non-empty.
 * @csspart meta - The wrapper around the `meta` slot. Only rendered in the built-in content path (not when the `content` slot is used), and `hidden` while the `meta` slot is empty.
 * @csspart timestamp - The formatted `timestamp`, rendered in a `<time>` element. Only rendered when `timestamp` is set and valid.
 * @csspart actions - The wrapper around the `actions` slot.
 * @cssprop [--lr-conversation-item-active-bg=var(--lr-color-brand-quiet)] - Background of the row
 *   while `active`. **Contrast-sensitive:** it is one half of a documented WCAG-AA pair — the
 *   active row's text is sized/toned for this background, so an override has to keep at least a
 *   4.5:1 ratio against `--lr-conversation-item-active-color` (excerpt/timestamp) and against
 *   `--lr-color-text` (the title, which is not restyled by the pair).
 * @cssprop [--lr-conversation-item-active-color=var(--lr-color-text)] - Text color of
 *   `[part="excerpt"]` and `[part="timestamp"]` while `active`. **Contrast-sensitive:** it exists
 *   precisely because `--lr-color-text-quiet` only reaches ~4.25:1 against the active background;
 *   override it together with `--lr-conversation-item-active-bg`, never alone.
 * @cssprop [--lr-conversation-item-active-indicator-color=var(--lr-color-brand)] - Color of the
 *   decorative `[part="active-indicator"]` while `active`.
 * @cssprop [--lr-conversation-item-active-indicator-width=var(--lr-size-2px)] - Inline size of
 *   `[part="active-indicator"]` while `active`.
 * @cssprop [--lr-conversation-item-active-indicator-inset-inline=0 auto] - Logical inline-start
 *   and inline-end insets for `[part="active-indicator"]`; set `auto 0` to place it at inline-end.
 * @cssprop [--lr-conversation-item-compact-padding=var(--lr-space-xs) var(--lr-space-s)] -
 *   `[part="base"]` padding while `compact`.
 * @cssprop [--lr-conversation-item-compact-gap=var(--lr-space-2xs)] - Gap between `[part="base"]`'s
 *   columns while `compact`.
 */
export class LyraConversationItem extends LyraElement<LyraConversationItemEventMap> {
  static override styles = [LyraElement.styles, styles];

  /** The session's display title. */
  @property() override title = '';

  /** A short preview snippet of the last message. Omit for no excerpt line. Ignored entirely when the
   *  `excerpt` slot has assigned content — see that slot's own description. Only non-focusable
   *  content should be slotted there: `role="button"` on `[part="option"]` forbids focusable
   *  descendants (axe's `nested-interactive` rule); an interactive control belongs in the `actions`
   *  slot instead. */
  @property() excerpt = '';

  /** When the session was last active. Accepts a `Date` or anything
   *  `new Date()` can parse (e.g. an ISO 8601 string); invalid input is
   *  treated the same as unset (no timestamp rendered) -- mirrors
   *  `<lr-chat-message>`'s identical `timestamp` prop. */
  @property({ attribute: false }) timestamp?: Date | string;

  /** Overrides the default absolute-time rendering of `timestamp` when an application
   *  needs a different timestamp style (mirrors `<lr-chat-message>`'s identical hook). */
  @property({ attribute: false }) formatTimestamp?: (date: Date) => string;

  /** Whether this is the currently-selected/open session. Drives the
   *  brand-quiet background treatment. */
  @property({ type: Boolean, reflect: true }) active = false;

  /** Tighter row padding and gaps, for the dense history sidebars these rows usually render in --
   *  same convention as `lr-empty`'s `compact`. Defaults to `false`, i.e. the full row padding.
   *  Purely a density knob: it tightens `[part="base"]`'s padding and gap and collapses
   *  `[part="content"]`'s inter-line gap, and changes nothing else. In particular it does **not**
   *  shrink `[part="rename-button"]` below the shared `--lr-icon-button-size` target floor, hide the
   *  excerpt (bind `excerpt`/the `excerpt` slot per row for that), or reduce the excerpt/timestamp
   *  font sizes -- so a row with a rename button or slotted `actions` still floors at roughly that
   *  icon size plus the compact padding. */
  @property({ type: Boolean, reflect: true }) compact = false;

  /** Whether inline-rename is available at all. When `false`, the rename
   *  button never renders and the row can never enter its editing state. If
   *  flipped to `false` while a rename is already open, the in-progress edit
   *  is cancelled (discarded, like Escape) rather than left committable. */
  @property({ type: Boolean, reflect: true, converter: trueDefaultBooleanConverter }) editable = true;

  /** Forwarded to the in-place rename `<input>`'s own `spellcheck`. Defaults to `true`, matching
   *  the native element's own default. `spellcheck="false"` is parsed as false. */
  @property({ converter: spellcheckConverter }) override spellcheck = true;

  /** Forwarded to the in-place rename `<input>`'s own `autocapitalize`. Empty string omits the
   *  attribute (browser default). */
  @property() override autocapitalize = '';

  /** Forwarded to the in-place rename `<input>`'s own `autocorrect` (Safari/WebKit-specific).
   *  Empty string omits the attribute (browser default). Named `autoCorrect` to avoid
   *  `HTMLElement.autocorrect`'s incompatible DOM typing -- mirrors `<lr-textarea>`'s identical
   *  choice. */
  @property({ attribute: 'autocorrect' }) autoCorrect = '';

  @state() private renaming = false;
  @state() private draftTitle = '';
  @state() private hasActionsSlot = false;
  @state() private hasLeadingSlot = false;
  @state() private hasContentSlot = false;
  @state() private hasMetaSlot = false;
  @state() private hasExcerptSlot = false;

  @query('[part="title-input"]') private titleInput?: HTMLInputElement;

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed); // no-op in LyraElement/ReactiveElement today, but a future mixin's
    // willUpdate() layered under this class must still run.
    if (!this.hasUpdated) {
      this.hasActionsSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'actions');
      this.hasLeadingSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'leading');
      this.hasContentSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'content');
      this.hasMetaSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'meta');
      this.hasExcerptSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'excerpt');
    }
    // `editable` documents that flipping it false can never leave a rename
    // committable -- without this, toggling it mid-edit would strand the
    // input mounted (and still submittable via Enter/blur) since nothing
    // else observes `editable` while `renaming` is already true.
    if (changed.has('editable') && !this.editable && this.renaming) {
      this.cancelRename();
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed); // no-op in LyraElement/ReactiveElement today, but a future mixin's
    // updated() layered under this class must still run.
    if (changed.has('renaming') && this.renaming) {
      // Runs after render, so the input already exists in the DOM.
      this.titleInput?.focus();
      this.titleInput?.select();
    }
  }

  private get normalizedTimestamp(): Date | undefined {
    if (this.timestamp === undefined) return undefined;
    const date = this.timestamp instanceof Date ? this.timestamp : new Date(this.timestamp);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  private select(): void {
    this.emit('lr-select');
  }

  private startRename(): void {
    if (!this.editable || this.renaming) return;
    this.draftTitle = this.title;
    this.renaming = true;
  }

  private commitRename(): void {
    this.renaming = false;
    const next = this.draftTitle.trim();
    // An empty or unchanged draft has nothing meaningful to commit -- treat
    // it the same as Escape rather than firing a no-op (or blanking) rename
    // for the consumer to deal with.
    if (!next || next === this.title) return;
    this.emit<ConversationItemRenameDetail>('lr-rename', { title: next });
  }

  private cancelRename(): void {
    this.renaming = false;
  }

  private onOptionClick = (): void => {
    // While renaming, `[part="option"]` has no role/selection semantics
    // (see the class doc) -- a click inside it (e.g. to place the caret in
    // the input) must not also select the row.
    if (this.renaming) return;
    this.select();
  };

  private onOptionKeyDown = (e: KeyboardEvent): void => {
    if (this.renaming) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      // Space would otherwise scroll the page, same as lr-checkbox/lr-switch.
      e.preventDefault();
      this.select();
    }
  };

  private onRenameButtonClick = (): void => {
    // No stopPropagation() needed here: the rename button is a DOM sibling
    // of `[part="option"]` (see the class doc), not a descendant of it, so
    // this click was never going to reach onOptionClick's listener anyway.
    this.startRename();
  };

  private onTitleInputChange = (e: Event): void => {
    this.draftTitle = (e.target as HTMLInputElement).value;
  };

  private onTitleInputKeyDown = (e: KeyboardEvent): void => {
    // The input is a descendant of `[part="option"]` (unlike the rename
    // button/actions slot, which are siblings of it) -- its keydown would
    // otherwise bubble into onOptionKeyDown above. Stopping it here avoids a
    // race where commitRename() (called below) has already flipped
    // `renaming` back to `false` by the time that bubbled event reaches
    // onOptionKeyDown's own `if (this.renaming) return;` guard, which would
    // otherwise wrongly let the same Enter keystroke also fire lr-select.
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      this.commitRename();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.cancelRename();
    }
  };

  private onTitleInputFocus = (): void => {
    this.emit('focus');
  };

  private onTitleInputBlur = (): void => {
    // Native blur/focus neither bubble nor cross the shadow boundary -- re-dispatch so a
    // host-level listener on the custom element itself can observe them. Always fires, even on
    // the Escape-driven path below, since the native input really did blur either way.
    this.emit('blur');
    // If Escape already ended the edit synchronously (cancelRename() runs
    // before this fires), `renaming` is already false by the time the
    // now-removed input's blur event reaches here -- skip so Escape can't
    // also commit.
    if (!this.renaming) return;
    this.commitRename();
  };

  private onActionsSlotChange = (e: Event): void => {
    this.hasActionsSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onLeadingSlotChange = (e: Event): void => {
    this.hasLeadingSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onContentSlotChange = (e: Event): void => {
    this.hasContentSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onMetaSlotChange = (e: Event): void => {
    this.hasMetaSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onExcerptSlotChange = (e: Event): void => {
    this.hasExcerptSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  override render(): TemplateResult {
    const ts = this.normalizedTimestamp;
    const formatter = this.formatTimestamp ?? ((date: Date) => defaultFormatTimestamp(date, this.effectiveLocale));
    const displayTitle = this.title || this.localize('untitledConversation');
    const showRenameButton = this.editable && !this.renaming;
    // Shared between the rename button and the input it opens: the input is
    // where focus actually lands, so it needs the same row-specific
    // accessible name (not a generic one) to disambiguate which row a
    // screen-reader user is editing.
    const renameLabel = this.localize('rename', undefined, { title: displayTitle });

    return html`
      <div part="base">
        ${this.active ? html`<span part="active-indicator" aria-hidden="true"></span>` : nothing}
        <div
          part="option"
          role=${this.renaming ? nothing : 'button'}
          tabindex=${this.renaming ? nothing : '0'}
          aria-current=${this.renaming || !this.active ? nothing : 'true'}
          aria-label=${this.renaming ? nothing : this.getAttribute('aria-label') || displayTitle}
          @click=${this.onOptionClick}
          @keydown=${this.onOptionKeyDown}
        >
          <span part="leading" ?hidden=${!this.hasLeadingSlot}>
            <slot name="leading" @slotchange=${this.onLeadingSlotChange}></slot>
          </span>
          <div part="content">
            <slot name="content" @slotchange=${this.onContentSlotChange}></slot>
            ${!this.hasContentSlot
              ? html`
                  ${this.renaming
                    ? html`<input
                        part="title-input"
                        type="text"
                        dir="auto"
                        .value=${this.draftTitle}
                        aria-label=${renameLabel}
                        spellcheck=${this.spellcheck}
                        autocapitalize=${this.autocapitalize || nothing}
                        autocorrect=${this.autoCorrect || nothing}
                        @input=${this.onTitleInputChange}
                        @keydown=${this.onTitleInputKeyDown}
                        @focus=${this.onTitleInputFocus}
                        @blur=${this.onTitleInputBlur}
                      />`
                    : html`<span part="title" dir="auto" title=${displayTitle}>${displayTitle}</span>`}
                  <span part="excerpt" dir="auto" ?hidden=${!(this.hasExcerptSlot || this.excerpt)}>
                    <slot name="excerpt" @slotchange=${this.onExcerptSlotChange}></slot>
                    ${!this.hasExcerptSlot && this.excerpt ? this.excerpt : nothing}
                  </span>
                  <span part="meta" ?hidden=${!this.hasMetaSlot}>
                    <slot name="meta" @slotchange=${this.onMetaSlotChange}></slot>
                  </span>
                `
              : nothing}
          </div>
          ${ts ? html`<time part="timestamp" dir="auto" datetime=${ts.toISOString()}>${formatter(ts)}</time>` : nothing}
        </div>
        ${showRenameButton
          ? html`<button
              part="rename-button"
              type="button"
              aria-label=${renameLabel}
              @click=${this.onRenameButtonClick}
            >
              ${pencilIcon()}
            </button>`
          : nothing}
        <span part="actions" ?hidden=${!this.hasActionsSlot}>
          <slot name="actions" @slotchange=${this.onActionsSlotChange}></slot>
        </span>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-conversation-item': LyraConversationItem;
  }
}

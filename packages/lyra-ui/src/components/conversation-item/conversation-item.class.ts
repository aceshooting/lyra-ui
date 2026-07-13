import { html, nothing, svg, type TemplateResult, type SVGTemplateResult, type PropertyValues } from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { styles } from './conversation-item.styles.js';

export interface ConversationItemRenameDetail {
  title: string;
}

// Mirrors the shared icon set's viewBox/stroke conventions
// (internal/icons.ts's chevronIcon()/closeIcon()/etc.) without adding a
// pencil/edit glyph to that module -- it's off limits here -- so this
// one-off icon still reads as part of the same visual language as the rest
// of the library's inline icons. Same approach lyra-checkbox's own local
// checkmark/indeterminate glyphs and lyra-chat-message's local retryIcon()
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
 *  entirely, mirroring `<lyra-chat-message>`'s identical override hook. */
function defaultFormatTimestamp(date: Date, now: Date = new Date()): string {
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
  }
  const sameYear = date.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat(
    undefined,
    sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' },
  ).format(date);
}

/**
 * `<lyra-conversation-item>` — a selectable row representing one chat
 * session in a history sidebar list. Usable standalone or as the
 * `renderItem()` payload of a sibling virtualized-list component; this
 * module has no dependency on that (or any) other component.
 *
 * Takes `title`/`excerpt`/`timestamp` as individual primitive props rather
 * than one opaque bound object, deliberately consistent with how
 * `<lyra-chat-message>` takes individual props instead of a single
 * `.message` blob -- every other component in this family follows that
 * shape, so this one does too even though a single bound `.session` object
 * would also have been a reasonable design.
 *
 * Identifying *which* session a `lyra-select` click/keypress was about: this
 * reuses the platform's own `id` attribute (every element already has one)
 * rather than inventing a second, differently-named id-carrying prop --
 * consumers already have the event's `target`/`currentTarget` (and thus
 * `.id`), the same reasoning `<lyra-attachment-chip>` documents for its own
 * identically-shaped choice. `lyra-select` therefore carries no detail
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
 * and would silently swallow the row's own single-click `lyra-select`,
 * whereas a button is independently focusable, has its own accessible name,
 * and composes cleanly with click-to-select.
 *
 * @customElement lyra-conversation-item
 * @slot actions - Overflow/icon-button controls (for example a pin/delete
 * button or a `lyra-menu` trigger) rendered at the trailing edge of the row.
 * @event lyra-select - The row was activated: a click on `[part="option"]`
 * (i.e. outside the rename button and the `actions` slot), or Enter/Space
 * while it's focused -- in both cases only while not currently renaming. No
 * detail payload -- see the class doc's "Identifying which session" note.
 * @event lyra-rename - An in-place rename was committed (Enter, or blur
 * while editing). `detail: { title }`. Does not mutate `title` itself --
 * this is a controlled component, the same convention
 * `<lyra-chat-message>` follows by not clearing its own state on retry; the
 * consumer applies the new title once it's actually persisted. Not fired
 * when the trimmed draft is empty or unchanged from the original `title`
 * (that's treated as an implicit cancel).
 * @csspart base - The outer row wrapper (plain, no ARIA role) laying out `[part="option"]`, the rename button, and `actions`.
 * @csspart option - The selectable region (`role="button"`, removed while renaming -- see the class doc). Wraps `content` and `timestamp`.
 * @csspart content - Wrapper around the title and excerpt.
 * @csspart title - The title text, shown while not renaming.
 * @csspart title-input - The in-place rename `<input>`, shown only while renaming.
 * @csspart rename-button - The pencil/edit affordance that starts a rename (only rendered while `editable` and not already renaming).
 * @csspart excerpt - The last-message preview snippet. Only rendered when `excerpt` is non-empty.
 * @csspart timestamp - The formatted `timestamp`, rendered in a `<time>` element. Only rendered when `timestamp` is set and valid.
 * @csspart actions - The wrapper around the `actions` slot.
 */
export interface LyraConversationItemEventMap {
  'lyra-select': CustomEvent<undefined>;
}
export class LyraConversationItem extends LyraElement<LyraConversationItemEventMap> {
  static styles = [LyraElement.styles, styles];

  /** The session's display title. */
  @property() title = '';

  /** A short preview snippet of the last message. Omit for no excerpt line. */
  @property() excerpt = '';

  /** When the session was last active. Accepts a `Date` or anything
   *  `new Date()` can parse (e.g. an ISO 8601 string); invalid input is
   *  treated the same as unset (no timestamp rendered) -- mirrors
   *  `<lyra-chat-message>`'s identical `timestamp` prop. */
  @property({ attribute: false }) timestamp?: Date | string;

  /** Overrides the default absolute-time rendering of `timestamp` -- this
   *  library has no i18n system of its own, so an overridable formatter is
   *  the established way to hand locale-sensitive display back to the
   *  consumer (mirrors `<lyra-chat-message>`'s identical `formatTimestamp`). */
  @property({ attribute: false }) formatTimestamp?: (date: Date) => string;

  /** Whether this is the currently-selected/open session. Drives the
   *  brand-quiet background treatment. */
  @property({ type: Boolean, reflect: true }) active = false;

  /** Whether inline-rename is available at all. When `false`, the rename
   *  button never renders and the row can never enter its editing state. If
   *  flipped to `false` while a rename is already open, the in-progress edit
   *  is cancelled (discarded, like Escape) rather than left committable. */
  @property({ type: Boolean, reflect: true }) editable = true;

  @state() private renaming = false;
  @state() private draftTitle = '';
  @state() private hasActionsSlot = false;

  @query('[part="title-input"]') private titleInput?: HTMLInputElement;

  protected willUpdate(changed: PropertyValues): void {
    if (!this.hasUpdated) {
      this.hasActionsSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'actions');
    }
    // `editable` documents that flipping it false can never leave a rename
    // committable -- without this, toggling it mid-edit would strand the
    // input mounted (and still submittable via Enter/blur) since nothing
    // else observes `editable` while `renaming` is already true.
    if (changed.has('editable') && !this.editable && this.renaming) {
      this.cancelRename();
    }
  }

  protected updated(changed: PropertyValues): void {
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
    this.emit('lyra-select');
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
    this.emit<ConversationItemRenameDetail>('lyra-rename', { title: next });
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
      // Space would otherwise scroll the page, same as lyra-checkbox/lyra-switch.
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
    // otherwise wrongly let the same Enter keystroke also fire lyra-select.
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      this.commitRename();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.cancelRename();
    }
  };

  private onTitleInputBlur = (): void => {
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

  render(): TemplateResult {
    const ts = this.normalizedTimestamp;
    const formatter = this.formatTimestamp ?? defaultFormatTimestamp;
    const displayTitle = this.title || 'Untitled conversation';
    const showRenameButton = this.editable && !this.renaming;
    // Shared between the rename button and the input it opens: the input is
    // where focus actually lands, so it needs the same row-specific
    // accessible name (not a generic one) to disambiguate which row a
    // screen-reader user is editing.
    const renameLabel = `Rename ${displayTitle}`;

    return html`
      <div part="base">
        <div
          part="option"
          role=${this.renaming ? nothing : 'button'}
          tabindex=${this.renaming ? nothing : '0'}
          aria-current=${this.renaming || !this.active ? nothing : 'true'}
          aria-label=${this.renaming ? nothing : this.getAttribute('aria-label') || displayTitle}
          @click=${this.onOptionClick}
          @keydown=${this.onOptionKeyDown}
        >
          <div part="content">
            ${this.renaming
              ? html`<input
                  part="title-input"
                  type="text"
                  .value=${this.draftTitle}
                  aria-label=${renameLabel}
                  @input=${this.onTitleInputChange}
                  @keydown=${this.onTitleInputKeyDown}
                  @blur=${this.onTitleInputBlur}
                />`
              : html`<span part="title" title=${displayTitle}>${displayTitle}</span>`}
            ${this.excerpt ? html`<span part="excerpt">${this.excerpt}</span>` : nothing}
          </div>
          ${ts ? html`<time part="timestamp" datetime=${ts.toISOString()}>${formatter(ts)}</time>` : nothing}
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
    'lyra-conversation-item': LyraConversationItem;
  }
}

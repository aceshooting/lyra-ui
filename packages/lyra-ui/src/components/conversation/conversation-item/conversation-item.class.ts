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
import {
  autocorrectConverter,
  normalizeAutocorrect,
  presenceTrueDefaultBooleanConverter as trueDefaultBooleanConverter,
  spellcheckConverter,
} from '../../../internal/converters.js';
import { activeElementIn } from '../../../internal/active-element.js';
import { normalizeLyraTimestamp, type LyraTimestamp } from '../timestamp.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_rename, LYRA_DEFAULT_untitledConversation } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export interface ConversationItemRenameDetail {
  conversationId: string;
  label: string;
}

export interface ConversationItemSelectDetail {
  conversationId: string;
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
function defaultFormatTimestamp(
  date: Date,
  locale: string,
  now: Date = new Date()
): string {
  // Shared per-locale+options formatter cache: this runs per row per render in a history
  // sidebar list, and constructing an `Intl.DateTimeFormat` per call is an ICU locale-data
  // lookup. `effectiveLocale` always resolves to a non-empty tag (it falls back to `'en'`),
  // so no empty-locale guard is needed.
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return getDateTimeFormat(locale, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  }
  const sameYear = date.getFullYear() === now.getFullYear();
  return getDateTimeFormat(
    locale,
    sameYear
      ? { month: 'short', day: 'numeric' }
      : { month: 'short', day: 'numeric', year: 'numeric' }
  ).format(date);
}

export interface LyraConversationItemEventMap {
  'lr-select': CustomEvent<ConversationItemSelectDetail>;
  'lr-rename': CustomEvent<ConversationItemRenameDetail>;
  blur: CustomEvent<null>;
  focus: CustomEvent<null>;
}
/**
 * `<lr-conversation-item>` — a selectable row representing one chat
 * session in a history sidebar list. Usable standalone or as the
 * `renderItem()` payload of a sibling virtualized-list component; this
 * module has no dependency on that (or any) other component.
 *
 * Takes `label`/`excerpt`/`timestamp` as individual primitive props rather
 * than one opaque bound object, deliberately consistent with how
 * `<lr-chat-message>` takes individual props instead of a single
 * `.message` blob -- every other component in this family follows that
 * shape, so this one does too even though a single bound `.session` object
 * would also have been a reasonable design.
 *
 * `conversationId` is the stable domain identity carried by both selection and rename events;
 * native `id` remains available for document identity and CSS/ARIA references.
 *
 * `role="button"` on `[part="select-button"]` so the item has valid semantics both
 * standalone and when placed in a larger history-list layout. A conversation
 * row activates one current session; it is not itself a listbox option and
 * therefore does not require a particular owner role.
 *
 * `role="button"` forbids focusable
 * descendants -- verified against axe-core's `nested-interactive` rule,
 * which flags it. That's why the rename button and the `actions` slot are
 * rendered as DOM *siblings* of `[part="select-button"]` (both inside
 * `[part="base"]`) rather than nested inside it: `[part="select-button"]` only ever
 * contains plain text/`<time>` content. The in-place rename `<input>` is the
 * same problem one level deeper -- it replaces the label *inside*
 * `[part="select-button"]` while renaming -- so `[part="select-button"]` sheds its
 * `role`/`tabindex`/`aria-current`/`aria-label` entirely for the duration
 * of an edit. A row mid-edit is a text field, so suspending the button
 * semantics is also the more accurate
 * description of what's on screen.
 *
 * Inline rename is a dedicated pencil/edit icon button (not a double-click
 * on the label) -- double-click has no keyboard/screen-reader equivalent
 * and would silently swallow the row's own single-click `lr-select`,
 * whereas a button is independently focusable, has its own accessible name,
 * and composes cleanly with click-to-select.
 *
 * @customElement lr-conversation-item
 * @slot actions - Overflow/icon-button controls (for example a pin/delete
 * button or a `lr-menu` trigger) rendered at the trailing edge of the row.
 * @slot start - Non-interactive content such as an avatar, purpose icon, or status indicator,
 * rendered inside the selectable region before the label/excerpt content.
 * @slot content - Replaces the built-in label, excerpt, and meta content area with host-supplied
 * non-interactive row content.
 * @slot excerpt - Full override of the excerpt presentation (e.g. a search-hit snippet with `<mark>`
 *   highlighting). Wins over the `excerpt` property whenever it has assigned content, even if
 *   `excerpt` is also set. Only non-focusable content should be slotted here — see the `excerpt`
 *   property's own doc for why.
 * @slot meta - Small, non-focusable structured fields for the row (e.g. a day label, cost, request
 *   count) rendered below the label/excerpt. Entirely app-supplied; this component computes none of
 *   it. Only non-focusable content should be slotted here, for the same `nested-interactive` reason
 *   as `excerpt`.
 * @event lr-select - The row was activated: a click on `[part="select-button"]`
 * (i.e. outside the rename button and the `actions` slot), or Enter/Space
 * while it's focused -- in both cases only while not currently renaming.
 * `detail: { conversationId }`.
 * @event lr-rename - An in-place rename was committed (Enter, or blur
 * while editing). `detail: { conversationId, label }`. Does not mutate `label` itself --
 * this is a controlled component, the same convention
 * `<lr-chat-message>` follows by not clearing its own state on retry; the
 * consumer applies the new label once it's actually persisted. Not fired
 * when the trimmed draft is empty or unchanged from the original `label`
 * (that's treated as an implicit cancel).
 * @event blur - Re-dispatched from the in-place rename input as a bubbling, composed event.
 * @event focus - Re-dispatched from the in-place rename input as a bubbling, composed event.
 * @csspart base - The outer row wrapper (plain, no ARIA role) laying out `[part="select-button"]`, the rename button, and `actions`.
 * @csspart active-indicator - A decorative inline indicator rendered only while the row is active.
 * @csspart select-button - The selectable region (`role="button"`, removed while renaming -- see the class doc). Wraps `content` and `timestamp`.
 * @csspart start - The wrapper around the `start` slot, inside `select-button`. Always rendered, but `hidden` while the slot is empty.
 * @csspart content - Wrapper around the label and excerpt.
 * @csspart label - The visible label, shown while not renaming.
 * @csspart label-input - The in-place rename `<input>`, shown only while renaming.
 * @csspart rename-button - The pencil/edit affordance that starts a rename (only rendered while `renamable` and not already renaming).
 * @csspart excerpt - The last-message preview snippet. Only rendered when `excerpt` is non-empty.
 * @csspart meta - The wrapper around the `meta` slot. Only rendered in the built-in content path (not when the `content` slot is used), and `hidden` while the `meta` slot is empty.
 * @csspart timestamp - The formatted `timestamp`, rendered in a `<time>` element. Only rendered when `timestamp` is set and valid.
 * @csspart actions - The wrapper around the `actions` slot.
 * @cssprop [--lr-conversation-item-active-bg=var(--lr-color-brand-quiet)] - Background of the row
 *   while `active`. **Contrast-sensitive:** it is one half of a documented WCAG-AA pair — the
 *   active row's text is sized/toned for this background, so an override has to keep at least a
 *   4.5:1 ratio against `--lr-conversation-item-active-color` (excerpt/timestamp) and against
 *   `--lr-color-text` (the label, which is not restyled by the pair).
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
 * @status stable
 * @since 4.0.0
 */
export class LyraConversationItem extends LyraElement<LyraConversationItemEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    rename: LYRA_DEFAULT_rename,
    untitledConversation: LYRA_DEFAULT_untitledConversation,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** Stable domain identity included in selection and rename request details. */
  @property({ attribute: 'conversation-id' }) conversationId = '';

  /** The session's visible label. The inherited native `title` remains available for host tooltip
   *  semantics and is not used as conversation content. */
  @property() label = '';

  /** A short preview snippet of the last message. Omit for no excerpt line. Ignored entirely when the
   *  `excerpt` slot has assigned content — see that slot's own description. Only non-focusable
   *  content should be slotted there: `role="button"` on `[part="select-button"]` forbids focusable
   *  descendants (axe's `nested-interactive` rule); an interactive control belongs in the `actions`
   *  slot instead. */
  @property() excerpt = '';

  /** When the session was last active. Accepts a `Date` or anything
   *  `new Date()` can parse (e.g. an ISO 8601 string); invalid input is
   *  treated the same as unset (no timestamp rendered) -- mirrors
   *  `<lr-chat-message>`'s identical `timestamp` prop. */
  @property({ attribute: false }) timestamp?: LyraTimestamp;

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
  @property({
    type: Boolean,
    reflect: true,
    converter: trueDefaultBooleanConverter,
  })
  renamable = true;

  /** Forwarded to the in-place rename `<input>`'s own `spellcheck`. Defaults to `true`, matching
   *  the native element's own default. `spellcheck="false"` is parsed as false. */
  @property({ converter: spellcheckConverter }) override spellcheck = true;

  /** Forwarded to the in-place rename `<input>`'s own `autocapitalize`. Empty string omits the
   *  attribute (browser default). */
  @property() override autocapitalize = '';

  private autocorrectValue = true;

  /** Native editing-assistance state forwarded as canonical `autocorrect="on"|"off"`. String
   *  writes are normalized for framework and plain-DOM interoperability; reads are boolean. */
  @property({ converter: autocorrectConverter })
  override get autocorrect(): boolean {
    return this.autocorrectValue;
  }
  override set autocorrect(next: boolean | string) {
    this.autocorrectValue = normalizeAutocorrect(next);
  }

  @state() private renaming = false;
  @state() private draftLabel = '';
  @state() private hasActionsSlot = false;
  @state() private hasStartSlot = false;
  @state() private hasContentSlot = false;
  @state() private hasMetaSlot = false;
  @state() private hasExcerptSlot = false;

  @query('[part="label-input"]') private labelInput?: HTMLInputElement;
  private blurCommitGeneration = 0;

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated && this.renaming) this.focusRenameInput();
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed); // no-op in LyraElement/ReactiveElement today, but a future mixin's
    // willUpdate() layered under this class must still run.
    if (!this.hasUpdated) {
      this.hasActionsSlot = Array.from(this.children).some(
        (el) => el.getAttribute('slot') === 'actions'
      );
      this.syncStartSlot();
      this.hasContentSlot = Array.from(this.children).some(
        (el) => el.getAttribute('slot') === 'content'
      );
      this.hasMetaSlot = Array.from(this.children).some(
        (el) => el.getAttribute('slot') === 'meta'
      );
      this.hasExcerptSlot = Array.from(this.children).some(
        (el) => el.getAttribute('slot') === 'excerpt'
      );
    }
    // `renamable` documents that flipping it false can never leave a rename
    // committable -- without this, toggling it mid-edit would strand the
    // input mounted (and still submittable via Enter/blur) since nothing
    // else observes `renamable` while `renaming` is already true.
    if (changed.has('renamable') && !this.renamable && this.renaming) {
      this.cancelRename();
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed); // no-op in LyraElement/ReactiveElement today, but a future mixin's
    // updated() layered under this class must still run.
    if (changed.has('renaming') && this.renaming) {
      // Runs after render, so the input already exists in the DOM.
      this.focusRenameInput();
    }
  }

  private focusRenameInput(): void {
    this.labelInput?.focus();
    this.labelInput?.select();
  }

  private get normalizedTimestamp(): Date | undefined {
    return normalizeLyraTimestamp(this.timestamp);
  }

  private select(): void {
    this.emit('lr-select', { conversationId: this.conversationId });
  }

  /** Activates the selectable row, matching a native button host. */
  override click(): void {
    if (this.renaming) this.labelInput?.click();
    else
      (
        this.renderRoot.querySelector(
          '[part="select-button"]'
        ) as HTMLElement | null
      )?.click();
  }

  private startRename(): void {
    if (!this.renamable || this.renaming) return;
    this.draftLabel = this.label;
    this.renaming = true;
  }

  private restoreOptionFocus(): void {
    void this.updateComplete.then(() => {
      (
        this.renderRoot.querySelector(
          '[part="select-button"]'
        ) as HTMLElement | null
      )?.focus();
    });
  }

  private commitRename(restoreFocus = false): void {
    this.renaming = false;
    if (restoreFocus) this.restoreOptionFocus();
    const next = this.draftLabel.trim();
    // An empty or unchanged draft has nothing meaningful to commit -- treat
    // it the same as Escape rather than firing a no-op (or blanking) rename
    // for the consumer to deal with.
    if (!next || next === this.label) return;
    this.emit('lr-rename', {
      conversationId: this.conversationId,
      label: next,
    });
  }

  private cancelRename(restoreFocus = false): void {
    this.renaming = false;
    if (restoreFocus) this.restoreOptionFocus();
  }

  private onOptionClick = (): void => {
    // While renaming, `[part="select-button"]` has no role/selection semantics
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
    // of `[part="select-button"]` (see the class doc), not a descendant of it, so
    // this click was never going to reach onOptionClick's listener anyway.
    this.startRename();
  };

  private onLabelInputChange = (e: Event): void => {
    this.draftLabel = (e.target as HTMLInputElement).value;
  };

  private onLabelInputKeyDown = (e: KeyboardEvent): void => {
    // The input is a descendant of `[part="select-button"]` (unlike the rename
    // button/actions slot, which are siblings of it) -- its keydown would
    // otherwise bubble into onOptionKeyDown above. Stopping it here avoids a
    // race where commitRename() (called below) has already flipped
    // `renaming` back to `false` by the time that bubbled event reaches
    // onOptionKeyDown's own `if (this.renaming) return;` guard, which would
    // otherwise wrongly let the same Enter keystroke also fire lr-select.
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      this.commitRename(true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.cancelRename(true);
    }
  };

  private onLabelInputFocus = (): void => {
    this.emit('focus', null);
  };

  private onLabelInputBlur = (event: FocusEvent): void => {
    // Native blur/focus neither bubble nor cross the shadow boundary -- re-dispatch so a
    // host-level listener on the custom element itself can observe them. Always fires, even on
    // the Escape-driven path below, since the native input really did blur either way.
    this.emit('blur', null);
    // If Escape already ended the edit synchronously (cancelRename() runs
    // before this fires), `renaming` is already false by the time the
    // now-removed input's blur event reaches here -- skip so Escape can't
    // also commit.
    if (!this.renaming) return;
    const generation = ++this.blurCommitGeneration;
    const synthetic = !event.isTrusted;
    queueMicrotask(() => {
      if (generation !== this.blurCommitGeneration || !this.renaming) return;
      // Removing a virtualized row blurs its editor as a lifecycle side effect. Preserve the
      // controlled draft/state so reconnect can restore the same editing session and focus.
      if (
        !this.isConnected ||
        (!synthetic && activeElementIn(this.shadowRoot) === this.labelInput)
      )
        return;
      this.commitRename();
    });
  };

  private onActionsSlotChange = (e: Event): void => {
    this.hasActionsSlot =
      (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length >
      0;
  };

  private syncStartSlot = (): void => {
    this.hasStartSlot = Array.from(this.children).some(
      (el) => el.getAttribute('slot') === 'start'
    );
  };

  private onContentSlotChange = (e: Event): void => {
    this.hasContentSlot =
      (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length >
      0;
  };

  private onMetaSlotChange = (e: Event): void => {
    this.hasMetaSlot =
      (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length >
      0;
  };

  private onExcerptSlotChange = (e: Event): void => {
    this.hasExcerptSlot =
      (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length >
      0;
  };

  override render(): TemplateResult {
    const ts = this.normalizedTimestamp;
    const formatter =
      this.formatTimestamp ??
      ((date: Date) => defaultFormatTimestamp(date, this.effectiveLocale));
    const displayLabel = this.label || this.localize('untitledConversation');
    const showRenameButton = this.renamable && !this.renaming;
    // Shared between the rename button and the input it opens: the input is
    // where focus actually lands, so it needs the same row-specific
    // accessible name (not a generic one) to disambiguate which row a
    // screen-reader user is editing.
    const renameLabel = this.localize('rename', undefined, {
      title: displayLabel,
    });

    return html`
      <div part="base">
        ${this.active
          ? html`<span part="active-indicator" aria-hidden="true"></span>`
          : nothing}
        <div
          part="select-button"
          role=${this.renaming ? nothing : 'button'}
          tabindex=${this.renaming ? nothing : '0'}
          aria-current=${this.renaming
            ? nothing
            : this.active
            ? 'true'
            : 'false'}
          aria-label=${this.renaming
            ? nothing
            : this.getAttribute('aria-label') ?? displayLabel}
          @click=${this.onOptionClick}
          @keydown=${this.onOptionKeyDown}
        >
          <span part="start" ?hidden=${!this.hasStartSlot}>
            <slot name="start" @slotchange=${this.syncStartSlot}></slot>
          </span>
          <div part="content">
            <slot
              name="content"
              ?hidden=${this.renaming}
              @slotchange=${this.onContentSlotChange}
            ></slot>
            ${this.renaming
              ? html`<input
                  part="label-input"
                  type="text"
                  dir="auto"
                  .value=${this.draftLabel}
                  aria-label=${renameLabel}
                  spellcheck=${this.spellcheck}
                  autocapitalize=${this.autocapitalize || nothing}
                  autocorrect=${this.hasAttribute('autocorrect') ||
                  !this.autocorrect
                    ? this.autocorrect
                      ? 'on'
                      : 'off'
                    : nothing}
                  @input=${this.onLabelInputChange}
                  @keydown=${this.onLabelInputKeyDown}
                  @focus=${this.onLabelInputFocus}
                  @blur=${this.onLabelInputBlur}
                />`
              : !this.hasContentSlot
              ? html`
                  <span part="label" dir="auto">${displayLabel}</span>
                  <span
                    part="excerpt"
                    dir="auto"
                    ?hidden=${!(this.hasExcerptSlot || this.excerpt)}
                  >
                    <slot
                      name="excerpt"
                      @slotchange=${this.onExcerptSlotChange}
                    ></slot>
                    ${!this.hasExcerptSlot && this.excerpt
                      ? this.excerpt
                      : nothing}
                  </span>
                  <span part="meta" ?hidden=${!this.hasMetaSlot}>
                    <slot
                      name="meta"
                      @slotchange=${this.onMetaSlotChange}
                    ></slot>
                  </span>
                `
              : nothing}
          </div>
          ${ts
            ? html`<time
                part="timestamp"
                dir="auto"
                datetime=${ts.toISOString()}
                >${formatter(ts)}</time
              >`
            : nothing}
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

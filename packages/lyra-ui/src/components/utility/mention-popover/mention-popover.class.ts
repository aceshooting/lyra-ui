import {
  html,
  nothing,
  type PropertyDeclaration,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import {
  deferredPlaceReady as place,
  type DeferredOperationHandle,
} from '../../../internal/anchored-overlay-runtime.js';
import { hostAriaLabel, nextId } from '../../../internal/a11y.js';
import {
  acquireAnnouncementSink,
  type AnnouncementSink,
} from '../../../internal/announcer.js';
import { styles } from './mention-popover.styles.js';
import { activeElementIn } from '../../../internal/active-element.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_mentionResultCount, LYRA_DEFAULT_mentionResultPosition, LYRA_DEFAULT_mentionSuggestions, LYRA_DEFAULT_noMatches } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

/** One candidate row — an `@`-mentionable person/entity, or a `/`-command. */
export interface LyraMentionItem {
  /** Stable business id. Duplicate ids remain distinguishable through the selection index. */
  readonly suggestionId: string;
  readonly label: string;
  readonly description?: string;
  /** Literal icon hint (e.g. an emoji), rendered next to `label` -- same
   *  "opaque string, not a registry lookup" convention as
   *  `<lr-tool-call-chip>`'s/`<lr-tool-select-dialog>`'s own `icon`. */
  readonly icon?: string;
}

/** Predicate deciding whether `item` matches a (already-trimmed, locale-lowercased) `query`.
 *  Mirrors `<lr-combobox>`'s `OptionFilter` convention -- override `filter` to replace the
 *  built-in case-insensitive label/description substring match entirely. */
export type LyraMentionFilter = (item: LyraMentionItem, query: string) => boolean;

export interface LyraMentionSelectDetail {
  readonly suggestionId: string;
  /** Occurrence in the assigned `items` collection, before query filtering. */
  readonly index: number;
  readonly label: string;
}

/** Guards an asynchronous same-tree focus transfer against stale caller ownership. */
export interface LyraMentionFocusOptions {
  /** Re-evaluated immediately before focus moves and during later popover-owned navigation. */
  readonly ownsFocus?: () => boolean;
}

type TextControl = HTMLTextAreaElement | HTMLInputElement;

type ReflectedAriaControl = HTMLElement & {
  ariaActiveDescendantElement?: Element | null;
  ariaControlsElements?: readonly Element[] | null;
};

interface AttributeSnapshot {
  present: boolean;
  value: string | null;
}

interface AnchorRelationship {
  control: TextControl;
  attributes: Map<string, AttributeSnapshot>;
  activeElement?: Element | null;
  controlsElements?: readonly Element[] | null;
  selectionStart?: number | null;
  selectionEnd?: number | null;
  selectionDirection?: SelectionDirection | null;
}

function isTextControl(el: Element): el is TextControl {
  const view = el.ownerDocument.defaultView;
  if (!view) return false;
  if (el instanceof view.HTMLTextAreaElement) return true;
  return el instanceof view.HTMLInputElement && (el.type === 'text' || el.type === 'search');
}

function isTextareaAnchor(el: Element): el is HTMLTextAreaElement {
  const view = el.ownerDocument.defaultView;
  return Boolean(view && el instanceof view.HTMLTextAreaElement);
}

// Computed-style properties that affect text layout/measurement, copied
// verbatim from the real control onto the hidden mirror in caretClientRect()
// below so wrapped-line offsets inside the mirror land exactly where they do
// in the real control. Deliberately excludes paint-only properties (color,
// background, etc.) -- those never affect where text/lines break.
const MIRROR_CSS_PROPS = [
  'box-sizing',
  'width',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'border-style',
  'font-family',
  'font-size',
  'font-style',
  'font-variant',
  'font-weight',
  'font-stretch',
  'letter-spacing',
  'word-spacing',
  'line-height',
  'text-align',
  'text-indent',
  'text-transform',
  'tab-size',
  'direction',
] as const;

/**
 * Measures exactly where `el`'s caret (`selectionStart`) currently paints,
 * in viewport coordinates, via the classic "hidden mirror div + marker span"
 * technique: there is no native DOM API for this -- `getBoundingClientRect()`
 * on a text control only reports the control's own box, never a cursor
 * position inside it. A throwaway off-screen clone of `el` is built (font/
 * box metrics copied via `MIRROR_CSS_PROPS` above), a marker `<span>` is
 * inserted at the caret's text offset, its rect is measured relative to the
 * mirror's own rect (so the absolute off-screen position of the mirror
 * itself never matters), and that local offset is applied to `el`'s real
 * `getBoundingClientRect()` minus its current scroll offset. Returns `null`
 * for a zero-size (e.g. `display: none`) control.
 */
function caretClientRect(el: TextControl): DOMRect | null {
  const owner = el.ownerDocument;
  const view = owner.defaultView;
  if (!view) return null;
  const elRect = el.getBoundingClientRect();
  if (elRect.width === 0 || elRect.height === 0) return null;

  const computed = view.getComputedStyle(el);
  const mirror = owner.createElement('div');
  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.top = '0';
  mirror.style.left = '-9999px';
  // <textarea> soft-wraps; a single-line <input> never does -- mismatching
  // this makes the mirror wrap where the real control wouldn't (or vice
  // versa), throwing off every offset past the first line/character run.
  mirror.style.whiteSpace = el instanceof view.HTMLTextAreaElement ? 'pre-wrap' : 'pre';
  mirror.style.overflowWrap = 'break-word';
  for (const prop of MIRROR_CSS_PROPS) {
    mirror.style.setProperty(prop, computed.getPropertyValue(prop));
  }

  const index = el.selectionStart ?? el.value.length;
  mirror.append(owner.createTextNode(el.value.slice(0, index)));
  const marker = owner.createElement('span');
  // A marker with no content at all collapses to zero width -- a hair of
  // content keeps it reliably measurable even for a caret sitting at the
  // very end of the value.
  marker.textContent = el.value.slice(index) || '​';
  mirror.appendChild(marker);
  owner.body.appendChild(mirror);

  const mirrorRect = mirror.getBoundingClientRect();
  const markerRect = marker.getBoundingClientRect();
  mirror.remove();

  const lineHeight = parseFloat(computed.lineHeight) || markerRect.height || 16;
  return new view.DOMRect(
    elRect.left + (markerRect.left - mirrorRect.left) - el.scrollLeft,
    elRect.top + (markerRect.top - mirrorRect.top) - el.scrollTop,
    1,
    lineHeight,
  );
}

export interface LyraMentionPopoverEventMap {
  'lr-mention-select': CustomEvent<LyraMentionSelectDetail>;
  'lr-mention-close': CustomEvent<null>;
}
/**
 * `<lr-mention-popover>` — a caret-anchored, keyboard-navigable popover for
 * `@`-mention and `/`-slash-command autocomplete inside a plain-text
 * `<textarea>`/`<input>` the host owns (e.g. `<lr-chat-composer>`'s own
 * textarea, though this component has no dependency on that or any other
 * specific input). A textarea session keeps the native textarea's implicit
 * textbox semantics: it snapshots and temporarily clears any authored role,
 * expanded state, controls/active-descendant IDREF, or ARIA element reflection
 * across shadow roots, leaving only autocomplete/haspopup while open. Its
 * first consumed arrow key moves real focus to the active option,
 * so the focus owner and option share this component's shadow tree.
 *
 * Integration contract (entirely the host's responsibility — this component
 * never inspects the text control's value or listens to it directly):
 * 1. Detect a mention/command trigger (e.g. `@`/`/` at the start of a word)
 *    in the host's own `input` handling.
 * 2. Set `anchor` (the `<textarea>`/`<input>` itself, or any element for
 *    plain whole-element anchoring — see "Positioning" below), `items`, and
 *    `query` (the text typed since the trigger character), then flip
 *    `open = true`.
 * 3. Forward every `keydown` the input receives, while `open`, through
 *    `handleKeyDown()` — it returns `true` when it consumed the key (so the
 *    host's own handler should stop, e.g. skip submitting the message on an
 *    Enter that actually picked a mention) and `false` otherwise.
 * 4. Set `open = false` whenever the query stops looking like an active
 *    mention context (a space typed, the trigger character deleted, or focus
 *    leaving both the input and this popover) — `lr-mention-close` fires
 *    automatically from that (see below), there is no separate "tell it to
 *    close" call needed.
 * 5. For a textarea anchor, the component temporarily sets only
 *    `aria-autocomplete="list"` and `aria-haspopup="listbox"`, restoring all authored ARIA/AOM
 *    values it changes on close, anchor replacement, disconnect, or adoption. Call
 *    `focusActiveOption()` after the first consumed navigation key. Pass an `ownsFocus` predicate
 *    if the host tracks a suggestion generation or disabled/focus-exit state; it must remain true
 *    while either the anchor or this popover owns that live session. A host blur handler must
 *    therefore keep the popover open when `relatedTarget` is this component.
 *
 * Positioning: when `anchor` is a plain `<textarea>` or single-line text
 * `<input>`, this component measures exactly where the caret currently
 * paints (`caretClientRect()`, the standard hidden-mirror-element technique
 * — see that function's own doc) and positions against that single point
 * with `internal/positioner.js`'s `place()`, so the popup tracks the caret
 * rather than sitting under the whole textarea. Any other `anchor` element
 * (or a text control this component fails to measure, e.g. one with
 * `display: none`) falls back to `place(anchor, popup)` against the whole
 * element — the same whole-element anchoring `<lr-combobox>`/
 * `<lr-select>` use for their own popups. Re-measures on every `anchor`/
 * `query` change while open (a keystroke moves the caret, so a fresh `query`
 * is the proxy for "the caret may have moved"); a caret that moves for a
 * reason other than typing (e.g. a mouse click elsewhere in the text while
 * the popover happens to still be open) is not separately tracked — the
 * host can force a re-measure by toggling `open` or reassigning `anchor`.
 *
 * Filtering happens internally against `items` (mirroring `<lr-combobox>`'s
 * filter-predicate convention via `filter`, rather than requiring the host to
 * pre-filter): candidate rows without a string `label` are omitted before any
 * predicate runs, and the default predicate is a case-insensitive substring
 * match against `label`/`description`, overridable via `filter`.
 *
 * There is no persisted "selection" the way a real listbox has one — a
 * mention is either committed (closing the popover) or the popover is
 * dismissed with nothing chosen — so `aria-selected="true"` marks whichever
 * row is currently *active* (what Enter/Tab would commit right now), per the
 * WAI-ARIA combobox-with-list-autocomplete pattern, rather than tracking a
 * separate persisted value the way `<lr-combobox>`'s own `aria-selected`
 * does.
 *
 * @example
 * ```html
 * <textarea id="composer"></textarea>
 * <lr-mention-popover id="mentions"></lr-mention-popover>
 * <script>
 *   const textarea = document.getElementById('composer');
 *   const popover = document.getElementById('mentions');
 *
 *   textarea.addEventListener('keydown', (e) => {
 *     if (popover.open && popover.handleKeyDown(e)) {
 *       if (e.key === 'ArrowUp' || e.key === 'ArrowDown') void popover.focusActiveOption();
 *       return; // consumed
 *     }
 *     // ...the host's own Enter-to-send handling, etc.
 *   });
 *   textarea.addEventListener('input', () => {
 *     // host's own '@'/'/' + query detection, then:
 *     popover.anchor = textarea;
 *     popover.items = candidates;
 *     popover.query = detectedQuery;
 *     popover.open = detectedQuery !== null;
 *   });
 *   textarea.addEventListener('blur', (event) => {
 *     if (event.relatedTarget !== popover) popover.open = false;
 *   });
 *
 *   popover.addEventListener('lr-mention-select', (e) => {
 *     // splice `${e.detail.label}` into the textarea at the trigger offset
 *   });
 * </script>
 * ```
 *
 * @customElement lr-mention-popover
 * @event lr-mention-select - An item was committed (Enter/Tab/click).
 *   `detail: { suggestionId, index, label }`; `index` disambiguates repeated business ids.
 * @event lr-mention-close - The popover was dismissed with no selection — Escape, or `open`
 * transitioning to `false` by any other means (a direct host assignment included). Never fires
 * for a close that followed a `lr-mention-select` commit.
 * @csspart listbox - The popover's root element (`role="listbox"`).
 * @csspart option - A candidate row (`role="option"`).
 * @csspart option-icon - A row's leading icon glyph, when `icon` is set.
 * @csspart option-label - Wrapper around a row's label/description.
 * @csspart option-description - A row's optional secondary line, when `description` is set.
 * @csspart empty - The "no matches" message, shown when `items`/`query` produce zero rows.
 * @cssprop [--lr-mention-popover-option-active-bg=var(--lr-color-brand-quiet)] - Background of the
 *   hovered or `[data-active]` (keyboard-highlighted) suggestion row.
 * @status stable
 * @since 4.0.0
 */
export class LyraMentionPopover extends LyraElement<LyraMentionPopoverEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    mentionResultCount: LYRA_DEFAULT_mentionResultCount,
    mentionResultPosition: LYRA_DEFAULT_mentionResultPosition,
    mentionSuggestions: LYRA_DEFAULT_mentionSuggestions,
    noMatches: LYRA_DEFAULT_noMatches,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  static override properties = {
    items: { attribute: false, noAccessor: true },
  };

  // This must initialize before reactive field initializers below: requestUpdate() is the
  // synchronous seam that invalidates a pending textarea focus transfer before Lit batches work.
  private _textareaFocusSessionGeneration = 0;

  override requestUpdate(
    name?: PropertyKey,
    oldValue?: unknown,
    options?: PropertyDeclaration,
  ): void {
    if (
      (name === 'open' || name === 'anchor' || name === 'query' || name === 'items' || name === 'filter') &&
      this.hasTextareaFocusSession()
    ) {
      this._textareaFocusSessionGeneration += 1;
    }
    super.requestUpdate(name, oldValue, options);
  }

  private hasTextareaFocusSession(): boolean {
    const relationshipControl = this.anchorRelationship?.control;
    return (
      (this.anchor !== undefined && isTextareaAnchor(this.anchor)) ||
      (relationshipControl !== undefined && isTextareaAnchor(relationshipControl))
    );
  }

  /** The element to position the popup relative to. When this is a plain
   *  `<textarea>`/single-line text `<input>`, positioning is caret-precise
   *  (see the class doc); any other element anchors the whole popup under
   *  that element's own box, the same as `<lr-combobox>`'s trigger. */
  @property({ attribute: false }) anchor?: HTMLElement;

  private _items: readonly Readonly<LyraMentionItem>[] = Object.freeze([]);

  /** The full candidate set, pre-`query`-filtering. Assignment takes a shallow frozen snapshot;
   *  malformed rows without a string `label` remain in that snapshot but are omitted from every
   *  filtered/rendered projection. */
  get items(): readonly Readonly<LyraMentionItem>[] {
    return this._items;
  }

  set items(next: readonly LyraMentionItem[]) {
    const previous = this._items;
    const source = Array.isArray(next) ? next : [];
    this._items = Object.freeze(source.map((item) => Object.freeze({ ...item })));
    this.requestUpdate('items', previous);
  }

  /** The text typed since the trigger character (`@`/`/`/…) — drives the
   *  built-in internal filtering (see `filter` to override it). */
  @property() query = '';

  /** Whether the popover is shown. */
  @property({ type: Boolean, reflect: true }) open = false;

  /** Overrides the built-in case-insensitive label/description substring match. */
  @property({ attribute: false }) filter: LyraMentionFilter | null = null;

  /** Message shown when `items` (post-`query`-filtering) is empty. `undefined` uses the localized
   * default; every supplied string, including `''` and `'No matches'`, is caller-owned. */
  @property({ attribute: 'empty-text' }) emptyText?: string;

  /** Accessible name for the `role="listbox"` popup. `undefined` uses the localized default;
   *  every supplied string, including `''` and `'Suggestions'`, is caller-owned. Also settable as
   *  a plain `aria-label` attribute on `<lr-mention-popover>` itself, which takes precedence over
   *  this property when present -- matches `<lr-combobox>`'s/`<lr-table>`'s identical host
   *  `aria-label` fallback. */
  @property() label?: string;

  // Highlighted row, opens pre-highlighted on the top match (index 0) so a
  // bare Enter right after opening commits immediately -- the same "first
  // result is pre-selected" UX every mainstream @-mention/slash-command
  // picker (Slack, GitHub, Notion, …) uses, unlike lr-combobox's own
  // listbox which opens with nothing highlighted (-1) since a combobox's
  // typed text can itself already equal a full, deliberately-typed value.
  @state() private activeIndex = 0;

  private readonly _listId = nextId('mention-popover-listbox');
  private cleanup?: DeferredOperationHandle;
  // A synthetic zero-size point element, positioned at the measured caret
  // rect and handed to place() in caret-precision mode -- place()/Floating
  // UI only understand a real HTMLElement anchor, so caret positioning goes
  // through this rather than a bespoke non-place()-based positioning path.
  private virtualAnchor: HTMLDivElement | null = null;
  private _isFirstUpdate = true;
  // Set by commit() immediately before it flips `open` false, so updated()'s
  // open-transition handling below (which otherwise fires lr-mention-close
  // on every true->false transition, matching lr-combobox's/lr-select's
  // identical lr-hide handling) can tell a successful-selection close
  // apart from every other close and skip the event for that one case.
  private _silentClose = false;
  // A textarea session always moves real focus onto its active option. That
  // keeps focus and the option in this component's shadow tree without
  // assigning a cross-root relationship to the native textarea.
  @state() private _ownsFocus = false;
  private _focusOwnerPredicate?: () => boolean;
  private _focusTransferGeneration = 0;
  private anchorRelationship?: AnchorRelationship;
  private announcementSink?: AnnouncementSink;
  private announcedResultCount?: string;
  private announcedResultPosition?: string;

  override connectedCallback(): void {
    super.connectedCallback();
    this.syncAnnouncementSink();
    this.announceResultState();
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this._isFirstUpdate = !this.hasUpdated;
    // Focus may have moved outside the input/popover composite since the previous update. Never
    // let a later candidate render reclaim it merely because this component used to own focus
    // within its popup.
    if (this._ownsFocus && !this.fallbackFocusIsStillOwned()) {
      this._ownsFocus = false;
      this._focusOwnerPredicate = undefined;
    }
    // A fresh query or candidate set re-highlights the top match, mirroring
    // how a filtering text field's own suggestion list re-anchors to the
    // first result on every keystroke rather than preserving a highlight
    // that may no longer even be in the filtered set.
    if (changed.has('query') || changed.has('items') || changed.has('filter')) this.activeIndex = 0;
    const candidatesChanged = changed.has('query') || changed.has('items') || changed.has('filter');
    if (this._ownsFocus && changed.has('open') && !this.open) {
      this.restoreAnchorFocus();
      this._ownsFocus = false;
      this._focusOwnerPredicate = undefined;
    } else if (
      this._ownsFocus &&
      this.open &&
      candidatesChanged &&
      this.filteredItems.length === 0
    ) {
      // Move focus before render removes the active option, and clear ownership in this same
      // pre-render pass so the empty listbox never commits a stale tabindex="0".
      if (this.anchor?.isConnected) this.restoreAnchorFocus();
      else this.renderRoot.querySelector<HTMLElement>('[part="listbox"]')?.focus({ preventScroll: true });
      this._ownsFocus = false;
      this._focusOwnerPredicate = undefined;
    }
    // Restoring an old textarea during updated() would assign the reactive
    // focus-owner state after Lit has rendered and schedule a redundant
    // follow-up update. Do it before the anchor replacement render instead.
    if (
      this._ownsFocus &&
      changed.has('anchor') &&
      this.anchorRelationship?.control !== this.anchor
    ) {
      this.detachAnchorRelationship();
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('open')) {
      if (this.open) {
        this.reposition();
      } else {
        this.cleanup?.();
        this.cleanup = undefined;
        this.virtualAnchor?.remove();
        // A close listener can synchronously author new textarea semantics and reopen. Restore
        // the old session before that listener runs, so the reopen snapshots those fresh values.
        const relationshipControl = this.anchorRelationship?.control;
        if (relationshipControl && isTextareaAnchor(relationshipControl)) {
          this.detachAnchorRelationship();
        }
        // Don't fire for markup that's simply rendering open="false" for the
        // first time, and don't fire for the commit() path (see
        // _silentClose's own doc above) -- every other true->false
        // transition (Escape, or a direct host assignment) does fire.
        // A close listener may synchronously reopen or rewrite the anchor; dispatching from
        // inside this update would make that a change-in-update. The microtask still runs
        // before `updateComplete` resolves, so hosts awaiting it observe the same ordering.
        if (!this._isFirstUpdate && !this._silentClose) {
          queueMicrotask(() => this.emit('lr-mention-close'));
        }
        this._silentClose = false;
      }
    } else if (this.open && (changed.has('anchor') || changed.has('query'))) {
      this.reposition();
    }
    // Keyed separately from the open/anchor/query branch above: a plain
    // ArrowDown/ArrowUp only ever changes activeIndex (see handleKeyDown), so
    // this must fire on its own rather than piggyback on a reposition. The
    // popup's own [part='listbox'] is height-capped and scrollable (see
    // mention-popover.styles.ts) -- without this, arrowing past its visible
    // rows would silently move the highlight off-screen. `block: 'nearest'`
    // makes this a no-op whenever the active row is already fully visible.
    if (changed.has('activeIndex') || changed.has('query') || changed.has('items') || changed.has('filter')) {
      const active = this.renderRoot.querySelector<HTMLElement>('[part="option"][data-active]');
      active?.scrollIntoView({ block: 'nearest' });
      if (this._ownsFocus) {
        if (!active && this.anchor?.isConnected) this.restoreFocus();
        else void this.restoreFocus(true);
      }
    }
    this.syncAnchorRelationship();
    if (!this.open) this.resetResultAnnouncements();
    // Inherited lang/locale and registered catalog updates arrive as unnamed
    // requestUpdate() calls. Reconcile on every open update, using the
    // formatted message cache below to avoid duplicate light-DOM announcements.
    else this.announceResultState();
  }

  override disconnectedCallback(): void {
    this._focusTransferGeneration += 1;
    this.resetResultAnnouncements();
    this.announcementSink?.release();
    this.announcementSink = undefined;
    if (this._ownsFocus && this.callFocusOwner(this._focusOwnerPredicate)) this.restoreAnchorFocus();
    this._ownsFocus = false;
    this._focusOwnerPredicate = undefined;
    this.detachAnchorRelationship();
    super.disconnectedCallback();
    this.cleanup?.();
    this.cleanup = undefined;
    this.virtualAnchor?.remove();
    // Reset so a reconnect (e.g. a drag-drop reparent of the composer, or a
    // virtualized/reordering message list moving this element) re-triggers
    // updated()'s open-driven branch -- without this, `open` stays `true`
    // across the disconnect/reconnect and changed.has('open') never fires
    // again, leaving the popup rendered open with no positioning and no live
    // scroll/resize tracking until the host happens to change `query`/
    // `anchor` on the next keystroke. Mirrors lr-select's/lr-combobox's
    // identical fix.
    this.open = false;
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this._focusTransferGeneration += 1;
    this.resetResultAnnouncements();
    this.syncAnnouncementSink();
    if (this._ownsFocus && this.callFocusOwner(this._focusOwnerPredicate)) this.restoreAnchorFocus();
    this._ownsFocus = false;
    this._focusOwnerPredicate = undefined;
    this.detachAnchorRelationship();
    this.open = false;
  }

  private syncAnnouncementSink(): void {
    if (this.announcementSink?.element?.ownerDocument === this.ownerDocument)
      return;
    this.announcementSink?.release();
    this.announcementSink = this.isConnected
      ? acquireAnnouncementSink('polite', {
          document: this.ownerDocument,
          source: this,
        })
      : undefined;
  }

  private resetResultAnnouncements(): void {
    this.announcedResultCount = undefined;
    this.announcedResultPosition = undefined;
  }

  private announceResultState(): void {
    if (!this.open || !this.announcementSink) return;
    const rows = this.filteredItems;
    const resultState = rows.length === 0
      ? this.localize('noMatches')
      : this.localize('mentionResultCount', undefined, { count: rows.length });
    const index = this.clampedIndex(rows);
    const position = index < 0
      ? undefined
      : this.localize('mentionResultPosition', undefined, {
          current: index + 1,
          total: rows.length,
        });
    // A picker supplied as initially-open markup must not announce its
    // mount state, but later inherited-context updates still need the same
    // cache to compare their localized output against.
    if (this._isFirstUpdate) {
      this.announcedResultCount = resultState;
      this.announcedResultPosition = position;
      return;
    }
    if (resultState !== this.announcedResultCount) {
      this.announcementSink.announce(resultState);
      this.announcedResultCount = resultState;
    }
    if (position === undefined) {
      this.announcedResultPosition = undefined;
      return;
    }
    if (position !== this.announcedResultPosition) {
      this.announcementSink.announce(position);
      this.announcedResultPosition = position;
    }
  }

  private snapshotAttribute(control: HTMLElement, name: string): AttributeSnapshot {
    return {
      present: control.hasAttribute(name),
      value: control.getAttribute(name),
    };
  }

  private restoreAttribute(control: HTMLElement, name: string, snapshot: AttributeSnapshot): void {
    if (snapshot.present) control.setAttribute(name, snapshot.value ?? '');
    else control.removeAttribute(name);
  }

  private captureAnchorCaret(relationship = this.anchorRelationship): void {
    if (!relationship || !isTextareaAnchor(relationship.control)) return;
    const { control } = relationship;
    relationship.selectionStart = control.selectionStart;
    relationship.selectionEnd = control.selectionEnd;
    relationship.selectionDirection = control.selectionDirection;
  }

  private restoreRelationshipFocus(relationship: AnchorRelationship): void {
    const { control } = relationship;
    if (!control.isConnected) return;
    try {
      control.focus({ preventScroll: true });
      if (
        isTextareaAnchor(control) &&
        relationship.selectionStart !== null &&
        relationship.selectionStart !== undefined &&
        relationship.selectionEnd !== null &&
        relationship.selectionEnd !== undefined
      ) {
        control.setSelectionRange(
          relationship.selectionStart,
          relationship.selectionEnd,
          relationship.selectionDirection ?? undefined,
        );
      }
    } catch {
      // A disconnected/adopted native control can reject focus or selection restoration.
    }
  }

  private restoreAnchorFocus(): void {
    const relationship = this.anchorRelationship;
    if (relationship) {
      this.restoreRelationshipFocus(relationship);
      return;
    }
    const anchor = this.anchor;
    if (anchor?.isConnected) {
      try {
        anchor.focus({ preventScroll: true });
      } catch {
        // The caller can replace or detach an anchor during a close callback.
      }
    }
  }

  private attachAnchorRelationship(control: TextControl): AnchorRelationship {
    const reflected = control as ReflectedAriaControl;
    const textarea = isTextareaAnchor(control);
    const attributes = new Map(
      (textarea
        ? [
            'role',
            'aria-expanded',
            'aria-haspopup',
            'aria-autocomplete',
            'aria-controls',
            'aria-activedescendant',
          ]
        : ['role', 'aria-expanded', 'aria-haspopup', 'aria-controls', 'aria-activedescendant']
      ).map((name) => [name, this.snapshotAttribute(control, name)]),
    );
    const activeElement = 'ariaActiveDescendantElement' in control
      ? reflected.ariaActiveDescendantElement ?? null
      : undefined;
    const controlsElements = 'ariaControlsElements' in control
      ? reflected.ariaControlsElements ?? null
      : undefined;
    const capturedTextareaActiveElement =
      textarea &&
      attributes.get('aria-activedescendant')?.present &&
      attributes.get('aria-activedescendant')?.value === ''
        ? activeElement ?? undefined
        : undefined;
    const capturedTextareaControlsElements =
      textarea &&
      attributes.get('aria-controls')?.present &&
      attributes.get('aria-controls')?.value === '' &&
      controlsElements?.length
        ? controlsElements
        : undefined;
    const relationship: AnchorRelationship = {
      control,
      attributes,
      // Textarea AOM setters serialize independently of the authored IDREF. Only a nonempty
      // element reference that originated from the native empty-attribute encoding is replayed;
      // nonempty/absent attributes retain their exact serialized author representation instead.
      activeElement: textarea ? capturedTextareaActiveElement : activeElement,
      controlsElements: textarea ? capturedTextareaControlsElements : controlsElements,
      selectionStart: textarea ? control.selectionStart : undefined,
      selectionEnd: textarea ? control.selectionEnd : undefined,
      selectionDirection: textarea ? control.selectionDirection : undefined,
    };
    this.anchorRelationship = relationship;
    return relationship;
  }

  private detachAnchorRelationship(): void {
    const relationship = this.anchorRelationship;
    if (!relationship) return;
    this.anchorRelationship = undefined;
    if (this._ownsFocus) {
      this.restoreRelationshipFocus(relationship);
      this._ownsFocus = false;
      this._focusOwnerPredicate = undefined;
    }
    const textarea = isTextareaAnchor(relationship.control);
    if (!textarea) {
      // Preserve the established single-line input route exactly.
      const reflected = relationship.control as ReflectedAriaControl;
      if (relationship.activeElement !== undefined) {
        try {
          reflected.ariaActiveDescendantElement = relationship.activeElement;
        } catch {
          // Attribute restoration below remains authoritative on partial AOM implementations.
        }
      }
      if (relationship.controlsElements !== undefined) {
        try {
          reflected.ariaControlsElements = relationship.controlsElements;
        } catch {
          // Attribute restoration below remains authoritative on partial AOM implementations.
        }
      }
      for (const [name, snapshot] of relationship.attributes) {
        this.restoreAttribute(relationship.control, name, snapshot);
      }
      return;
    }
    for (const [name, snapshot] of relationship.attributes) {
      this.restoreAttribute(relationship.control, name, snapshot);
    }
    // Native element-reference setters may serialize to idrefs. Restore those strings first:
    // replaying an authored empty idref afterwards would otherwise clear the AOM references.
    const reflected = relationship.control as ReflectedAriaControl;
    if (relationship.activeElement !== undefined) {
      try {
        reflected.ariaActiveDescendantElement = relationship.activeElement;
      } catch {
        // Plain-attribute restoration above remains authoritative on partial AOM implementations.
      }
    }
    if (relationship.controlsElements !== undefined) {
      try {
        reflected.ariaControlsElements = relationship.controlsElements;
      } catch {
        // Plain-attribute restoration above remains authoritative on partial AOM implementations.
      }
    }
  }

  private syncAnchorRelationship(): void {
    const next = this.open && this.anchor && isTextControl(this.anchor) ? this.anchor : undefined;
    if (this.anchorRelationship?.control !== next) this.detachAnchorRelationship();
    if (!next) return;
    const relationship = this.anchorRelationship ?? this.attachAnchorRelationship(next);
    const control = relationship.control;
    if (isTextareaAnchor(control)) {
      control.removeAttribute('role');
      control.removeAttribute('aria-expanded');
      control.removeAttribute('aria-controls');
      control.removeAttribute('aria-activedescendant');
      const reflected = control as ReflectedAriaControl;
      if (relationship.activeElement !== undefined) {
        try {
          reflected.ariaActiveDescendantElement = null;
        } catch {
          // The attribute removals remain authoritative on partial AOM implementations.
        }
      }
      if (relationship.controlsElements !== undefined) {
        try {
          reflected.ariaControlsElements = null;
        } catch {
          // The attribute removals remain authoritative on partial AOM implementations.
        }
      }
      // Some AOM implementations reflect setters back to string attributes;
      // remove them again so only the two temporary textarea semantics remain.
      control.removeAttribute('aria-controls');
      control.removeAttribute('aria-activedescendant');
      control.setAttribute('aria-haspopup', 'listbox');
      control.setAttribute('aria-autocomplete', 'list');
      return;
    }

    // Single-line inputs retain their established combobox path. The
    // textarea-specific real-focus design above deliberately does not alter it.
    if (!relationship.attributes.get('role')?.present) control.setAttribute('role', 'combobox');
    control.setAttribute('aria-expanded', 'true');
    control.setAttribute('aria-haspopup', 'listbox');

    const listbox = this.renderRoot.querySelector<HTMLElement>('[part="listbox"]');
    const reflected = control as ReflectedAriaControl;
    if (listbox && 'ariaControlsElements' in control) {
      try {
        control.removeAttribute('aria-controls');
        reflected.ariaControlsElements = [listbox];
        if (reflected.ariaControlsElements?.[0] !== listbox) {
          reflected.ariaControlsElements = [this];
          if (reflected.ariaControlsElements?.[0] !== this) control.removeAttribute('aria-controls');
        }
      } catch {
        control.removeAttribute('aria-controls');
      }
    } else {
      control.removeAttribute('aria-controls');
    }
    control.removeAttribute('aria-activedescendant');
    this.syncActiveDescendant(control);
  }

  /** The current candidate set: runtime rows without a string `label` are omitted, then the
   *  remaining `items` are filtered by `query` via `filter` (or the built-in default). */
  get filteredItems(): readonly Readonly<LyraMentionItem>[] {
    const locale = this.effectiveLocale;
    const q = this.query.trim().toLocaleLowerCase(locale);
    return this.items.filter((item) => {
      if (typeof item.label !== 'string') return false;
      if (!q) return true;
      if (this.filter) return this.filter(item, q);
      return item.label.toLocaleLowerCase(locale).includes(q) ||
        (typeof item.description === 'string' ? item.description : '')
          .toLocaleLowerCase(locale)
          .includes(q);
    });
  }

  /** The internal id of the currently highlighted row, for same-tree consumers only. */
  get activeDescendantId(): string | null {
    if (!this.open) return null;
    const idx = this.clampedIndex(this.filteredItems);
    return idx >= 0 ? this.rowId(idx) : null;
  }

  /** The currently highlighted shadow option. */
  get activeDescendantElement(): HTMLElement | null {
    const id = this.activeDescendantId;
    const escape = this.ownerDocument.defaultView?.CSS.escape;
    return id && escape ? this.renderRoot.querySelector<HTMLElement>(`#${escape(id)}`) : null;
  }

  /**
   * A textarea's active option always receives real focus; it does not use a
   * string IDREF or AOM element reflection. The established single-line input
   * route retains its existing element-reference behavior.
   */
  syncActiveDescendant(_control: HTMLElement): boolean {
    if (isTextareaAnchor(_control)) return false;
    _control.removeAttribute('aria-activedescendant');
    if (!('ariaActiveDescendantElement' in _control)) return false;
    const active = this.activeDescendantElement;
    try {
      const reflected = _control as ReflectedAriaControl & {
        ariaActiveDescendantElement: Element | null;
      };
      reflected.ariaActiveDescendantElement = active;
      const accepted = reflected.ariaActiveDescendantElement === active;
      if (!accepted) {
        reflected.ariaActiveDescendantElement = null;
        _control.removeAttribute('aria-activedescendant');
      }
      return accepted;
    } catch {
      _control.removeAttribute('aria-activedescendant');
      return false;
    }
  }

  /**
   * Moves real focus to the active option and returns whether it succeeded. `options.ownsFocus`, when given,
   * is checked before and immediately after the awaited render, then retained while the popover
   * owns navigation. A close, candidate/query/filter/anchor change, disconnect/adoption, newer
   * transfer, or failed ownership check makes the pending transfer resolve `false` without moving
   * focus. Once active, the popover handles its own navigation keys and restores focus to `anchor`
   * when it closes.
   */
  async focusActiveOption(options: LyraMentionFocusOptions = {}): Promise<boolean> {
    const ownsFocus = options.ownsFocus ?? (this._ownsFocus ? this._focusOwnerPredicate : undefined);
    if (!this.open || !this.isConnected || !this.activeDescendantElement || !this.callFocusOwner(ownsFocus)) {
      return false;
    }
    const generation = ++this._focusTransferGeneration;
    const textareaSession = this.anchor !== undefined && isTextareaAnchor(this.anchor);
    const textareaSessionGeneration = this._textareaFocusSessionGeneration;
    const snapshot = {
      ownerDocument: this.ownerDocument,
      anchor: this.anchor,
      items: this.items,
      query: this.query,
      filter: this.filter,
      activeIndex: this.activeIndex,
    };
    await this.updateComplete;

    if ((await this.cleanup?.ready) === false) {
      return false;
    }

    if (
      generation !== this._focusTransferGeneration ||
      (textareaSession && textareaSessionGeneration !== this._textareaFocusSessionGeneration) ||
      !this.isConnected ||
      !this.open ||
      this.ownerDocument !== snapshot.ownerDocument ||
      this.anchor !== snapshot.anchor ||
      this.items !== snapshot.items ||
      this.query !== snapshot.query ||
      this.filter !== snapshot.filter ||
      this.activeIndex !== snapshot.activeIndex ||
      !this.callFocusOwner(ownsFocus)
    ) {
      return false;
    }
    const active = this.activeDescendantElement;
    if (!active?.isConnected || !this.callFocusOwner(ownsFocus)) return false;
    this.captureAnchorCaret();
    active.focus({ preventScroll: true });
    if (activeElementIn(this.shadowRoot) !== active) return false;
    this._focusOwnerPredicate = ownsFocus;
    this._ownsFocus = true;
    return true;
  }

  private async restoreFocus(waitForPlacement = false): Promise<void> {
    if (waitForPlacement) {
      if ((await this.cleanup?.ready) === false || !this._ownsFocus || !this.open) return;
      // Placement is asynchronous. Do not reclaim a real textarea session after focus has
      // already moved elsewhere while geometry was resolving.
      if (this.hasTextareaFocusSession() && !this.fallbackFocusIsStillOwned()) {
        this._ownsFocus = false;
        this._focusOwnerPredicate = undefined;
        return;
      }
    }
    const active = this.renderRoot.querySelector<HTMLElement>('[part="option"][data-active]');
    if (active) {
      active.focus({ preventScroll: true });
    } else if (this.anchor?.isConnected) {
      this.renderRoot.querySelector<HTMLElement>('[part="listbox"]')?.setAttribute('tabindex', '-1');
      this.restoreAnchorFocus();
      this.scheduleAfterUpdate(() => {
        this._ownsFocus = false;
        this._focusOwnerPredicate = undefined;
      });
    } else {
      this.renderRoot.querySelector<HTMLElement>('[part="listbox"]')?.focus({ preventScroll: true });
    }
  }

  private callFocusOwner(predicate: (() => boolean) | undefined): boolean {
    try {
      return predicate?.() ?? true;
    } catch {
      return false;
    }
  }

  private fallbackFocusIsStillOwned(): boolean {
    return this.callFocusOwner(this._focusOwnerPredicate) && activeElementIn(this.shadowRoot) !== null;
  }

  /** The internal `id` of the `role="listbox"` popup. Like
   *  `activeDescendantId`, it cannot form a cross-shadow string IDREF from a
   *  host-owned input. */
  get listboxId(): string {
    return this._listId;
  }

  /**
   * The host's own text-control keydown handler calls this while the
   * popover is open. Returns `true` when the key was intercepted
   * (`preventDefault()` already called) and the host should not also act on
   * it; `false` when the host's normal handling should proceed untouched --
   * including ArrowDown/ArrowUp/Enter/Tab when there are zero filtered rows
   * to act on, so e.g. the host's own textarea still moves its caret a line
   * normally rather than having the keystroke silently eaten.
   */
  handleKeyDown(e: KeyboardEvent): boolean {
    if (!this.open) return false;
    const rows = this.filteredItems;
    switch (e.key) {
      case 'ArrowDown':
        // Nothing to navigate -- let the key fall through to the host's own
        // control (e.g. move the caret to the next line), matching Enter/Tab's
        // identical "no active row" fallthrough right below.
        if (!rows.length) return false;
        e.preventDefault();
        this.activeIndex = Math.min(rows.length - 1, this.clampedIndex(rows) + 1);
        return true;
      case 'ArrowUp':
        if (!rows.length) return false;
        e.preventDefault();
        this.activeIndex = Math.max(0, this.clampedIndex(rows) - 1);
        return true;
      case 'Enter':
      case 'Tab': {
        const idx = this.clampedIndex(rows);
        // Nothing to commit -- let Enter submit / Tab move focus normally,
        // matching a native combobox with no highlighted suggestion.
        if (idx < 0) return false;
        e.preventDefault();
        this.commit(rows[idx]!); // safe: idx >= 0 here is clampedIndex()'s in-range result
        return true;
      }
      case 'Escape':
        e.preventDefault();
        this.open = false;
        return true;
      default:
        return false;
    }
  }

  private clampedIndex(rows: readonly Readonly<LyraMentionItem>[]): number {
    if (!rows.length) return -1;
    return Math.min(Math.max(this.activeIndex, 0), rows.length - 1);
  }

  private rowId(index: number): string {
    return `${this._listId}-opt-${index}`;
  }

  private commit(item: Readonly<LyraMentionItem>): void {
    const index = this.items.indexOf(item);
    if (index < 0) return;
    const relationshipControl = this.anchorRelationship?.control;
    if (relationshipControl && isTextareaAnchor(relationshipControl)) {
      // A select listener may synchronously author textarea semantics. Restore the opening
      // snapshot (and its focus/caret) before it runs so the silent close cannot overwrite
      // listener-owned values. The established single-line route remains unchanged.
      this.detachAnchorRelationship();
    }
    this.emit(
      'lr-mention-select',
      Object.freeze({ suggestionId: item.suggestionId, index, label: item.label }),
    );
    this._silentClose = true;
    this.open = false;
  }

  private reposition(): void {
    this.cleanup?.();
    this.cleanup = undefined;
    const anchorEl = this.resolveAnchorElement();
    const popup = this.renderRoot.querySelector('[part="listbox"]') as HTMLElement | null;
    if (anchorEl && popup) {
      const placement = place(anchorEl, popup, { placement: 'bottom-start' });
      this.cleanup = placement;
      void placement.ready.then((positioned) => {
        if (positioned || this.cleanup !== placement || !this.open) return;
        this._silentClose = true;
        this.open = false;
      });
    }
  }

  /** Resolves what to actually hand `place()` -- a caret-precise virtual
   *  point for a measurable text control, `anchor` itself otherwise. See the
   *  class doc's "Positioning" section. */
  private resolveAnchorElement(): HTMLElement | null {
    const anchor = this.anchor;
    if (!anchor) return null;
    if (isTextControl(anchor)) {
      const rect = caretClientRect(anchor);
      if (rect) {
        const owner = anchor.ownerDocument;
        if (this.virtualAnchor && this.virtualAnchor.ownerDocument !== owner) {
          this.virtualAnchor.remove();
          this.virtualAnchor = null;
        }
        const virtual = this.virtualAnchor ?? (this.virtualAnchor = owner.createElement('div'));
        virtual.style.position = 'fixed';
        virtual.style.left = `${rect.left}px`;
        virtual.style.top = `${rect.top}px`;
        virtual.style.width = '0';
        virtual.style.height = `${rect.height}px`;
        virtual.style.pointerEvents = 'none';
        if (!virtual.isConnected) owner.body.appendChild(virtual);
        return virtual;
      }
    }
    return anchor;
  }

  // Delegated onto [part="listbox"] rather than one closure pair allocated
  // per row per render -- same pattern as lr-combobox's/lr-select's
  // identical onListboxMouseDown/onListboxClick.
  private onListboxMouseDown = (e: MouseEvent): void => {
    // Focus must never leave the host's own text control -- preventing the
    // default here is what stops a plain (non-focusable) row click from
    // blurring it.
    if ((e.target as HTMLElement).closest('[part="option"]')) e.preventDefault();
  };

  private onListboxClick = (e: MouseEvent): void => {
    const optionEl = (e.target as HTMLElement).closest('[part="option"]') as HTMLElement | null;
    const index = Number(optionEl?.dataset['index']);
    if (!Number.isInteger(index) || index < 0) return;
    const item = this.filteredItems[index];
    if (item) this.commit(item);
  };

  private onListboxKeyDown = (e: KeyboardEvent): void => {
    if (e.defaultPrevented || !this._ownsFocus) return;
    if (this.handleKeyDown(e) && this.open) void this.focusActiveOption();
  };

  /** Resolves `emptyText`'s effective text: an explicit override wins verbatim; left at the
   *  built-in default it instead routes through `this.localize()` so a locale/`.strings`
   *  override applies without requiring `emptyText` itself to be set. */
  private get effectiveEmptyText(): string {
    return this.emptyText === undefined ? this.localize('noMatches') : this.emptyText;
  }

  /** Resolves `label`'s effective text: a host-level plain `aria-label` attribute on
   *  `<lr-mention-popover>` itself wins first (checked via a plain `getAttribute()` read, not a
   *  reactive property, matching `<lr-combobox>`'s/`<lr-table>`'s identical fallback); failing
   *  that, an explicit `label` override wins verbatim; left at the built-in default it instead
   *  routes through `this.localize()` so a locale/`.strings` override applies without requiring
   *  `label` itself to be set. */
  private get effectiveLabel(): string {
    return (
      hostAriaLabel(this) ?? (this.label === undefined ? this.localize('mentionSuggestions') : this.label)
    );
  }

  private renderRow(item: Readonly<LyraMentionItem>, index: number, activeId: string): TemplateResult {
    const id = this.rowId(index);
    const active = id === activeId;
    return html`
      <div
        part="option"
        id=${id}
        role="option"
        data-id=${item.suggestionId}
        data-index=${index}
        aria-selected=${active ? 'true' : 'false'}
        tabindex=${this._ownsFocus && active ? '0' : '-1'}
        ?data-active=${active}
      >
        ${item.icon ? html`<span part="option-icon" aria-hidden="true">${item.icon}</span>` : nothing}
        <span part="option-label">
          <span>${item.label}</span>
          ${item.description ? html`<span part="option-description">${item.description}</span>` : nothing}
        </span>
      </div>
    `;
  }

  override render(): TemplateResult {
    const rows = this.filteredItems;
    const idx = this.clampedIndex(rows);
    const activeId = idx >= 0 ? this.rowId(idx) : '';

    return html`
      <div
        part="listbox"
        id=${this._listId}
        role="listbox"
        tabindex=${this._ownsFocus && rows.length === 0 ? '0' : '-1'}
        aria-label=${this.effectiveLabel}
        @mousedown=${this.onListboxMouseDown}
        @click=${this.onListboxClick}
        @keydown=${this.onListboxKeyDown}
      >
        ${rows.length === 0
          ? html`<div part="empty" role="option" aria-selected="false" aria-disabled="true">${this.effectiveEmptyText}</div>`
          : rows.map((item, i) => this.renderRow(item, i, activeId))}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-mention-popover': LyraMentionPopover;
  }
}

import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { place } from '../../../internal/positioner.js';
import { nextId } from '../../../internal/a11y.js';
import { styles } from './mention-popover.styles.js';

/** One candidate row — an `@`-mentionable person/entity, or a `/`-command. */
export interface MentionItem {
  id: string;
  label: string;
  description?: string;
  /** Literal icon hint (e.g. an emoji), rendered next to `label` -- same
   *  "opaque string, not a registry lookup" convention as
   *  `<lr-tool-call-chip>`'s/`<lr-tool-select-dialog>`'s own `icon`. */
  icon?: string;
}

/** Predicate deciding whether `item` matches a (already-trimmed, locale-lowercased) `query`.
 *  Mirrors `<lr-combobox>`'s `OptionFilter` convention -- override `filter` to replace the
 *  built-in case-insensitive label/description substring match entirely. */
export type MentionFilter = (item: MentionItem, query: string) => boolean;

export interface MentionSelectDetail {
  id: string;
  label: string;
}

type TextControl = HTMLTextAreaElement | HTMLInputElement;

function isTextControl(el: Element): el is TextControl {
  if (el instanceof HTMLTextAreaElement) return true;
  return el instanceof HTMLInputElement && (el.type === 'text' || el.type === 'search');
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
  const elRect = el.getBoundingClientRect();
  if (elRect.width === 0 || elRect.height === 0) return null;

  const computed = window.getComputedStyle(el);
  const mirror = document.createElement('div');
  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.top = '0';
  mirror.style.left = '-9999px';
  // <textarea> soft-wraps; a single-line <input> never does -- mismatching
  // this makes the mirror wrap where the real control wouldn't (or vice
  // versa), throwing off every offset past the first line/character run.
  mirror.style.whiteSpace = el instanceof HTMLTextAreaElement ? 'pre-wrap' : 'pre';
  mirror.style.overflowWrap = 'break-word';
  for (const prop of MIRROR_CSS_PROPS) {
    mirror.style.setProperty(prop, computed.getPropertyValue(prop));
  }

  const index = el.selectionStart ?? el.value.length;
  mirror.append(document.createTextNode(el.value.slice(0, index)));
  const marker = document.createElement('span');
  // A marker with no content at all collapses to zero width -- a hair of
  // content keeps it reliably measurable even for a caret sitting at the
  // very end of the value.
  marker.textContent = el.value.slice(index) || '​';
  mirror.appendChild(marker);
  document.body.appendChild(mirror);

  const mirrorRect = mirror.getBoundingClientRect();
  const markerRect = marker.getBoundingClientRect();
  mirror.remove();

  const lineHeight = parseFloat(computed.lineHeight) || markerRect.height || 16;
  return new DOMRect(
    elRect.left + (markerRect.left - mirrorRect.left) - el.scrollLeft,
    elRect.top + (markerRect.top - mirrorRect.top) - el.scrollTop,
    1,
    lineHeight,
  );
}

export interface LyraMentionPopoverEventMap {
  'lr-mention-select': CustomEvent<MentionSelectDetail>;
  'lr-mention-close': CustomEvent<undefined>;
}
/**
 * `<lr-mention-popover>` — a caret-anchored, keyboard-navigable popover for
 * `@`-mention and `/`-slash-command autocomplete inside a plain-text
 * `<textarea>`/`<input>` the host owns (e.g. `<lr-chat-composer>`'s own
 * textarea, though this component has no dependency on that or any other
 * specific input). On platforms that support cross-root ARIA element
 * reflection, focus stays in the host input while
 * `ariaActiveDescendantElement` conveys the active row. Where the platform
 * rejects that reference, the explicit `focusActiveOption()` fallback moves
 * real focus into this component's shadow listbox so focus ownership and
 * options share one tree scope. A string `aria-activedescendant` cannot
 * resolve from the host document into this component's shadow root.
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
 *    mention context (a space typed, the trigger character deleted, the
 *    input blurred, …) — `lr-mention-close` fires automatically from that
 *    (see below), there is no separate "tell it to close" call needed.
 * 5. Call `syncActiveDescendant()` after opening and after every consumed
 *    navigation key. It uses cross-root ARIA element reflection where the
 *    platform supports it and never installs a broken string IDREF. When it
 *    returns `false`, call `focusActiveOption()` after the first consumed
 *    navigation key. That fallback moves real focus into the shadow listbox,
 *    where each option and its focus owner share one tree scope; subsequent
 *    navigation is handled by the popover and focus returns to `anchor` when
 *    it closes.
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
 * pre-filter): the default predicate is a case-insensitive substring match
 * against `label`/`description`, overridable via `filter`.
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
 *     if (popover.open && popover.handleKeyDown(e)) return; // consumed
 *     // ...the host's own Enter-to-send handling, etc.
 *   });
 *   textarea.addEventListener('input', () => {
 *     // host's own '@'/'/' + query detection, then:
 *     popover.anchor = textarea;
 *     popover.items = candidates;
 *     popover.query = detectedQuery;
 *     popover.open = detectedQuery !== null;
 *   });
 *   textarea.addEventListener('blur', () => (popover.open = false));
 *
 *   popover.addEventListener('lr-mention-select', (e) => {
 *     // splice `${e.detail.label}` into the textarea at the trigger offset
 *   });
 *   popover.addEventListener('lr-mention-close', () => {
 *     popover.syncActiveDescendant(textarea);
 *   });
 *
 *   // Whenever the popover re-renders its active row (e.g. after every
 *   // ArrowUp/ArrowDown handleKeyDown() call above), sync the host's own
 *   // input so assistive tech announces the current candidate:
 *   const syncActiveDescendant = () => {
 *     popover.syncActiveDescendant(textarea);
 *   };
 * </script>
 * ```
 *
 * @customElement lr-mention-popover
 * @event lr-mention-select - An item was committed (Enter/Tab/click). `detail: { id, label }`.
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
 */
export class LyraMentionPopover extends LyraElement<LyraMentionPopoverEventMap> {
  static override styles = [LyraElement.styles, styles];

  /** The element to position the popup relative to. When this is a plain
   *  `<textarea>`/single-line text `<input>`, positioning is caret-precise
   *  (see the class doc); any other element anchors the whole popup under
   *  that element's own box, the same as `<lr-combobox>`'s trigger. */
  @property({ attribute: false }) anchor?: HTMLElement;

  /** The full candidate set, pre-`query`-filtering. */
  @property({ attribute: false }) items: MentionItem[] = [];

  /** The text typed since the trigger character (`@`/`/`/…) — drives the
   *  built-in internal filtering (see `filter` to override it). */
  @property() query = '';

  /** Whether the popover is shown. */
  @property({ type: Boolean, reflect: true }) open = false;

  /** Overrides the built-in case-insensitive label/description substring match. */
  @property({ attribute: false }) filter: MentionFilter | null = null;

  /** Message shown when `items` (post-`query`-filtering) is empty. */
  @property({ attribute: 'empty-text' }) emptyText = 'No matches';

  /** Accessible name for the `role="listbox"` popup. Also settable as a plain `aria-label`
   *  attribute on `<lr-mention-popover>` itself, which takes precedence over this property when
   *  present -- matches `<lr-combobox>`'s/`<lr-table>`'s identical host `aria-label` fallback. */
  @property() label = 'Suggestions';

  // Highlighted row, opens pre-highlighted on the top match (index 0) so a
  // bare Enter right after opening commits immediately -- the same "first
  // result is pre-selected" UX every mainstream @-mention/slash-command
  // picker (Slack, GitHub, Notion, …) uses, unlike lr-combobox's own
  // listbox which opens with nothing highlighted (-1) since a combobox's
  // typed text can itself already equal a full, deliberately-typed value.
  @state() private activeIndex = 0;

  private readonly _listboxId = nextId('mention-popover-listbox');
  private cleanup?: () => void;
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
  private _suppressCloseEvent = false;
  // Cross-root ARIA element reflection is not implemented consistently by
  // browsers. When a host explicitly chooses the documented fallback, real
  // focus moves onto the active option so ownership and option share this
  // shadow tree instead of publishing an unresolvable string IDREF.
  private _ownsFocus = false;

  protected override willUpdate(changed: PropertyValues): void {
    this._isFirstUpdate = !this.hasUpdated;
    // A fresh query or candidate set re-highlights the top match, mirroring
    // how a filtering text field's own suggestion list re-anchors to the
    // first result on every keystroke rather than preserving a highlight
    // that may no longer even be in the filtered set.
    if (changed.has('query') || changed.has('items')) this.activeIndex = 0;
  }

  protected override updated(changed: PropertyValues): void {
    if (changed.has('open')) {
      if (this.open) {
        this.reposition();
      } else {
        this.cleanup?.();
        this.cleanup = undefined;
        this.virtualAnchor?.remove();
        if (this._ownsFocus) {
          this._ownsFocus = false;
          if (this.anchor?.isConnected) this.anchor.focus({ preventScroll: true });
        }
        // Don't fire for markup that's simply rendering open="false" for the
        // first time, and don't fire for the commit() path (see
        // _suppressCloseEvent's own doc above) -- every other true->false
        // transition (Escape, or a direct host assignment) does fire.
        if (!this._isFirstUpdate && !this._suppressCloseEvent) this.emit('lr-mention-close');
        this._suppressCloseEvent = false;
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
    if (changed.has('activeIndex') || changed.has('query') || changed.has('items')) {
      const active = this.renderRoot.querySelector<HTMLElement>('[part="option"][data-active]');
      active?.scrollIntoView({ block: 'nearest' });
      if (this._ownsFocus) {
        if (active) {
          active.focus({ preventScroll: true });
        } else if (this.anchor?.isConnected) {
          this._ownsFocus = false;
          this.anchor.focus({ preventScroll: true });
        } else {
          this.renderRoot.querySelector<HTMLElement>('[part="listbox"]')?.focus({
            preventScroll: true,
          });
        }
      }
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.cleanup?.();
    this.cleanup = undefined;
    this.virtualAnchor?.remove();
    this._ownsFocus = false;
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

  /** The current candidate set: `items` filtered by `query` via `filter`
   *  (or the built-in default). Empty `query` returns `items` unfiltered. */
  get filteredItems(): MentionItem[] {
    const locale = this.effectiveLocale;
    const q = this.query.trim().toLocaleLowerCase(locale);
    if (!q) return this.items;
    if (this.filter) return this.items.filter((item) => this.filter!(item, q));
    return this.items.filter(
      (item) =>
        item.label.toLocaleLowerCase(locale).includes(q) ||
        (item.description ?? '').toLocaleLowerCase(locale).includes(q),
    );
  }

  /** The internal `id` of the currently-highlighted row. This remains useful
   *  for diagnostics and same-tree consumers, but must not be assigned as a
   *  string `aria-activedescendant` from outside this shadow root. Use
   *  `activeDescendantElement` or `syncActiveDescendant()` instead. */
  get activeDescendantId(): string | null {
    if (!this.open) return null;
    const idx = this.clampedIndex(this.filteredItems);
    return idx >= 0 ? this.rowId(idx) : null;
  }

  /** The currently-highlighted shadow option for ARIA element reflection. */
  get activeDescendantElement(): HTMLElement | null {
    const id = this.activeDescendantId;
    return id ? this.renderRoot.querySelector<HTMLElement>(`#${CSS.escape(id)}`) : null;
  }

  /**
   * Synchronizes a host-owned control with the active option through the
   * platform's element-reference ARIA API. Returns `false` when that API is
   * unavailable or rejects a cross-root reference; in that case the host
   * must use a listbox/focus owner in the control's own tree scope.
   */
  syncActiveDescendant(control: HTMLElement): boolean {
    control.removeAttribute('aria-activedescendant');
    if (!('ariaActiveDescendantElement' in control)) return false;
    const active = this.activeDescendantElement;
    try {
      const reflected = control as HTMLElement & { ariaActiveDescendantElement: Element | null };
      reflected.ariaActiveDescendantElement = active;
      const accepted = reflected.ariaActiveDescendantElement === active;
      if (!accepted) {
        reflected.ariaActiveDescendantElement = null;
        control.removeAttribute('aria-activedescendant');
      }
      return accepted;
    } catch {
      control.removeAttribute('aria-activedescendant');
      return false;
    }
  }

  /**
   * Same-tree fallback for platforms that reject cross-shadow ARIA element
   * reflection. Moves real focus to the active option and returns whether it
   * succeeded. Once active, the popover handles its own navigation keys and
   * restores focus to `anchor` when it closes.
   */
  async focusActiveOption(): Promise<boolean> {
    if (!this.open || !this.activeDescendantElement) return false;
    this._ownsFocus = true;
    this.requestUpdate();
    await this.updateComplete;
    const active = this.activeDescendantElement;
    active?.focus({ preventScroll: true });
    return this.shadowRoot?.activeElement === active;
  }

  /** The internal `id` of the `role="listbox"` popup. Like
   *  `activeDescendantId`, it cannot form a cross-shadow string IDREF from a
   *  host-owned input. */
  get listboxId(): string {
    return this._listboxId;
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

  private clampedIndex(rows: MentionItem[]): number {
    if (!rows.length) return -1;
    return Math.min(Math.max(this.activeIndex, 0), rows.length - 1);
  }

  private rowId(index: number): string {
    return `${this._listboxId}-opt-${index}`;
  }

  private commit(item: MentionItem): void {
    this.emit<MentionSelectDetail>('lr-mention-select', { id: item.id, label: item.label });
    this._suppressCloseEvent = true;
    this.open = false;
  }

  private reposition(): void {
    this.cleanup?.();
    this.cleanup = undefined;
    const anchorEl = this.resolveAnchorElement();
    const popup = this.renderRoot.querySelector('[part="listbox"]') as HTMLElement | null;
    if (anchorEl && popup) this.cleanup = place(anchorEl, popup, { placement: 'bottom-start' });
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
        const virtual = this.virtualAnchor ?? (this.virtualAnchor = document.createElement('div'));
        virtual.style.position = 'fixed';
        virtual.style.left = `${rect.left}px`;
        virtual.style.top = `${rect.top}px`;
        virtual.style.width = '0';
        virtual.style.height = `${rect.height}px`;
        virtual.style.pointerEvents = 'none';
        if (!virtual.isConnected) document.body.appendChild(virtual);
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
    const id = optionEl?.dataset['id'];
    if (id === undefined) return;
    const item = this.filteredItems.find((i) => i.id === id);
    if (item) this.commit(item);
  };

  private onListboxKeyDown = (e: KeyboardEvent): void => {
    if (!this._ownsFocus) return;
    if (this.handleKeyDown(e) && this.open) void this.focusActiveOption();
  };

  /** Resolves `emptyText`'s effective text: an explicit override wins verbatim; left at the
   *  built-in default it instead routes through `this.localize()` so a locale/`.strings`
   *  override applies without requiring `emptyText` itself to be set. */
  private get effectiveEmptyText(): string {
    return this.localize('noMatches', this.emptyText === 'No matches' ? undefined : this.emptyText);
  }

  /** Resolves `label`'s effective text: a host-level plain `aria-label` attribute on
   *  `<lr-mention-popover>` itself wins first (checked via a plain `getAttribute()` read, not a
   *  reactive property, matching `<lr-combobox>`'s/`<lr-table>`'s identical fallback); failing
   *  that, an explicit `label` override wins verbatim; left at the built-in default it instead
   *  routes through `this.localize()` so a locale/`.strings` override applies without requiring
   *  `label` itself to be set. */
  private get effectiveLabel(): string {
    return (
      this.getAttribute('aria-label') ||
      this.localize('mentionSuggestions', this.label === 'Suggestions' ? undefined : this.label)
    );
  }

  private renderRow(item: MentionItem, index: number, activeId: string): TemplateResult {
    const id = this.rowId(index);
    const active = id === activeId;
    return html`
      <div
        part="option"
        id=${id}
        role="option"
        data-id=${item.id}
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
        id=${this._listboxId}
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

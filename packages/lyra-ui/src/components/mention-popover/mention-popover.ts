import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { place } from '../../internal/positioner.js';
import { nextId } from '../../internal/a11y.js';
import { styles } from './mention-popover.styles.js';

/** One candidate row — an `@`-mentionable person/entity, or a `/`-command. */
export interface MentionItem {
  id: string;
  label: string;
  description?: string;
  /** Literal icon hint (e.g. an emoji), rendered next to `label` -- same
   *  "opaque string, not a registry lookup" convention as
   *  `<lyra-tool-call-chip>`'s/`<lyra-tool-select-dialog>`'s own `icon`. */
  icon?: string;
}

/** Predicate deciding whether `item` matches a (already-trimmed, already-lowercased) `query`.
 *  Mirrors `<lyra-combobox>`'s `OptionFilter` convention -- override `filter` to replace the
 *  built-in case-insensitive label/description substring match entirely. */
export type MentionFilter = (item: MentionItem, query: string) => boolean;

export interface MentionSelectDetail {
  id: string;
  label: string;
}

function defaultFilter(item: MentionItem, query: string): boolean {
  return item.label.toLowerCase().includes(query) || (item.description ?? '').toLowerCase().includes(query);
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

/**
 * `<lyra-mention-popover>` — a caret-anchored, keyboard-navigable popover for
 * `@`-mention and `/`-slash-command autocomplete inside a plain-text
 * `<textarea>`/`<input>` the host owns (e.g. `<lyra-chat-composer>`'s own
 * textarea, though this component has no dependency on that or any other
 * specific input). It never takes DOM focus itself — the same "focus stays
 * put, `aria-activedescendant` conveys the active row" pattern
 * `<lyra-select>`/`<lyra-combobox>` use for their own listbox — so a host
 * must apply `aria-activedescendant` to its *own* input element, pointing at
 * whatever `activeDescendantId` currently returns.
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
 *    input blurred, …) — `lyra-mention-close` fires automatically from that
 *    (see below), there is no separate "tell it to close" call needed.
 * 5. Keep the host's own input's `aria-activedescendant` (and, optionally,
 *    `aria-controls`, via `listboxId`) in sync with `activeDescendantId` —
 *    this component has no DOM of the host's to attach that to itself.
 *
 * Positioning: when `anchor` is a plain `<textarea>` or single-line text
 * `<input>`, this component measures exactly where the caret currently
 * paints (`caretClientRect()`, the standard hidden-mirror-element technique
 * — see that function's own doc) and positions against that single point
 * with `internal/positioner.js`'s `place()`, so the popup tracks the caret
 * rather than sitting under the whole textarea. Any other `anchor` element
 * (or a text control this component fails to measure, e.g. one with
 * `display: none`) falls back to `place(anchor, popup)` against the whole
 * element — the same whole-element anchoring `<lyra-combobox>`/
 * `<lyra-select>` use for their own popups. Re-measures on every `anchor`/
 * `query` change while open (a keystroke moves the caret, so a fresh `query`
 * is the proxy for "the caret may have moved"); a caret that moves for a
 * reason other than typing (e.g. a mouse click elsewhere in the text while
 * the popover happens to still be open) is not separately tracked — the
 * host can force a re-measure by toggling `open` or reassigning `anchor`.
 *
 * Filtering happens internally against `items` (mirroring `<lyra-combobox>`'s
 * filter-predicate convention via `filter`, rather than requiring the host to
 * pre-filter): the default predicate is a case-insensitive substring match
 * against `label`/`description`, overridable via `filter`.
 *
 * There is no persisted "selection" the way a real listbox has one — a
 * mention is either committed (closing the popover) or the popover is
 * dismissed with nothing chosen — so `aria-selected="true"` marks whichever
 * row is currently *active* (what Enter/Tab would commit right now), per the
 * WAI-ARIA combobox-with-list-autocomplete pattern, rather than tracking a
 * separate persisted value the way `<lyra-combobox>`'s own `aria-selected`
 * does.
 *
 * @example
 * ```html
 * <textarea id="composer"></textarea>
 * <lyra-mention-popover id="mentions"></lyra-mention-popover>
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
 *   popover.addEventListener('lyra-mention-select', (e) => {
 *     // splice `${e.detail.label}` into the textarea at the trigger offset
 *   });
 *   popover.addEventListener('lyra-mention-close', () => {
 *     textarea.removeAttribute('aria-activedescendant');
 *   });
 *
 *   // Whenever the popover re-renders its active row (e.g. after every
 *   // ArrowUp/ArrowDown handleKeyDown() call above), sync the host's own
 *   // input so assistive tech announces the current candidate:
 *   const syncActiveDescendant = () => {
 *     if (popover.open && popover.activeDescendantId) {
 *       textarea.setAttribute('aria-activedescendant', popover.activeDescendantId);
 *     } else {
 *       textarea.removeAttribute('aria-activedescendant');
 *     }
 *   };
 * </script>
 * ```
 *
 * @customElement lyra-mention-popover
 * @event lyra-mention-select - An item was committed (Enter/Tab/click). `detail: { id, label }`.
 * @event lyra-mention-close - The popover was dismissed with no selection — Escape, or `open`
 * transitioning to `false` by any other means (a direct host assignment included). Never fires
 * for a close that followed a `lyra-mention-select` commit.
 * @csspart listbox - The popover's root element (`role="listbox"`).
 * @csspart option - A candidate row (`role="option"`).
 * @csspart option-icon - A row's leading icon glyph, when `icon` is set.
 * @csspart option-label - Wrapper around a row's label/description.
 * @csspart option-description - A row's optional secondary line, when `description` is set.
 * @csspart empty - The "no matches" message, shown when `items`/`query` produce zero rows.
 */
export class LyraMentionPopover extends LyraElement {
  static styles = [LyraElement.styles, styles];

  /** The element to position the popup relative to. When this is a plain
   *  `<textarea>`/single-line text `<input>`, positioning is caret-precise
   *  (see the class doc); any other element anchors the whole popup under
   *  that element's own box, the same as `<lyra-combobox>`'s trigger. */
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

  /** Accessible name for the `role="listbox"` popup. */
  @property() label = 'Suggestions';

  // Highlighted row, opens pre-highlighted on the top match (index 0) so a
  // bare Enter right after opening commits immediately -- the same "first
  // result is pre-selected" UX every mainstream @-mention/slash-command
  // picker (Slack, GitHub, Notion, …) uses, unlike lyra-combobox's own
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
  // open-transition handling below (which otherwise fires lyra-mention-close
  // on every true->false transition, matching lyra-combobox's/lyra-select's
  // identical lyra-hide handling) can tell a successful-selection close
  // apart from every other close and skip the event for that one case.
  private _suppressCloseEvent = false;

  protected willUpdate(changed: PropertyValues): void {
    this._isFirstUpdate = !this.hasUpdated;
    // A fresh query or candidate set re-highlights the top match, mirroring
    // how a filtering text field's own suggestion list re-anchors to the
    // first result on every keystroke rather than preserving a highlight
    // that may no longer even be in the filtered set.
    if (changed.has('query') || changed.has('items')) this.activeIndex = 0;
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('open')) {
      if (this.open) {
        this.reposition();
      } else {
        this.cleanup?.();
        this.cleanup = undefined;
        this.virtualAnchor?.remove();
        // Don't fire for markup that's simply rendering open="false" for the
        // first time, and don't fire for the commit() path (see
        // _suppressCloseEvent's own doc above) -- every other true->false
        // transition (Escape, or a direct host assignment) does fire.
        if (!this._isFirstUpdate && !this._suppressCloseEvent) this.emit('lyra-mention-close');
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
    if (changed.has('activeIndex')) {
      this.renderRoot.querySelector<HTMLElement>('[part="option"][data-active]')?.scrollIntoView({ block: 'nearest' });
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.cleanup?.();
    this.cleanup = undefined;
    this.virtualAnchor?.remove();
  }

  /** The current candidate set: `items` filtered by `query` via `filter`
   *  (or the built-in default). Empty `query` returns `items` unfiltered. */
  get filteredItems(): MentionItem[] {
    const q = this.query.trim().toLowerCase();
    if (!q) return this.items;
    const fn = this.filter ?? defaultFilter;
    return this.items.filter((item) => fn(item, q));
  }

  /** The `id` of the currently-highlighted row for the host to apply as its
   *  own input's `aria-activedescendant` — `null` while closed or when
   *  `filteredItems` is empty (nothing to point at). See the class doc's
   *  `@example` for the full wiring. */
  get activeDescendantId(): string | null {
    if (!this.open) return null;
    const idx = this.clampedIndex(this.filteredItems);
    return idx >= 0 ? this.rowId(idx) : null;
  }

  /** The `id` of the `role="listbox"` popup, for a host that also wants to
   *  wire `aria-controls` on its own input (screen-reader support for
   *  `aria-controls` is inconsistent, so `activeDescendantId` remains the
   *  load-bearing piece; this is a supplementary nicety). */
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
        this.commit(rows[idx]);
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
    this.emit<MentionSelectDetail>('lyra-mention-select', { id: item.id, label: item.label });
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
  // per row per render -- same pattern as lyra-combobox's/lyra-select's
  // identical onListboxMouseDown/onListboxClick.
  private onListboxMouseDown = (e: MouseEvent): void => {
    // Focus must never leave the host's own text control -- preventing the
    // default here is what stops a plain (non-focusable) row click from
    // blurring it.
    if ((e.target as HTMLElement).closest('[part="option"]')) e.preventDefault();
  };

  private onListboxClick = (e: MouseEvent): void => {
    const optionEl = (e.target as HTMLElement).closest('[part="option"]') as HTMLElement | null;
    const id = optionEl?.dataset.id;
    if (id === undefined) return;
    const item = this.filteredItems.find((i) => i.id === id);
    if (item) this.commit(item);
  };

  private renderRow(item: MentionItem, index: number, activeId: string): TemplateResult {
    const id = this.rowId(index);
    const active = id === activeId;
    return html`
      <div part="option" id=${id} role="option" data-id=${item.id} aria-selected=${active ? 'true' : 'false'} ?data-active=${active}>
        ${item.icon ? html`<span part="option-icon" aria-hidden="true">${item.icon}</span>` : nothing}
        <span part="option-label">
          <span>${item.label}</span>
          ${item.description ? html`<span part="option-description">${item.description}</span>` : nothing}
        </span>
      </div>
    `;
  }

  render(): TemplateResult {
    const rows = this.filteredItems;
    const idx = this.clampedIndex(rows);
    const activeId = idx >= 0 ? this.rowId(idx) : '';

    return html`
      <div
        part="listbox"
        id=${this._listboxId}
        role="listbox"
        aria-label=${this.label}
        @mousedown=${this.onListboxMouseDown}
        @click=${this.onListboxClick}
      >
        ${rows.length === 0
          ? html`<div part="empty" role="option" aria-selected="false" aria-disabled="true">${this.emptyText}</div>`
          : rows.map((item, i) => this.renderRow(item, i, activeId))}
      </div>
    `;
  }
}

defineElement('mention-popover', LyraMentionPopover);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-mention-popover': LyraMentionPopover;
  }
}

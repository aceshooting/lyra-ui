import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { FormAssociated } from '../../../internal/form-associated.js';
import { hostAriaLabel, nextId } from '../../../internal/a11y.js';
import { activeElementIn, deepActiveElementIn } from '../../../internal/active-element.js';
import {
  acquireAnnouncementSink,
  type AnnouncementSink,
} from '../../../internal/announcer.js';
import {
  dispatchNativeEvent,
  dispatchNativeInputEvent,
  relayNativeEvent,
} from '../../../internal/native-event-relay.js';
import type { LyraSize } from '../../../internal/variants.js';
import { styles } from './emoji-picker.styles.js';
import { loadEmojiDataCached } from './emoji-data-loader.js';
// Data types live in ./emoji-types.js (extracted to break a type-only import cycle with
// emoji-data-loader.ts); re-exported so `export *` from emoji-picker.js keeps the public paths.
import type { EmojiPickerItem, EmojiPickerGroup } from './emoji-types.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_emojiPickerEmpty, LYRA_DEFAULT_emojiPickerGridLabel, LYRA_DEFAULT_emojiPickerGroupActivities, LYRA_DEFAULT_emojiPickerGroupAnimalsNature, LYRA_DEFAULT_emojiPickerGroupComponent, LYRA_DEFAULT_emojiPickerGroupFlags, LYRA_DEFAULT_emojiPickerGroupFoodDrink, LYRA_DEFAULT_emojiPickerGroupObjects, LYRA_DEFAULT_emojiPickerGroupPeopleBody, LYRA_DEFAULT_emojiPickerGroupSmileysEmotion, LYRA_DEFAULT_emojiPickerGroupSymbols, LYRA_DEFAULT_emojiPickerGroupTravelPlaces, LYRA_DEFAULT_emojiPickerGroupUnknown, LYRA_DEFAULT_emojiPickerLoadError, LYRA_DEFAULT_emojiPickerSearchLabel, LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_item, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_open, LYRA_DEFAULT_popover, LYRA_DEFAULT_progress, LYRA_DEFAULT_restore, LYRA_DEFAULT_search, LYRA_DEFAULT_select } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export type { EmojiPickerItem, EmojiPickerGroup };

const VIRTUALIZE_AT = 200;
// Only used while the probe boxes have no used size to read (the element is not laid out at all --
// `display: none`, a detached render). They mirror the shipped token defaults at a 16px root font
// size: 2.5rem, 0.125rem, and 2.5rem + 1rem.
const ITEM_SIZE_FALLBACK = 40;
const GAP_FALLBACK = 2;
const VIRTUAL_ROW_HEIGHT_FALLBACK = 56;
const MAX_VIRTUAL_COLUMNS = 20;

// The numeric keys are an implementation detail of the optional emojibase-backed loader, not
// consumer-authored group metadata. Provenance is tracked separately so a consumer group that
// happens to use key "0" still renders its caller-owned label verbatim.
const BUILT_IN_GROUP_LABEL_KEYS: Readonly<Record<string, string>> = {
  0: 'emojiPickerGroupSmileysEmotion',
  1: 'emojiPickerGroupPeopleBody',
  2: 'emojiPickerGroupComponent',
  3: 'emojiPickerGroupAnimalsNature',
  4: 'emojiPickerGroupFoodDrink',
  5: 'emojiPickerGroupTravelPlaces',
  6: 'emojiPickerGroupActivities',
  7: 'emojiPickerGroupObjects',
  8: 'emojiPickerGroupSymbols',
  9: 'emojiPickerGroupFlags',
};

interface VirtualEmojiRow {
  label?: string;
  items: ReadonlyArray<{ item: EmojiPickerItem; index: number }>;
}

interface EmojiProjection {
  source: readonly EmojiPickerGroup[];
  query: string;
  locale: string;
  groups: readonly EmojiPickerGroup[];
  items: readonly EmojiPickerItem[];
}

const MAX_EMOJI_GROUPS = 64;
const MAX_EMOJIS = 20_000;
const MAX_SHORTCODES_PER_EMOJI = 64;

function snapshotEmojiGroups(
  source: unknown,
  itemSnapshots: WeakMap<object, EmojiPickerItem>,
): readonly EmojiPickerGroup[] {
  if (!Array.isArray(source)) return Object.freeze([]);
  const groups: EmojiPickerGroup[] = [];
  let remaining = MAX_EMOJIS;
  for (let groupIndex = 0; groupIndex < Math.min(source.length, MAX_EMOJI_GROUPS) && remaining > 0; groupIndex += 1) {
    try {
      const rawGroup = source[groupIndex];
      if (rawGroup === null || typeof rawGroup !== 'object') continue;
      const group = rawGroup as Record<string, unknown>;
      const key = group['key'];
      const label = group['label'];
      const rawEmojis = group['emojis'];
      if (typeof key !== 'string' || typeof label !== 'string' || !Array.isArray(rawEmojis)) continue;
      const emojis: EmojiPickerItem[] = [];
      const length = Math.min(rawEmojis.length, remaining);
      for (let itemIndex = 0; itemIndex < length; itemIndex += 1) {
        try {
          const rawItem = rawEmojis[itemIndex];
          if (rawItem === null || typeof rawItem !== 'object') continue;
          const cached = itemSnapshots.get(rawItem);
          if (cached) {
            emojis.push(cached);
            continue;
          }
          const item = rawItem as Record<string, unknown>;
          const emoji = item['emoji'];
          const name = item['name'];
          const rawShortcodes = item['shortcodes'];
          if (
            typeof emoji !== 'string' || typeof name !== 'string' ||
            (rawShortcodes !== undefined && !Array.isArray(rawShortcodes))
          ) continue;
          const shortcodes = rawShortcodes === undefined
            ? undefined
            : Object.freeze(rawShortcodes.slice(0, MAX_SHORTCODES_PER_EMOJI).filter(
              (entry): entry is string => typeof entry === 'string',
            ));
          const snapshot = Object.freeze({ emoji, name, ...(shortcodes === undefined ? {} : { shortcodes }) });
          itemSnapshots.set(rawItem, snapshot);
          emojis.push(snapshot);
        } catch {
          // A hostile getter invalidates only its own emoji; later valid items remain reachable.
        }
      }
      remaining -= emojis.length;
      groups.push(Object.freeze({ key, label, emojis: Object.freeze(emojis) }));
    } catch {
      // A hostile getter invalidates only its own group; later valid groups remain reachable.
    }
  }
  return Object.freeze(groups);
}

/** Pixel geometry of the windowed layout, resolved from the three geometry custom properties. */
interface EmojiPickerGeometry {
  itemSize: number;
  gap: number;
  rowHeight: number;
}

/** One probe box's used inline size in CSS pixels, or `fallback` when it has no usable box yet. */
function probePixels(probe: HTMLElement, fallback: number, allowZero = false): number {
  // The *used* value (post-layout, minimum-clamped) rather than `getBoundingClientRect()` on
  // purpose: `inline-size`'s resolved value is in untransformed CSS pixels, the same space as the
  // `clientWidth`/`scrollTop` numbers this geometry is combined with. A rect is in transformed
  // viewport space, so a scaled ancestor would rescale the column count and row pitch relative to
  // the scroller they drive.
  const computed = probe.ownerDocument.defaultView?.getComputedStyle(probe);
  if (!computed) return fallback;
  const px = Number.parseFloat(computed.inlineSize);
  if (!Number.isFinite(px) || px < 0) return fallback;
  return px > 0 || allowZero ? px : fallback;
}

export interface LyraEmojiPickerEventMap {
  'lr-invalid': CustomEvent<null>;
  input: InputEvent;
  change: Event;
  blur: FocusEvent;
  focus: FocusEvent;
  /** Fired when an emoji is picked. `detail.value` is the picked glyph. */
  'lr-input': CustomEvent<{ value: string }>;
  /** Fired when an emoji pick is committed. `detail.value` is the picked glyph. */
  'lr-change': CustomEvent<{ value: string }>;
}

class EmojiPickerBase extends LyraElement<LyraEmojiPickerEventMap> {}

/**
 * `<lr-emoji-picker>` — a searchable, keyboard-navigable, form-associated emoji picker. In the
 * same "zero/optional-peer dependency" spirit as `<lr-lite-chart>`/`<lr-heatmap>`: `groups` is
 * fully consumer-suppliable (this component ships no emoji data of its own), with an *optional*
 * convenience auto-loader for a default set — see `emoji-data-loader.ts` and the class doc there for
 * exactly what that covers.
 *
 * The auto-loader fails *closed and visibly*: when the optional `emoji-picker-element-data` peer
 * cannot be loaded, the grid renders a distinct localized `[part="load-error"]` surface in place of
 * the ordinary `[part="empty"]` message, so a skipped install is distinguishable at a glance from a
 * genuine zero-match search or a deliberate `groups = []` opt-out, and announces the same message
 * once through the document's shared assertive live region. Assigning `groups` afterwards clears
 * it.
 *
 * Keyboard model: the grid is a roving-tabindex listbox (a single Tab stop — only the active emoji
 * is tabbable). Arrow keys move the active option (Left/Right follow reading direction and swap
 * under RTL; Up/Down move by one visual row, measured from the live wrap layout), Home/End jump to
 * the first/last option, and Enter/Space picks. The search input doubles as a `role="combobox"`
 * over the same listbox: the arrow keys and Enter also work there while focus stays in the input,
 * with `aria-activedescendant` tracking the active option. Large data sets automatically window
 * their visible rows so scrolling does not create one button per supplied emoji in the DOM.
 * Replacing `groups` while an emoji option owns focus preserves that item when its object remains
 * present, otherwise focus moves to the nearest surviving option; search or external focus is
 * never pulled into the grid by a controlled collection update. Roving navigation to an
 * off-window option materializes its virtual row before transferring focus.
 *
 * Ships the same opt-in `label`/`hint`/`errorText` form-control chrome as `<lr-select>`/
 * `<lr-color-picker>` (props + matching named slots + `form-control`/`form-control-label`/`hint`/
 * `error` parts) — left unset, the chrome stays hidden. When `label` (or the `label` slot) is set
 * and `aria-label`/`accessibleLabel` is not, the grid's accessible name switches from the
 * localized default to `aria-labelledby` pointing at the visible label, mirroring
 * `<lr-checkbox-group>`'s identical `accessibleLabel`-wins-over-`aria-labelledby` precedence.
 *
 * `disabled` (from the `FormAssociated` mixin) gates every self-rendered interactive
 * sub-control — the search input and every emoji button — not just one of them.
 *
 * Component-scoped theme inputs remain undeclared on the host, so values inherited from an
 * ancestor theme wrapper override the active size tier. A value set directly on the picker still
 * wins through normal custom-property inheritance.
 *
 * @customElement lr-emoji-picker
 * @event input - Native `InputEvent` emitted in the host's current owner realm after a user pick.
 * @event change - Native commit `Event` emitted in the host's current owner realm with `input`.
 * @event lr-input - An emoji was picked. `detail: { value }`.
 * @event lr-change - An emoji pick was committed. `detail: { value }`.
 * @event blur - Native owner-realm `FocusEvent` relayed from the internal search input.
 * @event focus - Native owner-realm `FocusEvent` relayed from the internal search input.
 * @event lr-invalid - The emoji picker failed a validity check. Cancelable — preventing this
 *   alias also prevents the native `invalid` event that produced it.
 * @slot label - Custom label content.
 * @slot hint - Custom hint content.
 * @slot error - Custom error content.
 * @csspart form-control - The outer wrapper around label, base, error and hint.
 * @csspart form-control-label - The visible label.
 * @csspart base - The wrapper around the search input and grid.
 * @csspart search - The search/filter `<input>` (`role="combobox"` over the grid).
 * @csspart grid - The keyboard-navigable emoji grid. It scrolls only in the block axis and clips
 *   inline overflow, avoiding a second scrollbar when the allocation is narrower than one option.
 * @csspart group-label - Each group's heading, rendered above its emojis.
 * @csspart emoji - Each emoji's own `<button>`; its box and glyph both scale with the `size`
 *   property (`--lr-emoji-picker-item-size`/`-glyph-size`), while its interactive box remains
 *   floored at the shared `--lr-icon-button-size`.
 * @csspart empty - The empty-state message, shown when the search matches nothing or a consumer
 *   deliberately opted out with `groups = []`.
 * @csspart load-error - The peer-load failure surface, shown in place of `empty` when the optional
 *   `emoji-picker-element-data` peer was consulted and did not resolve. It never appears for a
 *   zero-match search or a deliberate `groups = []`, and a later `groups` assignment clears it. The
 *   same message is announced once through the shared light-DOM assertive sink rather than through
 *   a shadow-root `role="alert"`, which announces unreliably.
 * @csspart virtual-spacer - The full-height scroll spacer that gives the grid its scrollbar while
 *   only the visible rows exist in the DOM. Rendered on the windowed path only.
 * @csspart virtual-row - One windowed row, absolutely positioned at the `--lr-emoji-picker-row-height`
 *   pitch. Rendered on the windowed path only.
 * @csspart virtual-label - The `aria-hidden` placeholder that reserves a row's group-label band when
 *   that row has no label, keeping every row the same height. Rendered on the windowed path only.
 * @csspart virtual-items - The flex row holding one windowed row's emoji buttons.
 * @csspart hint - The hint message.
 * @csspart error - The error message.
 * @cssprop [--lr-emoji-picker-item-size=var(--lr-icon-button-size)] - Each emoji button's box.
 *   Floored at the shared `--lr-icon-button-size`; small size tiers scale the glyph without
 *   shrinking the interactive target.
 * @cssprop [--lr-emoji-picker-glyph-size=var(--lr-font-size-lg)] - Font size of the emoji glyph,
 *   scaled by the `size` property to keep the glyph proportional to the item box.
 * @cssprop [--lr-emoji-picker-gap=var(--lr-space-2xs)] - Gap between emoji within a windowed row.
 * @cssprop [--lr-emoji-picker-control-gap=var(--lr-space-xs)] - Gap between field sections.
 * @cssprop [--lr-emoji-picker-radius=var(--lr-radius)] - Outer picker corner radius.
 * @cssprop [--lr-emoji-picker-item-radius=var(--lr-radius-xs)] - Search and emoji corner radius.
 * @cssprop [--lr-emoji-picker-search-hover-border-color=var(--lr-color-brand)] - Search hover border.
 * @cssprop [--lr-emoji-picker-row-height=calc(var(--lr-emoji-picker-item-size) + var(--lr-space-l))] -
 *   One windowed row's height. Must stay at or above the item size plus the group-label band, or
 *   consecutive absolutely-positioned rows overlap.
 * @cssprop [--lr-emoji-picker-hover-bg=var(--lr-emoji-picker-active-bg,var(--lr-color-brand-quiet))]
 *   - Pointer-hover background. The legacy `--lr-emoji-picker-active-bg` remains its fallback.
 * @cssprop [--lr-emoji-picker-keyboard-active-bg=var(--lr-emoji-picker-active-bg,var(--lr-color-brand-quiet))]
 *   - Roving keyboard/pointer-active background.
 * @cssprop [--lr-emoji-picker-selected-bg=var(--lr-color-brand-quiet)] - Committed-value background.
 * @cssprop [--lr-emoji-picker-selected-color=var(--lr-color-text)] - Committed-value foreground.
 * @cssprop [--lr-emoji-picker-selected-outline-color=var(--lr-color-brand)] - Outline color for
 *   the committed selection.
 * @cssprop [--lr-emoji-picker-pressed-bg=color-mix(...)] - Pointer-pressed background.
 * @cssprop [--lr-emoji-picker-pressed-outline-color=var(--lr-color-brand)] - Outline color while
 *   an emoji button is being pointer-pressed.
 * @cssprop [--lr-emoji-picker-keyboard-active-outline-color=var(--lr-color-brand)] - Outline color
 *   for the roving keyboard-active emoji.
 * @cssprop [--lr-emoji-picker-active-bg=var(--lr-color-brand-quiet)] - Compatibility fallback
 *   background for hover and roving-active states.
 * @cssprop [--lr-form-control-required-content=' *'] - The required marker appended to
 *   `form-control-label` while `required` is set. Set it to `''` to suppress the marker, or to any
 *   other quoted string (`' (required)'`, a localized word) to replace it.
 * @cssprop [--lr-form-control-required-color=var(--lr-color-danger)] - Required-marker color,
 *   themeable independently of error text and invalid borders.
 * @cssprop [--lr-form-control-required-offset=0] - Inline space between the label text and the
 *   required marker.
 * @status stable
 * @since 4.0.0
 */
export class LyraEmojiPicker extends FormAssociated(EmojiPickerBase) {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    emojiPickerEmpty: LYRA_DEFAULT_emojiPickerEmpty,
    emojiPickerGridLabel: LYRA_DEFAULT_emojiPickerGridLabel,
    emojiPickerGroupActivities: LYRA_DEFAULT_emojiPickerGroupActivities,
    emojiPickerGroupAnimalsNature: LYRA_DEFAULT_emojiPickerGroupAnimalsNature,
    emojiPickerGroupComponent: LYRA_DEFAULT_emojiPickerGroupComponent,
    emojiPickerGroupFlags: LYRA_DEFAULT_emojiPickerGroupFlags,
    emojiPickerGroupFoodDrink: LYRA_DEFAULT_emojiPickerGroupFoodDrink,
    emojiPickerGroupObjects: LYRA_DEFAULT_emojiPickerGroupObjects,
    emojiPickerGroupPeopleBody: LYRA_DEFAULT_emojiPickerGroupPeopleBody,
    emojiPickerGroupSmileysEmotion: LYRA_DEFAULT_emojiPickerGroupSmileysEmotion,
    emojiPickerGroupSymbols: LYRA_DEFAULT_emojiPickerGroupSymbols,
    emojiPickerGroupTravelPlaces: LYRA_DEFAULT_emojiPickerGroupTravelPlaces,
    emojiPickerGroupUnknown: LYRA_DEFAULT_emojiPickerGroupUnknown,
    emojiPickerLoadError: LYRA_DEFAULT_emojiPickerLoadError,
    emojiPickerSearchLabel: LYRA_DEFAULT_emojiPickerSearchLabel,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    item: LYRA_DEFAULT_item,
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    open: LYRA_DEFAULT_open,
    popover: LYRA_DEFAULT_popover,
    progress: LYRA_DEFAULT_progress,
    restore: LYRA_DEFAULT_restore,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  private _groups: readonly EmojiPickerGroup[] = Object.freeze([]);
  private readonly itemSnapshots = new WeakMap<object, EmojiPickerItem>();
  private builtInGroups = new WeakSet<EmojiPickerGroup>();
  private groupsWereSet = false;
  /** The third state `groups` alone cannot express: the optional `emoji-picker-element-data` peer
   *  was consulted and did not resolve, as opposed to "not loaded yet" or "loaded, and empty". */
  @state() private peerLoadFailed = false;
  /** Live region for the peer-load failure. A shadow-root `role="alert"` is unreliable, so the
   *  message goes through the document's shared light-DOM assertive sink -- the same channel
   *  `<lr-combobox>` uses for its own `sourceFailed` announcement. */
  private peerErrorAnnouncementSink?: AnnouncementSink;

  /** The full, ungrouped data set to search/render. Consumer-supplied — this component ships no
   *  emoji data of its own. Leaving the property unset allows the optional convenience loader to
   *  provide defaults; explicitly assigning `[]` opts out and renders only the search input and
   *  empty state. See `emoji-data-loader.ts` for the loader contract. */
  @property({ attribute: false })
  get groups(): readonly EmojiPickerGroup[] {
    return this._groups;
  }
  set groups(value: readonly EmojiPickerGroup[]) {
    const old = this._groups;
    const focused = activeElementIn(this.shadowRoot) as HTMLElement | null;
    const focusedIndex = Number(focused?.dataset?.['index']);
    this.pendingGridFocus =
      typeof focused?.getAttribute === 'function' &&
      focused.getAttribute('part')?.split(/\s+/).includes('emoji') && Number.isInteger(focusedIndex)
        ? { item: this.focusedGridItem ?? this.flatItems[focusedIndex], index: focusedIndex }
        : undefined;
    this.groupsWereSet = true;
    // A consumer assignment always supersedes a failed auto-load, including a deliberate `[]`
    // opt-out: from here on the empty grid is the consumer's decision, not a missing install.
    this.peerLoadFailed = false;
    // Every public assignment is caller-owned, even if it reuses an array previously returned by
    // the optional loader. Only connectedCallback's successful private load restores provenance.
    this.builtInGroups = new WeakSet<EmojiPickerGroup>();
    this._groups = snapshotEmojiGroups(value, this.itemSnapshots);
    this.requestUpdate('groups', old);
  }

  /** Accessible name forwarded from the host to the internal emoji listbox. Omission falls back
   *  to the visible label or localized default; an explicitly empty host attribute stays empty. */
  @property({ attribute: 'aria-label' }) accessibleLabel = '';

  /** Visual size — scales the emoji glyph and preferred item box while keeping the interactive
   *  target floored at `--lr-icon-button-size`; not pixel-matched to `lr-input`'s row-height scale. The Web Awesome / Shoelace spellings
   *  `small`/`medium`/`large` are accepted for `s`/`m`/`l`, so a migration is a tag rename with no
   *  attribute rewrite. */
  @property({ reflect: true }) size: LyraSize = 'm';

  /** Visible label content, rendered above the search/grid. Empty (the default) renders no label
   *  chrome at all -- see the class doc above for the full label/hint/error contract. */
  @property() label = '';
  /** Supporting text rendered below the search/grid. */
  @property() hint = '';
  /** Validation-error text rendered below the hint. */
  @property({ attribute: 'error-text' }) errorText = '';

  @state() private hasLabelSlot = false;
  @state() private hasHintSlot = false;
  @state() private hasErrorSlot = false;
  // Set on the search input's first native `blur`; gates the `aria-invalid` reflection below so
  // validity styling never flashes on first render -- mirrors `<lr-select>`'s identical `touched`.
  @state() private touched = false;

  private readonly labelId = nextId('emoji-picker-label');
  private readonly hintId = nextId('emoji-picker-hint');
  private readonly errorId = nextId('emoji-picker-error');

  /** Injectable loader seam -- overridden directly by tests with a synchronous fake instead of
   *  needing the real `emoji-picker-element-data` package to load in the test browser (mirrors
   *  `LyraPdfViewer`'s `loadLibrary` field / `LyraQrCode`'s `loadLibrary` field). */
  private loadGroups: () => Promise<EmojiPickerGroup[] | null> = loadEmojiDataCached;

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) this.syncGeometryProbe();
    // Re-arms the geometry sensor after a reconnect; the cache is deliberately kept across the
    // disconnect, so the first delivery here still re-renders if the tokens moved while detached.
    this.observeGeometryProbe();
    this.syncGridObserver();
    // Only auto-loads when the consumer hasn't already supplied groups directly -- an explicit
    // `groups` (even an empty array set intentionally) always wins, matching the "consumer-supplied
    // data takes precedence over any built-in default" convention this library uses elsewhere (e.g.
    // <lr-lite-chart>'s pointText falling back to a built-in template only when unset).
    if (this.groupsWereSet) return;
    const ownerDocument = this.ownerDocument;
    const generation = this.ownerRealmGeneration;
    void this.loadGroups().then((loaded) => {
      if (
        this.ownerRealmGeneration !== generation ||
        !this.isConnected ||
        this.ownerDocument !== ownerDocument ||
        this.groupsWereSet
      ) {
        return;
      }
      if (!loaded) {
        // Fail closed and SAY so. Leaving `groups` at its `[]` default rendered the picker's
        // ordinary "no emoji found" state -- byte-identical to a genuine zero-match search and to
        // a consumer's deliberate `groups = []` opt-out -- so a skipped `emoji-picker-element-data`
        // install was indistinguishable from working software, diagnosable only by a one-time
        // console.warn nobody sees. Mirrors <lr-combobox>'s `sourceFailed` treatment of the same
        // shape.
        this.peerLoadFailed = true;
        this.announcePeerLoadFailure();
        return;
      }
      this.groups = loaded;
      this.builtInGroups = new WeakSet(this._groups);
    });
  }

  @state() private queryText = '';

  // Deliberately non-reactive: pointer hover and arrow keys retarget the active option many times
  // a second, and a reactive property here would re-render the entire (potentially ~2000-button)
  // grid on every step. `setActiveIndex()` patches only the affected buttons imperatively instead;
  // the `live()` bindings in `render()` reconcile the template against that imperative state
  // whenever a real re-render (a query/groups change) happens.
  private activeIndex = 0;
  private focusedGridItem?: EmojiPickerItem;
  private pendingGridFocus?: { item?: EmojiPickerItem; index: number };

  /** The large-data path keeps only visible rows in the DOM. The regular path remains unchanged
   * for small sets so consumers keep the simple grouped light-DOM shape they already receive. */
  private virtualScrollTop = 0;
  private virtualScrollRaf?: number;
  private virtualScrollRafWindow?: Window;
  private virtualScrollRafDocument?: Document;
  private observedGrid?: HTMLElement;
  private observedGridVirtualized = false;
  private gridResizeObserver?: ResizeObserver;
  private gridResizeObserverDocument?: Document;
  private geometryProbe?: { root: HTMLElement; item: HTMLElement; gap: HTMLElement; row: HTMLElement };
  private geometryCache?: EmojiPickerGeometry;
  private liveGeometryReady = false;
  private geometryObserver?: ResizeObserver;
  private geometryObserverDocument?: Document;
  private geometryObserverRoot?: HTMLElement;
  private ownerRealmGeneration = 0;

  @query('[part="search"]') private searchEl?: HTMLInputElement;

  /** Reads both component state and the UA's synchronous fieldset cascade before host actions. */
  private get liveDisabled(): boolean {
    return this.effectiveDisabled || this.matches(':disabled');
  }

  /** Moves focus to the search combobox while the form control is enabled. */
  override focus(options?: FocusOptions): void {
    if (!this.liveDisabled) this.searchEl?.focus(options);
  }

  /** Blurs the currently focused owned search or emoji target, including a nested shadow owner. */
  override blur(): void {
    const active = deepActiveElementIn(this.shadowRoot);
    if (active && typeof (active as HTMLElement).blur === 'function') {
      (active as HTMLElement).blur();
    }
  }

  /** Activates the live search control while the form control is enabled. */
  override click(): void {
    if (!this.liveDisabled) this.searchEl?.click();
  }

  private readonly gridId = nextId('emoji-picker-grid');

  // Lowercased search haystack per item, computed once per item object -- re-joining and
  // re-lowercasing every item on every keystroke dominates filter cost for large sets. Keyed by
  // item identity in a WeakMap, so replacing `groups` invalidates naturally (stale entries are
  // simply collected).
  private readonly haystacks = new WeakMap<
    EmojiPickerItem,
    { locale: string; value: string }
  >();
  private projectionCache?: EmojiProjection;
  private rowCache?: { projection: EmojiProjection; columns: number; rows: VirtualEmojiRow[] };

  private haystackFor(item: EmojiPickerItem): string {
    const locale = this.effectiveLocale;
    let cached = this.haystacks.get(item);
    if (cached === undefined || cached.locale !== locale) {
      cached = {
        locale,
        value: [item.name, ...(item.shortcodes ?? [])].join(' ').toLocaleLowerCase(locale),
      };
      this.haystacks.set(item, cached);
    }
    return cached.value;
  }

  private projection(): EmojiProjection {
    const locale = this.effectiveLocale;
    const query = this.queryText.trim().toLocaleLowerCase(locale);
    const cached = this.projectionCache;
    if (cached?.source === this._groups && cached.query === query && cached.locale === locale) {
      return cached;
    }
    const groups = query
      ? this._groups
          .map((group) => ({
            ...group,
            emojis: group.emojis.filter((item) => this.haystackFor(item).includes(query)),
          }))
          .filter((group) => group.emojis.length > 0)
      : this._groups;
    const next = { source: this._groups, query, locale, groups, items: groups.flatMap((group) => group.emojis) };
    this.projectionCache = next;
    return next;
  }

  private get filteredGroups(): readonly EmojiPickerGroup[] {
    return this.projection().groups;
  }

  private get flatItems(): readonly EmojiPickerItem[] {
    return this.projection().items;
  }

  private get isVirtualized(): boolean {
    return this.flatItems.length >= VIRTUALIZE_AT;
  }

  /**
   * The windowed layout's pixel geometry. `getComputedStyle(host).getPropertyValue('--x')` hands
   * back a custom property's *computed token stream* (`2.5rem`, `calc(2.5rem + 1rem)`) and never a
   * pixel length, so parsing it reads a `rem` value's leading number as pixels and cannot read a
   * `calc()` at all. Measuring the probe boxes the stylesheet sizes from those same tokens makes
   * the browser do the unit math instead, for every unit `calc()` included.
   *
   * Measured at most once per geometry change, not per frame: the result is cached, and the probe
   * boxes themselves are the invalidation signal (see `observeGeometryProbe`).
   */
  private geometry(): EmojiPickerGeometry {
    if (this.geometryCache) return this.geometryCache;
    const probe = this.geometryProbe;
    if (!probe) {
      return { itemSize: ITEM_SIZE_FALLBACK, gap: GAP_FALLBACK, rowHeight: VIRTUAL_ROW_HEIGHT_FALLBACK };
    }
    // A zero gap is a legitimate value; a zero item size or row height is not (it would divide the
    // scroll offset by zero), so those fall back instead.
    this.geometryCache = {
      itemSize: probePixels(probe.item, ITEM_SIZE_FALLBACK),
      gap: probePixels(probe.gap, GAP_FALLBACK, true),
      rowHeight: probePixels(probe.row, VIRTUAL_ROW_HEIGHT_FALLBACK),
    };
    return this.geometryCache;
  }

  /** Resolves first-render geometry in a browser-only mount. The permanent probe is emitted by
   * `render()` so SSR and hydration own the same declarative nodes; this temporary box exists only
   * long enough to cache used pixels before the first browser render, then is removed. */
  private syncGeometryProbe(): void {
    if (this.geometryProbe || !this.isVirtualized || !this.ownerDocument) return;
    const makeProbe = (name: string): HTMLDivElement => {
      const probe = this.ownerDocument.createElement('div');
      probe.dataset['probe'] = name;
      return probe;
    };
    const root = makeProbe('root');
    root.setAttribute('aria-hidden', 'true');
    const item = makeProbe('item');
    const gap = makeProbe('gap');
    const row = makeProbe('row');
    root.append(item, gap, row);
    this.renderRoot.append(root);
    this.geometryProbe = { root, item, gap, row };
    // Force and retain used geometry while the temporary boxes participate in layout; render()
    // consumes this cache after the boxes have been removed.
    this.geometry();
    root.remove();
    this.geometryProbe = undefined;
  }

  /** Adopts render()'s permanent declarative probe after the update and arms its invalidation
   * observer. On hydration, a non-default CSS override corrects on the next animation frame so the
   * server-owned tree has already completed its identity-preserving first reuse pass. */
  private bindRenderedGeometryProbe(): void {
    const root = this.renderRoot?.querySelector<HTMLElement>('[data-probe="root"]');
    const item = root?.querySelector<HTMLElement>('[data-probe="item"]');
    const gap = root?.querySelector<HTMLElement>('[data-probe="gap"]');
    const row = root?.querySelector<HTMLElement>('[data-probe="row"]');
    if (!root || !item || !gap || !row) return;
    if (this.geometryProbe?.root === root) {
      this.observeGeometryProbe();
      return;
    }
    const prior = this.geometryCache ?? {
      itemSize: ITEM_SIZE_FALLBACK,
      gap: GAP_FALLBACK,
      rowHeight: VIRTUAL_ROW_HEIGHT_FALLBACK,
    };
    this.geometryProbe = { root, item, gap, row };
    this.geometryCache = undefined;
    const next = this.geometry();
    this.liveGeometryReady = true;
    this.observeGeometryProbe();
    if (
      prior.itemSize !== next.itemSize ||
      prior.gap !== next.gap ||
      prior.rowHeight !== next.rowHeight
    ) {
      this.ownerDocument.defaultView?.requestAnimationFrame(() => {
        if (this.isConnected && this.geometryProbe?.root === root) this.requestUpdate();
      });
    }
  }

  /** The probe boxes double as the change sensor: anything that can move the geometry -- a token
   *  override applied after the first render, a theme swap, a root/host font-size change feeding a
   *  `rem`/`em` value -- resizes them, so the cached pixels are re-derived exactly when they can
   *  actually differ, with no per-frame reads. */
  private observeGeometryProbe(): void {
    const probe = this.geometryProbe;
    const ownerDocument = this.ownerDocument;
    if (!probe || !this.isConnected) return;
    if (
      this.geometryObserver &&
      this.geometryObserverDocument === ownerDocument &&
      this.geometryObserverRoot === probe.root
    ) {
      return;
    }
    this.resetGeometryObserver();
    const ResizeObserverCtor = ownerDocument.defaultView?.ResizeObserver;
    if (!ResizeObserverCtor) return;
    const generation = this.ownerRealmGeneration;
    const observer = new ResizeObserverCtor(() => {
      if (
        this.geometryObserver !== observer ||
        this.geometryObserverDocument !== ownerDocument ||
        this.geometryObserverRoot !== probe.root ||
        this.ownerRealmGeneration !== generation ||
        !this.isConnected ||
        this.ownerDocument !== ownerDocument
      ) {
        return;
      }
      this.onGeometryResize();
    });
    this.geometryObserver = observer;
    this.geometryObserverDocument = ownerDocument;
    this.geometryObserverRoot = probe.root;
    observer.observe(probe.item);
    observer.observe(probe.gap);
    observer.observe(probe.row);
  }

  private resetGeometryObserver(): void {
    this.geometryObserver?.disconnect();
    this.geometryObserver = undefined;
    this.geometryObserverDocument = undefined;
    this.geometryObserverRoot = undefined;
  }

  private onGeometryResize = (): void => {
    const previous = this.geometryCache;
    this.geometryCache = undefined;
    if (!previous) return; // nothing has been rendered against the stale numbers yet
    const next = this.geometry();
    if (next.itemSize === previous.itemSize && next.gap === previous.gap && next.rowHeight === previous.rowHeight) {
      return;
    }
    this.requestUpdate();
  };

  /**
   * Localizes only groups whose object identity came from the built-in loader. A built-in group
   * whose numeric id isn't in `BUILT_IN_GROUP_LABEL_KEYS` (none exist in the emojibase dataset
   * shipped today, ids 0-9 are all mapped -- but a future dataset update could add one) still gets
   * a localized heading via the generic `emojiPickerGroupUnknown` key rather than the loader's own
   * `group.label`, which is a plain, unlocalized placeholder meant only for a caller who consumes
   * `loadEmojiData()` directly without going through this component's rendering.
   */
  private groupLabel(group: EmojiPickerGroup): string {
    if (!this.builtInGroups.has(group)) return group.label;
    const labelKey = BUILT_IN_GROUP_LABEL_KEYS[group.key];
    return labelKey
      ? this.localize(labelKey)
      : this.localize('emojiPickerGroupUnknown', undefined, { group: group.key });
  }

  private virtualRows(): VirtualEmojiRow[] {
    const projection = this.projection();
    const columns = this.columnsPerRow();
    if (this.rowCache?.projection === projection && this.rowCache.columns === columns) {
      return this.rowCache.rows;
    }
    let index = 0;
    const rows: VirtualEmojiRow[] = [];
    for (const group of projection.groups) {
      for (let offset = 0; offset < group.emojis.length; offset += columns) {
        rows.push({
          label: offset === 0 ? this.groupLabel(group) : undefined,
          items: group.emojis.slice(offset, offset + columns).map((item) => ({ item, index: index++ })),
        });
      }
    }
    this.rowCache = { projection, columns, rows };
    return rows;
  }

  private optionButtons(): HTMLButtonElement[] {
    return [...this.renderRoot.querySelectorAll<HTMLButtonElement>('[part="emoji"]')];
  }

  /** Selection is the committed form value; roving focus/hover is a separate active projection. */
  private get selectedIndex(): number {
    if (!this.value) return -1;
    return this.flatItems.findIndex((item) => item.emoji === this.value);
  }

  private syncSelectedProjection(): void {
    const selectedIndex = this.selectedIndex;
    for (const button of this.optionButtons()) {
      button.setAttribute(
        'aria-selected',
        Number(button.dataset['index']) === selectedIndex ? 'true' : 'false',
      );
    }
  }

  /** Options in the first rendered row. Measured from live layout at call time because the
   *  flex-wrap column count is fluid (container width, emoji font metrics). */
  private columnsPerRow(): number {
    if (this.isVirtualized) {
      const grid = this.liveGeometryReady
        ? this.renderRoot?.querySelector<HTMLElement>('[part="grid"]')
        : undefined;
      const width = grid?.clientWidth ?? 0;
      const { itemSize, gap } = this.geometry();
      return Math.min(MAX_VIRTUAL_COLUMNS, Math.max(1, Math.floor((Math.max(width, itemSize) + gap) / (itemSize + gap))));
    }
    const buttons = this.optionButtons();
    if (buttons.length === 0) return 1;
    const firstTop = buttons[0]!.offsetTop; // safe: length === 0 returned above
    let columns = 0;
    for (const button of buttons) {
      if (button.offsetTop !== firstTop) break;
      columns += 1;
    }
    return Math.max(1, columns);
  }

  /** Moves the active option (clamped), updating only the affected buttons plus the combobox's
   *  `aria-activedescendant` — no re-render. `focusTarget` distinguishes the grid's roving-focus
   *  idiom (focus follows the active option) from the search input's combobox idiom (focus stays
   *  in the input). */
  private setActiveIndex(next: number, focusTarget: boolean): void {
    const buttons = this.optionButtons();
    if (buttons.length === 0 && !this.isVirtualized) return;
    this.activeIndex = Math.max(0, Math.min(next, this.flatItems.length - 1));
    if (focusTarget) {
      this.pendingGridFocus = {
        item: this.flatItems[this.activeIndex],
        index: this.activeIndex,
      };
    }
    const target = this.isVirtualized
      ? this.renderRoot.querySelector<HTMLButtonElement>(
          `[part="emoji"][data-index="${this.activeIndex}"]`,
        )
      : buttons[this.activeIndex];
    const previous = this.renderRoot.querySelector<HTMLButtonElement>('[part="emoji"][data-active]');
    if (previous && previous !== target) {
      previous.tabIndex = -1;
      previous.removeAttribute('data-active');
    }
    if (target) {
      target.tabIndex = 0;
      target.setAttribute('data-active', '');
      this.searchEl?.setAttribute('aria-activedescendant', target.id);
      target.scrollIntoView({ block: 'nearest' });
    } else if (this.isVirtualized) {
      this.searchEl?.setAttribute('aria-activedescendant', `${this.gridId}-item-${this.activeIndex}`);
      const rowIndex = this.virtualRows().findIndex((row) => row.items.some(({ index }) => index === this.activeIndex));
      const grid = this.renderRoot.querySelector<HTMLElement>('[part="grid"]');
      if (rowIndex >= 0 && grid) {
        grid.scrollTop = rowIndex * this.geometry().rowHeight;
        this.virtualScrollTop = grid.scrollTop;
        this.requestUpdate();
      }
    }
    if (focusTarget && target) {
      this.pendingGridFocus = undefined;
      target.focus();
    }
  }

  private onSearchInput = (event: Event): void => {
    event.stopPropagation();
    if (this.liveDisabled) return;
    this.pendingGridFocus = undefined;
    this.queryText = (event.target as HTMLInputElement).value;
    this.activeIndex = 0;
  };

  // Native focus/blur neither bubble nor cross the shadow boundary, so a host-level @focus/@blur
  // listener on <lr-emoji-picker> would never fire without this bridge -- mirrors
  // <lr-input>'s/<lr-select>'s onFocus/onBlur pair (including the disabled-blur guard below).
  private onSearchFocus = (event: FocusEvent): void => {
    if (this.liveDisabled) {
      event.stopPropagation();
      return;
    }
    relayNativeEvent(this, event);
  };

  private onSearchBlur = (event: FocusEvent): void => {
    // This element's own `disabled` becoming true force-blurs the search input if it currently
    // holds focus -- plain native HTML behavior (disabling a focused control blurs it), not a user
    // interaction. That blur can land synchronously nested inside the very property write that
    // disabled this control, before `effectiveDisabled` was even read for this render, so it
    // already reads true here whenever this is that case. Marking `touched` for it was, depending
    // on timing, capable of reentering that same in-flight update and tripping Lit's dev-mode
    // "scheduled an update after an update completed" warning for a state flip nothing observable
    // needed -- a disabled control is barred from validation regardless.
    if (!this.liveDisabled) this.touched = true;
    relayNativeEvent(this, event);
  };

  private onLabelSlotChange = (event: Event): void => {
    this.hasLabelSlot = (event.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onHintSlotChange = (event: Event): void => {
    this.hasHintSlot = (event.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onErrorSlotChange = (event: Event): void => {
    this.hasErrorSlot = (event.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private pick(item: EmojiPickerItem): void {
    if (this.liveDisabled) return;
    this.value = item.emoji;
    this.syncSelectedProjection();
    dispatchNativeInputEvent(this);
    this.emit('lr-input', { value: item.emoji });
    dispatchNativeEvent(this, 'change');
    this.emit('lr-change', { value: item.emoji });
  }

  // Shared between the search input (combobox idiom: focus stays in the input while
  // `aria-activedescendant` tracks the active option) and the grid itself (roving tabindex: focus
  // follows the active option).
  private onNavigationKeyDown = (event: KeyboardEvent): void => {
    if (this.liveDisabled) return;
    const items = this.flatItems;
    if (items.length === 0) return;
    const inSearch = event.currentTarget === this.searchEl;
    // "Forward" follows reading direction: the wrapped flex grid mirrors under RTL, so the arrow
    // that moves visually toward the line end swaps with it.
    const forwardKey = this.effectiveDirection === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    const backwardKey = this.effectiveDirection === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    let target: number;
    if (event.key === forwardKey) target = this.activeIndex + 1;
    else if (event.key === backwardKey) target = this.activeIndex - 1;
    else if (event.key === 'ArrowDown') target = this.activeIndex + this.columnsPerRow();
    else if (event.key === 'ArrowUp') target = this.activeIndex - this.columnsPerRow();
    // In the input, Home/End keep their native caret meaning.
    else if (event.key === 'Home' && !inSearch) target = 0;
    else if (event.key === 'End' && !inSearch) target = items.length - 1;
    else if (event.key === 'Enter' || (event.key === ' ' && !inSearch)) {
      // Space only picks from the grid -- in the search input it types a literal space.
      event.preventDefault();
      const item = items[this.activeIndex];
      if (item) this.pick(item);
      return;
    } else {
      return;
    }
    event.preventDefault();
    if (inSearch) this.pendingGridFocus = undefined;
    this.setActiveIndex(target, !inSearch);
  };

  // Keeps the active option in lockstep with real focus, so Enter/Space always activates the
  // focused button -- focus can land on any option without passing through the arrow-key path
  // (Shift+Tab back into the grid, a consumer's own `focus()` call).
  private onGridFocusIn = (event: FocusEvent): void => {
    const button = event.target;
    if (
      (button as Partial<Node> | null)?.nodeType !== 1 ||
      (button as Partial<Element>).localName !== 'button'
    ) {
      return;
    }
    const option = button as HTMLButtonElement;
    const indexed = Number(option.dataset['index']);
    const index = Number.isInteger(indexed) ? indexed : this.optionButtons().indexOf(option);
    if (this.pendingGridFocus) return;
    this.focusedGridItem = this.flatItems[index];
    if (index >= 0 && index !== this.activeIndex) this.setActiveIndex(index, false);
  };

  private onEmojiPointerEnter = (itemIndex: number): void => {
    this.pendingGridFocus = undefined;
    this.setActiveIndex(itemIndex, false);
  };

  private onGridScroll = (event: Event): void => {
    if (!this.isVirtualized) return;
    const grid = event.currentTarget as HTMLElement;
    this.virtualScrollTop = grid.scrollTop;
    const ownerDocument = this.ownerDocument;
    const ownerWindow = ownerDocument.defaultView;
    if (!ownerWindow) return;
    if (
      this.virtualScrollRaf !== undefined &&
      this.virtualScrollRafWindow === ownerWindow &&
      this.virtualScrollRafDocument === ownerDocument
    ) {
      return;
    }
    this.cancelVirtualScrollFrame();
    const generation = this.ownerRealmGeneration;
    let handle = 0;
    handle = ownerWindow.requestAnimationFrame(() => {
      if (
        this.virtualScrollRaf !== handle ||
        this.virtualScrollRafWindow !== ownerWindow ||
        this.virtualScrollRafDocument !== ownerDocument ||
        this.ownerRealmGeneration !== generation ||
        !this.isConnected ||
        this.ownerDocument !== ownerDocument
      ) {
        return;
      }
      this.virtualScrollRaf = undefined;
      this.virtualScrollRafWindow = undefined;
      this.virtualScrollRafDocument = undefined;
      this.requestUpdate();
    });
    this.virtualScrollRaf = handle;
    this.virtualScrollRafWindow = ownerWindow;
    this.virtualScrollRafDocument = ownerDocument;
  };

  private cancelVirtualScrollFrame(): void {
    if (this.virtualScrollRaf !== undefined) {
      this.virtualScrollRafWindow?.cancelAnimationFrame(this.virtualScrollRaf);
    }
    this.virtualScrollRaf = undefined;
    this.virtualScrollRafWindow = undefined;
    this.virtualScrollRafDocument = undefined;
  }

  private syncGridObserver(): void {
    const grid = this.renderRoot?.querySelector<HTMLElement>('[part="grid"]');
    const virtualized = this.isVirtualized;
    const ownerDocument = this.ownerDocument;
    if (
      grid === this.observedGrid &&
      virtualized === this.observedGridVirtualized &&
      (!virtualized || this.gridResizeObserverDocument === ownerDocument)
    ) {
      return;
    }
    this.resetGridObserver();
    if (!this.isConnected) return;
    this.observedGrid = grid ?? undefined;
    this.observedGridVirtualized = virtualized;
    if (!grid || !virtualized) return;
    grid.addEventListener('scroll', this.onGridScroll, { passive: true });
    const ResizeObserverCtor = ownerDocument.defaultView?.ResizeObserver;
    if (!ResizeObserverCtor) return;
    const generation = this.ownerRealmGeneration;
    const observer = new ResizeObserverCtor(() => {
      if (
        this.gridResizeObserver !== observer ||
        this.gridResizeObserverDocument !== ownerDocument ||
        this.observedGrid !== grid ||
        this.ownerRealmGeneration !== generation ||
        !this.isConnected ||
        this.ownerDocument !== ownerDocument
      ) {
        return;
      }
      this.requestUpdate();
    });
    this.gridResizeObserver = observer;
    this.gridResizeObserverDocument = ownerDocument;
    observer.observe(grid);
  }

  private resetGridObserver(): void {
    this.observedGrid?.removeEventListener('scroll', this.onGridScroll);
    this.gridResizeObserver?.disconnect();
    this.gridResizeObserver = undefined;
    this.gridResizeObserverDocument = undefined;
    this.observedGrid = undefined;
    this.observedGridVirtualized = false;
    this.cancelVirtualScrollFrame();
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (this.isVirtualized && this.geometryProbe) this.geometryCache = undefined;
    this.syncGeometryProbe();
    if (!this.hasUpdated) {
      this.seedFirstRenderState(() => {
        this.hasLabelSlot = Array.from(this.children ?? []).some((el) => el.getAttribute('slot') === 'label');
        this.hasHintSlot = Array.from(this.children ?? []).some((el) => el.getAttribute('slot') === 'hint');
        this.hasErrorSlot = Array.from(this.children ?? []).some((el) => el.getAttribute('slot') === 'error');
      });
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.bindRenderedGeometryProbe();
    this.syncGridObserver();
    if (!changed.has('queryText') && !changed.has('groups')) {
      this.restorePendingGridFocus();
      return;
    }
    const buttons = this.optionButtons();
    if (buttons.length === 0) {
      // No options: the combobox must not reference a nonexistent descendant.
      this.searchEl?.removeAttribute('aria-activedescendant');
      if (this.pendingGridFocus) {
        this.pendingGridFocus = undefined;
        this.searchEl?.focus();
      }
      return;
    }
    if (this.pendingGridFocus) {
      const retainedIndex = this.pendingGridFocus.item
        ? this.flatItems.indexOf(this.pendingGridFocus.item)
        : -1;
      this.activeIndex = retainedIndex >= 0
        ? retainedIndex
        : Math.max(0, Math.min(this.pendingGridFocus.index, this.flatItems.length - 1));
      this.pendingGridFocus = {
        item: this.flatItems[this.activeIndex],
        index: this.activeIndex,
      };
    } else if (!this.isVirtualized && this.activeIndex >= buttons.length) {
      this.activeIndex = 0;
    }
    // The grid just re-rendered: re-assert roving focus separately from committed selection.
    this.setActiveIndex(this.activeIndex, false);
    this.syncSelectedProjection();
    this.restorePendingGridFocus();
  }

  private restorePendingGridFocus(): void {
    if (!this.pendingGridFocus) return;
    const target = this.renderRoot.querySelector<HTMLButtonElement>(
      `[part="emoji"][data-index="${this.activeIndex}"]`,
    );
    if (!target) return;
    this.pendingGridFocus = undefined;
    target.focus();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.releasePeerErrorAnnouncementSink();
    this.resetOwnerRealmResources();
  }

  /** Announces the peer-load failure once, through the owning document's shared assertive sink. */
  private announcePeerLoadFailure(): void {
    if (!this.isConnected) return;
    if (this.peerErrorAnnouncementSink?.element.ownerDocument !== this.ownerDocument) {
      this.releasePeerErrorAnnouncementSink();
      this.peerErrorAnnouncementSink = acquireAnnouncementSink('assertive', {
        document: this.ownerDocument,
        source: this,
      });
    }
    this.peerErrorAnnouncementSink?.announce(this.localize('emojiPickerLoadError'));
  }

  private releasePeerErrorAnnouncementSink(): void {
    this.peerErrorAnnouncementSink?.release();
    this.peerErrorAnnouncementSink = undefined;
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.resetOwnerRealmResources();
  }

  private resetOwnerRealmResources(): void {
    this.ownerRealmGeneration += 1;
    this.pendingGridFocus = undefined;
    this.resetGridObserver();
    // The probe node itself stays in the shadow root (it is re-observed on reconnect); only the
    // observer is torn down, so nothing keeps measuring while detached.
    this.resetGeometryObserver();
  }

  private renderEmojiButton(
    item: EmojiPickerItem,
    itemIndex: number,
    total: number,
    selectedIndex: number,
  ): TemplateResult {
    return html`<button
      type="button"
      part="emoji"
      id=${`${this.gridId}-item-${itemIndex}`}
      data-index=${itemIndex}
      role="option"
      tabindex=${live(itemIndex === this.activeIndex ? '0' : '-1')}
      aria-selected=${live(itemIndex === selectedIndex ? 'true' : 'false')}
      aria-setsize=${total}
      aria-posinset=${itemIndex + 1}
      aria-label=${item.name}
      ?data-active=${live(itemIndex === this.activeIndex)}
      ?disabled=${this.effectiveDisabled}
      @click=${() => this.pick(item)}
      @focusin=${this.onGridFocusIn}
      @mouseenter=${() => this.onEmojiPointerEnter(itemIndex)}
    >${item.emoji}</button>`;
  }

  private renderVirtualRows(): TemplateResult {
    const rows = this.virtualRows();
    const rowHeight = this.geometry().rowHeight;
    const grid = this.liveGeometryReady
      ? this.renderRoot?.querySelector<HTMLElement>('[part="grid"]')
      : undefined;
    const viewportHeight = grid?.clientHeight || 256;
    const start = Math.max(0, Math.floor(this.virtualScrollTop / rowHeight) - 3);
    const end = Math.min(rows.length, Math.ceil((this.virtualScrollTop + viewportHeight) / rowHeight) + 3);
    const total = this.flatItems.length;
    const selectedIndex = this.selectedIndex;
    return html`
      <div part="virtual-spacer" style=${`block-size: ${rows.length * rowHeight}px`}>
        ${rows.slice(start, end).map(
          (row, offset) => html`
            <div part="virtual-row" style=${`transform: translateY(${(start + offset) * rowHeight}px)`}>
              ${row.label ? html`<div part="group-label">${row.label}</div>` : html`<div part="virtual-label" aria-hidden="true"></div>`}
              <div part="virtual-items">
                ${row.items.map(({ item, index }) => this.renderEmojiButton(item, index, total, selectedIndex))}
              </div>
            </div>
          `,
        )}
      </div>
    `;
  }

  override render(): TemplateResult {
    const items = this.flatItems;
    const selectedIndex = this.selectedIndex;
    let index = -1;
    const hasLabel = this.hasLabelSlot || this.label.length > 0;
    const hasHint = this.hasHintSlot || this.hint.length > 0;
    const hasError = this.hasErrorSlot || this.errorText.length > 0;
    const describedBy = [hasError ? this.errorId : '', hasHint ? this.hintId : ''].filter(Boolean).join(' ');
    const invalid = this.touched && !this.internals.validity.valid;
    const gridLabel = hostAriaLabel(this);
    return html`
      <div part="form-control">
        <div part="form-control-label" id=${this.labelId} ?hidden=${!hasLabel}>
          ${this.label}<slot name="label" @slotchange=${this.onLabelSlotChange}></slot>
        </div>
        <div part="base">
          <input
            part="search"
            type="search"
            role="combobox"
            aria-expanded="true"
            aria-autocomplete="list"
            .value=${this.queryText}
            aria-label=${this.localize('emojiPickerSearchLabel')}
            aria-controls=${this.gridId}
            ?disabled=${this.effectiveDisabled}
            @input=${this.onSearchInput}
            @keydown=${this.onNavigationKeyDown}
            @focus=${this.onSearchFocus}
            @blur=${this.onSearchBlur}
          />
          <div
            part="grid"
            id=${this.gridId}
            role="listbox"
            aria-label=${gridLabel ?? (hasLabel ? nothing : this.localize('emojiPickerGridLabel'))}
            aria-labelledby=${gridLabel === null && hasLabel ? this.labelId : nothing}
            aria-describedby=${describedBy || nothing}
            aria-required=${this.required ? 'true' : 'false'}
            aria-invalid=${invalid ? 'true' : 'false'}
            @keydown=${this.onNavigationKeyDown}
            @focusin=${this.onGridFocusIn}
          >
            ${items.length === 0
              ? this.peerLoadFailed
                ? html`<div
                    part="load-error"
                    role="option"
                    aria-selected="false"
                    aria-disabled="true"
                  >${this.localize('emojiPickerLoadError')}</div>`
                : html`<div
                    part="empty"
                    role="option"
                    aria-selected="false"
                    aria-disabled="true"
                  >${this.localize('emojiPickerEmpty')}</div>`
              : this.isVirtualized
                ? this.renderVirtualRows()
                : this.filteredGroups.map(
                  (group) => html`
                    <div part="group-label">${this.groupLabel(group)}</div>
                    ${group.emojis.map((item) => {
                      index++;
                      return this.renderEmojiButton(item, index, items.length, selectedIndex);
                    })}
                  `,
                )}
          </div>
        </div>
        <div part="hint" id=${this.hintId} ?hidden=${!hasHint}>
          ${this.hint}<slot name="hint" @slotchange=${this.onHintSlotChange}></slot>
        </div>
        <div part="error" id=${this.errorId} ?hidden=${!hasError}>
          ${this.errorText}<slot name="error" @slotchange=${this.onErrorSlotChange}></slot>
        </div>
      </div>
      <div data-probe="root" aria-hidden="true">
        <div data-probe="item"></div>
        <div data-probe="gap"></div>
        <div data-probe="row"></div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-emoji-picker': LyraEmojiPicker;
  }
}

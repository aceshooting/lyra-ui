import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { optionalLiteralSetConverter } from '../../../internal/converters.js';
import {
  normalizeReflectedOptionalSize,
  optionalSizeConverter,
  type LyraAppearance,
  type LyraSize,
} from '../../../internal/variants.js';
import { sizes } from '../../../internal/sizes.styles.js';
import {
  deferredPlaceReady as place,
  type DeferredOperationHandle,
} from '../../../internal/anchored-overlay-runtime.js';
import { nextId } from '../../../internal/a11y.js';
import { resolveEffectivePositioningStrategy } from '../../../internal/positioning-strategy.js';
import { buildCsv, downloadBlob, type LyraCsvColumn } from './csv.js';
import { styles } from './export-button.styles.js';
import { activeElementIn } from '../../../internal/active-element.js';
import {
  activateNonmodalOverlay,
  type OverlayHandle,
} from '../../../internal/nonmodal-overlay-manager.js';
import {
  getOwnDataDescriptor,
  MISSING_OWN_DATA_DESCRIPTOR,
  UNSAFE_OWN_DATA_DESCRIPTOR,
} from '../../../internal/data-descriptors.js';
import { acquireAnnouncementSink, type AnnouncementSink } from '../../../internal/announcer.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_exportButtonLabel, LYRA_DEFAULT_exportFormatMenuLabel, LYRA_DEFAULT_statusError } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type LyraExportFormat = 'csv' | 'json';

/** The export trigger's compact treatments. Unset preserves its established chrome. */
export type LyraExportButtonAppearance = Extract<LyraAppearance, 'outlined'> | 'quiet';

const EXPORT_BUTTON_APPEARANCE = optionalLiteralSetConverter<LyraExportButtonAppearance>([
  'outlined',
  'quiet',
]);

export interface LyraExportFormatDescriptor {
  /** Stable format id carried through `lr-export`. */
  readonly formatId: string;
  /** Consumer-supplied, already-localized menu label. */
  readonly label: string;
  /** Optional consumer-supplied secondary menu text. */
  readonly description?: string;
  /** Optional metadata for the external export handler. */
  readonly extension?: string;
}

export type LyraExportFormatOption = LyraExportFormat | LyraExportFormatDescriptor;

const MAX_EXPORT_FORMATS = 10_000;

function queueDocumentMicrotask(ownerDocument: Document, callback: VoidFunction): void {
  const ownerWindow = ownerDocument.defaultView;
  if (ownerWindow) {
    ownerWindow.queueMicrotask(callback);
    return;
  }
  void Promise.resolve().then(callback);
}

function formatArrayLength(value: unknown): { source: object; length: number } | undefined {
  try {
    if (!Array.isArray(value)) return undefined;
    const length = getOwnDataDescriptor(value, 'length');
    if (
      length === MISSING_OWN_DATA_DESCRIPTOR ||
      length === UNSAFE_OWN_DATA_DESCRIPTOR ||
      typeof length.value !== 'number' ||
      !Number.isSafeInteger(length.value) ||
      length.value < 0
    )
      return undefined;
    return { source: value, length: Math.min(length.value, MAX_EXPORT_FORMATS) };
  } catch {
    return undefined;
  }
}

/** Projects the fields that menu rendering and export events subsequently consume. */
function projectExportFormat(value: unknown): LyraExportFormatOption | undefined {
  if (value === 'csv' || value === 'json') return value;
  if (value === null || typeof value !== 'object') return undefined;
  const formatId = getOwnDataDescriptor(value, 'formatId');
  const label = getOwnDataDescriptor(value, 'label');
  if (
    formatId === MISSING_OWN_DATA_DESCRIPTOR ||
    formatId === UNSAFE_OWN_DATA_DESCRIPTOR ||
    label === MISSING_OWN_DATA_DESCRIPTOR ||
    label === UNSAFE_OWN_DATA_DESCRIPTOR ||
    typeof formatId.value !== 'string' ||
    formatId.value.trim().length === 0 ||
    typeof label.value !== 'string' ||
    label.value.trim().length === 0
  )
    return undefined;
  const description = getOwnDataDescriptor(value, 'description');
  const extension = getOwnDataDescriptor(value, 'extension');
  return Object.freeze({
    formatId: formatId.value,
    label: label.value,
    ...(description !== MISSING_OWN_DATA_DESCRIPTOR &&
    description !== UNSAFE_OWN_DATA_DESCRIPTOR &&
    typeof description.value === 'string'
      ? { description: description.value }
      : {}),
    ...(extension !== MISSING_OWN_DATA_DESCRIPTOR &&
    extension !== UNSAFE_OWN_DATA_DESCRIPTOR &&
    typeof extension.value === 'string'
      ? { extension: extension.value }
      : {}),
  });
}

export interface LyraExportButtonEventMap {
  'lr-export': CustomEvent<{ readonly format: string }>;
  'lr-export-complete': CustomEvent<{ readonly format: LyraExportFormat }>;
  'lr-export-error': CustomEvent<{ readonly format: LyraExportFormat; readonly error: unknown }>;
  'lr-show': CustomEvent<null>;
  'lr-hide': CustomEvent<null>;
}
/**
 * `<lr-export-button>` — a CSV/JSON download button, single-format or a
 * format-choice menu. First-party invention; consolidates the ad-hoc
 * "export CSV" button pattern common across dashboard UIs.
 * Format ids are unique, nonempty occurrence identities. Malformed options and later duplicate
 * ids are omitted before menu state, focus reconciliation, or export events; the first wins.
 *
 * Data reaches a built-in CSV/JSON download two ways, both resolved at download time rather than
 * at assignment time: the eager `rows` property (read after the cancelable `lr-export` event, so a
 * listener may assign it from inside its own handler) and the lazy `getRows` callback, which
 * replaces `rows` for that download and lets a consumer export a collection it already holds --
 * an `<lr-table>`'s `viewRows`, for instance -- without materializing a second copy here.
 *
 * @customElement lr-export-button
 * @event lr-export - `detail: { format }`, cancelable — call `preventDefault()`
 *   to substitute the built-in client-side download with a server-generated one. A listener that
 *   lets the built-in download proceed may still supply its data from inside the handler: the rows
 *   are read *after* this dispatch, so assigning `.rows` here is honoured, and a `getRows`
 *   callback is consulted at the same point.
 * @event lr-export-complete - Fired after a non-cancelled download completes.
 * @event lr-export-error - Fired when a built-in CSV/JSON export cannot be serialized or
 *   downloaded. `detail: { format, error }`. The same failure is also announced through the
 *   shared light-DOM live region and marks the trigger with the `trigger-error` part token, so a
 *   screen-reader user and a sighted user both learn the export failed without needing to listen
 *   for this event.
 * @event lr-show - The format menu is about to open, however `open` became true. Cancelable —
 *   `preventDefault()` leaves it closed. Not fired for markup that renders open from the start.
 * @event lr-hide - The format menu is about to close. Cancelable on the same terms as `lr-show`.
 *   A close this component imposes on itself (disablement, `loading`, or a format list collapsing
 *   to one entry) emits no lifecycle event and therefore offers no veto point.
 * @csspart trigger - The button that triggers the export (or opens the format menu).
 * @csspart trigger-error - Present alongside `trigger` after a built-in CSV/JSON export fails,
 *   until the next export attempt. Style with `::part(trigger-error)`.
 * @csspart menu - The format-choice menu, shown when more than one format is configured.
 * @csspart menu-item - A single format option inside the menu.
 * @csspart format-label - A format option's primary label.
 * @csspart format-description - A custom format option's optional secondary text.
 * @cssprop [--lr-overlay-surface=var(--lr-color-surface-overlay)] - Shared floating-surface fill,
 * on the menu popup.
 * @cssprop [--lr-overlay-border=var(--lr-color-border)] - Shared floating-surface edge colour, on
 * the menu popup.
 * @cssprop [--lr-overlay-radius=var(--lr-radius)] - Shared floating-surface corner radius, on
 * the menu popup.
 * @cssprop [--lr-overlay-shadow-anchored=var(--lr-shadow-m)] - Elevation of the anchored surface.
 * @cssprop --lr-positioning-strategy - Cascading `absolute`/`fixed` override for the format
 *   menu's `fixed` default, read from computed style when it is (re)positioned. Set it once on
 *   `:root`, a theme, or one clipping ancestor to change every unset export button beneath it; an
 *   unrecognized value falls back to `fixed`.
 * @cssprop --lr-export-button-background - Trigger fill at rest. Overrides whatever the current
 *   `appearance` resolves to, leaving every other paint untouched.
 * @cssprop --lr-export-button-color - Trigger label and icon colour at rest. The escape hatch for
 *   `appearance="outlined"`, which paints the label `--lr-color-brand` and has no `variant` of its
 *   own to return it to neutral text.
 * @cssprop --lr-export-button-border - Trigger edge colour at rest.
 * @cssprop --lr-export-button-hover-background - Trigger fill on hover.
 * @cssprop --lr-export-button-hover-color - Trigger label and icon colour on hover.
 * @cssprop --lr-export-button-hover-border - Trigger edge colour on hover.
 * @cssprop --lr-export-button-active-background - Trigger fill while pressed.
 * @cssprop --lr-export-button-active-color - Trigger label and icon colour while pressed.
 * @cssprop --lr-export-button-active-border - Trigger edge colour while pressed.
 * @property size - Optional density on the shared `2xs` through `xl` ladder, including the
 *   `small`/`medium`/`large` aliases. It changes the trigger and menu-row typography and padding;
 *   the 40px default hit-area floor remains in place. Unset preserves the established geometry.
 * @property appearance - Optional `outlined` or `quiet` trigger treatment. Unset preserves the
 *   established surface, border, and text colors.
 * @status stable
 * @since 4.0.0
 */
export class LyraExportButton extends LyraElement<LyraExportButtonEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    exportButtonLabel: LYRA_DEFAULT_exportButtonLabel,
    exportFormatMenuLabel: LYRA_DEFAULT_exportFormatMenuLabel,
    statusError: LYRA_DEFAULT_statusError,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, sizes, styles];

  static override properties = {
    rows: { attribute: false, noAccessor: true },
    columns: { attribute: false, noAccessor: true },
    formats: { attribute: false, noAccessor: true },
  };

  private _rows: readonly Readonly<Record<string, unknown>>[] = Object.freeze([]);

  /** Shallow frozen row snapshots. Nested cell values remain caller-owned opaque data.
   *
   *  Read late, not early: the built-in download serializes whatever this holds *after* the
   *  cancelable `lr-export` event has been dispatched, so a listener may assign `.rows`
   *  synchronously inside its own handler and that assignment is the data that gets downloaded.
   *  A consumer that would rather not keep an eagerly-materialized copy in the element at all
   *  sets {@link getRows} instead, which is consulted at the same point. */
  get rows(): readonly Readonly<Record<string, unknown>>[] {
    return this._rows;
  }

  set rows(next: readonly Readonly<Record<string, unknown>>[]) {
    const previous = this._rows;
    const source = Array.isArray(next) ? next : [];
    this._rows = Object.freeze(source.map((row) => Object.freeze({ ...row })));
    this.requestUpdate('rows', previous);
  }

  /** Column allow-list (and CSV header labels) for both export formats. Left
   *  at its default empty array, both formats fall back to the union of the
   *  rows' own keys instead (see `effectiveColumns()`), rather than CSV
   *  degrading to a blank file while only JSON had a fallback. */
  private _columns: readonly Readonly<LyraCsvColumn>[] = Object.freeze([]);

  get columns(): readonly Readonly<LyraCsvColumn>[] {
    return this._columns;
  }

  set columns(next: readonly LyraCsvColumn[]) {
    const previous = this._columns;
    const source = Array.isArray(next) ? next : [];
    this._columns = Object.freeze(source.map((column) => Object.freeze({ ...column })));
    this.requestUpdate('columns', previous);
  }

  /** Lazy row source, consulted only when a built-in CSV/JSON download is actually about to be
   *  built -- after the cancelable `lr-export` event was not prevented, and never for a custom
   *  format this component does not serialize itself. When set, it fully replaces {@link rows}
   *  for that download (the eager property is not merged into or read alongside it), so a
   *  consumer holding a large or derived collection elsewhere -- an `<lr-table>`'s `viewRows`,
   *  say -- can export exactly what is on screen without copying it into this element first and
   *  keeping it live there:
   *
   *  ```ts
   *  exportButton.getRows = () => table.viewRows as readonly Record<string, unknown>[];
   *  ```
   *
   *  A non-array return is treated as no rows, matching how `rows` normalizes one. A callback
   *  that throws is reported through `lr-export-error` and the shared failure announcement, the
   *  same as any other export that could not be produced -- an export whose data could not be
   *  collected has failed, and silently downloading an empty file would hide that. */
  @property({ attribute: false }) getRows?: () => readonly Record<string, unknown>[];

  @property() filename = 'export';
  /** Prepends a UTF-8 byte-order mark (U+FEFF) to the built-in CSV download only. Excel on
   *  Windows ignores a downloaded file's MIME charset and decodes a BOM-less CSV with the
   *  system ANSI code page, so accented, Arabic, CJK, and typographic characters render as
   *  mojibake; the BOM makes Excel detect UTF-8 and decode correctly. Google Sheets,
   *  LibreOffice, and Numbers already sniff UTF-8 correctly with or without it. Never applies to
   *  the built-in JSON download -- RFC 8259 forbids a BOM there. */
  @property({ type: Boolean, reflect: true }) bom = false;
  private _formats: readonly LyraExportFormatOption[] = Object.freeze(['csv']);

  /** Format choices keyed by unique, nonempty `formatId`; the first duplicate wins. An empty or
   * fully rejected list disables the trigger because there is no export action to perform. */
  get formats(): readonly LyraExportFormatOption[] {
    return this._formats;
  }

  set formats(next: readonly LyraExportFormatOption[]) {
    const previous = this._formats;
    const source = formatArrayLength(next);
    const seen = new Set<string>();
    const formats: LyraExportFormatOption[] = [];
    for (let index = 0; source && index < source.length; index += 1) {
      const descriptor = getOwnDataDescriptor(source.source, String(index));
      if (descriptor === MISSING_OWN_DATA_DESCRIPTOR || descriptor === UNSAFE_OWN_DATA_DESCRIPTOR) continue;
      const snapshot = projectExportFormat(descriptor.value);
      if (!snapshot) continue;
      const id = typeof snapshot === 'string' ? snapshot : snapshot.formatId;
      if (typeof id !== 'string' || id.trim() === '' || seen.has(id)) continue;
      seen.add(id);
      formats.push(snapshot);
    }
    this._formats = Object.freeze(formats);
    this.requestUpdate('formats', previous);
  }

  private _size?: LyraSize;

  /** Optional density tier on the shared ladder. Omission preserves the original trigger geometry. */
  @property({ reflect: true, converter: optionalSizeConverter })
  get size(): LyraSize | undefined {
    return this._size;
  }
  set size(next: LyraSize | undefined) {
    const normalized = normalizeReflectedOptionalSize(this, next);
    const old = this._size;
    if (old === normalized) return;
    this._size = normalized;
    this.requestUpdate('size', old);
  }

  /** Optional compact trigger treatment. Omission preserves the original trigger chrome. */
  @property({ reflect: true, converter: EXPORT_BUTTON_APPEARANCE })
  get appearance(): LyraExportButtonAppearance | undefined {
    return this._appearance;
  }
  set appearance(next: LyraExportButtonAppearance | undefined) {
    const normalized = EXPORT_BUTTON_APPEARANCE.normalizeReflected(this, 'appearance', next);
    const old = this._appearance;
    if (old === normalized) return;
    this._appearance = normalized;
    this.requestUpdate('appearance', old);
  }

  private _appearance?: LyraExportButtonAppearance;

  @property({ type: Boolean, reflect: true }) disabled = false;
  /** Controlled busy state for async/server-generated exports. */
  @property({ type: Boolean, reflect: true }) loading = false;
  /** Visible trigger button text. It also feeds the format menu's `aria-label` when no host
   * `aria-label` supplies a more specific name. `undefined` uses the localized default; every
   * supplied string, including `''` and `'Export'`, is caller-owned visible copy. An empty or
   * whitespace-only visible label retains the localized default as the trigger's accessible name. */
  @property() label?: string;
  /** Accessible name forwarded from the host to the native trigger button.
   * When unset, a nonempty visible `label` provides the name; an empty visible label uses the
   * localized default. An explicit empty `aria-label` remains authoritative by presence. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;
  @property({ type: Boolean, reflect: true }) open = false;

  @query('[part~="trigger"]') private triggerEl?: HTMLButtonElement;
  @query('[part="menu"]') private menuEl?: HTMLElement;

  /** True from a failed built-in CSV/JSON export until the next export attempt starts; drives
   *  the visible `trigger-error` part token. */
  @state() private exportFailed = false;
  /** Handle on the shared light-DOM live region export outcomes announce through -- a region
   *  rendered inside this shadow root is not reliably announced. Acquired on connect, not on the
   *  first failure, so assistive tech is already observing before any text arrives. */
  private sink?: AnnouncementSink;

  private readonly menuId = nextId('export-menu');
  private cleanup?: DeferredOperationHandle;
  private overlay?: OverlayHandle;
  private menuPositioned = false;
  private pointerDocument?: Document;
  private connectionGeneration = 0;
  private connectedDocument?: Document;
  private pendingDisconnectDocument?: Document;
  private _isFirstUpdate = true;
  private openVetoed = false;
  /** Which menu item to focus the next time `open` flips true; reset after use. */
  private pendingMenuFocusIndex = 0;
  private formatsFocusSnapshot?: { index: number; id: string };
  private forcedMenuClose?: 'invalid-open' | 'formats' | 'state';
  /** Tracks only the temporary focus-rescue tabindex this component added itself. */
  private injectedHostTabIndex = false;
  private restoreFocusOnMenuClose = false;

  override connectedCallback(): void {
    const pendingDisconnectDocument = this.pendingDisconnectDocument;
    this.pendingDisconnectDocument = undefined;
    this.connectionGeneration += 1;
    this.connectedDocument = this.ownerDocument;
    super.connectedCallback();
    this.sink ??= acquireAnnouncementSink('polite', {
      document: this.ownerDocument,
      source: this,
    });
    if (pendingDisconnectDocument) {
      if (pendingDisconnectDocument === this.ownerDocument) {
        this.deactivateMenuOverlay(false);
        this.restoreFocusOnMenuClose = false;
        this.open = false;
        return;
      }
      if (this.hasUpdated && this.open)
        this.scheduleAfterUpdate(this.syncMenuOverlay, 'export-button-menu-overlay');
      return;
    }
    if (this.hasUpdated && this.open)
      this.scheduleAfterUpdate(this.syncMenuOverlay, 'export-button-menu-overlay');
  }

  override disconnectedCallback(): void {
    const generation = ++this.connectionGeneration;
    const connectedDocument = this.connectedDocument;
    const disconnectDocument = connectedDocument ?? this.ownerDocument;
    this.pendingDisconnectDocument = disconnectDocument;
    super.disconnectedCallback();
    this.cleanup?.();
    this.cleanup = undefined;
    this.menuPositioned = false;
    this.unbindDocumentPointer();
    this.overlay?.suspend();
    this.restoreFocusOnMenuClose = false;
    this.sink?.release();
    this.sink = undefined;
    queueDocumentMicrotask(disconnectDocument, () => {
      if (
        this.connectionGeneration !== generation ||
        this.isConnected ||
        this.pendingDisconnectDocument !== disconnectDocument
      )
        return;
      this.pendingDisconnectDocument = undefined;
      this.deactivateMenuOverlay(false);
      this.restoreFocusOnMenuClose = false;
      this.open = false;
    });
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.cleanup?.();
    this.cleanup = undefined;
    this.unbindDocumentPointer();
    this.overlay?.suspend();
    this.sink?.release();
    this.sink = undefined;
  }

  private bindDocumentPointer(): void {
    if (!this.isConnected) return;
    const owner = this.ownerDocument;
    if (this.pointerDocument === owner) return;
    this.unbindDocumentPointer();
    owner.addEventListener('pointerdown', this.onDocPointer);
    this.pointerDocument = owner;
  }

  private unbindDocumentPointer(): void {
    this.pointerDocument?.removeEventListener('pointerdown', this.onDocPointer);
    this.pointerDocument = undefined;
  }

  private onDocPointer = (e: PointerEvent): void => {
    if (e.composedPath().includes(this)) return;
    if (this.overlay?.isActive()) this.overlay.dismissBackdrop();
    else this.closeMenu();
  };

  private openMenu(): void {
    if (this.open) return;
    this.open = true;
  }

  private closeMenu(restoreFocus = false): void {
    if (!this.open) return;
    this.restoreFocusOnMenuClose ||= restoreFocus;
    this.open = false;
  }

  private activateMenuOverlay(): void {
    if (this.overlay?.isActive()) {
      this.overlay.resume();
      return;
    }
    this.overlay = activateNonmodalOverlay({
      host: this,
      panel: () => this.menuEl ?? null,
      onEscape: () => this.closeMenu(true),
      onBackdrop: () => this.closeMenu(),
      onTab: () => this.closeMenu(),
      restoreFocusTo: () => this.triggerEl ?? null,
    });
  }

  private deactivateMenuOverlay(restoreFocus: boolean): void {
    const overlay = this.overlay;
    this.overlay = undefined;
    overlay?.deactivate({ restoreFocus });
    this.unbindDocumentPointer();
  }

  private syncMenuOverlay = (): void => {
    this.cleanup?.();
    this.cleanup = undefined;
    this.menuPositioned = false;
    this.unbindDocumentPointer();
    if (!this.open || !this.isConnected) {
      const restoreFocus = this.restoreFocusOnMenuClose;
      this.restoreFocusOnMenuClose = false;
      this.deactivateMenuOverlay(restoreFocus);
      return;
    }
    this.activateMenuOverlay();
    this.bindDocumentPointer();
    const anchor = this.triggerEl;
    const menu = this.menuEl;
    const ownerDocument = this.ownerDocument;
    if (!anchor || !menu) return;
    const placement = place(anchor, menu, {
      strategy: resolveEffectivePositioningStrategy(this, undefined, 'fixed'),
    });
    this.cleanup = placement;
    void placement.ready.then((positioned) => {
      if (
        this.cleanup !== placement ||
        !this.open ||
        !this.isConnected ||
        this.ownerDocument !== ownerDocument
      )
        return;
      if (!positioned) {
        this.forcedMenuClose = 'state';
        this.open = false;
        return;
      }
      this.menuPositioned = true;
      this.focusMenuItem(this.pendingMenuFocusIndex);
      this.pendingMenuFocusIndex = 0;
    });
  };

  private menuItemEls(): HTMLButtonElement[] {
    return Array.from(this.renderRoot.querySelectorAll<HTMLButtonElement>('[part="menu-item"]'));
  }

  /** Focuses the menu item at `index` (clamped), if the menu is already open and rendered. */
  private focusMenuItem(index: number): void {
    const items = this.menuItemEls();
    if (items.length === 0) return;
    items[Math.max(0, Math.min(items.length - 1, index))]?.focus();
  }

  /** Opens the menu (if closed) and focuses `index`, or moves focus there directly if already open. */
  private focusMenuItemOnOpen(index: number): void {
    if (this.open && this.menuPositioned) {
      this.focusMenuItem(index);
    } else {
      this.pendingMenuFocusIndex = index;
      if (!this.open) this.openMenu();
    }
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.formats.length <= 1 || this.disabled || this.loading) return;

    const items = this.menuItemEls();
    const currentIndex = items.indexOf(e.target as HTMLButtonElement);

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.focusMenuItemOnOpen(currentIndex === -1 ? 0 : currentIndex + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.focusMenuItemOnOpen(currentIndex === -1 ? items.length - 1 : currentIndex - 1);
        break;
      case 'Home':
        if (this.open) {
          e.preventDefault();
          this.focusMenuItem(0);
        }
        break;
      case 'End':
        if (this.open) {
          e.preventDefault();
          this.focusMenuItem(items.length - 1);
        }
        break;
    }
  };

  protected override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    // Single delegated listener catches Escape/Arrow/Home/End from the
    // trigger button or any menu-item inside this shadow root.
    this.renderRoot.addEventListener('keydown', this.onKeyDown as EventListener);
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this._isFirstUpdate = !this.hasUpdated;
    this.setAttribute('aria-busy', String(this.loading));
    if (
      (changed.has('disabled') || changed.has('loading')) &&
      !this.disabled &&
      !this.loading &&
      this.injectedHostTabIndex
    ) {
      if (this.getAttribute('tabindex') === '-1') this.removeAttribute('tabindex');
      this.injectedHostTabIndex = false;
    }
    if ((changed.has('disabled') || changed.has('loading')) && (this.disabled || this.loading)) {
      const active = activeElementIn(this.shadowRoot);
      if (
        active === this.triggerEl ||
        active?.getAttribute('part') === 'menu-item'
      ) {
        if (!this.hasAttribute('tabindex')) {
          this.tabIndex = -1;
          this.injectedHostTabIndex = true;
        }
        const ownerHTMLElement = this.ownerDocument.defaultView?.HTMLElement;
        const nativeFocus = ownerHTMLElement
          ? Reflect.get(ownerHTMLElement.prototype, 'focus', this)
          : undefined;
        if (typeof nativeFocus === 'function') nativeFocus.call(this, { preventScroll: true });
      }
      if (this.open) {
        this.open = false;
        this.forcedMenuClose = 'state';
      }
    }
    if (changed.has('formats')) {
      const active = activeElementIn(this.shadowRoot);
      const items = this.menuItemEls();
      const index = items.indexOf(active as HTMLButtonElement);
      const previousFormats = changed.get('formats') as readonly LyraExportFormatOption[] | undefined;
      const previous = previousFormats?.[index];
      this.formatsFocusSnapshot =
        index >= 0 && previous ? { index, id: this.formatId(previous) } : undefined;
    }
    if (this.open && this.formats.length <= 1) {
      const previousOpen = changed.get('open');
      this.forcedMenuClose =
        changed.has('formats') && (changed.get('formats') as readonly LyraExportFormatOption[] | undefined)?.length
          ? 'formats'
          : previousOpen === false || previousOpen === undefined
            ? 'invalid-open'
            : 'state';
      this.open = false;
    }
    this.announceMenuTransition(changed);
  }

  /**
   * Emits the cancelable `lr-show`/`lr-hide` veto point for this update's `open` transition.
   *
   * It runs at the end of `willUpdate()` -- after the forced closes above, and still ahead of
   * render and attribute reflection -- so restoring `open` on a veto leaves the menu, the
   * reflected attribute and the property agreeing without a visible open-then-close flash. A close
   * this component imposed on itself (disablement, loading, or a format list collapsing to one
   * entry) is never offered as a veto: no listener may hold a menu open that has nothing to show.
   */
  private announceMenuTransition(changed: PropertyValues): void {
    this.openVetoed = false;
    if (!changed.has('open') || this._isFirstUpdate || this.forcedMenuClose) return;
    const name = this.open ? 'lr-show' : 'lr-hide';
    if (!this.emit(name, null, { cancelable: true }).defaultPrevented) return;
    this.openVetoed = true;
    this.open = !this.open;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const forcedMenuClose = this.forcedMenuClose;
    this.forcedMenuClose = undefined;
    // A vetoed transition already put `open` back during willUpdate(), so `changed` still names it
    // while nothing actually moved; rebuilding the popup machinery here would undo the veto.
    if (
      (changed.has('open') || forcedMenuClose === 'formats' || forcedMenuClose === 'state') &&
      !this.openVetoed
    ) {
      this.syncMenuOverlay();
    } else if (this.openVetoed) {
      // A vetoed close remains a live menu and keeps its existing overlay handle/return target.
      this.restoreFocusOnMenuClose = false;
    }
    if (changed.has('formats') && this.formatsFocusSnapshot) {
      const { index, id } = this.formatsFocusSnapshot;
      this.formatsFocusSnapshot = undefined;
      // Collapsing to one format changes the reactive open property. Defer the whole focus
      // restoration until this update completes so closeMenu() cannot schedule an update from
      // inside updated() and trigger Lit's change-in-update warning.
      this.scheduleAfterUpdate(() => {
        if (this.formats.length <= 1) {
          this.closeMenu();
          this.triggerEl?.focus();
        } else if (this.open) {
          const nextIndex = this.formats.findIndex((format) => this.formatId(format) === id);
          this.focusMenuItemOnOpen(nextIndex >= 0 ? nextIndex : index);
        }
      });
    }
  }

  /** Falls back to the union of the rows' own keys when `columns` is left at
   *  its default empty array, so an unconfigured export still produces a
   *  proper header + data file instead of blank lines. Both `rowsForExport()`
   *  and the CSV branch of `doExport()` share this same fallback, rather than
   *  only the JSON path having one. Takes the rows the current download resolved rather than
   *  reading `this.rows`, so a lazy `getRows` source derives its own header row instead of one
   *  built from a stale eager property. */
  private effectiveColumns(rows: readonly Readonly<Record<string, unknown>>[]): readonly Readonly<LyraCsvColumn>[] {
    if (this.columns.length > 0) return this.columns;
    const keys = new Set<string>();
    for (const row of rows) {
      for (const key of Object.keys(row)) keys.add(key);
    }
    return Array.from(keys, (key) => ({ key, label: key }));
  }

  /** The rows one download serializes: the lazy {@link getRows} source when set, otherwise the
   *  eagerly-assigned {@link rows}. Called from inside `doExport()`'s try block, so a throwing
   *  callback lands on the existing `lr-export-error` path rather than escaping the click
   *  handler. A non-array return normalizes to no rows exactly as the `rows` setter does. */
  private rowsToExport(): readonly Readonly<Record<string, unknown>>[] {
    if (this.getRows === undefined) return this.rows;
    const supplied = this.getRows();
    return Array.isArray(supplied) ? supplied : [];
  }

  /** Applies the same `columns` allow-list CSV exports use, so JSON can't leak fields CSV hides. */
  private rowsForExport(rows: readonly Readonly<Record<string, unknown>>[]): Record<string, unknown>[] {
    const keys = this.effectiveColumns(rows).map((c) => c.key);
    return rows.map((row) => {
      const picked = Object.create(null) as Record<string, unknown>;
      for (const key of keys) picked[key] = row[key];
      return picked;
    });
  }

  private formatId(format: LyraExportFormatOption): string {
    return typeof format === 'string' ? format : format.formatId;
  }

  private formatLabel(format: LyraExportFormatOption): string {
    return typeof format === 'string' ? format.toUpperCase() : format.label;
  }

  private doExport(formatOption: LyraExportFormatOption): void {
    if (this.disabled || this.loading) return;
    this.closeMenu();
    this.triggerEl?.focus();
    // A fresh attempt clears any earlier failure's visible/announced state, whether or not this
    // attempt reaches the try block below.
    this.exportFailed = false;
    const format = this.formatId(formatOption);
    const ev = this.emit('lr-export', Object.freeze({ format }), { cancelable: true });
    if (ev.defaultPrevented) return;

    if (format !== 'csv' && format !== 'json') {
      // Custom formats are intentionally handler-only: Lyra owns the menu and
      // event contract but does not pull format-specific encoders into the base bundle.
      return;
    }
    try {
      // Resolved inside the try, and only here: the rows a built-in download serializes are read
      // after the veto point, so both a late `.rows` assignment from an `lr-export` listener and a
      // `getRows` callback see the same "collected at download time" contract.
      const rows = this.rowsToExport();
      if (format === 'csv') {
        downloadBlob(
          buildCsv(rows, this.effectiveColumns(rows), { bom: this.bom }),
          `${this.filename}.csv`,
          'text/csv;charset=utf-8;',
          this.ownerDocument,
        );
      } else {
        downloadBlob(
          JSON.stringify(this.rowsForExport(rows), null, 2),
          `${this.filename}.json`,
          'application/json',
          this.ownerDocument,
        );
      }
      this.emit('lr-export-complete', Object.freeze({ format }));
    } catch (error) {
      this.exportFailed = true;
      this.sink?.announce(this.localize('statusError'));
      this.emit('lr-export-error', Object.freeze({ format, error }));
    }
  }

  private onTriggerClick(): void {
    if (this.disabled || this.loading) return;
    if (this.formats.length === 0) return;
    if (this.formats.length === 1) this.doExport(this.formats[0]!);
    else this.open ? this.closeMenu() : this.openMenu();
  }

  /** Focuses the native trigger button. */
  override focus(options?: FocusOptions): void {
    this.triggerEl?.focus(options);
  }

  /** Removes focus from the native trigger button. */
  override blur(): void {
    this.triggerEl?.blur();
  }

  /** Activates the native trigger button. */
  override click(): void {
    this.triggerEl?.click();
  }

  /** Resolves `label`'s effective text: an explicit override wins verbatim; left at the
   *  built-in default it instead routes through `this.localize()` so a locale/`.strings`
   *  override applies without requiring `label` itself to be set. */
  private get effectiveLabel(): string {
    return this.label == null ? this.localize('exportButtonLabel') : this.label;
  }

  override render(): TemplateResult {
    const label = this.effectiveLabel;
    const labelNamesTrigger = label.trim().length > 0;
    const accessibleLabel =
      this.accessibleLabel ?? (labelNamesTrigger ? label : this.localize('exportButtonLabel'));
    const triggerAriaLabel =
      this.accessibleLabel !== null || !labelNamesTrigger ? accessibleLabel : nothing;
    return html`
      <button
        part=${this.exportFailed ? 'trigger trigger-error' : 'trigger'}
        type="button"
        ?disabled=${this.disabled || this.loading || this.formats.length === 0}
        aria-label=${triggerAriaLabel}
        aria-busy=${this.loading ? 'true' : 'false'}
        aria-haspopup=${this.formats.length > 1 ? 'menu' : nothing}
        aria-expanded=${this.formats.length > 1 ? (this.open ? 'true' : 'false') : nothing}
        aria-controls=${this.formats.length > 1 ? this.menuId : nothing}
        @click=${() => this.onTriggerClick()}
      >
        ${label}
      </button>
      ${this.formats.length > 1
        ? html`<div
            id=${this.menuId}
            part="menu"
            role="menu"
            aria-label=${this.localize('exportFormatMenuLabel', undefined, {
              label: accessibleLabel,
            })}
          >
            ${repeat(
              this.formats,
              (format) => this.formatId(format),
              (f) =>
                html`<button
                  part="menu-item"
                  role="menuitem"
                  type="button"
                  ?disabled=${this.disabled || this.loading}
                  @click=${() => this.doExport(f)}
                >
                  <span part="format-label">${this.formatLabel(f)}</span>
                  ${typeof f !== 'string' && f.description
                    ? html`<span part="format-description">${f.description}</span>`
                    : nothing}
                </button>`,
            )}
          </div>`
        : nothing}
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-export-button': LyraExportButton;
  }
}

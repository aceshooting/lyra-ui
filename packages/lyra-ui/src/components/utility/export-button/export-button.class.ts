import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, query } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { place } from '../../../internal/positioner.js';
import { nextId } from '../../../internal/a11y.js';
import { buildCsv, downloadBlob, type CsvColumn } from './csv.js';
import { styles } from './export-button.styles.js';
import { activeElementIn } from '../../../internal/active-element.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_exportButtonLabel, LYRA_DEFAULT_exportFormatMenuLabel } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type ExportFormat = 'csv' | 'json';

export interface ExportFormatDescriptor {
  /** Stable id carried through `lr-export`. */
  id: string;
  /** Consumer-supplied, already-localized menu label. */
  label: string;
  /** Optional consumer-supplied secondary menu text. */
  description?: string;
  /** Optional metadata for the external export handler. */
  extension?: string;
}

export type ExportFormatOption = ExportFormat | ExportFormatDescriptor;

export interface LyraExportButtonEventMap {
  'lr-export': CustomEvent<{ format: string }>;
  'lr-export-complete': CustomEvent<{ format: ExportFormat }>;
  'lr-export-error': CustomEvent<{ format: ExportFormat; error: unknown }>;
  'lr-show': CustomEvent<undefined>;
  'lr-hide': CustomEvent<undefined>;
}
/**
 * `<lr-export-button>` — a CSV/JSON download button, single-format or a
 * format-choice menu. First-party invention; consolidates the ad-hoc
 * "export CSV" button pattern common across dashboard UIs.
 *
 * @customElement lr-export-button
 * @event lr-export - `detail: { format }`, cancelable — call `preventDefault()`
 *   to substitute the built-in client-side download with a server-generated one.
 * @event lr-export-complete - Fired after a non-cancelled download completes.
 * @event lr-export-error - Fired when a built-in CSV/JSON export cannot be serialized or
 *   downloaded. `detail: { format, error }`.
 * @event lr-show - The format menu is about to open, however `open` became true. Cancelable —
 *   `preventDefault()` leaves it closed. Not fired for markup that renders open from the start.
 * @event lr-hide - The format menu is about to close. Cancelable on the same terms as `lr-show`.
 *   A close this component imposes on itself (disablement, `loading`, or a format list collapsing
 *   to one entry) emits no lifecycle event and therefore offers no veto point.
 * @csspart trigger - The button that triggers the export (or opens the format menu).
 * @csspart menu - The format-choice menu, shown when more than one format is configured.
 * @csspart menu-item - A single format option inside the menu.
 * @csspart format-label - A format option's primary label.
 * @csspart format-description - A custom format option's optional secondary text.
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
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  @property({ attribute: false }) rows: Record<string, unknown>[] = [];
  /** Column allow-list (and CSV header labels) for both export formats. Left
   *  at its default empty array, both formats fall back to the union of the
   *  rows' own keys instead (see `effectiveColumns()`), rather than CSV
   *  degrading to a blank file while only JSON had a fallback. */
  @property({ attribute: false }) columns: CsvColumn[] = [];
  @property() filename = 'export';
  @property({ attribute: false }) formats: ExportFormatOption[] = ['csv'];
  @property({ type: Boolean, reflect: true }) disabled = false;
  /** Controlled busy state for async/server-generated exports. */
  @property({ type: Boolean, reflect: true }) loading = false;
  /** Visible trigger button text. It also feeds the format menu's `aria-label`
   *  when no host `aria-label` supplies a more specific accessible name.
   *  Left at its default English `'Export'`, the rendered text instead
   *  comes from `this.localize('exportButtonLabel', ...)` -- override-able
   *  via `.strings`/`registerLyraLocale()` -- same convention as
   *  `lr-attachment-chip`'s `removeLabel`/`retryLabel`. Set this
   *  attribute explicitly for a one-off override that always wins. */
  @property() label = 'Export';
  /** Accessible name forwarded from the host to the native trigger button.
   * When unset, the trigger's visible `label` provides its name. */
  @property({ attribute: 'aria-label' }) accessibleLabel = '';
  @property({ type: Boolean, reflect: true }) open = false;

  @query('[part="trigger"]') private triggerEl?: HTMLButtonElement;
  @query('[part="menu"]') private menuEl?: HTMLElement;

  private readonly menuId = nextId('export-menu');
  private cleanup?: () => void;
  private pointerDocument?: Document;
  private _isFirstUpdate = true;
  private openVetoed = false;
  /** Which menu item to focus the next time `open` flips true; reset after use. */
  private pendingMenuFocusIndex = 0;
  private formatsFocusSnapshot?: { index: number; id: string };
  private forcedMenuClose?: 'invalid-open' | 'formats' | 'state';
  /** Tracks only the temporary focus-rescue tabindex this component added itself. */
  private injectedHostTabIndex = false;

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.cleanup?.();
    this.cleanup = undefined;
    this.unbindDocumentPointer();
    this.open = false;
  }

  private bindDocumentPointer(): void {
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
    if (!e.composedPath().includes(this)) this.closeMenu();
  };

  private openMenu(): void {
    if (this.open) return;
    this.open = true;
  }

  private closeMenu(): void {
    if (!this.open) return;
    this.open = false;
  }

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
    if (this.open) {
      this.focusMenuItem(index);
    } else {
      this.pendingMenuFocusIndex = index;
      this.openMenu();
    }
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      if (this.open) {
        e.preventDefault();
        this.closeMenu();
        this.triggerEl?.focus();
      }
      return;
    }

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
      case 'Tab':
        // No preventDefault -- native Tab navigation proceeds untouched, only
        // the now-stale open menu closes (mirrors lr-menu's identical
        // Tab handling).
        this.closeMenu();
        break;
    }
  };

  protected override firstUpdated(): void {
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
      const previousFormats = changed.get('formats') as ExportFormatOption[] | undefined;
      const previous = previousFormats?.[index];
      this.formatsFocusSnapshot =
        index >= 0 && previous ? { index, id: this.formatId(previous) } : undefined;
    }
    if (this.open && this.formats.length <= 1) {
      const previousOpen = changed.get('open');
      this.forcedMenuClose =
        changed.has('formats') && (changed.get('formats') as ExportFormatOption[] | undefined)?.length
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
    if (!this.emit(name, undefined, { cancelable: true }).defaultPrevented) return;
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
      this.cleanup?.();
      this.cleanup = undefined;
      // Reacting to the `open` property itself (not just inside
      // openMenu()) means this runs however `open` became true -- via
      // openMenu()'s own click path, or a consumer/test setting
      // `el.open = true` directly (valid API on a `reflect: true`
      // property), which bypasses openMenu() entirely. Mirrors lr-menu/
      // lr-select/lr-combobox, whose lr-show/lr-hide veto point likewise
      // runs one step earlier, in willUpdate().
      this.unbindDocumentPointer();
      if (this.open) {
        const anchor = this.triggerEl;
        const menu = this.menuEl;
        if (anchor && menu) this.cleanup = place(anchor, menu);
        this.bindDocumentPointer();
        this.focusMenuItem(this.pendingMenuFocusIndex);
        this.pendingMenuFocusIndex = 0;
      }
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
          this.focusMenuItem(nextIndex >= 0 ? nextIndex : index);
        }
      });
    }
  }

  /** Falls back to the union of the rows' own keys when `columns` is left at
   *  its default empty array, so an unconfigured export still produces a
   *  proper header + data file instead of blank lines. Both `rowsForExport()`
   *  and the CSV branch of `doExport()` share this same fallback, rather than
   *  only the JSON path having one. */
  private effectiveColumns(): CsvColumn[] {
    if (this.columns.length > 0) return this.columns;
    const keys = new Set<string>();
    for (const row of this.rows) {
      for (const key of Object.keys(row)) keys.add(key);
    }
    return Array.from(keys, (key) => ({ key, label: key }));
  }

  /** Applies the same `columns` allow-list CSV exports use, so JSON can't leak fields CSV hides. */
  private rowsForExport(): Record<string, unknown>[] {
    const keys = this.effectiveColumns().map((c) => c.key);
    return this.rows.map((row) => {
      const picked = Object.create(null) as Record<string, unknown>;
      for (const key of keys) picked[key] = row[key];
      return picked;
    });
  }

  private formatId(format: ExportFormatOption): string {
    return typeof format === 'string' ? format : format.id;
  }

  private formatLabel(format: ExportFormatOption): string {
    return typeof format === 'string' ? format.toUpperCase() : format.label;
  }

  private doExport(formatOption: ExportFormatOption): void {
    if (this.disabled || this.loading) return;
    this.closeMenu();
    this.triggerEl?.focus();
    const format = this.formatId(formatOption);
    const ev = this.emit('lr-export', { format }, { cancelable: true });
    if (ev.defaultPrevented) return;

    if (format !== 'csv' && format !== 'json') {
      // Custom formats are intentionally handler-only: Lyra owns the menu and
      // event contract but does not pull format-specific encoders into the base bundle.
      return;
    }
    try {
      if (format === 'csv') {
        downloadBlob(
          buildCsv(this.rows, this.effectiveColumns()),
          `${this.filename}.csv`,
          'text/csv;charset=utf-8;',
          this.ownerDocument,
        );
      } else {
        downloadBlob(
          JSON.stringify(this.rowsForExport(), null, 2),
          `${this.filename}.json`,
          'application/json',
          this.ownerDocument,
        );
      }
      this.emit('lr-export-complete', { format });
    } catch (error) {
      this.emit('lr-export-error', { format, error });
    }
  }

  private onTriggerClick(): void {
    if (this.disabled || this.loading) return;
    if (this.formats.length <= 1) this.doExport(this.formats[0] ?? 'csv');
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
    return this.localize('exportButtonLabel', this.label === 'Export' ? undefined : this.label);
  }

  override render(): TemplateResult {
    const label = this.effectiveLabel;
    const accessibleLabel = this.accessibleLabel || label;
    return html`
      <button
        part="trigger"
        type="button"
        ?disabled=${this.disabled || this.loading}
        aria-label=${this.accessibleLabel || nothing}
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
            ${this.formats.map(
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

import { AnchoredPopoverController } from './anchored-popover-controller.js';
import { resolveIntlLocale } from './intl-cache.js';
import { dispatchNativeEvent, relayNativeEvent } from './native-event-relay.js';

/** The common public row vocabulary for catalog-backed controls. */
export interface LyraCatalogEntry {
  id: string;
  label: string;
}

/**
 * A homogeneous, readonly catalog. String shorthand uses the same string for the row id and
 * label; object catalogs retain the caller's extended row type.
 */
export type LyraCatalog<T extends LyraCatalogEntry = LyraCatalogEntry> =
  | readonly string[]
  | readonly T[];

export type DisplayCatalogEntry<T extends LyraCatalogEntry> = T & { synthetic: boolean };

export function normalizeCatalog<T extends LyraCatalogEntry>(catalog: LyraCatalog<T> | undefined): T[] {
  return (catalog ?? []).map((entry) =>
    typeof entry === 'string' ? ({ id: entry, label: entry } as T) : entry,
  );
}

export function withSyntheticCatalogValue<T extends LyraCatalogEntry>(
  catalog: readonly T[],
  value: string,
): DisplayCatalogEntry<T>[] {
  const entries = catalog.map((entry) => ({ ...entry, synthetic: false }));
  if (catalog.length && value && !catalog.some((entry) => entry.id === value)) {
    entries.push({ id: value, label: value, synthetic: true } as DisplayCatalogEntry<T>);
  }
  return entries;
}

export function filterCatalogEntries<T>(
  entries: readonly T[],
  query: string,
  locale: string,
  fields: (entry: T) => readonly string[],
): T[] {
  const intlLocale = resolveIntlLocale(locale);
  const normalized = query.trim().toLocaleLowerCase(intlLocale);
  if (!normalized) return [...entries];
  return entries.filter((entry) =>
    fields(entry).some((value) => value.toLocaleLowerCase(intlLocale).includes(normalized)),
  );
}

interface CatalogPickerChangeDetail {
  value: string;
  inCatalog: boolean;
}

interface CatalogPickerHost extends HTMLElement {
  readonly renderRoot: HTMLElement | DocumentFragment;
  readonly effectiveDisabled: boolean;
}

interface CatalogPickerControllerOptions<T extends LyraCatalogEntry> {
  catalog: () => LyraCatalog<T> | undefined;
  allowCustom: () => boolean;
  locale: () => string;
  searchableFields: (entry: T) => readonly string[];
  emitChange: (detail: CatalogPickerChangeDetail) => void;
  emitFocusAlias: (type: 'lr-focus' | 'lr-blur') => void;
  onValueChange: (value: string, oldValue: string) => void;
  onDefaultValueChange: (value: string, oldValue: string) => void;
  onStateChange: (state: 'open' | 'query' | 'activeIndex', oldValue: boolean | string | number) => void;
  beforeValueChange?: (value: string, oldValue: string) => void;
  beforeActiveIndexChange?: (next: number, oldValue: number) => void;
  afterQueryChange?: (query: string, oldValue: string) => void;
  onControlFocus?: (event: FocusEvent) => void;
  onControlBlur?: (event: FocusEvent) => void;
  containsFocusTarget?: (target: EventTarget | null) => boolean;
  forwardFreeInputClick?: boolean;
}

/**
 * Shared dual-mode state machine for catalog-backed text/form controls. Rendering and
 * component-specific behavior stay on the host; catalog normalization, editing state, keyboard
 * transitions, popup ownership, commits, and native/prefixed event relays have one authority.
 */
export class CatalogPickerController<T extends LyraCatalogEntry> {
  private readonly popupPosition = new AnchoredPopoverController();
  private pointerListenerDocument?: Document;
  private pointerListener?: (event: PointerEvent) => void;
  private _activeIndex = -1;
  private _query = '';
  private _open = false;
  private _value = '';
  private _defaultValue = '';
  private valueDirty = false;
  private settingDefaultValue = false;
  private reflectingDefaultValue = false;

  suppressControlEvents = false;

  constructor(
    private readonly host: CatalogPickerHost,
    private readonly options: CatalogPickerControllerOptions<T>,
  ) {}

  get normalizedCatalog(): T[] {
    return normalizeCatalog<T>(this.options.catalog());
  }

  get closedMode(): boolean {
    return this.normalizedCatalog.length > 0 && !this.options.allowCustom();
  }

  get effectiveEntries(): DisplayCatalogEntry<T>[] {
    return withSyntheticCatalogValue(this.normalizedCatalog, this._value);
  }

  get filteredEntries(): DisplayCatalogEntry<T>[] {
    return filterCatalogEntries(
      this.effectiveEntries,
      this._query,
      this.options.locale(),
      this.options.searchableFields,
    );
  }

  get visibleEntries(): DisplayCatalogEntry<T>[] {
    return this.closedMode ? this.effectiveEntries : this.filteredEntries;
  }

  labelFor(id: string): string {
    if (!id) return '';
    return this.effectiveEntries.find((entry) => entry.id === id)?.label ?? id;
  }

  get activeIndex(): number {
    return this._activeIndex;
  }

  setActiveIndex(next: number): void {
    if (next === this._activeIndex) return;
    const old = this._activeIndex;
    this.options.beforeActiveIndexChange?.(next, old);
    this._activeIndex = next;
    this.options.onStateChange('activeIndex', old);
  }

  get query(): string {
    return this._query;
  }

  setQuery(next: string): void {
    if (next === this._query) return;
    const old = this._query;
    this._query = next;
    this.options.afterQueryChange?.(next, old);
    this.options.onStateChange('query', old);
  }

  get open(): boolean {
    return this._open;
  }

  setOpen(next: boolean): void {
    const liveDisabled =
      this.host.effectiveDisabled ||
      (typeof this.host.matches === 'function' && this.host.matches(':disabled'));
    const resolved = Boolean(next) && !liveDisabled;
    if (resolved === this._open) {
      if (next && !resolved && this.host.hasAttribute('open')) this.host.removeAttribute('open');
      return;
    }
    const old = this._open;
    if (!resolved) this.setActiveIndex(-1);
    this._open = resolved;
    this.options.onStateChange('open', old);
  }

  show(): void {
    if (!this._open && !this.host.effectiveDisabled) this.setOpen(true);
  }

  hide(): void {
    if (this._open) this.setOpen(false);
  }

  get value(): string {
    return this._value;
  }

  set value(next: string) {
    const normalized = next ?? '';
    this.options.beforeValueChange?.(normalized, this._value);
    if (normalized === this._value) {
      if (!this.settingDefaultValue) this.valueDirty = true;
      return;
    }
    const old = this._value;
    if (!this.settingDefaultValue) this.valueDirty = true;
    this._value = normalized;
    this.options.onValueChange(normalized, old);
  }

  get defaultValue(): string {
    return this._defaultValue;
  }

  set defaultValue(next: string) {
    if (this.reflectingDefaultValue) return;
    const normalized = next ?? '';
    const old = this._defaultValue;
    this._defaultValue = normalized;
    this.reflectDefaultValue();
    if (!this.valueDirty) this.restoreLiveValueFromDefault();
    this.options.onDefaultValueChange(normalized, old);
  }

  resetValue(): void {
    this.restoreLiveValueFromDefault();
  }

  restoreState(state: string | File | FormData | null): void {
    this.value = typeof state === 'string' ? state : '';
  }

  private restoreLiveValueFromDefault(): void {
    this.settingDefaultValue = true;
    try {
      this.value = this._defaultValue;
    } finally {
      this.settingDefaultValue = false;
    }
    this.valueDirty = false;
  }

  private reflectDefaultValue(): void {
    this.reflectingDefaultValue = true;
    try {
      if (this._defaultValue) this.host.setAttribute('value', this._defaultValue);
      else this.host.removeAttribute('value');
    } finally {
      this.reflectingDefaultValue = false;
    }
  }

  commitValue(next: string): void {
    const inCatalog = this.normalizedCatalog.some((entry) => entry.id === next);
    this.value = next;
    this.hide();
    this.options.emitChange({ value: next, inCatalog });
    this.emitValueEvents();
  }

  emitValueEvents(): void {
    dispatchNativeEvent(this.host, 'input');
    dispatchNativeEvent(this.host, 'change');
  }

  commitFreeText(): void {
    const active = this.filteredEntries[this._activeIndex];
    this.commitValue(this._activeIndex >= 0 && active ? active.id : this._query.trim());
  }

  selectEntry(entry: DisplayCatalogEntry<T>): void {
    this.commitValue(entry.id);
  }

  reconcileRows(activeValue: string | undefined, rebaseQuery: boolean, clampMissing = true): void {
    const rows = this.visibleEntries;
    const remapped = activeValue ? rows.findIndex((entry) => entry.id === activeValue) : -1;
    this.setActiveIndex(
      remapped >= 0
        ? remapped
        : clampMissing
          ? Math.min(this._activeIndex, Math.max(-1, rows.length - 1))
          : -1,
    );
    if (rebaseQuery) this.setQuery(this.labelFor(this._value));
  }

  handleTriggerKeyDown(event: KeyboardEvent): void {
    const rows = this.effectiveEntries;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!this._open) return this.show();
        this.setActiveIndex(rows.length ? Math.min(rows.length - 1, this._activeIndex + 1) : -1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (!this._open) return this.show();
        this.setActiveIndex(rows.length ? Math.max(0, this._activeIndex - 1) : -1);
        break;
      case 'Enter':
      case ' ':
        if (this._open) {
          event.preventDefault();
          const active = rows[this._activeIndex];
          if (this._activeIndex >= 0 && active) this.selectEntry(active);
          else this.hide();
        }
        break;
      case 'Escape':
        if (this._open) {
          event.preventDefault();
          this.hide();
        }
        break;
      case 'Home':
        if (this._open) {
          event.preventDefault();
          this.setActiveIndex(rows.length ? 0 : -1);
        }
        break;
      case 'End':
        if (this._open) {
          event.preventDefault();
          this.setActiveIndex(rows.length - 1);
        }
        break;
    }
  }

  handleInputKeyDown(event: KeyboardEvent): void {
    const rows = this.filteredEntries;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!this._open) return this.show();
        this.setActiveIndex(rows.length ? Math.min(rows.length - 1, this._activeIndex + 1) : -1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (!this._open) return this.show();
        this.setActiveIndex(rows.length ? Math.max(0, this._activeIndex - 1) : -1);
        break;
      case 'Enter':
        if (this._open) {
          event.preventDefault();
          this.commitFreeText();
        }
        break;
      case 'Escape':
        if (this._open) {
          event.preventDefault();
          this.setQuery(this.labelFor(this._value));
          this.hide();
        }
        break;
      case 'Home':
        if (this._open) {
          event.preventDefault();
          this.setActiveIndex(rows.length ? 0 : -1);
        }
        break;
      case 'End':
        if (this._open) {
          event.preventDefault();
          this.setActiveIndex(rows.length - 1);
        }
        break;
    }
  }

  handleInput(event: Event): void {
    const input = event.currentTarget as HTMLInputElement | null;
    if (!input) return;
    this.setQuery(input.value);
    this.setActiveIndex(-1);
    this.show();
    relayNativeEvent(this.host, event);
  }

  handleInputFocus(event: FocusEvent): void {
    if (this.suppressControlEvents) {
      event.stopPropagation();
      return;
    }
    if (!this._open) this.setQuery(this.labelFor(this._value));
    this.show();
    this.handleControlFocus(event);
  }

  handleControlFocus(event: FocusEvent): void {
    if (this.suppressControlEvents) {
      event.stopPropagation();
      return;
    }
    if (this.containsFocusTarget(event.relatedTarget)) {
      event.stopPropagation();
      return;
    }
    this.options.onControlFocus?.(event);
    relayNativeEvent(this.host, event);
    this.options.emitFocusAlias('lr-focus');
  }

  handleControlBlur(event: FocusEvent): void {
    if (this.suppressControlEvents) {
      event.stopPropagation();
      return;
    }
    if (this.containsFocusTarget(event.relatedTarget)) {
      event.stopPropagation();
      return;
    }
    this.options.onControlBlur?.(event);
    this.hide();
    relayNativeEvent(this.host, event);
    this.options.emitFocusAlias('lr-blur');
  }

  handleComboMouseDown(event: MouseEvent): void {
    if (this.host.effectiveDisabled) return;
    // The shell owns focus redirection, but the editable input owns the browser's native caret
    // placement and Shift-selection defaults. A bubbled input mousedown must therefore remain
    // uncanceled; preventing it here leaves the caret at its previous position.
    if (event.composedPath()[0] === this.input) return;
    event.preventDefault();
    this.input?.focus();
  }

  handleListboxMouseDown(event: MouseEvent): void {
    if ((event.target as HTMLElement).closest('[part="option"]')) event.preventDefault();
  }

  handleListboxClick(event: MouseEvent): void {
    if (this.host.effectiveDisabled) return;
    const option = (event.target as HTMLElement).closest('[part="option"]') as HTMLElement | null;
    const value = option?.dataset['value'];
    if (value === undefined) return;
    const entry = this.visibleEntries.find((candidate) => candidate.id === value);
    if (entry) this.selectEntry(entry);
  }

  get input(): HTMLInputElement | null {
    return this.host.renderRoot?.querySelector<HTMLInputElement>('[part="combobox-input"]') ?? null;
  }

  click(): void {
    if (this.host.effectiveDisabled) return;
    const trigger = this.host.renderRoot?.querySelector<HTMLButtonElement>('[part="trigger"]');
    if (trigger) {
      trigger.click();
      return;
    }
    const input = this.input;
    if (this.options.forwardFreeInputClick) input?.click();
    input?.focus();
  }

  focus(options?: FocusOptions): void {
    if (this.host.effectiveDisabled) return;
    const control = this.host.renderRoot?.querySelector<HTMLElement>(
      '[part="trigger"], [part="combobox-input"]',
    );
    control?.focus(options);
  }

  blur(): void {
    const control = this.host.renderRoot?.querySelector<HTMLElement>(
      '[part="trigger"], [part="combobox-input"]',
    );
    control?.blur();
  }

  select(): void {
    this.input?.select();
  }

  setSelectionRange(start: number | null, end: number | null, direction?: SelectionDirection): void {
    this.input?.setSelectionRange(start, end, direction);
  }

  setRangeText(replacement: string, start?: number, end?: number, selectMode?: SelectionMode): void {
    const input = this.input;
    if (!input) return;
    if (start === undefined || end === undefined) input.setRangeText(replacement);
    else input.setRangeText(replacement, start, end, selectMode);
    this.setQuery(input.value);
    this.setActiveIndex(-1);
    this.value = input.value;
  }

  connected(hasUpdated: boolean): void {
    if (hasUpdated && this._open) queueMicrotask(() => this.syncPopup());
  }

  disconnected(): void {
    this.popupPosition.disconnect();
    this.unbindDocumentPointer();
    this.setOpen(false);
  }

  adopted(): void {
    this.popupPosition.disconnect();
    this.unbindDocumentPointer();
    if (this._open) queueMicrotask(() => this.syncPopup());
  }

  updated(reposition: boolean): void {
    if (reposition) this.syncPopup();
  }

  private containsFocusTarget(target: EventTarget | null): boolean {
    if (this.options.containsFocusTarget) return this.options.containsFocusTarget(target);
    if (!target || typeof (target as Node).nodeType !== 'number') return false;
    const node = target as Node;
    return this.host.renderRoot.contains(node) || this.host.contains(node);
  }

  private bindDocumentPointer(): void {
    if (!this.host.isConnected) return;
    const ownerDocument = this.host.ownerDocument;
    if (this.pointerListenerDocument === ownerDocument && this.pointerListener) return;
    this.unbindDocumentPointer();
    const listener = (event: PointerEvent): void => {
      if (
        this.pointerListener !== listener ||
        this.pointerListenerDocument !== ownerDocument ||
        !this.host.isConnected ||
        this.host.ownerDocument !== ownerDocument
      ) {
        return;
      }
      if (!event.composedPath().includes(this.host)) this.hide();
    };
    this.pointerListenerDocument = ownerDocument;
    this.pointerListener = listener;
    ownerDocument.addEventListener('pointerdown', listener);
  }

  private unbindDocumentPointer(): void {
    if (this.pointerListenerDocument && this.pointerListener) {
      this.pointerListenerDocument.removeEventListener('pointerdown', this.pointerListener);
    }
    this.pointerListenerDocument = undefined;
    this.pointerListener = undefined;
  }

  private syncPopup(): void {
    this.popupPosition.disconnect();
    if (!this._open || !this.host.isConnected) {
      this.unbindDocumentPointer();
      return;
    }
    this.bindDocumentPointer();
    const anchor = this.host.renderRoot.querySelector<HTMLElement>(
      this.closedMode ? '[part="trigger"]' : '[part="combobox"]',
    );
    const listbox = this.host.renderRoot.querySelector<HTMLElement>('[part="listbox"]');
    if (anchor && listbox) this.popupPosition.reposition(anchor, listbox);
  }
}

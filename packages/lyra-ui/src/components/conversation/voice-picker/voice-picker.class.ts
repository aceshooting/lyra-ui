import { html, nothing, type TemplateResult, type PropertyValues, type ComplexAttributeConverter } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { place } from '../../../internal/positioner.js';
import { nextId } from '../../../internal/a11y.js';
import { chevronIcon, playIcon, pauseIcon } from '../../../internal/icons.js';
import { AnchoredValidityController, VALIDITY_ANCHOR } from '../../../internal/anchored-validity.js';
import { safeMediaSrc } from '../../../internal/safe-url.js';
import { styles } from './voice-picker.styles.js';

/**
 * String-aware boolean attribute converter for `spellcheck`. Lit's built-in `type: Boolean`
 * converter is presence-based -- the attribute's mere presence (regardless of its string value)
 * maps to `true`, so a plain-markup consumer writing the literal `spellcheck="false"` would
 * actually get `true` (this property's default), the opposite of what that string reads as -- the
 * same bug class `<lr-model-select>`'s/`<lr-textarea>`'s/`<lr-date-input>`'s identical
 * converters document and fix.
 */
const spellcheckConverter: ComplexAttributeConverter<boolean> = {
  fromAttribute(value): boolean {
    return value !== 'false';
  },
  toAttribute(value): string | null {
    return value ? null : 'false';
  },
};

/**
 * `true`-defaulting boolean attribute converter for `preview`. Lit's built-in `type: Boolean`
 * converter is presence-based -- the attribute's mere presence (regardless of its string value)
 * maps to `true`, so a plain-markup consumer writing the literal `preview="false"` would actually
 * get `true` (this property's default) -- the same bug class `spellcheckConverter` above and
 * `<lr-checkpoint>`'s `restorable`/`confirmRestore` converters document and fix.
 */
const trueDefaultBooleanConverter: ComplexAttributeConverter<boolean> = {
  fromAttribute(value): boolean {
    return value !== 'false';
  },
  toAttribute(value): string | null {
    return value ? null : 'false';
  },
};

/** A catalog row: a selectable TTS voice. */
export interface LyraVoiceCatalogEntry {
  id: string;
  label: string;
  /** Rendered (with `description`) as a quiet `[part="option-meta"]` second line. */
  language?: string;
  description?: string;
  /** A sample-audio URL; validated via `safeMediaSrc()` before ever reaching an `<audio src>`. */
  previewUrl?: string;
}

/**
 * Either every entry is a plain string (used as both id and label) or every entry is a full
 * `{ id, label, ... }` row -- not a mix of both, mirroring `LyraModelCatalog`'s identical contract.
 */
export type LyraVoiceCatalog = string[] | LyraVoiceCatalogEntry[];

/** A catalog row plus whether it's the synthetic "stale value" row — see `effectiveEntries`. */
interface DisplayEntry extends LyraVoiceCatalogEntry {
  synthetic: boolean;
}

export interface LyraVoicePickerEventMap {
  'lr-change': CustomEvent<{ value: string; inCatalog: boolean }>;
  'lr-preview-request': CustomEvent<{ voiceId: string; previewUrl?: string }>;
  'lr-preview-change': CustomEvent<{ voiceId: string | null }>;
  input: CustomEvent<undefined>;
  change: CustomEvent<undefined>;
  blur: CustomEvent<undefined>;
  focus: CustomEvent<undefined>;
}

/**
 * `<lr-voice-picker>` — a TTS voice selector over a host-supplied `catalog`, mirroring
 * `lr-model-select`'s closed-dropdown/free-text-combobox dual mode, stale-value handling, and
 * form-association verbatim (see that class's own doc for the full mode-switching contract this one
 * shares), extended with a TTS-agnostic preview affordance: a standalone, always-tab-reachable
 * `[part="preview-button"]` beside the trigger previews the active option while open, else the
 * committed value; per-row `[part="option-preview"]` icons are pointer-only duplicates
 * (`tabindex="-1"`, `aria-hidden="true"`) since a listbox option must not contain a focusable
 * descendant.
 *
 * Preview is event-first: `lr-preview-request` always fires first and is cancelable. Left
 * un-prevented, a `previewUrl` plays through one internal native `<audio>` (the URL passes
 * `safeMediaSrc()` first); `preventDefault()` or no URL leaves playback entirely to the host's own
 * TTS. Requesting the same voice while it is already playing internally stops it instead of
 * re-requesting; requesting a different voice switches. `lr-preview-change` reports internal
 * playback start/stop (`voiceId: null` on stop/end/error).
 *
 * @customElement lr-voice-picker
 * @slot hint - Custom hint content.
 * @slot error - Custom error content.
 * @event lr-change - `detail: { value: string; inCatalog: boolean }`.
 * @event {Event} change - Fired alongside `lr-change`, mirroring `lr-model-select`'s native-style pair.
 * @event {Event} input - Fired alongside `change`/`lr-change`.
 * @event blur - Re-dispatched from the free-text mode's internal `<input>`'s own `blur` (bubbling,
 *   composed, unlike the native event).
 * @event focus - Re-dispatched from the free-text mode's internal `<input>`'s own `focus`.
 * @event lr-preview-request - `detail: { voiceId: string; previewUrl?: string }`. Cancelable.
 * @event lr-preview-change - `detail: { voiceId: string | null }` — internal playback started
 *   (`voiceId`) or stopped (`null`).
 * @csspart form-control-label - The `<label>` element.
 * @csspart trigger - The trigger button (closed-dropdown mode).
 * @csspart combobox - The text-input container (free-text mode).
 * @csspart combobox-input - The free-text `<input>`.
 * @csspart provider-badge - The optional leading `provider` label.
 * @csspart listbox - The options popover.
 * @csspart option - An option row.
 * @csspart option-label - An option row's label/meta wrapper.
 * @csspart option-meta - An option row's quiet `language · description` second line.
 * @csspart option-badge - The "not in catalog" badge on a synthetic stale-value row.
 * @csspart option-preview - A pointer-only per-row preview icon (`tabindex="-1"`, `aria-hidden`).
 * @csspart preview-button - The standalone, keyboard-reachable preview toggle beside the trigger.
 * @csspart expand-icon - The dropdown indicator.
 * @csspart empty - The empty-listbox message.
 * @csspart hint - The hint message.
 * @csspart error - The error message.
 */
export class LyraVoicePicker extends LyraElement<LyraVoicePickerEventMap> {
  static formAssociated = true;
  static styles = [LyraElement.styles, styles];

  static properties = {
    disabled: { type: Boolean, reflect: true, noAccessor: true },
    required: { type: Boolean, reflect: true, noAccessor: true },
    value: { noAccessor: true },
    name: { reflect: true, noAccessor: true },
  };

  /** Informational only (e.g. `'elevenlabs'`); rendered as a small leading badge. */
  @property() provider = '';
  /** The full voice list. Omit (or leave empty) to fall back to plain free-text entry. */
  @property({ attribute: false }) catalog?: LyraVoiceCatalog;
  /** Let the user type/commit a value that isn't in `catalog`, even when `catalog` is non-empty. */
  @property({ type: Boolean, reflect: true, attribute: 'allow-custom' }) allowCustom = false;
  /** Whether to render preview affordances at all. */
  @property({ reflect: true, converter: trueDefaultBooleanConverter }) preview = true;
  @property() label = '';
  @property() hint = '';
  @property({ attribute: 'error-text' }) errorText = '';
  @property() placeholder = '';
  @property({ converter: spellcheckConverter }) spellcheck = true;
  @property() autocapitalize = '';
  @property({ attribute: 'autocorrect' }) autoCorrect = '';
  @property() autocomplete = 'off';
  @property({ attribute: 'inputmode' }) inputMode = '';
  @property({ attribute: 'enterkeyhint' }) enterKeyHint = '';
  @property({ type: Boolean, reflect: true }) open = false;

  @state() private activeIndex = -1;
  @state() private query = '';
  @state() private touched = false;
  @state() private hasHintSlot = false;
  @state() private hasErrorSlot = false;
  /** The voiceId currently playing via the internal `<audio>` (`null` when nothing is). */
  @state() private previewingId: string | null = null;

  private internals: ElementInternals;
  private validityController: AnchoredValidityController;
  private listId = nextId('voice-picker-list');
  private controlId = nextId('voice-picker-control');
  private cleanup?: () => void;
  private audioEl?: HTMLAudioElement;
  private _value = '';
  private _fieldsetDisabled = false;
  private _name = '';
  private _disabled = false;
  private _required = false;
  private _defaultValue = '';

  constructor() {
    super();
    this.internals = this.attachInternals();
    this.validityController = new AnchoredValidityController(this, this.internals, () => this[VALIDITY_ANCHOR]());
    this.internals.setFormValue('');
  }

  get form(): HTMLFormElement | null {
    return this.internals.form;
  }
  get labels(): NodeList {
    return this.internals.labels;
  }
  get validity(): ValidityState {
    return this.internals.validity;
  }
  get validationMessage(): string {
    return this.internals.validationMessage;
  }
  get willValidate(): boolean {
    return this.internals.willValidate;
  }

  /** @internal */
  [VALIDITY_ANCHOR](): HTMLElement | null {
    return this.renderRoot?.querySelector('[part="trigger"], [part="combobox-input"]') ?? null;
  }

  /**
   * Forwards to whichever internal control the current mode renders, since
   * `HTMLElement.prototype.click()` is otherwise a no-op on a custom element with no native click
   * semantics of its own (mirrors `<lr-button>`'s identical forwarding override). Closed-dropdown
   * mode forwards a real `.click()` to the trigger `<button>`, whose own `@click` handler opens
   * it. Free-text mode instead calls `.focus()` on the combobox `<input>`: opening there is wired
   * to the native `focus` event (`onInputFocus`), and unlike a `<button>`, a synthetic
   * `.click()` on a text `<input>` does not itself dispatch `focus` -- browsers only focus a text
   * control from a real click's `mousedown` default action, which `.click()` skips -- so
   * `.focus()` is what actually reproduces a real click's end-user-visible effect here.
   */
  override click(): void {
    const trigger = this.renderRoot?.querySelector('[part="trigger"]') as HTMLButtonElement | null;
    if (trigger) {
      trigger.click();
      return;
    }
    (this.renderRoot?.querySelector('[part="combobox-input"]') as HTMLInputElement | null)?.focus();
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.updateValidity();
  }

  protected willUpdate(): void {
    if (!this.hasUpdated) {
      this.hasHintSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'hint');
      this.hasErrorSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'error');
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.cleanup?.();
    this.cleanup = undefined;
    this.ownerDocument.removeEventListener('pointerdown', this.onDocPointer);
    this.stopInternalPreview();
    this.open = false;
  }

  attributeChangedCallback(name: string, old: string | null, val: string | null): void {
    super.attributeChangedCallback(name, old, val);
    if (name === 'value') this._defaultValue = this._value;
  }

  /** The current voice id (empty string when nothing is selected). */
  get value(): string {
    return this._value;
  }
  set value(next: string) {
    const old = this._value;
    this._value = next ?? '';
    this.internals.setFormValue(this._value);
    this.updateValidity();
    this.requestUpdate('value', old);
  }

  get name(): string {
    return this._name;
  }
  set name(next: string) {
    const old = this._name;
    this._name = next ?? '';
    if (this._name) this.setAttribute('name', this._name);
    else this.removeAttribute('name');
    this.requestUpdate('name', old);
  }

  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(next: boolean) {
    const old = this._disabled;
    this._disabled = Boolean(next);
    this.toggleAttribute('disabled', this._disabled);
    if (this._disabled) this.hide();
    this.requestUpdate('disabled', old);
  }

  get required(): boolean {
    return this._required;
  }
  set required(next: boolean) {
    const old = this._required;
    this._required = Boolean(next);
    this.toggleAttribute('required', this._required);
    this.updateValidity();
    this.requestUpdate('required', old);
  }

  /** Whether the control is disabled explicitly or by an ancestor fieldset. */
  get effectiveDisabled(): boolean {
    return this.disabled || this._fieldsetDisabled;
  }

  private updateValidity(): void {
    if (this.required && !this._value) {
      this.validityController.setValidity({ valueMissing: true }, this.localize('voicePickerRequired'));
    } else {
      this.validityController.setValidity({});
    }
  }

  formResetCallback(): void {
    this.touched = false;
    this.value = this._defaultValue;
  }
  formStateRestoreCallback(state: string | File | FormData | null, _mode?: 'restore' | 'autocomplete'): void {
    this.value = typeof state === 'string' ? state : '';
  }
  formDisabledCallback(disabled: boolean): void {
    this._fieldsetDisabled = disabled;
    if (disabled) this.hide();
    this.requestUpdate();
  }
  checkValidity(): boolean {
    return this.internals.checkValidity();
  }
  reportValidity(): boolean {
    return this.internals.reportValidity();
  }

  /** `catalog`, normalized to `{ id, label, ... }[]` regardless of the plain-string-array shorthand. */
  private get normalizedCatalog(): LyraVoiceCatalogEntry[] {
    const raw = this.catalog;
    if (!raw || raw.length === 0) return [];
    return raw.map((item): LyraVoiceCatalogEntry => (typeof item === 'string' ? { id: item, label: item } : item));
  }

  /** Closed-dropdown-with-listbox mode vs. free-text filterable mode — see class doc. */
  private get closedMode(): boolean {
    return this.normalizedCatalog.length > 0 && !this.allowCustom;
  }

  /**
   * `normalizedCatalog` plus, when `value` isn't one of its ids, a synthetic trailing row for it —
   * recomputed from scratch on every access so it always reflects the *current* `catalog`/`value`,
   * never a snapshot from whenever `value` happened to be assigned.
   */
  private get effectiveEntries(): DisplayEntry[] {
    const catalog = this.normalizedCatalog;
    const entries: DisplayEntry[] = catalog.map((e) => ({ ...e, synthetic: false }));
    if (catalog.length > 0 && this._value && !catalog.some((e) => e.id === this._value)) {
      entries.push({ id: this._value, label: this._value, synthetic: true });
    }
    return entries;
  }

  /** `effectiveEntries` filtered by the typed `query` (free-text mode only; id, label, language, or
   *  description substring, case-insensitive). */
  private get filteredEntries(): DisplayEntry[] {
    const q = this.query.trim().toLocaleLowerCase(this.effectiveLocale);
    if (!q) return this.effectiveEntries;
    return this.effectiveEntries.filter(
      (e) =>
        e.id.toLocaleLowerCase(this.effectiveLocale).includes(q) ||
        e.label.toLocaleLowerCase(this.effectiveLocale).includes(q) ||
        (e.language ?? '').toLocaleLowerCase(this.effectiveLocale).includes(q) ||
        (e.description ?? '').toLocaleLowerCase(this.effectiveLocale).includes(q),
    );
  }

  private labelFor(id: string): string {
    if (!id) return '';
    return this.effectiveEntries.find((e) => e.id === id)?.label ?? id;
  }

  private show(): void {
    if (this.open || this.effectiveDisabled) return;
    this.open = true;
  }
  private hide(): void {
    if (!this.open) return;
    this.open = false;
    this.activeIndex = -1;
  }
  private onDocPointer = (e: PointerEvent): void => {
    if (!e.composedPath().includes(this)) this.hide();
  };

  protected updated(changed: PropertyValues): void {
    const reposition = changed.has('open') || (this.open && (changed.has('catalog') || changed.has('allowCustom')));
    if (reposition) {
      this.cleanup?.();
      this.cleanup = undefined;
      if (this.open) {
        this.ownerDocument.addEventListener('pointerdown', this.onDocPointer);
        const anchor = this.renderRoot.querySelector(
          this.closedMode ? '[part="trigger"]' : '[part="combobox"]',
        ) as HTMLElement | null;
        const listbox = this.renderRoot.querySelector('[part="listbox"]') as HTMLElement | null;
        if (anchor && listbox) this.cleanup = place(anchor, listbox);
      } else {
        this.ownerDocument.removeEventListener('pointerdown', this.onDocPointer);
      }
    }
    if (changed.has('required') || changed.has('touched') || changed.has('value')) {
      this.toggleAttribute('data-invalid', this.touched && !this.internals.validity.valid);
    }
  }

  private commitValue(next: string): void {
    const inCatalog = this.normalizedCatalog.some((e) => e.id === next);
    this.value = next;
    this.hide();
    this.emit('lr-change', { value: next, inCatalog });
    this.emitValueEvents();
  }

  /** Dispatches the platform-style value-event pair alongside `lr-change`, mirroring
   *  `lr-model-select` so native form bindings and framework `v-model` handlers behave
   *  consistently across the picker family. */
  private emitValueEvents(): void {
    const EventConstructor = this.ownerDocument.defaultView?.Event ?? Event;
    const init: EventInit = { bubbles: true, composed: true };
    this.dispatchEvent(new EventConstructor('input', init));
    this.dispatchEvent(new EventConstructor('change', init));
  }

  private selectEntry(entry: DisplayEntry): void {
    this.commitValue(entry.id);
  }

  /** Enter in free-text mode: commit the highlighted suggestion, else the raw typed text. */
  private commitFreeText(): void {
    const rows = this.filteredEntries;
    if (this.activeIndex >= 0 && rows[this.activeIndex]) {
      this.commitValue(rows[this.activeIndex].id);
      return;
    }
    this.commitValue(this.query.trim());
  }

  // -- Preview -------------------------------------------------------------

  /** The candidate the standalone preview button acts on: the active option while open, else the
   *  committed value. */
  private get previewCandidateId(): string {
    if (this.open && this.activeIndex >= 0) {
      const rows = this.closedMode ? this.effectiveEntries : this.filteredEntries;
      return rows[this.activeIndex]?.id ?? this._value;
    }
    return this._value;
  }

  private requestPreview(voiceId: string): void {
    if (!voiceId) return;
    const entry = this.effectiveEntries.find((e) => e.id === voiceId);
    const previewUrl = entry?.previewUrl;
    const event = this.emit<{ voiceId: string; previewUrl?: string }>(
      'lr-preview-request',
      { voiceId, previewUrl },
      { cancelable: true },
    );
    if (!event.defaultPrevented && previewUrl) this.playInternal(voiceId, previewUrl);
  }

  private playInternal(voiceId: string, url: string): void {
    const safe = safeMediaSrc(url);
    if (!safe) return;
    this.stopInternalPreview();
    const audio = new Audio();
    audio.src = safe;
    audio.addEventListener('ended', this.onAudioEnded);
    audio.addEventListener('error', this.onAudioLoadFailure);
    this.audioEl = audio;
    this.previewingId = voiceId;
    void audio.play().catch(() => this.onAudioLoadFailure());
    this.emit<{ voiceId: string | null }>('lr-preview-change', { voiceId });
  }

  private onAudioEnded = (): void => {
    this.stopInternalPreview();
  };

  /**
   * A rejected `play()` or a media `error` event means only that *this specific* audio resource
   * failed to load/play. It must not flip the public "playing" toggle out from under a caller who
   * may have already toggled it off or requested a different voice by the time this settles --
   * network timing is inherently unpredictable and racing it against user interaction would make
   * the toggle state nondeterministic. Release the dead resource quietly instead of routing through
   * `stopInternalPreview()`; the affordance stays pressed until the user's own next toggle or
   * request clears it. `audioEl` already pointing elsewhere (or being unset) means a newer preview
   * or an explicit stop has since superseded this resource, so this is a no-op.
   */
  private onAudioLoadFailure = (): void => {
    if (!this.audioEl) return;
    this.audioEl.removeEventListener('ended', this.onAudioEnded);
    this.audioEl.removeEventListener('error', this.onAudioLoadFailure);
    this.audioEl = undefined;
  };

  private stopInternalPreview(): void {
    if (this.audioEl) {
      this.audioEl.removeEventListener('ended', this.onAudioEnded);
      this.audioEl.removeEventListener('error', this.onAudioLoadFailure);
      this.audioEl.pause();
      this.audioEl = undefined;
    }
    if (this.previewingId !== null) {
      this.previewingId = null;
      this.emit<{ voiceId: string | null }>('lr-preview-change', { voiceId: null });
    }
  }

  private onPreviewButtonClick = (): void => {
    const candidate = this.previewCandidateId;
    if (!candidate) return;
    if (this.previewingId === candidate) this.stopInternalPreview();
    else this.requestPreview(candidate);
  };

  private onOptionPreviewClick = (e: MouseEvent, entry: DisplayEntry): void => {
    e.stopPropagation(); // don't also select the row -- see onListboxClick
    if (this.previewingId === entry.id) this.stopInternalPreview();
    else this.requestPreview(entry.id);
  };

  private get previewButtonLabel(): string {
    const candidate = this.previewCandidateId;
    const playing = this.previewingId !== null && this.previewingId === candidate;
    const name = this.labelFor(candidate) || candidate;
    return playing ? this.localize('voicePickerStopPreview') : this.localize('voicePickerPreview', undefined, { name });
  }

  // -- Closed-dropdown mode (trigger button) --------------------------------

  private onTriggerClick = (): void => {
    if (this.effectiveDisabled) return;
    this.open ? this.hide() : this.show();
  };
  private onTriggerBlur = (): void => {
    this.touched = true;
    this.hide();
  };
  private onTriggerKeyDown = (e: KeyboardEvent): void => {
    const rows = this.effectiveEntries;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!this.open) return this.show();
        this.activeIndex = Math.min(rows.length - 1, this.activeIndex + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!this.open) return this.show();
        this.activeIndex = Math.max(0, this.activeIndex - 1);
        break;
      case 'Enter':
      case ' ':
        if (this.open) {
          e.preventDefault();
          if (this.activeIndex >= 0 && rows[this.activeIndex]) this.selectEntry(rows[this.activeIndex]);
          else this.hide();
        }
        break;
      case 'Escape':
        if (this.open) {
          e.preventDefault();
          this.hide();
        }
        break;
      case 'Home':
        if (this.open) {
          e.preventDefault();
          this.activeIndex = 0;
        }
        break;
      case 'End':
        if (this.open) {
          e.preventDefault();
          this.activeIndex = rows.length - 1;
        }
        break;
    }
  };

  // -- Free-text mode (text input) -------------------------------------------

  private onComboMouseDown = (e: MouseEvent): void => {
    if (this.effectiveDisabled) return;
    e.preventDefault();
    (this.renderRoot.querySelector('[part="combobox-input"]') as HTMLInputElement | null)?.focus();
  };
  private onInputFocus = (): void => {
    if (!this.open) this.query = this.labelFor(this.value);
    this.show();
    this.emit('focus');
  };
  private onInput = (e: Event): void => {
    this.query = (e.target as HTMLInputElement).value;
    this.activeIndex = -1;
    this.show();
  };
  private onInputBlur = (): void => {
    this.touched = true;
    this.hide();
    this.emit('blur');
  };
  private onInputKeyDown = (e: KeyboardEvent): void => {
    const rows = this.filteredEntries;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!this.open) return this.show();
        this.activeIndex = Math.min(rows.length - 1, this.activeIndex + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!this.open) return this.show();
        this.activeIndex = Math.max(0, this.activeIndex - 1);
        break;
      case 'Enter':
        if (this.open) {
          e.preventDefault();
          this.commitFreeText();
        }
        break;
      case 'Escape':
        if (this.open) {
          e.preventDefault();
          this.query = this.labelFor(this.value);
          this.hide();
        }
        break;
      case 'Home':
        if (this.open) {
          e.preventDefault();
          this.activeIndex = 0;
        }
        break;
      case 'End':
        if (this.open) {
          e.preventDefault();
          this.activeIndex = rows.length - 1;
        }
        break;
    }
  };

  // -- Shared listbox ---------------------------------------------------

  private onListboxMouseDown = (e: MouseEvent): void => {
    if ((e.target as HTMLElement).closest('[part="option"]')) e.preventDefault();
  };
  private onListboxClick = (e: MouseEvent): void => {
    if (this.effectiveDisabled) return;
    const optionEl = (e.target as HTMLElement).closest('[part="option"]') as HTMLElement | null;
    const value = optionEl?.dataset.value;
    if (value === undefined) return;
    const entry = (this.closedMode ? this.effectiveEntries : this.filteredEntries).find((e2) => e2.id === value);
    if (entry) this.selectEntry(entry);
  };

  private renderRows(rows: DisplayEntry[], activeId: string): TemplateResult[] {
    return rows.map((entry, i) => {
      const id = `${this.listId}-opt-${i}`;
      const selected = entry.id === this._value;
      const meta = [entry.language, entry.description].filter(Boolean).join(' · ');
      return html`<div
        part="option"
        id=${id}
        role="option"
        data-value=${entry.id}
        ?data-synthetic=${entry.synthetic}
        aria-selected=${selected ? 'true' : 'false'}
        ?data-active=${id === activeId}
      >
        <span part="option-label">
          <span>${entry.label}</span>
          ${meta ? html`<span part="option-meta">${meta}</span>` : nothing}
        </span>
        ${entry.synthetic ? html`<span part="option-badge">${this.localize('notInCatalog')}</span>` : nothing}
        ${this.preview && entry.previewUrl
          ? html`<span
              part="option-preview"
              tabindex="-1"
              aria-hidden="true"
              @click=${(e: MouseEvent) => this.onOptionPreviewClick(e, entry)}
              >${this.previewingId === entry.id ? pauseIcon() : playIcon()}</span
            >`
          : nothing}
      </div>`;
    });
  }

  private renderListbox(rows: DisplayEntry[], activeId: string, emptyText: string): TemplateResult {
    return html`
      <div
        part="listbox"
        id=${this.listId}
        role="listbox"
        @mousedown=${this.onListboxMouseDown}
        @click=${this.onListboxClick}
      >
        ${rows.length === 0
          ? html`<div part="empty" role="option" aria-selected="false" aria-disabled="true">${emptyText}</div>`
          : this.renderRows(rows, activeId)}
      </div>
    `;
  }

  private onHintSlotChange = (e: Event): void => {
    this.hasHintSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };
  private onErrorSlotChange = (e: Event): void => {
    this.hasErrorSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private renderLabel(): TemplateResult {
    return html`<label part="form-control-label" for=${this.controlId} ?hidden=${!this.label}>${this.label}</label>`;
  }

  private renderHintError(hasError: boolean, hasHint: boolean): TemplateResult {
    return html`
      <div id="voice-picker-error" part="error" ?hidden=${!hasError}>
        ${this.errorText}<slot name="error" @slotchange=${this.onErrorSlotChange}></slot>
      </div>
      <div id="voice-picker-hint" part="hint" ?hidden=${!hasHint}>
        ${this.hint}<slot name="hint" @slotchange=${this.onHintSlotChange}></slot>
      </div>
    `;
  }

  private renderPreviewButton(): TemplateResult {
    if (!this.preview) return html``;
    const candidate = this.previewCandidateId;
    const playing = this.previewingId !== null && this.previewingId === candidate;
    return html`
      <button
        part="preview-button"
        type="button"
        aria-pressed=${playing ? 'true' : 'false'}
        aria-label=${this.previewButtonLabel}
        ?disabled=${this.effectiveDisabled || !candidate}
        @click=${this.onPreviewButtonClick}
      >
        ${playing ? pauseIcon() : playIcon()}
      </button>
    `;
  }

  private renderClosed(): TemplateResult {
    const rows = this.effectiveEntries;
    const activeId = this.activeIndex >= 0 && rows[this.activeIndex] ? `${this.listId}-opt-${this.activeIndex}` : '';
    const hasValue = this._value.length > 0;
    const hasLabel = this.label.length > 0;
    const hasHint = this.hasHintSlot || this.hint.length > 0;
    const hasError = this.hasErrorSlot || this.errorText.length > 0;
    const describedBy = [hasError ? 'voice-picker-error' : '', hasHint ? 'voice-picker-hint' : '']
      .filter(Boolean)
      .join(' ');
    return html`
      ${this.renderLabel()}
      <div class="control-row">
        <button
          id=${this.controlId}
          part="trigger"
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded=${this.open ? 'true' : 'false'}
          aria-controls=${this.listId}
          aria-activedescendant=${activeId}
          aria-label=${this.getAttribute('aria-label') || (hasLabel ? nothing : this.placeholder || this.localize('voice'))}
          aria-describedby=${describedBy || nothing}
          aria-required=${this.required ? 'true' : 'false'}
          aria-invalid=${this.touched && !this.internals.validity.valid ? 'true' : 'false'}
          ?disabled=${this.effectiveDisabled}
          @click=${this.onTriggerClick}
          @keydown=${this.onTriggerKeyDown}
          @blur=${this.onTriggerBlur}
        >
          ${this.provider ? html`<span part="provider-badge">${this.provider}</span>` : ''}
          <span class="trigger-label" ?data-placeholder=${!hasValue}
            >${hasValue ? this.labelFor(this._value) : this.placeholder}</span
          >
          <span part="expand-icon" aria-hidden="true">${chevronIcon()}</span>
        </button>
        ${this.renderPreviewButton()}
      </div>
      ${this.renderListbox(rows, activeId, this.localize('voicePickerNoVoices'))}
      ${this.renderHintError(hasError, hasHint)}
    `;
  }

  private renderFreeText(): TemplateResult {
    const rows = this.filteredEntries;
    const activeId = this.activeIndex >= 0 && rows[this.activeIndex] ? `${this.listId}-opt-${this.activeIndex}` : '';
    const hasLabel = this.label.length > 0;
    const hasHint = this.hasHintSlot || this.hint.length > 0;
    const hasError = this.hasErrorSlot || this.errorText.length > 0;
    const describedBy = [hasError ? 'voice-picker-error' : '', hasHint ? 'voice-picker-hint' : '']
      .filter(Boolean)
      .join(' ');
    return html`
      ${this.renderLabel()}
      <div class="control-row">
        <div part="combobox" @mousedown=${this.onComboMouseDown}>
          ${this.provider ? html`<span part="provider-badge">${this.provider}</span>` : ''}
          <input
            id=${this.controlId}
            part="combobox-input"
            role="combobox"
            aria-label=${this.getAttribute('aria-label') || (hasLabel ? nothing : this.placeholder || this.localize('voice'))}
            aria-expanded=${this.open ? 'true' : 'false'}
            aria-controls=${this.listId}
            aria-activedescendant=${activeId}
            aria-autocomplete="list"
            aria-describedby=${describedBy || nothing}
            aria-required=${this.required ? 'true' : 'false'}
            aria-invalid=${this.touched && !this.internals.validity.valid ? 'true' : 'false'}
            autocomplete=${this.autocomplete || nothing}
            spellcheck=${this.spellcheck}
            autocapitalize=${this.autocapitalize || nothing}
            autocorrect=${this.autoCorrect || nothing}
            inputmode=${this.inputMode || nothing}
            enterkeyhint=${this.enterKeyHint || nothing}
            .value=${this.open ? this.query : this.labelFor(this._value)}
            placeholder=${this.placeholder}
            ?disabled=${this.effectiveDisabled}
            @input=${this.onInput}
            @keydown=${this.onInputKeyDown}
            @focus=${this.onInputFocus}
            @blur=${this.onInputBlur}
          />
          <span part="expand-icon" aria-hidden="true">${chevronIcon()}</span>
        </div>
        ${this.renderPreviewButton()}
      </div>
      ${this.renderListbox(rows, activeId, this.localize('noMatches'))}
      ${this.renderHintError(hasError, hasHint)}
    `;
  }

  render(): TemplateResult {
    return this.closedMode ? this.renderClosed() : this.renderFreeText();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-voice-picker': LyraVoicePicker;
  }
}

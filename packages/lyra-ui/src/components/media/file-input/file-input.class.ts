import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { srOnly } from '../../../internal/a11y.js';
import { acquireAnnouncementSink, type AnnouncementSink } from '../../../internal/announcer.js';
import { finiteCount, finiteRange } from '../../../internal/numbers.js';
import { AnchoredValidityController, VALIDITY_ANCHOR } from '../../../internal/anchored-validity.js';
import { setCustomState, syncValidityStates } from '../../../internal/custom-states.js';
import {
  attachInternalsSafely,
  getFormOwner,
  installCustomErrorProperty,
  isBarredFromValidation,
  setFormOwner,
  type FormOwnerValue,
} from '../../../internal/form-associated.js';
import { installInvalidEventAlias } from '../../../internal/invalid-event-alias.js';
import { dispatchNativeEvent, relayNativeEvent } from '../../../internal/native-event-relay.js';
import { sizes } from '../../../internal/sizes.styles.js';
import { SlotPresenceController } from '../../../internal/slot-presence-controller.js';
import type { LyraSize } from '../../../internal/variants.js';
import { closeIcon, fileIcon } from '../../../internal/icons.js';
import { styles } from './file-input.styles.js';
import { matchesAccept } from './accept.js';
import { presenceTrueDefaultBooleanConverter as trueDefaultBooleanConverter } from '../../../internal/converters.js';
import { FILE_SIZE_UNIT_KEYS, formatFileSize } from '../attachment-chip/file-size.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_dropzoneRejectedType, LYRA_DEFAULT_dropzoneReleaseToAdd, LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_fileInputAcceptedMany, LYRA_DEFAULT_fileInputAcceptedOne, LYRA_DEFAULT_fileInputDefaultLabel, LYRA_DEFAULT_fileInputFolderRejected, LYRA_DEFAULT_fileInputRejectedCount, LYRA_DEFAULT_fileInputRejectedMany, LYRA_DEFAULT_fileInputRejectedOne, LYRA_DEFAULT_fileInputRejectedSize, LYRA_DEFAULT_fileInputRejectedType, LYRA_DEFAULT_fileSizeUnitB, LYRA_DEFAULT_fileSizeUnitGb, LYRA_DEFAULT_fileSizeUnitKb, LYRA_DEFAULT_fileSizeUnitMb, LYRA_DEFAULT_fileSizeUnitTb, LYRA_DEFAULT_open, LYRA_DEFAULT_removeWithContext, LYRA_DEFAULT_restore } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


type DragState = 'default' | 'accept' | 'reject';
type DroppedFolderReadResult =
  | { status: 'complete'; files: File[] }
  | { status: 'cancelled' }
  | { status: 'limit' };
export type LyraFileInputCapture = '' | 'user' | 'environment';

export const DEFAULT_MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_DROPPED_FOLDER_ENTRIES = 10_000;

const INTERACTIVE_CONTENT_SELECTOR =
  'a[href], area[href], button, input, select, textarea, summary, ' +
  '[contenteditable]:not([contenteditable="false"]), [role="button"], [role="link"], ' +
  '[tabindex]:not([tabindex="-1"])';

function isElementTarget(value: EventTarget): value is Element {
  const candidate = value as Partial<Element> & { nodeType?: number };
  return candidate.nodeType === 1 && typeof candidate.matches === 'function';
}

function isFileValue(value: unknown): value is File {
  if (value === null || typeof value !== 'object') return false;
  try {
    const candidate = value as Partial<File>;
    return Object.prototype.toString.call(value) === '[object File]'
      && typeof candidate.name === 'string'
      && typeof candidate.lastModified === 'number'
      && typeof candidate.size === 'number'
      && typeof candidate.type === 'string'
      && typeof candidate.slice === 'function';
  } catch {
    return false;
  }
}

function isFormDataValue(value: unknown): value is FormData {
  if (value === null || typeof value !== 'object') return false;
  try {
    const candidate = value as Partial<FormData>;
    return Object.prototype.toString.call(value) === '[object FormData]'
      && typeof candidate.append === 'function'
      && typeof candidate.values === 'function';
  } catch {
    return false;
  }
}

export interface RejectedFile {
  file: File;
  reason: 'type' | 'count' | 'size' | 'directory';
}

export interface LyraFileInputEventMap {
  blur: FocusEvent;
  focus: FocusEvent;
  input: Event;
  change: Event;
  'lr-invalid': CustomEvent<undefined>;
  'lr-files': CustomEvent<{ files: File[]; rejected: RejectedFile[] }>;
}
/**
 * `<lr-file-input>` — a drag-drop + click-to-browse file dropzone. Emits
 * raw `File[]`; parsing (CSV/XLSX/etc.) is left to the host, since that's
 * where files ultimately get uploaded and processed anyway.
 *
 * @customElement lr-file-input
 * @slot - Custom drop-zone content, overrides the visible `label` text. The
 * accessible name comes from a host `aria-label` when present, then falls
 * back to `label`, so icon-only slot content remains announced correctly.
 * @slot dropzone - Named equivalent of the default dropzone-content slot.
 * @slot label - Custom form-control label content.
 * @slot hint - Custom form-control hint content.
 * @slot error - Custom validation error content. Use `with-error` when this slot is populated in
 * server-rendered declarative shadow DOM before light-DOM slot assignment is observable.
 * @event lr-files - `detail: { files, rejected }`, fired on drop and manual selection.
 * @event {Event} input - Native event fired before `change` when user interaction changes `files`;
 * bubbling, composed, and non-cancelable.
 * @event {Event} change - Native event fired after `input` when user interaction changes `files`;
 * bubbling, composed, and non-cancelable.
 * @event {FocusEvent} focus - Fired when the semantic dropzone receives focus; bubbling, composed,
 * and non-cancelable.
 * @event {FocusEvent} blur - Fired when the semantic dropzone loses focus; bubbling, composed, and
 * non-cancelable.
 * @event lr-invalid - The file input failed a validity check. Cancelable: calling
 * `preventDefault()` also cancels the native `invalid` event behind it, suppressing the browser's
 * own validation bubble so an app can present the failure its own way.
 * @csspart file-input - Compatibility name for the complete form-control wrapper.
 * @csspart form-control - The complete label, dropzone, selected-file, error, and hint frame.
 * @csspart form-control-label - The form-control label.
 * @csspart label - Compatibility wrapper around the visible label content.
 * @csspart hint - The form-control hint.
 * @csspart error - The visible validation message or authored error content.
 * @csspart dropzone - The drag/drop and paste target around the semantic button.
 * @csspart dropzone-icon - The default decorative file icon.
 * @csspart dropzone-text - Wrapper around dropzone slot/text content.
 * @csspart base - The native dropzone button, visually backing the slotted content while remaining
 *   its sibling in the accessibility tree so arbitrary slotted controls are never nested in it.
 * @csspart input - The visually-hidden native `<input type="file">`.
 * @csspart status - The visually-hidden, `aria-hidden` mirror of the drag accept/reject state and
 * accepted/rejected selection counts. The announcement itself lands in the shared light-DOM polite
 * region (`acquireAnnouncementSink()` in `internal/announcer.ts`) — a live region inside a shadow
 * root is not reliably announced — so this part is a styling/inspection surface only.
 * @csspart rejection - The visible region listing each currently-rejected file alongside its
 * reason, rendered in addition to (never in place of) the sr-only `status` summary. Its text stays
 * in the accessibility tree as ordinary visible content; the interrupting announcement it used to
 * make as a shadow `role="alert"` now goes through the shared light-DOM assertive region instead.
 * @csspart file-list - The current selected-file list.
 * @csspart file - One selected-file row.
 * @csspart file-thumbnail - One selected file's thumbnail/icon wrapper.
 * @csspart file-image - Image preview for an image file.
 * @csspart file-icon - Generic icon for a non-image file.
 * @csspart file-details - Filename and formatted-size wrapper.
 * @csspart file-name - Selected filename.
 * @csspart file-size - Localized selected-file size.
 * @csspart remove-button - Removes one selected file.
 * @cssstate blank - Matches while no files are selected.
 * @cssstate dragging - Matches during an active file drag session.
 * @cssprop [--lr-file-input-font-size=var(--lr-form-control-font-size)] - Dropzone text size.
 * @cssprop [--lr-file-input-gap=var(--lr-space-xs)] - Gap between the dropzone's slotted
 * children. While `compact`, this is the fallback when `--lr-file-input-compact-gap` is unset.
 * @cssprop [--lr-file-input-radius=var(--lr-radius)] - Corner radius of `[part="base"]`.
 * @cssprop [--lr-file-input-compact-padding=var(--lr-space-s)] - `[part="base"]` padding while
 * `compact`.
 * @cssprop [--lr-file-input-compact-gap=var(--lr-space-2xs)] - Gap between the dropzone's slotted
 * children while `compact`.
 * @cssprop [--lr-file-input-compact-font-size=var(--lr-font-size-sm)] - Label font size while
 * `compact`.
 * @cssprop [--lr-file-input-accept-border-color=var(--lr-color-success)] - Border color of
 * `[part="base"][data-drag-state="accept"]`.
 * @cssprop [--lr-file-input-accept-bg=color-mix(in srgb, var(--lr-color-success) 8%, transparent)] -
 * Background of `[part="base"][data-drag-state="accept"]`.
 * @cssprop [--lr-file-input-reject-border-color=var(--lr-color-danger)] - Border color of
 * `[part="base"][data-drag-state="reject"]`.
 * @cssprop [--lr-file-input-reject-bg=color-mix(in srgb, var(--lr-color-danger) 8%, transparent)] -
 * Background of `[part="base"][data-drag-state="reject"]`.
 * @cssprop [--lr-form-control-required-content=' *'] - The required marker appended to
 * `form-control-label` while `required` is set. Set it to `''` to suppress the marker, or to any
 * other quoted string (`' (required)'`, a localized word) to replace it.
 * @cssprop [--lr-form-control-required-color=var(--lr-color-danger)] - Required-marker color,
 * themeable independently of error text and invalid borders.
 * @cssprop [--lr-form-control-required-offset=0] - Inline space between the label text and the
 * required marker.
 * @status stable
 * @since 4.0.0
 */
export class LyraFileInput extends LyraElement<LyraFileInputEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    dropzoneRejectedType: LYRA_DEFAULT_dropzoneRejectedType,
    dropzoneReleaseToAdd: LYRA_DEFAULT_dropzoneReleaseToAdd,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    fileInputAcceptedMany: LYRA_DEFAULT_fileInputAcceptedMany,
    fileInputAcceptedOne: LYRA_DEFAULT_fileInputAcceptedOne,
    fileInputDefaultLabel: LYRA_DEFAULT_fileInputDefaultLabel,
    fileInputFolderRejected: LYRA_DEFAULT_fileInputFolderRejected,
    fileInputRejectedCount: LYRA_DEFAULT_fileInputRejectedCount,
    fileInputRejectedMany: LYRA_DEFAULT_fileInputRejectedMany,
    fileInputRejectedOne: LYRA_DEFAULT_fileInputRejectedOne,
    fileInputRejectedSize: LYRA_DEFAULT_fileInputRejectedSize,
    fileInputRejectedType: LYRA_DEFAULT_fileInputRejectedType,
    fileSizeUnitB: LYRA_DEFAULT_fileSizeUnitB,
    fileSizeUnitGb: LYRA_DEFAULT_fileSizeUnitGb,
    fileSizeUnitKb: LYRA_DEFAULT_fileSizeUnitKb,
    fileSizeUnitMb: LYRA_DEFAULT_fileSizeUnitMb,
    fileSizeUnitTb: LYRA_DEFAULT_fileSizeUnitTb,
    open: LYRA_DEFAULT_open,
    removeWithContext: LYRA_DEFAULT_removeWithContext,
    restore: LYRA_DEFAULT_restore,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static formAssociated = true;
  static override styles = [LyraElement.styles, sizes, styles, srOnly];

  static override properties = {
    customError: { attribute: 'custom-error', reflect: true, noAccessor: true },
    name: { reflect: true, noAccessor: true },
    files: { attribute: false, noAccessor: true },
    disabled: { type: Boolean, reflect: true, noAccessor: true },
    required: { type: Boolean, reflect: true, noAccessor: true },
  };

  @property({ type: Boolean, reflect: true }) multiple = false;
  /** Tighter dropzone padding, gap and label font for constrained spaces (a toolbar, a table cell)
   *  -- same convention as `lr-empty`'s `compact`. Defaults to `false`, i.e. the full `--lr-space-l`
   *  dropzone. The dashed border stays; only the internal spacing shrinks. */
  @property({ type: Boolean, reflect: true }) compact = false;
  @property() accept = '';
  /** Mobile capture hint forwarded to the native file picker. */
  @property() capture: LyraFileInputCapture = '';
  @property({ attribute: false }) allowedMimeTypes: string[] = [];
  @property({ attribute: false }) forbiddenMimeTypes: string[] = [];
  /** Largest accepted file size in bytes. `0` (the default) disables the size check entirely --
   *  see `effectiveMaxFileSize` for how an invalid override is handled. */
  @property({ type: Number, attribute: 'max-file-size' }) maxFileSize = 0;
  /** Enables directory selection through the browser's native picker. */
  @property({ type: Boolean, reflect: true }) directory = false;
  /** Enables files pasted from the clipboard into the dropzone. `true`-defaulting, so a plain
   *  `paste="false"` attribute (not just a `.paste=${false}` property binding) actually disables it. */
  @property({ type: Boolean, reflect: true, converter: trueDefaultBooleanConverter }) paste = true;
  /** Form-control label. Empty leaves the localized dropzone instruction as the visible fallback. */
  @property() label = '';
  @property() hint = '';
  /** Plain-text validation error. A custom-validity message is shown when this is empty. */
  @property({ attribute: 'error-text' }) errorText = '';
  /** SSR slot-presence hint for label content. */
  @property({ type: Boolean, attribute: 'with-label' }) withLabel = false;
  /** SSR slot-presence hint for hint content. */
  @property({ type: Boolean, attribute: 'with-hint' }) withHint = false;
  /** SSR slot-presence hint for rich error content. */
  @property({ type: Boolean, attribute: 'with-error' }) withError = false;
  @property({ reflect: true }) size: LyraSize = 'm';
  /** Consumer-managed validator inventory retained for public-surface compatibility. */
  @property({ attribute: false }) validators: unknown[] = [];
  /** Accessible name forwarded to the semantic dropzone and native file input.
   * When unset, the effective `label` text is used. */
  @property({ attribute: 'aria-label' }) accessibleLabel = '';
  /** Message announced after an accepted selection; `{count}` is replaced by
   * the number of accepted files. */
  @property({ attribute: 'accepted-message' }) acceptedMessage = '{count} file(s) added.';
  /** Message announced after rejected files; `{count}` is replaced by the
   * number of rejected files. */
  @property({ attribute: 'rejected-message' }) rejectedMessage = '{count} file(s) rejected.';

  @state() private dragState: DragState = 'default';
  @state() private resultStatus = '';
  /** Files rejected by the most recent drop/paste/selection, each paired with its reason.
   *  Populated in `emitFiles()` (never on mount -- it starts empty and every write is a direct
   *  consequence of a user action), so the visible `[part="rejection"]` alert naturally never
   *  fires on connect and needs no `isMounting` guard. Cleared back to `[]` whenever a
  *  subsequent classification rejects nothing. */
  @state() private rejectedFiles: RejectedFile[] = [];
  @state() private touched = false;
  // Server renderers do not necessarily expose Element.children. The shared controller treats
  // missing DOM surfaces as empty and seeds real light-DOM slot presence after browser hydration.
  private readonly slotPresence = new SlotPresenceController(this);
  @query('[part="base"]') private baseEl?: HTMLElement;
  @query('input[type="file"]') private inputEl?: HTMLInputElement;

  private internals: ElementInternals;
  private validityController: AnchoredValidityController;
  /** Consumer-supplied validation message reflected through `custom-error`. */
  declare customError: string | null;
  private dragCounter = 0;
  private dropToken = 0;
  /** Shared light-DOM live regions this element announces through. A region rendered inside this
   *  shadow root is not reliably announced (JAWS with Firefox ignores one outright), so
   *  `[part="status"]` is only an `aria-hidden` mirror and `[part="rejection"]` is plain visible
   *  text. */
  private politeSink?: AnnouncementSink;
  private assertiveSink?: AnnouncementSink;
  /** False until the first render has committed, so mounting never announces a resting state. */
  private announcementsArmed = false;
  private _name: string | null = null;
  private _files: File[] = [];
  private _fileCount = 0;
  private _disabled = false;
  private _required = false;
  private validationTargetOverride?: HTMLElement;
  private _fieldsetDisabled = false;
  private thumbnailUrls = new Map<File, { url: string; owner: typeof URL; revoke: () => void }>();

  constructor() {
    super();
    this.internals = attachInternalsSafely(this);
    this.validityController = new AnchoredValidityController(this, this.internals, () => this[VALIDITY_ANCHOR]());
    installCustomErrorProperty(this, () => this.validityController.customValidityMessage);
    installInvalidEventAlias(this, (init: { cancelable: true }) =>
      this.emit('lr-invalid', undefined, init));
    this.internals.setFormValue(null);
  }

  get form(): HTMLFormElement | null {
    return getFormOwner(this.internals);
  }
  set form(owner: FormOwnerValue) {
    setFormOwner(this, owner);
  }
  getForm(): HTMLFormElement | null {
    return getFormOwner(this.internals);
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

  /** Submitted field name.
   * @default null */
  get name(): string | null {
    return this._name;
  }
  set name(next: string | null) {
    const old = this._name;
    this._name = next == null || next === '' ? null : String(next);
    if (this._name == null) this.removeAttribute('name');
    else this.setAttribute('name', this._name);
    this.syncFormValue();
    this.requestUpdate('name', old);
  }

  /** Selected files. Programmatic writes are silent but immediately synchronize rendering/forms.
   * @default [] */
  get files(): File[] {
    return [...this._files];
  }
  set files(next: File[]) {
    const old = this._files;
    const valid = Array.isArray(next) ? next.filter(isFileValue) : [];
    this._files = this.multiple ? [...valid] : valid.slice(0, 1);
    this.fileCount = this._files.length;
    this.syncThumbnailUrls();
    this.syncFormValue();
    this.updateValidity();
    this.requestUpdate('files', old);
  }

  /** Public file-count state. Real file writes resynchronize it to `files.length`.
   * @default 0 */
  get fileCount(): number {
    return this._fileCount;
  }
  set fileCount(next: number) {
    const old = this._fileCount;
    this._fileCount = finiteCount(next, this._files.length);
    this.requestUpdate('fileCount', old);
  }

  /** Whether a file drag session is active. A consumer write uses the accepting visual state;
   * the next real drag event resumes ownership of the accept/reject distinction.
   * @default false */
  get dragging(): boolean {
    return this.dragState !== 'default';
  }
  set dragging(next: boolean) {
    const active = Boolean(next);
    if (active === this.dragging) return;
    this.dragState = active ? 'accept' : 'default';
    this.publishCustomStates();
  }

  /** Disables every interactive sub-control.
   * @default false */
  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(next: boolean) {
    const old = this._disabled;
    this._disabled = Boolean(next);
    this.toggleAttribute('disabled', this._disabled);
    if (this._disabled) {
      this.dropToken++;
      this.resetDragSession();
    }
    // Disabling bars constraint validation, so the intrinsic violation has to be dropped with it --
    // synchronously, for the same reason the attribute is reflected synchronously.
    this.updateValidity();
    this.requestUpdate('disabled', old);
  }

  /** Requires at least one selected file.
   * @default false */
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

  get effectiveDisabled(): boolean {
    return this.disabled || this._fieldsetDisabled;
  }

  /** Constraint-validation popup anchor. The focusable base of the dropzone control is the
   * default after first render; assign another shadow descendant to override the anchor, or
   * `undefined` to restore the default. */
  get validationTarget(): HTMLElement | undefined {
    return this.validationTargetOverride ?? this.baseEl;
  }
  set validationTarget(next: HTMLElement | undefined) {
    this.validationTargetOverride = next ?? undefined;
    this.validityController.refreshAnchor();
  }

  /** @internal */
  [VALIDITY_ANCHOR](): HTMLElement | null {
    return this.validationTarget ?? null;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (changed.has('multiple')) {
      if (!this.multiple && this._files.length > 1) this.files = this._files;
      else this.syncFormValue();
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.syncThumbnailUrls();
    this.updateValidity();
    // Acquired on connect, not on the first announcement: assistive tech has to have been
    // observing a live region *before* text arrives for the change to be announced at all, and a
    // drag can start in the same task this element is appended in.
    this.politeSink ??= acquireAnnouncementSink('polite', {
      document: this.ownerDocument,
      source: this,
    });
    this.assertiveSink ??= acquireAnnouncementSink('assertive', {
      document: this.ownerDocument,
      source: this,
    });
  }

  override disconnectedCallback(): void {
    this.dropToken++;
    this.resetDragSession();
    for (const thumbnail of this.thumbnailUrls.values()) thumbnail.revoke();
    this.thumbnailUrls.clear();
    this.politeSink?.release();
    this.politeSink = undefined;
    this.assertiveSink?.release();
    this.assertiveSink = undefined;
    // Re-arm so a reconnect never replays the state it disconnected holding.
    this.announcementsArmed = false;
    super.disconnectedCallback();
  }

  // Untyped `PropertyValues` (not `PropertyValues<this>`): the announced transitions are tracked
  // on private `@state()` fields, which `keyof this` does not include.
  protected override updated(changed: PropertyValues): void {
    // The very first render is a mount, not a transition: a component appearing on the page must
    // not announce its resting state.
    if (this.announcementsArmed) {
      if (changed.has('dragState') || changed.has('resultStatus')) {
        this.politeSink?.announce(this.statusText());
      }
      if (changed.has('rejectedFiles') && this.rejectedFiles.length > 0) {
        this.assertiveSink?.announce(
          this.rejectedFiles.map((rejected) => this.rejectionMessage(rejected)).join(' '),
        );
      }
    }
    this.announcementsArmed = true;
  }

  private syncFormValue(): void {
    if (!this.name || this._files.length === 0) {
      const state = this.multiple ? this.createFormData() : (this._files[0] ?? null);
      this.internals.setFormValue(null, state);
      return;
    }
    if (this.multiple) {
      const submitted = this.createFormData();
      const state = this.createFormData();
      if (!submitted || !state) {
        this.internals.setFormValue(null);
        return;
      }
      for (const file of this._files) {
        submitted.append(this.name, file);
        state.append('file', file);
      }
      this.internals.setFormValue(submitted, state);
      return;
    }
    const file = this._files[0] ?? null;
    this.internals.setFormValue(file, file);
  }

  private createFormData(): FormData | null {
    const FormDataCtor = this.ownerDocument?.defaultView?.FormData;
    return FormDataCtor ? new FormDataCtor() : null;
  }

  /**
   * Shared with every other form control: own `disabled` and a `<fieldset disabled>` ancestor bar
   * constraint validation (this control has no `readonly` of its own — a file picker with nothing
   * to pick from is spelled `disabled`). A barred control matches neither `:valid` nor `:invalid`
   * natively, so leaving `valueMissing` raised on a disabled required dropzone is what painted it
   * red under the documented `:state(user-invalid)` rule.
   */
  private get barredFromValidation(): boolean {
    return isBarredFromValidation(this, this.internals);
  }

  private updateValidity(): void {
    if (this.barredFromValidation) {
      this.validityController.setValidity({});
    } else if (this.required && this._files.length === 0) {
      this.validityController.setValidity({ valueMissing: true }, this.localize('fieldRequired'));
    } else {
      this.validityController.setValidity({});
    }
    this.publishCustomStates();
  }

  private publishCustomStates(): void {
    syncValidityStates(this.internals, {
      required: this.required,
      hasInteracted: this.touched,
      barred: this.barredFromValidation,
    });
    setCustomState(this.internals, 'blank', this._files.length === 0);
    setCustomState(this.internals, 'dragging', this.dragging);
    this.toggleAttribute('dragging', this.dragging);
  }

  checkValidity(): boolean {
    return this.internals.checkValidity();
  }

  reportValidity(): boolean {
    this.touched = true;
    this.publishCustomStates();
    return this.internals.reportValidity();
  }

  setCustomValidity(message: string): void {
    this.validityController.setCustomValidity(message ?? '');
    this.publishCustomStates();
    this.requestUpdate();
  }

  resetValidity(): void {
    this.validityController.setCustomValidity('');
    this.updateValidity();
    this.requestUpdate();
  }

  formResetCallback(): void {
    this.touched = false;
    this.files = [];
    this.rejectedFiles = [];
    this.resultStatus = '';
  }

  formStateRestoreCallback(
    state: string | File | FormData | null,
    reason: 'autocomplete' | 'restore',
  ): void {
    void reason;
    if (isFileValue(state)) {
      this.files = [state];
      return;
    }
    if (isFormDataValue(state)) {
      this.files = [...state.values()].filter(isFileValue);
      return;
    }
    this.files = [];
  }

  formDisabledCallback(disabled: boolean): void {
    this._fieldsetDisabled = disabled;
    if (disabled) {
      this.dropToken++;
      this.resetDragSession();
    }
    // Cascaded disablement bars constraint validation exactly like the control's own `disabled`.
    this.updateValidity();
    this.requestUpdate();
  }

  private syncThumbnailUrls(): void {
    const urlApi = this.ownerDocument.defaultView?.URL ?? globalThis.URL;
    const canCreate = typeof urlApi.createObjectURL === 'function';
    const canRevoke = typeof urlApi.revokeObjectURL === 'function';
    let changed = false;
    for (const [file, thumbnail] of this.thumbnailUrls) {
      if (!this._files.includes(file) || thumbnail.owner !== urlApi) {
        thumbnail.revoke();
        this.thumbnailUrls.delete(file);
        changed = true;
      }
    }
    if (canCreate) {
      for (const file of this._files) {
        if (!file.type.startsWith('image/') || this.thumbnailUrls.has(file)) continue;
        const url = urlApi.createObjectURL(file);
        this.thumbnailUrls.set(file, {
          url,
          owner: urlApi,
          revoke: canRevoke ? () => urlApi.revokeObjectURL(url) : () => undefined,
        });
        changed = true;
      }
    }
    // The map is not a reactive field. Reconnection and never-connected cross-document adoption
    // can replace a URL without changing `files`, so explicitly repaint the rendered `<img src>`.
    if (changed) this.requestUpdate();
  }

  /** `maxFileSize` normalized: `0` (explicitly set, or left at the default) or `Infinity`
   *  (explicitly set) both mean "no limit" verbatim -- `null` here signals that. Anything else
   *  that isn't a positive, finite override -- a `NaN` from an invalid `max-file-size` attribute,
   *  or a negative value -- falls back to a sane cap instead. This matters because the size check
   *  below used to gate directly on `this.maxFileSize > 0`: `NaN > 0` and `-1 > 0` are both
   *  `false`, so an invalid override silently disabled the entire size limit (accepting files of
   *  any size) rather than failing safe. */
  private get effectiveMaxFileSize(): number | null {
    const maxFileSize = this.maxFileSize;
    if (maxFileSize === 0 || maxFileSize === Infinity) return null;
    return finiteRange(maxFileSize > 0 ? maxFileSize : NaN, DEFAULT_MAX_FILE_SIZE_BYTES, 1);
  }

  private isAllowed(file: File, isPreview = false): 'ok' | 'type' | 'size' {
    if (this.forbiddenMimeTypes.includes(file.type)) return 'type';
    if (this.allowedMimeTypes.length > 0 && !this.allowedMimeTypes.includes(file.type)) return 'type';
    // During dragenter preview, `accept` extension patterns can't be evaluated (no
    // `.name` yet) — treat them as a possible match rather than a guaranteed reject,
    // so the preview doesn't flag a file that will in fact be accepted on drop.
    if (this.accept && !matchesAccept(file, this.accept, isPreview)) return 'type';
    // `file.size` is `undefined` on the synthetic `DataTransferItem`-cast objects
    // used during dragenter preview (real sizes aren't available until drop),
    // so this naturally only takes effect for the real `classify()` call at drop time.
    const maxFileSize = this.effectiveMaxFileSize;
    if (maxFileSize !== null && file.size > maxFileSize) return 'size';
    return 'ok';
  }

  private classify(
    fileList: File[],
    isPreview = false,
  ): { files: File[]; rejected: RejectedFile[] } {
    if (!this.multiple && fileList.length > 1) {
      return { files: [], rejected: fileList.map((file) => ({ file, reason: 'count' as const })) };
    }
    const files: File[] = [];
    const rejected: RejectedFile[] = [];
    for (const f of fileList) {
      const reason = this.isAllowed(f, isPreview);
      if (reason === 'ok') files.push(f);
      else rejected.push({ file: f, reason });
    }
    return { files, rejected };
  }

  /** Per-reason, per-file message for the visible `[part="rejection"]` alert. The filename is
   *  caller-supplied data interpolated via the `values` argument, never localized itself --
   *  only the surrounding copy comes from `this.localize()`. `'directory'` deliberately reuses
   *  `fileInputFolderRejected` verbatim (its template has no `{filename}` placeholder, so the
   *  extra interpolation value is simply unused). */
  private rejectionMessage(rejected: RejectedFile): string {
    const filename = rejected.file.name;
    switch (rejected.reason) {
      case 'type':
        return this.localize('fileInputRejectedType', undefined, { filename });
      case 'size':
        return this.localize('fileInputRejectedSize', undefined, { filename });
      case 'count':
        return this.localize('fileInputRejectedCount', undefined, { filename });
      case 'directory':
        return this.localize('fileInputFolderRejected', undefined, { filename });
    }
  }

  private emitFiles(fileList: File[], additionalRejected: RejectedFile[] = []): void {
    const { files, rejected } = this.classify(fileList);
    rejected.push(...additionalRejected);
    this.rejectedFiles = rejected;
    const messages: string[] = [];
    const numberFormat = getNumberFormat(this.effectiveLocale);
    if (files.length) {
      messages.push(
        this.localize(
          files.length === 1 ? 'fileInputAcceptedOne' : 'fileInputAcceptedMany',
          this.acceptedMessage === '{count} file(s) added.' ? undefined : this.acceptedMessage,
          { count: numberFormat.format(files.length) },
        ),
      );
    }
    if (rejected.length) {
      messages.push(
        this.localize(
          rejected.length === 1 ? 'fileInputRejectedOne' : 'fileInputRejectedMany',
          this.rejectedMessage === '{count} file(s) rejected.' ? undefined : this.rejectedMessage,
          { count: numberFormat.format(rejected.length) },
        ),
      );
    }
    this.resultStatus = messages.join(' ');
    if (files.length) {
      this.touched = true;
      this.files = this.multiple ? [...this._files, ...files] : files;
      dispatchNativeEvent(this, 'input');
      dispatchNativeEvent(this, 'change');
    }
    this.emit('lr-files', { files, rejected });
  }

  /** Programmatically open the native file picker. */
  openPicker(): void {
    if (this.effectiveDisabled) return;
    this.inputEl?.click();
  }

  /** Focuses the semantic dropzone. */
  override focus(options?: FocusOptions): void {
    this.baseEl?.focus(options);
  }

  /** Removes focus from the semantic dropzone. */
  override blur(): void {
    this.baseEl?.blur();
  }

  /** Opens the native picker, matching a user click on the semantic dropzone. */
  override click(): void {
    this.openPicker();
  }

  private resetDragSession(): void {
    this.dragCounter = 0;
    this.dragState = 'default';
    this.publishCustomStates();
  }

  private previewState(fileList: File[]): DragState {
    const { rejected } = this.classify(fileList, true);
    return rejected.length > 0 ? 'reject' : 'accept';
  }

  private onDragEnter = (e: DragEvent): void => {
    e.preventDefault();
    if (this.effectiveDisabled) return;
    this.dragCounter++;
    const items = e.dataTransfer ? [...e.dataTransfer.items].filter((i) => i.kind === 'file') : [];
    this.dragState = items.length ? this.previewState(items as unknown as File[]) : 'default';
    this.publishCustomStates();
  };

  private onDragOver = (e: DragEvent): void => {
    // Always suppress the browser's default drop action (e.g. navigating the
    // whole page to the dropped file), even while disabled — only the
    // subsequent classification/emit logic is gated on `disabled`.
    e.preventDefault();
    if (this.effectiveDisabled) return;
  };

  private onDragLeave = (e: DragEvent): void => {
    if (this.effectiveDisabled) return;
    e.preventDefault();
    this.dragCounter = Math.max(0, this.dragCounter - 1);
    if (this.dragCounter === 0) {
      this.dragState = 'default';
      this.publishCustomStates();
    }
  };

  private readDroppedFile(
    entry: FileSystemFileEntry,
    isCurrent: () => boolean,
  ): Promise<File | undefined> {
    if (!isCurrent()) return Promise.resolve(undefined);
    return new Promise<File | undefined>((resolve) => {
      entry.file(
        (file) => resolve(isCurrent() ? file : undefined),
        () => resolve(undefined),
      );
    });
  }

  private readDroppedDirectoryBatch(
    reader: FileSystemDirectoryReader,
    isCurrent: () => boolean,
  ): Promise<FileSystemEntry[] | undefined> {
    if (!isCurrent()) return Promise.resolve(undefined);
    return new Promise<FileSystemEntry[] | undefined>((resolve) => {
      reader.readEntries(
        (entries) => resolve(isCurrent() ? entries : undefined),
        () => resolve([]),
      );
    });
  }

  /** Walks legacy File System API folders one operation at a time, with a bounded queue. */
  private async readDroppedFolders(
    folders: FileSystemEntry[],
    isCurrent: () => boolean,
  ): Promise<DroppedFolderReadResult> {
    const files: File[] = [];
    const queue: FileSystemEntry[] = [];
    let entryCount = 0;
    const enqueue = (entry: FileSystemEntry): boolean => {
      if (entryCount >= MAX_DROPPED_FOLDER_ENTRIES) return false;
      entryCount++;
      queue.push(entry);
      return true;
    };

    for (const folder of folders) {
      if (!isCurrent()) return { status: 'cancelled' };
      if (!enqueue(folder)) return { status: 'limit' };
    }

    for (let index = 0; index < queue.length; index++) {
      if (!isCurrent()) return { status: 'cancelled' };
      const entry = queue[index]!;
      if (entry.isFile) {
        const file = await this.readDroppedFile(entry as FileSystemFileEntry, isCurrent);
        if (!isCurrent()) return { status: 'cancelled' };
        if (file) files.push(file);
        continue;
      }
      if (!entry.isDirectory) continue;

      const reader = (entry as FileSystemDirectoryEntry).createReader();
      while (true) {
        if (!isCurrent()) return { status: 'cancelled' };
        const entries = await this.readDroppedDirectoryBatch(reader, isCurrent);
        if (!isCurrent()) return { status: 'cancelled' };
        if (!entries?.length) break;
        for (const child of entries) {
          if (!isCurrent()) return { status: 'cancelled' };
          if (!enqueue(child)) return { status: 'limit' };
        }
      }
    }
    return { status: 'complete', files };
  }

  private onDrop = (e: DragEvent): void => {
    // Same rationale as `onDragOver`: prevent the browser's default drop
    // action unconditionally, before the `disabled` gate.
    e.preventDefault();
    if (this.effectiveDisabled) return;
    this.resetDragSession();
    const token = ++this.dropToken;
    const files = [...(e.dataTransfer?.files ?? [])];
    const folders = [...(e.dataTransfer?.items ?? [])]
      .map((item) => (item as DataTransferItem & { webkitGetAsEntry?: () => FileSystemEntry | null }).webkitGetAsEntry?.())
      .filter((entry): entry is FileSystemEntry => !!entry && entry.isDirectory);
    if (folders.length && this.multiple) {
      const isCurrent = () => token === this.dropToken && this.isConnected && !this.effectiveDisabled;
      void this.readDroppedFolders(folders, isCurrent).then((result) => {
        if (!isCurrent() || result.status !== 'complete') return;
        const allFiles = [...files, ...result.files];
        if (allFiles.length) this.emitFiles(allFiles);
      });
      return;
    }
    const FileCtor = this.ownerDocument.defaultView?.File ?? globalThis.File;
    const rejectedFolders = folders.map((folder) => ({
      file: new FileCtor([], folder.name),
      reason: 'directory' as const,
    }));
    if (files.length || rejectedFolders.length) this.emitFiles(files, rejectedFolders);
  };

  private onPaste = (e: ClipboardEvent): void => {
    if (!this.paste || this.effectiveDisabled) return;
    const files = [...(e.clipboardData?.files ?? [])];
    if (files.length) { e.preventDefault(); this.emitFiles(files); }
  };

  private onInputChange = (e: Event): void => {
    const input = e.target as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = '';
    if (!this.effectiveDisabled && files.length) this.emitFiles(files);
  };
  // Bridged off [part="base"] (the actual keyboard-focusable dropzone), not the visually-hidden,
  // tabindex="-1", aria-hidden native `<input type="file">` — that input is never focused by a
  // user, only `.click()`ed by `openPicker()`, so binding here is what makes a host-level
  // `addEventListener('focus' | 'blur', ...)` observe real focus/blur at all; native focus/blur
  // neither bubble nor cross the shadow boundary on their own.
  private onFocus = (event: FocusEvent): void => {
    relayNativeEvent(this, event);
  };
  private onBlur = (event: FocusEvent): void => {
    // The dropzone `[part="base"]` button becoming disabled while it holds focus force-blurs it --
    // a platform reaction to the very `?disabled=${effectiveDisabled}` render that turned it on, not
    // a user interaction. That blur can land synchronously nested inside the update this handler is
    // itself part of (Lit committing the button's `disabled` attribute), before `effectiveDisabled`
    // could read anything but `true` here. Marking `touched` for it was, depending on timing, capable
    // of reentering that same in-flight update and tripping Lit's dev-mode "scheduled an update
    // after an update completed" warning for a state flip nothing observable needed -- a disabled
    // control is barred from validation regardless (fr_asxOgk4UhNB07xevCWwFVQ).
    if (!this.effectiveDisabled) this.touched = true;
    this.publishCustomStates();
    relayNativeEvent(this, event);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.effectiveDisabled) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      // Prevent Space from scrolling the page, matching the `table.ts`
      // sortable-header/row convention for role-based clickable elements.
      e.preventDefault();
      this.openPicker();
    }
  };

  private onDropzoneClick = (event: MouseEvent): void => {
    const path = event.composedPath();
    // The native base button owns its own activation handler below. Any other interactive node
    // in arbitrary slotted content keeps its own click instead of also opening the file picker.
    if (
      path.includes(this.baseEl as EventTarget) ||
      path.some((node) => isElementTarget(node) && node.matches(INTERACTIVE_CONTENT_SELECTOR))
    ) {
      return;
    }
    this.openPicker();
  };

  private statusText(): string {
    if (this.dragState === 'accept') return this.localize('dropzoneReleaseToAdd');
    if (this.dragState === 'reject') return this.localize('dropzoneRejectedType');
    return this.resultStatus;
  }

  /** Resolves `label`'s effective text: an explicit override wins verbatim; left at the
   *  built-in default it instead routes through `this.localize()` so a locale/`.strings`
   *  override applies without requiring `label` itself to be set. */
  private get effectiveLabel(): string {
    return this.label || this.localize('fileInputDefaultLabel');
  }

  private removeFile(index: number): void {
    if (this.effectiveDisabled || index < 0 || index >= this._files.length) return;
    this.touched = true;
    this.files = this._files.filter((_, candidate) => candidate !== index);
    dispatchNativeEvent(this, 'input');
    dispatchNativeEvent(this, 'change');
  }

  private fileSize(file: File): string {
    return formatFileSize(
      file.size,
      (unit) => this.localize(FILE_SIZE_UNIT_KEYS[unit]),
      (value, fractionDigits) =>
        getNumberFormat(this.effectiveLocale, {
          minimumFractionDigits: fractionDigits,
          maximumFractionDigits: fractionDigits,
        }).format(value),
    );
  }

  private renderFile(file: File, index: number): TemplateResult {
    const thumbnail = this.thumbnailUrls.get(file)?.url;
    return html`<div part="file">
      <span part="file-thumbnail" aria-hidden="true">
        ${thumbnail
          ? html`<img part="file-image" src=${thumbnail} alt="" />`
          : html`<span part="file-icon">${fileIcon()}</span>`}
      </span>
      <span part="file-details">
        <span part="file-name" dir="auto" title=${file.name}>${file.name}</span>
        <span part="file-size">${this.fileSize(file)}</span>
      </span>
      <button
        part="remove-button"
        type="button"
        ?disabled=${this.effectiveDisabled}
        aria-label=${this.localize('removeWithContext', undefined, { label: file.name })}
        @click=${() => this.removeFile(index)}
      >${closeIcon()}</button>
    </div>`;
  }

  override render(): TemplateResult {
    const label = this.effectiveLabel;
    const accessibleLabel = this.getAttribute('aria-label') || this.accessibleLabel || label;
    const hasLabel = this.withLabel || this.slotPresence.has('label') || this.label.length > 0;
    const hasHint = this.withHint || this.slotPresence.has('hint') || this.hint.length > 0;
    const renderedError = this.errorText || this.customError || (this.touched ? this.validationMessage : '');
    const hasError = this.withError || this.slotPresence.has('error') || renderedError.length > 0;
    const describedBy = [hasError ? 'file-input-error' : '', hasHint ? 'file-input-hint' : '']
      .filter(Boolean)
      .join(' ');
    const invalid = hasError || (this.touched && !this.internals.validity.valid);
    return html`
      <div part="file-input form-control">
        <label part="form-control-label" ?hidden=${!hasLabel}>
          <span part="label">${this.label}<slot name="label"></slot></span>
        </label>
        <div
          part="dropzone"
          class="dropzone"
          @dragenter=${this.onDragEnter}
          @dragover=${this.onDragOver}
          @dragleave=${this.onDragLeave}
          @drop=${this.onDrop}
          @paste=${this.onPaste}
          @click=${this.onDropzoneClick}
        >
          <button
            part="base"
            type="button"
            role="button"
            tabindex=${this.effectiveDisabled ? '-1' : '0'}
            aria-disabled=${this.effectiveDisabled ? 'true' : 'false'}
            aria-label=${accessibleLabel}
            aria-describedby=${describedBy || nothing}
            aria-invalid=${invalid ? 'true' : 'false'}
            data-drag-state=${this.dragState}
            ?disabled=${this.effectiveDisabled}
            @click=${this.openPicker}
            @keydown=${this.onKeyDown}
            @focus=${this.onFocus}
            @blur=${this.onBlur}
          ></button>
          <div class="dropzone-content">
            <span part="dropzone-icon" aria-hidden="true">${fileIcon()}</span>
            <span part="dropzone-text"><slot name="dropzone"><slot>${label}</slot></slot></span>
          </div>
        </div>
        ${this._files.length
          ? html`<div part="file-list">${this._files.map((file, index) => this.renderFile(file, index))}</div>`
          : nothing}
        <div id="file-input-error" part="error" ?hidden=${!hasError}>
          <slot name="error">${renderedError}</slot>
        </div>
        <div id="file-input-hint" part="hint" ?hidden=${!hasHint}>
          ${this.hint}<slot name="hint"></slot>
        </div>
      </div>
      <div part="status" class="sr-only" aria-hidden="true">${this.statusText()}</div>
      ${this.rejectedFiles.length
        ? html`
            <div part="rejection">
              <ul>
                ${this.rejectedFiles.map((r) => html`<li>${this.rejectionMessage(r)}</li>`)}
              </ul>
            </div>
          `
        : nothing}
      <input
        part="input"
        class="sr-only"
        type="file"
        tabindex="-1"
        aria-hidden="true"
        aria-label=${accessibleLabel}
        accept=${this.accept}
        capture=${this.capture || nothing}
        ?multiple=${this.multiple}
        ?webkitdirectory=${this.directory}
        ?disabled=${this.effectiveDisabled}
        @change=${this.onInputChange}
      />
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-file-input': LyraFileInput;
  }
}

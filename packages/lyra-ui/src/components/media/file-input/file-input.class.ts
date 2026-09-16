import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { installFormControlLabelSupport } from '../../../internal/form-control-labels.js';
installFormControlLabelSupport();
import { hostAriaLabel, srOnly } from '../../../internal/a11y.js';
import { acquireAnnouncementSink, type AnnouncementSink } from '../../../internal/announcer.js';
import { finiteCount, finiteRange } from '../../../internal/numbers.js';
import { AggregateFileLimitTracker } from '../../../internal/aggregate-file-limits.js';
import { AnchoredValidityController, VALIDITY_ANCHOR } from '../../../internal/anchored-validity.js';
import { setCustomState, syncValidityStates } from '../../../internal/custom-states.js';
import { syncAriaDescribedByElements } from '../../../internal/aria-controls.js';
import {
  attachInternalsSafely,
  getFormOwner,
  installCustomErrorProperty,
  isBarredFromValidation,
  setFormOwner,
  type FormOwnerValue,
} from '../../../internal/form-associated.js';
import {
  installInteractionOnInvalid,
  installInvalidEventAlias,
  withStaticValidityCheck,
} from '../../../internal/invalid-event-alias.js';
import { dispatchNativeEvent, relayNativeEvent } from '../../../internal/native-event-relay.js';
import { DropSessionController, type DropSessionState } from '../../../internal/drop-session-controller.js';
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
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_dropzoneRejectedType, LYRA_DEFAULT_dropzoneReleaseToAdd, LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_fileInputAcceptedMany, LYRA_DEFAULT_fileInputAcceptedOne, LYRA_DEFAULT_fileInputDefaultLabel, LYRA_DEFAULT_fileInputFolderRejected, LYRA_DEFAULT_fileInputRejectedCount, LYRA_DEFAULT_fileInputRejectedLimit, LYRA_DEFAULT_fileInputRejectedMany, LYRA_DEFAULT_fileInputRejectedMaxFiles, LYRA_DEFAULT_fileInputRejectedMaxTotalSize, LYRA_DEFAULT_fileInputRejectedOne, LYRA_DEFAULT_fileInputRejectedRead, LYRA_DEFAULT_fileInputRejectedSize, LYRA_DEFAULT_fileInputRejectedType, LYRA_DEFAULT_fileSizeUnitB, LYRA_DEFAULT_fileSizeUnitGb, LYRA_DEFAULT_fileSizeUnitKb, LYRA_DEFAULT_fileSizeUnitMb, LYRA_DEFAULT_fileSizeUnitTb, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_open, LYRA_DEFAULT_popover, LYRA_DEFAULT_progress, LYRA_DEFAULT_removeWithContext, LYRA_DEFAULT_restore, LYRA_DEFAULT_search, LYRA_DEFAULT_select, LYRA_DEFAULT_valueInvalid } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


type FileInputOutcomeMessageKey =
  | 'fileInputAcceptedOne'
  | 'fileInputAcceptedMany'
  | 'fileInputRejectedOne'
  | 'fileInputRejectedMany';
export type LyraFileInputCapture = '' | 'user' | 'environment';

/** What a `validators` entry may return: nothing/`true` passes, a string is the message, `false` is
 *  a generic failure, and an object of {@linkcode ValidityStateFlags} names the flags to raise. */
export type LyraFileInputValidatorResult = void | boolean | string | ValidityStateFlags;
/** Result shape accepted from object validators used by the upstream form-control contract. */
export interface LyraFileInputObjectValidatorResult {
  message: string;
  isValid: boolean;
  invalidKeys: Exclude<keyof ValidityState, 'valid'>[];
}
/** Structural compatibility shape for an object validator. The `never` callback input is
 * intentional: it lets an array typed by another custom-element package remain assignable while
 * Lyra invokes the callback with this host at runtime. Author new Lyra validators with the
 * strongly typed function or `validate()` branches of {@linkcode LyraFileInputValidator}. */
export interface LyraFileInputObjectValidator {
  /** Host attributes that trigger a fresh validity check when they change. */
  observedAttributes?: string[];
  checkValidity: (input: never) => LyraFileInputObjectValidatorResult;
  message?: string | ((input: never) => string);
}
export type LyraFileInputValidator =
  | ((value: File[], input: LyraFileInput) => LyraFileInputValidatorResult)
  | { validate(value: File[], input: LyraFileInput): LyraFileInputValidatorResult }
  | LyraFileInputObjectValidator;

const VALIDITY_FLAG_KEYS: ReadonlySet<keyof ValidityStateFlags> = new Set<keyof ValidityStateFlags>([
  'badInput',
  'customError',
  'patternMismatch',
  'rangeOverflow',
  'rangeUnderflow',
  'stepMismatch',
  'tooLong',
  'tooShort',
  'typeMismatch',
  'valueMissing',
]);

function isValidityFlagKey(value: unknown): value is keyof ValidityStateFlags {
  return typeof value === 'string' && VALIDITY_FLAG_KEYS.has(value as keyof ValidityStateFlags);
}

export const DEFAULT_MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
/** Fallback used by `effectiveMaxFiles` for an invalid (negative/`NaN`) `maxFiles` override,
 *  mirroring `DEFAULT_MAX_FILE_SIZE_BYTES`'s fail-safe role for `maxFileSize`. */
export const DEFAULT_MAX_FILES = 100;
/** Fallback used by `effectiveMaxTotalSize` for an invalid (negative/`NaN`) `maxTotalSize`
 *  override, mirroring `DEFAULT_MAX_FILE_SIZE_BYTES`'s fail-safe role for `maxFileSize`. */
export const DEFAULT_MAX_TOTAL_SIZE_BYTES = 250 * 1024 * 1024;
const MAX_DROPPED_FOLDER_ENTRIES = 10_000;
const MAX_MIME_TYPES = 10_000;
const EMPTY_MIME_TYPES: readonly string[] = Object.freeze([]);

function snapshotMimeTypes(value: unknown): readonly string[] {
  try {
    if (!Array.isArray(value)) return EMPTY_MIME_TYPES;
    const count = Math.min(value.length, MAX_MIME_TYPES);
    const values: string[] = [];
    for (let index = 0; index < count; index++) {
      try {
        const candidate = value[index];
        if (typeof candidate === 'string') values.push(candidate);
      } catch {
        // A hostile indexed getter invalidates only its own entry.
      }
    }
    return values.length ? Object.freeze(values) : EMPTY_MIME_TYPES;
  } catch {
    return EMPTY_MIME_TYPES;
  }
}

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

export interface LyraFileInputRejectedFile {
  readonly file: File;
  readonly reason: 'type' | 'count' | 'size' | 'directory' | 'read' | 'limit' | 'maxFiles' | 'maxTotalSize';
}

export interface LyraFileInputFilesDetail {
  readonly files: readonly File[];
  readonly rejected: readonly LyraFileInputRejectedFile[];
  /** Remaining allowance under `maxFiles` after this batch, at the control's running count
   *  (retained files, unless `nonRetaining`, plus `heldFileCount`) -- `null` while `maxFiles` is
   *  unset (no limit), never negative. */
  readonly remainingFiles: number | null;
  /** Remaining allowance under `maxTotalSize` after this batch, in bytes -- `null` while
   *  `maxTotalSize` is unset (no limit), never negative. */
  readonly remainingTotalSize: number | null;
}

/** `lr-files`' event type, narrowing `target`/`currentTarget` to `LyraFileInput` so a listener
 *  reads them without casting. */
export interface LyraFileInputFilesEvent extends CustomEvent<LyraFileInputFilesDetail> {
  readonly target: LyraFileInput;
  readonly currentTarget: LyraFileInput;
}

export interface LyraFileInputEventMap {
  blur: FocusEvent;
  focus: FocusEvent;
  input: Event;
  change: Event;
  'lr-invalid': CustomEvent<null>;
  'lr-files': LyraFileInputFilesEvent;
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
 * @event lr-files - Frozen `detail: { files, rejected, remainingFiles, remainingTotalSize }` with
 * detached readonly sequences and rejected-file records, fired on drop and manual selection.
 * `remainingFiles`/`remainingTotalSize` report the allowance still left under `maxFiles`/
 * `maxTotalSize` after this batch (`null` while that limit is unset). Immutable `File` items
 * retain identity. Typed as {@linkcode LyraFileInputFilesEvent}, so
 * `event.target`/`event.currentTarget` are `LyraFileInput` without a cast. Still fires while
 * `nonRetaining` is set, even though `files` itself is never written in that mode.
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
 * @csspart file-input - The interactive picker surface.
 * @csspart form-control - The complete label, dropzone, selected-file, error, and hint frame.
 * @csspart form-control-label - The form-control label.
 * @csspart label - Deprecated in 8.2.3; compatibility name for `form-control-label`; both names
 *   are on the same node.
 * @csspart hint - The form-control hint.
 * @csspart error - The visible validation message or authored error content.
 * @csspart dropzone - The drag/drop and paste target around the semantic button.
 * @csspart dropzone-icon - The default decorative file icon.
 * @csspart dropzone-text - Wrapper around dropzone slot/text content.
 * @csspart base - Deprecated in 8.2.3; compatibility name for `file-input`; both names are on the
 *   native dropzone button, visually backing the slotted content while remaining its sibling in
 *   the accessibility tree so arbitrary slotted controls are never nested in it.
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
 * @cssstate required - Matches while `required` is set. Style with `lr-file-input:state(required)`.
 * @cssstate optional - Matches while `required` is not set — the complement of `required`.
 * @cssstate valid - Matches while the control satisfies its constraints — `required`, every entry
 * in `validators`, and any `setCustomValidity()` error.
 * @cssstate invalid - Matches while it does not — from the very first render, before the user has
 * touched anything. Neither this nor `user-invalid` matches while the control is barred from
 * constraint validation (disabled, or inside a disabled fieldset).
 * @cssstate user-valid - `valid`, but only after the user has interacted: choosing or dropping
 * files, removing one, a blur, `reportValidity()`, or a submission attempt. Not after a silent
 * `checkValidity()` alone.
 * @cssstate user-invalid - `invalid` after that same interaction. Style validation errors with this
 * rather than `invalid`: a pristine required file input is genuinely invalid, but colouring it red
 * before the user has done anything is hostile.
 * @cssstate blank - Matches while no files are selected -- or, while `nonRetaining` is set,
 * while `valuePresent` is also unset.
 * @cssstate dragging - Matches during an active file drag session.
 * @cssprop [--lr-file-input-font-size=var(--lr-form-control-font-size)] - Label and selected-filename
 * text size; tracks the shared `size` ladder.
 * @cssprop [--lr-file-input-dropzone-font-size=var(--lr-font-size-md-sm)] - Instructional text size
 * inside the dropzone. Retuned per `size` tier; the documented default is the `m`/`medium` tier.
 * @cssprop [--lr-file-input-dropzone-icon-size=var(--lr-font-size-xl)] - `[part="dropzone-icon"]`
 * glyph size. Retuned per `size` tier.
 * @cssprop [--lr-file-input-dropzone-padding=var(--lr-space-l)] - Padding inside `[part~="base"]`
 * and the stacked dropzone content. Retuned per `size` tier; `compact` overrides it.
 * @cssprop [--lr-file-input-detail-font-size=var(--lr-font-size-sm)] - Size of the secondary text:
 * the hint, the validation error, and each selected file's formatted size. Retuned per `size` tier.
 * @cssprop [--lr-file-input-gap=var(--lr-space-xs)] - Gap between the dropzone's slotted
 * children. While `compact`, this is the fallback when `--lr-file-input-compact-gap` is unset.
 * @cssprop [--lr-file-input-radius=var(--lr-radius)] - Corner radius of `[part~="base"]`.
 * @cssprop [--lr-file-input-compact-padding=var(--lr-space-s)] - `[part~="base"]` padding while
 * `compact`.
 * @cssprop [--lr-file-input-compact-gap=var(--lr-space-2xs)] - Gap between the dropzone's slotted
 * children while `compact`.
 * @cssprop [--lr-file-input-compact-font-size=var(--lr-font-size-sm)] - Label font size while
 * `compact`.
 * @cssprop [--lr-file-input-accept-border-color=var(--lr-color-success)] - Border color of
 * `[part~="base"][data-drag-state="accept"]`.
 * @cssprop [--lr-file-input-accept-bg=color-mix(in srgb, var(--lr-color-success) 8%, transparent)] -
 * Background of `[part~="base"][data-drag-state="accept"]`.
 * @cssprop [--lr-file-input-reject-border-color=var(--lr-color-danger)] - Border color of
 * `[part~="base"][data-drag-state="reject"]`.
 * @cssprop [--lr-file-input-reject-bg=color-mix(in srgb, var(--lr-color-danger) 8%, transparent)] -
 * Background of `[part~="base"][data-drag-state="reject"]`.
 * @cssprop [--lr-file-input-dropzone-fill=var(--lr-color-surface)] - Resting dropzone background,
 * the state it spends most of its life in. The drag accept/reject tints have had their own hooks
 * since 12.0.0; this one completes the set.
 * @cssprop [--lr-file-input-dropzone-border-color=var(--lr-color-border)] - Resting dropzone border
 * color. The dashed border style is unchanged.
 * @cssprop [--lr-file-input-dropzone-hover-border-color=var(--lr-color-brand)] - Dropzone border
 * color while the pointer is over it, whether over the button or over the content stacked on it.
 * @cssprop [--lr-form-control-focus-shadow=none] - The shared field focus halo, painted as a
 * `box-shadow` while this control is focused. One name for every field-shaped control in the
 * library, so a halo is configured once rather than per component. Additive: the focus outline and
 * border cue are the accessibility answer to focus and are never replaced by it.
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
    fileInputRejectedLimit: LYRA_DEFAULT_fileInputRejectedLimit,
    fileInputRejectedMany: LYRA_DEFAULT_fileInputRejectedMany,
    fileInputRejectedMaxFiles: LYRA_DEFAULT_fileInputRejectedMaxFiles,
    fileInputRejectedMaxTotalSize: LYRA_DEFAULT_fileInputRejectedMaxTotalSize,
    fileInputRejectedOne: LYRA_DEFAULT_fileInputRejectedOne,
    fileInputRejectedRead: LYRA_DEFAULT_fileInputRejectedRead,
    fileInputRejectedSize: LYRA_DEFAULT_fileInputRejectedSize,
    fileInputRejectedType: LYRA_DEFAULT_fileInputRejectedType,
    fileSizeUnitB: LYRA_DEFAULT_fileSizeUnitB,
    fileSizeUnitGb: LYRA_DEFAULT_fileSizeUnitGb,
    fileSizeUnitKb: LYRA_DEFAULT_fileSizeUnitKb,
    fileSizeUnitMb: LYRA_DEFAULT_fileSizeUnitMb,
    fileSizeUnitTb: LYRA_DEFAULT_fileSizeUnitTb,
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    open: LYRA_DEFAULT_open,
    popover: LYRA_DEFAULT_popover,
    progress: LYRA_DEFAULT_progress,
    removeWithContext: LYRA_DEFAULT_removeWithContext,
    restore: LYRA_DEFAULT_restore,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
    valueInvalid: LYRA_DEFAULT_valueInvalid,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-files',
  ]);

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
  private _allowedMimeTypes: readonly string[] = EMPTY_MIME_TYPES;
  /** Exact MIME allowlist. Assignment takes a bounded immutable snapshot. */
  @property({ attribute: false })
  get allowedMimeTypes(): readonly string[] {
    return this._allowedMimeTypes;
  }
  set allowedMimeTypes(next: readonly string[]) {
    const old = this._allowedMimeTypes;
    this._allowedMimeTypes = snapshotMimeTypes(next);
    this.requestUpdate('allowedMimeTypes', old);
  }

  private _forbiddenMimeTypes: readonly string[] = EMPTY_MIME_TYPES;
  /** Exact MIME denylist, evaluated before `allowedMimeTypes`. Assignment takes a bounded
   * immutable snapshot. */
  @property({ attribute: false })
  get forbiddenMimeTypes(): readonly string[] {
    return this._forbiddenMimeTypes;
  }
  set forbiddenMimeTypes(next: readonly string[]) {
    const old = this._forbiddenMimeTypes;
    this._forbiddenMimeTypes = snapshotMimeTypes(next);
    this.requestUpdate('forbiddenMimeTypes', old);
  }
  /** Largest accepted file size in bytes. `0` (the default) disables the size check entirely --
   *  see `effectiveMaxFileSize` for how an invalid override is handled. */
  @property({ type: Number, attribute: 'max-file-size' }) maxFileSize = 0;
  /** Largest total number of files accepted, counting retained files (unless `nonRetaining`) plus
   *  `heldFileCount` plus the current batch. `0` (the default) disables the check. Same
   *  rejection-UI shape as `maxFileSize`: an excess file in the batch is rejected with reason
   *  `'maxFiles'` and appears in `[part="rejection"]` alongside any other rejection, rather than
   *  failing the whole selection. An invalid override (negative, `NaN`) falls back to a sane cap
   *  rather than silently accepting an unlimited count -- see `effectiveMaxFiles`. */
  @property({ type: Number, attribute: 'max-files' }) maxFiles = 0;
  /** Largest combined byte size accepted, summing retained files (unless `nonRetaining`) plus
   *  `heldTotalSize` plus the current batch. `0` (the default) disables the check. Same
   *  rejection-UI shape and invalid-override fallback as `maxFileSize` -- see
   *  `effectiveMaxTotalSize`. */
  @property({ type: Number, attribute: 'max-total-size' }) maxTotalSize = 0;
  /** Externally held file count added to the running count `maxFiles` evaluates against, in both
   *  retaining and `nonRetaining` modes -- the numeric counterpart of `valuePresent`, for a
   *  cumulative cap that spans separate picker sessions (e.g. a server-backed upload limit) rather
   *  than resetting to what this control alone can see. `0` (the default) means "nothing held" and
   *  reproduces prior behavior exactly. A negative, `NaN`, or `Infinity` value is normalized to `0`
   *  via `finiteCount` -- an invalid baseline degrades to "nothing held" rather than corrupting
   *  every later comparison or permanently blocking every future file. */
  @property({ type: Number, attribute: 'held-file-count' }) heldFileCount = 0;
  /** Externally held byte total added to the running size `maxTotalSize` evaluates against, in
   *  both retaining and `nonRetaining` modes. Same contract, default, and invalid-input
   *  normalization as `heldFileCount`. */
  @property({ type: Number, attribute: 'held-total-size' }) heldTotalSize = 0;
  /** Opt-in mode where an accepted selection still fires `lr-files`/`input`/`change` but is never
   *  written to `files` or rendered as a built-in `[part="file"]` row -- for a host that persists
   *  files elsewhere and renders its own list, so assigning `files` (even to reset it) never fights
   *  that host-owned rendering. `required` validity and the `blank` state read `valuePresent`
   *  instead of `files.length` while this is set. Does not affect `formStateRestoreCallback()` or a
   *  direct `files` assignment, both of which still retain. */
  @property({ type: Boolean, reflect: true, attribute: 'non-retaining' }) nonRetaining = false;
  /** External "a value is present" signal for a `nonRetaining` host to set once it has taken
   *  ownership of the selected files, so `required` validity and the `blank` state reflect
   *  externally-held files instead of the always-empty internal list. Ignored while `nonRetaining`
   *  is `false`. */
  @property({ type: Boolean, reflect: true, attribute: 'value-present' }) valuePresent = false;
  /** Enables directory selection through the browser's native picker. */
  @property({ type: Boolean, reflect: true }) directory = false;
  /** Enables files pasted from the clipboard into the dropzone. `true`-defaulting, so a plain
   *  `paste="false"` attribute (not just a `.paste=${false}` property binding) actually disables it. */
  @property({ type: Boolean, reflect: true, converter: trueDefaultBooleanConverter }) paste = true;
  /** Form-control label. Empty or removed leaves the localized dropzone instruction as the visible fallback. */
  @property() label = '';
  /** Optional hint copy. Removing the attribute removes its text and description association. */
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
  /** Additional JavaScript validators run after the intrinsic `required` constraint — the same
   * contract `lr-date-input` and `lr-combobox` implement. Accepts a function, an object with
   * `validate(value, input)`, or the mapped object-validator shape with `checkValidity(input)` and
   * `{ isValid, message, invalidKeys }` results. The value handed to a function/`validate()`
   * validator is the current `files` array. Object validators can list host `observedAttributes`
   * that should trigger live revalidation. A validator that throws fails closed with the generic
   * localized message. Barred (own or fieldset-cascaded `disabled`) exactly like the intrinsic
   * constraint. */
  @property({ attribute: false }) validators: LyraFileInputValidator[] = [];
  /** Accessible name forwarded to the semantic dropzone and native file input.
   * When unset, the effective `label` text is used. */
  @property({ attribute: 'accessible-label' }) accessibleLabel = '';
  /** Message announced after an accepted selection; `{count}` is replaced by the number of
   * accepted files. `undefined` uses the localized singular/plural default; every supplied
   * string, including `''` and the former English default, is caller-owned. */
  @property({ attribute: 'accepted-message' }) acceptedMessage?: string;
  /** Message announced after rejected files; `{count}` is replaced by the number of rejected
   * files. `undefined` uses the localized singular/plural default; every supplied string,
   * including `''` and the former English default, is caller-owned. */
  @property({ attribute: 'rejected-message' }) rejectedMessage?: string;

  @state() private dragState: DropSessionState = 'default';
  @state() private resultStatus = '';
  /** Files rejected by the most recent drop/paste/selection, each paired with its reason.
   *  Populated in `emitFiles()` (never on mount -- it starts empty and every write is a direct
   *  consequence of a user action), so the visible `[part="rejection"]` alert naturally never
   *  fires on connect and needs no `isMounting` guard. Cleared back to `[]` whenever a
  *  subsequent classification rejects nothing. */
  @state() private rejectedFiles: readonly LyraFileInputRejectedFile[] = Object.freeze([]);
  @state() private touched = false;
  /** Bumped whenever an out-of-band revalidation (a validator's `observedAttributes` firing)
   *  changes published validity, so the rendered `[part="error"]` text refreshes without any
   *  reactive property of this host having changed. */
  @state() private validityRevision = 0;
  // Server renderers do not necessarily expose Element.children. The shared controller treats
  // missing DOM surfaces as empty and seeds real light-DOM slot presence after browser hydration.
  private readonly slotPresence = new SlotPresenceController(this);
  @query('[part~="base"]') private baseEl?: HTMLElement;
  @query('input[type="file"]') private inputEl?: HTMLInputElement;

  private internals: ElementInternals;
  private validityController: AnchoredValidityController;
  /** Consumer-supplied validation message reflected through `custom-error`. */
  declare customError: string | null;
  /** Owns the drag-session state machine and folder traversal -- shared with `lr-drop-zone`. */
  private readonly dropSession: DropSessionController;
  /** Shared light-DOM live regions this element announces through. A region rendered inside this
   *  shadow root is not reliably announced (JAWS with Firefox ignores one outright), so
   *  `[part="status"]` is only an `aria-hidden` mirror and `[part="rejection"]` is plain visible
   *  text. */
  private politeSink?: AnnouncementSink;
  private assertiveSink?: AnnouncementSink;
  private hasSyncedDescribedByElements = false;
  /** False until the first render has committed, so mounting never announces a resting state. */
  private announcementsArmed = false;
  private _name: string | null = null;
  private _files: File[] = [];
  private _fileCount = 0;
  private _disabled = false;
  private _required = false;
  private validationTargetOverride?: HTMLElement;
  private validatorAttributeObserver?: { observer: MutationObserver; owner: Window };
  private _fieldsetDisabled = false;
  private thumbnailUrls = new Map<File, { url: string; owner: typeof URL; revoke: () => void }>();

  constructor() {
    super();
    this.internals = attachInternalsSafely(this);
    this.validityController = new AnchoredValidityController(this, this.internals, () => this[VALIDITY_ANCHOR]());
    installCustomErrorProperty(this, () => this.validityController.customValidityMessage);
    installInvalidEventAlias(this, (init: { cancelable: true }) =>
      this.emit('lr-invalid', null, init));
    // Interactive validation (a submission attempt, `reportValidity()`) is interaction, exactly
    // like choosing/dropping/removing a file or a blur; `checkValidity()`'s own call below runs
    // inside `withStaticValidityCheck()` so this listener can tell the silent query apart from
    // every other path that raises the same `invalid` event.
    installInteractionOnInvalid(this, this.markInteracted);
    this.internals.setFormValue(null);
    this.dropSession = new DropSessionController(this, {
      isDisabled: () => this.liveDisabled,
      previewRejects: (items) => this.classify(items as unknown as File[], true).rejected.length > 0,
      onStateChange: () => {
        this.dragState = this.dropSession.state;
        this.publishCustomStates();
      },
    });
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
  set files(next: readonly File[]) {
    const old = this._files;
    const valid = Array.isArray(next) ? next.filter(isFileValue) : [];
    // Truncation to a single file when `!effectiveMultiple` is NOT applied here: `multiple`/
    // `directory` may still be about to change within the same synchronous property-assignment
    // batch (e.g. a Lit template binding `.files` before `.multiple`), and `effectiveMultiple`
    // read at this instant could be stale. `willUpdate()` re-derives the truncation once every
    // property in the batch has landed, which is order-independent.
    this._files = [...valid];
    const oldCount = this._fileCount;
    this._fileCount = this._files.length;
    this.syncThumbnailUrls();
    this.syncFormValue();
    this.updateValidity();
    this.requestUpdate('files', old);
    if (oldCount !== this._fileCount) this.requestUpdate('fileCount', oldCount);
  }

  /** Readonly selected-file count derived from `files`.
   * @default 0 */
  get fileCount(): number {
    return this._fileCount;
  }

  /** Readonly state derived from the current drag session.
   * @default false */
  get dragging(): boolean {
    return this.dragState !== 'default';
  }

  private get effectiveMultiple(): boolean {
    return this.multiple || this.directory;
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
      this.dropSession.reset();
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
    if (changed.has('multiple') || changed.has('directory') || changed.has('files')) {
      if (!this.effectiveMultiple && this._files.length > 1) this.files = this._files.slice(0, 1);
      else this.syncFormValue();
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.syncThumbnailUrls();
    this.updateValidity();
    // Rebuilt on every reconnect: `disconnectedCallback()` tears the observer down, and a
    // re-parent can also move this host into another document/window.
    if (this.hasUpdated) this.syncValidatorAttributeObserver();
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
    this.disconnectValidatorAttributeObserver();
    this.dropSession.reset();
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
    super.updated(changed);
    if (changed.has('validators')) {
      this.updateValidity();
      this.syncValidatorAttributeObserver();
    }
    // `valuePresent`/`nonRetaining` both feed `hasEffectiveValue`, which `required`/`blank` read.
    if (changed.has('valuePresent') || changed.has('nonRetaining')) {
      this.updateValidity();
    }
    // Merges a consumer-set host `aria-describedby` onto the internal `role="button"` dropzone
    // control -- the sole semantic owner -- since idrefs never cross the shadow boundary on their
    // own. `describedBy` (rendered into the control's own `aria-describedby`) already covers the
    // internal hint/error ids; this projects the host's external reference alongside them.
    const hostDescribedBy = this.getAttribute('aria-describedby');
    if (hostDescribedBy || this.hasSyncedDescribedByElements) {
      this.hasSyncedDescribedByElements = syncAriaDescribedByElements(
        this,
        this.baseEl,
        hostDescribedBy,
      );
    }
    // The very first render is a mount, not a transition: a component appearing on the page must
    // not announce its resting state.
    if (this.announcementsArmed) {
      if (changed.has('dragState') && this.dragState !== 'default') {
        this.politeSink?.announce(this.dragStatusText());
      }
      if (changed.has('resultStatus') && this.resultStatus) this.politeSink?.announce(this.resultStatus);
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
      const state = this.effectiveMultiple ? this.createRestorationFormData() : (this._files[0] ?? null);
      this.internals.setFormValue(null, state);
      return;
    }
    if (this.effectiveMultiple) {
      const submitted = this.createFormData();
      const state = this.createRestorationFormData();
      if (!submitted || !state) {
        this.internals.setFormValue(null);
        return;
      }
      for (const file of this._files) {
        submitted.append(this.name, file);
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

  private createRestorationFormData(): FormData | null {
    const state = this.createFormData();
    if (!state) return null;
    for (const file of this._files) state.append('file', file);
    return state;
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

  /** Runs `validators` in order and returns the first failure. Mirrors `lr-date-input`'s and
   *  `lr-combobox`'s reading of the same contract: a thrown validator fails closed with the
   *  generic localized message rather than escaping into the caller that happened to write
   *  `files`. */
  private validatorResult(): { flags?: ValidityStateFlags; message?: string } {
    let validators: LyraFileInputValidator[];
    try {
      validators = Array.isArray(this.validators) ? Array.from(this.validators) : [];
    } catch {
      return { flags: { customError: true }, message: this.localize('valueInvalid') };
    }
    for (const validator of validators) {
      let result: LyraFileInputValidatorResult;
      try {
        if (typeof validator === 'object' && validator !== null && 'checkValidity' in validator) {
          const checked = validator.checkValidity(this as never);
          if (checked?.isValid === true) continue;
          const flags: ValidityStateFlags = {};
          for (const key of Array.isArray(checked?.invalidKeys) ? checked.invalidKeys : []) {
            if (isValidityFlagKey(key)) flags[key] = true;
          }
          if (!Object.values(flags).some(Boolean)) flags.customError = true;
          let message = typeof checked?.message === 'string' ? checked.message : '';
          if (!message && typeof validator.message === 'string') message = validator.message;
          if (!message && typeof validator.message === 'function') {
            message = validator.message(this as never);
          }
          return { flags, message: message || this.localize('valueInvalid') };
        }
        result = typeof validator === 'function'
          ? validator(this.files, this)
          : validator?.validate(this.files, this);
        if (result === undefined || result === true) continue;
        if (typeof result === 'string') return { flags: { customError: true }, message: result };
        if (result === false) {
          return { flags: { customError: true }, message: this.localize('valueInvalid') };
        }
        if (result && typeof result === 'object') {
          const flags: ValidityStateFlags = {};
          for (const key of VALIDITY_FLAG_KEYS) {
            if (Object.prototype.hasOwnProperty.call(result, key) && result[key]) flags[key] = true;
          }
          if (Object.values(flags).some(Boolean)) {
            return { flags, message: this.localize('valueInvalid') };
          }
        }
      } catch {
        return { flags: { customError: true }, message: this.localize('valueInvalid') };
      }
    }
    return {};
  }

  /** Watches the host attributes any object validator listed in `observedAttributes`, so changing
   *  one revalidates live. Bound to the owning window so a re-parent into another document (or a
   *  disconnect) can never leave the previous document's observer firing into this host. */
  private syncValidatorAttributeObserver(): void {
    this.disconnectValidatorAttributeObserver();
    const owner = this.ownerDocument.defaultView;
    const MutationObserverCtor = owner?.MutationObserver;
    if (!this.isConnected || !owner || typeof MutationObserverCtor !== 'function') return;

    const attributes = new Set<string>();
    let validators: LyraFileInputValidator[];
    try {
      validators = Array.isArray(this.validators) ? Array.from(this.validators) : [];
    } catch {
      return;
    }
    for (const validator of validators) {
      try {
        if (typeof validator !== 'object' || validator === null || !('checkValidity' in validator)) {
          continue;
        }
        const observed: unknown = validator.observedAttributes;
        if (!Array.isArray(observed)) continue;
        for (const name of observed) {
          if (typeof name === 'string' && name.length > 0) attributes.add(name);
        }
      } catch {
        // A validator is application code. A revoked/hostile proxy must not reject this component's
        // Lit update or prevent well-formed sibling validators from being observed.
        continue;
      }
    }
    if (attributes.size === 0) return;

    const binding = {} as { observer: MutationObserver; owner: Window };
    const observer = new MutationObserverCtor(() => {
      if (
        this.validatorAttributeObserver !== binding
        || !this.isConnected
        || this.ownerDocument.defaultView !== owner
      ) return;
      this.updateValidity();
      this.validityRevision++;
    });
    binding.observer = observer;
    binding.owner = owner;
    try {
      observer.observe(this, { attributes: true, attributeFilter: [...attributes] });
      this.validatorAttributeObserver = binding;
    } catch {
      observer.disconnect();
    }
  }

  private disconnectValidatorAttributeObserver(): void {
    const binding = this.validatorAttributeObserver;
    this.validatorAttributeObserver = undefined;
    binding?.observer.disconnect();
  }

  private updateValidity(): void {
    if (this.barredFromValidation) {
      // A barred control reports no violation at all, exactly like a native disabled input.
      // Configured validators are barred with it, the same way the intrinsic constraint is.
      this.validityController.setValidity({});
      this.publishCustomStates();
      return;
    }
    const flags: ValidityStateFlags = {};
    let message = '';
    if (this.required && !this.hasEffectiveValue) {
      flags.valueMissing = true;
      message = this.localize('fieldRequired');
    }
    const configured = this.validatorResult();
    if (configured.flags) Object.assign(flags, configured.flags);
    if (configured.message) message = configured.message;
    this.validityController.setValidity(flags, message);
    this.publishCustomStates();
  }

  /** Whether the control has a value for `required`/`blank` purposes: real retained files, or --
   *  while `nonRetaining` is set -- the host's own `valuePresent` signal. */
  private get hasEffectiveValue(): boolean {
    return this._files.length > 0 || (this.nonRetaining && this.valuePresent);
  }

  private publishCustomStates(): void {
    syncValidityStates(this.internals, {
      required: this.required,
      hasInteracted: this.touched,
      barred: this.barredFromValidation,
    });
    setCustomState(this.internals, 'blank', !this.hasEffectiveValue);
    setCustomState(this.internals, 'dragging', this.dragging);
    this.toggleAttribute('dragging', this.dragging);
  }

  private markInteracted = (): void => {
    if (this.touched) return;
    this.touched = true;
    this.updateValidity();
    this.publishCustomStates();
  };

  checkValidity(): boolean {
    // Recomputed at call time, like a native control: `validators` is a plain JS array whose
    // entries can start failing without any property on this host changing, so a check that read
    // only the last published state would answer from a stale snapshot.
    this.updateValidity();
    // Silent query: must never mark a pristine control as interacted, however invalid it already
    // is. `withStaticValidityCheck()` tells the `installInteractionOnInvalid()` listener above
    // that whatever `invalid` event fires synchronously inside this call is this call, not a
    // submission attempt.
    return withStaticValidityCheck(this, () => this.internals.checkValidity());
  }

  reportValidity(): boolean {
    // Reporting is what a submit attempt does, and a failed submit is precisely when native
    // `:user-invalid` starts matching — so it counts as interaction. (A submission attempt itself
    // never calls this method -- it drives `ElementInternals` directly -- which is what
    // `installInteractionOnInvalid()` above covers.)
    this.touched = true;
    this.updateValidity();
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
    const restored = this.readFormDataFiles(state);
    if (restored) {
      this.files = restored;
      return;
    }
    this.files = [];
  }

  private readFormDataFiles(value: unknown): File[] | undefined {
    if (value === null || typeof value !== 'object') return undefined;
    const FormDataCtor = this.ownerDocument.defaultView?.FormData ?? globalThis.FormData;
    try {
      // Brand-check with an intrinsic before consulting the instance. A plain object can borrow a
      // `values()` method, and a genuine FormData can still have a hostile/throwing instance
      // override; neither shape may escape this restore callback or be accepted as partial state.
      FormDataCtor.prototype.has.call(value, '__lyra_form_state_brand_probe__');
      const values = (value as FormData).values;
      const iterator = values.call(value);
      const files: File[] = [];
      let entries = 0;
      while (entries <= MAX_DROPPED_FOLDER_ENTRIES) {
        const next = iterator.next();
        if (next.done) return files;
        if (entries === MAX_DROPPED_FOLDER_ENTRIES) return undefined;
        entries += 1;
        if (isFileValue(next.value)) files.push(next.value);
      }
      return undefined;
    } catch {
      return undefined;
    }
  }

  formDisabledCallback(disabled: boolean): void {
    this._fieldsetDisabled = disabled;
    if (disabled) {
      this.dropSession.reset();
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
    // Blob URLs are live document resources. A detached property write may update owned file
    // state, but must not recreate resources that `disconnectedCallback()` just retired;
    // `connectedCallback()` deterministically rebuilds them in the current owner realm.
    if (!this.isConnected) {
      if (changed) this.requestUpdate();
      return;
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

  /** `maxFiles` normalized exactly like `effectiveMaxFileSize` normalizes `maxFileSize`: `0`/
   *  `Infinity` both mean "no limit" (`null`); any other invalid override falls back to
   *  `DEFAULT_MAX_FILES` rather than silently disabling the check. */
  private get effectiveMaxFiles(): number | null {
    const maxFiles = this.maxFiles;
    if (maxFiles === 0 || maxFiles === Infinity) return null;
    return finiteRange(maxFiles > 0 ? maxFiles : NaN, DEFAULT_MAX_FILES, 1);
  }

  /** `maxTotalSize` normalized exactly like `effectiveMaxFileSize` normalizes `maxFileSize`. */
  private get effectiveMaxTotalSize(): number | null {
    const maxTotalSize = this.maxTotalSize;
    if (maxTotalSize === 0 || maxTotalSize === Infinity) return null;
    return finiteRange(maxTotalSize > 0 ? maxTotalSize : NaN, DEFAULT_MAX_TOTAL_SIZE_BYTES, 1);
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

  /** Sum of `.size` across `files`, tolerating a hostile/undefined getter (a synthetic dragenter-
   *  preview item has none) by treating anything non-finite as `0`. */
  private totalFileSize(files: readonly File[]): number {
    let total = 0;
    for (const file of files) {
      const size = file.size;
      if (Number.isFinite(size)) total += size;
    }
    return total;
  }

  private classify(
    fileList: File[],
    isPreview = false,
  ): {
    files: File[];
    rejected: LyraFileInputRejectedFile[];
    remainingFiles: number | null;
    remainingTotalSize: number | null;
  } {
    const limits = { maxFiles: this.effectiveMaxFiles, maxTotalSize: this.effectiveMaxTotalSize };
    // `maxFiles`/`maxTotalSize` count against retained files too, except while `nonRetaining` is
    // set, in which case the control's own retained count/total is 0 -- but `heldFileCount`/
    // `heldTotalSize` (an externally held baseline) still apply in both modes, since that's their
    // entire purpose: a cumulative cap spanning separate picker sessions.
    const tracker = new AggregateFileLimitTracker(
      (this.nonRetaining ? 0 : this._files.length) + finiteCount(this.heldFileCount, 0),
      (this.nonRetaining ? 0 : this.totalFileSize(this._files)) + finiteCount(this.heldTotalSize, 0),
    );
    if (!this.effectiveMultiple && fileList.length > 1) {
      return {
        files: [],
        rejected: fileList.map((file) => ({ file, reason: 'count' as const })),
        ...tracker.allowance(limits),
      };
    }
    const files: File[] = [];
    const rejected: LyraFileInputRejectedFile[] = [];
    for (const f of fileList) {
      const reason = this.isAllowed(f, isPreview);
      if (reason !== 'ok') {
        rejected.push({ file: f, reason });
        continue;
      }
      const limitReason = tracker.evaluate(f, limits);
      if (limitReason) {
        rejected.push({ file: f, reason: limitReason });
        continue;
      }
      files.push(f);
    }
    return { files, rejected, ...tracker.allowance(limits) };
  }

  /** Per-reason, per-file message for the visible `[part="rejection"]` alert. The filename is
   *  caller-supplied data interpolated via the `values` argument, never localized itself --
   *  only the surrounding copy comes from `this.localize()`. `'directory'` deliberately reuses
   *  `fileInputFolderRejected` verbatim (its template has no `{filename}` placeholder, so the
   *  extra interpolation value is simply unused). Read and traversal-limit failures have their
   *  own truthful terminal-outcome messages. */
  private rejectionMessage(rejected: LyraFileInputRejectedFile): string {
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
      case 'read':
        return this.localize('fileInputRejectedRead', undefined, { filename });
      case 'limit':
        return this.localize('fileInputRejectedLimit', undefined, { filename });
      case 'maxFiles':
        return this.localize('fileInputRejectedMaxFiles', undefined, { filename });
      case 'maxTotalSize':
        return this.localize('fileInputRejectedMaxTotalSize', undefined, { filename });
    }
  }

  private outcomeMessage(
    key: FileInputOutcomeMessageKey,
    override: string | undefined,
    count: string,
  ): string {
    if (override == null) return this.localize(key, undefined, { count });
    return override.replace(/\{count\}/g, count);
  }

  private emitFiles(fileList: File[], additionalRejected: readonly LyraFileInputRejectedFile[] = []): void {
    const { files, rejected, remainingFiles, remainingTotalSize } = this.classify(fileList);
    rejected.push(...additionalRejected);
    const rejectedSnapshot = Object.freeze(rejected.map((item) => Object.freeze({ ...item })));
    const filesSnapshot = Object.freeze([...files]);
    this.rejectedFiles = rejectedSnapshot;
    const messages: string[] = [];
    const numberFormat = getNumberFormat(this.effectiveLocale);
    if (files.length) {
      messages.push(
        this.outcomeMessage(
          files.length === 1 ? 'fileInputAcceptedOne' : 'fileInputAcceptedMany',
          this.acceptedMessage,
          numberFormat.format(files.length),
        ),
      );
    }
    if (rejected.length) {
      messages.push(
        this.outcomeMessage(
          rejected.length === 1 ? 'fileInputRejectedOne' : 'fileInputRejectedMany',
          this.rejectedMessage,
          numberFormat.format(rejected.length),
        ),
      );
    }
    this.resultStatus = messages.filter((message) => message.length > 0).join(' ');
    if (files.length || rejected.length) {
      this.touched = true;
      this.updateValidity();
    }
    if (files.length) {
      // `nonRetaining`: the selection is announced (below) but never written to `files` -- the
      // host owns rendering and persistence, and reads `valuePresent` for required validity.
      if (!this.nonRetaining) {
        this.files = this.effectiveMultiple ? [...this._files, ...files] : files;
      }
      dispatchNativeEvent(this, 'input');
      dispatchNativeEvent(this, 'change');
    }
    this.emit(
      'lr-files',
      Object.freeze({ files: filesSnapshot, rejected: rejectedSnapshot, remainingFiles, remainingTotalSize }),
    );
  }

  /** Reads both component state and the UA's synchronous fieldset cascade before public actions. */
  private get liveDisabled(): boolean {
    return this.effectiveDisabled || this.matches(':disabled');
  }

  /** Programmatically open the native file picker. */
  openPicker(): void {
    if (this.liveDisabled) return;
    this.inputEl?.click();
  }

  /** Focuses the semantic dropzone unless the form control is effectively disabled. */
  override focus(options?: FocusOptions): void {
    if (!this.liveDisabled) this.baseEl?.focus(options);
  }

  /** Removes focus from the semantic dropzone. */
  override blur(): void {
    this.baseEl?.blur();
  }

  /** Opens the native picker, matching a user click on the semantic dropzone. */
  override click(): void {
    this.openPicker();
  }

  // The nested-depth counter, accept/reject preview, and folder-walking mechanics below are
  // owned by `this.dropSession` (`internal/drop-session-controller.ts`), extracted from this
  // component's original implementation so `lr-drop-zone` shares the exact same mechanics rather
  // than reimplementing them. Only classification (`isAllowed`/`classify`, below) stays here,
  // since it reads this control's own `accept`/`maxFileSize`/`maxFiles`/`maxTotalSize`.
  private onDragEnter = (e: DragEvent): void => this.dropSession.onDragEnter(e);
  private onDragOver = (e: DragEvent): void => this.dropSession.onDragOver(e);
  private onDragLeave = (e: DragEvent): void => this.dropSession.onDragLeave(e);

  private onDrop = (e: DragEvent): void => {
    const drop = this.dropSession.beginDrop(e);
    if (!drop) return;
    const { token, files, folders, overLimit } = drop;
    if (overLimit && this.effectiveMultiple) {
      this.emitFiles([], [this.folderFailure(folders[0]?.name ?? '', 'limit')]);
      return;
    }
    if (folders.length && this.effectiveMultiple) {
      void this.dropSession.readFolders(folders, token).then((result) => {
        if (!this.dropSession.isCurrent(token) || result.status === 'cancelled') return;
        if (result.status === 'error' || result.status === 'limit') {
          this.emitFiles([], [this.folderFailure(result.name, result.status === 'limit' ? 'limit' : 'read')]);
          return;
        }
        const allFiles = [...files, ...result.files];
        if (allFiles.length) this.emitFiles(allFiles);
      });
      return;
    }
    const rejectedFolders = folders.map((folder) => this.folderFailure(folder.name, 'directory'));
    if (files.length || rejectedFolders.length) this.emitFiles(files, rejectedFolders);
  };

  private folderFailure(
    name: string,
    reason: 'directory' | 'read' | 'limit',
  ): LyraFileInputRejectedFile {
    const FileCtor = this.ownerDocument.defaultView?.File ?? globalThis.File;
    return Object.freeze({ file: new FileCtor([], name), reason });
  }

  private onPaste = (e: ClipboardEvent): void => {
    if (!this.paste || this.liveDisabled) return;
    const files = [...(e.clipboardData?.files ?? [])];
    if (files.length) { e.preventDefault(); this.emitFiles(files); }
  };

  private onInputChange = (e: Event): void => {
    // The native picker's composed `change` is an implementation detail. Publish exactly one
    // host-owned `change` from `emitFiles()` after state/form validity have committed instead of
    // leaking this pre-commit event across the shadow boundary as a duplicate.
    e.stopPropagation();
    const input = e.target as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = '';
    if (!this.liveDisabled && files.length) this.emitFiles(files);
  };
  // Bridged off [part~="base"] (the actual keyboard-focusable dropzone), not the visually-hidden,
  // tabindex="-1", aria-hidden native `<input type="file">` — that input is never focused by a
  // user, only `.click()`ed by `openPicker()`, so binding here is what makes a host-level
  // `addEventListener('focus' | 'blur', ...)` observe real focus/blur at all; native focus/blur
  // neither bubble nor cross the shadow boundary on their own.
  private onFocus = (event: FocusEvent): void => {
    if (this.liveDisabled) {
      event.stopPropagation();
      return;
    }
    relayNativeEvent(this, event);
  };
  private onBlur = (event: FocusEvent): void => {
    // The dropzone `[part~="base"]` button becoming disabled while it holds focus force-blurs it --
    // a platform reaction to the very `?disabled=${effectiveDisabled}` render that turned it on, not
    // a user interaction. That blur can land synchronously nested inside the update this handler is
    // itself part of (Lit committing the button's `disabled` attribute), before `effectiveDisabled`
    // could read anything but `true` here. Marking `touched` for it was, depending on timing, capable
    // of reentering that same in-flight update and tripping Lit's dev-mode "scheduled an update
    // after an update completed" warning for a state flip nothing observable needed -- a disabled
    // control is barred from validation regardless.
    if (!this.liveDisabled) this.touched = true;
    this.publishCustomStates();
    relayNativeEvent(this, event);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.liveDisabled) return;
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

  private onVisibleLabelClick = (event: MouseEvent): void => {
    const label = event.currentTarget;
    const path = event.composedPath();
    const labelIndex = path.indexOf(label as EventTarget);
    const contentPath = labelIndex < 0 ? path : path.slice(0, labelIndex);

    // A native `for` association is inconsistent here: WebKit also activates the file input when
    // a button projected into the label is clicked. Own the association explicitly so ordinary
    // label text still opens the picker while rich controls retain exactly their own action.
    if (
      contentPath.some(
        (node) => isElementTarget(node) && node.matches(INTERACTIVE_CONTENT_SELECTOR),
      )
    ) return;
    this.openPicker();
  };

  private statusText(): string {
    return this.dragState === 'default' ? this.resultStatus : this.dragStatusText();
  }

  private dragStatusText(): string {
    if (this.dragState === 'accept') return this.localize('dropzoneReleaseToAdd');
    if (this.dragState === 'reject') return this.localize('dropzoneRejectedType');
    return '';
  }

  /** Resolves `label`'s effective text: an explicit override wins verbatim; left at the
   *  built-in default it instead routes through `this.localize()` so a locale/`.strings`
   *  override applies without requiring `label` itself to be set. */
  private get effectiveLabel(): string {
    return this.label || this.localize('fileInputDefaultLabel');
  }

  private removeFile(index: number): void {
    if (this.liveDisabled || index < 0 || index >= this._files.length) return;
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
    const hasLabel = this.withLabel || this.slotPresence.has('label') || (this.label ?? '').length > 0;
    const explicitHostLabel = hostAriaLabel(this);
    const explicitAccessibleLabel = this.hasAttribute('accessible-label') || this.accessibleLabel
      ? this.accessibleLabel
      : null;
    const accessibleLabel = explicitHostLabel ?? explicitAccessibleLabel;
    const labelledBy = accessibleLabel == null && hasLabel ? 'file-input-label' : undefined;
    const fallbackAriaLabel = accessibleLabel ?? (hasLabel ? undefined : label);
    const hasHint = this.withHint || this.slotPresence.has('hint') || (this.hint ?? '').length > 0;
    const renderedError = this.errorText || this.customError || (this.touched ? this.validationMessage : '');
    const hasError = this.withError || this.slotPresence.has('error') || renderedError.length > 0;
    const describedBy = [hasError ? 'file-input-error' : '', hasHint ? 'file-input-hint' : '']
      .filter(Boolean)
      .join(' ');
    const invalid = hasError || (this.touched && !this.internals.validity.valid);
    return html`
      <div part="form-control">
        <label
          id="file-input-label"
          part="form-control-label label"
          ?hidden=${!hasLabel}
          @click=${this.onVisibleLabelClick}
        >
          <span>${this.label}<slot name="label"></slot></span>
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
            part="file-input base"
            type="button"
            role="button"
            tabindex=${this.effectiveDisabled ? '-1' : '0'}
            aria-disabled=${this.effectiveDisabled ? 'true' : 'false'}
            aria-label=${fallbackAriaLabel ?? nothing}
            aria-labelledby=${labelledBy ?? nothing}
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
        id="file-input-native"
        aria-label=${fallbackAriaLabel ?? nothing}
        aria-labelledby=${labelledBy ?? nothing}
        accept=${this.accept}
        capture=${this.capture || nothing}
        ?multiple=${this.effectiveMultiple}
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

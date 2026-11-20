import { collectionSupport } from '../../../internal/collection-snapshot.js';
import type { LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import { html, nothing, svg, type PropertyValues, type TemplateResult, type SVGTemplateResult } from 'lit';
import { property, query } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { syncAriaDescribedByElements } from '../../../internal/aria-controls.js';
import { chevronIcon, iconFrame } from '../../../internal/icons.js';
import { relayNativeEvent } from '../../../internal/native-event-relay.js';
import { sizes } from '../../../internal/sizes.styles.js';
import type { LyraAppearance, LyraSize } from '../../../internal/variants.js';
import type { LyraIconButton } from '../../forms/icon-button/icon-button.class.js';
import { styles } from './attachment-trigger.styles.js';
import type { MenuItemSelectDetail } from '../../layout/menu/menu.class.js';
import type { LyraDropdown } from '../../overlays/overlay/dropdown.class.js';
import { falseDefaultBooleanConverter } from '../../../internal/converters.js';
import { normalizeLabel } from '../../../internal/accessible-name.js';
import { classifyFiles, EMPTY_MIME_TYPES, mimeTypeFilter, snapshotMimeTypes } from '../file-input/accept.js';
import type { LyraFileInputRejectedFile } from '../file-input/file-input.class.js';
import type { LyraMessageKey } from '../../../internal/localization-types.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_attachmentAdd, LYRA_DEFAULT_attachmentMenuAudio, LYRA_DEFAULT_attachmentMenuCamera, LYRA_DEFAULT_attachmentMenuFiles, LYRA_DEFAULT_attachmentMenuImage, LYRA_DEFAULT_attachmentTriggerAudio, LYRA_DEFAULT_attachmentTriggerCamera, LYRA_DEFAULT_attachmentTriggerFiles, LYRA_DEFAULT_attachmentTriggerImage } from '../../../internal/default-strings/media.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export type LyraAttachmentCapability = 'files' | 'image' | 'camera' | 'audio';

/** The capabilities that resolve to a real file selection (as opposed to `camera`/`audio`, which
 *  never touch the hidden file input -- see the class doc). */
export type LyraFileBackedCapability = Exclude<LyraAttachmentCapability, 'camera' | 'audio'>;

/** The native `capture` values `camera-capture` accepts: which camera a capture-capable (touch)
 *  device opens. */
export type LyraAttachmentCameraCapture = 'user' | 'environment';

/** The capabilities an `lr-files` event can report: the file-backed ones, plus `camera` while
 *  `camera-capture` routes it through the system camera. */
export type LyraAttachmentFilesCapability = LyraFileBackedCapability | 'camera';

function isCameraCapture(value: unknown): value is LyraAttachmentCameraCapture {
  return value === 'user' || value === 'environment';
}

export interface LyraAttachmentFilesDetail {
  capability: LyraAttachmentFilesCapability;
  files: readonly File[];
  rejected: readonly LyraFileInputRejectedFile[];
  remainingFiles: number | null;
  remainingTotalSize: number | null;
}

// Mirrors the shared icon set's viewBox/stroke conventions
// (internal/icons.ts's chevronIcon()/closeIcon()/etc.) without adding these
// one-off glyphs to that module -- it's off limits here -- so they still
// read as part of the same visual language as the rest of the library's
// inline icons. Same approach as lr-attachment-chip's local fileGlyph()/
// retryIcon() and lr-checkbox's local checkmarkGlyph().
/** A paperclip glyph -- the generic "attach" affordance, used for the
 *  `files` capability and as the multi-capability menu's own trigger icon
 *  (the one glyph a user recognizes regardless of which capabilities the
 *  menu underneath actually offers). */
function paperclipIcon(): SVGTemplateResult {
  return iconFrame(svg`
    <path d="M21.44 11.05 12.25 20.24a5.5 5.5 0 0 1-7.78-7.78l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95l-9.2 9.19a1.5 1.5 0 0 1-2.12-2.12l8.49-8.48"></path>
  `);
}

/** A picture-frame glyph for the `image` capability. */
function imageIcon(): SVGTemplateResult {
  return iconFrame(svg`
    <rect x="3" y="3" width="18" height="18" rx="2"></rect>
    <circle cx="8.5" cy="8.5" r="1.5"></circle>
    <polyline points="21 15 16 10 5 21"></polyline>
  `);
}

/** A camera-body glyph for the `camera` capability. */
function cameraIcon(): SVGTemplateResult {
  return iconFrame(svg`
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z"></path>
    <circle cx="12" cy="13" r="4"></circle>
  `);
}

/** A mic glyph for the `audio` capability. Duplicated locally rather than shared -- this file's
 *  own convention keeps one-off icons local to whichever component renders them, matching the
 *  paperclip/image/camera glyphs above. */
function audioIcon(): SVGTemplateResult {
  return iconFrame(svg`
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3Z"></path>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
    <line x1="12" y1="19" x2="12" y2="23"></line>
    <line x1="8" y1="23" x2="16" y2="23"></line>
  `);
}

interface CapabilityMeta {
  /** Icon shown on the single-capability trigger button and next to the menu item. */
  icon: () => SVGTemplateResult;
}

const CAPABILITY_META: Record<LyraAttachmentCapability, CapabilityMeta> = {
  files: { icon: paperclipIcon },
  image: { icon: imageIcon },
  camera: { icon: cameraIcon },
  audio: { icon: audioIcon },
};

const ATTACHMENT_TRIGGER_KEYS = {
  files: 'attachmentTriggerFiles',
  image: 'attachmentTriggerImage',
  camera: 'attachmentTriggerCamera',
  audio: 'attachmentTriggerAudio',
} as const satisfies Record<LyraAttachmentCapability, LyraMessageKey>;

const ATTACHMENT_MENU_KEYS = {
  files: 'attachmentMenuFiles',
  image: 'attachmentMenuImage',
  camera: 'attachmentMenuCamera',
  audio: 'attachmentMenuAudio',
} as const satisfies Record<LyraAttachmentCapability, LyraMessageKey>;

const OWNED_CAPABILITY_SNAPSHOTS = new WeakSet<object>();

function ownCapabilitySnapshot(values: LyraAttachmentCapability[]): readonly LyraAttachmentCapability[] {
  const snapshot = Object.freeze(values);
  OWNED_CAPABILITY_SNAPSHOTS.add(snapshot);
  return snapshot;
}

const DEFAULT_CAPABILITIES: readonly LyraAttachmentCapability[] = ownCapabilitySnapshot(['files']);
const MAX_ATTACHMENT_CAPABILITIES = 4;
const ATTACHMENT_CAPABILITY_SCAN_LIMIT = 64;

function normalizeCapabilities(value: unknown): readonly LyraAttachmentCapability[] {
  try {
    if (!Array.isArray(value)) return DEFAULT_CAPABILITIES;
    if (OWNED_CAPABILITY_SNAPSHOTS.has(value)) return value as readonly LyraAttachmentCapability[];
    const normalized: LyraAttachmentCapability[] = [];
    const length = Math.min(value.length, ATTACHMENT_CAPABILITY_SCAN_LIMIT);
    for (
      let index = 0;
      index < length && normalized.length < MAX_ATTACHMENT_CAPABILITIES;
      index++
    ) {
      const candidate: unknown = value[index];
      if (
        typeof candidate === 'string' &&
        Object.prototype.hasOwnProperty.call(CAPABILITY_META, candidate) &&
        !normalized.includes(candidate as LyraAttachmentCapability)
      ) {
        normalized.push(candidate as LyraAttachmentCapability);
      }
    }
    return ownCapabilitySnapshot(normalized);
  } catch {
    return DEFAULT_CAPABILITIES;
  }
}

function isCanonicalCapabilitySnapshot(
  source: unknown,
): source is readonly LyraAttachmentCapability[] {
  try {
    return typeof source === 'object' && source !== null && OWNED_CAPABILITY_SNAPSHOTS.has(source);
  } catch {
    return false;
  }
}

export interface LyraAttachmentTriggerEventMap {
  'lr-camera-request': CustomEvent<null>;
  'lr-audio-request': CustomEvent<null>;
  'lr-files': CustomEvent<LyraEventDetailSnapshot<LyraAttachmentFilesDetail>>;
  blur: FocusEvent;
  focus: FocusEvent;
}
/**
 * `<lr-attachment-trigger>` — a compact attach affordance designed for a
 * chat composer's start slot (see `<lr-chat-composer>`'s own `start`
 * slot, which this drops straight into, though this component has no code
 * dependency on it). Its shape adapts to how many attachment `capabilities`
 * are configured:
 *  - Exactly one capability: a single plain icon button ([part='trigger']).
 *    Activating it performs that capability's action directly.
 *  - More than one: a small anchored menu ([part='menu'], composed from
 *    `<lr-dropdown>`/`<lr-menu>`/`<lr-menu-item>`) listing each capability as a row.
 *
 * Two of the four capabilities (`files`, `image`) are file-picker-backed:
 * activating them opens a hidden native `<input type="file">` via a
 * synthetic `.click()`, and the resulting selection is re-emitted as
 * `lr-files`. `accept` is shared across both — `image` defaults it to
 * `'image/*'` unless the `accept` prop overrides it, `files` always uses
 * `accept` as-is (empty means "any file type", matching a bare native
 * `<input type="file">` with no `accept` attribute).
 *
 * **`camera`/`audio` are scope-limited by design.** This component does not
 * implement any camera or microphone capture UI itself — no `getUserMedia` —
 * because that's entirely a host/browser concern with no single right answer
 * (a desktop web app, a mobile PWA, and a native wrapper all want different
 * things here). Activating `camera` fires `lr-camera-request`; activating
 * `audio` fires `lr-audio-request`. The host owns everything from that point
 * on — typically opening `<lr-push-to-talk>` in a `<lr-overlay>`/popover for
 * `audio`, then handing the resulting blob to something like
 * `<lr-attachment-chip>`.
 *
 * The one opt-in exception is `camera-capture`: set it to `'environment'` or
 * `'user'` and, on an engine that supports the native `capture` attribute
 * (phones and tablets), `camera` opens the shared hidden file input with
 * `accept="image/*"` and that `capture` value synchronously inside the
 * activation, so the system camera opens, and the photo arrives as `lr-files`
 * with `capability: 'camera'`. Where `capture` is unsupported (desktop
 * browsers, which would only show a file picker), `camera` still fires
 * `lr-camera-request`, so one host can keep its own camera dialog there.
 *
 * @customElement lr-attachment-trigger
 * @event lr-files - A file-backed capability's hidden file input produced a real selection.
 * `detail: { capability: 'files' | 'image' | 'camera', files, rejected, remainingFiles,
 * remainingTotalSize }` (`'camera'` only while `camera-capture` routed the capture there),
 * the same shape as `lr-file-input`'s. `files` are the picks matching `accept` (a fresh readonly
 * owner-realm `File[]` snapshot rather than the native input's live `FileList`); the rest, which
 * the OS dialog's "All files" filter can let through, are listed in `rejected`. Size and count
 * limits are off unless `max-file-size`, `max-files` or `max-total-size` is set; `remaining*` are
 * `null` while the matching limit is unset.
 * @event lr-camera-request - The `camera` capability was activated. No
 * detail payload — see the class doc's scope note; the host implements the
 * actual capture flow. Not fired when `camera-capture` opens the system camera instead.
 * @event lr-audio-request - The `audio` capability was activated. No
 * detail payload — same request-only scope as `lr-camera-request`; the
 * host implements the actual recording flow (typically `<lr-push-to-talk>`).
 * @event {FocusEvent} focus - Relayed once from the active trigger button as a bubbling, composed
 *   native event.
 * @event {FocusEvent} blur - Relayed once from the active trigger button as a bubbling, composed
 *   native event.
 * @csspart trigger - The single-capability action, a composed `<lr-icon-button>` as of 16.0.0. Only
 *   rendered when `capabilities.length === 1`. It still owns the accessible name, the activation
 *   and the `title`; its background, radius, hover/press mixes, focus ring and hit-area floor now
 *   come from `--lr-icon-button-*`, retuned by `appearance`/`size`.
 * @csspart trigger-control - The single-capability action's own native `<button>`, forwarded
 *   because the painted surface sits one shadow boundary deeper than `trigger`.
 * @csspart menu-trigger-control - The multi-capability action's own native `<button>`, forwarded
 *   for the same reason.
 * @csspart menu - The `<lr-dropdown>` shell. Only rendered when `capabilities.length > 1`.
 * @csspart menu-trigger - The multi-capability button slotted into `<lr-dropdown>`'s `trigger` slot. Only rendered when `capabilities.length > 1`.
 * @csspart expand-icon - The disclosure chevron inside the multi-capability trigger button. Only rendered when `capabilities.length > 1`.
 * @csspart hidden-input - The internal native `<input type="file">` that actually opens the OS file
 *   picker. Hidden (`display: none`) by default; exposed as a part only so a consumer can override
 *   that with `::part(hidden-input)` in the unlikely case their integration needs to.
 *
 * The host `aria-label` names either trigger shape; an empty value is ignored, so the control keeps
 * its localized name.
 * @status stable
 * @since 4.0.0
 */
export class LyraAttachmentTrigger extends LyraElement<LyraAttachmentTriggerEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    attachmentAdd: LYRA_DEFAULT_attachmentAdd,
    attachmentMenuAudio: LYRA_DEFAULT_attachmentMenuAudio,
    attachmentMenuCamera: LYRA_DEFAULT_attachmentMenuCamera,
    attachmentMenuFiles: LYRA_DEFAULT_attachmentMenuFiles,
    attachmentMenuImage: LYRA_DEFAULT_attachmentMenuImage,
    attachmentTriggerAudio: LYRA_DEFAULT_attachmentTriggerAudio,
    attachmentTriggerCamera: LYRA_DEFAULT_attachmentTriggerCamera,
    attachmentTriggerFiles: LYRA_DEFAULT_attachmentTriggerFiles,
    attachmentTriggerImage: LYRA_DEFAULT_attachmentTriggerImage,
  };
  // GENERATED DEFAULT-STRING SLICE: END
  protected static override collectionSupport = collectionSupport;

  protected static override readonly ownedCollectionProperties = Object.freeze([
    'capabilities',
  ]);

  static override styles = [LyraElement.styles, sizes, styles];

  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-files',
  ]);

  /** Which attachment capabilities to offer, in display order. Normalization scans at most 64
   *  candidates and retains the first four unique recognized values, so duplicates and unknown
   *  entries do not consume the four-capability output budget. A single retained entry renders a
   *  plain button; more than one renders a menu. */
  @property({ attribute: false }) capabilities: readonly LyraAttachmentCapability[] = DEFAULT_CAPABILITIES;

  /** Native-file-input-style accept string (e.g. `'image/*'` or
   *  `'.pdf,.docx'`), forwarded to the hidden file input for the
   *  `files`/`image` capabilities — see the class doc for how each uses it. */
  @property({ useDefault: true }) accept = '';

  /** The host `aria-label`: names either trigger shape. An empty value is ignored. */
  @property({ attribute: 'aria-label' }) private hostAccessibleLabel: string | null = null;

  /** Forwards to the internal trigger button(s)' native `title` attribute — a sighted mouse
   *  user's hover tooltip, distinct from the accessible-name (`aria-label`) role.
   *  Applies to both the single-capability `[part=trigger]` button and the multi-capability
   *  `[part=menu-trigger]` button. Unset (the default): no `title` attribute, unchanged from
   *  before this property existed. */
  @property({ attribute: 'trigger-title' }) triggerTitle?: string;

  /** Opt-in system-camera capture for the `camera` capability: `'environment'` (rear camera) or
   *  `'user'` (front camera), the native `<input capture>` values. On an engine that supports
   *  `capture` (phones and tablets), activating `camera` opens the hidden file input with
   *  `accept="image/*"` and this `capture` value inside the same user gesture and reports the photo
   *  as `lr-files` with `capability: 'camera'` (non-image picks move to `rejected`). Elsewhere it
   *  keeps firing `lr-camera-request`. Unset (the default) or any other value: `camera` only fires
   *  `lr-camera-request`, unchanged. */
  @property({ attribute: 'camera-capture' }) cameraCapture?: LyraAttachmentCameraCapture;

  /** Largest accepted file size in bytes; larger picks are listed in `rejected` with reason
   *  `'size'`. `0` (the default) disables the check; an invalid override falls back to 25 MiB. */
  // numeric-guard-exempt: normalized by classifyFiles() in file-intake.ts
  @property({ type: Number, attribute: 'max-file-size', useDefault: true }) maxFileSize = 0;
  /** Largest number of files accepted per selection; excess picks are rejected with reason
   *  `'maxFiles'`. `0` (the default) disables the check; an invalid override falls back to 100. */
  // numeric-guard-exempt: normalized by classifyFiles() in file-intake.ts
  @property({ type: Number, attribute: 'max-files', useDefault: true }) maxFiles = 0;
  /** Largest combined byte size accepted per selection (`'maxTotalSize'` rejection). `0` (the
   *  default) disables the check; an invalid override falls back to 250 MiB. */
  // numeric-guard-exempt: normalized by classifyFiles() in file-intake.ts
  @property({ type: Number, attribute: 'max-total-size', useDefault: true }) maxTotalSize = 0;

  /** Externally held files to count against `maxFiles`. */
  // numeric-guard-exempt: normalized by classifyFiles() in file-input/accept.ts via finiteCount()
  @property({ type: Number, attribute: 'held-file-count', useDefault: true }) heldFileCount = 0;
  /** Externally held bytes to count against `maxTotalSize`. */
  // numeric-guard-exempt: normalized by classifyFiles() in file-input/accept.ts via finiteCount()
  @property({ type: Number, attribute: 'held-total-size', useDefault: true }) heldTotalSize = 0;
  /** Exact MIME types allowed in addition to satisfying `accept`. An empty allowlist admits any type. */
  @property({ attribute: false }) allowedMimeTypes: readonly string[] = EMPTY_MIME_TYPES;
  /** Exact MIME types rejected even when present in the allowlist. */
  @property({ attribute: false }) forbiddenMimeTypes: readonly string[] = EMPTY_MIME_TYPES;

  /** Forwarded to the hidden file input's own `multiple` attribute. */
  @property({ type: Boolean, reflect: true, converter: falseDefaultBooleanConverter }) multiple = false;

  @property({ type: Boolean, reflect: true }) disabled = false;

  /** How the trigger fills itself, from the library's one shared `appearance` vocabulary. The
   *  default `'plain'` is exactly the treatment this component shipped before it had the property:
   *  no fill, no border, quiet glyph. `'filled'`/`'filled-outlined'` tint it, `'outlined'` bounds
   *  it, `'accent'` makes it the loud primary affordance in a composer's start slot. Painted
   *  through the composed `<lr-icon-button>`'s own `--lr-icon-button-*` contract, so an ancestor
   *  theme wrapper still wins over every tier. */
  @property({ reflect: true }) appearance: LyraAppearance = 'plain';

  /** Size on the library's shared six-step ladder, accepting the Web Awesome/Shoelace spellings
   *  (`small`/`medium`/`large`) too so a migration stays a tag rename. The tier scales the GLYPH,
   *  never the tappable box: `--lr-icon-button-size` is an accessibility floor, and the ladder's
   *  tightest tiers resolve below WCAG 2.5.8's minimum, so wiring the target to it would let
   *  `size="2xs"` ship an untappable control. Override `--lr-icon-button-size` to make that
   *  trade-off explicitly, exactly as on a standalone `<lr-icon-button>`. */
  @property({ reflect: true }) size: LyraSize = 'm';

  @query('input[type="file"]') private inputEl?: HTMLInputElement;
  @query('lr-dropdown') private dropdownEl?: LyraDropdown;
  @query('[part="trigger"], [part="menu-trigger"]')
  private composedTriggerEl?: LyraIconButton;

  /** The element that owns the button role in either shape. Both triggers are composed
   *  `<lr-icon-button>`s, whose real control lives one shadow boundary deeper -- a host IDREF
   *  relationship assigned to the icon-button host would never reach it, so project onto the
   *  composed control itself (the same reason `<lr-activity-feed>` targets `<lr-virtual-list>`'s
   *  `scrollContainer` rather than its host). Falls back to the host before its first render. */
  private descriptionSyncGeneration = 0;

  private get triggerEl(): HTMLElement | undefined {
    return this.composedTriggerEl?.control ?? this.composedTriggerEl;
  }
  private hasSyncedDescribedByElements = false;

  // Which file-backed capability the hidden input's next 'change' event
  // belongs to -- set synchronously right before the synthetic .click(), so
  // one shared <input> can serve both 'files' and 'image' (each wanting a
  // different `accept`) without needing two separate hidden inputs.
  private pendingCapability: LyraAttachmentFilesCapability = 'files';
  private pickerGeneration = 0;
  private pendingPickerGeneration = -1;

  private get effectiveCapabilities(): readonly LyraAttachmentCapability[] {
    return normalizeCapabilities(this.capabilities);
  }

  private get hasFileCapability(): boolean {
    return this.effectiveCapabilities.includes('files') || this.effectiveCapabilities.includes('image')
      || (isCameraCapture(this.cameraCapture) && this.effectiveCapabilities.includes('camera'));
  }

  private canReturnFiles(capability: LyraAttachmentFilesCapability): boolean {
    return this.effectiveCapabilities.includes(capability)
      && (capability !== 'camera' || (isCameraCapture(this.cameraCapture) && this.captureSupported));
  }

  /** Whether this realm's file input implements `capture` -- only touch engines do; a desktop
   *  engine ignores the attribute and would show a plain file picker. */
  private get captureSupported(): boolean {
    const view = this.ownerDocument.defaultView;
    return Boolean(view && 'capture' in view.HTMLInputElement.prototype);
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (changed.has('disabled') && this.disabled) void this.dropdownEl?.hide();
    if (changed.has('capabilities')) {
      const normalized = normalizeCapabilities(this.capabilities);
      if (!isCanonicalCapabilitySnapshot(this.capabilities)) this.capabilities = normalized;
    }
    if (
      (changed.has('capabilities') || changed.has('cameraCapture'))
      && this.pendingPickerGeneration !== -1
      && !this.canReturnFiles(this.pendingCapability)
    ) this.pendingPickerGeneration = -1;
  }

  // Merges a consumer-set host `aria-describedby` onto whichever internal trigger button is
  // currently rendered (single-capability or menu) -- the sole semantic owner -- since idrefs
  // never cross the shadow boundary on their own.
  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    this.syncTriggerDescription();
    // The composed `<lr-icon-button>` exists in the DOM by the time this update finishes, but it
    // has not run its OWN first update, so `control` is still null and the projection above lands
    // on nothing. Re-run once the child has rendered. Generation-guarded because a capability
    // change can swap single-capability trigger for menu trigger while the await is in flight.
    const composed = this.composedTriggerEl;
    if (!composed || composed.control) return;
    const generation = ++this.descriptionSyncGeneration;
    void composed.updateComplete.then(() => {
      if (generation !== this.descriptionSyncGeneration || !this.isConnected) return;
      this.syncTriggerDescription();
    });
  }

  private syncTriggerDescription(): void {
    const hostDescribedBy = this.getAttribute('aria-describedby');
    if (!hostDescribedBy && !this.hasSyncedDescribedByElements) return;
    this.hasSyncedDescribedByElements = syncAriaDescribedByElements(
      this,
      this.triggerEl,
      hostDescribedBy,
    );
  }

  private effectiveAccept(capability: LyraAttachmentFilesCapability): string {
    if (capability === 'camera') return 'image/*';
    return capability === 'image' ? this.accept || 'image/*' : this.accept;
  }

  private activateCapability(capability: LyraAttachmentCapability): void {
    if (this.disabled) return;
    const capture = this.cameraCapture;
    if (capability === 'camera' && !(isCameraCapture(capture) && this.captureSupported)) {
      this.emit('lr-camera-request', null);
      return;
    }
    if (capability === 'audio') {
      this.emit('lr-audio-request', null);
      return;
    }
    this.pendingCapability = capability;
    this.pendingPickerGeneration = ++this.pickerGeneration;
    const input = this.inputEl;
    if (!input) return;
    input.accept = this.effectiveAccept(capability);
    // Imperative like `accept`: one shared input serves every file-backed capability, and only a
    // camera activation may carry `capture`.
    if (capability === 'camera' && isCameraCapture(capture)) input.setAttribute('capture', capture);
    else input.removeAttribute('capture');
    input.click();
  }

  private onTriggerClick = (): void => {
    const capability = this.effectiveCapabilities[0];
    if (capability === undefined) return;
    this.activateCapability(capability);
  };

  private onMenuSelect = (e: CustomEvent<MenuItemSelectDetail>): void => {
    e.stopPropagation();
    const capability = e.detail.item.value;
    if (Object.prototype.hasOwnProperty.call(CAPABILITY_META, capability)
      && this.effectiveCapabilities.includes(capability as LyraAttachmentCapability)) {
      this.activateCapability(capability as LyraAttachmentCapability);
    }
  };

  private onInputChange = (e: Event): void => {
    e.stopPropagation();
    const input = e.target as HTMLInputElement;
    if (input !== this.inputEl) {
      input.value = '';
      return;
    }
    const selected = input.files;
    const generation = this.pendingPickerGeneration;
    this.pendingPickerGeneration = -1;
    if (
      this.isConnected
      && generation === this.pickerGeneration
      && !this.disabled
      && this.canReturnFiles(this.pendingCapability)
      && selected
      && selected.length > 0
    ) {
      const accept = this.effectiveAccept(this.pendingCapability);
      const allowed = snapshotMimeTypes(this.allowedMimeTypes);
      const forbidden = snapshotMimeTypes(this.forbiddenMimeTypes);
      const typeAllowed = allowed.length || forbidden.length ? mimeTypeFilter(allowed, forbidden) : undefined;
      const result = classifyFiles({
        accept, maxFiles: this.maxFiles, maxFileSize: this.maxFileSize, maxTotalSize: this.maxTotalSize,
        heldFileCount: this.heldFileCount, heldTotalSize: this.heldTotalSize,
      }, Array.from(selected), true, [], false, typeAllowed);
      // A File identity that matched the type filter cannot also be a type rejection.
      const matched = new Set(result.files);
      for (const entry of result.rejected) if (entry.reason !== 'type') matched.add(entry.file);
      const rejected = result.rejected.filter(entry => entry.reason !== 'type' || !matched.has(entry.file));
      this.emit('lr-files', { ...result, capability: this.pendingCapability, rejected });
    }
    // Clearing `.value` (not just leaving the stale selection in place)
    // means re-picking the exact same file still fires another 'change'
    // event next time, matching <lr-file-input>'s identical reset.
    input.value = '';
  };

  override disconnectedCallback(): void {
    this.pendingPickerGeneration = -1;
    this.pickerGeneration++;
    void this.dropdownEl?.hide();
    super.disconnectedCallback();
  }
  private onControlFocus = (event: FocusEvent): void => {
    relayNativeEvent(this, event);
  };
  private onControlBlur = (event: FocusEvent): void => {
    relayNativeEvent(this, event);
  };
  private stopInternalEvent = (event: Event): void => {
    event.stopPropagation();
  };

  private primaryControl(): HTMLButtonElement | undefined {
    return this.renderRoot?.querySelector<HTMLButtonElement>('[part="trigger"], [part="menu-trigger"]') ?? undefined;
  }

  override focus(options?: FocusOptions): void {
    this.primaryControl()?.focus(options);
  }

  override blur(): void {
    this.primaryControl()?.blur();
  }

  override click(): void {
    this.primaryControl()?.click();
  }

  private renderHiddenInput(): TemplateResult {
    return html`
      <input
        part="hidden-input"
        type="file"
        tabindex="-1"
        aria-hidden="true"
        ?multiple=${this.multiple}
        ?disabled=${this.disabled}
        @change=${this.onInputChange}
      />
    `;
  }

  private renderSingleTrigger(capability: LyraAttachmentCapability): TemplateResult {
    const meta = CAPABILITY_META[capability];
    const label = normalizeLabel(this.hostAccessibleLabel) ?? this.localize(ATTACHMENT_TRIGGER_KEYS[capability]);
    return html`
      <lr-icon-button
        part="trigger"
        exportparts="button:trigger-control"
        class="trigger-button"
        aria-label=${label}
        title=${this.triggerTitle ?? nothing}
        ?disabled=${this.disabled}
        @click=${this.onTriggerClick}
        @focus=${this.onControlFocus}
        @blur=${this.onControlBlur}
      >
        ${meta.icon()}
      </lr-icon-button>
    `;
  }

  private renderMenu(): TemplateResult {
    const addLabel = this.localize('attachmentAdd');
    const accessibleLabel = normalizeLabel(this.hostAccessibleLabel) ?? addLabel;
    return html`
      <lr-dropdown without-arrow
        part="menu"
        @lr-show=${this.stopInternalEvent}
        @lr-after-show=${this.stopInternalEvent}
        @lr-hide=${this.stopInternalEvent}
        @lr-after-hide=${this.stopInternalEvent}
      >
        <lr-icon-button
          slot="trigger"
          part="menu-trigger"
          exportparts="button:menu-trigger-control"
          class="trigger-button"
          aria-label=${accessibleLabel}
          title=${this.triggerTitle ?? nothing}
          ?disabled=${this.disabled}
          @focus=${this.onControlFocus}
          @blur=${this.onControlBlur}
        >
          ${paperclipIcon()}
          <span part="expand-icon" aria-hidden="true">${chevronIcon()}</span>
        </lr-icon-button>
        <lr-menu label=${accessibleLabel} @lr-select=${this.onMenuSelect}>
          ${this.effectiveCapabilities.map((capability) => {
            const meta = CAPABILITY_META[capability];
            return html`
              <lr-menu-item value=${capability} ?disabled=${this.disabled}>
                <span slot="icon">${meta.icon()}</span>
                ${this.localize(ATTACHMENT_MENU_KEYS[capability])}
              </lr-menu-item>
            `;
          })}
        </lr-menu>
      </lr-dropdown>
    `;
  }

  override render(): TemplateResult {
    const capabilities = this.effectiveCapabilities;
    const single = capabilities.length === 1;
    const multi = capabilities.length > 1;
    return html`
      ${single ? this.renderSingleTrigger(capabilities[0]!) : nothing}
      ${multi ? this.renderMenu() : nothing}
      ${this.hasFileCapability ? this.renderHiddenInput() : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-attachment-trigger': LyraAttachmentTrigger;
  }
}

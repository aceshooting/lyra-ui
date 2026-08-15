import type { LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import { html, nothing, svg, type PropertyValues, type TemplateResult, type SVGTemplateResult } from 'lit';
import { property, query } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { chevronIcon } from '../../../internal/icons.js';
import { relayNativeEvent } from '../../../internal/native-event-relay.js';
import { styles } from './attachment-trigger.styles.js';
import type { MenuItemSelectDetail } from '../../layout/menu/menu.class.js';
import type { LyraDropdown } from '../../overlays/overlay/dropdown.class.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_attachmentAdd, LYRA_DEFAULT_attachmentMenuAudio, LYRA_DEFAULT_attachmentMenuCamera, LYRA_DEFAULT_attachmentMenuFiles, LYRA_DEFAULT_attachmentMenuImage, LYRA_DEFAULT_attachmentTriggerAudio, LYRA_DEFAULT_attachmentTriggerCamera, LYRA_DEFAULT_attachmentTriggerFiles, LYRA_DEFAULT_attachmentTriggerImage, LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_open, LYRA_DEFAULT_progress, LYRA_DEFAULT_search, LYRA_DEFAULT_select } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type LyraAttachmentCapability = 'files' | 'image' | 'camera' | 'audio';

/** The capabilities that resolve to a real file selection (as opposed to `camera`/`audio`, which
 *  never touch the hidden file input -- see the class doc). */
export type LyraFileBackedCapability = Exclude<LyraAttachmentCapability, 'camera' | 'audio'>;

export interface LyraAttachmentFilesDetail {
  capability: LyraFileBackedCapability;
  files: readonly File[];
}

// Mirrors the shared icon set's viewBox/stroke conventions
// (internal/icons.ts's chevronIcon()/closeIcon()/etc.) without adding these
// one-off glyphs to that module -- it's off limits here -- so they still
// read as part of the same visual language as the rest of the library's
// inline icons. Same approach as lr-attachment-chip's local fileGlyph()/
// retryIcon() and lr-checkbox's local checkmarkGlyph().
const ICON_VIEW_BOX = '0 0 24 24';
const ICON_STROKE_WIDTH = '1.75';

function icon(paths: SVGTemplateResult): SVGTemplateResult {
  return svg`
    <svg
      width="1em"
      height="1em"
      viewBox=${ICON_VIEW_BOX}
      fill="none"
      stroke="currentColor"
      stroke-width=${ICON_STROKE_WIDTH}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >${paths}</svg>
  `;
}

/** A paperclip glyph -- the generic "attach" affordance, used for the
 *  `files` capability and as the multi-capability menu's own trigger icon
 *  (the one glyph a user recognizes regardless of which capabilities the
 *  menu underneath actually offers). */
function paperclipIcon(): SVGTemplateResult {
  return icon(svg`
    <path d="M21.44 11.05 12.25 20.24a5.5 5.5 0 0 1-7.78-7.78l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95l-9.2 9.19a1.5 1.5 0 0 1-2.12-2.12l8.49-8.48"></path>
  `);
}

/** A picture-frame glyph for the `image` capability. */
function imageIcon(): SVGTemplateResult {
  return icon(svg`
    <rect x="3" y="3" width="18" height="18" rx="2"></rect>
    <circle cx="8.5" cy="8.5" r="1.5"></circle>
    <polyline points="21 15 16 10 5 21"></polyline>
  `);
}

/** A camera-body glyph for the `camera` capability. */
function cameraIcon(): SVGTemplateResult {
  return icon(svg`
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z"></path>
    <circle cx="12" cy="13" r="4"></circle>
  `);
}

/** A mic glyph for the `audio` capability. Duplicated locally rather than shared -- this file's
 *  own convention keeps one-off icons local to whichever component renders them, matching the
 *  paperclip/image/camera glyphs above. */
function audioIcon(): SVGTemplateResult {
  return icon(svg`
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3Z"></path>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
    <line x1="12" y1="19" x2="12" y2="23"></line>
    <line x1="8" y1="23" x2="16" y2="23"></line>
  `);
}

interface CapabilityMeta {
  /** Icon shown on the single-capability trigger button and next to the menu item. */
  icon: () => SVGTemplateResult;
  /** Localization key for the single-capability trigger button's `aria-label`. */
  triggerKey: string;
  /** Localization key for the multi-capability menu item's label text. */
  menuKey: string;
}

const CAPABILITY_META: Record<LyraAttachmentCapability, CapabilityMeta> = {
  files: { icon: paperclipIcon, triggerKey: 'attachmentTriggerFiles', menuKey: 'attachmentMenuFiles' },
  image: { icon: imageIcon, triggerKey: 'attachmentTriggerImage', menuKey: 'attachmentMenuImage' },
  camera: { icon: cameraIcon, triggerKey: 'attachmentTriggerCamera', menuKey: 'attachmentMenuCamera' },
  audio: { icon: audioIcon, triggerKey: 'attachmentTriggerAudio', menuKey: 'attachmentMenuAudio' },
};

const OWNED_CAPABILITY_SNAPSHOTS = new WeakSet<object>();

function ownCapabilitySnapshot(values: LyraAttachmentCapability[]): readonly LyraAttachmentCapability[] {
  const snapshot = Object.freeze(values);
  OWNED_CAPABILITY_SNAPSHOTS.add(snapshot);
  return snapshot;
}

const DEFAULT_CAPABILITIES: readonly LyraAttachmentCapability[] = ownCapabilitySnapshot(['files']);

function normalizeCapabilities(value: unknown): readonly LyraAttachmentCapability[] {
  try {
    if (!Array.isArray(value)) return DEFAULT_CAPABILITIES;
    if (OWNED_CAPABILITY_SNAPSHOTS.has(value)) return value as readonly LyraAttachmentCapability[];
    const normalized: LyraAttachmentCapability[] = [];
    const length = Math.min(value.length, 4);
    for (let index = 0; index < length; index++) {
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
  'lr-blur': CustomEvent<null>;
  'lr-focus': CustomEvent<null>;
}
/**
 * `<lr-attachment-trigger>` — a compact attach affordance designed for a
 * chat composer's leading slot (see `<lr-chat-composer>`'s own `leading`
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
 * implement any camera or microphone capture UI itself — no `getUserMedia`,
 * no `<input capture>` — because that's entirely a host/browser concern with
 * no single right answer (a desktop web app, a mobile PWA, and a native
 * wrapper all want different things here). Activating `camera` fires
 * `lr-camera-request`; activating `audio` fires `lr-audio-request`. The
 * host owns everything from that point on — typically opening
 * `<lr-push-to-talk>` in a `<lr-overlay>`/popover for `audio`, then
 * handing the resulting blob to something like `<lr-attachment-chip>`.
 *
 * @customElement lr-attachment-trigger
 * @event lr-files - A file-backed capability's hidden file input produced a real selection.
 * `detail: { capability: 'files' | 'image', files }`; `files` is a fresh readonly owner-realm
 * `File[]` snapshot rather than the native input's live `FileList`.
 * @event lr-camera-request - The `camera` capability was activated. No
 * detail payload — see the class doc's scope note; the host implements the
 * actual capture flow.
 * @event lr-audio-request - The `audio` capability was activated. No
 * detail payload — same request-only scope as `lr-camera-request`; the
 * host implements the actual recording flow (typically `<lr-push-to-talk>`).
 * @event {FocusEvent} focus - Relayed once from the active trigger button as a bubbling, composed
 *   native event.
 * @event {FocusEvent} blur - Relayed once from the active trigger button as a bubbling, composed
 *   native event.
 * @event lr-focus - Prefixed compatibility alias for `focus`.
 * @event lr-blur - Prefixed compatibility alias for `blur`.
 * @csspart trigger - The single-capability icon button. Only rendered when `capabilities.length === 1`.
 * @csspart menu - The `<lr-dropdown>` shell. Only rendered when `capabilities.length > 1`.
 * @csspart menu-trigger - The multi-capability button slotted into `<lr-dropdown>`'s `trigger` slot. Only rendered when `capabilities.length > 1`.
 * @csspart expand-icon - The disclosure chevron inside the multi-capability trigger button. Only rendered when `capabilities.length > 1`.
 * @csspart hidden-input - The internal native `<input type="file">` that actually opens the OS file
 *   picker. Hidden (`display: none`) by default; exposed as a part only so a consumer can override
 *   that with `::part(hidden-input)` in the unlikely case their integration needs to.
 *
 * `accessibleLabel` supplies an accessible-name override for either trigger shape. A host
 * `aria-label`, including an explicit empty value, wins over it.
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
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    open: LYRA_DEFAULT_open,
    progress: LYRA_DEFAULT_progress,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override readonly ownedCollectionProperties = Object.freeze([
    'capabilities',
  ]);

  static override styles = [LyraElement.styles, styles];
  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-files',
  ]);

  /** Which attachment capabilities to offer, in display order. A single
   *  entry renders a plain button; more than one renders a menu. */
  @property({ attribute: false }) capabilities: readonly LyraAttachmentCapability[] = DEFAULT_CAPABILITIES;

  /** Native-file-input-style accept string (e.g. `'image/*'` or
   *  `'.pdf,.docx'`), forwarded to the hidden file input for the
   *  `files`/`image` capabilities — see the class doc for how each uses it. */
  @property() accept = '';

  /** Accessible-name override for the semantic trigger button. */
  @property({ attribute: 'accessible-label' }) accessibleLabel?: string;

  /** Forwards to the internal trigger button(s)' native `title` attribute — a sighted mouse
   *  user's hover tooltip, distinct from `accessibleLabel`'s accessible-name (`aria-label`) role.
   *  Applies to both the single-capability `[part=trigger]` button and the multi-capability
   *  `[part=menu-trigger]` button. Unset (the default): no `title` attribute, unchanged from
   *  before this property existed. */
  @property({ attribute: 'trigger-title' }) triggerTitle?: string;

  /** Forwarded to the hidden file input's own `multiple` attribute. */
  @property({ type: Boolean, reflect: true, converter: trueDefaultBooleanConverter }) multiple = true;

  @property({ type: Boolean, reflect: true }) disabled = false;

  @query('input[type="file"]') private inputEl?: HTMLInputElement;
  @query('lr-dropdown') private dropdownEl?: LyraDropdown;

  // Which file-backed capability the hidden input's next 'change' event
  // belongs to -- set synchronously right before the synthetic .click(), so
  // one shared <input> can serve both 'files' and 'image' (each wanting a
  // different `accept`) without needing two separate hidden inputs.
  private pendingCapability: LyraFileBackedCapability = 'files';
  private pickerGeneration = 0;
  private pendingPickerGeneration = -1;

  private get effectiveCapabilities(): readonly LyraAttachmentCapability[] {
    return normalizeCapabilities(this.capabilities);
  }

  private get hasFileCapability(): boolean {
    return this.effectiveCapabilities.includes('files') || this.effectiveCapabilities.includes('image');
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (changed.has('disabled') && this.disabled) void this.dropdownEl?.hide();
    if (changed.has('capabilities')) {
      const normalized = normalizeCapabilities(this.capabilities);
      if (!isCanonicalCapabilitySnapshot(this.capabilities)) this.capabilities = normalized;
    }
  }

  private effectiveAccept(capability: LyraFileBackedCapability): string {
    return capability === 'image' ? this.accept || 'image/*' : this.accept;
  }

  private activateCapability(capability: LyraAttachmentCapability): void {
    if (this.disabled) return;
    if (capability === 'camera') {
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
    const selected = input.files;
    const generation = this.pendingPickerGeneration;
    this.pendingPickerGeneration = -1;
    if (
      this.isConnected
      && generation === this.pickerGeneration
      && !this.disabled
      && selected
      && selected.length > 0
    ) {
      const OwnerArray = this.ownerDocument.defaultView?.Array ?? Array;
      const files = Object.freeze(OwnerArray.from(selected)) as readonly File[];
      this.emit('lr-files', {
        capability: this.pendingCapability,
        files,
      });
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
    this.emit('lr-focus', null);
  };
  private onControlBlur = (event: FocusEvent): void => {
    relayNativeEvent(this, event);
    this.emit('lr-blur', null);
  };
  private stopInternalEvent = (event: Event): void => {
    event.stopPropagation();
  };

  private primaryControl(): HTMLButtonElement | undefined {
    return this.renderRoot.querySelector<HTMLButtonElement>('[part="trigger"], [part="menu-trigger"]') ?? undefined;
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
    const hostLabel = this.hasAttribute('aria-label') ? (this.getAttribute('aria-label') ?? '') : null;
    const label = hostLabel ?? this.accessibleLabel ?? this.localize(meta.triggerKey);
    return html`
      <button
        part="trigger"
        class="trigger-button"
        type="button"
        aria-label=${label}
        title=${this.triggerTitle ?? nothing}
        ?disabled=${this.disabled}
        @click=${this.onTriggerClick}
        @focus=${this.onControlFocus}
        @blur=${this.onControlBlur}
      >
        ${meta.icon()}
      </button>
    `;
  }

  private renderMenu(): TemplateResult {
    const addLabel = this.localize('attachmentAdd');
    const hostLabel = this.hasAttribute('aria-label') ? (this.getAttribute('aria-label') ?? '') : null;
    const accessibleLabel = hostLabel ?? this.accessibleLabel ?? addLabel;
    return html`
      <lr-dropdown
        part="menu"
        @lr-show=${this.stopInternalEvent}
        @lr-after-show=${this.stopInternalEvent}
        @lr-hide=${this.stopInternalEvent}
        @lr-after-hide=${this.stopInternalEvent}
      >
        <button
          slot="trigger"
          part="menu-trigger"
          class="trigger-button"
          type="button"
          aria-label=${accessibleLabel}
          title=${this.triggerTitle ?? nothing}
          ?disabled=${this.disabled}
          @focus=${this.onControlFocus}
          @blur=${this.onControlBlur}
        >
          ${paperclipIcon()}
          <span part="expand-icon" aria-hidden="true">${chevronIcon()}</span>
        </button>
        <lr-menu label=${accessibleLabel} @lr-select=${this.onMenuSelect}>
          ${this.effectiveCapabilities.map((capability) => {
            const meta = CAPABILITY_META[capability];
            return html`
              <lr-menu-item value=${capability} ?disabled=${this.disabled}>
                <span slot="icon">${meta.icon()}</span>
                ${this.localize(meta.menuKey)}
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

import { html, nothing, svg, type TemplateResult, type SVGTemplateResult } from 'lit';
import { property, query } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { chevronIcon } from '../../internal/icons.js';
import { styles } from './attachment-trigger.styles.js';
import type { MenuSelectDetail } from '../menu/menu.class.js';
import '../menu/menu.class.js';
import '../menu/menu-item.class.js';

export type AttachmentCapability = 'files' | 'image' | 'camera' | 'audio';

/** The capabilities that resolve to a real file selection (as opposed to `camera`/`audio`, which
 *  never touch the hidden file input -- see the class doc). */
export type FileBackedCapability = Exclude<AttachmentCapability, 'camera' | 'audio'>;

export interface AttachmentPickDetail {
  capability: FileBackedCapability;
  files: FileList;
}

// Mirrors the shared icon set's viewBox/stroke conventions
// (internal/icons.ts's chevronIcon()/closeIcon()/etc.) without adding these
// one-off glyphs to that module -- it's off limits here -- so they still
// read as part of the same visual language as the rest of the library's
// inline icons. Same approach as lyra-attachment-chip's local fileGlyph()/
// retryIcon() and lyra-checkbox's local checkmarkGlyph().
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

const CAPABILITY_META: Record<AttachmentCapability, CapabilityMeta> = {
  files: { icon: paperclipIcon, triggerKey: 'attachmentTriggerFiles', menuKey: 'attachmentMenuFiles' },
  image: { icon: imageIcon, triggerKey: 'attachmentTriggerImage', menuKey: 'attachmentMenuImage' },
  camera: { icon: cameraIcon, triggerKey: 'attachmentTriggerCamera', menuKey: 'attachmentMenuCamera' },
  audio: { icon: audioIcon, triggerKey: 'attachmentTriggerAudio', menuKey: 'attachmentMenuAudio' },
};

export interface LyraAttachmentTriggerEventMap {
  'lyra-camera-request': CustomEvent<undefined>;
  'lyra-audio-request': CustomEvent<undefined>;
  'lyra-pick': CustomEvent<AttachmentPickDetail>;
  blur: CustomEvent<undefined>;
  focus: CustomEvent<undefined>;
}
/**
 * `<lyra-attachment-trigger>` — a compact attach affordance designed for a
 * chat composer's leading slot (see `<lyra-chat-composer>`'s own `leading`
 * slot, which this drops straight into, though this component has no code
 * dependency on it). Its shape adapts to how many attachment `capabilities`
 * are configured:
 *  - Exactly one capability: a single plain icon button ([part='trigger']).
 *    Activating it performs that capability's action directly.
 *  - More than one: a small anchored menu ([part='menu'], composed from
 *    `<lyra-menu>`/`<lyra-menu-item>`) listing each capability as a row.
 *
 * Two of the four capabilities (`files`, `image`) are file-picker-backed:
 * activating them opens a hidden native `<input type="file">` via a
 * synthetic `.click()`, and the resulting selection is re-emitted as
 * `lyra-pick`. `accept` is shared across both — `image` defaults it to
 * `'image/*'` unless the `accept` prop overrides it, `files` always uses
 * `accept` as-is (empty means "any file type", matching a bare native
 * `<input type="file">` with no `accept` attribute).
 *
 * **`camera`/`audio` are scope-limited by design.** This component does not
 * implement any camera or microphone capture UI itself — no `getUserMedia`,
 * no `<input capture>` — because that's entirely a host/browser concern with
 * no single right answer (a desktop web app, a mobile PWA, and a native
 * wrapper all want different things here). Activating `camera` fires
 * `lyra-camera-request`; activating `audio` fires `lyra-audio-request`. The
 * host owns everything from that point on — typically opening
 * `<lyra-push-to-talk>` in a `<lyra-overlay>`/popover for `audio`, then
 * handing the resulting blob to something like `<lyra-attachment-chip>`.
 *
 * @customElement lyra-attachment-trigger
 * @event lyra-pick - A file-backed capability's hidden file input produced a
 * real selection. `detail: { capability: 'files' | 'image', files }` — a
 * real `FileList` (not a plain array), matching the native input's own
 * `.files` shape, but an independent snapshot rather than that same live
 * object — see `onInputChange`'s own doc for why a live reference would be
 * unsafe to hand out here.
 * @event lyra-camera-request - The `camera` capability was activated. No
 * detail payload — see the class doc's scope note; the host implements the
 * actual capture flow.
 * @event lyra-audio-request - The `audio` capability was activated. No
 * detail payload — same request-only scope as `lyra-camera-request`; the
 * host implements the actual recording flow (typically `<lyra-push-to-talk>`).
 * @csspart trigger - The single-capability icon button. Only rendered when `capabilities.length === 1`.
 * @csspart menu - The `<lyra-menu>` wrapper. Only rendered when `capabilities.length > 1`.
 * @csspart menu-trigger - The multi-capability button slotted into `<lyra-menu>`'s own `trigger` slot. Only rendered when `capabilities.length > 1`.
 * @csspart expand-icon - The disclosure chevron inside the multi-capability trigger button. Only rendered when `capabilities.length > 1`.
 * @csspart hidden-input - The internal native `<input type="file">` that actually opens the OS file
 *   picker. Hidden (`display: none`) by default; exposed as a part only so a consumer can override
 *   that with `::part(hidden-input)` in the unlikely case their integration needs to.
 *
 * `triggerLabel` lets a host override the single-capability trigger button's
 * `aria-label` (i18n) — see that property's own doc for exactly what it
 * does and doesn't affect.
 */
export class LyraAttachmentTrigger extends LyraElement<LyraAttachmentTriggerEventMap> {
  static styles = [LyraElement.styles, styles];

  /** Which attachment capabilities to offer, in display order. A single
   *  entry renders a plain button; more than one renders a menu. */
  @property({ attribute: false }) capabilities: AttachmentCapability[] = ['files'];

  /** Native-file-input-style accept string (e.g. `'image/*'` or
   *  `'.pdf,.docx'`), forwarded to the hidden file input for the
   *  `files`/`image` capabilities — see the class doc for how each uses it. */
  @property() accept = '';

  /** Overrides the single-capability trigger button's `aria-label`, which
   *  otherwise comes from `this.localize()` (e.g. `'Attach files'`, localizable
   *  via `.strings`/`registerLyraLocale()`). Set this for a one-off override;
   *  leave it unset to keep the localized default. Only affects the
   *  single-capability button ([part='trigger']) — the multi-capability
   *  menu's own trigger keeps its own `'Add attachment'` label regardless. */
  @property({ attribute: 'trigger-label' }) triggerLabel?: string;

  /** Forwards to the internal trigger button(s)' native `title` attribute — a sighted mouse
   *  user's hover tooltip, distinct from `triggerLabel`'s accessible-name (`aria-label`) role.
   *  Applies to both the single-capability `[part=trigger]` button and the multi-capability
   *  `[part=menu-trigger]` button. Unset (the default): no `title` attribute, unchanged from
   *  before this property existed. */
  @property({ attribute: 'trigger-title' }) triggerTitle?: string;

  /** Forwarded to the hidden file input's own `multiple` attribute. */
  @property({ type: Boolean, reflect: true }) multiple = true;

  @property({ type: Boolean, reflect: true }) disabled = false;

  @query('input[type="file"]') private inputEl?: HTMLInputElement;

  // Which file-backed capability the hidden input's next 'change' event
  // belongs to -- set synchronously right before the synthetic .click(), so
  // one shared <input> can serve both 'files' and 'image' (each wanting a
  // different `accept`) without needing two separate hidden inputs.
  private pendingCapability: FileBackedCapability = 'files';

  private get hasFileCapability(): boolean {
    return this.capabilities.includes('files') || this.capabilities.includes('image');
  }

  private effectiveAccept(capability: FileBackedCapability): string {
    return capability === 'image' ? this.accept || 'image/*' : this.accept;
  }

  private activateCapability(capability: AttachmentCapability): void {
    if (this.disabled) return;
    if (capability === 'camera') {
      this.emit('lyra-camera-request');
      return;
    }
    if (capability === 'audio') {
      this.emit('lyra-audio-request');
      return;
    }
    this.pendingCapability = capability;
    const input = this.inputEl;
    if (!input) return;
    input.accept = this.effectiveAccept(capability);
    input.click();
  }

  private onTriggerClick = (): void => {
    this.activateCapability(this.capabilities[0]);
  };

  private onMenuSelect = (e: CustomEvent<MenuSelectDetail>): void => {
    this.activateCapability(e.detail.value as AttachmentCapability);
  };

  private onInputChange = (e: Event): void => {
    const input = e.target as HTMLInputElement;
    const selected = input.files;
    if (selected && selected.length > 0) {
      // `input.files` is a *live* view of the input's own current
      // selection, not a frozen snapshot -- clearing `.value` below (so
      // re-picking the exact same file still fires another 'change' next
      // time) mutates this very object back to empty in place. A listener
      // that reads `detail.files` synchronously (a plain `addEventListener`
      // callback) would never notice, but anything that reads it even one
      // microtask later (an `async` handler, a queued upload) would see an
      // empty list. Rehoming the selected files into a fresh `DataTransfer`
      // produces an independent `FileList` — still the real `FileList` type
      // the `lyra-pick` contract promises, just no longer tied to this
      // input's own live state.
      const snapshot = new DataTransfer();
      for (const file of selected) snapshot.items.add(file);
      this.emit<AttachmentPickDetail>('lyra-pick', {
        capability: this.pendingCapability,
        files: snapshot.files,
      });
    }
    // Clearing `.value` (not just leaving the stale selection in place)
    // means re-picking the exact same file still fires another 'change'
    // event next time, matching <lyra-file-input>'s identical reset.
    input.value = '';
  };
  private onNativeFocus = (): void => { this.emit('focus'); };
  private onNativeBlur = (): void => { this.emit('blur'); };

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
        @focus=${this.onNativeFocus}
        @blur=${this.onNativeBlur}
      />
    `;
  }

  private renderSingleTrigger(capability: AttachmentCapability): TemplateResult {
    const meta = CAPABILITY_META[capability];
    return html`
      <button
        part="trigger"
        class="trigger-button"
        type="button"
        aria-label=${this.localize(meta.triggerKey, this.triggerLabel)}
        title=${this.triggerTitle ?? nothing}
        ?disabled=${this.disabled}
        @click=${this.onTriggerClick}
      >
        ${meta.icon()}
      </button>
    `;
  }

  private renderMenu(): TemplateResult {
    const addLabel = this.localize('attachmentAdd');
    return html`
      <lyra-menu part="menu" label=${addLabel} @lyra-menu-select=${this.onMenuSelect}>
        <button
          slot="trigger"
          part="menu-trigger"
          class="trigger-button"
          type="button"
          aria-label=${addLabel}
          title=${this.triggerTitle ?? nothing}
          ?disabled=${this.disabled}
        >
          ${paperclipIcon()}
          <span part="expand-icon" aria-hidden="true">${chevronIcon()}</span>
        </button>
        ${this.capabilities.map((capability) => {
          const meta = CAPABILITY_META[capability];
          return html`
            <lyra-menu-item value=${capability}>
              <span slot="icon">${meta.icon()}</span>
              ${this.localize(meta.menuKey)}
            </lyra-menu-item>
          `;
        })}
      </lyra-menu>
    `;
  }

  render(): TemplateResult {
    const single = this.capabilities.length === 1;
    const multi = this.capabilities.length > 1;
    return html`
      ${single ? this.renderSingleTrigger(this.capabilities[0]) : nothing}
      ${multi ? this.renderMenu() : nothing}
      ${this.hasFileCapability ? this.renderHiddenInput() : nothing}
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lyra-attachment-trigger': LyraAttachmentTrigger;
  }
}

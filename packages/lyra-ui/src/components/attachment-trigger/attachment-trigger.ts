import { html, nothing, svg, type TemplateResult, type SVGTemplateResult } from 'lit';
import { property, query } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { styles } from './attachment-trigger.styles.js';
import type { MenuSelectDetail } from '../menu/menu.js';
import '../menu/menu.js';
import '../menu/menu-item.js';

export type AttachmentCapability = 'files' | 'image' | 'camera';

/** The two capabilities that resolve to a real file selection (as opposed
 *  to `camera`, which never touches a file input -- see the class doc). */
export type FileBackedCapability = Exclude<AttachmentCapability, 'camera'>;

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

interface CapabilityMeta {
  /** Icon shown on the single-capability trigger button and next to the menu item. */
  icon: () => SVGTemplateResult;
  /** `aria-label` for the single-capability trigger button. */
  triggerLabel: string;
  /** Label text for the multi-capability menu item. */
  menuLabel: string;
}

const CAPABILITY_META: Record<AttachmentCapability, CapabilityMeta> = {
  files: { icon: paperclipIcon, triggerLabel: 'Attach files', menuLabel: 'Upload files' },
  image: { icon: imageIcon, triggerLabel: 'Attach an image', menuLabel: 'Upload a photo' },
  camera: { icon: cameraIcon, triggerLabel: 'Use camera', menuLabel: 'Take a photo' },
};

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
 * Two of the three capabilities (`files`, `image`) are file-picker-backed:
 * activating them opens a hidden native `<input type="file">` via a
 * synthetic `.click()`, and the resulting selection is re-emitted as
 * `lyra-pick`. `accept` is shared across both — `image` defaults it to
 * `'image/*'` unless the `accept` prop overrides it, `files` always uses
 * `accept` as-is (empty means "any file type", matching a bare native
 * `<input type="file">` with no `accept` attribute).
 *
 * **`camera` is scope-limited by design.** This component does not
 * implement any camera capture UI itself — no `getUserMedia`, no
 * `<input capture>` — because that's entirely a host/browser concern with
 * no single right answer (a desktop web app, a mobile PWA, and a native
 * wrapper all want different things here). Activating the `camera`
 * capability only fires `lyra-camera-request`; the host owns everything
 * from that point on (opening its own capture UI, then presumably handing
 * the resulting `File` back to something like `<lyra-attachment-chip>`).
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
 * @csspart trigger - The single-capability icon button. Only rendered when `capabilities.length === 1`.
 * @csspart menu - The `<lyra-menu>` wrapper. Only rendered when `capabilities.length > 1`.
 */
export class LyraAttachmentTrigger extends LyraElement {
  static styles = [LyraElement.styles, styles];

  /** Which attachment capabilities to offer, in display order. A single
   *  entry renders a plain button; more than one renders a menu. */
  @property({ attribute: false }) capabilities: AttachmentCapability[] = ['files'];

  /** Native-file-input-style accept string (e.g. `'image/*'` or
   *  `'.pdf,.docx'`), forwarded to the hidden file input for the
   *  `files`/`image` capabilities — see the class doc for how each uses it. */
  @property() accept = '';

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

  private renderHiddenInput(): TemplateResult {
    return html`
      <input
        type="file"
        tabindex="-1"
        aria-hidden="true"
        ?multiple=${this.multiple}
        ?disabled=${this.disabled}
        @change=${this.onInputChange}
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
        aria-label=${meta.triggerLabel}
        ?disabled=${this.disabled}
        @click=${this.onTriggerClick}
      >
        ${meta.icon()}
      </button>
    `;
  }

  private renderMenu(): TemplateResult {
    return html`
      <lyra-menu part="menu" label="Add attachment" @lyra-menu-select=${this.onMenuSelect}>
        <button
          slot="trigger"
          class="trigger-button"
          type="button"
          aria-label="Add attachment"
          ?disabled=${this.disabled}
        >
          ${paperclipIcon()}
        </button>
        ${this.capabilities.map((capability) => {
          const meta = CAPABILITY_META[capability];
          return html`
            <lyra-menu-item value=${capability}>
              <span slot="icon">${meta.icon()}</span>
              ${meta.menuLabel}
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

defineElement('attachment-trigger', LyraAttachmentTrigger);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-attachment-trigger': LyraAttachmentTrigger;
  }
}

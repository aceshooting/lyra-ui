import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import type { Placement } from '@floating-ui/dom';
import { LyraElement } from '../../../internal/lyra-element.js';
import { FormAssociated } from '../../../internal/form-associated.js';
import { nextId, srOnly } from '../../../internal/a11y.js';
import { place } from '../../../internal/positioner.js';
import { isRtl, rtlAwarePlacement } from '../../../internal/rtl.js';
import { activateOverlay, composedContains, type OverlayHandle } from '../../../internal/overlay-manager.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { finiteRange } from '../../../internal/numbers.js';
import { eyeIcon } from '../../../internal/icons.js';
import {
  cssColor,
  formatColor,
  hsva,
  parseColor,
  sameColor,
  withAlphaFormat,
  type LyraColorHsva,
  type LyraColorPickerFormat,
  type LyraColorPickerOutputFormat,
} from './color-core.js';
import { sizes } from '../../../internal/sizes.styles.js';
import type { LyraSize, LyraSizeStep } from '../../../internal/variants.js';
import { styles } from './color-picker.styles.js';

export type {
  LyraColorHsva,
  LyraColorPickerFormat,
  LyraColorPickerOutputFormat,
} from './color-core.js';

/** Alias of the library-wide {@linkcode LyraSizeStep}; kept as a named export so existing imports
 *  and the generated manifest keep resolving while there is exactly one definition of the ladder. */
export type LyraColorPickerSize = LyraSizeStep;

/** A predefined palette entry. `label` becomes the swatch's accessible name; without one the
 *  raw colour string is announced instead. */
export interface LyraColorPickerSwatch {
  color: string;
  label?: string;
}

/** Arrow-key step, in percent/degrees. Shift multiplies it by {@link LARGE_STEP_MULTIPLIER}. */
const SMALL_STEP = 1;
/** How much larger a shift+arrow step is than a plain arrow step. */
const LARGE_STEP_MULTIPLIER = 10;
/** The order the format toggle cycles through. */
const FORMAT_CYCLE: LyraColorPickerFormat[] = ['hex', 'rgb', 'hsl', 'hsv'];

/** The subset of the EyeDropper API this component uses, feature-detected at connect. */
interface EyeDropperLike {
  open(options?: { signal?: AbortSignal }): Promise<{ sRGBHex: string }>;
}
type EyeDropperConstructor = new () => EyeDropperLike;

function eyeDropperConstructor(): EyeDropperConstructor | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { EyeDropper?: EyeDropperConstructor }).EyeDropper;
}

export interface LyraColorPickerEventMap {
  input: CustomEvent<undefined>;
  change: CustomEvent<undefined>;
  blur: CustomEvent<undefined>;
  focus: CustomEvent<undefined>;
  'lr-change': CustomEvent<{ value: string }>;
  'lr-show': CustomEvent<undefined>;
  'lr-hide': CustomEvent<undefined>;
}
class ColorPickerBase extends LyraElement<LyraColorPickerEventMap> {}

/**
 * `<lr-color-picker>` — a form-associated colour picker: a compact swatch trigger that opens a
 * popover with a saturation/brightness grid, a hue slider, an optional alpha slider, a text field
 * accepting any parseable CSS colour, an optional predefined palette, and — where the browser
 * supports it — a screen eyedropper.
 *
 * `value` is always serialized in the active `format` (`hex` by default), so reading it back after
 * any interaction gives a canonical string in exactly one syntax; switching `format`, `opacity`, or
 * `uppercase` re-serializes the same colour rather than reinterpreting it. Input is far more
 * permissive than output: hex (3/4/6/8 digit), `rgb()`/`rgba()`, `hsl()`/`hsla()`,
 * `hsv()`/`hsva()`, CSS colour names, and any other colour syntax the browser itself parses are all
 * accepted. A value that is not a colour at all is kept verbatim rather than being silently
 * replaced, so a consumer's own sentinel survives a round trip.
 *
 * Colour is never the only channel carrying state: the trigger is described by the current value in
 * text, the panel shows it in an editable field, and the selected palette swatch is marked with
 * `aria-pressed` plus a check mark rather than a tint alone.
 *
 * @customElement lr-color-picker
 * @slot label - Custom label content.
 * @slot hint - Supporting text.
 * @slot error - Custom validation-error content.
 * @event input - Native-style composed event, fired for every colour change during an interaction.
 * @event change - Native-style composed event, fired once an interaction commits (pointer release,
 *   key release, swatch click, text entry, eyedropper result).
 * @event lr-change - Change detail carrying the newly serialized value.
 * @event lr-show - The colour panel opened.
 * @event lr-hide - The colour panel closed.
 * @event focus - Re-dispatched from the trigger's own `focus`, bubbling and composed unlike the
 *   native event.
 * @event blur - Re-dispatched from the trigger's own `blur`, for the same reason as `focus`.
 * @method show - `show(): void` — opens the panel unless the control is effectively disabled.
 * @method hide - `hide(): void` — closes the panel and returns focus to the trigger.
 * @method getFormattedValue - `getFormattedValue(format?: LyraColorPickerOutputFormat): string` —
 *   the current colour in any of the eight supported formats, independent of `format`/`opacity`.
 * @csspart form-control - The field wrapper.
 * @csspart form-control-label - The label. Also carries the `label` part token for back-compat.
 * @csspart label - Alias of `form-control-label`, kept for back-compat.
 * @csspart trigger-container - The row wrapping the trigger.
 * @csspart trigger - The swatch button that opens the panel.
 * @csspart panel - The positioned popover surface.
 * @csspart grid - The saturation/brightness grid.
 * @csspart grid-handle - The grid's draggable, keyboard-operable handle.
 * @csspart slider - Both the hue and opacity sliders.
 * @csspart slider-handle - Both slider handles.
 * @csspart hue-slider - The hue slider. Also carries the `slider` token.
 * @csspart hue-slider-handle - The hue slider's handle. Also carries the `slider-handle` token.
 * @csspart opacity-slider - The opacity slider, rendered only when `opacity` is set. Also carries
 *   the `slider` token.
 * @csspart opacity-slider-handle - The opacity slider's handle. Also carries the `slider-handle`
 *   token.
 * @csspart preview - The current-colour preview beside the sliders.
 * @csspart input - The text field holding the serialized value.
 * @csspart format-button - The format-cycling button.
 * @csspart eyedropper-button - The screen-eyedropper button, rendered only where the EyeDropper API
 *   exists.
 * @csspart swatches - The predefined-palette container, rendered only when `swatches` is non-empty.
 * @csspart swatch - A single palette swatch. The active one is `[part~='swatch-selected']`.
 * @csspart swatch-selected - Token added to the swatch matching the current value.
 * @csspart hint - Supporting text.
 * @csspart error - The validation message.
 * @cssprop [--lr-color-picker-swatch-size=var(--lr-form-control-height,var(--lr-size-2-5rem))] -
 *   The trigger's inline and block size. Reads the shared form-control height ladder, so retuning
 *   `--lr-theme-form-control-height-*` keeps the trigger square with the fields beside it.
 * @cssprop [--lr-color-picker-gap=var(--lr-space-xs)] - Gap between field chrome and panel rows.
 * @cssprop [--lr-color-picker-radius=var(--lr-radius)] - Trigger, grid, and panel corner radius.
 * @cssprop [--lr-color-picker-hover-border-color=var(--lr-color-brand)] - Hover border color.
 * @cssprop [--lr-color-picker-grid-inline-size=var(--lr-size-15rem)] - Saturation/brightness grid width.
 * @cssprop [--lr-color-picker-grid-block-size=var(--lr-size-8rem)] - Saturation/brightness grid height.
 * @cssprop [--lr-color-picker-grid-handle-size=var(--lr-size-1rem)] - Diameter of the grid handle.
 * @cssprop [--lr-color-picker-slider-block-size=var(--lr-size-0-75rem)] - Thickness of the visible
 *   hue/opacity ramp. The slider's own pointer target stays floored at 24px regardless.
 * @cssprop [--lr-color-picker-slider-handle-size=var(--lr-size-1-25rem)] - Diameter of a slider handle.
 * @cssprop [--lr-color-picker-palette-swatch-size=var(--lr-size-1-5rem)] - Size of a palette swatch.
 * @cssprop [--lr-color-picker-checker-color=var(--lr-color-border)] - Tint of the alpha checkerboard.
 * @cssprop [--lr-color-picker-checker-size=var(--lr-size-0-5rem)] - Cell size of the alpha checkerboard.
 * @cssprop --lr-color-picker-hue-stops - The hue ramp's own gradient stops, shared by the hue
 *   slider in both text directions. Defaults to the six-stop sRGB hue wheel.
 * @cssprop --lr-color-picker-swatch-color - The live colour painted on the trigger, preview, slider
 *   handles, and palette swatches. Rewritten on every render, so it reports state rather than
 *   accepting configuration.
 * @cssprop --lr-color-picker-grid-hue - The saturation/brightness grid's fully-saturated base hue.
 *   Rewritten on every render, like `--lr-color-picker-swatch-color`.
 * @cssprop --lr-color-picker-opacity-gradient - The opacity slider's transparent-to-opaque ramp,
 *   built from the current colour and text direction. Rewritten on every render.
 */
export class LyraColorPicker extends FormAssociated(ColorPickerBase) {
  static override styles = [LyraElement.styles, srOnly, sizes, styles];

  @property() label = '';
  @property() hint = '';
  @property({ attribute: 'error-text' }) errorText = '';
  @property({ attribute: 'aria-label' }) accessibleLabel = '';
  /** Visual size — the library-wide `2xs`–`xl` ladder shared with `lr-input`/`lr-select`, so the
   *  trigger swatch is exactly as tall as a field beside it. The Web Awesome / Shoelace spellings
   *  `small`/`medium`/`large` are accepted for `s`/`m`/`l`, so a migration is a tag rename with no
   *  attribute rewrite. */
  @property({ reflect: true }) size: LyraSize = 'm';
  /** Output format for `value`. Input is always parsed permissively regardless of this. */
  @property() format: LyraColorPickerFormat = 'hex';
  /** Enables the alpha channel: an opacity slider, and an alpha-carrying serialized value. */
  @property({ type: Boolean }) opacity = false;
  /** Serializes `value` in upper case (`#FF0000` rather than `#ff0000`). */
  @property({ type: Boolean }) uppercase = false;
  /** Predefined palette. A `;`-separated string, an array of colour strings, or an array of
   *  `{ color, label }` objects. Every colour the picker can parse is accepted. */
  @property() swatches: string | string[] | LyraColorPickerSwatch[] = '';
  /** Removes the button that cycles between formats. */
  @property({ type: Boolean, attribute: 'without-format-toggle' }) withoutFormatToggle = false;
  /** Preferred panel placement; the resolved side still flips to stay in the viewport. */
  @property({ reflect: true }) placement: Placement = 'bottom-start';

  private _open = false;
  /** Whether the colour panel is showing. */
  @property({ type: Boolean, reflect: true })
  get open(): boolean {
    return this._open;
  }
  set open(next: boolean) {
    const normalized = Boolean(next) && !this.effectiveDisabled;
    if (normalized === this._open) return;
    const old = this._open;
    this._open = normalized;
    this.requestUpdate('open', old);
  }

  @state() private hasLabel = false;
  @state() private hasHint = false;
  @state() private hasError = false;
  @state() private hasEyeDropper = false;
  @state() private color: LyraColorHsva = hsva(0, 0, 0, 1);
  /** Set by the `value` setter; consumed once per update cycle by `willUpdate()`. Parsing is
   *  deferred so a declarative `value` attribute is interpreted with the `format`/`opacity`/
   *  `uppercase` attributes that arrive alongside it, whatever order they land in. */
  private valueNeedsParse = false;
  private pendingInput = '';

  private hintId = nextId('color-picker-hint');
  private errorId = nextId('color-picker-error');
  private valueTextId = nextId('color-picker-value');
  private triggerId = nextId('color-picker-trigger');
  private panelId = nextId('color-picker-panel');

  /** Which control a pointer drag is currently steering, plus the box it maps onto. */
  private drag?: { pointerId: number; track: 'grid' | 'hue' | 'alpha'; rect: DOMRect; rtl: boolean };
  private dragChanged = false;
  private keyboardChanged = false;
  private cleanupPositioner?: () => void;
  private overlayHandle?: OverlayHandle;
  private lightDismissDocument?: Document;
  private hasRenderedOnce = false;

  override connectedCallback(): void {
    if (!this.hasAttribute('value') && !this.value) this.value = '#000000';
    super.connectedCallback();
    // Seed from the light-DOM children directly, before the first render -- the slots'
    // @slotchange handler (onSlotChange below) only fires once the shadow DOM has committed its
    // first <slot> elements, so relying on it alone rendered label/hint/error chrome `hidden` on
    // the very first paint for a color picker mounted with declarative slotted content, only
    // revealing it on the following render. Mirrors lr-checkbox-group's identical fix.
    const hasSlot = (name: string): boolean =>
      Array.from(this.children).some((el) => el.getAttribute('slot') === name);
    this.hasLabel = hasSlot('label');
    this.hasHint = hasSlot('hint');
    this.hasError = hasSlot('error');
    this.hasEyeDropper = eyeDropperConstructor() !== undefined;
  }

  override disconnectedCallback(): void {
    // A disconnect/reconnect cycle (drag-and-drop reparenting, a virtualized list reordering)
    // otherwise leaves the panel rendered open at a stale, frozen position. Assigned through the
    // setter so the reflected `open` attribute is cleared too, then torn down immediately rather
    // than waiting for the scheduled update.
    this.open = false;
    this.teardownOverlay();
    this.endDrag();
    super.disconnectedCallback();
  }

  override formResetCallback(): void {
    super.formResetCallback();
    if (!this.hasAttribute('value')) this.value = '#000000';
  }

  override get value(): string {
    return super.value;
  }

  override set value(next: string) {
    super.value = next ?? '';
    this.valueNeedsParse = true;
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    // `disabled` can flip (directly, or through an ancestor fieldset) while the panel is already
    // showing; the open-guard in the setter only covers the opening direction.
    if (this.open && this.effectiveDisabled) this.open = false;
    const formatChanged =
      changed.has('format') || changed.has('opacity') || changed.has('uppercase');
    if (!this.valueNeedsParse && !formatChanged) return;
    const shouldReserialize = formatChanged;
    if (this.valueNeedsParse) {
      this.valueNeedsParse = false;
      const parsed = parseColor(super.value);
      if (parsed) {
        this.color = parsed;
        this.writeSerializedValue();
        return;
      }
    }
    // A value that is not a colour keeps whatever string the consumer supplied; only a format
    // change on an already-understood colour re-serializes.
    if (shouldReserialize && parseColor(super.value) !== null) this.writeSerializedValue();
  }

  protected override updated(changed: PropertyValues): void {
    if (changed.has('open')) {
      if (this.open) {
        this.activatePanel();
      } else {
        this.teardownOverlay();
        // An abandoned half-typed entry must not reappear the next time the panel opens.
        this.pendingInput = '';
      }
      // A declaratively-open picker must not announce a transition it never made, and a close
      // driven by disconnection has nowhere to dispatch to.
      if (this.hasRenderedOnce && this.isConnected) this.emit(this.open ? 'lr-show' : 'lr-hide');
    } else if (this.open && (changed.has('placement') || changed.has('size'))) {
      this.positionPanel();
    }
    this.hasRenderedOnce = true;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /** Opens the colour panel. A no-op while the control is effectively disabled. */
  show(): void {
    this.open = true;
  }

  /** Closes the colour panel, returning focus to the trigger. */
  hide(): void {
    this.open = false;
  }

  /** The current colour in any supported format, independent of `format`/`opacity`/`uppercase`. */
  getFormattedValue(format: LyraColorPickerOutputFormat = 'hex'): string {
    return formatColor(this.color, format, this.uppercase);
  }

  override click(): void {
    if (!this.effectiveDisabled) this.triggerEl()?.click();
  }

  override focus(options?: FocusOptions): void {
    this.triggerEl()?.focus(options);
  }

  override blur(): void {
    this.triggerEl()?.blur();
  }

  // -------------------------------------------------------------------------
  // Value plumbing
  // -------------------------------------------------------------------------

  private activeFormat(): LyraColorPickerOutputFormat {
    return withAlphaFormat(this.format, this.opacity);
  }

  /** Writes the serialized colour straight through the mixin's own accessor, deliberately
   *  bypassing this class's `value` setter so it is not re-queued for parsing. */
  private writeSerializedValue(): boolean {
    const serialized = formatColor(this.color, this.activeFormat(), this.uppercase);
    if (serialized === super.value) return false;
    super.value = serialized;
    return true;
  }

  /**
   * Applies a colour change coming from a user interaction, emitting `input`/`lr-change` only when
   * the serialized value actually moves. The working HSVA is compared component-wise rather than by
   * rendered colour, because hue and saturation are still meaningful while the rendered colour
   * cannot change (a fully desaturated or black colour has a hue the sliders must keep tracking);
   * `value` is compared separately, so those moves reposition the handles without announcing an
   * edit that did not happen.
   */
  private applyColor(next: LyraColorHsva): boolean {
    const unchanged =
      next.h === this.color.h &&
      next.s === this.color.s &&
      next.v === this.color.v &&
      next.a === this.color.a;
    if (!unchanged) this.color = next;
    const changed = this.writeSerializedValue();
    if (changed) {
      this.emit('input');
      this.emit('lr-change', { value: this.value });
    }
    return changed;
  }

  /** `applyColor()` plus the committing `change` event a discrete interaction ends with. */
  private commitColor(next: LyraColorHsva): boolean {
    const changed = this.applyColor(next);
    if (changed) this.emit('change');
    return changed;
  }

  private normalizedSwatches(): LyraColorPickerSwatch[] {
    const raw = this.swatches;
    const entries: (string | LyraColorPickerSwatch)[] = Array.isArray(raw)
      ? raw
      : String(raw ?? '').split(';');
    const result: LyraColorPickerSwatch[] = [];
    for (const entry of entries) {
      if (typeof entry === 'string') {
        const color = entry.trim();
        if (color) result.push({ color });
      } else if (entry && typeof entry.color === 'string' && entry.color.trim()) {
        result.push({ color: entry.color.trim(), label: entry.label });
      }
    }
    return result;
  }

  // -------------------------------------------------------------------------
  // Panel lifecycle
  // -------------------------------------------------------------------------

  private triggerEl(): HTMLButtonElement | null {
    return this.renderRoot?.querySelector('[part~="trigger"]') as HTMLButtonElement | null;
  }

  private panelEl(): HTMLElement | null {
    return this.renderRoot?.querySelector('[part~="panel"]') as HTMLElement | null;
  }

  private positionPanel(): void {
    this.cleanupPositioner?.();
    this.cleanupPositioner = undefined;
    const anchor = this.triggerEl();
    const panel = this.panelEl();
    if (!anchor || !panel) return;
    this.cleanupPositioner = place(anchor, panel, {
      placement: rtlAwarePlacement(this.placement, this),
    });
  }

  private activatePanel(): void {
    if (!this.isConnected) return;
    this.positionPanel();
    this.overlayHandle = activateOverlay({
      host: this,
      panel: () => this.panelEl(),
      onEscape: () => this.hide(),
      restoreFocusTo: this.triggerEl(),
      modal: false,
      trapFocus: false,
    });
    this.overlayHandle.focusInitial();
    this.lightDismissDocument = this.ownerDocument;
    this.lightDismissDocument.addEventListener('pointerdown', this.onDocumentPointerDown, true);
  }

  private teardownOverlay(): void {
    this.cleanupPositioner?.();
    this.cleanupPositioner = undefined;
    this.overlayHandle?.deactivate();
    this.overlayHandle = undefined;
    this.lightDismissDocument?.removeEventListener('pointerdown', this.onDocumentPointerDown, true);
    this.lightDismissDocument = undefined;
  }

  private onDocumentPointerDown = (event: Event): void => {
    const target = event.composedPath()[0];
    if (target instanceof Element && composedContains(this, target)) return;
    this.hide();
  };

  private onTriggerClick = (): void => {
    if (this.effectiveDisabled) return;
    this.open = !this.open;
  };

  // -------------------------------------------------------------------------
  // Pointer interaction
  // -------------------------------------------------------------------------

  private beginDrag(event: PointerEvent, track: 'grid' | 'hue' | 'alpha', box: HTMLElement): void {
    if (this.effectiveDisabled) return;
    const rect = box.getBoundingClientRect();
    this.drag = { pointerId: event.pointerId, track, rect, rtl: isRtl(this) };
    this.dragChanged = false;
    try {
      box.setPointerCapture(event.pointerId);
    } catch {
      // A synthetic or already-released pointer has no capture to take; the window-level
      // listeners below still track the gesture, so this is not worth failing the interaction over.
    }
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerCancel);
    window.addEventListener('lostpointercapture', this.onPointerCancel);
    this.applyPointer(event);
  }

  private applyPointer(event: PointerEvent): void {
    const drag = this.drag;
    if (!drag) return;
    const { rect, rtl, track } = drag;
    const rawX = rect.width === 0 ? 0 : (event.clientX - rect.left) / rect.width;
    const ratioX = finiteRange(rtl ? 1 - rawX : rawX, 0, 0, 1);
    let next: LyraColorHsva;
    if (track === 'grid') {
      const rawY = rect.height === 0 ? 0 : (event.clientY - rect.top) / rect.height;
      const ratioY = finiteRange(rawY, 0, 0, 1);
      next = hsva(this.color.h, ratioX * 100, (1 - ratioY) * 100, this.color.a);
    } else if (track === 'hue') {
      next = hsva(ratioX * 360, this.color.s, this.color.v, this.color.a);
    } else {
      next = hsva(this.color.h, this.color.s, this.color.v, ratioX);
    }
    this.dragChanged = this.applyColor(next) || this.dragChanged;
  }

  private onPointerMove = (event: PointerEvent): void => {
    if (this.drag?.pointerId !== event.pointerId) return;
    if (this.effectiveDisabled) {
      // These window-level listeners keep firing for a captured pointer regardless of the
      // `disabled` reflection, so an in-flight drag would otherwise keep mutating `value`.
      this.endDrag();
      return;
    }
    this.applyPointer(event);
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (this.drag?.pointerId !== event.pointerId) return;
    this.applyPointer(event);
    const changed = this.dragChanged;
    this.endDrag();
    if (changed) this.emit('change');
  };

  // A gesture can end without a pointerup: touch-scroll takeover and palm rejection fire
  // pointercancel, and losing capture fires lostpointercapture. Both end the drag with no commit.
  private onPointerCancel = (event: PointerEvent): void => {
    if (this.drag?.pointerId !== event.pointerId) return;
    this.endDrag();
  };

  private endDrag(): void {
    this.drag = undefined;
    this.dragChanged = false;
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerCancel);
    window.removeEventListener('lostpointercapture', this.onPointerCancel);
  }

  // -------------------------------------------------------------------------
  // Keyboard interaction
  // -------------------------------------------------------------------------

  /** Resolves an arrow key to a signed step along the inline axis, honouring text direction. */
  private inlineStep(event: KeyboardEvent): number | null {
    const rtl = isRtl(this);
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
    const backward = rtl ? 'ArrowRight' : 'ArrowLeft';
    const step = SMALL_STEP * (event.shiftKey ? LARGE_STEP_MULTIPLIER : 1);
    if (event.key === forward) return step;
    if (event.key === backward) return -step;
    return null;
  }

  private onGridKeyDown = (event: KeyboardEvent): void => {
    if (this.effectiveDisabled) return;
    const step = SMALL_STEP * (event.shiftKey ? LARGE_STEP_MULTIPLIER : 1);
    const inline = this.inlineStep(event);
    let next: LyraColorHsva | undefined;
    if (inline !== null) next = hsva(this.color.h, this.color.s + inline, this.color.v, this.color.a);
    else if (event.key === 'ArrowUp') next = hsva(this.color.h, this.color.s, this.color.v + step, this.color.a);
    else if (event.key === 'ArrowDown') next = hsva(this.color.h, this.color.s, this.color.v - step, this.color.a);
    else if (event.key === 'Home') next = hsva(this.color.h, 0, this.color.v, this.color.a);
    else if (event.key === 'End') next = hsva(this.color.h, 100, this.color.v, this.color.a);
    if (!next) return;
    event.preventDefault();
    this.keyboardChanged = this.applyColor(next) || this.keyboardChanged;
  };

  private onHueKeyDown = (event: KeyboardEvent): void => {
    if (this.effectiveDisabled) return;
    const step = SMALL_STEP * (event.shiftKey ? LARGE_STEP_MULTIPLIER : 1);
    const inline = this.inlineStep(event);
    let hue: number | undefined;
    if (inline !== null) hue = this.color.h + inline;
    else if (event.key === 'ArrowUp') hue = this.color.h + step;
    else if (event.key === 'ArrowDown') hue = this.color.h - step;
    else if (event.key === 'Home') hue = 0;
    else if (event.key === 'End') hue = 360;
    if (hue === undefined) return;
    event.preventDefault();
    this.keyboardChanged =
      this.applyColor(hsva(finiteRange(hue, 0, 0, 360), this.color.s, this.color.v, this.color.a)) ||
      this.keyboardChanged;
  };

  private onAlphaKeyDown = (event: KeyboardEvent): void => {
    if (this.effectiveDisabled) return;
    const step = (SMALL_STEP * (event.shiftKey ? LARGE_STEP_MULTIPLIER : 1)) / 100;
    const inline = this.inlineStep(event);
    let alpha: number | undefined;
    if (inline !== null) alpha = this.color.a + inline / 100;
    else if (event.key === 'ArrowUp') alpha = this.color.a + step;
    else if (event.key === 'ArrowDown') alpha = this.color.a - step;
    else if (event.key === 'Home') alpha = 0;
    else if (event.key === 'End') alpha = 1;
    if (alpha === undefined) return;
    event.preventDefault();
    this.keyboardChanged =
      this.applyColor(hsva(this.color.h, this.color.s, this.color.v, alpha)) || this.keyboardChanged;
  };

  /** One discrete press pairs a keydown (`input`) with a keyup (`change`); OS key repeat re-fires
   *  keydown but still commits only once, matching a pointer drag's shape. */
  private onControlKeyUp = (): void => {
    if (!this.keyboardChanged) return;
    this.keyboardChanged = false;
    this.emit('change');
  };

  // -------------------------------------------------------------------------
  // Field / palette / eyedropper
  // -------------------------------------------------------------------------

  private onFieldInput = (event: Event): void => {
    this.pendingInput = (event.target as HTMLInputElement).value;
  };

  private onFieldChange = (event: Event): void => {
    event.stopPropagation();
    const field = event.target as HTMLInputElement;
    const parsed = parseColor(field.value);
    if (parsed) this.commitColor(parsed);
    this.pendingInput = '';
    this.requestUpdate();
  };

  private onFieldKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    this.onFieldChange(event);
  };

  private onSwatchClick(swatch: LyraColorPickerSwatch): void {
    const parsed = parseColor(swatch.color);
    if (!parsed) return;
    this.commitColor(this.opacity ? parsed : hsva(parsed.h, parsed.s, parsed.v, 1));
  }

  private onFormatClick = (): void => {
    const index = FORMAT_CYCLE.indexOf(this.format);
    this.format = FORMAT_CYCLE[(index + 1) % FORMAT_CYCLE.length]!;
  };

  private onEyeDropperClick = (): void => {
    const Constructor = eyeDropperConstructor();
    if (!Constructor || this.effectiveDisabled) return;
    void new Constructor()
      .open()
      .then((result) => {
        const parsed = parseColor(result?.sRGBHex ?? '');
        if (parsed) this.commitColor(this.opacity ? hsva(parsed.h, parsed.s, parsed.v, this.color.a) : parsed);
      })
      // Dismissing the eyedropper rejects; that is a cancellation, not an error worth surfacing.
      .catch(() => undefined);
  };

  private onTriggerFocus = (): void => {
    this.emit('focus');
  };

  private onTriggerBlur = (): void => {
    this.emit('blur');
  };

  private onSlotChange = (event: Event): void => {
    const slot = event.target as HTMLSlotElement;
    const assigned = slot.assignedElements({ flatten: true }).length > 0;
    if (slot.name === 'label') this.hasLabel = assigned;
    if (slot.name === 'hint') this.hasHint = assigned;
    if (slot.name === 'error') this.hasError = assigned;
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  private formatNumber(value: number): string {
    return getNumberFormat(this.effectiveLocale, { maximumFractionDigits: 0 }).format(value);
  }

  private renderGrid(): TemplateResult {
    const saturation = Math.round(this.color.s);
    const brightness = Math.round(this.color.v);
    return html`<div
      part="grid"
      style=${styleMap({ '--lr-color-picker-grid-hue': cssColor(hsva(this.color.h, 100, 100, 1)) })}
      @pointerdown=${(event: PointerEvent) => this.beginDrag(event, 'grid', event.currentTarget as HTMLElement)}
    >
      <!-- hit-area-exempt: the pointer target is the whole grid box, which is far larger than the
           40px floor; this handle is the visual thumb drawn at the current point and is reached by
           keyboard through its own role="slider" contract. -->
      <div
        part="grid-handle"
        role="slider"
        tabindex=${this.effectiveDisabled ? '-1' : '0'}
        aria-label=${this.localize('colorPickerSaturationBrightness')}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow=${saturation}
        aria-valuetext=${this.localize('colorPickerSaturationBrightnessValue', undefined, {
          saturation: this.formatNumber(saturation),
          brightness: this.formatNumber(brightness),
        })}
        aria-disabled=${this.effectiveDisabled ? 'true' : 'false'}
        style=${styleMap({
          insetInlineStart: `${saturation}%`,
          insetBlockStart: `${100 - brightness}%`,
        })}
        @keydown=${this.onGridKeyDown}
        @keyup=${this.onControlKeyUp}
      ></div>
    </div>`;
  }

  private renderHueSlider(): TemplateResult {
    const hue = Math.round(this.color.h);
    return html`<div
      part="slider hue-slider"
      @pointerdown=${(event: PointerEvent) => this.beginDrag(event, 'hue', event.currentTarget as HTMLElement)}
    >
      <!-- hit-area-exempt: the pointer target is the full-width slider track; the handle is its
           visual thumb, keyboard-reachable through its own role="slider" contract. -->
      <div
        part="slider-handle hue-slider-handle"
        role="slider"
        tabindex=${this.effectiveDisabled ? '-1' : '0'}
        aria-label=${this.localize('colorPickerHue')}
        aria-valuemin="0"
        aria-valuemax="360"
        aria-valuenow=${hue}
        aria-valuetext=${this.localize('colorPickerHueValue', undefined, { hue: this.formatNumber(hue) })}
        aria-disabled=${this.effectiveDisabled ? 'true' : 'false'}
        style=${styleMap({
          insetInlineStart: `${(hue / 360) * 100}%`,
          '--lr-color-picker-swatch-color': cssColor(this.color),
        })}
        @keydown=${this.onHueKeyDown}
        @keyup=${this.onControlKeyUp}
      ></div>
    </div>`;
  }

  private renderOpacitySlider(): TemplateResult {
    const percent = Math.round(this.color.a * 100);
    const opaque = cssColor(hsva(this.color.h, this.color.s, this.color.v, 1));
    const clear = cssColor(hsva(this.color.h, this.color.s, this.color.v, 0));
    const toEnd = this.effectiveDirection === 'rtl' ? 'left' : 'right';
    return html`<div
      part="slider opacity-slider"
      style=${styleMap({
        '--lr-color-picker-opacity-gradient': `linear-gradient(to ${toEnd}, ${clear}, ${opaque})`,
      })}
      @pointerdown=${(event: PointerEvent) => this.beginDrag(event, 'alpha', event.currentTarget as HTMLElement)}
    >
      <!-- hit-area-exempt: same track-versus-thumb split as the hue slider above. -->
      <div
        part="slider-handle opacity-slider-handle"
        role="slider"
        tabindex=${this.effectiveDisabled ? '-1' : '0'}
        aria-label=${this.localize('colorPickerOpacity')}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow=${percent}
        aria-valuetext=${this.localize('colorPickerOpacityValue', undefined, {
          opacity: this.formatNumber(percent),
        })}
        aria-disabled=${this.effectiveDisabled ? 'true' : 'false'}
        style=${styleMap({
          insetInlineStart: `${percent}%`,
          '--lr-color-picker-swatch-color': cssColor(this.color),
        })}
        @keydown=${this.onAlphaKeyDown}
        @keyup=${this.onControlKeyUp}
      ></div>
    </div>`;
  }

  private renderSwatches(entries: LyraColorPickerSwatch[]): TemplateResult {
    return html`<div part="swatches" role="group" aria-label=${this.localize('colorPickerSwatches')}>
      ${entries.map((entry) => {
        const parsed = parseColor(entry.color);
        const selected = parsed !== null && sameColor(parsed, this.color);
        const part = selected ? 'swatch swatch-selected' : 'swatch';
        const name = entry.label ?? this.localize('colorPickerSwatch', undefined, { color: entry.color });
        return html`
          <!-- hit-area-exempt: palette swatches are 24px targets separated by at least 4px, so
               adjacent centres stay 28px apart -- WCAG 2.5.8's target-spacing exception. -->
          <button
            type="button"
            part=${part}
            aria-pressed=${selected ? 'true' : 'false'}
            aria-label=${name}
            ?disabled=${this.effectiveDisabled}
            style=${styleMap(parsed ? { '--lr-color-picker-swatch-color': cssColor(parsed) } : {})}
            @click=${() => this.onSwatchClick(entry)}
          ></button>
        `;
      })}
    </div>`;
  }

  private renderPanel(name: string): TemplateResult {
    const entries = this.normalizedSwatches();
    const fieldValue = this.pendingInput || this.getFormattedValue(this.activeFormat());
    return html`<div
      id=${this.panelId}
      part="panel"
      role="dialog"
      aria-label=${name}
      ?hidden=${!this.open}
    >
      ${this.renderGrid()}
      <div class="row">
        <div
          part="preview"
          aria-hidden="true"
          style=${styleMap({ '--lr-color-picker-swatch-color': cssColor(this.color) })}
        ></div>
        <div class="sliders">${this.renderHueSlider()}${this.opacity ? this.renderOpacitySlider() : nothing}</div>
      </div>
      <div class="row">
        <input
          part="input"
          type="text"
          spellcheck="false"
          autocapitalize="off"
          autocomplete="off"
          .value=${fieldValue}
          aria-label=${this.localize('colorPickerValueField')}
          ?disabled=${this.effectiveDisabled}
          @input=${this.onFieldInput}
          @change=${this.onFieldChange}
          @keydown=${this.onFieldKeyDown}
        />
        ${this.withoutFormatToggle
          ? nothing
          : html`<button
              type="button"
              part="format-button"
              aria-label=${this.localize('colorPickerToggleFormat')}
              ?disabled=${this.effectiveDisabled}
              @click=${this.onFormatClick}
            >${this.activeFormat().toUpperCase()}</button>`}
        ${this.hasEyeDropper
          ? html`<button
              type="button"
              part="eyedropper-button"
              aria-label=${this.localize('colorPickerEyeDropper')}
              ?disabled=${this.effectiveDisabled}
              @click=${this.onEyeDropperClick}
            >${eyeIcon()}</button>`
          : nothing}
      </div>
      ${entries.length > 0 ? this.renderSwatches(entries) : nothing}
    </div>`;
  }

  override render(): TemplateResult {
    const hasLabel = this.hasLabel || Boolean(this.label);
    const hasHint = this.hasHint || Boolean(this.hint);
    const hasError = this.hasError || Boolean(this.errorText);
    const name = this.accessibleLabel || this.label || this.localize('colorPicker');
    const describedBy = [
      hasError ? this.errorId : '',
      hasHint ? this.hintId : '',
      this.valueTextId,
    ]
      .filter(Boolean)
      .join(' ');
    return html`<div part="form-control">
      <label part="label form-control-label" for=${this.triggerId} ?hidden=${!hasLabel}
        >${this.label}<slot name="label" @slotchange=${this.onSlotChange}></slot
      ></label>
      <div part="trigger-container">
        <button
          id=${this.triggerId}
          type="button"
          part="trigger"
          aria-label=${name}
          aria-haspopup="dialog"
          aria-expanded=${this.open ? 'true' : 'false'}
          aria-controls=${this.panelId}
          aria-describedby=${describedBy}
          aria-required=${this.required ? 'true' : 'false'}
          ?disabled=${this.effectiveDisabled}
          style=${styleMap({ '--lr-color-picker-swatch-color': cssColor(this.color) })}
          @click=${this.onTriggerClick}
          @focus=${this.onTriggerFocus}
          @blur=${this.onTriggerBlur}
        ></button>
      </div>
      <span id=${this.valueTextId} class="sr-only"
        >${this.localize('colorPickerCurrentValue', undefined, { color: this.value })}</span
      >
      ${this.renderPanel(name)}
      <div id=${this.errorId} part="error" ?hidden=${!hasError}
        >${this.errorText}<slot name="error" @slotchange=${this.onSlotChange}></slot
      ></div>
      <div id=${this.hintId} part="hint" ?hidden=${!hasHint}
        >${this.hint}<slot name="hint" @slotchange=${this.onSlotChange}></slot
      ></div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-color-picker': LyraColorPicker;
  }
}

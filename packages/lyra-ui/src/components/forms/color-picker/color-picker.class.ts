import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import type { Placement } from '@floating-ui/dom';
import { LyraElement } from '../../../internal/lyra-element.js';
import { FormAssociated } from '../../../internal/form-associated.js';
import { hostAriaLabel, nextId, srOnly } from '../../../internal/a11y.js';
import { place } from '../../../internal/positioner.js';
import { isRtl, rtlAwarePlacement } from '../../../internal/rtl.js';
import { activateOverlay, composedContains, type OverlayHandle } from '../../../internal/overlay-manager.js';
import { relayNativeEvent } from '../../../internal/native-event-relay.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { finiteRange } from '../../../internal/numbers.js';
import { eyeIcon } from '../../../internal/icons.js';
import { dispatchNativeEvent, dispatchNativeInputEvent } from '../../../internal/native-event-relay.js';
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
import type { LyraSize } from '../../../internal/variants.js';
import { styles } from './color-picker.styles.js';
import { currentValidityValidator, type LyraFormValidator } from '../form-validator.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_colorPicker, LYRA_DEFAULT_colorPickerCurrentValue, LYRA_DEFAULT_colorPickerEyeDropper, LYRA_DEFAULT_colorPickerHue, LYRA_DEFAULT_colorPickerHueValue, LYRA_DEFAULT_colorPickerOpacity, LYRA_DEFAULT_colorPickerOpacityValue, LYRA_DEFAULT_colorPickerSaturationBrightness, LYRA_DEFAULT_colorPickerSaturationBrightnessValue, LYRA_DEFAULT_colorPickerSwatch, LYRA_DEFAULT_colorPickerSwatches, LYRA_DEFAULT_colorPickerToggleFormat, LYRA_DEFAULT_colorPickerValueField, LYRA_DEFAULT_fieldRequired } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type {
  LyraColorHsva,
  LyraColorPickerFormat,
  LyraColorPickerOutputFormat,
} from './color-core.js';

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

interface ColorPickerDrag {
  pointerId: number;
  track: 'grid' | 'hue' | 'alpha';
  rect: DOMRect;
  rtl: boolean;
  startColor: LyraColorHsva;
  startValue: { readonly value: string; readonly dirty: boolean };
}

function eyeDropperConstructor(ownerWindow: Window | null): EyeDropperConstructor | undefined {
  return (ownerWindow as (Window & { EyeDropper?: EyeDropperConstructor }) | null)?.EyeDropper;
}

function isNodeValue(value: unknown): value is Node {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as Partial<Node> & { nodeType?: number };
  return typeof candidate.nodeType === 'number' && typeof candidate.getRootNode === 'function';
}

function isElementValue(value: unknown): value is Element {
  if (!isNodeValue(value) || value.nodeType !== 1) return false;
  return typeof (value as Partial<Element>).matches === 'function';
}

export interface LyraColorPickerEventMap {
  'lr-invalid': CustomEvent<null>;
  'lr-input': CustomEvent<null>;
  input: InputEvent;
  change: Event;
  blur: FocusEvent;
  focus: FocusEvent;
  'lr-change': CustomEvent<{ value: string }>;
  'lr-show': CustomEvent<null>;
  'lr-after-show': CustomEvent<null>;
  'lr-hide': CustomEvent<null>;
  'lr-after-hide': CustomEvent<null>;
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
 * Pointer drags are reversible previews: a release commits the latest colour, while cancellation,
 * lost capture, disablement, disconnection, or document adoption silently restores the colour and
 * submitted form value that existed before the gesture.
 * The popup participates in the shared nonmodal overlay stack, so Escape and an outside pointer
 * dismiss it only while it is topmost; closing a newer overlay hands focus back through the
 * manager instead of collapsing every open popup under the same event.
 *
 * @customElement lr-color-picker
 * @slot label - Custom label content.
 * @slot hint - Supporting text.
 * @slot error - Custom validation-error content.
 * @event {InputEvent} input - Native-style composed event, fired for every colour preview during an interaction.
 *   Canceling a pointer gesture silently restores its pre-gesture value without another event.
 * @event {Event} change - Native-style composed event, fired once an interaction commits (pointer release,
 *   key release, swatch click, text entry, eyedropper result).
 * @event lr-change - Shoelace-compatible commit alias carrying the newly serialized value;
 *   emitted alongside the native `change` event.
 * @event lr-input - Shoelace-compatible edit alias, emitted alongside each native `input` event.
 * @event lr-show - The colour panel is about to open, however `open` became true. Cancelable —
 *   `preventDefault()` leaves it closed. Initial markup, disconnect cleanup, and a close forced
 *   by disablement apply without emitting this request event.
 * @event {CustomEvent<null>} lr-after-show - The colour panel finished opening. There is no animated
 *   delay, so it follows `lr-show` in the same completed update.
 * @event lr-hide - The colour panel is about to close. Cancelable on the same terms as
 *   `lr-show`.
 * @event {CustomEvent<null>} lr-after-hide - The colour panel finished closing; follows `lr-hide` in the
 *   same update.
 * @event {FocusEvent} focus - Native-constructor relay when focus enters an internal control;
 *   bubbling and composed across the shadow boundary.
 * @event {FocusEvent} blur - Native-constructor relay when focus leaves the internal controls.
 * @event lr-invalid - The color picker failed a validity check; cancelable. Calling
 *   `preventDefault()` also cancels the native `invalid` event it aliases, suppressing the
 *   browser's own validation bubble and `reportValidity()`'s focus/scroll.
 * @method show - `show(): void` — opens the popup unless disabled; inline visibility is unchanged.
 * @method hide - `hide(): void` — closes the popup and returns focus to the trigger; inline
 *   visibility is unchanged.
 * @method getFormattedValue - `getFormattedValue(format?: LyraColorPickerOutputFormat): string` —
 *   the current colour in any of the eight supported formats, independent of `format`/`opacity`.
 * @method getHexString - `getHexString(hue, saturation, brightness, alpha?): string` — converts
 *   percent-scaled HSV(A) channels to a hex string; `alpha` defaults to 100.
 * @csspart base - Permanent compatibility name on the same field wrapper as `color-picker`.
 * @csspart color-picker - The field wrapper. It is the same node as `base` and `form-control`.
 * @csspart form-control - The field wrapper. It is the same node as `base` and `color-picker`.
 * @csspart form-control-label - The label. It also carries the `label` compatibility name.
 * @csspart label - Permanent compatibility name on the same label as `form-control-label`.
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
 * @csspart format-button__base - Alias for the format button's interactive base.
 * @csspart format-button__start - Web Awesome start-adornment container.
 * @csspart format-button__prefix - Shoelace alias for `format-button__start`.
 * @csspart format-button__label - The visible format abbreviation.
 * @csspart format-button__end - Web Awesome end-adornment container.
 * @csspart format-button__suffix - Shoelace alias for `format-button__end`.
 * @csspart format-button__caret - Reserved caret container.
 * @csspart eyedropper-button - The screen-eyedropper button, rendered only where the EyeDropper API
 *   exists.
 * @csspart eye-dropper-button - Shoelace alias for `eyedropper-button`.
 * @csspart eyedropper-button__base - Web Awesome alias for the eyedropper button's base.
 * @csspart eye-dropper-button__base - Shoelace alias for the eyedropper button's base.
 * @csspart eyedropper-button__start - Web Awesome start-adornment container.
 * @csspart eye-dropper-button__prefix - Shoelace alias for `eyedropper-button__start`.
 * @csspart eyedropper-button__label - The localized, visually hidden button label.
 * @csspart eye-dropper-button__label - Shoelace alias for `eyedropper-button__label`.
 * @csspart eyedropper-button__end - Web Awesome end-adornment container.
 * @csspart eye-dropper-button__suffix - Shoelace alias for `eyedropper-button__end`.
 * @csspart eyedropper-button__caret - Reserved caret container.
 * @csspart eye-dropper-button__caret - Shoelace alias for `eyedropper-button__caret`.
 * @csspart swatches - The predefined-palette container, rendered only when `swatches` is non-empty.
 * @csspart swatch - A single palette swatch. The active one is `[part~='swatch-selected']`.
 * @csspart swatch-selected - Token added to the swatch matching the current value.
 * @csspart hint - Supporting text.
 * @csspart error - The validation message.
 * @cssprop [--lr-color-picker-swatch-size=var(--lr-form-control-height,var(--lr-size-2-5rem))] -
 *   The centered visible swatch's inline and block size. The interactive trigger stays at least
 *   `--lr-icon-button-size`; larger swatch tiers expand it. The value reads the shared
 *   form-control height ladder, so the visible swatch follows neighbouring field density.
 * @cssprop [--lr-color-picker-gap=var(--lr-space-xs)] - Gap between field chrome and panel rows.
 * @cssprop [--lr-color-picker-radius=var(--lr-radius)] - Trigger, grid, and panel corner radius.
 * @cssprop [--lr-color-picker-hover-border-color=var(--lr-color-brand)] - Hover border color.
 * @cssprop [--lr-color-picker-selected-border=var(--lr-color-brand)] - Border of the selected
 * palette swatch.
 * @cssprop [--lr-color-picker-selected-check-color=var(--lr-color-surface)] - Checkmark color on
 * the selected palette swatch.
 * @cssprop [--lr-color-picker-grid-inline-size=var(--lr-size-15rem)] - Saturation/brightness grid width.
 * @cssprop [--lr-color-picker-grid-block-size=var(--lr-size-8rem)] - Saturation/brightness grid height.
 * @cssprop [--lr-color-picker-grid-handle-size=var(--lr-size-1rem)] - Diameter of the grid handle.
 * @cssprop [--lr-color-picker-slider-block-size=var(--lr-size-0-75rem)] - Thickness of the visible
 *   hue/opacity ramp. The slider's own pointer target stays floored at 24px regardless.
 * @cssprop [--lr-color-picker-slider-handle-size=var(--lr-size-1-25rem)] - Diameter of a slider handle.
 * @cssprop [--lr-color-picker-palette-swatch-size=var(--lr-size-1-5rem)] - Size of a palette swatch.
 * @cssprop --grid-width - Upstream alias for `--lr-color-picker-grid-inline-size`.
 * @cssprop --grid-height - Upstream alias for `--lr-color-picker-grid-block-size`.
 * @cssprop --grid-handle-size - Upstream alias for `--lr-color-picker-grid-handle-size`.
 * @cssprop --slider-height - Upstream alias for `--lr-color-picker-slider-block-size`.
 * @cssprop --slider-handle-size - Upstream alias for `--lr-color-picker-slider-handle-size`.
 * @cssprop --swatch-size - Shoelace alias for `--lr-color-picker-palette-swatch-size`.
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
 * @cssprop [--lr-form-control-required-content=' *'] - The required-field marker rendered after the
 * label. Set it to `''` to suppress the marker, or to any other quoted string (`' (required)'`, a
 * localized word) to replace it. Caller-supplied content, so it is never localized here.
 * @cssprop [--lr-form-control-required-color=var(--lr-color-danger)] - Color of that marker,
 * retunable without touching any other danger-coloured surface.
 * @cssprop [--lr-form-control-required-offset=0] - Inline space between the label text and the
 * marker.
 * @status stable
 * @since 4.0.0
 */
export class LyraColorPicker extends FormAssociated(ColorPickerBase) {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    colorPicker: LYRA_DEFAULT_colorPicker,
    colorPickerCurrentValue: LYRA_DEFAULT_colorPickerCurrentValue,
    colorPickerEyeDropper: LYRA_DEFAULT_colorPickerEyeDropper,
    colorPickerHue: LYRA_DEFAULT_colorPickerHue,
    colorPickerHueValue: LYRA_DEFAULT_colorPickerHueValue,
    colorPickerOpacity: LYRA_DEFAULT_colorPickerOpacity,
    colorPickerOpacityValue: LYRA_DEFAULT_colorPickerOpacityValue,
    colorPickerSaturationBrightness: LYRA_DEFAULT_colorPickerSaturationBrightness,
    colorPickerSaturationBrightnessValue: LYRA_DEFAULT_colorPickerSaturationBrightnessValue,
    colorPickerSwatch: LYRA_DEFAULT_colorPickerSwatch,
    colorPickerSwatches: LYRA_DEFAULT_colorPickerSwatches,
    colorPickerToggleFormat: LYRA_DEFAULT_colorPickerToggleFormat,
    colorPickerValueField: LYRA_DEFAULT_colorPickerValueField,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  /** Public WA-compatible intrinsic validator catalog. */
  static get validators(): LyraFormValidator<LyraColorPicker>[] {
    return [currentValidityValidator('required', 'disabled', 'value')];
  }
  static override styles = [LyraElement.styles, srOnly, sizes, styles];

  @property() label = '';
  @property() hint = '';
  /** Server-rendering hint that the `label` slot is populated before client slot observation. */
  @property({ type: Boolean, attribute: 'with-label', reflect: true }) withLabel = false;
  /** Server-rendering hint that the `hint` slot is populated before client slot observation. */
  @property({ type: Boolean, attribute: 'with-hint', reflect: true }) withHint = false;
  @property({ attribute: 'error-text' }) errorText = '';
  @property({ attribute: 'aria-label' }) accessibleLabel = '';
  /** Visible-swatch size — the library-wide `2xs`–`xl` ladder shared with `lr-input`/`lr-select`.
   *  The interactive trigger retains the shared `--lr-icon-button-size` minimum target even when
   *  the visible swatch is denser. The Web Awesome / Shoelace spellings `small`/`medium`/`large`
   *  are accepted for `s`/`m`/`l`, so a migration is a tag rename with no attribute rewrite. */
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
  /** Shoelace spelling for `withoutFormatToggle`; either property removes the same button. */
  @property({ type: Boolean, attribute: 'no-format-toggle', reflect: true }) noFormatToggle = false;
  /** Renders the full picker panel in normal flow instead of behind a popup trigger. */
  @property({ type: Boolean, reflect: true }) inline = false;
  /** Uses fixed popup positioning to escape clipping ancestors. The default absolute strategy
   *  keeps the popup in the component's local scrolling context. */
  @property({ type: Boolean, reflect: true }) hoist = false;

  /** Preferred panel placement; the resolved side still flips to stay in the viewport. */
  @property({ reflect: true }) placement: Placement = 'bottom-start';

  private _open = false;
  /** Whether the popup panel is open. The panel remains visible in `inline` mode. */
  @property({ type: Boolean, reflect: true })
  get open(): boolean {
    return this._open;
  }
  set open(next: boolean) {
    const normalized = Boolean(next) && !this.effectiveDisabled;
    if (normalized === this._open) return;
    // The veto point sits in the setter because the setter is the one funnel every path uses --
    // `show()`/`hide()`, the trigger toggle, a direct `el.open = true`, and the reflected
    // attribute all land here, and here the transition has not happened yet. Three paths are
    // deliberately not vetoable: initial declarative markup (no transition to veto), a disconnect
    // (the element is already gone), and a disablement-forced close (a disabled control must not
    // be held open by a listener).
    if (this.forcedOpenChange || !this.hasRenderedOnce || !this.isConnected) {
      this.applyOpenState(normalized);
      return;
    }
    if (this.emit(normalized ? 'lr-show' : 'lr-hide', null, { cancelable: true }).defaultPrevented) {
      // A veto reached through the reflected attribute would otherwise leave `open` present on an
      // element whose property says closed.
      this.toggleAttribute('open', this._open);
      return;
    }
    this.applyOpenState(normalized);
  }

  private applyOpenState(next: boolean): void {
    const old = this._open;
    this._open = next;
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
  private labelId = nextId('color-picker-label');
  private valueTextId = nextId('color-picker-value');
  private triggerId = nextId('color-picker-trigger');
  private panelId = nextId('color-picker-panel');

  /** Which control a pointer drag is currently steering, plus the box it maps onto. */
  private drag?: ColorPickerDrag;
  /** Exact realm carrying the active drag listeners, retained across adoption for symmetric cleanup. */
  private dragWindow?: Window;
  private dragChanged = false;
  private keyboardChanged = false;
  private cleanupPositioner?: () => void;
  private overlayHandle?: OverlayHandle;
  private restoreFocusOnClose = true;
  private lightDismissDocument?: Document;
  private eyeDropperAbort?: AbortController;
  private eyeDropperGeneration = 0;
  private suppressDisconnectedClose = false;
  /** Set while a close is imposed by disablement, which no listener may veto. */
  private forcedOpenChange = false;
  private interactionGeneration = 0;
  private hasRenderedOnce = false;

  constructor() {
    super();
    // FormAssociated registers its focusout interaction marker in its own constructor, before
    // this listener. Requesting here therefore projects the newly-synced user-invalid state in
    // the next render; the internal blur listener runs too early because blur precedes focusout.
    this.addEventListener('focusout', () => this.requestUpdate());
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // Seed from the light-DOM children directly, before the first render -- the slots'
    // @slotchange handler (onSlotChange below) only fires once the shadow DOM has committed its
    // first <slot> elements, so relying on it alone rendered label/hint/error chrome `hidden` on
    // the very first paint for a color picker mounted with declarative slotted content, only
    // revealing it on the following render. Mirrors lr-checkbox-group's identical fix.
    const seedEnvironmentState = (): void => {
      const hasSlot = (name: string): boolean =>
        Array.from(this.children ?? []).some((el) => el.getAttribute('slot') === name);
      this.hasLabel = hasSlot('label');
      this.hasHint = hasSlot('hint');
      this.hasError = hasSlot('error');
      // A server renderer has neither those children nor an `EyeDropper` constructor, so on a
      // hydrating mount this runs one update after the render it would otherwise contradict.
      this.hasEyeDropper = eyeDropperConstructor(this.ownerDocument.defaultView) !== undefined;
    };
    if (this.hasUpdated) seedEnvironmentState();
    else this.seedFirstRenderState(seedEnvironmentState);
  }

  override disconnectedCallback(): void {
    // A disconnect/reconnect cycle (drag-and-drop reparenting, a virtualized list reordering)
    // otherwise leaves the panel rendered open at a stale, frozen position. Assigned through the
    // setter so the reflected `open` attribute is cleared too, then torn down immediately rather
    // than waiting for the scheduled update.
    this.suppressDisconnectedClose = this.open;
    this.open = false;
    this.teardownOverlay(false);
    this.cancelEyeDropper();
    this.interactionGeneration += 1;
    this.keyboardChanged = false;
    this.cancelDrag();
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    // Adoption can occur while already disconnected, in which case no new disconnected callback
    // runs. Defensively retire resources retained from the previous realm either way.
    this.cancelDrag();
    this.cancelEyeDropper();
  }

  override get value(): string {
    return super.value;
  }

  override set value(next: string | null) {
    // A consumer assignment is authoritative. Retire any pointer transaction without restoring
    // its older checkpoint, or a later capture-loss event could overwrite the assigned value.
    this.endDrag();
    super.value = next ?? '';
    this.valueNeedsParse = true;
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    const formatChanged =
      changed.has('format') || changed.has('opacity') || changed.has('uppercase');
    if (formatChanged) this.cancelDrag();
    // `disabled` can flip (directly, or through an ancestor fieldset) while the panel is already
    // showing; the open-guard in the setter only covers the opening direction.
    if (this.effectiveDisabled) {
      if (this.open) {
        this.forcedOpenChange = true;
        try {
          this.open = false;
        } finally {
          this.forcedOpenChange = false;
        }
      }
      this.keyboardChanged = false;
      this.cancelDrag();
    }
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
    super.updated(changed);
    if (changed.has('open')) {
      const suppressClose = this.suppressDisconnectedClose && !this.open;
      this.suppressDisconnectedClose = false;
      if (this.open && !this.inline) {
        this.activatePanel();
      } else {
        this.teardownOverlay(this.restoreFocusOnClose);
        // An abandoned half-typed entry must not reappear the next time the panel opens.
        this.pendingInput = '';
      }
      // A declaratively-open picker must not announce a transition it never made, and a close
      // driven by disconnection has nowhere to dispatch to.
      // `lr-show`/`lr-hide` already fired from the `open` setter, one step earlier, so a listener
      // can still veto the transition; only the settled notifications remain here.
      if (this.hasRenderedOnce && this.isConnected && !suppressClose) {
        this.emit(this.open ? 'lr-after-show' : 'lr-after-hide');
      }
    } else if (changed.has('inline')) {
      if (this.inline) {
        this.teardownOverlay();
        this.panelEl()?.style.removeProperty('position');
      } else if (this.open) {
        this.activatePanel();
      }
    } else if (
      this.open &&
      !this.inline &&
      (changed.has('placement') || changed.has('size') || changed.has('hoist'))
    ) {
      this.positionPanel();
    }
    this.hasRenderedOnce = true;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /** Opens the popup panel. A no-op while disabled; inline visibility is unchanged. */
  show(): void {
    this.open = true;
  }

  /** Closes the popup panel, returning focus to its trigger; inline visibility is unchanged. */
  hide(): void {
    this.open = false;
  }

  /** The current colour in any supported format, independent of `format`/`opacity`/`uppercase`. */
  getFormattedValue(
    format: 'hex' | 'hexa' | 'rgb' | 'rgba' | 'hsl' | 'hsla' | 'hsv' | 'hsva' = 'hex',
  ): string {
    return formatColor(this.color, format, this.uppercase);
  }

  /** Generates a hex string from HSV percentages. `alpha` is also percent-scaled and omitted from
   *  the result at 100, matching ordinary six-digit hex notation. */
  getHexString(hue: number, saturation: number, brightness: number, alpha: number = 100): string {
    const normalizedAlpha = finiteRange(alpha, 100, 0, 100);
    return formatColor(
      hsva(hue, saturation, brightness, normalizedAlpha / 100),
      normalizedAlpha < 100 ? 'hexa' : 'hex',
      this.uppercase,
    );
  }

  override click(): void {
    if (this.effectiveDisabled) return;
    if (this.inline) {
      (this.renderRoot?.querySelector('[part~="input"]') as HTMLInputElement | null)?.click();
    } else {
      this.triggerEl()?.click();
    }
  }

  override focus(options?: FocusOptions): void {
    if (this.effectiveDisabled) return;
    if (this.inline) {
      (this.renderRoot?.querySelector('[part~="grid-handle"]') as HTMLElement | null)?.focus(options);
    } else {
      this.triggerEl()?.focus(options);
    }
  }

  override blur(): void {
    const active = this.shadowRoot?.activeElement;
    if (active && typeof (active as Partial<HTMLElement>).blur === 'function') {
      (active as HTMLElement).blur();
    }
  }

  override reportValidity(): boolean {
    const valid = super.reportValidity();
    this.requestUpdate();
    return valid;
  }

  override setCustomValidity(message: string): void {
    super.setCustomValidity(message);
    this.requestUpdate();
  }

  override resetValidity(): void {
    super.resetValidity();
    this.requestUpdate();
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
   * Applies a colour change coming from a user interaction, emitting `input`/`lr-input` only when
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
      dispatchNativeInputEvent(this);
      this.emit('lr-input');
    }
    return changed;
  }

  /** Emits the native and migrated commit pair for a completed value-changing interaction. */
  private emitCommit(): void {
    dispatchNativeEvent(this, 'change');
    this.emit('lr-change', { value: this.value });
  }

  /** `applyColor()` plus the commit pair a discrete interaction ends with. */
  private commitColor(next: LyraColorHsva): boolean {
    const changed = this.applyColor(next);
    if (changed) this.emitCommit();
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
      strategy: this.hoist ? 'fixed' : 'absolute',
    });
  }

  private activatePanel(): void {
    if (!this.isConnected || this.inline) return;
    this.positionPanel();
    this.restoreFocusOnClose = true;
    this.overlayHandle = activateOverlay({
      host: this,
      panel: () => this.panelEl(),
      onEscape: () => this.hide(),
      onBackdrop: () => {
        this.restoreFocusOnClose = false;
        this.hide();
        if (this.open) this.restoreFocusOnClose = true;
      },
      restoreFocusTo: this.triggerEl(),
      modal: false,
      trapFocus: false,
    });
    this.overlayHandle.focusInitial();
    this.lightDismissDocument = this.ownerDocument;
    this.lightDismissDocument.addEventListener('pointerdown', this.onDocumentPointerDown, true);
  }

  private teardownOverlay(restoreFocus = true): void {
    this.cleanupPositioner?.();
    this.cleanupPositioner = undefined;
    this.overlayHandle?.deactivate({ restoreFocus });
    this.overlayHandle = undefined;
    this.lightDismissDocument?.removeEventListener('pointerdown', this.onDocumentPointerDown, true);
    this.lightDismissDocument = undefined;
    this.restoreFocusOnClose = true;
  }

  private onDocumentPointerDown = (event: Event): void => {
    const target = event.composedPath()[0];
    if (isElementValue(target) && composedContains(this, target)) return;
    if (this.overlayHandle?.isActive()) {
      this.overlayHandle.dismissBackdrop();
      return;
    }
    this.restoreFocusOnClose = false;
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
    const dragWindow = box.ownerDocument.defaultView;
    if (
      !this.isConnected ||
      !dragWindow ||
      this.effectiveDisabled ||
      this.drag !== undefined ||
      (event.pointerType === 'mouse' && event.button !== 0)
    ) return;
    const rect = box.getBoundingClientRect();
    this.drag = {
      pointerId: event.pointerId,
      track,
      rect,
      rtl: isRtl(this),
      startColor: { ...this.color },
      startValue: this.captureLiveValueCheckpoint(),
    };
    this.dragChanged = false;
    try {
      box.setPointerCapture(event.pointerId);
    } catch {
      // A synthetic or already-released pointer has no capture to take; the window-level
      // listeners below still track the gesture, so this is not worth failing the interaction over.
    }
    this.dragWindow = dragWindow;
    dragWindow.addEventListener('pointermove', this.onPointerMove);
    dragWindow.addEventListener('pointerup', this.onPointerUp);
    dragWindow.addEventListener('pointercancel', this.onPointerCancel);
    dragWindow.addEventListener('lostpointercapture', this.onPointerCancel);
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
      this.cancelDrag();
      return;
    }
    this.applyPointer(event);
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (this.drag?.pointerId !== event.pointerId) return;
    if (this.effectiveDisabled) {
      this.cancelDrag();
      return;
    }
    this.applyPointer(event);
    const changed = this.dragChanged;
    this.endDrag();
    if (changed) this.emitCommit();
  };

  // A gesture can end without a pointerup: touch-scroll takeover and palm rejection fire
  // pointercancel, and losing capture fires lostpointercapture. Both end the drag with no commit.
  private onPointerCancel = (event: PointerEvent): void => {
    if (this.drag?.pointerId !== event.pointerId) return;
    this.cancelDrag();
  };

  private cancelDrag(): void {
    const drag = this.drag;
    if (!drag) return;
    this.endDrag();
    this.color = drag.startColor;
    this.restoreLiveValueCheckpoint(drag.startValue);
    this.valueNeedsParse = false;
  }

  private endDrag(): void {
    this.drag = undefined;
    this.dragChanged = false;
    const dragWindow = this.dragWindow;
    this.dragWindow = undefined;
    dragWindow?.removeEventListener('pointermove', this.onPointerMove);
    dragWindow?.removeEventListener('pointerup', this.onPointerUp);
    dragWindow?.removeEventListener('pointercancel', this.onPointerCancel);
    dragWindow?.removeEventListener('lostpointercapture', this.onPointerCancel);
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
    this.applyKeyboardColor(next);
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
    this.applyKeyboardColor(
      hsva(finiteRange(hue, 0, 0, 360), this.color.s, this.color.v, this.color.a),
    );
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
    this.applyKeyboardColor(hsva(this.color.h, this.color.s, this.color.v, alpha));
  };

  private applyKeyboardColor(next: LyraColorHsva): void {
    const generation = this.interactionGeneration;
    const changed = this.applyColor(next);
    // An `input` listener can synchronously reparent the picker while applyColor() dispatches.
    // Disconnection cancels that interrupted gesture, so do not re-arm its later keyup commit.
    if (generation !== this.interactionGeneration) return;
    this.keyboardChanged = changed || this.keyboardChanged;
  }

  /** One discrete press pairs a keydown (`input`) with a keyup (`change`); OS key repeat re-fires
   *  keydown but still commits only once, matching a pointer drag's shape. */
  private onControlKeyUp = (): void => {
    if (!this.keyboardChanged) return;
    this.keyboardChanged = false;
    this.emitCommit();
  };

  // -------------------------------------------------------------------------
  // Field / palette / eyedropper
  // -------------------------------------------------------------------------

  private onFieldInput = (event: Event): void => {
    // The text field is a draft editor. Its native composed InputEvent must not escape as if the
    // color-picker's serialized public value changed; commitColor() emits the one public input
    // after parsing succeeds.
    event.stopPropagation();
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
    const ownerWindow = this.ownerDocument.defaultView;
    if (!this.isConnected || !ownerWindow) return;
    const Constructor = eyeDropperConstructor(ownerWindow);
    if (!Constructor || this.effectiveDisabled) return;
    this.cancelEyeDropper();
    const generation = this.eyeDropperGeneration;
    const controller = new ownerWindow.AbortController();
    this.eyeDropperAbort = controller;
    void new Constructor()
      .open({ signal: controller.signal })
      .then((result) => {
        if (
          controller.signal.aborted ||
          generation !== this.eyeDropperGeneration ||
          !this.isConnected ||
          this.ownerDocument.defaultView !== ownerWindow ||
          this.effectiveDisabled
        ) return;
        const parsed = parseColor(result?.sRGBHex ?? '');
        if (parsed) this.commitColor(this.opacity ? hsva(parsed.h, parsed.s, parsed.v, this.color.a) : parsed);
      })
      // Dismissing the eyedropper rejects; that is a cancellation, not an error worth surfacing.
      .catch(() => undefined)
      .finally(() => {
        if (generation === this.eyeDropperGeneration) this.eyeDropperAbort = undefined;
      });
  };

  private cancelEyeDropper(): void {
    this.eyeDropperGeneration += 1;
    this.eyeDropperAbort?.abort();
    this.eyeDropperAbort = undefined;
  }

  private onControlFocus = (event: FocusEvent): void => {
    event.stopPropagation();
    const previous = event.relatedTarget;
    if (isNodeValue(previous) && this.renderRoot.contains(previous)) return;
    relayNativeEvent(this, event);
  };

  private onControlBlur = (event: FocusEvent): void => {
    event.stopPropagation();
    const next = event.relatedTarget;
    if (isNodeValue(next) && this.renderRoot.contains(next)) return;
    relayNativeEvent(this, event);
    // FormAssociated marks the control interacted on the composed focusout boundary. Its custom
    // validity state is not itself a Lit property, so schedule the ARIA projection explicitly.
    this.requestUpdate();
  };

  private readonly controlFocusListener = {
    capture: true,
    handleEvent: (event: FocusEvent): void => this.onControlFocus(event),
  };

  private readonly controlBlurListener = {
    capture: true,
    handleEvent: (event: FocusEvent): void => this.onControlBlur(event),
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

  private renderPanel(
    name: string,
    labelledBy: string,
    describedBy: string,
    invalid: boolean,
  ): TemplateResult {
    const entries = this.normalizedSwatches();
    const fieldValue = this.pendingInput || this.getFormattedValue(this.activeFormat());
    return html`<div
      id=${this.panelId}
      part="panel"
      role="dialog"
      aria-label=${name || nothing}
      aria-labelledby=${labelledBy || nothing}
      aria-describedby=${describedBy || nothing}
      ?hidden=${!this.inline && !this.open}
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
          aria-required=${this.required ? 'true' : 'false'}
          aria-invalid=${invalid ? 'true' : 'false'}
          ?disabled=${this.effectiveDisabled}
          @input=${this.onFieldInput}
          @change=${this.onFieldChange}
          @keydown=${this.onFieldKeyDown}
        />
        ${this.withoutFormatToggle || this.noFormatToggle
          ? nothing
          : html`<button
              type="button"
              part="format-button format-button__base"
              aria-label=${this.localize('colorPickerToggleFormat')}
              ?disabled=${this.effectiveDisabled}
              @click=${this.onFormatClick}
            ><span part="format-button__start format-button__prefix"></span
              ><span part="format-button__label">${this.activeFormat().toUpperCase()}</span
              ><span part="format-button__end format-button__suffix"></span
              ><span part="format-button__caret"></span></button>`}
        ${this.hasEyeDropper
          ? html`<button
              type="button"
              part="eyedropper-button eye-dropper-button eyedropper-button__base eye-dropper-button__base"
              aria-label=${this.localize('colorPickerEyeDropper')}
              ?disabled=${this.effectiveDisabled}
              @click=${this.onEyeDropperClick}
            ><span part="eyedropper-button__start eye-dropper-button__prefix">${eyeIcon()}</span
              ><span class="sr-only" part="eyedropper-button__label eye-dropper-button__label"
                >${this.localize('colorPickerEyeDropper')}</span
              ><span part="eyedropper-button__end eye-dropper-button__suffix"></span
              ><span part="eyedropper-button__caret eye-dropper-button__caret"></span></button>`
          : nothing}
      </div>
      ${entries.length > 0 ? this.renderSwatches(entries) : nothing}
    </div>`;
  }

  override render(): TemplateResult {
    const hasLabel = this.withLabel || this.hasLabel || Boolean(this.label);
    const hasHint = this.withHint || this.hasHint || Boolean(this.hint);
    const hasError = this.hasError || Boolean(this.errorText);
    // Presence-based (`hostAriaLabel`), not truthiness-based: `accessibleLabel` defaults to `''`,
    // so reading the property alone cannot tell an absent `aria-label` from an explicitly empty
    // one, and the localized fallback quietly reinstated a name the author had suppressed.
    // The labelledby companion below stays truthiness-based on purpose, exactly as lr-otp-input's
    // does: it asks whether the host supplies a *real* name, and an empty one supplies none --
    // suppressing the host name must not orphan a rendered visible label from the control it names.
    const name = hostAriaLabel(this) ?? (!hasLabel ? this.localize('colorPicker') : '');
    const labelledBy = !this.accessibleLabel && hasLabel ? this.labelId : '';
    const userInvalid = this.internals.states.has('user-invalid');
    const invalid = hasError || userInvalid;
    const describedBy = [
      hasError ? this.errorId : '',
      hasHint ? this.hintId : '',
      this.valueTextId,
    ]
      .filter(Boolean)
      .join(' ');
    return html`<div
      part="form-control base color-picker"
      @focus=${this.controlFocusListener}
      @blur=${this.controlBlurListener}
    >
      <label id=${this.labelId} part="label form-control-label" for=${this.inline ? nothing : this.triggerId} ?hidden=${!hasLabel}
        >${this.hasLabel ? nothing : this.label}<slot name="label" @slotchange=${this.onSlotChange}></slot
      ></label>
      ${this.inline ? nothing : html`<div part="trigger-container">
        <button
          id=${this.triggerId}
          type="button"
          part="trigger"
          aria-label=${name || nothing}
          aria-labelledby=${labelledBy || nothing}
          aria-haspopup="dialog"
          aria-expanded=${this.open ? 'true' : 'false'}
          aria-controls=${this.panelId}
          aria-describedby=${describedBy}
          aria-required=${this.required ? 'true' : 'false'}
          aria-invalid=${invalid ? 'true' : 'false'}
          ?disabled=${this.effectiveDisabled}
          style=${styleMap({ '--lr-color-picker-swatch-color': cssColor(this.color) })}
          @click=${this.onTriggerClick}
        ></button>
      </div>`}
      <span id=${this.valueTextId} class="sr-only"
        >${this.localize('colorPickerCurrentValue', undefined, {
          color: this.value || this.getFormattedValue(this.activeFormat()),
        })}</span
      >
      ${this.renderPanel(name, labelledBy, describedBy, invalid)}
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

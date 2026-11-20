import { OwnedResizeObserver, readInlineSize } from '../../../internal/owned-observer.js';
import { OwnedFrame } from '../../../internal/owned-timer.js';
import { normalizeLabel } from '../../../internal/accessible-name.js';
import { isRepeatedActivationKey, shouldIgnoreNavigationKey } from '../../../internal/list-navigation.js';
import { installInteractionOnInvalid } from '../../../internal/invalid-event-alias.js';
import { AutocorrectState, installNativeSelectionAccessors, setNativeRangeText, nativeAutocorrectAttribute } from '../../../internal/native-text-control.js';
import {
  html,
  nothing,
  type TemplateResult,
  type PropertyValues,
} from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { hasSlotContent } from '../../../internal/slot-content.js';
import { sendIcon, stopIcon } from '../../../internal/icons.js';
import type { LyraFrame } from '../../../internal/variants.js';
import type {
  LyraSelectionDirection,
  LyraTextWrap,
} from '../../../internal/shared-unions.js';
import {
  FormAssociated,
  isBarredFromValidation,
} from '../../../internal/form-associated.js';
import { SET_ANCHORED_VALIDITY } from '../../../internal/anchored-validity.js';
import { lengthLimitConverter, lengthViolations, normalizeLengthLimit } from '../../../internal/length-constraints.js';
import { finiteInteger } from '../../../internal/numbers.js';
import { styles } from './chat-composer.styles.js';
import { normalizeChatComposerStatus, type ChatComposerStatus } from '../../../internal/chat-composer-status.js';
export { CHAT_COMPOSER_STATUSES, normalizeChatComposerStatus } from '../../../internal/chat-composer-status.js';
export type { ChatComposerStatus } from '../../../internal/chat-composer-status.js';
import {
  autocorrectConverter,
  literalSetConverter,
  trueDefaultBooleanConverter,
  blankNumberConverter,
} from '../../../internal/converters.js';
import { deepActiveElementIn } from '../../../internal/active-element.js';
import { isHtmlElement } from '../../../internal/dom-guards.js';
import {
  captureComposedFocusRepair,
  applyComposedFocusRepair,
  type ComposedFocusRepairSnapshot,
} from '../../../internal/focus-navigation.js';
import { relayNativeEvent } from '../../../internal/native-event-relay.js';
import {
  acquireResolvedAriaRelationship,
  type ResolvedAriaRelationshipLease,
} from '../../../internal/aria-controls.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_composerLabel, LYRA_DEFAULT_sendMessage, LYRA_DEFAULT_stopGenerating } from '../../../internal/default-strings/conversation.generated.js';
import { LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_valueInvalid } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

/** Whether the root draws itself as a bounded card — an alias of the shared {@linkcode LyraFrame},
 *  so there is one definition. Named `frame`, not `appearance`: `appearance` is the library's
 *  vocabulary for how a *control fills itself*, and using it for container chrome as well made one
 *  property name mean two unrelated things. */
export type ChatComposerFrame = LyraFrame;
/** Retained name for the shared native `<textarea wrap>` vocabulary. */
export type ChatComposerWrap = LyraTextWrap;
/** Retained name for the shared native `selectionDirection` vocabulary. */
export type ChatComposerSelectionDirection = LyraSelectionDirection;

/** Arrangement of the `start`/`end` action slots relative to the textarea. `'inline'` is a single flex row; `'stacked'` arranges them as a compact rail beside a multi-row textarea;
 *  `'below'` gives the textarea its own full-width line with `start` and `end` on one row under it. */
export type ChatComposerActionsLayout = 'inline' | 'stacked' | 'below';

const CHAT_COMPOSER_ACTIONS_LAYOUT = literalSetConverter<ChatComposerActionsLayout>(
  ['inline', 'stacked', 'below'],
  'inline'
);

/** Placement of caller-supplied toolbar controls inside the composer frame. */
export type ChatComposerToolbarPlacement = 'above' | 'actions';

const CHAT_COMPOSER_TOOLBAR_PLACEMENT = literalSetConverter<ChatComposerToolbarPlacement>(
  ['above', 'actions'],
  'above'
);

/** Logical alignment of a toolbar placed in the bottom action row. */
export type ChatComposerToolbarAlign = 'start' | 'end';

const CHAT_COMPOSER_TOOLBAR_ALIGN = literalSetConverter<ChatComposerToolbarAlign>(
  ['start', 'end'],
  'start'
);

export interface LyraChatComposerEventMap {
  input: InputEvent;
  change: Event;
  'lr-invalid': CustomEvent<null>;
  'lr-input': CustomEvent<{ value: string }>;
  'lr-change': CustomEvent<{ value: string }>;
  'lr-stop': CustomEvent<null>;
  'lr-submit': CustomEvent<{ value: string }>;
  blur: FocusEvent;
  focus: FocusEvent;
}
class LyraChatComposerBase extends LyraElement<LyraChatComposerEventMap> {}

/**
 * `<lr-chat-composer>` — the message input for a chat/agent conversation
 * surface: an auto-resizing textarea plus a send/stop button. Form-
 * associated via the `FormAssociated` mixin (see `<lr-date-input>` for the
 * same shape), so it participates in native `<form>` submission/validation/
 * reset like any other text control — `name`/`value`/`disabled`/`required`/
 * `checkValidity()`/`reportValidity()` all come from that mixin.
 *
 * Auto-resize reads the textarea's own *computed* line-height/padding/
 * border at runtime (`resizeTextarea()`) rather than assuming a fixed
 * px-per-row constant, so it stays correct under a consumer's own font-size/
 * line-height overrides. It grows between `min-rows` and `max-rows`, then
 * switches to internal scrolling. A `ResizeObserver` on the textarea itself
 * re-runs the same fit whenever its *width* changes (a responsive
 * breakpoint, a sidebar toggling, a window resize, an orientation change)
 * even though `value`/`min-rows`/`max-rows` never did -- a narrower box
 * wraps the same text across more lines, so the previously-fitted height
 * would otherwise go stale and clip content with no scrollbar to reveal it.
 *
 * Enter-to-send (active unless `without-enter-submit` is set):
 * plain Enter submits and is prevented from inserting a newline; Shift+Enter
 * always inserts a newline no matter what; an IME composition step (checked
 * via `isComposing`, with `keyCode === 229` as a defense-in-depth fallback
 * for browsers that report `isComposing` inconsistently on the
 * compositionend-adjacent keydown) is never treated as a submit trigger;
 * and while `status` isn't `"idle"` Enter is left alone to insert a newline
 * too, rather than trying to submit again -- there is nothing meaningful to
 * submit while a previous message is still sending/streaming, and the
 * textarea deliberately stays interactive (see `disabled` below) so a user
 * can keep composing their next message in the meantime.
 *
 * Deliberately no label/hint/error chrome -- a composite chat-input control, not a labeled form
 * field; wrap it in your own layout for that context. A host `aria-label` is forwarded to the
 * internal textarea and takes precedence over the placeholder-derived name; a host
 * `aria-describedby` describes the textarea.
 *
 * `lr-submit`'s `detail.value` is always the exact, untrimmed current
 * value (`detail.value === value` at the moment it fires) -- trimming is
 * left to the consumer so it never silently diverges from what `value`
 * itself reports. Submitting does not clear `value`; the consumer clears it
 * once the submission has actually been accepted (so e.g. a failed send can
 * leave the text in place for retry).
 * `submitDisabled` lets the consumer apply its own validation policy without
 * disabling the textarea or the busy-state Stop action.
 *
 * @customElement lr-chat-composer
 * @slot toolbar - Auxiliary controls (e.g. a model or provider picker) rendered inside the frame,
 * above the chips tray and input row by default, or between start and end below the textarea
 * with toolbar-placement="actions" and actions-layout="below", sharing `[part="base"]`'s `:focus-within` affordance.
 * @slot start - Content at the logical start of the input/action layout (e.g. an attach-file trigger).
 * @slot chips - An attachment tray rendered above the input row (e.g. files queued for this message).
 * @slot end - Overrides the built-in send/stop button entirely when it has assigned content.
 * @event input - One realm-correct native `InputEvent` relayed from the textarea for each user edit.
 * @event change - One native `Event` relayed from the textarea when its edit is committed.
 * @event lr-input - Fired on every user-driven edit of the textarea (not a programmatic `.value` assignment). `detail: { value }`.
 * @event lr-change - Fired with `detail: { value }` beside the native `change` event.
 * @event lr-submit - Fired by Enter (unless `without-enter-submit`) or the built-in button while `status="idle"` and `submitDisabled` is false. `detail: { value }`.
 * @event lr-stop - Fired by the built-in button while `status` is `"sending"` or `"streaming"` and `without-stop` is not set. No detail.
 * @event blur - One realm-correct native `FocusEvent` relayed from the textarea, preserving `relatedTarget`.
 * @event focus - One realm-correct native `FocusEvent` relayed from the textarea, preserving `relatedTarget`.
 * @event lr-invalid - The composer failed a validity check. Cancelable — preventing this alias
 *   also prevents the native `invalid` event that produced it.
 * @csspart base - The bordered root container. Drops its card chrome (border, background, padding,
 * radius) under `frame="plain"`, where the focus affordance becomes an underline on this same
 * part instead of the border-color shift.
 * @csspart toolbar - The toolbar wrapper, above attachments by default or in the bottom action row
 * with toolbar-placement="actions" and actions-layout="below". Hidden entirely when empty.
 * @csspart chips - The wrapper around the `chips` slot. Hidden entirely when the slot is empty.
 * @csspart row - The input/action layout holding the textarea, start and end, plus the toolbar
 * when toolbar-placement="actions" and actions-layout="below".
 * @csspart start - The wrapper around the `start` slot. Hidden entirely when empty.
 * @csspart textarea - The auto-resizing `<textarea>` itself.
 * @csspart end - The wrapper around the `end` slot and the built-in `action-button`.
 * @csspart send-glyph - Directional send glyph wrapper; mirrored automatically in RTL.
 * @csspart stop-glyph - Symmetric stop glyph wrapper.
 * @csspart action-button - The built-in send/stop button. Absent whenever `end` has assigned content.
 * @cssprop [--lr-chat-composer-action-bg=var(--lr-color-brand)] - Resting Send button background.
 * @cssprop [--lr-chat-composer-action-color=var(--lr-color-on-brand)] - Send glyph colour.
 * @cssprop [--lr-chat-composer-action-radius=var(--lr-radius)] - Send/Stop button corner radius.
 * @cssprop [--lr-chat-composer-action-size=auto] - Send/Stop button inline and block size, subject
 *   to the shared `--lr-icon-button-size` minimum hit target.
 * @cssprop --lr-chat-composer-action-hover-bg - Send/Stop hover background. Defaults to a tint of
 *   the current Send or Stop background.
 * @cssprop --lr-chat-composer-action-active-bg - Send/Stop pressed background. Defaults to a
 *   stronger tint of the current Send or Stop background.
 * @cssprop --lr-chat-composer-action-hover-color - Send/Stop hover glyph colour. Defaults to the
 *   current Send or Stop glyph colour.
 * @cssprop --lr-chat-composer-action-active-color - Send/Stop pressed glyph colour. Defaults to the
 *   current Send or Stop glyph colour.
 * @cssprop --lr-chat-composer-action-disabled-bg - Disabled Send/Stop background. Defaults to the
 *   current Send or Stop background, with the existing disabled opacity.
 * @cssprop --lr-chat-composer-action-disabled-color - Disabled Send/Stop glyph colour. Defaults to
 *   the current Send or Stop glyph colour, with the existing disabled opacity.
 * @cssprop [--lr-chat-composer-busy-color=var(--lr-color-on-brand)] - Stop glyph colour while
 *   `status` is `"sending"` or `"streaming"`.
 * @cssprop [--lr-chat-composer-busy-bg=var(--lr-color-text-quiet)] - `action-button` background while `status` is `"sending"` or `"streaming"`. Scoped separately from the shared `--lr-color-text-quiet` token, which the `textarea` part's placeholder also reads -- overriding this recolors only the busy button, not the placeholder text too.
 * @cssprop [--lr-chat-composer-bg=var(--lr-color-surface)] - Fill of the card
 *   (`[part="base"]`) while `frame="card"`. `frame="plain"` still removes the fill entirely.
 * @cssprop [--lr-chat-composer-border-color=var(--lr-color-border)] - Resting colour of the card's
 *   border.
 * @cssprop [--lr-chat-composer-focus-border-color=var(--lr-color-brand)] - Border color while the card contains focus.
 * @cssprop [--lr-chat-composer-radius=var(--lr-radius)] - Corner radius of the card.
 *   `frame="plain"` still squares the corners.
 * @cssprop [--lr-chat-composer-shadow=none] - Box shadow of the card. The shadow stays visible
 *   while focused and is omitted under `frame="plain"`.
 * @cssprop [--lr-chat-composer-padding=var(--lr-space-s)] - Padding of the card (`[part="base"]`).
 *   `frame="plain"` still zeroes it, same as the background/border-color/radius hooks above.
 * @cssprop [--lr-chat-composer-gap=var(--lr-space-xs)] - Row gap between the `toolbar`, `chips` and
 *   `row` sections stacked inside `[part="base"]`.
 * @cssprop [--lr-chat-composer-focus-shadow=inset 0 calc(-1 * var(--lr-focus-ring-width)) 0 0 var(--lr-focus-ring-color)] -
 *   The `frame="plain"` focus affordance painted on `[part="base"]:focus-within`, replacing the
 *   card's border-color shift with an underline since there is no border left to recolor under
 *   `plain`. Override to reshape it (a different width/color) or set to `none` to cede focus chrome
 *   entirely to a consumer-drawn wrapper -- chosen over a third `frame` value, since every other
 *   piece of this card's paint (background/border-color/radius above) is already a cssprop hook
 *   rather than a `frame` variant, and `none` already reads naturally as "I'll draw my own".
 * @status stable
 * @since 4.0.0
 */
export class LyraChatComposer extends FormAssociated(LyraChatComposerBase) {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    composerLabel: LYRA_DEFAULT_composerLabel,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    sendMessage: LYRA_DEFAULT_sendMessage,
    stopGenerating: LYRA_DEFAULT_stopGenerating,
    valueInvalid: LYRA_DEFAULT_valueInvalid,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** Placeholder text of the internal textarea; also the accessible-name fallback when `accessible-label` is unset. */
  @property() placeholder = '';
  /** Minimum visible rows of the internal textarea (default `1`). */
  @property({ converter: blankNumberConverter(1), attribute: 'min-rows' }) minRows = 1;
  /** Maximum rows the internal textarea grows to before scrolling (default `8`). */
  @property({ converter: lengthLimitConverter, useDefault: true, attribute: 'max-rows' }) maxRows = 8;
  private statusValue: ChatComposerStatus = 'idle';
  /** Sending state. Invalid direct or attribute writes normalize and reflect as `idle`. */
  @property({ reflect: true })
  get status(): ChatComposerStatus {
    return this.statusValue;
  }
  set status(value: ChatComposerStatus) {
    const previous = this.statusValue;
    const normalized = normalizeChatComposerStatus(value);
    this.statusValue = normalized;
    // Lit suppresses reflection during attribute changes, so repair invalid attributes here.
    if (
      typeof value === 'string' &&
      value !== normalized &&
      this.getAttribute('status') !== normalized
    ) {
      this.setAttribute('status', normalized);
    }
    // Reflect even when the normalized value stays the same.
    this.requestUpdate('status', previous, {
      reflect: true,
      hasChanged: () => true,
    });
  }
  /** Visual chrome, on the library-wide `frame` vocabulary. `'card'` (the default) keeps the
   *  bordered, filled, padded box. `'plain'` removes the border, background, padding and corner
   *  radius, so a composer docked inside a chat panel, dialog footer or toolbar that already draws
   *  its own border doesn't double the frame. Focus stays visible either way: `plain` swaps the
   *  border-color shift for an underline across the input row, since there is no border left to
   *  recolor. */
  @property({ reflect: true }) frame: ChatComposerFrame = 'card';

  private actionsLayoutValue: ChatComposerActionsLayout = 'inline';
  /** Arrangement of the `start`/`end` action slots relative to the textarea, on the shared
   *  literal-set pattern (`literalSetConverter`, matching `<lr-model-settings-panel>`'s `layout`).
   *  `'inline'` (the default) keeps a single flex row. `'stacked'` arranges `start` above
   *  `end` as a compact rail in one column, beside a `textarea` that spans both rows -- for a
   *  multi-row composer where the action buttons would otherwise stretch to the row's full
   *  cross-axis height. `'below'` puts the `textarea` on its own full-width line and `start` and
   *  `end` on one row beneath it (`start` at the inline start, `end` at the inline end, even while
   *  `start` is empty) -- the usual phone-width chat input with attach buttons; `min-rows`/
   *  `max-rows` growth and inner scrolling are unchanged. Layout only; slot content, empty-slot
   *  hiding and the built-in button are unchanged. Invalid direct or attribute values normalize and
   *  reflect as `'inline'`. */
  @property({
    reflect: true,
    attribute: 'actions-layout',
    converter: CHAT_COMPOSER_ACTIONS_LAYOUT,
  })
  get actionsLayout(): ChatComposerActionsLayout {
    return this.actionsLayoutValue;
  }
  set actionsLayout(next: ChatComposerActionsLayout) {
    const normalized = CHAT_COMPOSER_ACTIONS_LAYOUT.normalizeReflected(
      this,
      'actions-layout',
      next
    );
    const previous = this.actionsLayoutValue;
    if (previous === normalized) return;
    this.actionsLayoutValue = normalized;
    this.requestUpdate('actionsLayout', previous);
  }

  private toolbarPlacementValue: ChatComposerToolbarPlacement = 'above';
  /** Toolbar position. `'above'` keeps controls above attachments. `'actions'` places them between
   * start and end below the textarea only with `actionsLayout='below'`; other layouts retain the
   * upper toolbar. Invalid or removed values normalize to `'above'`.
   * @default 'above'
   */
  @property({
    reflect: true,
    attribute: 'toolbar-placement',
    converter: CHAT_COMPOSER_TOOLBAR_PLACEMENT,
  })
  get toolbarPlacement(): ChatComposerToolbarPlacement {
    return this.toolbarPlacementValue;
  }
  set toolbarPlacement(next: ChatComposerToolbarPlacement) {
    const normalized = CHAT_COMPOSER_TOOLBAR_PLACEMENT.normalizeReflected(this, 'toolbar-placement', next);
    if (this.hasUpdated && !this.hasAttribute('toolbar-placement')) {
      this.setAttribute('toolbar-placement', normalized);
    }
    const previous = this.toolbarPlacementValue;
    if (previous === normalized) return;
    this.toolbarPlacementValue = normalized;
    this.requestUpdate('toolbarPlacement', previous);
  }

  /** Aligns the toolbar controls within the bottom action row. Set to `'end'` to place them next
   * to the end actions. Applies only with `toolbar-placement="actions"` and `actions-layout="below"`.
   * Invalid or removed values normalize to `'start'`.
   * @default 'start'
   */
  @property({
    reflect: true,
    attribute: 'toolbar-align',
    converter: CHAT_COMPOSER_TOOLBAR_ALIGN,
  })
  get toolbarAlign(): ChatComposerToolbarAlign {
    return this.toolbarAlignValue;
  }
  set toolbarAlign(next: ChatComposerToolbarAlign) {
    const normalized = CHAT_COMPOSER_TOOLBAR_ALIGN.normalizeReflected(this, 'toolbar-align', next);
    if (this.hasUpdated && !this.hasAttribute('toolbar-align')) {
      this.setAttribute('toolbar-align', normalized);
    }
    const previous = this.toolbarAlignValue;
    if (previous === normalized) return;
    this.toolbarAlignValue = normalized;
    this.requestUpdate('toolbarAlign', previous);
  }

  private toolbarAlignValue: ChatComposerToolbarAlign = 'start';

  private get toolbarInActions(): boolean {
    return this.actionsLayout === 'below' && this.toolbarPlacement === 'actions';
  }

  private renderedToolbarInActions = false;
  private placementFocusRepair: ComposedFocusRepairSnapshot | null = null;

  /** Turns off Enter-to-send: plain Enter inserts a newline, as Shift+Enter always does. */
  @property({ type: Boolean, reflect: true, attribute: 'without-enter-submit' })
  withoutEnterSubmit = false;

  /** Consumer-controlled validation gate for submission. While idle, disables the built-in Send
   * button and suppresses Enter/click submission without disabling the textarea. Busy Stop behavior
   * remains governed by `status` and `without-stop`. */
  @property({ type: Boolean, reflect: true, attribute: 'submit-disabled' })
  submitDisabled = false;

  /** While `status` is busy, renders a disabled Send button instead of the Stop action and never
   *  fires `lr-stop`. */
  @property({ type: Boolean, reflect: true, attribute: 'without-stop' }) withoutStop = false;

  /** Native read-only state. The textarea remains focusable/submittable but cannot be user-edited,
   * and intrinsic constraints are barred just like a native read-only textarea. */
  @property({ type: Boolean, reflect: true, attribute: 'readonly' }) readOnly =
    false;
  /** Native minimum text length. Unset or invalid values impose no lower bound. */
  @property({ converter: lengthLimitConverter, attribute: 'minlength' }) minLength?: number;
  /** Native maximum text length. Unset or invalid values impose no upper bound. */
  @property({ converter: lengthLimitConverter, attribute: 'maxlength' }) maxLength?: number;
  /** Accessible name for the internal textarea. Takes precedence over the placeholder-derived name. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  @property({ converter: trueDefaultBooleanConverter }) override spellcheck =
    true;
  /** Forwarded to the internal `<textarea>`'s own `autocapitalize`. Empty string omits the
   *  attribute (browser default). */
  @property() override autocapitalize = '';
  private readonly autocorrectState = new AutocorrectState(this, true);
  /** Native autocorrect state. Reads are boolean; writes accept boolean or the legacy
   * `'off'`/`'false'` string vocabulary and reflect canonical `on`/`off`.
   * @default true
   */
  @property({ converter: autocorrectConverter })
  override get autocorrect(): boolean {
    return this.autocorrectState.value;
  }
  override set autocorrect(next: boolean | string) {
    this.autocorrectState.set(next);
  }
  /** Native editing-assistance attributes forwarded to the internal textarea. */
  @property() wrap: ChatComposerWrap = 'soft';
  @property() autocomplete = '';
  @property({ attribute: 'inputmode' }) override inputMode = '';
  @property({ attribute: 'enterkeyhint' }) override enterKeyHint = '';

  @state() private hasToolbarSlot = false;
  @state() private hasStartSlot = false;
  @state() private hasChipsSlot = false;
  @state() private hasEndSlot = false;
  @state() private touched = false;

  @query('textarea') private textareaEl?: HTMLTextAreaElement;
  private descriptionLease?: ResolvedAriaRelationshipLease;
  private readonly resizeFrame = new OwnedFrame(this);
  private lastTextareaWidth = 0;
  private readonly textareaResizeObserver = new OwnedResizeObserver(this, entries => {
    const width = readInlineSize(entries[0]);
    if (width === undefined || Math.abs(width - this.lastTextareaWidth) < 0.5) return;
    this.lastTextareaWidth = width;
    if (!this.resizeFrame.pending) this.resizeFrame.schedule(() => this.resizeTextarea());
  });

  // Purely presentational sizing (never form-submitted, unlike `value`/`disabled`/`required`
  // above), so a read-time getter -- mirroring `<lr-audio-visualizer>`'s `effectiveBarCount` --
  // is enough; no write-time accessor is needed to keep some other reactive state in sync.
  private get effectiveMinRows(): number {
    return finiteInteger(this.minRows, 1, 1);
  }

  /** Never less than {@link effectiveMinRows} -- an inverted min/max-rows pair (authored
   *  backwards, or a live update that shrinks `max-rows` below the current `min-rows`) still
   *  produces a usable, non-collapsed range instead of clipping the textarea to less than its own
   *  minimum. */
  private get effectiveMaxRows(): number {
    return Math.max(
      this.effectiveMinRows,
      finiteInteger(this.maxRows, this.effectiveMinRows, 1)
    );
  }

  constructor() {
    super();
    this.requestUpdate('toolbarPlacement', undefined);
    this.requestUpdate('toolbarAlign', undefined);
    installInteractionOnInvalid(this, () => { this.touched = true; });
  }

  /** The internal native textarea for integrations that require direct DOM access. */
  get input(): HTMLTextAreaElement | null {
    return this.textareaEl ?? null;
  }

  declare selectionStart: number | null;
  declare selectionEnd: number | null;
  declare selectionDirection: ChatComposerSelectionDirection | null;

  override focus(options?: FocusOptions): void {
    this.textareaEl?.focus(options);
  }

  override blur(): void {
    this.textareaEl?.blur();
  }

  /** Focuses the primary textarea, matching activation of the wrapped native control. */
  override click(): void {
    if (!this.effectiveDisabled) this.textareaEl?.focus();
  }

  /** Selects all text in the native textarea. */
  select(): void {
    this.input?.select();
  }

  /** Sets the native textarea's selection range and optional direction. */
  setSelectionRange(
    start: number | null,
    end: number | null,
    direction: ChatComposerSelectionDirection = 'none',
  ): void {
    this.input?.setSelectionRange(start, end, direction);
  }

  setRangeText(replacement: string): void;
  setRangeText(
    replacement: string,
    start: number,
    end: number,
    selectMode?: SelectionMode
  ): void;
  setRangeText(
    replacement: string,
    start?: number,
    end?: number,
    selectMode?: SelectionMode
  ): void {
    const textarea = this.textareaEl;
    if (!textarea) return;
    setNativeRangeText(textarea, replacement, start, end, selectMode);
    this.value = textarea.value;
    this.resizeTextarea();
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (this.hasUpdated && this.toolbarInActions !== this.renderedToolbarInActions) {
      const active = deepActiveElementIn(this.ownerDocument);
      if (isHtmlElement(active)) {
        for (const wrapper of this.renderRoot.querySelectorAll('[part="start"], [part="toolbar"]')) {
          this.placementFocusRepair = captureComposedFocusRepair(wrapper, active);
          if (this.placementFocusRepair) break;
        }
      }
    }
    // A server render sees no light-DOM children, so a hydrating composer reproduces the server's
    // slot-less rendering first and adopts the real adornment slots on the next update.
    this.seedFirstRenderState(() => {
      this.syncToolbarSlot();
      this.syncStartSlot();
      this.hasChipsSlot = hasSlotContent(this, 'chips');
      this.syncEndSlot();
    });
  }

  protected override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    this.resizeTextarea();
    this.armTextareaResizeObserver();
    if (this.isConnected) this.descriptionLease ??= acquireResolvedAriaRelationship(this, this.input, 'aria-describedby');
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // Reconnecting a rendered textarea does not trigger firstUpdated again.
    if (this.hasUpdated) {
      this.armTextareaResizeObserver();
      this.resizeTextarea();
      this.descriptionLease ??= acquireResolvedAriaRelationship(this, this.input, 'aria-describedby');
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resetTextareaResizeWork();
    this.placementFocusRepair = null;
    this.descriptionLease?.release();
    this.descriptionLease = undefined;
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.resetTextareaResizeWork();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.renderedToolbarInActions = this.toolbarInActions;
    const repair = this.placementFocusRepair;
    this.placementFocusRepair = null;
    if (repair && this.isConnected) applyComposedFocusRepair(repair);
    if (
      changed.has('value') ||
      changed.has('minRows') ||
      changed.has('maxRows')
    ) {
      this.resizeTextarea();
    }
    if (
      changed.has('minLength') ||
      changed.has('maxLength') ||
      changed.has('readOnly')
    ) {
      this.updateValidity();
    }
  }

  protected updateValidity(): void {
    if (
      isBarredFromValidation(
        { effectiveDisabled: this.effectiveDisabled, readonly: this.readOnly },
        this.internals
      )
    ) {
      this[SET_ANCHORED_VALIDITY]({});
      return;
    }
    if (this.required && this.value === '') {
      this[SET_ANCHORED_VALIDITY](
        { valueMissing: true },
        () => this.localize('fieldRequired')
      );
      return;
    }
    const textarea = this.textareaEl;
    if (textarea && textarea.value !== this.value) textarea.value = this.value;
    const own = lengthViolations(this.value, this.minLength, this.maxLength);
    const tooShort = Boolean(textarea?.validity.tooShort) || own.tooShort;
    const tooLong = Boolean(textarea?.validity.tooLong) || own.tooLong;
    if (!tooShort && !tooLong) {
      this[SET_ANCHORED_VALIDITY]({});
      return;
    }
    this[SET_ANCHORED_VALIDITY](
      { tooShort, tooLong },
      () => textarea?.validationMessage || this.localize('valueInvalid')
    );
  }

  override formResetCallback(): void {
    super.formResetCallback();
    this.touched = false;
  }

  /**
   * Grows/shrinks the textarea between `min-rows` and `max-rows`, reading
   * the *computed* line-height/padding/border back out of the element at
   * call time instead of assuming a fixed px-per-row figure -- correct
   * whatever font-size/line-height a consumer's own CSS ends up applying.
   * Past `max-rows` the box stops growing and switches to internal
   * scrolling (`overflow-y: auto`).
   */
  private resizeTextarea(): void {
    const ta = this.textareaEl;
    if (!ta) return;
    const cs = this.ownerDocument.defaultView?.getComputedStyle(ta) ?? ta.style;
    const lineHeight =
      parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
    const paddingBlock =
      parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const borderBlock =
      parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
    const minRows = this.effectiveMinRows;
    const maxRows = this.effectiveMaxRows;
    const minHeight = lineHeight * minRows + paddingBlock + borderBlock;
    const maxHeight = lineHeight * maxRows + paddingBlock + borderBlock;

    // Clear the applied height so deleting wrapped text can shrink the textarea.
    ta.style.height = 'auto';
    // Compare border-box heights and ignore wrapped placeholder text for empty drafts.
    const contentHeight = ta.value === '' ? minHeight : ta.scrollHeight + borderBlock;
    const next = Math.min(Math.max(contentHeight, minHeight), maxHeight);
    ta.style.height = `${next}px`;
    ta.style.overflowY = contentHeight > maxHeight ? 'auto' : 'hidden';
  }

  private armTextareaResizeObserver(): void {
    const textarea = this.textareaEl;
    if (!textarea || !this.isConnected) return;
    this.lastTextareaWidth = textarea.getBoundingClientRect().width;
    this.textareaResizeObserver.observe(textarea);
  }

  private resetTextareaResizeWork(): void {
    this.textareaResizeObserver.clear();
    this.resizeFrame.cancel();
  }

  private onTextareaInput = (event: InputEvent): void => {
    if (this.effectiveDisabled || this.readOnly) {
      event.stopPropagation();
      return;
    }
    this.value = (event.target as HTMLTextAreaElement).value;
    this.resizeTextarea();
    relayNativeEvent(this, event);
    this.emit('lr-input', { value: this.value });
  };

  private onTextareaChange = (event: Event): void => {
    if (this.effectiveDisabled || this.readOnly) {
      event.stopPropagation();
      return;
    }
    this.value = (event.target as HTMLTextAreaElement).value;
    relayNativeEvent(this, event);
    this.emit('lr-change', { value: this.value });
  };

  private onTextareaKeyDown = (e: KeyboardEvent): void => {
    if (e.defaultPrevented || e.key !== 'Enter' || e.shiftKey || this.withoutEnterSubmit ||
        this.status !== 'idle' || shouldIgnoreNavigationKey(e)) return;
    e.preventDefault();
    if (isRepeatedActivationKey(e)) return;
    this.submit();
  };

  private onActionClick = (): void => {
    if (this.effectiveDisabled) return;
    if (this.status === 'idle') {
      this.submit();
    } else if (!this.withoutStop) {
      this.emit('lr-stop', null);
    }
  };

  private submit(): void {
    if (this.submitDisabled || this.effectiveDisabled || this.status !== 'idle')
      return;
    this.emit('lr-submit', { value: this.value });
  }

  private syncToolbarSlot = (): void => {
    this.hasToolbarSlot = hasSlotContent(this, 'toolbar');
  };

  private syncStartSlot = (): void => {
    this.hasStartSlot = hasSlotContent(this, 'start');
  };

  private onChipsSlotChange = (): void => {
    this.hasChipsSlot = hasSlotContent(this, 'chips');
  };

  private syncEndSlot = (): void => {
    this.hasEndSlot = hasSlotContent(this, 'end');
  };

  private onTextareaBlur = (event: FocusEvent): void => {
    // Disabling a focused textarea can trigger blur synchronously during the update.
    if (!this.effectiveDisabled) this.touched = true;
    relayNativeEvent(this, event);
  };

  private onTextareaFocus = (event: FocusEvent): void => {
    if (this.effectiveDisabled) {
      event.stopPropagation();
      return;
    }
    relayNativeEvent(this, event);
  };

  private renderActionButton(): TemplateResult {
    const busy = this.status !== 'idle';
    const showStop = busy && !this.withoutStop;
    return html`
      <button
        part="action-button"
        type="button"
        aria-label=${showStop
          ? this.localize('stopGenerating')
          : this.localize('sendMessage')}
        ?disabled=${this.effectiveDisabled ||
        (busy ? this.withoutStop : this.submitDisabled)}
        @click=${this.onActionClick}
      >
        <span part=${showStop ? 'stop-glyph' : 'send-glyph'}>
          ${showStop ? stopIcon() : sendIcon()}
        </span>
      </button>
    `;
  }

  private renderToolbar(): TemplateResult {
    return html`<div part="toolbar" ?hidden=${!this.hasToolbarSlot}>
      <slot name="toolbar" @slotchange=${this.syncToolbarSlot}></slot>
    </div>`;
  }

  private renderStart(): TemplateResult {
    return html`<span part="start" ?hidden=${!this.hasStartSlot}>
      <slot name="start" @slotchange=${this.syncStartSlot}></slot>
    </span>`;
  }

  override render(): TemplateResult {
    return html`
      <div part="base">
        ${this.toolbarInActions ? nothing : this.renderToolbar()}
        <div part="chips" ?hidden=${!this.hasChipsSlot}>
          <slot name="chips" @slotchange=${this.onChipsSlotChange}></slot>
        </div>
        <div part="row">
          ${this.toolbarInActions ? nothing : this.renderStart()}
          <textarea
            part="textarea"
            aria-label=${this.accessibleLabel === '' ? '' :
              normalizeLabel(this.accessibleLabel) ?? normalizeLabel(this.placeholder) ?? this.localize('composerLabel')}
            aria-required=${this.required ? 'true' : 'false'}
            aria-invalid=${this.touched && !this.internals.validity.valid
              ? 'true'
              : 'false'}
            spellcheck=${this.spellcheck}
            autocapitalize=${this.autocapitalize || nothing}
            autocorrect=${nativeAutocorrectAttribute(this, this.autocorrect)}
            wrap=${this.wrap}
            autocomplete=${this.autocomplete || nothing}
            inputmode=${this.inputMode || nothing}
            enterkeyhint=${this.enterKeyHint || nothing}
            minlength=${normalizeLengthLimit(this.minLength) ?? nothing}
            maxlength=${normalizeLengthLimit(this.maxLength) ?? nothing}
            .value=${this.value}
            placeholder=${this.placeholder}
            rows=${this.effectiveMinRows}
            ?required=${this.required}
            ?disabled=${this.effectiveDisabled}
            ?readonly=${this.readOnly}
            @input=${this.onTextareaInput}
            @change=${this.onTextareaChange}
            @keydown=${this.onTextareaKeyDown}
            @focus=${this.onTextareaFocus}
            @blur=${this.onTextareaBlur}
          ></textarea>
          ${this.toolbarInActions ? this.renderStart() : nothing}
          ${this.toolbarInActions ? this.renderToolbar() : nothing}
          <span part="end">
            <slot name="end" @slotchange=${this.syncEndSlot}></slot>
            ${this.hasEndSlot ? nothing : this.renderActionButton()}
          </span>
        </div>
      </div>
    `;
  }
}

installNativeSelectionAccessors(LyraChatComposer.prototype, host => host.input, { methods: false });

declare global {
  interface HTMLElementTagNameMap {
    'lr-chat-composer': LyraChatComposer;
  }
}

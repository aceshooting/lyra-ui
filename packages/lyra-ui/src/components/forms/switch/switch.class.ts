import { emitValueEvents } from '../../../internal/value-events.js';
import { formControlSupportingState, renderFormControlHintError } from '../../../internal/form-control-template.js';
import { shouldIgnoreActivationKey } from '../../../internal/list-navigation.js';
import { SlotPresenceController } from '../../../internal/slot-presence-controller.js';
import { installFormControlLabelSupport } from '../../../internal/form-control-labels.js';
import { HostDescriptionController } from '../../../internal/aria-controls.js';
import { html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { CheckedControlLabelController } from '../../../internal/checked-control-label.js';
import { VALIDITY_ANCHOR } from '../../../internal/anchored-validity.js';
import { sizes } from '../../../internal/sizes.styles.js';
import type { LyraSize } from '../../../internal/variants.js';
import { styles } from './switch.styles.js';
import { relayNativeEvent } from '../../../internal/native-event-relay.js';
import { requestThenCommit } from '../../../internal/request-commit.js';
import { markVetoGuardWrite, VetoWriteGuard } from '../../../internal/veto-write-guard.js';
import { isActionableElement } from '../../../internal/focus-navigation.js';
import { CheckedFormAssociated, isLiveDisabled } from '../../../internal/form-associated.js';
import { currentValidityValidator, type LyraFormValidator } from '../form-validator.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_switchRequired } from '../../../internal/default-strings/forms.generated.js';
import { LYRA_DEFAULT_fieldRequired } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

installFormControlLabelSupport();

export interface LyraSwitchEventMap {
  input: Event;
  change: Event;
  'lr-input': CustomEvent<{ checked: boolean; value: string }>;
  'lr-change': CustomEvent<{ checked: boolean; value: string }>;
  focus: FocusEvent;
  blur: FocusEvent;
  'lr-invalid': CustomEvent<null>;
  // The proposal, not the outcome: `checked` still holds the old value while this dispatches, so
  // `detail.checked` is what the control would become. Same request/commit shape `<lr-details>`
  // uses, with the direction in the detail rather than in two direction-named events.
  'lr-switch-toggle-request': CustomEvent<{ checked: boolean; value: string }>;
}
class LyraSwitchBase extends LyraElement<LyraSwitchEventMap> {}

/**
 * `<lr-switch>` — a boolean toggle-switch form control. Structurally the
 * same idea as a checkbox (form-associated via `ElementInternals`, click and
 * Space toggle) but with switch semantics: `role="switch"` +
 * `aria-checked` read to assistive tech as an on/off state rather than a
 * checked/unchecked one, and there is no indeterminate state.
 *
 * Form association, dirty/default `checked` tracking, reset, state restore and the validity
 * states come from the shared `CheckedFormAssociated` mixin, the same one `<lr-checkbox>` and
 * `<lr-radio>` use; this class adds only the switch's own toggle veto and rendering.
 *
 * Deliberately no `readonly`: the native checkbox a switch stands in for has no read-only state either, so this control
 * offers `disabled` alone (which also leaves form submission). A read-only form view renders the
 * committed value as text, with a hidden input when it must still submit.
 *
 * Ships an opt-in `hint`/`errorText` form-control chrome (props + matching named slots +
 * `hint`/`error` CSS parts), mirroring `<lr-select>`'s pattern for those two pieces -- left
 * unset, neither renders. Deliberately no separate top-of-field `label` prop/slot/part mirroring
 * `<lr-select>`'s `form-control-label`: the default slot already *is* this control's visible,
 * clickable label (same as `<lr-checkbox>`), so a second label surface would be redundant.
 * Its wrapper follows flattened rendered assignment and updates through forwarding slots. Visual
 * elements, including decorative `aria-hidden` icons, retain the wrapper independently of their
 * accessibility-tree contribution.
 *
 * Host `aria-describedby` references resolve onto the internal switch before its local error/hint
 * guidance, tracking target changes, reconnect and document adoption. Removing `hint`, `help-text`
 * or `error-text` safely omits the content while preserving native null property readback.
 *
 * @customElement lr-switch
 * @slot - Label text, rendered next to the track. Clicking it toggles the
 * switch, the same as clicking a checkbox's associated `<label>`. If left
 * empty, set `aria-label` on the host so the control still has an accessible name. Host
 * `aria-label` is forwarded by presence, including an explicitly empty value.
 * @slot hint - Custom hint content.
 * @slot help-text - Shoelace alias for `hint`.
 * @slot error - Custom error content.
 * @event {Event} input - The user toggled the switch; bubbling and composed like a native form event.
 * @event lr-input - Prefixed compatibility alias for `input`; `detail: { checked, value }`.
 * @event {Event} change - Fired immediately after `input` for the same user toggle, matching the native
 * checkbox/radio contract a form library expects from a boolean control.
 * @event lr-change - Compatibility alias fired after `input` and `change` (click, Space, logical
 * ArrowLeft/ArrowRight, or
 * the programmatic `click()` activation path). `detail: { checked, value }`. Not fired for a plain
 * `.checked` property assignment, `form.reset()`, session-state restoration, or a user toggle a
 * listener refused through `lr-switch-toggle-request`.
 * @event lr-switch-toggle-request - A user toggle (click, Space, the logical arrow keys, or the
 * programmatic `click()` activation path) is about to change `checked`; `detail: { checked, value }`
 * carries the state the control *would* take (`value` is the current `.value`, unaffected by the
 * toggle), and `checked` itself still holds the old value while
 * this dispatches. Cancelable: calling `preventDefault()` keeps the current state, so the switch
 * never slides at all rather than sliding and snapping back, and none of
 * `input`/`lr-input`/`change`/`lr-change` fire. A listener may instead resolve the request by
 * assigning `checked` itself during the dispatch, which suppresses the built-in write the same
 * way. Not fired for a programmatic `.checked` assignment, while the control is disabled, or for
 * an arrow key that names the state the switch already holds.
 * @event focus - The internal switch control received focus. Bridges the internal element's
 * non-bubbling native `focus`, re-dispatched as bubbling and composed.
 * @event blur - The internal switch control lost focus. Bridges the internal element's
 * non-bubbling native `blur`, re-dispatched as bubbling and composed.
 * @event lr-invalid - The switch failed a validity check. Cancelable: calling
 * `preventDefault()` also cancels the native `invalid` event behind it, suppressing the
 * browser's own validation bubble so an app can present the failure its own way.
 * @cssstate required - Matches while `required` is set. Style with `lr-switch:state(required)`.
 * @cssstate optional - Matches while `required` is not set — the complement of `required`.
 * @cssstate valid - Matches while the control satisfies its constraints, including any
 * `setCustomValidity()` error.
 * @cssstate invalid - Matches while it does not — from the very first render, before the user has
 * touched anything.
 * @cssstate user-valid - `valid`, but only after the user has interacted: a toggle the host
 * allowed, a blur, `reportValidity()`, or a submission attempt. Not after a silent
 * `checkValidity()` alone. A toggle refused through `lr-switch-toggle-request` is deliberately
 * not one of them -- nothing changed, so nothing is revealed until the user interacts again.
 * @cssstate user-invalid - `invalid` after that same interaction. Style validation errors with this
 * rather than `invalid`: a pristine required switch is genuinely invalid, but colouring it red
 * before the user has done anything is hostile.
 * @cssstate checked - Matches while the live switch state is on.
 * @cssstate disabled - Matches while disabled directly or by an ancestor fieldset.
 * @csspart form-control - The outer wrapper around the switch, error and hint.
 * @csspart row - The row wrapping the switch owner and the label as siblings. This is the node
 *  to size or align when laying out a column of switches; `base`/`switch` is only the track box
 *  inside it, so its inline size tracks the track, not the row.
 * @csspart wrapper - Compatibility name on the semantic switch owner.
 * @csspart base - Compatibility name for the semantic switch owner; use `switch`.
 * @csspart switch - The interactive `role="switch"` owner around the track, with the rich default
 *   label as a sibling so nested actions remain valid focus stops.
 * @csspart track - The pill-shaped background.
 * @csspart control - WA/Shoelace name for the same pill-shaped background.
 * @csspart thumb - The circular knob that slides across the track.
 * @csspart label - The wrapper around the default slot.
 * @csspart hint - The hint message.
 * @csspart form-control-help-text - Shoelace name for the same hint message.
 * @csspart error - The error message.
 * @cssprop [--lr-switch-gap=var(--lr-space-s)] - Gap between the track and label.
 * @cssprop [--lr-switch-invalid-border=var(--lr-color-danger)] - Outline color of `[part='track']`
 *   while the switch matches `:state(user-invalid)`.
 * @cssprop [--lr-switch-track-inline-size=calc(var(--lr-switch-track-block-size) * 1.8)] - Inline
 *   size of the track, and (with the block size) the distance the thumb travels when checked.
 *   Derived from the block size, so re-sizing the track keeps its aspect ratio.
 * @cssprop [--lr-switch-track-block-size=calc(var(--lr-form-control-height) * 0.5)] - Block size of
 *   the track, half the `size` tier's shared control height; the thumb's diameter is derived from
 *   it minus twice `--lr-switch-thumb-offset`.
 * @cssprop [--lr-switch-thumb-offset=var(--lr-size-2px)] - Inset of the thumb from the track's
 *   edges.
 * @cssprop [--lr-switch-track-fill=var(--lr-color-border)] - Resting fill of `[part='track']`
 *   while unchecked and the base for unchecked hover/press fallbacks. It never paints the checked
 *   track.
 * @cssprop [--lr-switch-checked-track-fill=var(--lr-color-brand)] - Track fill while checked and
 *   the base for checked hover/press fallbacks. It is independent of the unchecked fill.
 * @cssprop [--lr-switch-track-hover-fill=color-mix(...)] - Track fill while hovered in either
 *   state. When unset, the current state's fill is mixed toward the color-mix partner.
 * @cssprop [--lr-switch-track-active-fill=color-mix(...)] - Track fill while pressed in either
 *   state. When unset, the current state's fill is mixed toward the color-mix partner.
 * @cssprop --lr-switch-track-border - Border of `[part='track']`, and the checked-state fallback
 *   when `--lr-switch-checked-track-border` is unset. Undeclared by default (no border renders at
 *   all), matching today's chrome.
 * @cssprop [--lr-switch-checked-track-border=var(--lr-switch-track-border)] - Border of
 *   `[part='track']` while checked, independently themeable from the unchecked border, so a
 *   bordered track can differ by state without reaching for `::part(track)` plus the `checked`
 *   custom state. Takes a whole `border` shorthand value, like `--lr-switch-track-border`; give
 *   both states the same border *width* unless a size change between them is what you want, since
 *   the track is `box-sizing: content-box` and a border grows its outer footprint.
 * @cssprop [--lr-switch-thumb-fill=var(--lr-color-surface)] - Thumb fill while unchecked, and the
 *   checked-state fallback when `--lr-switch-checked-thumb-fill` is unset.
 * @cssprop [--lr-switch-checked-thumb-fill=var(--lr-switch-thumb-fill)] - Thumb fill while
 *   checked, independently themeable from the unchecked fill.
 * @cssprop [--width=var(--lr-switch-track-inline-size)] - WA/Shoelace alias for the track's inline
 * size.
 * @cssprop [--height=var(--lr-switch-track-block-size)] - WA/Shoelace alias for the track's block
 * size.
 * @cssprop [--thumb-size=calc(var(--height, var(--lr-switch-track-block-size)) - (var(--lr-switch-thumb-offset) * 2))] - WA/Shoelace thumb diameter alias.
 * @cssprop [--lr-switch-label-color=var(--lr-color-text)] - Text color of `[part='label']`, and
 *   the checked-state fallback when `--lr-switch-checked-label-color` is unset.
 * @cssprop [--lr-switch-checked-label-color=var(--lr-switch-label-color)] - Text color of
 *   `[part='label']` while checked, independently themeable from the unchecked color.
 * @status stable
 * @since 4.0.0
 */
export class LyraSwitch extends CheckedFormAssociated(LyraSwitchBase) {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    switchRequired: LYRA_DEFAULT_switchRequired,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  /** Public WA-compatible intrinsic validator catalog. */
  static get validators(): LyraFormValidator<LyraSwitch>[] {
    return [currentValidityValidator('required', 'disabled', 'checked', 'value')];
  }
  static override styles = [LyraElement.styles, sizes, styles];
  static override properties = {
    size: { reflect: true },
  };

  /**
   * Control size, on the library's shared ladder. Accepts both spellings of every tier —
   * `2xs`/`xs`/`s`/`m`/`l`/`xl` and Web Awesome's `small`/`medium`/`large` — so migrating either way
   * is a tag rename. Scales the track and thumb off the same `--lr-form-control-*` values
   * `<lr-input>`/`<lr-select>`/`<lr-button>` use, so controls of one `size` line up in a row. The
   * slotted label keeps the library's standard control-label type size at every tier; restyle it
   * through `::part(label)` if you want it to track the control.
   */
  size: LyraSize = 'm';

  /** Hint text below the switch. Unset: no hint chrome renders. */
  @property() hint = '';
  /** Shoelace alias for {@link hint}. `hint` wins when both are supplied. */
  @property({ attribute: 'help-text' }) helpText = '';
  /** WA SSR slot-presence hint used before light-DOM assignment can be inspected. */
  @property({ type: Boolean, attribute: 'with-hint' }) withHint = false;
  /** Error text below the switch (overridden by slotted `error` content). Unset: no error chrome
   *  renders. */
  @property({ attribute: 'error-text' }) errorText = '';

  @state() private hasLabelSlot = false;
  private readonly slotPresence = new SlotPresenceController(this);
  private readonly labelController = new CheckedControlLabelController(this, {
    changed: present => { this.hasLabelSlot = present; },
  });
  // Shared with every other veto point in this library: `emit()` is synchronous, so a listener
  // that answers `lr-switch-toggle-request` by writing `checked` itself finishes before the
  // built-in commit runs, and a before/after value compare reads "unchanged" whenever it wrote
  // back the value the control already held. The guard records that a write happened.
  private toggleGuard = new VetoWriteGuard();

  /** Unconditional, including a write of the value already held: the guard tracks that a write
   *  happened, not that a value differs. See {@link toggleGuard}. */
  protected override checkedWritten(previous: boolean): void {
    void previous;
    markVetoGuardWrite(this.toggleGuard);
  }

  protected override requiredMessage(): string {
    return this.localize('switchRequired');
  }

  /** @internal */
  [VALIDITY_ANCHOR](): HTMLElement | null {
    return this.renderRoot?.querySelector('.switch-owner') ?? null;
  }

  /** Reads both component state and the UA's synchronous fieldset cascade before public actions. */
  private get liveDisabled(): boolean {
    return isLiveDisabled(this);
  }

  /** Activates the internal switch control, toggling it the same as a real click -- mirrors
   *  `<lr-checkbox>`'s identical `override click()`. Without this, `HTMLElement.prototype.click()`
   *  on the host is a no-op: the real click handler is bound only to the internal
   *  `[part~="base"]` control, not the host itself. */
  override click(): void {
    if (!this.liveDisabled) this[VALIDITY_ANCHOR]()?.click();
  }

  /** Moves focus to the internal switch control. */
  override focus(options?: FocusOptions): void {
    if (!this.liveDisabled) this[VALIDITY_ANCHOR]()?.focus(options);
  }

  /** Removes focus from the internal switch control. */
  override blur(): void {
    this[VALIDITY_ANCHOR]()?.blur();
  }

  private readonly description = new HostDescriptionController(this, () => this[VALIDITY_ANCHOR]());

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.labelController.adopted();
    this.description.adopted();
  }

  private setFromUser(next: boolean): void {
    if (this.liveDisabled) return;
    if (this.checked === next) return;
    // The veto point sits BEFORE the write, not after it: a host that refuses this toggle leaves
    // the switch exactly as the user found it, instead of letting it slide across and snapping it
    // back a frame later. `requestThenCommit()` also suppresses the commit when a listener
    // resolved the request by writing `checked` itself. Mirrors `<lr-checkbox>`'s `toggle()`.
    requestThenCommit({
      requestDetail: { checked: next, value: this.value },
      emitRequest: (detail, init: { cancelable: true }) =>
        this.emit('lr-switch-toggle-request', detail, init),
      guard: this.toggleGuard,
      commit: () => {
        if (this.liveDisabled) return;
        // Set inside the commit, for `<lr-checkbox>`'s `toggle()` reason: `syncValidityStates()`
        // reads this flag, so marking it before the veto would let a
        // REFUSED first toggle start matching `:state(user-invalid)` for a change that never
        // happened. `onBlur` still marks a real user interacted when focus leaves,
        // which is the native `:user-invalid` timing.
        this.setInteracted(true);
        this.checked = next;
        const detail = { checked: this.checked, value: this.value };
        emitValueEvents(this, 'input', detail, captured => this.emit('lr-input', captured));
        emitValueEvents(this, 'change', detail, captured => this.emit('lr-change', captured));
      },
    });
  }

  private onClick = (event: MouseEvent): void => {
    const owner = this[VALIDITY_ANCHOR]();
    for (const target of event.composedPath()) {
      if (target === event.currentTarget) break;
      if (
        target &&
        typeof target === 'object' &&
        (target as Node).nodeType === 1 &&
        target !== owner &&
        isActionableElement(target as Element)
      ) return;
    }
    this.setFromUser(!this.checked);
  };

  private onBlur = (event: FocusEvent): void => {
    // Disabling a focused control can force blur before its next render.
    if (!this.liveDisabled) {
      this.setInteracted(true);
    }
    relayNativeEvent(this, event);
  };

  private onFocus = (event: FocusEvent): void => {
    if (this.liveDisabled) {
      event.stopPropagation();
      return;
    }
    relayNativeEvent(this, event);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.liveDisabled || e.defaultPrevented || shouldIgnoreActivationKey(e)) return;
    if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      this.setFromUser(!this.checked);
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const turnsOn = this.effectiveDirection === 'rtl'
        ? e.key === 'ArrowLeft'
        : e.key === 'ArrowRight';
      this.setFromUser(turnsOn);
    }
  };

  override render(): TemplateResult {
    const supporting = formControlSupportingState({
      presence: this.slotPresence, idPrefix: 'switch', hint: this.hint,
      errorText: this.errorText, withHint: this.withHint, helpText: this.helpText,
    });
    const describedBy = supporting.describedBy;
    const invalid = supporting.hasError || (this.hasInteracted && !this.internals.validity.valid);
    return html`
      <div part="form-control">
        <span class="switch-layout" part="row" @click=${this.onClick}>
          <span
            class="switch-owner"
            part="base switch wrapper"
            role="switch"
            tabindex=${this.effectiveDisabled ? '-1' : '0'}
            aria-checked=${this.checked ? 'true' : 'false'}
            aria-required=${this.required ? 'true' : 'false'}
            aria-invalid=${invalid ? 'true' : 'false'}
            aria-disabled=${this.effectiveDisabled ? 'true' : 'false'}
            aria-label=${this.getAttribute('aria-label') ?? nothing}
            aria-labelledby=${this.hasAttribute('aria-label') ? nothing : 'switch-label'}
            aria-describedby=${describedBy || nothing}
            @keydown=${this.onKeyDown}
            @focus=${this.onFocus}
            @blur=${this.onBlur}
          >
            <span part=${this.checked ? 'track control checked' : 'track control'}>
              <span part="thumb"></span>
            </span>
          </span>
          <span id="switch-label" part="label" ?hidden=${!this.renderSlotPresence(this.hasLabelSlot)}>
            <slot @slotchange=${this.labelController.onSlotChange}></slot>
          </span>
        </span>
        ${renderFormControlHintError({
          ...supporting, idPrefix: 'switch', hint: this.hint || this.helpText,
          errorText: this.errorText, helpTextSlot: true,
        })}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-switch': LyraSwitch;
  }
}

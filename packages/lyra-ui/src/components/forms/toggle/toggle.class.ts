import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { sizes } from '../../../internal/sizes.styles.js';
import { variants } from '../../../internal/variants.styles.js';
import type { LyraAppearance, LyraSize, LyraVariant } from '../../../internal/variants.js';
import { literalSetConverter } from '../../../internal/converters.js';
import { hostAriaLabel } from '../../../internal/a11y.js';
import {
  acquireResolvedAriaRelationship,
  type ResolvedAriaRelationshipLease,
} from '../../../internal/aria-controls.js';
import {
  acquireNativeControlDescription,
  type NativeControlDescriptionLease,
} from '../../../internal/native-control-description.js';
import { relayNativeEvent } from '../../../internal/native-event-relay.js';
import { requestThenCommit } from '../../../internal/request-commit.js';
import { markVetoGuardWrite, VetoWriteGuard } from '../../../internal/veto-write-guard.js';
import { SlotPresenceController } from '../../../internal/slot-presence-controller.js';
import type { AdjacentRunPosition } from '../../../internal/adjacent-runs.js';
import type { LyraToolbarAction } from '../../conversation/message-actions/toolbar-actions.js';
import { styles } from './toggle.styles.js';

/** The two fill treatments a toggle takes: text-only chrome, or a bounded outline. */
export type LyraToggleAppearance = Extract<LyraAppearance, 'plain' | 'outlined'>;

/** Detail of a toggle's request and settled events. */
export interface LyraToggleChangeDetail {
  /** The request's proposed state, or the committed state on `lr-change`. */
  readonly pressed: boolean;
  /** The toggle's current `value`, unaffected by the toggle. */
  readonly value: string;
}

export interface LyraToggleEventMap {
  focus: FocusEvent;
  blur: FocusEvent;
  'lr-toggle-toggle-request': CustomEvent<LyraToggleChangeDetail>;
  'lr-change': CustomEvent<LyraToggleChangeDetail>;
  'lr-toolbar-actions-change': Event;
}

/** @internal The owning group's side of the link, handed over by `joinGroup()`. */
export interface LyraToggleGroupLink {
  /** True while the linking group is connected and still owns `toggle`. */
  owns(toggle: LyraToggle): boolean;
  /** Synchronous notification from the `pressed` setter. A no-op unless the group owns `toggle`. */
  pressedWritten(toggle: LyraToggle): void;
}

/** @internal State an owning group projects onto each toggle it owns. */
export interface LyraToggleGroupProjection {
  readonly disabled: boolean;
  readonly tabbable: boolean;
  readonly size: LyraSize | null;
  readonly appearance: LyraToggleAppearance | null;
  readonly run: AdjacentRunPosition;
}

const TOGGLE_VARIANT = literalSetConverter<LyraVariant>(
  ['neutral', 'brand', 'success', 'warning', 'danger'],
  'neutral',
);
const TOGGLE_APPEARANCE = literalSetConverter<LyraToggleAppearance>(['plain', 'outlined'], 'plain');
const TOGGLE_SIZE = literalSetConverter<LyraSize>(
  ['2xs', 'xs', 's', 'm', 'l', 'xl', 'small', 'medium', 'large'],
  'm',
);

const STANDALONE: LyraToggleGroupProjection = Object.freeze({
  disabled: false,
  tabbable: true,
  size: null,
  appearance: null,
  run: 'standalone',
});

/**
 * `<lr-toggle>` — a two-state button that owns its `pressed` state.
 *
 * It renders a native `<button type="button">` whose `aria-pressed` is always `"true"` or
 * `"false"`. Keep the label constant while `pressed` changes: the state is conveyed by
 * `aria-pressed` alone, so a "Mute"/"Unmute" label swap announces the change twice and wrongly.
 * An icon-only toggle needs a name from the host `aria-label`, the host `aria-labelledby`, or its
 * content (a labelled icon or visually hidden text); there is deliberately no generic fallback
 * name. A host `aria-label` is forwarded by presence, including an explicitly empty value, and a
 * host `aria-describedby` is resolved onto the internal button through `ariaDescribedByElements`.
 * A host `aria-pressed` is not supported: the host has no role, so use `pressed`.
 *
 * A user activation (click, Enter, Space, or host `click()`) first emits the cancelable
 * `lr-toggle-toggle-request` and then, unless a listener refused it, commits and emits
 * `lr-change`. Programmatic `pressed` and `value` writes are silent.
 *
 * Inside an `<lr-toggle-group>` the group is the aggregate event surface: it consumes this
 * toggle's `lr-toggle-toggle-request` and `lr-change` and republishes them under its own names,
 * so listeners on an individual grouped toggle receive neither. The group also projects its
 * `disabled`, optional `size`/`appearance`, roving tab stop and joined-run corners onto the toggle
 * without rewriting any of its own attributes.
 *
 * This is not a form control. It is not form-associated and submits nothing, so an ancestor
 * `<fieldset disabled>` does not reach it and it is absent from `form.elements`; disable each
 * toggle explicitly, and use `<lr-switch>`, `<lr-checkbox>`, `<lr-checkbox-group>` or
 * `<lr-radio-group>` for a value that must be submitted. For the same reason it renders no
 * label/hint/error chrome: its content is its name.
 *
 * **Hit area.** The toggle keeps the shared size ladder, including for icon-only content, rather
 * than flooring its box at `--lr-icon-button-size` the way `<lr-icon-button>` does. Every tier
 * still floors both axes at 1.5rem (24px, the WCAG 2.5.8 minimum), the default `m` tier equals the
 * 2.5rem icon-button floor, and a coarse pointer floors every tier at 2.75rem (44px); only
 * fine-pointer `2xs`/`xs`/`s` sit below 40px. Keep `m` or larger, or use `<lr-icon-button>` with a
 * consumer-managed `aria-pressed`, when the compact 40px floor matters.
 *
 * `getToolbarActions()` contributes this toggle as one logical action to an enclosing composite
 * toolbar (`<lr-message-actions>`), leasing the internal button's own `tabindex`. While grouped it
 * returns no action, because the group owns that tab stop.
 *
 * Component-scoped custom properties are not declared on the host, so a value set on an ancestor
 * theme wrapper overrides the built-in fallback.
 *
 * @customElement lr-toggle
 * @slot - The label or icon content. It is the toggle's accessible name unless the host supplies one.
 * @slot start - Leading adornment, hidden while empty.
 * @slot end - Trailing adornment, hidden while empty.
 * @event lr-toggle-toggle-request - A user activation is about to flip `pressed`;
 *   `detail: { pressed, value }` carries the state the toggle *would* take, while `pressed` itself
 *   still holds the old value. Cancelable: `preventDefault()` keeps the current state and no
 *   `lr-change` follows. A listener may instead resolve the request by assigning `pressed`
 *   itself during the dispatch, which suppresses the built-in commit the same way. Never fired for
 *   a programmatic write or while disabled, and consumed by an owning `<lr-toggle-group>`.
 * @event lr-change - A committed user toggle; `detail: { pressed, value }`. Not cancelable, not
 *   fired for programmatic writes, and consumed by an owning `<lr-toggle-group>`.
 * @event lr-toolbar-actions-change - No-detail coordination event emitted when this toggle joins
 *   or leaves an `<lr-toggle-group>`, so an enclosing toolbar re-reads `getToolbarActions()`.
 * @event focus - Native focus relayed once from the internal button.
 * @event blur - Native blur relayed once from the internal button.
 * @attr aria-labelledby - Host IDREFs resolved onto the internal button through
 *   `ariaLabelledByElements`, following same-ID replacement, reconnect and adoption. Per ARIA it
 *   wins over `aria-label` and the content.
 * @csspart base - The native button; the same node also carries `button`.
 * @csspart button - The native button.
 * @csspart start - Wrapper of the `start` slot.
 * @csspart label - Wrapper of the default slot; a long label ellipsizes.
 * @csspart end - Wrapper of the `end` slot.
 * @cssprop [--lr-toggle-radius=var(--lr-form-control-radius)] - Corner radius of the button.
 * @cssprop [--lr-toggle-padding-inline=var(--lr-space-s)] - Inline padding of the button.
 * @cssprop [--lr-toggle-gap=var(--lr-form-control-gap)] - Gap between the adornments and the label.
 * @cssprop [--lr-toggle-color=var(--lr-color-text)] - Text and icon colour while unpressed.
 * @cssprop [--lr-toggle-background=transparent] - Fill while unpressed.
 * @cssprop [--lr-toggle-border-color=transparent] - Border colour while unpressed. The built-in
 *   default is transparent for `plain` and `var(--lr-color-border)` for `outlined`.
 * @cssprop [--lr-toggle-hover-background=color-mix(in oklab, var(--lr-color-surface), var(--lr-color-mix-partner) var(--lr-color-mix-hover))] -
 *   Fill of an unpressed toggle under the pointer.
 * @cssprop [--lr-toggle-pressed-background=var(--lr-color-fill-quiet)] - Fill while pressed, from
 *   the `variant` row of the semantic colour grid.
 * @cssprop [--lr-toggle-pressed-color=var(--lr-color-on-quiet)] - Text and icon colour while pressed.
 * @cssprop [--lr-toggle-pressed-border-color=var(--lr-color-border-loud)] - Border colour while
 *   pressed. It is the pressed state's 3:1 non-text indicator; a quiet fill alone would not meet
 *   WCAG 1.4.11.
 * @status experimental
 * @since unreleased
 */
export class LyraToggle extends LyraElement<LyraToggleEventMap> {
  static override styles = [LyraElement.styles, sizes, variants, styles];
  static override properties = {
    pressed: { type: Boolean, reflect: true, noAccessor: true },
  };

  private _pressed = false;
  private _variant: LyraVariant = 'neutral';
  private _appearance: LyraToggleAppearance = 'plain';
  private _size: LyraSize = 'm';
  // `emit()` is synchronous, so a listener that answers the request by writing `pressed` itself
  // finishes before the built-in commit runs, and a before/after value compare reads "unchanged"
  // whenever it wrote back the value the toggle already held. The guard records that a write
  // happened.
  private readonly pressGuard = new VetoWriteGuard();
  private groupLink: LyraToggleGroupLink | null = null;
  private projection: LyraToggleGroupProjection = STANDALONE;
  private descriptionLease?: NativeControlDescriptionLease;
  private labelLease?: ResolvedAriaRelationshipLease;
  private readonly slots = new SlotPresenceController(this);
  private readonly toolbarAction = this.createToolbarAction();
  @query('[part~="button"]') private button?: HTMLButtonElement | null;

  /** Whether the toggle is pressed. Reflected; programmatic writes emit nothing. */
  get pressed(): boolean {
    return this._pressed;
  }
  set pressed(next: boolean) {
    const old = this._pressed;
    this._pressed = Boolean(next);
    // Unconditional, including a write of the value already held: the guard tracks that a write
    // happened, not that a value differs.
    markVetoGuardWrite(this.pressGuard);
    this.requestUpdate('pressed', old);
    this.groupLink?.pressedWritten(this);
  }

  /** Disables the toggle. An owning group's `disabled` is projected without changing this. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /** Item identity inside an `<lr-toggle-group>`, echoed in event details. Never submitted. */
  @property() value = '';

  /** Semantic tone of the pressed fill. Unsupported values fall back to `neutral`. */
  @property({ reflect: true, converter: TOGGLE_VARIANT })
  get variant(): LyraVariant {
    return this._variant;
  }
  set variant(next: LyraVariant) {
    const normalized = TOGGLE_VARIANT.normalizeReflected(this, 'variant', next);
    const old = this._variant;
    if (old === normalized) return;
    this._variant = normalized;
    this.requestUpdate('variant', old);
  }

  /** `plain` (text-only chrome) or `outlined` (a bounded border). Unsupported values fall back to
   *  `plain`. An owning group's opt-in `appearance` overrides it without rewriting it. */
  @property({ reflect: true, converter: TOGGLE_APPEARANCE })
  get appearance(): LyraToggleAppearance {
    return this._appearance;
  }
  set appearance(next: LyraToggleAppearance) {
    const normalized = TOGGLE_APPEARANCE.normalizeReflected(this, 'appearance', next);
    const old = this._appearance;
    if (old === normalized) return;
    this._appearance = normalized;
    this.requestUpdate('appearance', old);
  }

  /** Tier on the shared size ladder, accepting both `2xs`..`xl` and `small`/`medium`/`large`.
   *  Unsupported values fall back to `m`. An owning group's opt-in `size` overrides it without
   *  rewriting it. */
  @property({ reflect: true, converter: TOGGLE_SIZE })
  get size(): LyraSize {
    return this._size;
  }
  set size(next: LyraSize) {
    const normalized = TOGGLE_SIZE.normalizeReflected(this, 'size', next);
    const old = this._size;
    if (old === normalized) return;
    this._size = normalized;
    this.requestUpdate('size', old);
  }

  /** Whether the toggle is disabled by its own `disabled` or by an owning group. */
  get effectiveDisabled(): boolean {
    return this.disabled || this.projection.disabled;
  }

  /** Activates the toggle through its full user-activation path; a no-op while disabled. */
  override click(): void {
    if (this.effectiveDisabled) return;
    this.button?.click();
  }

  override focus(options?: FocusOptions): void {
    if (!this.effectiveDisabled) this.button?.focus(options);
  }

  override blur(): void {
    this.button?.blur();
  }

  /**
   * The logical action this toggle contributes to an enclosing composite toolbar
   * (`<lr-message-actions>`). Standalone it is one stable action leasing the internal button's
   * `tabindex`; a tabindex on this host would neither add nor remove that button's tab stop.
   * Grouped it is empty, because the owning `<lr-toggle-group>` already owns the tab stop.
   */
  getToolbarActions(): readonly LyraToolbarAction[] {
    return this.groupLink ? [] : [this.toolbarAction];
  }

  /** @internal Links this toggle to an owning group. */
  joinGroup(link: LyraToggleGroupLink): void {
    if (this.groupLink === link) return;
    // Release a toolbar's tabindex lease first: the group's rendered roving value replaces it, and
    // a later lease release restoring the pre-group value would otherwise erase that stop.
    this.toolbarAction.releaseTabIndex?.();
    this.groupLink = link;
    this.requestUpdate();
    this.emit('lr-toolbar-actions-change');
  }

  /** @internal Releases the link, unless another group has already linked this toggle. */
  leaveGroup(link: LyraToggleGroupLink): void {
    if (this.groupLink !== link) return;
    this.releaseGroup();
  }

  /** @internal Applies the state an owning group projects. */
  setGroupProjection(projection: LyraToggleGroupProjection): void {
    const current = this.projection;
    if (
      current.disabled === projection.disabled &&
      current.tabbable === projection.tabbable &&
      current.size === projection.size &&
      current.appearance === projection.appearance &&
      current.run === projection.run
    ) {
      return;
    }
    this.projection = Object.freeze({ ...projection });
    this.toggleAttribute('data-lr-group-size', projection.size !== null);
    this.requestUpdate();
  }

  private releaseGroup(): void {
    this.groupLink = null;
    this.setGroupProjection(STANDALONE);
    this.requestUpdate();
    this.emit('lr-toolbar-actions-change');
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // A toggle moved out of its group, or left behind in a detached one, releases the stale link
    // itself; the group only ever observes its own subtree.
    const link = this.groupLink;
    if (link && this.isConnected && !link.owns(this)) this.releaseGroup();
    if (this.hasUpdated) this.syncRelationships();
  }

  override disconnectedCallback(): void {
    this.toolbarAction.releaseTabIndex?.();
    this.releaseRelationships();
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    this.toolbarAction.releaseTabIndex?.();
    super.adoptedCallback();
    this.releaseRelationships();
    if (this.isConnected && this.hasUpdated) this.syncRelationships();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.syncRelationships();
  }

  private syncRelationships(): void {
    const target = this.isConnected ? this.button : null;
    if (!target) {
      this.releaseRelationships();
      return;
    }
    if (this.descriptionLease) this.descriptionLease.update(target);
    else this.descriptionLease = acquireNativeControlDescription(this, target, () => '');
    // An IDREF cannot cross into this shadow root, so a host `aria-labelledby` is projected as a
    // reflected element reference onto the button that owns the role.
    if (this.labelLease) this.labelLease.update(target);
    else this.labelLease = acquireResolvedAriaRelationship(this, target, 'aria-labelledby');
  }

  private releaseRelationships(): void {
    this.descriptionLease?.release();
    this.descriptionLease = undefined;
    this.labelLease?.release();
    this.labelLease = undefined;
  }

  private onClick = (): void => {
    if (this.effectiveDisabled) return;
    const next = !this.pressed;
    requestThenCommit({
      requestDetail: { pressed: next, value: this.value },
      emitRequest: (detail, init: { cancelable: true }) =>
        this.emit('lr-toggle-toggle-request', detail, init),
      guard: this.pressGuard,
      commit: () => {
        this.pressed = next;
        this.emit('lr-change', { pressed: this.pressed, value: this.value });
      },
    });
  };

  private onFocus = (event: FocusEvent): void => {
    relayNativeEvent(this, event);
  };

  private onBlur = (event: FocusEvent): void => {
    relayNativeEvent(this, event);
  };

  private createToolbarAction(): LyraToolbarAction {
    const host = this;
    let leasedTrigger: HTMLElement | undefined;
    let authoredTabIndex: string | null = null;
    let lastManagedTabIndex: string | null = null;
    let consumerOwnsTabIndex = false;
    const releaseTabIndex = (): void => {
      const target = leasedTrigger;
      if (target && target.getAttribute('tabindex') === lastManagedTabIndex) {
        if (authoredTabIndex === null) target.removeAttribute('tabindex');
        else target.setAttribute('tabindex', authoredTabIndex);
      }
      leasedTrigger = undefined;
      authoredTabIndex = null;
      lastManagedTabIndex = null;
      consumerOwnsTabIndex = false;
    };
    return {
      id: 'toggle',
      get disabled() {
        return host.effectiveDisabled || !host.button;
      },
      focus(options) {
        host.focus(options);
      },
      setTabIndex(tabIndex) {
        const trigger = host.button;
        if (!trigger || host.groupLink) {
          releaseTabIndex();
          return;
        }
        if (leasedTrigger !== trigger) {
          releaseTabIndex();
          leasedTrigger = trigger;
          authoredTabIndex = trigger.getAttribute('tabindex');
        }
        if (
          consumerOwnsTabIndex ||
          (lastManagedTabIndex !== null && trigger.getAttribute('tabindex') !== lastManagedTabIndex)
        ) {
          consumerOwnsTabIndex = true;
          return;
        }
        trigger.tabIndex = tabIndex;
        lastManagedTabIndex = trigger.getAttribute('tabindex');
      },
      releaseTabIndex,
      matchesEventPath(path) {
        // `!= null`: Lit's @query getter yields null, not undefined, before the first render.
        const button = host.button;
        return path.includes(host) || (button != null && path.includes(button));
      },
    };
  }

  override render(): TemplateResult {
    const grouped = this.groupLink !== null;
    return html`<button
      part="base button"
      type="button"
      data-appearance=${this.projection.appearance ?? this.appearance}
      data-run=${this.projection.run}
      tabindex=${grouped ? (this.projection.tabbable ? '0' : '-1') : nothing}
      ?disabled=${this.effectiveDisabled}
      aria-pressed=${this.pressed ? 'true' : 'false'}
      aria-label=${hostAriaLabel(this) ?? nothing}
      @click=${this.onClick}
      @focus=${this.onFocus}
      @blur=${this.onBlur}
    ><span part="start" ?hidden=${!this.slots.has('start')}><slot name="start"></slot></span
    ><span part="label"><slot></slot></span
    ><span part="end" ?hidden=${!this.slots.has('end')}><slot name="end"></slot></span></button>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-toggle': LyraToggle;
  }
}

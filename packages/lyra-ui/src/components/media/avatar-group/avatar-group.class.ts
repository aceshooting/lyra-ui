import type { PropertyValues } from 'lit';
import { html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { hostAriaLabel } from '../../../internal/a11y.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteCount } from '../../../internal/numbers.js';
import { tag } from '../../../internal/prefix.js';
import type { LyraSize, LyraVariant } from '../../../internal/variants.js';
import { styles } from './avatar-group.styles.js';
// Type-only import — erased at build. Importing the value module (`avatar.ts`/`avatar.js`) here
// would side-effect-register `<lr-avatar>` just from importing `<lr-avatar-group>`, which this
// component must not do: consumers register `lr-avatar` themselves.
import type { LyraAvatar, LyraAvatarShape } from '../avatar/avatar.class.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_showMoreCollapsed, LYRA_DEFAULT_showMoreCount } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

type AvatarPresentationAttribute = 'size' | 'shape' | 'variant';

export interface LyraAvatarGroupOverflowDetail {
  readonly hiddenCount: number;
  readonly hiddenAvatars: readonly LyraAvatar[];
}

export interface LyraAvatarGroupEventMap {
  'lr-overflow-click': CustomEvent<LyraAvatarGroupOverflowDetail>;
}

/**
 * `<lr-avatar-group>` — stacks a set of slotted `<lr-avatar>` children into a single
 * overlapping row (negative-margin overlap, ring border so each circle reads as distinct) and,
 * past a configurable `max` count, collapses the excess into a "+N" overflow badge. First-party
 * invention (no Web Awesome equivalent), composed over `<lr-avatar>` rather than reimplementing
 * it — plain light-DOM slotted content is the group's items, the same shape `<lr-multi-split>`'s
 * panels / `<lr-source-list>`'s cards / `<lr-chip-group>`'s chips already use, not a
 * `.items` array prop.
 *
 * `size`/`shape`/`variant` provide defaults to assigned avatars that omit the corresponding
 * attribute. Explicit child attributes always win; group-owned defaults are removed on disconnect
 * or removal without overwriting later author writes.
 *
 * **Deliberate divergence from `<lr-chip-group>`'s overflow pattern.** Chip-group's overflow
 * indicator is a disclosure toggle that reveals the excess children in place (`aria-expanded`,
 * a "Show less" relabel). This component's overflow badge does not do that — unstacking N more
 * circles back into the row would defeat the entire point of a compact identity stack. Instead,
 * `lr-overflow-click` is a pure notification hook: the component keeps rendering the same
 * collapsed stack + badge regardless of whether anyone listens, and a consumer typically wires
 * the event to open their own popover/dialog/tooltip listing the hidden members (out of scope for
 * this component — no popover dependency is introduced here). There is no `expanded` state, no
 * `aria-expanded`, and the badge never changes its own text/label on click.
 *
 * **No roving-tabindex / arrow-key composite-widget behavior applies here, and this is
 * intentional, not an oversight.** Avatars are non-interactive per `<lr-avatar>`'s own
 * established contract (purely presentational, no built-in interactivity), so this is not a
 * listbox/toolbar/grid needing `ArrowLeft`/`ArrowRight` roving focus — the overflow badge is the
 * only interactive element, and as a native `<button>` it's automatically part of the normal Tab
 * sequence with no custom keyboard handling required.
 *
 * @customElement lr-avatar-group
 * @slot - Direct or forwarded `<lr-avatar>` elements. Other assigned elements are ignored and
 * remain untouched.
 * @event lr-overflow-click - The overflow badge was activated (click, or Enter/Space while
 * focused — native `<button>` behavior). `detail: { hiddenCount, hiddenAvatars }` where
 * `hiddenAvatars` is a fresh readonly snapshot of eligible avatars hidden past `max`.
 * Non-cancelable — informational hook, no default action to veto.
 * @csspart base - The outer inline-flex container (holds the slot and the overflow badge).
 * @csspart overflow-badge - The "+N" button. Only rendered while `max` is actively causing an
 * overflow.
 * @csspart overflow-badge-visual - The avatar-sized painted disc inside the 40px action surface.
 * @cssprop [--lr-avatar-group-avatar-size=var(--lr-size-3rem)] - Sizes the overflow badge to
 * match the slotted avatars, tier for tier with `<lr-avatar>`'s own `--lr-avatar-size`.
 * @cssprop [--lr-avatar-group-overlap=var(--lr-size-neg-6px)] - Horizontal overlap between
 * consecutive avatars (a logical `margin-inline-start`, so it auto-mirrors under `dir="rtl"`).
 * Setting this to `0` or a positive length is a supported escape hatch that turns the stack into
 * normal, non-overlapping spacing.
 * @cssprop [--lr-avatar-group-ring-color=var(--lr-color-surface)] - The cutout-style ring
 * drawn around every avatar and the overflow badge.
 * @cssprop [--lr-avatar-group-ring-width=var(--lr-border-width-medium)] - Ring thickness.
 * @cssprop [--lr-avatar-group-badge-bg=var(--lr-color-border)] - Overflow badge background.
 * Its private default follows `variant`; the public value remains authoritative.
 * @cssprop [--lr-avatar-group-badge-color=var(--lr-color-text)] - Overflow badge text color.
 * Its private default follows `variant`; the public value remains authoritative.
 * @cssprop [--lr-avatar-group-badge-font-size=var(--lr-font-size-m)] - Font size of the "+N"
 * badge label. `size` steps its private default across the same six-step ladder as `<lr-avatar>`'s
 * own `--lr-avatar-font-size`, so the badge and the avatars it caps read at the same optical weight.
 * @status stable
 * @since 4.0.0
 */
export class LyraAvatarGroup extends LyraElement<LyraAvatarGroupEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    showMoreCollapsed: LYRA_DEFAULT_showMoreCollapsed,
    showMoreCount: LYRA_DEFAULT_showMoreCount,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-overflow-click',
  ]);
  protected static override readonly identityEventDetailProperties = Object.freeze({
    'lr-overflow-click': Object.freeze(['hiddenAvatars']),
  });

  static override styles = [LyraElement.styles, styles];

  private _max?: number;
  /** Maximum number of assigned children shown before the rest collapse behind a "+N" badge.
   *  Flattened slot-forwarded children count the same as direct light-DOM children. Unset (the
   *  default) means no limit — every child is always shown. Any explicitly assigned value is
   *  sanitized to a finite, non-negative integer via `finiteCount` — this feeds the
   *  `hasOverflow`/`syncChildVisibility`/`onOverflowClick` index math below directly, so a
   *  NaN/negative value must never reach it. */
  @property({ type: Number })
  get max(): number | undefined {
    return this._max;
  }
  set max(next: number | undefined | null) {
    const old = this._max;
    this._max = next == null ? undefined : finiteCount(next);
    this.requestUpdate('max', old);
  }

  /** Shared size default for the badge and avatars that omit their own `size`. */
  @property({ reflect: true }) size: LyraSize = 'medium';

  /** `'circle'` (the default), `'rounded'`, or `'square'`. Also provides the default to assigned
   * avatars that omit their own `shape`. */
  @property({ reflect: true }) shape: LyraAvatarShape = 'circle';

  /** Recolors the overflow badge and defaults avatars that omit their own `variant`.
   * `'neutral'` (the default) reads as a plain, unaccented badge. */
  @property({ reflect: true }) variant: LyraVariant = 'neutral';

  /** The group's own accessible name (`role="group"`'s `aria-label`). A host-level `aria-label`
   *  wins if both are set. Unset (the default) renders no `aria-label` at all — a screen reader
   *  announces "group" with no name, then reads each avatar's own accessible name in turn. */
  @property() label = '';

  @state() private eligibleAvatarCount = 0;
  @state() private overflowHiddenAvatars: readonly LyraAvatar[] = Object.freeze(
    []
  );
  private assignedAvatars: readonly LyraAvatar[] = Object.freeze([]);
  private observedAvatars: readonly LyraAvatar[] = Object.freeze([]);
  private avatarObserver?: MutationObserver;
  private avatarObserverWindow?: Window;
  private readonly defaultOwnership = new Map<
    LyraAvatar,
    Map<AvatarPresentationAttribute, string>
  >();
  private readonly pendingOwnedAttributeWrites = new WeakMap<
    LyraAvatar,
    Map<AvatarPresentationAttribute, number>
  >();

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (
      changed.has('size') &&
      this.size !== '2xs' &&
      this.size !== 'xs' &&
      this.size !== 's' &&
      this.size !== 'm' &&
      this.size !== 'l' &&
      this.size !== 'xl' &&
      this.size !== 'small' &&
      this.size !== 'medium' &&
      this.size !== 'large'
    )
      this.size = 'medium';
    if (
      changed.has('shape') &&
      this.shape !== 'circle' &&
      this.shape !== 'rounded' &&
      this.shape !== 'square'
    ) {
      this.shape = 'circle';
    }
    if (
      changed.has('variant') &&
      this.variant !== 'neutral' &&
      this.variant !== 'brand' &&
      this.variant !== 'success' &&
      this.variant !== 'warning' &&
      this.variant !== 'danger'
    )
      this.variant = 'neutral';

    if (!this.hasUpdated) {
      this.seedFirstRenderState(() => {
        this.assignedAvatars = Object.freeze(
          Array.from(this.children).filter((element): element is LyraAvatar =>
            this.isAvatar(element)
          )
        );
        this.recomputeWindow();
      });
    } else if (changed.has('max')) {
      this.recomputeWindow();
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasUpdated) return;
    const slot = this.renderRoot.querySelector('slot');
    if (slot?.localName === 'slot') {
      this.reconcileAvatars(
        (slot as HTMLSlotElement).assignedElements({ flatten: true })
      );
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.connectAvatarObserver(this.assignedAvatars);
    this.applyGroupDefaults();
    this.applyVisibilityMarkers();
  }

  override disconnectedCallback(): void {
    this.disconnectAvatarObserver();
    this.restoreOwnedState();
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.disconnectAvatarObserver();
    if (!this.isConnected) return;
    const slot = this.renderRoot.querySelector('slot');
    if (slot?.localName === 'slot') {
      this.reconcileAvatars(
        (slot as HTMLSlotElement).assignedElements({ flatten: true })
      );
    }
  }

  private get hasOverflow(): boolean {
    // `max`'s own accessor already sanitizes to a finite, non-negative integer (or `undefined`)
    // on assignment, so no further finiteness check is needed here.
    const max = this.max;
    return max != null && this.eligibleAvatarCount > max;
  }

  private get hiddenCount(): number {
    return this.overflowHiddenAvatars.length;
  }

  private isAvatar(element: Element): element is LyraAvatar {
    return element.localName === tag('avatar');
  }

  private sameAvatars(
    a: readonly LyraAvatar[],
    b: readonly LyraAvatar[]
  ): boolean {
    return (
      a.length === b.length && a.every((avatar, index) => avatar === b[index])
    );
  }

  private reconcileAvatars(elements: readonly Element[]): void {
    if (!this.isConnected) return;
    const next = Object.freeze(
      elements.filter((element): element is LyraAvatar =>
        this.isAvatar(element)
      )
    );
    const nextSet = new Set(next);
    for (const avatar of this.assignedAvatars) {
      if (!nextSet.has(avatar)) this.restoreAvatarState(avatar);
    }
    this.assignedAvatars = next;
    this.connectAvatarObserver(next);
    this.applyGroupDefaults();
    this.recomputeWindow();
    this.applyVisibilityMarkers();
  }

  private recomputeWindow(): void {
    const eligible = this.assignedAvatars.filter(
      (avatar) =>
        !avatar.hasAttribute('hidden') && !avatar.hasAttribute('inert')
    );
    const hidden = this.max == null ? [] : eligible.slice(this.max);
    if (this.eligibleAvatarCount !== eligible.length)
      this.eligibleAvatarCount = eligible.length;
    if (!this.sameAvatars(this.overflowHiddenAvatars, hidden)) {
      this.overflowHiddenAvatars = Object.freeze([...hidden]);
    }
  }

  private connectAvatarObserver(avatars: readonly LyraAvatar[]): void {
    const ownerWindow = this.ownerDocument.defaultView;
    if (!ownerWindow) return;
    const identitiesChanged = !this.sameAvatars(this.observedAvatars, avatars);
    if (
      !identitiesChanged &&
      this.avatarObserverWindow === ownerWindow &&
      this.avatarObserver
    )
      return;
    this.disconnectAvatarObserver();
    this.observedAvatars = Object.freeze([...avatars]);
    this.avatarObserverWindow = ownerWindow;
    const observer = new ownerWindow.MutationObserver((records) => {
      if (
        this.avatarObserver !== observer ||
        !this.isConnected ||
        this.ownerDocument.defaultView !== ownerWindow
      )
        return;
      for (const record of records) {
        const attribute =
          record.attributeName as AvatarPresentationAttribute | null;
        if (
          !attribute ||
          (attribute !== 'size' &&
            attribute !== 'shape' &&
            attribute !== 'variant') ||
          !this.isAvatar(record.target as Element)
        )
          continue;
        const avatar = record.target as LyraAvatar;
        if (this.consumeOwnedAttributeWrite(avatar, attribute)) continue;
        const ownership = this.defaultOwnership.get(avatar);
        ownership?.delete(attribute);
        if (ownership?.size === 0) this.defaultOwnership.delete(avatar);
      }
      this.applyGroupDefaults();
      this.recomputeWindow();
      this.applyVisibilityMarkers();
    });
    this.avatarObserver = observer;
    for (const avatar of avatars) {
      observer.observe(avatar, {
        attributes: true,
        attributeFilter: ['hidden', 'inert', 'size', 'shape', 'variant'],
      });
    }
  }

  private disconnectAvatarObserver(): void {
    this.avatarObserver?.disconnect();
    for (const avatar of this.observedAvatars)
      this.pendingOwnedAttributeWrites.delete(avatar);
    this.avatarObserver = undefined;
    this.avatarObserverWindow = undefined;
    this.observedAvatars = Object.freeze([]);
  }

  private markOwnedAttributeWrite(
    avatar: LyraAvatar,
    attribute: AvatarPresentationAttribute
  ): void {
    if (!this.avatarObserver || !this.observedAvatars.includes(avatar)) return;
    let writes = this.pendingOwnedAttributeWrites.get(avatar);
    if (!writes) {
      writes = new Map();
      this.pendingOwnedAttributeWrites.set(avatar, writes);
    }
    writes.set(attribute, (writes.get(attribute) ?? 0) + 1);
  }

  private consumeOwnedAttributeWrite(
    avatar: LyraAvatar,
    attribute: AvatarPresentationAttribute
  ): boolean {
    const writes = this.pendingOwnedAttributeWrites.get(avatar);
    const count = writes?.get(attribute) ?? 0;
    if (count === 0) return false;
    if (count === 1) writes!.delete(attribute);
    else writes!.set(attribute, count - 1);
    if (writes!.size === 0) this.pendingOwnedAttributeWrites.delete(avatar);
    return true;
  }

  private applyGroupDefaults(): void {
    const values = {
      size: this.size,
      shape: this.shape,
      variant: this.variant,
    } as const;
    for (const avatar of this.assignedAvatars) {
      let ownership = this.defaultOwnership.get(avatar);
      for (const attribute of ['size', 'shape', 'variant'] as const) {
        const applied = ownership?.get(attribute);
        if (applied != null && avatar.getAttribute(attribute) !== applied) {
          ownership!.delete(attribute);
        }
        if (!avatar.hasAttribute(attribute)) {
          ownership ??= new Map();
          ownership.set(attribute, values[attribute]);
          this.markOwnedAttributeWrite(avatar, attribute);
          avatar.setAttribute(attribute, values[attribute]);
        } else if (
          ownership?.has(attribute) &&
          avatar.getAttribute(attribute) === applied &&
          applied !== values[attribute]
        ) {
          ownership.set(attribute, values[attribute]);
          this.markOwnedAttributeWrite(avatar, attribute);
          avatar.setAttribute(attribute, values[attribute]);
        }
      }
      if (ownership?.size) this.defaultOwnership.set(avatar, ownership);
      else this.defaultOwnership.delete(avatar);
    }
  }

  private applyVisibilityMarkers(): void {
    const hidden = new Set(this.overflowHiddenAvatars);
    const firstVisible = this.assignedAvatars.find(
      (avatar) =>
        !avatar.hasAttribute('hidden') &&
        !avatar.hasAttribute('inert') &&
        !hidden.has(avatar)
    );
    for (const avatar of this.assignedAvatars) {
      if (hidden.has(avatar))
        avatar.setAttribute('data-lr-avatar-group-hidden', '');
      else avatar.removeAttribute('data-lr-avatar-group-hidden');
      if (avatar === firstVisible)
        avatar.setAttribute('data-lr-avatar-group-first', '');
      else avatar.removeAttribute('data-lr-avatar-group-first');
    }
  }

  private restoreAvatarState(avatar: LyraAvatar): void {
    avatar.removeAttribute('data-lr-avatar-group-hidden');
    avatar.removeAttribute('data-lr-avatar-group-first');
    const ownership = this.defaultOwnership.get(avatar);
    if (ownership) {
      for (const [attribute, applied] of ownership) {
        if (avatar.getAttribute(attribute) === applied)
          avatar.removeAttribute(attribute);
      }
      this.defaultOwnership.delete(avatar);
    }
  }

  private restoreOwnedState(): void {
    for (const avatar of this.assignedAvatars) this.restoreAvatarState(avatar);
    this.assignedAvatars = Object.freeze([]);
    this.overflowHiddenAvatars = Object.freeze([]);
    this.eligibleAvatarCount = 0;
  }

  private onSlotChange = (e: Event): void => {
    const slot = e.target as HTMLSlotElement;
    this.updateBrowserDerivedState(() => {
      if (!this.isConnected) return;
      this.reconcileAvatars(slot.assignedElements({ flatten: true }));
    });
  };

  private onOverflowClick = (): void => {
    const hiddenAvatars = Object.freeze([...this.overflowHiddenAvatars]);
    this.emit(
      'lr-overflow-click',
      Object.freeze({
        hiddenCount: hiddenAvatars.length,
        hiddenAvatars,
      })
    );
  };

  override render(): TemplateResult {
    const overflowing = this.hasOverflow;
    const hiddenCount = this.hiddenCount;
    // The badge is the first *visible* element in the row only when every avatar is hidden
    // (max <= 0) — there's no selector that can express "first visible thing regardless of DOM
    // position", so the margin override is computed here instead of in CSS.
    const badgeIsFirstVisible =
      overflowing && hiddenCount === this.eligibleAvatarCount;
    const accessibleLabel = hostAriaLabel(this) ?? (this.label || nothing);
    const localizedHiddenCount = getNumberFormat(this.effectiveLocale).format(
      hiddenCount
    );

    return html`
      <div part="base" role="group" aria-label=${accessibleLabel}>
        <slot @slotchange=${this.onSlotChange}></slot>
        ${overflowing
          ? html`<button
              part="overflow-badge"
              type="button"
              ?data-first-visible=${badgeIsFirstVisible}
              aria-label=${this.localize('showMoreCount', undefined, {
                count: localizedHiddenCount,
              })}
              @click=${this.onOverflowClick}
            >
              <span part="overflow-badge-visual" aria-hidden="true"
                >${this.localize('showMoreCollapsed', undefined, {
                  count: localizedHiddenCount,
                })}</span
              >
            </button>`
          : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-avatar-group': LyraAvatarGroup;
  }
}

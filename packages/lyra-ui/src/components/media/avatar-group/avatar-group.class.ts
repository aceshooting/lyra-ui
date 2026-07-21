import { html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteCount } from '../../../internal/numbers.js';
import { styles } from './avatar-group.styles.js';
// Type-only import — erased at build. Importing the value module (`avatar.ts`/`avatar.js`) here
// would side-effect-register `<lr-avatar>` just from importing `<lr-avatar-group>`, which this
// component must not do: consumers register `lr-avatar` themselves.
import type { AvatarSize, AvatarShape, AvatarTone, LyraAvatar } from '../avatar/avatar.class.js';

export interface AvatarGroupOverflowClickDetail {
  hiddenCount: number;
  hiddenAvatars: LyraAvatar[];
}

export interface LyraAvatarGroupEventMap {
  'lr-overflow-click': CustomEvent<AvatarGroupOverflowClickDetail>;
}

/**
 * `<lr-avatar-group>` — stacks a set of slotted `<lr-avatar>` children into a single
 * overlapping row (negative-margin overlap, ring border so each circle reads as distinct) and,
 * past a configurable `max` count, collapses the excess into a "+N" overflow badge. First-party
 * invention (no Web Awesome equivalent), composed over `<lr-avatar>` rather than reimplementing
 * it — plain light-DOM slotted content is the group's items, the same shape `<lr-split>`'s
 * panels / `<lr-source-list>`'s cards / `<lr-chip-group>`'s chips already use, not a
 * `.items` array prop.
 *
 * **`size`/`shape`/`tone` do not cascade onto slotted avatars.** They drive only this
 * component's own ring, overlap amount, and the overflow badge's rendering — they cannot resize
 * or reshape the `<lr-avatar>` children themselves, since each avatar's own `--lr-avatar-size`
 * lives inside *its own* shadow-scoped `:host` block and unconditionally overrides anything of
 * the same custom-property name inherited from an ancestor. This mirrors every other group
 * component in this library (`button-group`, `checkbox-group`, `radio`): none of them cascade a
 * size/variant prop onto their children either. The consumer is responsible for setting a
 * matching `size`/`shape` on both the group and each `<lr-avatar>` child for a visually coherent
 * stack.
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
 * @slot - `<lr-avatar>` elements (or any content, though the avatar pairing is the intended
 * usage).
 * @event lr-overflow-click - The overflow badge was activated (click, or Enter/Space while
 * focused — native `<button>` behavior). `detail: { hiddenCount, hiddenAvatars }` where
 * `hiddenAvatars` is the current set of children the component has hidden past `max`.
 * Non-cancelable — informational hook, no default action to veto.
 * @csspart base - The outer inline-flex container (holds the slot and the overflow badge).
 * @csspart overflow-badge - The "+N" button. Only rendered while `max` is actively causing an
 * overflow.
 * @cssprop [--lr-avatar-group-avatar-size=var(--lr-size-2rem)] - Sizes the overflow badge to
 * match the slotted avatars. Does not resize the avatars themselves (see class doc) — set a
 * matching `size` on each `<lr-avatar>` child directly for that.
 * @cssprop [--lr-avatar-group-overlap=var(--lr-size-neg-6px)] - Horizontal overlap between
 * consecutive avatars (a logical `margin-inline-start`, so it auto-mirrors under `dir="rtl"`).
 * Setting this to `0` or a positive length is a supported escape hatch that turns the stack into
 * normal, non-overlapping spacing.
 * @cssprop [--lr-avatar-group-ring-color=var(--lr-color-surface)] - The cutout-style ring
 * drawn around every avatar and the overflow badge.
 * @cssprop [--lr-avatar-group-ring-width=var(--lr-border-width-medium)] - Ring thickness.
 * @cssprop [--lr-avatar-group-badge-bg=var(--lr-color-border)] - Overflow badge background.
 * Tone-driven; see `tone`.
 * @cssprop [--lr-avatar-group-badge-color=var(--lr-color-text)] - Overflow badge text color.
 * Tone-driven; see `tone`.
 * @cssprop [--lr-avatar-group-badge-font-size=var(--lr-font-size-sm)] - Font size of the "+N"
 * badge label. `size` swaps it to `var(--lr-font-size-xs)` (`sm`) or `var(--lr-font-size-md)`
 * (`lg`), matching `<lr-avatar>`'s own `--lr-avatar-font-size` scale so the badge and the avatars
 * it caps read at the same optical weight.
 */
export class LyraAvatarGroup extends LyraElement<LyraAvatarGroupEventMap> {
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

  /** Visual size, reused verbatim from `<lr-avatar>`'s own `AvatarSize` union. Drives the
   *  overflow badge's size and the overlap amount — does not resize slotted avatars (see class
   *  doc). */
  @property({ reflect: true }) size: AvatarSize = 'md';

  /** `'circle'` (the default) or `'square'`, reused verbatim from `<lr-avatar>`'s own
   *  `AvatarShape` union. Drives the overflow badge's shape — does not reshape slotted avatars
   *  (see class doc); each avatar's own ring already adapts to that avatar's own `shape`
   *  attribute independently. */
  @property({ reflect: true }) shape: AvatarShape = 'circle';

  /** Recolors the overflow badge, reused verbatim from `<lr-avatar>`'s own `AvatarTone` union.
   *  `'neutral'` (the default) reads as a plain, unaccented badge. */
  @property({ reflect: true }) tone: AvatarTone = 'neutral';

  /** The group's own accessible name (`role="group"`'s `aria-label`). A host-level `aria-label`
   *  wins if both are set. Unset (the default) renders no `aria-label` at all — a screen reader
   *  announces "group" with no name, then reads each avatar's own accessible name in turn. */
  @property() label = '';

  // Tracks the default slot's assigned-element count, the same connectedCallback/willUpdate +
  // slotchange convention `<lr-chip-group>`'s `childCount` already establishes.
  @state() private childCount = 0;

  protected override willUpdate(): void {
    if (!this.hasUpdated) {
      this.childCount = this.children.length;
    }
  }

  override firstUpdated(): void {
    // Fallback reconciliation for slot-forwarding / engines that don't fire `slotchange` for
    // content present at parse time — same idiom as `<lr-chip-group>`'s identical
    // `firstUpdated`. `updated()` (below) always runs right after this and recomputes visibility
    // from this same corrected count.
    const slot = this.shadowRoot!.querySelector('slot') as HTMLSlotElement;
    this.childCount = slot.assignedElements({ flatten: true }).length;
  }

  protected override updated(): void {
    this.syncChildVisibility();
  }

  private get hasOverflow(): boolean {
    // `max`'s own accessor already sanitizes to a finite, non-negative integer (or `undefined`)
    // on assignment, so no further finiteness check is needed here.
    const max = this.max;
    return max != null && this.childCount > max;
  }

  private get hiddenCount(): number {
    return this.hasOverflow ? this.childCount - (this.max as number) : 0;
  }

  private syncChildVisibility(): void {
    const overflowing = this.hasOverflow;
    const max = this.max as number;
    const slot = this.shadowRoot?.querySelector('slot');
    const assignedChildren = slot?.assignedElements({ flatten: true }) ?? Array.from(this.children);
    assignedChildren.forEach((child, i) => {
      (child as HTMLElement).hidden = overflowing && i >= max;
    });
  }

  private onSlotChange = (e: Event): void => {
    this.childCount = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length;
  };

  private onOverflowClick = (): void => {
    const slot = this.shadowRoot!.querySelector('slot') as HTMLSlotElement;
    const hiddenAvatars = slot.assignedElements({ flatten: true }).slice(this.max as number) as LyraAvatar[];
    this.emit<AvatarGroupOverflowClickDetail>('lr-overflow-click', {
      hiddenCount: hiddenAvatars.length,
      hiddenAvatars,
    });
  };

  override render(): TemplateResult {
    const overflowing = this.hasOverflow;
    const hiddenCount = this.hiddenCount;
    // The badge is the first *visible* element in the row only when every avatar is hidden
    // (max <= 0) — there's no selector that can express "first visible thing regardless of DOM
    // position", so the margin override is computed here instead of in CSS.
    const badgeIsFirstVisible = overflowing && hiddenCount === this.childCount;
    const accessibleLabel = this.getAttribute('aria-label') || this.label || nothing;

    return html`
      <div part="base" role="group" aria-label=${accessibleLabel}>
        <slot @slotchange=${this.onSlotChange}></slot>
        ${overflowing
          ? html`<button
              part="overflow-badge"
              type="button"
              style=${styleMap({ marginInlineStart: badgeIsFirstVisible ? '0' : undefined })}
              aria-label=${this.localize('showMoreCount', undefined, { count: hiddenCount })}
              @click=${this.onOverflowClick}
            >${this.localize('showMoreCollapsed', undefined, { count: hiddenCount })}</button>`
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

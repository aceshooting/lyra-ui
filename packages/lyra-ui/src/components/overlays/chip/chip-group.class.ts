import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteCount } from '../../../internal/numbers.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { deepActiveElementIn } from '../../../internal/active-element.js';
import {
  applyComposedFocusRepair,
  captureComposedFocusRepair,
  collectComposedFocusTargets,
  type ComposedFocusRepairSnapshot,
} from '../../../internal/focus-navigation.js';
import { composedContains } from '../../../internal/overlay-manager.js';
import { styles } from './chip-group.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_showLess, LYRA_DEFAULT_showMoreCollapsed, LYRA_DEFAULT_showMoreCount } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export interface ChipGroupOverflowToggleDetail {
  expanded: boolean;
}

export interface LyraChipGroupEventMap {
  'lr-overflow-toggle': CustomEvent<ChipGroupOverflowToggleDetail>;
}

interface TrackedChipFocus {
  child: HTMLElement;
  index: number;
  repair: ComposedFocusRepairSnapshot;
}

/**
 * `<lr-chip-group>` — a flex-wrap container for a set of `<lr-chip>`
 * children (plain light-DOM composition — direct children are the chips,
 * the same shape `<lr-multi-split>`'s panels / `<lr-source-list>`'s cards
 * take — no `.items` array prop).
 *
 * `max-visible` is entirely optional. When unset, every child is always
 * shown and this component does nothing beyond flex-wrap layout. When set
 * and the group has more chip children than that, the excess children are
 * hidden (via their own `hidden` property — CSS alone can't parameterize
 * `:nth-child` on a runtime prop, so this reaches into the light DOM the
 * same way `<lr-multi-split>` sets each panel's inline `flex`/`order`) and a
 * "+N" overflow-indicator pill takes their place. Clicking it is a toggle:
 * it reveals the rest (and relabels itself "Show less"); clicking again
 * re-collapses back to `max-visible`. `lr-overflow-toggle` fires only from
 * that click — i.e. only when `max-visible` is actually causing an overflow
 * state — never as a side effect of `max-visible`/children changing on
 * their own.
 *
 * Author-owned `hidden` changes remain live while collapse management is active. The latest author
 * state is restored when a child leaves or the group disconnects, and reconnecting reapplies the
 * current collapsed state.
 *
 * @customElement lr-chip-group
 * @slot - `<lr-chip>` elements (or any content, though the chip pairing is
 * the intended usage).
 * @event lr-overflow-toggle - The overflow indicator was activated,
 * revealing or re-collapsing the excess children. `detail: { expanded }`.
 * @csspart base - The flex-wrap container (holds both the slot and the overflow indicator).
 * @csspart overflow-indicator - The "+N" / "Show less" toggle button. Only rendered while `max-visible` is actively causing an overflow.
 * @cssprop [--lr-chip-group-overflow-expanded-color=var(--lr-color-text)] - Text color of
 *   `[part="overflow-indicator"]` while expanded (`aria-expanded="true"`).
 *   `::part(overflow-indicator)[aria-expanded='true']` is invalid CSS, so this is the only way to
 *   retint the expanded state without re-pointing the shared `--lr-color-text` token.
 * @cssprop [--lr-chip-group-overflow-expanded-border-style=solid] - Border style of
 *   `[part="overflow-indicator"]` while expanded. The resting indicator intentionally stays
 *   dashed, so this can retune the expanded state without losing that structural affordance.
 * @status stable
 * @since 4.0.0
 */
export class LyraChipGroup extends LyraElement<LyraChipGroupEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    showLess: LYRA_DEFAULT_showLess,
    showMoreCollapsed: LYRA_DEFAULT_showMoreCollapsed,
    showMoreCount: LYRA_DEFAULT_showMoreCount,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  private _maxVisible?: number;
  /** Maximum number of assigned children shown before the rest collapse behind a "+N"
   *  indicator. Flattened slot-forwarded children count the same as direct light-DOM children.
   *  Unset (the default) means no limit — every child is always shown. Any explicitly assigned
   *  value is sanitized to a finite, non-negative integer via `finiteCount` — this feeds the
   *  `hasOverflow`/`syncChildVisibility` index comparisons below directly, so a NaN/negative value
   *  must never reach them. */
  @property({ type: Number, attribute: 'max-visible' })
  get maxVisible(): number | undefined {
    return this._maxVisible;
  }
  set maxVisible(next: number | undefined | null) {
    const old = this._maxVisible;
    this._maxVisible = next == null ? undefined : finiteCount(next);
    this.requestUpdate('maxVisible', old);
  }

  // Tracks the default slot's assigned-element count, the same
  // connectedCallback/willUpdate + slotchange convention `<lr-multi-split>`'s
  // `panelCount`/`<lr-source-list>`'s `slottedCount` already establish.
  @state() private childCount = 0;

  /** Whether the excess (beyond `max-visible`) children are currently
   *  revealed. Meaningless (and never rendered) while there's no overflow. */
  @state() private expanded = false;
  private readonly authorHidden = new Map<Element, boolean>();
  private readonly observedChildren = new Set<Element>();
  private readonly pendingHiddenWrites = new Map<Element, boolean[]>();
  private visibilityObserver?: MutationObserver;
  private visibilityObserverDocument?: Document;
  private visibilityObserverGeneration = 0;
  private trackedChipFocus?: TrackedChipFocus;

  override connectedCallback(): void {
    super.connectedCallback();
    this.armVisibilityObserver();
    // A synchronous disconnect/reconnect has no reactive property change, so updated() does not
    // rerun. Re-snapshot the restored author state and reapply collapse ownership immediately.
    if (this.hasUpdated) this.reconcileChildVisibilityAndFocus();
  }

  private armVisibilityObserver(): void {
    const ownerDocument = this.ownerDocument;
    if (!this.isConnected) return;
    if (this.visibilityObserver && this.visibilityObserverDocument === ownerDocument) return;
    this.resetVisibilityObserver();
    const MutationObserverCtor = ownerDocument.defaultView?.MutationObserver;
    if (!MutationObserverCtor) return;
    const generation = this.visibilityObserverGeneration;
    const observer = new MutationObserverCtor((records) => {
      if (
        this.visibilityObserver !== observer ||
        this.visibilityObserverDocument !== ownerDocument ||
        this.visibilityObserverGeneration !== generation ||
        !this.isConnected ||
        this.ownerDocument !== ownerDocument
      ) {
        return;
      }
      if (this.processHiddenMutations(records)) {
        this.reconcileChildVisibilityAndFocus();
        this.requestUpdate();
      }
    });
    this.visibilityObserver = observer;
    this.visibilityObserverDocument = ownerDocument;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (!this.hasUpdated) this.seedFirstRenderState(() => {
      this.childCount = this.children.length;
    });
    // max-visible/children can change out from under an already-expanded
    // group (e.g. the consumer raises max-visible past the current count) —
    // silently resync rather than leaving `expanded` stuck true with nothing
    // left for it to mean. This never fires the event: only an actual click
    // on the indicator does (see the class doc). Corrected here (not in
    // `updated()`) so it folds into the update already in progress instead
    // of scheduling a second one.
    if (this.expanded && !this.hasOverflow) this.expanded = false;
  }

  override firstUpdated(changed: PropertyValues<this>): void {
    super.firstUpdated(changed);
    // Resolve forwarded slots after the first update has completed. Mutating reactive state
    // inside firstUpdated() produces Lit's "scheduled an update" warning and makes hydration
    // timing observable to consumers.
    const slot = this.shadowRoot!.querySelector('slot') as HTMLSlotElement;
    queueMicrotask(() => {
      if (!this.isConnected) return;
      this.updateBrowserDerivedState(() => {
        this.childCount = slot.assignedElements({ flatten: true }).length;
      });
    });
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    this.reconcileChildVisibilityAndFocus();
  }

  override disconnectedCallback(): void {
    this.resetVisibilityObserver();
    this.observedChildren.clear();
    this.pendingHiddenWrites.clear();
    this.trackedChipFocus = undefined;
    this.restoreChildVisibility();
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.resetVisibilityObserver();
    this.observedChildren.clear();
    this.pendingHiddenWrites.clear();
    this.trackedChipFocus = undefined;
  }

  private resetVisibilityObserver(): void {
    this.visibilityObserverGeneration += 1;
    this.visibilityObserver?.disconnect();
    this.visibilityObserver = undefined;
    this.visibilityObserverDocument = undefined;
  }

  private get hasOverflow(): boolean {
    // `maxVisible`'s own accessor already sanitizes to a finite, non-negative integer (or
    // `undefined`) on assignment, so no further finiteness check is needed here.
    const max = this.maxVisible;
    return max != null && this.childCount > 0 && this.eligibleChildren().length > max;
  }

  private assignedChildren(): Element[] {
    const slot = this.shadowRoot?.querySelector('slot');
    return slot?.assignedElements({ flatten: true }) ?? Array.from(this.children);
  }

  private isAuthorHidden(child: Element): boolean {
    return this.authorHidden.get(child) ?? child.hasAttribute('hidden');
  }

  private isCapacityEligible(child: Element): boolean {
    return !this.isAuthorHidden(child) && !child.hasAttribute('inert');
  }

  private eligibleChildren(children = this.assignedChildren()): Element[] {
    return children.filter((child) => this.isCapacityEligible(child));
  }

  private childWillBeVisible(child: Element, assignedChildren: Element[]): boolean {
    if (!this.isCapacityEligible(child)) return !this.isAuthorHidden(child);
    const eligibleIndex = this.eligibleChildren(assignedChildren).indexOf(child);
    const managedHidden = this.hasOverflow && !this.expanded && eligibleIndex >= (this.maxVisible as number);
    return !managedHidden;
  }

  private focusRepairBeforeVisibility(
    assignedChildren: Element[],
  ): { index: number; repair: ComposedFocusRepairSnapshot } | null {
    const tracked = this.trackedChipFocus;
    if (!tracked) return null;
    const currentIndex = assignedChildren.indexOf(tracked.child);
    if (currentIndex >= 0 && this.childWillBeVisible(tracked.child, assignedChildren)) {
      tracked.index = currentIndex;
      return null;
    }

    const active = deepActiveElementIn(this.ownerDocument);
    const stillOwnsFocus = active !== null && composedContains(tracked.child, active);
    const focusWasLostWithRemovedBranch =
      currentIndex < 0 &&
      (active === null || active === this.ownerDocument.body || active === this.ownerDocument.documentElement);
    const focusWasLostWithAlreadyHiddenBranch =
      tracked.child.hasAttribute('hidden') &&
      (active === null || active === this.ownerDocument.body || active === this.ownerDocument.documentElement);
    if (!stillOwnsFocus && !focusWasLostWithRemovedBranch && !focusWasLostWithAlreadyHiddenBranch) {
      return null;
    }
    return {
      index: currentIndex >= 0 ? currentIndex : tracked.index,
      repair: tracked.repair,
    };
  }

  private focusTargetAfterVisibility(
    assignedChildren: Element[],
    originIndex: number,
  ): HTMLElement | null {
    const chipTargets = assignedChildren
      .map((child, index) => ({
        index,
        target: collectComposedFocusTargets(child, {
          includeRoot: false,
          mode: 'programmatic',
        }).elements[0],
      }))
      .filter((entry): entry is { index: number; target: HTMLElement } => entry.target !== undefined)
      .sort((first, second) => {
        const distance = Math.abs(first.index - originIndex) - Math.abs(second.index - originIndex);
        return distance || first.index - second.index;
      });
    if (chipTargets[0]) return chipTargets[0].target;

    const disclosure = this.renderRoot.querySelector<HTMLElement>('[part="overflow-indicator"]');
    if (disclosure) {
      const available = collectComposedFocusTargets(disclosure, {
        mode: 'programmatic',
      }).elements[0];
      if (available) return available;
    }
    const base = this.renderRoot.querySelector<HTMLElement>('[part="base"]');
    if (!base) return null;
    return collectComposedFocusTargets(base, {
      mode: 'programmatic',
    }).elements.find((target) => target === base) ?? null;
  }

  private reconcileChildVisibilityAndFocus(): void {
    const assignedChildren = this.assignedChildren();
    const focusRepair = this.focusRepairBeforeVisibility(assignedChildren);
    this.syncChildVisibility(assignedChildren);
    if (!focusRepair) return;
    const candidate = this.focusTargetAfterVisibility(assignedChildren, focusRepair.index);
    this.trackedChipFocus = undefined;
    if (candidate) {
      applyComposedFocusRepair(focusRepair.repair, candidate);
    }
  }

  private syncChildVisibility(assignedChildren = this.assignedChildren()): void {
    const max = this.maxVisible;
    const overflowing = this.hasOverflow;
    this.observeChildren(assignedChildren);
    const current = new Set(assignedChildren);
    for (const [child, hidden] of this.authorHidden) {
      if (!current.has(child)) {
        child.toggleAttribute('hidden', hidden);
        this.authorHidden.delete(child);
      }
    }
    let eligibleIndex = 0;
    assignedChildren.forEach((element) => {
      if (!this.authorHidden.has(element)) this.authorHidden.set(element, element.hasAttribute('hidden'));
      const authored = this.authorHidden.get(element) ?? false;
      const eligible = !authored && !element.hasAttribute('inert');
      const managed = eligible && overflowing && !this.expanded && eligibleIndex >= (max as number);
      this.setManagedHidden(element, authored || managed);
      if (eligible) eligibleIndex += 1;
    });
  }

  private observeChildren(children: Element[]): void {
    const next = new Set(children);
    if (
      next.size === this.observedChildren.size &&
      [...next].every((child) => this.observedChildren.has(child))
    ) {
      return;
    }
    const queued = this.visibilityObserver?.takeRecords() ?? [];
    if (queued.length > 0) this.processHiddenMutations(queued);
    this.visibilityObserver?.disconnect();
    this.observedChildren.clear();
    for (const child of children) {
      this.visibilityObserver?.observe(child, {
        attributes: true,
        attributeFilter: ['hidden', 'inert'],
        attributeOldValue: true,
      });
      this.observedChildren.add(child);
    }
  }

  private processHiddenMutations(records: MutationRecord[]): boolean {
    let authorChanged = false;
    for (let index = 0; index < records.length; index++) {
      const record = records[index];
      if (!record || record.type !== 'attributes') continue;
      const child = record.target as Element;
      if (!this.authorHidden.has(child)) continue;
      if (record.attributeName === 'inert') {
        authorChanged = true;
        continue;
      }
      if (record.attributeName !== 'hidden') continue;
      let nextRecord: MutationRecord | undefined;
      for (let nextIndex = index + 1; nextIndex < records.length; nextIndex++) {
        const candidate = records[nextIndex];
        if (candidate?.type === 'attributes' && candidate.attributeName === 'hidden' && candidate.target === child) {
          nextRecord = candidate;
          break;
        }
      }
      const hidden = nextRecord ? nextRecord.oldValue !== null : child.hasAttribute('hidden');
      const pending = this.pendingHiddenWrites.get(child);
      if (pending?.[0] === hidden) {
        pending.shift();
        if (pending.length === 0) this.pendingHiddenWrites.delete(child);
        continue;
      }
      this.authorHidden.set(child, hidden);
      authorChanged = true;
    }
    return authorChanged;
  }

  private setManagedHidden(child: Element, hidden: boolean): void {
    if (child.hasAttribute('hidden') === hidden) return;
    let pending = this.pendingHiddenWrites.get(child);
    if (!pending) {
      pending = [];
      this.pendingHiddenWrites.set(child, pending);
    }
    pending.push(hidden);
    child.toggleAttribute('hidden', hidden);
  }

  private restoreChildVisibility(): void {
    for (const [child, hidden] of this.authorHidden) child.toggleAttribute('hidden', hidden);
    this.authorHidden.clear();
  }

  private onSlotChange = (e: Event): void => {
    const slot = e.target as HTMLSlotElement;
    this.updateBrowserDerivedState(() => {
      if (!this.isConnected) return;
      this.childCount = slot.assignedElements({ flatten: true }).length;
    });
  };

  private onFocusIn = (): void => {
    const active = deepActiveElementIn(this.ownerDocument);
    const children = this.assignedChildren();
    const index = children.findIndex((child) => composedContains(child, active));
    const base = this.renderRoot.querySelector<HTMLElement>('[part="base"]');
    if (index < 0 || !base) {
      this.trackedChipFocus = undefined;
      return;
    }
    const child = children[index]!;
    if (!('focus' in child)) {
      this.trackedChipFocus = undefined;
      return;
    }
    const repair = captureComposedFocusRepair(child, base);
    this.trackedChipFocus = repair ? { child: child as HTMLElement, index, repair } : undefined;
  };

  private onFocusOut = (): void => {
    const tracked = this.trackedChipFocus;
    if (!tracked) return;
    queueMicrotask(() => {
      if (this.trackedChipFocus !== tracked) return;
      const active = deepActiveElementIn(this.ownerDocument);
      if (active !== null && composedContains(tracked.child, active)) return;
      const lostWithRemovedBranch =
        !tracked.child.isConnected &&
        (active === null || active === this.ownerDocument.body || active === this.ownerDocument.documentElement);
      if (!lostWithRemovedBranch) this.trackedChipFocus = undefined;
    });
  };

  private onToggleOverflow = (): void => {
    this.expanded = !this.expanded;
    this.emit('lr-overflow-toggle', { expanded: this.expanded });
  };

  override render(): TemplateResult {
    const overflowing = this.hasOverflow;
    const hiddenCount = overflowing ? this.eligibleChildren().length - (this.maxVisible as number) : 0;
    const formattedHiddenCount = getNumberFormat(this.effectiveLocale).format(hiddenCount);

    return html`
      <div part="base" tabindex="-1" @focusin=${this.onFocusIn} @focusout=${this.onFocusOut}>
        <slot @slotchange=${this.onSlotChange}></slot>
        ${overflowing
          ? html`<button
              part="overflow-indicator"
              type="button"
              aria-expanded=${this.expanded ? 'true' : 'false'}
              aria-label=${this.expanded ? this.localize('showLess') : this.localize('showMoreCount', undefined, { count: formattedHiddenCount })}
              @click=${this.onToggleOverflow}
            >
              ${this.expanded
                ? this.localize('showLess')
                : this.localize('showMoreCollapsed', undefined, { count: formattedHiddenCount })}
            </button>`
          : nothing}
      </div>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-chip-group': LyraChipGroup;
  }
}

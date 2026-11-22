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
import { blankNumberConverter, literalSetConverter } from '../../../internal/converters.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_showLess, LYRA_DEFAULT_showMoreCollapsed, LYRA_DEFAULT_showMoreOverflowLabel } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export interface ChipGroupOverflowToggleDetail {
  expanded: boolean;
}

/** How a chip group manages its toggleable chips: `none` (default) leaves them alone. */
export type LyraChipGroupSelection = 'none' | 'single' | 'multiple';

export interface ChipGroupChangeDetail {
  /** The new selection: a string (empty when nothing is selected) in `single`, an array in `multiple`. */
  value: string | string[];
}

export interface LyraChipGroupEventMap {
  'lr-overflow-toggle': CustomEvent<ChipGroupOverflowToggleDetail>;
  'lr-change': CustomEvent<ChipGroupChangeDetail>;
}

const SELECTION = literalSetConverter<LyraChipGroupSelection>(['none', 'single', 'multiple'], 'none');

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
 * Collapsed groups reapply max-visible when assigned children are replaced or reordered at the same count, preserving authored hidden/inert state and releasing departed visibility leases.
 *
 * An opt-in selection model turns the group into a filter bar. `selection="single"` or `"multiple"`
 * makes the group own the pressed state of every direct `<lr-chip>` child that has a `value`: it
 * sets them `toggleable`, presses the ones named by `value`, and, in `single`, releases the others
 * when one is pressed. Pressing a pressed chip releases it, so the selection may be empty. A chip
 * without a `value` is left alone. `value` is a string in `single` and an array in `multiple`; as an
 * attribute it is the string, comma-separated in `multiple`. An unknown value is kept (it simply
 * presses no chip). Setting `value` is silent; `lr-change` fires only from a user press.
 * `all-value` names an optional "all" chip, the child whose `value` equals it: it is pressed while
 * the selection is empty, pressing it clears the selection, and it cannot be un-pressed. It is never
 * part of `value`. With `selection` unset the group behaves exactly as before.
 *
 * @customElement lr-chip-group
 * @slot - `<lr-chip>` elements (or any content, though the chip pairing is
 * the intended usage).
 * @event lr-overflow-toggle - The overflow indicator was activated,
 * revealing or re-collapsing the excess children. `detail: { expanded }`.
 * @event lr-change - A user press changed the selection (`selection` is `single` or `multiple`).
 * `detail: { value }`.
 * @csspart base - The flex-wrap container (holds both the slot and the overflow indicator).
 *   Carries `role="group"` and the accessible name when one is supplied -- see `accessibleLabel`.
 * @csspart overflow-indicator - The "+N" / "Show less" toggle button. Only rendered while `max-visible` is actively causing an overflow.
 * @cssprop [--lr-chip-group-gap=var(--lr-space-xs)] - Gap between `[part="base"]`'s wrapped
 *   children, chips and the overflow indicator alike.
 * @cssprop [--lr-chip-group-overflow-expanded-color=var(--lr-color-text)] - Text color of
 *   `[part="overflow-indicator"]` while expanded (`aria-expanded="true"`).
 *   `::part(overflow-indicator)[aria-expanded='true']` is invalid CSS, so this is the only way to
 *   retint the expanded state without re-pointing the shared `--lr-color-text` token.
 * @cssprop [--lr-chip-group-overflow-expanded-border-style=solid] - Border style of
 *   `[part="overflow-indicator"]` while expanded. The resting indicator intentionally stays
 *   dashed, so this can retune the expanded state without losing that structural affordance.
 * @cssprop --lr-chip-group-overflow-bg - Overflow indicator background.
 * @cssprop --lr-chip-group-overflow-color - Overflow indicator text color.
 * @cssprop --lr-chip-group-overflow-border-color - Overflow indicator border color.
 * @cssprop [--lr-chip-group-overflow-hover-border-color=var(--lr-color-brand)] - Overflow indicator
 *   border color while hovered or pressed.
 * @cssprop [--lr-chip-group-overflow-hover-color=var(--lr-color-text)] - Overflow indicator text
 *   color while hovered or pressed.
 * @cssprop --lr-chip-group-overflow-hover-bg - Overflow indicator hover background. Defaults to its
 *   resting fill.
 * @cssprop --lr-chip-group-overflow-active-bg - Overflow indicator pressed background. Defaults to
 *   the hover background mixed by the press step.
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
    showMoreOverflowLabel: LYRA_DEFAULT_showMoreOverflowLabel,
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
  @property({ converter: blankNumberConverter(undefined), attribute: 'max-visible' })
  get maxVisible(): number | undefined {
    return this._maxVisible;
  }
  set maxVisible(next: number | undefined | null) {
    const old = this._maxVisible;
    this._maxVisible = next == null ? undefined : finiteCount(next);
    this.requestUpdate('maxVisible', old);
  }

  private _selection: LyraChipGroupSelection = 'none';
  /** `none` (default): the group does not manage chip state. `single` allows zero or one pressed
   *  chip, `multiple` any number. Unsupported values fall back to `none`. */
  @property({ reflect: true, useDefault: true, converter: SELECTION })
  get selection(): LyraChipGroupSelection {
    return this._selection;
  }
  set selection(next: LyraChipGroupSelection) {
    const normalized = SELECTION.normalizeReflected(this, 'selection', next);
    const old = this._selection;
    if (old === normalized) return;
    this._selection = normalized;
    // An attribute set before `selection` (value="a,b" selection="multiple") was read in the old
    // mode; read the author's raw assignment again in the new one.
    this.selectedValues = this.parseSelection(this.rawValue);
    this.requestUpdate('selection', old);
  }

  private selectedValues: string[] = [];
  private rawValue: string | readonly string[] | null | undefined;

  private parseSelection(next: string | readonly string[] | null | undefined): string[] {
    const list = next == null ? [] : typeof next === 'string' ? (this.selection === 'multiple' ? next.split(',') : [next]) : [...next];
    const cleaned = [...new Set(list.map((entry) => String(entry).trim()).filter((entry) => entry !== ''))];
    return this.selection === 'multiple' ? cleaned : cleaned.slice(0, 1);
  }

  /** The pressed chips' values: a string in `single` (empty when none), an array otherwise. In
   *  `single` an array assignment keeps its first entry; in `multiple` a string is read as a
   *  comma-separated list. `null`/`undefined` clears. Silent: never fires `lr-change`.
   *  @default '' */
  @property()
  get value(): string | string[] {
    return this.selection === 'multiple' ? [...this.selectedValues] : (this.selectedValues[0] ?? '');
  }
  set value(next: string | readonly string[] | null | undefined) {
    const old = this.value;
    this.rawValue = next;
    this.selectedValues = this.parseSelection(next);
    this.requestUpdate('value', old);
  }

  /** The `value` of the optional "all" chip (selection mode only). Unset means no all chip. */
  @property({ attribute: 'all-value' }) allValue?: string;

  /**
   * Accessible name for the group, forwarded to `[part="base"]`.
   *
   * A chip group IS a group, and every peer grouping primitive here already says so --
   * `<lr-radio-group>` renders `role="radiogroup"`, `<lr-segmented>` the same, each forwarding a
   * host `aria-label` inward. This component rendered a roleless container and read no name, and
   * because a host `aria-label` does not cross a shadow boundary, a consumer labelling the host
   * named nothing at all. Supplying a name here (as the `aria-label` attribute or this property)
   * is what makes the group real to assistive technology.
   *
   * The `role="group"` is applied only WITH a name, deliberately: an unnamed group role adds
   * verbosity without adding information, and applying it unconditionally would change the
   * accessibility tree of every decorative chip row already shipped.
   */
  @property({ attribute: 'aria-label' }) accessibleLabel = '';

  // Tracks the default slot's assigned-element count, the same
  // connectedCallback/willUpdate + slotchange convention `<lr-multi-split>`'s
  // `panelCount`/`<lr-source-list>`'s `slottedCount` already establish.
  @state() private childCount = 0;

  /** Whether the excess (beyond `max-visible`) children are currently
   *  revealed. Meaningless (and never rendered) while there's no overflow. */
  @state() private expanded = false;
  private readonly authorHidden = new Map<Element, boolean>();
  private readonly observedChildren = new Set<Element>();
  private readonly pendingHiddenWrites = new Map<Element, { values: boolean[]; cursor: number }>();
  private visibilityObserver?: MutationObserver;
  private visibilityObserverDocument?: Document;
  private trackedChipFocus?: TrackedChipFocus;
  private overflowFocusRepair?: ComposedFocusRepairSnapshot;

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
    const observer = new MutationObserverCtor((records) => {
      // No staleness guard: every path that retires this observer (disconnect, adoption, a
      // new owner document) drains queued records before disconnecting, so the callback never
      // runs for a retired observer or a disconnected group.
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
    if (!this.hasOverflow) {
      this.expanded = false;
      const disclosure = this.shadowRoot?.querySelector<HTMLButtonElement>('[part="overflow-indicator"]');
      if (disclosure) this.overflowFocusRepair = captureComposedFocusRepair(disclosure, disclosure) ?? undefined;
    }
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
    this.syncSelectedChips();
    const overflowRepair = this.overflowFocusRepair;
    this.overflowFocusRepair = undefined;
    this.reconcileChildVisibilityAndFocus(overflowRepair);
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
    this.drainVisibilityRecords();
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

  private reconcileChildVisibilityAndFocus(overflowRepair?: ComposedFocusRepairSnapshot): void {
    const assignedChildren = this.assignedChildren();
    const focusRepair = overflowRepair
      ? { index: assignedChildren.length, repair: overflowRepair }
      : this.focusRepairBeforeVisibility(assignedChildren);
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
    this.drainVisibilityRecords();
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

  private drainVisibilityRecords(): void {
    const records = this.visibilityObserver?.takeRecords();
    if (records?.length) this.processHiddenMutations(records);
  }

  private processHiddenMutations(records: MutationRecord[]): boolean {
    let authorChanged = false;
    const hiddenTargets = new Set<Element>();
    for (const record of records) {
      if (record.type !== 'attributes') continue;
      const child = record.target as Element;
      if (!this.authorHidden.has(child)) continue;
      if (record.attributeName === 'inert') {
        authorChanged = true;
        continue;
      }
      if (record.attributeName !== 'hidden') continue;
      // The next record for this child supplies the previous write's resulting value.
      if (hiddenTargets.has(child) && this.recordHiddenWrite(child, record.oldValue !== null)) authorChanged = true;
      hiddenTargets.add(child);
    }
    for (const child of hiddenTargets) {
      if (this.recordHiddenWrite(child, child.hasAttribute('hidden'))) authorChanged = true;
    }
    return authorChanged;
  }

  private recordHiddenWrite(child: Element, hidden: boolean): boolean {
    const pending = this.pendingHiddenWrites.get(child);
    if (pending && pending.values[pending.cursor] === hidden) {
      if (++pending.cursor === pending.values.length) this.pendingHiddenWrites.delete(child);
      return false;
    }
    this.authorHidden.set(child, hidden);
    return true;
  }

  private setManagedHidden(child: Element, hidden: boolean): void {
    if (child.hasAttribute('hidden') === hidden) return;
    let pending = this.pendingHiddenWrites.get(child);
    if (!pending) {
      pending = { values: [], cursor: 0 };
      this.pendingHiddenWrites.set(child, pending);
    }
    pending.values.push(hidden);
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
      this.requestUpdate();
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

  /** The chips this group owns while a selection mode is active: valued, in the assigned slot. */
  private managedChips(): (Element & { value?: string; selected: boolean; toggleable: boolean })[] {
    if (this.selection === 'none') return [];
    return this.assignedChildren().filter(
      (child): child is Element & { value?: string; selected: boolean; toggleable: boolean } =>
        'toggleable' in child && 'selected' in child && typeof (child as { value?: unknown }).value === 'string',
    );
  }

  private isAllChip(chip: { value?: string }): boolean {
    return this.allValue != null && chip.value === this.allValue;
  }

  /** Writes the selection onto the chips. Idempotent; a no-op while `selection` is `none`. */
  private syncSelectedChips(): void {
    const chosen = new Set(this.selectedValues);
    for (const chip of this.managedChips()) {
      if (!chip.toggleable) chip.toggleable = true;
      const pressed = this.isAllChip(chip) ? chosen.size === 0 : chosen.has(chip.value as string);
      if (chip.selected !== pressed) chip.selected = pressed;
    }
  }

  private onChipToggleRequest = (event: Event): void => {
    const chip = event.target as Element & { value?: string; selected: boolean };
    // The "all" chip reads as a radio that is already on: it cannot be released by pressing it.
    if (this.managedChips().includes(chip as never) && this.isAllChip(chip) && chip.selected) event.preventDefault();
  };

  private onChipChange = (event: Event): void => {
    const chip = event.target as Element & { value?: string; selected: boolean };
    if (!this.managedChips().includes(chip as never)) return;
    const value = chip.value as string;
    if (this.isAllChip(chip)) this.selectedValues = [];
    else if (chip.selected) this.selectedValues = this.selection === 'single' ? [value] : [...this.selectedValues, value];
    else this.selectedValues = this.selectedValues.filter((entry) => entry !== value);
    this.rawValue = [...this.selectedValues];
    this.syncSelectedChips();
    this.requestUpdate('value');
    this.emit('lr-change', { value: this.value });
  };

  private onToggleOverflow = (): void => {
    this.expanded = !this.expanded;
    this.emit('lr-overflow-toggle', { expanded: this.expanded });
  };

  override render(): TemplateResult {
    const hasAccessibleLabel = this.hasAttribute('aria-label') || Boolean(this.accessibleLabel);
    const overflowing = this.hasOverflow;
    const hiddenCount = overflowing ? this.eligibleChildren().length - (this.maxVisible as number) : 0;
    const formattedHiddenCount = getNumberFormat(this.effectiveLocale).format(hiddenCount);

    // Resolved only for a rendered indicator, so a group that never overflows reads no overflow copy.
    // The collapsed name starts with this visible text, so speech users can say what they see.
    const visible = !overflowing ? '' : this.expanded
      ? this.localize('showLess') : this.localize('showMoreCollapsed', undefined, { count: formattedHiddenCount });

    return html`
      <div
        part="base"
        tabindex="-1"
        role=${hasAccessibleLabel ? 'group' : nothing}
        aria-label=${hasAccessibleLabel ? this.accessibleLabel : nothing}
        @focusin=${this.onFocusIn}
        @focusout=${this.onFocusOut}
        @lr-chip-toggle-request=${this.onChipToggleRequest}
        @lr-chip-change=${this.onChipChange}
      >
        <slot @slotchange=${this.onSlotChange}></slot>
        ${overflowing
          ? html`<button
              part="overflow-indicator"
              type="button"
              aria-expanded=${this.expanded ? 'true' : 'false'}
              aria-label=${this.expanded ? visible : this.localize('showMoreOverflowLabel', undefined, { visible, count: formattedHiddenCount })}
              @click=${this.onToggleOverflow}
            >
              ${visible}
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

import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import {
  bindAccessibleTextObserver,
  composedAccessibilityText,
  isAccessibilitySubtreeExcluded,
} from '../../../internal/accessibility-visibility.js';
import { composedParentElement } from '../../../internal/active-element.js';
import {
  applyComposedFocusRepair,
  captureComposedFocusRepair,
  collectComposedFocusTargets,
  type ComposedFocusRepairSnapshot,
} from '../../../internal/focus-navigation.js';
import { renderInertPresentation } from '../../../internal/inert-presentation.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { closeIcon } from '../../../internal/icons.js';
import { literalSetConverter } from '../../../internal/converters.js';
import type { LyraSizeAlias, LyraSizeStep, LyraVariant } from '../../../internal/variants.js';
import { variants } from '../../../internal/variants.styles.js';
import { styles } from './chip.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_remove, LYRA_DEFAULT_removeWithContext, LYRA_DEFAULT_select } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

/** The library's one semantic-tone vocabulary. */
export type ChipVariant = LyraVariant;
/** The shared six-step ladder plus one step below it (a chip is the library's smallest labelled
 *  surface and needs a tier that fits inside a table cell, which no other component does), plus
 *  the `small`/`medium`/`large` aliases `<lr-badge>`/`<lr-callout>` already accept for the six
 *  shared steps. `3xs` has no long-form alias -- it is a Lyra-only step below the shared ladder,
 *  not part of the upstream scale either spelling mirrors. */
export type ChipSize = LyraSizeStep | '3xs' | LyraSizeAlias;

const CHIP_SIZE = literalSetConverter<ChipSize>(
  ['3xs', '2xs', 'xs', 's', 'm', 'l', 'xl', 'small', 'medium', 'large'],
  'm'
);
const CHIP_VARIANT = literalSetConverter<ChipVariant>(
  ['neutral', 'brand', 'success', 'warning', 'danger'],
  'neutral'
);

export interface ChipRemoveDetail {
  value?: string;
}

export interface ChipSelectDetail {
  value?: string;
  selected: boolean;
}

export interface LyraChipEventMap {
  'lr-remove': CustomEvent<ChipRemoveDetail>;
  'lr-chip-select': CustomEvent<ChipSelectDetail>;
}

function isComposedWithin(owner: Element, candidate: Element): boolean {
  let current: Element | null = candidate;
  while (current) {
    if (current === owner) return true;
    current = composedParentElement(current);
  }
  return false;
}

function nearestExternalFocusTarget(owner: Element): HTMLElement | null {
  const targets = collectComposedFocusTargets(
    owner.ownerDocument.documentElement,
    {
      mode: 'programmatic',
    }
  ).elements;
  const owned = targets
    .map((target, index) => (isComposedWithin(owner, target) ? index : -1))
    .filter((index) => index >= 0);
  if (owned.length === 0) return null;
  const first = owned[0]!;
  const last = owned[owned.length - 1]!;
  return (
    targets
      .slice(last + 1)
      .find((target) => !isComposedWithin(owner, target)) ??
    targets
      .slice(0, first)
      .reverse()
      .find((target) => !isComposedWithin(owner, target)) ??
    null
  );
}

function sourceParent(node: Node): Element | null {
  if (node.parentElement) return node.parentElement;
  const root = node.getRootNode() as Document | ShadowRoot;
  return 'host' in root ? root.host : null;
}

function isClosedSourceDetailsBranch(
  details: Element,
  branch: Element | null
): boolean {
  if (
    details.localName !== 'details' ||
    details.hasAttribute('open') ||
    branch === null
  )
    return false;
  return (
    Array.from(details.children).find(
      (child) => child.localName === 'summary'
    ) !== branch
  );
}

function isSourceLabelAvailable(node: Node): boolean {
  const target = node.nodeType === 1 ? (node as Element) : sourceParent(node);
  if (!target?.isConnected) return false;
  let branch: Element | null = target;
  let current = sourceParent(target);
  if (isAccessibilitySubtreeExcluded(target)) return false;
  while (current) {
    if (
      isAccessibilitySubtreeExcluded(current) ||
      isClosedSourceDetailsBranch(current, branch)
    ) {
      return false;
    }
    branch = current;
    current = sourceParent(current);
  }
  return true;
}

/**
 * `<lr-chip>` — a small, content-agnostic pill for a short label: a tag, an
 * active-filter/scope indicator, etc. Distinct from `<lr-attachment-chip>`
 * (specifically file-shaped, with a thumbnail/size/upload-progress) — this
 * one carries no domain assumptions at all, just a label and an optional
 * leading adornment.
 *
 * `variant` tints the whole pill using the same loud-color-on-quiet-tint
 * convention `<lr-tool-call-chip>`/`<lr-citation-badge>` already
 * establish for status coloring: background is the variant's quiet fill,
 * text/icon is its loud fill, both read from the shared semantic grid.
 * `neutral` (the default) deliberately opts out of that grid's own neutral
 * row and falls back to a plain bordered-surface look — the same "no signal"
 * treatment `<lr-citation-badge>`'s `default` status and
 * `<lr-tool-call-chip>`'s `pending` status already use.
 *
 * This property was called `tone` before 8.0.0. It is `variant` now, with no
 * alias: the library spells one concept one way, and `<lr-badge>`,
 * `<lr-callout>` and `<lr-toast-item>` all already spelled it `variant`.
 *
 * This is a controlled component: clicking the remove (×) button only fires
 * `lr-remove` — the chip never removes itself from the DOM on its own
 * interaction, the same contract `<lr-attachment-chip>`/
 * `<lr-conversation-item>` already follow. A consumer owns the underlying
 * list and decides whether/how the click actually removes anything.
 * `disabled` disables whichever native action control is active and suppresses
 * selection/removal requests without changing the controlled state.
 * If an interactive chip has a host `aria-label`, the host becomes the single aggregate
 * `role="group"` owner. The native toggle/remove action keeps a purpose-specific name derived from
 * visible label text (or its localized fallback), avoiding two owners with the same copied name.
 *
 * @customElement lr-chip
 * @slot - The chip's label content. Visible accessible text and forwarding-slot reassignment stay
 * synchronized with toggle/remove action names. In toggle mode its flattened subtree is inert and
 * hidden from assistive technology while the separate native toggle owns the action and name.
 * @slot start - Optional decorative leading adornment, such as an icon or status dot. Its
 * flattened subtree remains visible but is inert and hidden from assistive technology. Nothing is
 * reserved for it (no extra gap) when left empty.
 * @slot end - Optional trailing content, typically an icon, placed after the label and before the
 * toggle/remove button. Nothing is reserved for it (no extra gap) when left empty, mirroring
 * `<lr-badge>`'s identical `end` slot. It remains ordinary consumer content in passive/removable
 * mode; toggle mode makes its flattened subtree inert and hidden from assistive technology beneath
 * the full-surface native toggle.
 * @event lr-remove - The remove (×) button was activated (click, or
 * Enter/Space while focused — native `<button>` behavior). `detail: { value }`
 * — `value` is `undefined` when the `value` prop was never set. Only
 * rendered while `removable`.
 * @event lr-chip-select - Fired on click, or Enter/Space while focused, once the chip has
 * opted into toggle mode via `toggleable` and `removable` is not set.
 * `detail: { value, selected }` contains the proposed next state. Cancelable; preventing it keeps
 * the current `selected` state unchanged.
 * @method focus - Forwards focus to the chip's active remove or toggle button.
 * @method blur - Forwards blur to the chip's active remove or toggle button.
 * @method click - Activates the chip's active remove or toggle button; passive chips retain the
 * ordinary `HTMLElement.click()` behavior.
 * @csspart base - The pill's root container.
 * @csspart start - Inert, aria-hidden wrapper around the decorative `start` slot. Hidden entirely
 *   while empty.
 * @csspart label - Wrapper around the default slot; inert and aria-hidden in toggle mode.
 * @csspart end - Wrapper around the `end` slot. Hidden entirely while empty, and inert plus
 *   aria-hidden in toggle mode.
 * @csspart toggle-button - The real toggle control, rendered over the non-interactive label when
 * toggle mode is active.
 * @csspart remove-button - The remove (×) affordance, only rendered while `removable`.
 * @cssprop [--lr-chip-accent=var(--lr-color-text)] - Text/icon color of the pill. Each non-neutral
 * `variant` changes its private default to that variant's loud fill.
 * @cssprop [--lr-chip-bg=var(--lr-color-surface)] - Background of the pill. Each non-neutral
 * `variant` changes its private default to that variant's quiet fill.
 * @cssprop [--lr-chip-border=var(--lr-color-border)] - Border color of the pill. Every non-neutral
 * `variant` changes its private default to `transparent`.
 * @cssprop [--lr-chip-font-size=var(--lr-font-size-sm)] - Label font size. Each `size` changes its
 * private default to that step's font size; an inherited or direct public value still wins.
 * @cssprop [--lr-chip-gap=var(--lr-space-xs)] - Gap between the icon, label, and remove button.
 * Each `size` changes its private default to that step's gap.
 * @cssprop [--lr-chip-radius=var(--lr-radius)] - Corner radius of the pill and of the remove
 * button, kept in sync so retuning one retunes both. `pill` changes its private default to
 * `var(--lr-radius-pill)`. Does not vary by `size` tier.
 * @cssprop [--lr-chip-icon-size=var(--lr-font-size-sm)] - Font size of the `start` slot wrapper.
 * Its private default follows each `size` step's icon size; an inherited or direct public value
 * remains authoritative.
 * @cssprop [--lr-chip-padding-block=var(--lr-size-0-25rem)] - Block padding of the pill. Each
 * `size` changes its private default to that step's block padding; an inherited or direct public
 * value remains authoritative.
 * @cssprop [--lr-chip-padding-inline=var(--lr-space-s)] - Inline padding of the pill. Each `size`
 * changes its private default to that step's inline padding; an inherited or direct public value
 * remains authoritative.
 * @cssprop [--lr-chip-min-height=var(--lr-size-1-5rem)] - Component density floor for an
 * interactive chip. The real toggle/remove controls also enforce the shared
 * `--lr-icon-button-size` target floor.
 * @cssprop --lr-chip-height - Exact block size of the chip. Undeclared by default, so the chip
 * grows to fit its content (floored by `--lr-chip-min-height` when interactive). Set it to pin a
 * fixed height. A value below the shared interactive target is for non-interactive chips only.
 * @cssprop [--lr-chip-pressed-bg=var(--lr-chip-bg)] - Background while a toggleable chip is
 * selected, independently themeable from its resting background.
 * @cssprop [--lr-chip-pressed-border=var(--lr-chip-accent)] - Border color while a toggleable chip
 * is selected, independently themeable from the label/icon color.
 * @status stable
 * @since 4.0.0
 */
export class LyraChip extends LyraElement<LyraChipEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    remove: LYRA_DEFAULT_remove,
    removeWithContext: LYRA_DEFAULT_removeWithContext,
    select: LYRA_DEFAULT_select,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, variants, styles];

  /** Visual density. `m` preserves the original chip dimensions and is the fallback for
   *  unsupported values. Both Web Awesome spellings are accepted for the shared `s`/`m`/`l`
   *  steps (`small`/`medium`/`large`), matching `<lr-badge>`/`<lr-callout>`; `3xs` has no
   *  long-form alias. */
  private _size: ChipSize = 'm';

  @property({ reflect: true, converter: CHIP_SIZE })
  get size(): ChipSize {
    return this._size;
  }
  set size(next: ChipSize) {
    const normalized = CHIP_SIZE.normalizeReflected(this, 'size', next);
    const old = this._size;
    if (old === normalized) return;
    this._size = normalized;
    this.requestUpdate('size', old);
  }

  /** Status/emphasis color. `neutral` (the default and unsupported-value fallback) reads as
   *  plain/unstyled. */
  private _variant: ChipVariant = 'neutral';

  @property({ reflect: true, converter: CHIP_VARIANT })
  get variant(): ChipVariant {
    return this._variant;
  }
  set variant(next: ChipVariant) {
    const normalized = CHIP_VARIANT.normalizeReflected(this, 'variant', next);
    const old = this._variant;
    if (old === normalized) return;
    this._variant = normalized;
    this.requestUpdate('variant', old);
  }

  /** Shows the remove (×) button. */
  @property({ type: Boolean, reflect: true }) removable = false;

  /** Disables the active toggle/remove control and suppresses its request event. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /** Draws fully-rounded ends instead of the default rounded rectangle, matching
   *  `<lr-badge>`/`<lr-tag>`'s identical property. */
  @property({ type: Boolean, reflect: true }) pill = false;

  /** Current pressed state. This does not make the chip interactive by itself; set `toggleable`
   *  to opt into the native toggle action. Keeping state and mode independent makes declarative
   *  SSR and property-update order deterministic. Has no visual or interactive effect while
   *  `toggleable` is unset or while `removable` owns the chip's action. */
  @property({ type: Boolean, reflect: true }) selected = false;

  /** Sole opt-in for the chip's toggle/pressed interactive mode. Set `selected` independently for
   *  the current pressed state. The default is a passive label pill. Has no effect while
   *  `removable` owns the chip's action. */
  @property({ type: Boolean, reflect: true }) toggleable = false;

  /** Opaque consumer bookkeeping value — never read, validated, or rendered
   *  by this component itself, only ever echoed back verbatim (including
   *  `undefined` if never set) in `lr-remove`'s detail. */
  @property() value?: string;

  // A `[part]` always contains a literal `<slot>` child regardless of
  // assigned content, so `:empty` never matches — real emptiness is tracked
  // in JS instead, the same fix `<lr-stat>`'s `hasIcon`/
  // `<lr-tool-call-chip>`'s `hasDetailSlot` etc. already establish.
  @state() private hasStartSlot = false;
  // Same rationale as hasStartSlot above -- mirrors <lr-badge>'s hasEndSlot, adapted to chip's
  // already-established SSR-safe seeding path (recomputeHasEndSlot + seedFirstRenderState) rather
  // than badge's willUpdate-based seed, since only this file needs to survive server-rendered
  // hydration.
  @state() private hasEndSlot = false;
  // The server cannot inspect assigned nodes. Keep its first render on the empty-label fallback,
  // then seed from light DOM before a browser-only first paint (or immediately after hydration).
  private cachedLabelText = '';
  private labelObserver?: MutationObserver;
  private managedActionGroupRole = false;
  private pendingControlFocusRepair?: ComposedFocusRepairSnapshot;
  private readonly onLabelSlotChange = (event: Event): void => {
    const target = event.target as Element | null;
    if (target?.nodeType !== 1 || target.localName !== 'slot') return;
    if (!this.tracksActionLabel) return;
    this.bindLabelObserverTargets();
    this.updateBrowserDerivedState(() => this.recomputeLabelText());
  };

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('slotchange', this.onLabelSlotChange);
    this.syncLabelObservation();
    const sampleBrowserState = (): void => {
      this.recomputeHasStartSlot();
      this.recomputeHasEndSlot();
      if (this.tracksActionLabel) this.recomputeLabelText(true, true);
    };
    if (this.hasUpdated) {
      sampleBrowserState();
      this.ownerDocument.defaultView?.queueMicrotask(() => {
        if (this.isConnected && this.tracksActionLabel)
          this.recomputeLabelText();
      });
    } else this.seedFirstRenderState(sampleBrowserState);
  }

  private get tracksActionLabel(): boolean {
    return this.toggleable || this.removable;
  }

  private syncLabelObservation(): void {
    this.labelObserver?.disconnect();
    this.labelObserver = undefined;
    if (!this.isConnected || !this.tracksActionLabel) return;
    const MutationObserverCtor = (this.ownerDocument as Document | undefined)
      ?.defaultView?.MutationObserver;
    this.labelObserver = MutationObserverCtor
      ? new MutationObserverCtor(() => {
          this.bindLabelObserverTargets();
          this.syncHostActionRole();
          this.updateBrowserDerivedState(() => this.recomputeLabelText());
        })
      : undefined;
    this.bindLabelObserverTargets();
  }

  // `'slot'` widens the shared content-node filter: only the default slot's content names this
  // chip's actions, so a light-DOM child moving to or from the decorative `start`/`end` slots
  // changes the name.
  private bindLabelObserverTargets(): void {
    bindAccessibleTextObserver(this.labelObserver, this, ['slot', 'role']);
  }

  override disconnectedCallback(): void {
    this.removeEventListener('slotchange', this.onLabelSlotChange);
    this.labelObserver?.disconnect();
    this.labelObserver = undefined;
    this.releaseHostActionRole();
    this.pendingControlFocusRepair = undefined;
    super.disconnectedCallback();
  }

  private recomputeHasStartSlot(): void {
    const children = (this as unknown as { children?: HTMLCollection })
      .children;
    if (!children) return;
    this.hasStartSlot = Array.from(children).some(
      (el) => el.getAttribute('slot') === 'start'
    );
  }

  private onStartSlotChange = (e: Event): void => {
    const slot = e.target as HTMLSlotElement;
    const update = (): void => {
      if (!this.isConnected) return;
      this.hasStartSlot = slot.assignedElements({ flatten: true }).length > 0;
    };
    this.updateBrowserDerivedState(update);
  };

  private recomputeHasEndSlot(): void {
    const children = (this as unknown as { children?: HTMLCollection })
      .children;
    if (!children) return;
    this.hasEndSlot = Array.from(children).some(
      (el) => el.getAttribute('slot') === 'end'
    );
  }

  private onEndSlotChange = (e: Event): void => {
    const slot = e.target as HTMLSlotElement;
    const update = (): void => {
      if (!this.isConnected) return;
      this.hasEndSlot = slot.assignedElements({ flatten: true }).length > 0;
    };
    this.updateBrowserDerivedState(update);
  };

  // Only the default slot's own content counts toward the remove/toggle button's accessible name --
  // text incidentally living inside the (decorative) `start`/`end` slots shouldn't leak into
  // "Remove {text}", which is what the node selection below is for. The extraction itself is the
  // library's shared `composedAccessibleVisibleText()`: it walks slots, honors hidden/inert/
  // `aria-hidden`/CSS-hidden branches, and counts only Text and Element nodes. That last part
  // matters here: when a consumer interpolates the label via a lit-html expression
  // (`html\`<lr-chip>${label}</lr-chip>\``, the ordinary way a data-driven label gets bound) rather
  // than a static string, lit-html inserts a marker Comment node alongside the Text node in the
  // light DOM, and that comment's own (non-empty) data is internal bookkeeping, not label content.
  private computeLabelText(preferLightDom = false): string {
    const renderRoot = this.renderRoot as ParentNode | undefined;
    const slot = renderRoot?.querySelector<HTMLSlotElement>('slot:not([name])');
    const lightDomNodes = (
      this as unknown as { childNodes?: NodeListOf<ChildNode> }
    ).childNodes;
    const assigned = slot?.assignedNodes({ flatten: true }) ?? [];
    const direct = Array.from(lightDomNodes ?? []).filter(
      (node) =>
        node.nodeType !== 1 ||
        ((node as Element).getAttribute('slot') ?? '') === ''
    );
    const nodes = !preferLightDom && assigned.length > 0 ? assigned : direct;
    return nodes
      .map((node) =>
        composedAccessibilityText(node, {
          ancestorBoundary: this,
          // Toggle mode makes projected label content inert because the sibling button owns the
          // interaction. Ignore only that internal fence when deriving the button's own name.
          isSubtreeExcluded: (element) =>
            element.getRootNode() === this.renderRoot &&
            element.getAttribute('part')?.split(/\s+/).includes('label')
              ? false
              : isAccessibilitySubtreeExcluded(element),
          // A reconnect sample can precede layout in the new owner realm. It still honors authored
          // hidden/inert/ARIA state and is replaced by the ordinary rendered sample on slotchange.
          requireRendered: preferLightDom
            ? false
            : node.nodeType !== 1 || (node as Element).localName !== 'slot',
          shouldPruneNode: (candidate) =>
            !this.contains(candidate) && !isSourceLabelAvailable(candidate),
        })
      )
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private recomputeLabelText(request = true, preferLightDom = false): void {
    const next = this.computeLabelText(preferLightDom);
    if (next === this.cachedLabelText) return;
    this.cachedLabelText = next;
    if (request) this.requestUpdate();
  }

  /** Accessible name for the real toggle control. The chip's own visible label text names the
   *  action; a host `aria-label`, when present, names the aggregate group instead. A start-only
   *  toggleable chip has no visible label, and a focusable control with no name at all is
   *  announced as a nameless "button" — so it falls back to the generic localized action the same
   *  way the remove button falls back to `remove`. */
  private get accessibleToggleLabel(): string {
    return this.cachedLabelText || this.localize('select');
  }

  private get accessibleRemoveLabel(): string {
    const text = this.cachedLabelText;
    return text
      ? this.localize('removeWithContext', undefined, { label: text })
      : this.localize('remove');
  }

  private onRemoveClick = (): void => {
    if (this.disabled) return;
    const repair = captureComposedFocusRepair(
      this,
      nearestExternalFocusTarget(this)
    );
    this.emit('lr-remove', { value: this.value });
    if (repair && (!this.isConnected || !this.removable))
      applyComposedFocusRepair(repair);
  };

  private onToggleClick = (): void => {
    if (this.disabled) return;
    const selected = !this.selected;
    const event = this.emit(
      'lr-chip-select',
      { value: this.value, selected },
      { cancelable: true }
    );
    if (!event.defaultPrevented) this.selected = selected;
  };

  private get primaryControl(): HTMLButtonElement | null {
    return this.renderRoot.querySelector<HTMLButtonElement>(
      this.removable ? '[part="remove-button"]' : '[part="toggle-button"]'
    );
  }

  override focus(options?: FocusOptions): void {
    this.primaryControl?.focus(options);
  }

  override blur(): void {
    this.primaryControl?.blur();
  }

  override click(): void {
    const control = this.primaryControl;
    if (control) control.click();
    else super.click();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (changed.has('removable') || changed.has('toggleable')) {
      this.syncLabelObservation();
      if (this.hasUpdated) {
        if (this.tracksActionLabel) this.recomputeLabelText(false);
        else this.cachedLabelText = '';
      }
    }
    if (this.pendingControlFocusRepair) return;
    const oldRemovable = changed.get('removable') ?? this.removable;
    const oldToggleable = changed.get('toggleable') ?? this.toggleable;
    const oldDisabled = changed.get('disabled') ?? this.disabled;
    const oldMode = oldRemovable
      ? 'remove'
      : oldToggleable
      ? 'toggle'
      : 'passive';
    const newMode = this.removable
      ? 'remove'
      : this.toggleable
      ? 'toggle'
      : 'passive';
    if (oldMode === newMode && !(oldDisabled === false && this.disabled))
      return;
    this.pendingControlFocusRepair =
      captureComposedFocusRepair(
        this,
        nearestExternalFocusTarget(this) ??
          this.renderRoot.querySelector<HTMLButtonElement>(
            '[part="remove-button"], [part="toggle-button"]'
          )
      ) ?? undefined;
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    this.syncHostActionRole();
    const repair = this.pendingControlFocusRepair;
    this.pendingControlFocusRepair = undefined;
    if (!repair) return;
    const replacement = this.disabled ? null : this.primaryControl;
    applyComposedFocusRepair(repair, replacement ?? repair.candidate);
  }

  private syncHostActionRole(): void {
    const needsGroup =
      this.tracksActionLabel && this.hasAttribute('aria-label');
    if (needsGroup && !this.hasAttribute('role')) {
      this.setAttribute('role', 'group');
      this.managedActionGroupRole = true;
    } else if (!needsGroup) {
      this.releaseHostActionRole();
    }
  }

  private releaseHostActionRole(): void {
    if (this.managedActionGroupRole && this.getAttribute('role') === 'group')
      this.removeAttribute('role');
    this.managedActionGroupRole = false;
  }

  override render(): TemplateResult {
    // `toggleable` alone gates structural interactivity. `selected` is only the current pressed
    // value, which keeps mode and state independent.
    const toggleMode = this.toggleable && !this.removable;
    const pressed = this.selected && !this.removable;
    return html`
      <span part="base">
        ${renderInertPresentation(
          html`<slot
            name="start"
            @slotchange=${this.onStartSlotChange}
          ></slot>`,
          {
            part: 'start',
            hidden: !this.renderSlotPresence(this.hasStartSlot),
          }
        )}
        ${renderInertPresentation(
          html`<slot @slotchange=${this.onLabelSlotChange}></slot>`,
          { part: 'label', presentation: toggleMode }
        )}
        ${renderInertPresentation(
          html`<slot name="end" @slotchange=${this.onEndSlotChange}></slot>`,
          {
            part: 'end',
            presentation: toggleMode,
            hidden: !this.renderSlotPresence(this.hasEndSlot),
          }
        )}
        ${toggleMode
          ? html`<button
              part="toggle-button"
              type="button"
              ?disabled=${this.disabled}
              aria-label=${this.accessibleToggleLabel}
              aria-pressed=${pressed ? 'true' : 'false'}
              @click=${this.onToggleClick}
            ></button>`
          : nothing}
        ${this.removable
          ? html`<button
              part="remove-button"
              type="button"
              ?disabled=${this.disabled}
              aria-label=${this.accessibleRemoveLabel}
              @click=${this.onRemoveClick}
            >
              ${closeIcon()}
            </button>`
          : nothing}
      </span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-chip': LyraChip;
  }
}

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
import type { LyraSizeStep, LyraVariant } from '../../../internal/variants.js';
import { variants } from '../../../internal/variants.styles.js';
import { styles } from './chip.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_remove, LYRA_DEFAULT_removeWithContext, LYRA_DEFAULT_select } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/** The library's one semantic-tone vocabulary. */
export type ChipVariant = LyraVariant;
/** The shared six-step ladder plus one step below it: a chip is the library's smallest labelled
 *  surface and needs a tier that fits inside a table cell, which no other component does. */
export type ChipSize = LyraSizeStep | '3xs';

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
  const targets = collectComposedFocusTargets(owner.ownerDocument.documentElement, {
    mode: 'programmatic',
  }).elements;
  const owned = targets
    .map((target, index) => isComposedWithin(owner, target) ? index : -1)
    .filter((index) => index >= 0);
  if (owned.length === 0) return null;
  const first = owned[0]!;
  const last = owned[owned.length - 1]!;
  return targets.slice(last + 1).find((target) => !isComposedWithin(owner, target))
    ?? targets.slice(0, first).reverse().find((target) => !isComposedWithin(owner, target))
    ?? null;
}

function sourceParent(node: Node): Element | null {
  if (node.parentElement) return node.parentElement;
  const root = node.getRootNode() as Document | ShadowRoot;
  return 'host' in root ? root.host : null;
}

function isClosedSourceDetailsBranch(details: Element, branch: Element | null): boolean {
  if (details.localName !== 'details' || details.hasAttribute('open') || branch === null) return false;
  return Array.from(details.children).find((child) => child.localName === 'summary') !== branch;
}

function isSourceLabelAvailable(node: Node): boolean {
  const target = node.nodeType === 1 ? node as Element : sourceParent(node);
  if (!target?.isConnected) return false;
  let branch: Element | null = target;
  let current = sourceParent(target);
  if (isAccessibilitySubtreeExcluded(target)) return false;
  while (current) {
    if (isAccessibilitySubtreeExcluded(current) || isClosedSourceDetailsBranch(current, branch)) {
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
 * leading icon/dot.
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
 *
 * @customElement lr-chip
 * @slot - The chip's label content. Visible accessible text and forwarding-slot reassignment stay
 * synchronized with toggle/remove action names. In toggle mode its flattened subtree is inert and
 * hidden from assistive technology while the separate native toggle owns the action and name.
 * @slot icon - Optional decorative leading icon or status dot. Its flattened subtree remains
 * visible but is inert and hidden from assistive technology. Nothing is reserved for it (no extra
 * gap) when left empty.
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
 * opted into toggle mode (via `selected` or `toggleable`) and `removable` is not set.
 * `detail: { value, selected }` contains the proposed next state. Cancelable; preventing it keeps
 * the current `selected` state unchanged.
 * @method focus - Forwards focus to the chip's active remove or toggle button.
 * @method blur - Forwards blur to the chip's active remove or toggle button.
 * @method click - Activates the chip's active remove or toggle button; passive chips retain the
 * ordinary `HTMLElement.click()` behavior.
 * @csspart base - The pill's root container.
 * @csspart icon - Inert, aria-hidden wrapper around the decorative `icon` slot. Hidden entirely
 *   while empty.
 * @csspart label - Wrapper around the default slot; inert and aria-hidden in toggle mode.
 * @csspart end - Wrapper around the `end` slot. Hidden entirely while empty, and inert plus
 *   aria-hidden in toggle mode.
 * @csspart toggle-button - The real toggle control, rendered over the non-interactive label when
 * toggle mode is active.
 * @csspart remove-button - The remove (×) affordance, only rendered while `removable`.
 * @cssprop [--lr-chip-accent=var(--lr-color-text)] - Text/icon color of the pill. Each non-neutral
 * `variant` sets it to that variant's loud fill.
 * @cssprop [--lr-chip-bg=var(--lr-color-surface)] - Background of the pill. Each non-neutral
 * `variant` sets it to that variant's quiet fill.
 * @cssprop [--lr-chip-border=var(--lr-color-border)] - Border color of the pill. Every non-neutral
 * `variant` sets it to `transparent`.
 * @cssprop [--lr-chip-font-size=var(--lr-font-size-sm)] - Label font size. Each `size` sets it to
 * that step's font size.
 * @cssprop [--lr-chip-gap=var(--lr-space-xs)] - Gap between the icon, label, and remove button.
 * Each `size` sets it to that step's gap.
 * @cssprop [--lr-chip-radius=var(--lr-radius)] - Corner radius of the pill and of the remove
 * button, kept in sync so retuning one retunes both. `pill` raises it to
 * `var(--lr-radius-pill)`. Does not vary by `size` tier.
 * @cssprop [--lr-chip-icon-size=var(--lr-font-size-sm)] - Font size of the `icon` slot wrapper.
 * Each `size` sets it to that step's icon size.
 * @cssprop [--lr-chip-padding-block=var(--lr-size-0-25rem)] - Block padding of the pill. Each
 * `size` sets it to that step's block padding.
 * @cssprop [--lr-chip-padding-inline=var(--lr-space-s)] - Inline padding of the pill. Each `size`
 * sets it to that step's inline padding.
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

  /** Visual density. `m` preserves the original chip dimensions. */
  @property({ reflect: true }) size: ChipSize = 'm';

  /** Status/emphasis color. `neutral` (the default) reads as plain/unstyled. */
  @property({ reflect: true }) variant: ChipVariant = 'neutral';

  /** Shows the remove (×) button. */
  @property({ type: Boolean, reflect: true }) removable = false;

  /** Disables the active toggle/remove control and suppresses its request event. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /** Draws fully-rounded ends instead of the default rounded rectangle, matching
   *  `<lr-badge>`/`<lr-tag>`'s identical property. */
  @property({ type: Boolean, reflect: true }) pill = false;

  /** Opt-in toggle/pressed mode -- the current pressed value. Setting `selected` (to `true`, the
   *  common way to start a chip already pressed) opts the chip into toggle mode automatically, so
   *  `<lr-chip selected>` alone is enough: `[part='toggle-button']` renders as a native,
   *  keyboard-activatable button and reflects
   *  `aria-pressed`, and toggles on click/activation, emitting `lr-chip-select`. That opt-in
   *  (tracked by `toggleable`, see below) persists once made, so toggling `selected` back to
   *  `false` never strips the chip's interactivity -- a chip a user has clicked "off" must stay
   *  clickable to turn it back "on". Has no effect when combined with `removable`, since that
   *  mode already owns the chip's one native action. The label slot is inert in toggle mode, so
   *  unrestricted slotted descendants can never nest inside or double-activate the real button.
   *  This component's two real use cases (a chart-series visibility
   *  toggle, a category filter chip) never need both at once. `false` (the default, with
   *  `toggleable` also left at its default) reproduces today's exact passive-label-pill output. */
  private _selected = false;
  @property({ type: Boolean, reflect: true })
  get selected(): boolean {
    return this._selected;
  }
  set selected(next: boolean) {
    const normalized = Boolean(next);
    const old = this._selected;
    // Latch at assignment time rather than update time: Lit batches same-task writes, so looking
    // only at the final value would lose an explicit `true` followed by `false`.
    if (normalized) this.toggleable = true;
    this._selected = normalized;
    this.requestUpdate('selected', old);
  }

  /** Explicit opt-in into `selected`'s toggle/pressed interactive mode, independent of the
   *  *current* value of `selected`. Setting `selected` to `true` at any point opts in
   *  automatically (see its doc comment) and keeps this `true` from then on, which is enough for
   *  a chip that starts already pressed. Set `toggleable` directly for a chip that must be
   *  clickable from the outset while starting **unselected** -- e.g. an initially-inactive
   *  category filter chip -- since `selected`'s own default (`false`) can't be distinguished from
   *  "never opted in" on its own. */
  @property({ type: Boolean, reflect: true }) toggleable = false;

  /** Opaque consumer bookkeeping value — never read, validated, or rendered
   *  by this component itself, only ever echoed back verbatim (including
   *  `undefined` if never set) in `lr-remove`'s detail. */
  @property() value?: string;

  // A `[part]` always contains a literal `<slot>` child regardless of
  // assigned content, so `:empty` never matches — real emptiness is tracked
  // in JS instead, the same fix `<lr-stat>`'s `hasIcon`/
  // `<lr-tool-call-chip>`'s `hasDetailSlot` etc. already establish.
  @state() private hasIconSlot = false;
  // Same rationale as hasIconSlot above -- mirrors <lr-badge>'s hasEndSlot, adapted to chip's
  // already-established SSR-safe seeding path (recomputeHasEndSlot + seedFirstRenderState) rather
  // than badge's willUpdate-based seed, since only this file needs to survive server-rendered
  // hydration.
  @state() private hasEndSlot = false;
  // The server cannot inspect assigned nodes. Keep its first render on the empty-label fallback,
  // then seed from light DOM before a browser-only first paint (or immediately after hydration).
  private cachedLabelText = '';
  private labelObserver?: MutationObserver;
  private pendingControlFocusRepair?: ComposedFocusRepairSnapshot;
  private readonly onLabelSlotChange = (event: Event): void => {
    const target = event.target as Element | null;
    if (target?.nodeType !== 1 || target.localName !== 'slot') return;
    this.bindLabelObserverTargets();
    this.updateBrowserDerivedState(() => this.recomputeLabelText());
  };

  override connectedCallback(): void {
    super.connectedCallback();
    const MutationObserverCtor = (this.ownerDocument as Document | undefined)?.defaultView
      ?.MutationObserver;
    this.labelObserver = MutationObserverCtor
      ? new MutationObserverCtor(() => {
          this.bindLabelObserverTargets();
          this.updateBrowserDerivedState(() => this.recomputeLabelText());
        })
      : undefined;
    this.addEventListener('slotchange', this.onLabelSlotChange);
    this.bindLabelObserverTargets();
    const sampleBrowserState = (): void => {
      this.recomputeHasIconSlot();
      this.recomputeHasEndSlot();
      this.recomputeLabelText();
    };
    if (this.hasUpdated) sampleBrowserState();
    else this.seedFirstRenderState(sampleBrowserState);
  }

  // `'slot'` widens the shared content-node filter: only the default slot's content names this
  // chip's actions, so a light-DOM child moving to or from the decorative `icon`/`end` slots
  // changes the name.
  private bindLabelObserverTargets(): void {
    bindAccessibleTextObserver(this.labelObserver, this, ['slot']);
  }

  override disconnectedCallback(): void {
    this.removeEventListener('slotchange', this.onLabelSlotChange);
    this.labelObserver?.disconnect();
    this.labelObserver = undefined;
    this.pendingControlFocusRepair = undefined;
    super.disconnectedCallback();
  }

  private recomputeHasIconSlot(): void {
    const children = (this as unknown as { children?: HTMLCollection }).children;
    if (!children) return;
    this.hasIconSlot = Array.from(children).some((el) => el.getAttribute('slot') === 'icon');
  }

  private onIconSlotChange = (e: Event): void => {
    const slot = e.target as HTMLSlotElement;
    const update = (): void => {
      if (!this.isConnected) return;
      this.hasIconSlot = slot.assignedElements({ flatten: true }).length > 0;
    };
    this.updateBrowserDerivedState(update);
  };

  private recomputeHasEndSlot(): void {
    const children = (this as unknown as { children?: HTMLCollection }).children;
    if (!children) return;
    this.hasEndSlot = Array.from(children).some((el) => el.getAttribute('slot') === 'end');
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
  // text incidentally living inside the (decorative) `icon`/`end` slots shouldn't leak into
  // "Remove {text}", which is what the node selection below is for. The extraction itself is the
  // library's shared `composedAccessibleVisibleText()`: it walks slots, honors hidden/inert/
  // `aria-hidden`/CSS-hidden branches, and counts only Text and Element nodes. That last part
  // matters here: when a consumer interpolates the label via a lit-html expression
  // (`html\`<lr-chip>${label}</lr-chip>\``, the ordinary way a data-driven label gets bound) rather
  // than a static string, lit-html inserts a marker Comment node alongside the Text node in the
  // light DOM, and that comment's own (non-empty) data is internal bookkeeping, not label content.
  private computeLabelText(): string {
    const renderRoot = this.renderRoot as ParentNode | undefined;
    const slot = renderRoot?.querySelector<HTMLSlotElement>('slot:not([name])');
    const lightDomNodes = (this as unknown as { childNodes?: NodeListOf<ChildNode> }).childNodes;
    const nodes = slot
      ? slot.assignedNodes({ flatten: true })
      : Array.from(lightDomNodes ?? []).filter(
          (node) => node.nodeType !== 1 || ((node as Element).getAttribute('slot') ?? '') === '',
        );
    return nodes
      .map((node) => composedAccessibilityText(node, {
        ancestorBoundary: this,
        // Toggle mode makes projected label content inert because the sibling button owns the
        // interaction. Ignore only that internal fence when deriving the button's own name.
        isSubtreeExcluded: (element) =>
          element.getRootNode() === this.renderRoot &&
          element.getAttribute('part')?.split(/\s+/).includes('label')
            ? false
            : isAccessibilitySubtreeExcluded(element),
        requireRendered: node.nodeType !== 1 || (node as Element).localName !== 'slot',
        shouldPruneNode: (candidate) =>
          !this.contains(candidate) && !isSourceLabelAvailable(candidate),
      }))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private recomputeLabelText(): void {
    const next = this.computeLabelText();
    if (next === this.cachedLabelText) return;
    this.cachedLabelText = next;
    this.requestUpdate();
  }

  /** Accessible name for the real toggle control. A host `aria-label` wins; otherwise the chip's
   *  own label text names it. An icon-only toggleable chip (a colour swatch standing in for a
   *  chart series, a bare status dot) has neither, and a focusable control with no name at all is
   *  announced as a nameless "button" — so it falls back to the generic localized action the same
   *  way the remove button falls back to `remove`. */
  private get accessibleToggleLabel(): string {
    const hostLabel = this.getAttribute('aria-label');
    if (hostLabel !== null) return hostLabel;
    return this.cachedLabelText || this.localize('select');
  }

  private get accessibleRemoveLabel(): string {
    const hostLabel = this.getAttribute('aria-label');
    if (hostLabel !== null) return hostLabel;
    const text = this.cachedLabelText;
    return text ? this.localize('removeWithContext', undefined, { label: text }) : this.localize('remove');
  }

  private onRemoveClick = (): void => {
    if (this.disabled) return;
    const repair = captureComposedFocusRepair(this, nearestExternalFocusTarget(this));
    this.emit('lr-remove', { value: this.value });
    if (repair && (!this.isConnected || !this.removable)) applyComposedFocusRepair(repair);
  };

  private onToggleClick = (): void => {
    if (this.disabled) return;
    const selected = !this.selected;
    const event = this.emit(
      'lr-chip-select',
      { value: this.value, selected },
      { cancelable: true },
    );
    if (!event.defaultPrevented) this.selected = selected;
  };

  private get primaryControl(): HTMLButtonElement | null {
    return this.renderRoot.querySelector<HTMLButtonElement>(
      this.removable ? '[part="remove-button"]' : '[part="toggle-button"]',
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
    if (this.pendingControlFocusRepair) return;
    const oldRemovable = changed.get('removable') ?? this.removable;
    const oldToggleable = changed.get('toggleable') ?? this.toggleable;
    const oldDisabled = changed.get('disabled') ?? this.disabled;
    const oldMode = oldRemovable ? 'remove' : oldToggleable ? 'toggle' : 'passive';
    const newMode = this.removable ? 'remove' : this.toggleable ? 'toggle' : 'passive';
    if (oldMode === newMode && !(oldDisabled === false && this.disabled)) return;
    this.pendingControlFocusRepair = captureComposedFocusRepair(
      this,
      nearestExternalFocusTarget(this)
        ?? this.renderRoot.querySelector<HTMLButtonElement>(
          '[part="remove-button"], [part="toggle-button"]',
        ),
    ) ?? undefined;
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    const repair = this.pendingControlFocusRepair;
    this.pendingControlFocusRepair = undefined;
    if (!repair) return;
    const replacement = this.disabled ? null : this.primaryControl;
    applyComposedFocusRepair(repair, replacement ?? repair.candidate);
  }

  override render(): TemplateResult {
    // `toggleMode` is sticky (see `toggleable`'s doc comment) and gates the chip's structural
    // interactivity, so it survives `selected` toggling back to false. `pressed` tracks only the
    // *current* value, for `aria-pressed`.
    const toggleMode = this.toggleable && !this.removable;
    const pressed = this.selected && !this.removable;
    return html`
      <span
        part="base"
      >
        ${renderInertPresentation(
          html`<slot name="icon" @slotchange=${this.onIconSlotChange}></slot>`,
          {
            part: 'icon',
            hidden: !this.renderSlotPresence(this.hasIconSlot),
          },
        )}
        ${renderInertPresentation(
          html`<slot @slotchange=${this.onLabelSlotChange}></slot>`,
          { part: 'label', presentation: toggleMode },
        )}
        ${renderInertPresentation(
          html`<slot name="end" @slotchange=${this.onEndSlotChange}></slot>`,
          {
            part: 'end',
            presentation: toggleMode,
            hidden: !this.renderSlotPresence(this.hasEndSlot),
          },
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

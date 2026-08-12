import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { isRtl } from '../../../internal/rtl.js';
import { composedParentElement, isAccessibilityVisibilityHidden, nextId } from '../../../internal/a11y.js';
import { chevronIcon } from '../../../internal/icons.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { tag } from '../../../internal/prefix.js';
import { observeScrollOverflow } from '../../../internal/scroll-overflow.js';
import { styles } from './tab-group.styles.js';
import { activeElementIn } from '../../../internal/active-element.js';
import type { LyraTab } from './tab.class.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_scrollNext, LYRA_DEFAULT_scrollPrevious } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/**
 * One tab, derived from a direct light-DOM child's `slot`/`label`/`disabled`
 * attributes, plus whether a sibling `slot="<id>-icon"` child is also present
 * (see the class doc for the icon mechanism).
 */
interface TabDef {
  slotName: string;
  label: string;
  disabled: boolean;
  /** The source child's own `inert` state — see `isInertChild()`. */
  inert: boolean;
  hasIcon: boolean;
  /** `element` when the tab came from an `<lr-tab>`, whose content the button projects instead of
   *  rendering `label` as text. `attribute` is the panel-attribute shape. */
  source: 'attribute' | 'element';
  element?: LyraTab;
}

interface ProjectedSourceSnapshot {
  inert: string | null;
  appliedInert: string | null;
  /** True only while the current `inert` attribute was added by this group. */
  libraryOwnsInert: boolean;
}

/**
 * `inert` sits alongside `disabled` in every navigability predicate here, matching `<lr-menu>`'s
 * own item predicate: an inert element *refuses* focus, so a roving `tabindex` that steps onto one
 * leaves `focus()` a silent no-op and strands the user's arrow key with focus back on `<body>`.
 * The tab button this group renders for an inert source child is itself marked `inert`, so the two
 * states cannot disagree — which is exactly why the button must never be an arrow-key target.
 *
 * Deliberately the child's **own** inert state, never an ancestor's: a tab group sitting in a
 * subtree an open modal has inerted is inert *as a whole*, and treating every tab as non-navigable
 * there would reset `active` to `''` and blank every panel for as long as the dialog is open.
 */
function isHtmlElement(child: Element): child is HTMLElement {
  return child.nodeType === 1 && child.namespaceURI === 'http://www.w3.org/1999/xhtml';
}

function isInertChild(child: Element): boolean {
  return isHtmlElement(child) && child.inert;
}

/** Whether a closed native `<details>` hides `branch` rather than its visible `<summary>`. */
function isClosedDetailsContentBranch(details: Element, branch: Node | null): boolean {
  if (details.localName !== 'details' || details.hasAttribute('open') || branch === null) return false;
  let directBranch = branch;
  while (directBranch.parentNode && directBranch.parentNode !== details) {
    directBranch = directBranch.parentNode;
  }
  if (directBranch.parentNode !== details) return false;
  return Array.from(details.children).find((child) => child.localName === 'summary') !== directBranch;
}

/** The subtree-pruning portion of accessible visibility, excluding `inert` so a group-owned
 * source fence can be handled without overlooking author-owned hidden/ARIA/CSS state. */
function isTabLabelSubtreeExcludedWithoutInert(element: Element): boolean {
  if (
    element.hasAttribute('hidden') ||
    element.getAttribute('aria-hidden')?.trim().toLowerCase() === 'true'
  ) {
    return true;
  }
  const rendered = element.ownerDocument.defaultView?.getComputedStyle(element);
  return rendered?.display === 'none' || rendered?.contentVisibility === 'hidden';
}

/** Which edge the tab strip sits on. `start`/`end` are logical, so they mirror under RTL. */
export type TabGroupPlacement = 'top' | 'bottom' | 'start' | 'end';

/**
 * `auto` moves selection with focus (the APG's automatic activation). `manual` moves focus only,
 * and the user commits with Enter or Space — required by the APG whenever revealing a panel is
 * expensive, since automatic activation would load every panel the user arrows past.
 */
export type TabGroupActivation = 'auto' | 'manual';

/** Fallback panel name for an `<lr-tab>` with no `panel` attribute -- keyed by position so it is
 *  stable across re-syncs, and prefixed so it cannot collide with an author-chosen name. */
const SYNTHETIC_PANEL_PREFIX = 'lr-tab-';

/** How much of the visible tab row one press of a scroll control travels. Short of a full viewport
 *  on purpose: a whole-width jump leaves nothing on screen that was there before it, so there is no
 *  landmark to tell you which way you moved. The leftover fifth is that landmark, and it matches
 *  `lr-scroller`'s own control step. */
const SCROLL_STEP_RATIO = 0.8;

export interface LyraTabGroupEventMap {
  'lr-tab-show': CustomEvent<{ tabId: string; name: string }>;
  'lr-tab-hide': CustomEvent<{ tabId: string; name: string }>;
}
/**
 * `<lr-tab-group>` — a tab strip whose panels are direct light-DOM children,
 * each carrying `slot="<id>"` (the panel's stable id) and `label="<text>"`
 * (the tab button's text). One named `<slot>` is rendered per distinct
 * `slot` name found among the current children — a child with no `label`,
 * or a name with no matching child, simply never produces a tab.
 *
 * A tab button's *visible* content can carry a leading icon without ever
 * changing its *accessible name* (which always stays exactly `label`'s
 * text, nothing else): give a tab an extra direct-child sibling of
 * `<lr-tab-group>` carrying `slot="<id>-icon"` (that sibling's own content --
 * an inline SVG, an emoji span, a custom icon element, anything -- is
 * entirely up to the consumer). Its assigned source is inert while projected,
 * and it renders ahead of the label inside an `aria-hidden="true"` part so it
 * cannot create a nested action. A tab with no matching
 * `<id>-icon` sibling renders no icon wrapper at all, so existing text-only
 * tabs are completely unaffected. (A named slot,
 * rather than a second attribute holding an icon-name lookup, was chosen
 * because this library's `internal/icons.ts` is a small closed set of
 * chrome glyphs for this library's *own* components, not a public
 * name-keyed registry -- a slot lets a consumer supply an arbitrary,
 * domain-specific icon instead of being limited to that internal set.)
 *
 * Implements the WAI-ARIA APG tabs pattern. With the default `activation="auto"`, Left/Right
 * (swapped under RTL, or Up/Down when `placement` is `start`/`end`) move focus *and* selection
 * together; with `activation="manual"` they move focus only and Enter/Space commits, which the APG
 * requires whenever revealing a panel is expensive. Home/End jump to the first/last enabled tab,
 * and a roving `tabindex` follows the focused tab. An enabled closable `<lr-tab>` adds
 * `aria-keyshortcuts="Delete"` to that same real tab button; Delete routes the close request through
 * the descriptor so `lr-close` still targets `<lr-tab>`. The visual close affordance stays
 * non-focusable and accessibility-hidden, avoiding a nested interactive control. Rich `<lr-tab>`
 * content is likewise inert while projected; only its accessibility-exposed, default-slot text
 * names the real tab button rather than leaving an interactive descendant inside it. Author
 * `aria-hidden`, hidden, inert, and CSS-hidden branches never leak into that name, and visibility
 * or text changes refresh it.
 *
 * **`inert` on a source child excludes its tab exactly as `disabled` does** — it never takes
 * selection, never holds the roving `tabindex`, and arrow keys step past it — and the rendered tab
 * button is itself marked `inert`, so a pointer cannot reach it either. Only the child's *own*
 * `inert` counts: a whole group inerted by an open modal keeps its selection and panels intact.
 *
 * **Two child models are accepted.** `<lr-tab panel="x">` plus `<lr-tab-panel name="x">` mirrors
 * `wa-tab-group`/`sl-tab-group`, so that markup renames mechanically; the group assigns the `slot`
 * attributes itself. The attribute model described above is this library's own original shape and
 * remains fully supported. A group containing any `<lr-tab>` child is read purely as the element
 * model, so the two never interleave ambiguously.
 * `defaultSlot` exposes the real unnamed shadow slot expected by mapped integrations. Lyra keeps
 * it hidden because every accepted child is assigned to a deterministic named projection slot.
 *
 * **Overflow.** A horizontal tab row that does not fit stays natively scrollable and gains two
 * scroll controls flanking the tablist inside `[part="nav"]`, mirroring both upstreams. They are
 * rendered only for a horizontal `placement` (a vertical strip scrolls in the block direction,
 * which these controls do not address — the same restriction both upstreams apply) and are laid out
 * only while the tablist genuinely overflows, gated on the measurement the edge fade already uses,
 * so a row that fits is never flanked by two dead buttons. `without-scroll-controls` (or Shoelace's
 * `no-scroll-controls`) opts out, leaving the pre-8.0.0 behavior: native scrolling plus the fade.
 * The fade is deliberately kept alongside the controls — it says "the row continues past this
 * edge", which the controls themselves cannot show, and both appear on exactly the same condition.
 * A vertical `start`/`end` nav stays shrinkable and is capped at
 * `--lr-tab-group-vertical-nav-max-inline-size` (default `var(--lr-size-12rem)`), so long labels
 * ellipsize rather than consuming the panel's allocation.
 *
 * **The scroll controls are `aria-hidden="true"` and `tabindex="-1"`** — a pointer affordance only,
 * matching upstream. The tablist is already fully keyboard-scrollable without them: the roving
 * `tabindex` puts every tab one arrow key away, and focusing a tab scrolls it into view. Adding two
 * tab stops in the middle of the strip would therefore buy no capability and cost every keyboard
 * user two extra stops between the tabs and the panel. They still carry a localized `aria-label`,
 * so the name is there for automation and for a consumer that chooses to expose them.
 *
 * @customElement lr-tab-group
 * @slot - Either `<lr-tab>`/`<lr-tab-panel>` pairs, or direct children with `slot="<id>" label="<text>"` (and optionally `disabled`); one becomes each tab's panel.
 * @slot nav - Upstream-compatible slot used by `<lr-tab>` descriptors.
 * @slot <id>-icon - Optional inert sibling direct child supplying a tab's leading icon content, in the attribute model only; excluded from the tab button's accessible name.
 * @event lr-tab-show - `detail: { name, tabId }`, fired when a tab becomes active via click or keyboard.
 * @event lr-tab-hide - `detail: { name, tabId }`, fired for the outgoing tab immediately before `lr-tab-show`.
 * @csspart base - Compatibility name for the root wrapper; use `tab-group`.
 * @csspart tab-group - The root wrapper around the tablist and panels. It is the same node as
 *   `base`.
 * @csspart nav - The row wrapping the tablist together with the two overflow scroll controls; mirrors the upstream part of the same name.
 * @csspart tabs - Upstream name on the same scroll container as `tablist`.
 * @csspart body - Wrapper around all tab panels.
 * @csspart tablist - The `role="tablist"` row of tab buttons.
 * @csspart scroll-button - Shared part on both overflow scroll controls.
 * @csspart scroll-button__base - Export-compatible base name on both scroll controls.
 * @csspart scroll-button-start - The control that scrolls the tabs toward their inline start ("previous" — the right-hand control under RTL).
 * @csspart scroll-button-end - The control that scrolls the tabs toward their inline end ("next" — the left-hand control under RTL).
 * @csspart scroll-button--start - Upstream modifier alias on `scroll-button-start`.
 * @csspart scroll-button--end - Upstream modifier alias on `scroll-button-end`.
 * @csspart scroll-button-glyph - The chevron wrapper inside a scroll control. This is the element that mirrors under RTL; the icon itself never rotates.
 * @csspart tab - A single tab button.
 * @csspart tab-icon - The optional aria-hidden leading-icon wrapper inside a tab button. Its assigned source is inert while projected; the wrapper renders only when that tab has a matching `<id>-icon` sibling.
 * @csspart panel - A single `role="tabpanel"` wrapper (one per tab, hidden unless active).
 * @csspart active-tab-indicator - Indicator inside the active tab.
 * @cssprop --indicator-color - Upstream alias for the active indicator color.
 * @cssprop --track-color - Upstream track color.
 * @cssprop --track-width - Upstream track width.
 * @cssprop [--lr-scroll-fade-size=2rem] - Width of the fade at each horizontal scroll edge. The
 *   fade is applied only while the tablist actually overflows, so a row that fits is never dimmed.
 * @cssprop [--lr-tab-group-selected-color=var(--lr-color-brand)] - Text color of the selected tab.
 *   Scoped to `[aria-selected='true']` only, so it never repaints a hovered unselected tab (which
 *   is what hijacking `--lr-color-brand` library-wide used to do).
 * @cssprop [--lr-tab-group-indicator-color=var(--lr-color-brand)] - Color of the selected tab's
 *   underline, themeable independently of its text color.
 * @cssprop [--lr-tab-group-hover-color=var(--lr-color-text)] - Text color of a hovered, non-disabled tab.
 *   Independent of the selected-state props above.
 * Pressed-tab and scroll-control hooks use inline `var()` fallbacks rather than a `:host`
 * declaration, so they inherit from the group or any ancestor without retheming the other states.
 * @cssprop [--lr-tab-group-active-bg=color-mix(in oklab, transparent, var(--lr-color-mix-partner) var(--lr-color-mix-active))] - Background of a pressed, non-disabled tab.
 * @cssprop [--lr-tab-group-active-color=var(--lr-tab-group-hover-color, var(--lr-color-text))] - Text
 *   color of a pressed, non-disabled tab.
 * @cssprop [--lr-tab-group-scroll-button-hover-color=var(--lr-color-text)] - Text color of a
 *   hovered overflow scroll control.
 * @cssprop [--lr-tab-group-scroll-button-active-bg=color-mix(in oklab, transparent, var(--lr-color-mix-partner) var(--lr-color-mix-active))] - Background of a pressed overflow scroll control.
 * @cssprop [--lr-tab-group-scroll-button-active-color=var(--lr-color-text)] - Text color of a
 *   pressed overflow scroll control.
 * @cssprop [--lr-tab-group-vertical-nav-max-inline-size=var(--lr-size-12rem)] - Maximum logical
 *   inline size of a vertical `start`/`end` nav. Long labels ellipsize inside that bound so the
 *   panel remains usable at narrow allocations.
 * @status stable
 * @since 8.0.0
 */
export class LyraTabGroup extends LyraElement<LyraTabGroupEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    scrollNext: LYRA_DEFAULT_scrollNext,
    scrollPrevious: LYRA_DEFAULT_scrollPrevious,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** The active tab's `slot`/id. Falls back to the first enabled tab whenever the current value doesn't resolve to one. */
  @property({ reflect: true }) active = '';

  /** Accessible name for the `role="tablist"` strip. Attribute-reflects from a host-level
   *  `aria-label` so a plain-markup consumer gets ARIA-name forwarding without setting a JS
   *  property. `null` omits the attribute; an explicit empty string is forwarded (the role has no
   *  localized default name). */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  /** Which edge the tab strip sits on. `start`/`end` are logical and mirror under RTL; both make
   *  the tablist vertical, which swaps the navigation keys to Up/Down per the APG. */
  @property({ reflect: true }) placement: TabGroupPlacement = 'top';

  /** `auto` (the default) moves selection with focus. `manual` moves focus only and waits for
   *  Enter or Space — the APG requirement for panels that are expensive to reveal. */
  @property({ reflect: true }) activation: TabGroupActivation = 'auto';

  /** Suppresses the overflow scroll controls, leaving an overflowing tab row natively scrollable
   *  with the edge fade as its only affordance. Web Awesome's spelling of the flag. */
  @property({ type: Boolean, attribute: 'without-scroll-controls', reflect: true })
  withoutScrollControls = false;

  /** Shoelace's spelling of `withoutScrollControls`, read alongside it so a consumer arriving from
   *  either upstream finds their own attribute working. Neither is deprecated. */
  @property({ type: Boolean, attribute: 'no-scroll-controls', reflect: true })
  noScrollControls = false;

  /** Shoelace compatibility flag. Lyra's controls remain present at both edges whenever the row
   * overflows, so enabling this preserves that fixed behavior explicitly. */
  @property({ type: Boolean, attribute: 'fixed-scroll-controls', reflect: true })
  fixedScrollControls = false;

  /** The group's real unnamed slot. It is kept hidden because Lyra assigns each tab and panel to
   * its own deterministic named slot, but remains exposed for mapped slot observation. */
  @query('slot:not([name])') defaultSlot!: HTMLSlotElement;

  @state() private tabs: TabDef[] = [];
  /** Where keyboard focus currently sits under `activation="manual"`, which is allowed to differ
   *  from `active`. Under `auto` the two are always the same, so this simply follows selection. */
  @state() private focusedTab = '';

  private baseId = nextId('tab-group');
  private nextOpaqueId = 0;
  private readonly idsBySlot = new Map<string, { tab: string; panel: string }>();
  private mutationObserver?: MutationObserver;
  private mutationObserverDocument?: Document;
  private mutationObserverGeneration = 0;
  private readonly projectedSourceSnapshots = new Map<Element, ProjectedSourceSnapshot>();
  private projectedSourceObserver?: MutationObserver;
  private projectedSourceObserverDocument?: Document;
  private projectedSourceObserverGeneration = 0;
  private rehomeTabFocus = false;

  constructor() {
    super();
    // Gates the [part="tablist"] edge fade on the strip genuinely overflowing -- see
    // --lr-scroll-fade-size and tabs.styles.ts.
    observeScrollOverflow(this, () => this.renderRoot.querySelector('[part~="tablist"]'));
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.syncTabs();
    // Each child carries its own individual `slot` attribute (one named slot
    // per tab, unlike lr-split's single default-slot-of-many-panels) -- a
    // brand-new tab's name has no matching `<slot>` to fire `slotchange` on
    // until *this* component has already rendered one for it, and neither
    // `slotchange` nor any Lit lifecycle hook observes a plain attribute
    // edit (panel/name/slot/label/disabled) on a light-DOM child at all. A
    // mutation observer on the host is the only thing that sees either case. `attributes: true`
    // alone only reports mutations on the observed node itself (`this`), never
    // on its children, so `subtree: true` is required too -- but that widens
    // `childList`/`attributeFilter` to the *entire* descendant tree, including
    // each panel's own projected content. A panel can legitimately churn its
    // own children/attributes fast (a streaming log, a live JSON preview), so
    // every record is filtered down to direct-child mutations, except label-affecting text, content,
    // or visibility changes inside a direct <lr-tab>. Panel-internal churn still never forces a tabs
    // recompute or re-render.
    this.resetMutationObserver();
    const ownerDocument = this.ownerDocument;
    const MutationObserverCtor = ownerDocument.defaultView?.MutationObserver;
    if (!MutationObserverCtor) return;
    const generation = this.mutationObserverGeneration;
    const observer = new MutationObserverCtor((records) => {
      if (
        this.mutationObserver !== observer ||
        this.mutationObserverDocument !== ownerDocument ||
        this.mutationObserverGeneration !== generation ||
        !this.isConnected ||
        this.ownerDocument !== ownerDocument
      ) {
        return;
      }
      const isDirectChild = (node: Node) => node.parentNode === this;
      const isElementTabContent = (node: Node): boolean => {
        let current: Element | null = node.nodeType === 1 ? node as Element : node.parentElement;
        while (current && current !== this) {
          if (current.localName === tag('tab') && current.parentNode === this) return true;
          current = current.parentElement;
        }
        return false;
      };
      const relevant = records.some((record) => {
        if (record.type === 'childList') {
          return record.target === this || isElementTabContent(record.target);
        }
        if (record.type === 'characterData') return isElementTabContent(record.target);
        if (
          record.attributeName === 'inert' &&
          this.projectedSourceSnapshots.has(record.target as Element)
        ) {
          return false;
        }
        return isDirectChild(record.target) || isElementTabContent(record.target);
      });
      if (relevant) this.syncTabs();
    });
    this.mutationObserver = observer;
    this.mutationObserverDocument = ownerDocument;
    observer.observe(this, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
      attributeFilter: [
        'aria-hidden',
        'aria-label',
        'class',
        'closable',
        'disabled',
        'hidden',
        'inert',
        'label',
        'name',
        'open',
        'panel',
        'slot',
        'style',
      ],
    });
  }

  override disconnectedCallback(): void {
    this.resetMutationObserver();
    this.resetProjectedSourceObserver();
    this.restoreProjectedSources();
    super.disconnectedCallback();
  }

  adoptedCallback(): void {
    this.resetMutationObserver();
    this.resetProjectedSourceObserver();
  }

  private resetMutationObserver(): void {
    this.mutationObserverGeneration += 1;
    this.mutationObserver?.disconnect();
    this.mutationObserver = undefined;
    this.mutationObserverDocument = undefined;
  }

  /**
   * Rebuilds `tabs` from the current direct children, in whichever of the two child models they
   * use. First child wins when two share a name (matching native slot assignment: both would
   * render into the one panel, but only one label can back the button).
   *
   * **Element model** (`<lr-tab panel="x">` + `<lr-tab-panel name="x">`) mirrors both upstreams, so
   * `wa-tab-group`/`sl-tab-group` markup renames mechanically. **Attribute model** (any child with
   * `slot="x" label="…"`) is this library's own original shape and stays fully supported — several
   * components here compose it. A group using any `<lr-tab>` child is read purely as the element
   * model, so the two never interleave ambiguously within one group.
   */
  private syncTabs = (): void => {
    const children = Array.from(this.children);
    this.adoptProjectedSourceInertStates();
    const next = children.some((child) => child.localName === tag('tab'))
      ? this.readElementModel(children)
      : this.readAttributeModel(children);
    this.syncProjectedSources(children, next);
    const liveSlots = new Set(next.map((tab) => tab.slotName));
    for (const slotName of this.idsBySlot.keys()) {
      if (!liveSlots.has(slotName)) this.idsBySlot.delete(slotName);
    }
    this.tabs = next;
  };

  private readAttributeModel(children: Element[]): TabDef[] {
    const seen = new Set<string>();
    const next: TabDef[] = [];
    for (const child of children) {
      const slotName = child.getAttribute('slot');
      const label = child.getAttribute('label');
      if (!slotName || !label || seen.has(slotName)) continue;
      seen.add(slotName);
      const iconSlot = this.iconSlotName(slotName);
      const hasIcon = children.some((c) => c.getAttribute('slot') === iconSlot);
      next.push({
        slotName,
        label,
        disabled: child.hasAttribute('disabled'),
        inert: isInertChild(child),
        hasIcon,
        source: 'attribute',
      });
    }
    return next;
  }

  /**
   * Reads `<lr-tab>`/`<lr-tab-panel>` pairs and assigns each one the `slot` that lands it in the
   * right place: a tab projects into its own button, a panel into its own tabpanel wrapper. Writing
   * `slot` here rather than asking consumers to is what keeps the upstream markup a pure rename --
   * and it is idempotent, so the mutation observer that sees the write does not re-enter.
   *
   * A tab with no `panel` still gets a stable synthetic name from its position, so an unpaired tab
   * renders a button with an empty panel instead of silently disappearing.
   */
  private readElementModel(children: Element[]): TabDef[] {
    const seen = new Set<string>();
    const next: TabDef[] = [];
    const panels = children.filter((child) => child.localName === tag('tab-panel'));
    let index = 0;
    for (const child of children) {
      if (child.localName !== tag('tab')) continue;
      const slotName = child.getAttribute('panel') || `${SYNTHETIC_PANEL_PREFIX}${index}`;
      index += 1;
      if (seen.has(slotName)) continue;
      seen.add(slotName);
      const tabSlot = this.tabSlotName(slotName);
      if (child.getAttribute('slot') !== tabSlot) child.setAttribute('slot', tabSlot);
      const panel = panels.find((candidate) => candidate.getAttribute('name') === slotName);
      if (panel && panel.getAttribute('slot') !== slotName) panel.setAttribute('slot', slotName);
      next.push({
        slotName,
        label: this.readElementLabel(child as LyraTab),
        disabled: child.hasAttribute('disabled'),
        inert: isInertChild(child),
        hasIcon: false,
        source: 'element',
        element: child as LyraTab,
      });
      if (!this.active && child.hasAttribute('active')) this.active = slotName;
    }
    return next;
  }

  /** Rich tab descriptors are visual-only projections. Their direct default-slot elements are
   * made inert by this group, but the outer real tab still needs the author-visible, accessible
   * label text. Read that text through the same flattened slot shape while preserving every
   * author-owned accessibility exclusion. */
  private readElementLabel(tab: LyraTab): string {
    return Array.from(tab.childNodes)
      .filter((node) =>
        node.nodeType !== Node.ELEMENT_NODE || (node as Element).getAttribute('slot') === null ||
        (node as Element).getAttribute('slot') === '',
      )
      .map((node) => this.accessibleTabLabelText(node))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private tabLabelComposedParent(node: Node): Element | null {
    const assignedSlot = (node as Node & { assignedSlot?: HTMLSlotElement | null }).assignedSlot;
    if (assignedSlot) return assignedSlot;
    if (node.parentElement) return node.parentElement;
    const root = node.getRootNode() as Document | ShadowRoot;
    return 'host' in root && root.host.nodeType === Node.ELEMENT_NODE ? root.host : null;
  }

  private libraryOwnsSourceInert(element: Element): boolean {
    return this.projectedSourceSnapshots.get(element)?.libraryOwnsInert === true;
  }

  private isTabLabelSubtreeExcluded(element: Element): boolean {
    return (
      isTabLabelSubtreeExcludedWithoutInert(element) ||
      (element.hasAttribute('inert') && !this.libraryOwnsSourceInert(element))
    );
  }

  /** Mirrors the accessibility visibility walk, except that it treats only this group's own
   * source-level inert fence as presentation. Author-provided inertness remains an exclusion. */
  private isTabLabelVisible(element: Element, initialComposedChild: Node | null = null): boolean {
    if (!element.isConnected) return false;
    let current: Element | null = element;
    let composedChild: Node | null = initialComposedChild;
    while (current) {
      if (this.isTabLabelSubtreeExcluded(current)) return false;
      if (isClosedDetailsContentBranch(current, composedChild)) return false;
      if (current === element && isAccessibilityVisibilityHidden(current)) return false;
      if (current.localName === tag('tab') && current.parentNode === this) break;
      composedChild = current;
      current = composedParentElement(current);
    }

    const targetDisplay = element.ownerDocument.defaultView?.getComputedStyle(element).display;
    // `display: contents` has no own box, so `checkVisibility()` answers false even while its
    // semantic children are exposed. Every other target must opt into the skipped
    // `content-visibility:auto` check the shared accessibility helper uses.
    if (targetDisplay === 'contents') return true;
    const visibilityTarget = element as Element & {
      checkVisibility?: (options?: { contentVisibilityAuto?: boolean }) => boolean;
    };
    return typeof visibilityTarget.checkVisibility === 'function'
      ? visibilityTarget.checkVisibility({ contentVisibilityAuto: true })
      : true;
  }

  private accessibleTabLabelText(node: Node, inheritedTextVisible?: boolean): string {
    if (node.nodeType === Node.TEXT_NODE) {
      const parent = this.tabLabelComposedParent(node);
      const textVisible =
        inheritedTextVisible !== false && parent !== null && this.isTabLabelVisible(parent, node);
      return textVisible ? node.textContent ?? '' : '';
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const element = node as Element;
    if (this.isTabLabelSubtreeExcluded(element)) return '';
    const ownTextVisible = !isAccessibilityVisibilityHidden(element);
    if (ownTextVisible && !this.isTabLabelVisible(element)) return '';
    const accessibleLabel = ownTextVisible ? element.getAttribute('aria-label')?.trim() : '';
    if (accessibleLabel) return accessibleLabel;
    const children =
      element.localName === 'slot' && (element as HTMLSlotElement).assignedNodes().length > 0
        ? (element as HTMLSlotElement).assignedNodes({ flatten: true })
        : Array.from(element.childNodes);
    return Array.from(children)
      .map((child) => this.accessibleTabLabelText(child, ownTextVisible))
      .join(' ');
  }

  private snapshotProjectedSource(source: Element): ProjectedSourceSnapshot {
    const inert = source.getAttribute('inert');
    return { inert, appliedInert: inert, libraryOwnsInert: false };
  }

  private adoptProjectedSourceInert(
    source: Element,
    snapshot: ProjectedSourceSnapshot,
  ): void {
    const current = source.getAttribute('inert');
    if (current !== snapshot.appliedInert) {
      snapshot.inert = current;
      snapshot.libraryOwnsInert = false;
    }
  }

  private makeProjectedSourceInert(source: Element, snapshot: ProjectedSourceSnapshot): void {
    if (!source.hasAttribute('inert')) {
      source.setAttribute('inert', '');
      snapshot.libraryOwnsInert = true;
    }
    snapshot.appliedInert = source.getAttribute('inert');
  }

  private restoreProjectedSource(source: Element, snapshot: ProjectedSourceSnapshot): void {
    this.adoptProjectedSourceInert(source, snapshot);
    if (snapshot.inert === null) source.removeAttribute('inert');
    else source.setAttribute('inert', snapshot.inert);
  }

  private restoreProjectedSources(): void {
    for (const [source, snapshot] of this.projectedSourceSnapshots) {
      this.restoreProjectedSource(source, snapshot);
    }
    this.projectedSourceSnapshots.clear();
  }

  private resetProjectedSourceObserver(): void {
    this.projectedSourceObserverGeneration += 1;
    this.projectedSourceObserver?.disconnect();
    this.projectedSourceObserver = undefined;
    this.projectedSourceObserverDocument = undefined;
  }

  private observeProjectedSources(): void {
    this.resetProjectedSourceObserver();
    const ownerDocument = this.ownerDocument;
    const MutationObserverCtor = ownerDocument.defaultView?.MutationObserver;
    if (!MutationObserverCtor || !this.isConnected || this.projectedSourceSnapshots.size === 0) {
      return;
    }
    const generation = this.projectedSourceObserverGeneration;
    const observer = new MutationObserverCtor((records) => {
      if (
        this.projectedSourceObserver !== observer ||
        this.projectedSourceObserverDocument !== ownerDocument ||
        this.projectedSourceObserverGeneration !== generation ||
        !this.isConnected ||
        this.ownerDocument !== ownerDocument
      ) {
        return;
      }
      if (records.some((record) => this.projectedSourceSnapshots.has(record.target as Element))) {
        this.syncTabs();
      }
    });
    this.projectedSourceObserver = observer;
    this.projectedSourceObserverDocument = ownerDocument;
    for (const source of this.projectedSourceSnapshots.keys()) {
      observer.observe(source, { attributes: true, attributeFilter: ['inert'] });
    }
  }

  private projectedSources(children: Element[], tabs: readonly TabDef[]): Set<Element> {
    const sources = new Set<Element>();
    const iconSlots = new Set(
      tabs
        .filter((tab) => tab.source === 'attribute')
        .map((tab) => this.iconSlotName(tab.slotName)),
    );
    for (const child of children) {
      if (iconSlots.has(child.getAttribute('slot') ?? '')) sources.add(child);
    }
    for (const tab of tabs) {
      if (tab.source !== 'element' || !tab.element) continue;
      for (const child of Array.from(tab.element.children)) {
        if ((child.getAttribute('slot') ?? '') === '') sources.add(child);
      }
    }
    return sources;
  }

  private syncProjectedSources(children: Element[], tabs: readonly TabDef[]): void {
    const sources = this.projectedSources(children, tabs);
    for (const [source, snapshot] of this.projectedSourceSnapshots) {
      this.adoptProjectedSourceInert(source, snapshot);
      if (!sources.has(source)) {
        this.restoreProjectedSource(source, snapshot);
        this.projectedSourceSnapshots.delete(source);
      }
    }
    for (const source of sources) {
      const snapshot =
        this.projectedSourceSnapshots.get(source) ?? this.snapshotProjectedSource(source);
      this.projectedSourceSnapshots.set(source, snapshot);
      this.adoptProjectedSourceInert(source, snapshot);
      this.makeProjectedSourceInert(source, snapshot);
    }
    this.observeProjectedSources();
  }

  private adoptProjectedSourceInertStates(): void {
    for (const [source, snapshot] of this.projectedSourceSnapshots) {
      this.adoptProjectedSourceInert(source, snapshot);
    }
  }

  /** Whether a tab can hold selection, the roving `tabindex`, and arrow-key focus. `inert` counts
   *  alongside `disabled` — see `isInertChild()` for why, and for why only the child's own inert
   *  state is consulted. */
  private isNavigable(tab: TabDef): boolean {
    return !tab.disabled && !tab.inert;
  }

  /** Keeps `active` resolved to a real, navigable tab -- covers the initial default, a tab disappearing/becoming disabled or inert underneath the current selection, and a consumer assigning `.active` directly. Silent (no `lr-tab-show`): this corrects *invalid* state rather than responding to a user picking a different tab. Reading the focused element *before* the render that marks the outgoing button `inert` is what lets `updated()` rehome real focus rather than leaving it stranded on `<body>`. */
  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (!changed.has('tabs') && !changed.has('active')) return;
    const current = this.tabs.find((t) => t.slotName === this.active);
    if (current && this.isNavigable(current)) return;
    this.rehomeTabFocus =
      activeElementIn(this.renderRoot as ShadowRoot)?.getAttribute('part') ===
      'tab';
    this.active = this.tabs.find((t) => this.isNavigable(t))?.slotName ?? '';
    this.focusedTab = this.active;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('active') || changed.has('tabs')) this.syncElementActiveState();
    if (!this.rehomeTabFocus) return;
    this.rehomeTabFocus = false;
    this.renderRoot
      .querySelector<HTMLElement>('[part="tab"][tabindex="0"]')
      ?.focus();
  }

  /** Activates `tab` (no-op for a disabled tab or one that's already active), emitting
   *  `lr-tab-hide` for the outgoing tab before `lr-tab-show` for the incoming one, so a listener
   *  that tears down the old panel always runs before the one that builds the new one. */
  private selectTab(tab: TabDef): void {
    if (!this.isNavigable(tab) || tab.slotName === this.active) return;
    const previous = this.active;
    this.active = tab.slotName;
    this.focusedTab = tab.slotName;
    if (previous) this.emit('lr-tab-hide', { tabId: previous, name: previous });
    this.emit('lr-tab-show', { tabId: tab.slotName, name: tab.slotName });
  }

  /** Show the panel named by an `<lr-tab panel>` or attribute-model slot. */
  show(panel: string): void {
    const tab = this.tabs.find((candidate) => candidate.slotName === panel);
    if (tab) this.selectTab(tab);
  }

  /** Mirrors selection onto public `active` hints for SSR-compatible tab/panel children. */
  private syncElementActiveState(): void {
    for (const child of Array.from(this.children)) {
      if (child.localName === tag('tab')) {
        child.toggleAttribute('active', child.getAttribute('panel') === this.active);
      } else if (child.localName === tag('tab-panel')) {
        child.toggleAttribute('active', child.getAttribute('name') === this.active);
      }
    }
  }

  /** Moves the roving focus without selecting -- the `activation="manual"` path. */
  private focusOnly(tab: TabDef): void {
    this.focusedTab = tab.slotName;
    this.focusTab(tab.slotName);
  }

  /** Whichever tab currently owns `tabindex="0"`. Under `auto` that is always the selected tab;
   *  under `manual` focus may sit elsewhere, and it must fall back to the selection whenever the
   *  remembered tab has gone away or become disabled. */
  private get rovingTab(): string {
    const candidate = this.tabs.find((t) => t.slotName === this.focusedTab && this.isNavigable(t));
    return candidate ? candidate.slotName : this.active;
  }

  /** Moves real DOM focus to tab `slotName`'s button. Safe to call immediately (no `updateComplete` wait): every tab button already exists in the DOM regardless of its current `tabindex`, and `tabindex="-1"` elements are still focusable via script. */
  private focusTab(slotName: string): void {
    const buttons = this.renderRoot.querySelectorAll('[part="tab"]');
    for (const button of Array.from(buttons)) {
      if ((button as HTMLElement).dataset['slot'] === slotName) {
        (button as HTMLElement).focus();
        return;
      }
    }
  }

  /** Whether the strip runs down the side rather than across the top -- which decides both the
   *  navigation keys and `aria-orientation`. */
  private get isVertical(): boolean {
    return this.placement === 'start' || this.placement === 'end';
  }

  private onTabListKeyDown = (e: KeyboardEvent): void => {
    const navigable = this.tabs.filter((t) => this.isNavigable(t));
    if (navigable.length === 0) return;
    const currentIndex = navigable.findIndex((t) => t.slotName === this.rovingTab);

    if (e.key === 'Delete') {
      const focused = navigable.find((tab) => tab.slotName === this.rovingTab);
      if (!focused?.element?.closable) return;
      e.preventDefault();
      focused.element.requestCloseFromOwner();
      return;
    }

    // A vertical strip navigates with Up/Down per the APG; a horizontal one with Left/Right, which
    // swap under RTL the same way lr-split/lr-tree handle physical directions. Up/Down are never
    // direction-dependent -- block flow does not reverse under RTL.
    const rtl = isRtl(this);
    const forwardKey = this.isVertical ? 'ArrowDown' : rtl ? 'ArrowLeft' : 'ArrowRight';
    const backwardKey = this.isVertical ? 'ArrowUp' : rtl ? 'ArrowRight' : 'ArrowLeft';

    // Manual activation commits the focused tab; the APG requires this precisely because automatic
    // activation would reveal every panel arrowed past.
    if (this.activation === 'manual' && (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar')) {
      const focused = navigable.find((t) => t.slotName === this.rovingTab);
      if (!focused) return;
      e.preventDefault();
      this.selectTab(focused);
      return;
    }

    let targetIndex: number;
    switch (e.key) {
      case forwardKey:
        targetIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % navigable.length;
        break;
      case backwardKey:
        targetIndex = currentIndex < 0 ? navigable.length - 1 : (currentIndex - 1 + navigable.length) % navigable.length;
        break;
      case 'Home':
        targetIndex = 0;
        break;
      case 'End':
        targetIndex = navigable.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    const target = navigable[targetIndex]!; // safe: navigable non-empty (checked) and targetIndex in [0, length)
    if (this.activation === 'manual') {
      this.focusOnly(target);
      return;
    }
    this.selectTab(target);
    this.focusTab(target.slotName);
  };

  private tabId(slotName: string): string {
    return this.idsFor(slotName).tab;
  }
  private panelId(slotName: string): string {
    return this.idsFor(slotName).panel;
  }
  private idsFor(slotName: string): { tab: string; panel: string } {
    const existing = this.idsBySlot.get(slotName);
    if (existing) return existing;
    const token = `${this.baseId}-${this.nextOpaqueId++}`;
    const ids = { tab: `${token}-tab`, panel: `${token}-panel` };
    this.idsBySlot.set(slotName, ids);
    return ids;
  }
  /** Derives a tab's optional icon-sibling `slot` name from its own `slotName` -- see the class doc. */
  private iconSlotName(slotName: string): string {
    return `${slotName}-icon`;
  }

  /** Derives the `slot` an `<lr-tab>` is projected into -- its own button. */
  private tabSlotName(slotName: string): string {
    return `${slotName}-tab`;
  }

  /** Whether either upstream's opt-out attribute is set. Both are read; neither wins. */
  private get scrollControlsSuppressed(): boolean {
    return this.withoutScrollControls || this.noScrollControls;
  }

  /**
   * Scrolls the tab row one step toward `edge`. Native scrolling does the work -- there is no
   * scroll listener and no scroll-position state anywhere in this component.
   *
   * `edge` is logical, so it is `effectiveDirection` that turns it into a physical delta: per the
   * CSSOM View spec (what every browser this library targets implements) `scrollLeft` under RTL
   * runs 0 at the inline start down to -max at the inline end, so "toward the end" is a *negative*
   * left delta there -- the mirror image of the LTR case, and the reason this cannot be a constant.
   *
   * `instant` rather than `auto` for the reduced-motion branch: `auto` defers to the stylesheet, so
   * a consumer's own `scroll-behavior: smooth` on the tablist would animate the very scroll the
   * preference asks not to animate.
   */
  private scrollTabs(edge: 'start' | 'end'): void {
    const tablist = this.renderRoot.querySelector('[part~="tablist"]');
    if (!tablist || !isHtmlElement(tablist) || typeof tablist.scrollBy !== 'function') return;
    const step = Math.max(1, tablist.clientWidth * SCROLL_STEP_RATIO);
    const towardEnd = edge === 'end' ? 1 : -1;
    const physical = this.effectiveDirection === 'rtl' ? -towardEnd : towardEnd;
    tablist.scrollBy({
      left: step * physical,
      behavior: prefersReducedMotion(this.ownerDocument.defaultView) ? 'instant' : 'smooth',
    });
  }

  /** One overflow scroll control, or nothing at all when this group cannot have them (see the class
   *  doc: vertical placement, or either upstream's opt-out attribute). Whether a *rendered* control
   *  is laid out is a separate, purely visual question the stylesheet answers from the tablist's own
   *  overflow measurement. */
  private renderScrollControl(edge: 'start' | 'end'): TemplateResult | typeof nothing {
    if (this.isVertical || this.scrollControlsSuppressed) return nothing;
    const part = edge === 'start'
      ? 'scroll-button scroll-button__base scroll-button-start scroll-button--start'
      : 'scroll-button scroll-button__base scroll-button-end scroll-button--end';
    return html`<button
      type="button"
      part=${part}
      tabindex="-1"
      aria-hidden="true"
      aria-label=${edge === 'start' ? this.localize('scrollPrevious') : this.localize('scrollNext')}
      @pointerdown=${this.onScrollControlPointerDown}
      @pointerup=${this.onScrollControlPointerEnd}
      @pointercancel=${this.onScrollControlPointerEnd}
      @lostpointercapture=${this.onScrollControlPointerEnd}
      @mousedown=${this.onScrollControlMouseDown}
      @click=${() => this.scrollTabs(edge)}
    ><span part="scroll-button-glyph" aria-hidden="true">${chevronIcon()}</span></button>`;
  }

  /** Pressing a control must not pull focus off the tab the user was on: Chromium focuses a button
   *  on mousedown, and focus landing on an `aria-hidden` element leaves assistive technology with
   *  no focus context at all. Suppressing the default keeps the roving tabindex where it was; the
   *  click still fires. */
  private onScrollControlMouseDown = (event: MouseEvent): void => {
    event.preventDefault();
  };

  /** Firefox suppresses the native `:active` pseudo-class when the mouse-down default is
   * prevented to retain the tab's roving focus. Mirror that short-lived state on the control so
   * its pressed affordance remains visible in every supported engine. */
  private onScrollControlPointerDown = (event: PointerEvent): void => {
    const control = event.currentTarget;
    if (!(control instanceof HTMLElement)) return;
    control.setAttribute('data-pressed', '');
    control.setPointerCapture(event.pointerId);
  };

  private onScrollControlPointerEnd = (event: PointerEvent): void => {
    const control = event.currentTarget;
    if (!(control instanceof HTMLElement)) return;
    control.removeAttribute('data-pressed');
    if (control.hasPointerCapture(event.pointerId)) {
      control.releasePointerCapture(event.pointerId);
    }
  };

  private renderTab(tab: TabDef): TemplateResult {
    const selected = tab.slotName === this.active;
    const closable = this.isNavigable(tab) && Boolean(tab.element?.closable);
    return html`<button
      type="button"
      part="tab"
      id=${this.tabId(tab.slotName)}
      data-slot=${tab.slotName}
      role="tab"
      ?inert=${tab.inert}
      aria-selected=${selected ? 'true' : 'false'}
      aria-disabled=${tab.disabled ? 'true' : 'false'}
      aria-label=${tab.source === 'element' && tab.label ? tab.label : nothing}
      aria-controls=${this.panelId(tab.slotName)}
      aria-keyshortcuts=${closable ? 'Delete' : nothing}
      tabindex=${tab.slotName === this.rovingTab ? '0' : '-1'}
      @click=${() => this.selectTab(tab)}
    >${tab.source === 'element'
      ? html`<slot name=${this.tabSlotName(tab.slotName)}></slot>`
      : html`${tab.hasIcon
          ? html`<span part="tab-icon" aria-hidden="true"><slot name=${this.iconSlotName(tab.slotName)}></slot></span>`
          : nothing}${tab.label}`}${selected
      ? html`<span part="active-tab-indicator" aria-hidden="true"></span>`
      : nothing}</button>`;
  }

  private renderPanel(tab: TabDef): TemplateResult {
    const selected = tab.slotName === this.active;
    return html`<div
      part="panel"
      id=${this.panelId(tab.slotName)}
      role="tabpanel"
      aria-labelledby=${this.tabId(tab.slotName)}
      tabindex="0"
      ?hidden=${!selected}
    >
      <slot name=${tab.slotName}></slot>
    </div>`;
  }

  override render(): TemplateResult {
    // Keyed by `slotName`, not a plain `.map()`: a plain array binding reuses
    // each rendered DOM node by *position*, so removing e.g. the first tab
    // would silently relabel the still-focused second button's DOM node into
    // the (unfocused) third tab's button, leaving real keyboard focus stuck
    // on a tabindex="-1"/aria-selected="false" button instead of following
    // the tab it used to represent. Keying by identity keeps each tab's own
    // DOM node (and any focus on it) attached to that same tab across
    // additions/removals anywhere in the list.
    return html`
      <slot hidden></slot>
      <div part="base tab-group">
        <div part="nav">
          ${this.renderScrollControl('start')}
          <div
            part="tablist tabs"
            role="tablist"
            aria-label=${this.accessibleLabel ?? nothing}
            aria-orientation=${this.isVertical ? 'vertical' : 'horizontal'}
            @keydown=${this.onTabListKeyDown}
          >
            ${repeat(this.tabs, (tab) => tab.slotName, (tab) => this.renderTab(tab))}
          </div>
          ${this.renderScrollControl('end')}
        </div>
        <div part="body">
          ${repeat(this.tabs, (tab) => tab.slotName, (tab) => this.renderPanel(tab))}
        </div>
      </div>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-tab-group': LyraTabGroup;
  }
}

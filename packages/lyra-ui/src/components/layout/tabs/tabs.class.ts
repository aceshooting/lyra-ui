import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { isRtl } from '../../../internal/rtl.js';
import { nextId } from '../../../internal/a11y.js';
import { styles } from './tabs.styles.js';

/**
 * One tab, derived from a direct light-DOM child's `slot`/`label`/`disabled`
 * attributes, plus whether a sibling `slot="<id>-icon"` child is also present
 * (see the class doc for the icon mechanism).
 */
interface TabDef {
  slotName: string;
  label: string;
  disabled: boolean;
  hasIcon: boolean;
}

export interface LyraTabsEventMap {
  'lr-tabs-change': CustomEvent<{ tabId: string }>;
}
/**
 * `<lr-tabs>` — a tab strip whose panels are direct light-DOM children,
 * each carrying `slot="<id>"` (the panel's stable id) and `label="<text>"`
 * (the tab button's text). One named `<slot>` is rendered per distinct
 * `slot` name found among the current children — a child with no `label`,
 * or a name with no matching child, simply never produces a tab.
 *
 * A tab button's *visible* content can carry a leading icon without ever
 * changing its *accessible name* (which always stays exactly `label`'s
 * text, nothing else): give a tab an extra direct-child sibling of
 * `<lr-tabs>` carrying `slot="<id>-icon"` (that sibling's own content --
 * an inline SVG, an emoji span, a custom icon element, anything -- is
 * entirely up to the consumer). It's rendered ahead of the label inside
 * that tab's button, wrapped in an `aria-hidden="true"` part so it's
 * excluded from accessible-name computation no matter what it contains. A
 * tab with no matching `<id>-icon` sibling renders no icon wrapper at all,
 * so existing text-only tabs are completely unaffected. (A named slot,
 * rather than a second attribute holding an icon-name lookup, was chosen
 * because this library's `internal/icons.ts` is a small closed set of
 * chrome glyphs for this library's *own* components, not a public
 * name-keyed registry -- a slot lets a consumer supply an arbitrary,
 * domain-specific icon instead of being limited to that internal set.)
 *
 * Implements the WAI-ARIA APG tabs pattern with automatic activation:
 * Left/Right (swapped under RTL) move focus *and* selection together,
 * Home/End jump to the first/last enabled tab, and a roving `tabindex`
 * follows whichever tab is currently selected.
 *
 * @customElement lr-tabs
 * @slot - Direct children with `slot="<id>" label="<text>"` (and optionally `disabled`); one becomes each tab's panel.
 * @slot <id>-icon - Optional sibling direct child supplying a tab's leading icon content; excluded from the tab button's accessible name.
 * @event lr-tabs-change - `detail: { tabId }`, fired when the active tab changes via click or keyboard.
 * @csspart base - The root wrapper around the tablist and panels.
 * @csspart tablist - The `role="tablist"` row of tab buttons.
 * @csspart tab - A single tab button.
 * @csspart tab-icon - The optional leading-icon wrapper inside a tab button; only rendered when that tab has a matching `<id>-icon` sibling.
 * @csspart panel - A single `role="tabpanel"` wrapper (one per tab, hidden unless active).
 * @cssprop [--lr-scroll-fade-size=2rem] - Width of the static fade at each horizontal scroll edge.
 * @cssprop [--lr-tabs-selected-color=var(--lr-color-brand)] - Text color of the selected tab.
 *   Scoped to `[aria-selected='true']` only, so it never repaints a hovered unselected tab (which
 *   is what hijacking `--lr-color-brand` library-wide used to do).
 * @cssprop [--lr-tabs-indicator-color=var(--lr-color-brand)] - Color of the selected tab's
 *   underline, themeable independently of its text color.
 * @cssprop [--lr-tabs-hover-color=var(--lr-color-text)] - Text color of a hovered, non-disabled tab.
 *   Independent of the selected-state props above.
 */
export class LyraTabs extends LyraElement<LyraTabsEventMap> {
  static override styles = [LyraElement.styles, styles];

  /** The active tab's `slot`/id. Falls back to the first enabled tab whenever the current value doesn't resolve to one. */
  @property({ reflect: true }) active = '';

  /** Accessible name for the `role="tablist"` strip. Attribute-reflects from a host-level
   *  `aria-label` so a plain-markup consumer gets ARIA-name forwarding without setting a JS
   *  property. Unset, the tablist renders without an `aria-label` (the role carries no localized
   *  default name). */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  @state() private tabs: TabDef[] = [];

  private baseId = nextId('tabs');
  private nextOpaqueId = 0;
  private readonly idsBySlot = new Map<string, { tab: string; panel: string }>();
  private mutationObserver?: MutationObserver;

  override connectedCallback(): void {
    super.connectedCallback();
    this.syncTabs();
    // Each child carries its own individual `slot` attribute (one named slot
    // per tab, unlike lr-split's single default-slot-of-many-panels) -- a
    // brand-new tab's name has no matching `<slot>` to fire `slotchange` on
    // until *this* component has already rendered one for it, and neither
    // `slotchange` nor any Lit lifecycle hook observes a plain attribute
    // edit (label/disabled) on a light-DOM child at all. A mutation observer
    // on the host is the only thing that sees either case. `attributes: true`
    // alone only reports mutations on the observed node itself (`this`), never
    // on its children, so `subtree: true` is required too -- but that widens
    // `childList`/`attributeFilter` to the *entire* descendant tree, including
    // each panel's own projected content. A panel can legitimately churn its
    // own children/attributes fast (a streaming log, a live JSON preview), so
    // every record is filtered down to direct-child mutations only before
    // triggering a resync, keeping panel-internal churn from forcing a tabs
    // recompute and re-render on every unrelated mutation.
    this.mutationObserver = new MutationObserver((records) => {
      const isDirectChild = (node: Node) => node.parentNode === this;
      const relevant = records.some((r) => (r.type === 'childList' ? r.target === this : isDirectChild(r.target)));
      if (relevant) this.syncTabs();
    });
    this.mutationObserver.observe(this, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['slot', 'label', 'disabled'],
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.mutationObserver?.disconnect();
    this.mutationObserver = undefined;
  }

  /** Rebuilds `tabs` from the current direct children. First child wins when two share a `slot` name (matches native slot assignment: both would render into the one panel, but only one label can back the button). */
  private syncTabs = (): void => {
    const seen = new Set<string>();
    const next: TabDef[] = [];
    const children = Array.from(this.children);
    for (const child of children) {
      const slotName = child.getAttribute('slot');
      const label = child.getAttribute('label');
      if (!slotName || !label || seen.has(slotName)) continue;
      seen.add(slotName);
      const iconSlot = this.iconSlotName(slotName);
      const hasIcon = children.some((c) => c.getAttribute('slot') === iconSlot);
      next.push({ slotName, label, disabled: child.hasAttribute('disabled'), hasIcon });
    }
    const liveSlots = new Set(next.map((tab) => tab.slotName));
    for (const slotName of this.idsBySlot.keys()) {
      if (!liveSlots.has(slotName)) this.idsBySlot.delete(slotName);
    }
    this.tabs = next;
  };

  /** Keeps `active` resolved to a real, enabled tab -- covers the initial default, a tab disappearing/becoming disabled underneath the current selection, and a consumer assigning `.active` directly. Silent (no `lr-tabs-change`): this corrects *invalid* state rather than responding to a user picking a different tab. */
  protected override willUpdate(changed: PropertyValues): void {
    if (!changed.has('tabs') && !changed.has('active')) return;
    const current = this.tabs.find((t) => t.slotName === this.active);
    if (current && !current.disabled) return;
    this.active = this.tabs.find((t) => !t.disabled)?.slotName ?? '';
  }

  /** Activates `tab` (no-op for a disabled tab or one that's already active) and emits `lr-tabs-change`. */
  private selectTab(tab: TabDef): void {
    if (tab.disabled || tab.slotName === this.active) return;
    this.active = tab.slotName;
    this.emit('lr-tabs-change', { tabId: tab.slotName });
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

  private onTabListKeyDown = (e: KeyboardEvent): void => {
    const navigable = this.tabs.filter((t) => !t.disabled);
    if (navigable.length === 0) return;
    const currentIndex = navigable.findIndex((t) => t.slotName === this.active);
    // Horizontal strip -- Up/Down aren't used. Left/Right swap under RTL,
    // matching lr-split/lr-tree's physical-direction handling.
    const rtl = isRtl(this);
    const forwardKey = rtl ? 'ArrowLeft' : 'ArrowRight';
    const backwardKey = rtl ? 'ArrowRight' : 'ArrowLeft';

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
    const target = navigable[targetIndex];
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

  private renderTab(tab: TabDef): TemplateResult {
    const selected = tab.slotName === this.active;
    return html`<button
      type="button"
      part="tab"
      id=${this.tabId(tab.slotName)}
      data-slot=${tab.slotName}
      role="tab"
      aria-selected=${selected ? 'true' : 'false'}
      aria-disabled=${tab.disabled ? 'true' : 'false'}
      aria-controls=${this.panelId(tab.slotName)}
      tabindex=${selected ? '0' : '-1'}
      @click=${() => this.selectTab(tab)}
    >${tab.hasIcon
      ? html`<span part="tab-icon" aria-hidden="true"><slot name=${this.iconSlotName(tab.slotName)}></slot></span>`
      : nothing}${tab.label}</button>`;
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
      <div part="base">
        <div part="tablist" role="tablist" aria-label=${this.accessibleLabel || nothing} aria-orientation="horizontal" @keydown=${this.onTabListKeyDown}>
          ${repeat(this.tabs, (tab) => tab.slotName, (tab) => this.renderTab(tab))}
        </div>
        ${repeat(this.tabs, (tab) => tab.slotName, (tab) => this.renderPanel(tab))}
      </div>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-tabs': LyraTabs;
  }
}

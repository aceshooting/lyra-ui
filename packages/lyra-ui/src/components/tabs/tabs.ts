import { html, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { isRtl } from '../../internal/rtl.js';
import { nextId } from '../../internal/a11y.js';
import { styles } from './tabs.styles.js';

/** One tab, derived from a direct light-DOM child's `slot`/`label`/`disabled` attributes. */
interface TabDef {
  slotName: string;
  label: string;
  disabled: boolean;
}

/**
 * `<lyra-tabs>` — a tab strip whose panels are direct light-DOM children,
 * each carrying `slot="<id>"` (the panel's stable id) and `label="<text>"`
 * (the tab button's text). One named `<slot>` is rendered per distinct
 * `slot` name found among the current children — a child with no `label`,
 * or a name with no matching child, simply never produces a tab.
 *
 * Implements the WAI-ARIA APG tabs pattern with automatic activation:
 * Left/Right (swapped under RTL) move focus *and* selection together,
 * Home/End jump to the first/last enabled tab, and a roving `tabindex`
 * follows whichever tab is currently selected.
 *
 * @customElement lyra-tabs
 * @slot - Direct children with `slot="<id>" label="<text>"` (and optionally `disabled`); one becomes each tab's panel.
 * @event lyra-tabs-change - `detail: { tabId }`, fired when the active tab changes via click or keyboard.
 * @csspart base - The root wrapper around the tablist and panels.
 * @csspart tablist - The `role="tablist"` row of tab buttons.
 * @csspart tab - A single tab button.
 * @csspart panel - A single `role="tabpanel"` wrapper (one per tab, hidden unless active).
 */
export class LyraTabs extends LyraElement {
  static styles = [LyraElement.styles, styles];

  /** The active tab's `slot`/id. Falls back to the first enabled tab whenever the current value doesn't resolve to one. */
  @property({ reflect: true }) active = '';

  @state() private tabs: TabDef[] = [];

  private baseId = nextId('tabs');
  private mutationObserver?: MutationObserver;

  connectedCallback(): void {
    super.connectedCallback();
    this.syncTabs();
    // Each child carries its own individual `slot` attribute (one named slot
    // per tab, unlike lyra-split's single default-slot-of-many-panels) -- a
    // brand-new tab's name has no matching `<slot>` to fire `slotchange` on
    // until *this* component has already rendered one for it, and neither
    // `slotchange` nor any Lit lifecycle hook observes a plain attribute
    // edit (label/disabled) on a light-DOM child at all. A mutation observer
    // on the host is the only thing that sees either case.
    this.mutationObserver = new MutationObserver(this.syncTabs);
    this.mutationObserver.observe(this, {
      childList: true,
      attributes: true,
      attributeFilter: ['slot', 'label', 'disabled'],
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.mutationObserver?.disconnect();
    this.mutationObserver = undefined;
  }

  /** Rebuilds `tabs` from the current direct children. First child wins when two share a `slot` name (matches native slot assignment: both would render into the one panel, but only one label can back the button). */
  private syncTabs = (): void => {
    const seen = new Set<string>();
    const next: TabDef[] = [];
    for (const child of Array.from(this.children)) {
      const slotName = child.getAttribute('slot');
      const label = child.getAttribute('label');
      if (!slotName || !label || seen.has(slotName)) continue;
      seen.add(slotName);
      next.push({ slotName, label, disabled: child.hasAttribute('disabled') });
    }
    this.tabs = next;
  };

  /** Keeps `active` resolved to a real, enabled tab -- covers the initial default, a tab disappearing/becoming disabled underneath the current selection, and a consumer assigning `.active` directly. Silent (no `lyra-tabs-change`): this corrects *invalid* state rather than responding to a user picking a different tab. */
  protected willUpdate(changed: PropertyValues): void {
    if (!changed.has('tabs') && !changed.has('active')) return;
    const current = this.tabs.find((t) => t.slotName === this.active);
    if (current && !current.disabled) return;
    this.active = this.tabs.find((t) => !t.disabled)?.slotName ?? '';
  }

  /** Activates `tab` (no-op for a disabled tab or one that's already active) and emits `lyra-tabs-change`. */
  private selectTab(tab: TabDef): void {
    if (tab.disabled || tab.slotName === this.active) return;
    this.active = tab.slotName;
    this.emit('lyra-tabs-change', { tabId: tab.slotName });
  }

  /** Moves real DOM focus to tab `slotName`'s button. Safe to call immediately (no `updateComplete` wait): every tab button already exists in the DOM regardless of its current `tabindex`, and `tabindex="-1"` elements are still focusable via script. */
  private focusTab(slotName: string): void {
    const buttons = this.renderRoot.querySelectorAll('[part="tab"]');
    for (const button of Array.from(buttons)) {
      if ((button as HTMLElement).dataset.slot === slotName) {
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
    // matching lyra-split/lyra-tree's physical-direction handling.
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
    return `${this.baseId}-tab-${slotName}`;
  }
  private panelId(slotName: string): string {
    return `${this.baseId}-panel-${slotName}`;
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
    >
      ${tab.label}
    </button>`;
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

  render(): TemplateResult {
    return html`
      <div part="base">
        <div part="tablist" role="tablist" aria-orientation="horizontal" @keydown=${this.onTabListKeyDown}>
          ${this.tabs.map((tab) => this.renderTab(tab))}
        </div>
        ${this.tabs.map((tab) => this.renderPanel(tab))}
      </div>
    `;
  }
}

defineElement('tabs', LyraTabs);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-tabs': LyraTabs;
  }
}

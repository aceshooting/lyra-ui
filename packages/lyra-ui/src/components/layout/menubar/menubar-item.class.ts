import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { composedAccessibilityText } from '../../../internal/accessibility-visibility.js';
import { isAccessibilitySubtreeExcluded } from '../../../internal/a11y.js';
import { collectInitialSlotAssignment } from '../../../internal/initial-slot-collection.js';
import { composedContains, deepActiveElement } from '../../../internal/nonmodal-overlay-manager.js';
import { isHtmlElement } from '../../../internal/dom-guards.js';
import { tag } from '../../../internal/prefix.js';
import {
  submenuPanelController,
  syncOwnedAriaLabel,
  type MenuFocusTarget,
  type OwnedAriaLabel,
  type SubmenuPanel,
} from '../menu/menu-shared.js';
import { menubarItemOwner, type MenubarItemOwner } from './menubar-shared.js';
import { styles } from './menubar-item.styles.js';

/**
 * A menu title or plain action in an application menubar. Its host owns menuitem semantics;
 * the visual label is inert and an optional slotted menu opens below the title. Use a native
 * click listener for menu-less actions. Disabled items suppress activation, including click(),
 * although capture listeners on ancestors can still observe a dispatched click.
 *
 * @customElement lr-menubar-item
 * @slot - Visual label. Its text names the item unless an author supplies an accessible name.
 * @slot menu - Exactly one lr-menu. The first menu is used; other assigned elements are ignored.
 * @csspart base - Visual title row.
 * @csspart label - Ellipsized label wrapper.
 * @cssprop [--lr-menubar-item-hover-bg=var(--lr-color-brand-quiet)] - Hover, focus-visible and open fill.
 * @cssprop [--lr-menubar-item-active-bg=color-mix(in oklab, var(--lr-menubar-item-hover-bg, var(--lr-color-brand-quiet)), var(--lr-color-mix-partner) var(--lr-color-mix-active))] - Pressed fill.
 * @status experimental
 * @since unreleased
 */
export class LyraMenubarItem extends LyraElement {
  static override styles = [LyraElement.styles, styles];

  /** Prevents focus traversal and activation. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  @state() private attached = false;
  @state() private expanded = false;
  private panel: SubmenuPanel | null = null;
  private owner: MenubarItemOwner | null = null;
  private generation = 0;
  private inertGeneration = 0;
  private labelObserver?: MutationObserver;
  private label = '';
  private readonly ownedName: OwnedAriaLabel = { owns: false, value: null };
  private panelName: OwnedAriaLabel = { owns: false, value: null };
  private pendingFocusout?: () => void;
  private ignoredElements = new Map<HTMLElement, boolean>();

  constructor() {
    super();
    this.addEventListener('click', event => {
      if (this.disabled) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, { capture: true });
    this.addEventListener('mousedown', event => { if (this.disabled) event.preventDefault(); });
  }

  /** @internal */
  get hasMenu(): boolean { return this.attached; }
  /** @internal */
  get menuOpen(): boolean { return this.expanded; }
  /** @internal */
  get menuElement(): HTMLElement | null { return this.panel; }
  /** @internal */
  get textLabel(): string { return composedAccessibilityText(this).replace(/\s+/g, ' ').trim() || this.label; }

  /** @internal Releases only the requesting owner's lease after reparenting. */
  [menubarItemOwner](owner: MenubarItemOwner | null, expectedOwner?: MenubarItemOwner): void {
    if (owner === null && expectedOwner && this.owner !== expectedOwner) return;
    this.owner = owner;
  }

  override click(): void { if (!this.disabled) super.click(); }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.tabIndex !== 0) this.tabIndex = -1;
    this.syncLabel(false);
    const Observer = this.ownerDocument.defaultView?.MutationObserver;
    if (Observer) {
      this.labelObserver = new Observer(records => {
        if (records.some(record => !this.panel || !this.panel.contains(record.target) ||
          (record.target === this.panel && record.type === 'attributes'))) this.syncLabel();
      });
      this.labelObserver.observe(this, {
        childList: true, subtree: true, characterData: true, attributes: true,
        attributeFilter: ['aria-label', 'aria-labelledby', 'label', 'hidden', 'aria-hidden', 'inert', 'slot'],
      });
    }
    if (this.hasUpdated) {
      const generation = ++this.generation;
      void this.updateComplete.then(() => {
        if (this.isConnected && generation === this.generation) { this.syncMenu(); this.syncLabel(); }
      });
    }
  }

  override disconnectedCallback(): void {
    ++this.generation;
    ++this.inertGeneration;
    this.cancelPendingFocusout();
    this.labelObserver?.disconnect(); this.labelObserver = undefined;
    if (this.panel && this.attached) this.panel[submenuPanelController].detach(this);
    this.expanded = false;
    this.attached = false;
    this.setInert(true);
    this.restoreIgnoredElements();
    super.disconnectedCallback();
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.setAttribute('role', 'menuitem');
    this.setAttribute('aria-disabled', String(this.disabled));
    if (this.hasMenu) {
      this.setAttribute('aria-haspopup', 'menu');
      this.setAttribute('aria-expanded', String(this.expanded));
    } else {
      this.removeAttribute('aria-haspopup'); this.removeAttribute('aria-expanded');
    }
    if (changed.has('disabled')) {
      if (this.disabled) void this.closeMenu();
      this.owner?.itemStateChanged(this);
    }
  }

  protected override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    queueMicrotask(() => {
      if (!this.isConnected) return;
      collectInitialSlotAssignment(this.renderRoot.querySelector<HTMLSlotElement>('slot[name="menu"]'), () => this.syncMenu());
      this.syncLabel();
    });
  }

  /** @internal Opens the assigned panel, with stale asynchronous completions discarded. */
  async openMenu(focus: MenuFocusTarget): Promise<void> {
    const panel = this.panel; const generation = this.generation;
    if (!panel || !this.attached || this.disabled || !this.isConnected) return;
    ++this.inertGeneration;
    this.cancelPendingFocusout();
    this.setInert(false);
    await panel[submenuPanelController].show(focus);
    if (!this.isConnected || this.panel !== panel || generation !== this.generation) return;
    await panel.updateComplete;
    if (!this.isConnected || this.panel !== panel || generation !== this.generation) return;
    this.expanded = panel[submenuPanelController].open;
    await this.updateComplete;
  }

  /** @internal Closes the panel while preserving native Tab order during its exit transition. */
  async closeMenu(options?: { focusItem?: boolean }): Promise<void> {
    const panel = this.panel; const generation = this.generation;
    if (!panel || !this.attached) return;
    const hidden = panel[submenuPanelController].hide({ focusTrigger: options?.focusItem });
    this.deferInert();
    await hidden;
    if (!this.isConnected || this.panel !== panel || generation !== this.generation) return;
    this.expanded = panel[submenuPanelController].open;
    await this.updateComplete;
  }

  private cancelPendingFocusout(): void {
    this.pendingFocusout?.();
    this.pendingFocusout = undefined;
  }

  private setInert(value: boolean): void {
    const wrapper = this.renderRoot?.querySelector<HTMLElement>('.menu');
    if (wrapper) wrapper.inert = value;
  }

  private deferInert(): void {
    this.cancelPendingFocusout();
    const generation = ++this.inertGeneration;
    const panel = this.panel;
    const active = deepActiveElement(this.ownerDocument);
    if (!panel || !active || !composedContains(panel, active)) { this.setInert(true); return; }
    const leave = (event: FocusEvent): void => {
      if (isHtmlElement(event.relatedTarget) && composedContains(panel, event.relatedTarget)) return;
      this.cancelPendingFocusout();
      if (generation === this.inertGeneration && !this.expanded) this.setInert(true);
    };
    panel.addEventListener('focusout', leave);
    this.pendingFocusout = () => panel.removeEventListener('focusout', leave);
  }

  private onPanelState = (open: boolean): void => {
    this.expanded = open;
    if (!open) this.deferInert();
    this.owner?.menuStateChanged(this, open);
  };

  private restoreIgnoredElements(): void {
    for (const [element, hidden] of this.ignoredElements) element.hidden = hidden;
    this.ignoredElements.clear();
  }

  private syncMenu = (): void => {
    if (!this.isConnected) return;
    const slot = this.renderRoot.querySelector<HTMLSlotElement>('slot[name="menu"]');
    const assigned = slot?.assignedElements({ flatten: true }) ?? [];
    const candidate = assigned.find(element => element.localName === tag('menu')) as SubmenuPanel | undefined;
    this.restoreIgnoredElements();
    for (const element of assigned) {
      if (isHtmlElement(element) && element !== candidate) {
        this.ignoredElements.set(element, Boolean(element.hidden)); element.hidden = true;
      }
    }
    if (candidate === this.panel && this.attached) { this.syncPanelName(); return; }
    const previous = this.panel;
    const generation = ++this.generation;
    if (previous && this.attached) previous[submenuPanelController].detach(this);
    this.attached = false;
    this.panel = null;
    this.expanded = false;
    this.panelName = { owns: false, value: null };
    this.setInert(true);
    if (candidate && !(submenuPanelController in candidate)) {
      void this.ownerDocument.defaultView?.customElements.whenDefined(tag('menu')).then(() => {
        if (this.isConnected && generation === this.generation) this.syncMenu();
      });
    } else if (candidate) {
      this.panel = candidate;
      candidate[submenuPanelController].attach(this, this.onPanelState, { menubar: true });
      this.attached = true;
      this.syncPanelName();
    }
    this.owner?.itemStateChanged(this);
  };

  private syncPanelName(): void {
    const name = this.hasAttribute('aria-labelledby')
      ? composedAccessibilityText(this).replace(/\s+/g, ' ').trim()
      : this.getAttribute('aria-label') ?? this.label;
    if (this.panel) syncOwnedAriaLabel(this.panel, name, this.panelName,
      this.panel.hasAttribute('label') || this.panel.hasAttribute('aria-labelledby'));
  }

  private syncLabel = (requireRendered = true): void => {
    const slot = this.renderRoot?.querySelector<HTMLSlotElement>('slot:not([name])');
    const nodes = slot?.assignedNodes({ flatten: true }) ?? Array.from(this.childNodes).filter(node =>
      node.nodeType !== 1 || !(node as Element).getAttribute('slot'));
    this.label = composedAccessibilityText(nodes, {
      ancestorBoundary: this, requireRendered, ignoreInheritedVisibility: true,
      isSubtreeExcluded: element => {
        if (element.getRootNode() === this.renderRoot && element.matches('[part="label"][aria-hidden="true"][inert]')) return false;
        return isAccessibilitySubtreeExcluded(element);
      },
    }).replace(/\s+/g, ' ').trim();
    syncOwnedAriaLabel(this, this.label, this.ownedName, this.hasAttribute('aria-labelledby'));
    this.syncPanelName();
  };

  override render(): TemplateResult {
    return html`<span part="base"><span part="label" aria-hidden="true" inert><slot @slotchange=${() => this.syncLabel()}></slot></span></span><span class="menu" ?hidden=${!this.attached} inert><slot name="menu" @slotchange=${this.syncMenu}></slot></span>`;
  }
}

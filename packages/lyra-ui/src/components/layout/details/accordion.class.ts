import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { tag } from '../../../internal/prefix.js';
import type { LyraAccordionItem } from './accordion-item.class.js';
import type {
  LyraAccordionAppearance,
  LyraAccordionHeadingLevel,
  LyraAccordionIconPlacement,
} from './accordion-item.class.js';
import type { LyraDetails } from './details.class.js';
import { styles } from './accordion.styles.js';

export type LyraAccordionMode = 'single' | 'single-collapsible' | 'multiple';
export type LyraAccordionPanel = LyraAccordionItem | LyraDetails;
export interface LyraAccordionEventDetail { item: LyraAccordionPanel }
export interface LyraAccordionEventMap {
  'lr-expand': CustomEvent<LyraAccordionEventDetail>;
  'lr-after-expand': CustomEvent<LyraAccordionEventDetail>;
  'lr-collapse': CustomEvent<LyraAccordionEventDetail>;
  'lr-after-collapse': CustomEvent<LyraAccordionEventDetail>;
}

function normalizeMode(value: unknown): LyraAccordionMode {
  return value === 'single' || value === 'single-collapsible' ? value : 'multiple';
}

/**
 * `<lr-accordion>` — coordinates accessible, vertically stacked expandable sections.
 *
 * `mode="multiple"` allows any number of items to expand. `single` permits at most one and keeps
 * the active item open when it is activated again. `single-collapsible` also permits at most one,
 * but allows all items to be collapsed. Direct `<lr-details>` children remain supported for
 * compatibility; the full accordion presentation and roving-keyboard contract applies to
 * `<lr-accordion-item>` children.
 *
 * @customElement lr-accordion
 * @slot - Direct `<lr-accordion-item>` elements, or legacy `<lr-details>` panels.
 * @event lr-expand - Emitted before a direct item expands. `detail: { item }`. Cancelable.
 * @event lr-after-expand - Emitted after a direct item finishes expanding. `detail: { item }`.
 * @event lr-collapse - Emitted before a direct item collapses. `detail: { item }`. Cancelable.
 * @event lr-after-collapse - Emitted after a direct item finishes collapsing. `detail: { item }`.
 * @csspart base - The accordion wrapper.
 */
export class LyraAccordion extends LyraElement<LyraAccordionEventMap> {
  static override styles = [LyraElement.styles, styles];

  private _mode: LyraAccordionMode = 'multiple';
  private readonly panels = new Set<LyraAccordionPanel>();

  /** Controls whether one or multiple items can be expanded. */
  @property({ reflect: true })
  get mode(): LyraAccordionMode {
    return this._mode;
  }
  set mode(next: LyraAccordionMode) {
    const normalized = normalizeMode(next);
    const old = this._mode;
    if (normalized === old) return;
    this._mode = normalized;
    this.requestUpdate('mode', old);
    this.requestUpdate('multiple', old === 'multiple');
  }

  /**
   * Compatibility alias for `mode`: true means `multiple`; false means `single-collapsible`.
   * When both attributes occur in initial markup, the explicit `mode` attribute wins.
   */
  @property({ reflect: true, converter: trueDefaultBooleanConverter })
  get multiple(): boolean {
    return this.mode === 'multiple';
  }
  set multiple(next: boolean) {
    const old = this.multiple;
    this.mode = next ? 'multiple' : 'single-collapsible';
    if (this.multiple !== old) this.requestUpdate('multiple', old);
  }

  /** Icon position applied to direct accordion items. */
  @property({ attribute: 'icon-placement', reflect: true })
  iconPlacement: LyraAccordionIconPlacement = 'end';

  /** Heading level applied to direct accordion items. */
  @property({ attribute: 'heading-level', reflect: true })
  headingLevel: LyraAccordionHeadingLevel = '3';

  /** Visual treatment applied to the group and its direct items. */
  @property({ reflect: true })
  appearance: LyraAccordionAppearance = 'outlined';

  override connectedCallback(): void {
    const authoredMode = this.getAttribute('mode');
    super.connectedCallback();
    // Attribute upgrade order must not decide the meaning of conflicting legacy/canonical markup.
    if (authoredMode !== null) this.mode = normalizeMode(authoredMode);
    if (this.hasUpdated) {
      queueMicrotask(() => {
        if (!this.isConnected) return;
        const slot = this.renderRoot.querySelector<HTMLSlotElement>('slot');
        if (slot) this.bindPanels(slot.assignedElements({ flatten: true }));
      });
    }
  }

  override disconnectedCallback(): void {
    this.panels.clear();
    super.disconnectedCallback();
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    if (changed.has('iconPlacement') || changed.has('headingLevel') || changed.has('appearance')) {
      this.syncPresentation();
    }
    if (changed.has('mode')) this.reconcileExpandedPanels();
  }

  /** Expand every direct enabled item. No-op outside `multiple` mode. */
  expandAll(): void {
    if (this.mode !== 'multiple') return;
    for (const panel of this.panels) {
      if (panel.disabled || this.isExpanded(panel)) continue;
      if (this.isAccordionItem(panel)) void panel.expand();
      else panel.show();
    }
  }

  /** Collapse every direct expanded item. */
  collapseAll(): void {
    for (const panel of this.panels) {
      if (!this.isExpanded(panel)) continue;
      if (this.isAccordionItem(panel)) void panel.collapse();
      else panel.hide();
    }
  }

  private isAccordionItem(panel: LyraAccordionPanel): panel is LyraAccordionItem {
    return panel.localName === tag('accordion-item');
  }

  private isExpanded(panel: LyraAccordionPanel): boolean {
    return this.isAccordionItem(panel) ? panel.expanded : panel.open;
  }

  private bindPanels(assigned: Element[]): void {
    const itemTag = tag('accordion-item');
    const detailsTag = tag('details');
    const next = assigned.filter(
      (element): element is LyraAccordionPanel =>
        element.localName === itemTag || element.localName === detailsTag,
    );
    this.panels.clear();
    for (const panel of next) this.panels.add(panel);
    this.syncPresentation();
    this.reconcileExpandedPanels();
    this.syncRovingTabIndex();
  }

  private syncPresentation(): void {
    for (const panel of this.panels) {
      if (!this.isAccordionItem(panel)) continue;
      panel.iconPlacement = this.iconPlacement;
      panel.headingLevel = this.headingLevel;
      panel.appearance = this.appearance;
    }
  }

  private reconcileExpandedPanels(): void {
    if (this.mode === 'multiple') return;
    let foundExpanded = false;
    for (const panel of this.panels) {
      if (!this.isExpanded(panel)) continue;
      if (!foundExpanded) {
        foundExpanded = true;
        continue;
      }
      panel.open = false;
    }
  }

  private enabledItems(): LyraAccordionItem[] {
    return [...this.panels].filter(
      (panel): panel is LyraAccordionItem => this.isAccordionItem(panel) && !panel.disabled,
    );
  }

  private syncRovingTabIndex(preferred?: LyraAccordionItem): void {
    const enabled = this.enabledItems();
    const active = preferred && enabled.includes(preferred)
      ? preferred
      : enabled.find((item) => item.isTabbable) ?? enabled[0];
    for (const panel of this.panels) {
      if (this.isAccordionItem(panel)) panel.isTabbable = panel === active;
    }
  }

  private collapseSiblings(source: LyraAccordionPanel): void {
    for (const panel of this.panels) {
      if (panel === source || !this.isExpanded(panel)) continue;
      if (this.isAccordionItem(panel)) void panel.collapse();
      else panel.hide();
    }
  }

  private handleSlotChange = (event: Event): void => {
    this.bindPanels((event.target as HTMLSlotElement).assignedElements({ flatten: true }));
  };

  private handleItemStateChange = (event: CustomEvent<{ item: LyraAccordionItem }>): void => {
    if (!this.panels.has(event.detail.item)) return;
    this.syncRovingTabIndex();
  };

  private handleFocusIn = (event: FocusEvent): void => {
    const item = event.composedPath().find(
      (node): node is LyraAccordionItem =>
        node instanceof HTMLElement && node.localName === tag('accordion-item'),
    );
    if (!item || !this.panels.has(item) || item.disabled) return;
    this.syncRovingTabIndex(item);
  };

  private handleKeyDown = (event: KeyboardEvent): void => {
    const current = event.composedPath().find(
      (node): node is LyraAccordionItem =>
        node instanceof HTMLElement && node.localName === tag('accordion-item'),
    );
    if (!current || !this.panels.has(current) || current.disabled) return;
    const items = this.enabledItems();
    if (items.length === 0) return;
    const currentIndex = items.indexOf(current);
    if (currentIndex < 0) return;

    const forwardKey = this.effectiveDirection === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    const backwardKey = this.effectiveDirection === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    let nextIndex: number | undefined;
    if (event.key === 'ArrowDown' || event.key === forwardKey) {
      nextIndex = (currentIndex + 1) % items.length;
    } else if (event.key === 'ArrowUp' || event.key === backwardKey) {
      nextIndex = (currentIndex - 1 + items.length) % items.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = items.length - 1;
    }
    if (nextIndex === undefined) return;

    event.preventDefault();
    event.stopPropagation();
    const next = items[nextIndex]!;
    this.syncRovingTabIndex(next);
    next.focus();
  };

  private handleItemTrigger = async (
    event: CustomEvent<{ item: LyraAccordionItem }>,
  ): Promise<void> => {
    const { item } = event.detail;
    if (!this.panels.has(item)) return;
    event.preventDefault();
    event.stopPropagation();
    if (item.disabled) return;

    if (item.expanded) {
      if (this.mode === 'single') return;
      const before = this.emit('lr-collapse', { item }, { cancelable: true });
      if (before.defaultPrevented) return;
      await item.collapse();
      if (!item.expanded) this.emit('lr-after-collapse', { item });
      return;
    }

    const before = this.emit('lr-expand', { item }, { cancelable: true });
    if (before.defaultPrevented) return;
    if (this.mode !== 'multiple') this.collapseSiblings(item);
    await item.expand();
    if (item.expanded) this.emit('lr-after-expand', { item });
  };

  private directLegacyPanel(event: Event): LyraDetails | undefined {
    const panel = event.target as LyraDetails;
    return this.panels.has(panel) && !this.isAccordionItem(panel) ? panel : undefined;
  }

  private handleLegacyShow = (event: Event): void => {
    const panel = this.directLegacyPanel(event);
    if (!panel) return;
    const before = this.emit('lr-expand', { item: panel }, { cancelable: true });
    if (before.defaultPrevented) {
      event.preventDefault();
      return;
    }
    if (this.mode !== 'multiple') this.collapseSiblings(panel);
  };

  private handleLegacyHide = (event: Event): void => {
    const panel = this.directLegacyPanel(event);
    if (!panel) return;
    if (this.mode === 'single') {
      event.preventDefault();
      return;
    }
    if (this.emit('lr-collapse', { item: panel }, { cancelable: true }).defaultPrevented) {
      event.preventDefault();
    }
  };

  private handleLegacyAfterShow = (event: Event): void => {
    const panel = this.directLegacyPanel(event);
    if (panel) this.emit('lr-after-expand', { item: panel });
  };

  private handleLegacyAfterHide = (event: Event): void => {
    const panel = this.directLegacyPanel(event);
    if (panel) this.emit('lr-after-collapse', { item: panel });
  };

  private handlePanelToggle = (event: CustomEvent<{ open: boolean }>): void => {
    const panel = event.target as LyraAccordionPanel;
    if (!this.panels.has(panel) || !event.detail.open || this.mode === 'multiple') return;
    this.collapseSiblings(panel);
  };

  override render(): TemplateResult {
    return html`<div
      part="base"
      @lr-accordion-item-trigger=${this.handleItemTrigger}
      @lr-accordion-item-state-change=${this.handleItemStateChange}
      @lr-show=${this.handleLegacyShow}
      @lr-hide=${this.handleLegacyHide}
      @lr-after-show=${this.handleLegacyAfterShow}
      @lr-after-hide=${this.handleLegacyAfterHide}
      @lr-toggle=${this.handlePanelToggle}
      @focusin=${this.handleFocusIn}
      @keydown=${this.handleKeyDown}
    ><slot @slotchange=${this.handleSlotChange}></slot></div>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-accordion': LyraAccordion; } }

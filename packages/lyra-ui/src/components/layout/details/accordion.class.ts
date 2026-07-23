import { html, type TemplateResult } from "lit";
import { property } from "lit/decorators.js";
import { LyraElement } from "../../../internal/lyra-element.js";
import { tag } from "../../../internal/prefix.js";
import { styles } from "./accordion.styles.js";
import type { LyraDetails } from "./details.class.js";

/**
 * `<lr-accordion>` — coordinates slotted `<lr-details>` panels.
 *
 * @customElement lr-accordion
 * @slot - `<lr-details>` panels.
 * @csspart base - The accordion wrapper.
 */
export class LyraAccordion extends LyraElement {
  static override styles = [LyraElement.styles, styles];
  @property({ type: Boolean, reflect: true }) multiple = false;
  private readonly panels = new Set<LyraDetails>();
  private onSlotChange = (event: Event): void => {
    this.bindPanels(
      (event.target as HTMLSlotElement).assignedElements({ flatten: true })
    );
  };

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) {
      queueMicrotask(() => {
        if (!this.isConnected) return;
        const slot = this.shadowRoot?.querySelector<HTMLSlotElement>("slot");
        if (slot) this.bindPanels(slot.assignedElements({ flatten: true }));
      });
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.bindPanels([]);
  }

  private bindPanels(assigned: Element[]): void {
    const detailsTag = tag("details");
    const itemTag = tag("accordion-item");
    const next = new Set(
      assigned.filter(
        (element): element is LyraDetails =>
          element.localName === detailsTag || element.localName === itemTag
      )
    );
    for (const panel of this.panels) {
      if (!next.has(panel))
        panel.removeEventListener(
          "lr-toggle",
          this.onPanelToggle as EventListener
        );
    }
    for (const panel of next) {
      if (!this.panels.has(panel))
        panel.addEventListener(
          "lr-toggle",
          this.onPanelToggle as EventListener
        );
    }
    this.panels.clear();
    for (const panel of next) this.panels.add(panel);
  }

  private onPanelToggle = (event: Event): void => {
    if (this.multiple || !(event as CustomEvent<{ open: boolean }>).detail.open)
      return;
    const source = event.target as LyraDetails;
    if (!this.panels.has(source)) return;
    for (const panel of this.panels) {
      if (panel !== source) panel.open = false;
    }
  };
  override render(): TemplateResult {
    return html`<div part="base">
      <slot @slotchange=${this.onSlotChange}></slot>
    </div>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    "lr-accordion": LyraAccordion;
  }
}

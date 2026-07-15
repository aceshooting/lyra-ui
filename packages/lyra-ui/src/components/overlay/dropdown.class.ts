import type { TemplateResult } from 'lit';
import { LyraPopover } from './popover.class.js';

/**
 * `<lyra-dropdown>` — a menu-role popover for action lists and consumer-supplied menu content.
 * For full roving-focus menu behavior, compose `<lyra-menu>`; this primitive is useful when a
 * consumer owns the menu rows or needs a small migration-compatible trigger surface.
 *
 * @customElement lyra-dropdown
 * @slot trigger - The interactive trigger.
 * @slot - Menu content.
 */
export class LyraDropdown extends LyraPopover {
  constructor() {
    super();
    this.popupRole = 'menu';
  }
  override render(): TemplateResult { return super.render(); }
}
declare global { interface HTMLElementTagNameMap { 'lyra-dropdown': LyraDropdown; } }

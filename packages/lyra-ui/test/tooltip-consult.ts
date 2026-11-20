import type { LyraTooltip } from '../src/components/overlays/overlay/tooltip.class.js';

/**
 * A tooltip reads its content (description, dialog-versus-tooltip role, actionability) and keeps
 * observing it while open, while its trigger has focus, and in `label` mode. Holding one open lets
 * a test exercise that live tracking directly.
 */
export async function holdOpen(el: LyraTooltip): Promise<void> {
  el.open = true;
  await el.updateComplete;
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

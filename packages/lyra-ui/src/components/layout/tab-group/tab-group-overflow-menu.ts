import { deferredPlaceReady } from '../../../internal/anchored-overlay-runtime.js';
import { DocumentPointerListener } from '../../../internal/document-pointer.js';
import { activateNonmodalOverlay } from '../../../internal/nonmodal-overlay-manager.js';

/** Registers and positions one visible tab overflow menu. Loaded only by menu-mode groups. */
export function mountTabOverflowMenu(
  host: HTMLElement,
  trigger: HTMLButtonElement,
  panel: HTMLElement,
  above: boolean,
  dismiss: (restoreFocus: boolean) => void,
): { ready: Promise<boolean>; close(restoreFocus: boolean): void } {
  const overlay = activateNonmodalOverlay({
    host,
    panel: () => panel,
    onEscape: () => dismiss(true),
    onBackdrop: () => dismiss(false),
    restoreFocusTo: trigger,
  });
  const pointer = new DocumentPointerListener(host, event => {
    const path = event.composedPath();
    if (!path.includes(trigger) && !path.includes(panel)) overlay.dismissBackdrop();
  });
  pointer.bind();
  const position = deferredPlaceReady(trigger, panel, { placement: above ? 'top-end' : 'bottom-end' });
  return {
    ready: position.ready,
    close(restoreFocus) {
      pointer.unbind();
      position();
      overlay.deactivate({ restoreFocus });
    },
  };
}

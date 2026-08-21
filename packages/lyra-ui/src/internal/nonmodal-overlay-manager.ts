import type {
  OverlayStackActivationOptions,
  OverlayStackHandle,
} from './overlay-stack.js';
import { activateOverlayStack } from './overlay-stack.js';

export type NonmodalOverlayActivationOptions = Omit<
  OverlayStackActivationOptions,
  | 'initiallySuspended'
  | 'modal'
  | 'modalRoot'
  | 'onDeactivate'
  | 'onRegistered'
  | 'onUnregistered'
  | 'trapFocus'
>;

export type OverlayHandle = OverlayStackHandle;

/**
 * Adds a nonmodal popup to the document's shared overlay stack without loading modal inerting,
 * scroll locking, or rendered-dialog lifecycle machinery.
 */
export function activateNonmodalOverlay(options: NonmodalOverlayActivationOptions): OverlayHandle {
  return activateOverlayStack({
    ...options,
    modal: false,
    trapFocus: false,
  });
}

export {
  collectAutofocusElements,
  collectFocusableElements,
  composedContains,
  deepActiveElement,
} from './overlay-stack.js';

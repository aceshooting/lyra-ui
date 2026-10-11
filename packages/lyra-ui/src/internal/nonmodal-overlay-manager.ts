import type {
  OverlayStackActivationOptions,
  OverlayStackHandle,
} from './overlay-stack.js';
import { activateOverlayStack } from './overlay-stack.js';
import { acquireOpenOverlayAncestors } from './open-overlay-ancestors.js';

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
  let releaseAncestors: (() => void) | undefined;
  return activateOverlayStack({
    ...options,
    modal: false,
    trapFocus: false,
    onRegistered: () => { releaseAncestors = acquireOpenOverlayAncestors(options.host); },
    onUnregistered: () => {
      const release = releaseAncestors;
      releaseAncestors = undefined;
      release?.();
      return undefined;
    },
  });
}

export {
  composedContains,
  deepActiveElement,
} from './overlay-stack.js';

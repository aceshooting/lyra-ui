import { observeReducedMotion } from '../../../internal/motion-observer.js';

/** Arm/disarm pair for the reduced-motion watch shared by the canvas chart surfaces. */
export function createReducedMotionWatch(host: Element, redraw: () => void) {
  let stop: (() => void) | undefined;
  const disarm = (): void => {
    stop?.();
    stop = undefined;
  };
  return {
    arm(): void {
      if (stop) return;
      stop = observeReducedMotion(host, () => {
        if (host.isConnected) redraw();
      });
    },
    disarm,
  };
}

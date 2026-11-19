import { sanitizeCssLength } from '../../../internal/safe-css.js';
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

export function guardCanvasRenderer(onFailure: () => void) {
  return (operation: () => void, onSuccess?: () => void): void => {
    try { operation(); }
    catch { onFailure(); return; }
    onSuccess?.();
  };
}

export function disposeChart(chart: { destroy(): void } | undefined): void {
  try { chart?.destroy(); }
  catch { /* A peer disposer may throw after releasing its canvas. */ }
}

export function syncChartHeight(host: HTMLElement, value: string): void {
  const height = sanitizeCssLength(value, 'height');
  if (height) host.style.setProperty('--_lr-chart-height', height);
  else host.style.removeProperty('--_lr-chart-height');
}

export function createCanvasChart(
  Chart: {
    new (canvas: HTMLCanvasElement, config: unknown): object;
    getChart?(canvas: HTMLCanvasElement): { destroy(): void } | undefined;
  },
  canvas: HTMLCanvasElement,
  config: unknown,
): object {
  const previous = Chart.getChart?.(canvas);
  try {
    return new Chart(canvas, config);
  } catch (error) {
    const partial = Chart.getChart?.(canvas);
    if (partial !== previous) disposeChart(partial);
    throw error;
  }
}

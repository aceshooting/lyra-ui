import type { ReactiveControllerHost } from 'lit';
import { SeparatorDragController } from './separator-drag.js';

export const RANGE_PAGE_STEP_MULTIPLIER = 10;

export interface RangeDragState<Handle> {
  handle: Handle;
  changed: boolean;
  captureTarget: HTMLElement;
  rect: DOMRect | null;
  rtl: boolean;
}

/** Pointer position along a range; the vertical axis increases bottom-to-top. */
export function rangePointerRatio(clientX: number, clientY: number, rect: DOMRect, rtl: boolean, vertical = false): number {
  const raw = vertical
    ? rect.height === 0 ? 0 : (clientY - rect.top) / rect.height
    : rect.width === 0 ? 0 : (clientX - rect.left) / rect.width;
  return Math.min(1, Math.max(0, vertical || rtl ? 1 - raw : raw));
}

/** Ties choose the endpoint that can move toward the requested value. */
export function nearestRangeEnd(target: number, start: number, end: number): 0 | 1 {
  const toStart = Math.abs(target - start);
  const toEnd = Math.abs(target - end);
  return toStart < toEnd || (toStart === toEnd && target < start) ? 0 : 1;
}

/** Range state shares the same capture and owner-window lifetime as separator gestures. */
export class RangeDragController<Handle> {
  readonly active = new Map<number, RangeDragState<Handle>>();
  private readonly pointers: SeparatorDragController;

  constructor(
    private readonly host: ReactiveControllerHost & { readonly isConnected: boolean },
    onMove: (event: PointerEvent) => void,
    onEnd: (event: PointerEvent) => void,
  ) {
    this.pointers = new SeparatorDragController(host, onMove, onEnd);
  }

  begin(event: PointerEvent, state: RangeDragState<Handle>): RangeDragState<Handle> | undefined {
    if (!this.host.isConnected || !this.pointers.start(event, state.captureTarget)) return undefined;
    this.active.set(event.pointerId, state);
    return state;
  }

  end(pointerId: number): RangeDragState<Handle> | undefined {
    const state = this.active.get(pointerId);
    this.active.delete(pointerId);
    this.pointers.end(pointerId);
    return state;
  }

  abort(): void {
    this.active.clear();
    this.pointers.cancelAll();
  }
}

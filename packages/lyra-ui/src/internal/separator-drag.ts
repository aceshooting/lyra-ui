import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { isModifiedOrComposingKey } from './list-navigation.js';
import { capturePointer, releasePointer, togglePointerGesture } from './pointer-capture.js';

export type SeparatorAxis = 'inline' | 'block';

/** Physical pointer coordinate on a separator's resize axis. */
export function separatorCoordinate(event: PointerEvent, axis: SeparatorAxis): number {
  return axis === 'inline' ? event.clientX : event.clientY;
}

/** Signed movement from drag start; the inline axis mirrors under RTL. */
export function separatorDelta(
  start: number,
  event: PointerEvent,
  axis: SeparatorAxis,
  rtl: boolean,
): number {
  const delta = separatorCoordinate(event, axis) - start;
  return axis === 'inline' && rtl ? -delta : delta;
}

/** Direction of an arrow key along the logical resize axis. */
export function separatorArrowDirection(
  event: KeyboardEvent,
  axis: SeparatorAxis,
  rtl: boolean,
): -1 | 0 | 1 {
  if (isModifiedOrComposingKey(event)) return 0;
  if (axis === 'block') {
    if (event.key === 'ArrowDown') return 1;
    if (event.key === 'ArrowUp') return -1;
  } else {
    if (event.key === 'ArrowRight') return rtl ? -1 : 1;
    if (event.key === 'ArrowLeft') return rtl ? 1 : -1;
  }
  return 0;
}

/** Owns capture and window listeners; consumers retain their own drag math and settle policy. */
export class SeparatorDragController implements ReactiveController {
  private readonly handles = new Map<number, HTMLElement>();
  private ownerWindow?: Window;

  constructor(
    host: ReactiveControllerHost,
    private readonly onMove: (event: PointerEvent) => void,
    private readonly onEnd: (event: PointerEvent) => void,
  ) {
    host.addController(this);
  }

  hostDisconnected(): void {
    this.cancelAll();
  }

  start(event: PointerEvent, handle: HTMLElement): boolean {
    const ownerWindow = handle.ownerDocument.defaultView;
    if (!ownerWindow || this.handles.has(event.pointerId)) return false;
    if (this.ownerWindow && this.ownerWindow !== ownerWindow) return false;
    this.handles.set(event.pointerId, handle);
    if (!this.ownerWindow) {
      this.ownerWindow = ownerWindow;
      togglePointerGesture(ownerWindow, true, this.handleMove, this.handleEnd);
    }
    handle.addEventListener('lostpointercapture', this.handleEnd);
    capturePointer(handle, event.pointerId);
    return true;
  }

  end(pointerId: number): void {
    const handle = this.handles.get(pointerId);
    if (!handle) return;
    this.handles.delete(pointerId);
    if (![...this.handles.values()].includes(handle)) {
      handle.removeEventListener('lostpointercapture', this.handleEnd);
    }
    releasePointer(handle, pointerId);
    if (this.handles.size === 0) this.removeWindowListeners();
  }

  cancelAll(): void {
    for (const pointerId of [...this.handles.keys()]) this.end(pointerId);
  }

  private removeWindowListeners(): void {
    const ownerWindow = this.ownerWindow;
    this.ownerWindow = undefined;
    if (ownerWindow) togglePointerGesture(ownerWindow, false, this.handleMove, this.handleEnd);
  }

  private readonly handleMove = (event: PointerEvent): void => {
    if (this.handles.has(event.pointerId)) this.onMove(event);
  };

  private readonly handleEnd = (event: PointerEvent): void => {
    if (!this.handles.has(event.pointerId)) return;
    this.onEnd(event);
    this.end(event.pointerId);
  };
}

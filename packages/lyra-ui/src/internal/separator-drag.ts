import type { ReactiveController, ReactiveControllerHost } from 'lit';

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
  if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return 0;
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
      ownerWindow.addEventListener('pointermove', this.handleMove);
      ownerWindow.addEventListener('pointerup', this.handleEnd);
      ownerWindow.addEventListener('pointercancel', this.handleEnd);
      ownerWindow.addEventListener('lostpointercapture', this.handleEnd);
    }
    handle.addEventListener('lostpointercapture', this.handleEnd);
    try {
      handle.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic and detached pointers still end through the window listeners.
    }
    return true;
  }

  end(pointerId: number): void {
    const handle = this.handles.get(pointerId);
    if (!handle) return;
    this.handles.delete(pointerId);
    if (![...this.handles.values()].includes(handle)) {
      handle.removeEventListener('lostpointercapture', this.handleEnd);
    }
    if (handle.hasPointerCapture(pointerId)) {
      try {
        handle.releasePointerCapture(pointerId);
      } catch {
        // Capture may already have been released by the platform.
      }
    }
    if (this.handles.size === 0) this.removeWindowListeners();
  }

  cancelAll(): void {
    for (const pointerId of [...this.handles.keys()]) this.end(pointerId);
  }

  private removeWindowListeners(): void {
    const ownerWindow = this.ownerWindow;
    this.ownerWindow = undefined;
    ownerWindow?.removeEventListener('pointermove', this.handleMove);
    ownerWindow?.removeEventListener('pointerup', this.handleEnd);
    ownerWindow?.removeEventListener('pointercancel', this.handleEnd);
    ownerWindow?.removeEventListener('lostpointercapture', this.handleEnd);
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

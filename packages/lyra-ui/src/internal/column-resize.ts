import { isModifiedOrComposingKey } from './list-navigation.js';
import { capturePointer, releasePointer, togglePointerGesture } from './pointer-capture.js';

/** Shared interaction math for vertical column separators. The component owns its width storage
 * and event detail, while this module keeps keyboard and pointer geometry consistent. */
export function columnResizeWidth(width: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, width));
}

export function columnResizePointerWidth(
  startWidth: number,
  startX: number,
  clientX: number,
  rtl: boolean,
  minimum: number,
  maximum: number,
): number {
  return columnResizeWidth(startWidth + (clientX - startX) * (rtl ? -1 : 1), minimum, maximum);
}

/** Return undefined for keys that belong to navigation rather than the separator. */
export function columnResizeKeyboardWidth(
  event: KeyboardEvent,
  current: number,
  minimum: number,
  maximum: number,
  rtl: boolean,
  allowBounds = true,
): number | undefined {
  if (isModifiedOrComposingKey(event)) return undefined;
  if (allowBounds && event.key === 'Home') return minimum;
  if (allowBounds && event.key === 'End' && Number.isFinite(maximum)) return maximum;
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return undefined;
  const direction = (event.key === 'ArrowRight' ? 1 : -1) * (rtl ? -1 : 1);
  return columnResizeWidth(current + direction * (event.shiftKey ? 50 : 10), minimum, maximum);
}

export function columnResizeAriaValues(width: number, minimum: number, maximum: number): {
  min: number;
  now: number;
  max: number;
} {
  return {
    min: Math.round(minimum),
    now: Math.round(width),
    // A missing maximum otherwise makes a separator default to 100 in accessibility APIs.
    max: Number.isFinite(maximum) ? Math.round(maximum) : Number.MAX_SAFE_INTEGER,
  };
}

/** One owner-window listener set follows a captured separator across its shadow boundary. */
export class ColumnResizePointerSession {
  private active?: { handle: HTMLElement; owner: Window; pointerId: number };
  private readonly seenMoves = new WeakSet<Event>();

  constructor(
    private readonly onMove: (event: PointerEvent) => void,
    private readonly onCommit: (event: PointerEvent) => void,
    private readonly onCancel: (event: PointerEvent) => void,
  ) {}

  start(event: PointerEvent, handle: HTMLElement): boolean {
    const owner = handle.ownerDocument.defaultView;
    if (!owner) return false;
    this.stop();
    this.active = { handle, owner, pointerId: event.pointerId };
    capturePointer(handle, event.pointerId);
    // A synthetic non-composed event remains in a shadow root; native captured events can also
    // originate at the handle. Listen on both, then process each bubbling event only once.
    togglePointerGesture(owner, true, this.handleMove, this.handleCommit, this.handleCancel);
    togglePointerGesture(handle, true, this.handleMove, this.handleCommit, this.handleCancel);
    return true;
  }

  stop(): void {
    const active = this.active;
    if (!active) return;
    this.active = undefined;
    togglePointerGesture(active.owner, false, this.handleMove, this.handleCommit, this.handleCancel);
    togglePointerGesture(active.handle, false, this.handleMove, this.handleCommit, this.handleCancel);
    releasePointer(active.handle, active.pointerId);
  }

  private readonly handleMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.active?.pointerId || this.seenMoves.has(event)) return;
    this.seenMoves.add(event);
    this.onMove(event);
  };

  private readonly handleCommit = (event: PointerEvent): void => {
    if (event.pointerId !== this.active?.pointerId) return;
    this.stop();
    this.onCommit(event);
  };

  private readonly handleCancel = (event: PointerEvent): void => {
    if (event.pointerId !== this.active?.pointerId) return;
    this.stop();
    this.onCancel(event);
  };
}

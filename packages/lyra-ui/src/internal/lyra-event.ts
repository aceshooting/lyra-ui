// The runtime class behind every event a component dispatches through `emit()`.
//
// Components never import the per-event classes in `event-classes.ts`; they only dispatch this one
// base. A per-event class is recognised by `Symbol.hasInstance` (event name + brand), so
// `event instanceof LyraChangeEvent` is true for exactly what `emit('lr-change')` dispatched,
// without any component paying for the class module.

const BRAND = Symbol.for('lyra-ui.event');

/** Options a Lyra event constructor accepts; events always bubble and are composed. */
export interface LyraEventOptions {
  /** Set only for events whose listener may veto an operation before it runs. */
  cancelable?: boolean;
}

// Node 22+ and every supported browser define `CustomEvent`; the fallback only keeps an exotic
// server runtime from failing at import time.
const BaseEvent: typeof CustomEvent =
  globalThis.CustomEvent ?? (class {} as unknown as typeof CustomEvent);

/** `detail` of an event type; an event declared as a bare `Event` carries `null`. */
export type LyraEventDetailOf<E> = E extends { detail: infer Detail } ? Detail : null;

const isBranded = (value: unknown): boolean =>
  (value as { [BRAND]?: unknown } | null | undefined)?.[BRAND] === true;

/**
 * Base class of every event a Lyra component dispatches: a bubbling, composed `CustomEvent`.
 * Use a per-event subclass from `@aceshooting/lyra-ui/event-classes` (for example
 * `LyraChangeEvent`) to narrow by event name with `instanceof`.
 */
export class LyraEvent<Detail = unknown> extends BaseEvent<Detail> {
  /** Event name a per-event subclass matches; unset on the base class. */
  static readonly eventName?: string;

  static override [Symbol.hasInstance](value: unknown): boolean {
    const name = this.eventName;
    return name === undefined
      ? isBranded(value) || Function.prototype[Symbol.hasInstance].call(this, value)
      : isBranded(value) && (value as Event).type === name;
  }

  constructor(type: string, detail: Detail, options?: LyraEventOptions) {
    super(type, {
      detail,
      bubbles: true,
      composed: true,
      cancelable: options?.cancelable ?? false,
    });
  }

  get [BRAND](): true {
    return true;
  }
}

/**
 * Builds the event in the element's own realm. The main realm gets a real `LyraEvent`; an event
 * for an element adopted into another window keeps that window's `CustomEvent` constructor (the
 * identity consumers rely on there) and carries the brand as an own property so the per-event
 * classes still recognise it.
 */
export function createLyraEvent(
  realmConstructor: typeof CustomEvent,
  type: string,
  detail: unknown,
  options?: LyraEventOptions,
): CustomEvent {
  if (realmConstructor === globalThis.CustomEvent) return new LyraEvent(type, detail, options);
  const event = new realmConstructor(type, {
    detail,
    bubbles: true,
    composed: true,
    cancelable: options?.cancelable ?? false,
  });
  Object.defineProperty(event, BRAND, { value: true });
  return event;
}

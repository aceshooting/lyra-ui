/**
 * Stops a native event emitted inside a component's shadow root and emits one equivalent native
 * event from the component host. Use this for wrapped controls whose public event must originate
 * at the custom element: allowing the original composed event through as well would deliver two
 * host notifications, while replacing it with a `CustomEvent` would discard native payload such
 * as `InputEvent.inputType` and `FocusEvent.relatedTarget`.
 */
type EventConstructor = new (type: string, eventInitDict?: EventInit) => Event;
type InputEventConstructor = new (type: string, eventInitDict?: InputEventInit) => InputEvent;
type FocusEventConstructor = new (type: string, eventInitDict?: FocusEventInit) => FocusEvent;

interface EventRealm {
  Event: EventConstructor;
  InputEvent?: InputEventConstructor;
  FocusEvent?: FocusEventConstructor;
}

function eventRealm(view: Window): EventRealm {
  return view as unknown as EventRealm;
}

function probeEventConstructor<T>(ownerDocument: Document, interfaceName: string): T | undefined {
  try {
    const constructor = ownerDocument.createEvent(interfaceName).constructor;
    if (typeof constructor === 'function') return constructor as unknown as T;
  } catch {
    // Some interfaces, notably InputEvent, are not exposed through createEvent().
  }
  return undefined;
}

function inertDocumentEventRealm(ownerDocument: Document): EventRealm | undefined {
  const EventConstructor = probeEventConstructor<EventConstructor>(ownerDocument, 'Event');
  if (!EventConstructor) return undefined;
  return {
    Event: EventConstructor,
    InputEvent: probeEventConstructor<InputEventConstructor>(ownerDocument, 'InputEvent'),
    FocusEvent: probeEventConstructor<FocusEventConstructor>(ownerDocument, 'FocusEvent'),
  };
}

function ownerEventRealm(target: EventTarget): EventRealm {
  const candidate = target as EventTarget & {
    ownerDocument?: Document | null;
    createEvent?: Document['createEvent'];
  };
  const ownerDocument =
    candidate.ownerDocument ?? (typeof candidate.createEvent === 'function' ? candidate as unknown as Document : null);
  const documentView = ownerDocument?.defaultView;
  if (documentView) return eventRealm(documentView);
  if (ownerDocument) {
    const inertRealm = inertDocumentEventRealm(ownerDocument);
    if (inertRealm) return inertRealm;
  }

  const defaultView = (target as EventTarget & { defaultView?: Window | null }).defaultView;
  if (defaultView) return eventRealm(defaultView);

  return globalThis as typeof globalThis & EventRealm;
}

function sourceEventRealm(source: Event): EventRealm {
  const view = (source as Event & { view?: Window | null }).view;
  if (view) return eventRealm(view);
  if (source.currentTarget) return ownerEventRealm(source.currentTarget);
  if (source.target) return ownerEventRealm(source.target);
  return globalThis as typeof globalThis & EventRealm;
}

function isNativeEventKind(
  source: Event,
  constructor: InputEventConstructor | FocusEventConstructor | undefined,
  kind: 'InputEvent' | 'FocusEvent',
): boolean {
  if (constructor && source instanceof constructor) return true;
  // The source can have been constructed before its target was adopted into another document.
  // Native event brands remain stable across realms even when no matching realm constructor is
  // reachable from the event's target or `view`.
  return Object.prototype.toString.call(source) === `[object ${kind}]`;
}

export function relayNativeEvent<T extends Event>(
  target: EventTarget,
  source: T,
  options: EventInit = {},
): T {
  // `stopPropagation()`, deliberately not `stopImmediatePropagation()`: Firefox skips the
  // submit-driven interactive-validation focus of a form-associated custom element whose inner
  // control's `blur` had immediate propagation stopped. Both forms keep the source event from
  // reaching the host -- these are component-authored templates with a single listener per
  // event on the inner node, so the weaker stop is equivalent here.
  source.stopPropagation();

  const init: EventInit = {
    bubbles: options.bubbles ?? true,
    composed: options.composed ?? true,
    cancelable: options.cancelable ?? source.cancelable,
  };

  const sourceRealm = sourceEventRealm(source);
  const targetRealm = ownerEventRealm(target);

  let relayed: Event;
  if (isNativeEventKind(source, sourceRealm.InputEvent, 'InputEvent')) {
    const InputEventConstructor =
      targetRealm.InputEvent ??
      (source instanceof targetRealm.Event && typeof source.constructor === 'function'
        ? (source.constructor as unknown as InputEventConstructor)
        : undefined);
    if (!InputEventConstructor) {
      throw new TypeError('InputEvent is not available in the target realm.');
    }
    const inputSource = source as unknown as InputEvent;
    relayed = new InputEventConstructor(source.type, {
      ...init,
      data: inputSource.data,
      dataTransfer: inputSource.dataTransfer,
      inputType: inputSource.inputType,
      isComposing: inputSource.isComposing,
      view: inputSource.view,
      detail: inputSource.detail,
    });
  } else if (isNativeEventKind(source, sourceRealm.FocusEvent, 'FocusEvent')) {
    const FocusEventConstructor =
      targetRealm.FocusEvent ??
      (source instanceof targetRealm.Event && typeof source.constructor === 'function'
        ? (source.constructor as unknown as FocusEventConstructor)
        : undefined);
    if (!FocusEventConstructor) {
      throw new TypeError('FocusEvent is not available in the target realm.');
    }
    const focusSource = source as unknown as FocusEvent;
    relayed = new FocusEventConstructor(source.type, {
      ...init,
      relatedTarget: focusSource.relatedTarget,
      view: focusSource.view,
      detail: focusSource.detail,
    });
  } else {
    relayed = new targetRealm.Event(source.type, init);
  }

  if (source.defaultPrevented && relayed.cancelable) relayed.preventDefault();
  target.dispatchEvent(relayed);
  if (relayed.defaultPrevented && source.cancelable) source.preventDefault();
  return relayed as T;
}

/** Dispatches a native `Event` with the public form-control defaults used by Lyra wrappers. */
export function dispatchNativeEvent(
  target: EventTarget,
  type: string,
  options: EventInit = {},
): Event {
  const event = new (ownerEventRealm(target).Event)(type, {
    bubbles: options.bubbles ?? true,
    composed: options.composed ?? true,
    cancelable: options.cancelable ?? false,
  });
  target.dispatchEvent(event);
  return event;
}

/**
 * Dispatches a native `InputEvent`, preserving any editing payload supplied by the caller.
 * Fails closed when an inert owner document cannot expose its creator realm's InputEvent
 * constructor; using the ambient constructor would publish an event with incorrect identity.
 */
export function dispatchNativeInputEvent(
  target: EventTarget,
  options: InputEventInit = {},
): InputEvent {
  const InputEventConstructor = ownerEventRealm(target).InputEvent;
  if (!InputEventConstructor) {
    throw new TypeError('InputEvent is not available in the target realm.');
  }
  const event = new InputEventConstructor('input', {
    ...options,
    bubbles: options.bubbles ?? true,
    composed: options.composed ?? true,
    cancelable: options.cancelable ?? false,
  });
  target.dispatchEvent(event);
  return event;
}

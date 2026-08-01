/**
 * Stops a native event emitted inside a component's shadow root and emits one equivalent native
 * event from the component host. Use this for wrapped controls whose public event must originate
 * at the custom element: allowing the original composed event through as well would deliver two
 * host notifications, while replacing it with a `CustomEvent` would discard native payload such
 * as `InputEvent.inputType` and `FocusEvent.relatedTarget`.
 */
export function relayNativeEvent<T extends Event>(
  target: EventTarget,
  source: T,
  options: EventInit = {},
): T {
  source.stopImmediatePropagation();

  const init: EventInit = {
    bubbles: options.bubbles ?? true,
    composed: options.composed ?? true,
    cancelable: options.cancelable ?? source.cancelable,
  };

  let relayed: Event;
  if (source instanceof InputEvent) {
    relayed = new InputEvent(source.type, {
      ...init,
      data: source.data,
      dataTransfer: source.dataTransfer,
      inputType: source.inputType,
      isComposing: source.isComposing,
      view: source.view,
      detail: source.detail,
    });
  } else if (source instanceof FocusEvent) {
    relayed = new FocusEvent(source.type, {
      ...init,
      relatedTarget: source.relatedTarget,
      view: source.view,
      detail: source.detail,
    });
  } else {
    relayed = new Event(source.type, init);
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
  const event = new Event(type, {
    bubbles: options.bubbles ?? true,
    composed: options.composed ?? true,
    cancelable: options.cancelable ?? false,
  });
  target.dispatchEvent(event);
  return event;
}

/** Dispatches a native `InputEvent`, preserving any editing payload supplied by the caller. */
export function dispatchNativeInputEvent(
  target: EventTarget,
  options: InputEventInit = {},
): InputEvent {
  const event = new InputEvent('input', {
    ...options,
    bubbles: options.bubbles ?? true,
    composed: options.composed ?? true,
    cancelable: options.cancelable ?? false,
  });
  target.dispatchEvent(event);
  return event;
}

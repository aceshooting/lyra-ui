import { dispatchNativeEvent } from './native-event-relay.js';

/** Pair a native value notification with a captured detail; the caller keeps typed emission protected. */
export function emitValueEvents<T extends { readonly value: unknown }>(
  host: HTMLElement,
  kind: 'input' | 'change',
  detail: T,
  emit: (detail: T) => void,
): void {
  dispatchNativeEvent(host, kind);
  emit(detail);
}

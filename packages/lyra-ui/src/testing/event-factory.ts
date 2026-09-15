import { LYRA_EVENT_CANCELABLE } from './lyra-tag-event-map.js';
import type { LyraTagEventTypes } from './lyra-tag-event-map.js';

/**
 * The `lr-*` event names one specific tag documents, restricted away from any native-named
 * member the same map lists (`input`, `change`, `blur`, `focus`, ...) -- those already have real
 * DOM event types and dispatch semantics of their own that this factory does not model.
 */
type LyraFactoryEventName<Tag extends keyof LyraTagEventTypes> = keyof LyraTagEventTypes[Tag] &
  `lr-${string}`;

/**
 * The `detail` `createLyraEvent()` accepts for one event: the same shape a real `this.emit()`
 * call site is typed against (`CustomEvent<{ id: string }>` makes it a specific shape;
 * `CustomEvent<null>` makes it `never`, i.e. omit it). Always optional here, even where the real
 * component's own map makes it required -- a test that only cares about the dispatched event's
 * `bubbles`/`composed`/`cancelable` flags should not have to fabricate a realistic detail just to
 * satisfy this factory the way it must satisfy `emit()` itself.
 */
type LyraFactoryDetail<Event> = Event extends CustomEvent<infer Detail> ? Detail : never;

/**
 * Builds a `CustomEvent` matching one `lr-*` component's own documented event contract --
 * `detail` shape, `bubbles`, `composed`, and `cancelable` -- so a downstream test can dispatch a
 * realistic event without hand-rolling one and guessing its flags.
 *
 * `tag` and `name` are checked against {@link LyraTagEventTypes}, the same per-component
 * `Lyra*EventMap` interfaces `LyraElement.emit()` itself is keyed by, so an unknown tag, an event
 * name that tag does not document, or a `detail` of the wrong shape are all compile errors rather
 * than a silently-wrong test double. `bubbles`/`composed` are always `true`: `LyraElement.emit()`
 * hard-codes both, for every event, unconditionally (`src/internal/lyra-element.ts`). `cancelable`
 * is looked up per tag/event from the same authored contract `check-event-contracts.mjs` already
 * cross-checks against every component's real `this.emit()` call sites -- regenerate it with
 * `node scripts/build-testing-event-registry.mjs` after changing a component's event map.
 *
 * Constructs the event only; it does not dispatch it. Dispatch it at the element under test the
 * normal way (`element.dispatchEvent(createLyraEvent(...))`), the same as any other `CustomEvent`.
 *
 * @example
 * ```ts
 * const event = createLyraEvent('lr-confirm-bar', 'lr-approve', {
 *   args: null,
 *   waitUntil: () => {},
 * });
 * event.cancelable; // true -- lr-confirm-bar's own lr-approve call site passes { cancelable: true }
 * confirmBar.dispatchEvent(event);
 * ```
 */
export function createLyraEvent<
  Tag extends keyof LyraTagEventTypes,
  Name extends LyraFactoryEventName<Tag>,
>(
  tag: Tag,
  name: Name,
  detail?: LyraFactoryDetail<LyraTagEventTypes[Tag][Name]>,
): LyraTagEventTypes[Tag][Name] {
  const cancelable = LYRA_EVENT_CANCELABLE[tag]?.[name] ?? false;
  return new CustomEvent(name, {
    detail: detail === undefined ? null : detail,
    bubbles: true,
    composed: true,
    cancelable,
  }) as LyraTagEventTypes[Tag][Name];
}

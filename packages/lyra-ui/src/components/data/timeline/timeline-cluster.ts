/** @internal Parent/child contract for rendering a collision cluster at its representative
 * timeline item's author-order position without turning ordinary items into public controls. */
export interface TimelineClusterPresentation {
  readonly accessibleLabel: string;
  readonly countText: string;
  readonly activate: () => void;
}

/** @internal */
export type TimelineTimestampObserver = () => void;

/** @internal */
export const SET_TIMELINE_CLUSTER_PRESENTATION: unique symbol = Symbol.for(
  '@aceshooting/lyra-ui/timeline/cluster-presentation/v1'
) as never;

/** @internal Dates compare by time, so a re-created equal `Date` is no change. */
export const timeValueChanged = (value: unknown, old: unknown): boolean =>
  value instanceof Date && old instanceof Date ? !Object.is(value.getTime(), old.getTime()) : !Object.is(value, old);

/** @internal */
export const OBSERVE_TIMELINE_ITEM_TIMESTAMP: unique symbol = Symbol.for(
  '@aceshooting/lyra-ui/timeline/timestamp-observer/v1'
) as never;

/** @internal */
export interface TimelineClusterItemContract {
  [SET_TIMELINE_CLUSTER_PRESENTATION](
    presentation: TimelineClusterPresentation | undefined
  ): void;
  [OBSERVE_TIMELINE_ITEM_TIMESTAMP](
    observer: TimelineTimestampObserver,
    observe: boolean
  ): void;
}

/** @internal */
export function isTimelineClusterItemContract(
  value: Element
): value is Element & TimelineClusterItemContract {
  const candidate = value as Partial<TimelineClusterItemContract>;
  return (
    typeof candidate[SET_TIMELINE_CLUSTER_PRESENTATION] === 'function' &&
    typeof candidate[OBSERVE_TIMELINE_ITEM_TIMESTAMP] === 'function'
  );
}

/** @internal Parent-to-item push of an `ordered` timeline's step number (`undefined` clears it). */
export const SET_TIMELINE_ITEM_ORDINAL: unique symbol = Symbol.for(
  '@aceshooting/lyra-ui/timeline/item-ordinal/v1'
) as never;

/** @internal Item-to-parent pull, for an item that upgrades after its timeline last numbered. */
export const TIMELINE_ITEM_ORDINAL_OF: unique symbol = Symbol.for(
  '@aceshooting/lyra-ui/timeline/ordinal-of/v1'
) as never;

/** @internal */
export interface TimelineOrdinalItemContract {
  [SET_TIMELINE_ITEM_ORDINAL](ordinal: number | undefined): void;
}

/** @internal */
export interface TimelineOrdinalOwnerContract {
  [TIMELINE_ITEM_ORDINAL_OF](item: Element): number | undefined;
}

/** @internal */
export function isTimelineOrdinalItem(value: Element): value is Element & TimelineOrdinalItemContract {
  return typeof (value as Partial<TimelineOrdinalItemContract>)[SET_TIMELINE_ITEM_ORDINAL] === 'function';
}

/** @internal */
export function isTimelineOrdinalOwner(value: Element | null): value is Element & TimelineOrdinalOwnerContract {
  return value !== null && typeof (value as Partial<TimelineOrdinalOwnerContract>)[TIMELINE_ITEM_ORDINAL_OF] === 'function';
}

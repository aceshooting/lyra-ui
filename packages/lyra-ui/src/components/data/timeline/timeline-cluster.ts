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

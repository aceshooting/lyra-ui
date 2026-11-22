// Compile-only contract for the per-event classes: `instanceof` narrows `detail`, and a class
// instance is assignable to the event type the global map already declares.
import { LyraChangeEvent, LyraEvent, LyraSortEvent } from '../src/event-classes.js';
import type { LyraEventDetailOf } from '../src/event-classes.js';
import type { LyraGlobalEventMap } from '../src/events.js';

declare const event: Event;

if (event instanceof LyraSortEvent) {
  const detail: LyraEventDetailOf<LyraGlobalEventMap['lr-sort']> = event.detail;
  void detail;
  const type: 'lr-sort' = event.type as 'lr-sort';
  void type;
}

if (event instanceof LyraChangeEvent) {
  const asEvent: CustomEvent = event;
  void asEvent;
}

const base: LyraEvent<number> = new LyraEvent('lr-custom', 1);
void base;

// @ts-expect-error a per-event class takes that event's detail shape.
new LyraSortEvent(42);

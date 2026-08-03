import {
  Announcer,
  acquireAnnouncementSink,
  type AnnouncementSinkOptions,
  type AnnouncerTimerHost,
} from '../src/lyra.js';
import {
  Announcer as GranularAnnouncer,
  acquireAnnouncementSink as acquireGranularAnnouncementSink,
} from '../src/utilities/announcer.js';

const granularConstructor: typeof Announcer = GranularAnnouncer;
const granularAcquire: typeof acquireAnnouncementSink = acquireGranularAnnouncementSink;
void granularConstructor;
void granularAcquire;

const timerHost: AnnouncerTimerHost = window;
const announcer = new Announcer({
  timerHost,
  onFlush: () => undefined,
});
announcer.setTimerHost(window);

const source = document.createElement('div');
const options: AnnouncementSinkOptions = {
  document,
  source,
  messageTtlMs: 5000,
};
const sink = acquireAnnouncementSink('polite', options);
sink.announce('Ready');
sink.release();

// @ts-expect-error A source must be an Element whose composed visibility can be evaluated.
const invalidSource: AnnouncementSinkOptions = { source: document };
void invalidSource;

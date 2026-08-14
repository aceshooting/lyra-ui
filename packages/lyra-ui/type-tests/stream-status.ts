import type {
  LyraStreamPhase,
  LyraStreamStatus,
  StreamConnectionState,
} from '../src/lyra.js';

declare const status: LyraStreamStatus;

const connectionState: StreamConnectionState = status.connectionState;
const phase: LyraStreamPhase = status.phase;
status.connectionState = 'streaming';
status.markStalled();
status.recordActivity();

void connectionState;
void phase;

// @ts-expect-error `phase` is derived read-only state in v9.
status.phase = 'stalled';
// @ts-expect-error legacy connection vocabulary is rejected.
status.connectionState = 'connected';

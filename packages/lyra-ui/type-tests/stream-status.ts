import type { LyraStreamStatus } from '../src/components/conversation/stream-status/stream-status.class.js';
import type {
  LyraStreamPhase,
  StreamConnectionState,
  StreamStatusPhase,
} from '../src/lyra.js';

declare const status: LyraStreamStatus;

const connectionState: StreamConnectionState = status.connectionState;
const phase: StreamStatusPhase = status.phase;
const interrupted: StreamStatusPhase = 'interrupted';
if (phase !== 'interrupted') {
  const sharedPhase: LyraStreamPhase = phase;
  void sharedPhase;
}
status.connectionState = 'streaming';
status.connectionState = 'interrupted';
status.markStalled();
status.recordActivity();

void connectionState;
void phase;
void interrupted;

// @ts-expect-error `phase` is derived read-only state in v9.
status.phase = 'stalled';
// @ts-expect-error legacy connection vocabulary is rejected.
status.connectionState = 'connected';

// @ts-expect-error Stalls are detected or declared through markStalled(), not connectionState.
status.connectionState = 'stalled';

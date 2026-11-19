import type { AgentStatusKind } from '../ai/types.js';

const STATUS_LABEL_KEYS: Record<AgentStatusKind, string> = {
  idle: 'agentRunStatusIdle',
  queued: 'agentRunStatusQueued',
  running: 'statusRunning',
  collecting: 'agentRunStatusCollecting',
  'waiting-input': 'agentRunStatusWaitingInput',
  'waiting-approval': 'agentRunStatusWaitingApproval',
  done: 'agentRunStatusDone',
  error: 'statusError',
  cancelled: 'agentRunStatusCancelled',
};

/** The localized label of a built-in lifecycle kind; an application-defined kind is title-cased.
 *  A value that is neither a kind string nor a `{ kind }` record reads as `idle`. */
export function agentStatusText(localize: (key: string) => string, kind: unknown): string {
  let name: unknown = kind;
  if (name !== null && typeof name === 'object') {
    try {
      name = (name as { kind?: unknown }).kind;
    } catch {
      name = undefined;
    }
  }
  const text = typeof name === 'string' && name !== '' ? name : 'idle';
  return Object.hasOwn(STATUS_LABEL_KEYS, text)
    ? localize(STATUS_LABEL_KEYS[text as AgentStatusKind]!)
    : text.replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

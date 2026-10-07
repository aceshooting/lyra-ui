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

/** The localized label of a built-in lifecycle kind; an application-defined kind is title-cased. */
export function agentStatusText(localize: (key: string) => string, kind: AgentStatusKind): string {
  return STATUS_LABEL_KEYS[kind]
    ? localize(STATUS_LABEL_KEYS[kind])
    : kind.replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

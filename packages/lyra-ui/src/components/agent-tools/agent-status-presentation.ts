import type { AgentStatus, AgentStatusKind } from '../../ai/types.js';
import type { BadgeVariant } from '../overlays/badge/badge.class.js';

/** Optional presentation metadata for application-defined agent lifecycle states. */
export interface AgentStatusPresentation extends AgentStatus {
  /** Caller-visible label. An explicitly empty label is preserved. */
  label?: string;
  /** Badge presentation for this state. Invalid runtime values fall back to the component map. */
  variant?: BadgeVariant;
  /** Whether this state counts as complete. Defaults to the built-in terminal-state map. */
  terminal?: boolean;
  /** Whether this state represents active work. Defaults to the built-in active-state map. */
  active?: boolean;
}

/** Compact lifecycle kinds remain accepted alongside the extensible presentation object. */
export type AgentStatusValue = AgentStatusKind | AgentStatusPresentation;

const BADGE_VARIANTS = new Set<BadgeVariant>([
  'neutral',
  'brand',
  'success',
  'warning',
  'danger',
]);

export function agentStatusKind(status: AgentStatusValue): AgentStatusKind {
  if (typeof status === 'string') return status;
  return status !== null
    && typeof status === 'object'
    && typeof status.kind === 'string'
    ? status.kind
    : 'idle';
}

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

export function agentStatusLabel(status: AgentStatusValue): string | undefined {
  return status !== null && typeof status === 'object' && typeof status.label === 'string'
    ? status.label
    : undefined;
}

export function agentStatusMessage(status: AgentStatusValue): string | undefined {
  return status !== null && typeof status === 'object' && typeof status.message === 'string'
    ? status.message
    : undefined;
}

export function agentStatusVariant(
  status: AgentStatusValue,
  fallback: BadgeVariant,
): BadgeVariant {
  const variant = status !== null && typeof status === 'object' ? status.variant : undefined;
  return variant != null && BADGE_VARIANTS.has(variant) ? variant : fallback;
}

export function isAgentStatusTerminal(status: AgentStatusValue): boolean {
  if (status !== null && typeof status === 'object' && typeof status.terminal === 'boolean') return status.terminal;
  const kind = agentStatusKind(status);
  return kind === 'done' || kind === 'error' || kind === 'cancelled';
}

export function isAgentStatusActive(status: AgentStatusValue): boolean {
  if (status !== null && typeof status === 'object' && typeof status.active === 'boolean') return status.active;
  const kind = agentStatusKind(status);
  return kind === 'running' || kind === 'collecting';
}

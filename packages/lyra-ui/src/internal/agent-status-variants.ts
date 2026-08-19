import type { AgentStatusKind } from '../ai/types.js';
import type { LyraVariant } from './variants.js';

/**
 * The one badge tone per built-in `AgentStatusKind`.
 *
 * Four components rendered a private, byte-identical copy of this map (`lr-agent-run`,
 * `lr-subagent-panel`, `lr-eval-run`, `lr-agent-eval-dashboard`), which meant a run shown in two
 * of them could drift to two different tones — the same failure mode `internal/variants.ts`
 * describes for the tone union itself. The polarity matches `<lr-span-waterfall>`'s own
 * status-to-tone mapping, extended to the lifecycle states a single span's narrower vocabulary
 * has no need for (`queued`, `collecting`, both `waiting-*`, `cancelled`).
 *
 * `AgentStatusKind` stays open to application-defined states, so the map is deliberately partial:
 * an unknown kind resolves to `undefined` and each caller applies its own fallback (`'neutral'`,
 * unless the caller-supplied `AgentStatusPresentation.variant` already won in
 * `agentStatusVariant()`). Values are `LyraVariant`, which every `BadgeVariant` position accepts.
 */
export const AGENT_STATUS_VARIANTS: Readonly<
  Partial<Record<AgentStatusKind, LyraVariant>>
> = Object.freeze({
  idle: 'neutral',
  queued: 'neutral',
  running: 'brand',
  collecting: 'brand',
  'waiting-input': 'warning',
  'waiting-approval': 'warning',
  done: 'success',
  error: 'danger',
  cancelled: 'neutral',
});

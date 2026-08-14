/** Shared correlation detail for activating a run from any agent/evaluation surface. */
export interface AgentRunActivateDetail<TRun = unknown> {
  runId: string;
  run?: TRun;
}

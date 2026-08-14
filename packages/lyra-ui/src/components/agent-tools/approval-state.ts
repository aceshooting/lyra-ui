/** An approval operation that is being proposed or persisted. */
export type ApprovalAction = 'approve' | 'deny';

/** The final outcome of an approval operation. */
export type ApprovalDecision = 'approved' | 'denied';

/** Converts an imperative pending action into its committed decision value. */
export function approvalDecision(action: ApprovalAction): ApprovalDecision {
  return action === 'approve' ? 'approved' : 'denied';
}

/** Converts a committed decision into the action that produced it. */
export function approvalAction(decision: ApprovalDecision): ApprovalAction {
  return decision === 'approved' ? 'approve' : 'deny';
}

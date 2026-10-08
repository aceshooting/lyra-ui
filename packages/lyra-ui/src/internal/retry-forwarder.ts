import { requestThenCommit } from './request-commit.js';

/**
 * Forwards a nested table's cancelable retry as the host's own `lr-retry-request`; a veto keeps
 * both error states, and a retry arriving while one is being forwarded is refused.
 */
export function createRetryForwarder(
  emitRequest: (init: { cancelable: true }) => CustomEvent,
  commit: () => void,
): (event: CustomEvent<null>) => void {
  let active = false;
  return (event) => {
    event.stopPropagation();
    if (active) {
      event.preventDefault();
      return;
    }
    active = true;
    try {
      const request = requestThenCommit<null, CustomEvent>({
        requestDetail: null,
        emitRequest: (_detail, init: { cancelable: true }) => emitRequest(init),
        commit,
      });
      if (request.defaultPrevented) event.preventDefault();
    } finally {
      active = false;
    }
  };
}

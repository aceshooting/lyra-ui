import { devWarnOnce } from './dev-mode-attribute-warning.js';

/** The ExtendableEvent-style resolver an approval request's detail carries (see `createWaitUntil`). */
export type ApprovalWaitUntil = (promise: Promise<unknown>) => void;

/**
 * A `waitUntil()` collector for one request dispatch. Calls are honored only until `seal()`;
 * later ones warn and do nothing. `deferrals` holds every accepted promise.
 */
export function createWaitUntil(tag: string): {
  waitUntil: ApprovalWaitUntil;
  deferrals: Promise<unknown>[];
  seal: () => void;
} {
  const deferrals: Promise<unknown>[] = [];
  let open = true;
  const waitUntil: ApprovalWaitUntil = (promise) => {
    if (!open) {
      devWarnOnce(
        `lyra-${tag}-wait-until-after-dispatch`,
        `<lr-${tag}>: waitUntil() was called after its lr-approve-request/lr-deny-request dispatch had ` +
          'finished, so it did nothing. Call it synchronously from the listener; the promise it ' +
          'receives may settle whenever it likes.',
      );
      return;
    }
    // Promise.resolve() so a thenable (or nothing) from plain JS cannot throw inside the dispatch.
    deferrals.push(Promise.resolve(promise));
  };
  return { waitUntil, deferrals, seal: () => { open = false; } };
}

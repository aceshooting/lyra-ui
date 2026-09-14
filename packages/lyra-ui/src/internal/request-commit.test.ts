import { expect } from '@open-wc/testing';
import { LyraElement } from './lyra-element.js';
import { defineElement, tag } from './prefix.js';
import { requestThenCommit } from './request-commit.js';
import { markVetoGuardWrite, VetoWriteGuard } from './veto-write-guard.js';

interface StubToggleDetail {
  readonly id: string;
  readonly collapsed: boolean;
}

interface StubHostEventMap {
  'lr-stub-toggle-request': CustomEvent<StubToggleDetail>;
  'lr-stub-toggle': CustomEvent<StubToggleDetail>;
}

/**
 * A minimal stand-in for the real pairs this helper replaces (a disclosure toggle, a group
 * collapse): one guarded boolean written through a hand-written accessor that marks the guard on
 * every write, and one request/commit method per guard mode.
 */
class RequestCommitStubHost extends LyraElement<StubHostEventMap> {
  readonly guard = new VetoWriteGuard();
  readonly log: string[] = [];
  readonly committedIds: string[] = [];
  commitCount = 0;
  #collapsed = false;

  get collapsed(): boolean {
    return this.#collapsed;
  }

  set collapsed(value: boolean) {
    this.#collapsed = value;
    markVetoGuardWrite(this.guard);
  }

  /**
   * The guarded call shape, written exactly as the module documents it: a listener may veto, or
   * may simply write `collapsed` itself. The `init: { cancelable: true }` annotation is the
   * documented call-site requirement -- `check:event-contracts` resolves an EventInit only from an
   * object literal or an inline object type, never from contextual inference or a named alias.
   */
  toggle(detail: StubToggleDetail): CustomEvent<StubToggleDetail> {
    return requestThenCommit({
      requestDetail: detail,
      emitRequest: (proposed, init: { cancelable: true }) =>
        this.emit('lr-stub-toggle-request', proposed, init),
      guard: this.guard,
      commit: () => this.applyToggle(detail),
    });
  }

  /** The same call with the optional `guard` key absent -- the unset-regression shape. */
  toggleUnguarded(detail: StubToggleDetail): CustomEvent<StubToggleDetail> {
    return requestThenCommit({
      requestDetail: detail,
      emitRequest: (proposed, init: { cancelable: true }) =>
        this.emit('lr-stub-toggle-request', proposed, init),
      commit: () => this.applyToggle(detail),
    });
  }

  /**
   * The misuse the type system cannot reject: an arity-shortened adapter that drops the `init`
   * the helper supplies, so the request is dispatched non-cancelable and `preventDefault()`
   * becomes a silent no-op. Only the helper's dev-mode read-back catches it.
   */
  toggleDroppingInit(detail: StubToggleDetail): CustomEvent<StubToggleDetail> {
    return requestThenCommit({
      requestDetail: detail,
      emitRequest: (proposed) => this.emit('lr-stub-toggle-request', proposed),
      guard: this.guard,
      commit: () => this.applyToggle(detail),
    });
  }

  /**
   * A commit that both writes through the guarded setter and then starts a nested request/commit
   * pair on the same guard. Re-entrancy fixture for the module's claim that the outer decision,
   * taken before `commit` ran, cannot be revisited by anything the commit itself does -- including
   * the nested pair re-opening the very guard the outer call just read.
   */
  toggleWithNestedPair(
    detail: StubToggleDetail,
    nested: StubToggleDetail,
  ): CustomEvent<StubToggleDetail> {
    return requestThenCommit({
      requestDetail: detail,
      emitRequest: (proposed, init: { cancelable: true }) =>
        this.emit('lr-stub-toggle-request', proposed, init),
      guard: this.guard,
      commit: () => {
        this.applyToggle(detail);
        this.toggle(nested);
      },
    });
  }

  private applyToggle(detail: StubToggleDetail): void {
    this.commitCount++;
    this.committedIds.push(detail.id);
    this.log.push('commit');
    this.collapsed = detail.collapsed;
    this.emit('lr-stub-toggle', detail);
  }
}

const stubTag = tag('request-commit-test-host');
defineElement('request-commit-test-host', RequestCommitStubHost);

const mounted: RequestCommitStubHost[] = [];

function createHost(): RequestCommitStubHost {
  const host = document.createElement(stubTag) as RequestCommitStubHost;
  document.body.append(host);
  mounted.push(host);
  return host;
}

afterEach(() => {
  for (const host of mounted.splice(0)) host.remove();
});

type LitWarningGlobal = { litIssuedWarnings?: Set<string> };

/**
 * Runs `body` with Lit's dev-mode signal forced on or off and `console.warn` captured, then
 * restores both globals whatever happens. `devWarnOnce()` is gated on that signal, so the
 * diagnostic is only observable with it installed -- and its dedupe store is that same set, so a
 * fresh set per run keeps the "warn once" assertion honest.
 */
function warningsWhile(devMode: boolean, body: () => void): string[] {
  const target = globalThis as LitWarningGlobal;
  const hadSignal = 'litIssuedWarnings' in target;
  const previousSignal = target.litIssuedWarnings;
  const previousWarn = console.warn;
  const messages: string[] = [];
  if (devMode) target.litIssuedWarnings = new Set<string>();
  else delete target.litIssuedWarnings;
  console.warn = (...args: unknown[]) => {
    messages.push(args.map(String).join(' '));
  };
  try {
    body();
  } finally {
    console.warn = previousWarn;
    if (hadSignal) target.litIssuedWarnings = previousSignal;
    else delete target.litIssuedWarnings;
  }
  return messages;
}

describe('requestThenCommit', () => {
  it('does not run the commit action when a listener vetoes the request', () => {
    const host = createHost();
    host.addEventListener('lr-stub-toggle-request', (event) =>
      event.preventDefault(),
    );

    const request = host.toggle({ id: 'alpha', collapsed: true });

    expect(
      host.commitCount,
      'a vetoed request must never run the commit action',
    ).to.equal(0);
    expect(request.defaultPrevented).to.equal(true);
    expect(
      host.collapsed,
      'the proposed value must not be written after a veto',
    ).to.equal(false);
  });

  it('runs the commit action exactly once when no listener vetoes', () => {
    const host = createHost();
    const settled: string[] = [];
    host.addEventListener('lr-stub-toggle', (event) =>
      settled.push(event.detail.id),
    );

    const request = host.toggle({ id: 'alpha', collapsed: true });

    expect(host.commitCount).to.equal(1);
    expect(host.committedIds).to.deep.equal(['alpha']);
    expect(request.defaultPrevented).to.equal(false);
    expect(host.collapsed).to.equal(true);
    expect(
      settled,
      'the commit action owns the settled event, so it must have been emitted once',
    ).to.deep.equal(['alpha']);
  });

  it('returns the same request event the listeners received, dispatched cancelable and composed', () => {
    const host = createHost();
    const seen: CustomEvent<StubToggleDetail>[] = [];
    host.addEventListener('lr-stub-toggle-request', (event) => seen.push(event));

    const request = host.toggle({ id: 'alpha', collapsed: true });

    expect(seen.length, 'the request event must reach a host listener').to.equal(
      1,
    );
    expect(
      seen[0] === request,
      'the returned event must be the very event object the listener received',
    ).to.equal(true);
    expect(request.type).to.equal('lr-stub-toggle-request');
    expect(
      request.cancelable,
      'a request nobody can cancel is not a veto point',
    ).to.equal(true);
    expect(request.bubbles).to.equal(true);
    expect(request.composed).to.equal(true);
    expect(request.detail.id).to.equal('alpha');
    expect(request.detail.collapsed).to.equal(true);
  });

  it('does not clobber a listener that resolves the change itself during the dispatch', () => {
    const host = createHost();
    // The listener writes back the value the property already holds and does NOT veto: the exact
    // case a before/after value compare cannot see.
    host.addEventListener('lr-stub-toggle-request', () => {
      host.collapsed = false;
    });

    const request = host.toggle({ id: 'alpha', collapsed: true });

    expect(request.defaultPrevented).to.equal(false);
    expect(
      host.commitCount,
      'a guarded write during the dispatch must suppress the default commit',
    ).to.equal(0);
    expect(
      host.collapsed,
      'the value the listener chose must survive the call',
    ).to.equal(false);
  });

  it('keeps a listener that both vetoes and writes from being overwritten', () => {
    const host = createHost();
    host.addEventListener('lr-stub-toggle-request', (event) => {
      event.preventDefault();
      host.collapsed = true;
    });

    const request = host.toggle({ id: 'alpha', collapsed: false });

    expect(request.defaultPrevented).to.equal(true);
    expect(host.commitCount).to.equal(0);
    expect(host.collapsed).to.equal(true);
  });

  it('still commits when no guard is supplied, even if a listener writes during the dispatch', () => {
    const host = createHost();
    host.addEventListener('lr-stub-toggle-request', () => {
      host.collapsed = false;
    });

    const request = host.toggleUnguarded({ id: 'alpha', collapsed: true });

    expect(request.defaultPrevented).to.equal(false);
    expect(
      host.commitCount,
      'omitting the guard must keep the plain veto-or-commit behaviour',
    ).to.equal(1);
    expect(host.collapsed).to.equal(true);
  });

  it('opens the guard itself, so a write from before the call cannot suppress the commit', () => {
    const host = createHost();
    host.collapsed = false;
    expect(
      host.guard.touched,
      'the precondition for this test is a guard left touched by an earlier write',
    ).to.equal(true);

    const request = host.toggle({ id: 'alpha', collapsed: true });

    expect(request.defaultPrevented).to.equal(false);
    expect(host.commitCount).to.equal(1);
    expect(host.collapsed).to.equal(true);
  });

  it('opens the guard on every call, so a commit write from the previous call cannot suppress the next one', () => {
    const host = createHost();

    host.toggle({ id: 'alpha', collapsed: true });
    host.toggle({ id: 'beta', collapsed: false });

    expect(
      host.committedIds,
      'each call must be judged on its own dispatch, not on the previous commit write',
    ).to.deep.equal(['alpha', 'beta']);
    expect(host.commitCount).to.equal(2);
    expect(host.collapsed).to.equal(false);
  });

  it('runs the whole request/commit sequence synchronously and in order', () => {
    const host = createHost();
    host.addEventListener('lr-stub-toggle-request', () =>
      host.log.push('request'),
    );
    host.addEventListener('lr-stub-toggle', () => host.log.push('settled'));

    host.toggle({ id: 'alpha', collapsed: true });

    expect(
      host.log,
      'the request listeners, the commit action and the settled event must all have run before the call returned',
    ).to.deep.equal(['request', 'commit', 'settled']);
  });

  it('warns in dev mode when an adapter drops the init and dispatches a non-cancelable request', () => {
    const host = createHost();
    host.addEventListener('lr-stub-toggle-request', (event) =>
      event.preventDefault(),
    );

    let request: CustomEvent<StubToggleDetail> | undefined;
    const messages = warningsWhile(true, () => {
      request = host.toggleDroppingInit({ id: 'alpha', collapsed: true });
      // Warn once per event type, however many call sites hit the same mistake.
      host.toggleDroppingInit({ id: 'beta', collapsed: false });
    });

    expect(
      request?.cancelable,
      'the adapter dropped the init, so the request really was dispatched non-cancelable',
    ).to.equal(false);
    expect(
      request?.defaultPrevented,
      'preventDefault() on a non-cancelable event is a silent no-op -- that is the defect',
    ).to.equal(false);
    expect(
      messages.length,
      'the dev-mode read-back must fire exactly once per event type',
    ).to.equal(1);
    expect(messages[0]).to.contain('lr-stub-toggle-request');
    expect(messages[0]).to.contain('cancelable');
  });

  it('stays silent about cancelability in production, and never warns for a correct adapter', () => {
    const host = createHost();

    const productionMessages = warningsWhile(false, () => {
      host.toggleDroppingInit({ id: 'alpha', collapsed: true });
    });
    expect(
      productionMessages,
      'the diagnostic is dev-mode only, exactly like every other devWarnOnce() caller',
    ).to.deep.equal([]);

    const correctMessages = warningsWhile(true, () => {
      host.toggle({ id: 'beta', collapsed: false });
    });
    expect(
      correctMessages,
      'an adapter that forwards init must never draw the diagnostic',
    ).to.deep.equal([]);
  });

  it('survives a nested request/commit pair started from inside the commit action', () => {
    const host = createHost();

    const request = host.toggleWithNestedPair(
      { id: 'alpha', collapsed: true },
      { id: 'beta', collapsed: false },
    );

    expect(request.defaultPrevented).to.equal(false);
    expect(
      host.committedIds,
      'the outer commit ran to completion and the nested pair committed on its own terms',
    ).to.deep.equal(['alpha', 'beta']);
    expect(host.collapsed).to.equal(false);
  });

  it('keeps working after the host is disconnected and reconnected', async () => {
    const host = createHost();
    const seen: string[] = [];
    host.addEventListener('lr-stub-toggle-request', (event) =>
      seen.push(event.detail.id),
    );
    await host.updateComplete;

    host.remove();
    document.body.append(host);
    await host.updateComplete;

    const request = host.toggle({ id: 'alpha', collapsed: true });

    expect(seen).to.deep.equal(['alpha']);
    expect(
      host.commitCount,
      'the helper holds no per-host state, so a reconnect must not change the outcome',
    ).to.equal(1);
    expect(request.defaultPrevented).to.equal(false);
    expect(host.collapsed).to.equal(true);
  });
});

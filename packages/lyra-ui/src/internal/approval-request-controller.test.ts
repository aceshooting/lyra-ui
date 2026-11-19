import { expect, fixture, html } from '@open-wc/testing';
import { LyraElement } from './lyra-element.js';
import { defineElement } from './prefix.js';
import { ApprovalRequestController } from './approval-request-controller.js';
import type { ApprovalWaitUntil } from './approval-wait-until.js';

type Action = 'approve' | 'deny';

class ApprovalProbe extends LyraElement {
  decided: string[] = [];
  vetoes: string[] = [];
  bounces: string[] = [];
  decision: string | null = null;
  open = true;
  private _pending: Action | null = null;
  readonly approval = new ApprovalRequestController<Action>(this, {
    tag: 'approval-probe',
    pending: () => this._pending,
    setPending: (value) => { this.pendingAction = value; },
    stillOpen: () => this.decision === null,
    onDecide: (action, sync) => { this.decision = action; this.decided.push(`${action}:${sync ? 'sync' : 'async'}`); },
    onVeto: (action) => this.vetoes.push(action),
    onBounce: (action) => this.bounces.push(action),
  });

  get pendingAction(): Action | null { return this._pending; }
  set pendingAction(value: Action | null) {
    const previous = this._pending;
    this._pending = value;
    this.approval.pendingChanged(previous, value);
  }

  writeDecision(value: string | null): void {
    this.decision = value;
    this.approval.markWrite();
  }

  fire(action: Action, listener?: (event: Event, waitUntil: ApprovalWaitUntil) => void): boolean {
    return this.approval.request(action, (waitUntil) => {
      const event = new CustomEvent('probe-request', { cancelable: true });
      const handler = (e: Event): void => listener?.(e, waitUntil);
      this.addEventListener('probe-request', handler, { once: true });
      this.dispatchEvent(event);
      this.removeEventListener('probe-request', handler);
      return event;
    });
  }

  override render() { return html``; }
}
defineElement('approval-probe', ApprovalProbe);

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 10));

describe('ApprovalRequestController', () => {
  const make = () => fixture<ApprovalProbe>(html`<lr-approval-probe></lr-approval-probe>`);

  it('commits synchronously when no listener vetoes', async () => {
    const host = await make();
    expect(host.fire('approve')).to.equal(true);
    expect(host.decided).to.deep.equal(['approve:sync']);
  });

  it('a veto without waitUntil holds the pending state and keeps the decision unmade', async () => {
    const host = await make();
    expect(host.fire('deny', (e) => e.preventDefault())).to.equal(false);
    expect(host.pendingAction).to.equal('deny');
    expect(host.vetoes).to.deep.equal(['deny']);
    expect(host.decided).to.deep.equal([]);
    // Pending blocks any further request.
    expect(host.fire('approve')).to.equal(false);
    expect(host.decided).to.deep.equal([]);
  });

  it('blocks a nested request dispatched from inside a listener', async () => {
    const host = await make();
    let nested: boolean | undefined;
    host.fire('approve', () => { nested = host.fire('deny'); });
    expect(nested).to.equal(false);
    expect(host.decided).to.deep.equal(['approve:sync']);
  });

  it('waitUntil fulfilment finalizes asynchronously; rejection bounces back', async () => {
    const host = await make();
    host.fire('approve', (_e, waitUntil) => waitUntil(Promise.resolve()));
    expect(host.pendingAction).to.equal('approve');
    await tick();
    expect(host.decided).to.deep.equal(['approve:async']);

    const other = await make();
    other.fire('deny', (_e, waitUntil) => waitUntil(Promise.reject(new Error('no'))));
    await tick();
    expect(other.pendingAction).to.equal(null);
    expect(other.bounces).to.deep.equal(['deny']);
    expect(other.decided).to.deep.equal([]);
  });

  it('a listener that resolves the state itself wins and its promises are absorbed', async () => {
    const host = await make();
    const rejections: unknown[] = [];
    const onRejection = (e: PromiseRejectionEvent): void => { rejections.push(e.reason); e.preventDefault(); };
    window.addEventListener('unhandledrejection', onRejection);
    host.fire('approve', (e, waitUntil) => {
      e.preventDefault();
      host.writeDecision('other');
      waitUntil(Promise.reject(new Error('ignored')));
    });
    await tick();
    window.removeEventListener('unhandledrejection', onRejection);
    expect(rejections).to.deep.equal([]);
    expect(host.pendingAction).to.equal(null);
    expect(host.decided).to.deep.equal([]);
    expect(host.decision).to.equal('other');
  });

  it('a listener writing the same value back still counts as resolving it', async () => {
    const host = await make();
    host.fire('approve', () => host.writeDecision(null));
    expect(host.decided).to.deep.equal([]);
  });

  it('a stale settlement never resolves a newer pending decision', async () => {
    const host = await make();
    let release!: () => void;
    host.fire('approve', (_e, waitUntil) => waitUntil(new Promise<void>((resolve) => { release = resolve; })));
    host.pendingAction = null;
    host.pendingAction = 'approve';
    release();
    await tick();
    expect(host.decided).to.deep.equal([]);
  });

  it('waitUntil after the dispatch is ignored', async () => {
    const host = await make();
    let late: ApprovalWaitUntil | undefined;
    host.fire('approve', (_e, waitUntil) => { late = waitUntil; });
    const warn = console.warn;
    const warnings: unknown[] = [];
    console.warn = (...args: unknown[]) => { warnings.push(args[0]); };
    try { late!(Promise.resolve()); } finally { console.warn = warn; }
    await tick();
    expect(warnings.length).to.be.at.most(1);
    expect(host.decided).to.deep.equal(['approve:sync']);
  });

  it('a disconnect clears the dispatch flag so the next connection can request', async () => {
    const host = await make();
    host.approval.decisionDispatching = true;
    const parent = host.parentNode!;
    host.remove();
    expect(host.approval.decisionDispatching).to.equal(false);
    parent.append(host);
    expect(host.fire('approve')).to.equal(true);
  });
});

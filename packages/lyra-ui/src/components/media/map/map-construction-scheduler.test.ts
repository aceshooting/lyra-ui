import { expect } from '@open-wc/testing';
import { createMapConstructionScheduler, MapConstructionScheduler, type MapConstructionPort } from './map-construction-scheduler.js';

function harness(synchronous = false) {
  let connected = true;
  let constructions = 0;
  const jobs: { kind: string; run: () => void; cancelled: boolean }[] = [];
  const queue = (kind: string, run: () => void): (() => void) => {
    const job = { kind, run, cancelled: false };
    jobs.push(job);
    if (synchronous) run();
    return () => { job.cancelled = true; };
  };
  const port: MapConstructionPort = {
    connected: () => connected,
    visible: admit => queue('visible', admit),
    idle: admit => queue('idle', admit),
  };
  const scheduler = new MapConstructionScheduler(port, () => { constructions += 1; });
  return { scheduler, jobs, count: () => constructions, detach: () => { connected = false; } };
}

describe('map construction scheduling', () => {
  it('defaults to visibility and waits for both readiness and visibility', () => {
    const h = harness();
    h.scheduler.connect();
    h.scheduler.setReady(true);
    expect(h.jobs[0]!.kind).to.equal('visible');
    expect(h.count()).to.equal(0);
    h.jobs[0]!.run();
    expect(h.count()).to.equal(1);
    expect(h.jobs[0]!.cancelled).to.equal(true);
  });

  it('retains admission until the peer and render prerequisites become ready', () => {
    const h = harness();
    h.scheduler.connect();
    h.jobs[0]!.run();
    expect(h.count()).to.equal(0);
    h.scheduler.setReady(true);
    expect(h.count()).to.equal(1);
  });

  it('does not construct from repeated observer deliveries or readiness notifications', () => {
    const h = harness();
    h.scheduler.connect();
    h.scheduler.setReady(true);
    h.jobs[0]!.run();
    h.jobs[0]!.run();
    h.scheduler.setReady(false);
    h.scheduler.setReady(true);
    h.scheduler.reconfigure('eager');
    expect(h.count()).to.equal(1);
  });

  it('eager skips scheduling while retaining readiness gating', () => {
    const h = harness();
    h.scheduler.connect('eager');
    expect(h.count()).to.equal(0);
    expect(h.jobs.length).to.equal(0);
    h.scheduler.setReady(true);
    expect(h.count()).to.equal(1);
  });

  it('idle waits for its scheduler and cancels the completed handle', () => {
    const h = harness();
    h.scheduler.connect('idle');
    h.scheduler.setReady(true);
    expect(h.jobs[0]!.kind).to.equal('idle');
    expect(h.count()).to.equal(0);
    h.jobs[0]!.run();
    expect(h.jobs[0]!.cancelled).to.equal(true);
    expect(h.count()).to.equal(1);
  });

  it('disconnect cancels idle work and rejects late delivery', () => {
    const h = harness();
    h.scheduler.connect('idle');
    h.scheduler.setReady(true);
    h.scheduler.disconnect();
    h.jobs[0]!.run();
    expect(h.jobs[0]!.cancelled).to.equal(true);
    expect(h.count()).to.equal(0);
  });

  it('reconfiguration rejects an old visibility callback while waiting for idle', () => {
    const h = harness();
    h.scheduler.connect();
    h.scheduler.setReady(true);
    h.scheduler.reconfigure('idle');
    h.jobs[0]!.run();
    expect(h.jobs[0]!.cancelled).to.equal(true);
    expect(h.count()).to.equal(0);
    h.jobs[1]!.run();
    expect(h.count()).to.equal(1);
  });

  it('reconnect requires fresh readiness and ignores the previous connection callback', () => {
    const h = harness();
    h.scheduler.connect();
    h.scheduler.setReady(true);
    h.scheduler.disconnect();
    h.scheduler.connect();
    h.jobs[0]!.run();
    h.jobs[1]!.run();
    expect(h.count()).to.equal(0);
    h.scheduler.setReady(true);
    expect(h.count()).to.equal(1);
  });

  it('a completed connection can construct once again after reconnect', () => {
    const h = harness();
    h.scheduler.connect('eager');
    h.scheduler.setReady(true);
    h.scheduler.disconnect();
    h.scheduler.connect('eager');
    h.scheduler.setReady(true);
    expect(h.count()).to.equal(2);
  });

  it('checks actual host attachment when scheduled work arrives', () => {
    const h = harness();
    h.scheduler.connect();
    h.scheduler.setReady(true);
    h.detach();
    h.jobs[0]!.run();
    expect(h.count()).to.equal(0);
  });

  it('cleans a synchronous scheduling result without leaving a live handle', () => {
    const h = harness(true);
    h.scheduler.connect();
    expect(h.jobs[0]!.cancelled).to.equal(true);
    h.scheduler.setReady(true);
    expect(h.count()).to.equal(1);
  });

  it('consumes before invoking construction to prevent synchronous reentry', () => {
    let count = 0;
    const scheduler = new MapConstructionScheduler({ connected: () => true, visible: () => () => {}, idle: () => () => {} }, () => {
      count += 1;
      scheduler.setReady(true);
      scheduler.reconfigure('eager');
    });
    scheduler.connect('eager');
    scheduler.setReady(true);
    expect(count).to.equal(1);
  });

  it('does not retry a throwing constructor in the same connection', () => {
    const scheduler = new MapConstructionScheduler({ connected: () => true, visible: () => () => {}, idle: () => () => {} }, () => { throw new Error('constructor failed'); });
    scheduler.connect('eager');
    expect(() => scheduler.setReady(true)).to.throw('constructor failed');
    expect(() => scheduler.setReady(true)).to.not.throw();
  });

  it('does not schedule or construct without an owner browser realm', () => {
    const host = document.implementation.createHTMLDocument().createElement('div');
    let count = 0;
    const scheduler = createMapConstructionScheduler(host, () => { count += 1; });
    for (const mode of ['visible', 'idle', 'eager'] as const) {
      scheduler.connect(mode);
      scheduler.setReady(true);
      scheduler.disconnect();
    }
    expect(host.ownerDocument.defaultView === null).to.equal(true);
    expect(count).to.equal(0);
  });

  it('uses the host realm idle queue with its timeout and cancels on disconnect', () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const view = frame.contentWindow!;
    const host = view.document.createElement('div');
    view.document.body.append(host);
    const originalRequest = view.requestIdleCallback;
    const originalCancel = view.cancelIdleCallback;
    let callback: IdleRequestCallback | undefined;
    let timeout: number | undefined;
    let cancelled = 0;
    let count = 0;
    try {
      view.requestIdleCallback = (next, options) => { callback = next; timeout = options?.timeout; return 41; };
      view.cancelIdleCallback = handle => { cancelled = handle; };
      const scheduler = createMapConstructionScheduler(host, () => { count += 1; });
      scheduler.connect('idle');
      scheduler.setReady(true);
      scheduler.disconnect();
      callback!({ didTimeout: true, timeRemaining: () => 0 });
      expect(timeout).to.equal(1000);
      expect(cancelled).to.equal(41);
      expect(count).to.equal(0);
    } finally {
      view.requestIdleCallback = originalRequest;
      view.cancelIdleCallback = originalCancel;
      frame.remove();
    }
  });

  it('cancels the owner timer fallback and ignores its late delivery', () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const view = frame.contentWindow!;
    const host = view.document.createElement('div');
    view.document.body.append(host);
    const requestDescriptor = Object.getOwnPropertyDescriptor(view, 'requestIdleCallback');
    const originalTimer = view.setTimeout;
    const originalClear = view.clearTimeout;
    let callback: (() => void) | undefined;
    let cancelled = 0;
    let count = 0;
    try {
      Object.defineProperty(view, 'requestIdleCallback', { configurable: true, value: undefined });
      view.setTimeout = handler => {
        if (typeof handler !== 'function') throw new Error('Expected a callback');
        callback = () => handler();
        return 53;
      };
      view.clearTimeout = handle => { cancelled = handle ?? 0; };
      const scheduler = createMapConstructionScheduler(host, () => { count += 1; });
      scheduler.connect('idle');
      scheduler.setReady(true);
      scheduler.reconfigure('eager');
      callback!();
      expect(cancelled).to.equal(53);
      expect(count).to.equal(1);
    } finally {
      if (requestDescriptor) Object.defineProperty(view, 'requestIdleCallback', requestDescriptor);
      else Reflect.deleteProperty(view, 'requestIdleCallback');
      view.setTimeout = originalTimer;
      view.clearTimeout = originalClear;
      frame.remove();
    }
  });


  it('preserves the newer idle handle when visibility cleanup reenters reconfigure', () => {
    let scheduler: MapConstructionScheduler;
    let idleCancelled = 0;
    let visibleRequests = 0;
    let constructions = 0;
    let idleAdmission: (() => void) | undefined;
    scheduler = new MapConstructionScheduler({
      connected: () => true,
      visible: () => {
        visibleRequests += 1;
        return () => scheduler.reconfigure('idle');
      },
      idle: admit => {
        idleAdmission = admit;
        return () => { idleCancelled += 1; };
      },
    }, () => { constructions += 1; });
    scheduler.connect();
    scheduler.setReady(true);
    scheduler.reconfigure('visible');
    expect(visibleRequests).to.equal(1);
    scheduler.disconnect();
    expect(idleCancelled).to.equal(1);
    idleAdmission!();
    expect(constructions).to.equal(0);
  });

  it('preserves a newer connection created during the old connection cleanup', () => {
    let scheduler: MapConstructionScheduler;
    let constructions = 0;
    let idleRequests = 0;
    scheduler = new MapConstructionScheduler({
      connected: () => true,
      visible: () => () => {
        scheduler.connect('eager');
        scheduler.setReady(true);
      },
      idle: () => { idleRequests += 1; return () => {}; },
    }, () => { constructions += 1; });
    scheduler.connect();
    scheduler.connect('idle');
    scheduler.setReady(true);
    expect(constructions).to.equal(1);
    expect(idleRequests).to.equal(0);
  });

  it('does not construct when the connection predicate disconnects before returning true', () => {
    let scheduler: MapConstructionScheduler;
    let constructions = 0;
    scheduler = new MapConstructionScheduler({
      connected: () => { scheduler.disconnect(); return true; },
      visible: () => () => {},
      idle: () => () => {},
    }, () => { constructions += 1; });
    scheduler.connect('eager');
    scheduler.setReady(true);
    expect(constructions).to.equal(0);
  });

  it('honors readiness revoked from the connection predicate', () => {
    let scheduler: MapConstructionScheduler;
    let constructions = 0;
    scheduler = new MapConstructionScheduler({
      connected: () => { scheduler.setReady(false); return true; },
      visible: () => () => {},
      idle: () => () => {},
    }, () => { constructions += 1; });
    scheduler.connect('eager');
    scheduler.setReady(true);
    expect(constructions).to.equal(0);
  });

  it('does not recursively evaluate a connection predicate that signals readiness', () => {
    let scheduler: MapConstructionScheduler;
    let constructions = 0;
    let checks = 0;
    scheduler = new MapConstructionScheduler({
      connected: () => { checks += 1; scheduler.setReady(true); return true; },
      visible: () => () => {},
      idle: () => () => {},
    }, () => { constructions += 1; });
    scheduler.connect('eager');
    scheduler.setReady(true);
    expect(checks).to.equal(1);
    expect(constructions).to.equal(1);
  });


  for (const action of ['reconfigure', 'reconnect'] as const) {
    it(`drains a newer eager admission after one-time connection predicate ${action}`, () => {
      let scheduler: MapConstructionScheduler;
      let checks = 0;
      let constructions = 0;
      scheduler = new MapConstructionScheduler({
        connected: () => {
          checks += 1;
          if (checks === 1) {
            if (action === 'reconfigure') scheduler.reconfigure('eager');
            else { scheduler.connect('eager'); scheduler.setReady(true); }
          }
          return true;
        },
        visible: () => () => {},
        idle: () => () => {},
      }, () => { constructions += 1; });
      scheduler.connect('eager');
      scheduler.setReady(true);
      expect(checks).to.equal(2);
      expect(constructions).to.equal(1);
    });
  }

  it('bounds predicate evaluation when every connection check changes admission', () => {
    let scheduler: MapConstructionScheduler;
    let checks = 0;
    let constructions = 0;
    scheduler = new MapConstructionScheduler({
      connected: () => { checks += 1; scheduler.reconfigure('eager'); return true; },
      visible: () => () => {},
      idle: () => () => {},
    }, () => { constructions += 1; });
    scheduler.connect('eager');
    scheduler.setReady(true);
    expect(checks).to.equal(2);
    expect(constructions).to.equal(0);
  });

});

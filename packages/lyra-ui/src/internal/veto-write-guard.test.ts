import { expect } from '@open-wc/testing';
import { markVetoGuardWrite, VetoWriteGuard } from './veto-write-guard.js';

describe('VetoWriteGuard', () => {
  it('is untouched immediately after construction, before any open()', () => {
    const guard = new VetoWriteGuard();
    expect(guard.touched).to.equal(false);
  });

  it('reports touched after a write, and resets on the next open()', () => {
    const guard = new VetoWriteGuard();
    guard.open();
    markVetoGuardWrite(guard);
    expect(guard.touched).to.equal(true);
    guard.open();
    expect(guard.touched).to.equal(false);
  });

  it('is untouched when no listener runs at all', () => {
    const guard = new VetoWriteGuard();
    guard.open();
    expect(guard.touched).to.equal(false);
  });

  it('is untouched when a listener vetoes the operation but writes nothing', () => {
    // Mirrors confirm-bar's own veto branch: a listener calls preventDefault() and does nothing
    // else. Reading a property is not a write.
    class Host {
      readonly guard = new VetoWriteGuard();
      decision: string | null = null;
    }
    const host = new Host();
    host.guard.open();
    const vetoListener = (): void => {
      void host.decision; // inspects state, writes nothing
    };
    vetoListener();
    expect(host.guard.touched).to.equal(false);
  });

  it('lets two properties share one guard, mirroring a decision/pending pair', () => {
    class TwoProps {
      readonly guard = new VetoWriteGuard();
      #a = 0;
      #b = 0;
      get a(): number { return this.#a; }
      set a(value: number) {
        this.#a = value;
        markVetoGuardWrite(this.guard);
      }
      get b(): number { return this.#b; }
      set b(value: number) {
        this.#b = value;
        markVetoGuardWrite(this.guard);
      }
    }
    const host = new TwoProps();

    host.guard.open();
    host.a = 1;
    expect(host.guard.touched).to.equal(true);

    host.guard.open();
    expect(host.guard.touched).to.equal(false);
    host.b = 2;
    expect(host.guard.touched).to.equal(true);
  });

  // The vacuous case a before/after value snapshot cannot see: a listener that calls
  // preventDefault() and then writes back the exact value the property already held (e.g.
  // re-affirming an in-flight state rather than clearing it). A value comparison reads
  // "unchanged"; the write-tracking guard must not.
  it('is touched even when a listener writes back the exact same value the field already held', () => {
    class Host {
      readonly guard = new VetoWriteGuard();
      #pending: string | null = null;
      get pending(): string | null { return this.#pending; }
      set pending(value: string | null) {
        this.#pending = value;
        markVetoGuardWrite(this.guard);
      }
    }
    const host = new Host();
    host.pending = 'approve'; // pre-existing value, set before the guard is even opened
    host.guard.open();
    host.pending = 'approve'; // a listener writes the SAME value back during dispatch
    expect(host.guard.touched).to.equal(true);
    expect(host.pending).to.equal('approve');
  });

  it('tracks several sequential decisions on the same instance independently', () => {
    const guard = new VetoWriteGuard();

    guard.open();
    markVetoGuardWrite(guard);
    expect(guard.touched).to.equal(true);

    guard.open();
    expect(guard.touched).to.equal(false);

    guard.open();
    markVetoGuardWrite(guard);
    expect(guard.touched).to.equal(true);
  });

  it('gives a reentrant decision, triggered from inside another decision, its own correct result, and lets the outer decision still see its own later write', () => {
    const guard = new VetoWriteGuard();
    const results: Array<{ label: string; touched: boolean }> = [];

    function decide(label: string, run: () => void): void {
      guard.open();
      run();
      results.push({ label, touched: guard.touched });
    }

    decide('outer', () => {
      // The outer listener itself triggers a second, fully nested decision before writing.
      decide('inner', () => {
        markVetoGuardWrite(guard);
      });
      // The outer decision's own write happens only after the nested one has completed.
      markVetoGuardWrite(guard);
    });

    expect(results.length).to.equal(2);
    expect(results[0]?.label).to.equal('inner');
    expect(results[0]?.touched).to.equal(true);
    expect(results[1]?.label).to.equal('outer');
    expect(results[1]?.touched).to.equal(true);
  });

  it('keeps independent guard instances from leaking state into each other', () => {
    // Relevant for a per-entry guard (one instance per list row rather than one shared per host):
    // opening or writing one entry's guard must never be visible on another entry's guard.
    const first = new VetoWriteGuard();
    const second = new VetoWriteGuard();

    first.open();
    second.open();
    markVetoGuardWrite(first);

    expect(first.touched).to.equal(true);
    expect(second.touched).to.equal(false);
  });
});

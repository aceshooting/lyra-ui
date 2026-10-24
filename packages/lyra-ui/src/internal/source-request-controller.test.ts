import { expect } from '@open-wc/testing';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { SourceRequestController, type SourceRequestLease } from './source-request-controller.js';

function makeHost() {
  const controllers = new Set<ReactiveController>();
  const host = Object.assign(document.createElement('div'), {
    addController: (controller: ReactiveController) => controllers.add(controller),
    removeController: (controller: ReactiveController) => controllers.delete(controller),
    requestUpdate: () => { throw new Error('Authority must not request a host refresh'); },
    updateComplete: Promise.resolve(true),
  }) satisfies HTMLElement & ReactiveControllerHost;
  document.body.append(host);
  return { host, disconnect: () => { host.remove(); controllers.forEach(c => c.hostDisconnected?.()); },
    connect: () => { document.body.append(host); controllers.forEach(c => c.hostConnected?.()); } };
}

describe('SourceRequestController', () => {
  it('preserves newer source authority established inside abort and reset callbacks', () => {
    for (const callback of ['abort', 'reset']) {
      const fixture = makeHost();
      let armed = false;
      const newest = {};
      const control = new SourceRequestController(fixture.host, { channels: ['page'], onReset: () => {
        if (callback === 'reset' && armed) { armed = false; control.setSource(newest, 'newest'); }
      } });
      control.setSource({}, 'initial');
      const initial = control.begin('page', 'en')!;
      initial.context.signal.addEventListener('abort', () => {
        if (callback === 'abort' && armed) { armed = false; control.setSource(newest, 'newest'); }
      });
      armed = true;
      control.setSource({}, 'outer');
      const current = control.begin('page', 'en')!;
      expect(current.context.revision).to.equal('newest');
      expect(current.isCurrent()).to.equal(true);
      fixture.disconnect();
    }
  });

  it('keeps a nested newer channel lease and aborts every superseded controller', () => {
    const fixture = makeHost();
    const control = new SourceRequestController(fixture.host, { channels: ['page'] });
    control.setSource({}, 1);
    const initial = control.begin('page', 'en')!;
    let nested: SourceRequestLease | undefined;
    initial.context.signal.addEventListener('abort', () => { nested = control.begin('page', 'fr'); });
    const outer = control.begin('page', 'de');
    expect(nested !== undefined).to.equal(true);
    expect(nested!.isCurrent()).to.equal(true);
    expect(outer === undefined || outer.context.signal.aborted).to.equal(true);
    expect(initial.context.signal.aborted).to.equal(true);
    fixture.disconnect();
    expect(nested!.context.signal.aborted).to.equal(true);
  });

  it('revokes page authority immediately without invalidating stable selection work', () => {
    const fixture = makeHost();
    let resets = 0;
    const control = new SourceRequestController(fixture.host, { channels: ['page', 'lookup'], onReset: () => resets++ });
    control.setSource({}, 1);
    const page = control.begin('page', 'en');
    const lookup = control.begin('lookup', 'en');
    expect(page !== undefined && lookup !== undefined).to.equal(true);
    const baseline = resets;
    control.invalidate('page');
    expect(page!.context.signal.aborted).to.equal(true);
    expect(page!.isCurrent()).to.equal(false);
    expect(lookup!.isCurrent()).to.equal(true);
    expect(resets).to.equal(baseline);
    const next = control.begin('page', 'en')!;
    expect(next.isCurrent()).to.equal(true);
    control.refresh();
    expect(next.isCurrent()).to.equal(false);
    expect(lookup!.context.signal.aborted).to.equal(true);
    expect(resets).to.equal(baseline + 1);
    fixture.disconnect();
  });

  it('invalidates source/revision changes and ignores late work that disregards abort', async () => {
    const fixture = makeHost();
    const control = new SourceRequestController(fixture.host, { channels: ['page'] });
    const source = {};
    expect(control.setSource(source, 'a')).to.equal(true);
    const first = control.begin('page', 'en')!;
    expect(control.setSource(source, 'a')).to.equal(false);
    expect(first.isCurrent()).to.equal(true);
    let release!: () => void;
    let committed = false;
    const pending = new Promise<void>(resolve => { release = resolve; }).then(() => { if (first.isCurrent()) committed = true; });
    control.setSource(source, 'b');
    release();
    await pending;
    expect(committed).to.equal(false);
    expect(first.context.signal.aborted).to.equal(true);
    const second = control.begin('page', 'en')!;
    control.setSource({}, 'b');
    expect(second.isCurrent()).to.equal(false);
    fixture.disconnect();
  });

  it('rejects disconnected and old-document leases through reconnect and adoption', () => {
    const fixture = makeHost();
    const control = new SourceRequestController(fixture.host, { channels: ['page'] });
    control.setSource({}, 0);
    const first = control.begin('page', 'en')!;
    fixture.disconnect();
    expect(first.isCurrent()).to.equal(false);
    expect(control.begin('page', 'en')).to.equal(undefined);
    fixture.connect();
    const second = control.begin('page', 'en')!;
    expect(second.isCurrent()).to.equal(true);
    const other = document.implementation.createHTMLDocument();
    other.body.append(other.adoptNode(fixture.host));
    expect(second.isCurrent()).to.equal(false);
    control.adopted();
    expect(second.context.signal.aborted).to.equal(true);
    fixture.disconnect();
  });

  it('bounds channel enrollment and rejects malformed revisions without retaining authority', () => {
    const fixture = makeHost();
    expect(() => new SourceRequestController(fixture.host, { channels: Array.from({ length: 17 }, (_, i) => String(i)) })).to.throw();
    const control = new SourceRequestController(fixture.host, { channels: ['page'] });
    control.setSource({}, 1);
    const lease = control.begin('page', 'en')!;
    expect(() => control.setSource({}, Number.NaN)).to.throw();
    expect(lease.isCurrent()).to.equal(false);
    expect(() => Reflect.apply(control.begin, control, ['unknown', 'en'])).to.throw();
    control.setSource(undefined, undefined);
    expect(control.begin('page', 'en')).to.equal(undefined);
    fixture.disconnect();
  });

  it('rejects empty, non-string and duplicate channel names at enrollment', () => {
    const fixture = makeHost();
    for (const channels of [[''], ['page', 'page'], [7 as unknown as string]]) {
      expect(() => new SourceRequestController(fixture.host, { channels }), JSON.stringify(channels)).to.throw(TypeError, 'Invalid source channel');
    }
    expect(() => new SourceRequestController(fixture.host, { channels: [] })).to.throw(RangeError, 'Invalid source channels');
    expect(new SourceRequestController(fixture.host, { channels: ['page', 'lookup'] }).epoch).to.equal(0);
    fixture.disconnect();
  });

  it('refuses a revision without a source and a source that is not an object, retaining no authority', () => {
    const fixture = makeHost();
    const control = new SourceRequestController(fixture.host, { channels: ['page'] });
    control.setSource({}, 1);
    const lease = control.begin('page', 'en')!;
    expect(() => control.setSource(undefined, 3)).to.throw(TypeError, 'Revision requires a source');
    expect(lease.isCurrent()).to.equal(false);
    expect(control.begin('page', 'en')).to.equal(undefined);

    control.setSource({}, 2);
    expect(() => control.setSource(5 as unknown as object, 1)).to.throw(TypeError, 'Invalid source');
    expect(control.begin('page', 'en')).to.equal(undefined);
    control.setSource({}, 3);
    expect(() => control.setSource(null as unknown as object, 1)).to.throw(TypeError, 'Invalid source');
    expect(control.begin('page', 'en')).to.equal(undefined);

    control.setSource(function provider() {} as unknown as object, 4);
    expect(control.begin('page', 'en')?.isCurrent(), 'a function is a valid source owner').to.equal(true);
    fixture.disconnect();
  });

  it('rejects an unknown channel on invalidate and begin', () => {
    const fixture = makeHost();
    const control = new SourceRequestController(fixture.host, { channels: ['page'] });
    control.setSource({}, 1);
    expect(() => control.invalidate('unknown' as 'page')).to.throw(TypeError, 'Unknown source channel');
    expect(() => control.begin('unknown' as 'page', 'en')).to.throw(TypeError, 'Unknown source channel');
    control.invalidate('page');
    expect(control.begin('page', 'en')?.isCurrent()).to.equal(true);
    fixture.disconnect();
  });

  it('aborts the previous lease when the host leaves the document without notifying the controller', () => {
    const fixture = makeHost();
    const control = new SourceRequestController(fixture.host, { channels: ['page'] });
    control.setSource({}, 1);
    const lease = control.begin('page', 'en')!;
    fixture.host.remove();
    expect(control.begin('page', 'en')).to.equal(undefined);
    expect(lease.context.signal.aborted).to.equal(true);
    expect(lease.isCurrent()).to.equal(false);
    fixture.connect();
    expect(control.begin('page', 'en')?.isCurrent()).to.equal(true);
    fixture.disconnect();
  });
});

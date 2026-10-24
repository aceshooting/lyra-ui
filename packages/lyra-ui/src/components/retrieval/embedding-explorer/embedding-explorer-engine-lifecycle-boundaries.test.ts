import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { EmbeddingEngineController, embeddingEngineEnvironment, embeddingPointsLoader } from './embedding-explorer-engine.js';
import { EmbeddingRows } from './embedding-explorer-data.js';
import type { Engine3dHost, Engine3dInstance } from '../../../internal/engine-3d-loader.js';
import type { Engine3dFallbackDetail } from '../../../internal/engine-3d.js';

describe('embedding engine public lifecycle boundaries', () => {
  const available = embeddingEngineEnvironment.available;
  let controller: EmbeddingEngineController | undefined;
  let host: HTMLDivElement & { requestUpdate(): void };
  let surface: HTMLDivElement;
  let callbacks: Engine3dHost | undefined;
  let disposed: number;
  let mounts: number;
  let styles: number;
  let foreground: unknown;
  let stateFailure: boolean;
  let resizeFailure: boolean;
  let styleFailure: boolean;
  let engine: Engine3dInstance;
  let fallbacks: Engine3dFallbackDetail[];
  let picks: number[];
  const rows = new EmbeddingRows(null, [{ id: 'first', x: 0, y: 0 }, { id: 'second', x: 1, y: 1 }]);

  beforeEach(async () => {
    disposed = mounts = styles = 0;
    stateFailure = resizeFailure = styleFailure = false;
    callbacks = undefined;
    foreground = undefined;
    fallbacks = []; picks = [];
    host = Object.assign(await fixture<HTMLDivElement>(html`<div style="width: 320px; height: 200px"><div style="width: 100%; height: 100%"></div></div>`), {
      requestUpdate() {},
    });
    surface = host.firstElementChild as HTMLDivElement;
    controller = new EmbeddingEngineController(host, () => {}, detail => fallbacks.push(detail), index => picks.push(index));
    engine = {
      contract: 1,
      async mount(_container, value) { mounts++; callbacks = value; },
      setData() {}, setCamera() {},
      setStyle(value) {
        styles++;
        foreground = value !== null && typeof value === 'object' ? Reflect.get(value, 'foreground') : undefined;
        if (styleFailure) throw new Error('Style rejected');
      },
      setState() { if (stateFailure) throw new Error('State rejected'); },
      resize() { if (resizeFailure) throw new Error('Resize rejected'); },
      dispose() { disposed++; },
    };
    embeddingEngineEnvironment.available = () => true;
    embeddingPointsLoader.override(async () => ({ createEngine: () => engine }));
  });

  afterEach(() => {
    controller?.disconnect();
    host.remove();
    embeddingEngineEnvironment.available = available;
    embeddingPointsLoader.override(undefined);
  });

  async function ready() {
    controller!.update('webgl', rows, false, surface, -1, -1);
    await waitUntil(() => controller!.ready);
    expect(mounts).to.equal(1);
  }

  it('releases an engine whose import completes after disconnect without mounting or accepting picks', async () => {
    let resolve: ((module: { createEngine(): Engine3dInstance }) => void) | undefined;
    embeddingPointsLoader.override(() => new Promise(complete => { resolve = complete; }));
    controller!.update('webgl', rows, false, surface, -1, -1);
    await waitUntil(() => resolve !== undefined);
    controller!.disconnect();
    resolve!({ createEngine: () => engine });
    await waitUntil(() => disposed > 0);
    expect(mounts).to.equal(0);
    expect(controller!.ready).to.equal(false);
    expect(controller!.loading).to.equal(false);
    expect(fallbacks).to.deep.equal([]);
    expect(picks).to.deep.equal([]);
  });

  it('contains a late mount rejection after disconnect without publishing a fallback for the retired renderer', async () => {
    let reject: ((reason: Error) => void) | undefined;
    let mountSettled: Promise<void> | undefined;
    engine.mount = async (_container, value) => {
      mounts++; callbacks = value;
      const pending = new Promise<void>((_resolve, fail) => { reject = fail; });
      mountSettled = pending.catch(() => {});
      await pending;
    };
    controller!.update('webgl', rows, false, surface, -1, -1);
    await waitUntil(() => reject !== undefined);
    controller!.disconnect();
    reject!(new Error('Retired mount rejected'));
    await mountSettled;
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    callbacks!.pick(0, { shift: false, ctrl: false, double: false });
    callbacks!.lost('error');
    expect(disposed).to.be.at.least(1);
    expect(controller!.ready).to.equal(false);
    expect(controller!.loading).to.equal(false);
    expect(fallbacks).to.deep.equal([]);
    expect(picks).to.deep.equal([]);
  });

  it('falls back once when restoring a lost context cannot restore selection state', async () => {
    await ready();
    callbacks!.lost('context-lost');
    expect(controller!.ready).to.equal(false);
    expect(disposed).to.equal(0);
    stateFailure = true;
    callbacks!.restored!();
    expect(fallbacks.map(detail => detail.reason)).to.deep.equal(['context-lost', 'error']);
    expect(controller!.notice?.reason).to.equal('error');
    expect(controller!.ready).to.equal(false);
    expect(disposed).to.equal(1);
    callbacks!.restored!(); callbacks!.lost('error');
    expect(fallbacks.length).to.equal(2);
  });

  it('contains a native resize failure and revokes subsequent engine interaction callbacks', async () => {
    await ready();
    resizeFailure = true;
    surface.style.width = '240px';
    await waitUntil(() => fallbacks.length === 1);
    expect(fallbacks[0]).to.deep.equal({ from: 'webgl', to: 'builtin', reason: 'error' });
    expect(disposed).to.equal(1);
    callbacks!.pick(1, { shift: false, ctrl: false, double: false });
    expect(picks).to.deep.equal([]);
    expect(controller!.ready).to.equal(false);
  });

  it('refreshes live styles after author changes and contains a failed style refresh', async () => {
    await ready();
    const initial = styles;
    host.style.setProperty('--lr-color-text', 'rgb(1, 2, 3)');
    await waitUntil(() => foreground === 'rgba(1, 2, 3, 1)');
    expect(styles).to.be.greaterThan(initial);
    expect(controller!.ready).to.equal(true);
    styleFailure = true;
    host.style.setProperty('--lr-color-text', 'rgb(4, 5, 6)');
    await waitUntil(() => fallbacks.length === 1);
    expect(controller!.notice?.reason).to.equal('error');
    expect(disposed).to.equal(1);
    expect(controller!.ready).to.equal(false);
  });

  it('ignores style notifications while a context is lost and restores the retained engine afterward', async () => {
    await ready();
    callbacks!.lost('context-lost');
    callbacks!.lost('context-lost');
    expect(fallbacks.map(detail => detail.reason)).to.deep.equal(['context-lost']);
    const initial = styles;
    host.style.color = 'rgb(7, 8, 9)';
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    expect(styles).to.equal(initial);
    expect(disposed).to.equal(0);
    callbacks!.restored!();
    expect(controller!.ready).to.equal(true);
    expect(controller!.notice).to.equal(null);
    callbacks!.pick(1, { shift: false, ctrl: false, double: false });
    expect(picks).to.deep.equal([1]);
    expect(fallbacks.map(detail => detail.reason)).to.deep.equal(['context-lost']);
  });

  it('cancels pending visibility admission and can admit the same rows after reconnect', async () => {
    host.hidden = true;
    controller!.update('webgl', rows, false, surface, -1, -1);
    controller!.update('webgl', rows, false, surface, -1, -1);
    controller!.disconnect();
    host.hidden = false;
    expect(mounts).to.equal(0);
    await ready();
    callbacks!.pick(0, { shift: false, ctrl: false, double: false });
    expect(picks).to.deep.equal([0]);
    expect(fallbacks).to.deep.equal([]);
  });
});

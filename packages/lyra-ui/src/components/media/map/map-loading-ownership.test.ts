import { expect, fixture, fixtureCleanup, html, waitUntil } from '@open-wc/testing';
import { ControlMapEngine } from '../../../../test/map-control-engine.js';
import { LYRA_MAP_EMPTY_STYLE, type LyraMap } from './map.js';

class BusyTestMap extends ControlMapEngine {
  static override initialReady = true;
}

describe('lr-map loading-state ownership', () => {
  const getContext = HTMLCanvasElement.prototype.getContext;

  beforeEach(() => {
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, id: string, ...rest: unknown[]) {
      return id === 'webgl2' ? {} : getContext.call(this, id as never, ...(rest as []));
    } as typeof getContext;
  });
  afterEach(() => {
    fixtureCleanup();
    HTMLCanvasElement.prototype.getContext = getContext;
  });

  it('preserves an authored false while loading and across reconnect until the attribute is removed', async () => {
    const wrapper = await fixture<HTMLElement>(html`<div style="width:320px;height:240px"></div>`);
    const element = document.createElement('lr-map') as LyraMap;
    element.engine = 'maplibre';
    element.initialization = 'eager';
    element.mapStyle = LYRA_MAP_EMPTY_STYLE;
    type Peer = { Map: typeof BusyTestMap };
    const pending: Array<(peer: Peer) => void> = [];
    (element as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary =
      () => new Promise<Peer>(resolve => { pending.push(resolve); });
    const hostBusy = () => element.getAttribute('aria-busy');
    const baseBusy = () => element.shadowRoot?.querySelector('[part="base"]')?.getAttribute('aria-busy');
    const finish = async (index: number) => {
      pending[index]!({ Map: BusyTestMap });
      await waitUntil(() => element.map !== undefined, 'the map engine did not finish loading');
      await element.updateComplete;
    };

    element.setAttribute('aria-busy', 'false');
    wrapper.append(element);
    await element.updateComplete;
    expect(hostBusy()).to.equal('false');
    expect(baseBusy()).to.equal('true');

    element.removeAttribute('aria-busy');
    await element.updateComplete;
    expect(hostBusy()).to.equal('true');
    expect(baseBusy()).to.equal('true');

    element.ariaBusy = 'true';
    await finish(0);
    expect(hostBusy()).to.equal('true');
    expect(baseBusy()).to.equal('false');

    element.ariaBusy = 'false';
    element.pickMode = true;
    await element.updateComplete;
    expect(hostBusy()).to.equal('false');
    expect(baseBusy()).to.equal('false');

    element.remove();
    wrapper.append(element);
    await element.updateComplete;
    expect(hostBusy()).to.equal('false');
    expect(baseBusy()).to.equal('true');

    element.removeAttribute('aria-busy');
    await element.updateComplete;
    expect(hostBusy()).to.equal('true');
    expect(baseBusy()).to.equal('true');

    await finish(1);
    expect(hostBusy()).to.equal('false');
    expect(baseBusy()).to.equal('false');
  });
});

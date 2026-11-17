import { expect, fixture, fixtureCleanup, html, waitUntil } from '@open-wc/testing';
import { twoFrames } from '../../../../test/frames.js';
import { installCameraPeerEnvironment } from '../../../../test/map-camera-peer.js';
import { ControlMapEngine } from '../../../../test/map-control-engine.js';
import { LYRA_MAP_EMPTY_STYLE, type LyraMap } from './map.js';

class ReadRetirementMap extends ControlMapEngine {
  beforeBounds?: () => void;
  getBounds() {
    this.beforeBounds?.();
    return { getWest: () => -10, getSouth: () => -20, getEast: () => 10, getNorth: () => 20 };
  }
}

type Report = { center: readonly number[]; zoom: number; bounds?: readonly (readonly number[])[] };

function reports(element: LyraMap, name: 'lr-map-move' | 'lr-map-view-change'): Report[] {
  const captured: Report[] = [];
  // Listen on the element: a retired dispatch would no longer bubble to its former parent.
  element.addEventListener(name, event => { captured.push((event as CustomEvent<Report>).detail); });
  return captured;
}

async function ready(element: LyraMap): Promise<ReadRetirementMap> {
  await waitUntil(() => element.map !== undefined, 'the current peer is constructed');
  const peer = element.map as unknown as ReadRetirementMap;
  peer.ready = true; peer.fire('load');
  await element.whenStyleReady(); await element.updateComplete; await twoFrames();
  return peer;
}

async function mount() {
  const wrapper = await fixture<HTMLDivElement>(html`<div style="width:320px;height:240px"></div>`);
  const element = document.createElement('lr-map') as LyraMap;
  element.style.cssText = 'width:100%;height:100%';
  element.engine = 'maplibre'; element.initialization = 'eager';
  element.mapStyle = LYRA_MAP_EMPTY_STYLE; element.controls = { attribution: false };
  element.center = [12, 34]; element.zoom = 5;
  (element as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = async () => ({ Map: ReadRetirementMap });
  wrapper.append(element);
  return { wrapper, element, peer: await ready(element) };
}

function settleUserCamera(peer: ReadRetirementMap): void {
  // No queued move: this reaches settled reflection independently of the frame-report path.
  peer.fire('moveend', { originalEvent: new MouseEvent('mouseup') });
}

describe('lr-map camera reporting after native read retirement', () => {
  let restore: () => void;
  beforeEach(() => {
    restore = installCameraPeerEnvironment();
    ReadRetirementMap.initialReady = false; ReadRetirementMap.prepare = undefined;
  });
  afterEach(() => { fixtureCleanup(); restore(); });

  for (const method of ['getCenter', 'getBounds'] as const) {
    it(`does not publish a queued move when ${method} retires the peer while returning valid data`, async () => {
      const { wrapper, element, peer } = await mount();
      const moves = reports(element, 'lr-map-move');
      peer.center = { lng: 23, lat: 45 }; peer.fire('move');
      await waitUntil(() => moves.length === 1, 'ordinary queued movement reports its camera');
      expect(moves[0]!.center).to.deep.equal([23, 45]);
      expect(moves[0]!.bounds).to.deep.equal([[-10, -20], [10, 20]]);
      moves.length = 0;
      let retired = false;
      const retire = () => {
        peer.beforeGetCenter = undefined; peer.beforeBounds = undefined;
        retired = true; element.remove();
      };
      if (method === 'getCenter') peer.beforeGetCenter = retire;
      else peer.beforeBounds = retire;
      peer.fire('move');
      await waitUntil(() => retired, 'the queued report reached the retiring native read');
      await twoFrames();
      expect(peer.removed).to.equal(true);
      expect(moves.length, 'successful native data cannot authorize a retired movement event').to.equal(0);

      wrapper.append(element);
      const replacement = await ready(element);
      expect(replacement === peer).to.equal(false);
      moves.length = 0;
      replacement.center = { lng: 31, lat: 42 }; replacement.fire('move');
      await waitUntil(() => moves.length === 1, 'a replacement peer can report movement');
      expect(moves[0]!.center).to.deep.equal([31, 42]);
    });
  }

  it('does not overwrite newly authored camera state when a settled camera getter retires its peer', async () => {
    const { wrapper, element, peer } = await mount();
    const views = reports(element, 'lr-map-view-change');
    peer.center = { lng: 23, lat: 45 }; peer.zoom = 6;
    settleUserCamera(peer);
    expect(views.length).to.equal(1);
    expect(element.center).to.deep.equal([23, 45]); expect(element.zoom).to.equal(6);
    await element.updateComplete; await twoFrames(); views.length = 0;
    let retired = false;
    peer.beforeGetCenter = () => {
      peer.beforeGetCenter = undefined;
      retired = true; element.remove();
      element.center = [70, 20]; element.zoom = 9;
    };
    settleUserCamera(peer);
    expect(retired, 'the settled camera read actually retired its peer').to.equal(true);
    expect(peer.removed).to.equal(true);
    expect(element.center, 'retired native coordinates cannot replace a newer authored camera').to.deep.equal([70, 20]);
    expect(element.zoom).to.equal(9);
    expect(views.length).to.equal(0);

    wrapper.append(element);
    const replacement = await ready(element);
    expect(replacement === peer).to.equal(false);
    expect(element.center).to.deep.equal([70, 20]); expect(element.zoom).to.equal(9);
    views.length = 0;
    replacement.center = { lng: 31, lat: 42 }; replacement.zoom = 7;
    settleUserCamera(replacement);
    expect(views.length).to.equal(1);
    expect(views[0]!.center).to.deep.equal([31, 42]);
    expect(element.center).to.deep.equal([31, 42]); expect(element.zoom).to.equal(7);
  });

  it('does not publish settled camera notification when its bounds read retires the peer', async () => {
    const { wrapper, element, peer } = await mount();
    const views = reports(element, 'lr-map-view-change');
    settleUserCamera(peer);
    expect(views.length).to.equal(1);
    expect(views[0]!.bounds).to.deep.equal([[-10, -20], [10, 20]]);
    views.length = 0;
    let retired = false;
    peer.beforeBounds = () => {
      peer.beforeBounds = undefined;
      retired = true; element.remove();
    };
    settleUserCamera(peer);
    expect(retired, 'the settled bounds read actually retired its peer').to.equal(true);
    expect(peer.removed).to.equal(true);
    expect(views.length, 'camera data collected before retirement cannot publish afterward').to.equal(0);

    wrapper.append(element);
    const replacement = await ready(element);
    expect(replacement === peer).to.equal(false);
    views.length = 0;
    replacement.center = { lng: 31, lat: 42 }; settleUserCamera(replacement);
    expect(views.length).to.equal(1);
    expect(views[0]!.center).to.deep.equal([31, 42]);
    expect(views[0]!.bounds).to.deep.equal([[-10, -20], [10, 20]]);
  });
});

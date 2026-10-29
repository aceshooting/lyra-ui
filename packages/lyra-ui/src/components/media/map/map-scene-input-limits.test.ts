import { expect } from '@open-wc/testing';
import { sceneArc, sceneMarker, sceneModel, scenePath, sceneSourceHarness } from '../../../../test/map-scene-admission-fixtures.js';
import { stageMapSceneAdmission } from './map-scene-admission.js';
import { mapSceneAdmissionErrorCode } from './map-scene-errors.js';
import { createMapScenePositionRegistry } from './map-scene-position-registry.js';

const MAX_POSITIONS = 65_536;
const MAX_LABEL = 16_384;
const MAX_COLOR = 1_024;
const MAX_SOURCE = 1_048_576;
const MAX_TEXT = 4_194_304;

function failure(operation: () => unknown, code: 'invalid' | 'limit'): unknown {
  let caught: unknown;
  try { operation(); } catch (error) { caught = error; }
  expect(caught).to.be.instanceOf(TypeError);
  expect(mapSceneAdmissionErrorCode(caught)).to.equal(code);
  return caught;
}

function routePositions(length: number) {
  return Array.from({ length }, (_, index) => ({ lngLat: [index / 100, 0] as [number, number] }));
}

function fullPositionScene(extra = 0) {
  const positions = routePositions(4096);
  return { objects: [
    sceneModel('asset'), sceneMarker('pin'), sceneArc('flight'),
    ...Array.from({ length: 15 }, (_, index) => ({ ...scenePath(`route-${index}`), positions })),
    { ...scenePath('last-route'), positions: positions.slice(0, 4092 + extra) },
  ] };
}

function urlOfLength(length: number, suffix: string) {
  const prefix = 'https://example.invalid/';
  return `${prefix}${'x'.repeat(length - prefix.length - suffix.length)}${suffix}`;
}

function exactTextScene() {
  const labelPrefix = 'l'.repeat(MAX_LABEL - 4);
  const markers = Array.from({ length: 255 }, (_, index) => ({ ...sceneMarker(`pin-${index}`),
    label: `${labelPrefix}${String(index).padStart(4, '0')}` }));
  const model = { ...sceneModel('asset'), label: `${labelPrefix}last`, color: 'red',
    source: { format: 'glb' as const, src: 'model.glb' } };
  const overhead = model.id.length + model.color.length + model.source.src.length +
    markers.reduce((sum, marker) => sum + marker.id.length, 0);
  markers[markers.length - 1]!.label = 'tail'.padEnd(MAX_LABEL - overhead, 'l');
  return { markers, model, objects: [model, ...markers] };
}

describe('map scene input limits', () => {
  it('admits the exact authored-position total across marker, model, path and arc inputs', () => {
    const h = sceneSourceHarness();
    try {
      const candidate = stageMapSceneAdmission(fullPositionScene(), { request: h.request(), sources: h.sources });
      const count = candidate.objects.reduce((total, object) => total +
        (object.kind === 'path' ? object.positions.length : object.kind === 'arc' ? 2 : 1), 0);
      expect(count).to.equal(MAX_POSITIONS);
      expect(candidate.objects.length).to.equal(19);
      expect(h.allocations).to.equal(1);
      candidate.dispose();
      expect(h.liveBytes).to.equal(0);
    } finally { h.sources.dispose(); }
  });

  it('rejects one excess authored position before nested position reflection or source allocation', () => {
    const h = sceneSourceHarness();
    try {
      const input = fullPositionScene(1);
      let nestedReads = 0;
      const nested = new Proxy({ lngLat: [0, 0] as [number, number] }, {
        getOwnPropertyDescriptor(target, key) { nestedReads++; return Reflect.getOwnPropertyDescriptor(target, key); },
        ownKeys(target) { nestedReads++; return Reflect.ownKeys(target); },
      });
      const pin = input.objects.find(object => object.kind === 'marker');
      if (!pin || pin.kind !== 'marker') throw new Error('Expected marker input');
      pin.position = nested;
      failure(() => stageMapSceneAdmission(input, { request: h.request(), sources: h.sources }), 'limit');
      expect(nestedReads).to.equal(0);
      expect(h.allocations).to.equal(0);
      expect(h.resolutions).to.equal(0);
    } finally { h.sources.dispose(); }
  });

  it('reports the whole-request position limit before inspecting a nested accessor', () => {
    const h = sceneSourceHarness();
    try {
      const input = fullPositionScene(1);
      let getterCalls = 0;
      const pin = input.objects.find(object => object.kind === 'marker');
      if (!pin || pin.kind !== 'marker') throw new Error('Expected marker input');
      Object.defineProperty(pin.position, 'lngLat', { get() { getterCalls++; return [0, 0]; } });
      failure(() => stageMapSceneAdmission(input, { request: h.request(), sources: h.sources }), 'limit');
      expect(getterCalls).to.equal(0);
      expect(h.allocations).to.equal(0);
    } finally { h.sources.dispose(); }
  });

  it('admits exact label and color lengths and rejects length excess before content validation', () => {
    const h = sceneSourceHarness();
    try {
      const label = 'l'.repeat(MAX_LABEL);
      const color = `${' '.repeat(MAX_COLOR - 3)}red`;
      const candidate = stageMapSceneAdmission({ objects: [{ ...sceneMarker(), label, color }] }, {
        request: h.request(), sources: h.sources,
      });
      expect(candidate.objects[0]!.label).to.equal(label);
      expect(candidate.objects[0]!.color).to.equal(color);
      candidate.dispose();
      const astralLabel = '😀'.repeat(MAX_LABEL / 2);
      const astral = stageMapSceneAdmission({ objects: [{ ...sceneMarker(), label: astralLabel }] }, {
        request: h.request(), sources: h.sources,
      });
      expect(astral.objects[0]!.label).to.equal(astralLabel);
      astral.dispose();
      for (const change of [{ label: `${label}x` }, { label: `${astralLabel}x` }, { label: ' '.repeat(MAX_LABEL + 1) },
        { color: `${color} ` }, { color: 'x'.repeat(MAX_COLOR + 1) }]) {
        failure(() => stageMapSceneAdmission({ objects: [{ ...sceneMarker(), ...change }] }, {
          request: h.request(), sources: h.sources,
        }), 'limit');
      }
      expect(h.allocations).to.equal(0);
    } finally { h.sources.dispose(); }
  });

  it('bounds raw source strings before resolution in both admission and the source owner', () => {
    const h = sceneSourceHarness();
    try {
      h.hooks.resolve = () => ({ url: 'https://example.invalid/model.glb', owner: h.owner });
      const source = { format: 'glb' as const, src: 'x'.repeat(MAX_SOURCE) };
      const candidate = stageMapSceneAdmission({ objects: [{ ...sceneModel(), source }] }, {
        request: h.request(), sources: h.sources,
      });
      expect(h.resolutions).to.equal(1);
      candidate.dispose();
      const oversized = { format: 'glb' as const, src: `${source.src}x` };
      failure(() => stageMapSceneAdmission({ objects: [{ ...sceneModel(), source: oversized }] }, {
        request: h.request(), sources: h.sources,
      }), 'limit');
      failure(() => h.sources.stage([oversized], h.request()), 'limit');
      expect(h.resolutions).to.equal(1);
      expect(h.allocations).to.equal(0);
    } finally { h.sources.dispose(); }
  });

  it('bounds owner-resolved source URLs independently of the raw source length', () => {
    const h = sceneSourceHarness();
    try {
      let url = urlOfLength(MAX_SOURCE, 'a');
      h.hooks.resolve = () => ({ url, owner: h.owner });
      const source = { format: 'glb' as const, src: 'model.glb' };
      const stage = h.sources.stage([source], h.request());
      const snapshot = h.sources.snapshot(stage.receipts[0]!);
      if (snapshot.kind !== 'url') throw new Error('Expected URL snapshot');
      expect(snapshot.request.url.length).to.equal(MAX_SOURCE);
      stage.dispose();
      url = urlOfLength(MAX_SOURCE + 1, 'b');
      failure(() => h.sources.stage([source], h.next()), 'limit');
      failure(() => stageMapSceneAdmission({ objects: [{ ...sceneModel(), source }] }, {
        request: h.next(), sources: h.sources,
      }), 'limit');
      expect(h.resolutions).to.equal(3);
      expect(h.allocations).to.equal(0);
    } finally { h.sources.dispose(); }
  });

  it('admits the exact aggregate variable-text budget including IDs, labels, color and source', () => {
    const h = sceneSourceHarness();
    try {
      h.hooks.resolve = () => ({ url: 'https://example.invalid/model.glb', owner: h.owner });
      const input = exactTextScene();
      const expected = input.objects.reduce((sum, object) => sum + object.id.length + object.label.length, 0) +
        input.model.color.length + input.model.source.src.length;
      expect(expected).to.equal(MAX_TEXT);
      const candidate = stageMapSceneAdmission({ objects: input.objects }, { request: h.request(), sources: h.sources });
      expect(candidate.objects.length).to.equal(256);
      expect(h.resolutions).to.equal(1);
      candidate.dispose();
    } finally { h.sources.dispose(); }
  });

  it('counts each variable-text channel at aggregate boundary plus one before source work', () => {
    for (const channel of ['id', 'label', 'color', 'src'] as const) {
      const h = sceneSourceHarness();
      try {
        const input = exactTextScene();
        if (channel === 'id') input.model.id += 'x';
        else if (channel === 'label') input.markers[input.markers.length - 1]!.label += 'x';
        else if (channel === 'color') input.model.color += ' ';
        else input.model.source.src += 'x';
        failure(() => stageMapSceneAdmission({ objects: input.objects }, {
          request: h.request(), sources: h.sources,
        }), 'limit');
        expect(h.resolutions).to.equal(0);
        expect(h.allocations).to.equal(0);
      } finally { h.sources.dispose(); }
    }
  });

  it('admits the exact deduplicated resolved-URL aggregate independently from authored text', () => {
    const h = sceneSourceHarness();
    try {
      const urls = Array.from({ length: 4 }, (_, index) => urlOfLength(MAX_SOURCE, String(index)));
      h.hooks.resolve = src => ({ url: urls[Number(src)]!, owner: h.owner });
      const sources = urls.map((_, index) => ({ format: 'glb' as const, src: String(index) }));
      const stage = h.sources.stage([...sources, sources[0]!], h.request());
      expect(stage.receipts.length).to.equal(4);
      expect(h.resolutions).to.equal(4);
      const total = stage.receipts.reduce((sum, receipt) => {
        const snapshot = h.sources.snapshot(receipt);
        if (snapshot.kind !== 'url') throw new Error('Expected URL snapshot');
        return sum + snapshot.request.url.length;
      }, 0);
      expect(total).to.equal(MAX_TEXT);
      stage.dispose();
      expect(h.allocations).to.equal(0);
    } finally { h.sources.dispose(); }
  });

  it('rejects resolved aggregate boundary plus one without publishing provisional associations', () => {
    const h = sceneSourceHarness();
    try {
      const short = 'https://example.invalid/short';
      const urls = [urlOfLength(MAX_SOURCE, 'a'), urlOfLength(MAX_SOURCE, 'b'), urlOfLength(MAX_SOURCE, 'c'),
        urlOfLength(MAX_SOURCE - short.length + 1, 'd'), short];
      expect(urls.reduce((sum, url) => sum + url.length, 0)).to.equal(MAX_TEXT + 1);
      h.hooks.resolve = src => ({ url: urls[Number(src)]!, owner: h.owner });
      const sources = urls.map((_, index) => ({ format: 'glb' as const, src: String(index) }));
      failure(() => h.sources.stage(sources, h.request()), 'limit');
      const afterRejected = h.resolutions;
      const fresh = h.sources.stage([sources[0]!], h.next());
      expect(h.resolutions).to.equal(afterRejected + 1);
      fresh.dispose();
      expect(h.allocations).to.equal(0);
    } finally { h.sources.dispose(); }
  });

  it('counts distinct source records separately even when their resolved URL strings are equal', () => {
    const h = sceneSourceHarness();
    try {
      const url = urlOfLength(MAX_SOURCE, 'same');
      h.hooks.resolve = () => ({ url, owner: h.owner });
      const sources = Array.from({ length: 5 }, (_, index) => ({ format: 'glb' as const, src: String(index) }));
      failure(() => h.sources.stage(sources, h.request()), 'limit');
      expect(h.allocations).to.equal(0);
    } finally { h.sources.dispose(); }
  });

  it('applies resolved totals per request while including retained source receipts in each request', () => {
    const h = sceneSourceHarness();
    const accepted: { release(): void }[] = [];
    try {
      const url = urlOfLength(MAX_SOURCE, 'resolved');
      h.hooks.resolve = () => ({ url, owner: h.owner });
      const firstSources = Array.from({ length: 4 }, (_, index) => ({ format: 'glb' as const, src: `old-${index}` }));
      const first = h.sources.stage(firstSources, h.request());
      accepted.push(...h.sources.publish(first));
      const secondSources = Array.from({ length: 4 }, (_, index) => ({ format: 'glb' as const, src: `new-${index}` }));
      const second = h.sources.stage(secondSources, h.next());
      expect(second.receipts.length).to.equal(4);
      second.dispose();
      const resolutions = h.resolutions;
      const reused = h.sources.stage([...firstSources, firstSources[0]!], h.next());
      expect(reused.receipts[0]).to.equal(first.receipts[0]);
      expect(h.resolutions).to.equal(resolutions);
      reused.dispose();
      failure(() => h.sources.stage([...firstSources, { format: 'glb', src: 'extra' }], h.next()), 'limit');
      expect(h.allocations).to.equal(0);
    } finally { accepted.forEach(lease => lease.release()); h.sources.dispose(); }
  });

  it('classifies object, model, per-path and encoded-reservation ceilings as limits', () => {
    const h = sceneSourceHarness(3);
    try {
      const source = { format: 'glb' as const, bytes: new Uint8Array([1]) };
      const inputs = [
        { objects: Array.from({ length: 2001 }, (_, index) => sceneMarker(String(index))) },
        { objects: Array.from({ length: 33 }, (_, index) => sceneModel(String(index), source)) },
        { objects: [{ ...scenePath(), positions: routePositions(4097) }] },
      ];
      for (const input of inputs) failure(() => stageMapSceneAdmission(input, {
        request: h.request(), sources: h.sources,
      }), 'limit');
      failure(() => h.sources.stage([{ format: 'glb', bytes: new Uint8Array(4) }], h.request()), 'limit');
      expect(h.allocations).to.equal(0);
    } finally { h.sources.dispose(); }
  });

  it('preserves accepted facts, snapshot identity and retained source reuse after a limit rejection', () => {
    const h = sceneSourceHarness();
    const registry = createMapScenePositionRegistry({ connection: h.connection, sources: h.sources, isCurrent: h.isCurrent });
    try {
      const source = { format: 'glb' as const, bytes: new Uint8Array([1, 2]) };
      const first = stageMapSceneAdmission({ objects: [sceneModel('target', source)] }, {
        request: h.request(), sources: h.sources,
      });
      registry.commit(first);
      const before = registry.capture();
      let notices = 0;
      registry.subscribe(() => { notices++; });
      failure(() => stageMapSceneAdmission({ objects: [sceneModel('new'), {
        ...sceneMarker('invalid'), label: 'x'.repeat(MAX_LABEL + 1),
      }] }, { request: h.next(), sources: h.sources }), 'limit');
      expect(registry.capture()).to.equal(before);
      expect(h.allocations).to.equal(1);
      expect(h.liveBytes).to.equal(2);
      expect(notices).to.equal(0);
      const reused = stageMapSceneAdmission({ objects: [sceneModel('target', source)] }, {
        request: h.next(), sources: h.sources,
      });
      expect(reused.sourceStage.receipts[0]).to.equal(first.sourceStage.receipts[0]);
      registry.commit(reused);
      expect(h.allocations).to.equal(1);
      expect(notices).to.equal(0);
    } finally { registry.dispose(); h.sources.dispose(); }
  });

  it('classifies changed retained source metadata as invalid without resolving or replacing its snapshot', () => {
    const h = sceneSourceHarness();
    const accepted: { release(): void }[] = [];
    try {
      const source = { format: 'glb' as const, src: 'first.glb' };
      const first = h.sources.stage([source], h.request());
      accepted.push(...h.sources.publish(first));
      const original = h.sources.snapshot(first.receipts[0]!);
      source.src = 'changed.glb';
      failure(() => h.sources.stage([source], h.next()), 'invalid');
      expect(h.resolutions).to.equal(1);
      expect(h.sources.snapshot(first.receipts[0]!)).to.equal(original);
    } finally { accepted.forEach(lease => lease.release()); h.sources.dispose(); }
  });

  it('classifies only branded sanitized TypeErrors and hides caller callback messages', () => {
    const h = sceneSourceHarness();
    try {
      for (const error of [undefined, null, {}, new Error('limit'), new TypeError('Invalid map scene descriptor'),
        Object.assign(new TypeError('limit'), { code: 'limit' }), { name: 'TypeError', code: 'invalid' }]) {
        expect(mapSceneAdmissionErrorCode(error)).to.equal(undefined);
      }
      failure(() => stageMapSceneAdmission({ objects: [{ ...sceneMarker(), opacity: NaN }] }, {
        request: h.request(), sources: h.sources,
      }), 'invalid');
      const secret = 'CALLER_CALLBACK_DETAIL_729';
      h.hooks.resolve = () => { throw new Error(secret); };
      const error = failure(() => h.sources.stage([{ format: 'glb', src: 'model.glb' }], h.request()), 'invalid');
      if (!(error instanceof TypeError)) throw new Error('Expected sanitized TypeError');
      expect(error.message.includes(secret)).to.equal(false);
      expect(error.message.includes('model.glb')).to.equal(false);
      h.hooks.reserve = () => { throw new Error(secret); };
      const reservationError = failure(() => h.sources.stage([{ format: 'glb', bytes: new Uint8Array([1]) }], h.next()), 'invalid');
      if (!(reservationError instanceof TypeError)) throw new Error('Expected sanitized TypeError');
      expect(reservationError.message.includes(secret)).to.equal(false);
    } finally { h.sources.dispose(); }
  });
});

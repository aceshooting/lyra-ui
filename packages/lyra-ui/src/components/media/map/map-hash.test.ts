import { expect } from '@open-wc/testing';
import { admitMapHashOption, chooseMapInitialView, normalizeMapInitialBounds, readMapHash, removeMapHash, replaceMapHash } from './map-hash.js';
import { MAP_HASH_UNNAMED } from './map-hash-option.js';

const camera = { zoom: 5, center: [12, 34] as const, bearing: 20, pitch: 30 };
describe('map named hash ownership', () => {
  it('defaults to disabled and never writes for disabled options even with malformed fragments', () => {
    for (const option of [undefined, null, false]) {
      expect(admitMapHashOption(option).status).to.equal('disabled');
      expect(readMapHash('#map=%xx', option).status).to.equal('disabled');
      expect(replaceMapHash('#map=%xx', option, camera)).to.deep.equal({ status: 'disabled', fragment: '#map=%xx' });
      expect(removeMapHash('#map=%xx', option)).to.deep.equal({ status: 'disabled', fragment: '#map=%xx' });
    }
    expect(admitMapHashOption(true)).to.deep.equal({ status: 'enabled', key: 'map' });
    for (const option of ['', 'a&b', '1map', 'x'.repeat(65), 1, {}, 'map=other']) expect(admitMapHashOption(option).status).to.equal('invalid');
  });

  it('reads finite camera grammar with longitude/latitude order and immutable snapshots', () => {
    expect(readMapHash('#anchor&map=5/34/12/20/30', true)).to.deep.equal({ status: 'camera', camera });
    expect(readMapHash('#map=0/-90/-180', true)).to.deep.equal({ status: 'camera', camera: { zoom: 0, center: [-180, -90], bearing: 0, pitch: 0 } });
    expect(readMapHash('#map=24/90/180/-360/85', true).status).to.equal('camera');
    const parsed = readMapHash('#map=5%2F34%2F12%2F20%2F30', true); expect(parsed.status).to.equal('camera');
    if (parsed.status === 'camera') { expect(Object.isFrozen(parsed.camera)).to.equal(true); expect(Object.isFrozen(parsed.camera.center)).to.equal(true); }
    expect(readMapHash('#5/34/12', true).status).to.equal('none');
  });

  it('preserves opaque anchors, unrelated fields, token order and original encoding', () => {
    const original = '#chapter%20two&raw=%2f%2F&map=1/2/3&empty=&opaque%xx&&last';
    expect(replaceMapHash(original, true, camera)).to.deep.equal({ status: 'written', fragment: '#chapter%20two&raw=%2f%2F&map=5/34/12/20/30&empty=&opaque%xx&&last' });
    expect(removeMapHash(original, true)).to.deep.equal({ status: 'written', fragment: '#chapter%20two&raw=%2f%2F&empty=&opaque%xx&&last' });
    expect(replaceMapHash('#opaque&', 'detail', camera).fragment).to.equal('#opaque&&detail=5/34/12/20/30');
    expect(removeMapHash('#opaque', true).fragment).to.equal('#opaque'); expect(removeMapHash('#', true).fragment).to.equal('#');
  });

  it('preserves matching opaque document anchors that are not named fields', () => {
    for (const key of ['map', 'detail']) {
      const fragment = `#${key}`;
      expect(readMapHash(fragment, key).status).to.equal('none');
      expect(removeMapHash(fragment, key).fragment).to.equal(fragment);
      expect(replaceMapHash(fragment, key, camera).fragment).to.equal(`${fragment}&${key}=5/34/12/20/30`);
    }
    expect(readMapHash('#map&map=5/34/12', true).status).to.equal('camera');
    expect(removeMapHash('#map&map=5/34/12', true).fragment).to.equal('#map');
  });

  it('owns only the configured decoded key and allows explicit remove then key replacement', () => {
    const original = '#map=1/2/3&detail=4/5/6&anchor';
    expect(readMapHash(original, 'detail')).to.deep.equal({ status: 'camera', camera: { zoom: 4, center: [6, 5], bearing: 0, pitch: 0 } });
    expect(readMapHash('#m%61p=5/34/12', true).status).to.equal('camera');
    const removed = removeMapHash(original, true); expect(removed.fragment).to.equal('#detail=4/5/6&anchor');
    expect(replaceMapHash(removed.fragment, 'detail', camera).fragment).to.equal('#detail=5/34/12/20/30&anchor');
    expect(readMapHash('#other=5/34/12', true).status).to.equal('none');
  });

  it('rejects duplicate owned tokens and malformed values without rewriting the URL', () => {
    for (const fragment of ['#map=1/2/3&m%61p=4/5/6', '#map=%xx', '#map=1/2', '#map=1//2', '#map=1/2/3/4/5/6',
      '#map=25/0/0', '#map=-1/0/0', '#map=1/91/0', '#map=1/0/181', '#map=1/0/0/361', '#map=1/0/0/0/86',
      '#map=NaN/0/0', '#map=Infinity/0/0', '#map=1e1/0/0', '#map=0x10/0/0', '#map=1/%200/0', '#map=1/--0/0']) {
      expect(readMapHash(fragment, true).status).to.equal('invalid');
      expect(replaceMapHash(fragment, true, camera)).to.deep.equal({ status: 'invalid', fragment });
    }
    expect(removeMapHash('#map=bad&map=%xx&anchor', true).fragment).to.equal('#anchor');
    expect(readMapHash('#unrelated=%xx&map=1/2/3', true).status).to.equal('camera');
  });

  it('writes small finite decimals in the readable grammar and round-trips without exponent notation', () => {
    const tiny = { zoom: 1e-7, center: [5e-12, -1e-10] as const, bearing: 0, pitch: 1e-9 };
    const output = replaceMapHash('', true, tiny); expect(output.status).to.equal('written');
    expect(output.fragment).not.to.include('e-'); expect(readMapHash(output.fragment, true)).to.deep.equal({ status: 'camera', camera: tiny });
  });

  it('reparses independent back and forward URL snapshots without retaining camera state', () => {
    const history = ['#anchor&map=1/2/3', '#anchor&map=4/5/6', '#anchor&map=1/2/3'];
    const values = history.map((fragment) => readMapHash(fragment, true));
    expect(values.map((value) => value.status === 'camera' ? value.camera.zoom : -1)).to.deep.equal([1, 4, 1]);
  });

  it('bounds fragments/tokens and rejects unsafe authored cameras without invoking getters', () => {
    expect(readMapHash(`#${'x'.repeat(65537)}`, true).status).to.equal('invalid');
    expect(readMapHash(`#${Array(1025).fill('x').join('&')}`, true).status).to.equal('invalid');
    let reads = 0; const unsafe = { zoom: 5, get center() { reads++; return [12, 34]; } };
    expect(replaceMapHash('#anchor', true, unsafe).status).to.equal('invalid'); expect(reads).to.equal(0);
    const proxy = new Proxy(camera, { getOwnPropertyDescriptor() { throw new Error('trap'); } });
    expect(replaceMapHash('#anchor', true, proxy).status).to.equal('invalid');
    expect(replaceMapHash('#anchor', true, { ...camera, pitch: 86 }).status).to.equal('invalid');
    expect(replaceMapHash('#anchor', true, { ...camera, center: Array(2) }).status).to.equal('invalid');
  });
});

describe('map unnamed engine hash compatibility', () => {
  const unnamed = MAP_HASH_UNNAMED;
  it('reads the leading bare token in the engine grammar, and only that token', () => {
    expect(admitMapHashOption(unnamed)).to.deep.equal({ status: 'enabled', key: '' });
    expect(readMapHash('#5/34/12/20/30', unnamed)).to.deep.equal({ status: 'camera', camera });
    expect(readMapHash('#5/34/12&layer=solar', unnamed)).to.deep.equal({ status: 'camera', camera: { ...camera, bearing: 0, pitch: 0 } });
    expect(readMapHash('5%2F34%2F12', unnamed).status).to.equal('camera');
    for (const fragment of ['', '#', '#layer=solar', '#&5/34/12', '#map=5/34/12']) expect(readMapHash(fragment, unnamed).status, fragment).to.equal('none');
    for (const fragment of ['#section', '#5/34', '#5/34/12/1/2/3', '#5/91/12', '#a/b/c', '#%xx']) expect(readMapHash(fragment, unnamed).status, fragment).to.equal('invalid');
    // A named owner never reads the unnamed token, and the reverse.
    expect(readMapHash('#5/34/12', true).status).to.equal('none');
  });

  it('writes the leading token, preserving named fields, and never overwrites an unrelated anchor', () => {
    expect(replaceMapHash('', unnamed, camera)).to.deep.equal({ status: 'written', fragment: '#5/34/12/20/30' });
    expect(replaceMapHash('#1/2/3&layer=solar', unnamed, camera).fragment).to.equal('#5/34/12/20/30&layer=solar');
    expect(replaceMapHash('#layer=solar&map=1/2/3', unnamed, camera).fragment).to.equal('#5/34/12/20/30&layer=solar&map=1/2/3');
    expect(replaceMapHash('#&layer=solar', unnamed, camera).fragment).to.equal('#5/34/12/20/30&layer=solar');
    for (const fragment of ['#section', '#section&layer=solar', '#5/34']) expect(replaceMapHash(fragment, unnamed, camera)).to.deep.equal({ status: 'invalid', fragment });
    expect(removeMapHash('#1/2/3&layer=solar', unnamed).fragment).to.equal('#layer=solar');
  });

  it('lets a valid unnamed camera beat the initial fit, and nothing else', () => {
    const bounds = [[0, 0], [10, 10]];
    expect(chooseMapInitialView({ fragment: '#3/4/5', hash: unnamed, bounds }).kind).to.equal('hash');
    for (const fragment of ['#section', '#layer=solar', '#3/4', '']) expect(chooseMapInitialView({ fragment, hash: unnamed, bounds }).kind, fragment).to.equal('bounds');
  });
});

describe('map initial view precedence', () => {
  it('normalizes wrapped and unwrapped antimeridian bounds without mutating caller arrays', () => {
    const input = [[170, -10], [-170, 10]]; const box = normalizeMapInitialBounds(input);
    expect(box).to.deep.equal([[170, -10], [190, 10]]); expect(input[1]![0]).to.equal(-170);
    expect(Object.isFrozen(box)).to.equal(true); expect(Object.isFrozen(box![0])).to.equal(true);
    expect(normalizeMapInitialBounds([[170, -10], [190, 10]])).to.deep.equal(box);
    expect(normalizeMapInitialBounds([[-180, -90], [180, 90]])).to.deep.equal([[-180, -90], [180, 90]]);
    for (const bad of [[[181, 0], [190, 1]], [[0, 1], [1, 0]], [[0, -91], [1, 2]], [[0, 0], [361, 1]], [[0, 0], [NaN, 1]], Array(2)]) expect(normalizeMapInitialBounds(bad)).to.equal(undefined);
  });

  it('chooses valid owned hash, then initial bounds, then authored camera', () => {
    const bounds = [[170, -10], [-170, 10]];
    expect(chooseMapInitialView({ fragment: '#map=3/4/5', hash: true, bounds, camera })).to.deep.equal({ kind: 'hash', camera: { zoom: 3, center: [5, 4], bearing: 0, pitch: 0 } });
    for (const fragment of ['#map=bad', '#map=1/2/3&map=4/5/6', '#anchor']) expect(chooseMapInitialView({ fragment, hash: true, bounds, camera })).to.deep.equal({ kind: 'bounds', bounds: [[170, -10], [190, 10]] });
    expect(chooseMapInitialView({ fragment: '#map=3/4/5', hash: false, camera })).to.deep.equal({ kind: 'camera', camera });
    expect(chooseMapInitialView({ bounds: 'invalid', camera })).to.deep.equal({ kind: 'camera', camera });
    expect(chooseMapInitialView({ camera: { zoom: Infinity, center: [0, 0] } })).to.deep.equal({ kind: 'none' });
  });

  it('rejects getter/proxy choice and bounds input without invoking accessors', () => {
    let reads = 0;
    const input = { hash: true, get fragment() { reads++; return '#map=1/2/3'; }, camera };
    expect(chooseMapInitialView(input).kind).to.equal('invalid'); expect(reads).to.equal(0);
    const bounds = [Object.defineProperty([0, 0], '0', { get() { reads++; return 0; } }), [1, 1]];
    expect(normalizeMapInitialBounds(bounds)).to.equal(undefined); expect(reads).to.equal(0);
    expect(chooseMapInitialView(new Proxy({}, { ownKeys() { throw new Error('trap'); } })).kind).to.equal('invalid');
    expect(chooseMapInitialView(Object.create({ camera })).kind).to.equal('invalid');
  });
});

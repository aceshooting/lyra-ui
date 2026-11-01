import { expect } from '@open-wc/testing';
import { normalizeMapControlOptions, mapGeolocationErrorCode } from './map-control-options.js';

describe('map control option projection', () => {
  it('keeps unset and disabled controls absent, with legacy navigation and scale defaults', () => {
    for (const input of [undefined, null, false, {}, { navigation: false, scale: false, geolocate: false, attribution: false }]) expect(normalizeMapControlOptions(input).controls.size).to.equal(0);
    const { controls } = normalizeMapControlOptions({ navigation: true, scale: true });
    expect(controls.get('navigation')).to.deep.equal({ kind: 'navigation', position: 'top-right', order: 0, unit: undefined, options: {}, key: 'top-right:0:' });
    expect(controls.get('scale')).to.deep.equal({ kind: 'scale', position: 'bottom-left', order: 0, unit: 'metric', options: { unit: 'metric' }, key: 'bottom-left:0:metric' });
  });
  it('preserves legacy position/unit fallback and does not call option getters', () => {
    let reads = 0;
    const options = Object.defineProperty({ unit: 'unknown' }, 'position', { get() { reads++; return 'top-left'; } });
    const { controls } = normalizeMapControlOptions({ navigation: { position: 'bottom-right' }, scale: options });
    expect(controls.get('navigation')!.position).to.equal('bottom-right'); expect(controls.get('scale')!.key).to.equal('bottom-left:0:metric'); expect(reads).to.equal(0);
    expect(normalizeMapControlOptions({ scale: { unit: 'imperial', position: 'top-left' } }).controls.get('scale')!.unit).to.equal('imperial');
  });
  it('admits geolocate as inert constructor data with bounded explicit options', () => {
    const first = normalizeMapControlOptions({ geolocate: true }).controls.get('geolocate')!;
    expect(first.options).to.deep.equal({ trackUserLocation: false, showUserLocation: true, showAccuracyCircle: true, positionOptions: { enableHighAccuracy: false, timeout: 6000, maximumAge: 0 }, fitBoundsOptions: { maxZoom: 15 } });
    const input = { geolocate: { trackUserLocation: true, positionOptions: { timeout: 0, maximumAge: 123, enableHighAccuracy: true }, fitBoundsOptions: { maxZoom: 17 }, showUserLocation: false, zoomToUserAccuracy: false } };
    const entry = normalizeMapControlOptions(input).controls.get('geolocate')!;
    input.geolocate.positionOptions.timeout = 999;
    expect(entry.options['positionOptions']).to.deep.equal({ enableHighAccuracy: true, timeout: 0, maximumAge: 123 });
    expect(entry.options['showAccuracyCircle']).to.equal(false); expect(Object.isFrozen(entry.options['positionOptions'])).to.equal(true);
    expect(Object.keys(entry.options)).not.to.include('trigger');
  });
  it('rejects invalid new-control values without affecting valid legacy controls', () => {
    for (const geolocate of [{ trackUserLocation: 'yes' }, { positionOptions: { timeout: Infinity } }, { positionOptions: { maximumAge: -1 } }, { fitBoundsOptions: { maxZoom: 25 } }, { position: 'invalid' }]) {
      const result = normalizeMapControlOptions({ navigation: true, geolocate });
      expect(result.controls.has('navigation')).to.equal(true); expect(result.controls.has('geolocate')).to.equal(false); expect(result.diagnostics[0]?.kind).to.equal('geolocate');
    }
  });
  it('escapes bounded plain attribution text and preserves automatic compact mode', () => {
    const plain = normalizeMapControlOptions({ attribution: true }).controls.get('attribution')!;
    expect(Object.hasOwn(plain.options, 'compact')).to.equal(false);
    const input = ['<img src=x onerror=alert(1)>', 'A & B'];
    const entry = normalizeMapControlOptions({ attribution: { customAttribution: input, compact: false } }).controls.get('attribution')!;
    input[0] = 'changed'; expect(entry.options['customAttribution']).to.deep.equal(['&lt;img src=x onerror=alert(1)&gt;', 'A &amp; B']); expect(entry.options['compact']).to.equal(false);
    expect(normalizeMapControlOptions({ attribution: { customAttribution: Array(33).fill('x') } }).controls.size).to.equal(0);
    expect(normalizeMapControlOptions({ attribution: { customAttribution: 'x'.repeat(4097) } }).controls.size).to.equal(0);
  });
  it('does not forward inherited, accessor-backed or executable new options', () => {
    let reads = 0; const getter = Object.defineProperty({}, 'trackUserLocation', { enumerable: true, get() { reads++; return true; } });
    expect(normalizeMapControlOptions({ geolocate: getter }).controls.size).to.equal(0);
    expect(normalizeMapControlOptions({ geolocate: Object.create({ trackUserLocation: true }) }).controls.size).to.equal(0);
    const entry = normalizeMapControlOptions({ geolocate: { unknown: () => true } }).controls.get('geolocate')!;
    expect(Object.keys(entry.options)).not.to.include('unknown'); expect(reads).to.equal(0);
  });
  it('makes configuration identity stable across property order and sensitive to changes', () => {
    const a = normalizeMapControlOptions({ geolocate: { trackUserLocation: true, position: 'bottom-left' } }).controls.get('geolocate')!;
    const b = normalizeMapControlOptions({ geolocate: { position: 'bottom-left', trackUserLocation: true } }).controls.get('geolocate')!;
    const c = normalizeMapControlOptions({ geolocate: { position: 'bottom-left', trackUserLocation: false } }).controls.get('geolocate')!;
    expect(a.key).to.equal(b.key); expect(a.key).not.to.equal(c.key);
  });
  it('maps geolocation errors to stable codes without reading arbitrary error objects', () => {
    expect([1, 2, 3, 0, Infinity].map(mapGeolocationErrorCode)).to.deep.equal(['permission-denied', 'position-unavailable', 'timeout', 'unknown', 'unknown']);
    let reads = 0; expect(mapGeolocationErrorCode({ get code() { reads++; return 1; } })).to.equal('unknown'); expect(reads).to.equal(0);
  });
  it('snapshots guarded linked credits and exports only escaped labels', () => {
    const link = { label: '<img src=x> & "credits"', url: 'HTTPS://EXAMPLE.COM:443/credits?a=1&b=2' };
    const entry = normalizeMapControlOptions({ attribution: { customAttribution: [link, 'Text'] } }).controls.get('attribution')!;
    link.label = 'changed'; link.url = 'javascript:alert(1)';
    const target = document.createElement('template');
    target.innerHTML = (entry.options['customAttribution'] as readonly string[]).join(' | ');
    const anchor = target.content.querySelector('a')!;
    expect(anchor.textContent).to.equal('<img src=x> & "credits"');
    expect(anchor.href).to.equal('https://example.com/credits?a=1&b=2');
    expect(anchor.target).to.equal('_blank'); expect(anchor.rel).to.equal('noopener noreferrer');
    expect(target.content.querySelectorAll('img').length).to.equal(0);
    expect(entry.attributionText).to.deep.equal(['&lt;img src=x&gt; &amp; &quot;credits&quot;', 'Text']);
    expect(Object.isFrozen(entry.attributionText)).to.equal(true);
    expect(Object.isFrozen(entry.options['customAttribution'])).to.equal(true);
  });
  it('rejects one invalid linked item atomically and never invokes label or URL accessors', () => {
    let reads = 0;
    const getter = Object.defineProperty({ label: 'Credits' }, 'url', { get() { reads++; return 'https://example.com'; } });
    const revoked = Proxy.revocable({}, {}); revoked.revoke();
    const invalid = [getter, revoked.proxy, Object.create({ label: 'Credits', url: 'https://example.com' }),
      { label: 'x'.repeat(4097), url: 'https://example.com' },
      ...['javascript:alert(1)', 'data:text/plain,x', 'blob:https://example.com/x', 'file:///x', '/credits',
        'https://user:password@example.com', 'https://example.com/\ncredits', 'https://example.com/' + 'x'.repeat(2048)]
        .map(url => ({ label: 'Credits', url }))];
    for (const value of invalid) {
      const result = normalizeMapControlOptions({ navigation: true, attribution: { customAttribution: ['Valid', value] } });
      expect(result.controls.has('attribution')).to.equal(false); expect(result.controls.has('navigation')).to.equal(true);
      expect(result.diagnostics).to.deep.equal([{ kind: 'attribution', code: 'invalid-options' }]);
    }
    expect(reads).to.equal(0);
    expect(normalizeMapControlOptions({ attribution: { customAttribution: Array(5).fill({ label: 'x'.repeat(4000), url: 'https://example.com' }) } }).controls.size).to.equal(0);
    expect(normalizeMapControlOptions({ attribution: { customAttribution: new Array(2) } }).controls.size).to.equal(0);
  });
  it('snapshots initial attribution expansion separately from native constructor options', () => {
    for (const initialExpanded of [true, false]) {
      const input = { initialExpanded, compact: true };
      const result = normalizeMapControlOptions({ attribution: input });
      input.initialExpanded = !initialExpanded;
      const entry = result.controls.get('attribution')!;
      expect(Reflect.get(entry, 'initialExpanded')).to.equal(initialExpanded);
      expect(entry.options).to.deep.equal({ compact: true });
      expect(Object.isFrozen(entry)).to.equal(true);
    }
    expect(Reflect.get(normalizeMapControlOptions({ attribution: true }).controls.get('attribution')!, 'initialExpanded')).to.equal(undefined);
    const keys = [undefined, true, false].map(initialExpanded => normalizeMapControlOptions({ attribution: { compact: true,
      ...(initialExpanded === undefined ? {} : { initialExpanded }) } }).controls.get('attribution')!.key);
    expect(new Set(keys).size, 'a changed seed is a non-position configuration change').to.equal(3);
  });
  it('rejects malformed initial attribution expansion without invoking accessors', () => {
    let reads = 0;
    for (const initialExpanded of [null, 0, 1, 'false', {}, []]) {
      const result = normalizeMapControlOptions({ attribution: { initialExpanded } });
      expect(result.controls.has('attribution')).to.equal(false);
      expect(result.diagnostics).to.deep.equal([{ kind: 'attribution', code: 'invalid-options' }]);
    }
    const result = normalizeMapControlOptions({ attribution: { get initialExpanded() { reads++; return false; } } });
    expect(result.controls.has('attribution')).to.equal(false);
    expect(reads).to.equal(0);
  });
  it('skips a navigation or scale value that is neither enabled nor a record and flags malformed new-control members', () => {
    const { controls, diagnostics } = normalizeMapControlOptions({ navigation: 'yes', scale: 1, geolocate: { zoomToUserAccuracy: 'yes' }, attribution: { compact: 'yes' } });
    expect(controls.size).to.equal(0);
    expect(diagnostics).to.deep.equal([{ kind: 'geolocate', code: 'invalid-options' }, { kind: 'attribution', code: 'invalid-options' }]);
    expect(normalizeMapControlOptions({ attribution: { compact: false } }).controls.get('attribution')!.options).to.deep.equal({ compact: false });
  });
});

describe('scene control option projection', () => {
  const entry = (input: unknown, kind: string) => [...normalizeMapControlOptions(input).controls.values()].find(value => String(value.kind) === kind);

  it('admits opt-in globe and explicit terrain targets without scene state options', () => {
    const input = { globe: true, terrain: { source: 'dem', projection: 'globe', enabled: true } };
    expect(entry(input, 'globe')).to.include({ kind: 'globe', position: 'top-right', order: 0, unit: undefined });
    expect(entry(input, 'globe')?.options).to.deep.equal({});
    expect(entry(input, 'terrain')).to.include({ kind: 'terrain', position: 'top-right', order: 0, unit: undefined });
    expect(entry(input, 'terrain')?.options).to.deep.equal({ source: 'dem', exaggeration: 1 });
    expect(normalizeMapControlOptions({ globe: false, terrain: false }).controls.size).to.equal(0);
    expect(normalizeMapControlOptions({ globe: undefined, terrain: undefined }).diagnostics).to.deep.equal([]);
  });

  it('requires an explicit terrain source and rejects runtime true without disturbing other controls', () => {
    for (const terrain of [true, null, {}, { source: '' }, { source: ' ' }, { source: 1 }, { source: 'x'.repeat(4097) },
      { source: 'dem', exaggeration: -1 }, { source: 'dem', exaggeration: NaN }, { source: 'dem', exaggeration: Infinity },
      { source: 'dem', exaggeration: '1' }, { source: 'dem', position: 'middle' }, { source: 'dem', order: Infinity }]) {
      const result = normalizeMapControlOptions({ navigation: true, terrain });
      expect(entry({ terrain }, 'terrain')).to.equal(undefined);
      expect(result.controls.has('navigation')).to.equal(true);
      expect(result.diagnostics).to.deep.equal([{ kind: 'terrain', code: 'invalid-options' }]);
    }
  });

  it('snapshots terrain without an invented scale maximum and keeps position/order out of adapter options', () => {
    for (const exaggeration of [0, 11, Number.MAX_VALUE]) {
      const terrain = { source: 'dem', exaggeration, position: 'bottom-left', order: -2 };
      const result = entry({ terrain }, 'terrain');
      terrain.source = 'changed'; terrain.exaggeration = -1;
      expect(result?.options).to.deep.equal({ source: 'dem', exaggeration });
      expect(result?.position).to.equal('bottom-left'); expect(result?.order).to.equal(-2);
      expect(Object.isFrozen(result) && Object.isFrozen(result?.options)).to.equal(true);
    }
  });

  it('rejects hostile scene-control descriptors without invoking accessors', () => {
    let reads = 0;
    const getter = (key: string) => Object.defineProperty(key === 'source' ? {} : { source: 'dem' }, key, { get() { reads++; return 'dem'; } });
    for (const terrain of [getter('source'), getter('exaggeration'), getter('position'), getter('order'), Object.create({ source: 'dem' })]) {
      expect(normalizeMapControlOptions({ terrain }).diagnostics).to.deep.equal([{ kind: 'terrain', code: 'invalid-options' }]);
    }
    const globe = Object.defineProperty({}, 'position', { get() { reads++; return 'top-left'; } });
    expect(normalizeMapControlOptions({ globe }).diagnostics).to.deep.equal([{ kind: 'globe', code: 'invalid-options' }]);
    const input = Object.defineProperty({}, 'terrain', { get() { reads++; return { source: 'dem' }; } });
    expect(normalizeMapControlOptions(input).diagnostics).to.deep.equal([{ kind: 'terrain', code: 'invalid-options' }]);
    expect(reads).to.equal(0);
  });

  it('normalizes scene control identity and enrolls stable tie priority', () => {
    const a = entry({ terrain: { source: 'dem', exaggeration: 2, position: 'bottom-left', order: 3 } }, 'terrain');
    const b = entry({ terrain: { order: 3, position: 'bottom-left', exaggeration: 2, source: 'dem' } }, 'terrain');
    const c = entry({ terrain: { source: 'other', exaggeration: 2, position: 'bottom-left', order: 3 } }, 'terrain');
    expect(a?.key).to.equal(b?.key); expect(a?.key).not.to.equal(c?.key);
    const controls = normalizeMapControlOptions({ attribution: true, terrain: { source: 'dem' }, globe: true, geolocate: true, scale: true, navigation: true }).controls;
    expect([...controls.keys()]).to.deep.equal(['navigation', 'scale', 'geolocate', 'globe', 'terrain', 'attribution']);
  });
});

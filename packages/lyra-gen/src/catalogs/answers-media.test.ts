import assert from 'node:assert/strict';
import test from 'node:test';
import { createCatalog, dashboardCatalog } from '../catalog.js';
import { validateView } from '../runtime.js';
import { answerMediaRoles, mediaComponents } from './answers-media.js';
import type { LyraGenCatalog, LyraGenNode } from '../types.js';

const base = dashboardCatalog();
const origins = ['https://cdn.example.com'];
const roles = { ...answerMediaRoles, ...mediaComponents(base, { origins }) };
const catalog: LyraGenCatalog = createCatalog({ ...base, id: `${base.id}+media`, components: { ...base.components, ...roles } });
const reserved = ['id', 'slot', 'text', 'bindings', 'reads', 'liveReads', 'dataQuery', 'repeat', 'itemReads', 'visible', 'checks', 'computes', 'a11y', 'action'];
const view = (root: LyraGenNode) => ({ version: '1', catalog: { id: catalog.id, version: catalog.version }, surfaceId: 'media-test', revision: 0, root });
const accepts = (root: LyraGenNode): void => { const checked = validateView(view(root), catalog); assert.ok(checked.ok, `${JSON.stringify(root).slice(0, 160)}: ${JSON.stringify(checked.diagnostics)}`); };
const rejects = (root: LyraGenNode): void => assert.equal(validateView(view(root), catalog).ok, false, JSON.stringify(root).slice(0, 200));
const media = (props: Record<string, unknown>): LyraGenNode => ({ id: 'm', type: 'media-card', props: { kind: 'image', alt: 'Chart', ...props } } as LyraGenNode);

test('media roles are collision-free, documented and validate their examples', () => {
  assert.deepEqual(Object.keys(roles), ['calendar', 'geojson', 'entity-card', 'media-card']);
  for (const [name, component] of Object.entries(roles)) {
    // The dashboard overlay carries the plain-data roles; only the host-configured media card is new.
    assert.equal(base.components[name], name === 'media-card' ? undefined : answerMediaRoles[name as keyof typeof answerMediaRoles], name);
    assert.ok(component.useWhen && component.examples?.length === 1 && component.load && component.documentation, name);
    for (const key of Object.keys(component.properties)) assert.equal(reserved.includes(key), false, `${name}.${key}`);
    accepts(component.examples![0]!);
  }
});

test('media-card accepts only HTTPS URLs on the declared origins', () => {
  accepts(media({ src: 'https://cdn.example.com/a/b.png' }));
  accepts(media({ src: 'https://cdn.example.com/v.mp4', kind: 'video' }));
  for (const src of ['https://evil.example.net/a.png', 'http://cdn.example.com/a.png', 'https://cdn.example.com.evil.net/a.png', 'https://cdn.example.com:8443/a.png', 'https://user:pw@cdn.example.com/a.png', '//cdn.example.com/a.png', '/a.png', 'data:image/png;base64,AAAA', 'javascript:alert(1)', 'blob:https://cdn.example.com/x', 'https://sub.cdn.example.com/a.png', 'https://cdn.example.com/a b.png']) rejects(media({ src }));
  rejects({ id: 'm', type: 'media-card', props: { kind: 'image', alt: 'Chart' } });
});

test('media-card requires a kind and an accessible name and refuses unreviewed members', () => {
  const src = 'https://cdn.example.com/a.png';
  rejects({ id: 'm', type: 'media-card', props: { src, kind: 'image' } });
  rejects({ id: 'm', type: 'media-card', props: { src, alt: 'Chart' } });
  rejects(media({ src, alt: '' }));
  rejects(media({ src, kind: 'audio' }));
  for (const extra of [{ href: src }, { mimeType: 'image/png' }, { disabled: false }, { maxHeight: '1px' }, { srcset: src }, { poster: src }]) rejects(media({ src, ...extra }));
});

test('the media factory rejects missing, malformed or duplicate-authority origins and role clashes', () => {
  for (const bad of [[], ['*'], ['https://*.example.com'], ['http://cdn.example.com'], ['https://cdn.example.com/'], ['https://cdn.example.com/path'], ['cdn.example.com'], ['https://cdn.example.com', 'ftp://x']]) assert.throws(() => mediaComponents(base, { origins: bad }), TypeError, JSON.stringify(bad));
  assert.throws(() => mediaComponents(base, {} as never), TypeError);
  assert.throws(() => mediaComponents(base, undefined as never), TypeError);
  assert.throws(() => mediaComponents(catalog, { origins }), /already defines/u);
});

test('entity-card carries bounded plain data and forces the focus button off', () => {
  const entity = { id: 'e1', label: 'Entity' };
  accepts({ id: 'e', type: 'entity-card', props: { entity: { ...entity, properties: { A: 'x', B: 2 }, degree: 3 } } });
  rejects({ id: 'e', type: 'entity-card', props: {} });
  rejects({ id: 'e', type: 'entity-card', props: { entity: { ...entity, type: 'person' } } });
  rejects({ id: 'e', type: 'entity-card', props: { entity: { ...entity, properties: { A: { nested: 1 } } } } });
  rejects({ id: 'e', type: 'entity-card', props: { entity: { ...entity, properties: { url: 'https://evil.example.net' } } } });
  rejects({ id: 'e', type: 'entity-card', props: { entity: { ...entity, properties: Object.fromEntries(Array.from({ length: 41 }, (_, i) => [`k${i}`, 'v'])) } } });
  rejects({ id: 'e', type: 'entity-card', props: { entity, types: [{ id: 'x', color: 'red' }] } });
  rejects({ id: 'e', type: 'entity-card', props: { entity, withoutFocusButton: false } });
  assert.equal(roles['entity-card']!.prepareProperties!({ entity })['withoutFocusButton'], true);
});

test('calendar bounds events and exposes no source', () => {
  const event = (i: number) => ({ title: `E${i}`, start: '2026-12-01' });
  accepts({ id: 'c', type: 'calendar', props: { name: 'Plan', events: Array.from({ length: 250 }, (_, i) => event(i)) } });
  rejects({ id: 'c', type: 'calendar', props: { name: 'Plan', events: Array.from({ length: 251 }, (_, i) => event(i)) } });
  rejects({ id: 'c', type: 'calendar', props: { name: 'Plan', events: [{ title: 'No start' }] } });
  rejects({ id: 'c', type: 'calendar', props: { name: 'Plan', events: [{ ...event(0), url: 'https://x.example' }] } });
  rejects({ id: 'c', type: 'calendar', props: { name: 'Plan', events: [{ ...event(0), title: 'x'.repeat(257) }] } });
  rejects({ id: 'c', type: 'calendar', props: { events: [event(0)] } });
  for (const extra of [{ src: 'https://cdn.example.com/a.ics' }, { maxEvents: 2500 }, { maxHeight: '1px' }] as Record<string, string | number>[]) rejects({ id: 'c', type: 'calendar', props: { name: 'Plan', events: [], ...extra } });
});

test('geojson accepts bounded geometry only and exposes no source', () => {
  const point = { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 2] } };
  accepts({ id: 'g', type: 'geojson', props: { name: 'Map', data: point } });
  accepts({ id: 'g', type: 'geojson', props: { name: 'Map', data: { type: 'FeatureCollection', features: [{ ...point, properties: { n: 'a', v: 1 } }] } } });
  accepts({ id: 'g', type: 'geojson', props: { name: 'Map', data: { type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 0]]]] } } } });
  rejects({ id: 'g', type: 'geojson', props: { name: 'Map', data: { type: 'FeatureCollection', features: Array.from({ length: 51 }, () => point) } } });
  rejects({ id: 'g', type: 'geojson', props: { name: 'Map', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: Array.from({ length: 201 }, (_, i) => [i, 0]) } } } });
  rejects({ id: 'g', type: 'geojson', props: { name: 'Map', data: { type: 'Feature', geometry: { type: 'GeometryCollection', geometries: [] } } } });
  rejects({ id: 'g', type: 'geojson', props: { name: 'Map', data: { type: 'Feature', geometry: { type: 'Point', coordinates: ['a', 'b'] } } } });
  rejects({ id: 'g', type: 'geojson', props: { name: 'Map', data: { ...point, properties: { link: { a: 1 } } } } });
  rejects({ id: 'g', type: 'geojson', props: { name: 'Map', data: { ...point, properties: { url: 'https://evil.example.net' } } } });
  rejects({ id: 'g', type: 'geojson', props: { name: 'Map', data: point, src: 'https://cdn.example.com/a.json' } });
  rejects({ id: 'g', type: 'geojson', props: { data: point } });
});

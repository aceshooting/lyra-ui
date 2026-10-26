import assert from 'node:assert/strict';
import { parseMarkup, createMarkupParser } from '../src/parser.js';
import { parseJsonView, createJsonViewStream } from '../src/json-stream.js';
import { createSnapshot, createSurfaceState, restoreSnapshot, setSurfaceState, validateView } from '../src/runtime.js';
import type { LyraGenResult, LyraGenView } from '../src/types.js';
import type { PositiveRouteFixture, RefusalRouteFixture, RouteFixture, RouteId, RouteOutcome } from './fixtures/input-routes.js';

export function chunksFor(source: string, widths: readonly number[]): string[] {
  assert.ok(source.length > 0);
  assert.ok(widths.length > 0 && widths.every(width => Number.isSafeInteger(width) && width > 0));
  const chunks: string[] = [];
  let offset = 0;
  for (let index = 0; offset < source.length; index++) {
    const width = widths[index % widths.length]!;
    chunks.push(source.slice(offset, offset + width));
    offset += width;
  }
  assert.equal(chunks.join(''), source);
  return chunks;
}

const admitted = (result: LyraGenResult<LyraGenView>): RouteOutcome => result.ok
  ? { ok: true, view: result.value, diagnostics: result.diagnostics }
  : { ok: false, diagnostics: result.diagnostics };

export function runRoute(fixture: RouteFixture, route: RouteId, widths: readonly number[] = [17, 1, 4]): RouteOutcome {
  const validation = { limits: fixture.limits };
  const markupOptions = { catalog: fixture.catalog, surfaceId: fixture.surfaceId, revision: fixture.revision,
    allowedTags: Object.keys(fixture.catalog.components) };
  switch (route) {
    case 'json-object': return admitted(validateView(JSON.parse(fixture.jsonSource), fixture.catalog, validation));
    case 'json-batch': {
      const result = parseJsonView(fixture.jsonSource, { catalog: fixture.catalog, limits: fixture.limits });
      return { ok: result.status === 'complete', ...(result.view ? { view: result.view } : {}), diagnostics: result.diagnostics };
    }
    case 'markup-batch': {
      const result = parseMarkup(fixture.markupSource, markupOptions);
      return result.status === 'complete' && result.view
        ? admitted(validateView(result.view, fixture.catalog, validation))
        : { ok: false, diagnostics: result.diagnostics };
    }
    case 'json-stream': {
      const stream = createJsonViewStream({ catalog: fixture.catalog, limits: fixture.limits });
      for (const chunk of chunksFor(fixture.jsonSource, widths)) assert.equal(stream.push(chunk).view, undefined, `${fixture.id}: JSON before finish`);
      const result = stream.finish();
      assert.deepEqual(stream.finish(), result);
      return { ok: result.status === 'complete', ...(result.view ? { view: result.view } : {}), diagnostics: result.diagnostics };
    }
    case 'markup-stream': {
      const stream = createMarkupParser(markupOptions);
      for (const chunk of chunksFor(fixture.markupSource, widths)) assert.equal(stream.push(chunk).view, undefined, `${fixture.id}: Markup before finish`);
      const result = stream.finish();
      assert.deepEqual(stream.finish(), result);
      return result.status === 'complete' && result.view
        ? admitted(validateView(result.view, fixture.catalog, validation))
        : { ok: false, diagnostics: result.diagnostics };
    }
  }
}

export function assertFullView(actual: unknown, expected: LyraGenView): void {
  assert.deepEqual(actual, expected);
}

export function assertEditedRestore(view: LyraGenView, fixture: PositiveRouteFixture): void {
  let state = createSurfaceState(view, fixture.initialValues);
  assert.deepEqual(state, fixture.expectedInitialState);
  for (const edit of fixture.edits) {
    const result = setSurfaceState(state, edit.pointer, edit.value);
    assert.ok(result.ok, `${fixture.id}: host edit ${edit.pointer}`);
    state = result.value;
  }
  const created = createSnapshot(view, state);
  assert.deepEqual(created, fixture.expectedSnapshot);
  const restored = restoreSnapshot(JSON.parse(JSON.stringify(created)), fixture.catalog);
  assert.ok(restored.ok, `${fixture.id}: restore admitted route`);
  assert.deepEqual(restored.value, fixture.expectedSnapshot);
  const literal = restoreSnapshot(JSON.parse(JSON.stringify(fixture.expectedSnapshot)), fixture.catalog);
  assert.ok(literal.ok, `${fixture.id}: restore independently authored snapshot`);
  assert.deepEqual(literal.value, fixture.expectedSnapshot);
}

export function assertPositiveRoute(fixture: PositiveRouteFixture, route: RouteId, widths?: readonly number[]): void {
  const result = runRoute(fixture, route, widths);
  assert.equal(result.ok, true, `${fixture.id}/${route}: ${result.diagnostics.map(item => item.code).join(',')}`);
  assert.ok(result.view);
  assert.deepEqual(result.diagnostics, []);
  assertFullView(result.view, fixture.expectedView);
  assertEditedRestore(result.view, fixture);
}

export function assertRefusal(fixture: RefusalRouteFixture, route: RouteId, widths?: readonly number[]): void {
  const result = runRoute(fixture, route, widths);
  assert.equal(result.ok, false, `${fixture.id}/${route}`);
  assert.equal(result.view, undefined, `${fixture.id}/${route}: no same-boundary salvage`);
  const lexical = (route === 'markup-batch' || route === 'markup-stream') && fixture.markupCode;
  assert.equal(result.diagnostics[0]?.code, lexical || fixture.code, `${fixture.id}/${route}`);
  if (fixture.diagnosticPath) assert.equal(result.diagnostics[0]?.path, fixture.diagnosticPath);
}

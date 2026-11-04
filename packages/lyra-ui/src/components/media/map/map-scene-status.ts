import type { LyraMapSceneErrorCode } from './map-scene-types.js';

/** What one renderer established for the accepted members it owns. */
export type SceneDrawOutcome =
  | { readonly state: 'none' }
  | { readonly state: 'pending' }
  /** `approximate` members are drawn as their ground track without the authored altitude. */
  | { readonly state: 'drawn'; readonly approximate?: boolean }
  | { readonly state: 'failed'; readonly code: 'engine' | 'limit' | 'context-lost' };

export interface SceneRenderStatus {
  readonly state: 'loading' | 'ready' | 'partial' | 'unavailable';
  readonly code?: LyraMapSceneErrorCode;
}
export interface SceneMemberCounts { readonly markers: number; readonly lines: number; readonly models: number }

/** Most significant first: a lost context or engine failure explains more than an omission. */
const PRECEDENCE: readonly LyraMapSceneErrorCode[] = ['context-lost', 'engine', 'limit', 'model', 'altitude'];

export function countSceneMembers(objects: readonly { readonly kind: string }[]): SceneMemberCounts {
  let markers = 0, lines = 0, models = 0;
  for (const object of objects) {
    if (object.kind === 'marker') markers++;
    else if (object.kind === 'path' || object.kind === 'arc') lines++;
    else if (object.kind === 'model') models++;
  }
  return { markers, lines, models };
}

/**
 * Whole-scene status from per-renderer outcomes. Models are never drawn. `ready` requires every
 * requested member to be installed exactly; installation does not assert visible pixels.
 */
export function summarizeSceneRender(counts: SceneMemberCounts, markers: SceneDrawOutcome,
  lines: SceneDrawOutcome): SceneRenderStatus {
  const groups: SceneDrawOutcome[] = [];
  if (counts.markers > 0) groups.push(markers);
  if (counts.lines > 0) groups.push(lines);
  if (groups.some(group => group.state === 'pending')) return Object.freeze({ state: 'loading' });
  const codes = new Set<LyraMapSceneErrorCode>(counts.models > 0 ? ['model'] : []);
  let drawn = 0;
  for (const group of groups) {
    if (group.state === 'drawn') { drawn++; if (group.approximate) codes.add('altitude'); }
    else codes.add(group.state === 'failed' ? group.code : 'engine');
  }
  const code = PRECEDENCE.find(candidate => codes.has(candidate));
  if (drawn === 0) return Object.freeze({ state: 'unavailable', code: code ?? 'engine' });
  return Object.freeze(code === undefined ? { state: 'ready' } : { state: 'partial', code });
}

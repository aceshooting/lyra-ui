import type { LyraGenCatalog } from '../types.js';

/** UAX #31 identifier rule shared by candidate component, property and ID names. */
export const A2UI_CANDIDATE_IDENTIFIER = /^[\p{XID_Start}_][\p{XID_Continue}]*$/u;

/** Deterministic role-to-wire names: hyphens become underscores, collisions and `Surface` fail. */
export function a2uiCandidateComponentNames(catalog: LyraGenCatalog): ReadonlyMap<string, string> {
  const names = new Map<string, string>();
  const used = new Set<string>();
  for (const name of Object.keys(catalog.components)) {
    const wireName = name.replaceAll('-', '_');
    if (!A2UI_CANDIDATE_IDENTIFIER.test(wireName)) throw new TypeError('Invalid candidate component identifier.');
    if (wireName === 'Surface') throw new TypeError('Surface is reserved by the candidate protocol.');
    if (used.has(wireName)) throw new TypeError('Candidate component identifier collision.');
    used.add(wireName);
    names.set(name, wireName);
  }
  return names;
}

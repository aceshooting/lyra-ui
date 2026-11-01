import type { LyraMapFeatureRequirements } from './map-loader.js';
import { admitMapTerrain, mapScenePreparation, mapSceneValueEqual, snapshotMapSceneBaseline,
  type LyraMapProjection } from './map-scene-configuration.js';

/** Optional capabilities are required only after declarative scene configuration is used. */
export interface MapScenePeer {
  getStyle?(): unknown;
  getProjection?(): unknown;
  getTerrain?(): unknown;
  setProjection?(value: unknown): unknown;
  setTerrain?(value: unknown): unknown;
  prepareFeatures?(requirements: LyraMapFeatureRequirements, options?: { signal?: AbortSignal }): Promise<void>;
  on?(type: 'error', listener: () => void): unknown;
  off?(type: 'error', listener: () => void): unknown;
}
interface MapSceneOptions {
  readonly changed: () => void;
  readonly failed: () => void;
}
type Baseline = ReturnType<typeof snapshotMapSceneBaseline>;

/** Owns a per-style baseline and supersedable scene preparation; never owns caller sources. */
export class MapSceneConfigurationController {
  private peer?: MapScenePeer;
  private generation?: number;
  private baseline?: Baseline;
  private applied?: Baseline;
  private projectionOwned = false;
  private terrainOwned = false;
  private abort?: AbortController;
  private revision = 0;
  pending = false;
  work: Promise<void> = Promise.resolve();

  constructor(private readonly options: MapSceneOptions) {}

  cancel(): void {
    this.revision++;
    this.abort?.abort(); this.abort = undefined;
    this.pending = false;
    this.peer = undefined; this.generation = undefined; this.baseline = undefined; this.applied = undefined;
    this.projectionOwned = false; this.terrainOwned = false;
  }

  sync(peer: MapScenePeer, generation: number, current: () => boolean, projection: LyraMapProjection | undefined, terrain: unknown): void {
    if (peer !== this.peer || generation !== this.generation) {
      this.cancel(); this.peer = peer; this.generation = generation;
    }
    if (!this.baseline && projection === undefined && terrain === undefined) return;
    this.abort?.abort();
    const abort = new AbortController(); this.abort = abort;
    const revision = ++this.revision;
    const live = () => !abort.signal.aborted && this.revision === revision && this.peer === peer && current();
    try {
      if (!live()) return;
      const admittedTerrain = admitMapTerrain(terrain);
      for (const key of ['getStyle', 'getProjection', 'getTerrain'] as const) {
        if (typeof peer[key] !== 'function') throw new TypeError('Map scene reader unavailable');
      }
      const style = peer.getStyle!();
      if (!live()) return;
      if (style === null || typeof style !== 'object' || Array.isArray(style)) throw new TypeError('Map style unavailable');
      const originalProjection = peer.getProjection!(); if (!live()) return;
      const originalTerrain = peer.getTerrain!(); if (!live()) return;
      const observed = snapshotMapSceneBaseline(originalProjection, originalTerrain);
      if (!live()) return;
      if (!this.baseline) {
        // Reject accessor-bearing style descriptors even when a getter would conceal them.
        for (const key of ['projection', 'terrain']) {
          const descriptor = Object.getOwnPropertyDescriptor(style, key);
          if (descriptor && !('value' in descriptor)) throw new TypeError('Invalid map scene descriptor');
          if (!live()) return;
        }
        const baseline = observed;
        const styleBaseline = snapshotMapSceneBaseline(Object.getOwnPropertyDescriptor(style, 'projection')?.value,
          Object.getOwnPropertyDescriptor(style, 'terrain')?.value);
        if (!mapSceneValueEqual(baseline, styleBaseline)) throw new TypeError('Inconsistent map scene readers');
        if (!live()) return;
        this.baseline = baseline; this.applied = baseline;
      }
      const next = {
        projection: projection === undefined ? (this.projectionOwned ? this.baseline.projection : observed.projection) : Object.freeze({ type: projection }),
        terrain: admittedTerrain === undefined ? (this.terrainOwned ? this.baseline.terrain : observed.terrain) : admittedTerrain,
      };
      const projectionOwned = projection !== undefined, terrainOwned = admittedTerrain !== undefined;
      const participatesProjection = projectionOwned || this.projectionOwned, participatesTerrain = terrainOwned || this.terrainOwned;
      const writeProjection = participatesProjection && !mapSceneValueEqual(next.projection, observed.projection);
      const writeTerrain = participatesTerrain && !mapSceneValueEqual(next.terrain, observed.terrain);
      if (participatesProjection && typeof peer.setProjection !== 'function' || participatesTerrain && typeof peer.setTerrain !== 'function') throw new TypeError('Map scene writer unavailable');
      const preparation = mapScenePreparation(participatesProjection ? next.projection : undefined, participatesTerrain ? next.terrain : undefined, style);
      if (!live()) return;
      if (!writeProjection && !writeTerrain) {
        this.projectionOwned = projectionOwned; this.terrainOwned = terrainOwned;
        this.pending = false; this.work = Promise.resolve(); this.options.changed(); return;
      }
      if (typeof peer.on !== 'function' || typeof peer.off !== 'function') throw new TypeError('Map error subscription unavailable');
      this.pending = true;
      this.options.changed();
      this.work = this.apply(peer, preparation, next, writeProjection, writeTerrain, participatesProjection, participatesTerrain, abort.signal, live).then(() => {
        if (!live()) return;
        this.projectionOwned = projectionOwned; this.terrainOwned = terrainOwned;
      }).catch(() => { if (live()) this.options.failed(); }).finally(() => {
        if (this.revision === revision) { this.pending = false; this.options.changed(); }
      });
    } catch {
      if (live()) { this.pending = false; this.options.failed(); }
      this.work = Promise.resolve();
    }
  }

  private async apply(peer: MapScenePeer, preparation: LyraMapFeatureRequirements, next: Baseline,
    projection: boolean, terrain: boolean, participatesProjection: boolean, participatesTerrain: boolean, signal: AbortSignal, live: () => boolean): Promise<void> {
    let release = () => undefined;
    const cancelled = new Promise<void>(resolve => {
      const cancel = () => resolve();
      signal.addEventListener('abort', cancel, { once: true });
      release = () => { signal.removeEventListener('abort', cancel); };
    });
    try {
      // Supersession also releases peers whose preparation ignores the abort signal.
      await Promise.race([peer.prepareFeatures?.(preparation, { signal }) ?? Promise.resolve(), cancelled]);
      if (!live()) return;
      const projectionNow = peer.getProjection!(); if (!live()) return;
      const terrainNow = peer.getTerrain!(); if (!live()) return;
      const observed = snapshotMapSceneBaseline(projectionNow, terrainNow);
      if (!live()) return;
      const style = peer.getStyle!();
      if (!live()) return;
      mapScenePreparation(participatesProjection ? next.projection : undefined, participatesTerrain ? next.terrain : undefined, style);
      if (!live()) return;
      this.applied = observed;
      let nativeError = false;
      const error = () => { nativeError = true; };
      peer.on!('error', error);
      try {
        if (!live()) return;
        if (projection) {
          // Record the effect before a native callback can request its release. Failure retires
          // the map, while supersession can now restore this field from its captured baseline.
          this.applied = { projection: next.projection, terrain: this.applied!.terrain };
          this.projectionOwned = true;
          peer.setProjection!(next.projection);
        }
        if (nativeError) throw new Error('Map projection application failed');
        if (!live()) return;
        if (terrain) {
          this.applied = { projection: this.applied!.projection, terrain: next.terrain };
          this.terrainOwned = true;
          peer.setTerrain!(next.terrain);
        }
        if (nativeError) throw new Error('Map terrain application failed');
      } finally { peer.off!('error', error); }
    } finally { release(); }
  }
}

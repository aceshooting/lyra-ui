import { ENGINE_3D_PREFERENCE, type Engine3dPreference } from './engine-3d.js';
import {
  PANORAMA_DEFAULT_CAMERA,
  PANORAMA_PROJECTION,
  normalizePanoramaCamera,
  snapshotPanoramaHotspots,
  type LyraMediaProjection,
  type LyraPanoramaCamera,
  type LyraPanoramaHotspot,
} from './media-panorama.js';

/** What {@linkcode PanoramaPropertyState} needs from the media element that owns it. */
export interface PanoramaPropertyHost {
  readonly ownerDocument: Document | null;
  requestUpdate(name?: PropertyKey, oldValue?: unknown): void;
}

/**
 * Backing state for the panorama properties a media element declares (`projection`, `engine`,
 * `panoramaCamera`, `hotspots`): normalized writes, silent authored camera writes, the bounded
 * hotspot snapshot, and renderer invalidation. The element keeps its decorated accessors (and their
 * documentation) and forwards to this state, so its published API is unchanged.
 */
export class PanoramaPropertyState {
  private projectionValue: LyraMediaProjection = 'flat';
  private engineValue: Engine3dPreference = 'builtin';
  private cameraValue: LyraPanoramaCamera = PANORAMA_DEFAULT_CAMERA;
  private cameraRevision = 0;
  private hotspotsValue: readonly LyraPanoramaHotspot[] = Object.freeze([]);
  private hotspotSource: unknown = this.hotspotsValue;
  private hotspotRevision = 0;

  constructor(
    private readonly host: PanoramaPropertyHost,
    /** Drops the renderer's prepared scene; called when a property it depends on changes. */
    private readonly invalidate: () => void,
  ) {}

  get projection(): LyraMediaProjection { return this.projectionValue; }

  setProjection(value: LyraMediaProjection): void {
    const next = PANORAMA_PROJECTION.normalize(value), old = this.projectionValue;
    if (next === old) return;
    this.projectionValue = next;
    this.invalidate();
    this.host.requestUpdate('projection', old);
  }

  get engine(): Engine3dPreference { return this.engineValue; }

  setEngine(value: Engine3dPreference): void {
    const next = ENGINE_3D_PREFERENCE.normalize(value), old = this.engineValue;
    if (next === old) return;
    this.engineValue = next;
    this.invalidate();
    this.host.requestUpdate('engine', old);
  }

  get camera(): LyraPanoramaCamera { return this.cameraValue; }

  /** An authored write: normalized, ignored when equal, and never announced as a camera change. */
  setCamera(value: LyraPanoramaCamera): void {
    const revision = ++this.cameraRevision;
    const next = normalizePanoramaCamera(value), old = this.cameraValue;
    // Normalizing can run caller code (a proxy trap) that writes the camera again; the newest write wins.
    if (revision !== this.cameraRevision) return;
    if (next.yaw === old.yaw && next.pitch === old.pitch && next.fieldOfView === old.fieldOfView) return;
    this.cameraValue = next;
    this.host.requestUpdate('panoramaCamera', old);
  }

  /** A camera the renderer reports from a gesture or key; the host announces it. */
  adoptCamera(camera: LyraPanoramaCamera): void {
    const old = this.cameraValue;
    this.cameraValue = camera;
    this.host.requestUpdate('panoramaCamera', old);
  }

  get hotspots(): readonly LyraPanoramaHotspot[] { return this.hotspotsValue; }

  /** Snapshots `value` in the owner realm; reassigning the same source or the snapshot is a no-op. */
  setHotspots(value: readonly LyraPanoramaHotspot[]): void {
    if (value === this.hotspotSource || value === this.hotspotsValue) return;
    const old = this.hotspotsValue;
    this.hotspotSource = value;
    const revision = ++this.hotspotRevision;
    const next = snapshotPanoramaHotspots(value, this.host.ownerDocument?.defaultView ?? null);
    if (revision !== this.hotspotRevision) return;
    this.hotspotsValue = next;
    this.invalidate();
    this.host.requestUpdate('hotspots', old);
  }

  /** Spherical rendering needs both the equirectangular projection and the WebGL engine. */
  get enabled(): boolean {
    return this.projectionValue === 'equirectangular' && this.engineValue === 'webgl';
  }
}

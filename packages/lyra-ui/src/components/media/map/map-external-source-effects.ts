import { getInheritedPropertyDescriptor, isObjectValue } from '../../../internal/data-descriptors.js';
import { prepareMapLocalImage, type PreparedMapLocalImage } from './map-local-image.js';
import type { MapImagePreparationContext } from './map-images.js';
import type { LyraMapOverlaySource } from './map-overlay-admission.js';
import type { MapLibreMapCapability } from './map-loader.js';

// Retained local image-source URLs have a separate budget from atlas images and providers.
const MAX_LOCAL_IMAGE_RETAINED_BYTES = 8 * 1024 * 1024;

type Method = (...args: unknown[]) => unknown;
function method(value: unknown, key: string): Method | undefined {
  if (!isObjectValue(value)) return undefined;
  const entry = getInheritedPropertyDescriptor(value, key);
  return entry && Object.hasOwn(entry, 'value') && typeof entry.value === 'function' ? entry.value as Method : undefined;
}
function failed(): never { throw new Error('Map source could not be updated.'); }
interface LocalEntry { readonly input: string; readonly image: PreparedMapLocalImage; readonly id: string; native?: unknown }
interface CanvasEntry { readonly source: unknown; readonly revision: number }
export interface MapExternalSourceContext extends MapImagePreparationContext {
  /** Peer/style ownership only, also checked during cleanup of an interrupted transaction. */
  readonly isLive: () => boolean;
  /** Whether the latest admitted policy still permits stopping this static canvas. */
  readonly canPauseCanvas: (id: string) => boolean;
  /** Retire a still-current poisoned peer if a canvas cannot be stopped. */
  readonly retire: () => void;
}
/** Internal revision and owned-URL state. Native source descriptors never contain redrawRevision. */
export class MapExternalSourceEffects {
  private retained = new Set<LocalEntry>();
  private committed = new Map<string, LocalEntry>();
  private installed = new Map<string, unknown>();
  private canvases = new Map<string, CanvasEntry>();
  private map?: MapLibreMapCapability;
  private style?: unknown;
  private off?: () => void;
  private epoch = 0;
  private readonly nativeApplications = new Set<object>();
  private sweepRetained?: () => void;

  constructor(private readonly prepare = prepareMapLocalImage) {}

  /** Called only after the native peer has been removed. */
  dispose(): void {
    this.epoch++;
    try { this.off?.(); } catch { /* The native peer has already retired. */ }
    this.off = undefined; this.sweepRetained = undefined; this.nativeApplications.clear();
    for (const entry of this.retained) entry.image.dispose();
    this.retained.clear(); this.committed.clear(); this.installed.clear(); this.canvases.clear(); this.map = undefined;
  }

  async reconcile(map: MapLibreMapCapability, style: unknown, sources: readonly LyraMapOverlaySource[],
    revisions: ReadonlyMap<string, number>, context: MapExternalSourceContext,
    apply: (sources: readonly LyraMapOverlaySource[]) => Promise<void>): Promise<void> {
    const epoch = ++this.epoch;
    const check = () => { if (epoch !== this.epoch || context.signal.aborted || !context.isCurrent()) failed(); };
    check();
    if (this.map !== map || !Object.is(this.style, style)) {
      this.off?.(); this.off = undefined; this.canvases.clear(); this.installed.clear();
      this.map = map; this.style = style;
    }
    const sweep = () => {
      // Source absence during an asynchronous or partially applied native transaction is not
      // retirement proof: that transaction may still install any of its prepared URLs.
      if (this.nativeApplications.size) return;
      const sweepingEpoch = this.epoch;
      const live = () => sweepingEpoch === this.epoch && this.map === map && Object.is(this.style, style) && context.isLive();
      if (!live()) return;
      for (const entry of [...this.retained]) {
        if (this.committed.get(entry.id) === entry) continue;
        const source = map.getSource(entry.id);
        if (!live()) return;
        const loaded = method(source, 'loaded');
        const settled = source && source === this.installed.get(entry.id) && loaded && Reflect.apply(loaded, source, []) === true;
        if (!live()) return;
        if (!source || entry.native !== undefined && source !== entry.native || settled) {
          this.retained.delete(entry); entry.image.dispose();
        }
      }
    };
    const listener = () => { try { sweep(); } catch { if (context.isLive()) context.retire(); } };
    this.sweepRetained = listener;
    const application = {};
    const created: LocalEntry[] = [], desired = new Map<string, LocalEntry>();
    let exposed = false;
    try {
      const prepared: LyraMapOverlaySource[] = [];
      for (const entry of sources) {
        const input = entry.source['url'];
        if (entry.source['type'] !== 'image' || typeof input !== 'string' || !/^(?:data|blob):/u.test(input)) {
          prepared.push(entry); continue;
        }
        let local = this.committed.get(entry.id);
        if (!local || local.input !== input) {
          const image = await this.prepare(input, context);
          try { check(); } catch (error) { image.dispose(); throw error; }
          local = { input, image, id: entry.id }; created.push(local);
          sweep(); check();
          const bytes = [...this.retained, ...created].reduce((total, item) => total + item.image.encodedBytes, 0);
          if (bytes > MAX_LOCAL_IMAGE_RETAINED_BYTES) failed();
        }
        desired.set(entry.id, local);
        prepared.push(Object.freeze({ ...entry, source: Object.freeze({ ...entry.source, url: local.image.url }) }));
      }
      check();
      // A callback may throw after the native source has accepted a URL. Retain it until native
      // retirement is proved, rather than revoking a URL whose request might still be pending.
      this.nativeApplications.add(application);
      for (const entry of created) this.retained.add(entry);
      // Until the whole application succeeds, an old loaded() result proves nothing about
      // which URL a callback-capable update accepted. Keep failed exposures conservatively.
      this.installed.clear();
      exposed = true;
      await apply(prepared); check();
      for (const entry of desired.values()) { entry.native = map.getSource(entry.id); check(); }
      const installed = new Map<string, unknown>();
      for (const entry of prepared) { installed.set(entry.id, map.getSource(entry.id)); check(); }
      this.committed = desired; this.installed = installed;
      const next = new Map<string, CanvasEntry>();
      for (const entry of sources) {
        if (entry.source['type'] !== 'canvas') continue;
        const source = map.getSource(entry.id); check();
        const revision = revisions.get(entry.id) ?? 0, previous = this.canvases.get(entry.id);
        if (previous && previous.source === source && previous.revision !== revision) {
          const play = method(source, 'play'), pause = method(source, 'pause');
          if (!play || !pause) failed();
          let temporaryPlay = false;
          const staticCanvas = entry.source['animate'] === false;
          try {
            check(); temporaryPlay = staticCanvas; Reflect.apply(play, source, []); check();
            if (staticCanvas) Reflect.apply(pause, source, []);
            temporaryPlay = false; check();
          } finally {
            // A data-only supersession may leave this same source live; stop our temporary play.
            // A style/peer retirement is different: never call into its old source afterward.
            if (temporaryPlay && context.isLive() && context.canPauseCanvas(entry.id)) {
              try {
                const same = map.getSource(entry.id) === source;
                if (context.isLive() && same && context.canPauseCanvas(entry.id)) Reflect.apply(pause, source, []);
              } catch { if (context.isLive()) context.retire(); }
            }
          }
        }
        next.set(entry.id, { source, revision });
      }
      check(); this.canvases = next;
      this.off?.();
      check(); map.on('sourcedata', listener); this.off = () => { map.off?.('sourcedata', listener); };
      check(); this.nativeApplications.delete(application); sweep(); check();
    } finally {
      if (!exposed) for (const entry of created) entry.image.dispose();
      else if (this.nativeApplications.delete(application)) {
        // A superseded application can finish last. Sweep the latest peer/style owner, and
        // keep protection while any other application can still expose a retained URL.
        this.sweepRetained?.();
      }
    }
  }
}

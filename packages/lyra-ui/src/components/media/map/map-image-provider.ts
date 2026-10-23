import { devWarnOnce } from '../../../internal/dev-mode-attribute-warning.js';
import { admitMapImages, MAP_IMAGE_LIMITS, type LyraMapImage } from './map-image-admission.js';
import type { prepareMapImages, PreparedMapImage } from './map-images.js';
import type { MapLibreMapCapability } from './map-loader.js';

/**
 * Supplies one atlas image on demand, for an image ID that a style layer needs and that neither
 * `images` nor the basemap sprite provides. Return a descriptor with that same `id`, or nothing to
 * leave the image missing. The result is admitted, sanitized and rasterized exactly like an
 * `images` entry and is charged against the same image budget.
 */
export type LyraMapImageProvider = (id: string) =>
  LyraMapImage | null | undefined | PromiseLike<LyraMapImage | null | undefined>;

/** What the provider needs from its owner: the images `images` already holds, and their cost. */
export interface MapImageProviderContext {
  readonly owner: Element;
  readonly prepare: typeof prepareMapImages;
  /** IDs `images` owns; the provider never supplies or evicts them. */
  readonly ownedIds: () => ReadonlySet<string>;
  /** Count, encoded bytes and decoded pixels that `images` already uses. */
  readonly ownedUsage: () => { readonly count: number; readonly encodedBytes: number; readonly decodedPixels: number };
}

interface ImageUsage { readonly count: number; readonly encodedBytes: number; readonly decodedPixels: number; }
interface OwnedImageUpdate {
  readonly ids: ReadonlySet<string>;
  readonly detached: Set<string>;
  usage?: ImageUsage;
  busy: boolean;
  native: boolean;
  restore: boolean;
  cancelled: boolean;
  restoring: boolean;
}

type MissingImageEvent = { readonly id?: unknown };
type EventPeer = {
  on(type: 'styleimagemissing', listener: (event: MissingImageEvent) => void): unknown;
  off?(type: 'styleimagemissing', listener: (event: MissingImageEvent) => void): unknown;
};

/**
 * Lazy image supply through the engine's missing-image hook. The engine awaits the resolver before
 * it lays out the symbols that need the image; an engine without that hook falls back to its
 * `styleimagemissing` event, after which the added image reloads the tiles that depend on it.
 * Prepared pixels are kept per ID, so a style swap re-adds them without asking the provider again.
 */
export class MapImageProvider {
  private map?: MapLibreMapCapability;
  private provider?: LyraMapImageProvider;
  private context?: MapImageProviderContext;
  private epoch = 0;
  private abort?: AbortController;
  private uninstall?: () => void;
  private readonly prepared = new Map<string, PreparedMapImage>();
  private readonly pending = new Map<string, Promise<PreparedMapImage | undefined>>();
  /** IDs the provider declined or failed, so tile reloads do not ask again for this provider. */
  private readonly declined = new Set<string>();
  private readonly installed = new Set<string>();
  private readonly tokens = new Map<string, object>();
  private ownedUpdate?: OwnedImageUpdate;
  private rollbackOwnedUpdate?: () => boolean;
  private updateAttempt = 0;
  private resetting = false;
  private disposing = false;
  private pendingConfiguration?: () => void;
  private readonly retired = new Set<PreparedMapImage>();

  /** IDs whose pixels this provider currently holds. */
  get ids(): ReadonlySet<string> { return new Set(this.prepared.keys()); }

  configure(map: MapLibreMapCapability | undefined, provider: unknown, context: MapImageProviderContext): void {
    if (this.disposing) return;
    if (this.resetting) { this.pendingConfiguration = () => { this.configure(map, provider, context); }; return; }
    const usable = typeof provider === 'function' ? provider as LyraMapImageProvider : undefined;
    if (map === this.map && usable === this.provider) {
      const epoch = this.epoch, attempt = this.updateAttempt, previousContext = this.context;
      this.cancelOwnedUpdate();
      if (this.epoch === epoch && this.updateAttempt === attempt && this.map === map &&
        this.context === previousContext && !this.ownedUpdate) this.context = context;
      return;
    }
    const expectedEpoch = this.epoch + 1;
    this.reset();
    if (this.epoch !== expectedEpoch) return;
    this.map = map; this.provider = usable; this.context = context;
    if (!map || !usable) return;
    const epoch = this.epoch;
    const resolve = (id: unknown): Promise<void> => this.resolve(id, epoch);
    if (typeof map.setMissingStyleImageResolver === 'function') {
      this.uninstall = () => { try { map.setMissingStyleImageResolver?.(null); } catch { /* The engine is being removed. */ } };
      map.setMissingStyleImageResolver(resolve);
    } else {
      const events = map as unknown as EventPeer;
      const listener = (event: MissingImageEvent): void => { void resolve(event?.id); };
      this.uninstall = () => { try { events.off?.('styleimagemissing', listener); } catch { /* The engine is being removed. */ } };
      events.on('styleimagemissing', listener);
    }
  }

  /** Reserves a proposed declarative catalog before asynchronous preparation. */
  beginOwnedUpdate(ids: Iterable<string>): {
    budget(usage: ImageUsage): boolean;
    detach(): void;
    beforeNativeMutation(): void;
    settleNative(restore: boolean): void;
    commit(): void;
    rollback(): boolean;
  } {
    const attempt = ++this.updateAttempt;
    this.rollbackOwnedUpdate?.();
    const aborted = (): never => { throw new DOMException('Map image ownership changed.', 'AbortError'); };
    // A native resource mutation must settle before anyone can restore or take its slot.
    if (attempt !== this.updateAttempt || this.ownedUpdate?.native || this.ownedUpdate?.busy || this.ownedUpdate?.restoring) aborted();
    const map = this.map, context = this.context, epoch = this.epoch;
    const update: OwnedImageUpdate = { ids: new Set(ids), detached: new Set(), busy: false,
      native: false, restore: true, cancelled: false, restoring: false };
    this.ownedUpdate = update;
    for (const id of update.ids) { this.tokens.delete(id); this.pending.delete(id); }
    const owned = (): boolean => this.ownedUpdate === update && this.map === map && this.context === context && this.epoch === epoch;
    const current = (): boolean => owned() && (context?.owner.isConnected ?? true);
    const check = (): void => { if (!current() || update.cancelled) aborted(); };
    const finish = (): void => { if (owned()) { this.ownedUpdate = undefined; this.rollbackOwnedUpdate = undefined; } };
    const rollback = (): boolean => {
      if (!owned()) return true;
      update.cancelled = true;
      if (update.busy || update.native || update.restoring) return false;
      if (!current()) { finish(); return true; }
      if (!update.restore) { finish(); return false; }
      update.restoring = true;
      let restored = true;
      try {
        for (const id of update.detached) {
          if (!current()) return false;
          const image = this.prepared.get(id);
          if (!image?.image || context?.ownedIds().has(id)) continue;
          if (!current()) return false;
          // Occupancy is not ownership. A failed resource rollback can leave a different image.
          if (!this.install(id, image, current, true)) restored = false;
          if (!current()) return false;
        }
        return restored;
      } finally { update.restoring = false; finish(); }
    };
    this.rollbackOwnedUpdate = rollback;
    return {
      budget: usage => {
        if (!current() || update.cancelled || !this.fitsUsage(usage, update.ids)) return false;
        update.usage = usage; return true;
      },
      detach: () => {
        check();
        for (const id of update.ids) {
          check();
          if (!this.prepared.has(id) || !this.installed.has(id)) continue;
          this.installed.delete(id); update.detached.add(id); update.busy = true;
          try { map?.removeImage?.(id); } finally { update.busy = false; }
          if (owned() && update.cancelled) rollback();
          check();
        }
      },
      beforeNativeMutation: () => { check(); update.native = true; },
      settleNative: restore => {
        if (!owned()) return;
        if (update.native) update.restore = restore;
        update.native = false;
      },
      commit: () => {
        check();
        for (const id of update.ids) {
          check();
          const image = this.prepared.get(id);
          this.prepared.delete(id); this.installed.delete(id);
          image?.dispose(); check();
        }
        finish();
      },
      rollback,
    };
  }

  /** Cancels a reservation; native resource mutation settles before its rollback can restore. */
  cancelOwnedUpdate(): void { this.rollbackOwnedUpdate?.(); }

  /** Hands already prepared provider IDs to a declarative owner. */
  release(ids: Iterable<string>): void {
    const update = this.beginOwnedUpdate(ids);
    try { update.detach(); update.commit(); } catch (error) { update.rollback(); throw error; }
  }

  private install(id: string, image: PreparedMapImage, lease?: () => boolean, restoring = false): boolean {
    const map = this.map, context = this.context, epoch = this.epoch;
    const current = (): boolean => this.map === map && this.context === context && this.epoch === epoch &&
      context?.owner.isConnected === true && (lease?.() ?? true);
    if (!map || !image.image || !current() || context!.ownedIds().has(id) || !restoring && this.ownedUpdate?.ids.has(id)) return false;
    if (!current()) return false;
    try {
      const occupied = map.hasImage?.(id);
      if (!current() || occupied || typeof map.addImage !== 'function') return false;
      const pixels = image.image;
      if (!pixels || !current()) return false;
      // Journal the empty-slot mutation before the native callback can reset this owner.
      this.installed.add(id);
      map.addImage(id, pixels, image.sdf ? { pixelRatio: image.pixelRatio, sdf: true } : { pixelRatio: image.pixelRatio });
      if (!current()) return false;
      return true;
    } catch {
      // A native add may mutate before throwing; retain its journal for safe reset cleanup.
      return false;
    }
  }

  /** Uninstalls the hook and removes every lazily added image from the live engine. */
  reset(): void {
    if (this.resetting) return;
    this.resetting = true;
    try {
      const map = this.map, context = this.context, images = [...this.prepared];
      const installed = new Set(this.installed), abort = this.abort, uninstall = this.uninstall;
      const epoch = ++this.epoch;
      this.ownedUpdate = undefined; this.rollbackOwnedUpdate = undefined; this.tokens.clear();
      this.abort = undefined; this.uninstall = undefined;
      this.prepared.clear(); this.pending.clear(); this.declined.clear(); this.installed.clear();
      this.map = undefined; this.provider = undefined; this.context = undefined;
      for (const [, image] of images) this.retired.add(image);
      const current = (): boolean => this.epoch === epoch && this.map === undefined;
      abort?.abort();
      if (!current()) return;
      uninstall?.();
      if (!current()) return;
      for (const [id, image] of images) {
        if (!current()) return;
        try {
          const declared = context?.ownedIds().has(id);
          if (!current()) return;
          if (installed.has(id) && !declared) {
            const occupied = map?.hasImage?.(id);
            if (!current()) return;
            if (occupied) map?.removeImage?.(id);
            if (!current()) return;
          }
        } catch { /* A removed engine already released its atlas. */ }
        if (!current()) return;
        this.retired.delete(image); image.dispose();
        if (!current()) return;
      }
    } finally {
      this.resetting = false;
      const pending = this.pendingConfiguration; this.pendingConfiguration = undefined;
      pending?.();
    }
  }

  /** Called once the engine itself is gone: nothing remains to remove from it. */
  dispose(): void {
    if (this.disposing) return;
    this.disposing = true;
    try {
      this.map = undefined;
      this.pendingConfiguration = undefined;
      if (this.resetting) this.epoch += 1;
      else this.reset();
      const retired = [...this.retired];
      for (const image of retired) { this.retired.delete(image); image.dispose(); }
    } finally { this.disposing = false; }
  }

  private async resolve(input: unknown, epoch: number): Promise<void> {
    const ownerMap = this.map, ownerContext = this.context;
    const current = (): boolean => this.epoch === epoch && this.map === ownerMap && ownerMap !== undefined && this.context === ownerContext && ownerContext?.owner.isConnected === true;
    if (!current() || typeof input !== 'string' || !input || input.length > MAP_IMAGE_LIMITS.idLength) return;
    const id = input, map = this.map!;
    if (this.context!.ownedIds().has(id) || this.ownedUpdate?.ids.has(id) || this.declined.has(id)) return;
    try { if (map.hasImage?.(id)) return; } catch { return; }
    if (!current()) return;
    let image = this.prepared.get(id);
    if (!image) {
      let work = this.pending.get(id);
      if (!work) {
        const token = {}; this.tokens.set(id, token);
        work = this.supply(id, epoch, token).finally(() => { if (this.pending.get(id) === work) this.pending.delete(id); });
        this.pending.set(id, work);
      }
      image = await work;
    }
    if (!image?.image || !current() || this.context!.ownedIds().has(id) || this.ownedUpdate?.ids.has(id)) return;
    this.install(id, image, current);
  }

  private decline(id: string, epoch: number, reason: string): undefined {
    if (this.epoch === epoch) this.declined.add(id);
    devWarnOnce(`lyra-map-image-provider:${reason}`, `<lr-map>: imageProvider did not supply image "${id}" (${reason}); it stays missing.`);
    return undefined;
  }

  private fitsUsage(owned: ImageUsage, excluded: ReadonlySet<string> = new Set(), candidate?: { encodedBytes: number; decodedPixels: number }): boolean {
    let count = owned.count + (candidate ? 1 : 0), bytes = owned.encodedBytes + (candidate?.encodedBytes ?? 0), pixels = owned.decodedPixels + (candidate?.decodedPixels ?? 0);
    for (const [id, image] of this.prepared) if (!excluded.has(id)) {
      count += 1; bytes += image.encodedBytes ?? MAP_IMAGE_LIMITS.totalBytes; pixels += image.decodedPixels ?? MAP_IMAGE_LIMITS.totalPixels;
    }
    return Number.isFinite(count) && Number.isFinite(bytes) && Number.isFinite(pixels) && count >= 0 && bytes >= 0 && pixels >= 0 &&
      count <= MAP_IMAGE_LIMITS.count && bytes <= MAP_IMAGE_LIMITS.totalBytes && pixels <= MAP_IMAGE_LIMITS.totalPixels;
  }

  private fits(context: MapImageProviderContext, encodedBytes: number, decodedPixels: number): boolean {
    const candidate = { encodedBytes, decodedPixels }, update = this.ownedUpdate;
    return this.fitsUsage(context.ownedUsage(), new Set(), candidate) &&
      (!update?.usage || this.fitsUsage(update.usage, update.ids, candidate));
  }

  private async supply(id: string, epoch: number, token: object): Promise<PreparedMapImage | undefined> {
    const provider = this.provider!, context = this.context!, map = this.map;
    const current = (): boolean => this.epoch === epoch && this.map === map && this.context === context &&
      context.owner.isConnected && this.tokens.get(id) === token &&
      !this.ownedUpdate?.ids.has(id) && !this.context?.ownedIds().has(id);
    let descriptor: unknown;
    try { descriptor = await provider(id); } catch { return current() ? this.decline(id, epoch, 'provider error') : undefined; }
    if (!current()) return undefined;
    if (descriptor === undefined || descriptor === null) return this.decline(id, epoch, 'no descriptor');
    const admitted = admitMapImages([descriptor]);
    if (!admitted.ok || admitted.images[0]!.id !== id) return this.decline(id, epoch, 'invalid descriptor');
    const candidate = admitted.images[0]!;
    // Lazy images share the `images` budget: count, encoded bytes and decoded pixels.
    if (!this.fits(context, 0, candidate.width * candidate.height)) return this.decline(id, epoch, 'image budget');
    const abort = this.abort ??= new AbortController();
    const result = await context.prepare([candidate], { owner: context.owner, signal: abort.signal, isCurrent: current });
    if (!result.ok) return current() ? this.decline(id, epoch, result.issue.code) : undefined;
    const image = result.images[0]!;
    if (!current() || this.prepared.has(id)) { image.dispose(); return this.prepared.get(id); }
    // Measured again after the await: concurrent supplies may have spent the budget meanwhile.
    if (!this.fits(context, image.encodedBytes ?? MAP_IMAGE_LIMITS.totalBytes, image.decodedPixels ?? MAP_IMAGE_LIMITS.totalPixels)) {
      image.dispose(); return this.decline(id, epoch, 'image budget');
    }
    this.prepared.set(id, image);
    return image;
  }
}

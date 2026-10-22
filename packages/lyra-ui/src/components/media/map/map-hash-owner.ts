import { admitMapHashOption, readMapHash, replaceMapHash, type MapHashReadResult } from './map-hash.js';

export interface MapHashWindow {
  readonly location: { hash: string; readonly pathname: string; readonly search: string };
  readonly history: { readonly state: unknown; replaceState(data: unknown, unused: string, url?: string | URL | null): void };
  addEventListener(type: 'hashchange' | 'popstate', listener: () => void): void;
  removeEventListener(type: 'hashchange' | 'popstate', listener: () => void): void;
}
export type MapHashOwnerStatus = 'enabled' | 'disabled' | 'invalid' | 'conflict';
const owners = new WeakMap<MapHashWindow, Map<string, object>>();
/** Owns one named fragment without changing the URL on release or taking over another owner. */
export class MapHashOwner {
  private view?: MapHashWindow;
  private key?: string;
  private option: unknown;
  private status: MapHashOwnerStatus = 'disabled';
  private cleanup?: () => void;
  private epoch = 0;
  private onNavigation?: () => void;
  configure(view: MapHashWindow | null, option: unknown, onNavigation: () => void): MapHashOwnerStatus {
    if (this.view === view && Object.is(this.option, option)) { this.onNavigation = onNavigation; return this.status; }
    const nextEpoch = this.epoch + 1;
    this.dispose();
    if (this.epoch !== nextEpoch) return this.status;
    this.view = view ?? undefined; this.option = option; this.onNavigation = onNavigation;
    const admitted = admitMapHashOption(option);
    if (admitted.status !== 'enabled' || !view) return this.status = admitted.status === 'invalid' ? 'invalid' : 'disabled';
    let registry = owners.get(view); if (!registry) owners.set(view, registry = new Map());
    if (registry.has(admitted.key)) return this.status = 'conflict';
    const token = {}, epoch = this.epoch;
    registry.set(admitted.key, token); this.key = admitted.key;
    const current = () => this.epoch === epoch && this.view === view && registry.get(admitted.key) === token;
    const listener = () => { if (current()) this.onNavigation?.(); };
    let registering = false, retired = false;
    const attempted: ('hashchange' | 'popstate')[] = [];
    const retire = () => {
      retired = true;
      if (registry.get(admitted.key) === token) registry.delete(admitted.key);
      if (registering) return;
      for (const type of attempted.splice(0)) {
        try { view.removeEventListener(type, listener); } catch { /* Retire the remaining listener independently. */ }
      }
    };
    this.cleanup = retire;
    try {
      for (const type of ['hashchange', 'popstate'] as const) {
        attempted.push(type); registering = true;
        try { view.addEventListener(type, listener); }
        finally { registering = false; if (retired) retire(); }
        if (!current()) { retire(); return 'disabled'; }
      }
    } catch {
      const owned = current();
      retire();
      if (owned && this.epoch === epoch) { this.dispose(); this.status = 'invalid'; }
      return 'invalid';
    }
    return this.status = 'enabled';
  }
  read(): MapHashReadResult {
    if (this.status !== 'enabled' || !this.view) return { status: 'disabled' };
    try { return readMapHash(this.view.location.hash, this.key); } catch { return { status: 'invalid' }; }
  }
  write(camera: unknown): boolean {
    const view = this.view, epoch = this.epoch;
    if (this.status !== 'enabled' || !view) return false;
    try {
      const result = replaceMapHash(view.location.hash, this.key, camera);
      if (result.status !== 'written' || this.epoch !== epoch) return false;
      if (result.fragment !== view.location.hash) view.history.replaceState(view.history.state, '', `${view.location.pathname}${view.location.search}${result.fragment}`);
      return true;
    } catch { return false; }
  }
  dispose(): void {
    const cleanup = this.cleanup; this.cleanup = undefined; this.epoch++;
    this.view = undefined; this.key = undefined; this.option = undefined; this.status = 'disabled'; this.onNavigation = undefined;
    cleanup?.();
  }
}

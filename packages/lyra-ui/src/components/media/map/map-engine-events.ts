export interface MapEngineEventMap {
  readonly load: unknown;
  readonly render: unknown;
  readonly 'style.load': unknown;
  readonly idle: unknown;
  readonly dataloading: unknown;
  readonly error: { readonly error?: unknown } | undefined;
  readonly movestart: Readonly<Record<string, unknown>> | undefined;
  readonly move: unknown;
  readonly moveend: Readonly<Record<string, unknown>> | undefined;
  readonly boxzoomstart: Readonly<Record<string, unknown>> | undefined;
  readonly boxzoomend: unknown;
  readonly mouseout: unknown;
  readonly mousemove: { readonly point: unknown; readonly lngLat: { readonly lng: number; readonly lat: number } };
  readonly contextmenu: { readonly point: unknown; readonly lngLat: { readonly lng: number; readonly lat: number } };
  readonly click: { readonly point: unknown; readonly lngLat: { readonly lng: number; readonly lat: number } };
}
interface Peer {
  readonly on: (...args: never[]) => unknown;
  readonly off?: (...args: never[]) => unknown;
}
interface Subscription {
  readonly listeners: Set<(event: unknown) => void>;
  receive: (event: unknown) => void;
}

/** Share native subscriptions while preserving independent owner/readiness listener lifetimes. */
export class MapEngineEvents {
  private readonly peers = new WeakMap<object, Map<string, Subscription>>();

  /** Invalidate captured dispatchers from a previous style while preserving owner handlers. */
  rotate(peer: Peer): void {
    const subscriptions = this.peers.get(peer);
    if (!subscriptions) return;
    for (const [type, subscription] of [...subscriptions]) {
      if (this.peers.get(peer) !== subscriptions || subscriptions.get(type) !== subscription) continue;
      const previous = subscription.receive;
      const receive = (event: unknown): void => {
        for (const callback of [...subscription.listeners]) {
          if (subscription.receive !== receive) return;
          if (subscription.listeners.has(callback)) callback(event);
        }
      };
      subscription.receive = receive;
      try { if (typeof peer.off === 'function') Reflect.apply(peer.off, peer, [type, previous]); }
      catch { /* The previous dispatcher is already inert. */ }
      if (this.peers.get(peer) !== subscriptions || subscriptions.get(type) !== subscription || subscription.receive !== receive) continue;
      Reflect.apply(peer.on, peer, [type, receive]);
    }
  }

  clear(peer: Peer): void {
    const subscriptions = this.peers.get(peer);
    this.peers.delete(peer);
    if (!subscriptions) return;
    for (const [type, subscription] of subscriptions) {
      subscription.listeners.clear();
      try {
        if (typeof peer.off === 'function') Reflect.apply(peer.off, peer, [type, subscription.receive]);
      } catch { /* Other subscriptions still need releasing. */ }
    }
    subscriptions.clear();
  }

  subscribe<K extends keyof MapEngineEventMap>(peer: Peer, type: K, listener: (event: MapEngineEventMap[K]) => void): () => void {
    let subscriptions = this.peers.get(peer);
    if (!subscriptions) { subscriptions = new Map(); this.peers.set(peer, subscriptions); }
    const callback = (event: unknown): void => { listener(event as MapEngineEventMap[K]); };
    let subscription = subscriptions.get(type);
    if (!subscription) {
      const listeners = new Set<(event: unknown) => void>();
      const receive = (event: unknown): void => {
        for (const callback of [...listeners]) {
          if (subscription?.receive !== receive) return;
          if (listeners.has(callback)) callback(event);
        }
      };
      subscription = { listeners, receive };
      subscriptions.set(type, subscription);
      listeners.add(callback);
      try { Reflect.apply(peer.on, peer, [type, receive]); }
      catch (error) { listeners.clear(); subscriptions.delete(type); throw error; }
    } else subscription.listeners.add(callback);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      subscription.listeners.delete(callback);
      if (subscription.listeners.size) return;
      if (subscriptions.get(type) !== subscription) return;
      subscriptions.delete(type);
      if (typeof peer.off === 'function') Reflect.apply(peer.off, peer, [type, subscription.receive]);
    };
  }
}

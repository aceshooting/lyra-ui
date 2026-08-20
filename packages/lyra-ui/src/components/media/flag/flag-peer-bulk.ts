import { loadBulkFlagUrl, setFlagUrlResolver, type LyraFlagUrlResolver } from './flag.js';

const peerResolver = loadBulkFlagUrl(() => import('@aceshooting/lyra-flags'));
setFlagUrlResolver(peerResolver);

/**
 * Register a bulk-resolution `@aceshooting/lyra-flags` resolver, backed by one shared
 * `flagUrls()` fetch instead of `flag-peer.js`'s per-code lazy resolution. Import this **instead
 * of** `flag-peer.js` — never both; the second `setFlagUrlResolver()` call simply replaces the
 * first — and only when the page renders most or all flags at once (a country table, a full
 * locale picker). A page rendering only a few flags pays an unneeded 249-entry fetch for no
 * benefit; use `flag-peer.js` there instead. `fidelity="compact"/"detailed"` on individual
 * `<lr-flag>` elements still resolves correctly (see `createFlagUrlResolver()`'s own doc in
 * `@aceshooting/lyra-flags`) — only the default (`"standard"`) tier is bulk-fetched.
 */
export async function registerLyraFlagBulkPeer(): Promise<LyraFlagUrlResolver | null> {
  return peerResolver;
}

void registerLyraFlagBulkPeer();

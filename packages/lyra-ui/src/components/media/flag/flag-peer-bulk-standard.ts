import { loadBulkFlagUrl, setFlagUrlResolver, type LyraFlagUrlResolver } from './flag.js';

const peerResolver = loadBulkFlagUrl(() => import('@aceshooting/lyra-flags/standard'));
setFlagUrlResolver(peerResolver);

/**
 * Register the bulk-resolution `@aceshooting/lyra-flags` resolver through that package's
 * tier-committed `./standard` entry — the pairing of `flag-peer-bulk.js`'s one-shared-fetch
 * batching with `./standard`'s one-tier module graph. Import this entry **instead of**
 * `flag-peer.js` or `flag-peer-bulk.js`, never alongside either: each `setFlagUrlResolver()` call
 * simply replaces the previous resolver, so importing two entries just makes whichever loaded last
 * win.
 *
 * Use it when both conditions hold: the page renders most or all flags at once (a country table, a
 * full locale picker), *and* every `<lr-flag>` stays on the default `fidelity="standard"`.
 * `flag-peer-bulk.js` reaches the same batching through the peer package's root entry, which
 * statically imports all three fidelity tiers' generated loader maps so its `flagUrl()` can honour
 * a per-call variant — so a bundler emits the detailed and compact tiers' whole lazy-chunk graph
 * even though bulk resolution only ever reads the standard-tier eager map. On a real production
 * build with a 156-country flag column, that difference was +15.8MB of emitted assets (+65 detailed
 * SVGs, +31 compact WebPs) that no route rendered.
 *
 * The tradeoff this entry makes in exchange: it is committed to one tier, so `fidelity="compact"`
 * or `fidelity="detailed"` on an individual element resolves to that code's *standard* asset
 * rather than reaching for a tier the registered resolver deliberately does not ship. That is a
 * silent visual no-op, not an error — for per-instance fidelity, import `flag-peer-bulk.js` (bulk,
 * all three tiers) or `flag-peer.js` (per-code lazy, all three tiers) instead.
 */
export async function registerLyraFlagStandardBulkPeer(): Promise<LyraFlagUrlResolver | null> {
  return peerResolver;
}

void registerLyraFlagStandardBulkPeer();

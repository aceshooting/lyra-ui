import { loadFlagUrl, setFlagUrlResolver, type FlagUrlResolver } from './flag.js';

const peerResolver = loadFlagUrl(() => import('@aceshooting/lyra-flags'));
setFlagUrlResolver(peerResolver);

/**
 * Register the optional `@aceshooting/lyra-flags` resolver for country and
 * language based flags. Import this entry explicitly when that feature is
 * used; the core Lyra barrel stays free of the optional asset graph.
 */
export async function registerLyraFlagPeer(): Promise<FlagUrlResolver | null> {
  return peerResolver;
}

void registerLyraFlagPeer();

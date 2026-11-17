import { expect } from '@open-wc/testing';
import { AUTOLOADER_OPTIONAL_PEERS } from './autoloader-manifest.js';
import { AUTOLOADER_TAGS, type AutoloadableTagName } from './autoloader-tags.js';
import { COMPONENT_LOADERS } from './component-loaders.generated.js';

const entries = Object.entries(COMPONENT_LOADERS) as ReadonlyArray<
  [AutoloadableTagName, () => Promise<CustomElementConstructor>]
>;

// The loader table is generated, so a broken entry never shows up as a compile error: a renamed or
// moved module leaves a literal import specifier that only fails at runtime, inside the one code
// path (the autoloader) a consumer reaches without importing the component itself. Executing every
// loader here is the only check that the generated specifiers and the named exports they reach for
// actually exist.
describe('autoloader manifest', () => {
  it('exposes exactly one loader per autoloadable tag', () => {
    const tags = entries.map(([tag]) => tag);
    expect(tags.length).to.equal(AUTOLOADER_TAGS.length);
    expect([...tags].sort()).to.deep.equal([...AUTOLOADER_TAGS].sort());
  });

  it('resolves every loader to a custom element constructor', async function () {
    // 280+ component modules, each pulling its own dependency subtree from the unbundled dev
    // server. Real consumers resolve one of these at a time from a bundle.
    this.timeout(180_000);

    const failures: string[] = [];
    // Keep at most 16 loaders pending: a library-wide burst starves the runner's transport on
    // slower workers. Each completed loader makes room for the next without a chunk barrier.
    const attempted: string[] = [];
    let nextIndex = 0;
    await Promise.all(
      Array.from({ length: Math.min(16, entries.length) }, async () => {
        while (true) {
          const entry = entries[nextIndex++];
          if (!entry) return;
          const [tag, load] = entry;
          attempted.push(tag);
          try {
            const constructor = await load();
            if (typeof constructor !== 'function') {
              failures.push(`${tag}: loader resolved to ${typeof constructor}`);
              continue;
            }
            // Never hand a live element class to chai as `actual`/`expected` -- serializing one
            // for a failure message hangs the whole file. Record a string instead.
            if (!(constructor.prototype instanceof HTMLElement)) {
              failures.push(`${tag}: loader resolved to a non-HTMLElement constructor`);
            }
          } catch (error) {
            failures.push(`${tag}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }),
    );

    expect(attempted.sort()).to.deep.equal(entries.map(([tag]) => tag).sort());
    expect(failures.sort()).to.deep.equal([]);
  });

  it('names optional peers as a sorted list of non-empty package names for known tags', () => {
    const failures: string[] = [];
    for (const [tag, peers] of Object.entries(AUTOLOADER_OPTIONAL_PEERS)) {
      if (!(AUTOLOADER_TAGS as readonly string[]).includes(tag)) failures.push(`${tag}: not an autoloadable tag`);
      if (!Array.isArray(peers) || peers.length === 0) {
        failures.push(`${tag}: optionalPeers must be a non-empty array`);
        continue;
      }
      for (const peer of peers) {
        if (typeof peer !== 'string' || peer.length === 0 || peer !== peer.trim()) {
          failures.push(`${tag}: invalid optional peer ${JSON.stringify(peer)}`);
        }
      }
      if ([...peers].sort().join('\u0000') !== peers.join('\u0000')) failures.push(`${tag}: optionalPeers is not sorted`);
    }
    expect(failures).to.deep.equal([]);
  });
});

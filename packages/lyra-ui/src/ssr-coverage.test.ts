import { expect } from '@open-wc/testing';
import {
  ROOT_BARREL_OPTIONAL_PEER_TAGS,
  ROOT_BARREL_TAGS,
} from './internal/root-registration-allowlist.js';
import {
  diagnoseLyraHydration,
  LYRA_SSR_AUDITED_STATIC_SAFE_TAGS,
  LYRA_SSR_CLIENT_RENDER_REASONS,
  LYRA_SSR_TAG_CAPABILITIES,
} from './ssr.js';

/** A duck-typed `ParentNode`: it exposes the query surface the API documents but carries neither an
 *  `ownerDocument` nor a document `nodeType`, so the owner realm must come from the ambient page. */
function duckTypedRoot(...children: Element[]): ParentNode {
  const fragment = document.createDocumentFragment();
  fragment.append(...children);
  return { querySelectorAll: (selector: string) => fragment.querySelectorAll(selector) } as unknown as ParentNode;
}

customElements.define(
  'lr-badge',
  class extends HTMLElement {
    readonly updateComplete = Promise.resolve();

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }
  },
);

describe('diagnoseLyraHydration with a root that has no owner document', () => {
  it('resolves hosts through the ambient registry', async () => {
    const badge = document.createElement('lr-badge');
    const diagnostics = await diagnoseLyraHydration(duckTypedRoot(badge));

    expect(diagnostics.length).to.equal(1);
    expect(diagnostics[0]?.tag).to.equal('lr-badge');
    expect(diagnostics[0]?.status).to.equal('ready');
    expect(diagnostics[0]?.element === badge).to.equal(true);
  });

  it('still resolves through the global registry when the ambient document has no window', async () => {
    const badge = document.createElement('lr-badge');
    const root = duckTypedRoot(badge);
    Object.defineProperty(document, 'defaultView', { configurable: true, get: () => null });
    let diagnostics: Awaited<ReturnType<typeof diagnoseLyraHydration>>;
    try {
      diagnostics = await diagnoseLyraHydration(root);
    } finally {
      Reflect.deleteProperty(document, 'defaultView');
    }

    expect(document.defaultView === window).to.equal(true);
    expect(diagnostics.length).to.equal(1);
    expect(diagnostics[0]?.status).to.equal('ready');
  });
});

describe('SSR classification tables', () => {
  const known = new Set<string>([...ROOT_BARREL_TAGS, ...ROOT_BARREL_OPTIONAL_PEER_TAGS]);

  it('only classify registered root tags', () => {
    const unknown = [
      ...Object.keys(LYRA_SSR_CLIENT_RENDER_REASONS),
      ...Object.keys(LYRA_SSR_TAG_CAPABILITIES),
      ...LYRA_SSR_AUDITED_STATIC_SAFE_TAGS,
    ].filter((tagName) => !known.has(tagName));
    expect(unknown).to.deep.equal([]);
  });

  it('never list a tag as both capability-bearing and audited static-safe', () => {
    const capable = new Set<string>(Object.keys(LYRA_SSR_TAG_CAPABILITIES));
    expect(LYRA_SSR_AUDITED_STATIC_SAFE_TAGS.filter((tagName) => capable.has(tagName))).to.deep.equal([]);
  });
});

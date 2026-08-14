import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import '../components/viewers/xml-viewer/xml-viewer.js';
import '../components/viewers/svg-viewer/svg-viewer.js';
import type { LyraXmlViewer } from '../components/viewers/xml-viewer/xml-viewer.js';
import type { LyraSvgViewer } from '../components/viewers/svg-viewer/svg-viewer.js';
import type { LyraAnchor } from '../components/viewers/document-viewer/anchors.js';
import type { LyraAnchorTarget } from './anchor-target.js';

/**
 * Contract-level regression for the `DocumentAnchorTarget` mixin's DEFAULT `scrollToAnchor()`
 * safety net (see `anchor-target.ts`'s `scrollToAnchor()`/`performScrollToAnchor()` split).
 *
 * Background: `anchor-target.ts` documents `scrollToAnchor()` as "always reports a definite
 * result" -- it must resolve to a boolean and emit `lr-anchor-result`, never reject silently. A
 * per-viewer `applyAnchor()` override throwing (a bug, a synchronous DOM exception, an unhandled
 * peer-library error) used to break that contract for every adopter except `lr-ebook-viewer`,
 * which handles failures via its own `scrollToAnchor()` override (see `ebook-viewer.test.ts`'s
 * "scrollToAnchor (ebook)" suite). A blanket try/catch around every `applyAnchor()` call site was
 * rejected because it makes that override's own catch -- which reports a localized
 * rendition-failure alert -- unreachable.
 *
 * This parameterized test covers the other adopters without duplicating a near-identical test in
 * every component file, following `viewer-owner-fetch.test.ts`'s multi-tag pattern. It deliberately
 * runs against real production adopter classes
 * (not just `anchor-target.test.ts`'s internal stub) via a temporary prototype monkeypatch of
 * `applyAnchor()`, restored after each case. `lr-ebook-viewer` is deliberately NOT a scenario
 * here -- it overrides `scrollToAnchor()` itself and must keep resolving through its own catch,
 * never this generic one; that invariant is covered separately in `ebook-viewer.test.ts`.
 */
interface ThrowSafetyScenario {
  readonly tag: string;
  readonly create: () => Promise<HTMLElement & LyraAnchorTarget>;
  readonly anchor: LyraAnchor;
}

const SCENARIOS: readonly ThrowSafetyScenario[] = [
  {
    tag: 'lr-xml-viewer',
    create: () => fixture<LyraXmlViewer>(html`<lr-xml-viewer></lr-xml-viewer>`),
    anchor: { kind: 'node-path', path: [0] },
  },
  {
    tag: 'lr-svg-viewer',
    create: () => fixture<LyraSvgViewer>(html`<lr-svg-viewer></lr-svg-viewer>`),
    anchor: { kind: 'region', rect: { x: 0, y: 0, width: 1, height: 1 } },
  },
];

describe('DocumentAnchorTarget contract: default scrollToAnchor() survives a throwing applyAnchor()', () => {
  for (const { tag, create, anchor } of SCENARIOS) {
    it(`<${tag}> resolves scrollToAnchor to false and still emits lr-anchor-result when applyAnchor throws`, async () => {
      const el = await create();
      const proto = Object.getPrototypeOf(el) as {
        applyAnchor: (target: LyraAnchor) => Promise<boolean>;
      };
      const originalApplyAnchor = proto.applyAnchor;
      proto.applyAnchor = async () => {
        throw new Error(`${tag} applyAnchor boom`);
      };
      try {
        const eventPromise = oneEvent(el, 'lr-anchor-result');
        const result = await el.scrollToAnchor(anchor);
        expect(result, `${tag} scrollToAnchor() must resolve, not reject`).to.be.false;
        const event = (await eventPromise) as CustomEvent<{ found: boolean }>;
        expect(event.detail, `${tag} lr-anchor-result detail`).to.deep.equal({ found: false });
      } finally {
        proto.applyAnchor = originalApplyAnchor;
      }
    });
  }
});

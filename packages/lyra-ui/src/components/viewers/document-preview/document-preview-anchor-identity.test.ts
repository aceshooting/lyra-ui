import { expect, fixture, html } from '@open-wc/testing';
import type { LyraAnchor, LyraHighlight } from '../document-viewer/anchors.js';
import type { LyraDocumentPreview } from './document-preview.class.js';
import './document-preview.js';

const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

function anchor(x = 10) {
  return { kind: 'region', rect: { x, y: 20, width: 15, height: 25 } } satisfies LyraAnchor;
}

async function preview(zoomable: boolean, highlights: readonly LyraHighlight[]): Promise<LyraDocumentPreview> {
  return fixture<LyraDocumentPreview>(html`<lr-document-preview
    mime-type="image/png" .src=${image} .zoomable=${zoomable}
    .highlights=${highlights}></lr-document-preview>`);
}

function recordScrolls(viewer: LyraDocumentPreview): string[] {
  const calls: string[] = [];
  for (const region of viewer.shadowRoot!.querySelectorAll<HTMLElement>('[part~="region-highlight"]')) {
    region.scrollIntoView = () => { calls.push(region.dataset['id']!); };
  }
  return calls;
}

for (const zoomable of [false, true]) {
  describe(`document preview anchor identity with zoomable=${zoomable}`, () => {
    it('prefers the original anchor identity when multiple highlights have equal geometry', async () => {
      const first = anchor(), second = anchor();
      const viewer = await preview(zoomable, [{ id: 'first', anchor: first }, { id: 'second', anchor: second }]);
      const calls = recordScrolls(viewer);
      expect(await viewer.scrollToAnchor(second)).to.equal(true);
      expect(await viewer.scrollToAnchor(first)).to.equal(true);
      expect(await viewer.scrollToAnchor(anchor())).to.equal(true);
      expect(calls).to.deep.equal(['second', 'first', 'first']);
    });

    it('keeps reference navigation bound to the captured rectangle after caller mutation', async () => {
      const original = anchor();
      const viewer = await preview(zoomable, [{ id: 'captured', anchor: original }]);
      const calls = recordScrolls(viewer);
      original.rect.x = 70;
      original.rect.width = Number.NaN;
      expect(await viewer.scrollToAnchor(original)).to.equal(true);
      expect(await viewer.scrollToAnchor(anchor())).to.equal(true);
      expect(await viewer.scrollToAnchor(anchor(70))).to.equal(false);
      expect(calls).to.deep.equal(['captured', 'captured']);
      expect(viewer.shadowRoot!.querySelector<HTMLElement>('[part~="region-highlight"]')!.style.left)
        .to.equal('10%');
    });

    it('uses exact ids containing selector punctuation for both identity and string navigation', async () => {
      const target = anchor();
      const id = 'region"[]:#.\\second';
      const viewer = await preview(zoomable, [{ id: 'other', anchor: anchor() }, { id, anchor: target }]);
      const calls = recordScrolls(viewer);
      expect(await viewer.scrollToAnchor(target)).to.equal(true);
      expect(await viewer.scrollToAnchor(id)).to.equal(true);
      expect(calls).to.deep.equal([id, id]);
    });

    it('does not navigate an ignored region by its original reference', async () => {
      const invalid = anchor();
      invalid.rect.width = -1;
      const viewer = await preview(zoomable, [{ id: 'invalid', anchor: invalid }, { id: 'valid', anchor: anchor() }]);
      const calls = recordScrolls(viewer);
      expect(await viewer.scrollToAnchor(invalid)).to.equal(false);
      expect(await viewer.scrollToAnchor('invalid')).to.equal(false);
      expect(await viewer.scrollToAnchor('valid')).to.equal(true);
      expect(calls).to.deep.equal(['valid']);
    });

    for (const status of ['converting', 'error'] as const) {
      it(`declines navigation while ${status} replaces the image and resumes after recovery`, async () => {
        const target = anchor();
        const viewer = await preview(zoomable, [{ id: 'target', anchor: target }]);
        const previousCalls = recordScrolls(viewer);
        viewer.status = status;
        expect(await viewer.scrollToAnchor(target)).to.equal(false);
        expect(previousCalls).to.deep.equal([]);
        expect(viewer.shadowRoot!.querySelectorAll('[part~="region-highlight"]').length).to.equal(0);
        viewer.status = 'ready';
        await viewer.updateComplete;
        const recoveredCalls = recordScrolls(viewer);
        expect(await viewer.scrollToAnchor(target)).to.equal(true);
        expect(recoveredCalls).to.deep.equal(['target']);
      });
    }
  });
}

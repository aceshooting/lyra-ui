import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './document-compare.js';
import type { LyraDocumentCompare } from './document-compare.js';
import type { LyraDocumentPreview } from '../document-preview/document-preview.class.js';
import { styles } from './document-compare.styles.js';

describe('lr-document-compare', () => {
  describe('view="diff" (default)', () => {
    it('renders an internal lr-diff-view forwarding oldVersion.text/newVersion.text', async () => {
      const el = (await fixture(html`
        <lr-document-compare
          .oldVersion=${{ id: 'v1', name: 'v1', text: 'a\nb' }}
          .newVersion=${{ id: 'v2', name: 'v2', text: 'a\nc' }}
        ></lr-document-compare>
      `)) as LyraDocumentCompare;
      expect(el.view).to.equal('diff');
      const diff = el.shadowRoot!.querySelector('lr-diff-view') as HTMLElement & { oldText: string; newText: string };
      expect(diff).to.exist;
      expect(diff.oldText).to.equal('a\nb');
      expect(diff.newText).to.equal('a\nc');
      expect(el.shadowRoot!.querySelector('[part="panes"]')).to.not.exist;
    });

    it('treats a missing oldVersion/newVersion as empty diff text rather than throwing', async () => {
      const el = (await fixture(html`<lr-document-compare></lr-document-compare>`)) as LyraDocumentCompare;
      const diff = el.shadowRoot!.querySelector('lr-diff-view') as HTMLElement & { oldText: string; newText: string };
      expect(diff.oldText).to.equal('');
      expect(diff.newText).to.equal('');
    });

    it('forwards diff-layout, copyable, language, and languages to the internal lr-diff-view', async () => {
      const el = (await fixture(html`
        <lr-document-compare
          diff-layout="split"
          copyable
          language="js"
          .languages=${{ js: {} }}
          .oldVersion=${{ id: 'v1', name: 'v1', text: 'a' }}
          .newVersion=${{ id: 'v2', name: 'v2', text: 'b' }}
        ></lr-document-compare>
      `)) as LyraDocumentCompare;
      const diff = el.shadowRoot!.querySelector('lr-diff-view') as HTMLElement & {
        layout: string;
        copyable: boolean;
        language: string;
        languages: unknown;
      };
      expect(diff.layout).to.equal('split');
      expect(diff.copyable).to.be.true;
      expect(diff.language).to.equal('js');
      expect(diff.languages).to.deep.equal({ js: {} });
    });

    it('bubbles lr-copy unchanged from the internal lr-diff-view', async () => {
      const el = (await fixture(html`
        <lr-document-compare
          copyable
          .oldVersion=${{ id: 'v1', name: 'v1', text: 'a' }}
          .newVersion=${{ id: 'v2', name: 'v2', text: 'b' }}
        ></lr-document-compare>
      `)) as LyraDocumentCompare;
      await el.updateComplete;
      const button = el.shadowRoot!.querySelector('lr-diff-view')!.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement;
      setTimeout(() => button.click());
      const ev = await oneEvent(el, 'lr-copy');
      expect(ev.detail.text).to.equal('- a\n+ b');
    });
  });

  describe('view="side-by-side"', () => {
    it('renders pane-old/pane-new, each wrapping an lr-document-preview fed from oldVersion/newVersion', async () => {
      const el = (await fixture(html`
        <lr-document-compare
          view="side-by-side"
          .oldVersion=${{ id: 'v1', name: 'Draft', mimeType: 'image/png', uri: 'https://example.test/a.png' }}
          .newVersion=${{ id: 'v2', name: 'Final', mimeType: 'image/png', uri: 'https://example.test/b.png' }}
        ></lr-document-compare>
      `)) as LyraDocumentCompare;
      await el.updateComplete;
      const paneOld = el.shadowRoot!.querySelector('[part="pane-old"]')!;
      const paneNew = el.shadowRoot!.querySelector('[part="pane-new"]')!;
      const previewOld = paneOld.querySelector('lr-document-preview') as LyraDocumentPreview;
      const previewNew = paneNew.querySelector('lr-document-preview') as LyraDocumentPreview;
      expect(previewOld.name).to.equal('Draft');
      expect(previewOld.mimeType).to.equal('image/png');
      expect(previewOld.src).to.equal('https://example.test/a.png');
      expect(previewNew.name).to.equal('Final');
      expect(previewNew.src).to.equal('https://example.test/b.png');
      expect(el.shadowRoot!.querySelector('lr-diff-view')).to.not.exist;
    });

    it('labels each pane from version.name, falling back to version.version, then a localized default', async () => {
      const el = (await fixture(html`
        <lr-document-compare
          view="side-by-side"
          .oldVersion=${{ id: 'v1', name: '', version: 'rev-3' }}
        ></lr-document-compare>
      `)) as LyraDocumentCompare;
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('[part="pane-old"]')!.getAttribute('aria-label')).to.equal('rev-3');
      expect(el.shadowRoot!.querySelector('[part="pane-new"]')!.getAttribute('aria-label')).to.equal('New version');
    });

    it('renders a placeholder pane when oldVersion/newVersion is unset, instead of an empty lr-document-preview', async () => {
      const el = (await fixture(html`<lr-document-compare view="side-by-side"></lr-document-compare>`)) as LyraDocumentCompare;
      await el.updateComplete;
      const paneOld = el.shadowRoot!.querySelector('[part="pane-old"]')!;
      expect(paneOld.querySelector('lr-document-preview')).to.not.exist;
      expect(paneOld.querySelector('[part="pane-empty"]')).to.exist;
    });

    it('falls back to the built-in English pane labels and honors a strings override', async () => {
      const el = (await fixture(html`<lr-document-compare view="side-by-side"></lr-document-compare>`)) as LyraDocumentCompare;
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('[part="pane-old"]')!.getAttribute('aria-label')).to.equal('Old version');
      expect(el.shadowRoot!.querySelector('[part="pane-new"]')!.getAttribute('aria-label')).to.equal('New version');
      el.strings = { documentCompareOldVersion: 'Version précédente' };
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('[part="pane-old"]')!.getAttribute('aria-label')).to.equal('Version précédente');
    });
  });

  describe('scroll sync', () => {
    async function sideBySideFixture(syncScroll = true): Promise<LyraDocumentCompare> {
      const el = (await fixture(html`
        <lr-document-compare
          view="side-by-side"
          .syncScroll=${syncScroll}
          .oldVersion=${{ id: 'v1', name: 'Old', mimeType: 'application/octet-stream' }}
          .newVersion=${{ id: 'v2', name: 'New', mimeType: 'application/octet-stream' }}
        ></lr-document-compare>
      `)) as LyraDocumentCompare;
      await el.updateComplete;
      const paneOld = el.shadowRoot!.querySelector('[part="pane-old"]') as HTMLElement;
      const paneNew = el.shadowRoot!.querySelector('[part="pane-new"]') as HTMLElement;
      const previewOld = paneOld.querySelector('lr-document-preview') as HTMLElement;
      const previewNew = paneNew.querySelector('lr-document-preview') as HTMLElement;
      paneOld.style.maxBlockSize = '100px';
      paneNew.style.maxBlockSize = '100px';
      previewOld.style.minBlockSize = '600px';
      previewNew.style.minBlockSize = '300px';
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return el;
    }

    it('defaults syncScroll to true', async () => {
      const el = (await fixture(html`<lr-document-compare></lr-document-compare>`)) as LyraDocumentCompare;
      expect(el.syncScroll).to.be.true;
    });

    it('proportionally mirrors scroll position from pane-old to pane-new by default', async () => {
      const el = await sideBySideFixture();
      const paneOld = el.shadowRoot!.querySelector('[part="pane-old"]') as HTMLElement;
      const paneNew = el.shadowRoot!.querySelector('[part="pane-new"]') as HTMLElement;
      const oldMax = paneOld.scrollHeight - paneOld.clientHeight;
      const newMax = paneNew.scrollHeight - paneNew.clientHeight;
      expect(oldMax).to.be.greaterThan(0);
      expect(newMax).to.be.greaterThan(0);

      paneOld.scrollTop = oldMax; // scroll old pane fully to the end (fraction = 1)
      paneOld.dispatchEvent(new Event('scroll'));
      expect(paneNew.scrollTop).to.be.closeTo(newMax, 1);
    });

    it('mirrors scroll position from pane-new to pane-old too', async () => {
      const el = await sideBySideFixture();
      const paneOld = el.shadowRoot!.querySelector('[part="pane-old"]') as HTMLElement;
      const paneNew = el.shadowRoot!.querySelector('[part="pane-new"]') as HTMLElement;
      const oldMax = paneOld.scrollHeight - paneOld.clientHeight;
      const newMax = paneNew.scrollHeight - paneNew.clientHeight;

      paneNew.scrollTop = newMax * 0.5;
      paneNew.dispatchEvent(new Event('scroll'));
      expect(paneOld.scrollTop).to.be.closeTo(oldMax * 0.5, 2);
    });

    it('does not mirror scroll position when syncScroll is set to false', async () => {
      const el = await sideBySideFixture(false);
      expect(el.syncScroll).to.be.false;
      const paneOld = el.shadowRoot!.querySelector('[part="pane-old"]') as HTMLElement;
      const paneNew = el.shadowRoot!.querySelector('[part="pane-new"]') as HTMLElement;
      const oldMax = paneOld.scrollHeight - paneOld.clientHeight;

      paneOld.scrollTop = oldMax;
      paneOld.dispatchEvent(new Event('scroll'));
      expect(paneNew.scrollTop).to.equal(0);
    });

    it('suppresses the immediate echo so mirroring pane-old -> pane-new does not bounce back to pane-old', async () => {
      const el = await sideBySideFixture();
      const paneOld = el.shadowRoot!.querySelector('[part="pane-old"]') as HTMLElement;
      const paneNew = el.shadowRoot!.querySelector('[part="pane-new"]') as HTMLElement;
      const oldMax = paneOld.scrollHeight - paneOld.clientHeight;

      paneOld.scrollTop = oldMax;
      paneOld.dispatchEvent(new Event('scroll'));
      // The programmatic scrollTop assignment above synchronously fires pane-new's own 'scroll'
      // listener too (real browser behavior) -- without a suppression guard that would bounce a
      // second, fraction-based write back onto pane-old and drift it away from `oldMax`.
      paneNew.dispatchEvent(new Event('scroll'));
      expect(paneOld.scrollTop).to.equal(oldMax);
    });
  });

  describe('synchronized highlight anchors (side-by-side)', () => {
    const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

    function highlightsFixture(): Promise<LyraDocumentCompare> {
      return fixture(html`
        <lr-document-compare
          view="side-by-side"
          .oldVersion=${{
            id: 'v1',
            name: 'Old',
            mimeType: 'image/png',
            uri: PIXEL,
            highlights: [{ id: 'h1', anchor: { kind: 'region', rect: { x: 10, y: 10, width: 20, height: 20 } } }],
          }}
          .newVersion=${{
            id: 'v2',
            name: 'New',
            mimeType: 'image/png',
            uri: PIXEL,
            highlights: [{ id: 'h1', anchor: { kind: 'region', rect: { x: 40, y: 40, width: 20, height: 20 } } }],
          }}
        ></lr-document-compare>
      `);
    }

    it('scrolls the matching highlight on the other pane when a highlight is activated', async () => {
      const el = await highlightsFixture();
      await el.updateComplete;
      const previewOld = el.shadowRoot!.querySelector('[part="pane-old"] lr-document-preview') as LyraDocumentPreview;
      const previewNew = el.shadowRoot!.querySelector('[part="pane-new"] lr-document-preview') as LyraDocumentPreview;
      let calledWith: unknown;
      previewNew.scrollToAnchor = async (target: unknown) => {
        calledWith = target;
        return true;
      };
      const region = previewOld.shadowRoot!.querySelector('[part="region-highlight"]') as HTMLElement;
      region.click();
      expect(calledWith).to.equal('h1');
    });

    it('does nothing on the other pane when no highlight with the same id exists there', async () => {
      const el = await highlightsFixture();
      await el.updateComplete;
      // Mutate the source-of-truth `newVersion` prop itself (not the child element directly) --
      // document-compare's own id-match check reads `this.newVersion.highlights`, and a render
      // cascades the new value down to the child, so this is the realistic way a host would
      // change which highlights are matchable.
      el.newVersion = {
        ...el.newVersion,
        highlights: [{ id: 'other-id', anchor: { kind: 'region', rect: { x: 0, y: 0, width: 5, height: 5 } } }],
      };
      await el.updateComplete;
      const previewOld = el.shadowRoot!.querySelector('[part="pane-old"] lr-document-preview') as LyraDocumentPreview;
      const previewNew = el.shadowRoot!.querySelector('[part="pane-new"] lr-document-preview') as LyraDocumentPreview;
      let called = false;
      previewNew.scrollToAnchor = async () => {
        called = true;
        return true;
      };
      const region = previewOld.shadowRoot!.querySelector('[part="region-highlight"]') as HTMLElement;
      region.click();
      expect(called).to.be.false;
    });

    it('bubbles lr-highlight-activate unchanged (detail: {id}) up through lr-document-compare', async () => {
      const el = await highlightsFixture();
      await el.updateComplete;
      const previewOld = el.shadowRoot!.querySelector('[part="pane-old"] lr-document-preview') as LyraDocumentPreview;
      const region = previewOld.shadowRoot!.querySelector('[part="region-highlight"]') as HTMLElement;
      setTimeout(() => region.click());
      const ev = await oneEvent(el, 'lr-highlight-activate');
      expect(ev.detail).to.deep.equal({ id: 'h1' });
    });
  });

  describe('anchor property', () => {
    it('forwards a shared anchor to both panes scrollToAnchor() in side-by-side view', async () => {
      const el = (await fixture(html`
        <lr-document-compare
          view="side-by-side"
          .oldVersion=${{ id: 'v1', name: 'Old', mimeType: 'image/png', uri: 'https://example.test/a.png' }}
          .newVersion=${{ id: 'v2', name: 'New', mimeType: 'image/png', uri: 'https://example.test/b.png' }}
        ></lr-document-compare>
      `)) as LyraDocumentCompare;
      await el.updateComplete;
      const previewOld = el.shadowRoot!.querySelector('[part="pane-old"] lr-document-preview') as LyraDocumentPreview;
      const previewNew = el.shadowRoot!.querySelector('[part="pane-new"] lr-document-preview') as LyraDocumentPreview;
      const calls: unknown[] = [];
      previewOld.scrollToAnchor = async (t: unknown) => {
        calls.push(['old', t]);
        return true;
      };
      previewNew.scrollToAnchor = async (t: unknown) => {
        calls.push(['new', t]);
        return true;
      };
      el.anchor = 'shared-id';
      await el.updateComplete;
      expect(calls).to.deep.equal([
        ['old', 'shared-id'],
        ['new', 'shared-id'],
      ]);
    });

    it('re-fires the anchor jump when the exact same anchor value is reassigned', async () => {
      const el = (await fixture(html`
        <lr-document-compare
          view="side-by-side"
          .oldVersion=${{ id: 'v1', name: 'Old' }}
          .newVersion=${{ id: 'v2', name: 'New' }}
        ></lr-document-compare>
      `)) as LyraDocumentCompare;
      await el.updateComplete;
      const previewOld = el.shadowRoot!.querySelector('[part="pane-old"] lr-document-preview') as LyraDocumentPreview;
      let calls = 0;
      previewOld.scrollToAnchor = async () => {
        calls++;
        return true;
      };
      el.anchor = 'same-id';
      await el.updateComplete;
      expect(calls).to.equal(1);
      el.anchor = 'same-id';
      await el.updateComplete;
      expect(calls).to.equal(2);
    });
  });

  describe('responsive and RTL', () => {
    it('stacks panes below 640px container width', async () => {
      const css = styles.cssText.replace(/\s+/g, ' ');
      expect(css).to.include('@container (max-inline-size: 639.98px)');
    });

    it('uses no hardcoded physical left/right in its stylesheet (logical properties only)', () => {
      const css = styles.cssText;
      expect(css).to.not.match(/[^-](left|right)\s*:/);
    });

    it('renders both panes under dir="rtl" without breaking', async () => {
      const wrapper = await fixture(html`
        <div dir="rtl">
          <lr-document-compare
            view="side-by-side"
            .oldVersion=${{ id: 'v1', name: 'Old' }}
            .newVersion=${{ id: 'v2', name: 'New' }}
          ></lr-document-compare>
        </div>
      `);
      const el = wrapper.querySelector('lr-document-compare') as LyraDocumentCompare;
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('[part="pane-old"]')).to.exist;
      expect(el.shadowRoot!.querySelector('[part="pane-new"]')).to.exist;
    });
  });

  describe('accessibility', () => {
    it('is accessible in diff view', async () => {
      const el = await fixture(html`
        <lr-document-compare
          .oldVersion=${{ id: 'v1', name: 'v1', text: 'a\nb' }}
          .newVersion=${{ id: 'v2', name: 'v2', text: 'a\nc' }}
        ></lr-document-compare>
      `);
      await expect(el).to.be.accessible();
    });

    it('is accessible in populated side-by-side view, including region highlights', async () => {
      const el = await fixture(html`
        <lr-document-compare
          view="side-by-side"
          .oldVersion=${{
            id: 'v1',
            name: 'Old',
            mimeType: 'image/png',
            uri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
            highlights: [{ id: 'h1', label: 'Changed', anchor: { kind: 'region', rect: { x: 10, y: 10, width: 20, height: 20 } } }],
          }}
          .newVersion=${{ id: 'v2', name: 'New', mimeType: 'text/plain' }}
        ></lr-document-compare>
      `);
      await el.updateComplete;
      await expect(el).to.be.accessible();
    });
  });
});

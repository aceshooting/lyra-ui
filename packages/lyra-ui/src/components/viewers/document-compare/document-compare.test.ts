import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import jsGrammar from 'shiki/langs/javascript.mjs';
import './document-compare.js';
import type { LyraDocumentCompare } from './document-compare.js';
import type { LyraDocumentPreview } from '../document-preview/document-preview.class.js';
import { styles } from './document-compare.styles.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

function stubClipboard(target: Navigator, value: unknown): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(target, 'clipboard');
  Object.defineProperty(target, 'clipboard', { configurable: true, value });
  return () => {
    if (descriptor) Object.defineProperty(target, 'clipboard', descriptor);
    else Reflect.deleteProperty(target, 'clipboard');
  };
}

describe('lr-document-compare', () => {
  it('normalizes unsupported view and diff-layout attributes and untyped property writes', async () => {
    const el = (await fixture(html`
      <lr-document-compare view="columns" diff-layout="columns"></lr-document-compare>
    `)) as LyraDocumentCompare;
    expect(el.view).to.equal('diff');
    expect(el.getAttribute('view')).to.equal('diff');
    expect(el.diffLayout).to.equal('unified');
    expect(el.getAttribute('diff-layout')).to.equal('unified');

    el.view = 'side-by-side';
    el.diffLayout = 'split';
    await el.updateComplete;
    const foreign = el as unknown as Record<string, unknown>;
    foreign.view = 'columns';
    foreign.diffLayout = 'columns';
    await el.updateComplete;
    expect(el.view).to.equal('diff');
    expect(el.getAttribute('view')).to.equal('diff');
    expect(el.diffLayout).to.equal('unified');
    expect(el.getAttribute('diff-layout')).to.equal('unified');
    expect(el.shadowRoot!.querySelector('lr-diff-view')).to.not.equal(null);
  });

  it('makes a nonempty host aria-label the sole semantic owner and restores the shadow group dynamically', async () => {
    const el = (await fixture(html`
      <lr-document-compare aria-label="Release comparison"></lr-document-compare>
    `)) as LyraDocumentCompare;
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(el.getAttribute('aria-label')).to.equal('Release comparison');
    expect(base.hasAttribute('role')).to.be.false;
    expect(base.hasAttribute('aria-label')).to.be.false;

    el.setAttribute('aria-label', '');
    await el.updateComplete;
    expect(base.getAttribute('role')).to.equal('group');
    expect(base.getAttribute('aria-label')).to.equal('');

    el.removeAttribute('aria-label');
    await el.updateComplete;
    expect(base.getAttribute('role')).to.equal('group');
    expect(base.getAttribute('aria-label')).to.equal('Document comparison');
  });

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
      expect((diff) != null).to.equal(true);
      expect(diff.oldText).to.equal('a\nb');
      expect(diff.newText).to.equal('a\nc');
      expect((el.shadowRoot!.querySelector('[part="panes"]')) == null).to.be.true;
    });

    it('treats a missing oldVersion/newVersion as empty diff text rather than throwing', async () => {
      const el = (await fixture(html`<lr-document-compare></lr-document-compare>`)) as LyraDocumentCompare;
      const diff = el.shadowRoot!.querySelector('lr-diff-view') as HTMLElement & { oldText: string; newText: string };
      expect(diff.oldText).to.equal('');
      expect(diff.newText).to.equal('');
    });

    it('preserves an explicitly empty host aria-label on the comparison group', async () => {
      const el = (await fixture(html`<lr-document-compare aria-label=""></lr-document-compare>`)) as LyraDocumentCompare;
      const base = el.shadowRoot!.querySelector('[part="base"]')!;
      expect(base.hasAttribute('aria-label')).to.be.true;
      expect(base.getAttribute('aria-label')).to.equal('');
    });

    it('forwards diff-layout, copyable, language, and languages to the internal lr-diff-view', async () => {
      const el = (await fixture(html`
        <lr-document-compare
          diff-layout="split"
          copyable
          language="js"
          .languages=${{ js: jsGrammar }}
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
      expect(diff.languages).to.deep.equal({ js: jsGrammar });
    });

    it('bubbles lr-copy unchanged from the internal lr-diff-view', async () => {
      const restoreClipboard = stubClipboard(navigator, { writeText: () => Promise.resolve() });
      try {
        const el = (await fixture(html`
          <lr-document-compare
            copyable
            .oldVersion=${{ id: 'v1', name: 'v1', text: 'a' }}
            .newVersion=${{ id: 'v2', name: 'v2', text: 'b' }}
          ></lr-document-compare>
        `)) as LyraDocumentCompare;
        await el.updateComplete;
        const diff = el.shadowRoot!.querySelector('lr-diff-view') as HTMLElement & {
          updateComplete: Promise<unknown>;
        };
        await diff.updateComplete;
        const copied = oneEvent(el, 'lr-copy');
        (diff.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement).click();
        const event = await copied;
        expect(event.detail).to.deep.equal({ ok: true, text: '- a\n+ b' });
        expect(Object.isFrozen(event.detail)).to.equal(true);
      } finally {
        restoreClipboard();
      }
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
      expect(previewOld.filename).to.equal('Draft');
      expect(previewOld.mimeType).to.equal('image/png');
      expect(previewOld.src).to.equal('https://example.test/a.png');
      expect(previewNew.filename).to.equal('Final');
      expect(previewNew.src).to.equal('https://example.test/b.png');
      expect((el.shadowRoot!.querySelector('lr-diff-view')) == null).to.be.true;
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
      expect((paneOld.querySelector('lr-document-preview')) == null).to.be.true;
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

    it('honors the plain HTML attribute form sync-scroll="false"', async () => {
      const el = (await fixture(html`<lr-document-compare sync-scroll="false"></lr-document-compare>`)) as LyraDocumentCompare;
      expect(el.syncScroll).to.be.false;
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

    it('resets both panes when one source identity changes while scroll sync is enabled', async () => {
      const el = await sideBySideFixture();
      const paneOld = el.shadowRoot!.querySelector('[part="pane-old"]') as HTMLElement;
      const paneNew = el.shadowRoot!.querySelector('[part="pane-new"]') as HTMLElement;
      paneOld.scrollTop = 60;
      paneNew.scrollTop = 40;
      el.oldVersion = { id: 'replacement', name: 'Replacement', mimeType: 'application/octet-stream' };
      await el.updateComplete;
      expect(paneOld.scrollTop).to.equal(0);
      expect(paneNew.scrollTop).to.equal(0);
    });

    it('resets only the replaced pane when scroll sync is disabled', async () => {
      const el = await sideBySideFixture(false);
      const paneOld = el.shadowRoot!.querySelector('[part="pane-old"]') as HTMLElement;
      const paneNew = el.shadowRoot!.querySelector('[part="pane-new"]') as HTMLElement;
      paneOld.scrollTop = 60;
      paneNew.scrollTop = 40;
      el.oldVersion = { id: 'replacement', name: 'Replacement', mimeType: 'application/octet-stream' };
      await el.updateComplete;
      expect(paneOld.scrollTop).to.equal(0);
      expect(paneNew.scrollTop).to.equal(40);
    });

    it('preserves reading position across a same-identity model refresh', async () => {
      const el = await sideBySideFixture(false);
      const paneOld = el.shadowRoot!.querySelector('[part="pane-old"]') as HTMLElement;
      const paneNew = el.shadowRoot!.querySelector('[part="pane-new"]') as HTMLElement;
      paneOld.scrollTop = 60;
      paneNew.scrollTop = 40;
      el.oldVersion = {
        id: 'v1',
        name: 'Old',
        mimeType: 'application/octet-stream',
        highlights: [{ id: 'fresh', anchor: { kind: 'region', rect: { x: 1, y: 1, width: 1, height: 1 } } }],
      };
      await el.updateComplete;
      expect(paneOld.scrollTop).to.equal(60);
      expect(paneNew.scrollTop).to.equal(40);
    });

    it('lets an active shared anchor win over source-replacement scroll reset', async () => {
      const el = await sideBySideFixture();
      const paneOld = el.shadowRoot!.querySelector('[part="pane-old"]') as HTMLElement;
      const paneNew = el.shadowRoot!.querySelector('[part="pane-new"]') as HTMLElement;
      const previewOld = paneOld.querySelector('lr-document-preview') as LyraDocumentPreview;
      const previewNew = paneNew.querySelector('lr-document-preview') as LyraDocumentPreview;
      paneOld.scrollTop = 60;
      paneNew.scrollTop = 40;
      let jumps = 0;
      previewOld.scrollToAnchor = async () => { jumps++; return true; };
      previewNew.scrollToAnchor = async () => { jumps++; return true; };
      el.anchor = 'target';
      el.oldVersion = { id: 'replacement', name: 'Replacement', mimeType: 'application/octet-stream' };
      await el.updateComplete;
      expect(jumps).to.equal(2);
      expect(paneOld.scrollTop).to.equal(60);
      expect(paneNew.scrollTop).to.equal(40);
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

    it('cancels a pending scroll-sync frame through its scheduling window when adopted', async () => {
      const el = await sideBySideFixture();
      const paneOld = el.shadowRoot!.querySelector('[part="pane-old"]') as HTMLElement;
      const paneNew = el.shadowRoot!.querySelector('[part="pane-new"]') as HTMLElement;
      Object.defineProperties(paneOld, {
        scrollHeight: { configurable: true, value: 600 },
        clientHeight: { configurable: true, value: 100 },
      });
      Object.defineProperties(paneNew, {
        scrollHeight: { configurable: true, value: 300 },
        clientHeight: { configurable: true, value: 100 },
      });
      const oldMax = paneOld.scrollHeight - paneOld.clientHeight;
      const iframe = document.createElement('iframe');
      document.body.append(iframe);
      const frameDocument = iframe.contentDocument!;
      const frameWindow = iframe.contentWindow!;
      const originalRequest = window.requestAnimationFrame;
      const originalCancel = window.cancelAnimationFrame;
      const originalFrameRequest = frameWindow.requestAnimationFrame;
      const originalFrameCancel = frameWindow.cancelAnimationFrame;
      const cancelled: number[] = [];
      let nextHandle = 500;
      let frameRequests = 0;
      window.requestAnimationFrame = (() => ++nextHandle) as typeof window.requestAnimationFrame;
      window.cancelAnimationFrame = ((handle: number) => { cancelled.push(handle); }) as typeof window.cancelAnimationFrame;
      frameWindow.requestAnimationFrame = (() => {
        frameRequests++;
        return ++nextHandle;
      }) as typeof frameWindow.requestAnimationFrame;
      frameWindow.cancelAnimationFrame = (() => undefined) as typeof frameWindow.cancelAnimationFrame;
      try {
        paneOld.scrollTop = oldMax;
        paneOld.dispatchEvent(new Event('scroll'));
        const oldOwnerHandle = nextHandle;

        frameDocument.body.append(el);
        expect(cancelled).to.include(oldOwnerHandle);

        // Adoption must also clear the suppression guard so a scroll in the new document can
        // schedule against that document's animation clock.
        const frameRequestsBeforeScroll = frameRequests;
        paneOld.scrollTop = oldMax * 0.5;
        paneOld.dispatchEvent(new frameWindow.Event('scroll'));
        expect(frameRequests).to.equal(frameRequestsBeforeScroll + 1);
      } finally {
        el.remove();
        window.requestAnimationFrame = originalRequest;
        window.cancelAnimationFrame = originalCancel;
        frameWindow.requestAnimationFrame = originalFrameRequest;
        frameWindow.cancelAnimationFrame = originalFrameCancel;
        iframe.remove();
      }
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
      const target = previewOld.shadowRoot!.querySelector('[part="region-highlight-target"]') as HTMLButtonElement;
      target.click();
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
      const target = previewOld.shadowRoot!.querySelector('[part="region-highlight-target"]') as HTMLButtonElement;
      target.click();
      expect(called).to.be.false;
    });

    it('bubbles lr-highlight-activate unchanged (detail: {highlightId}) up through lr-document-compare', async () => {
      const el = await highlightsFixture();
      await el.updateComplete;
      const previewOld = el.shadowRoot!.querySelector('[part="pane-old"] lr-document-preview') as LyraDocumentPreview;
      const target = previewOld.shadowRoot!.querySelector('[part="region-highlight-target"]') as HTMLButtonElement;
      setTimeout(() => target.click());
      const ev = await oneEvent(el, 'lr-highlight-activate');
      expect(ev.detail).to.deep.equal({ highlightId: 'h1' });
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

    it('applies an existing anchor when a version arrives or is replaced later', async () => {
      const el = (await fixture(html`
        <lr-document-compare
          view="side-by-side"
          .oldVersion=${{ id: 'v1', name: 'Old' }}
        ></lr-document-compare>
      `)) as LyraDocumentCompare;
      await el.updateComplete;
      const preview = el.shadowRoot!.querySelector('lr-document-preview') as LyraDocumentPreview;
      const prototype = Object.getPrototypeOf(preview) as {
        scrollToAnchor(target: unknown): Promise<boolean>;
      };
      const original = prototype.scrollToAnchor;
      const calls: string[] = [];
      prototype.scrollToAnchor = async function (this: LyraDocumentPreview): Promise<boolean> {
        calls.push(this.filename);
        return true;
      };
      try {
        el.anchor = 'shared-id';
        await el.updateComplete;
        calls.length = 0;

        el.newVersion = { id: 'v2', name: 'New' };
        await el.updateComplete;
        expect(calls).to.include('New');

        calls.length = 0;
        el.oldVersion = { id: 'v3', name: 'Replacement' };
        await el.updateComplete;
        expect(calls).to.include('Replacement');
      } finally {
        prototype.scrollToAnchor = original;
      }
    });
  });

  describe('responsive and RTL', () => {
    it('paints a rendered hover treatment on each keyboard-focusable pane', async () => {
      const el = (await fixture(html`
        <lr-document-compare
          view="side-by-side"
          .oldVersion=${{ id: 'old', name: 'Old', text: 'before' }}
          .newVersion=${{ id: 'new', name: 'New', text: 'after' }}
        ></lr-document-compare>
      `)) as LyraDocumentCompare;
      const pane = el.shadowRoot!.querySelector('[part="pane-old"]') as HTMLElement;
      const before = getComputedStyle(pane).borderColor;
      const rect = pane.getBoundingClientRect();
      try {
        await sendMouse({
          type: 'move',
          position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
        });
        expect(getComputedStyle(pane).borderColor).to.not.equal(before);
      } finally {
        await resetMouse();
      }
    });

    it('stacks panes below 640px container width', async () => {
      const wrap = await fixture(html`
        <div style="inline-size:320px;">
          <lr-document-compare
            view="side-by-side"
            .oldVersion=${{ id: 'v1', name: 'Old', text: 'a' }}
            .newVersion=${{ id: 'v2', name: 'New', text: 'b' }}
          ></lr-document-compare>
        </div>
      `);
      const narrow = wrap.querySelector('lr-document-compare') as LyraDocumentCompare;
      await narrow.updateComplete;
      const panes = narrow.shadowRoot!.querySelector('[part="panes"]') as HTMLElement;
      expect(getComputedStyle(panes).flexDirection).to.equal('column');

      // Control: the same part at the default (wide) allocation stays a row.
      const wide = (await fixture(html`
        <lr-document-compare
          view="side-by-side"
          .oldVersion=${{ id: 'v1', name: 'Old', text: 'a' }}
          .newVersion=${{ id: 'v2', name: 'New', text: 'b' }}
        ></lr-document-compare>
      `)) as LyraDocumentCompare;
      await wide.updateComplete;
      const widePanes = wide.shadowRoot!.querySelector('[part="panes"]') as HTMLElement;
      expect(getComputedStyle(widePanes).flexDirection).to.equal('row');
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

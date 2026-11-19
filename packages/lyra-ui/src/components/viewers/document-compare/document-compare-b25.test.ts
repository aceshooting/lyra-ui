import { aTimeout, expect, fixture, html } from '@open-wc/testing';
import './document-compare.js';
import type { LyraDocumentCompare } from './document-compare.js';
import type { LyraDocumentPreview } from '../document-preview/document-preview.class.js';

const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

describe('lr-document-compare remediation', () => {
  it('lets a listener tell which pane a bubbling pane event came from', async () => {
    const el = await fixture<LyraDocumentCompare>(html`
      <lr-document-compare view="side-by-side" .oldVersion=${{ id: 'a', name: 'a.png' }} .newVersion=${{ id: 'b', name: 'b.png' }}></lr-document-compare>
    `);
    let side: string | null = null;
    el.addEventListener('lr-highlight-activate', (event) => {
      const pane = event.composedPath().find((node) => node instanceof Element && /^pane-(old|new)$/.test(node.getAttribute('part') ?? ''));
      side = pane instanceof Element ? pane.getAttribute('part') : null;
    });
    const panes = el.shadowRoot!.querySelectorAll<LyraDocumentPreview>('lr-document-preview');
    panes[1]!.dispatchEvent(new CustomEvent('lr-highlight-activate', { bubbles: true, composed: true, detail: { highlightId: 'x' } }));
    expect(side).to.equal('pane-new');
  });

  it('caps the diff view block size with max-height in view="diff"', async () => {
    const lines = Array.from({ length: 200 }, (_, i) => `line ${i}`).join('\n');
    const el = await fixture<LyraDocumentCompare>(html`
      <lr-document-compare max-height="120px" .oldVersion=${{ id: 'a', text: lines }} .newVersion=${{ id: 'b', text: `${lines}\nmore` }}></lr-document-compare>
    `);
    const diff = el.shadowRoot!.querySelector<HTMLElement & { updateComplete: Promise<boolean> }>('[part="diff"]')!;
    await diff.updateComplete;
    const base = diff.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    expect(getComputedStyle(base).maxHeight).to.equal('120px');
  });

  it('forwards contextLines and languageLoaders to the diff view', async () => {
    const loaders = { demo: () => Promise.resolve([]) };
    const el = await fixture<LyraDocumentCompare>(html`
      <lr-document-compare context-lines="2" .languageLoaders=${loaders} .oldVersion=${{ id: 'a', text: 'x' }} .newVersion=${{ id: 'b', text: 'y' }}></lr-document-compare>
    `);
    const diff = el.shadowRoot!.querySelector('[part="diff"]') as unknown as { contextLines?: number; languageLoaders?: unknown };
    expect(diff.contextLines).to.equal(2);
    expect(diff.languageLoaders === loaders).to.equal(true);
  });

  it('marks the active highlight in both side-by-side panes', async () => {
    const el = await fixture<LyraDocumentCompare>(html`
      <lr-document-compare view="side-by-side" active-highlight-id="h1" .oldVersion=${{ id: 'a', name: 'a.png' }} .newVersion=${{ id: 'b', name: 'b.png' }}></lr-document-compare>
    `);
    const panes = [...el.shadowRoot!.querySelectorAll<LyraDocumentPreview>('lr-document-preview')];
    expect(panes.map((pane) => pane.activeHighlightId)).to.deep.equal(['h1', 'h1']);
    el.activeHighlightId = null;
    await el.updateComplete;
    expect(panes.map((pane) => pane.activeHighlightId)).to.deep.equal([null, null]);
  });

  it('names the two panes apart when both versions share one name', async () => {
    const el = await fixture<LyraDocumentCompare>(html`
      <lr-document-compare
        view="side-by-side"
        .oldVersion=${{ id: 'a', name: 'report.pdf' }}
        .newVersion=${{ id: 'b', name: 'report.pdf' }}
      ></lr-document-compare>
    `);
    const oldName = el.shadowRoot!.querySelector('[part="pane-old"]')!.getAttribute('aria-label');
    const newName = el.shadowRoot!.querySelector('[part="pane-new"]')!.getAttribute('aria-label');
    expect(oldName).to.not.equal(newName);
  });

  it('treats a whitespace-only version name as absent', async () => {
    const el = await fixture<LyraDocumentCompare>(html`
      <lr-document-compare view="side-by-side" .oldVersion=${{ id: 'a', name: '   ', version: 'rev-2' }}></lr-document-compare>
    `);
    expect(el.shadowRoot!.querySelector('[part="pane-old"]')!.getAttribute('aria-label')).to.equal('rev-2');
  });

  it('passes a stable highlights value to a pane without highlights across renders', async () => {
    const el = await fixture<LyraDocumentCompare>(html`
      <lr-document-compare view="side-by-side" .oldVersion=${{ id: 'a', name: 'A' }} .newVersion=${{ id: 'b', name: 'B' }}></lr-document-compare>
    `);
    const preview = el.shadowRoot!.querySelector<LyraDocumentPreview>('[part="pane-old"] lr-document-preview')!;
    const seen: unknown[] = [];
    const prototypeDescriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(preview), 'highlights')!;
    Object.defineProperty(preview, 'highlights', {
      configurable: true,
      get: () => prototypeDescriptor.get!.call(preview),
      set: (value: unknown) => {
        seen.push(value);
        prototypeDescriptor.set!.call(preview, value);
      },
    });
    el.oldVersion = { id: 'a', name: 'A2' };
    await el.updateComplete;
    el.oldVersion = { id: 'a', name: 'A3' };
    await el.updateComplete;
    expect(new Set(seen).size).to.be.at.most(1);
  });

  it('emits one anchor result for a side-by-side jump', async () => {
    const el = await fixture<LyraDocumentCompare>(html`
      <lr-document-compare
        view="side-by-side"
        .oldVersion=${{ id: 'a', name: 'Old', mimeType: 'image/png', uri: PIXEL, highlights: [{ id: 'h1', anchor: { kind: 'region', rect: { x: 10, y: 10, width: 20, height: 20 } } }] }}
        .newVersion=${{ id: 'b', name: 'New', mimeType: 'image/png', uri: PIXEL, highlights: [{ id: 'h1', anchor: { kind: 'region', rect: { x: 40, y: 40, width: 20, height: 20 } } }] }}
      ></lr-document-compare>
    `);
    const results: Array<{ found: boolean }> = [];
    el.addEventListener('lr-anchor-result', (event) => results.push((event as CustomEvent<{ found: boolean }>).detail));
    el.anchor = 'h1';
    await el.updateComplete;
    await aTimeout(100);
    expect(results).to.have.length(1);
    expect(results[0]!.found).to.equal(true);
  });
});

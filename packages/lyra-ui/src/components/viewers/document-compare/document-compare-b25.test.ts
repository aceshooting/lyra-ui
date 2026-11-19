import { aTimeout, expect, fixture, html } from '@open-wc/testing';
import './document-compare.js';
import type { LyraDocumentCompare } from './document-compare.js';
import type { LyraDocumentPreview } from '../document-preview/document-preview.class.js';

const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

describe('lr-document-compare remediation', () => {
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

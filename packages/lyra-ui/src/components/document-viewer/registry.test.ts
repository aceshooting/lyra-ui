import { expect } from '@open-wc/testing';
import {
  clearDocumentRenderers,
  findDocumentRenderer,
  getDefaultDocumentRendererRegistry,
  loadDocumentRenderer,
  registerDocumentRenderer,
  type DocumentFile,
  type DocumentRendererDefinition,
} from './registry.js';
import type { LyraAnchor, LyraHighlight } from './anchors.js';

const PDF_FILE: DocumentFile = {
  name: 'report.pdf',
  mimeType: 'application/pdf',
  src: 'https://example.test/report.pdf',
};
const CSV_FILE: DocumentFile = {
  name: 'data.csv',
  mimeType: 'application/octet-stream',
  src: 'https://example.test/data.csv',
};

afterEach(() => {
  clearDocumentRenderers();
});

describe('exact mimeType dispatch', () => {
  it('finds a renderer registered under an exact mimeType key', () => {
    const def: DocumentRendererDefinition = { render: () => 'pdf-output' };
    registerDocumentRenderer('application/pdf', def);
    expect(findDocumentRenderer(PDF_FILE)).to.equal(def);
  });

  it('returns undefined when nothing is registered', () => {
    expect(findDocumentRenderer(PDF_FILE)).to.be.undefined;
  });

  it('registering the same key twice overwrites the previous definition', () => {
    const first: DocumentRendererDefinition = { render: () => 'first' };
    const second: DocumentRendererDefinition = { render: () => 'second' };
    registerDocumentRenderer('application/pdf', first);
    registerDocumentRenderer('application/pdf', second);
    expect(findDocumentRenderer(PDF_FILE)).to.equal(second);
  });
});

describe('matches() shape-based fallback dispatch', () => {
  it('falls back to a matches() scan when no exact mimeType key matches', () => {
    const def: DocumentRendererDefinition = {
      matches: (file) => file.name.toLowerCase().endsWith('.csv'),
      render: () => 'csv-output',
    };
    registerDocumentRenderer('lyra:csv', def);
    expect(findDocumentRenderer(CSV_FILE)).to.equal(def);
  });

  it('an exact mimeType key match wins over a matches()-based entry', () => {
    const shapeDef: DocumentRendererDefinition = { matches: () => true, render: () => 'shape' };
    const exactDef: DocumentRendererDefinition = { render: () => 'exact' };
    registerDocumentRenderer('lyra:catch-all', shapeDef);
    registerDocumentRenderer('application/pdf', exactDef);
    expect(findDocumentRenderer(PDF_FILE)).to.equal(exactDef);
  });

  it('scans matches() entries in registration order, returning the first hit', () => {
    const first: DocumentRendererDefinition = { matches: () => true, render: () => 'first' };
    const second: DocumentRendererDefinition = { matches: () => true, render: () => 'second' };
    registerDocumentRenderer('lyra:first', first);
    registerDocumentRenderer('lyra:second', second);
    expect(findDocumentRenderer(CSV_FILE)).to.equal(first);
  });
});

describe('a custom registry (not the module-level default)', () => {
  it('dispatches against the passed-in registry instead of the default one', () => {
    const customRegistry = new Map<string, DocumentRendererDefinition>();
    const def: DocumentRendererDefinition = { render: () => 'custom' };
    customRegistry.set('application/pdf', def);
    expect(findDocumentRenderer(PDF_FILE, customRegistry)).to.equal(def);
    expect(findDocumentRenderer(PDF_FILE)).to.be.undefined;
  });

  it('getDefaultDocumentRendererRegistry() returns the same Map registerDocumentRenderer() writes to', () => {
    const def: DocumentRendererDefinition = { render: () => 'x' };
    registerDocumentRenderer('application/pdf', def);
    expect(getDefaultDocumentRendererRegistry().get('application/pdf')).to.equal(def);
  });
});

describe('loadDocumentRenderer()', () => {
  it('resolves a definition with no load() as itself', async () => {
    const def: DocumentRendererDefinition = { render: () => 'x' };
    expect(await loadDocumentRenderer(def)).to.equal(def);
  });

  it('resolves a lazy definition via its load() function', async () => {
    const resolved: DocumentRendererDefinition = { render: () => 'lazy-output' };
    const def: DocumentRendererDefinition = { load: () => Promise.resolve(resolved) };
    expect(await loadDocumentRenderer(def)).to.equal(resolved);
  });

  it('unwraps a { default } module-namespace shape from load()', async () => {
    const resolved: DocumentRendererDefinition = { render: () => 'lazy-output' };
    const def: DocumentRendererDefinition = { load: () => Promise.resolve({ default: resolved }) };
    expect(await loadDocumentRenderer(def)).to.equal(resolved);
  });

  it('calls load() at most once for the same definition, caching by identity', async () => {
    let callCount = 0;
    const def: DocumentRendererDefinition = {
      load: () => {
        callCount++;
        return Promise.resolve({ render: () => 'x' });
      },
    };
    await loadDocumentRenderer(def);
    await loadDocumentRenderer(def);
    expect(callCount).to.equal(1);
  });

  it('does not cache a rejected load(), so a later call retries', async () => {
    let callCount = 0;
    const def: DocumentRendererDefinition = {
      load: () => {
        callCount++;
        return callCount === 1 ? Promise.reject(new Error('boom')) : Promise.resolve({ render: () => 'x' });
      },
    };
    await loadDocumentRenderer(def).catch(() => {});
    const resolved = await loadDocumentRenderer(def);
    expect(callCount).to.equal(2);
    expect(resolved.render!(PDF_FILE)).to.equal('x');
  });
});

describe('clearDocumentRenderers()', () => {
  it('empties the default registry so a later test starts clean', () => {
    registerDocumentRenderer('application/pdf', { render: () => 'x' });
    clearDocumentRenderers();
    expect(getDefaultDocumentRendererRegistry().size).to.equal(0);
    expect(findDocumentRenderer(PDF_FILE)).to.be.undefined;
  });
});

describe('DocumentFile/DocumentRendererDefinition widening', () => {
  it('DocumentFile accepts anchor/highlights/alt as optional fields', () => {
    const anchor: LyraAnchor = { kind: 'page', page: 3 };
    const highlights: LyraHighlight[] = [{ id: 'cite-1', anchor }];
    const file: import('./registry.js').DocumentFile = {
      name: 'report.pdf',
      mimeType: 'application/pdf',
      src: 'https://example.test/report.pdf',
      anchor,
      highlights,
      alt: 'Annual report',
    };
    expect(file.anchor).to.deep.equal(anchor);
    expect(file.highlights).to.deep.equal(highlights);
    expect(file.alt).to.equal('Annual report');
  });

  it('DocumentRendererDefinition accepts an optional capabilities declaration', () => {
    const def: import('./registry.js').DocumentRendererDefinition = {
      capabilities: { anchors: ['page', 'text-quote'], textSelect: true },
    };
    expect(def.capabilities?.anchors).to.deep.equal(['page', 'text-quote']);
  });
});

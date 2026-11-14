import { expect } from '@open-wc/testing';
import { createDocumentRendererRegistry, findDocumentRenderer, type LyraDocumentFile } from './document-renderer-registry.js';

describe('document renderer lookup keys', () => {
  const definition = {
    render: () => document.createElement('div'),
    matches: (file: LyraDocumentFile) => file.name.endsWith('.demo'),
  };
  const registry = createDocumentRendererRegistry([['application/x-lookup-demo', definition]]);

  it('matches a registered MIME essence case-insensitively and ignores parameters and padding', () => {
    expect(registry.has(' Application/X-Lookup-Demo; charset=utf-8 ')).to.equal(true);
    expect(registry.get('application/x-lookup-demo')).to.not.equal(undefined);
  });

  it('treats a missing MIME type as no exact key and falls back to shape matching', () => {
    const untyped = { name: 'notes.demo', src: 'notes.demo' } as unknown as LyraDocumentFile;
    expect(registry.has(undefined as unknown as string)).to.equal(false);
    expect(registry.get(undefined as unknown as string)).to.equal(undefined);
    expect(findDocumentRenderer(untyped, registry)?.matches).to.equal(definition.matches);
    const other = { name: 'notes.txt', src: 'notes.txt' } as unknown as LyraDocumentFile;
    expect(findDocumentRenderer(other, registry)?.matches === definition.matches).to.equal(false);
  });
});

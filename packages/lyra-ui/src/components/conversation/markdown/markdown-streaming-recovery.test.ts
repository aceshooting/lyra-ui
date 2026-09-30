import { expect } from '@open-wc/testing';
import { MarkdownStreamingBuffer } from './markdown-streaming.js';

describe('Markdown stream recovery', () => {
  it('preserves complete source after a lexer extension fails and retries it on the next append', () => {
    const buffer = new MarkdownStreamingBuffer();
    const first = buffer.update('first\n\npartial', () => [
      { type: 'paragraph', raw: 'first\n\n' },
      { type: 'paragraph', raw: 'partial' },
    ]);
    expect(first.settledBlocks).to.deep.equal(['first\n\n']);
    const failed = buffer.update('first\n\npartial text', () => {
      throw new Error('extension unavailable');
    });
    expect(failed.reset).to.equal(true);
    expect(failed.settledBlocks).to.deep.equal([]);
    expect(failed.tail).to.equal('first\n\npartial text');
    let retried = '';
    const recovered = buffer.update('first\n\npartial text!', source => {
      retried = source;
      return [{ type: 'paragraph', raw: 'first\n\n' }, { type: 'paragraph', raw: 'partial text!' }];
    });
    expect(retried).to.equal('first\n\npartial text!');
    expect(recovered.settledBlocks).to.deep.equal(['first\n\n']);
    expect(buffer.finish()).to.deep.equal(['first\n\n', 'partial text!']);
    expect(buffer.finish()).to.deep.equal(['first\n\n', 'partial text!']);
  });

  it('keeps the original text mutable when an extension manufactures a different source slice', () => {
    const buffer = new MarkdownStreamingBuffer();
    const source = 'original\n\ntail';
    const snapshot = buffer.update(source, () => [
      { type: 'paragraph', raw: 'manufactured\n\n' },
      { type: 'paragraph', raw: 'tail' },
    ]);
    expect(snapshot.settledBlocks).to.deep.equal([]);
    expect(snapshot.tail).to.equal(source);
    expect(buffer.finish()).to.deep.equal([source]);
  });

  it('settles a closed fence together with trailing whitespace without waiting for another block', () => {
    const buffer = new MarkdownStreamingBuffer();
    const fence = '```ts\nconst value = 1;\n```\n';
    const snapshot = buffer.update(fence + '\n', () => [
      { type: 'code', raw: fence }, { type: 'space', raw: '\n' },
    ]);
    expect(snapshot.settledBlocks).to.deep.equal([fence, '\n']);
    expect(snapshot.tail).to.equal('');
  });
});

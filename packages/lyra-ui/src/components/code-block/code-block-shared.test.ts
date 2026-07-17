import { expect } from '@open-wc/testing';
import { parseHighlightLines, codeBlockLineTransformer } from './code-block-shared.js';

describe('parseHighlightLines', () => {
  it('parses a single range', () => {
    expect([...parseHighlightLines('3-5')].sort((a, b) => a - b)).to.deep.equal([3, 4, 5]);
  });

  it('parses multiple comma-separated segments, tolerating whitespace', () => {
    expect([...parseHighlightLines(' 3-5, 7 ')].sort((a, b) => a - b)).to.deep.equal([3, 4, 5, 7]);
  });

  it('normalizes a reversed range', () => {
    expect([...parseHighlightLines('5-3')].sort((a, b) => a - b)).to.deep.equal([3, 4, 5]);
  });

  it('merges overlapping ranges into a set with no duplicates', () => {
    expect([...parseHighlightLines('1-3,2-4')].sort((a, b) => a - b)).to.deep.equal([1, 2, 3, 4]);
  });

  it('ignores an invalid segment and warns, keeping the valid ones', () => {
    const warn = console.warn;
    let warned = false;
    console.warn = () => {
      warned = true;
    };
    try {
      expect([...parseHighlightLines('2,garbage,4')].sort((a, b) => a - b)).to.deep.equal([2, 4]);
      expect(warned).to.be.true;
    } finally {
      console.warn = warn;
    }
  });

  it('returns an empty set for an empty string', () => {
    expect(parseHighlightLines('').size).to.equal(0);
  });
});

describe('codeBlockLineTransformer', () => {
  it('stamps data-line, data-highlighted, and part on a highlighted line node', () => {
    const transformer = codeBlockLineTransformer({
      lineNumbers: false,
      highlightedLines: new Set([2]),
      activeLines: new Set(),
    });
    const node = { properties: {} as Record<string, unknown> };
    transformer.line(node, 2);
    expect(node.properties['data-line']).to.equal('2');
    expect(node.properties['data-highlighted']).to.equal('');
    expect(node.properties.part).to.deep.equal(['line-highlight']);
  });

  it('does not stamp part on a non-highlighted line', () => {
    const transformer = codeBlockLineTransformer({
      lineNumbers: false,
      highlightedLines: new Set([2]),
      activeLines: new Set(),
    });
    const node = { properties: {} as Record<string, unknown> };
    transformer.line(node, 5);
    expect(node.properties.part).to.equal(undefined);
    expect(node.properties['data-highlighted']).to.equal(undefined);
  });

  it('stamps data-active for an active line', () => {
    const transformer = codeBlockLineTransformer({
      lineNumbers: false,
      highlightedLines: new Set(),
      activeLines: new Set([3]),
    });
    const node = { properties: {} as Record<string, unknown> };
    transformer.line(node, 3);
    expect(node.properties['data-active']).to.equal('');
  });
});

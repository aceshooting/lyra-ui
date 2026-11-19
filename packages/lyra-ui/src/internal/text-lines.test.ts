import { expect } from '@open-wc/testing';
import { countLines, splitLines } from './text-lines.js';

describe('text-lines', () => {
  it('handles LF, CRLF, CR and mixes', () => {
    expect(splitLines('a\nb\r\nc\rd')).to.deep.equal(['a', 'b', 'c', 'd']);
    expect(splitLines('a\r\n\r\nb')).to.deep.equal(['a', '', 'b']);
    expect(splitLines('a\n\r')).to.deep.equal(['a', '', '']);
  });
  it('treats empty text and trailing breaks like split', () => {
    expect(splitLines('')).to.deep.equal(['']);
    expect(splitLines('a\n')).to.deep.equal(['a', '']);
    expect(countLines('')).to.equal(1);
    expect(countLines('a\r\nb\n')).to.equal(3);
  });
  it('honours the limit', () => {
    expect(splitLines('a\nb\nc', 2)).to.deep.equal(['a', 'b']);
    expect(splitLines('a\nb', 5)).to.deep.equal(['a', 'b']);
    expect(splitLines('a\nb', 0)).to.deep.equal(['a', 'b']);
    expect(splitLines('a\nb', 1)).to.deep.equal(['a']);
  });
});

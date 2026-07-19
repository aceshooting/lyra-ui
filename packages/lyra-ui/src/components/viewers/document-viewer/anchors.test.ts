import { expect } from '@open-wc/testing';
import {
  TEXT_QUOTE_CONTEXT_CHARS,
  type LyraAnchor,
  type LyraAnchorKind,
  type LyraHighlight,
  type LyraHighlightTone,
  type AnchorTargetCapabilities,
  type HighlightActivateDetail,
  type TextSelectDetail,
  type AnchorResultDetail,
} from './anchors.js';

// Compile-time exhaustiveness check: if a new `LyraAnchor` variant is ever added without updating
// this switch, TypeScript's `never` assignment fails the build -- this function's mere existence
// (and the fact the whole package still compiles) is what proves the exhaustiveness switch works.
function describeAnchorKind(anchor: LyraAnchor): LyraAnchorKind {
  switch (anchor.kind) {
    case 'page':
    case 'text-quote':
    case 'fragment':
    case 'line-range':
    case 'cell-range':
    case 'cfi':
    case 'time-range':
    case 'region':
    case 'node-path':
      return anchor.kind;
    default: {
      const exhaustive: never = anchor;
      throw new Error(`Unhandled anchor kind: ${JSON.stringify(exhaustive)}`);
    }
  }
}

describe('anchors.ts', () => {
  it('exposes TEXT_QUOTE_CONTEXT_CHARS as 32', () => {
    expect(TEXT_QUOTE_CONTEXT_CHARS).to.equal(32);
  });

  it('accepts one literal value per LyraAnchor kind and describeAnchorKind is exhaustive', () => {
    const samples: LyraAnchor[] = [
      { kind: 'page', page: 3 },
      { kind: 'text-quote', quote: 'revenue grew 12%', prefix: 'Overall ', suffix: ', driven', page: 12 },
      { kind: 'fragment', id: 'section-2' },
      { kind: 'line-range', start: 10, end: 20 },
      { kind: 'cell-range', sheet: 'Sheet1', range: 'A1:C3' },
      { kind: 'cfi', cfi: 'epubcfi(/6/4[chap01ref]!/4[body01]/10[para05]/2/1:1)' },
      { kind: 'time-range', start: 30, end: 45 },
      { kind: 'region', page: 1, rect: { x: 10, y: 20, width: 30, height: 5 } },
      { kind: 'node-path', path: ['items', 0, 'name'] },
    ];
    for (const anchor of samples) expect(describeAnchorKind(anchor)).to.equal(anchor.kind);
  });

  it('LyraHighlight requires id/anchor and accepts the optional label/note/tone fields', () => {
    const highlight: LyraHighlight = {
      id: 'cite-1',
      anchor: { kind: 'page', page: 1 },
      label: 'Citation 1',
      note: 'Internal reviewer note',
      tone: 'warning',
    };
    expect(highlight.id).to.equal('cite-1');
    const tones: LyraHighlightTone[] = ['accent', 'success', 'warning', 'danger', 'neutral'];
    expect(tones).to.include(highlight.tone);
  });

  it('AnchorTargetCapabilities/HighlightActivateDetail/TextSelectDetail/AnchorResultDetail shapes compile', () => {
    const capabilities: AnchorTargetCapabilities = { anchors: ['page', 'text-quote'], search: true, textSelect: true };
    const activate: HighlightActivateDetail = { id: 'cite-1' };
    const select: TextSelectDetail = { text: 'hello', anchor: null, rects: [] };
    const result: AnchorResultDetail = { found: true };
    expect(capabilities.anchors).to.deep.equal(['page', 'text-quote']);
    expect(activate.id).to.equal('cite-1');
    expect(select.anchor).to.be.null;
    expect(result.found).to.be.true;
  });
});

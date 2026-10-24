import { expect } from '@open-wc/testing';
import {
  IncrementalTextQuoteScope,
  buildQuoteAnchor,
  createTextQuoteIndex,
  findTextQuoteMatches,
  rangeFromTextQuoteMatch,
  scopeFromElement,
  scopeFromItems,
} from './text-quote.js';

describe('text quote boundaries across live DOM ownership', () => {
  it('uses actual selected text without scoped context when both Text boundaries are outside the corpus', () => {
    const root = document.createElement('div');
    root.textContent = 'Scoped context must stay separate';
    const outside = document.createElement('p');
    outside.append(document.createTextNode('skip e\u0301\u00ad '), document.createTextNode('selected tail'));
    const range = document.createRange();
    range.setStart(outside.firstChild!, 5);
    range.setEnd(outside.lastChild!, 8);
    expect(buildQuoteAnchor(range, scopeFromElement(root))).to.deep.equal({
      kind: 'text-quote', quote: 'é selected',
    });
  });

  it('invalidates an item mapping when a new sibling precedes its explicit text node', () => {
    const element = document.createElement('span');
    const leading = document.createTextNode('Decoration ');
    const node = document.createTextNode('needle');
    element.append(leading, node);
    const build = () => scopeFromItems([{ element, node, text: node.data }]);
    const scope = build();
    const match = findTextQuoteMatches(scope, 'needle').at(0)!;
    expect(rangeFromTextQuoteMatch(scope, match)?.toString()).to.equal('needle');
    node.before(document.createComment('new render boundary'));
    expect(rangeFromTextQuoteMatch(scope, match)).to.equal(null);
    expect(rangeFromTextQuoteMatch(build(), match)?.toString()).to.equal('needle');
  });

  it('rejects a subtree moved outside its original root and recovers after the subtree returns', () => {
    const root = document.createElement('div');
    const paragraph = document.createElement('p');
    paragraph.textContent = 'needle';
    root.append(paragraph);
    const scope = scopeFromElement(root);
    const match = findTextQuoteMatches(scope, 'needle').at(0)!;
    expect(rangeFromTextQuoteMatch(scope, match)?.toString()).to.equal('needle');
    const elsewhere = document.createElement('section');
    elsewhere.append(paragraph);
    expect(rangeFromTextQuoteMatch(scope, match)).to.equal(null);
    root.append(paragraph);
    expect(rangeFromTextQuoteMatch(scope, match)?.toString()).to.equal('needle');
  });

  it('recomputes an evicted occurrence list after append growth exceeds the shared cache ceiling', () => {
    const words = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'];
    const line = `${words.join(' ')} `;
    const root = document.createElement('div');
    const paragraph = document.createElement('p');
    paragraph.textContent = line.repeat(7_000);
    root.append(paragraph);
    const builder = new IncrementalTextQuoteScope(root);
    try {
      const index = createTextQuoteIndex(builder.update());
      for (const word of words) {
        const matches = index.search(word);
        expect(matches.length).to.equal(7_000);
        expect(matches.scanComplete).to.equal(true);
      }
      const scans = index.scanCount;
      const appended = document.createElement('p');
      appended.textContent = line.repeat(2_000);
      root.append(appended);
      expect(index.rebindScope(builder.update())).to.equal(true);
      expect(index.scanCount).to.equal(scans);
      expect(index.search('alpha').length).to.equal(9_000);
      expect(index.scanCount, 'the first retained list was extended in place').to.equal(scans);
      const matches = index.search('epsilon');
      expect(matches.length).to.equal(9_000);
      expect(matches.scanComplete).to.equal(true);
      expect(matches.matchCountExact).to.equal(true);
      expect(index.scanCount, 'the final list was evicted when its appended matches no longer fit')
        .to.equal(scans + 1);
      expect(rangeFromTextQuoteMatch(index.scope, matches.at(8_999)!)?.toString()).to.equal('epsilon');
      expect(scopeFromElement(root).text).to.equal(index.scope.text);
    } finally {
      builder.disconnect();
    }
  });
});

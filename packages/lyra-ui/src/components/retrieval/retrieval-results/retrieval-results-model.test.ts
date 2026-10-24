import { expect } from '@open-wc/testing';
import { projectRetrievalChunk } from './retrieval-results-model.js';

const chunk = { id: 'c1', text: 'Body', score: 0.5, source: { id: 'doc', name: 'Doc' } };

describe('projectRetrievalChunk', () => {
  it('rejects values that cannot be chunk records', () => {
    for (const value of [undefined, null, '', 'chunk', 0, 7, ['c1']]) {
      expect(projectRetrievalChunk(value), String(value)).to.equal(undefined);
    }
  });

  it('rejects a revoked chunk record instead of throwing', () => {
    const revoked = Proxy.revocable({ ...chunk }, {});
    revoked.revoke();

    expect(projectRetrievalChunk(revoked.proxy)).to.equal(undefined);
  });

  it('copies only the known score fields into a frozen score breakdown', () => {
    const projected = projectRetrievalChunk({
      ...chunk,
      scores: { dense: 0.8, sparse: 0.2, rerank: 0.9, final: 0.85, unrelated: 1 },
    })!;

    expect(projected.scores).to.deep.equal({ dense: 0.8, sparse: 0.2, rerank: 0.9, final: 0.85 });
    expect(Object.isFrozen(projected.scores)).to.equal(true);
    expect(Object.isFrozen(projected)).to.equal(true);
  });

  it('leaves the score breakdown out when it is not a record', () => {
    for (const scores of [[0.4], 'high', 0.4, null]) {
      expect('scores' in projectRetrievalChunk({ ...chunk, scores })!, String(scores)).to.equal(false);
    }
  });
});

import { expect } from '@open-wc/testing';
import { assertTableDimensions, assertTableSize, LyraResourceLimitError, readResponseText } from './resource-loader.js';

it('caps streamed response data even without a Content-Length header', async () => {
  const response = new Response('1234567890');
  let error: unknown;
  try {
    await readResponseText(response, 4);
  } catch (caught) {
    error = caught;
  }
  expect(error).to.be.instanceOf(LyraResourceLimitError);
});

it('rejects a response whose declared length exceeds the cap', async () => {
  const response = new Response(null, { headers: { 'content-length': '10' } });
  let error: unknown;
  try {
    await readResponseText(response, 4);
  } catch (caught) {
    error = caught;
  }
  expect(error).to.be.instanceOf(LyraResourceLimitError);
});

it('rejects tabular data over the row or column budget', () => {
  expect(() => assertTableSize([['a'], ['b']], 1, 10)).to.throw(LyraResourceLimitError);
  expect(() => assertTableSize([['a', 'b']], 10, 1)).to.throw(LyraResourceLimitError);
});

it('accepts a table sitting exactly on the row and column budget', () => {
  expect(() => assertTableDimensions(2, 2, 2, 2)).to.not.throw();
  expect(() => assertTableSize([['a'], ['b']], 2, 1)).to.not.throw();
});

it('rejects dimensions over the row or column budget', () => {
  expect(() => assertTableDimensions(3, 1, 2, 2)).to.throw(LyraResourceLimitError);
  expect(() => assertTableDimensions(1, 3, 2, 2)).to.throw(LyraResourceLimitError);
});

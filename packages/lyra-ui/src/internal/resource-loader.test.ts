import { expect, fixture, html } from '@open-wc/testing';
import {
  assertTableDimensions,
  assertTableSize,
  isAbortError,
  LyraResourceLimitError,
  MAX_RESOURCE_STREAM_CHUNKS,
  readResponseArrayBuffer,
  readResponseText,
  resolveOwnerFetchTarget,
} from './resource-loader.js';

function responseWithReader(
  read: () => Promise<ReadableStreamReadResult<Uint8Array>>,
  cancel: () => Promise<void> = async () => undefined,
): Response {
  return {
    headers: new Headers(),
    body: {
      getReader: () => ({ read, cancel, releaseLock() {} }),
    },
  } as unknown as Response;
}

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

it('copies streamed bytes as they arrive instead of retaining mutable chunk objects', async () => {
  const expected = Uint8Array.from({ length: 64 }, (_, index) => index);
  let index = 0;
  let previous: Uint8Array | undefined;
  const response = responseWithReader(async () => {
    if (previous) previous[0] = 255;
    if (index >= expected.length) return { done: true, value: undefined };
    previous = Uint8Array.of(expected[index++]!);
    return { done: false, value: previous };
  });

  const actual = new Uint8Array(await readResponseArrayBuffer(response, expected.length));
  expect([...actual]).to.deep.equal([...expected]);
});

it('rejects pathological tiny-chunk cardinality before exhausting the byte ceiling', async () => {
  let reads = 0;
  let cancellations = 0;
  const response = responseWithReader(
    async () => {
      reads += 1;
      return { done: false, value: Uint8Array.of(1) };
    },
    async () => {
      cancellations += 1;
    },
  );

  let error: unknown;
  try {
    await readResponseArrayBuffer(response, MAX_RESOURCE_STREAM_CHUNKS * 2);
  } catch (caught) {
    error = caught;
  }
  expect(error).to.be.instanceOf(LyraResourceLimitError);
  expect(reads).to.equal(MAX_RESOURCE_STREAM_CHUNKS + 1);
  expect(cancellations).to.equal(1);
});

it('keeps the resource-limit error authoritative when stream cancellation rejects', async () => {
  const response = responseWithReader(
    async () => ({ done: false, value: Uint8Array.of(1, 2) }),
    async () => {
      throw new Error('hostile cancellation');
    },
  );

  let error: unknown;
  try {
    await readResponseArrayBuffer(response, 1);
  } catch (caught) {
    error = caught;
  }
  expect(error).to.be.instanceOf(LyraResourceLimitError);
});

it('uses a bodyless response text fallback and normalizes an invalid byte cap', async () => {
  const response = {
    headers: new Headers(),
    body: null,
    text: async () => 'fallback text',
  } as unknown as Response;

  expect(await readResponseText(response, 0)).to.equal('fallback text');
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

it('resolves fetch targets against an adopted element owner document and retains its fetch realm', async () => {
  const iframe = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
  const frameDocument = iframe.contentDocument!;
  const frameWindow = iframe.contentWindow!;
  const base = frameDocument.createElement('base');
  base.href = 'https://frame.example/application/nested/';
  frameDocument.head.append(base);
  const element = document.createElement('div');
  frameDocument.adoptNode(element);
  frameDocument.body.append(element);

  const target = resolveOwnerFetchTarget(element, '../fixtures/data.csv');
  expect(target?.url).to.equal('https://frame.example/application/fixtures/data.csv');
  expect(target?.view === frameWindow).to.equal(true);
});

it('fails owner fetch resolution closed without a browsing context or for unsafe sources', () => {
  const detachedDocument = document.implementation.createHTMLDocument('detached');
  const detachedElement = detachedDocument.createElement('div');
  expect(detachedDocument.defaultView === null).to.equal(true);
  expect(resolveOwnerFetchTarget(detachedElement, 'relative.json') === null).to.equal(true);
  expect(resolveOwnerFetchTarget(document.createElement('div'), 'relative.json') === null).to.equal(true);
  expect(resolveOwnerFetchTarget(document.body, 'javascript:alert(1)') === null).to.equal(true);
});

it('fails owner fetch resolution closed when the owner document base cannot be read', async () => {
  const iframe = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
  const frameDocument = iframe.contentDocument!;
  const element = frameDocument.createElement('div');
  frameDocument.body.append(element);
  const descriptor = Object.getOwnPropertyDescriptor(frameDocument, 'baseURI');
  Object.defineProperty(frameDocument, 'baseURI', {
    configurable: true,
    get() {
      throw new Error('hostile base URI');
    },
  });
  try {
    expect(resolveOwnerFetchTarget(element, 'relative.json')).to.equal(null);
  } finally {
    if (descriptor) Object.defineProperty(frameDocument, 'baseURI', descriptor);
    else delete (frameDocument as unknown as { baseURI?: unknown }).baseURI;
  }
});

it('recognizes abort errors created in another browsing context', async () => {
  const iframe = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
  const ownerError = new iframe.contentWindow!.DOMException('cancelled', 'AbortError');
  expect(isAbortError(ownerError)).to.equal(true);
});

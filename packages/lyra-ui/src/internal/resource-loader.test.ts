import { expect, fixture, html } from '@open-wc/testing';
import {
  assertTableDimensions,
  assertTableSize,
  isAbortError,
  isPdfRenderCancellation,
  LyraResourceLimitError,
  MAX_RESOURCE_STREAM_CHUNKS,
  readResponseArrayBuffer,
  readResponseText,
  resolveOwnerFetchTarget,
  yieldViewerTask,
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

for (const limit of [64, 128]) {
  it(`returns only the streamed bytes and isolates mutable chunks with a ${limit}-byte capacity`, async () => {
    const expected = Uint8Array.from({ length: 64 }, (_, index) => index);
    let index = 0;
    let previous: Uint8Array | undefined;
    const response = responseWithReader(async () => {
      if (previous) previous[0] = 255;
      if (index >= expected.length) return { done: true, value: undefined };
      previous = Uint8Array.of(expected[index++]!);
      return { done: false, value: previous };
    });

    const actual = new Uint8Array(await readResponseArrayBuffer(response, limit));
    expect([...actual]).to.deep.equal([...expected]);
  });
}

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

it('treats a bodyless response that offers neither arrayBuffer() nor text() as empty', async () => {
  const response = { headers: new Headers(), body: null } as unknown as Response;
  expect((await readResponseArrayBuffer(response, 10)).byteLength).to.equal(0);
  expect(await readResponseText(response, 10)).to.equal('');
});

describe('yieldViewerTask', () => {
  it('prefers scheduler.yield, then requestIdleCallback, then a timer, then the ambient timer', async () => {
    const calls: string[] = [];
    const withScheduler = { scheduler: { yield: async () => { calls.push('yield'); } } } as unknown as Window;
    const withIdle = {
      requestIdleCallback: (callback: () => void) => { calls.push('idle'); callback(); },
    } as unknown as Window;
    const timerOnly = {
      setTimeout: (callback: () => void) => { calls.push('timer'); return window.setTimeout(callback, 0); },
    } as unknown as Window;
    for (const view of [withScheduler, withIdle, timerOnly, null]) await yieldViewerTask(view, () => true);
    expect(calls).to.deep.equal(['yield', 'idle', 'timer']);
  });

  it('rejects with an AbortError once the viewer source is no longer current', async () => {
    let error: unknown;
    try {
      await yieldViewerTask(null, () => false);
    } catch (caught) {
      error = caught;
    }
    expect(error instanceof DOMException && error.name).to.equal('AbortError');
  });
});

describe('declared Content-Length sizing', () => {
  const streamed = (bytes: number[], declared: string): Response =>
    new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(Uint8Array.from(bytes));
        controller.close();
      },
    }), { headers: { 'content-length': declared } });

  it('returns exactly the streamed bytes whether the declared length is exact, high, low or garbage', async () => {
    for (const declared of ['4', '9', '2', 'abc', '-1']) {
      const buffer = await readResponseArrayBuffer(streamed([1, 2, 3, 4], declared), 64);
      expect([buffer.byteLength, ...new Uint8Array(buffer)].join(',')).to.equal('4,1,2,3,4');
    }
  });
});

describe('isPdfRenderCancellation', () => {
  it('treats pdf.js cancellation and abort exceptions as cancellations, not failures', () => {
    const named = (name: string) => Object.assign(new Error('x'), { name });
    expect(isPdfRenderCancellation(named('RenderingCancelledException'))).to.equal(true);
    expect(isPdfRenderCancellation(named('AbortException'))).to.equal(true);
    expect(isPdfRenderCancellation(named('AbortError'))).to.equal(true);
    expect(isPdfRenderCancellation(named('TypeError'))).to.equal(false);
    expect(isPdfRenderCancellation(null)).to.equal(false);
  });
});

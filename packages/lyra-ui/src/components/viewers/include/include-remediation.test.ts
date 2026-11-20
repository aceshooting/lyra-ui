import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import '../../lr-include.js';
import type { LyraInclude } from '../../lr-include.js';
import { __clearIncludeResourceCacheForTesting, acquireSanitizedIncludeResource, MAX_INCLUDE_BYTES } from './include-resource.js';

function trackedResponse(text: string, init?: ResponseInit): { response: Response; state: { pulls: number; cancelled: boolean } } {
  const state = { pulls: 0, cancelled: false };
  const body = new ReadableStream<Uint8Array>({
    pull(controller) { state.pulls++; controller.enqueue(new TextEncoder().encode(text)); controller.close(); },
    cancel() { state.cancelled = true; },
  }, { highWaterMark: 0 });
  return { response: new Response(body, init), state };
}


const originalFetch = window.fetch;
afterEach(() => { window.fetch = originalFetch; __clearIncludeResourceCacheForTesting(); });

// Only passive text, ordinary presentation, inert form markup and a tiny inline raster are used.
const content = '<h2 id="heading">Passive heading</h2><p part="sample" style="color:blue">Preserved paragraph</p><form><span>Preserved form text</span><input type="hidden" value="sample"></form><img alt="Passive image" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="><a href="#heading">Local heading</a>';

function allElements(root: ParentNode): Element[] {
  const elements = [...root.querySelectorAll('*')];
  for (let index = 0; index < elements.length; index++) {
    const element = elements[index]!;
    if (element.localName === 'template') elements.push(...(element as HTMLTemplateElement).content.querySelectorAll('*'));
  }
  return elements;
}

function assertPassive(root: ParentNode) {
  const elements = allElements(root);
  expect(elements.filter((element) => element.matches('form,input,[style],[part],[exportparts],[src],[srcset],[action]')).length).to.equal(0);
  expect(elements.some((element) => element.textContent?.includes('Preserved paragraph'))).to.equal(true);
  expect(elements.some((element) => element.textContent === 'Preserved form text')).to.equal(true);
}

for (const shape of ['template', 'ordinary-under-templates'] as const) {
  it(`applies passive restrictions before remote ${shape} fragment extraction and rebases permitted local links`, async () => {
    const fragment = shape === 'template'
      ? `<main><template id="chosen">${content}<template><p style="color:blue" part="nested">Nested passive text</p></template></template></main>`
      : `<main>${'<template>'.repeat(8)}<section id="chosen">${content}</section>${'</template>'.repeat(8)}</main>`;
    let calls = 0;
    window.fetch = (() => { calls++; return Promise.resolve(new Response(fragment)); }) as typeof fetch;
    const viewer = await fixture<LyraInclude>(html`<lr-include>Fallback</lr-include>`);
    const loaded = oneEvent(viewer, 'lr-load');
    viewer.src = '/passive-fragments.html#chosen';
    await loaded;
    assertPassive(viewer);
    const headingId = viewer.querySelector('h2')?.id;
    expect(typeof headingId).to.equal('string');
    expect(headingId).not.to.equal('heading');
    expect(viewer.querySelector('a')?.getAttribute('href')).to.equal(`#${headingId}`);
    expect(calls).to.equal(1);
  });
}

it('retains only fully passive nested-template contents in the shared remote resource cache', async () => {
  let calls = 0;
  window.fetch = (() => { calls++; return Promise.resolve(new Response(`<main>${'<template>'.repeat(32)}${content}${'</template>'.repeat(32)}</main>`)); }) as typeof fetch;
  const url = new URL('/cached-passive.html', document.baseURI).href;
  const first = acquireSanitizedIncludeResource(url, 'same-origin', true, window);
  const firstValue = await first.promise;
  first.release();
  const second = acquireSanitizedIncludeResource(url, 'same-origin', true, window);
  try {
    expect(await second.promise).to.equal(firstValue);
    expect(calls).to.equal(1);
    const template = document.createElement('template');
    template.innerHTML = firstValue;
    assertPassive(template.content);
    expect(allElements(template.content).filter((element) => element.localName === 'template').length).to.equal(32);
  } finally { second.release(); }
});

it('rejects declared oversized remote fragments before reading their body and retains fallback content', async () => {
  let reads = 0;
  window.fetch = (() => Promise.resolve({ ok: true, status: 200, headers: new Headers({ 'content-length': String(MAX_INCLUDE_BYTES + 1) }),
    text: async () => { reads++; return '<p>Unused body</p>'; },
  } as Response)) as typeof fetch;
  const viewer = await fixture<LyraInclude>(html`<lr-include>Original fallback</lr-include>`);
  const failed = oneEvent(viewer, 'lr-include-error');
  viewer.src = '/oversized-passive.html#chosen';
  expect((await failed).detail.reason).to.equal('resource-too-large');
  expect(reads).to.equal(0);
  expect(viewer.textContent).to.equal('Original fallback');
});

it('drops name attributes so included markup cannot clobber window or document properties', async () => {
  window.fetch = (() => Promise.resolve(new Response('<img name="lyraIncludeProbe" alt="Probe"><a name="lyraAnchorProbe">Probe</a>'))) as typeof fetch;
  const viewer = await fixture<LyraInclude>(html`<lr-include>Fallback</lr-include>`);
  const loaded = oneEvent(viewer, 'lr-load');
  viewer.src = '/named-partial.html';
  await loaded;
  expect(viewer.querySelectorAll('[name]').length).to.equal(0);
  expect(typeof (window as unknown as Record<string, unknown>)['lyraIncludeProbe']).to.equal('undefined');
  expect(typeof (document as unknown as Record<string, unknown>)['lyraIncludeProbe']).to.equal('undefined');
});

it('discards a late response body unread after source removal', async () => {
  let resolveFetch!: (response: Response) => void;
  let signal: AbortSignal | null | undefined;
  window.fetch = (_url, init) => {
    signal = init?.signal;
    return new Promise<Response>((resolve) => { resolveFetch = resolve; });
  };
  const el = await fixture<LyraInclude>(html`<lr-include></lr-include>`);
  let failures = 0;
  el.addEventListener('lr-include-error', () => { failures++; });
  el.src = '/retired';
  await waitUntil(() => Boolean(signal));
  el.src = '';
  await waitUntil(() => signal?.aborted === true);
  const { response, state } = trackedResponse('retired');
  resolveFetch(response);
  await waitUntil(() => state.cancelled);
  expect(state.pulls).to.equal(0);
  expect(failures).to.equal(0);
});

it('reports an independent transport abort on the current source', async () => {
  const failure = new DOMException('Transport canceled', 'AbortError');
  window.fetch = () => Promise.reject(failure);
  const el = await fixture<LyraInclude>(html`<lr-include></lr-include>`);
  const failed = oneEvent(el, 'lr-include-error');
  el.src = '/current';
  expect((await failed).detail.error).to.equal(failure);
  await el.updateComplete;
  expect(el.getAttribute('aria-busy')).to.equal('false');
});

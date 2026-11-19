import { expect, fixture, waitUntil } from '@open-wc/testing';
import './markdown.js';
import type { LyraMarkdown } from './markdown.js';
import type { KatexApi } from './katex-loader.js';

it('passes explicit size and expansion limits when rendering math', async () => {
  const key = Symbol.for('@aceshooting/lyra-ui/markdown-katex-override');
  const previous = Object.getOwnPropertyDescriptor(globalThis, key);
  const options: Record<string, unknown>[] = [];
  const peer: KatexApi = { renderToString: (_tex, config) => {
    options.push(config!);
    return '<math><mi>x</mi></math>';
  } };
  Reflect.set(globalThis, key, peer);
  try {
    const el = await fixture<HTMLElement>('<lr-markdown math content="$x$"></lr-markdown>');
    await waitUntil(() => Boolean(el.shadowRoot!.querySelector('math')));
    expect(options[0]!['trust']).to.equal(false);
    expect(options[0]!['maxExpand']).to.equal(1000);
    expect(options[0]!['maxSize']).to.equal(20);
  } finally {
    if (previous) Object.defineProperty(globalThis, key, previous);
    else Reflect.deleteProperty(globalThis, key);
  }
});

it('reports a missing math peer again after math is disabled and re-enabled', async () => {
  const key = Symbol.for('@aceshooting/lyra-ui/markdown-katex-override');
  const previous = Object.getOwnPropertyDescriptor(globalThis, key);
  Reflect.set(globalThis, key, null);
  try {
    const el = await fixture<LyraMarkdown>('<lr-markdown content="$x$"></lr-markdown>');
    await waitUntil(() => Boolean(el.shadowRoot!.querySelector('p')));
    const reports: string[] = [];
    el.addEventListener('lr-render-error', () => reports.push(el.shadowRoot!.querySelector('p')!.textContent!));
    el.math = true;
    await el.updateComplete;
    el.math = false;
    await el.updateComplete;
    el.math = true;
    await el.updateComplete;
    expect(reports).to.deep.equal(['$x$', '$x$']);
  } finally {
    if (previous) Object.defineProperty(globalThis, key, previous);
    else Reflect.deleteProperty(globalThis, key);
  }
});

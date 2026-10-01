import { expect, waitUntil } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { getKatex } from './katex-loader.js';
import { preloadMarkdown } from './markdown.js';
import type { LyraMarkdown } from './markdown.js';
import type { LyraMarkdownCore } from './markdown-core.js';
import './markdown-core.js';
import { LyraMarkdown as FullClass } from './markdown.class.js';
import { LyraMarkdownCore as CoreClass } from './markdown-core.class.js';
import { createMarkdownVariantContext } from './markdown-base.class.js';
import { createMarkdownKatexState } from './markdown-shared.js';

const generationKey = Symbol.for('@aceshooting/lyra-ui/markdown-katex-cache-generation');
const overrideKey = Symbol.for('@aceshooting/lyra-ui/markdown-katex-override');
type MarkdownHost = LyraMarkdown | LyraMarkdownCore;

it('upgrades committed streaming math when KaTeX arrives without replacing unrelated content or restoring stale documents', async () => {
  const originalGeneration = Object.getOwnPropertyDescriptor(globalThis, generationKey);
  const originalOverride = Object.getOwnPropertyDescriptor(globalThis, overrideKey);
  const mounted: MarkdownHost[] = [];
  const errors: unknown[] = [];
  const variantDescriptors = [FullClass, CoreClass].map((Class) => ({
    prototype: Class.prototype,
    descriptor: Object.getOwnPropertyDescriptor(Class.prototype, 'markdownVariant')!,
  }));
  for (const [index, { prototype }] of variantDescriptors.entries()) {
    const context = createMarkdownVariantContext(index === 0 ? 'lr-markdown' : 'lr-markdown-core', createMarkdownKatexState());
    Object.defineProperty(prototype, 'markdownVariant', { configurable: true, get: () => context });
  }
  let resolvePeer!: (value: unknown) => void;
  const pendingPeer = new Promise<unknown>((resolve) => { resolvePeer = resolve; });
  Reflect.set(globalThis, generationKey, {});
  Reflect.deleteProperty(globalThis, overrideKey);
  const loadedPeer = getKatex(() => pendingPeer);
  const initialSource = '# Stable\n\n[Documentation](https://example.com/docs)\n\nInline';
  const source = '# Stable\n\n[Documentation](https://example.com/docs)\n\nInline $x$.\n\nUnfinished';

  function mount(tag: 'lr-markdown' | 'lr-markdown-core'): MarkdownHost {
    const element = document.createElement(tag);
    element.content = initialSource;
    element.streaming = true;
    element.streamingRender = 'progressive';
    element.headingAnchors = true;
    element.math = true;
    element.addEventListener('lr-render-error', (event) => errors.push(event));
    mounted.push(element);
    document.body.append(element);
    return element;
  }

  try {
    await preloadMarkdown();
    const groups = (['lr-markdown', 'lr-markdown-core'] as const).map((tag) => ({
      live: mount(tag), replacement: mount(tag), disconnected: mount(tag),
    }));
    await waitUntil(() => mounted.every((element) =>
      element.shadowRoot?.querySelector('[part="content"] p')?.textContent === 'Documentation'),
    'the unrelated heading and link should commit before the streamed math paragraph');

    const stable = groups.map(({ live }) => ({
      heading: live.shadowRoot!.querySelector('h1')!,
      link: live.shadowRoot!.querySelector<HTMLAnchorElement>('a[href="https://example.com/docs"]')!,
      outline: live.getHeadingTree(),
    }));
    for (const element of mounted) element.content = source;
    await waitUntil(() => mounted.every((element) => element.shadowRoot?.textContent?.includes('Inline $x$.')),
      'complete math paragraphs should commit as literal text while the peer is pending');
    for (const element of mounted) expect(element.shadowRoot!.querySelectorAll('math').length).to.equal(0);
    const firstGroup = groups[0];
    const firstStable = stable[0];
    if (!firstGroup || !firstStable) throw new Error('Both Markdown variants must be mounted.');
    await focusByKeyboard(firstStable.link);
    expect(firstGroup.live.shadowRoot!.activeElement === firstStable.link).to.equal(true);

    for (const { replacement, disconnected } of groups) {
      replacement.content = '# Replacement\n\nCurrent document.\n\nCurrent tail';
      disconnected.remove();
    }
    await waitUntil(() => groups.every(({ replacement }) =>
      replacement.shadowRoot?.querySelector('h1')?.textContent === 'Replacement'));
    const disconnectedHtml = groups.map(({ disconnected }) => disconnected.shadowRoot!.innerHTML);

    resolvePeer(await import('katex'));
    await loadedPeer;
    await waitUntil(() => groups.every(({ live }) =>
      live.shadowRoot?.querySelector('math mi')?.textContent === 'x'),
    'already committed literal math should become MathML without another source update');
    for (const [index, { live, replacement, disconnected }] of groups.entries()) {
      const original = stable[index];
      if (!original) throw new Error('The original committed nodes must be recorded.');
      expect(live.content).to.equal(source);
      expect(live.shadowRoot!.querySelector('h1') === original.heading).to.equal(true);
      expect(live.shadowRoot!.querySelector('a[href="https://example.com/docs"]') === original.link).to.equal(true);
      expect(live.getHeadingTree()).to.deep.equal(original.outline);
      expect(replacement.shadowRoot!.querySelector('h1')?.textContent).to.equal('Replacement');
      expect(replacement.shadowRoot!.textContent).to.not.include('Inline $x$.');
      expect(replacement.shadowRoot!.querySelectorAll('math').length).to.equal(0);
      expect(disconnected.shadowRoot!.innerHTML).to.equal(disconnectedHtml[index]);
    }
    expect(firstGroup.live.shadowRoot!.activeElement === firstStable.link).to.equal(true);

    for (const { live } of groups) {
      live.content = `${source}\n\n$$y$$\n\nAfter math.`;
      live.streaming = false;
    }
    await waitUntil(() => groups.every(({ live }) =>
      live.shadowRoot?.querySelectorAll('math').length === 2
      && live.shadowRoot?.querySelector('[part="math"][data-display="block"] math mi')?.textContent === 'y'
      && live.shadowRoot?.textContent?.includes('After math.')),
    'subsequent display math and the final paragraph should settle');
    expect(errors.length).to.equal(0);
  } finally {
    resolvePeer(null);
    await loadedPeer;
    for (const element of mounted) element.remove();
    for (const { prototype, descriptor } of variantDescriptors) Object.defineProperty(prototype, 'markdownVariant', descriptor);
    if (originalGeneration) Object.defineProperty(globalThis, generationKey, originalGeneration);
    else Reflect.deleteProperty(globalThis, generationKey);
    if (originalOverride) Object.defineProperty(globalThis, overrideKey, originalOverride);
    else Reflect.deleteProperty(globalThis, overrideKey);
  }
});

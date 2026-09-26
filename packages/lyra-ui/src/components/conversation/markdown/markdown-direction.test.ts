import { expect, fixture, html, waitUntil, aTimeout } from '@open-wc/testing';
import './markdown.js';
import './markdown-core.js';
import type { LyraMarkdown } from './markdown.js';
import { loadMarkdownDeps } from './markdown-loader.js';
import { renderedTemplateWhitespace, inMarkdownCodeBlock } from '../../../../test/rendered-whitespace.js';
import { MarkdownFallbackCodeScanner, segmentMarkdownFallback } from './markdown-fallback-code.js';
import { parseMarkdownDocument, renderMarkdownDocument, tokenizeMarkdownHighlight } from './markdown-shared.js';

describe('Markdown code direction', () => {
  for (const name of ['lr-markdown', 'lr-markdown-core'] as const) {
    it(`${name} isolates streaming code while preserving source and prose direction`, async () => {
      const host = await fixture<HTMLElement>(html`<div dir="rtl"></div>`);
      const el = document.createElement(name) as LyraMarkdown;
      const source = 'العربية `--flag` prose\n```js\nconst x = 1;\n```\n';
      el.content = source;
      el.streaming = true;
      host.append(el);
      await el.updateComplete;
      const root = el.shadowRoot!.querySelector<HTMLElement>('[part="content"]')!;
      expect(root.textContent).to.equal(source);
      expect(getComputedStyle(root).direction).to.equal('rtl');
      for (const part of root.querySelectorAll<HTMLElement>('.fallback-code, .fallback-inline-code')) {
        expect(getComputedStyle(part).direction).to.equal('ltr');
        expect(getComputedStyle(part).unicodeBidi).to.equal('isolate');
      }
      expect(root.querySelectorAll('.fallback-code, .fallback-inline-code').length).to.equal(2);
      expect(renderedTemplateWhitespace(el.shadowRoot!, { allow: inMarkdownCodeBlock })).to.deep.equal([]);
    });
    it(`${name} honors explicit direction and gives authored prose pre elements first-strong direction`, async () => {
      await loadMarkdownDeps();
      const host = await fixture<HTMLElement>(html`<div dir="rtl"></div>`);
      const el = document.createElement(name) as LyraMarkdown;
      el.content = '<pre part="code-block" dir="rtl"><code>نص</code></pre>\n\n<pre>نص عربي</pre>\n\n`--flag`';
      host.append(el);
      await waitUntil(() => Boolean(el.shadowRoot?.querySelector('pre')));
      const pre = el.shadowRoot!.querySelectorAll<HTMLElement>('pre');
      expect(getComputedStyle(pre[0]!).direction).to.equal('rtl');
      expect(getComputedStyle(pre[0]!.querySelector('code')!).direction).to.equal('rtl');
      expect(getComputedStyle(pre[1]!).unicodeBidi).to.equal('plaintext');
      expect(getComputedStyle(el.shadowRoot!.querySelector('[part="inline-code"]')!).direction).to.equal('ltr');
    });
  }
});

/** The client rect of the `occurrence`-th match of `needle` in any text node under `root`. */
function glyphs(root: Node, needle: string, occurrence = 0): DOMRect {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let seen = 0;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const data = (node as Text).data;
    for (let index = data.indexOf(needle); index !== -1; index = data.indexOf(needle, index + 1)) {
      if (seen++ !== occurrence) continue;
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + needle.length);
      const rects = range.getClientRects();
      return rects[0] ?? range.getBoundingClientRect();
    }
  }
  throw new Error(`text ${JSON.stringify(needle)} not rendered`);
}

const center = (rect: DOMRect): number => rect.left + rect.width / 2;
const isWebKit = /AppleWebKit/.test(navigator.userAgent) && !/Chrome|Chromium|Edg/.test(navigator.userAgent);

function contentStart(el: Element): number {
  const style = getComputedStyle(el);
  return el.getBoundingClientRect().left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft);
}

function contentEnd(el: Element): number {
  const style = getComputedStyle(el);
  return el.getBoundingClientRect().right - parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight);
}

async function mountRtl(name: string, content: string, props: Partial<LyraMarkdown> = {}): Promise<{ host: HTMLElement; el: LyraMarkdown }> {
  await loadMarkdownDeps();
  const host = await fixture<HTMLElement>(html`<div dir="rtl" style="inline-size: 400px"></div>`);
  const el = document.createElement(name) as LyraMarkdown;
  el.highlightCode = false;
  Object.assign(el, props);
  el.content = content;
  host.append(el);
  await el.updateComplete;
  return { host, el };
}

const contentOf = (el: LyraMarkdown): HTMLElement => el.shadowRoot!.querySelector<HTMLElement>('[part="content"]')!;
const nonMarkerChildren = (node: Node): Node[] => [...node.childNodes].filter((child) => child.nodeType !== Node.COMMENT_NODE);

function expectLtrCode(pre: HTMLElement): void {
  const style = getComputedStyle(pre);
  expect(style.direction).to.equal('ltr');
  expect(style.unicodeBidi).to.equal('isolate');
  expect(style.textAlign).to.equal('start');
}

describe('Markdown code direction: rendered geometry', () => {
  for (const name of ['lr-markdown', 'lr-markdown-core'] as const) {
    it(`${name} lays a fenced block out left-to-right from its start padding`, async () => {
      const long = `const long = '${'x'.repeat(120)}';`;
      const { el } = await mountRtl(name, `مقدمة\n\n\`\`\`js\nconst a = foo(1);\n${long}\n\`\`\`\n`);
      await waitUntil(() => Boolean(el.shadowRoot?.querySelector('pre[part~="code-block"]')));
      const pre = el.shadowRoot!.querySelector<HTMLElement>('pre[part~="code-block"]')!;
      expectLtrCode(pre);
      const first = glyphs(pre, 'const');
      expect(Math.abs(first.left - contentStart(pre))).to.be.at.most(2);
      expect(glyphs(pre, ';').left).to.be.greaterThan(first.right);
      const box = pre.getBoundingClientRect();
      expect(first.left).to.be.within(box.left, box.right);
    });

    it(`${name} lays an indented block out left-to-right`, async () => {
      const { el } = await mountRtl(name, 'مقدمة\n\n    const a = foo(1);\n');
      await waitUntil(() => Boolean(el.shadowRoot?.querySelector('pre[part~="code-block"]')));
      const pre = el.shadowRoot!.querySelector<HTMLElement>('pre[part~="code-block"]')!;
      expectLtrCode(pre);
      const first = glyphs(pre, 'const');
      expect(Math.abs(first.left - contentStart(pre))).to.be.at.most(2);
      expect(glyphs(pre, ';').left).to.be.greaterThan(first.right);
    });

    it(`${name} isolates inline code in right-to-left prose`, async () => {
      const { el } = await mountRtl(name, 'استخدم `--verbose` هنا');
      await waitUntil(() => Boolean(el.shadowRoot?.querySelector('[part="inline-code"]')));
      const code = el.shadowRoot!.querySelector<HTMLElement>('[part="inline-code"]')!;
      expect(getComputedStyle(code).direction).to.equal('ltr');
      expect(getComputedStyle(code).unicodeBidi).to.equal('isolate');
      expect(center(glyphs(code, '--'))).to.be.lessThan(center(glyphs(code, 'verbose')));
      const paragraph = el.shadowRoot!.querySelector<HTMLElement>('[part="paragraph"]')!;
      expect(Math.abs(glyphs(paragraph, 'استخدم').right - contentEnd(paragraph))).to.be.at.most(2);
    });

    it(`${name} keeps block placement and margins in page direction`, async () => {
      const { el } = await mountRtl(name, 'مقدمة\n\n```\ncode\n```\n\nخاتمة', { maxHeight: '20rem' });
      await waitUntil(() => Boolean(el.shadowRoot?.querySelector('pre[part~="code-block"]')));
      const pre = el.shadowRoot!.querySelector<HTMLElement>('pre[part~="code-block"]')!;
      const content = contentOf(el);
      expect(getComputedStyle(content).direction).to.equal('rtl');
      expect(Math.abs(pre.getBoundingClientRect().left - contentStart(content))).to.be.at.most(1);
      expect(Math.abs(pre.getBoundingClientRect().right - contentEnd(content))).to.be.at.most(1);
      expect(getComputedStyle(pre).marginInlineStart).to.equal('0px');
      expect(getComputedStyle(pre).marginInlineEnd).to.equal('0px');
    });

    it(`${name} does not stamp dir onto rendered code`, async () => {
      const { el } = await mountRtl(name, '```js\nx\n```\n\n    y\n\n`z`');
      await waitUntil(() => Boolean(el.shadowRoot?.querySelector('pre[part~="code-block"]')));
      expect(el.shadowRoot!.querySelectorAll('[part="content"] [dir]').length).to.equal(0);
    });

    it(`${name} orders authored sanitized code by glyph direction`, async () => {
      const { el } = await mountRtl(name, [
        '<p>استخدم <code>--verbose</code> هنا</p>',
        '',
        '<pre>const a = foo(1);\nمرحبا بالعالم</pre>',
        '',
        '<pre dir="rtl" id="rtl-pre"><code>const b = foo(2);</code></pre>',
        '',
        '<p><code dir="rtl">const c = foo(3);</code></p>',
      ].join('\n'), { htmlMode: 'sanitize' });
      await waitUntil(() => el.shadowRoot!.querySelectorAll('pre').length === 2);
      const root = contentOf(el);
      expect(center(glyphs(root, '--'))).to.be.lessThan(center(glyphs(root, 'verbose')));
      const [plain, rtl] = [...root.querySelectorAll<HTMLElement>('pre')];
      expect(glyphs(plain!, ';').left).to.be.greaterThan(glyphs(plain!, 'const').right);
      // Each line should read in its own direction. WebKit resolves `unicode-bidi: plaintext` from
      // the first strong character of the whole preformatted block rather than per line, so a
      // right-to-left line after a Latin one still lays out left-to-right there; the per-line
      // behavior is asserted only where engines implement it.
      if (!isWebKit) {
        expect(Math.abs(glyphs(plain!, 'مرحبا').right - contentEnd(plain!))).to.be.at.most(2);
        expect(center(glyphs(plain!, 'مرحبا'))).to.be.greaterThan(center(glyphs(plain!, 'بالعالم')));
      }
      expect(glyphs(rtl!, ';').right).to.be.at.most(glyphs(rtl!, 'const').left + 0.5);
      expect(glyphs(root, ';', 2).right).to.be.at.most(glyphs(root, 'const', 2).left + 0.5);
    });

    it(`${name} lets an outer ::part() rule restore right-to-left code, except in the fallback`, async () => {
      const style = document.createElement('style');
      style.textContent = `${name}::part(code-block), ${name}::part(inline-code) { direction: rtl }`;
      document.head.append(style);
      try {
        const { el } = await mountRtl(name, 'استخدم `--verbose` هنا\n\n```\nconst a = foo(1);\n```\n');
        await waitUntil(() => Boolean(el.shadowRoot?.querySelector('pre[part~="code-block"]')));
        const pre = el.shadowRoot!.querySelector<HTMLElement>('pre[part~="code-block"]')!;
        expect(getComputedStyle(pre.querySelector('code')!).direction).to.equal('rtl');
        expect(glyphs(pre, ';').right).to.be.at.most(glyphs(pre, 'const').left + 0.5);
        const inline = el.shadowRoot!.querySelector<HTMLElement>('[part="inline-code"]')!;
        expect(center(glyphs(inline, '--'))).to.be.greaterThan(center(glyphs(inline, 'verbose')));
        el.streaming = true;
        el.content += '\n```\nmore();\n';
        await waitUntil(() => Boolean(el.shadowRoot?.querySelector('.fallback-code')));
        expect(getComputedStyle(el.shadowRoot!.querySelector('.fallback-code')!).direction).to.equal('ltr');
      } finally {
        style.remove();
      }
    });

    it(`${name} keeps code left-to-right across a runtime direction flip without resettling`, async () => {
      const { host, el } = await mountRtl(name, 'مقدمة\n\n```\ncode\n```\n');
      await waitUntil(() => Boolean(el.shadowRoot?.querySelector('pre[part~="code-block"]')));
      let settled = 0;
      el.addEventListener('lr-content-settled', () => settled++);
      const pre = el.shadowRoot!.querySelector<HTMLElement>('pre[part~="code-block"]')!;
      const paragraph = el.shadowRoot!.querySelector<HTMLElement>('[part="paragraph"]')!;
      for (const dir of ['ltr', 'rtl'] as const) {
        host.dir = dir;
        await el.updateComplete;
        expect(getComputedStyle(pre).direction).to.equal('ltr');
        expect(getComputedStyle(paragraph).direction).to.equal(dir);
      }
      await aTimeout(50);
      expect(settled).to.equal(0);
    });

    it(`${name} is unchanged in a left-to-right document`, async () => {
      await loadMarkdownDeps();
      const host = await fixture<HTMLElement>(html`<div style="inline-size: 400px"></div>`);
      const el = document.createElement(name) as LyraMarkdown;
      el.highlightCode = false;
      el.content = '```\nconst a = foo(1);\n```\n';
      host.append(el);
      await waitUntil(() => Boolean(el.shadowRoot?.querySelector('pre[part~="code-block"]')));
      const pre = el.shadowRoot!.querySelector<HTMLElement>('pre[part~="code-block"]')!;
      expectLtrCode(pre);
      expect(Math.abs(glyphs(pre, 'const').left - contentStart(pre))).to.be.at.most(2);
    });

    it(`${name} passes axe in parsed, streaming and dark right-to-left states`, async () => {
      const { host, el } = await mountRtl(name, 'استخدم `--verbose` هنا\n\n```js\nconst a = 1;\n```\n');
      await waitUntil(() => Boolean(el.shadowRoot?.querySelector('pre[part~="code-block"]')));
      await expect(el).to.be.accessible();
      el.streaming = true;
      el.content += '\n```\nopen();\n';
      await waitUntil(() => Boolean(el.shadowRoot?.querySelector('.fallback-code')));
      await expect(el).to.be.accessible();
      // The dark theme's text needs the dark page surface behind it for axe's contrast check.
      host.setAttribute('data-lr-theme', 'dark');
      host.style.background = '#1a1a1a';
      await expect(el).to.be.accessible();
    });

    it(`${name} keeps bidi controls in code and still isolates it`, async () => {
      const content = 'مقدمة\n```\nconst s = "‮abc⁩";\n```\n';
      const { el } = await mountRtl(name, content, { streaming: true });
      await waitUntil(() => contentOf(el).textContent === content);
      expect(getComputedStyle(el.shadowRoot!.querySelector('.fallback-code')!).direction).to.equal('ltr');
      el.streaming = false;
      await waitUntil(() => Boolean(el.shadowRoot?.querySelector('pre[part~="code-block"]')));
      const pre = el.shadowRoot!.querySelector<HTMLElement>('pre[part~="code-block"]')!;
      expect(pre.textContent).to.include('‮abc⁩');
      expectLtrCode(pre);
    });
  }
});

describe('Markdown code direction: streaming timeline', () => {
  for (const name of ['lr-markdown', 'lr-markdown-core'] as const) {
    it(`${name} segments a streamed fence with no direction jump at completion`, async () => {
      const { el } = await mountRtl(name, '', { streaming: true });
      const root = contentOf(el);
      const steps = [
        'مقدمة\n',
        'استخدم `--verbose` هنا\n',
        '```js\n',
        'const a = foo(1);\n',
        '```\n',
        'خاتمة',
      ];
      let content = '';
      for (const [index, step] of steps.entries()) {
        content += step;
        el.content = content;
        await waitUntil(() => root.textContent === content, `step ${index} never rendered`);
        expect(renderedTemplateWhitespace(el.shadowRoot!, { allow: inMarkdownCodeBlock })).to.deep.equal([]);
        if (index === 0) {
          expect(Boolean(root.querySelector('.fallback-code, .fallback-inline-code'))).to.equal(false);
          const children = nonMarkerChildren(root);
          expect(children.length).to.equal(1);
          expect(children[0]!.nodeType).to.equal(Node.TEXT_NODE);
          expect((children[0] as Text).data).to.equal(content);
        }
        if (index === 1) {
          expect(root.querySelectorAll('.fallback-inline-code').length).to.equal(1);
          expect(center(glyphs(root, '--'))).to.be.lessThan(center(glyphs(root, 'verbose')));
        }
        if (index >= 2) expect(root.querySelectorAll('.fallback-code').length).to.equal(1);
        if (index === 3) {
          expect(glyphs(root, 'const').left).to.be.within(contentStart(root) - 2, contentStart(root) + 2);
          expect(glyphs(root, ';').left).to.be.greaterThan(glyphs(root, 'const').right);
          expect(el.getAttribute('aria-busy')).to.equal('true');
        }
      }
      const before = glyphs(root, 'const').left;
      const settled = new Promise((resolve) => el.addEventListener('lr-content-settled', resolve, { once: true }));
      el.streaming = false;
      await settled;
      await waitUntil(() => Boolean(el.shadowRoot?.querySelector('pre[part~="code-block"]')));
      const pre = el.shadowRoot!.querySelector<HTMLElement>('pre[part~="code-block"]')!;
      expect(getComputedStyle(pre).direction).to.equal('ltr');
      expect(Boolean(el.shadowRoot!.querySelector('.fallback-code, .fallback-inline-code'))).to.equal(false);
      const after = glyphs(pre, 'const');
      const padding = parseFloat(getComputedStyle(pre).paddingInlineStart);
      for (const left of [before, after.left]) expect(left).to.be.within(contentStart(root) - 2, contentStart(root) + padding + 2);
      expect(glyphs(pre, ';').left).to.be.greaterThan(after.right);
      const inline = el.shadowRoot!.querySelector<HTMLElement>('[part="inline-code"]')!;
      expect(center(glyphs(inline, '--'))).to.be.lessThan(center(glyphs(inline, 'verbose')));
    });

    it(`${name} gives the segmented fallback the same block size as unsegmented text`, async () => {
      const cases = ['P\n```js\nconst a = 1;\n```\n', '```js\nx\n```\nP', 'P\n```js\nopen', 'P\n```', '```\nx\n```', '```\nx\n```\nafter', 'a `b` c\n'];
      const original = MarkdownFallbackCodeScanner.prototype.segments;
      for (const content of cases) {
        const { el } = await mountRtl(name, content, { streaming: true });
        await waitUntil(() => contentOf(el).textContent === content);
        expect(Boolean(contentOf(el).querySelector('.fallback-code, .fallback-inline-code')), JSON.stringify(content)).to.equal(true);
        const segmented = contentOf(el).getBoundingClientRect().height;
        MarkdownFallbackCodeScanner.prototype.segments = () => null;
        try {
          const { el: plain } = await mountRtl(name, content, { streaming: true });
          await waitUntil(() => contentOf(plain).textContent === content);
          expect(Boolean(contentOf(plain).querySelector('.fallback-code, .fallback-inline-code'))).to.equal(false);
          expect(Math.abs(contentOf(plain).getBoundingClientRect().height - segmented), JSON.stringify(content)).to.be.at.most(1);
        } finally {
          MarkdownFallbackCodeScanner.prototype.segments = original;
        }
      }
    });

    it(`${name} rescans once and stays correct after a disconnect and reconnect`, async () => {
      const { host, el } = await mountRtl(name, 'مقدمة\n```js\nconst a = 1;\n', { streaming: true });
      await waitUntil(() => Boolean(contentOf(el).querySelector('.fallback-code')));
      el.remove();
      el.content += '```\nخاتمة `x` نهاية\n';
      host.append(el);
      await waitUntil(() => contentOf(el).textContent === el.content);
      expect(contentOf(el).querySelectorAll('.fallback-code').length).to.equal(1);
      expect(contentOf(el).querySelectorAll('.fallback-inline-code').length).to.equal(1);
    });
  }
});

type AnchorInternals = { anchorTimeoutMs: number; anchorRetryIntervalMs: number };
type HighlightInternals = { resolvedHighlightRanges: unknown[] };
type ScannerInternals = { fallbackCode: MarkdownFallbackCodeScanner };
type DepsInternals = { deps?: { marked: unknown; DOMPurify: unknown }; renderMarkdown(): void };

/** Streams `steps` into `el` one at a time, waiting for each to reach the fallback DOM. */
async function streamSteps(el: LyraMarkdown, steps: readonly string[], onStep: (index: number) => void | Promise<void> = () => undefined): Promise<void> {
  let content = el.content;
  for (const [index, step] of steps.entries()) {
    content += step;
    el.content = content;
    await waitUntil(() => contentOf(el).textContent === content, `step ${index} never rendered`);
    await onStep(index);
  }
}

const TIMELINE = ['مقدمة\n', 'استخدم `--verbose` هنا\n', '```js\n', 'const a = foo(1);\n', '```\n', 'خاتمة'] as const;

describe('Markdown code direction: streaming anchors and lifecycle', () => {
  for (const name of ['lr-markdown', 'lr-markdown-core'] as const) {
    it(`${name} leaves a prose range committed before the fence intact while the fence closes`, async () => {
      // A live Range over the prose Text node stands in for a user selection: WebKit refuses a
      // programmatic Selection inside a shadow tree, but a Range still collapses or detaches the
      // moment its node is replaced -- exactly the regression a selection would observe.
      const { el } = await mountRtl(name, '', { streaming: true });
      let range: Range | undefined;
      let pinned: [Node, number, number] | undefined;
      await streamSteps(el, TIMELINE, (index) => {
        if (index === 3) {
          const walker = document.createTreeWalker(contentOf(el), NodeFilter.SHOW_TEXT);
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const at = (node as Text).data.indexOf('مقدمة');
            if (at === -1) continue;
            range = document.createRange();
            range.setStart(node, at);
            range.setEnd(node, at + 'مقدمة'.length);
            pinned = [node, at, at + 'مقدمة'.length];
            break;
          }
          expect(range?.toString()).to.equal('مقدمة');
        }
        if (index >= 4) {
          expect(range!.toString(), `step ${index}`).to.equal('مقدمة');
          expect(range!.startContainer === pinned![0] && pinned![0].isConnected, `step ${index} replaced the prose node`).to.equal(true);
          expect([range!.startOffset, range!.endOffset], `step ${index}`).to.deep.equal([pinned![1], pinned![2]]);
        }
      });
    });

    it(`${name} resolves text quotes spanning prose into streamed code, with segmentation-independent highlight counts`, async () => {
      const content = 'مقدمة\n```js\nconst a = foo(1);\nfoo(1);\n';
      const highlights = [
        { id: 'span', anchor: { kind: 'text-quote' as const, quote: 'مقدمة\n```js' } },
        { id: 'code', anchor: { kind: 'text-quote' as const, quote: 'foo(1)' } },
      ];
      const counts: number[] = [];
      const original = MarkdownFallbackCodeScanner.prototype.segments;
      for (const segmented of [true, false]) {
        if (!segmented) MarkdownFallbackCodeScanner.prototype.segments = () => null;
        try {
          const { host, el } = await mountRtl(name, content, { streaming: true });
          Object.assign(el as unknown as AnchorInternals, { anchorTimeoutMs: 200, anchorRetryIntervalMs: 10 });
          await waitUntil(() => contentOf(el).textContent === content);
          expect(Boolean(contentOf(el).querySelector('.fallback-code')), `segmented=${segmented}`).to.equal(segmented);
          expect(await el.scrollToAnchor(highlights[0]!.anchor), `segmented=${segmented}`).to.equal(true);
          el.highlights = highlights;
          await el.updateComplete;
          counts.push((el as unknown as HighlightInternals).resolvedHighlightRanges.length);
          host.remove();
        } finally {
          MarkdownFallbackCodeScanner.prototype.segments = original;
        }
      }
      expect(counts[0]).to.be.greaterThan(0);
      expect(counts[0]).to.equal(counts[1]);
    });

    for (const firstAt of [0, 3]) {
      it(`${name} rebuilds a text-quote index first built at step ${firstAt} once the fallback resegments`, async () => {
        const { el } = await mountRtl(name, '', { streaming: true });
        Object.assign(el as unknown as AnchorInternals, { anchorTimeoutMs: 200, anchorRetryIntervalMs: 10 });
        await streamSteps(el, TIMELINE.slice(0, 5), async (index) => {
          if (index === firstAt) {
            expect(await el.scrollToAnchor({ kind: 'text-quote', quote: 'مقدمة' })).to.equal(true);
          }
          if (index === 4) {
            // Inside the code, which only exists as its own segment after the step-0 build.
            expect(await el.scrollToAnchor({ kind: 'text-quote', quote: 'foo(1)' })).to.equal(true);
          }
        });
      });
    }

    it(`${name} rescans once after adoption into another document and then stays incremental`, async () => {
      const iframe = await fixture<HTMLIFrameElement>(html`<iframe style="inline-size: 400px; block-size: 200px"></iframe>`);
      const frameDocument = iframe.contentDocument!;
      frameDocument.body.dir = 'rtl';
      const { el } = await mountRtl(name, '', { streaming: true });
      await streamSteps(el, TIMELINE.slice(0, 4));
      const scanner = (el as unknown as ScannerInternals).fallbackCode;
      const before = scanner.scannedCodeUnits;
      frameDocument.body.append(frameDocument.adoptNode(el));
      await el.updateComplete;
      await waitUntil(() => contentOf(el).textContent === el.content, 'adopted element never re-rendered');
      // One rescan of the whole source, plus at most one fence probe (64 code units).
      expect(scanner.scannedCodeUnits - Math.min(before, scanner.scannedCodeUnits)).to.be.at.most(el.content.length + 64);
      const expected = segmentMarkdownFallback(el.content)!;
      const rendered = [...contentOf(el).querySelectorAll('.fallback-code, .fallback-inline-code')].map((node) => node.textContent);
      expect(rendered).to.deep.equal(expected.filter((segment) => segment.kind !== 'prose').map((segment) => segment.text));
      const block = contentOf(el).querySelector('.fallback-code')!;
      expect(block.ownerDocument === frameDocument).to.equal(true);
      const afterAdoption = scanner.scannedCodeUnits;
      const append = 'bar(2);\n';
      el.content += append;
      await waitUntil(() => contentOf(el).textContent === el.content);
      expect(scanner.scannedCodeUnits - afterAdoption).to.be.at.most(append.length + 64);
      el.remove();
    });

    it(`${name} segments fenced code in the sanitizer-failure fallback and reports the render error`, async () => {
      const { el } = await mountRtl(name, 'مقدمة\n```js\nconst a = foo(1);\n```\n', { htmlMode: 'sanitize' });
      const internals = el as unknown as DepsInternals;
      await waitUntil(() => internals.deps !== undefined);
      const runtime = globalThis as typeof globalThis & { litIssuedWarnings?: Set<string> };
      const originalIssuedWarnings = runtime.litIssuedWarnings;
      const originalWarn = console.warn;
      const messages: string[] = [];
      runtime.litIssuedWarnings = new Set();
      console.warn = (...args: unknown[]) => messages.push(args.map(String).join(' '));
      const errors: unknown[] = [];
      const onError = (event: Event): void => {
        errors.push((event as CustomEvent<{ error: unknown }>).detail.error);
      };
      el.addEventListener('lr-render-error', onError);
      try {
        internals.deps = {
          marked: internals.deps!.marked,
          DOMPurify: { sanitize(): never { throw new Error('sanitizer failure'); } },
        };
        internals.renderMarkdown();
        await el.updateComplete;
      } finally {
        el.removeEventListener('lr-render-error', onError);
        if (originalIssuedWarnings === undefined) delete runtime.litIssuedWarnings;
        else runtime.litIssuedWarnings = originalIssuedWarnings;
        console.warn = originalWarn;
      }
      expect(errors.length).to.equal(1);
      expect(messages.length).to.equal(1);
      const block = contentOf(el).querySelector<HTMLElement>('.fallback-code');
      expect(block?.textContent).to.equal('```js\nconst a = foo(1);\n```\n');
      expect(getComputedStyle(block!).direction).to.equal('ltr');
      expect(contentOf(el).querySelector('pre') === null).to.equal(true);
    });
  }
});

describe('Markdown code direction: highlighted and serialized output', () => {
  for (const name of ['lr-markdown', 'lr-markdown-core'] as const) {
    it(`${name} keeps a Shiki-highlighted block left-to-right at the plain render's glyph position`, async function () {
      // The real optional peer: a cold Shiki load (WASM + grammar) can take several seconds on a
      // loaded runner, the same budget markdown.test.ts's first real-peer test documents.
      this.timeout(60_000);
      const tsLang = await import('shiki/langs/typescript.mjs');
      const { el } = await mountRtl(name, 'مقدمة\n\n```typescript\nconst a = foo(1);\n```\n', {
        highlightCode: true,
        ...(name === 'lr-markdown-core' ? { languages: { typescript: tsLang.default } } : {}),
      } as Partial<LyraMarkdown>);
      await waitUntil(() => Boolean(el.shadowRoot?.querySelector('pre[part~="code-block"]')));
      const plainPre = el.shadowRoot!.querySelector<HTMLElement>('pre[part~="code-block"]')!;
      expect(plainPre.querySelector('span[style], span[data-lr-shiki-light]') === null).to.equal(true);
      const plainOffset = glyphs(plainPre, 'const').left - contentStart(plainPre);
      await waitUntil(
        () => Boolean(el.shadowRoot!.querySelector('pre[part~="code-block"] code span')),
        'never highlighted',
        { timeout: 45_000 },
      );
      const pre = el.shadowRoot!.querySelector<HTMLElement>('pre[part~="code-block"]')!;
      expectLtrCode(pre);
      expect(Math.abs(glyphs(pre, 'const').left - contentStart(pre) - plainOffset)).to.be.at.most(1);
      expect(glyphs(pre, ';').left).to.be.greaterThan(glyphs(pre, 'const').right);
    });
  }

  it('serializes plain, indented and cached-highlight code blocks with no dir attribute', async () => {
    const deps = await loadMarkdownDeps();
    const cached = tokenizeMarkdownHighlight(
      {
        codeToHtml: () =>
          '<pre style="background-color:#ffffff"><code><span style="color:#24292f;--shiki-dark:#e6edf3">cached()</span></code></pre>',
      } as never,
      { key: 'ts\ncached()\n', lang: 'ts', code: 'cached()\n' },
    );
    const content = '```\nconst a = foo(1);\n```\n\n    indented();\n\n```ts\ncached()\n```\n';
    const outcome = renderMarkdownDocument({
      tag: 'lr-markdown',
      deps,
      htmlMode: 'sanitize',
      math: false,
      parse: (marked, pendingKeys, headingTreeOut) => {
        const result = parseMarkdownDocument({
          marked,
          content,
          gfm: true,
          linkTarget: null,
          headingOffset: 0,
          escapeHtmlOption: false,
          trustedHtmlOption: false,
          highlightCodeOption: true,
          getCachedHighlight: () => cached ?? undefined,
          failedHighlightKeys: new Set(),
          headingAnchorsOption: false,
          mathOption: false,
          cachedKatex: null,
          pendingKeys,
          headingTreeOut,
        });
        return { html: result.html, hadMathFallback: result.hadMathFallback };
      },
      onParsed: () => undefined,
      isKatexConfirmedMissing: () => false,
    });
    expect(outcome.status).to.equal('rendered');
    const serialized = outcome.status === 'rendered' ? outcome.html : '';
    expect(serialized).to.not.match(/\sdir=/);
    expect(serialized).to.equal(PINNED_CODE_DOCUMENT);
  });
});

// Recorded from the serializer: code direction is presentation-only (CSS), so the rendered
// document string carries no direction markup and must not drift.
const PINNED_CODE_DOCUMENT = [
  '<pre part="code-block" tabindex="0"><code>const a = foo(1);\n</code></pre>\n',
  '<pre part="code-block" tabindex="0"><code>indented();\n</code></pre>\n',
  '<pre style="background-color:#ffffff"><code><span style="color:#24292f;--shiki-dark:#e6edf3">cached()</span></code></pre>\n',
].join('');

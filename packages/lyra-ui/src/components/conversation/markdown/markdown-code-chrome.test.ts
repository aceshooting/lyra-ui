import { expect, fixture, html, waitUntil, aTimeout } from '@open-wc/testing';
import jsonGrammar from 'shiki/langs/json.mjs';
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import './markdown.js';
import './markdown-core.js';
import type { MarkdownStreamingRenderMode } from './markdown-base.class.js';
import { loadMarkdownDeps } from './markdown-loader.js';

const tags = ['lr-markdown', 'lr-markdown-core'] as const;
const fencedSource = 'const message = "<b> & café 🚀";\n';
const fencedContent = `\`\`\`json\n${fencedSource}\`\`\``;

interface MarkdownChromeElement extends HTMLElement {
  codeBlockChrome: boolean;
  content: string;
  highlightCode: boolean;
  htmlMode: 'sanitize' | 'escape' | 'trusted';
  languages: Record<string, unknown>;
  streaming: boolean;
  streamingRender: MarkdownStreamingRenderMode;
  strings: LyraLocaleStrings;
  renderMarkdown(): void;
  updateComplete: Promise<unknown>;
}

interface CopyButtonElement extends HTMLElement {
  copyLabel: string;
  value: string;
  updateComplete: Promise<unknown>;
}

async function mount(
  tagName: (typeof tags)[number],
  options: Partial<Pick<MarkdownChromeElement, 'content' | 'codeBlockChrome' | 'highlightCode' | 'htmlMode' | 'languages' | 'streaming' | 'streamingRender' | 'strings'>> = {},
): Promise<MarkdownChromeElement> {
  await loadMarkdownDeps();
  const wrapper = await fixture<HTMLElement>(html`<div></div>`);
  const el = document.createElement(tagName) as MarkdownChromeElement;
  for (const [key, value] of Object.entries(options)) {
    (el as unknown as Record<string, unknown>)[key] = value;
  }
  wrapper.append(el);
  await el.updateComplete;
  return el;
}

async function waitForMarkdown(el: MarkdownChromeElement, selector: string): Promise<void> {
  await waitUntil(
    () => el.shadowRoot?.querySelector(selector) != null && !el.shadowRoot.querySelector('[part="content"]')?.hasAttribute('data-fallback'),
    `Markdown output did not contain ${selector}`,
  );
}

function headers(el: MarkdownChromeElement): Element[] {
  return [...el.shadowRoot!.querySelectorAll('[part="code-block-header"]')];
}

function copyControl(el: MarkdownChromeElement): CopyButtonElement {
  return el.shadowRoot!.querySelector('[part="code-block-copy"]') as CopyButtonElement;
}

async function withClipboard(writes: string[], run: () => Promise<void>): Promise<void> {
  const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: (text: string) => { writes.push(text); return Promise.resolve(); } },
    configurable: true,
  });
  try {
    await run();
  } finally {
    if (original) Object.defineProperty(navigator, 'clipboard', original);
    else Reflect.deleteProperty(navigator, 'clipboard');
  }
}

for (const tagName of tags) {
  describe(`${tagName} code-block chrome`, () => {
    it('leaves code blocks unchanged when the opt-in is absent', async () => {
      const el = await mount(tagName, { content: fencedContent });
      await waitForMarkdown(el, '[part="code-block"]');
      expect(el.codeBlockChrome ?? false).to.equal(false);
      expect(headers(el)).to.have.length(0);
    });

    it('localizes the language and copy labels and copies the exact raw code text', async () => {
      const el = await mount(tagName, {
        content: fencedContent,
        codeBlockChrome: true,
        highlightCode: false,
        strings: {
          codeRegionWithLanguage: '{language} source',
          copyCode: 'Copy source',
        },
      });
      await waitForMarkdown(el, '[part="code-block-header"]');
      const language = el.shadowRoot!.querySelector('[part="code-block-language"]')!;
      const copy = copyControl(el);
      expect(language.textContent).to.equal('json source');
      expect(copy.localName).to.equal('lr-copy-button');
      expect(copy.copyLabel).to.equal('Copy source');
      expect(copy.value).to.equal(fencedSource);

      const writes: string[] = [];
      await copy.updateComplete;
      await withClipboard(writes, async () => {
        copy.shadowRoot!.querySelector<HTMLButtonElement>('[part~="base"]')!.click();
        await waitUntil(() => writes.length === 1);
      });
      expect(writes).to.deep.equal([fencedSource]);
    });

    it('adds chrome only to fenced code, excluding indented code and authored marker lookalikes', async () => {
      const content = [
        '```json',
        '{"kind":"fenced"}',
        '```',
        '',
        '    this is indented code',
        '',
        '<pre data-fenced="true"><code>authored HTML</code></pre>',
      ].join('\n');
      const el = await mount(tagName, { content, codeBlockChrome: true, highlightCode: false, htmlMode: 'trusted' });
      await waitForMarkdown(el, '[part="code-block-header"]');
      expect(headers(el)).to.have.length(1);
      const blocks = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="code-block"]')];
      expect(blocks).to.have.length(2);
      expect(blocks[0]!.hasAttribute('data-fenced')).to.be.true;
      expect(blocks[1]!.hasAttribute('data-fenced')).to.be.false;
      expect(blocks[1]!.previousElementSibling?.getAttribute('part')).to.not.equal('code-block-header');
      const authoredPre = [...el.shadowRoot!.querySelectorAll<HTMLPreElement>('pre')].find((pre) =>
        pre.textContent?.includes('authored HTML')
      );
      expect(authoredPre).to.exist;
      expect(authoredPre!.hasAttribute('data-fenced')).to.be.false;
      expect(el.shadowRoot!.querySelector('pre[data-fenced="true"] code')?.textContent).to.include('fenced');
    });

    it('waits for a closing fence while streaming and adds chrome once the block settles', async () => {
      const el = await mount(tagName, {
        content: '```json\n{"open":true}',
        codeBlockChrome: true,
        highlightCode: false,
        streaming: true,
        streamingRender: 'progressive',
      });
      await waitForMarkdown(el, '[part="code-block"][data-open-fence]');
      expect(headers(el)).to.have.length(0);

      el.content = '```json\n{"closed":true}\n```\n\nSettled tail';
      await waitForMarkdown(el, '[part="code-block"][data-fenced="true"]');
      expect(el.getAttribute('aria-busy')).to.equal('true');
      expect(headers(el)).to.have.length(1);
    });

    it('removes and restores the header cleanly when toggled and re-rendered', async () => {
      const el = await mount(tagName, {
        content: fencedContent,
        codeBlockChrome: true,
        highlightCode: false,
      });
      await waitForMarkdown(el, '[part="code-block-header"]');
      expect(headers(el)).to.have.length(1);

      el.codeBlockChrome = false;
      await el.updateComplete;
      await waitUntil(() => headers(el).length === 0);
      el.codeBlockChrome = true;
      await el.updateComplete;
      await waitUntil(() => headers(el).length === 1);

      el.renderMarkdown();
      await el.updateComplete;
      await waitUntil(() => headers(el).length === 1);
      expect(headers(el)).to.have.length(1);
    });

    it('does not duplicate chrome when highlighted markup replaces the plain block', async function () {
      this.timeout(60_000);
      const el = await mount(tagName, {
        content: '```json\n{"value":"<b> & café 🚀"}\n```',
        codeBlockChrome: true,
        languages: { json: jsonGrammar },
      });
      await waitForMarkdown(el, '[part="code-block-header"]');
      expect(headers(el)).to.have.length(1);
      await waitUntil(
        () => el.shadowRoot?.querySelector('[part="code-block"] span') != null,
        'the JSON block was not highlighted',
        { timeout: 45_000 },
      );
      await aTimeout(0);
      expect(headers(el)).to.have.length(1);

      el.renderMarkdown();
      await el.updateComplete;
      await waitUntil(() => el.shadowRoot?.querySelector('[part="code-block"] span') != null);
      expect(headers(el)).to.have.length(1);
    });
  });
}

import { expect, fixture, html, waitUntil, aTimeout } from '@open-wc/testing';
import jsonGrammar from 'shiki/langs/json.mjs';
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import './markdown.js';
import './markdown-core.js';
import type { MarkdownStreamingRenderMode } from './markdown-base.class.js';
import { loadMarkdownDeps } from './markdown-loader.js';
import {
  captureDeprecationWarnings,
  expectDeprecatedUsage,
} from '../../../../test/expected-deprecations.js';

const tags = ['lr-markdown', 'lr-markdown-core'] as const;
// The header tests below keep exercising the deprecated `codeBlockChrome` spelling as parity
// coverage for `codeBlockHeader`; it must keep enabling the header until its removal.
for (const tagName of tags) expectDeprecatedUsage(tagName, 'property', 'codeBlockChrome');
const fencedSource = 'const message = "<b> & café 🚀";\n';
const fencedContent = `\`\`\`json\n${fencedSource}\`\`\``;

interface MarkdownChromeElement extends HTMLElement {
  codeBlockChrome: boolean;
  codeBlockHeader: boolean;
  content: string;
  withoutSyntaxHighlighting: boolean;
  htmlMode: 'sanitize' | 'escape' | 'trusted';
  languages: Record<string, unknown>;
  streaming: boolean;
  streamingRender: MarkdownStreamingRenderMode;
  strings: LyraLocaleStrings;
  renderMarkdown(): void;
  updateComplete: Promise<unknown>;
}

async function mount(
  tagName: (typeof tags)[number],
  options: Partial<Pick<MarkdownChromeElement, 'content' | 'codeBlockChrome' | 'codeBlockHeader' | 'withoutSyntaxHighlighting' | 'htmlMode' | 'languages' | 'streaming' | 'streamingRender' | 'strings'>> = {},
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

function copyControl(el: MarkdownChromeElement): HTMLButtonElement {
  return el.shadowRoot!.querySelector('[part~="code-block-copy"]') as HTMLButtonElement;
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
        withoutSyntaxHighlighting: true,
        strings: {
          codeRegionWithLanguage: '{language} source',
          copyCode: 'Copy source',
        },
      });
      await waitForMarkdown(el, '[part="code-block-header"]');
      const language = el.shadowRoot!.querySelector('[part="code-block-language"]')!;
      const copy = copyControl(el);
      expect(language.getAttribute('data-language')).to.equal('json');
      expect(language.closest('[role="group"]')?.getAttribute('aria-label')).to.equal('json source');
      expect(copy.localName).to.equal('button');
      expect(copy.getAttribute('aria-label')).to.equal('Copy source');

      const writes: string[] = [];
      await withClipboard(writes, async () => {
        copy.click();
        await waitUntil(() => writes.length === 1);
      });
      expect(writes).to.deep.equal([fencedSource.replace(/\n$/, '')]);
    });

    it('adds chrome to built-in fenced and indented code without decorating authored lookalikes', async () => {
      const content = [
        '```json',
        '{"kind":"fenced"}',
        '```',
        '',
        '    this is indented code',
        '',
        '<pre data-fenced="true"><code>authored HTML</code></pre>',
      ].join('\n');
      const el = await mount(tagName, { content, codeBlockChrome: true, withoutSyntaxHighlighting: true, htmlMode: 'trusted' });
      await waitForMarkdown(el, '[part="code-block-header"]');
      expect(headers(el)).to.have.length(2);
      const blocks = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="code-block"]')];
      expect(blocks).to.have.length(2);
      expect(blocks.every((block) => block.parentElement?.part.contains('code-block-frame'))).to.equal(true);
      const authoredPre = [...el.shadowRoot!.querySelectorAll<HTMLPreElement>('pre')].find((pre) => pre.textContent?.includes('authored HTML'));
      expect(Boolean(authoredPre)).to.equal(true);
      expect(authoredPre?.parentElement?.part.contains('code-block-frame')).to.equal(false);
    });

    it('waits for a closing fence while streaming and adds chrome once the block settles', async () => {
      const el = await mount(tagName, {
        content: '```json\n{"open":true}',
        codeBlockChrome: true,
        withoutSyntaxHighlighting: true,
        streaming: true,
        streamingRender: 'progressive',
      });
      await waitForMarkdown(el, 'pre[part="code-block"]');
      expect(headers(el)).to.have.length(0);

      el.content = '```json\n{"closed":true}\n```\n\nSettled tail';
      await waitForMarkdown(el, '[part="code-block-frame"] [part="code-block"]');
      expect(el.getAttribute('aria-busy')).to.equal('true');
      expect(headers(el)).to.have.length(1);
    });

    it('removes and restores the header cleanly when toggled and re-rendered', async () => {
      const el = await mount(tagName, {
        content: fencedContent,
        codeBlockChrome: true,
        withoutSyntaxHighlighting: true,
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

for (const tagName of tags) {
  describe(`${tagName} deprecated code-block-chrome spelling`, () => {
    const usage = [{ tag: tagName, kind: 'property', name: 'codeBlockChrome' }] as const;

    it('warns once, naming code-block-header, and still renders the header', async () => {
      let headerCount = 0;
      const warnings = await captureDeprecationWarnings(usage, async () => {
        const el = await mount(tagName, { content: fencedContent, codeBlockChrome: true, withoutSyntaxHighlighting: true });
        await waitForMarkdown(el, '[part="code-block-header"]');
        headerCount = headers(el).length;
        const second = await mount(tagName, { content: fencedContent, codeBlockChrome: true, withoutSyntaxHighlighting: true });
        await second.updateComplete;
      });
      expect(headerCount).to.equal(1);
      expect(warnings.map(({ key }) => key)).to.deep.equal([
        `lyra-deprecated:${tagName}:property:codeBlockChrome`,
      ]);
      expect(warnings[0]!.message).to.contain('code-block-header');
    });

    it('warns when the code-block-chrome attribute is authored', async () => {
      const warnings = await captureDeprecationWarnings(usage, async () => {
        await loadMarkdownDeps();
        const wrapper = await fixture<HTMLElement>(html`<div></div>`);
        wrapper.innerHTML = `<${tagName} code-block-chrome></${tagName}>`;
        await (wrapper.firstElementChild as MarkdownChromeElement).updateComplete;
      });
      expect(warnings).to.have.length(1);
    });

    it('never warns for code-block-header, whose value the alias follows silently', async () => {
      let headerCount = 0;
      let aliasValue = false;
      const warnings = await captureDeprecationWarnings(usage, async () => {
        const el = await mount(tagName, { content: fencedContent, codeBlockHeader: true, withoutSyntaxHighlighting: true });
        await waitForMarkdown(el, '[part="code-block-header"]');
        headerCount = headers(el).length;
        aliasValue = el.codeBlockChrome;
        // Re-writing the value the alias already holds is not a change and never warns.
        el.codeBlockChrome = true;
        await el.updateComplete;
      });
      expect(headerCount).to.equal(1);
      expect(aliasValue).to.equal(true);
      expect(warnings).to.have.length(0);
    });

    it('keeps code-block-chrome and code-block-header in step, the last write winning', async () => {
      let el!: MarkdownChromeElement;
      await captureDeprecationWarnings(usage, async () => {
        el = await mount(tagName, { content: fencedContent, codeBlockHeader: true, withoutSyntaxHighlighting: true });
        await waitForMarkdown(el, '[part="code-block-header"]');
        el.codeBlockChrome = false;
        await el.updateComplete;
      });
      expect(el.codeBlockHeader, 'the later alias write wins').to.equal(false);
      await waitUntil(() => headers(el).length === 0, 'the alias write never removed the header');
      el.codeBlockHeader = true;
      await el.updateComplete;
      expect(el.codeBlockChrome, 'a canonical write syncs back to the alias').to.equal(true);
      await waitUntil(() => headers(el).length === 1, 'the canonical write never restored the header');
    });
  });
}

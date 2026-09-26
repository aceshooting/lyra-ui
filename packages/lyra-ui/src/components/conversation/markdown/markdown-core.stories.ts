import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import tsGrammar from 'shiki/langs/typescript.mjs';
import './markdown-core.js';
import type { LyraMarkdownCore } from './markdown-core.js';

const meta: Meta = {
  title: 'MarkdownCore',
  component: 'lr-markdown-core',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A build-lean variant of `lr-markdown` for a consumer whose `languages` map already ' +
          "covers every language it renders. This component's own module never " +
          "references shiki's full ~200-language default entry point at all, so importing it gives " +
          'a genuine compile-time exclusion of that table from the build output. A fenced-block ' +
          'language absent from `languages` always renders the plain-text fallback. A reconnect ' +
          'during the shared parser/sanitizer load invalidates the prior connection callback.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const sample = `# Build-lean Markdown

\`\`\`typescript
export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`
`;

export const Default: Story = {
  render: () => html`
    <lr-markdown-core
      .languages=${{ typescript: tsGrammar }}
      content=${sample}
      style="max-width: 32rem;"
    ></lr-markdown-core>
  `,
};

export const LanguageNotInMap: Story = {
  name: 'Language absent from the languages map (always plain text)',
  render: () => html`
    <lr-markdown-core
      .languages=${{}}
      content=${'```python\nprint("no python grammar was supplied")\n```'}
      style="max-width: 32rem;"
    ></lr-markdown-core>
  `,
};

export const Narrow320: Story = {
  name: 'Narrow allocation (320px)',
  render: () => html`
    <div style="inline-size: 320px; max-inline-size: 100%;">
      <lr-markdown-core .languages=${{ typescript: tsGrammar }} content=${sample}></lr-markdown-core>
    </div>
  `,
};

export const TasksTablesAndRtlCode: Story = {
  name: 'Tasks, scrolling tables, and code in RTL prose',
  render: () => html`
    <div dir="rtl" style="inline-size: 320px; max-inline-size: 100%;">
      <lr-markdown-core
        .languages=${{}}
        .content=${`- [x] Review the task list
- [ ] Finish the review

| Check | Outcome | Detail |
| --- | --- | --- |
| Keyboard | Median | QuarterlyEnergyProductionForecastForRooftopInstallations keeps words intact and scrolls inline |

\`\`\`js
function moveLeft() { return 'left'; }
\`\`\``}
      ></lr-markdown-core>
    </div>
  `,
};

/** `tab-size` controls leading-tab expansion before Markdown parsing, independently of code paint. */
export const LeadingTabParsing: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`tab-size="2"` expands the leading tab to two spaces before parsing, so the line remains paragraph text instead of becoming a four-space indented code block.',
      },
    },
  },
  render: () => html`
    <lr-markdown-core
      tab-size="2"
      .languages=${{}}
      .content=${'Intro\n\n\tA tab-indented paragraph'}
    ></lr-markdown-core>
  `,
};

export const InstanceParserRefresh: Story = {
  name: 'Instance parser refresh',
  parameters: {
    docs: {
      description: {
        story:
          'The button temporarily configures this element’s isolated `marked` parser, calls the public `renderMarkdown()` refresh method, and restores that instance’s defaults immediately afterward.',
      },
    },
  },
  render: () => html`
    <div style="display:flex; flex-direction:column; align-items:start; gap:var(--lr-space-s);">
      <button
        type="button"
        @click=${(event: Event) => {
          const markdown = (event.currentTarget as HTMLElement).nextElementSibling as LyraMarkdownCore;
          const parser = markdown.marked;
          if (!parser) return;
          const originalDefaults = { ...parser.defaults };
          try {
            parser.use({
              hooks: {
                preprocess: (source: string) => source.replace('CONFIGURED_TOKEN', '**Configured core parser**'),
              },
            });
            markdown.renderMarkdown();
          } finally {
            for (const key of Object.keys(parser.defaults)) delete parser.defaults[key];
            Object.assign(parser.defaults, originalDefaults);
          }
        }}
      >
        Refresh with shared parser
      </button>
      <lr-markdown-core .languages=${{}} .content=${'CONFIGURED_TOKEN'}></lr-markdown-core>
    </div>
  `,
};

export const TabWidth: Story = {
  name: 'Tab width (--lr-code-block-tab-size)',
  parameters: {
    docs: {
      description: {
        story:
          'The same `--lr-code-block-tab-size` token `lr-code-block` and `lr-code-editor` use, re-declared here because those are sibling elements rather than ancestors. A Markdown code block preserves lines (`white-space: pre`) and scrolls horizontally, like `lr-code-block`, so literal tab stops agree at the same value.',
      },
    },
  },
  render: () => html`
    <div style="display:flex; flex-direction:column; gap:0.75rem; max-width:32rem;">
      <lr-markdown-core .languages=${{}} content=${'```\n\tone tab\n\t\ttwo tabs\n```'}></lr-markdown-core>
      <lr-markdown-core
        .languages=${{}}
        content=${'```\n\tone tab\n\t\ttwo tabs\n```'}
        style="--lr-code-block-tab-size: 8"
      ></lr-markdown-core>
    </div>
  `,
};

/** Content removal clears the document without changing the native attribute readback. */
export const ClearContent: Story = {
  render: () => html`
    <div>
      <button type="button" @click=${(event: Event) => {
        const markdown = (event.currentTarget as HTMLElement).nextElementSibling!;
        if (markdown.hasAttribute('content')) markdown.removeAttribute('content');
        else markdown.setAttribute('content', '**Restored document**');
      }}>Clear or restore content</button>
      <lr-markdown-core content="**Visible document**"></lr-markdown-core>
    </div>
  `,
};

const longSample = Array.from(
  { length: 40 },
  (_, index) => `## Section ${index}\n\nSome body text for section ${index}.`
).join('\n\n');

export const MaxHeightScrolling: Story = {
  render: () => html`
    <lr-markdown-core .content=${longSample} max-height="10rem" style="max-width: 32rem;"></lr-markdown-core>
  `,
};

export const TaskLists: Story = {
  parameters: { docs: { description: { story: 'Mixed, all-task, loose, nested and ordered task lists. The read-only checkbox replaces the bullet in unordered lists and follows the numeral in ordered ones.' } } },
  render: () => html`<div style="display:grid; gap:1rem; max-inline-size:32rem;">
    <lr-markdown-core .content=${'- Ordinary item\n- [ ] Open task with enough text to wrap onto a second line so the hang stays visible\n- [x] Completed task\n\n- [x] All-task list\n- [ ] Second task\n\n- [ ] Loose task\n\n- [x] Loose completed task\n\n- [ ] Parent task\n  - Nested plain item\n  - [x] Nested completed task\n\n3. [x] Ordered task keeps its numeral\n4. [ ] Next ordered task'}></lr-markdown-core>
    <div dir="rtl"><lr-markdown-core .content=${'- Ordinary item\n- [ ] Open task with enough text to wrap onto a second line so the hang stays visible\n- [x] Completed task\n\n- [x] All-task list\n- [ ] Second task\n\n- [ ] Loose task\n\n- [x] Loose completed task\n\n- [ ] Parent task\n  - Nested plain item\n  - [x] Nested completed task\n\n3. [x] Ordered task keeps its numeral\n4. [ ] Next ordered task'}></lr-markdown-core></div>
  </div>`,
};
export const WideGfmTables: Story = {
  parameters: { docs: { description: { story: 'At 390px: a long prose cell wraps between words, an aligned table applies GFM alignment, and a six-column identifier table scrolls inside its keyboard-focusable `table-wrapper`. The second copy is right-to-left.' } } },
  render: () => html`<div style="display:grid; gap:1rem;">
    <div style="inline-size: 390px; max-inline-size: 100%"><lr-markdown-core .content=${'| Name | Notes |\n| --- | --- |\n| Report | A long prose cell that wraps only between words, never in the middle of a word, however narrow the column gets. |\n\n| Left | Center | Right | Default |\n| :--- | :---: | ---: | --- |\n| a | b | 42 | d |\n\n| Identifier | Region | Owner | Created | Status | Checksum |\n| --- | --- | --- | --- | --- | --- |\n| svc-authentication-gateway-primary | eu-central-1 | platform-infrastructure-team | 2026-09-25T10:00:00Z | operational | 9f86d081884c7d659a2feaa0c55ad015 |'}></lr-markdown-core></div>
    <div dir="rtl" style="inline-size: 390px; max-inline-size: 100%"><lr-markdown-core .content=${'| Name | Notes |\n| --- | --- |\n| Report | A long prose cell that wraps only between words, never in the middle of a word, however narrow the column gets. |\n\n| Left | Center | Right | Default |\n| :--- | :---: | ---: | --- |\n| a | b | 42 | d |\n\n| Identifier | Region | Owner | Created | Status | Checksum |\n| --- | --- | --- | --- | --- | --- |\n| svc-authentication-gateway-primary | eu-central-1 | platform-infrastructure-team | 2026-09-25T10:00:00Z | operational | 9f86d081884c7d659a2feaa0c55ad015 |'}></lr-markdown-core></div>
  </div>`,
};
export const CodeBlockHeaders: Story = {
  render: () => html`<lr-markdown-core code-block-header .content=${'```ts\nconst greeting = "Hello";\n```\n\n    indented code'}></lr-markdown-core>`,
};
export const RightToLeftCode: Story = {
  parameters: { docs: { description: { story: 'Arabic prose with inline code, a fenced block with one long line, an indented block and an authored `<pre>` of Arabic verse in sanitize mode. Code reads left-to-right; prose and the authored verse follow their own direction.' } } },
  render: () => html`<div dir="rtl" lang="ar" style="inline-size: 400px; max-inline-size: 100%"><lr-markdown-core code-block-header .highlightCode=${false} .content=${'استخدم الخيار `--verbose` لعرض التفاصيل.\n\n```js\nconst report = buildReport({ verbose: true, locale: \'ar\', includeTimings: true, destination: \'./out/report.json\' });\n```\n\n    indented_code --flag\n\n<pre>قصيدة عربية\nسطر ثانٍ من الشعر</pre>'}></lr-markdown-core></div>`,
};

export const ProgressiveStreaming: Story = {
  render: () => html`<div>
    <button type="button" @click=${(event: Event) => {
      const element = (event.currentTarget as HTMLElement).parentElement!.querySelector('lr-markdown-core') as LyraMarkdownCore;
      element.content += '\n\n## Next block\n\nAnother **settled** paragraph.\n\nStreaming tail';
    }}>Append blocks</button>
    <button type="button" @click=${(event: Event) => {
      const element = (event.currentTarget as HTMLElement).parentElement!.querySelector('lr-markdown-core') as LyraMarkdownCore;
      element.streaming = !element.streaming;
    }}>Toggle completion</button>
    <lr-markdown-core streaming streaming-render="progressive" code-block-header
      .content=${'# Settled heading\n\nA **rendered paragraph**.\n\n```js\nconst answer = 42;\n```\n\nCurrent tail'}></lr-markdown-core>
  </div>`,
};

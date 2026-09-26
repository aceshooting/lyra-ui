import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './markdown.js';
import type { LyraMarkdown } from './markdown.js';

const meta: Meta = {
  title: 'Markdown',
  component: 'lr-markdown',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Sanitized Markdown-to-HTML rendering (GFM tables, fenced code blocks, links, blockquotes) built on the optional `marked` + `dompurify` peer dependencies, lazy-loaded on first use. Without those peers installed — or when sanitization is requested but `dompurify` is unavailable — content renders as safe plain text and a `lr-render-error` event fires instead of shipping broken or unsanitized markup. A disconnect/reconnect during the shared load applies only the current connection settlement.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const sample = `# Release notes

**v1.2.0** adds \`lr-markdown\` and fixes a handful of *rendering* bugs.

- Sanitized by default
- Fenced code blocks
- [Docs](https://example.com/docs)

> Set \`html-mode="trusted"\` only for Markdown whose embedded HTML you already trust.
`;

export const Default: Story = {
  render: () => html`<lr-markdown .content=${sample}></lr-markdown>`,
};

const gfmSample = `| Feature | Status |
| --- | --- |
| Tables | done |
| Task lists | done |
| Strikethrough | ~~soon~~ done |

- [x] Ship lr-markdown
- [ ] Ship the next component
`;

export const GithubFlavored: Story = {
  render: () => html`<lr-markdown gfm .content=${gfmSample}></lr-markdown>`,
};

const codeSample = '```ts\nexport function greet(name: string): string {\n  return `Hello, ${name}!`;\n}\n```\n';

export const CodeBlocks: Story = {
  render: () => html`<lr-markdown .content=${codeSample}></lr-markdown>`,
};

export const LeadingTabWidth: Story = {
  name: 'Leading tab width',
  parameters: {
    docs: {
      description: {
        story:
          '`tab-size="2"` expands a leading tab to two spaces before parsing, so this line remains ordinary paragraph text instead of becoming a four-space indented code block.',
      },
    },
  },
  render: () => html` <lr-markdown tab-size="2" .content=${'Intro\n\n\tA tab-indented paragraph'}></lr-markdown> `,
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
          const markdown = (event.currentTarget as HTMLElement).nextElementSibling as LyraMarkdown;
          const parser = markdown.marked;
          if (!parser) return;
          const originalDefaults = { ...parser.defaults };
          try {
            parser.use({
              hooks: {
                preprocess: (source: string) => source.replace('CONFIGURED_TOKEN', '**Configured parser**'),
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
      <lr-markdown .content=${'CONFIGURED_TOKEN'}></lr-markdown>
    </div>
  `,
};

export const NarrowAllocation: Story = {
  name: 'Narrow allocation with long content',
  parameters: {
    docs: {
      description: {
        story:
          'A 320px allocation with a wide table, a long link, and an unbroken code line demonstrates logical containment and internal overflow: the wide table scrolls inside its own `table-wrapper`.',
      },
    },
  },
  render: () => html`
    <lr-markdown
      style="inline-size:320px; max-inline-size:100%;"
      .content=${`| Scenario | Long translated description |
| --- | --- |
| Narrow panel | VierteljährlicheEnergieerzeugungsprognoseFürDachanlagen |

[A long documentation link](https://example.com/guides/quarterly-generation-forecast-for-rooftop-installations)

\`\`\`ts
const longUnbrokenValue = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
\`\`\``}
    ></lr-markdown>
  `,
};

export const TaskTablesAndRtlCode: Story = {
  name: 'Tasks, scrolling tables, and code in RTL prose',
  render: () => html`
    <div dir="rtl" style="inline-size: 320px; max-inline-size: 100%;">
      <lr-markdown
        .content=${`- [x] Review the task list
- [ ] Finish the review

| Check | Outcome | Detail |
| --- | --- | --- |
| Keyboard | Median | QuarterlyEnergyProductionForecastForRooftopInstallations keeps words intact and scrolls inline |

\`\`\`js
function moveLeft() { return 'left'; }
\`\`\``}
      ></lr-markdown>
    </div>
  `,
};

export const Streaming: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`streaming` keeps the host `aria-busy` while partial Markdown is still arriving. Clear it alongside the final `content` update.',
      },
    },
  },
  render: () => html`
    <lr-markdown
      streaming
      .content=${'## Generating response\n\nThis partial response is still receiving additional content…'}
    ></lr-markdown>
  `,
};

export const InternalLinks: Story = {
  render: () => html`
    <div style="display:flex; flex-direction:column; gap:0.75rem;">
      <lr-markdown
        internal-link-prefix="/docs/"
        .content=${'See [the setup guide](/docs/setup) or visit [our site](https://example.com).'}
        @lr-link-click=${(e: CustomEvent<{ href: string }>) => {
          const out = (e.currentTarget as HTMLElement).nextElementSibling as HTMLElement;
          out.textContent = `lr-link-click: ${JSON.stringify(e.detail)}`;
        }}
      ></lr-markdown>
      <p style="margin:0; color:var(--lr-color-text-quiet); font-size:0.8125rem;">
        Click "the setup guide" — its href matches
        <code>internal-link-prefix</code>, so the click is intercepted and reported via
        <code>lr-link-click</code> instead of navigating. "our site" is external and opens normally.
      </p>
    </div>
  `,
};

export const TrustedHtml: Story = {
  render: () => html`
    <lr-markdown
      html-mode="trusted"
      .content=${'Raw HTML passthrough when explicitly opted out of sanitization: <mark>highlighted</mark> text.'}
    ></lr-markdown>
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
      <lr-markdown content="**Visible document**"></lr-markdown>
    </div>
  `,
};

/** Migrating a `<wa-markdown><script type="text/markdown">...</script></wa-markdown>` usage: a
 * direct `<script type="text/markdown">` child is read once at connect and adopted as `content`,
 * as long as `content` was never explicitly authored. Prefer the `content` property directly for
 * anything that needs to update after first connect -- the script child is not re-read. */
export const ScriptChildContent: Story = {
  name: 'Script-child content (wa-markdown migration)',
  render: () => html`
    <lr-markdown>
      <script type="text/markdown">
# Migrated from wa-markdown

This document was authored as a script-child, the same pattern wa-markdown documents, and adopted
once at connect.
      </script>
    </lr-markdown>
  `,
};

const longSample = Array.from(
  { length: 40 },
  (_, index) => `## Section ${index}\n\nSome body text for section ${index}.`
).join('\n\n');

export const MaxHeightScrolling: Story = {
  render: () => html`
    <lr-markdown .content=${longSample} max-height="10rem" style="max-width: 32rem;"></lr-markdown>
  `,
};

export const TaskLists: Story = {
  parameters: { docs: { description: { story: 'Mixed, all-task, loose, nested and ordered task lists. The read-only checkbox replaces the bullet in unordered lists and follows the numeral in ordered ones.' } } },
  render: () => html`<div style="display:grid; gap:1rem; max-inline-size:32rem;">
    <lr-markdown .content=${'- Ordinary item\n- [ ] Open task with enough text to wrap onto a second line so the hang stays visible\n- [x] Completed task\n\n- [x] All-task list\n- [ ] Second task\n\n- [ ] Loose task\n\n- [x] Loose completed task\n\n- [ ] Parent task\n  - Nested plain item\n  - [x] Nested completed task\n\n3. [x] Ordered task keeps its numeral\n4. [ ] Next ordered task'}></lr-markdown>
    <div dir="rtl"><lr-markdown .content=${'- Ordinary item\n- [ ] Open task with enough text to wrap onto a second line so the hang stays visible\n- [x] Completed task\n\n- [x] All-task list\n- [ ] Second task\n\n- [ ] Loose task\n\n- [x] Loose completed task\n\n- [ ] Parent task\n  - Nested plain item\n  - [x] Nested completed task\n\n3. [x] Ordered task keeps its numeral\n4. [ ] Next ordered task'}></lr-markdown></div>
  </div>`,
};
export const WideGfmTables: Story = {
  parameters: { docs: { description: { story: 'At 390px: a long prose cell wraps between words, an aligned table applies GFM alignment, and a six-column identifier table scrolls inside its keyboard-focusable `table-wrapper`. The second copy is right-to-left.' } } },
  render: () => html`<div style="display:grid; gap:1rem;">
    <div style="inline-size: 390px; max-inline-size: 100%"><lr-markdown .content=${'| Name | Notes |\n| --- | --- |\n| Report | A long prose cell that wraps only between words, never in the middle of a word, however narrow the column gets. |\n\n| Left | Center | Right | Default |\n| :--- | :---: | ---: | --- |\n| a | b | 42 | d |\n\n| Identifier | Region | Owner | Created | Status | Checksum |\n| --- | --- | --- | --- | --- | --- |\n| svc-authentication-gateway-primary | eu-central-1 | platform-infrastructure-team | 2026-09-25T10:00:00Z | operational | 9f86d081884c7d659a2feaa0c55ad015 |'}></lr-markdown></div>
    <div dir="rtl" style="inline-size: 390px; max-inline-size: 100%"><lr-markdown .content=${'| Name | Notes |\n| --- | --- |\n| Report | A long prose cell that wraps only between words, never in the middle of a word, however narrow the column gets. |\n\n| Left | Center | Right | Default |\n| :--- | :---: | ---: | --- |\n| a | b | 42 | d |\n\n| Identifier | Region | Owner | Created | Status | Checksum |\n| --- | --- | --- | --- | --- | --- |\n| svc-authentication-gateway-primary | eu-central-1 | platform-infrastructure-team | 2026-09-25T10:00:00Z | operational | 9f86d081884c7d659a2feaa0c55ad015 |'}></lr-markdown></div>
  </div>`,
};
export const CodeBlockHeaders: Story = {
  render: () => html`<lr-markdown code-block-header .content=${'```ts\nconst greeting = "Hello";\n```\n\n    indented code'}></lr-markdown>`,
};
export const RightToLeftCode: Story = {
  parameters: { docs: { description: { story: 'Arabic prose with inline code, a fenced block with one long line, an indented block and an authored `<pre>` of Arabic verse in sanitize mode. Code reads left-to-right; prose and the authored verse follow their own direction.' } } },
  render: () => html`<div dir="rtl" lang="ar" style="inline-size: 400px; max-inline-size: 100%"><lr-markdown code-block-header .highlightCode=${false} .content=${'استخدم الخيار `--verbose` لعرض التفاصيل.\n\n```js\nconst report = buildReport({ verbose: true, locale: \'ar\', includeTimings: true, destination: \'./out/report.json\' });\n```\n\n    indented_code --flag\n\n<pre>قصيدة عربية\nسطر ثانٍ من الشعر</pre>'}></lr-markdown></div>`,
};

export const ProgressiveStreaming: Story = {
  render: () => html`<div>
    <button type="button" @click=${(event: Event) => {
      const element = (event.currentTarget as HTMLElement).parentElement!.querySelector('lr-markdown') as LyraMarkdown;
      element.content += '\n\n## Next block\n\nAnother **settled** paragraph.\n\nStreaming tail';
    }}>Append blocks</button>
    <button type="button" @click=${(event: Event) => {
      const element = (event.currentTarget as HTMLElement).parentElement!.querySelector('lr-markdown') as LyraMarkdown;
      element.streaming = !element.streaming;
    }}>Toggle completion</button>
    <lr-markdown streaming streaming-render="progressive" code-block-header
      .content=${'# Settled heading\n\nA **rendered paragraph**.\n\n```js\nconst answer = 42;\n```\n\nCurrent tail'}></lr-markdown>
  </div>`,
};

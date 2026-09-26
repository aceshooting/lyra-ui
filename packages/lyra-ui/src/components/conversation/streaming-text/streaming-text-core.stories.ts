import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import tsGrammar from 'shiki/langs/typescript.mjs';
import './streaming-text-core.js';

const meta: Meta = {
  title: 'StreamingTextCore',
  component: 'lr-streaming-text-core',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A build-lean `lr-streaming-text` variant that composes `lr-markdown-core` instead of ' +
          '`lr-markdown` in Markdown mode, so a consumer with a bounded fenced-code language set ' +
          "never references lr-markdown's ~200-language dynamic-import table. Everything else -- " +
          'token coalescing, `contentMode` auto-detection, the blinking cursor -- is identical to ' +
          '`lr-streaming-text`. A fenced-block language absent from `languages` always renders the ' +
          'plain-text fallback.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const sample = `Here is a streamed answer with a fenced code block:

\`\`\`typescript
export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`
`;

export const Default: Story = {
  render: () => html`
    <lr-streaming-text-core
      streaming
      .languages=${{ typescript: tsGrammar }}
      .content=${sample}
    ></lr-streaming-text-core>
  `,
};

export const UnmappedLanguageStaysPlain: Story = {
  name: 'A fenced language absent from languages renders plain text',
  render: () => html`
    <lr-streaming-text-core
      .content=${'```python\nprint("no python grammar bound")\n```'}
    ></lr-streaming-text-core>
  `,
};

export const NarrowAllocation: Story = {
  name: 'Narrow allocation (320px) with long content',
  parameters: {
    docs: {
      description: {
        story:
          'A 320px allocation with an unbroken plain-text token and a fenced code block whose line has no break opportunity, demonstrating the shared overflow-wrap: break-word containment shared with lr-streaming-text.',
      },
    },
  },
  render: () => html`
    <div style="display:flex; flex-direction:column; gap:0.75rem;">
      <lr-streaming-text-core
        style="inline-size:320px; max-inline-size:100%;"
        content-mode="plain"
        .content=${'VierteljährlicheEnergieerzeugungsprognoseFürDachanlagenOhneUmbruchmöglichkeit'}
      ></lr-streaming-text-core>
      <lr-streaming-text-core
        style="inline-size:320px; max-inline-size:100%;"
        content-mode="markdown"
        .languages=${{ typescript: tsGrammar }}
        .content=${`Here is a streamed answer with an unbroken code line:

\`\`\`typescript
const longUnbrokenValue = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
\`\`\``}
      ></lr-streaming-text-core>
    </div>
  `,
};

export const ForwardedMarkdownConfiguration: Story = {
  name: 'Forwarded markdown configuration (link-target, heading-offset, ...)',
  parameters: {
    docs: {
      description: {
        story:
          'The rest of `<lr-markdown-core>`\'s configuration surface -- `tabSize`, `htmlMode`, `gfm`, `linkTarget`, `internalLinkPrefix`, `headingOffset`, `highlightCode`, `headingAnchors`, `math`, `maxHeight` -- forwards verbatim, so a consumer who has customized any of them (here `link-target=""` for same-tab links and `heading-offset="1"`) keeps that behavior after adopting `<lr-streaming-text-core>`. The composed `<lr-markdown-core>` still applies its own `rel="noopener noreferrer"` guard whenever a non-empty `link-target` is forwarded.',
      },
    },
  },
  render: () => html`
    <lr-streaming-text-core
      content-mode="markdown"
      link-target=""
      heading-offset="1"
      .content=${'# Release notes\n\nSee the [full changelog](https://example.com/changelog) for details.'}
    ></lr-streaming-text-core>
  `,
};

export const ProgressiveMarkdown: Story = {
  render: () => html`<lr-streaming-text-core content-mode="markdown" streaming streaming-render="progressive" code-block-header
    .content=${'# Settled response\n\nA **formatted paragraph**.\n\n```js\nconst ready = true;\n```\n\nThe response continues'}></lr-streaming-text-core>`,
};

export const RightToLeftCodeStream: Story = {
  parameters: { docs: { description: { story: 'A timer-driven right-to-left stream through inline code and a fenced block. The plain-text view isolates the code runs left-to-right while streaming, and the settled Markdown keeps them left-to-right.' } } },
  render: () => {
    const source = 'مقدمة قصيرة.\n\nاستخدم `--verbose` لعرض التفاصيل.\n\n```js\nconst answer = compute(42);\n```\n\nخاتمة.';
    const tokens = source.split(/(?<=\s)/);
    return html`<div dir="rtl" style="display:grid; gap:0.75rem; inline-size:400px; max-inline-size:100%;">
      <lr-streaming-text-core content-mode="markdown" coalesce-ms="50"></lr-streaming-text-core>
      <div><button type="button" @click=${(event: Event) => {
        const el = (event.currentTarget as HTMLElement).closest('div[dir]')!.querySelector('lr-streaming-text-core') as HTMLElement & { content: string; streaming: boolean };
        el.content = '';
        el.streaming = true;
        let index = 0;
        const timer = setInterval(() => {
          index++;
          el.content = tokens.slice(0, index).join('');
          if (index >= tokens.length) {
            clearInterval(timer);
            el.streaming = false;
          }
        }, 40);
      }}>ابدأ البث</button></div>
    </div>`;
  },
};

export const ForwardedTaskListParts: Story = {
  parameters: { docs: { description: { story: 'The composed Markdown element\'s task-list and table-wrapper parts are forwarded, so an outer `::part()` rule styles completed tasks and the table scroller.' } } },
  render: () => html`
    <style>
      .forwarded-task-parts::part(task-item-checked) { text-decoration-line: line-through; color: var(--lr-color-text-quiet); }
      .forwarded-task-parts::part(task-checkbox) { --lr-markdown-task-checkbox-size: 1.125em; }
      .forwarded-task-parts::part(table-wrapper) { outline: 1px dashed var(--lr-color-border); }
    </style>
    <lr-streaming-text-core class="forwarded-task-parts" content-mode="markdown"
      .content=${'- [x] Draft the answer\n- [ ] Cite the sources\n\n| Step | Owner |\n| --- | --- |\n| Review | Platform team |'}></lr-streaming-text-core>
  `,
};

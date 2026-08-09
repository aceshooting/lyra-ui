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
          "covers every language it renders. Unlike `lr-markdown`'s runtime `languagesOnly` flag " +
          "-- a check a bundler can't prove always-true -- this component's own module never " +
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

export const SharedParserRefresh: Story = {
  name: 'Shared parser refresh',
  parameters: {
    docs: {
      description: {
        story:
          'The button temporarily configures the parser shared by both Markdown variants, calls the public `renderMarkdown()` refresh method, and restores the defaults immediately afterward.',
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
          const originalDefaults = parser.defaults;
          try {
            parser.use({
              hooks: {
                preprocess: (source: string) => source.replace('CONFIGURED_TOKEN', '**Configured core parser**'),
              },
            });
            markdown.renderMarkdown();
          } finally {
            parser.defaults = originalDefaults;
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
          'The same `--lr-code-block-tab-size` token `lr-code-block` and `lr-code-editor` use, re-declared here because those are sibling elements rather than ancestors. A markdown code block wraps (`pre-wrap`), so at the same value a wrapped line can still look different from `lr-code-block`.',
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

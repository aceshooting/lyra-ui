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

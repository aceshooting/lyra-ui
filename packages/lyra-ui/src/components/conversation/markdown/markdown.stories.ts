import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './markdown.js';

const meta: Meta = {
  title: 'Markdown',
  component: 'lr-markdown',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Sanitized Markdown-to-HTML rendering (GFM tables, fenced code blocks, links, blockquotes) built on the optional `marked` + `dompurify` peer dependencies, lazy-loaded on first use. Without those peers installed — or when sanitization is requested but `dompurify` is unavailable — content renders as safe plain text and a `lr-render-error` event fires instead of shipping broken or unsanitized markup.',
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

> Disable sanitization by setting the \`sanitize\` property (not attribute) to \`false\` --
> \`.sanitize=\${false}\` -- only for markdown you already trust.
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

const codeSample =
  '```ts\nexport function greet(name: string): string {\n  return `Hello, ${name}!`;\n}\n```\n';

export const CodeBlocks: Story = {
  render: () => html`<lr-markdown .content=${codeSample}></lr-markdown>`,
};

export const NarrowAllocation: Story = {
  name: 'Narrow allocation with long content',
  parameters: {
    docs: {
      description: {
        story:
          'A 320px allocation with a wide table, a long link, and an unbroken code line demonstrates logical containment and internal overflow.',
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
        @lr-link-click=${(e: CustomEvent<{ href: string; internal: boolean }>) => {
          const out = (e.currentTarget as HTMLElement).nextElementSibling as HTMLElement;
          out.textContent = `lr-link-click: ${JSON.stringify(e.detail)}`;
        }}
      ></lr-markdown>
      <p style="margin:0; color:var(--lr-color-text-quiet); font-size:0.8125rem;">
        Click "the setup guide" — its href matches <code>internal-link-prefix</code>, so the click is
        intercepted and reported via <code>lr-link-click</code> instead of navigating. "our site" is
        external and opens normally.
      </p>
    </div>
  `,
};

export const SanitizeOptOut: Story = {
  render: () => html`
    <lr-markdown
      .sanitize=${false}
      .content=${'Raw HTML passthrough when explicitly opted out of sanitization: <mark>highlighted</mark> text.'}
    ></lr-markdown>
  `,
};

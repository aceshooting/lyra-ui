import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { createRef, ref } from 'lit/directives/ref.js';
import './streaming-text.js';
import '../markdown/markdown.js';
import type { LyraStreamingText } from './streaming-text.js';

const meta: Meta = {
  title: 'StreamingText',
  component: 'lr-streaming-text',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A token-coalescing incremental text renderer for streaming assistant output. The host always assigns the *entire* current text to `content` on every update (never a delta); rapid updates within `coalesce-ms` collapse to a single render of the latest value. `contentMode` defaults to auto-detection and can force `plain` or `markdown`. The plain-text path loads no optional peers; Markdown uses the composed renderer\'s lazy `marked` parser, default `dompurify` sanitizer, and optional `shiki` fenced-code highlighting. A blinking cursor (reduced-motion-aware) appears while `streaming` is `true`.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const buttonStyle =
  'font:inherit; font-size:0.8125rem; padding:0.3rem 0.7rem; border:1px solid var(--lr-color-border); border-radius:0.375rem; background:var(--lr-color-surface); cursor:pointer;';

export const PlainTextStreaming: Story = {
  render: () =>
    html`<lr-streaming-text
      streaming
      content-mode="plain"
      .content=${'The quick brown fox jumps over the lazy dog'}
    ></lr-streaming-text>`,
};

export const FinishedPlainText: Story = {
  name: 'Finished (no cursor)',
  render: () =>
    html`<lr-streaming-text
      content-mode="plain"
      .content=${'The quick brown fox jumps over the lazy dog.'}
    ></lr-streaming-text>`,
};

const markdownSample = `# Release notes

**v1.3.0** adds \`lr-streaming-text\`.

- Coalesces rapid updates
- Auto-detects Markdown
- [Read the docs](https://example.com/docs)
`;

export const MarkdownAutoDetected: Story = {
  name: 'Markdown (auto-detected)',
  render: () => html`<lr-streaming-text streaming .content=${markdownSample}></lr-streaming-text>`,
};

export const ForcedPlainText: Story = {
  name: 'content-mode="plain" forces plain text even for Markdown-looking content',
  render: () => html`<lr-streaming-text content-mode="plain" .content=${markdownSample}></lr-streaming-text>`,
};

export const ForcedMarkdown: Story = {
  name: 'content-mode="markdown" forces Markdown rendering even for plain-looking content',
  render: () =>
    html`<lr-streaming-text
      content-mode="markdown"
      streaming
      .content=${'no special syntax in this sentence at all'}
    ></lr-streaming-text>`,
};

export const LiveTokenStream: Story = {
  name: 'Live demo (simulated token-by-token stream)',
  render: () => {
    const tokens =
      'Here is a streamed answer with **bold**, a `code span`, and a list:\n\n- first point\n- second point\n\nHope that helps!'.split(
        /(?<=\s)/,
      );

    const elRef = createRef<LyraStreamingText>();
    let timer: ReturnType<typeof setInterval> | undefined;

    // Bound directly on the button via @click below (not wired up from a
    // bubbled event on some ancestor) so the very first click already has a
    // real listener attached -- Lit's template bindings attach eagerly on
    // first render and are idempotent across re-renders, so no manual
    // wiring guard is needed.
    function start(): void {
      const el = elRef.value!;
      clearInterval(timer);
      el.content = '';
      el.streaming = true;
      let i = 0;
      // Fires far faster than the default 50ms coalesce-ms window on
      // purpose, so the coalescing behavior described in the component
      // doc is actually visible rather than merely asserted.
      timer = setInterval(() => {
        i++;
        el.content = tokens.slice(0, i).join('');
        if (i >= tokens.length) {
          clearInterval(timer);
          el.streaming = false;
        }
      }, 20);
    }

    return html`
      <div style="display:flex; flex-direction:column; gap:0.75rem; max-width:32rem;">
        <div style="border:1px solid var(--lr-color-border); border-radius:0.5rem; padding:0.75rem;">
          <lr-streaming-text coalesce-ms="50" ${ref(elRef)}></lr-streaming-text>
        </div>
        <div>
          <button style=${buttonStyle} @click=${start}>Start streaming</button>
        </div>
        <p style="margin:0; font-size:0.8125rem; color:var(--lr-color-text-quiet);">
          Tokens arrive every 20ms — faster than the 50ms <code>coalesce-ms</code> window — so several
          tokens land per rendered frame instead of one DOM update per token.
        </p>
      </div>
    `;
  },
};

export const CoalescingComparison: Story = {
  name: 'coalesce-ms comparison (0 vs. 300)',
  parameters: {
    docs: {
      description: {
        story:
          'Same simulated token stream driving two instances side by side — a near-zero `coalesce-ms` re-renders on nearly every token, while a large one visibly batches several tokens per update.',
      },
    },
  },
  render: () => {
    const words = 'A response streamed one word at a time to show how coalesce-ms affects render frequency.'.split(
      ' ',
    );

    const fastRef = createRef<LyraStreamingText>();
    const slowRef = createRef<LyraStreamingText>();

    // Bound directly on the button via @click below so the very first click
    // already works -- see the LiveTokenStream story above for why the
    // previous bubbled-event wiring pattern silently no-op'd on that click.
    function start(): void {
      const fast = fastRef.value!;
      const slow = slowRef.value!;
      fast.content = '';
      slow.content = '';
      fast.streaming = true;
      slow.streaming = true;
      let i = 0;
      const timer = setInterval(() => {
        i++;
        const text = words.slice(0, i).join(' ');
        fast.content = text;
        slow.content = text;
        if (i >= words.length) {
          clearInterval(timer);
          fast.streaming = false;
          slow.streaming = false;
        }
      }, 30);
    }

    return html`
      <div style="display:flex; flex-direction:column; gap:0.75rem; max-width:32rem;">
        <div>
          <p style="margin:0 0 0.25rem; font-size:0.8125rem; color:var(--lr-color-text-quiet);">
            coalesce-ms="0"
          </p>
          <lr-streaming-text content-mode="plain" coalesce-ms="0" ${ref(fastRef)}></lr-streaming-text>
        </div>
        <div>
          <p style="margin:0 0 0.25rem; font-size:0.8125rem; color:var(--lr-color-text-quiet);">
            coalesce-ms="300"
          </p>
          <lr-streaming-text content-mode="plain" coalesce-ms="300" ${ref(slowRef)}></lr-streaming-text>
        </div>
        <div>
          <button style=${buttonStyle} @click=${start}>Start streaming</button>
        </div>
      </div>
    `;
  },
};

export const ForwardedMarkdownConfiguration: Story = {
  name: 'Forwarded markdown configuration (link-target, heading-offset, ...)',
  parameters: {
    docs: {
      description: {
        story:
          'The rest of `<lr-markdown>`\'s configuration surface -- `tabSize`, `htmlMode`, `gfm`, `linkTarget`, `internalLinkPrefix`, `headingOffset`, `highlightCode`, `headingAnchors`, `math`, `maxHeight` -- forwards verbatim, so a consumer who has customized any of them (here `link-target=""` for same-tab links and `heading-offset="1"`) keeps that behavior after adopting `<lr-streaming-text>`. The composed `<lr-markdown>` still applies its own `rel="noopener noreferrer"` guard whenever a non-empty `link-target` is forwarded.',
      },
    },
  },
  render: () =>
    html`<lr-streaming-text
      content-mode="markdown"
      link-target=""
      heading-offset="1"
      .content=${'# Release notes\n\nSee the [full changelog](https://example.com/changelog) for details.'}
    ></lr-streaming-text>`,
};

export const NarrowAllocation: Story = {
  name: 'Narrow allocation (320px) with long content',
  parameters: {
    docs: {
      description: {
        story:
          'A 320px allocation with an unbroken plain-text token and, in Markdown mode, a wide table, a long link, and an unbroken code line, demonstrates the shared overflow-wrap: break-word containment.',
      },
    },
  },
  render: () => html`
    <div style="display:flex; flex-direction:column; gap:0.75rem;">
      <lr-streaming-text
        style="inline-size:320px; max-inline-size:100%;"
        content-mode="plain"
        .content=${'VierteljährlicheEnergieerzeugungsprognoseFürDachanlagenOhneUmbruchmöglichkeit'}
      ></lr-streaming-text>
      <lr-streaming-text
        style="inline-size:320px; max-inline-size:100%;"
        content-mode="markdown"
        .content=${`| Scenario | Long translated description |
| --- | --- |
| Narrow panel | VierteljährlicheEnergieerzeugungsprognoseFürDachanlagen |

[A long documentation link](https://example.com/guides/quarterly-generation-forecast-for-rooftop-installations)

\`\`\`ts
const longUnbrokenValue = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
\`\`\``}
      ></lr-streaming-text>
    </div>
  `,
};

export const ReducedMotion: Story = {
  name: 'Reduced motion (static cursor)',
  parameters: {
    docs: {
      description: {
        story:
          'With `prefers-reduced-motion: reduce` set at the OS/browser level, the cursor renders as a static, always-visible bar instead of blinking.',
      },
    },
  },
  render: () => html`<lr-streaming-text streaming .content=${'Still working on it'}></lr-streaming-text>`,
};

export const ProgressiveMarkdown: Story = {
  render: () => html`<lr-streaming-text content-mode="markdown" streaming streaming-render="progressive" code-block-header
    .content=${'# Settled response\n\nA **formatted paragraph**.\n\n```js\nconst ready = true;\n```\n\nThe response continues'}></lr-streaming-text>`,
};

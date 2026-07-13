import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { createRef, ref } from 'lit/directives/ref.js';
import './streaming-text.js';
import '../markdown/markdown.js';
import type { LyraStreamingText } from './streaming-text.js';

const meta: Meta = {
  title: 'StreamingText',
  component: 'lyra-streaming-text',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A token-coalescing incremental text renderer for streaming assistant output. The host always assigns the *entire* current text to `content` on every update (never a delta); rapid updates within `coalesce-ms` collapse to a single render of the latest value. `markdown` auto-detects (via a lightweight heuristic) whether to route content through `<lyra-markdown>` or render it as plain text, and can be forced either way. A blinking cursor (reduced-motion-aware) appears while `streaming` is `true`.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const buttonStyle =
  'font:inherit; font-size:0.8125rem; padding:0.3rem 0.7rem; border:1px solid #ccc; border-radius:0.375rem; background:#fff; cursor:pointer;';

export const PlainTextStreaming: Story = {
  render: () =>
    html`<lyra-streaming-text
      streaming
      markdown="false"
      .content=${'The quick brown fox jumps over the lazy dog'}
    ></lyra-streaming-text>`,
};

export const FinishedPlainText: Story = {
  name: 'Finished (no cursor)',
  render: () =>
    html`<lyra-streaming-text
      markdown="false"
      .content=${'The quick brown fox jumps over the lazy dog.'}
    ></lyra-streaming-text>`,
};

const markdownSample = `# Release notes

**v1.3.0** adds \`lyra-streaming-text\`.

- Coalesces rapid updates
- Auto-detects Markdown
- [Read the docs](https://example.com/docs)
`;

export const MarkdownAutoDetected: Story = {
  name: 'Markdown (auto-detected)',
  render: () => html`<lyra-streaming-text streaming .content=${markdownSample}></lyra-streaming-text>`,
};

export const ForcedPlainText: Story = {
  name: 'markdown="false" forces plain text even for Markdown-looking content',
  render: () => html`<lyra-streaming-text markdown="false" .content=${markdownSample}></lyra-streaming-text>`,
};

export const ForcedMarkdown: Story = {
  name: 'markdown forces Markdown rendering even for plain-looking content',
  render: () =>
    html`<lyra-streaming-text
      markdown
      streaming
      .content=${'no special syntax in this sentence at all'}
    ></lyra-streaming-text>`,
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
        <div style="border:1px solid var(--lyra-color-border, #ddd); border-radius:0.5rem; padding:0.75rem;">
          <lyra-streaming-text coalesce-ms="50" ${ref(elRef)}></lyra-streaming-text>
        </div>
        <div>
          <button style=${buttonStyle} @click=${start}>Start streaming</button>
        </div>
        <p style="margin:0; font-size:0.8125rem; color:var(--lyra-color-text-quiet, #6b7280);">
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
          <p style="margin:0 0 0.25rem; font-size:0.8125rem; color:var(--lyra-color-text-quiet, #6b7280);">
            coalesce-ms="0"
          </p>
          <lyra-streaming-text markdown="false" coalesce-ms="0" ${ref(fastRef)}></lyra-streaming-text>
        </div>
        <div>
          <p style="margin:0 0 0.25rem; font-size:0.8125rem; color:var(--lyra-color-text-quiet, #6b7280);">
            coalesce-ms="300"
          </p>
          <lyra-streaming-text markdown="false" coalesce-ms="300" ${ref(slowRef)}></lyra-streaming-text>
        </div>
        <div>
          <button style=${buttonStyle} @click=${start}>Start streaming</button>
        </div>
      </div>
    `;
  },
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
  render: () => html`<lyra-streaming-text streaming .content=${'Still working on it'}></lyra-streaming-text>`,
};

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './chat-composer.js';
import type { LyraChatComposer } from './chat-composer.js';

const meta: Meta = {
  title: 'ChatComposer',
  component: 'lr-chat-composer',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The message input for a chat/agent conversation surface: an auto-resizing textarea plus a send/stop button, form-associated so it participates in native `<form>` submission like any other input.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lr-chat-composer
      placeholder="Message the assistant…"
      style="max-width: 32rem; display: block;"
      @lr-submit=${(e: CustomEvent<{ value: string }>) => alert(`lr-submit: ${JSON.stringify(e.detail)}`)}
    ></lr-chat-composer>
  `,
};

export const AutoResize: Story = {
  render: () => html`
    <lr-chat-composer
      placeholder="Type a few lines to watch this grow, up to 6 rows…"
      min-rows="1"
      max-rows="6"
      style="max-width: 32rem; display: block;"
    ></lr-chat-composer>
  `,
};

/** Host naming, native editing attributes, and public selection methods reach the wrapped textarea. */
export const NativeEditingSurface: Story = {
  render: () => html`
    <div style="display: grid; gap: 0.75rem; max-width: 32rem;">
      <lr-chat-composer
        aria-label="Compose an assistant message"
        value="Select or edit this draft"
        autocomplete="off"
        inputmode="text"
        enterkeyhint="send"
        wrap="soft"
      ></lr-chat-composer>
      <button
        type="button"
        style="justify-self: start;"
        @click=${(event: Event) => {
          const composer = (event.currentTarget as HTMLElement).parentElement!.querySelector(
            'lr-chat-composer',
          ) as LyraChatComposer;
          composer.focus();
          composer.select();
        }}
      >Focus and select the draft</button>
    </div>
  `,
};

export const Sending: Story = {
  render: () => html`
    <lr-chat-composer
      status="sending"
      value="Deploying the hotfix now…"
      style="max-width: 32rem; display: block;"
      @lr-stop=${() => alert('lr-stop fired — cancel the in-flight send.')}
    ></lr-chat-composer>
  `,
};

export const Streaming: Story = {
  render: () => html`
    <lr-chat-composer
      status="streaming"
      placeholder="Keep composing your next message while the reply streams in…"
      style="max-width: 32rem; display: block;"
      @lr-stop=${() => alert('lr-stop fired — cancel the in-flight generation.')}
    ></lr-chat-composer>
  `,
};

export const Disabled: Story = {
  render: () => html`
    <lr-chat-composer disabled placeholder="Composer disabled" style="max-width: 32rem; display: block;">
    </lr-chat-composer>
  `,
};

export const SubmitOnEnterDisabled: Story = {
  render: () => html`
    <lr-chat-composer
      .submitOnEnter=${false}
      placeholder="Enter always inserts a newline here — use the button to send."
      style="max-width: 32rem; display: block;"
      @lr-submit=${(e: CustomEvent<{ value: string }>) => alert(`lr-submit: ${JSON.stringify(e.detail)}`)}
    ></lr-chat-composer>
  `,
};

export const SubmissionValidationGate: Story = {
  render: () => html`
    <lr-chat-composer
      submit-disabled
      value="   "
      placeholder="The consumer keeps Send disabled until this draft is valid."
      style="max-width: 32rem; display: block;"
    ></lr-chat-composer>
  `,
};

export const WithLeadingAndChips: Story = {
  render: () => html`
    <lr-chat-composer placeholder="Message the assistant…" style="max-width: 32rem; display: block;">
      <button
        slot="leading"
        type="button"
        aria-label="Attach file"
        style="font:inherit;font-size:1.125rem;background:none;border:none;cursor:pointer;padding:0.375rem;line-height:1;"
      >
        📎
      </button>
      <span
        slot="chips"
        style="display:inline-flex;align-items:center;gap:0.25rem;font-size:0.75rem;padding:0.25rem 0.5rem;border:1px solid var(--lr-color-border);border-radius:999px;"
      >
        report.pdf
      </span>
      <span
        slot="chips"
        style="display:inline-flex;align-items:center;gap:0.25rem;font-size:0.75rem;padding:0.25rem 0.5rem;border:1px solid var(--lr-color-border);border-radius:999px;"
      >
        screenshot.png
      </span>
    </lr-chat-composer>
  `,
};

export const CustomTrailingSlot: Story = {
  render: () => html`
    <lr-chat-composer placeholder="Send button fully replaced by trailing slot content…" style="max-width: 32rem; display: block;">
      <button
        slot="trailing"
        type="button"
        style="font:inherit;font-size:0.8125rem;background:var(--lr-color-brand);color:var(--lr-color-on-brand);border:none;border-radius:0.375rem;padding:0.5rem 0.75rem;cursor:pointer;"
        @click=${(e: Event) => {
          const composer = (e.currentTarget as HTMLElement).closest('lr-chat-composer') as LyraChatComposer;
          alert(`custom trailing control — current value: ${JSON.stringify(composer.value)}`);
        }}
      >
        Custom Send
      </button>
    </lr-chat-composer>
  `,
};

export const PlainInsidePanel: Story = {
  name: 'appearance="plain" (docked in a bordered panel)',
  render: () => html`
    <div
      style="max-width:32rem; border:1px solid var(--lr-color-border); border-radius:var(--lr-radius); background:var(--lr-color-surface); padding:0.75rem; display:flex; flex-direction:column; gap:0.75rem;"
    >
      <div style="font-size:0.8125rem; color:var(--lr-color-text-quiet);">Assistant conversation</div>
      <lr-chat-composer appearance="plain" placeholder="Message the assistant…"></lr-chat-composer>
    </div>
  `,
  parameters: {
    docs: {
      description: {
        story:
          'With `appearance="plain"` the composer drops its own border/background so it doesn\'t double the frame of the chat panel, dialog footer or toolbar it is docked in. Focus stays visible: with no border left to recolor, the input row underlines itself instead (click into the textarea to see it).',
      },
    },
  },
};

export const InAForm: Story = {
  render: () => html`
    <form
      style="max-width: 32rem; display: flex; flex-direction: column; gap: 0.75rem;"
      @submit=${(e: SubmitEvent) => {
        e.preventDefault();
        const data = new FormData(e.target as HTMLFormElement);
        alert(`form submit — message: ${JSON.stringify(data.get('message'))}`);
      }}
    >
      <lr-chat-composer name="message" placeholder="Message the assistant…" required></lr-chat-composer>
      <button type="submit" style="align-self: flex-start;">Submit form</button>
    </form>
  `,
};

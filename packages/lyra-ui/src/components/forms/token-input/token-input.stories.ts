import type { Meta, StoryObj } from '@storybook/web-components-vite'; import { html } from 'lit'; import './token-input.js'; import type { LyraTokenInput, LyraTokenInputSize } from './token-input.class.js';
const meta: Meta = { title: 'Token Input', component: 'lr-token-input', tags: ['autodocs'] }; export default meta; type Story = StoryObj;
export const Default: Story = { render: () => html`<lr-token-input label="Recipients" placeholder="Add a recipient…" .value=${['Ada', 'Grace']}></lr-token-input>` };

export const BatchedPaste: Story = {
  name: 'Batched paste / delimiter commit',
  parameters: {
    docs: {
      description: {
        story:
          'Paste or type several comma-separated values and press Enter. The control deduplicates and commits once; lr-add reports the final token plus the complete ordered added batch in detail.values.',
      },
    },
  },
  render: () => html`
    <lr-token-input
      label="Recipients"
      hint="Try Ada,Grace,Ada,Linus and press Enter."
      @lr-add=${(event: CustomEvent<{ value: string; values: readonly string[] }>) =>
        console.log('batched lr-add', event.detail)}
    ></lr-token-input>
  `,
};
/**
 * The `size` property scales the input-wrapper's row height across six tiers, matching `lr-input`'s
 * own height ladder (`2xs`–`xl`), and automatically adjusts padding and text size to stay visually
 * balanced at each tier. The remove button's hit area stays fixed at `40px` across all sizes.
 */
export const Sizes: Story = {
  render: () => {
    const sizes: LyraTokenInputSize[] = ['2xs', 'xs', 's', 'm', 'l', 'xl'];
    return html`
      <div style="display: flex; flex-direction: column; gap: 1rem; max-width: 20rem">
        ${sizes.map(
          (size) => html`
            <lr-token-input
              size=${size}
              label=${`Size "${size}"`}
              placeholder="Add a token…"
              .value=${['Token A', 'Token B']}
            ></lr-token-input>
          `,
        )}
      </div>
    `;
  },
};
/**
 * `size` also accepts the Web Awesome / Shoelace spellings — `small`, `medium` and `large` render
 * exactly as `s`, `m` and `l` — and `pill` rounds the row and its token chips to a full pill.
 */
export const AliasSizesAndPill: Story = {
  render: () => html`
    <div style="display: flex; flex-direction: column; gap: 1rem; max-width: 20rem">
      <lr-token-input size="small" label='size="small"' .value=${['Token A']}></lr-token-input>
      <lr-token-input size="medium" label='size="medium"' .value=${['Token A']}></lr-token-input>
      <lr-token-input size="large" label='size="large"' .value=${['Token A']}></lr-token-input>
      <lr-token-input pill label="pill" .value=${['Token A', 'Token B']}></lr-token-input>
    </div>
  `,
};
/**
 * `editable` turns every token into a roving tab stop that opens an inline editor on click, Enter,
 * or F2 — Enter commits and emits `lr-token-edit`, Escape reverts. `.delimiter=${null}` keeps
 * commas (and every other character) inside a token instead of splitting it, which is what a rule
 * like `Bash(git status:*)` needs.
 */
export const Editable: Story = {
  render: () => html`<lr-token-input
    label="Permission rules"
    hint="Click a rule to edit it in place. Enter commits, Escape reverts."
    placeholder="Add a rule…"
    editable
    .delimiter=${null}
    .value=${['Bash(git status:*)', 'Read(src/**)', 'WebFetch(domain:example.com)']}
    @lr-token-edit=${(event: CustomEvent<{ value: string; previousValue: string; index: number }>) =>
      console.log('lr-token-edit', event.detail)}
  ></lr-token-input>`,
};

/** The inline editor relays native focus/blur and their prefixed aliases like the draft input. */
export const EditableLifecycleEvents: Story = {
  render: () => {
    const report = (event: Event): void => {
      const output = (event.currentTarget as HTMLElement).nextElementSibling as HTMLOutputElement | null;
      if (output) output.textContent = `${event.type} received on lr-token-input`;
    };
    return html`
      <div style="display: grid; gap: var(--lr-space-s); max-inline-size: 24rem">
        <lr-token-input
          editable
          label="Editable recipients"
          hint="Click a recipient, then move focus away to observe the host lifecycle events."
          .value=${['Ada', 'Grace']}
          @focus=${report}
          @blur=${report}
          @lr-focus=${report}
          @lr-blur=${report}
        ></lr-token-input>
        <output aria-live="polite">No lifecycle event received yet.</output>
      </div>
    `;
  },
};

export const DisabledEditableTokens: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Own and fieldset-cascaded disablement remove every editable token label and action from keyboard focus, expose disabled semantics, and suppress hover feedback. Host focus() and click() are synchronous no-ops even in the same task that starts disablement; re-enabling restores one roving token stop.',
      },
    },
  },
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-l); max-inline-size: 24rem;">
      <lr-token-input
        editable
        disabled
        label="Explicitly disabled rules"
        .value=${['Read(src/**)', 'WebFetch(domain:example.com)']}
      ></lr-token-input>
      <fieldset disabled>
        <legend>Disabled by fieldset</legend>
        <lr-token-input
          editable
          label="Inherited disabled rules"
          .value=${['Bash(git status:*)', 'Read(docs/**)']}
        ></lr-token-input>
      </fieldset>
    </div>
  `,
};

/** Edit and remove actions expose separate hover and pressed hooks while the older aggregate hover
 * hook remains the backwards-compatible fallback. */
export const IndependentPointerStates: Story = {
  name: 'Independent pointer-state themes',
  parameters: {
    docs: {
      description: {
        story:
          'Hover or press the editable token label and remove action: each surface uses its own component-scoped theme hooks.',
      },
    },
  },
  render: () => html`
    <lr-token-input
      editable
      label="Independently themed token actions"
      style="
        --lr-token-input-edit-hover-bg: var(--lr-color-success-quiet);
        --lr-token-input-edit-pressed-bg: var(--lr-color-success);
        --lr-token-input-remove-hover-bg: var(--lr-color-danger-quiet);
        --lr-token-input-remove-pressed-bg: var(--lr-color-danger);
      "
      .value=${['Editable token']}
    ></lr-token-input>
  `,
};

/** Editing-assistance attributes reach both the new-token draft and the inline token editor. */
export const EditingAssistance: Story = {
  render: () => html`
    <lr-token-input
      editable
      spellcheck="false"
      autocapitalize="off"
      autocorrect="off"
      label="Exact identifiers"
      hint="Automatic spelling correction and capitalization are disabled."
      .value=${['case-sensitive-token']}
    ></lr-token-input>
  `,
};

/** The host exposes the draft input's native selection and event-silent range-editing facade. */
export const ProgrammaticDraftEditing: Story = {
  name: 'Programmatic draft editing',
  parameters: {
    docs: {
      description: {
        story:
          'Type a draft, select part of it, then press Replace selection. The public setRangeText() method edits the pending draft without emitting user events; Enter, a delimiter, or blur commits the edited result.',
      },
    },
  },
  render: () => html`
    <div style="display:grid;gap:var(--lr-space-s);max-inline-size:24rem">
      <lr-token-input label="Recipients" placeholder="Type and select part of a draft"></lr-token-input>
      <button
        type="button"
        @pointerdown=${(event: PointerEvent) => event.preventDefault()}
        @click=${(event: Event) => {
          const field = (event.currentTarget as HTMLElement).previousElementSibling as LyraTokenInput;
          field.setRangeText('[selected]');
          field.focus();
        }}
      >Replace selection</button>
    </div>
  `,
};

/** 320px allocation with one adversarial unbroken token and editable state. */
export const Narrow: Story = {
  name: 'Narrow (320px)',
  render: () => html`
    <div style="inline-size: 320px; max-inline-size: 100%;">
      <lr-token-input
        editable
        label="Permission rules with long generated identifiers"
        hint="Every token and action remains reachable without widening the containing panel."
        .value=${[
          'Bash(git-status-with-an-intentionally-unbroken-generated-scope-identifier-that-must-stay-contained:*)',
        ]}
      ></lr-token-input>
    </div>
  `,
};

/** An explicit 40px row cap keeps inline overflow clipped and makes wrapped tokens reachable in a
 * deliberate block-axis scrollport. Focus a token and use Home/End to inspect focus scrolling. */
export const ExactHeightScrollableTokens: Story = {
  render: () => html`
    <div style="inline-size: 320px; max-inline-size: 100%;">
      <lr-token-input
        editable
        label="Pinned-height recipients"
        style="--lr-token-input-control-height: 40px"
        .value=${Array.from({ length: 12 }, (_, index) => `recipient-${index + 1}`)}
      ></lr-token-input>
    </div>
  `,
};

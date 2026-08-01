import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './button.js';

const meta: Meta = {
  title: 'Button',
  component: 'lr-button',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'A generic action-button primitive with tokenized tones, appearances, sizes, and loading feedback.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-button>Save</lr-button>`,
};

export const ReactiveAccessibleLabel: Story = {
  name: 'Reactive accessible label',
  parameters: {
    docs: {
      description: {
        story:
          '`accessibleLabel` is bound to the host `aria-label`; changing the attribute after mount immediately updates the internal native control.',
      },
    },
  },
  render: () => html`
    <lr-button
      aria-label="Run report"
      @click=${(event: Event) => {
        const button = event.currentTarget as HTMLElement;
        button.setAttribute('aria-label', 'Run report again');
        button.textContent = 'Run again';
      }}
    >
      Run
    </lr-button>
  `,
};

export const Variants: Story = {
  render: () => html`
    <div style="display: flex; gap: 0.5rem;">
      <lr-button variant="neutral">Neutral</lr-button>
      <lr-button variant="brand">Brand</lr-button>
      <lr-button variant="success">Success</lr-button>
      <lr-button variant="warning">Warning</lr-button>
      <lr-button variant="danger">Danger</lr-button>
    </div>
  `,
};

export const Appearances: Story = {
  render: () => html`
    <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
      <lr-button variant="brand" appearance="accent">Accent</lr-button>
      <lr-button variant="brand" appearance="filled">Filled</lr-button>
      <lr-button variant="brand" appearance="outlined">Outlined</lr-button>
      <lr-button variant="brand" appearance="filled-outlined">Filled outlined</lr-button>
      <lr-button variant="brand" appearance="plain">Plain</lr-button>
      <lr-button variant="brand" appearance="quiet">Quiet</lr-button>
      <lr-button variant="brand" appearance="link">Link</lr-button>
    </div>
  `,
};

export const FilledOutlined: Story = {
  name: 'Filled outlined',
  parameters: {
    docs: {
      description: {
        story:
          '`appearance="filled-outlined"` keeps the filled tier’s fill and foreground but takes the ' +
          'outlined tier’s `--lr-button-outlined-border`, so the edge still reads against a ' +
          'same-toned surface.',
      },
    },
  },
  render: () => html`
    <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
      <lr-button appearance="filled">Filled</lr-button>
      <lr-button appearance="filled-outlined">Filled outlined</lr-button>
      <lr-button variant="brand" appearance="filled-outlined">Brand</lr-button>
      <lr-button variant="danger" appearance="filled-outlined">Danger</lr-button>
    </div>
  `,
};

export const Pill: Story = {
  name: 'Pill',
  parameters: {
    docs: {
      description: {
        story:
          '`pill` re-assigns `--lr-button-radius` to `--lr-radius-pill`, so every appearance and ' +
          'size tier picks up fully rounded ends through the same knob a consumer would override.',
      },
    },
  },
  render: () => html`
    <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
      <lr-button pill variant="brand" appearance="accent">Accent</lr-button>
      <lr-button pill appearance="outlined">Outlined</lr-button>
      <lr-button pill size="xs">Extra small</lr-button>
      <lr-button pill size="l">Large</lr-button>
    </div>
  `,
};

export const WithCaret: Story = {
  name: 'Dropdown trigger (with-caret)',
  parameters: {
    docs: {
      description: {
        story:
          'The `with-caret` chevron (`::part(caret)`) marks the button as a dropdown/menu trigger. ' +
          'It is decorative (`aria-hidden`) — the popup relationship belongs on the host as ' +
          '`aria-haspopup`/`aria-expanded`, both of which are forwarded to the internal control.',
      },
    },
  },
  render: () => html`
    <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
      <lr-button with-caret aria-haspopup="menu" aria-expanded="false">Actions</lr-button>
      <lr-button with-caret pill appearance="outlined" aria-haspopup="menu" aria-expanded="false">
        Filter
      </lr-button>
      <lr-button with-caret size="xs" appearance="quiet" aria-haspopup="menu" aria-expanded="false">
        Sort
      </lr-button>
    </div>
  `,
};

export const Link: Story = {
  name: 'Link (inline text)',
  parameters: {
    docs: {
      description: {
        story:
          'A zero-chrome, underlined inline-text appearance: no padding, border, or min-height, ' +
          'colored from the same accent token `plain` uses and inheriting the surrounding font, so ' +
          'it flows within a sentence rather than rendering as a button-shaped control.',
      },
    },
  },
  render: () => html`
    <p style="max-inline-size: 32rem;">
      The message failed to send.
      <lr-button appearance="link" variant="brand">Retry</lr-button>
      or
      <lr-button appearance="link" variant="danger">cancel</lr-button>
      the request — both flow inline with this paragraph's font.
    </p>
  `,
};

export const AccentVsFilled: Story = {
  name: 'Accent vs. filled, every variant',
  parameters: {
    docs: {
      description: {
        story:
          '`appearance="accent"` (the default) is the active `variant`’s **loud** fill; ' +
          '`appearance="filled"` is the same tone one emphasis step down, its **quiet** tint. The two ' +
          'resolve against different rows of the shared semantic grid, so they differ for every ' +
          'variant — including `neutral`, whose filled tier used to be the page surface, i.e. no fill ' +
          'at all.',
      },
    },
  },
  render: () => html`
    <div style="display: grid; grid-template-columns: repeat(2, max-content); gap: 0.5rem;">
      ${['neutral', 'brand', 'success', 'warning', 'danger'].map(
        (variant) => html`
          <lr-button variant=${variant} appearance="accent">${variant} accent</lr-button>
          <lr-button variant=${variant} appearance="filled">${variant} filled</lr-button>
        `,
      )}
    </div>
  `,
};

export const Sizes: Story = {
  render: () => html`
    <div style="display: flex; align-items: center; gap: 0.5rem;">
      <lr-button size="2xs">2XS</lr-button>
      <lr-button size="xs">XS</lr-button>
      <lr-button size="s">S</lr-button>
      <lr-button size="m">M</lr-button>
      <lr-button size="l">L</lr-button>
      <lr-button size="xl">XL</lr-button>
    </div>
  `,
};

export const SizeSpellings: Story = {
  name: 'Both size spellings',
  parameters: {
    docs: {
      description: {
        story:
          'Every tier of the shared form-control ladder matches both its canonical step and Web ' +
          'Awesome’s/Shoelace’s name for it, so migrating markup that says `size="small"` renders ' +
          'exactly what `size="s"` renders — same height, padding and font size — with no attribute ' +
          'rewrite. The same ladder backs `<lr-input>`, `<lr-select>` and `<lr-textarea>`, so ' +
          'same-tier controls line up in a toolbar row.',
      },
    },
  },
  render: () => html`
    <div style="display: grid; grid-template-columns: repeat(2, max-content); gap: 0.5rem; align-items: center;">
      <lr-button size="s">size="s"</lr-button>
      <lr-button size="small">size="small"</lr-button>
      <lr-button size="m">size="m"</lr-button>
      <lr-button size="medium">size="medium"</lr-button>
      <lr-button size="l">size="l"</lr-button>
      <lr-button size="large">size="large"</lr-button>
    </div>
  `,
};

export const CompactToolbarTier: Story = {
  name: 'Retuned tier (padding / font-size / height)',
  parameters: {
    docs: {
      description: {
        story:
          'Each `size` tier reaches the button through `--lr-button-padding-block`, ' +
          '`--lr-button-padding-inline`, `--lr-button-font-size` and `--lr-button-min-height` — all ' +
          'four pointed at the shared form-control ladder — so a toolbar can retune a tier — or pin ' +
          'an exact row height with `--lr-button-height` — without a `::part(base)` rule. ' +
          '`--lr-button-height` is undeclared by default, which is what keeps each tier’s min-height ' +
          'floor working when it is unset.',
      },
    },
  },
  render: () => html`
    <div
      style="display: flex; align-items: center; gap: 0.25rem; padding: 0.25rem; border: 1px solid var(--lr-color-border); border-radius: var(--lr-radius); --lr-button-height: 28px; --lr-button-padding-inline: 0.5rem; --lr-button-padding-block: 0; --lr-button-font-size: 0.75rem;"
    >
      <lr-button size="s" appearance="quiet">Bold</lr-button>
      <lr-button size="s" appearance="quiet">Italic</lr-button>
      <lr-button size="s" appearance="outlined">Preview</lr-button>
      <lr-button size="s" appearance="accent" variant="brand">Publish</lr-button>
    </div>
  `,
};

export const OutlinedFill: Story = {
  name: 'Outlined fill (--lr-button-outlined-fill)',
  parameters: {
    docs: {
      description: {
        story:
          '`appearance="outlined"` is transparent by default; `--lr-button-outlined-fill` tints it ' +
          'without a `::part(base)` rule. It is not swapped per `variant` (same stance as ' +
          '`--lr-button-quiet-*`), and the hover `filter: brightness()` visibly affects a tinted fill.',
      },
    },
  },
  render: () => html`
    <div style="display: flex; align-items: center; gap: 0.5rem;">
      <lr-button appearance="outlined" variant="brand">Default (transparent)</lr-button>
      <lr-button
        appearance="outlined"
        variant="brand"
        style="--lr-button-outlined-fill: var(--lr-color-surface);"
        >Tinted fill</lr-button
      >
    </div>
  `,
};

export const GapAndRadiusTokens: Story = {
  name: 'Gap / radius tokens (--lr-button-gap, --lr-button-radius)',
  parameters: {
    docs: {
      description: {
        story:
          '`--lr-button-gap` (icon/label gap) and `--lr-button-radius` (corner radius) are retunable ' +
          'without a `::part(base)` rule, matching `--lr-button-padding-block/-inline`/' +
          '`--lr-button-font-size`. Neither varies by `size` tier — each is declared once on `:host`.',
      },
    },
  },
  render: () => html`
    <div style="display: flex; align-items: center; gap: 0.5rem;">
      <lr-button variant="brand">Default</lr-button>
      <lr-button variant="brand" style="--lr-button-gap: 0.75rem; --lr-button-radius: 999px;">
        Pill, wide gap
      </lr-button>
      <lr-button variant="brand" style="--lr-button-radius: 0;">Square corners</lr-button>
    </div>
  `,
};

export const Loading: Story = {
  render: () => html`<lr-button variant="brand" .loading=${true}>Saving…</lr-button>`,
};

export const Disabled: Story = {
  render: () => html`<lr-button disabled>Save</lr-button>`,
};

export const IconOnly: Story = {
  name: 'Icon-only (aria-label)',
  render: () => html`
    <lr-button appearance="plain" aria-label="Close dialog">
      <svg
        slot="start"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
      >
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </lr-button>
  `,
};

export const SubmitInAForm: Story = {
  name: 'Submit in a form',
  render: () => html`
    <form
      @submit=${(e: Event) => {
        e.preventDefault();
        alert('submitted');
      }}
    >
      <lr-button type="submit" variant="brand">Save</lr-button>
    </form>
  `,
};

export const NamedSubmitters: Story = {
  name: 'Named submitters (name / value / form* overrides)',
  parameters: {
    docs: {
      description: {
        story:
          'A submit button carrying `name`/`value` contributes that pair to the submitted ' +
          '`FormData`, so one form can distinguish which action was taken. `formnovalidate` (and ' +
          '`formaction`/`formenctype`/`formmethod`/`formtarget`) override the form owner for that ' +
          'submission only.',
      },
    },
  },
  render: () => html`
    <form
      @submit=${(event: SubmitEvent) => {
        event.preventDefault();
        const form = event.currentTarget as HTMLFormElement;
        const data = new FormData(form, event.submitter);
        alert(`action=${String(data.get('action'))} title=${String(data.get('title'))}`);
      }}
    >
      <label>Title <input name="title" required /></label>
      <div style="display: flex; gap: 0.5rem; margin-block-start: 0.5rem;">
        <lr-button type="submit" name="action" value="publish" variant="brand" appearance="accent">
          Publish
        </lr-button>
        <lr-button type="submit" name="action" value="draft" appearance="outlined" formnovalidate>
          Save draft (skips validation)
        </lr-button>
      </div>
    </form>
  `,
};

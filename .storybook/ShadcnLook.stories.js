import { html } from 'lit';

/**
 * The opt-in shadcn/ui look (`@aceshooting/lyra-ui/themes/shadcn.css`) next to Lyra's own, on the
 * same controls. Each story renders a light and a dark panel side by side -- `data-lr-theme` on the
 * panel is honoured by both theme.css and the preset -- and pins the `look` toolbar global, so the
 * two stories are a direct comparison. Every other story can be switched with the `Look` toolbar.
 *
 * Autodocs is off on purpose: the preset is a document-level stylesheet, and a docs page renders
 * every story in ONE document, so a page holding both looks could only ever show one of them.
 */
const meta = {
  title: 'Theming/shadcn',
  tags: ['!autodocs'],
  parameters: { layout: 'fullscreen' },
};
export default meta;

const panelStyle = [
  'display: grid',
  'gap: var(--lr-theme-space-l, 1rem)',
  'align-content: start',
  'padding: var(--lr-theme-space-2xl, 2rem)',
  'background: var(--lr-theme-color-surface-default)',
  'color: var(--lr-theme-color-text-normal)',
  'font-family: var(--lr-theme-font-family-body)',
  'font-size: var(--lr-theme-font-size-m)',
].join('; ');

const rowStyle = 'display: flex; flex-wrap: wrap; gap: var(--lr-theme-space-s, 0.5rem); align-items: center';

function panel(mode, label) {
  const id = `look-${label.toLowerCase().replace(/[^a-z]+/g, '-')}-${mode}`;
  return html`
    <section data-lr-theme=${mode} style=${panelStyle} aria-labelledby=${id}>
      <h2 id=${id} style="margin: 0; font-size: var(--lr-theme-font-size-lg, 1.125rem)">${label}, ${mode}</h2>
      <div style=${rowStyle}>
        <lr-button>Primary</lr-button>
        <lr-button appearance="filled">Secondary</lr-button>
        <lr-button appearance="outlined">Outline</lr-button>
        <lr-button appearance="plain">Ghost</lr-button>
        <lr-button variant="danger">Destructive</lr-button>
        <lr-button appearance="link">Link</lr-button>
      </div>
      <lr-input label="Email" placeholder="you@example.com" hint="We never share it."></lr-input>
      <lr-select label="Framework" placeholder="Select a framework">
        <lr-option value="lit">Lit</lr-option>
        <lr-option value="react">React</lr-option>
        <lr-option value="svelte">Svelte</lr-option>
      </lr-select>
      <lr-textarea label="Message" placeholder="Type your message here."></lr-textarea>
      <div style=${rowStyle}>
        <lr-checkbox checked>Accept terms</lr-checkbox>
        <lr-switch checked>Notifications</lr-switch>
      </div>
      <lr-radio-group label="Plan" value="pro">
        <lr-radio value="free">Free</lr-radio>
        <lr-radio value="pro">Pro</lr-radio>
      </lr-radio-group>
      <lr-slider label="Volume" value="60"></lr-slider>
      <lr-progress-bar value="60" label="Upload progress"></lr-progress-bar>
      <div style=${rowStyle}>
        <lr-badge>Badge</lr-badge>
        <lr-badge variant="neutral" appearance="outlined">Outline</lr-badge>
        <lr-badge variant="danger">Destructive</lr-badge>
      </div>
      <lr-tab-group>
        <lr-tab panel="account">Account</lr-tab>
        <lr-tab panel="password">Password</lr-tab>
        <lr-tab-panel name="account">Make changes to your account here.</lr-tab-panel>
        <lr-tab-panel name="password">Change your password here.</lr-tab-panel>
      </lr-tab-group>
      <lr-card>
        <strong>Card</strong>
        <p style="margin: 0; color: var(--lr-theme-color-text-quiet)">
          A decorative edge: the preset draws it with the subtle hairline, not the control grey.
        </p>
      </lr-card>
      <lr-callout variant="danger" heading="Heads up">Destructive actions cannot be undone.</lr-callout>
    </section>
  `;
}

function sideBySide(label) {
  return html`
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr))">
      ${panel('light', label)} ${panel('dark', label)}
    </div>
  `;
}

export const Shadcn = {
  name: 'shadcn/ui look',
  globals: { look: 'shadcn' },
  render: () => sideBySide('shadcn/ui'),
};

export const Lyra = {
  name: 'Lyra look (for comparison)',
  globals: { look: 'lyra' },
  render: () => sideBySide('Lyra'),
};

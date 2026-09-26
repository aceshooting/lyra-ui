import { html } from 'lit';
import { setLyraTheme } from '../packages/lyra-ui/src/theme/theme.js';
import { GEMSTONES } from '../packages/lyra-ui/src/theme/gemstones-data.js';

/**
 * The opt-in shadcn/ui look (`@aceshooting/lyra-ui/themes/shadcn.css`) next to Lyra's own, on the
 * same controls. Each story renders a light and a dark panel side by side -- `data-lr-theme` on the
 * panel is honoured by both theme.css and the preset -- and pins the `look` toolbar global, so the
 * two stories are a direct comparison. Every other story can be switched with the `Look` toolbar.
 * `panel()` demonstrates at least one representative control per component family (not just
 * forms/overlays/layout) so the preset's reach past its most-tested primitives is directly visible.
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

      <!-- One representative per remaining family (layout, data, charts, conversation,
           agent-tools, retrieval, media, utility, viewers) -- see shadcn.test.ts for the matching
           computed-style assertions on several of these. -->
      <lr-breadcrumb>
        <lr-breadcrumb-item href="/">Home</lr-breadcrumb-item>
        <lr-breadcrumb-item href="/reports">Reports</lr-breadcrumb-item>
        <lr-breadcrumb-item current>Current</lr-breadcrumb-item>
      </lr-breadcrumb>
      <div style=${rowStyle}>
        <lr-stat label="Active agents" value="17" variant="brand"></lr-stat>
        <lr-stat label="Errors" value="128" delta-percent="-5.1" variant="danger"></lr-stat>
      </div>
      <lr-lite-chart
        type="bar"
        height="10rem"
        legend
        data-table-toggle
        .labels=${['Q1', 'Q2', 'Q3', 'Q4']}
        .datasets=${[{ label: 'Revenue', data: [12, 19, 14, 22] }]}
      ></lr-lite-chart>
      <lr-chat-message message-role="assistant" .timestamp=${new Date()}>
        Deploys look healthy: three services restarted cleanly.
      </lr-chat-message>
      <lr-tool-call-block name="search_web" status="success" duration-ms="820"></lr-tool-call-block>
      <lr-source-card source-id="doc-1" title="annual_report.pdf" page="12">
        <span slot="excerpt">Revenue grew 12% year over year.</span>
      </lr-source-card>
      <lr-media-card
        src="https://example.com/reports/quarterly-summary.pdf"
        kind="file"
        filename="quarterly-summary.pdf"
        mime-type="application/pdf"
      ></lr-media-card>
      <div>
        <span>Above</span>
        <lr-divider></lr-divider>
        <span>Below</span>
      </div>
      <div style="position: relative; block-size: 4rem;">
        <lr-highlight-layer
          .items=${[{ id: 'zone-a', rects: [{ x: 10, y: 20, width: 40, height: 40 }], label: 'Zone A' }]}
        ></lr-highlight-layer>
      </div>
    </section>
  `;
}

/**
 * A third scenario alongside the light/dark side-by-side above: the shadcn look with a gemstone
 * accent layered on top (`setLyraTheme({ accent })`, the same runtime a consumer calls). The accent
 * ramp is resolved for one mode at a time, so unlike `panel()` this cannot show light and dark
 * side by side -- toggle the `Theme` toolbar global to see both. Only primary/brand-driven fills
 * (button, checked checkbox/switch, a `variant="brand"` badge, a streaming chat message's border)
 * follow the accent; secondary, muted, and status colors deliberately do not -- see
 * shadcn.test.ts's "lets a gemstone accent recolour primary..." assertions for the same claim
 * verified against computed styles.
 */
function accentPanel(gemstone) {
  setLyraTheme({ accent: gemstone.fill });
  return html`
    <section style=${panelStyle}>
      <h2 style="margin: 0; font-size: var(--lr-theme-font-size-lg, 1.125rem)">shadcn/ui, ${gemstone.key} accent</h2>
      <div style=${rowStyle}>
        <lr-button>Primary</lr-button>
        <lr-button appearance="filled">Secondary (unaffected)</lr-button>
        <lr-badge variant="brand">Brand</lr-badge>
      </div>
      <div style=${rowStyle}>
        <lr-checkbox checked>Accept terms</lr-checkbox>
        <lr-switch checked>Notifications</lr-switch>
      </div>
      <lr-chat-message message-role="assistant" status="streaming" .timestamp=${new Date()}>
        Still generating…
      </lr-chat-message>
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

export const GemstoneAccent = {
  name: 'shadcn/ui look — gemstone accent',
  globals: { look: 'shadcn' },
  render: () => accentPanel(GEMSTONES.emerald),
};

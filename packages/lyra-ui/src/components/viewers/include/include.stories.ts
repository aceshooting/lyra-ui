import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import './include.js';
import type { LyraInclude } from './include.js';

const meta: Meta = { title: 'Utilities/Include', component: 'lr-include' };
export default meta;
type Story = StoryObj;

// A data: URL avoids a live network dependency in Storybook, same pattern as
// html-viewer.stories.ts.
const fragment = '<article><h2>Included fragment</h2><p>This markup was fetched and sanitized, then transcluded as light-DOM content.</p></article>';
const src = `data:text/html,${encodeURIComponent(fragment)}`;
const narrowFragment = '<article><h2>International quarterly analytical-engine research fragment</h2><p>InternationalQuarterlyAnalyticalEngineResearchWithoutConvenientBreakpoints</p></article>';
const narrowSrc = `data:text/html,${encodeURIComponent(narrowFragment)}`;
const targetedFragment = '<main><template id="summary"><h2>Summary</h2><p>Selected after sanitizing the shared document.</p></template><section id="details"><h2>Details</h2><p>A different target from the same response.</p></section></main>';
const targetedSrc = `data:text/html,${encodeURIComponent(targetedFragment)}`;

export const Default: Story = {
  render: () => html`<lr-include src=${src} @lr-load=${(event: CustomEvent) => console.log('lr-load', event.detail)}></lr-include>`,
};

export const Empty: Story = { render: () => html`<lr-include></lr-include>` };

export const WithFallbackContent: Story = {
  render: () => html`<lr-include>Loading…</lr-include>`,
};

export const SamePageTemplate: Story = {
  render: () => html`
    <template id="include-story-profile">
      <article>
        <h2>Same-page profile</h2>
        <p>The template remains in place; Include inserts a sanitized clone of its content.</p>
      </article>
    </template>
    <lr-include src="#include-story-profile">Loading profile…</lr-include>
  `,
};

export const SharedRemoteFragments: Story = {
  render: () => html`
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem">
      <lr-include src=${`${targetedSrc}#summary`}>Loading summary…</lr-include>
      <lr-include src=${`${targetedSrc}#details`}>Loading details…</lr-include>
    </div>
  `,
};

export const ReloadWithoutCache: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Property-bound `cache=false` opts out of retained values and in-flight deduplication. The button exercises the public `reload()` method against the same remote source.',
      },
    },
  },
  render: () => {
    const reload = async (event: Event) => {
      const demo = (event.currentTarget as HTMLElement).closest('.include-reload-demo');
      const include = demo?.querySelector('lr-include') as LyraInclude | null;
      const output = demo?.querySelector('output');
      if (!include || !output) return;
      output.textContent = 'Reloading…';
      await include.reload();
      output.textContent = 'Reload complete.';
    };
    return html`
      <div class="include-reload-demo" style="display:grid;gap:0.75rem">
        <lr-include src=${src} .cache=${false}>Loading fragment…</lr-include>
        <div>
          <button type="button" @click=${reload}>Reload fragment</button>
          <output style="margin-inline-start:0.5rem" aria-live="polite"></output>
        </div>
      </div>
    `;
  },
};

/** Baseline narrow-allocation coverage with long transcluded content. */
export const Narrow320: Story = {
  render: () => html`
    <div style="max-inline-size:320px">
      <lr-include src=${narrowSrc}>Loading a long international research fragment…</lr-include>
    </div>
  `,
};


export const NestedRemoteTemplate: Story = {
  parameters: { docs: { description: { story: 'Remote fragment selection can reach an ordinary section inside nested templates. Passive text survives; presentation hooks and controls are removed before caching or insertion, and permitted local links are rebased.' } } },
  render: () => {
    const markup = '<main><template><template><section id="nested"><h2 id="title">Nested summary</h2><p style="color:blue" part="sample">Passive text remains.</p><form><span>Form text remains.</span><input type="hidden"></form><a href="#title">Summary heading</a></section></template></template></main>';
    return html`<lr-include src=${`data:text/html,${encodeURIComponent(markup)}#nested`}></lr-include>`;
  },
};

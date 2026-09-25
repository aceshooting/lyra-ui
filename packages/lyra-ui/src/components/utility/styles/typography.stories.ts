import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html, type TemplateResult } from 'lit';

import { narrowStoryFrames } from '../../../../../../.storybook/narrow-story.js';

const utilities = new URL('../../../styles/utilities.css', import.meta.url).href;
const tokensRoot = new URL('../../../styles/tokens-root.css', import.meta.url).href;

const stylesheets = html`
  <link rel="stylesheet" href=${tokensRoot} />
  <link rel="stylesheet" href=${utilities} />
`;

/**
 * One article exercising every element the `lr-typography` scope styles. Ids carry a prefix so the
 * autodocs page, which renders several stories into one document, keeps them unique.
 */
function specimen(prefix: string, captionNote = ''): TemplateResult {
  return html`
    <article class="lr-typography lr-max-inline-prose" aria-labelledby="${prefix}-title">
      <h1 id="${prefix}-title">Keeping a community tool library running</h1>
      <p class="lr-text-xl lr-text-quiet">
        What three years of lending drills, ladders and sewing machines taught the volunteer crew.
      </p>
      <p>
        Every loan is recorded with the <code>lend</code> command and reconciled weekly against the
        <a href="#${prefix}-caption">inventory table</a>. The checklist for returns lives in
        <a href="#${prefix}-returns"><code>docs/returns.md</code></a>.
      </p>
      <h2>Opening hours</h2>
      <p>
        The shed opens on Saturday mornings and one weekday evening. Longer hours were tried and
        dropped: the evening slot drew most of the borrowers who could not come at the weekend.
      </p>
      <blockquote>
        A tool on the shelf is a promise; a tool on loan is the promise kept.
      </blockquote>
      <h3 id="${prefix}-returns">Returns</h3>
      <ul>
        <li>Clean the tool and coil any cable</li>
        <li>
          Report damage at the desk
          <ul>
            <li>Photograph anything broken</li>
          </ul>
        </li>
      </ul>
      <ol>
        <li>Scan the tag</li>
        <li>Check the parts list</li>
        <li>Shelve it by category</li>
      </ol>
      <hr />
      <h4>Inventory</h4>
      <div class="lr-overflow-auto" role="region" aria-labelledby="${prefix}-caption" tabindex="0">
        <table>
          <caption id="${prefix}-caption">Items on the shelf by category${captionNote}</caption>
          <thead>
            <tr>
              <th scope="col">Category</th>
              <th scope="col">Items</th>
              <th scope="col">On loan</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Power tools</th>
              <td>24</td>
              <td>9</td>
            </tr>
            <tr>
              <th scope="row">Garden</th>
              <td>31</td>
              <td>12</td>
            </tr>
            <tr>
              <th scope="row">Sewing</th>
              <td>6</td>
              <td>2</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="lr-text-lg lr-font-semibold">Large: the ladder rack is full again.</p>
      <p class="lr-text-sm lr-font-medium">Small: last updated after the Saturday session.</p>
      <p class="lr-text-sm lr-text-quiet">Muted: counts exclude items waiting for repair.</p>
    </article>
  `;
}

const meta: Meta = {
  title: 'Styles/Typography',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Opt-in typography from `utilities.css`. The `lr-typography` scope styles bare headings, paragraphs, links, blockquotes, lists, inline code and tables inside it; `lr-heading-1`–`lr-heading-4` and `lr-inline-code` give one element a role look without changing its semantics; `lr-not-typography` opts a subtree out. The scope element itself is never styled. Lead, large, small and muted are compositions of existing text utilities.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

export const Specimen: Story = {
  render: () => html`${stylesheets}${specimen('specimen')}`,
};

export const RoleClasses: Story = {
  name: 'Role classes and boundaries',
  render: () => html`
    ${stylesheets}
    <div class="lr-stack" style="--lr-layout-gap: var(--lr-space-2xl)">
      <article class="lr-prose lr-typography" aria-labelledby="roles-combined">
        <h2 id="roles-combined">Prose measure with typography looks</h2>
        <p>The prose container supplies root type and colour; the scope supplies element looks.</p>
        <h3 class="lr-heading-1">An explicit role beats the element level</h3>
        <p>Headings keep their outline level; only the look changes.</p>
      </article>
      <section class="lr-stack" aria-labelledby="roles-level">
        <h3 id="roles-level" class="lr-heading-2">A level-3 heading with the heading-2 look</h3>
        <p>
          Run <code class="lr-inline-code">pnpm build</code> before publishing, or read the
          <a href="#roles-level">release notes for <code class="lr-inline-code">v2</code></a>.
        </p>
        <p class="lr-heading-2 lr-text-quiet">A quiet heading-2 look on a paragraph</p>
      </section>
      <article class="lr-typography" aria-labelledby="roles-boundary">
        <h2 id="roles-boundary">Boundaries and component chrome</h2>
        <p>The card title below keeps the card's own header styling.</p>
        <lr-card>
          <h2 slot="header">Card header chrome</h2>
          <p>Default-slot content is styled like the rest of the article.</p>
        </lr-card>
        <div class="lr-not-typography">
          <ul class="lr-cluster" aria-label="Topics" style="margin: 0; padding: 0; list-style: none">
            <li><lr-tag>Lending</lr-tag></li>
            <li><lr-tag>Repairs</lr-tag></li>
            <li><lr-tag>Volunteers</lr-tag></li>
          </ul>
        </div>
      </article>
    </div>
  `,
};

export const NarrowAllocation: Story = {
  render: () => html`
    ${stylesheets}
    ${narrowStoryFrames((direction) =>
      specimen(`narrow-${direction}`, direction === 'rtl' ? ' (right-to-left frame)' : ' (left-to-right frame)'),
    )}
  `,
};

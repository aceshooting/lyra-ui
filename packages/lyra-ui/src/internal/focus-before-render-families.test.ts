import { expect, fixture, html } from '@open-wc/testing';
import { render, type TemplateResult } from 'lit';
import type { LyraElement } from './lyra-element.js';
import { columns, rows } from '../../test/data-grid.js';
import '../components/lr-tool-call-chip.js';
import '../components/lr-tool-param-form.js';
import '../components/lr-branch-picker.js';
import '../components/lr-chat-composer.js';
import '../components/lr-message-feedback.js';
import '../components/lr-prompt-input.js';
import '../components/lr-push-to-talk.js';
import '../components/lr-data-grid.js';
import '../components/lr-graph-query-builder.js';
import '../components/lr-pagination.js';
import '../components/lr-checkbox-group.js';
import '../components/lr-checkbox.js';
import '../components/lr-radio-group.js';
import '../components/lr-radio.js';
import '../components/lr-toggle-group.js';
import '../components/lr-toggle.js';
import '../components/lr-app-rail-item.js';
import '../components/lr-breadcrumb-item.js';
import '../components/lr-card.js';
import '../components/lr-accordion-item.js';
import '../components/lr-navigation-menu-item.js';
import '../components/lr-tab-group.js';
import '../components/lr-tab.js';
import '../components/lr-tab-panel.js';
import '../components/lr-animated-image.js';
import '../components/lr-attachment-trigger.js';
import '../components/lr-av-player.js';
import '../components/lr-file-input.js';
import '../components/lr-image-comparer.js';
import '../components/lr-media-card.js';
import '../components/lr-pan-zoom.js';
import '../components/lr-sequence-playback.js';
import '../components/lr-video-playlist.js';
import '../components/lr-video.js';
import '../components/lr-zoomable-frame.js';
import '../components/lr-tag.js';
import '../components/lr-chip.js';
import '../components/lr-rating.js';
import '../components/lr-copy-button.js';
import '../components/lr-export-button.js';
import '../components/lr-known-date.js';

/**
 * Delegating controls outside the forms family. Each case marks the control with `data-probe`;
 * `data-focus-root` marks the element that must contain focus when that is not the control
 * itself (a tab's real button lives in its group).
 */
const schema = { type: 'object', properties: { days: { type: 'number' } } };
const graphQuery = { startId: '', endId: '', relationshipTypes: [], nodeTypes: [], direction: 'both', minHops: 1, maxHops: 1 };
const CASES: Record<string, Record<string, TemplateResult>> = {
  'agent-tools': {
    'tool-call-chip': html`<lr-tool-call-chip data-probe name="search"></lr-tool-call-chip>`,
    'tool-param-form': html`<lr-tool-param-form data-probe .schema=${schema}></lr-tool-param-form>`,
  },
  conversation: {
    'branch-picker': html`<lr-branch-picker data-probe count="3" index="1"></lr-branch-picker>`,
    'chat-composer': html`<lr-chat-composer data-probe></lr-chat-composer>`,
    'message-feedback': html`<lr-message-feedback data-probe></lr-message-feedback>`,
    'prompt-input': html`<lr-prompt-input data-probe></lr-prompt-input>`,
    'push-to-talk': html`<lr-push-to-talk data-probe></lr-push-to-talk>`,
  },
  data: {
    'data-grid': html`<lr-data-grid data-probe label="Rows" .columns=${columns} .data=${rows}></lr-data-grid>`,
    'graph-query-builder': html`<lr-graph-query-builder data-probe .value=${graphQuery}></lr-graph-query-builder>`,
    pagination: html`<lr-pagination data-probe total="95"></lr-pagination>`,
  },
  'forms groups': {
    'checkbox-group': html`<lr-checkbox-group data-probe label="Pick"><lr-checkbox value="a">A</lr-checkbox></lr-checkbox-group>`,
    'radio-group': html`<lr-radio-group data-probe label="Pick"><lr-radio value="a">A</lr-radio></lr-radio-group>`,
    'toggle-group': html`<lr-toggle-group data-probe label="Pick"><lr-toggle value="a">A</lr-toggle></lr-toggle-group>`,
  },
  layout: {
    'app-rail-item': html`<lr-app-rail-item data-probe href="/home">Home</lr-app-rail-item>`,
    'breadcrumb-item': html`<lr-breadcrumb-item data-probe href="/home">Home</lr-breadcrumb-item>`,
    card: html`<lr-card data-probe href="/details">Linked</lr-card>`,
    'accordion-item': html`<lr-accordion-item data-probe label="One">First</lr-accordion-item>`,
    'navigation-menu-item': html`<lr-navigation-menu-item data-probe href="/blog">Blog</lr-navigation-menu-item>`,
    tab: html`<lr-tab-group data-focus-root>
      <lr-tab data-probe panel="a">A</lr-tab>
      <lr-tab-panel name="a">A body</lr-tab-panel>
    </lr-tab-group>`,
  },
  media: {
    'attachment-trigger': html`<lr-attachment-trigger data-probe></lr-attachment-trigger>`,
    'av-player': html`<lr-av-player data-probe src="https://example.test/a.mp4"></lr-av-player>`,
    'file-input': html`<lr-file-input data-probe label="Files"></lr-file-input>`,
    'image-comparer': html`<lr-image-comparer data-probe></lr-image-comparer>`,
    'media-card': html`<lr-media-card data-probe src="https://example.test/a.mp4" kind="video"></lr-media-card>`,
    'pan-zoom': html`<lr-pan-zoom data-probe></lr-pan-zoom>`,
    'sequence-playback': html`<lr-sequence-playback data-probe item-count="3"></lr-sequence-playback>`,
    'video-playlist': html`<lr-video-playlist data-probe><lr-video title="One"></lr-video><lr-video title="Two"></lr-video></lr-video-playlist>`,
    video: html`<lr-video data-probe src="https://example.test/a.mp4"></lr-video>`,
    'zoomable-frame': html`<lr-zoomable-frame data-probe srcdoc="<p>Inside</p>"></lr-zoomable-frame>`,
  },
  overlays: {
    tag: html`<lr-tag data-probe with-remove>Tag</lr-tag>`,
    chip: html`<lr-chip data-probe toggleable>Chip</lr-chip>`,
    rating: html`<lr-rating data-probe label="Score"></lr-rating>`,
  },
  utility: {
    'copy-button': html`<lr-copy-button data-probe value="text"></lr-copy-button>`,
    'export-button': html`<lr-export-button data-probe></lr-export-button>`,
    'known-date': html`<lr-known-date data-probe locale="en-GB"></lr-known-date>`,
  },
};

/** Renders `template` into the connected `host` synchronously, so no update has run yet. */
function mount(host: HTMLElement, template: TemplateResult): { el: LyraElement; root: Element } {
  render(template, host);
  const el = host.querySelector<LyraElement>('[data-probe]')!;
  return { el, root: host.querySelector('[data-focus-root]') ?? el };
}

function container(): Promise<HTMLDivElement> {
  return fixture<HTMLDivElement>(html`<div></div>`);
}

async function settle(el: LyraElement, root: Element = el): Promise<void> {
  await el.updateComplete;
  // A tab's real button belongs to its group, which settles its projection after the tab renders.
  if (root !== el) await (root as LyraElement).updateComplete;
  await Promise.resolve();
}

for (const [family, cases] of Object.entries(CASES)) {
  describe(`focus() before first render: ${family}`, () => {
    for (const [name, template] of Object.entries(cases)) {
      it(`${name} applies a focus() called before its first render`, async () => {
        // Reference: where a focus() made after rendering lands in this engine. An engine may
        // leave a target unfocusable (no microphone API disables push-to-talk; an unloaded iframe).
        const rendered = mount(await container(), template);
        await settle(rendered.el, rendered.root);
        rendered.el.focus();
        await Promise.resolve();
        const expected = rendered.root.matches(':focus-within');
        rendered.root.remove();

        const { el, root } = mount(await container(), template);
        expect(el.hasUpdated, 'not yet rendered').to.be.false;
        el.focus();
        await settle(el, root);
        expect(root.matches(':focus-within'), `${name} contains focus`).to.equal(expected);
      });
    }
  });
}

/** Disabled hosts re-check their state when the queued focus replays. */
const DISABLED: Record<string, TemplateResult> = {
  'tool-param-form': html`<lr-tool-param-form data-probe disabled .schema=${schema}></lr-tool-param-form>`,
  'checkbox-group': html`<lr-checkbox-group data-probe disabled label="Pick"><lr-checkbox value="a">A</lr-checkbox></lr-checkbox-group>`,
  'toggle-group': html`<lr-toggle-group data-probe disabled label="Pick"><lr-toggle value="a">A</lr-toggle></lr-toggle-group>`,
  'file-input': html`<lr-file-input data-probe disabled label="Files"></lr-file-input>`,
  rating: html`<lr-rating data-probe disabled label="Score"></lr-rating>`,
};
for (const [name, template] of Object.entries(DISABLED)) {
  it(`a disabled ${name} stays unfocused when focus() was queued before render`, async () => {
    const { el, root } = mount(await container(), template);
    el.focus();
    await settle(el);
    expect(root.matches(':focus-within')).to.be.false;
  });
}

it('drops a queued focus when a delegating control is removed before its first render', async () => {
  const { el } = mount(await container(), html`<lr-chip data-probe toggleable>Chip</lr-chip>`);
  const parent = el.parentNode!;
  el.focus();
  el.remove();
  parent.appendChild(el);
  await settle(el);
  expect(el.matches(':focus-within')).to.be.false;
});

it('animated-image replays a queued focus() harmlessly before its controls exist', async () => {
  // The play control renders only once the image has loaded.
  const { el } = mount(await container(), html`<lr-animated-image data-probe alt="Pixel"></lr-animated-image>`);
  el.focus();
  await settle(el);
  expect(el.hasUpdated).to.be.true;
  expect(el.matches(':focus-within')).to.be.false;
});

it('a tab moved out of its group before the group settles does not take focus', async () => {
  const host = await container();
  const { el, root } = mount(host, html`<lr-tab-group data-focus-root>
    <lr-tab data-probe panel="a">A</lr-tab>
    <lr-tab panel="b">B</lr-tab>
  </lr-tab-group>`);
  el.focus();
  await el.updateComplete;
  host.append(el);
  await (root as LyraElement).updateComplete;
  await Promise.resolve();
  expect(root.matches(':focus-within')).to.be.false;
});

it('a standalone tab replays a queued focus() without an owning group', async () => {
  const { el } = mount(await container(), html`<lr-tab data-probe panel="a">A</lr-tab>`);
  el.focus();
  await settle(el);
  expect(el.hasUpdated).to.be.true;
  expect(el.matches(':focus-within')).to.be.false;
});

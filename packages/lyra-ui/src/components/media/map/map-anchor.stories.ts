import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { ref } from 'lit/directives/ref.js';
import './map.js';
import './map-anchor.js';
import { LYRA_MAP_EMPTY_STYLE, type LyraMap } from './map.js';
import type { LyraMapAnchor, LyraMapAnchorEventMap } from './map-anchor.js';

const meta: Meta = {
  title: 'Map/Map anchor',
  component: 'lr-map-anchor',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Experimental. Independent panels of rich, interactive content anchored to coordinates of their `lr-map`, each opened, moved and closed by its own owner. The content stays the caller\'s own light DOM, so listeners and component state survive camera moves, hiding, style replacement and reconnects. Overlapping panels paint in the order they were last opened, focused or pressed. Import `lr-map-anchor.js` alongside `lr-map.js`.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

/** A declarative panel anchored to a coordinate, with a localized close action. */
export const Default: Story = {
  render: () => html`
    <lr-map label="Map with a place detail panel" style="block-size: 20rem" .mapStyle=${LYRA_MAP_EMPTY_STYLE}>
      <lr-map-anchor slot="anchors" open closable label="Place details" .lngLat=${[0, 0] as const}>
        <p>A panel of content at the center of the map.</p>
      </lr-map-anchor>
    </lr-map>`,
};

const DETAILS_RECIPE = html`<style>
  lr-map-anchor.details::part(body) { display: flex; flex-direction: column; overflow: hidden; }
  .detail-card { display: flex; flex-direction: column; min-block-size: 0; }
  .detail-card > strong { flex: none; }
  .detail-card > .rows { min-block-size: 0; overflow: auto; }
  .detail-card p { margin: 0; }
</style>`;

function detailCard(title: string, rows: number) {
  return html`<div class="detail-card"><strong>${title}</strong><div class="rows">
    ${Array.from({ length: rows }, (_value, index) => html`<p>${title} detail ${index + 1}</p>`)}
  </div></div>`;
}

/**
 * Two modules each own one panel: its element, its listeners and its lifetime. Opening or closing
 * one never touches the other. Each header stays put while its details scroll.
 */
export const TwoIndependentModules: Story = {
  render: () => {
    let map: LyraMap | undefined;
    const open = (title: string, lngLat: readonly [number, number]): void => {
      if (!map) return;
      const anchor = document.createElement('lr-map-anchor');
      anchor.classList.add('details'); anchor.lngLat = lngLat; anchor.closable = true; anchor.label = `${title} details`;
      const content = document.createElement('div');
      content.className = 'detail-card';
      const heading = document.createElement('strong'), rows = document.createElement('div');
      heading.textContent = title; rows.className = 'rows';
      for (let index = 1; index <= 45; index++) {
        const row = document.createElement('p'); row.textContent = `${title} detail ${index}`; rows.append(row);
      }
      content.append(heading, rows); anchor.append(content);
      anchor.addEventListener('lr-close', () => { anchor.remove(); }, { once: true });
      map.append(anchor); anchor.open = true;
    };
    return html`${DETAILS_RECIPE}
      <button type="button" @click=${() => { open('Place', [-6, 4]); }}>Open place details</button>
      <button type="button" @click=${() => { open('Power line', [6, -4]); }}>Open power line details</button>
      <lr-map ${ref(node => { map = node as LyraMap | undefined; })} label="Two independent detail panels"
        style="block-size: 26rem" zoom="3" .mapStyle=${LYRA_MAP_EMPTY_STYLE} .anchorSafeArea=${{ blockStart: 16 }}></lr-map>`;
  },
};

/** `lr-close-request` is cancelable: this panel stays open until closing is allowed. */
export const VetoedClose: Story = {
  render: () => {
    let allowed = false;
    return html`
      <label><input type="checkbox" @change=${(event: Event) => { allowed = (event.target as HTMLInputElement).checked; }}> Allow closing</label>
      <lr-map label="A panel that asks before closing" style="block-size: 18rem" .mapStyle=${LYRA_MAP_EMPTY_STYLE}>
        <lr-map-anchor slot="anchors" open closable label="Unsaved note" .lngLat=${[0, 0] as const}
          @lr-close-request=${(event: LyraMapAnchorEventMap['lr-close-request']) => { if (!allowed) event.preventDefault(); }}>
          <p>Unsaved changes keep this panel open.</p>
        </lr-map-anchor>
      </lr-map>`;
  },
};

/** At 320px in RTL, long content wraps inside the logical safe area and the close action sits at the inline end. */
export const Narrow320Rtl: Story = {
  render: () => html`
    <div dir="rtl" style="inline-size: 320px">
      <lr-map label="خريطة ضيقة" style="block-size: 20rem" .mapStyle=${LYRA_MAP_EMPTY_STYLE}
        .anchorSafeArea=${{ inlineStart: 48, blockStart: 8 }}>
        <lr-map-anchor slot="anchors" open closable label="تفاصيل المكان" .lngLat=${[-4, 2] as const}>
          <p>نص طويل جدا يلتف داخل المساحة المتاحة للخريطة دون أن يتجاوز حدودها.</p>
        </lr-map-anchor>
        <lr-map-anchor slot="anchors" open closable label="خط الكهرباء" .lngLat=${[5, -3] as const}>
          <p>تفاصيل الخط</p>
        </lr-map-anchor>
      </lr-map>
    </div>`,
};

/** Two anchors at one coordinate cover each other; focus or a press brings the covered one to the front. */
export const SameCoordinate: Story = {
  render: () => html`
    <lr-map label="Two panels at one point" style="block-size: 18rem" .mapStyle=${LYRA_MAP_EMPTY_STYLE}>
      <lr-map-anchor slot="anchors" open closable label="First" .lngLat=${[0, 0] as const}>
        <button type="button">First panel action</button>
      </lr-map-anchor>
      <lr-map-anchor slot="anchors" open closable label="Second" .lngLat=${[0, 0] as const}>
        <button type="button">Second panel action</button>
      </lr-map-anchor>
    </lr-map>`,
};

/** Each anchor has its own safe area and boundary; one inherits the map's safe area, one opts out with `{}`. */
export const SafeAreasAndBoundaries: Story = {
  render: () => {
    let boundary: HTMLElement | undefined;
    const bounded = (node?: Element): void => {
      const anchor = node as LyraMapAnchor | undefined;
      if (anchor && boundary) anchor.boundary = boundary;
    };
    return html`
      <div style="position: relative">
        <div ${ref(node => { boundary = node as HTMLElement | undefined; })}
          style="position: absolute; inset-block: 0; inset-inline-start: 0; inline-size: 50%; pointer-events: none"></div>
        <lr-map label="Per-anchor safe areas" style="block-size: 22rem" .mapStyle=${LYRA_MAP_EMPTY_STYLE}
          .anchorSafeArea=${{ blockStart: 64 }}>
          <lr-map-anchor slot="anchors" open label="Inherits the map safe area" .lngLat=${[-6, 8] as const}>
            <p>Kept below the map's 64px block-start inset.</p>
          </lr-map-anchor>
          <lr-map-anchor slot="anchors" open label="Own safe area" .lngLat=${[6, 8] as const} .safeArea=${{}}>
            <p>Opts out of the map's inset.</p>
          </lr-map-anchor>
          <lr-map-anchor ${ref(bounded)} slot="anchors" open label="Bounded" .lngLat=${[-2, -6] as const}>
            <p>Clipped to the start half of the map.</p>
          </lr-map-anchor>
        </lr-map>
      </div>`;
  },
};

/** The `anchor` slot and child anchors coexist; the slot panel joins the children's paint and Escape order. */
export const WithSlotAnchor: Story = {
  render: () => html`
    <lr-map label="Slot anchor and child anchors" style="block-size: 20rem" .mapStyle=${LYRA_MAP_EMPTY_STYLE}
      .anchorLngLat=${[-6, 0] as const} anchor-closable>
      <div slot="anchor"><p>The single anchor slot</p></div>
      <lr-map-anchor slot="anchors" open closable label="Child anchor" .lngLat=${[6, 0] as const}>
        <p>An independent child panel</p>
      </lr-map-anchor>
    </lr-map>`,
};

/** A detail panel with a fixed header over scrolling rows, using the documented part recipe. */
export const FixedHeaderDetails: Story = {
  render: () => html`${DETAILS_RECIPE}
    <lr-map label="Scrolling details" style="block-size: 20rem" .mapStyle=${LYRA_MAP_EMPTY_STYLE}>
      <lr-map-anchor class="details" slot="anchors" open closable label="Place details" .lngLat=${[0, -2] as const}>
        ${detailCard('Place', 45)}
      </lr-map-anchor>
    </lr-map>`,
};

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../../lr-lightbox.js';
import '../../lr-lightbox-item.js';

const blue =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="640" height="360"%3E%3Crect width="640" height="360" fill="%230969da"/%3E%3C/svg%3E';
const amber =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="640" height="360"%3E%3Crect width="640" height="360" fill="%23bf8700"/%3E%3C/svg%3E';

const meta: Meta = {
  title: 'Lightbox/Lightbox Item',
  component: 'lr-lightbox-item',
  tags: ['autodocs'],
};
export default meta;

export const Default: StoryObj = {
  render: () => html`
    <lr-lightbox label="Swatches">
      <lr-lightbox-item src=${blue} alt="Blue swatch" width="640" height="360">
        <img src=${blue} alt="Blue swatch" width="160" height="90" />
        <span slot="caption">Blue</span>
      </lr-lightbox-item>
      <lr-lightbox-item src=${amber} alt="Amber swatch" width="640" height="360">
        <img src=${amber} alt="Amber swatch" width="160" height="90" />
        <span slot="caption">Amber</span>
      </lr-lightbox-item>
    </lr-lightbox>
  `,
};

/** A `<template>` child makes a custom slide: its content is copied into the viewer only while
 *  that slide is shown, page styles apply to it, and `width`/`height` keep its proportions. The
 *  slotted image remains the page and strip thumbnail. Swipe by touch to see the slide follow the
 *  pointer. */
export const CustomTemplateSlide: StoryObj = {
  render: () => html`
    <style>
      .swatch-card {
        display: grid;
        place-content: center;
        gap: var(--lr-space-s);
        padding: var(--lr-space-l);
        background: var(--lr-color-surface);
        color: var(--lr-color-text);
        text-align: center;
      }
    </style>
    <lr-lightbox label="Swatches" with-thumbnails>
      <lr-lightbox-item src=${blue} alt="Blue swatch" width="640" height="360">
        <img src=${blue} alt="Blue swatch" width="160" height="90" />
      </lr-lightbox-item>
      <lr-lightbox-item alt="Swatch details" width="640" height="360">
        <img src=${amber} alt="Swatch details" width="160" height="90" />
        <template>
          <div class="swatch-card">
            <strong>Amber</strong>
            <span>Custom slide content, copied in only while it is shown.</span>
            <button type="button">A focusable control</button>
          </div>
        </template>
      </lr-lightbox-item>
      <lr-lightbox-item src=${amber} alt="Amber swatch" width="640" height="360">
        <img src=${amber} alt="Amber swatch" width="160" height="90" />
      </lr-lightbox-item>
    </lr-lightbox>
  `,
};

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './flag-peer.js';
import '../../overlays/overlay/popover.js';
import { languageToCountry, localeNativeName } from './language-map.js';

const meta: Meta = {
  title: 'Flag',
  component: 'lr-flag',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Gallery: Story = {
  render: () => html`
    <div style="display:flex; gap:1rem; align-items:center;">
      <lr-flag country="fr" label="France" style="height: 1.5rem"></lr-flag>
      <lr-flag language="en" label="English" style="height: 1.5rem"></lr-flag>
      <lr-flag language="de" label="German" round style="height: 1.5rem"></lr-flag>
      <lr-flag country="jp" label="Japan" round style="height: 1.5rem"></lr-flag>
    </div>
  `,
};

export const ThemeableFraming: Story = {
  render: () => html`
    <div style="display:flex; gap:1rem; align-items:center;">
      <lr-flag
        country="fr"
        aria-label="French flag in a wide frame"
        style="height: 3rem; --lr-flag-aspect-ratio: 2 / 1; --lr-flag-object-fit: contain;"
      ></lr-flag>
      <lr-flag country="jp" aria-label="Japanese flag in a circular frame" round style="height: 3rem;"></lr-flag>
    </div>
  `,
};

export const FidelityTiers: Story = {
  name: 'Fidelity tiers (compact / standard / detailed)',
  render: () => html`
    <div style="display:flex; gap:2rem; align-items:flex-end;">
      <div style="display:flex; flex-direction:column; align-items:center; gap:0.5rem;">
        <lr-flag country="es" variant="compact" label="Spain (compact)" style="height: 6rem"></lr-flag>
        <span><code>variant="compact"</code><br />~2 KB WebP · for icons</span>
      </div>
      <div style="display:flex; flex-direction:column; align-items:center; gap:0.5rem;">
        <lr-flag country="es" label="Spain (standard)" style="height: 6rem"></lr-flag>
        <span>default (standard)<br />~48 KB vector · for cards</span>
      </div>
      <div style="display:flex; flex-direction:column; align-items:center; gap:0.5rem;">
        <lr-flag country="es" variant="detailed" label="Spain (detailed)" style="height: 6rem"></lr-flag>
        <span><code>variant="detailed"</code><br />full vector · for hero display</span>
      </div>
    </div>
  `,
};

/**
 * A locale picker is a composition, not a component: `lr-popover` supplies the light-dismiss
 * surface, `lr-flag` the country mark, `localeNativeName()` the endonym (each locale named in its
 * own language, from `Intl.DisplayNames` — no name table ships), and `aria-current="true"` marks
 * the active choice. Which locales exist is the app's decision, so the app owns the list.
 */
export const LocalePicker: Story = {
  name: 'Locale picker recipe (popover + flag + native names)',
  render: () => {
    const locales = ['en', 'fr', 'de', 'pt-BR', 'ja', 'ar'];
    const current = 'fr';
    return html`
      <lr-popover placement="bottom-start">
        <button slot="trigger" style="display:flex; align-items:center; gap:0.5rem;">
          <lr-flag language=${current} label="" style="height: 1rem"></lr-flag>
          <span>${localeNativeName(current)}</span>
        </button>
        <ul role="list" style="list-style:none; margin:0; padding:0; min-width:12rem;">
          ${locales.map(
            (tag) => html`
              <li>
                <button
                  lang=${tag}
                  aria-current=${tag === current ? 'true' : 'false'}
                  style="display:flex; align-items:center; gap:0.6rem; width:100%; padding:0.4rem 0.6rem; border:0; background:transparent; font:inherit; text-align:start; cursor:pointer;"
                  @click=${() => console.log('locale selected', tag)}
                >
                  <lr-flag language=${tag} variant="compact" label="" style="height: 1rem"></lr-flag>
                  <span>${localeNativeName(tag)}</span>
                  <span style="margin-inline-start:auto; opacity:0.6;">${languageToCountry(tag)}</span>
                </button>
              </li>
            `,
          )}
        </ul>
      </lr-popover>
    `;
  },
};

export const LanguageSelector: Story = {
  name: 'Compact flags as menu icons',
  render: () => html`
    <ul style="list-style:none; margin:0; padding:0.5rem 0; width:14rem; border:1px solid var(--lr-color-border); border-radius:0.5rem; font-family:system-ui;">
      ${[
        ['es', 'Español'],
        ['fr', 'Français'],
        ['pt', 'Português'],
        ['hr', 'Hrvatski'],
        ['rs', 'Српски'],
      ].map(
        ([code, label]) => html`
          <li style="display:flex; align-items:center; gap:0.6rem; padding:0.4rem 0.9rem; cursor:pointer;">
            <lr-flag country=${code} variant="compact" label=${label} style="height: 1.1rem"></lr-flag>
            <span>${label}</span>
          </li>
        `,
      )}
    </ul>
  `,
};

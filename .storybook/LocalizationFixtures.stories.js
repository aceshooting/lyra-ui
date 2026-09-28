import { html } from 'lit';
import '../packages/lyra-ui/src/density.css';
import '../packages/lyra-ui/src/translations/pseudo/en-XA.js';
import '../packages/lyra-ui/src/translations/pseudo/ar-XB.js';
import { resolveLyraString } from '../packages/lyra-ui/src/localization.js';
import '../packages/lyra-ui/src/components/forms/input/input.js';
import '../packages/lyra-ui/src/components/forms/textarea/textarea.js';
import '../packages/lyra-ui/src/components/forms/button/button.js';
import '../packages/lyra-ui/src/components/forms/locale-picker/locale-picker.js';

export default {
  title: 'Localization/Pseudo locales',
  tags: ['!autodocs'],
  parameters: { docs: { description: { component: 'Synthetic expansion and bidirectional fixtures expose clipping, wrapping and mixed-direction behavior. They are test catalogs and do not claim translation quality.' } } },
};

function specimen(locale, direction) {
  const host = document.createElement('span');
  host.lang = locale;
  const text = (key) => resolveLyraString(host, key);
  return html`<section lang=${locale} dir=${direction} data-lr-density="compact"
    style="box-sizing:border-box;inline-size:100%;max-inline-size:32rem;min-inline-size:0;display:grid;gap:var(--lr-theme-space-m);padding:var(--lr-theme-space-m);overflow-wrap:anywhere">
    <h2 style="margin:0">${text('localePickerLabel')}</h2>
    <p style="margin:0">${text('documentPreviewGenericError')} · OpenAI / العربية / 日本語 / 123</p>
    <lr-input label=${text('search')} placeholder=${text('search')} value="English العربية 日本語" clearable></lr-input>
    <lr-textarea label=${text('editMessage')} hint=${text('fieldRequired')} value="العربية · English · 日本語 · 123" resize="auto"></lr-textarea>
    <lr-locale-picker without-flags .locales=${['en', 'fr', 'ar']} @lr-change-request=${event => event.preventDefault()}></lr-locale-picker>
    <div style="display:flex;flex-wrap:wrap;gap:var(--lr-theme-space-s)">
      <lr-button variant="brand">${text('confirm')}</lr-button>
      <lr-button>${text('cancel')}</lr-button>
    </div>
  </section>`;
}

export const Expanded = { render: () => specimen('en-XA', 'ltr') };
export const Bidirectional = { render: () => specimen('ar-XB', 'rtl') };

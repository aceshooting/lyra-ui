import { expectLocaleFallback } from '../../test/expected-locale-fallbacks.js';
import { expect, fixture, html } from '@open-wc/testing';
import { getRegisteredLyraLocales, registerLyraLocale } from './localization.js';
import { lyraLocaleCatalogVersion } from './localization-runtime.js';
import { LyraElement } from './lyra-element.js';

// Module state is per page: nothing in this file registers a catalog before the final case, so
// every earlier lookup runs on the unexpanded English-only candidate chain.

class UnregisteredPluralProbe extends LyraElement {
  protected static override readonly defaultStrings = Object.freeze({
    probeItems: { one: '{count} item', other: '{count} items' },
    probeTitle: 'Probe title',
  });
  count = 0;

  protected override render() {
    return html`<span>${this.localize('probeTitle')}|${this.localize('probeItems', undefined, { count: this.count })}</span>`;
  }
}

if (!customElements.get('x-unregistered-plural-probe')) {
  customElements.define('x-unregistered-plural-probe', UnregisteredPluralProbe);
}

const text = (probe: UnregisteredPluralProbe): string => probe.shadowRoot?.textContent?.trim() ?? '';

function expectedPlural(locale: string, count: number): string {
  // The English catalog authors `one` and `other`; every other category widens to `other`.
  const category = new Intl.PluralRules(locale).select(count);
  const formatted = new Intl.NumberFormat(locale, { maximumFractionDigits: 20, useGrouping: false }).format(count);
  return `${formatted} ${category === 'one' ? 'item' : 'items'}`;
}

describe('localization before any catalog is registered', () => {
  it('selects plural categories and formats numbers in the inherited locale', async () => {
    expect(getRegisteredLyraLocales()).to.deep.equal(['en']);
    for (const locale of ['ar', 'ru', 'fr-CA', 'qps-Ploc', 'en']) {
      if (locale !== 'en') expectLocaleFallback(locale, ['probeTitle', 'probeItems']);
      for (const count of [0, 1, 2, 5, 1234]) {
        const probe = await fixture<UnregisteredPluralProbe>(
          html`<x-unregistered-plural-probe lang=${locale} .count=${count}></x-unregistered-plural-probe>`,
        );
        expect(text(probe), `${locale} ${count}`).to.equal(`Probe title|${expectedPlural(locale, count)}`);
      }
    }
  });

  it('reports one stable empty catalog signature whatever the locale', () => {
    for (const locale of ['', 'en', 'pt', 'zh-Hant-TW', 'sr-ME', 'not a locale']) {
      expect(lyraLocaleCatalogVersion(locale), locale).to.equal('');
    }
  });

  it('expands the candidate chain on the first registration, reaching a regional catalog from its base language', async () => {
    expectLocaleFallback('pt', ['probeTitle', 'probeItems']);
    const probe = await fixture<UnregisteredPluralProbe>(
      html`<x-unregistered-plural-probe lang="pt" .count=${1}></x-unregistered-plural-probe>`,
    );
    expect(text(probe)).to.equal('Probe title|1 item');
    const before = lyraLocaleCatalogVersion('pt');

    // `pt-BR` is reached from `pt` only through the regional-fallback half of the expanded chain.
    registerLyraLocale('pt-BR', { probeTitle: 'Título', probeItems: { one: '{count} item', other: '{count} itens' } });
    await probe.updateComplete;
    expect(text(probe)).to.equal('Título|1 item');
    probe.count = 3;
    probe.requestUpdate();
    await probe.updateComplete;
    expect(text(probe)).to.equal('Título|3 itens');
    expect(lyraLocaleCatalogVersion('pt')).to.not.equal(before);
    expect(lyraLocaleCatalogVersion('en')).to.equal('');
  });
});

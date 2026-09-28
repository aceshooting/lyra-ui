import { expect, fixture } from '@open-wc/testing';
import { property } from 'lit/decorators.js';
import { LyraElement } from './lyra-element.js';
import { trueDefaultBooleanConverter } from './converters.js';
import { invertAlias, type LyraDeprecatedAliases } from './deprecated-aliases.js';
import { tag } from './prefix.js';
import { captureDeprecationWarnings } from '../../test/expected-deprecations.js';

class AliasDemo extends LyraElement {
  protected static override deprecatedAliases: LyraDeprecatedAliases = {
    closable: ['withoutCloseButton', invertAlias, invertAlias],
    legend: 'withLegend',
    showLegend: 'withLegend',
    railWidthPx: 'railWidth',
  };

  @property({ type: Boolean, reflect: true, attribute: 'without-close-button' })
  withoutCloseButton = false;

  /** @deprecated */
  @property({ type: Boolean, converter: trueDefaultBooleanConverter, reflect: true })
  closable = true;

  @property({ type: Boolean, reflect: true, attribute: 'with-legend' })
  withLegend = false;

  /** @deprecated */
  @property({ type: Boolean, reflect: true })
  legend = false;

  /** @deprecated */
  @property({ type: Boolean, attribute: 'show-legend' })
  showLegend = false;

  @property({ attribute: 'rail-width' }) railWidth?: string;

  /** @deprecated */
  @property({ attribute: 'rail-width-px' }) railWidthPx?: string;
}
const aliasTag = tag('alias-demo');
customElements.define(aliasTag, AliasDemo);

class AliasChild extends AliasDemo {
  protected static override deprecatedAliases: LyraDeprecatedAliases = { compact: ['size', (v) => (v ? 's' : 'm'), (v) => v === 's'] };

  @property({ reflect: true }) size = 'm';

  /** @deprecated */
  @property({ type: Boolean }) compact = false;
}
const childTag = tag('alias-child');
customElements.define(childTag, AliasChild);

const mount = <T extends HTMLElement>(markup: string): Promise<T> => fixture<T>(markup);

describe('deprecated alias sync', () => {
  it('initializes both sides without warning', async () => {
    const warnings = await captureDeprecationWarnings([], () => mount(`<${aliasTag}></${aliasTag}>`));
    expect(warnings.length).to.equal(0);
  });

  it('maps an inverted alias attribute onto the canonical property and warns once', async () => {
    let el!: AliasDemo;
    const warnings = await captureDeprecationWarnings(
      [{ tag: aliasTag, kind: 'property', name: 'closable' }],
      async () => {
        el = await mount<AliasDemo>(`<${aliasTag} closable="false"></${aliasTag}>`);
      },
    );
    expect(el.withoutCloseButton).to.equal(true);
    expect(el.hasAttribute('without-close-button')).to.equal(true);
    expect(warnings.map((w) => w.key)).to.deep.equal([`lyra-deprecated:${aliasTag}:property:closable`]);
  });

  it('keeps the alias reflecting the canonical state', async () => {
    const el = await mount<AliasDemo>(`<${aliasTag}></${aliasTag}>`);
    el.withoutCloseButton = true;
    await el.updateComplete;
    expect(el.closable).to.equal(false);
    expect(el.getAttribute('closable')).to.equal('false');
    el.withoutCloseButton = false;
    await el.updateComplete;
    expect(el.closable).to.equal(true);
    expect(el.hasAttribute('closable')).to.equal(false);
  });

  it('lets the last write win in either direction after the first render', async () => {
    const el = await mount<AliasDemo>(`<${aliasTag} with-legend></${aliasTag}>`);
    expect(el.legend).to.equal(true);
    await captureDeprecationWarnings([{ tag: aliasTag, kind: 'property', name: 'legend' }], async () => {
      el.removeAttribute('legend');
      await el.updateComplete;
    });
    expect(el.withLegend).to.equal(false);
    el.setAttribute('with-legend', '');
    await el.updateComplete;
    expect(el.legend).to.equal(true);
    expect(el.showLegend).to.equal(true);
  });

  it('syncs every alias of one canonical property', async () => {
    const el = await mount<AliasDemo>(`<${aliasTag}></${aliasTag}>`);
    await captureDeprecationWarnings([{ tag: aliasTag, kind: 'property', name: 'showLegend' }], async () => {
      el.showLegend = true;
      await el.updateComplete;
    });
    expect(el.withLegend).to.equal(true);
    expect(el.legend).to.equal(true);
  });

  it('adds a subclass table to the inherited one and applies value mappings', async () => {
    let el!: AliasChild;
    await captureDeprecationWarnings([{ tag: childTag, kind: 'property', name: 'closable' }], async () => {
      el = await mount<AliasChild>(`<${childTag} closable="false"></${childTag}>`);
    });
    expect(el.withoutCloseButton).to.equal(true);
    const warnings = await captureDeprecationWarnings(
      [{ tag: childTag, kind: 'property', name: 'compact' }],
      async () => {
        el.compact = true;
        await el.updateComplete;
      },
    );
    expect(el.size).to.equal('s');
    expect(warnings.length).to.equal(1);
    el.size = 'l';
    await el.updateComplete;
    expect(el.compact).to.equal(false);
  });

  it('warns for an authored alias attribute whose default is undefined', async () => {
    let el!: AliasDemo;
    const warnings = await captureDeprecationWarnings(
      [{ tag: aliasTag, kind: 'property', name: 'railWidthPx' }],
      async () => {
        el = await mount<AliasDemo>(`<${aliasTag} rail-width-px="200"></${aliasTag}>`);
      },
    );
    expect(el.railWidth).to.equal('200');
    expect(warnings.length).to.equal(1);
  });

  it('never warns for canonical writes', async () => {
    const el = await mount<AliasDemo>(`<${aliasTag}></${aliasTag}>`);
    const warnings = await captureDeprecationWarnings([], async () => {
      el.withoutCloseButton = true;
      el.withLegend = true;
      await el.updateComplete;
    });
    expect(warnings.length).to.equal(0);
  });
});

import { expect, fixture, html } from '@open-wc/testing';
import '../components/overlays/alert/alert.js';
import '../components/overlays/badge/badge.js';
import '../components/overlays/badge/tag.js';
import '../components/overlays/callout/callout.js';
import '../components/overlays/chip/chip.js';
import { effectiveSemanticVariant, semanticVariantConverter } from './semantic-variant.js';

describe('semantic variant vocabulary', () => {
  it('resolves primary to brand and unsupported values to neutral', () => {
    expect(effectiveSemanticVariant('primary')).to.equal('brand');
    expect(effectiveSemanticVariant('danger')).to.equal('danger');
    expect(effectiveSemanticVariant('loud')).to.equal('neutral');
    expect(effectiveSemanticVariant(undefined)).to.equal('neutral');
  });

  it('shares one accepted set and varies only the fallback', () => {
    for (const value of ['neutral', 'brand', 'primary', 'success', 'warning', 'danger']) {
      expect(semanticVariantConverter('neutral').normalize(value)).to.equal(value);
    }
    expect(semanticVariantConverter('brand').normalize('loud')).to.equal('brand');
  });

  it('is accepted by every labelled surface', async () => {
    const host = await fixture<HTMLElement>(html`
      <div>
        <lr-alert variant="brand"></lr-alert>
        <lr-chip variant="primary"></lr-chip>
        <lr-badge variant="primary"></lr-badge>
        <lr-tag variant="brand"></lr-tag>
        <lr-callout variant="primary"></lr-callout>
      </div>
    `);
    const [alert, chip, badge, tag, callout] = [...host.children] as Array<HTMLElement & { variant: string }>;
    expect(alert!.variant).to.equal('brand');
    expect(chip!.variant).to.equal('primary');
    expect(badge!.getAttribute('data-effective-variant')).to.equal('brand');
    expect(tag!.getAttribute('data-effective-variant')).to.equal('brand');
    expect(callout!.variant).to.equal('brand');
  });
});

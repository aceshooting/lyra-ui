import { expect, fixture, html } from '@open-wc/testing';
import { nativePopoverSupported } from './native-popover.js';
import {
  TOP_LAYER_ATTRIBUTE, ancestorZoom, applyReferenceHidden, compensateAncestorZoom,
  promoteToTopLayer, releaseTopLayer,
} from './top-layer-escape.js';

async function zoomedPopup() {
  const parent = await fixture<HTMLElement>(html`<div style="zoom:2"><div style="inline-size:40px;block-size:20px">Popup</div></div>`);
  const popup = parent.firstElementChild as HTMLElement;
  expect(popup.getClientRects().length).to.be.greaterThan(0);
  expect(ancestorZoom(popup)).to.be.closeTo(2, 0.001);
  return { parent, popup };
}

describe('top-layer style ownership boundaries', () => {
  it('retires its compensating zoom when the ancestor returns to normal scale', async () => {
    const { parent, popup } = await zoomedPopup();
    try {
      expect(compensateAncestorZoom(popup, null)).to.equal(true);
      expect(Number.parseFloat(popup.style.getPropertyValue('zoom'))).to.be.closeTo(0.5, 0.001);
      parent.style.setProperty('zoom', '1');
      expect(ancestorZoom(popup)).to.be.closeTo(1, 0.001);
      expect(compensateAncestorZoom(popup, null)).to.equal(true);
      expect(popup.style.getPropertyValue('zoom')).to.equal('');
      expect(compensateAncestorZoom(popup, null)).to.equal(false);
    } finally { releaseTopLayer(popup); }
  });

  it('leaves an authored inline zoom untouched instead of claiming it', async () => {
    const { popup } = await zoomedPopup();
    popup.style.setProperty('zoom', '0.75', 'important');
    try {
      expect(compensateAncestorZoom(popup, null)).to.equal(false);
      expect(popup.style.getPropertyValue('zoom')).to.equal('0.75');
      expect(popup.style.getPropertyPriority('zoom')).to.equal('important');
    } finally { releaseTopLayer(popup); }
    expect(popup.style.getPropertyValue('zoom')).to.equal('0.75');
    expect(popup.style.getPropertyPriority('zoom')).to.equal('important');
  });

  it('relinquishes a compensation that the application replaces and preserves it through release', async () => {
    const { parent, popup } = await zoomedPopup();
    try {
      expect(compensateAncestorZoom(popup, null)).to.equal(true);
      popup.style.setProperty('zoom', '0.75');
      expect(compensateAncestorZoom(popup, null)).to.equal(false);
      parent.style.setProperty('zoom', '3');
      expect(compensateAncestorZoom(popup, null)).to.equal(false);
      expect(popup.style.getPropertyValue('zoom')).to.equal('0.75');
    } finally { releaseTopLayer(popup); }
    expect(popup.style.getPropertyValue('zoom')).to.equal('0.75');
  });

  it('keeps reference-hidden ownership while important placement concealment temporarily wins', async () => {
    const popup = await fixture<HTMLElement>(html`<div>Popup</div>`);
    try {
      applyReferenceHidden(popup, true);
      expect(popup.style.getPropertyValue('visibility')).to.equal('hidden');
      popup.style.setProperty('visibility', 'hidden', 'important');
      applyReferenceHidden(popup, false);
      expect(popup.style.getPropertyValue('visibility')).to.equal('hidden');
      expect(popup.style.getPropertyPriority('visibility')).to.equal('important');
      popup.style.removeProperty('visibility');
      popup.style.setProperty('visibility', 'hidden');
      applyReferenceHidden(popup, false);
      expect(popup.style.getPropertyValue('visibility')).to.equal('');
      expect(getComputedStyle(popup).visibility).to.equal('visible');
    } finally { releaseTopLayer(popup); }
  });

  it('uses neutral ancestor scale for a connected element in a document without a body or browsing context', () => {
    const doc = document.implementation.createHTMLDocument('Inert surface');
    doc.body.remove();
    const popup = doc.createElement('div');
    doc.documentElement.append(popup);
    expect(popup.isConnected).to.equal(true);
    expect(doc.defaultView).to.equal(null);
    expect(doc.body).to.equal(null);
    expect(ancestorZoom(popup)).to.equal(1);
    expect(compensateAncestorZoom(popup, null)).to.equal(false);
    expect(popup.style.getPropertyValue('zoom')).to.equal('');
  });

  it('contains native promotion failure in an inactive document and restores the authored visibility', () => {
    const doc = document.implementation.createHTMLDocument('Inert surface');
    const popup = doc.createElement('div');
    popup.style.setProperty('visibility', 'collapse', 'important');
    doc.body.append(popup);
    expect(nativePopoverSupported()).to.equal(true);
    expect(popup.isConnected).to.equal(true);
    expect(typeof popup.showPopover).to.equal('function');
    try {
      expect(promoteToTopLayer(popup)).to.equal(false);
      expect(popup.hasAttribute('popover')).to.equal(false);
      expect(popup.hasAttribute(TOP_LAYER_ATTRIBUTE)).to.equal(false);
      expect(popup.style.getPropertyValue('visibility')).to.equal('collapse');
      expect(popup.style.getPropertyPriority('visibility')).to.equal('important');
    } finally { releaseTopLayer(popup); }
  });
});

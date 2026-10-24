import { expect } from '@open-wc/testing';
import { seriesPalette, translucentAreaColor } from './chart-colors.js';

describe('chart theme color resolution', () => {
  it('reads the document theme when no scope is given and the fallback ramp for a null scope', () => {
    const root = document.documentElement;
    const previous = root.style.getPropertyValue('--lr-color-chart-1');
    root.style.setProperty('--lr-color-chart-1', 'rgb(18, 52, 86)');
    try {
      const themed = seriesPalette();
      expect(themed).to.have.length(8);
      expect(themed[0]).to.equal('rgb(18, 52, 86)');
      expect(themed).to.deep.equal(seriesPalette(root));
      const fallback = seriesPalette(null);
      expect(fallback).to.have.length(8);
      expect(fallback[0]).not.to.equal(themed[0]);
    } finally {
      if (previous) root.style.setProperty('--lr-color-chart-1', previous);
      else root.style.removeProperty('--lr-color-chart-1');
    }
  });

  it('returns the requested colors unchanged where no style computation exists', () => {
    const scope = document.createElement('div');
    document.body.append(scope);
    const original = Object.getOwnPropertyDescriptor(window, 'getComputedStyle');
    try {
      Object.defineProperty(window, 'getComputedStyle', { configurable: true, writable: true, value: undefined });
      expect(translucentAreaColor(scope, 'rgb(10, 20, 30)')).to.equal('rgb(10, 20, 30)');
      expect(seriesPalette(scope)).to.deep.equal(seriesPalette(null));
    } finally {
      if (original) Object.defineProperty(window, 'getComputedStyle', original);
    }
    try {
      expect(translucentAreaColor(scope, 'rgb(10, 20, 30)')).not.to.equal('rgb(10, 20, 30)');
    } finally {
      scope.remove();
    }
  });
});

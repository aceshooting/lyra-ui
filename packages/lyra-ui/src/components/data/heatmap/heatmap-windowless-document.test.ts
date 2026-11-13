import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { LyraHeatmap } from './heatmap.js';

for (const initiallyWindowless of [false, true]) {
  it(`retains heatmap data when ${initiallyWindowless ? 'first connected' : 'adopted'} into a windowless document and paints on return`, async () => {
    const mount = await fixture<HTMLDivElement>(html`<div></div>`);
    const heatmap = document.createElement('lr-heatmap') as LyraHeatmap;
    heatmap.style.cssText = 'inline-size:480px;block-size:320px';
    heatmap.accessibleCells = true;
    heatmap.data = { kind: 'matrix', rowLabels: ['Before adoption'], colLabels: ['Value'], values: [[10]] };
    try {
      if (!initiallyWindowless) {
        mount.append(heatmap);
        await waitUntil(() => heatmap.exportData('png').startsWith('data:image/png'), 'initial heatmap did not paint');
      }
      const owner = document.implementation.createHTMLDocument('Matrix data editor');
      owner.body.append(owner.adoptNode(heatmap));
      await heatmap.updateComplete;
      heatmap.data = { kind: 'matrix', rowLabels: ['After adoption'], colLabels: ['Value'], values: [[20]] };
      await heatmap.updateComplete;
      expect(heatmap.ownerDocument.defaultView).to.equal(null);
      expect(heatmap.isConnected).to.equal(true);
      expect(heatmap.exportData('csv')).to.include('After adoption,Value,20');
      expect(heatmap.exportData('csv')).not.to.include('Before adoption');
      mount.append(document.adoptNode(heatmap));
      await heatmap.updateComplete;
      await waitUntil(() => heatmap.exportData('png').startsWith('data:image/png'), 'heatmap did not paint after adoption');
      expect(heatmap.exportData('csv')).to.include('After adoption,Value,20');
      await expect(heatmap).to.be.accessible();
    } finally { heatmap.remove(); }
  });
}

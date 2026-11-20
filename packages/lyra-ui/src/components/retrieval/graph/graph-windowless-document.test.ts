import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { LyraGraph } from '../../lr-graph.js';

for (const view of ['3d', 'list'] as const) for (const initiallyWindowless of [false, true]) {
  it(`retains ${view} graph data when ${initiallyWindowless ? 'first connected' : 'adopted'} into a windowless document`, async () => {
    const mount = await fixture<HTMLDivElement>(html`<div></div>`);
    const graph = document.createElement('lr-graph') as LyraGraph;
    graph.style.cssText = 'inline-size:480px;block-size:320px';
    graph.view = view;
    graph.nodeLabels = 'none';
    graph.camera = { yaw: 0, pitch: 0, distance: 300, target: { x: 0, y: 0, z: 0 } };
    graph.nodes = [{ id: 'before', label: 'Before adoption', position: { x: 0, y: 0, z: 0 }, color: '#ff0000' }];
    const position = { x: 10, y: 20, z: 30 };
    try {
      if (!initiallyWindowless) { mount.append(graph); await graph.updateComplete; }
      const owner = document.implementation.createHTMLDocument('Graph data editor');
      owner.body.append(owner.adoptNode(graph));
      await graph.updateComplete;
      graph.nodes = [{ id: 'after', label: 'After adoption', position, color: '#0000ff' }];
      await graph.updateComplete;
      expect(graph.isConnected).to.equal(true);
      expect(graph.ownerDocument.defaultView).to.equal(null);
      expect(graph.getNodePosition3d('after')).to.deep.equal(position);
      expect(graph.getNodePosition3d('before')).to.equal(undefined);
      mount.append(document.adoptNode(graph));
      await graph.updateComplete;
      if (view === 'list') {
        expect(graph.shadowRoot!.querySelector('[part="spatial-list"]')?.textContent).to.include('After adoption');
        expect(graph.shadowRoot!.querySelector('[part="spatial-list"]')?.textContent).not.to.include('Before adoption');
      } else {
        await waitUntil(() => {
          const canvas = graph.shadowRoot?.querySelector<HTMLCanvasElement>('[part="spatial-canvas"]');
          if (!canvas || canvas.width === 0 || canvas.height === 0) return false;
          const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
          for (let index = 0; index < pixels.length; index += 4) {
            if (pixels[index]! < 50 && pixels[index + 1]! < 50 && pixels[index + 2]! > 200 && pixels[index + 3]! > 200) return true;
          }
          return false;
        }, 'latest graph node was not painted after adoption', { timeout: 5_000 });
      }
      expect(graph.getNodePosition3d('after')).to.deep.equal(position);
      await expect(graph).to.be.accessible();
    } finally { graph.remove(); }
  });
}

it('resolves a canvas color through the owner document after adoption', async () => {
  const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
  const doc = frame.contentDocument!;
  const graph = document.createElement('lr-graph');
  doc.body.append(doc.adoptNode(graph));
  const probe = doc.createElement('span');
  graph.shadowRoot!.append(probe);
  const view = doc.defaultView!;
  const read = view.getComputedStyle.bind(view);
  let reads = 0;
  view.getComputedStyle = (...args) => { if (args[0] === probe) reads++; return read(...args); };
  try {
    const api = graph as unknown as {resolveCssColorWithProbe(value:string, probe:HTMLElement):string};
    expect(api.resolveCssColorWithProbe('red', probe)).to.equal('rgb(255, 0, 0)');
    expect(reads).to.equal(1);
  } finally { view.getComputedStyle = read; graph.remove(); }
});

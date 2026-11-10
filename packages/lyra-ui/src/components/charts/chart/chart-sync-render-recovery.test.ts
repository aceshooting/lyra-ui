import { expect, fixture, html } from '@open-wc/testing';
import { ChartSyncController, type ChartSyncPresentation } from './chart-sync.js';

async function synchronizedRenderers() {
  const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
  const view = frame.contentWindow!, doc = frame.contentDocument!;
  const requestFrame = view.requestAnimationFrame, cancelFrame = view.cancelAnimationFrame;
  const queued = new Map<number, FrameRequestCallback>(); let next = 0;
  view.requestAnimationFrame = callback => { const id = ++next; queued.set(id, callback); return id; };
  view.cancelAnimationFrame = id => { queued.delete(id); };
  const hosts = Array.from({ length: 3 }, () => {
    const host = doc.createElement('div'); host.style.width = '200px'; host.style.height = '100px';
    const root = host.attachShadow({ mode: 'open' });
    root.append(doc.createElement('div')); doc.body.append(host); return host;
  });
  const failed = new Set<number>(), resetFailures = new Set<number>();
  const resets: number[] = [];
  const controllers = hosts.map((host, index) => new ChartSyncController(host, label => {
    if (failed.has(index)) throw new Error('Renderer unavailable');
    return { container: host.shadowRoot!.firstElementChild as HTMLElement,
      x: 10, top: 0, height: 40, tooltip: { title: label, rows: ['Series'] },
    } satisfies ChartSyncPresentation;
  }, () => {
    resets.push(index);
    if (resetFailures.has(index)) throw new Error('Renderer reset unavailable');
  }));
  const tick = () => { const callbacks = [...queued.values()]; queued.clear(); for (const callback of callbacks) callback(0); };
  const shown = (index: number) => Boolean(hosts[index]!.shadowRoot!.querySelector('[part="sync-crosshair"]'));
  const tooltip = (index: number) => hosts[index]!.shadowRoot!.querySelector('[part="sync-tooltip"]')?.textContent ?? '';
  controllers.forEach(controller => { controller.update('render-failure', true); });
  const publish = (label: string, index: number) => { controllers[0]!.publish(label, index); tick(); };
  const dispose = () => {
    try { controllers.forEach(controller => { controller.disconnect(); }); }
    finally { view.requestAnimationFrame = requestFrame; view.cancelAnimationFrame = cancelFrame; }
  };
  return { hosts, controllers, failed, resetFailures, resets, tick, shown, tooltip, publish, dispose };
}

describe('synchronized chart renderer recovery', () => {
  for (const resetAlsoFails of [false, true]) {
    it(`keeps healthy peers current when one renderer ${resetAlsoFails ? 'and its reset fail' : 'fails'}`, async () => {
      const group = await synchronizedRenderers();
      try {
        group.publish('A', 0);
        expect([0, 1, 2].every(group.shown)).to.equal(true);
        group.failed.add(1);
        if (resetAlsoFails) group.resetFailures.add(1);
        expect(() => group.publish('B', 1)).not.to.throw();
        expect(group.shown(1)).to.equal(false);
        expect(group.resets).to.deep.equal([1]);
        for (const index of [0, 2]) expect(group.tooltip(index)).to.include('B');
        group.failed.clear(); group.resetFailures.clear();
        group.publish('B', 1);
        expect([0, 1, 2].every(index => group.tooltip(index).includes('B'))).to.equal(true);
      } finally { group.resetFailures.clear(); group.dispose(); }
    });
  }

  it('clears every cue when its source cannot render and accepts a later category', async () => {
    const group = await synchronizedRenderers();
    try {
      group.publish('A', 0); group.failed.add(0);
      expect(() => group.publish('B', 1)).not.to.throw();
      expect([0, 1, 2].some(group.shown)).to.equal(false);
      group.failed.clear(); group.publish('C', 2);
      expect([0, 1, 2].every(index => group.tooltip(index).includes('C'))).to.equal(true);
    } finally { group.dispose(); }
  });

  for (const rejoin of [false, true]) {
    it(`contains a renderer failure while ${rejoin ? 'rejoining' : 'refreshing'} the active group`, async () => {
      const group = await synchronizedRenderers();
      try {
        group.publish('A', 0);
        if (rejoin) group.controllers[1]!.disconnect();
        group.failed.add(1);
        expect(() => group.controllers[1]!.update('render-failure', true)).not.to.throw();
        expect(group.shown(1)).to.equal(false);
        for (const index of [0, 2]) expect(group.tooltip(index)).to.include('A');
        group.failed.clear(); group.controllers[1]!.update('render-failure', true);
        expect(group.tooltip(1)).to.include('A');
      } finally { group.dispose(); }
    });
  }

  for (const operation of ['clear', 'disconnect', 'disable'] as const) {
    it(`finishes ${operation} despite a renderer reset failure and does not retain its old cue`, async () => {
      const group = await synchronizedRenderers();
      try {
        group.publish('A', 0); group.resetFailures.add(0);
        expect(() => {
          if (operation === 'clear') group.controllers[0]!.clear();
          else if (operation === 'disconnect') group.controllers[0]!.disconnect();
          else group.controllers[0]!.update('', false);
        }).not.to.throw();
        expect([0, 1, 2].some(group.shown)).to.equal(false);
        expect(group.resets).to.deep.equal([0, 1, 2]);
        expect(group.controllers[0]!.enabled).to.equal(operation === 'clear');
        group.resetFailures.clear(); group.controllers[0]!.update('render-failure', true);
        group.publish('B', 1);
        expect([0, 1, 2].every(index => group.tooltip(index).includes('B'))).to.equal(true);
      } finally { group.resetFailures.clear(); group.dispose(); }
    });
  }
});

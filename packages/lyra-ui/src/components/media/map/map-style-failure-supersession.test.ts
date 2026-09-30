import { expect, oneEvent, waitUntil } from '@open-wc/testing';
import type { LyraMap, LyraMapInstance } from './map.class.js';
import './map.js';

const style = { version: 8 as const, sources: {}, layers: [] };
type StylePeer = LyraMapInstance & { setStyle(style: unknown): unknown };

async function liveMap(): Promise<LyraMap> {
  const element = document.createElement('lr-map') as LyraMap;
  element.style.cssText = 'width:320px;height:200px';
  element.mapStyle = style;
  const loaded = oneEvent(element, 'lr-map-load');
  document.body.append(element);
  await loaded;
  return element;
}

it('keeps the current peer style failure visible and permits a later retry', async function () {
  if (!webglAvailable()) this.skip();
  const element = await liveMap();
  const peer = element.map as StylePeer;
  const setStyle = peer.setStyle;
  try {
    peer.setStyle = () => { throw new Error('peer rejects the current style'); };
    element.mapStyle = { ...style, name: 'Rejected local style' };
    // A second failed request must remain observable even if an earlier failure was queued.
    await new Promise<void>((resolve) => queueMicrotask(() => {
      element.mapStyle = { ...style, name: 'Latest rejected local style' };
      resolve();
    }));
    await waitUntil(() => element.shadowRoot!.querySelectorAll('[part="error"]').length === 1);
    expect(element.map === undefined).to.equal(true);
    expect(element.shadowRoot!.querySelector('[part="error"]')!.textContent!.trim().length).to.be.greaterThan(0);
    peer.setStyle = setStyle;
    const loaded = oneEvent(element, 'lr-map-load');
    element.mapStyle = { ...style, name: 'Retried local style' };
    await loaded;
    expect(element.map !== undefined).to.equal(true);
    expect(element.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
  } finally {
    peer.setStyle = setStyle;
    element.remove();
  }
});

function webglAvailable(): boolean {
  const context = document.createElement('canvas').getContext('webgl2');
  context?.getExtension('WEBGL_lose_context')?.loseContext();
  return context !== null;
}

for (const reconnect of [false, true]) {
  it(`ignores a superseded peer style failure ${reconnect ? 'after reconnect' : 'on the current map'}`, async function () {
    if (!webglAvailable()) this.skip();
    const element = await liveMap();
    const peer = element.map as StylePeer;
    const setStyle = peer.setStyle;
    const restored = { ...style, name: 'Recovered local style' };
    let reconnected: Promise<Event> | undefined;
    try {
      peer.setStyle = () => { throw new Error('peer rejects the obsolete style'); };
      element.mapStyle = { ...style, name: 'Obsolete local style' };
      await new Promise<void>((resolve) => queueMicrotask(() => {
        peer.setStyle = setStyle;
        if (reconnect) {
          reconnected = oneEvent(element, 'lr-map-load');
          element.remove();
        }
        element.mapStyle = restored;
        if (reconnect) document.body.append(element);
        resolve();
      }));
      if (reconnected) await reconnected;
      await element.updateComplete;
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      expect(element.map !== undefined, 'the restored map remains live').to.equal(true);
      if (!reconnect) expect(element.map === peer, 'same-turn restoration retains the existing peer').to.equal(true);
      expect(element.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
    } finally {
      peer.setStyle = setStyle;
      element.remove();
    }
  });
}

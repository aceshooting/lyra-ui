import { expect, fixture, html } from '@open-wc/testing';
import './flow-canvas.js';
import type { LyraFlowCanvas } from './flow-canvas.js';
import { FlowCanvasCompanionController } from './flow-companion-controller.js';

interface CapableCanvas extends HTMLElement {
  registerCompanion(callback: (snapshot: unknown) => void): () => void;
}

function isCapable(element: HTMLElement): element is CapableCanvas {
  return typeof (element as Partial<CapableCanvas>).registerCompanion === 'function';
}

it('fails closed for an explicit absent or wrong-tag target instead of using an ancestor canvas', async () => {
  const canvas = (await fixture(html`
    <lr-flow-canvas>
      <span id="wrong-target"></span>
      <div id="companion-host"></div>
    </lr-flow-canvas>
  `)) as LyraFlowCanvas;
  const host = canvas.querySelector('#companion-host') as HTMLElement & { for: string };
  host.for = 'wrong-target';
  const targetIds: Array<string | null> = [];
  const controller = new FlowCanvasCompanionController(host, isCapable, (next) => targetIds.push(next?.id ?? null));

  controller.connect();
  expect(controller.target === null).to.be.true;
  expect(targetIds).to.deep.equal([]);

  host.for = 'missing-target';
  controller.targetIdChanged();
  expect(controller.target === null).to.be.true;
  controller.disconnect();
});

it('acquires and releases an explicit canvas when only its id changes', async () => {
  const root = (await fixture(html`
    <div>
      <lr-flow-canvas id="before"></lr-flow-canvas>
      <div id="companion-host"></div>
    </div>
  `)) as HTMLElement;
  const canvas = root.querySelector('lr-flow-canvas') as LyraFlowCanvas;
  const host = root.querySelector('#companion-host') as HTMLElement & { for: string };
  host.for = 'wanted';
  const targetIds: Array<string | null> = [];
  const controller = new FlowCanvasCompanionController(host, isCapable, (next) => targetIds.push(next?.id ?? null));
  controller.connect();
  expect(controller.target === null).to.be.true;

  canvas.id = 'wanted';
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(controller.target === canvas).to.be.true;

  canvas.id = 'after';
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(controller.target === null).to.be.true;
  expect(targetIds).to.deep.equal(['wanted', null]);
  controller.disconnect();
});

it('waits for late flow-canvas registration in the owner realm and retries capability resolution', async () => {
  const iframe = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
  const ownerDocument = iframe.contentDocument!;
  const ownerWindow = iframe.contentWindow!;
  const candidate = ownerDocument.createElement('lr-flow-canvas');
  candidate.id = 'late-canvas';
  const host = ownerDocument.createElement('div') as HTMLElement & { for: string };
  host.for = 'late-canvas';
  ownerDocument.body.append(candidate, host);
  const targetIds: Array<string | null> = [];
  const controller = new FlowCanvasCompanionController(host, isCapable, (next) => targetIds.push(next?.id ?? null));

  try {
    controller.connect();
    expect(controller.target === null).to.be.true;

    const OwnerHTMLElement = ownerWindow.HTMLElement;
    class LateFlowCanvas extends OwnerHTMLElement {
      registerCompanion(_callback: (snapshot: unknown) => void): () => void {
        return () => {};
      }
    }
    ownerWindow.customElements.define(
      'lr-flow-canvas',
      LateFlowCanvas as unknown as CustomElementConstructor,
    );
    await ownerWindow.customElements.whenDefined('lr-flow-canvas');
    await Promise.resolve();

    expect(controller.target === candidate).to.be.true;
    expect(targetIds).to.deep.equal(['late-canvas']);
  } finally {
    controller.disconnect();
    iframe.remove();
  }
});

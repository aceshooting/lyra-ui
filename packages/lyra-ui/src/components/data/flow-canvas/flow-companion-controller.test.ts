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
  const host = ownerDocument.createElement('div') as unknown as HTMLElement & {
    for: string;
  };
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

it('observes its root only while an explicit for target is set', async () => {
  const canvas = (await fixture(html`<lr-flow-canvas></lr-flow-canvas>`)) as LyraFlowCanvas;
  const host = document.createElement('div') as unknown as HTMLElement & { for: string };
  host.for = '';
  canvas.append(host);
  const observed: Node[] = [];
  const observe = MutationObserver.prototype.observe;
  MutationObserver.prototype.observe = function (this: MutationObserver, target: Node, options?: MutationObserverInit) {
    observed.push(target);
    return observe.call(this, target, options);
  };
  const controller = new FlowCanvasCompanionController(host, isCapable, () => {});
  try {
    controller.connect();
    expect([controller.target === canvas, observed.length]).to.deep.equal([true, 0]);
    host.for = 'elsewhere';
    controller.targetIdChanged();
    expect(observed.filter((node) => node === document).length).to.equal(1);
  } finally {
    controller.disconnect();
    MutationObserver.prototype.observe = observe;
  }
});

describe('FlowCanvasCompanionController stale continuations', () => {
  it('ignores an id change while its host is detached', () => {
    const host = document.createElement('div') as unknown as HTMLElement & { for: string };
    host.for = 'anything';
    let changes = 0;
    const controller = new FlowCanvasCompanionController(host, isCapable, () => { changes += 1; });
    controller.targetIdChanged();
    expect(controller.target === null).to.equal(true);
    expect(changes).to.equal(0);
  });

  const lateRegistration = async (move: (host: HTMLElement, doc: Document) => void) => {
    const iframe = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
    const doc = iframe.contentDocument!;
    const win = iframe.contentWindow!;
    const candidate = doc.createElement('lr-flow-canvas');
    candidate.id = 'late-canvas';
    const host = doc.createElement('div') as unknown as HTMLElement & { for: string };
    host.for = 'late-canvas';
    doc.body.append(candidate, host);
    const seen: Array<string | null> = [];
    const controller = new FlowCanvasCompanionController(host, isCapable, (next) => seen.push(next?.id ?? null));
    try {
      controller.connect();
      move(host, doc);
      class Late extends win.HTMLElement {
        registerCompanion(_callback: (snapshot: unknown) => void): () => void { return () => {}; }
      }
      win.customElements.define('lr-flow-canvas', Late as unknown as CustomElementConstructor);
      await win.customElements.whenDefined('lr-flow-canvas');
      await Promise.resolve();
      return { resolved: controller.target !== null, seen };
    } finally {
      controller.disconnect();
      iframe.remove();
    }
  };

  it('does not resolve a late registration for a host that was detached in the meantime', async () => {
    const outcome = await lateRegistration((host) => host.remove());
    expect(outcome).to.deep.equal({ resolved: false, seen: [] });
  });

  it('does not resolve a late registration for a host that moved to another root in the meantime', async () => {
    const outcome = await lateRegistration((host, doc) => {
      const shadowHost = doc.createElement('div');
      doc.body.append(shadowHost);
      shadowHost.attachShadow({ mode: 'open' }).append(host);
    });
    expect(outcome).to.deep.equal({ resolved: false, seen: [] });
  });

  for (const leave of ['detached', 'moved to another root'] as const) {
    it(`keeps its target when the observed root mutates after the host was ${leave}`, async () => {
      const root = (await fixture(html`
        <div>
          <lr-flow-canvas id="wanted"></lr-flow-canvas>
          <div id="companion-host"></div>
        </div>
      `)) as HTMLElement;
      const canvas = root.querySelector('lr-flow-canvas') as LyraFlowCanvas;
      const host = root.querySelector('#companion-host') as HTMLElement & { for: string };
      host.for = 'wanted';
      const seen: Array<string | null> = [];
      const controller = new FlowCanvasCompanionController(host, isCapable, (next) => seen.push(next?.id ?? null));
      try {
        controller.connect();
        expect(controller.target === canvas).to.equal(true);
        if (leave === 'detached') host.remove();
        else root.appendChild(document.createElement('div')).attachShadow({ mode: 'open' }).append(host);
        canvas.id = 'renamed';
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(controller.target === canvas).to.equal(true);
        expect(seen).to.deep.equal(['wanted']);
      } finally {
        controller.disconnect();
      }
    });
  }

  it('leaves an incapable candidate unresolved when the owner document has no window to wait on', () => {
    const inert = document.implementation.createHTMLDocument('inert');
    const candidate = inert.createElement('lr-flow-canvas');
    candidate.id = 'target';
    const host = inert.createElement('div') as unknown as HTMLElement & { for: string };
    host.for = 'target';
    inert.body.append(candidate, host);
    const seen: Array<string | null> = [];
    const controller = new FlowCanvasCompanionController(host, isCapable, (next) => seen.push(next?.id ?? null));
    controller.connect();
    expect(controller.target === null).to.equal(true);
    expect(seen).to.deep.equal([]);
    controller.disconnect();
  });
});

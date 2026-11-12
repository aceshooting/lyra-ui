import { expect, fixture, html } from '@open-wc/testing';
import { getActiveNativeModal } from './native-modal-context.js';

describe('native modal discovery fallbacks', () => {
  it('has no active modal without a document', () => {
    expect(getActiveNativeModal(null)).to.equal(null);
    expect(getActiveNativeModal(undefined)).to.equal(null);
  });

  it('uses native focused-dialog ancestry when hit testing is unavailable', async () => {
    const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
    const doc = frame.contentDocument!;
    doc.body.innerHTML = '<dialog><button id="inside">Inside</button></dialog>';
    const dialog = doc.querySelector('dialog')!;
    const original = Object.getOwnPropertyDescriptor(doc, 'elementFromPoint');
    dialog.showModal();
    try {
      expect(doc.activeElement?.id).to.equal('inside');
      Object.defineProperty(doc, 'elementFromPoint', { configurable: true, value: undefined });
      expect(getActiveNativeModal(doc) === dialog).to.equal(true);
    } finally {
      if (original) Object.defineProperty(doc, 'elementFromPoint', original);
      else Reflect.deleteProperty(doc, 'elementFromPoint');
      dialog.close();
    }
  });

  it('invalidates a cached dialog if native modal matching becomes unavailable', async () => {
    const dialog = await fixture<HTMLDialogElement>(html`<dialog><button>Inside</button></dialog>`);
    dialog.showModal();
    const original = Object.getOwnPropertyDescriptor(dialog, 'matches');
    try {
      expect(getActiveNativeModal(document) === dialog).to.equal(true);
      Object.defineProperty(dialog, 'matches', { configurable: true, value: () => { throw new DOMException('Unsupported selector', 'SyntaxError'); } });
      expect(getActiveNativeModal(document) === null).to.equal(true);
    } finally {
      if (original) Object.defineProperty(dialog, 'matches', original);
      else Reflect.deleteProperty(dialog, 'matches');
      dialog.close();
    }
    await Promise.resolve();
    dialog.showModal();
    try { expect(getActiveNativeModal(document) === dialog).to.equal(true); }
    finally { dialog.close(); }
  });

  for (const hit of ['absent', 'retargeted'] as const) {
    it(`uses focused shadow content when an inner hit test is ${hit}`, async () => {
      const host = await fixture<HTMLElement>(html`<div></div>`);
      const root = host.attachShadow({ mode: 'open' });
      root.innerHTML = '<dialog><button>Inside</button></dialog>';
      const dialog = root.querySelector('dialog')!;
      const originalDocumentHit = Object.getOwnPropertyDescriptor(document, 'elementFromPoint');
      const originalRootHit = Object.getOwnPropertyDescriptor(root, 'elementFromPoint');
      dialog.showModal();
      try {
        Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => host });
        Object.defineProperty(root, 'elementFromPoint', { configurable: true, value: hit === 'absent' ? undefined : () => host });
        expect(root.activeElement?.localName).to.equal('button');
        expect(getActiveNativeModal(document) === dialog).to.equal(true);
      } finally {
        if (originalDocumentHit) Object.defineProperty(document, 'elementFromPoint', originalDocumentHit);
        else Reflect.deleteProperty(document, 'elementFromPoint');
        if (originalRootHit) Object.defineProperty(root, 'elementFromPoint', originalRootHit);
        else Reflect.deleteProperty(root, 'elementFromPoint');
        dialog.close();
      }
    });
  }
});

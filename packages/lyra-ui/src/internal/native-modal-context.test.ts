import { expect, fixture, html } from '@open-wc/testing';
import { getActiveNativeModal, registerNativeModalContext } from './native-modal-context.js';

/** Counts `elementFromPoint` hit tests on `doc` while `run` executes synchronously. */
function countHitTests(doc: Document, run: () => void): number {
  const own = Object.getOwnPropertyDescriptor(doc, 'elementFromPoint');
  const original = doc.elementFromPoint;
  let calls = 0;
  Object.defineProperty(doc, 'elementFromPoint', {
    configurable: true,
    value(this: Document, x: number, y: number) {
      calls += 1;
      return original.call(this, x, y);
    },
  });
  try {
    run();
  } finally {
    if (own) Object.defineProperty(doc, 'elementFromPoint', own);
    else delete (doc as unknown as Record<string, unknown>)['elementFromPoint'];
  }
  return calls;
}

it('answers a burst of same-task callers with one probe', async () => {
  const root = await fixture<HTMLElement>(html`<div><dialog><button>Inside</button></dialog></div>`);
  const dialog = root.querySelector('dialog')!;
  dialog.showModal();
  try {
    // Start from a fresh task so no earlier probe is still remembered.
    await new Promise<void>((resolve) => setTimeout(resolve));
    let found = 0;
    const hitTests = countHitTests(document, () => {
      for (let index = 0; index < 20; index += 1) {
        if (getActiveNativeModal(document) === dialog) found += 1;
      }
    });
    expect(found, 'every caller still gets the active modal').to.equal(20);
    expect(hitTests, 'one probe, not one per caller').to.be.at.most(3);
  } finally {
    dialog.close();
  }
});

it('notices a modal opening and closing within the same task', async () => {
  const root = await fixture<HTMLElement>(html`
    <div><button id="outside">Outside</button><dialog><button>Inside</button></dialog></div>
  `);
  const outside = root.querySelector<HTMLButtonElement>('#outside')!;
  const dialog = root.querySelector('dialog')!;
  outside.focus();
  await new Promise<void>((resolve) => setTimeout(resolve));
  expect(getActiveNativeModal(document) === null, 'no modal yet').to.equal(true);
  dialog.showModal();
  expect(getActiveNativeModal(document) === dialog, 'the opened modal, in the same task').to.equal(true);
  dialog.close();
  expect(getActiveNativeModal(document) === null, 'gone again, in the same task').to.equal(true);
});

it('notices a library carrier that opens without moving focus', async () => {
  const root = await fixture<HTMLElement>(html`
    <div><button id="outside">Outside</button><dialog><button>Inside</button></dialog><span></span></div>
  `);
  const outside = root.querySelector<HTMLButtonElement>('#outside')!;
  const dialog = root.querySelector('dialog')!;
  const host = root.querySelector('span')!;
  outside.focus();
  await new Promise<void>((resolve) => setTimeout(resolve));
  expect(getActiveNativeModal(document) === null).to.equal(true);
  // A carrier keeps focus where it is by showing an inert dialog, then registers its context.
  const release = registerNativeModalContext(dialog, host);
  dialog.inert = true;
  dialog.showModal();
  dialog.inert = false;
  try {
    expect(getActiveNativeModal(document) === dialog).to.equal(true);
  } finally {
    release();
    dialog.close();
  }
  expect(getActiveNativeModal(document) === null).to.equal(true);
});

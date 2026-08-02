import { expect, fixture, html } from '@open-wc/testing';
import { describeElement, undescribeElement } from './aria-controls.js';

type Reflected = HTMLElement & { ariaDescribedByElements?: Element[] | null };

const supportsElementReferences = 'ariaDescribedByElements' in HTMLElement.prototype;

it('adds a same-root description through the serialized attribute', async () => {
  const el = await fixture<HTMLElement>(html`
    <div><button id="describe-target">Go</button><span id="describe-source">Details</span></div>
  `);
  const target = el.querySelector<HTMLElement>('#describe-target')!;
  const source = el.querySelector('#describe-source')!;

  const applied = describeElement(target, source);
  expect(target.getAttribute('aria-describedby')).to.equal('describe-source');
  expect(applied.assigned).to.be.false;

  undescribeElement(applied);
  expect(target.hasAttribute('aria-describedby')).to.be.false;
});

it('keeps the descriptions a target already had and restores them exactly', async () => {
  const el = await fixture<HTMLElement>(html`
    <div>
      <button id="describe-target-2" aria-describedby="describe-existing">Go</button>
      <span id="describe-existing">Existing</span>
      <span id="describe-source-2">Details</span>
    </div>
  `);
  const target = el.querySelector<HTMLElement>('#describe-target-2')!;
  const source = el.querySelector('#describe-source-2')!;

  const applied = describeElement(target, source);
  expect(target.getAttribute('aria-describedby')?.split(/\s+/)).to.have.members([
    'describe-existing',
    'describe-source-2',
  ]);

  undescribeElement(applied);
  expect(target.getAttribute('aria-describedby')).to.equal('describe-existing');
});

it('is a no-op when the description is already applied', async () => {
  const el = await fixture<HTMLElement>(html`
    <div><button id="describe-target-3" aria-describedby="describe-source-3">Go</button><span id="describe-source-3">D</span></div>
  `);
  const target = el.querySelector<HTMLElement>('#describe-target-3')!;
  const source = el.querySelector('#describe-source-3')!;

  const applied = describeElement(target, source);
  expect(applied.assigned).to.be.false;
  expect(target.getAttribute('aria-describedby')).to.equal('describe-source-3');
  undescribeElement(applied);
  expect(target.getAttribute('aria-describedby')).to.equal('describe-source-3');
});

it('crosses a shadow boundary through the element-reference list without dropping existing links', async () => {
  const tagName = 'test-aria-controls-described-host';
  if (!customElements.get(tagName)) {
    customElements.define(
      tagName,
      class extends HTMLElement {
        constructor() {
          super();
          this.attachShadow({ mode: 'open' }).innerHTML =
            '<button aria-describedby="inner-hint">Go</button><span id="inner-hint">Hint</span>';
        }
      },
    );
  }
  const el = await fixture<HTMLElement>(`<div>${`<${tagName}></${tagName}>`}<span id="outer-source">Details</span></div>`);
  const host = el.querySelector<HTMLElement>(tagName)!;
  const target = host.shadowRoot!.querySelector('button') as Reflected;
  const hint = host.shadowRoot!.querySelector('#inner-hint')!;
  const source = el.querySelector('#outer-source')!;

  const applied = describeElement(target, source);
  if (supportsElementReferences) {
    expect(applied.assigned).to.be.true;
    expect([...(target.ariaDescribedByElements ?? [])].map((node) => node.id)).to.have.members([
      'inner-hint',
      'outer-source',
    ]);
    // Assigning the element-reference list clears the serialized attribute by contract.
    expect(target.getAttribute('aria-describedby')).to.equal('');
  } else {
    expect(applied.assigned).to.be.false;
    expect(target.getAttribute('aria-describedby')?.split(/\s+/)).to.have.members(['inner-hint', 'outer-source']);
  }

  undescribeElement(applied);
  expect(target.getAttribute('aria-describedby')).to.equal('inner-hint');
  // Back to plain attribute reflection: the explicitly assigned list is gone.
  expect([...(target.ariaDescribedByElements ?? [hint])].map((node) => node.id)).to.deep.equal(['inner-hint']);
});

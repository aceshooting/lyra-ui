import { aTimeout, fixture, expect, html, oneEvent } from '@open-wc/testing';
import './mind-map.js';
import type { LyraMindMap, LyraTopic } from './mind-map.js';
import { styles } from './mind-map.styles.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

function sinkElement(): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`
  );
}

function sinkTexts(): string[] {
  return Array.from(sinkElement()?.children ?? []).map(
    (child) => child.textContent ?? ''
  );
}

const topics: LyraTopic[] = [
  {
    id: 'root',
    label: 'Knowledge Graph RAG',
    children: [
      { id: 'kg', label: 'Knowledge graphs' },
      {
        id: 'rag',
        label: 'Retrieval',
        children: [{ id: 'chunking', label: 'Chunking' }],
      },
    ],
  },
];

it('defaults to empty topics, an unset label, expandDepth=1', async () => {
  const el = (await fixture(html`<lr-mind-map></lr-mind-map>`)) as LyraMindMap;
  expect(el.topics).to.deep.equal([]);
  expect(el.label).to.be.undefined;
  expect(el.expandDepth).to.equal(1);
});

it('renders one [part="node"] per visible topic -- root plus its expandDepth-1 children', async () => {
  const el = (await fixture(html`<lr-mind-map></lr-mind-map>`)) as LyraMindMap;
  el.topics = topics;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="node"]').length).to.equal(3); // root + kg + rag; chunking stays collapsed
});

it('emits lr-topic-select when a leaf node is clicked', async () => {
  const el = (await fixture(html`<lr-mind-map></lr-mind-map>`)) as LyraMindMap;
  el.topics = topics;
  await el.updateComplete;
  const kgNode = [...el.shadowRoot!.querySelectorAll('[part="node"]')].find(
    (n) => n.textContent?.includes('Knowledge graphs')
  )!;
  const listener = oneEvent(el, 'lr-topic-select');
  kgNode.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  const event = await listener;
  expect(event.detail).to.deep.equal({ topicId: 'kg' });
});

it('keeps compact node pointer targets at the 40px floor and activates through the focus-ring annulus', async () => {
  const dense = (await fixture(
    html`<lr-mind-map
      style="inline-size: 320px; block-size: 320px"
    ></lr-mind-map>`
  )) as LyraMindMap;
  dense.topics = Array.from({ length: 20 }, (_, index) => ({
    id: `topic-${index}`,
    label: `T${index}`,
  }));
  await dense.updateComplete;

  const denseHits = [
    ...dense.shadowRoot!.querySelectorAll<SVGLineElement>('.node-hit'),
  ];
  expect(
    denseHits.length,
    'the hub and every short-label topic have a private hit target'
  ).to.equal(21);
  for (const hit of denseHits) {
    expect(
      hit.hasAttribute('part'),
      'the hit target remains an implementation detail'
    ).to.equal(false);
    expect(
      hit.getAttribute('aria-hidden'),
      'the hit target is not duplicated for assistive technology'
    ).to.equal('true');
    expect(
      hit.getAttribute('vector-effect'),
      'the target is measured in rendered pixels'
    ).to.equal('non-scaling-stroke');
    expect(
      Number.parseFloat(getComputedStyle(hit).strokeWidth),
      'the target diameter'
    ).to.be.at.least(40);
  }

  const el = (await fixture(
    html`<lr-mind-map
      style="inline-size: 120px; block-size: 120px"
    ></lr-mind-map>`
  )) as LyraMindMap;
  el.topics = [{ id: 'tiny', label: 'T' }];
  await el.updateComplete;
  const hit = el.shadowRoot!.querySelector<SVGLineElement>('.node-hit')!;
  const svg = el.shadowRoot!.querySelector<SVGSVGElement>('[part="svg"]')!;
  svg.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  const focusRing = el.shadowRoot!.querySelector<SVGCircleElement>(
    '[part="focus-ring"]'
  )!;
  const selected: string[] = [];
  el.addEventListener('lr-topic-select', (event) =>
    selected.push((event as CustomEvent<{ topicId: string }>).detail.topicId)
  );

  el.scrollIntoView({ block: 'center', inline: 'center' });
  await aTimeout(0);
  const matrix = hit.getScreenCTM()!;
  const center = new DOMPoint(0, 0).matrixTransform(matrix);
  const ringMatrix = focusRing.getScreenCTM()!;
  const ringCenter = new DOMPoint(
    focusRing.cx.baseVal.value,
    focusRing.cy.baseVal.value
  ).matrixTransform(ringMatrix);
  const ringRadius =
    focusRing.r.baseVal.value * Math.hypot(ringMatrix.a, ringMatrix.b);
  try {
    await resetMouse();
    await sendMouse({
      type: 'click',
      position: [Math.round(center.x + 18), Math.round(center.y)],
    });
    await sendMouse({
      type: 'click',
      position: [Math.round(center.x), Math.round(center.y + 18)],
    });
    await sendMouse({
      type: 'click',
      position: [
        Math.round(ringCenter.x + ringRadius),
        Math.round(ringCenter.y),
      ],
    });
    expect(
      selected,
      'target edges and the focus-ring annulus activate the compact node'
    ).to.deep.equal(['tiny', 'tiny', 'tiny']);
  } finally {
    await resetMouse();
  }
});

it('emits lr-topic-toggle when a parent node is clicked, and reveals its children', async () => {
  const el = (await fixture(html`<lr-mind-map></lr-mind-map>`)) as LyraMindMap;
  el.topics = topics;
  await el.updateComplete;
  const ragNode = [...el.shadowRoot!.querySelectorAll('[part="node"]')].find(
    (n) => n.textContent?.includes('Retrieval')
  )!;
  const listener = oneEvent(el, 'lr-topic-toggle');
  ragNode.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  const event = await listener;
  expect(event.detail).to.deep.equal({ topicId: 'rag', expanded: true });
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="node"]').length).to.equal(4); // chunking now visible
});

it('wraps multiple root topics in an implicit hub labeled from the label property', async () => {
  const el = (await fixture(
    html`<lr-mind-map label="My Topics"></lr-mind-map>`
  )) as LyraMindMap;
  el.topics = [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
  ];
  await el.updateComplete;
  const labels = [
    ...el.shadowRoot!.querySelectorAll('[part="node-label"]'),
  ].map((n) => n.textContent);
  expect(labels).to.include('My Topics');
});

it('keyboard: ArrowDown descends into children, auto-expanding a collapsed parent', async () => {
  const el = (await fixture(html`<lr-mind-map></lr-mind-map>`)) as LyraMindMap;
  el.topics = topics;
  await el.updateComplete;
  const svg = el.shadowRoot!.querySelector('[part="svg"]')!;

  svg.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    })
  ); // focus root
  await el.updateComplete;
  svg.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    })
  ); // descend to root's first child (kg)
  await el.updateComplete;
  svg.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true,
    })
  ); // move to next sibling (rag)
  await el.updateComplete;

  const listener = oneEvent(el, 'lr-topic-toggle');
  svg.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    })
  ); // rag is collapsed -- auto-expands
  const event = await listener;
  expect(event.detail).to.deep.equal({ topicId: 'rag', expanded: true });
});

it('ignores a non-navigation key', async () => {
  const el = (await fixture(html`<lr-mind-map></lr-mind-map>`)) as LyraMindMap;
  el.topics = topics;
  await el.updateComplete;
  const svg = el.shadowRoot!.querySelector('[part="svg"]')!;
  const focusedId = () =>
    (el as unknown as { focusedId: string | null }).focusedId;
  expect(focusedId()).to.equal(null);
  svg.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true })
  );
  await el.updateComplete;
  expect(focusedId()).to.equal(null);
});

it('ignores a navigation key once every topic has been removed (defensive, via a retained svg reference)', async () => {
  const el = (await fixture(html`<lr-mind-map></lr-mind-map>`)) as LyraMindMap;
  el.topics = topics;
  await el.updateComplete;
  const svg = el.shadowRoot!.querySelector('[part="svg"]')!;
  el.topics = [];
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelector('[part="svg"]') === null,
    'the empty state replaced the svg'
  ).to.equal(true);
  expect(() =>
    svg.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true,
        cancelable: true,
      })
    )
  ).to.not.throw();
});

it('ignores a navigation key when the focused id does not match any placed node (defensive)', async () => {
  const el = (await fixture(html`<lr-mind-map></lr-mind-map>`)) as LyraMindMap;
  el.topics = topics;
  await el.updateComplete;
  const svg = el.shadowRoot!.querySelector('[part="svg"]')!;
  (el as unknown as { focusedId: string | null }).focusedId =
    'not-a-real-topic-id';
  expect(() =>
    svg.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true,
        cancelable: true,
      })
    )
  ).to.not.throw();
  expect((el as unknown as { focusedId: string | null }).focusedId).to.equal(
    'not-a-real-topic-id'
  );
});

it('ArrowDown on a leaf node is a no-op -- there are no children to descend into', async () => {
  const el = (await fixture(html`<lr-mind-map></lr-mind-map>`)) as LyraMindMap;
  el.topics = topics;
  await el.updateComplete;
  const svg = el.shadowRoot!.querySelector('[part="svg"]')!;
  const focusedId = () =>
    (el as unknown as { focusedId: string | null }).focusedId;

  svg.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    })
  ); // focus root
  await el.updateComplete;
  svg.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    })
  ); // descend to kg, a leaf
  await el.updateComplete;
  expect(focusedId()).to.equal('kg');

  svg.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    })
  ); // no children -- no-op
  await el.updateComplete;
  expect(focusedId()).to.equal('kg');
});

it('adoptedCallback is a no-op when no announcement sink was ever acquired', () => {
  const el = document.createElement('lr-mind-map') as LyraMindMap;
  expect(() => el.adoptedCallback()).to.not.throw();
});

it('keyboard: ArrowUp moves focus to the parent, and is a no-op at the root', async () => {
  const el = (await fixture(html`<lr-mind-map></lr-mind-map>`)) as LyraMindMap;
  el.topics = topics;
  await el.updateComplete;
  const svg = el.shadowRoot!.querySelector('[part="svg"]')!;
  const focusedId = () =>
    (el as unknown as { focusedId: string | null }).focusedId;

  svg.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    })
  ); // focus root
  await el.updateComplete;
  expect(focusedId()).to.equal('root');
  svg.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowUp',
      bubbles: true,
      cancelable: true,
    })
  ); // root has no parent -- no-op
  await el.updateComplete;
  expect(focusedId()).to.equal('root');

  svg.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    })
  ); // descend to kg
  await el.updateComplete;
  expect(focusedId()).to.equal('kg');
  svg.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowUp',
      bubbles: true,
      cancelable: true,
    })
  ); // back up to its parent
  await el.updateComplete;
  expect(focusedId()).to.equal('root');
});

it('keyboard: ArrowLeft moves to the previous sibling, Home/End jump to the first/last sibling', async () => {
  const el = (await fixture(html`<lr-mind-map></lr-mind-map>`)) as LyraMindMap;
  el.topics = topics;
  await el.updateComplete;
  const svg = el.shadowRoot!.querySelector('[part="svg"]')!;
  const focusedId = () =>
    (el as unknown as { focusedId: string | null }).focusedId;

  svg.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    })
  ); // focus root
  await el.updateComplete;
  svg.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    })
  ); // descend to kg (first child)
  await el.updateComplete;
  expect(focusedId()).to.equal('kg');

  svg.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'End',
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect(focusedId()).to.equal('rag');

  svg.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect(focusedId()).to.equal('kg');

  svg.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Home',
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect(focusedId()).to.equal('kg');
});

it('keyboard: Enter/Space activates the focused node -- select on a leaf, toggle (incl. collapse) on a parent', async () => {
  const el = (await fixture(html`<lr-mind-map></lr-mind-map>`)) as LyraMindMap;
  el.topics = topics;
  await el.updateComplete;
  const svg = el.shadowRoot!.querySelector('[part="svg"]')!;

  svg.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    })
  ); // focus root
  await el.updateComplete;
  svg.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    })
  ); // descend to kg, a leaf
  await el.updateComplete;

  const selectListener = oneEvent(el, 'lr-topic-select');
  svg.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    })
  );
  const selectEvent = await selectListener;
  expect(selectEvent.detail).to.deep.equal({ topicId: 'kg' });

  svg.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowUp',
      bubbles: true,
      cancelable: true,
    })
  ); // back to root, a parent
  await el.updateComplete;
  const toggleListener = oneEvent(el, 'lr-topic-toggle');
  svg.dispatchEvent(
    new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })
  );
  const toggleEvent = await toggleListener;
  // root starts expanded (depth 0 < the default expandDepth 1) -- Space collapses it.
  expect(toggleEvent.detail).to.deep.equal({
    topicId: 'root',
    expanded: false,
  });
});

it('mirrors sibling navigation under dir="rtl", where ArrowLeft becomes "forward"', async () => {
  const el = (await fixture(
    html`<lr-mind-map dir="rtl"></lr-mind-map>`
  )) as LyraMindMap;
  el.topics = topics;
  await el.updateComplete;
  const svg = el.shadowRoot!.querySelector('[part="svg"]')!;
  const focusedId = () =>
    (el as unknown as { focusedId: string | null }).focusedId;

  svg.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    })
  ); // focus root
  await el.updateComplete;
  svg.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    })
  ); // descend to kg
  await el.updateComplete;
  expect(focusedId()).to.equal('kg');

  svg.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      bubbles: true,
      cancelable: true,
    })
  ); // RTL "forward"
  await el.updateComplete;
  expect(focusedId()).to.equal('rag');

  // link connectors render fine, exercising the mirrored connector control point under RTL.
  expect(
    el.shadowRoot!.querySelectorAll('[part="link"]').length
  ).to.be.greaterThan(0);
});

it('does not re-invalidate layout when dir is reassigned the same value', async () => {
  const el = (await fixture(
    html`<lr-mind-map dir="rtl"></lr-mind-map>`
  )) as LyraMindMap;
  el.topics = topics;
  await el.updateComplete;
  const internals = el as unknown as { relayout(): void };
  const original = internals.relayout.bind(el);
  let calls = 0;
  internals.relayout = () => {
    calls++;
    original();
  };
  el.setAttribute('dir', 'rtl'); // identical value -- attributeChangedCallback's oldValue !== value guard must no-op
  await el.updateComplete;
  expect(
    calls,
    'reassigning the same dir value must not trigger a relayout'
  ).to.equal(0);
});

it('draws the focus ring as soon as the widget takes focus, before any arrow key is pressed', async () => {
  const el = (await fixture(
    html`<lr-mind-map .topics=${topics}></lr-mind-map>`
  )) as LyraMindMap;
  const svg = el.shadowRoot!.querySelector<SVGSVGElement>('[part="svg"]')!;
  expect(
    el.shadowRoot!.querySelectorAll('[part="focus-ring"]').length,
    'no ring before focus'
  ).to.equal(0);

  svg.focus();
  await el.updateComplete;

  expect(
    el.shadowRoot!.querySelectorAll('[part="focus-ring"]').length,
    'a bare Tab into the single tab stop must show a visible focus state'
  ).to.equal(1);
  expect((el as unknown as { focusedId: string | null }).focusedId).to.equal(
    'root'
  );
});

it('leaves an already-established keyboard cursor alone when focus re-enters the widget', async () => {
  const el = (await fixture(
    html`<lr-mind-map .topics=${topics}></lr-mind-map>`
  )) as LyraMindMap;
  const svg = el.shadowRoot!.querySelector<SVGSVGElement>('[part="svg"]')!;
  svg.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    })
  ); // focus root
  await el.updateComplete;
  svg.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    })
  ); // descend to kg
  await el.updateComplete;
  expect((el as unknown as { focusedId: string | null }).focusedId).to.equal(
    'kg'
  );

  svg.focus();
  await el.updateComplete;
  expect(
    (el as unknown as { focusedId: string | null }).focusedId,
    'refocusing must not reset the cursor'
  ).to.equal('kg');
});

it('has a single [part="svg"] tab stop, not per-node tabbing', async () => {
  const el = (await fixture(html`<lr-mind-map></lr-mind-map>`)) as LyraMindMap;
  el.topics = topics;
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelector('[part="svg"]')!.getAttribute('tabindex')
  ).to.equal('0');
  el.shadowRoot!.querySelectorAll('[part="node"]').forEach(
    (n) => expect(n.hasAttribute('tabindex')).to.be.false
  );
});

it('reads --lr-transition-base for node-position transitions (collapses to near-zero under reduced motion globally)', async () => {
  const el = (await fixture(
    html`<lr-mind-map style="--lr-transition-base: 42ms linear"></lr-mind-map>`
  )) as LyraMindMap;
  el.topics = topics;
  await el.updateComplete;
  const g = el.shadowRoot!.querySelector('[part="node"]') as SVGGElement;
  expect(getComputedStyle(g).transitionDuration).to.equal('0.042s');
});

it('shows the noData empty state when topics is empty', async () => {
  const el = (await fixture(html`<lr-mind-map></lr-mind-map>`)) as LyraMindMap;
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelector('[part="empty"]')!.textContent
  ).to.include('No data');
});

it('normalizes a NaN expandDepth instead of silently collapsing every ring (falls back to the default of 1)', async () => {
  const el = (await fixture(html`<lr-mind-map></lr-mind-map>`)) as LyraMindMap;
  el.topics = topics;
  el.expandDepth = NaN;
  await el.updateComplete;
  // A raw NaN would make every `depth < expandDepth` comparison false, collapsing even the root's
  // own children -- guarded, it must render the same as the default expandDepth=1 (root + 2 children).
  expect(el.shadowRoot!.querySelectorAll('[part="node"]').length).to.equal(3);
});

it('resolves the default svg accessible name through a .strings override for mindMapLabel when label is unset', async () => {
  // label stays unset (never assigned), so the `this.label == null ? this.localize(...) :
  // this.label` aria-label must fall through to the .strings/registry path.
  const el = (await fixture(
    html`<lr-mind-map
      .strings=${{ mindMapLabel: 'Carte mentale' }}
    ></lr-mind-map>`
  )) as LyraMindMap;
  el.topics = topics;
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelector('[part="svg"]')!.getAttribute('aria-label')
  ).to.equal('Carte mentale');
});

it('keeps an explicitly empty label genuinely empty instead of falling back to the localized default', async () => {
  const el = (await fixture(
    html`<lr-mind-map
      label=""
      .strings=${{ mindMapLabel: 'Carte mentale' }}
    ></lr-mind-map>`
  )) as LyraMindMap;
  el.topics = topics;
  await el.updateComplete;
  expect(el.label).to.equal('');
  expect(
    el.shadowRoot!.querySelector('[part="svg"]')!.getAttribute('aria-label')
  ).to.equal('');
});

it('keeps explicit-empty and dynamic host naming distinct from the SVG, tree, and implicit hub', async () => {
  const roots: LyraTopic[] = [
    { id: 'research', label: 'Research' },
    { id: 'sources', label: 'Sources' },
  ];
  const el = (await fixture(
    html`<lr-mind-map
      label="Knowledge topics"
      aria-label=""
      .topics=${roots}
    ></lr-mind-map>`
  )) as LyraMindMap;
  const svg = () => el.shadowRoot!.querySelector<SVGElement>('[part="svg"]')!;
  const tree = () =>
    el.shadowRoot!.querySelector<HTMLElement>('[role="tree"]')!;
  const nodeLabels = () =>
    Array.from(
      el.shadowRoot!.querySelectorAll<SVGTextElement>('[part="node-label"]')
    ).map((node) => node.textContent ?? '');

  expect(el.hasAttribute('aria-label')).to.equal(true);
  expect(el.getAttribute('aria-label')).to.equal('');
  expect(svg().getAttribute('aria-label')).to.equal('Knowledge topics');
  expect(tree().getAttribute('aria-label')).to.equal(null);
  expect(nodeLabels()).to.include('Knowledge topics');

  el.setAttribute('aria-label', 'Author map');
  await el.updateComplete;
  expect(el.getAttribute('aria-label')).to.equal('Author map');
  expect(svg().getAttribute('aria-label')).to.equal('Knowledge topics');
  expect(tree().getAttribute('aria-label')).to.equal(null);
  expect(nodeLabels()).to.include('Knowledge topics');

  el.removeAttribute('aria-label');
  await el.updateComplete;
  expect(el.getAttribute('aria-label')).to.equal(null);
  expect(svg().getAttribute('aria-label')).to.equal('Knowledge topics');
  expect(tree().getAttribute('aria-label')).to.equal(null);
  expect(nodeLabels()).to.include('Knowledge topics');
});

it('is accessible with an expanded, multi-level tree', async () => {
  const el = (await fixture(
    html`<lr-mind-map expand-depth="2"></lr-mind-map>`
  )) as LyraMindMap;
  el.topics = topics;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('exposes the visible topic hierarchy as a nested ARIA tree', async () => {
  const el = (await fixture(
    html`<lr-mind-map expand-depth="2" .topics=${topics}></lr-mind-map>`
  )) as LyraMindMap;
  const tree = el.shadowRoot!.querySelector('[role="tree"]')!;
  const root = tree.querySelector(':scope > [role="treeitem"]')!;
  expect(root.textContent).to.include('Knowledge Graph RAG');
  expect(root.getAttribute('aria-level')).to.equal('1');
  expect(root.getAttribute('aria-expanded')).to.equal('true');
  const group = root.querySelector(':scope > [role="group"]')!;
  expect(group.querySelectorAll(':scope > [role="treeitem"]').length).to.equal(
    2
  );
});

it('announces keyboard focus through light DOM while retaining a non-live shadow description', async () => {
  const el = (await fixture(
    html`<lr-mind-map .topics=${topics}></lr-mind-map>`
  )) as LyraMindMap;
  const svg = el.shadowRoot!.querySelector('[part="svg"]')!;
  svg.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;

  const mirror = el.shadowRoot!.querySelector('[part="live-region"]')!;
  expect(mirror.textContent).to.include('Knowledge Graph RAG');
  expect(mirror.getAttribute('role')).to.equal(null);
  expect(mirror.getAttribute('aria-live')).to.equal(null);
  expect(mirror.hasAttribute('aria-hidden')).to.equal(false);
  expect(svg.getAttribute('aria-describedby')).to.equal(mirror.id);
  expect(sinkTexts().at(-1)).to.include('Knowledge Graph RAG');
});

it('releases and reacquires its shared announcement sink across disconnect and reconnect', async () => {
  const el = (await fixture(html`<lr-mind-map></lr-mind-map>`)) as LyraMindMap;
  expect(sinkElement() !== null).to.be.true;
  el.remove();
  expect(sinkElement() === null).to.be.true;
  document.body.append(el);
  expect(sinkElement() !== null).to.be.true;
  el.remove();
  expect(sinkElement() === null).to.be.true;
});

it('rebinds resize observation and its coalesced frame to the adopted owner realm', async () => {
  const el = (await fixture(
    html`<lr-mind-map .topics=${topics}></lr-mind-map>`
  )) as LyraMindMap;
  await el.updateComplete;
  el.remove();
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  const frameDocument = iframe.contentDocument;
  const frameWindow = iframe.contentWindow;
  if (!frameDocument || !frameWindow) {
    iframe.remove();
    throw new Error('The iframe realm was unavailable.');
  }
  const originalResizeObserver = frameWindow.ResizeObserver;
  const originalRequestAnimationFrame = frameWindow.requestAnimationFrame;
  const originalCancelAnimationFrame = frameWindow.cancelAnimationFrame;
  let resizeCallback: ResizeObserverCallback | undefined;
  let observerDisconnects = 0;
  const frames = new Map<number, FrameRequestCallback>();
  const cancelledFrames: number[] = [];
  class OwnerResizeObserver implements ResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      resizeCallback = callback;
    }
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {
      observerDisconnects += 1;
    }
  }
  frameWindow.ResizeObserver = OwnerResizeObserver;
  frameWindow.requestAnimationFrame = ((
    callback: FrameRequestCallback
  ): number => {
    frames.set(44, callback);
    return 44;
  }) as typeof frameWindow.requestAnimationFrame;
  frameWindow.cancelAnimationFrame = ((handle: number): void => {
    cancelledFrames.push(handle);
    frames.delete(handle);
  }) as typeof frameWindow.cancelAnimationFrame;

  try {
    frameDocument.body.append(frameDocument.adoptNode(el));
    expect(
      resizeCallback,
      'the destination window constructs the resize observer'
    ).to.be.a('function');
    resizeCallback!(
      [
        {
          contentRect: { width: 333, height: 222 },
        } as unknown as ResizeObserverEntry,
      ],
      {} as ResizeObserver
    );
    const staleFrame = frames.get(44);
    expect(
      staleFrame,
      'the resize callback schedules through its owner window'
    ).to.be.a('function');

    document.adoptNode(el);
    expect(
      observerDisconnects,
      'adoption disconnects the old observer'
    ).to.equal(1);
    expect(
      cancelledFrames,
      'adoption cancels through the scheduling window'
    ).to.deep.equal([44]);
    let updateCalls = 0;
    el.requestUpdate = () => {
      updateCalls += 1;
    };
    staleFrame!(0);
    expect(
      updateCalls,
      'a stale old-realm frame cannot update the adopted element'
    ).to.equal(0);
  } finally {
    frameWindow.ResizeObserver = originalResizeObserver;
    frameWindow.requestAnimationFrame = originalRequestAnimationFrame;
    frameWindow.cancelAnimationFrame = originalCancelAnimationFrame;
    if (el.ownerDocument !== document) document.adoptNode(el);
    el.remove();
    iframe.remove();
  }
});

it('resolves token units through the adopted owner realm', async () => {
  const el = (await fixture(html`<lr-mind-map></lr-mind-map>`)) as LyraMindMap;
  el.remove();
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  const frameDocument = iframe.contentDocument;
  const frameWindow = iframe.contentWindow;
  if (!frameDocument || !frameWindow) {
    iframe.remove();
    throw new Error('The iframe realm was unavailable.');
  }
  const originalGetComputedStyle = window.getComputedStyle;
  const originalFrameGetComputedStyle = frameWindow.getComputedStyle;
  let destinationStyleReads = 0;
  window.getComputedStyle = (() => {
    throw new Error(
      'The originating realm must not resolve styles for an adopted element.'
    );
  }) as typeof window.getComputedStyle;
  frameWindow.getComputedStyle = ((element: Element) => {
    destinationStyleReads += 1;
    return {
      fontSize: element === frameDocument.documentElement ? '11px' : '13px',
      getPropertyValue: (name: string) =>
        name === '--lr-mind-map-ring-gap' ? '2rem' : '',
    } as CSSStyleDeclaration;
  }) as typeof frameWindow.getComputedStyle;

  try {
    frameDocument.adoptNode(el);
    const internals = el as unknown as { ringGapPx(): number };
    expect(internals.ringGapPx()).to.equal(22);
    expect(destinationStyleReads).to.equal(2);
  } finally {
    window.getComputedStyle = originalGetComputedStyle;
    frameWindow.getComputedStyle = originalFrameGetComputedStyle;
    if (el.ownerDocument !== document) document.adoptNode(el);
    el.remove();
    iframe.remove();
  }
});

it('leaves the resize observer unarmed when connectedCallback runs while not part of a document', () => {
  const el = document.createElement('lr-mind-map') as LyraMindMap;
  const OriginalResizeObserver = window.ResizeObserver;
  let constructions = 0;
  class CountingResizeObserver {
    constructor() {
      constructions += 1;
    }
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  (
    window as unknown as { ResizeObserver: typeof ResizeObserver }
  ).ResizeObserver = CountingResizeObserver as unknown as typeof ResizeObserver;
  try {
    expect(() => el.connectedCallback()).to.not.throw();
    expect(
      constructions,
      'a disconnected element must not construct a resize observer'
    ).to.equal(0);
  } finally {
    el.disconnectedCallback(); // release the announcement sink acquired above
    (
      window as unknown as { ResizeObserver: typeof ResizeObserver }
    ).ResizeObserver = OriginalResizeObserver;
  }
});

it('renders without a resize observer when ResizeObserver is unavailable in the realm', async () => {
  const OriginalResizeObserver = window.ResizeObserver;
  (
    window as unknown as { ResizeObserver?: typeof ResizeObserver }
  ).ResizeObserver = undefined;
  try {
    const el = (await fixture(
      html`<lr-mind-map></lr-mind-map>`
    )) as LyraMindMap;
    el.topics = topics;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="node"]').length).to.equal(3);
  } finally {
    window.ResizeObserver = OriginalResizeObserver;
  }
});

it('does not construct a second resize observer when connectedCallback re-runs for the same realm', async () => {
  const OriginalResizeObserver = window.ResizeObserver;
  let constructions = 0;
  class CountingResizeObserver {
    constructor() {
      constructions += 1;
    }
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  (
    window as unknown as { ResizeObserver: typeof ResizeObserver }
  ).ResizeObserver = CountingResizeObserver as unknown as typeof ResizeObserver;
  try {
    const el = (await fixture(
      html`<lr-mind-map></lr-mind-map>`
    )) as LyraMindMap;
    expect(constructions).to.equal(1);
    el.connectedCallback(); // re-entrant call while already connected to the same document
    expect(
      constructions,
      'the same document must not re-arm a second observer'
    ).to.equal(1);
  } finally {
    (
      window as unknown as { ResizeObserver: typeof ResizeObserver }
    ).ResizeObserver = OriginalResizeObserver;
  }
});

it('ignores a stale ResizeObserver notification received after disconnect', async () => {
  const OriginalResizeObserver = window.ResizeObserver;
  const originalRaf = window.requestAnimationFrame;
  let notify: ResizeObserverCallback | undefined;
  class StubResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      notify = callback;
    }
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  (
    window as unknown as { ResizeObserver: typeof ResizeObserver }
  ).ResizeObserver = StubResizeObserver as unknown as typeof ResizeObserver;
  let rafCalls = 0;
  window.requestAnimationFrame = ((callback: FrameRequestCallback): number => {
    rafCalls += 1;
    return originalRaf(callback);
  }) as typeof window.requestAnimationFrame;
  try {
    const el = (await fixture(
      html`<lr-mind-map></lr-mind-map>`
    )) as LyraMindMap;
    expect(notify, 'a resize observer was armed').to.be.a('function');
    el.remove(); // disconnect bumps the realm generation and flips isConnected
    notify!(
      [
        {
          contentRect: { width: 10, height: 10 },
        } as unknown as ResizeObserverEntry,
      ],
      {} as ResizeObserver
    );
    expect(
      rafCalls,
      'a stale post-disconnect notification must not schedule a relayout frame'
    ).to.equal(0);
  } finally {
    window.requestAnimationFrame = originalRaf;
    (
      window as unknown as { ResizeObserver: typeof ResizeObserver }
    ).ResizeObserver = OriginalResizeObserver;
  }
});

it('coalesces rapid resize notifications and skips a no-op repeat with an unchanged content rect', async () => {
  const OriginalResizeObserver = window.ResizeObserver;
  const originalRaf = window.requestAnimationFrame;
  const originalCaf = window.cancelAnimationFrame;
  let notify: ResizeObserverCallback | undefined;
  class StubResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      notify = callback;
    }
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  let rafCalls = 0;
  let nextHandle = 100;
  const cancelled: number[] = [];
  (
    window as unknown as { ResizeObserver: typeof ResizeObserver }
  ).ResizeObserver = StubResizeObserver as unknown as typeof ResizeObserver;
  window.requestAnimationFrame = (() => {
    rafCalls += 1;
    return nextHandle++;
  }) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = ((handle: number): void => {
    cancelled.push(handle);
  }) as typeof window.cancelAnimationFrame;
  try {
    const el = (await fixture(
      html`<lr-mind-map></lr-mind-map>`
    )) as LyraMindMap;
    expect(notify, 'a resize observer was armed').to.be.a('function');

    notify!([], {} as ResizeObserver); // no entry -- the optional-chained contentRect falls back to ''
    expect(rafCalls).to.equal(1);

    notify!(
      [
        {
          contentRect: { width: 50, height: 20 },
        } as unknown as ResizeObserverEntry,
      ],
      {} as ResizeObserver
    );
    expect(rafCalls).to.equal(2);
    expect(
      cancelled.length,
      'the still-pending frame from the previous notification is cancelled'
    ).to.equal(1);

    notify!(
      [
        {
          contentRect: { width: 50, height: 20 },
        } as unknown as ResizeObserverEntry,
      ],
      {} as ResizeObserver
    );
    expect(
      rafCalls,
      'an unchanged content rect is a no-op, scheduling no new frame'
    ).to.equal(2);
    expect(cancelled.length).to.equal(1);

    notify!(
      [
        {
          contentRect: { width: 90, height: 40 },
        } as unknown as ResizeObserverEntry,
      ],
      {} as ResizeObserver
    );
    expect(rafCalls).to.equal(3);
    expect(cancelled.length).to.equal(2);
  } finally {
    window.requestAnimationFrame = originalRaf;
    window.cancelAnimationFrame = originalCaf;
    (
      window as unknown as { ResizeObserver: typeof ResizeObserver }
    ).ResizeObserver = OriginalResizeObserver;
  }
});

it('reconciles keyboard focus when the focused topic disappears', async () => {
  const el = (await fixture(
    html`<lr-mind-map .topics=${topics}></lr-mind-map>`
  )) as LyraMindMap;
  const svg = el.shadowRoot!.querySelector('[part="svg"]')!;
  svg.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    })
  );
  svg.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect((el as unknown as { focusedId: string | null }).focusedId).to.equal(
    'kg'
  );
  el.topics = [
    {
      ...topics[0]!,
      children: topics[0]!.children!.filter((topic) => topic.id !== 'kg'),
    },
  ];
  await el.updateComplete;
  expect((el as unknown as { focusedId: string | null }).focusedId).to.equal(
    'root'
  );
});

it('clears the focused id when every topic is removed while a node is focused', async () => {
  const el = (await fixture(
    html`<lr-mind-map .topics=${topics}></lr-mind-map>`
  )) as LyraMindMap;
  const svg = el.shadowRoot!.querySelector('[part="svg"]')!;
  svg.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect((el as unknown as { focusedId: string | null }).focusedId).to.equal(
    'root'
  );
  el.topics = [];
  await el.updateComplete;
  expect((el as unknown as { focusedId: string | null }).focusedId).to.equal(
    null
  );
});

it('does not recompute the O(n) radial layout for focus-only keyboard updates', async () => {
  const el = (await fixture(
    html`<lr-mind-map .topics=${topics}></lr-mind-map>`
  )) as LyraMindMap;
  const internals = el as unknown as { relayout(): void };
  const original = internals.relayout.bind(el);
  let calls = 0;
  internals.relayout = () => {
    calls++;
    original();
  };
  el.shadowRoot!.querySelector('[part="svg"]')!.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect(calls).to.equal(0);
});

it('recomputes the implicit hub when locale strings change after mount', async () => {
  const el = (await fixture(
    html`<lr-mind-map
      .topics=${[
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ]}
    ></lr-mind-map>`
  )) as LyraMindMap;
  expect(
    el.shadowRoot!.querySelector('[part="node-label"]')!.textContent
  ).to.equal('Mind map');
  el.strings = { mindMapLabel: 'Carte mentale' };
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelector('[part="node-label"]')!.textContent
  ).to.equal('Carte mentale');
});

it('recomputes token-derived geometry when its allocation changes', async () => {
  const OriginalResizeObserver = window.ResizeObserver;
  let notify: ResizeObserverCallback | undefined;
  class TestResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      notify = callback;
    }
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  (
    window as unknown as { ResizeObserver: typeof ResizeObserver }
  ).ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver;
  try {
    const el = (await fixture(
      html`<lr-mind-map .topics=${topics}></lr-mind-map>`
    )) as LyraMindMap;
    const beforeRoot = nodePosition(el, 'Knowledge Graph RAG');
    const beforeChild = nodePosition(el, 'Knowledge graphs');
    const before = Math.hypot(
      beforeChild.x - beforeRoot.x,
      beforeChild.y - beforeRoot.y
    );
    el.style.setProperty('--lr-mind-map-ring-gap', '8rem');
    expect(typeof notify).to.equal('function');
    notify!(
      [
        {
          contentRect: { width: 321, height: 240 },
        } as unknown as ResizeObserverEntry,
      ],
      {} as ResizeObserver
    );
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve())
    );
    await el.updateComplete;
    const afterRoot = nodePosition(el, 'Knowledge Graph RAG');
    const afterChild = nodePosition(el, 'Knowledge graphs');
    const after = Math.hypot(
      afterChild.x - afterRoot.x,
      afterChild.y - afterRoot.y
    );
    expect(after).to.be.greaterThan(before);
  } finally {
    (
      window as unknown as { ResizeObserver: typeof ResizeObserver }
    ).ResizeObserver = OriginalResizeObserver;
  }
});

function nodePosition(
  el: LyraMindMap,
  labelSubstring: string
): { x: number; y: number } {
  const nodeEl = [...el.shadowRoot!.querySelectorAll('[part="node"]')].find(
    (n) => n.textContent?.includes(labelSubstring)
  )!;
  const match = nodeEl
    .getAttribute('style')!
    .match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/)!;
  return { x: parseFloat(match[1]!), y: parseFloat(match[2]!) };
}

it("reads a live root font-size for a rem-unit --lr-mind-map-ring-gap, matching lr-table's own minimumResizeWidth() rem-to-px fix", async () => {
  const originalFontSize = document.documentElement.style.fontSize;
  document.documentElement.style.fontSize = '32px';
  try {
    const el = (await fixture(
      html`<lr-mind-map .topics=${topics}></lr-mind-map>`
    )) as LyraMindMap;
    await el.updateComplete;
    const root = nodePosition(el, 'Knowledge Graph RAG');
    const child = nodePosition(el, 'Knowledge graphs'); // a depth-1 ring node, one ringGap away
    const distance = Math.hypot(child.x - root.x, child.y - root.y);
    // Default --lr-mind-map-ring-gap is 6rem; at a 32px root font-size that's 192px. A hardcoded
    // `* 16` multiplier would instead produce 96px regardless of the live root font-size.
    expect(distance).to.be.closeTo(192, 0.5);
  } finally {
    document.documentElement.style.fontSize = originalFontSize;
  }
});

it('falls back to the default ring gap for a non-numeric --lr-mind-map-ring-gap', async () => {
  const el = (await fixture(
    html`<lr-mind-map
      style="--lr-mind-map-ring-gap: not-a-number"
      .topics=${topics}
    ></lr-mind-map>`
  )) as LyraMindMap;
  await el.updateComplete;
  const root = nodePosition(el, 'Knowledge Graph RAG');
  const child = nodePosition(el, 'Knowledge graphs');
  const distance = Math.hypot(child.x - root.x, child.y - root.y);
  expect(distance).to.be.closeTo(96, 0.5); // parseFloat(...) is NaN -> DEFAULT_RING_GAP_PX
});

it('resolves a case-insensitive REM unit against the live root font size, not as raw pixels', async () => {
  const originalFontSize = document.documentElement.style.fontSize;
  document.documentElement.style.fontSize = '32px';
  try {
    const el = (await fixture(
      html`<lr-mind-map
        style="--lr-mind-map-ring-gap: 6REM"
        .topics=${topics}
      ></lr-mind-map>`
    )) as LyraMindMap;
    await el.updateComplete;
    const root = nodePosition(el, 'Knowledge Graph RAG');
    const child = nodePosition(el, 'Knowledge graphs');
    const distance = Math.hypot(child.x - root.x, child.y - root.y);
    // CSS units are case-insensitive. A lowercase-only unit test would read '6REM' as a bare
    // number and space the ring 6px from the hub instead of 6 * the live 32px root font size.
    expect(distance).to.be.closeTo(192, 0.5);
  } finally {
    document.documentElement.style.fontSize = originalFontSize;
  }
});

it('falls back to the default ring gap for a unit with no resolvable pixel length, instead of reading it as pixels', async () => {
  const el = (await fixture(
    html`<lr-mind-map
      style="--lr-mind-map-ring-gap: 6pt"
      .topics=${topics}
    ></lr-mind-map>`
  )) as LyraMindMap;
  await el.updateComplete;
  const root = nodePosition(el, 'Knowledge Graph RAG');
  const child = nodePosition(el, 'Knowledge graphs');
  const distance = Math.hypot(child.x - root.x, child.y - root.y);
  // A number-plus-unrecognized-unit value must not collapse to its bare number (6px would put
  // every ring node practically on top of the hub); the documented default applies instead.
  expect(distance).to.be.closeTo(96, 0.5);
});

it('uses a plain px --lr-mind-map-ring-gap value directly, without unit conversion', async () => {
  const el = (await fixture(
    html`<lr-mind-map
      style="--lr-mind-map-ring-gap: 40px"
      .topics=${topics}
    ></lr-mind-map>`
  )) as LyraMindMap;
  await el.updateComplete;
  const root = nodePosition(el, 'Knowledge Graph RAG');
  const child = nodePosition(el, 'Knowledge graphs');
  const distance = Math.hypot(child.x - root.x, child.y - root.y);
  expect(distance).to.be.closeTo(40, 0.5);
});

it('resolves an em-unit --lr-mind-map-ring-gap against the live host font-size', async () => {
  const el = (await fixture(
    html`<lr-mind-map
      style="--lr-mind-map-ring-gap: 3em"
      .topics=${topics}
    ></lr-mind-map>`
  )) as LyraMindMap;
  await el.updateComplete;
  const root = nodePosition(el, 'Knowledge Graph RAG');
  const child = nodePosition(el, 'Knowledge graphs');
  const distance = Math.hypot(child.x - root.x, child.y - root.y);
  expect(distance).to.be.closeTo(48, 0.5); // 3 * the default 16px host font-size
});

it('resolves an em-unit ring gap against the root font size when the host has no readable font-size', async () => {
  const el = (await fixture(html`<lr-mind-map></lr-mind-map>`)) as LyraMindMap;
  el.topics = topics;
  await el.updateComplete;
  const rootFontSize = Number.parseFloat(
    getComputedStyle(document.documentElement).fontSize
  );
  const originalGetComputedStyle = window.getComputedStyle;
  window.getComputedStyle = ((element: Element) => {
    if (element === el) {
      return {
        fontSize: '',
        getPropertyValue: (name: string) =>
          name === '--lr-mind-map-ring-gap' ? '2em' : '',
      } as CSSStyleDeclaration;
    }
    return originalGetComputedStyle(element);
  }) as typeof window.getComputedStyle;
  try {
    const internals = el as unknown as { ringGapPx(): number };
    // An element with no computed font-size of its own inherits the document root's, so an `em`
    // length anchors there rather than discarding the authored gap -- the shared resolveCssLength()
    // contract every unit-resolving component in the library now follows.
    expect(internals.ringGapPx()).to.equal(2 * rootFontSize);
  } finally {
    window.getComputedStyle = originalGetComputedStyle;
  }
});

it('resolves ringGapPx via inline style, not computed style, when the realm has no window', async () => {
  const el = (await fixture(html`<lr-mind-map></lr-mind-map>`)) as LyraMindMap;
  const detached = document.implementation.createHTMLDocument('detached');
  try {
    detached.adoptNode(el);
    expect(
      detached.defaultView,
      'a document.implementation document has no browsing context'
    ).to.equal(null);
    const internals = el as unknown as { ringGapPx(): number };
    // this.style has no --lr-mind-map-ring-gap set (only the component's own stylesheet does, and
    // computed-style resolution is skipped entirely without a window) -> raw is empty -> the
    // DEFAULT_RING_GAP_PX fallback.
    expect(internals.ringGapPx()).to.equal(96);
  } finally {
    document.adoptNode(el);
  }
});

it('falls back to the default ring gap when a rem-unit gap cannot resolve a root font-size in a windowless realm', async () => {
  const el = (await fixture(
    html`<lr-mind-map style="--lr-mind-map-ring-gap: 3rem"></lr-mind-map>`
  )) as LyraMindMap;
  const detached = document.implementation.createHTMLDocument('detached');
  try {
    detached.adoptNode(el);
    const internals = el as unknown as { ringGapPx(): number };
    // ownerWindow is null, so the root-style lookup falls back to the detached document's own
    // <html> element's inline style, whose font-size is unset -> NaN -> DEFAULT_RING_GAP_PX.
    expect(internals.ringGapPx()).to.equal(96);
  } finally {
    document.adoptNode(el);
  }
});

describe('lifecycle super calls', () => {
  it('calls super.willUpdate() (regression guard: a future mixin layered under LyraMindMap must still run)', async () => {
    const el = (await fixture(
      html`<lr-mind-map></lr-mind-map>`
    )) as LyraMindMap;
    // The immediate prototype of an instance is LyraElement.prototype -- the exact object
    // `super.willUpdate()` resolves against from inside this component's own override.
    const proto = Object.getPrototypeOf(Object.getPrototypeOf(el)) as Record<
      string,
      unknown
    >;
    const originalWillUpdate = proto.willUpdate as
      | ((changed: unknown) => void)
      | undefined;
    let willUpdateCalls = 0;
    proto.willUpdate = function (this: unknown, changed: unknown) {
      willUpdateCalls++;
      return originalWillUpdate?.call(this, changed);
    };
    try {
      el.topics = topics;
      await el.updateComplete;
      expect(willUpdateCalls).to.be.greaterThan(0);
    } finally {
      delete proto.willUpdate;
    }
  });
});

describe('hover feedback on [part="node"]', () => {
  // :hover cannot be synthesized in this test runner (no real pointer), so per this repo's
  // documented exception for genuinely-unsynthesizable pseudo-classes, this asserts against the
  // stylesheet source instead of a rendered/computed effect.
  it("declares a [part='node']:hover rule, giving mouse users the same 'clickable' feedback keyboard users get from the drawn focus ring", () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/\[part=["']node["']\]:hover/);
  });
});

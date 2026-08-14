import { expect, fixture, html } from '@open-wc/testing';
import {
  composedAccessibilityText,
  composedAccessibilityTextResult,
} from './announcement-text.js';

function normalizedText(node: Node): string {
  return composedAccessibilityText(node).replace(/\s+/g, ' ').trim();
}

it('walks an open shadow tree and flattened slots without leaking unassigned light DOM', async () => {
  const container = (await fixture(html`<div></div>`)) as HTMLDivElement;
  const host = document.createElement('div');
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <span>Rendered shadow text</span>
    <slot><span>Unrendered fallback</span></slot>
    <script>Script leak</script>
    <style>Style leak</style>
    <template>Template leak</template>
  `;
  const assigned = document.createElement('span');
  assigned.textContent = 'Rendered assigned text';
  const unassigned = document.createElement('span');
  unassigned.slot = 'missing';
  unassigned.textContent = 'Unassigned named-slot leak';
  host.append(assigned, unassigned);
  container.append(host);

  expect(normalizedText(host)).to.equal('Rendered shadow text Rendered assigned text');

  assigned.hidden = true;
  expect(
    normalizedText(host),
    'a hidden direct assignment suppresses the slot fallback instead of revealing it',
  ).to.equal('Rendered shadow text');
});

it('reports only open shadow roots reached by the bounded composed walk', async () => {
  const container = await fixture<HTMLDivElement>(html`<div></div>`);
  const outerHost = document.createElement('div');
  const outerShadow = outerHost.attachShadow({ mode: 'open' });
  const nestedHost = document.createElement('span');
  const nestedShadow = nestedHost.attachShadow({ mode: 'open' });
  nestedShadow.textContent = 'Nested shadow text';
  outerShadow.append(nestedHost);
  container.append(outerHost);

  const complete = composedAccessibilityTextResult(outerHost, {
    skipRootAncestorValidation: true,
  });
  expect(complete.traversedShadowRoots.has(outerShadow)).to.equal(true);
  expect(complete.traversedShadowRoots.has(nestedShadow)).to.equal(true);
  expect(complete.traversedShadowRoots.size).to.equal(2);

  const bounded = composedAccessibilityTextResult(outerHost, {
    maxNodes: 1,
    skipRootAncestorValidation: true,
  });
  expect(bounded.traversedShadowRoots.has(outerShadow)).to.equal(true);
  expect(bounded.traversedShadowRoots.has(nestedShadow)).to.equal(false);
  expect(bounded.traversedShadowRoots.size).to.equal(1);
  expect(bounded.truncationReasons).to.include('nodes');

  const supplied = composedAccessibilityTextResult(nestedShadow, {
    skipRootAncestorValidation: true,
  });
  expect(supplied.traversedShadowRoots.has(nestedShadow)).to.equal(true);
  expect(supplied.traversedShadowRoots.size).to.equal(1);
});

it('uses only a closed details summary and includes image alternative text', async () => {
  const root = await fixture(html`
    <div>
      <details>
        <summary>Collapsed summary <img alt="summary diagram" /></summary>
        <p>Collapsed body leak</p>
      </details>
      <img alt="standalone diagram" />
      <details open>
        <summary>Open summary</summary>
        <p>Open body</p>
      </details>
    </div>
  `);

  expect(normalizedText(root)).to.equal(
    'Collapsed summary summary diagram standalone diagram Open summary Open body',
  );

  root.querySelector('details')!.open = true;
  expect(normalizedText(root)).to.equal(
    'Collapsed summary summary diagram Collapsed body leak standalone diagram Open summary Open body',
  );
});

it('uses owner-realm styles and lets visibility-visible descendants re-enter hidden text', async () => {
  const iframe = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
  const ownerDocument = iframe.contentDocument!;
  const root = ownerDocument.createElement('div');
  root.innerHTML = `
    <span style="visibility: hidden">
      Hidden wrapper text
      <span style="visibility: visible">Visible override</span>
    </span>
    <span aria-hidden=" TRUE ">ARIA-hidden leak</span>
    <span style="display: none">Display-hidden leak</span>
  `;
  ownerDocument.body.append(root);

  expect(normalizedText(root)).to.equal('Visible override');
});

it('walks a deeply nested composed label iteratively without overflowing the call stack', async () => {
  const root = await fixture<HTMLDivElement>(html`<div></div>`);
  let parent: Element = root;
  for (let index = 0; index < 5_000; index += 1) {
    const child = root.ownerDocument.createElement('span');
    parent.append(child);
    parent = child;
  }
  parent.textContent = 'deep label';

  const result = composedAccessibilityTextResult(root, {
    maxCharacters: 128,
    maxDepth: 128,
    maxNodes: 512,
  });

  expect(result.truncated).to.equal(true);
  expect(result.truncationReasons).to.include('depth');
  expect(result.visitedNodes).to.be.at.most(512);
});

it('shares one node and character budget across every supplied root', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`
    <div><span>First label that is deliberately long</span><span>Second label</span></div>
  `);
  const result = composedAccessibilityTextResult(wrapper.childNodes, {
    maxCharacters: 12,
    maxDepth: 32,
    maxNodes: 3,
    skipRootAncestorValidation: true,
  });

  expect(result.text.length).to.be.at.most(12);
  expect(result.visitedNodes).to.be.at.most(3);
  expect(result.truncated).to.equal(true);
  expect(result.truncationReasons).to.include('characters');
});

it('processes each supplied root before spending work on later-root validation', async () => {
  const parent = await fixture<HTMLDivElement>(html`
    <div><span id="first-root">First</span><span id="later-root">Later</span></div>
  `);
  const result = composedAccessibilityTextResult([
    parent.querySelector('#first-root')!,
    parent.querySelector('#later-root')!,
  ], {
    ancestorBoundary: parent,
    maxNodes: 3,
  });

  expect(result.text).to.equal('First');
  expect(result.truncationReasons).to.include('nodes');
});

it('inherits composed visibility for a directly supplied Text root', async () => {
  const parent = await fixture<HTMLDivElement>(html`
    <div style="visibility: hidden">HIDDEN-TEXT</div>
  `);

  expect(composedAccessibilityTextResult(parent.firstChild!).text).to.equal('');
  expect(composedAccessibilityTextResult(parent).text).to.equal('');
});

it('spends a tight node budget in composed pre-order instead of reserving it for later siblings', async () => {
  const root = await fixture<HTMLDivElement>(html`
    <div><span>First reachable label</span><span>Later label</span></div>
  `);
  const result = composedAccessibilityTextResult(root, {
    maxNodes: 3,
    skipRootAncestorValidation: true,
  });

  expect(result.text.trim()).to.equal('First reachable label');
  expect(result.visitedNodes).to.equal(3);
  expect(result.truncationReasons).to.include('nodes');
});

it('uses same-root aria-labelledby before aria-label and visible rich content', async () => {
  const root = await fixture<HTMLDivElement>(html`
    <div>
      <span id="authoritative-name"><img alt="Authoritative diagram" /></span>
      <button aria-labelledby="authoritative-name" aria-label="Fallback name">Visible fallback</button>
    </div>
  `);
  const button = root.querySelector('button')!;

  expect(normalizedText(button)).to.equal('Authoritative diagram');
});

it('rejects a supplied Text root from the content branch of closed details', async () => {
  const details = await fixture<HTMLDetailsElement>(html`
    <details><summary>Summary</summary>Leaked direct text</details>
  `);
  const text = [...details.childNodes].find(
    (node) => node.nodeType === 3 && node.textContent?.includes('Leaked'),
  )!;

  expect(composedAccessibilityTextResult(text).text).to.equal('');
});

it('performs no node, ancestor, or consumer-predicate work with a zero node budget', async () => {
  const root = await fixture<HTMLElement>(html`<div><span>Label</span></div>`);
  let predicateCalls = 0;
  const result = composedAccessibilityTextResult(root, {
    isSubtreeExcluded: () => {
      predicateCalls += 1;
      return false;
    },
    maxNodes: 0,
    shouldPruneNode: () => {
      predicateCalls += 1;
      return false;
    },
  });

  expect(result.text).to.equal('');
  expect(result.visitedNodes).to.equal(0);
  expect(result.truncationReasons).to.include('nodes');
  expect(predicateCalls).to.equal(0);
});

it('charges repeated supplied-root ancestor validation to the shared node-work budget', async () => {
  const outer = await fixture<HTMLElement>(html`<div></div>`);
  let parent = outer;
  for (let depth = 0; depth < 64; depth += 1) {
    const child = document.createElement('div');
    parent.append(child);
    parent = child;
  }
  const roots: Text[] = [];
  for (let index = 0; index < 100; index += 1) {
    const text = document.createTextNode(`label-${index}`);
    parent.append(text);
    roots.push(text);
  }
  let ancestorChecks = 0;
  const result = composedAccessibilityTextResult(roots, {
    isSubtreeExcluded: () => {
      ancestorChecks += 1;
      return false;
    },
    maxDepth: 128,
    maxNodes: 100,
  });

  expect(result.truncationReasons).to.include('nodes');
  expect(ancestorChecks).to.be.at.most(100);
});

it('does not fall through from a budget-truncated authoritative aria-labelledby', async () => {
  const root = await fixture<HTMLElement>(html`
    <div><span id="bounded-authoritative">Authoritative</span><button aria-labelledby="bounded-authoritative" aria-label="Fallback">Visible</button></div>
  `);
  const button = root.querySelector('button')!;
  const result = composedAccessibilityTextResult(button, {
    maxNodes: 1,
    skipRootAncestorValidation: true,
  });

  expect(result.text).to.equal('');
  expect(result.truncationReasons).to.include('nodes');
});

it('does not materialize reflected labelled-by elements after its work budget is exhausted', async () => {
  const root = await fixture<HTMLElement>(html`
    <div><span id="bounded-reflection">Authoritative</span><button aria-labelledby="bounded-reflection" aria-label="Fallback"></button></div>
  `);
  const button = root.querySelector<HTMLButtonElement>('button')!;
  let reflectedReads = 0;
  Object.defineProperty(button, 'ariaLabelledByElements', {
    configurable: true,
    get: () => {
      reflectedReads += 1;
      return [root.querySelector('#bounded-reflection')!];
    },
  });

  const result = composedAccessibilityTextResult(button, {
    maxNodes: 1,
    skipRootAncestorValidation: true,
  });

  expect(result.text).to.equal('');
  expect(result.truncationReasons).to.include('nodes');
  expect(reflectedReads).to.equal(0);
});

it('charges reflected labelled-by access before invoking a potentially unbounded getter', async () => {
  const root = await fixture<HTMLElement>(html`
    <div><span id="reflected-label">Authoritative</span><button aria-labelledby="" aria-label="Fallback"></button></div>
  `);
  const label = root.querySelector('#reflected-label')!;
  const button = root.querySelector<HTMLButtonElement>('button')!;
  let reflectedReads = 0;
  Object.defineProperty(button, 'ariaLabelledByElements', {
    configurable: true,
    get: () => {
      reflectedReads += 1;
      return new Array<Element>(100_000).fill(label);
    },
  });

  const result = composedAccessibilityTextResult(button, {
    maxNodes: 2,
    skipRootAncestorValidation: true,
  });

  expect(result.text).to.equal('');
  expect(result.truncationReasons).to.include('nodes');
  expect(reflectedReads).to.equal(0);
});

it('charges serialized IDREF scanning before materializing or resolving a giant token', async () => {
  const host = await fixture<HTMLElement>(html`<div></div>`);
  const root = host.attachShadow({ mode: 'open' });
  const button = document.createElement('button');
  button.setAttribute('aria-labelledby', 'x'.repeat(100_000));
  button.setAttribute('aria-label', 'Fallback');
  root.append(button);
  const getElementById = root.getElementById.bind(root);
  let lookups = 0;
  Object.defineProperty(root, 'getElementById', {
    configurable: true,
    value: (id: string) => {
      lookups += 1;
      return getElementById(id);
    },
  });

  const result = composedAccessibilityTextResult(button, {
    maxNodes: 2,
    skipRootAncestorValidation: true,
  });

  expect(result.text).to.equal('');
  expect(result.truncationReasons).to.include('nodes');
  expect(lookups).to.equal(0);
});

it('tokenizes aria-labelledby with ASCII whitespace only', async () => {
  const root = await fixture<HTMLElement>(html`<div><span>Authoritative</span><button aria-label="Fallback"></button></div>`);
  const label = root.querySelector<HTMLElement>('span')!;
  const button = root.querySelector<HTMLButtonElement>('button')!;
  label.id = 'label\u00a0token';
  button.setAttribute('aria-labelledby', label.id);
  Object.defineProperty(button, 'ariaLabelledByElements', {
    configurable: true,
    get: () => null,
  });

  expect(normalizedText(button)).to.equal('Authoritative');
});

it('does not materialize a slot assignment array after exhausting its node budget', () => {
  const host = document.createElement('div');
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = '<slot></slot>';
  for (let index = 0; index < 1_000; index += 1) {
    host.append(document.createTextNode(`assigned-${index}`));
  }
  const slot = shadow.querySelector('slot')!;
  let assignedCalls = 0;
  const assignedNodes = slot.assignedNodes.bind(slot);
  Object.defineProperty(slot, 'assignedNodes', {
    configurable: true,
    value: (...args: Parameters<HTMLSlotElement['assignedNodes']>) => {
      assignedCalls += 1;
      return assignedNodes(...args);
    },
  });

  const result = composedAccessibilityTextResult(slot, {
    maxNodes: 1,
    skipRootAncestorValidation: true,
  });

  expect(result.truncationReasons).to.include('nodes');
  expect(assignedCalls).to.equal(0);
});

it('keeps a proper image map available through its non-rendered map container', async () => {
  const root = await fixture<HTMLElement>(html`
    <div>
      <img alt="Mapped image" usemap="#announcement-map" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==" />
      <map name="announcement-map"><area href="#target" alt="Mapped action" /></map>
    </div>
  `);

  expect(normalizedText(root.querySelector('map')!)).to.equal('Mapped action');
});

it('charges a closed-details summary search to the total work budget', () => {
  const details = document.createElement('details');
  for (let index = 0; index < 1_000; index += 1) details.append(document.createElement('span'));
  const summary = document.createElement('summary');
  summary.textContent = 'Late summary';
  details.append(summary);

  const result = composedAccessibilityTextResult(details, {
    maxNodes: 10,
    skipRootAncestorValidation: true,
  });

  expect(result.text).to.equal('');
  expect(result.truncationReasons).to.include('nodes');
  expect(result.visitedNodes).to.be.at.most(10);
});

it('reports omitted text when the character ceiling is zero', async () => {
  const root = await fixture<HTMLElement>(html`<span aria-label="Bounded label"></span>`);
  const result = composedAccessibilityTextResult(root, {
    maxCharacters: 0,
    skipRootAncestorValidation: true,
  });

  expect(result.text).to.equal('');
  expect(result.truncationReasons).to.include('characters');
});

it('does not report depth truncation for an empty leaf at the configured depth', async () => {
  const root = await fixture<HTMLElement>(html`<span></span>`);
  const result = composedAccessibilityTextResult(root, {
    maxDepth: 0,
    skipRootAncestorValidation: true,
  });

  expect(result.text).to.equal('');
  expect(result.truncated).to.equal(false);
});

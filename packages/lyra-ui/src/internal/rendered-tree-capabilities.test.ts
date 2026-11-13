import { expect } from '@open-wc/testing';
import { collectRenderedTree, DEFAULT_RENDERED_TREE_TRAVERSAL_LIMITS, nativeElementLocalName,
  nativeNodeType, openShadowRoot, ownerDocumentFor } from './rendered-tree-traversal.js';

function tree() {
  const root = document.createElement('div'); root.id = 'root';
  const light = document.createElement('span'); light.id = 'light'; root.append('Text', light);
  const shadow = root.attachShadow({ mode: 'open' });
  const child = document.createElement('button'); child.id = 'shadow'; child.textContent = 'Action'; shadow.append(child);
  return { root, shadow };
}

it('discovers native light and shadow children when the owner exposes no Node constructor', () => {
  const original = Object.getOwnPropertyDescriptor(window, 'Node');
  const { root, shadow } = tree();
  Object.defineProperty(window, 'Node', { configurable: true, value: undefined });
  let ids: string[], rootCount: number, type: number | undefined, owner: Document | undefined;
  try {
    const result = collectRenderedTree(root, DEFAULT_RENDERED_TREE_TRAVERSAL_LIMITS, { work: 0 }, 'partial-dom');
    ids = result.elements.map(element => element.id); rootCount = result.roots.length;
    type = nativeNodeType(root); owner = ownerDocumentFor(shadow);
  } finally {
    if (original) Object.defineProperty(window, 'Node', original);
    else Reflect.deleteProperty(window, 'Node');
  }
  expect(ids).to.deep.equal(['root', 'light', 'shadow']); expect(rootCount).to.equal(2);
  expect(type).to.equal(1); expect(owner === document).to.equal(true);
  const recovered = collectRenderedTree(root, DEFAULT_RENDERED_TREE_TRAVERSAL_LIMITS, { work: 0 }, 'native-dom');
  expect(recovered.elements.map(element => element.id)).to.deep.equal(ids);
});

it('retains light children without Element accessors and rediscovers the shadow tree once capabilities return', () => {
  const original = Object.getOwnPropertyDescriptor(window, 'Element');
  const { root } = tree();
  Object.defineProperty(window, 'Element', { configurable: true, value: undefined });
  let ids: string[], name: string | undefined, shadow: ShadowRoot | undefined;
  try {
    const result = collectRenderedTree(root, DEFAULT_RENDERED_TREE_TRAVERSAL_LIMITS, { work: 0 }, 'partial-dom');
    ids = result.elements.map(element => element.id);
    name = nativeElementLocalName(root); shadow = openShadowRoot(root);
  } finally {
    if (original) Object.defineProperty(window, 'Element', original);
    else Reflect.deleteProperty(window, 'Element');
  }
  expect(ids).to.deep.equal(['root', 'light']); expect(name).to.equal(undefined); expect(shadow === undefined).to.equal(true);
  expect(nativeElementLocalName(root)).to.equal('div');
  const recovered = collectRenderedTree(root, DEFAULT_RENDERED_TREE_TRAVERSAL_LIMITS, { work: 0 }, 'native-dom');
  expect(recovered.elements.map(element => element.id)).to.deep.equal(['root', 'light', 'shadow']);
  expect(recovered.roots.length).to.equal(2);
});

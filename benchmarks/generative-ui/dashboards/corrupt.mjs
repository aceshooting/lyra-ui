/**
 * Deliberate corruptions. View-level ones feed validation, isolation and the repair session;
 * stream-level ones damage the encoded text and observe each streaming consumer.
 */
import { clone, walk } from './encoders.mjs';

const firstNode = (view, test) => { for (const node of walk(view.root)) if (test(node)) return node; return undefined; };
const lastLeaf = (view) => [...walk(view.root)].filter(node => !node.children?.length && node.id !== view.root.id).at(-1);

export const VIEW_CORRUPTIONS = Object.freeze([
  { id: 'unknown-prop', describe: 'adds a property the catalog does not define', apply(view) { const node = firstNode(view, n => n.props && n.id !== view.root.id); if (!node) return undefined; node.props.bogusProperty = 1; return node.id; } },
  { id: 'wrong-type', describe: 'changes a numeric property to a string', apply(view) { const node = firstNode(view, n => n.props && Object.values(n.props).some(v => typeof v === 'number' && !Array.isArray(v))); if (!node) return undefined; const key = Object.keys(node.props).find(k => typeof node.props[k] === 'number'); node.props[key] = 'not a number'; return node.id; } },
  { id: 'missing-required', describe: 'deletes a required property', apply(view, catalog) { const node = firstNode(view, n => (catalog.components[n.type]?.required ?? []).some(k => n.props?.[k] !== undefined)); if (!node) return undefined; delete node.props[catalog.components[node.type].required.find(k => node.props[k] !== undefined)]; return node.id; } },
  { id: 'unknown-type', describe: 'renames a leaf to a component the catalog lacks', apply(view) { const node = lastLeaf(view); if (!node) return undefined; node.type = 'hologram'; return node.id; } },
  { id: 'duplicate-id', describe: 'gives a leaf the root identity', apply(view) { const node = lastLeaf(view); if (!node) return undefined; node.id = view.root.id; return node.id; } },
  { id: 'dangling-read', describe: 'reads a state path no binding owns', apply(view) { const node = firstNode(view, n => n.props && !n.reads && !n.children?.length && n.id !== view.root.id); if (!node) return undefined; node.reads = { [Object.keys(node.props)[0]]: '/nowhere/owned' }; return node.id; } }
]);

/** Returns a corrupted deep copy and the touched node id, or undefined when the scenario cannot host it. */
export function corruptView(view, corruption, catalog) {
  const copy = clone(view);
  const target = corruption.apply(copy, catalog);
  return target === undefined ? undefined : { view: copy, target };
}

export const STREAM_CORRUPTIONS = Object.freeze([
  { id: 'truncate-60', describe: 'the stream stops after 60 percent of its code units', apply: (text) => text.slice(0, Math.floor(text.length * 0.6)) },
  { id: 'garble-middle', describe: 'three stray characters are inserted at the midpoint', apply: (text) => `${text.slice(0, Math.floor(text.length / 2))}@#%${text.slice(Math.floor(text.length / 2))}` }
]);

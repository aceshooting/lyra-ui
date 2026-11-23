/**
 * `fixture()` from @open-wc/testing-helpers awaits only the root element it returns. A Lyra
 * component's first render waits for the lazy token layer on a page that links no Lyra stylesheet
 * (the test page links none), so a test whose fixture root is a plain wrapper can read a child
 * component before that child has rendered. This rewrites `elementUpdated()`, which every fixture
 * awaits, to also await each light-DOM descendant that has not completed its first update yet.
 * Elements that already rendered, and elements that are not reactive, are not waited for, so a
 * fixture settles exactly as before whenever no first render is pending.
 * A helper release that changes the function's shape leaves this a no-op rather than breaking the
 * run; `scripts/wtr-fixture-settle.test.mjs` fails when that happens.
 */
const ORIGINAL_SIGNATURE = /export async function elementUpdated\(el\) \{/u;

const SETTLE_DESCENDANTS = `
// Injected by scripts/wtr-fixture-settle.mjs: settle descendants whose first render is pending.
async function settlePendingDescendants(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return;
  for (let pass = 0; pass < 8; pass++) {
    const pending = [...root.querySelectorAll('*')].filter(
      (node) => node.hasUpdated === false && isDefinedPromise(node.updateComplete),
    );
    if (pending.length === 0) return;
    await Promise.all(pending.map((node) => node.updateComplete));
  }
}

export async function elementUpdated(el) {
  await originalElementUpdated(el);
  await settlePendingDescendants(el);
  return el;
}
`;

/** Rewrites the helper's source; returns `undefined` when the expected shape is absent. */
export function settleFixtureDescendants(source) {
  if (!ORIGINAL_SIGNATURE.test(source) || !source.includes('isDefinedPromise')) return undefined;
  return `${source.replace(ORIGINAL_SIGNATURE, 'async function originalElementUpdated(el) {')}\n${SETTLE_DESCENDANTS}`;
}

export const fixtureSettlePlugin = {
  name: 'lyra-fixture-settle-descendants',
  transform(context) {
    if (!context.response.is('js') || !context.path.includes('/testing-helpers/') || !context.path.endsWith('/src/elementUpdated.js')) return;
    return settleFixtureDescendants(context.body);
  },
};

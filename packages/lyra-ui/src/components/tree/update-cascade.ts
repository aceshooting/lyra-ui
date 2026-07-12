/**
 * Both `<lyra-tree>` and `<lyra-tree-node>` override `getUpdateComplete()` to
 * additionally await their currently-known child `<lyra-tree-node>`
 * elements' own `updateComplete`. A nested node only receives a pushed-down
 * property (like `activeId`, and the `tabIndex` derived from it) once its
 * own render has committed -- one more pending update per depth level -- so
 * without this, code that awaits a parent's `updateComplete` (e.g.
 * `focusNode()`) could run before an arbitrarily-nested descendant has
 * actually settled.
 */
export async function cascadeUpdateComplete(
  children: Iterable<{ updateComplete: Promise<unknown> }>,
): Promise<void> {
  await Promise.all([...children].map((child) => child.updateComplete));
}

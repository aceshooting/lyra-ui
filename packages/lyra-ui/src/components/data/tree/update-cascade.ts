/**
 * Both `<lr-tree>` and `<lr-tree-item>` override `getUpdateComplete()` to
 * additionally await their currently-known, owner-bounded child `<lr-tree-item>`
 * elements' own `updateComplete`. A nested node only receives private owner
 * context (and the `tabIndex` derived from it) once its own render has committed -- one more
 * pending update per accepted depth level -- so
 * without this, code that awaits a parent's `updateComplete` (e.g.
 * `focusNode()`) could run before a reachable descendant has
 * actually settled.
 */
export async function cascadeUpdateComplete(
  children: Iterable<{ updateComplete: Promise<unknown> }>,
): Promise<void> {
  await Promise.all([...children].map((child) => child.updateComplete));
}

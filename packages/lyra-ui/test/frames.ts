/** Waits for one animation frame in the supplied document's realm. */
export function nextFrame(doc: Document = document): Promise<void> {
  const view = doc.defaultView;
  return view ? new Promise<void>((resolve) => view.requestAnimationFrame(() => resolve())) : Promise.resolve();
}

/** Waits for two queued paint opportunities in the supplied document's realm. */
export async function twoFrames(doc: Document = document): Promise<void> {
  await nextFrame(doc);
  await nextFrame(doc);
}

/** Flushes Lit updates for a set of elements before the next frame. */
export async function settle(elements: readonly { updateComplete: Promise<unknown> }[], doc: Document = document): Promise<void> {
  await Promise.all(elements.map((element) => element.updateComplete));
  await nextFrame(doc);
}

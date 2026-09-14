/**
 * Minimal host surface `announceAfterFirstPaint()` needs. Declared structurally rather than as
 * `LyraElement` so the helper stays testable against a plain object and pulls no component
 * dependency into this module.
 *
 * @internal
 */
export interface InitialAnnouncementHost {
  readonly isConnected: boolean;
  readonly ownerDocument: Document;
  readonly updateComplete: Promise<unknown>;
}

/**
 * Run an opt-in mount-time announcement one paint after the host's first update.
 *
 * `acquireAnnouncementSink()` deliberately mounts the shared light-DOM region at acquire time,
 * ahead of any text, because assistive technology has to have been observing that region before
 * an addition lands in it. A component that connects and then announces straight out of its first
 * `updated()` defeats that: `connectedCallback()` and the first update can share a single task,
 * so the region would be created and filled in the same one. Waiting an animation frame (and the
 * update that frame may schedule) puts the text in a later task than the mount, which is the same
 * ordering `<lr-callout>`'s own arming hook establishes for its `announce` opt-in.
 *
 * `isCurrent` is re-checked after every await, so a disconnect, reconnection, or adoption between
 * frames abandons the announcement instead of speaking for a connection that no longer owns it.
 *
 * @internal
 */
export async function announceAfterFirstPaint(
  host: InitialAnnouncementHost,
  isCurrent: () => boolean,
  announce: () => void
): Promise<void> {
  await host.updateComplete;
  if (!isCurrent()) return;
  const view = host.ownerDocument.defaultView;
  if (typeof view?.requestAnimationFrame === 'function') {
    await new Promise<void>((resolve) =>
      view.requestAnimationFrame(() => resolve())
    );
  }
  await host.updateComplete;
  if (!isCurrent() || !host.isConnected) return;
  announce();
}

type AnnotationRegistrationListener = () => void;
const annotationRegistrationListeners = new Set<AnnotationRegistrationListener>();

/**
 * Subscribes to the moment `chartjs-plugin-annotation` is registered globally. The plugin creates
 * its per-chart state only in `beforeInit`, so a chart constructed before that registration has
 * none and the plugin throws inside that chart's very next update. Every live Chart.js host
 * therefore rebuilds its instance on this signal. Returns the unsubscribe function.
 *
 * @internal Library-private wiring between the chart feature loader and its Chart.js hosts.
 */
export function onAnnotationPluginRegistered(
  listener: AnnotationRegistrationListener
): () => void {
  annotationRegistrationListeners.add(listener);
  return () => {
    annotationRegistrationListeners.delete(listener);
  };
}

/**
 * Fires every subscriber once, isolating a throwing host from its siblings.
 *
 * @internal Called by the chart feature loader immediately after the global registration.
 */
export function notifyAnnotationPluginRegistered(): void {
  for (const listener of [...annotationRegistrationListeners]) {
    try {
      listener();
    } catch (err) {
      console.warn('<lr-chart> could not rebuild a chart after annotation registration:', err);
    }
  }
}

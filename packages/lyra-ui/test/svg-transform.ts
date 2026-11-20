import { waitUntil } from '@open-wc/testing';
import { nextFrame } from './frames.js';

/**
 * Resolves with the final `transform` of an animated SVG group once it stops changing.
 *
 * `fit()` and d3-zoom's double-click zoom animate the transform without exposing a completion
 * signal, so this waits for the first movement (when `from` is given) and then for the value to
 * hold still across consecutive frames, instead of sleeping for the tween's nominal duration.
 */
export async function settledTransform(
  group: Element,
  options: { readonly from?: string | null; readonly stableFrames?: number } = {},
): Promise<string | null> {
  const { from, stableFrames = 5 } = options;
  if (from !== undefined) {
    await waitUntil(() => group.getAttribute('transform') !== from, 'the transform never moved');
  }
  let last = group.getAttribute('transform');
  let stable = 0;
  while (stable < stableFrames) {
    await nextFrame();
    const current = group.getAttribute('transform');
    if (current === last) stable += 1;
    else {
      last = current;
      stable = 0;
    }
  }
  return last;
}

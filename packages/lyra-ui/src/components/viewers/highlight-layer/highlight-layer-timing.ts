import { parseCssTime } from '../../../internal/css-motion-time.js';

function cssList(value: string): string[] {
  const values = value.split(',').map((item) => item.trim());
  return values.length ? values : [''];
}

/** @internal */
export function maxPairedAnimationEndMs(
  animationNames: string,
  animationDurations: string,
  animationDelays: string,
): number {
  const names = cssList(animationNames);
  const durations = cssList(animationDurations).map((value) => Math.max(0, parseCssTime(value)));
  const delays = cssList(animationDelays).map(parseCssTime);
  let latestEnd = 0;
  names.forEach((name, index) => {
    if (name.toLowerCase() === 'none') return;
    const duration = durations[index % durations.length] ?? 0;
    const delay = delays[index % delays.length] ?? 0;
    latestEnd = Math.max(latestEnd, duration + delay, 0);
  });
  return latestEnd;
}

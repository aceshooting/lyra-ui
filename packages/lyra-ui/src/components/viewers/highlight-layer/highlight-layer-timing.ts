function parseCssTime(value: string): number {
  const trimmed = value.trim();
  const parsed = trimmed.endsWith('ms')
    ? Number.parseFloat(trimmed)
    : trimmed.endsWith('s')
      ? Number.parseFloat(trimmed) * 1000
      : 0;
  if (Number.isFinite(parsed)) return parsed;
  return 0;
}

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

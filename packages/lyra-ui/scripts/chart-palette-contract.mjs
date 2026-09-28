/** Categorical marks and ordered magnitude fills have different accessibility contracts. */
export function chartPaletteKind(name) {
  if (/^--lr-theme-color-chart-[1-8]$/.test(name)) return 'categorical';
  return name.match(/^--lr-theme-color-chart-(sequential|diverging)-[1-3]$/)?.[1] ?? null;
}

const channels = hex => [1, 3, 5].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
const luminance = hex => channels(hex).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
const contrast = (left, right) => (Math.max(left, right) + 0.05) / (Math.min(left, right) + 0.05);

/** These fills encode magnitude alongside values/labels/boundaries; they are not text/series ink. */
export function checkOrderedChartScales(tokens, mode, label) {
  const findings = [];
  let checks = 0;
  for (const kind of ['sequential', 'diverging']) {
    const colors = [1, 2, 3].map(index => tokens.get(`--lr-theme-color-chart-${kind}-${index}`));
    checks++;
    if (colors.some(color => !/^#[a-f0-9]{6}$/i.test(color ?? ''))) {
      findings.push(`${label}: ${kind} requires three opaque six-digit color stops`);
      continue;
    }
    const [low, middle, high] = colors.map(luminance);
    checks += 2;
    if (kind === 'sequential') {
      if (!(mode === 'light' ? low > middle && middle > high : low < middle && middle < high)) {
        findings.push(`${label}: sequential luminance must be strictly ${mode === 'light' ? 'decreasing' : 'increasing'}`);
      }
      if (contrast(low, high) < 3) findings.push(`${label}: sequential endpoints need at least 3:1 tonal range`);
    } else {
      if (!(mode === 'light' ? middle > low && middle > high : middle < low && middle < high)) {
        findings.push(`${label}: diverging midpoint must be the ${mode === 'light' ? 'lightest' : 'darkest'} stop`);
      }
      if (contrast(low, middle) < 3 || contrast(high, middle) < 3) {
        findings.push(`${label}: both diverging arms need at least 3:1 tonal range from the midpoint`);
      }
      checks += 2;
      const neutral = channels(colors[1]);
      if (Math.max(...neutral) - Math.min(...neutral) > 0.125) {
        findings.push(`${label}: diverging midpoint must be near-neutral (sRGB channel spread at most 0.125)`);
      }
      const [first, last] = [channels(colors[0]), channels(colors[2])];
      if (Math.hypot(...first.map((value, index) => value - last[index])) < 0.25) {
        findings.push(`${label}: diverging endpoints must remain distinct`);
      }
    }
  }
  return { findings, checks };
}

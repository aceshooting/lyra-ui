/** Rendered specimen diagnostics; dynamic backgrounds deliberately remain unqualified. */
const linear = channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
const luminance = rgb => rgb.slice(0, 3).map(value => linear(value / 255)).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
export function contrastRatio(a, b) { const x = luminance(a); const y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
export function composite(foreground, background) {
  const alpha = foreground[3] / 255;
  return [...foreground.slice(0, 3).map((value, i) => value * alpha + background[i] * (1 - alpha)), 255];
}
function rgba(root, color) {
  if (typeof color !== 'string' || !CSS.supports('color', color)) return null;
  const canvas = root.ownerDocument.createElement('canvas'); canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.fillStyle = color; context.fillRect(0, 0, 1, 1);
  return Array.from(context.getImageData(0, 0, 1, 1).data);
}
function token(root, name) {
  const raw = getComputedStyle(root).getPropertyValue(name).trim();
  if (!raw || !CSS.supports('color', raw)) return null;
  const probe = root.ownerDocument.createElement('span');
  probe.style.color = `var(${name})`; probe.hidden = true; root.append(probe);
  const value = getComputedStyle(probe).color; probe.remove(); return value;
}
const matrices = {
  protanopia: [0.170556992, 0.829443014, 0, 0.170556991, 0.829443008, 0, -0.004517144, 0.004517144, 1],
  deuteranopia: [0.33066007, 0.66933993, 0, 0.33066007, 0.66933993, 0, -0.02785538, 0.02785538, 1],
  tritanopia: [1, 0.1273989, -0.1273989, 0, 0.8739093, 0.1260907, 0, 0.8739093, 0.1260907],
};
function lab(rgb, matrix) {
  let [r, g, b] = rgb.slice(0, 3).map(value => linear(value / 255));
  if (matrix) [r, g, b] = [0, 3, 6].map(offset => {
    const channel = matrix[offset] * r + matrix[offset + 1] * g + matrix[offset + 2] * b;
    const srgb = channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055;
    return linear(Math.round(Math.min(1, Math.max(0, srgb)) * 255) / 255);
  });
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
export function paletteDistance(a, b, kind) {
  const left = lab(a, matrices[kind]); const right = lab(b, matrices[kind]);
  return Math.hypot(...left.map((value, i) => value - right[i]));
}
export function measureBuilderPreview(roots, revision) {
  const rows = [];
  for (const root of roots) {
    const mode = root.dataset.resolvedMode;
    const rootStyle = getComputedStyle(root);
    const page = rootStyle.backgroundImage === 'none' ? rgba(root, rootStyle.backgroundColor) : null;
    const add = (name, foreground, background, threshold, field = 'contrast', state = 'rest') => {
      const fg = rgba(root, foreground); const bg = rgba(root, background);
      const known = fg && bg && page && page[3] === 255;
      const actualBg = known ? composite(bg, page) : null;
      const ratio = known ? contrastRatio(composite(fg, actualBg), actualBg) : null;
      rows.push({ mode, name, state, field, foreground, background, value: ratio, threshold, result: ratio === null ? 'unknown' : ratio >= threshold ? 'pass' : 'fail' });
    };
    for (const surface of ['default', 'raised', 'overlay', 'container-lowest', 'container-low', 'container', 'container-high', 'container-highest']) {
      for (const text of ['normal', 'quiet']) add(`text-${text} / ${surface}`, token(root, `--lr-theme-color-text-${text}`), token(root, `--lr-theme-color-surface-${surface}`), 4.5);
    }
    for (const role of ['brand', 'success', 'warning', 'danger', 'neutral']) {
      for (const level of ['quiet', 'normal', 'loud']) add(`${role}-${level}`, token(root, `--lr-theme-color-${role}-on-${level}`), token(root, `--lr-theme-color-${role}-fill-${level}`), 4.5, 'accent');
    }
    add('border-strong / default', token(root, '--lr-theme-color-border-strong'), getComputedStyle(root).backgroundColor, 3, 'contrast');
    const button = root.querySelector('[data-brand]')?.shadowRoot?.querySelector('button');
    if (button) {
      const style = getComputedStyle(button);
      const state = button.matches(':active') ? 'pressed' : button.matches(':focus-visible') ? 'focus' : button.matches(':hover') ? 'hover' : 'rest';
      const size = Number.parseFloat(style.fontSize); const weight = Number.parseFloat(style.fontWeight);
      const textThreshold = size >= 24 || (size >= 14 * 96 / 72 && weight >= 700) ? 3 : 4.5;
      add('rendered brand button', style.color, style.backgroundColor, textThreshold, 'accent', state);
      if (state === 'focus' && style.outlineStyle !== 'none') add('focus / surface', style.outlineColor, getComputedStyle(root).backgroundColor, 3, 'contrast', state);
      else rows.push({ mode, name: 'focus / surface', state: 'focus', field: 'contrast', value: null, threshold: 3, result: 'unknown' });
    }
    const marks = Array.from(root.querySelectorAll('[data-palette-mark]'));
    const categories = marks.map(mark => {
      const color = rgba(root, getComputedStyle(mark).fill);
      return color && page?.[3] === 255 ? composite(color, page) : null;
    });
    marks.forEach((mark, i) => add(`chart-${i + 1} / surface`, getComputedStyle(mark).fill, rootStyle.backgroundColor, 3, 'palette'));
    for (const kind of Object.keys(matrices)) {
      let minimum = Infinity;
      const complete = categories.length === 8 && categories.every(Boolean);
      for (let i = 0; i < categories.length; i++) for (let j = i + 1; j < categories.length; j++) {
        if (complete) minimum = Math.min(minimum, paletteDistance(categories[i], categories[j], kind));
      }
      rows.push({ mode, name: kind, state: 'simulation', field: 'palette', value: Number.isFinite(minimum) ? minimum : null, threshold: 0.1, result: !Number.isFinite(minimum) ? 'unknown' : minimum >= 0.1 ? 'pass' : 'fail' });
    }
    for (const mark of root.querySelectorAll('[data-scale]')) add(`${mark.dataset.scale}-${Number(mark.dataset.step) + 1} / surface`, getComputedStyle(mark).backgroundColor, rootStyle.backgroundColor, 3, 'palette', 'scale');
    if (root.getAttribute('data-lr-surface') === 'glass') rows.push({ mode, name: 'glass / dynamic backdrop', state: 'rest', field: 'surface', value: null, threshold: null, result: 'unknown' });
  }
  return { revision, rows };
}

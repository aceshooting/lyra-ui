import { defineLyraLook, type LyraLook } from './theme.js';
import { LOOK_MODE_RESOLVER, LOOK_SLOTTED_INPUTS, LOOK_STYLE_VERSION } from './look-inputs.js';

/** Optional class aliases within the selected look's subtree. */
export interface LyraLookCssOptions {
  /** Enable .light and .dark; explicit Lyra mode attributes always take precedence. */
  readonly modeAliases?: boolean;
}

/**
 * Serializes a look as an opt-in stylesheet. Install theme.css and this result in each tree that
 * contains local style boundaries, including application-owned shadow roots. No DOM is accessed.
 * The id selects the look; defining or serializing it never registers a global theme.
 */
export function lyraLookCss(input: LyraLook, options: LyraLookCssOptions = {}): string {
  const look = defineLyraLook(input);
  const lines = [`    --_lr-look-installed: ${look.id}-${LOOK_STYLE_VERSION};`];
  for (const [name, value] of Object.entries(look.tokens)) {
    if (!LOOK_SLOTTED_INPUTS.includes(name)) {
      if (typeof value !== 'string') throw new TypeError(`Per-mode input requires the theme resolver: ${name}`);
      lines.push(`    ${name}: ${value};`);
      continue;
    }
    for (const mode of ['light', 'dark'] as const) {
      const branch = typeof value === 'string' ? value : value[mode];
      if (branch == null) continue;
      const key = mode === 'light' ? 'l' : 'd';
      const suffix = name.slice(11);
      const channel = name.match(/^--lr-theme-color-(?:success|warning|danger|neutral)-((?:fill|border|on)-(?:quiet|normal|loud))$/)?.[1];
      if (channel && branch === `var(--lr-theme-color-brand-${channel})`) {
        lines.push(`    --_lr-f${key}-${suffix}: ;`, `    --_lr-o${key}-${suffix}: initial;`);
      } else {
        lines.push(`    --_lr-l${key}-${suffix}: ${branch};`);
        if (channel) lines.push(`    --_lr-f${key}-${suffix}: initial;`, `    --_lr-o${key}-${suffix}: ;`);
      }
    }
  }
  let css = `@layer lr-base, lr-theme, lr-theme-preset, lr-utilities, lr-overrides;\n@layer lr-theme-preset.look, lr-theme-preset.density, lr-theme-preset.surface, lr-theme-preset.accent, lr-theme-preset.mode;\n@layer lr-theme-preset.look {\n  [data-lr-look='${look.id}'] {\n${lines.join('\n')}\n  }\n}\n`;
  if (options.modeAliases) {
    const explicit = ':not(:where([data-lr-mode], [data-lr-theme], .lr-light, .lr-dark))';
    const selector = (mode: 'light' | 'dark'): string => `:where([data-lr-look='${look.id}']).${mode}${explicit}, :where([data-lr-look='${look.id}']) .${mode}${explicit}`;
    const light = selector('light');
    const dark = selector('dark');
    css += `@layer lr-theme {\n  ${light}, ${dark} {\n${LOOK_MODE_RESOLVER}\n  }\n}\n`;
    css += `@layer lr-theme-preset.mode {\n  ${light} {\n    color-scheme: light;\n    --_lr-dark-on: initial;\n    --_lr-light-on: ;\n  }\n  ${dark} {\n    color-scheme: dark;\n    --_lr-dark-on: ;\n    --_lr-light-on: initial;\n  }\n}\n`;
  }
  return css;
}

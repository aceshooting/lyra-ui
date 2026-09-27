// Which --lr-theme-* inputs reach components through the shared layer, and which are read directly
// by component or specialist sheets (and therefore keep working on any wrapper)? Also: does any
// component sheet declare a shared-layer name? Parses every exported CSSResult with postcss.
// Usage: node analyze-inputs.mjs [dist-dir]  -> out/inputs.json
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, process.argv[2] ?? 'dist-a');
const checkout = path.resolve(process.env.LYRA_CHECKOUT ?? path.join(here, '..', 'lyra-ui'));
const postcss = (await import(path.join(checkout, 'node_modules/.pnpm/node_modules/postcss/lib/postcss.js'))).default;
const walk = (d) => readdirSync(d).flatMap((f) => { const p = path.join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : []; });
const files = [...walk(path.join(dist, 'components')), ...walk(path.join(dist, 'internal'))];
const { palette } = await import(pathToFileURL(path.join(dist, 'internal/tokens/palette.styles.js')).href);
const { tokens } = await import(pathToFileURL(path.join(dist, 'internal/tokens.styles.js')).href);
const { specialistTokens } = await import(pathToFileURL(path.join(dist, 'internal/specialist-tokens.styles.js')).href);
const KIND = new Map([[palette.cssText, 'shared'], [tokens.cssText, 'shared'], [specialistTokens.cssText, 'specialist']]);
const texts = new Map(); // cssText -> first module
let modules = 0, failed = 0;
const collect = (v, file, seen = new Set()) => {
  if (!v || seen.has(v)) return; seen.add(v);
  if (typeof v === 'object' && typeof v.cssText === 'string') { if (!texts.has(v.cssText)) texts.set(v.cssText, path.relative(dist, file)); return; }
  if (Array.isArray(v)) v.forEach((x) => collect(x, file, seen));
  else if (typeof v === 'function' && v.elementStyles) collect(v.elementStyles, file, seen);
};
for (const f of files) {
  try { const m = await import(pathToFileURL(f).href); modules++; for (const v of Object.values(m)) { collect(v, f); if (typeof v === 'function') { try { collect(v.styles, f); } catch {} } } } catch { failed++; }
}
const refs = (value) => [...value.matchAll(/var\(\s*(--[a-z0-9-]+)/g)].map((m) => m[1]);

const shared = { declared: new Set(), inputs: new Set() };
const perKind = { specialist: { declared: new Set(), inputs: new Set(), files: new Set() }, component: { inputs: new Set(), files: new Set() } };
const componentDeclaresShared = [];
const parsed = [];
for (const [text, file] of texts) {
  const kind = KIND.get(text) ?? 'component';
  const root = postcss.parse(text);
  parsed.push({ kind, file, root });
  root.walkDecls((d) => {
    if (kind === 'shared' && d.prop.startsWith('--')) shared.declared.add(d.prop);
    for (const r of refs(d.value)) if (r.startsWith('--lr-theme-')) (kind === 'shared' ? shared.inputs : perKind[kind].inputs).add(r);
    if (kind === 'specialist' && d.prop.startsWith('--')) perKind.specialist.declared.add(d.prop);
  });
}
for (const { kind, file, root } of parsed) {
  if (kind === 'shared') continue;
  root.walkDecls((d) => {
    if (d.prop.startsWith('--lr-theme-') || refs(d.value).some((r) => r.startsWith('--lr-theme-'))) perKind[kind].files.add(file);
    if (kind === 'component' && shared.declared.has(d.prop)) componentDeclaresShared.push(`${file}: ${d.parent.selector} { ${d.prop} }`);
  });
}
const directOnly = [...perKind.component.inputs, ...perKind.specialist.inputs].filter((i) => !shared.inputs.has(i));
const both = [...perKind.component.inputs].filter((i) => shared.inputs.has(i));
const result = {
  modulesImported: modules, modulesFailed: failed, distinctCssTexts: texts.size,
  sharedLayer: { declaredNames: shared.declared.size, inputsRead: shared.inputs.size },
  specialist: { declaredNames: perKind.specialist.declared.size, inputsRead: perKind.specialist.inputs.size },
  componentSheets: { inputsReadDirectly: perKind.component.inputs.size, sheets: perKind.component.files.size },
  inputsReadOnlyOutsideSharedLayer: directOnly.length,
  inputsReadByBothSharedLayerAndComponentSheets: both,
  componentSheetsDeclaringASharedLayerName: componentDeclaresShared,
  lists: { directOnly: directOnly.sort(), componentDirect: [...perKind.component.inputs].sort(), sharedInputs: [...shared.inputs].sort() },
};
writeFileSync(path.join(here, 'out/inputs.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ...result, lists: undefined }, null, 2));
console.log('component-direct inputs:', [...perKind.component.inputs].sort().join(' '));

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { cli as analyzeManifest } from '@custom-elements-manifest/analyzer/cli.js';
import { compactManifest } from './manifest-compact.mjs';
import { renderSurfaceFor } from './manifest-render-reachability.mjs';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(packageDir, 'src', 'components');
const manifestPath = path.join(packageDir, 'custom-elements.json');

// The pinned public wa-video table publishes this exact camel-case attribute spelling. HTML
// normalizes it to `currenttime` at runtime, and the component also retains `current-time` as a
// compatibility alias. Keep the manifest exception tag-scoped so no other noncanonical attribute
// can enter the package unnoticed.
const REVIEWED_NONCANONICAL_ATTRIBUTES = new Set([
  'lr-carousel\0currentSlide',
  'lr-video\0currentTime',
]);

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function namesFromJSDoc(source) {
  return [...source.matchAll(/@csspart\s+([A-Za-z0-9_-]+)/g)].map((match) => match[1]);
}

/** Every single- or double-quoted string literal in a small source expression. Empty literals
 * remain empty so one `: ''` branch cannot pair its quote with the next branch's quote. */
function stringLiterals(source) {
  return [...source.matchAll(/'([^'\\]*(?:\\.[^'\\]*)*)'|"([^"\\]*(?:\\.[^"\\]*)*)"/g)]
    .map((match) => match[1] ?? match[2] ?? '');
}

function addLiteralPartNames(source, names) {
  for (const literal of stringLiterals(source)) {
    for (const name of literal.trim().split(/\s+/)) {
      if (name) names.add(name);
    }
  }
  // A subclass getter commonly appends one alias with a template literal, e.g.
  // `` `${super.inputWrapperParts} time-input` ``. The interpolation is inherited plumbing; only
  // the static words around it are new part tokens owned by this member.
  for (const template of source.matchAll(/`([^`\\]*(?:\\.[^`\\]*)*)`/g)) {
    const staticText = template[1].replace(/\$\{[\s\S]*?\}/g, ' ');
    for (const name of staticText.trim().split(/\s+/)) {
      if (name) names.add(name);
    }
  }
  // Preserve the static prefix of a template whose interpolation itself contains a nested
  // template literal. The complete-template expression above necessarily stops at that inner
  // backtick, but the prefix is still a deterministic public token (for example `node-type-*`).
  for (const templatePrefix of source.matchAll(/`([^`$]*)\$\{/g)) {
    for (const name of templatePrefix[1].trim().split(/\s+/)) {
      if (name) names.add(name);
    }
  }
}

/** Extracts balanced Lit attribute expressions such as `part=${condition ? `a ${b}` : 'a'}`.
 * A flat `[^}]*` expression stops at the first nested template interpolation and silently loses
 * the exact static token that precedes it. */
function litPartBindings(source) {
  const expressions = [];
  const pattern = /\bpart\s*=\s*\$\{/g;
  for (const match of source.matchAll(pattern)) {
    const start = match.index + match[0].length;
    let depth = 1;
    let quote = '';
    let escaped = false;
    let index = start;
    for (; index < source.length && depth > 0; index += 1) {
      const character = source[index];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === '\\') {
        escaped = true;
        continue;
      }
      if (quote === "'" || quote === '"') {
        if (character === quote) quote = '';
        continue;
      }
      if (character === "'" || character === '"') {
        quote = character;
        continue;
      }
      // Template-literal `${...}` braces remain structural here; counting every brace while a
      // backtick is open correctly carries the outer binding past nested interpolations.
      if (character === '{') depth += 1;
      else if (character === '}') depth -= 1;
    }
    if (depth === 0) expressions.push(source.slice(start, index - 1));
  }
  return expressions;
}

function addPartBindingHelperLiterals(source, expression, names) {
  for (const identifier of new Set(expression.match(/[A-Za-z_$][\w$]*/g) ?? [])) {
    const escapedIdentifier = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const declaration = source.match(
      new RegExp(`\\b(?:const|let)\\s+${escapedIdentifier}\\s*(?::\\s*[^=;]+)?=([^;]+);`),
    );
    const calledHelper = declaration?.[1].match(/^\s*(?:this\.)?([A-Za-z_$][\w$]*)\s*\(/)?.[1];
    if (!calledHelper) continue;
    const escapedHelper = calledHelper.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const helper = source.match(
      new RegExp(`\\b(?:function\\s+)?${escapedHelper}\\s*\\([^)]*\\)[^{]*\\{([\\s\\S]{0,1600})`),
    );
    if (helper) addLiteralPartNames(helper[1], names);
  }
}

function namesFromTemplates(source) {
  const names = new Set();
  for (const match of source.matchAll(/\bpart\s*=\s*["']([^"']+)["']/g)) {
    for (const name of match[1].trim().split(/\s+/)) {
      if (name) names.add(name);
    }
  }
  // A part built up dynamically (e.g. `const parts = ['day']; if (x) parts.push('day-today'); ...
  // part=${parts.join(' ')}`) never appears as a static part="..." literal above -- pick up both
  // its initial array-literal names and its pushed string-literal names, so this check doesn't
  // false-positive on that pattern (see <lr-date-picker>'s calendar-day parts).
  for (const match of source.matchAll(/\bparts\s*=\s*\[([^\]]*)\]/g)) {
    addLiteralPartNames(match[1], names);
  }
  for (const match of source.matchAll(/\bparts\.push\(\s*["']([^"']+)["']\s*\)/g)) {
    names.add(match[1]);
  }
  // `exportparts="inner:outer, inner2:outer2"` re-exposes a shadow-nested child's own part under
  // this component's own part namespace (e.g. <lr-svg-viewer>'s internal <lr-zoomable-frame>
  // forwarding `viewport` as `frame-viewport`) -- the exposed (right-hand, or bare when there's no
  // `:`) name is what a consumer's `::part(frame-viewport)` selector actually targets, so it counts
  // as rendered even though no literal `part="frame-viewport"` attribute exists on this component's
  // own template.
  for (const match of source.matchAll(/\bexportparts\s*=\s*["']([^"']+)["']/g)) {
    for (const mapping of match[1].split(',')) {
      const [inner, outer] = mapping.split(':').map((part) => part.trim());
      if (outer || inner) names.add(outer || inner);
    }
  }
  // A reusable export-parts vocabulary is normally assembled once as a string-valued constant and
  // bound with Lit (`exportparts=${CONTROL_EXPORT_PARTS}`). Resolve the finite quoted mappings in
  // that constant expression just as the dynamic `part=${pickerPart}` pass below resolves its
  // source identifier. This keeps semantic aliases shared across render branches without making
  // the manifest check mistake the indirection for an undocumented/unrendered part.
  for (const match of source.matchAll(/\bexportparts\s*=\s*\$\{\s*(\w+)\s*\}/g)) {
    const identifier = match[1];
    const escapedIdentifier = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const declaration = source.match(
      new RegExp(`\\bconst\\s+${escapedIdentifier}\\s*=([\\s\\S]*?);`),
    );
    if (!declaration) continue;
    for (const literal of stringLiterals(declaration[1])) {
      for (const mapping of literal.split(',')) {
        const [inner, outer] = mapping.split(':').map((part) => part.trim());
        if (outer || inner) names.add(outer || inner);
      }
    }
  }
  // A single dynamic part name resolved by a ternary chain into a local `part` variable (e.g.
  // `const part = interactive ? (isHighlighted ? 'line-button line-highlight' : 'line-button') :
  // ...;` in <lr-code-block-core>, or a `part: 'header-row' | 'data-row'` function parameter in
  // <lr-csv-viewer>) then gets applied via `part=${part}` in a template or, for the imperative
  // <mark>-highlight path in <lr-docx-viewer>/<lr-markdown>, `mark.setAttribute('part', part)`
  // -- neither shape is a literal `part="..."` attribute nor the `parts`/`parts.push` array pattern
  // above, so pick up every quoted string literal (space-separated multi-part values included)
  // from any declaration or parameter type named exactly `part`, matching this codebase's own
  // naming convention for that variable.
  for (const match of source.matchAll(/\b(?:const|let)\s+part\s*=([^;]+);/g)) {
    addLiteralPartNames(match[1], names);
  }
  for (const match of source.matchAll(/\bpart\s*:\s*((?:'[^']+'|"[^"]+")(?:\s*\|\s*(?:'[^']+'|"[^"]+"))*)/g)) {
    addLiteralPartNames(match[1], names);
  }
  // A static `part="prefix ...${identifier}"` attribute (a literal string with one interpolated
  // segment, not a fully dynamic binding) -- e.g. <lr-flow-node>'s
  // `part="handle handle-${kind}"` where `kind: 'input' | 'output'` is a typed function parameter.
  // Resolve every possible rendered value by cross-multiplying the literal prefix/suffix text
  // around the interpolation with that parameter's own string-literal union type (declared
  // anywhere else in the file), same source of truth as the `part: 'a' | 'b'` pass above.
  for (const match of source.matchAll(/\bpart\s*=\s*["']([^"']*)\$\{(\w+)\}([^"']*)["']/g)) {
    const [, prefix, identifier, suffix] = match;
    const typeMatch = source.match(
      new RegExp(`\\b${identifier}\\s*:\\s*((?:'[^']+'|"[^"]+")(?:\\s*\\|\\s*(?:'[^']+'|"[^"]+"))*)`),
    );
    const values = typeMatch ? stringLiterals(typeMatch[1]) : [];
    for (const value of values) {
      for (const name of `${prefix}${value}${suffix}`.trim().split(/\s+/)) {
        if (name) names.add(name);
      }
    }
    // The static (non-interpolated) tokens in the same attribute are still real, e.g. the
    // leading "handle" in "handle handle-${kind}".
    for (const name of `${prefix} ${suffix}`.trim().split(/\s+/)) {
      if (name) names.add(name);
    }
  }
  // A fully dynamic Lit binding such as `part=${pickerPart}` still has a finite set of
  // statically-resolvable names when its value comes from a local string expression (or a
  // string-literal union annotation). Resolve the binding's identifier rather than requiring
  // every helper to call its variable exactly `part` -- <lr-eval-run> and
  // <lr-graph-query-builder> both use descriptive names for two related parts in one helper.
  // Literals directly inside the binding cover the common inline conditional form first.
  for (const expression of litPartBindings(source)) {
    addLiteralPartNames(expression, names);
    addPartBindingHelperLiterals(source, expression, names);
  }
  for (const match of source.matchAll(/\bpart\s*=\s*\$\{(\w+)\}/g)) {
    const [, identifier] = match;
    const escapedIdentifier = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const declaration = source.match(
      new RegExp(`\\b(?:const|let)\\s+${escapedIdentifier}\\s*(?::\\s*[^=;]+)?=([^;]+);`),
    );
    if (declaration) {
      addLiteralPartNames(declaration[1], names);
      const calledHelper = declaration[1].match(/^\s*(?:this\.)?([A-Za-z_$][\w$]*)\s*\(/)?.[1];
      if (calledHelper) {
        const escapedHelper = calledHelper.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const helper = source.match(
          new RegExp(`\\b(?:function\\s+)?${escapedHelper}\\s*\\([^)]*\\)[^{]*\\{([\\s\\S]{0,1600})`),
        );
        if (helper) addLiteralPartNames(helper[1], names);
      }
    }
    const typeDeclaration = source.match(
      new RegExp(`\\b${escapedIdentifier}\\s*:\\s*((?:'[^']+'|"[^"]+")(?:\\s*\\|\\s*(?:'[^']+'|"[^"]+"))*)`),
    );
    if (typeDeclaration) {
      addLiteralPartNames(typeDeclaration[1], names);
    }
  }
  // Bound part vocabularies can live in a getter so subclasses append aliases without duplicating
  // a render template (`this.inputWrapperParts`), or in a method shared by multiple render branches
  // (`this.itemPartNames()`). Follow every matching same-directory getter/method, including the
  // superclass implementation concatenated by renderSurfaceFor(), and accept only quoted tokens.
  for (const match of source.matchAll(/\bpart\s*=\s*\$\{\s*(?:this|super)\.(\w+)/g)) {
    const identifier = match[1];
    const escapedIdentifier = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const memberPattern = new RegExp(
      `\\b(?:get\\s+)?${escapedIdentifier}\\s*(?:\\([^)]*\\))?\\s*(?::\\s*[^\\{]+)?\\{([\\s\\S]*?)\\n\\s*\\}`,
      'g',
    );
    for (const member of source.matchAll(memberPattern)) addLiteralPartNames(member[1], names);
  }
  // `element.setAttribute('part', 'literal')` -- the imperative-DOM equivalent of a literal
  // `part="literal"` template attribute, used by the shared <mark>-wrap highlight-painting
  // fallback (see internal/text-highlights.js's adopting viewers) since that shared module can't
  // emit a lit template attribute for a part name it doesn't itself own.
  for (const match of source.matchAll(/\.setAttribute\(\s*["']part["']\s*,\s*["']([^"']+)["']\s*\)/g)) {
    names.add(match[1]);
  }
  for (const match of source.matchAll(/\.setAttribute\(\s*["']part["']\s*,([\s\S]{0,300}?)\)/g)) {
    addLiteralPartNames(match[1], names);
  }
  // Imperative peer DOM receives public parts through this explicit sink. Follow literal values
  // directly, plus the finite selector/part tuple table used by the MapLibre adapter; selectors
  // themselves never count as evidence.
  for (const match of source.matchAll(/\baddPartToken\([^,]+,\s*["']([^"']+)["']\s*\)/g)) {
    names.add(match[1]);
  }
  if (/\baddPartToken\([^,]+,\s*part\s*\)/.test(source)) {
    for (const match of source.matchAll(/\[\s*["'][^"']+["']\s*,\s*["']([^"']+)["']\s*\]/g)) {
      names.add(match[1]);
    }
  }
  // A render method can deliberately accept a finite part token from its callers. Only literal
  // arguments to a method whose first parameter is actually bound to `part=${...}` are evidence.
  for (const signature of source.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(\s*([A-Za-z_$][\w$]*)\s*:\s*string\b/g)) {
    const [, methodName, parameter] = signature;
    const methodSlice = source.slice(signature.index, signature.index + 1800);
    if (!new RegExp(`\\bpart\\s*=\\s*\\$\\{\\s*${parameter}\\s*\\}`).test(methodSlice)) continue;
    const escapedMethod = methodName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    for (const call of source.matchAll(new RegExp(`\\bthis\\.${escapedMethod}\\(\\s*["']([^"']+)["']`, 'g'))) {
      names.add(call[1]);
    }
  }
  // Fetched SVGs retain sanitizer-approved third-party part names while adding Lyra's public
  // token through a Set. Only accept `.add('token')` when that exact Set is spread into a
  // `setAttribute('part', ...)` sink, so unrelated Set values cannot mask a missing rendered part.
  for (const match of source.matchAll(/\b(\w+)\.add\(\s*(['"])([^'"]+)\2\s*\)/g)) {
    const [, identifier, , literal] = match;
    const escapedIdentifier = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const reachesPart = new RegExp(
      `\\.setAttribute\\(\\s*["']part["']\\s*,\\s*\\[\\.\\.\\.${escapedIdentifier}\\]\\.join\\(`,
    ).test(source);
    if (reachesPart) {
      for (const name of literal.trim().split(/\s+/)) if (name) names.add(name);
    }
  }
  return names;
}

const sourceByModule = new Map();
for (const file of walk(sourceDir).filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts') && !file.endsWith('.stories.ts'))) {
  // Relative to packageDir (not sourceDir) so this matches the manifest's own module.path
  // convention exactly (e.g. "src/components/chart/chart.class.ts") -- a prior sourceDir-relative
  // computation silently produced "src/chart/chart.class.ts" here, which never matched any real
  // module.path, making every lookup below a permanent miss.
  const modulePath = path.relative(packageDir, file).replaceAll(path.sep, '/');
  sourceByModule.set(modulePath, fs.readFileSync(file, 'utf8'));
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const errors = [];
const tags = new Set();
for (const module of manifest.modules ?? []) {
  const source = sourceByModule.get(module.path);
  if (!source) continue;
  const documented = namesFromJSDoc(source);
  const rendered = namesFromTemplates(renderSurfaceFor(module.path, sourceByModule));
  for (const name of documented) {
    if (!rendered.has(name)) errors.push(`${module.path}: documented CSS part "${name}" is not rendered statically`);
  }
  for (const declaration of module.declarations ?? []) {
    if (declaration.tagName) {
      if (!/^lr-[a-z][a-z0-9-]*$/.test(declaration.tagName)) {
        errors.push(`${module.path}: invalid custom-element tag ${JSON.stringify(declaration.tagName)}`);
      }
      if (tags.has(declaration.tagName)) {
        errors.push(`duplicate custom-element tag ${JSON.stringify(declaration.tagName)}`);
      }
      tags.add(declaration.tagName);
      if (declaration.customElement !== true) {
        errors.push(`${module.path}: ${declaration.tagName} is not marked customElement`);
      }
    }
    for (const part of declaration.cssParts ?? []) {
      if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(part.name)) {
        errors.push(`${module.path}: invalid manifest CSS-part name ${JSON.stringify(part.name)}`);
      }
    }
    for (const event of declaration.events ?? []) {
      if (!/^[a-z][a-z0-9-]*$/.test(event.name) || event.name.startsWith('wa-')) {
        errors.push(`${module.path}: invalid or forbidden event name ${JSON.stringify(event.name)}`);
      }
    }
    for (const attribute of declaration.attributes ?? []) {
      const reviewed = REVIEWED_NONCANONICAL_ATTRIBUTES.has(`${declaration.tagName}\0${attribute.name}`);
      if ((!reviewed && !/^[a-z][a-z0-9-]*$/.test(attribute.name)) || attribute.name.startsWith('wa-')) {
        errors.push(`${module.path}: invalid or forbidden attribute name ${JSON.stringify(attribute.name)}`);
      }
    }
  }
}

const generatedManifest = await analyzeManifest({
  argv: ['analyze', '--litelement', '--quiet'],
  cwd: packageDir,
  noWrite: true,
});
const expectedText = `${JSON.stringify(compactManifest(generatedManifest))}\n`;
const actualText = fs.readFileSync(manifestPath, 'utf8');
if (actualText !== expectedText) {
  errors.push(
    'custom-elements.json is stale, expanded, or nondeterministic; run `pnpm --filter @aceshooting/lyra-ui manifest` and commit the result',
  );
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Lyra CEM CSS-part contract passed.');
}

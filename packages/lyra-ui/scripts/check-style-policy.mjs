import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const componentsRoot = join(process.cwd(), 'src', 'components');

// Web Awesome's public data-grid variables intentionally retain their unprefixed spelling so a
// consumer migration remains a mechanical tag rename. This is a closed, path-scoped compatibility
// set: the same names anywhere else, or a newly invented nineteenth alias, still fail below. Their
// declarations must continue to reference Lyra tokens, so the exception cannot smuggle raw design
// values into a component stylesheet.
const dataGridCompatibilityProperties = new Set([
  '--accent-color',
  '--background-color',
  '--border-color',
  '--border-radius',
  '--border-width',
  '--cell-padding',
  '--focus-ring',
  '--header-background',
  '--header-row-height',
  '--header-text-color',
  '--indent-size',
  '--max-height',
  '--row-height',
  '--row-hover-background',
  '--selected-background',
  '--stripe-background',
  '--text-color',
  '--transition-duration',
]);
const dataGridStyleFile = join(
  componentsRoot,
  'data',
  'data-grid',
  'data-grid.styles.ts'
);

// Closed exceptions for documented properties that are intentionally written by component code:
// declarative property/attribute bridges, read-only state outputs, per-record data channels, and
// mapped animation variables forwarded to an internal surface. Every other documented property is
// a consumer input and may not be declared by a production class any more than by its stylesheet.
const classCssPropertyDeclarationExemptions = new Set([
  'agent-tools/stack-trace/stack-trace.class.ts:--lr-stack-trace-max-height',
  'data/context-meter/context-meter.class.ts:--lr-context-meter-segment-color',
  'data/heatmap/heatmap.class.ts:--lr-heatmap-color-steps-gradient',
  'data/table/table.class.ts:--lr-table-heat-t',
  'data/table/table.class.ts:--lr-table-sticky-offset',
  'data/tree/tree-item.class.ts:--show-duration',
  'data/tree/tree-item.class.ts:--lr-tree-depth',
  'forms/code-editor/code-editor.class.ts:--lr-code-editor-tab-size',
  'forms/color-picker/color-picker.class.ts:--lr-color-picker-grid-hue',
  'forms/color-picker/color-picker.class.ts:--lr-color-picker-opacity-gradient',
  'forms/color-picker/color-picker.class.ts:--lr-color-picker-swatch-color',
  'layout/split-panel/split-panel.class.ts:--max',
  'layout/widget/widget.class.ts:--lr-widget-backdrop-inset',
  'layout/widget/widget.class.ts:--lr-widget-fullscreen-inset',
  'media/media-card/media-card.class.ts:--lr-media-card-max-height',
  'media/pan-zoom/pan-zoom.class.ts:--lr-pan-zoom-zoom',
  'media/zoomable-frame/zoomable-frame.class.ts:--lr-zoomable-frame-zoom',
  'overlays/dialog/dialog.class.ts:--show-duration',
  'overlays/drawer/drawer.class.ts:--show-duration',
  'overlays/overlay/dropdown.class.ts:--show-duration',
  'overlays/overlay/popover.class.ts:--show-duration',
  'overlays/overlay/tooltip.class.ts:--show-delay',
  'overlays/popup/popup.class.ts:--auto-size-available-height',
  'overlays/popup/popup.class.ts:--auto-size-available-width',
  'overlays/skeleton/skeleton.class.ts:--lr-skeleton-h',
  'overlays/skeleton/skeleton.class.ts:--lr-skeleton-w',
  'retrieval/embedding-explorer/embedding-explorer.class.ts:--lr-embedding-explorer-height',
  'retrieval/graph/graph.class.ts:--lr-graph-hull-fill',
  'retrieval/graph/graph.class.ts:--lr-link-color',
  'retrieval/graph/graph.class.ts:--lr-node-fill',
  'retrieval/source-picker/source-picker.class.ts:--lr-source-picker-depth',
  'utility/icon/icon.class.ts:--lr-icon-rotate',
  'utility/json-viewer/json-viewer.class.ts:--lr-json-viewer-max-height',
  'viewers/calendar-viewer/calendar-viewer.class.ts:--lr-calendar-viewer-max-height',
  'viewers/contact-viewer/contact-viewer.class.ts:--lr-contact-viewer-max-height',
  'viewers/csv-viewer/csv-viewer.class.ts:--lr-csv-viewer-max-height',
  'viewers/dataset-viewer/dataset-viewer.class.ts:--lr-dataset-viewer-max-height',
  'viewers/document-preview/document-preview.class.ts:--lr-document-preview-max-height',
  'viewers/document-preview/document-preview.class.ts:--lr-document-preview-progress',
  'viewers/docx-viewer/docx-viewer.class.ts:--lr-docx-viewer-max-height',
  'viewers/ebook-viewer/ebook-viewer.class.ts:--lr-ebook-viewer-max-height',
  'viewers/email-viewer/email-viewer.class.ts:--lr-email-viewer-max-height',
  'viewers/html-viewer/html-viewer.class.ts:--lr-html-viewer-max-height',
  'viewers/notebook-viewer/notebook-viewer.class.ts:--lr-notebook-viewer-max-height',
  'viewers/pdf-viewer/pdf-viewer.class.ts:--lr-pdf-viewer-height',
  'viewers/pptx-viewer/pptx-viewer.class.ts:--lr-pptx-viewer-max-height',
  'viewers/spreadsheet-viewer/spreadsheet-viewer.class.ts:--lr-spreadsheet-viewer-max-height',
  'viewers/svg-viewer/svg-viewer.class.ts:--lr-svg-viewer-max-height',
  'viewers/xml-viewer/xml-viewer.class.ts:--lr-xml-viewer-max-height',
]);

function styleFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) return styleFiles(file);
    return entry.name.endsWith('.styles.ts') ? [file] : [];
  });
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, (comment) =>
    comment.replace(/[^\n]/g, ' ')
  );
}

function documentedCssProperties(styleFile) {
  const directory = dirname(styleFile);
  const classSource = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.class.ts'))
    .map((entry) => readFileSync(join(directory, entry.name), 'utf8'))
    .join('\n');

  return new Set(
    [
      ...classSource.matchAll(/@cssprop\s+(?:\[)?(--[A-Za-z_][A-Za-z0-9_-]*)/g),
    ].map((match) => match[1])
  );
}

const findings = [];
const rawColor = /#[0-9a-fA-F]{3,8}\b|\brgb(?:a)?\(/;
const rawDimension = /(?<![\w-])[-+]?(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem|em|ch)\b/;
const semanticProperty =
  /^\s*(?:font-size|--[\w-]*font-size|font-weight|line-height|z-index|border(?:-[\w]+)*-radius)\s*:\s*([^;]+)/;
const customProperty = /^\s*(--[A-Za-z][A-Za-z0-9-]*)\s*:/;

for (const file of styleFiles(componentsRoot)) {
  const source = stripComments(readFileSync(file, 'utf8'));
  const publicCssProperties = documentedCssProperties(file);

  for (const entry of readdirSync(dirname(file), { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.class.ts')) continue;
    const classFile = join(dirname(file), entry.name);
    const classSource = stripComments(readFileSync(classFile, 'utf8'));
    const declarations = [
      ...classSource.matchAll(/(["'`])(--[A-Za-z_][A-Za-z0-9_-]*)\1\s*:/g),
      ...classSource.matchAll(/(["'`])(--[A-Za-z_][A-Za-z0-9_-]*)\s*:/g),
      ...classSource.matchAll(
        /\.setProperty\(\s*(["'`])(--[A-Za-z_][A-Za-z0-9_-]*)\1/g
      ),
    ];
    for (const declaration of declarations) {
      const name = declaration[2];
      const exemption = `${relative(componentsRoot, classFile)}:${name}`;
      if (
        !publicCssProperties.has(name) ||
        classCssPropertyDeclarationExemptions.has(exemption)
      ) {
        continue;
      }
      const line = classSource.slice(0, declaration.index).split('\n').length;
      findings.push(
        `${classFile}:${line}: documented CSS custom property must not be declared by component runtime code (${name})`
      );
    }
  }

  // `container-type: inline-size` applies inline-size containment to the declaration's own box,
  // which removes content-based intrinsic sizing. In a shrink-to-fit flex/grid placement that
  // otherwise resolves the component to zero. Keep the fallback on the exact query-container rule
  // (host or internal part), so every new responsive surface is safe without relying on a distant
  // consumer allocation.
  for (const match of source.matchAll(
    /container-type\s*:\s*inline-size\s*;/g
  )) {
    const ruleStart = source.lastIndexOf('{', match.index);
    const ruleEnd = source.indexOf('}', match.index);
    const ruleBody = source.slice(ruleStart + 1, ruleEnd);
    if (!/contain-intrinsic-inline-size\s*:/.test(ruleBody)) {
      const line = source.slice(0, match.index).split('\n').length;
      findings.push(
        `${file}:${line}: inline-size query container must declare contain-intrinsic-inline-size in the same rule`
      );
    }
  }

  source.split('\n').forEach((line, index) => {
    if (line.includes('@media') || line.includes('@container')) return;

    if (rawColor.test(line) || /\bblack\b/.test(line)) {
      findings.push(`${file}:${index + 1}: raw color literal`);
    }
    if (rawDimension.test(line)) {
      findings.push(`${file}:${index + 1}: raw dimension literal`);
    }

    const custom = customProperty.exec(line)?.[1];
    const isDataGridCompatibilityProperty =
      file === dataGridStyleFile &&
      custom !== undefined &&
      dataGridCompatibilityProperties.has(custom);
    if (
      custom &&
      !/^(?:--lr-|--shiki-)/.test(custom) &&
      !isDataGridCompatibilityProperty
    ) {
      findings.push(
        `${file}:${
          index + 1
        }: custom property must use a library or integration prefix (${custom})`
      );
    }
    if (isDataGridCompatibilityProperty && !line.includes('var(--lr-')) {
      findings.push(
        `${file}:${
          index + 1
        }: data-grid compatibility property must resolve through a --lr-* token (${custom})`
      );
    }

    // A documented CSS custom property is a consumer input, so it must remain undeclared inside
    // the component's own shadow stylesheet. Any local declaration -- on :host, a state selector,
    // or an internal part -- wins over the value inherited from a theme/container ancestor. It can
    // also make a direct host value lose once the declaration sits on a descendant. Defaults belong
    // in the consuming var() fallback, or in a private --_lr-* value selected by size/state rules.
    // Scanning every declaration rather than only :host blocks keeps the invariant true across
    // refactors and catches multiple declarations written on one line.
    for (const declaration of line.matchAll(
      /(--[A-Za-z_][A-Za-z0-9_-]*)\s*:/g
    )) {
      const name = declaration[1];
      if (publicCssProperties.has(name)) {
        findings.push(
          `${file}:${
            index + 1
          }: documented CSS custom property must be consumed through a use-site/private fallback, not declared (${name})`
        );
      }
    }

    const property = semanticProperty.exec(line);
    if (property) {
      const value = property[1].trim();
      const isGeometricRadius =
        /border(?:-[\w]+)*-radius/.test(property[0]) &&
        /^(?:0|50%)(?:\s|$)/.test(value);
      const isUnitlessZeroLineHeight =
        /line-height/.test(property[0]) && /^0(?:\s|$)/.test(value);
      if (
        !isGeometricRadius &&
        !isUnitlessZeroLineHeight &&
        /^(?:[-+]?\d|\.\d|bold\b)/.test(value)
      ) {
        findings.push(
          `${file}:${index + 1}: semantic property has a numeric literal`
        );
      }
    }
  });
}

if (findings.length > 0) {
  console.error(`Style policy failed with ${findings.length} finding(s):`);
  for (const finding of findings) console.error(`- ${finding}`);
  process.exitCode = 1;
} else {
  console.log(
    `Style policy passed for ${styleFiles(componentsRoot).length} style files.`
  );
}

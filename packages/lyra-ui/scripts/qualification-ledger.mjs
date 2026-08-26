import fs from 'node:fs';
import path from 'node:path';
import { parseSync } from 'oxc-parser';

import {
  QUALIFICATION_DIMENSIONS,
  axeEvidenceForTag,
  normalizeExemptions,
  readComponentTestFiles,
} from './qualification-core.mjs';

const QUALIFICATION_LEDGER_SCHEMA_VERSION = 1;

export function validateVisualQualificationManifest(manifest, inventory) {
  const findings = [];
  if (manifest?.schemaVersion !== 1) findings.push('visual qualification manifest must use schemaVersion 1');
  const tags = new Set((inventory.components ?? []).map((component) => component.tag));
  const stories = new Map();
  for (const story of manifest?.stories ?? []) {
    if (typeof story?.id !== 'string' || stories.has(story.id)) {
      findings.push(`visual manifest has an invalid or duplicate story id ${String(story?.id)}`);
      continue;
    }
    stories.set(story.id, story);
    if (!manifest?.coverageProfiles?.[story.profile]) findings.push(`${story.id}: unknown visual coverage profile`);
  }
  const enrolledStories = new Set();
  for (const [tag, ids] of Object.entries(manifest?.tagCoverage ?? {})) {
    if (!tags.has(tag)) findings.push(`${tag}: visual manifest tag is not in the public inventory`);
    if (!Array.isArray(ids) || ids.length === 0) findings.push(`${tag}: visual enrollment must name at least one story`);
    for (const id of ids ?? []) {
      if (!stories.has(id)) findings.push(`${tag}: visual enrollment references unknown story ${id}`);
      enrolledStories.add(id);
    }
  }
  for (const id of stories.keys()) {
    if (!enrolledStories.has(id) && typeof manifest?.untaggedStories?.[id] !== 'string') {
      findings.push(`${id}: visual story is neither assigned to a tag nor reviewed as untagged`);
    }
  }
  const review = manifest?.baselineReview;
  if (review?.status === 'pending-human-review') {
    if (review.reviewer !== null || review.reviewedAt !== null) findings.push('pending visual review must not invent a reviewer or date');
    if (manifest?.provenance?.humanVisualReview !== false) findings.push('pending visual review requires provenance.humanVisualReview=false');
  } else if (review?.status === 'complete') {
    if (!review.reviewer || !/^\d{4}-\d{2}-\d{2}$/.test(review.reviewedAt ?? '')) {
      findings.push('complete visual review requires reviewer and ISO review date');
    }
    if (manifest?.provenance?.humanVisualReview !== true) findings.push('complete visual review requires provenance.humanVisualReview=true');
  } else {
    findings.push('visual baseline review status is missing or unsupported');
  }
  return findings;
}

const relative = (root, file) => path.relative(root, file).replaceAll('\\', '/');

function firstSignal(files, pattern, packageDir) {
  for (const { file, source } of files) {
    const match = pattern.exec(source);
    pattern.lastIndex = 0;
    if (!match) continue;
    return {
      file: relative(packageDir, file),
      line: source.slice(0, match.index).split('\n').length,
    };
  }
  return null;
}

function readSourceFiles(component, packageDir) {
  const directory = path.join(packageDir, path.dirname(component.classModule));
  let entries = [];
  try {
    entries = fs.readdirSync(directory);
  } catch {
    return [];
  }
  return entries
    .filter((file) =>
      file.endsWith('.ts') &&
      !file.endsWith('.test.ts') &&
      !file.endsWith('.stories.ts') &&
      !file.endsWith('.styles.ts'))
    .sort()
    .map((file) => ({ file: path.join(directory, file), source: fs.readFileSync(path.join(directory, file), 'utf8') }));
}

function readStyleFiles(component, packageDir) {
  const directory = path.join(packageDir, path.dirname(component.classModule));
  let entries = [];
  try {
    entries = fs.readdirSync(directory);
  } catch {
    return [];
  }
  return entries
    .filter((file) => file.endsWith('.styles.ts'))
    .sort()
    .map((file) => ({ file: path.join(directory, file), source: fs.readFileSync(path.join(directory, file), 'utf8') }));
}

function evidence(signal, kind) {
  return signal ? [{ ...signal, kind }] : [];
}

function sourceDimension({ applicable, signal, kind, limitation }) {
  if (!applicable) {
    return {
      applicability: 'not-applicable',
      status: 'not-applicable',
      evidence: [],
      limitation,
    };
  }
  return {
    applicability: 'applicable',
    status: signal ? 'source-evidence' : 'not-recorded',
    evidence: evidence(signal, kind),
    ...(limitation ? { limitation } : {}),
  };
}

function walkSyntax(node, visit) {
  if (!node || typeof node !== 'object') return;
  visit(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent' || key === 'type' || key === 'start' || key === 'end') continue;
    if (Array.isArray(value)) {
      for (const child of value) walkSyntax(child, visit);
    } else if (value && typeof value === 'object') {
      walkSyntax(value, visit);
    }
  }
}

function syntax(file) {
  const parsed = parseSync(file.file, file.source, { lang: 'ts', sourceType: 'module' });
  if (parsed.errors.length > 0) {
    throw new SyntaxError(
      `${file.file}: qualification evidence parser failed: ${parsed.errors[0].message}`,
    );
  }
  return parsed.program;
}

function sourceSignal(file, index, packageDir) {
  return {
    file: relative(packageDir, file.file),
    line: file.source.slice(0, index).split('\n').length,
  };
}

function unwrapExpression(node) {
  while (
    node &&
    ['TSAsExpression', 'TSSatisfiesExpression', 'TSNonNullExpression', 'ChainExpression'].includes(
      node.type,
    )
  ) {
    node = node.expression;
  }
  return node;
}

function literalString(node) {
  node = unwrapExpression(node);
  return node?.type === 'Literal' && typeof node.value === 'string' ? node.value : undefined;
}

function templateHasRenderedInteraction(node) {
  if (node.type !== 'TaggedTemplateExpression' || node.tag?.name !== 'html') return false;
  const raw = node.quasi.quasis.map((quasi) => quasi.value.raw).join(' ');
  return /<(?:button|input|select|textarea|summary)\b|<a\b[^>]*\bhref\s*=|\brole\s*=\s*["']?(?:button|menu|tab|tree|grid|listbox|slider|switch)\b|\btabindex\s*=|@(?:click|keydown|keyup)\s*=/i.test(
    raw,
  );
}

function implementationInteractionSignal(files, packageDir) {
  for (const file of files) {
    let found;
    walkSyntax(syntax(file), (node) => {
      if (found) return;
      if (templateHasRenderedInteraction(node)) found = sourceSignal(file, node.start, packageDir);
      if (
        node.type === 'CallExpression' &&
        node.callee?.type === 'MemberExpression' &&
        ['click', 'keydown', 'keyup'].includes(literalString(node.arguments?.[0]) ?? '') &&
        node.callee.property?.name === 'addEventListener'
      ) {
        found = sourceSignal(file, node.start, packageDir);
      }
    });
    if (found) return found;
  }
  return null;
}

function keyboardTestSignal(files, packageDir) {
  for (const file of files) {
    let found;
    walkSyntax(syntax(file), (node) => {
      if (found || node.type !== 'Identifier') return;
      if (/^(?:KeyboardEvent|sendKeys|pressTab)$/.test(node.name)) {
        found = sourceSignal(file, node.start, packageDir);
      }
    });
    if (found) return found;
  }
  return null;
}

function finiteDirectionArrays(program) {
  const values = new Map();
  walkSyntax(program, (node) => {
    if (node.type !== 'VariableDeclarator' || node.id?.type !== 'Identifier') return;
    const expression = unwrapExpression(node.init);
    if (expression?.type !== 'ArrayExpression') return;
    const directions = new Set(expression.elements.map(literalString).filter(Boolean));
    if (directions.has('ltr') && directions.has('rtl')) values.set(node.id.name, directions);
  });
  return values;
}

function templateBindsDirection(node, identifier) {
  if (node.type !== 'TemplateLiteral') return false;
  return node.expressions.some(
    (expression, index) =>
      unwrapExpression(expression)?.type === 'Identifier' &&
      unwrapExpression(expression).name === identifier &&
      /\bdir\s*=\s*$/.test(node.quasis[index]?.value.raw ?? ''),
  );
}

function rtlTestSignal(files, packageDir) {
  for (const file of files) {
    const program = syntax(file);
    const directionArrays = finiteDirectionArrays(program);
    let found;
    walkSyntax(program, (node) => {
      if (found) return;
      if (node.type === 'TemplateElement' && /\bdir\s*=\s*["']rtl["']/.test(node.value.raw)) {
        found = sourceSignal(file, node.start, packageDir);
        return;
      }
      if (
        node.type === 'AssignmentExpression' &&
        node.left?.type === 'MemberExpression' &&
        node.left.property?.name === 'dir' &&
        literalString(node.right) === 'rtl'
      ) {
        found = sourceSignal(file, node.start, packageDir);
        return;
      }
      if (
        node.type === 'CallExpression' &&
        node.callee?.type === 'MemberExpression' &&
        node.callee.property?.name === 'setAttribute' &&
        literalString(node.arguments?.[0]) === 'dir' &&
        literalString(node.arguments?.[1]) === 'rtl'
      ) {
        found = sourceSignal(file, node.start, packageDir);
        return;
      }
      if (
        node.type === 'BinaryExpression' &&
        ['==', '==='].includes(node.operator) &&
        (literalString(node.left) === 'rtl' || literalString(node.right) === 'rtl')
      ) {
        const compared = literalString(node.left) === 'rtl' ? node.right : node.left;
        if (
          compared?.type === 'MemberExpression' &&
          ['dir', 'effectiveDirection'].includes(compared.property?.name)
        ) {
          found = sourceSignal(file, node.start, packageDir);
          return;
        }
      }
      if (node.type !== 'ForOfStatement') return;
      const declaration = node.left?.type === 'VariableDeclaration' ? node.left.declarations[0] : null;
      const identifier = declaration?.id?.type === 'Identifier' ? declaration.id.name : undefined;
      const right = unwrapExpression(node.right);
      const inlineDirections = right?.type === 'ArrayExpression'
        ? new Set(right.elements.map(literalString).filter(Boolean))
        : right?.type === 'Identifier'
          ? directionArrays.get(right.name)
          : undefined;
      if (!identifier || !inlineDirections?.has('ltr') || !inlineDirections.has('rtl')) return;
      let bindsDirection = false;
      walkSyntax(node.body, (child) => {
        if (templateBindsDirection(child, identifier)) bindsDirection = true;
      });
      if (bindsDirection) found = sourceSignal(file, node.start, packageDir);
    });
    if (found) return found;
  }
  return null;
}

function stripCssNonCode(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, ' ');
}

function motionImplementationSignal(files, packageDir) {
  for (const file of files) {
    let found;
    walkSyntax(syntax(file), (node) => {
      if (found) return;
      if (node.type === 'TaggedTemplateExpression' && node.tag?.name === 'css') {
        const css = stripCssNonCode(node.quasi.quasis.map((quasi) => quasi.value.raw).join(' '));
        if (/(?:^|[;{])\s*(?:transition(?:-[\w-]+)?|animation(?:-[\w-]+)?)\s*:/i.test(css)) {
          // CSS template evidence is reported in the template's own virtual line space; unlike a
          // TypeScript call-site line, leading wrapper whitespace is not part of the stylesheet.
          found = { file: relative(packageDir, file.file), line: 1 };
        }
      }
      if (
        node.type === 'CallExpression' &&
        node.callee?.type === 'MemberExpression' &&
        node.callee.property?.name === 'animate'
      ) {
        found = sourceSignal(file, node.start, packageDir);
      }
    });
    if (found) return found;
  }
  return null;
}

function motionTestSignal(files, packageDir) {
  for (const file of files) {
    let found;
    walkSyntax(syntax(file), (node) => {
      if (found) return;
      if (
        node.type === 'Identifier' &&
        /^(?:stubReducedMotion|motionPreference|prefersReducedMotion)$/.test(node.name)
      ) {
        found = sourceSignal(file, node.start, packageDir);
      } else if (
        node.type === 'Literal' &&
        typeof node.value === 'string' &&
        /\(prefers-reduced-motion:\s*(?:reduce|no-preference)\)/.test(node.value)
      ) {
        found = sourceSignal(file, node.start, packageDir);
      }
    });
    if (found) return found;
  }
  return null;
}

/** Parsed/structured applicability signals used by the generated qualification ledger. */
export function qualificationApplicabilitySignals({
  component,
  packageDir,
  sources,
  styles,
  tests,
  interactiveTags,
}) {
  const allImplementation = [...sources, ...styles];
  let interactiveSignal = implementationInteractionSignal(allImplementation, packageDir);
  if (!interactiveSignal && (component.optionalPeers ?? []).includes('maplibre-gl')) {
    interactiveSignal = { file: component.classModule, line: 1 };
  }
  if (
    !interactiveSignal &&
    [...(component.dependencies?.direct ?? []), ...(component.dependencies?.transitive ?? [])].some(
      (tag) => interactiveTags.has(tag),
    )
  ) {
    interactiveSignal = { file: component.classModule, line: 1 };
  }

  return {
    keyboardSignal: keyboardTestSignal(tests, packageDir),
    interactiveSignal,
    rtlSignal: rtlTestSignal(tests, packageDir),
    motionImplementation: motionImplementationSignal(allImplementation, packageDir),
    motionSignal: motionTestSignal(tests, packageDir),
    narrowSignal: firstSignal(
      tests,
      /(?:inline-size|width)\s*[:=]\s*['"]?320px|\b320px\b|narrow allocation|narrow layout/i,
      packageDir,
    ),
    peerSignal: firstSignal(
      tests,
      /(?:peer|loader).*(?:fail|reject|null)|(?:fail|reject).*(?:peer|loader)|role=['"]alert['"]/i,
      packageDir,
    ),
    securitySignal: firstSignal(
      [...allImplementation, ...tests],
      /safeFetchUrl|readResponse(?:ArrayBuffer|Text)|DOMPurify|sanitize\s*\(|unsafeHTML|unsafeSVG|LyraResourceLimitError|generation\s*!==/,
      packageDir,
    ),
  };
}

export function parseSsrSource(source, tags) {
  const inventoryTags = new Set(tags);
  const clientReasons = new Map();
  const declarations = [...source.matchAll(/\[\s*tag\s*\(/g)].length;
  const parsed = [...source.matchAll(
    /\[\s*tag\(\s*(['"])([a-z0-9-]+)\1\s*\)\s*\]\s*:\s*reason\(\s*(['"])([a-z0-9-]+)\3\s*,/g,
  )];
  if (parsed.length !== declarations) {
    throw new Error('SSR qualification could not parse every client-render declaration; update the parser instead of defaulting an unknown entry to render-and-hydrate');
  }
  for (const match of parsed) {
    const tag = `lr-${match[2]}`;
    if (!inventoryTags.has(tag)) throw new Error(`SSR qualification found unknown client-render tag ${tag}`);
    if (clientReasons.has(tag)) throw new Error(`SSR qualification found duplicate client-render declaration for ${tag}`);
    clientReasons.set(tag, { code: match[4] });
  }
  return new Map(tags.map((tag) => [tag, clientReasons.has(tag)
    ? { mode: 'client-render', reason: clientReasons.get(tag).code }
    : { mode: 'render-and-hydrate', reason: null }]));
}

function visualForTag(tag, visualManifest) {
  const stories = [...(visualManifest?.tagCoverage?.[tag] ?? [])].sort();
  const byStory = new Map((visualManifest?.stories ?? []).map((story) => [story.id, story]));
  const profiles = visualManifest?.coverageProfiles ?? {};
  const axes = new Set();
  for (const id of stories) {
    const story = byStory.get(id);
    for (const axis of profiles[story?.profile]?.axes ?? []) axes.add(axis);
  }
  const review = visualManifest?.baselineReview ?? {
    status: 'pending-human-review',
    reviewer: null,
    reviewedAt: null,
    knownLimitations: ['No visual coverage manifest was available when this ledger was generated.'],
  };
  return { stories, axes: [...axes].sort(), review };
}

function visualProvenance(visualManifest) {
  const provenance = visualManifest?.provenance ?? visualManifest?.captureProvenance;
  if (!provenance) {
    return {
      generator: null,
      generatedBy: 'unknown',
      generatedOn: null,
      sourceCommit: null,
      sourceTreeDirty: null,
      browser: null,
      platform: null,
      humanVisualReview: false,
    };
  }
  return {
    generator: provenance.generator ?? null,
    generatedBy: provenance.generatedBy ?? provenance.producer ?? 'unknown',
    generatedOn: provenance.generatedOn ?? null,
    sourceCommit: provenance.sourceCommit ?? provenance.sourceTree?.baseCommit ?? null,
    sourceTreeDirty: provenance.sourceTree?.dirty ?? null,
    browser: provenance.browser ?? null,
    platform: provenance.platform ?? null,
    humanVisualReview: provenance.humanVisualReview === true,
  };
}

function accessibilityFor(component, tests, packageDir, exemption) {
  const candidates = tests
    .flatMap(({ file, source }) => axeEvidenceForTag({ file, source, tag: component.tag }))
    .map((entry) => ({ ...entry, file: relative(packageDir, entry.file) }))
    .sort((a, b) => {
      const rank = (state) => state === 'open' ? 0 : state === 'populated' ? 1 : 2;
      return rank(a.state) - rank(b.state) || a.file.localeCompare(b.file) || a.line - b.line;
    });
  const qualified = candidates.filter((entry) => entry.state === 'open' || entry.state === 'populated');
  if (qualified.length > 0) {
    return {
      applicability: 'applicable',
      status: 'automated',
      evidence: qualified,
      exemption: null,
    };
  }
  if (exemption) {
    return {
      applicability: 'applicable',
      status: 'reviewed-exemption',
      evidence: candidates,
      exemption: {
        scope: exemption.scope,
        reason: exemption.reason,
        reviewer: exemption.reviewer,
        recordedAt: exemption.recordedAt,
        evidence: exemption.evidence,
        humanReview: exemption.humanReview ?? 'not-claimed',
      },
    };
  }
  return {
    applicability: 'applicable',
    status: 'missing',
    evidence: candidates,
    exemption: null,
  };
}

function componentRecord({ component, packageDir, exemptions, visualManifest, ssr, interactiveTags }) {
  const directory = path.join(packageDir, path.dirname(component.classModule));
  const tests = readComponentTestFiles(directory);
  const sources = readSourceFiles(component, packageDir);
  const styles = readStyleFiles(component, packageDir);
  const exemption = exemptions.get(`${component.tag}\0accessibility`);
  const accessibility = accessibilityFor(component, tests, packageDir, exemption);

  const {
    keyboardSignal,
    interactiveSignal,
    rtlSignal,
    motionImplementation,
    motionSignal,
    narrowSignal,
    peerSignal,
    securitySignal,
  } = qualificationApplicabilitySignals({
    component,
    packageDir,
    sources,
    styles,
    tests,
    interactiveTags,
  });
  const visual = visualForTag(component.tag, visualManifest);
  const peerApplicable = (component.optionalPeers ?? []).length > 0;
  const securityApplicable = peerApplicable || Boolean(securitySignal);
  const ssrEntry = ssr.get(component.tag);

  const dimensions = {
    accessibility,
    keyboard: sourceDimension({
      applicable: Boolean(interactiveSignal || keyboardSignal),
      signal: keyboardSignal,
      kind: 'component keyboard assertion signal',
      limitation: !interactiveSignal && !keyboardSignal
        ? 'No component-owned interactive surface was detected; applicability is re-evaluated when the source changes.'
        : keyboardSignal
          ? undefined
          : 'Interactive implementation detected without a recorded component keyboard-test signal.',
    }),
    rtl: sourceDimension({
      applicable: true,
      signal: rtlSignal,
      kind: 'rendered RTL test signal',
      limitation: rtlSignal ? undefined : 'No component-local rendered RTL assertion is recorded.',
    }),
    reducedMotion: sourceDimension({
      applicable: Boolean(motionImplementation),
      signal: motionSignal,
      kind: 'reduced-motion test signal',
      limitation: motionImplementation
        ? motionSignal ? undefined : 'Component-owned motion is present without a recorded two-branch reduced-motion test signal.'
        : 'No component-owned motion declaration or programmatic animation was detected.',
    }),
    narrowAllocation: sourceDimension({
      applicable: true,
      signal: narrowSignal,
      kind: '320px allocation test signal',
      limitation: narrowSignal ? undefined : 'No component-local 320px allocation assertion is recorded.',
    }),
    engines: {
      applicability: 'applicable',
      status: 'configured-automation',
      evidence: [
        { file: '.github/workflows/ci.yml', kind: 'Chromium full suite and Firefox/WebKit contract subset' },
        { file: '.github/workflows/full-engine.yml', kind: 'weekly/manual Firefox and WebKit full-suite shards' },
      ],
      limitation: 'This record proves CI configuration, not a particular green run; Firefox/WebKit full coverage is weekly/manual rather than per commit.',
    },
    ssrHydration: {
      applicability: 'applicable',
      status: 'declared-and-gated',
      mode: ssrEntry?.mode ?? 'unclassified',
      reason: ssrEntry?.reason ?? null,
      evidence: [
        { file: 'src/ssr.ts', kind: 'machine-readable SSR support matrix' },
        { file: 'scripts/check-ssr.mjs', kind: 'server render crawl' },
        { file: 'scripts/check-hydration.mjs', kind: 'browser hydration identity crawl' },
      ],
      limitation: 'The ledger classifies the declared mode and gate ownership; CI run results are reported separately.',
    },
    visual: {
      applicability: 'applicable',
      status: visual.stories.length > 0 ? visual.review.status : 'not-enrolled',
      stories: visual.stories,
      axes: visual.axes,
      evidence: visual.stories.length > 0 ? [{ file: 'visual-baselines/manifest.json', kind: 'automated screenshot enrollment' }] : [],
      reviewer: visual.review.reviewer ?? null,
      reviewedAt: visual.review.reviewedAt ?? null,
      limitation: visual.stories.length > 0
        ? 'Automated captures are enrolled, but complete human visual approval is not recorded.'
        : 'No visual-regression story is enrolled for this tag.',
    },
    peerFailure: sourceDimension({
      applicable: peerApplicable,
      signal: peerSignal,
      kind: 'optional-peer failure-path test signal',
      limitation: peerApplicable
        ? 'A source signal does not substitute for a reviewed visible, localized, fail-closed failure-path assertion.'
        : 'The component declares no optional peer dependencies.',
    }),
    security: sourceDimension({
      applicable: securityApplicable,
      signal: securitySignal,
      kind: 'remote-content or trust-boundary source signal',
      limitation: securityApplicable
        ? 'Security applicability is tracked; source signals do not constitute a penetration test or external audit.'
        : 'No optional-peer or remote-content trust boundary was detected in the component directory.',
    }),
    forcedColors: {
      applicability: 'applicable',
      status: visual.axes.includes('forced-colors') ? 'enrolled-automated-visual' : 'not-enrolled',
      stories: visual.stories.filter((id) => {
        const story = (visualManifest?.stories ?? []).find((entry) => entry.id === id);
        return (visualManifest?.coverageProfiles?.[story?.profile]?.axes ?? []).includes('forced-colors');
      }),
      evidence: visual.axes.includes('forced-colors')
        ? [{ file: 'visual-baselines/manifest.json', kind: 'forced-colors emulated screenshot axis' }]
        : [],
      limitation: visual.axes.includes('forced-colors')
        ? 'Automated emulation and pixel probes do not constitute Windows High Contrast manual verification.'
        : 'No forced-colors visual capture is enrolled for this tag.',
    },
    assistiveTechnology: {
      applicability: 'applicable',
      status: 'not-verified',
      evidence: [],
      reviewer: null,
      reviewedAt: null,
      limitation: 'No screen reader, voice-control tool, or Windows High Contrast pairing has been manually verified.',
    },
  };

  const evidenceGaps = Object.entries(dimensions)
    .filter(([, dimension]) =>
      ['missing', 'not-recorded', 'not-enrolled', 'not-verified', 'unclassified'].includes(dimension.status))
    .map(([dimension]) => dimension);

  return {
    tag: component.tag,
    family: component.family,
    maturity: component.maturity?.status ?? 'unclassified',
    qualification: {
      status: evidenceGaps.length > 0 || ssrEntry == null ? 'incomplete' : 'pending-human-review',
      humanReview: 'pending',
      reviewer: null,
      reviewedAt: null,
      evidenceGaps,
    },
    dimensions,
    knownLimitations: [...new Set(
      Object.values(dimensions)
        .map((dimension) => dimension.limitation)
        .filter((limitation) => typeof limitation === 'string' && limitation.length > 0),
    )],
    provenance: {
      inventory: 'scripts/fixtures/component-inventory.json',
      tests: tests.map(({ file }) => relative(packageDir, file)),
      visual: 'visual-baselines/manifest.json',
      ssr: 'src/ssr.ts',
    },
  };
}

function interactiveInventoryTags(inventory, packageDir) {
  const interactiveTags = new Set();
  for (const component of inventory.components ?? []) {
    const implementation = [
      ...readSourceFiles(component, packageDir),
      ...readStyleFiles(component, packageDir),
    ];
    if (
      implementationInteractionSignal(implementation, packageDir) ||
      (component.optionalPeers ?? []).includes('maplibre-gl')
    ) {
      interactiveTags.add(component.tag);
    }
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const component of inventory.components ?? []) {
      if (interactiveTags.has(component.tag)) continue;
      const dependencies = [
        ...(component.dependencies?.direct ?? []),
        ...(component.dependencies?.transitive ?? []),
      ];
      if (dependencies.some((tag) => interactiveTags.has(tag))) {
        interactiveTags.add(component.tag);
        changed = true;
      }
    }
  }
  return interactiveTags;
}

export function buildQualificationLedger({ packageDir, inventory, exemptions, visualManifest, ssrSource }) {
  const normalized = normalizeExemptions(exemptions);
  if (normalized.problems.length > 0) throw new Error(normalized.problems.join('\n'));
  const tags = inventory.components.map((component) => component.tag);
  const ssr = parseSsrSource(ssrSource, tags);
  const interactiveTags = interactiveInventoryTags(inventory, packageDir);
  const components = inventory.components
    .map((component) => componentRecord({
      component,
      packageDir,
      exemptions: normalized.byKey,
      visualManifest,
      ssr,
      interactiveTags,
    }))
    .sort((a, b) => a.tag.localeCompare(b.tag));
  const count = (dimension, status) => components.filter((component) => component.dimensions[dimension].status === status).length;
  return {
    $comment: 'Generated per-tag qualification evidence. Maturity is copied only for presentation and never derived from qualification status.',
    schemaVersion: QUALIFICATION_LEDGER_SCHEMA_VERSION,
    generatedFrom: {
      inventory: 'scripts/fixtures/component-inventory.json',
      exemptions: 'scripts/qualification-exemptions.json',
      visual: 'visual-baselines/manifest.json',
      ssr: 'src/ssr.ts',
    },
    humanReview: {
      status: 'pending',
      reviewer: null,
      reviewedAt: null,
      claim: 'No library-wide human design, assistive-technology, or exhaustive visual review is recorded.',
    },
    browserSupport: {
      evidenceStatus: 'workflow-configuration-only',
      chromium: { coverage: 'full-suite-current-stable', workflow: '.github/workflows/ci.yml' },
      firefox: { coverage: 'per-commit-contract-subset-plus-weekly-full', workflow: '.github/workflows/full-engine.yml' },
      webkit: { coverage: 'per-commit-contract-subset-plus-weekly-full', workflow: '.github/workflows/full-engine.yml' },
    },
    baselineProvenance: visualProvenance(visualManifest),
    knownLimitations: [
      ...(visualManifest?.baselineReview?.knownLimitations ?? ['Visual baseline limitations were not available.']),
      'No assistive technology pairing has been manually verified.',
      'Firefox and WebKit run a per-commit contract subset; their complete suites are weekly/manual.',
      'Source-signal dimensions identify evidence locations but do not turn regex presence into a behavioral pass.',
    ],
    summary: {
      componentCount: components.length,
      automatedAccessibility: count('accessibility', 'automated'),
      accessibilityExemptions: count('accessibility', 'reviewed-exemption'),
      accessibilityMissing: count('accessibility', 'missing'),
      visualEnrolled: components.filter((component) => component.dimensions.visual.stories.length > 0).length,
      forcedColorsEnrolled: count('forcedColors', 'enrolled-automated-visual'),
      assistiveTechnologyVerified: components.filter((component) => component.dimensions.assistiveTechnology.status === 'verified').length,
    },
    components,
  };
}

export function validateQualificationLedger(ledger, inventory) {
  const findings = [];
  if (ledger?.schemaVersion !== QUALIFICATION_LEDGER_SCHEMA_VERSION) findings.push('unsupported qualification ledger schema');
  const records = Array.isArray(ledger?.components) ? ledger.components : [];
  const expectedTags = inventory.components.map((component) => component.tag).sort();
  const actualTags = records.map((component) => component.tag).sort();
  if (JSON.stringify(actualTags) !== JSON.stringify(expectedTags)) findings.push('qualification ledger tags do not exactly match component inventory');
  const inventoryByTag = new Map(inventory.components.map((component) => [component.tag, component]));
  for (const record of records) {
    const expected = inventoryByTag.get(record.tag);
    if (!expected) continue;
    if (record.maturity !== expected.maturity?.status) findings.push(`${record.tag}: maturity presentation is stale`);
    const keys = Object.keys(record.dimensions ?? {}).sort();
    if (JSON.stringify(keys) !== JSON.stringify([...QUALIFICATION_DIMENSIONS].sort())) {
      findings.push(`${record.tag}: qualification dimensions are incomplete or unknown`);
    }
    if (!['automated', 'reviewed-exemption'].includes(record.dimensions?.accessibility?.status)) {
      findings.push(`${record.tag}: accessibility is not qualified`);
    }
    if (
      record.dimensions?.accessibility?.status === 'reviewed-exemption' &&
      !record.dimensions.accessibility.evidence?.some((entry) => entry.state === 'default')
    ) {
      findings.push(`${record.tag}: state-model exemption lacks baseline same-instance axe evidence`);
    }
    if (record.dimensions?.assistiveTechnology?.status !== 'not-verified') {
      findings.push(`${record.tag}: assistive-technology support must remain unverified without a published manual record`);
    }
    if (
      record.qualification?.humanReview !== 'pending' ||
      record.qualification?.reviewer !== null ||
      record.qualification?.reviewedAt !== null
    ) {
      findings.push(`${record.tag}: unsubstantiated human-review claim`);
    }
  }
  if (ledger?.humanReview?.status !== 'pending' || ledger?.humanReview?.reviewer !== null || ledger?.humanReview?.reviewedAt !== null) {
    findings.push('ledger must record library-wide human review as pending with no invented reviewer/date');
  }
  return findings;
}

export function renderQualificationDashboard(ledger) {
  const compact = (dimension) => {
    const labels = {
      automated: 'automated',
      'automated-evidence': 'automated',
      'configured-automation': 'configured CI',
      'declared-and-gated': 'declared/gated',
      'enrolled-automated-visual': 'visual enrolled',
      'source-evidence': 'source signal',
      'reviewed-exemption': 'reviewed exemption',
      'pending-human-review': 'pending human',
      'not-enrolled': 'not enrolled',
      'not-recorded': 'not recorded',
      'not-verified': 'not verified',
      'not-applicable': 'N/A',
      missing: 'missing',
    };
    return labels[dimension?.status] ?? dimension?.status ?? 'missing';
  };
  const lines = [
    '<!-- GENERATED by scripts/generate-component-quality.mjs — do not edit. -->',
    '',
    '# Component quality dashboard',
    '',
    'This dashboard is deliberately separate from semver maturity. A stable API can have incomplete',
    'human or platform evidence, and that gap remains visible here instead of silently changing the',
    'component’s compatibility status. The machine-readable source is',
    '`packages/lyra-ui/scripts/fixtures/component-qualification.json`.',
    '',
    '## Current evidence',
    '',
    `- Public tags: **${ledger.summary.componentCount}**`,
    `- Exact same-test/same-instance populated or open axe evidence: **${ledger.summary.automatedAccessibility}**`,
    `- Narrow reviewed axe-state exemptions: **${ledger.summary.accessibilityExemptions}**`,
    `- Missing axe qualification: **${ledger.summary.accessibilityMissing}**`,
    `- Visual-regression enrollment: **${ledger.summary.visualEnrolled}** tags`,
    `- Forced-colors visual enrollment: **${ledger.summary.forcedColorsEnrolled}** tags`,
    `- Manually verified assistive-technology pairings: **${ledger.summary.assistiveTechnologyVerified}**`,
    '',
    `Human review status: **${ledger.humanReview.status}**. Reviewer: **none recorded**. Review date: **none recorded**.`,
    '',
    '“Source signal” means the component directory contains a relevant rendered assertion pattern; it',
    'is intentionally not labeled “verified”. “Not recorded” and “not enrolled” are evidence gaps,',
    'not failures hidden behind an exemption. Visual captures remain pending until a human reviews the',
    'complete enrolled set. Axe is not assistive-technology testing.',
    '',
    '## Browser and baseline provenance',
    '',
    `- Chromium: ${ledger.browserSupport.chromium.coverage}`,
    `- Firefox: ${ledger.browserSupport.firefox.coverage}`,
    `- WebKit: ${ledger.browserSupport.webkit.coverage}`,
    `- Browser evidence status: ${ledger.browserSupport.evidenceStatus}`,
    `- Capture producer: ${ledger.baselineProvenance.generatedBy ?? ledger.baselineProvenance.producer ?? 'unknown'}`,
    `- Capture date: ${ledger.baselineProvenance.generatedOn ?? 'not recorded'}`,
    `- Capture source commit: ${ledger.baselineProvenance.sourceCommit ?? 'not recorded'}`,
    `- Capture source tree dirty: ${ledger.baselineProvenance.sourceTreeDirty == null ? 'not recorded' : ledger.baselineProvenance.sourceTreeDirty ? 'yes' : 'no'}`,
    `- Complete human visual review: ${ledger.baselineProvenance.humanVisualReview === true ? 'yes' : 'no'}`,
    '',
    '## Known limitations',
    '',
    ...ledger.knownLimitations.map((limitation) => `- ${limitation}`),
    '',
    '## Per-tag matrix',
    '',
    '| Tag | Maturity | Axe state | Keyboard | RTL | Reduced motion | 320px | Engines | SSR/hydration | Visual | Peer failure | Security | Forced colors | AT |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const component of ledger.components) {
    const d = component.dimensions;
    lines.push(
      `| [\`${component.tag}\`](component-integration.md#${component.tag}) | ${component.maturity} | ${compact(d.accessibility)} | ${compact(d.keyboard)} | ${compact(d.rtl)} | ${compact(d.reducedMotion)} | ${compact(d.narrowAllocation)} | ${compact(d.engines)} | ${d.ssrHydration.mode} | ${compact(d.visual)} | ${compact(d.peerFailure)} | ${compact(d.security)} | ${compact(d.forcedColors)} | ${compact(d.assistiveTechnology)} |`,
    );
  }
  lines.push(
    '',
    '## Evidence interpretation',
    '',
    '- Accessibility is blocking and exact: the checker follows the variable passed to axe back to the',
    '  fixture/helper/query that produced that same tag inside the same test case, then requires a',
    '  populated or open state. Empty defaults require a narrowly scoped reviewed exception.',
    '- SSR modes come from `LYRA_SSR_SUPPORT_MATRIX`; both modes are exercised by the SSR and hydration',
    '  crawls. A client-render fallback is a declared capability tier, not a hidden failure.',
    '- Browser rows describe automated CI only. Firefox/WebKit full-suite evidence is weekly/manual;',
    '  their per-commit job is a curated contract subset.',
    '- Visual and forced-colors rows consume the visual manifest’s per-tag enrollment. A clean pixel',
    '  comparison proves stability against the baseline, never design correctness.',
    '- Peer/security source signals identify review applicability. They do not claim an external',
    '  security audit or that every failure mode has been manually exercised.',
    '- AT remains “not verified” until a record names the technology/browser/OS versions, date, tested',
    '  components, reviewer, and findings.',
  );
  return `${lines.join('\n').trimEnd()}\n`;
}

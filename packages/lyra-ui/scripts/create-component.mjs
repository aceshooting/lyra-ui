import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { normalizeManifest } from './component-inventory.mjs';

const defaultPackageDir = fileURLToPath(new URL('..', import.meta.url));
const PROFILE = 'new-component-experimental';
const PROFILE_RATIONALE =
  'This newly scaffolded component is an unreleased public-surface candidate whose API is still under maintainer review.';
const PROFILE_GRADUATION =
  'Graduate to stable only after its documented API, populated accessibility state, three-engine behavior, and compatibility contract pass review and a release qualification.';
const NAME_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)*$/;
let temporaryFileCounter = 0;

function usage() {
  return 'Usage: pnpm create:component --family <family> --name <unprefixed-kebab-name>';
}

function optionValue(argv, index, option) {
  const argument = argv[index];
  if (argument === option) {
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`${option} requires a value.\n${usage()}`);
    return { value, consumed: 2 };
  }
  if (argument.startsWith(`${option}=`)) {
    const value = argument.slice(option.length + 1);
    if (!value) throw new Error(`${option} requires a value.\n${usage()}`);
    return { value, consumed: 1 };
  }
  return null;
}

export function parseCreateComponentArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length;) {
    const argument = argv[index];
    let match;
    if ((match = optionValue(argv, index, '--family'))) {
      if (parsed.family !== undefined) throw new Error('--family was provided more than once.');
      parsed.family = match.value;
      index += match.consumed;
      continue;
    }
    if ((match = optionValue(argv, index, '--name'))) {
      if (parsed.name !== undefined) throw new Error('--name was provided more than once.');
      parsed.name = match.value;
      index += match.consumed;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}.\n${usage()}`);
  }
  if (parsed.family === undefined) throw new Error(`Missing --family.\n${usage()}`);
  if (parsed.name === undefined) throw new Error(`Missing --name.\n${usage()}`);
  return parsed;
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function atomicWrite(file, source) {
  const temporary = `${file}.create-component-${process.pid}-${temporaryFileCounter++}`;
  try {
    writeFileSync(temporary, source, { flag: 'wx' });
    renameSync(temporary, file);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
}

function jsonSource(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function pascalCase(name) {
  return name
    .split('-')
    .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
    .join('');
}

function humanName(name) {
  return name
    .split('-')
    .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function manifestTags(manifest) {
  return (manifest.modules ?? []).flatMap((module) =>
    (module.declarations ?? [])
      .filter((declaration) => declaration.customElement && declaration.tagName)
      .map((declaration) => declaration.tagName),
  );
}

function addIndexExport(source, name) {
  const exportLine = `export * from './${name}/${name}.js';`;
  const lines = source.replace(/\n$/, '').split('\n');
  const exports = lines
    .map((line, index) => ({ line, index, directory: /^export .* from '\.\/([^/]+)\//.exec(line)?.[1] }))
    .filter((entry) => entry.directory);
  const next = exports.find((entry) => entry.directory.localeCompare(name) > 0);
  const insertion = next?.index ?? ((exports.at(-1)?.index ?? lines.length - 1) + 1);
  lines.splice(insertion, 0, exportLine);
  return `${lines.join('\n')}\n`;
}

function appendDocs(source, { tag, family, name, displayName }) {
  const prefix = source.endsWith('\n') ? source : `${source}\n`;
  return `${prefix}\n## \`${tag}\`\n\nA themeable ${displayName} content surface. Use the default slot for the component's main content.\n\n**Slots:** default — main content.\n\n**CSS parts:** \`base\` — the content container.\n\n\`\`\`html\n<script type="module">\n  import '@aceshooting/lyra-ui/components/${family}/${name}/${name}.js';\n</script>\n\n<${tag}>Populated ${displayName} content</${tag}>\n\`\`\`\n`;
}

function classTemplate({ tag, name, className, displayName }) {
  return `import { html, type TemplateResult } from 'lit';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './${name}.styles.js';

/**
 * \`<${tag}>\` — a themeable ${displayName} content surface.
 *
 * @customElement ${tag}
 * @slot - Main content.
 * @csspart base - The content container.
 */
export class ${className} extends LyraElement {
  static override styles = [LyraElement.styles, styles];

  override render(): TemplateResult {
    return html\`<div part="base"><slot></slot></div>\`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    '${tag}': ${className};
  }
}
`;
}

function registrationTemplate({ name, className }) {
  return `export * from './${name}.class.js';
import { ${className} } from './${name}.class.js';
import { defineElement } from '../../../internal/prefix.js';

defineElement('${name}', ${className});
`;
}

function stylesTemplate() {
  return `import { css } from 'lit';

export const styles = css\`
  :host {
    display: block;
  }

  [part='base'] {
    min-inline-size: 0;
  }
\`;
`;
}

function testTemplate({ tag, name, className, displayName }) {
  return `import { expect, fixture, html } from '@open-wc/testing';
import type { ${className} } from './${name}.class.js';
import './${name}.js';

describe('<${tag}>', () => {
  it('renders populated content through the public base part and remains accessible', async () => {
    const el = await fixture<${className}>(html\`
      <${tag}><p>Populated ${displayName} content</p></${tag}>
    \`);
    const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    const slot = base.querySelector<HTMLSlotElement>('slot')!;
    const assigned = slot.assignedElements();

    expect(base.localName).to.equal('div');
    expect(assigned.length).to.equal(1);
    expect(assigned[0]?.textContent?.trim()).to.equal('Populated ${displayName} content');
    await expect(el).to.be.accessible();
  });
});
`;
}

function storyTemplate({ tag, name, displayName, familyLabel }) {
  return `import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './${name}.js';

const meta: Meta = {
  title: '${familyLabel}/${displayName}',
  component: '${tag}',
  tags: ['autodocs'],
};

export default meta;

export const Default: StoryObj = {
  render: () => html\`<${tag}>Populated ${displayName} content</${tag}>\`,
};
`;
}

function componentFiles(details) {
  return new Map([
    [`${details.name}.class.ts`, classTemplate(details)],
    [`${details.name}.ts`, registrationTemplate(details)],
    [`${details.name}.styles.ts`, stylesTemplate()],
    [`${details.name}.test.ts`, testTemplate(details)],
    [`${details.name}.stories.ts`, storyTemplate(details)],
  ]);
}

function expectedMaturity(version) {
  return {
    status: 'experimental',
    since: version,
    deprecated: null,
    profile: PROFILE,
    rationale: PROFILE_RATIONALE,
    graduationCriteria: PROFILE_GRADUATION,
    deprecations: [],
  };
}

function assertProfile(metadata) {
  const profile = metadata.profiles?.[PROFILE];
  if (
    profile?.status !== 'experimental' ||
    profile.rationale !== PROFILE_RATIONALE ||
    profile.graduationCriteria !== PROFILE_GRADUATION ||
    !Array.isArray(metadata.assignments?.[PROFILE])
  ) {
    throw new Error(
      `Component metadata is missing the reviewed ${PROFILE} profile. Run the metadata setup before scaffolding.`,
    );
  }
}

function validateRequest({ packageDir, family, name }) {
  if (!NAME_PATTERN.test(family)) throw new Error(`Invalid family "${family}"; expected a kebab-case family key.`);
  if (/^(?:lr|wa|sl)-/.test(name)) {
    throw new Error(
      `Pass the unprefixed component name (for example "video"); the scaffold creates only <lr-*> tags.`,
    );
  }
  if (!NAME_PATTERN.test(name)) {
    throw new Error(`Invalid component name "${name}"; expected unprefixed kebab-case.`);
  }

  const paths = {
    familyCatalog: join(packageDir, 'scripts/component-families.json'),
    familyIndex: join(packageDir, 'src/components', family, 'index.ts'),
    docs: join(packageDir, 'llms', `${family}.md`),
    inventory: join(packageDir, 'scripts/fixtures/component-inventory.json'),
    metadata: join(packageDir, 'scripts/fixtures/component-metadata.json'),
    manifest: join(packageDir, 'custom-elements.json'),
    rootBarrel: join(packageDir, 'src/lyra.ts'),
    // `pnpm registrations` (a verification step below) rewrites the two compatibility barrels and
    // the allowlist from the inventory, so all three belong in the rollback snapshot.
    allBarrel: join(packageDir, 'src/all.ts'),
    ssrAllBarrel: join(packageDir, 'src/ssr/all.ts'),
    allowlist: join(packageDir, 'src/internal/root-registration-allowlist.ts'),
    packageJson: join(packageDir, 'package.json'),
    componentDirectory: join(packageDir, 'src/components', family, name),
  };
  // `allBarrel`/`ssrAllBarrel` are rollback targets, not preconditions: `pnpm registrations`
  // regenerates both from the inventory, and the snapshot below handles an absent one by deleting
  // it on rollback rather than restoring it.
  const optionalPaths = ['componentDirectory', 'familyIndex', 'docs', 'allBarrel', 'ssrAllBarrel'];
  for (const [key, file] of Object.entries(paths)) {
    if (optionalPaths.includes(key)) continue;
    if (!existsSync(file)) throw new Error(`Cannot scaffold: required repository file is missing: ${file}`);
  }

  const familyCatalog = readJson(paths.familyCatalog);
  const familyEntry = familyCatalog.families?.find((entry) => entry.key === family);
  if (!familyEntry || !existsSync(dirname(paths.familyIndex))) throw new Error(`Unknown component family "${family}".`);
  for (const file of [paths.familyIndex, paths.docs]) {
    if (!existsSync(file)) throw new Error(`Cannot scaffold: required repository file is missing: ${file}`);
  }

  const tag = `lr-${name}`;
  const inventory = readJson(paths.inventory);
  const metadata = readJson(paths.metadata);
  const manifest = readJson(paths.manifest);
  const indexSource = readFileSync(paths.familyIndex, 'utf8');
  const docsSource = readFileSync(paths.docs, 'utf8');
  assertProfile(metadata);

  const collisions = [];
  if (existsSync(paths.componentDirectory)) collisions.push('component directory');
  if (Object.hasOwn(familyCatalog.directories ?? {}, name)) collisions.push('family catalog');
  if ((inventory.components ?? []).some((entry) => entry.tag === tag)) collisions.push('component inventory');
  if (manifestTags(manifest).includes(tag)) collisions.push('custom-elements manifest');
  if (indexSource.includes(`'./${name}/${name}.js'`)) collisions.push('family barrel');
  if (docsSource.includes(`\`${tag}\``) || docsSource.includes(`<${tag}`)) collisions.push('authored docs');
  if (
    Object.values(metadata.assignments ?? {}).some(
      (assignments) => Array.isArray(assignments) && assignments.includes(tag),
    )
  ) {
    collisions.push('component metadata');
  }
  if (collisions.length > 0) {
    throw new Error(`Component scaffold collision for ${tag}: ${collisions.join(', ')}.`);
  }

  return {
    paths,
    familyCatalog,
    familyEntry,
    inventory,
    metadata,
    indexSource,
    docsSource,
    packageJson: readJson(paths.packageJson),
  };
}

function inventoryEntry({ tag, family, name, surface }) {
  return {
    tag,
    family,
    classModule: `src/components/${family}/${name}/${name}.class.ts`,
    registrationModule: `src/components/${family}/${name}/${name}.ts`,
    rootIncluded: true,
    rootExclusion: null,
    optionalPeers: [],
    maturity: { status: 'unclassified', since: null, deprecated: null },
    counterparts: [],
    surface,
  };
}

function commandStep(id, args, env) {
  return { id, command: 'pnpm', args, ...(env ? { env } : {}) };
}

function verificationSteps(testPath) {
  return [
    commandStep('manifest', ['run', 'manifest']),
    commandStep('component-metadata', ['run', 'component-metadata']),
    commandStep('registrations', ['run', 'registrations']),
    { id: 'component-families', command: 'node', args: ['scripts/component-families.test.mjs'] },
    commandStep('component-inventory', ['run', 'check:component-inventory']),
    commandStep('registration-check', ['run', 'check:registrations']),
    { id: 'coverage-check', command: 'node', args: ['scripts/check-component-coverage.mjs'] },
    ...['chromium', 'firefox', 'webkit'].map((browser) =>
      commandStep(`test-${browser}`, ['exec', 'wtr', testPath], { WTR_BROWSER: browser }),
    ),
  ];
}

function runProcessStep(packageDir, step) {
  const result = spawnSync(step.command, step.args, {
    cwd: packageDir,
    env: { ...process.env, ...step.env },
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${step.id} failed with exit code ${String(result.status)}.`);
  }
}

export async function scaffoldComponent({
  packageDir = defaultPackageDir,
  family,
  name,
  runStep = (step) => runProcessStep(packageDir, step),
}) {
  packageDir = resolve(packageDir);
  const state = validateRequest({ packageDir, family, name });
  const tag = `lr-${name}`;
  const className = `Lyra${pascalCase(name)}`;
  const displayName = humanName(name);
  const details = {
    tag,
    family,
    name,
    className,
    displayName,
    familyLabel: state.familyEntry.label,
  };
  const snapshotPaths = [
    state.paths.familyCatalog,
    state.paths.familyIndex,
    state.paths.docs,
    state.paths.inventory,
    state.paths.metadata,
    state.paths.manifest,
    state.paths.rootBarrel,
    state.paths.allBarrel,
    state.paths.ssrAllBarrel,
    state.paths.allowlist,
    state.paths.packageJson,
  ];
  // A missing file snapshots as `null` and is DELETED on rollback rather than restored, so a
  // generator that creates one of these on its first run cannot leave it behind after a failure.
  const snapshots = new Map(
    snapshotPaths.map((file) => [file, existsSync(file) ? readFileSync(file, 'utf8') : null]),
  );

  try {
    mkdirSync(state.paths.componentDirectory);
    for (const [file, source] of componentFiles(details)) {
      writeFileSync(join(state.paths.componentDirectory, file), source, { flag: 'wx' });
    }

    state.familyCatalog.directories[name] = family;
    atomicWrite(state.paths.familyCatalog, jsonSource(state.familyCatalog));
    atomicWrite(state.paths.familyIndex, addIndexExport(state.indexSource, name));
    atomicWrite(state.paths.docs, appendDocs(state.docsSource, details));
    state.metadata.assignments[PROFILE] = [...state.metadata.assignments[PROFILE], tag].sort((a, b) =>
      a.localeCompare(b),
    );
    atomicWrite(state.paths.metadata, jsonSource(state.metadata));

    const steps = verificationSteps(`src/components/${family}/${name}/${name}.test.ts`);
    await runStep(steps[0]);

    const manifest = readJson(state.paths.manifest);
    const normalized = normalizeManifest(manifest, { ecosystem: 'lyra' });
    const component = normalized.find((entry) => entry.tag === tag);
    const expectedClassModule = `src/components/${family}/${name}/${name}.class.ts`;
    if (!component || component.module !== expectedClassModule) {
      throw new Error(
        `Manifest regeneration did not produce ${tag} from ${expectedClassModule}; the scaffold was rolled back.`,
      );
    }
    state.inventory.components.push(inventoryEntry({ tag, family, name, surface: component.surface }));
    state.inventory.components.sort((left, right) => left.tag.localeCompare(right.tag));
    atomicWrite(state.paths.inventory, jsonSource(state.inventory));

    for (const step of steps.slice(1)) await runStep(step);

    const materialized = readJson(state.paths.inventory).components.find((entry) => entry.tag === tag);
    const expected = expectedMaturity(state.packageJson.version);
    if (JSON.stringify(materialized?.maturity) !== JSON.stringify(expected)) {
      throw new Error(
        `${PROFILE} did not materialize the reviewed metadata for ${tag}; the scaffold was rolled back.`,
      );
    }

    return { tag, className, componentDirectory: state.paths.componentDirectory };
  } catch (error) {
    rmSync(state.paths.componentDirectory, { recursive: true, force: true });
    for (const [file, source] of snapshots) {
      if (source === null) rmSync(file, { force: true });
      else atomicWrite(file, source);
    }
    throw error;
  }
}

async function main() {
  try {
    const options = parseCreateComponentArgs(process.argv.slice(2));
    const result = await scaffoldComponent(options);
    console.log(`Created and verified <${result.tag}> in ${result.componentDirectory}.`);
    console.log('The component is enrolled as new-component-experimental. Review its public API before release.');
    console.log('After editing the starter contract, regenerate editor data and authored-reference artifacts.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) await main();

#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import {
  copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseProgram, visitAst } from './lib/ast.mjs';
import { isMainModule } from './is-main-module.mjs';

const packageDir = fileURLToPath(new URL('..', import.meta.url));
const root = fileURLToPath(new URL('../../..', import.meta.url));
const baselinePath = join(packageDir, 'scripts/duplication-baseline.json');
const jscpd = join(packageDir, 'node_modules/.bin', process.platform === 'win32' ? 'jscpd.cmd' : 'jscpd');
const SCOPE_TOKENS = Object.freeze({ logic: 60, tooling: 60, tests: 80, css: 60 });
const GENERATED_HEADER = /GENERATED (?:FILE|by )|Generated (?:from|by)|<generated:/u;

function filesUnder(directory, { excludeFixtures = false } = {}) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) {
      return ['node_modules', 'dist', '.git', 'coverage'].includes(entry.name) ||
        (excludeFixtures && entry.name === 'fixtures') ? [] : filesUnder(file, { excludeFixtures });
    }
    return entry.isFile() ? [file] : [];
  });
}

function authored(file) {
  return !GENERATED_HEADER.test(readFileSync(file, 'utf8').split(/\r?\n/u, 4).join('\n'));
}

/** File scopes follow the measured source/test/tooling/style corpus, with generated files excluded. */
export function duplicationScopes(repositoryRoot = root) {
  const ui = join(repositoryRoot, 'packages/lyra-ui');
  const src = filesUnder(join(ui, 'src'));
  const logic = src.filter((file) => file.endsWith('.ts') && !/\.(?:test|stories|styles)\.ts$/u.test(file) &&
    !file.includes('/translations/') && authored(file));
  const tests = [...src.filter((file) => /\.test\.(?:ts|mjs)$/u.test(file)),
    ...filesUnder(join(ui, 'test')).filter((file) => /\.(?:ts|js|mjs)$/u.test(file))].filter(authored);
  const tooling = [...filesUnder(join(ui, 'scripts'), { excludeFixtures: true }).filter((file) => file.endsWith('.mjs')),
    ...filesUnder(join(repositoryRoot, 'scripts'), { excludeFixtures: true }).filter((file) => /\.(?:mjs|js|sh)$/u.test(file)),
    join(repositoryRoot, 'package.sh')].filter((file) => existsSync(file) && authored(file));
  const styles = filesUnder(join(repositoryRoot, 'packages')).filter((file) => file.endsWith('.styles.ts') && authored(file));
  return { logic, tooling, tests, styles };
}

function lineStarts(source) {
  const starts = [0];
  for (let i = 0; i < source.length; i++) if (source[i] === '\n') starts.push(i + 1);
  return starts;
}

function lineAt(starts, offset) {
  let low = 0;
  let high = starts.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (starts[mid] <= offset) low = mid;
    else high = mid - 1;
  }
  return low;
}

/** Extract only css-tagged template text, preserving source line numbers and interpolation gaps. */
export function cssTemplateText(file, source, markerSeed = 0) {
  const tree = parseProgram(file, source);
  const starts = lineStarts(source);
  const pieces = Array.from({ length: starts.length }, () => []);
  let marker = markerSeed;
  let count = 0;
  function append(start, end) {
    let offset = start;
    while (offset < end) {
      const newline = source.indexOf('\n', offset);
      const stop = newline < 0 || newline >= end ? end : newline;
      if (stop > offset) pieces[lineAt(starts, offset)].push({ offset, value: source.slice(offset, stop) });
      offset = stop + 1;
    }
  }
  visitAst(tree, (node) => {
    if (node.type !== 'TaggedTemplateExpression' || node.tag.type !== 'Identifier' || node.tag.name !== 'css') return;
    count += 1;
    const template = node.quasi;
    pieces[lineAt(starts, template.start)].push({ offset: template.start, value: String(9_000_000 + ++marker) });
    for (const literal of template.quasis) {
      append(literal.start + 1, literal.end - (literal.tail ? 1 : 2));
      if (!literal.tail) {
        const interpolation = literal.end - 2;
        pieces[lineAt(starts, interpolation)].push({ offset: interpolation, value: '__I__' });
      }
    }
  });
  return {
    text: pieces.map((parts) => parts.sort((a, b) => a.offset - b.offset).map((part) => part.value).join(' ')).join('\n'),
    count,
    marker,
  };
}

function copyScope(files, repositoryRoot, destination) {
  for (const file of files) {
    const target = join(destination, relative(repositoryRoot, file));
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(file, target);
  }
}

function runJscpd(scope, sourceDir, reportDir, minTokens) {
  mkdirSync(reportDir, { recursive: true });
  const child = spawnSync(jscpd, [
    '--min-tokens', String(minTokens), '--mode', 'mild', '--reporters', 'json', '--output', reportDir,
    '--no-gitignore', '--silent', '--max-size', '4mb', '.',
  ], { cwd: sourceDir, encoding: 'utf8' });
  if (child.error) throw new Error(`jscpd ${scope} could not start: ${child.error.message}`);
  if (child.status !== 0) throw new Error(`jscpd ${scope} failed: ${child.stderr || child.stdout}`);
  const total = JSON.parse(readFileSync(join(reportDir, 'jscpd-report.json'), 'utf8')).statistics?.total;
  if (!total || !Number.isFinite(total.percentage) || !Number.isFinite(total.duplicatedLines) ||
    !Number.isFinite(total.sources) || total.sources < 1) {
    throw new Error(`jscpd ${scope} returned incomplete statistics`);
  }
  return total;
}

/** A ratchet cannot pass with absent scopes, missing dependency, or an unreviewed baseline. */
export function compareDuplication(measured, baseline) {
  const findings = [];
  if (baseline?.version !== 1 || baseline?.jscpdVersion !== '5.4.0') {
    findings.push('missing or incompatible reviewed duplication baseline');
  }
  for (const scope of Object.keys(SCOPE_TOKENS)) {
    const actual = measured[scope];
    const record = baseline?.scopes?.[scope];
    if (!actual || !record || !Number.isFinite(record.maxPercentage) ||
      !Number.isInteger(record.measuredSources) || record.measuredSources < 1) {
      findings.push(`${scope}: missing reviewed duplication baseline`);
      continue;
    }
    if (actual.sources < Math.floor(record.measuredSources * 0.95)) {
      findings.push(`${scope}: source coverage shrank from ${record.measuredSources} to ${actual.sources}`);
    }
    if (actual.percentage > record.maxPercentage + 1e-9) {
      findings.push(`${scope}: ${actual.percentage.toFixed(3)}% exceeds ${record.maxPercentage.toFixed(3)}%`);
    }
  }
  return findings;
}

export function checkDuplication(repositoryRoot = root, options = {}) {
  if (!existsSync(jscpd)) throw new Error('Pinned jscpd is missing; install the workspace dependencies');
  const selections = duplicationScopes(repositoryRoot);
  const cacheDir = join(packageDir, 'node_modules/.cache');
  mkdirSync(cacheDir, { recursive: true });
  const scratch = mkdtempSync(join(cacheDir, 'duplication-'));
  try {
    const measured = {};
    for (const scope of ['logic', 'tooling', 'tests']) {
      const directory = join(scratch, scope);
      mkdirSync(directory, { recursive: true });
      copyScope(selections[scope], repositoryRoot, directory);
      measured[scope] = runJscpd(scope, directory, join(scratch, `${scope}-report`), SCOPE_TOKENS[scope]);
    }
    const cssDir = join(scratch, 'css');
    mkdirSync(cssDir, { recursive: true });
    let marker = 0;
    for (const file of selections.styles) {
      const result = cssTemplateText(file, readFileSync(file, 'utf8'), marker);
      marker = result.marker;
      if (result.count === 0) continue;
      const target = join(cssDir, `${relative(repositoryRoot, file)}.css`);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, result.text);
    }
    measured.css = runJscpd('css', cssDir, join(scratch, 'css-report'), SCOPE_TOKENS.css);
    const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, 'utf8')) : undefined;
    if (options.writeBaseline) {
      if (baseline) {
        const findings = compareDuplication(measured, baseline);
        if (findings.length) throw new Error(`Refusing to relax duplication baselines:\n${findings.join('\n')}`);
      }
      const reviewed = { version: 1, jscpdVersion: '5.4.0', scopes: Object.fromEntries(
        Object.entries(measured).map(([scope, total]) => [scope, {
          maxPercentage: Math.ceil(total.percentage * 100) / 100,
          measuredSources: total.sources,
          measuredLines: total.lines,
          measuredDuplicatedLines: total.duplicatedLines,
        }]),
      ) };
      writeFileSync(baselinePath, `${JSON.stringify(reviewed, null, 2)}\n`);
    } else if (!options.printReview) {
      const findings = compareDuplication(measured, baseline);
      if (findings.length) throw new Error(`Duplication ratchet failed:\n${findings.join('\n')}`);
    }
    return measured;
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

if (isMainModule(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some((arg) => !['--print-review', '--write-baseline'].includes(arg)) || args.length > 1) {
    throw new Error('Usage: node scripts/check-duplication.mjs [--print-review|--write-baseline]');
  }
  const totals = checkDuplication(root, { printReview: args[0] === '--print-review', writeBaseline: args[0] === '--write-baseline' });
  for (const [scope, total] of Object.entries(totals)) {
    console.log(`${scope}: ${total.duplicatedLines}/${total.lines} duplicated lines ` +
      `(${total.percentage.toFixed(3)}%; ${total.sources} sources)`);
  }
}

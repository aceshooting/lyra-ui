import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryDir = path.resolve(packageDir, '..', '..');

const forbidden = [
  { label: 'task reference', pattern: /\bTask\s+\d+\b/i },
  { label: 'commit hash', pattern: /\bcommit\s+[0-9a-f]{7,40}\b/i },
  { label: 'fix brief', pattern: /\bfix brief\b/i },
  { label: 'round-specific fix', pattern: /\bround\s+\d+['’]?s?\s+fix\b/i },
  { label: 'internal phase reference', pattern: /\b(?:this|later|future)[ -]phase\b/i },
  { label: 'release-tier framing', pattern: /\b(?:release[ -]tier|full tag\/tier table|component tiers|v1 core)\b/i },
  { label: 'internal review status', pattern: /\b(?:review finding|audit severity|battle-tested|adoption status)\b/i },
  {
    label: 'stale roadmap wording',
    pattern: /\b(?:a|the)\s+future\s+(?:enhancement|optimization|sticky-header|pin\/delete|streaming renderer|value|theme|option)\b/i,
  },
  { label: 'stale version wording', pattern: /\bpossible\s+v\d+\s+option\b/i },
  { label: 'reserved future feature', pattern: /\breserved for a future\b/i },
];

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return [fullPath];
  });
}

const files = [
  ...walk(path.join(packageDir, 'src')).filter(
    (file) =>
      /\.(?:ts|js)$/.test(file) &&
      !file.endsWith('.test.ts') &&
      !file.endsWith('.stories.ts'),
  ),
  path.join(packageDir, 'README.md'),
  path.join(packageDir, 'llms.txt'),
  path.join(packageDir, 'llms-full.txt'),
  // The authored llms/ sources ship verbatim (as llms-full.txt and llms/components/), so the same
  // policy applies to them; the generated copies are covered transitively.
  ...walk(path.join(packageDir, 'llms')).filter(
    (file) => file.endsWith('.md') && !file.includes(`${path.sep}components${path.sep}`),
  ),
  path.join(repositoryDir, 'packages', 'lyra-flags', 'index.js'),
  path.join(repositoryDir, 'packages', 'lyra-flags', 'README.md'),
];

const findings = [];
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  source.split('\n').forEach((line, index) => {
    for (const rule of forbidden) {
      if (rule.pattern.test(line)) {
        findings.push(`${path.relative(repositoryDir, file)}:${index + 1}: ${rule.label}`);
      }
    }
  });
}

if (findings.length > 0) {
  console.error(`Shipped provenance policy failed with ${findings.length} finding(s):`);
  for (const finding of findings) console.error(`- ${finding}`);
  process.exitCode = 1;
} else {
  console.log(`Shipped provenance policy passed for ${files.length} source and documentation files.`);
}

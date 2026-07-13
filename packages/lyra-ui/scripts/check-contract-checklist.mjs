import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checklistPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'contract-checklist.json');
const checklist = JSON.parse(fs.readFileSync(checklistPath, 'utf8'));
const errors = [];
const ids = new Set();

for (const entry of checklist) {
  if (!entry.id || ids.has(entry.id)) errors.push(`duplicate or missing contract id: ${entry.id ?? '<empty>'}`);
  ids.add(entry.id);
  const sources = entry.files.map((file) => {
    const absolute = path.join(packageDir, file);
    if (!fs.existsSync(absolute)) errors.push(`${entry.id}: missing test file ${file}`);
    return fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : '';
  });
  for (const marker of entry.markers) {
    if (!sources.some((source) => source.includes(marker))) {
      errors.push(`${entry.id}: no listed test contains marker ${JSON.stringify(marker)}`);
    }
  }
}

if (errors.length) {
  console.error(`Contract checklist failed with ${errors.length} finding(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Contract checklist passed for ${checklist.length} behavior-risk areas.`);
}

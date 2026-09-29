import path from 'node:path';
import { isMainModule } from './is-main-module.mjs';
import { commitSourceWritePlan } from './source-fixture-io.mjs';
import { validateVisualQualificationManifest } from './qualification-ledger.mjs';
import { assembleVisualManifest, readVisualManifestSources, visualManifestSourceFindings } from './visual-manifest-source.mjs';

/** Regenerate only the aggregate; authored evidence and family records are never inferred. */
export function generateVisualManifest({ packageDir, check = false } = {}) {
  const sources = readVisualManifestSources({ packageDir, allowStaleAggregate: true });
  const manifest = assembleVisualManifest(sources);
  const findings = validateVisualQualificationManifest(manifest, { components: Object.keys(sources.familyByTag).map(tag => ({ tag })) });
  if (findings.length) throw new Error(`Visual qualification manifest failed:\n- ${findings.join('\n- ')}`);
  if (check) {
    const drift = visualManifestSourceFindings(sources);
    if (drift.length) throw new Error(drift.join('\n'));
  } else {
    const file = path.join(sources.packageDir, 'visual-baselines/manifest.json');
    const expected = `${JSON.stringify(manifest, null, 2)}\n`;
    commitSourceWritePlan({ root: sources.packageDir, entries: sources.snapshots.map(snapshot => ({
      ...snapshot, expected: snapshot.file === file ? expected : snapshot.original,
    })) });
  }
  return manifest;
}

if (isMainModule(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length && !['--write', '--check'].includes(args[0]))) throw new Error('Usage: generate-visual-manifest.mjs [--write|--check]');
  generateVisualManifest({ check: args.includes('--check') });
  console.log(args.includes('--check') ? 'Visual manifest sources and aggregate are current.' : 'Visual manifest aggregate generated.');
}

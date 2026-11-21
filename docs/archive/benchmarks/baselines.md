# Archived: Saved synthetic baseline comparisons

Moved from benchmarks/baselines/README.md; history before 30.0.0, not current guidance. The saved
result files remain in [`benchmarks/baselines/`](../../../benchmarks/baselines/).

[2026-10-12-28.1.1-stress.json](../../../benchmarks/baselines/2026-10-12-28.1.1-stress.json) preserves the 28.1.1 distribution measured later that day. All 80 workload/browser cases and 560 recorded samples passed their semantic checks. It retains the original raw samples and anonymous metadata, including `publicCommit: null`; no source commit has been inferred or added.

The compatible comparison with the unchanged 28.1.0 baseline observed 84 regressed and 131 improved metric series out of 800, using the existing thresholds of more than 15% **and** 1 ms for median or p95. A series can appear in both groups. These measurements do not establish a uniform speedup or attribute timing changes to the library.

Validate the saved run and reproduce that comparison without launching browsers:

```sh
node benchmarks/schema.mjs --validate benchmarks/baselines/2026-10-12-28.1.1-stress.json
pnpm benchmark:compare benchmarks/baselines/2026-10-12-stress.json benchmarks/baselines/2026-10-12-28.1.1-stress.json
```

The original comparison exits with status 1 because timing regressions exceeded both thresholds; this does not mean the recorded semantic checks failed.

[2026-10-13-28.1.1-stress.json](../../../benchmarks/baselines/2026-10-13-28.1.1-stress.json) and [2026-10-13-28.1.2-stress.json](../../../benchmarks/baselines/2026-10-13-28.1.2-stress.json) preserve a same-day comparison with matching harness and fixture fingerprints, browser versions and environment metadata. Each run contains 80 workload/browser cases and 560 measured samples; all 160 cases and 1,120 samples passed their semantic checks. Both files retain their exact raw bytes and anonymous metadata, including `publicCommit: null`.

Comparing only this pair with the unchanged thresholds observed 101 regressed and 85 improved metric series out of 800. A series can appear in both groups. The original strict comparison exits with status 1 because timing increases exceed both 15% **and** 1 ms for median or p95; the semantic checks remain passed. These observations do not establish a uniform speedup or attribute timing differences to the library.

Validate both saved runs and reproduce their comparison without launching browsers:

```sh
node benchmarks/schema.mjs --validate benchmarks/baselines/2026-10-13-28.1.1-stress.json
node benchmarks/schema.mjs --validate benchmarks/baselines/2026-10-13-28.1.2-stress.json
pnpm benchmark:compare benchmarks/baselines/2026-10-13-28.1.1-stress.json benchmarks/baselines/2026-10-13-28.1.2-stress.json
```

[2026-10-14-28.1.5-stress.json](../../../benchmarks/baselines/2026-10-14-28.1.5-stress.json) preserves the 28.1.5 distribution measured on October 14. All 80 workload/browser cases and 560 measured samples passed their semantic checks across the five channels. The original bytes, raw samples and anonymous metadata are retained, including `publicCommit: null`. Million-record cases retain the bounded table and caller-controlled pagination scope described above.

Comparing this run with the October 13 28.1.2 baseline matches the recorded compatibility fields and observes 105 regressed and 89 improved metric series out of 800. The strict comparison exits with status 1 under the unchanged thresholds; semantic checks passed. Complete measured-bundle dependency equivalence with that historical run is not established, so these observations do not attribute changes to Lyra or establish a uniform speedup. Rerun both versions with one frozen dependency environment when investigating a regression.

```sh
node benchmarks/schema.mjs --validate benchmarks/baselines/2026-10-14-28.1.5-stress.json
pnpm benchmark:compare benchmarks/baselines/2026-10-13-28.1.2-stress.json benchmarks/baselines/2026-10-14-28.1.5-stress.json
```

# Saved synthetic baselines

[2026-10-12-stress.json](2026-10-12-stress.json) records the published `@aceshooting/lyra-ui@28.1.0` package. It includes 16 workloads across Chromium, Firefox, WebKit, Chrome and Edge, with one discarded warmup and seven measured samples per scenario. The JSON contains each assertion, raw timing, count, version and fingerprint; its status fields are authoritative.

This Linux run uses headless browsers, a virtual display, software rendering, a 1280 × 900 viewport and DPR 1. Node, Playwright, Vite, Chart.js and exact browser versions are recorded in the file. Dataset creation is outside measured timing phases. The million-record workloads exercise the table boundary and caller-controlled pagination; they do not construct a million-row DOM.

[2026-10-12-toolchain.json](2026-10-12-toolchain.json) lists public package names and exact versions from the archived installation lockfile, including Lit and its runtime packages. This is archived install resolution, not proof of the dependencies present in the measured bundle; optional platform packages in the lockfile may not have been installed. It supplements the unchanged result JSON and is not enforced by the current comparer.

Reuse the same frozen harness dependency lock for future comparisons and manually verify its resolutions against this sidecar, keeping the tested Lyra package as the intentional variable. If that dependency environment cannot be reproduced, rerun both library versions with one new frozen harness lock. Matching comparison metadata alone does not establish complete dependency equivalence.

Build a candidate and use the same workload settings:

```sh
nvm use
pnpm --filter @aceshooting/lyra-ui build
xvfb-run -a pnpm benchmark --profile stress \
  --browsers chromium,firefox,webkit,chrome,edge \
  --timeout-ms 90000 --software-rendering \
  --output benchmarks/results/candidate.json
pnpm benchmark:compare benchmarks/baselines/2026-10-12-stress.json benchmarks/results/candidate.json
```

Comparison requires matching browser versions, environment metadata and harness fingerprints. If the toolchain, machine or fixtures changed, run both the baseline package and candidate again in the new environment. `--package-dir` can select an independently installed published package; keep harness peers fixed. An explicit incompatible comparison is exploratory and cannot pass qualification.

Keep the dated result unchanged when adding a later baseline. New ordinary results go to the ignored `benchmarks/results/` directory; promote a reviewed result under a new name. See the [benchmark guide](../README.md) for phase definitions, thresholds and validation commands.

[2026-10-12-28.1.1-stress.json](2026-10-12-28.1.1-stress.json) preserves the 28.1.1 distribution measured later that day. All 80 workload/browser cases and 560 recorded samples passed their semantic checks. It retains the original raw samples and anonymous metadata, including `publicCommit: null`; no source commit has been inferred or added.

The compatible comparison with the unchanged 28.1.0 baseline observed 84 regressed and 131 improved metric series out of 800, using the existing thresholds of more than 15% **and** 1 ms for median or p95. A series can appear in both groups. These measurements do not establish a uniform speedup or attribute timing changes to the library.

Validate the saved run and reproduce that comparison without launching browsers:

```sh
node benchmarks/schema.mjs --validate benchmarks/baselines/2026-10-12-28.1.1-stress.json
pnpm benchmark:compare benchmarks/baselines/2026-10-12-stress.json benchmarks/baselines/2026-10-12-28.1.1-stress.json
```

The original comparison exits with status 1 because timing regressions exceeded both thresholds; this does not mean the recorded semantic checks failed.

[2026-10-13-28.1.1-stress.json](2026-10-13-28.1.1-stress.json) and [2026-10-13-28.1.2-stress.json](2026-10-13-28.1.2-stress.json) preserve a same-day comparison with matching harness and fixture fingerprints, browser versions and environment metadata. Each run contains 80 workload/browser cases and 560 measured samples; all 160 cases and 1,120 samples passed their semantic checks. Both files retain their exact raw bytes and anonymous metadata, including `publicCommit: null`.

Comparing only this pair with the unchanged thresholds observed 101 regressed and 85 improved metric series out of 800. A series can appear in both groups. The original strict comparison exits with status 1 because timing increases exceed both 15% **and** 1 ms for median or p95; the semantic checks remain passed. These observations do not establish a uniform speedup or attribute timing differences to the library.

Validate both saved runs and reproduce their comparison without launching browsers:

```sh
node benchmarks/schema.mjs --validate benchmarks/baselines/2026-10-13-28.1.1-stress.json
node benchmarks/schema.mjs --validate benchmarks/baselines/2026-10-13-28.1.2-stress.json
pnpm benchmark:compare benchmarks/baselines/2026-10-13-28.1.1-stress.json benchmarks/baselines/2026-10-13-28.1.2-stress.json
```

[2026-10-14-28.1.5-stress.json](2026-10-14-28.1.5-stress.json) preserves the 28.1.5 distribution measured on October 14. All 80 workload/browser cases and 560 measured samples passed their semantic checks across the five channels. The original bytes, raw samples and anonymous metadata are retained, including `publicCommit: null`. Million-record cases retain the bounded table and caller-controlled pagination scope described above.

Comparing this run with the October 13 28.1.2 baseline matches the recorded compatibility fields and observes 105 regressed and 89 improved metric series out of 800. The strict comparison exits with status 1 under the unchanged thresholds; semantic checks passed. Complete measured-bundle dependency equivalence with that historical run is not established, so these observations do not attribute changes to Lyra or establish a uniform speedup. Rerun both versions with one frozen dependency environment when investigating a regression.

```sh
node benchmarks/schema.mjs --validate benchmarks/baselines/2026-10-14-28.1.5-stress.json
pnpm benchmark:compare benchmarks/baselines/2026-10-13-28.1.2-stress.json benchmarks/baselines/2026-10-14-28.1.5-stress.json
```

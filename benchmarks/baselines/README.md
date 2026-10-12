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

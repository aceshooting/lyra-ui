# Saved synthetic baseline

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

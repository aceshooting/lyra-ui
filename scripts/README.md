# Repository scripts

Root scripts are for repository-wide orchestration, documentation and release workflows. Package
API checks, generators and their focused fixtures stay in `packages/lyra-ui/scripts/`, beside the
package contract they enforce.

## Canonical entry points

| Command | Purpose |
| --- | --- |
| `./scripts/ci.sh` | Reproduce the aggregate CI gate on Node 22. |
| `./scripts/test.sh` | Run the complete Chromium, Firefox and WebKit test sweep plus SSR, hydration, visual and workspace checks. |
| `./scripts/test_all_browsers.sh` | Run the workflow-specific five-browser sweep in four sequential shards per browser. |
| `./scripts/regen.sh` | Regenerate checked-in derived artifacts. |
| `./scripts/publish.sh` | Run the release and publish workflow. |

## Root script groups

- `check-*`: repository-wide documentation, consumer, workflow, secret and Storybook checks.
- `docs-*`, `generate-sitemap.mjs`, and `storybook-*`: documentation and site contracts.
- `release-*`, `publish.sh`, `upgrade.sh`, and metadata sync helpers: release maintenance.
- `*-test.mjs`: focused contract tests for the adjacent repository-level module.

## Adding a script

- Put package API, generator and contract-gate logic in `packages/lyra-ui/scripts/` beside its test
  or fixture.
- Keep root scripts for work that crosses package boundaries or integrates docs, CI or releases.
- Extend an existing gate or module before adding a wrapper.
- Wire every executable script from package metadata, CI or documented developer workflows; do not
  add unreferenced one-off helpers.

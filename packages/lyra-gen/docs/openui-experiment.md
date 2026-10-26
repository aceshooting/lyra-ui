# OpenUI Lang importer experiment

The current decision is **no-go for a runtime importer**. A pinned external parser can produce static trees that map to reviewed Lyra views, but the experiment does not establish equivalent behavior for expressions, actions, fields, queries, source edits, arbitrary component libraries, or adversarial parser workloads. No importer or external parser dependency was added to the runtime.

The experiment uses the published [`@openuidev/lang-core@1.0.1` package](https://registry.npmjs.org/@openuidev%2Flang-core/1.0.1), its declared public [repository](https://github.com/thesysdev/openui), `zod@4.6.7`, and `ci-info@4.4.0`. All three published tarballs are pinned by SHA-512 integrity in the [fixture manifest](../scripts/fixtures/openui-experiment.json). The package license is MIT. The one public README fixture retains its [upstream license notice](../scripts/fixtures/openui-fixture-LICENSE.txt); the other fixtures are original MIT examples. The published core metadata does not provide a Git commit, so the package integrity, rather than an assumed source commit, identifies the inspected implementation.

Reproduce after building this package, with the workspace dependencies installed and Node selected from `.nvmrc`:

```sh
node packages/lyra-gen/scripts/openui-experiment.mjs --write
```

The script requires `tar` and uses the existing development dependency's esbuild. It downloads integrity-checked package tarballs into a task-owned temporary directory, invokes no package lifecycle scripts, and removes that directory on completion or failure. It writes a [compact report with actual parser outputs](../scripts/fixtures/openui-experiment-report.json). Registry downloads are required; model calls are not used.

The actual batch parser and one midpoint streaming split were exercised for ten fixtures. All ten sampled streaming roots matched their batch roots. This is a small equivalence sample, not exhaustive streaming or resource qualification.

| Conversion result | Fixtures | Meaning |
| --- | --- | --- |
| Supported within this experiment | Public README forward references; original typed table; original numeric chart with a null gap | Trees pass the Lyra runtime validator. Table and chart conversions also round-trip through the current typed converters. Original table column metadata is retained beside the candidate view. |
| Lossy | Numeric metric | The stat display requires a string, so the candidate view alone loses the source number's type/provenance. |
| Rejected | Reactive expression; assistant action; URL action; unapproved field; incomplete reference; unknown component | No evaluator, action executor, field collection or incomplete-tree import is attempted. |

The synthetic Table and Chart signatures are explicitly declared by the checked experiment schema. They do not demonstrate compatibility with every upstream built-in table or chart. The public README fixture exercises only its literal text and container content. These fixture classifications are experiment results, not an exported importer API or a general interoperability promise.

The measured browser boundary exports only the public `createParser` and `createStreamingParser` functions, with all reachable dependencies bundled. With esbuild 0.28.2, ES2022 ESM output, tree shaking, minification, no externals, and no telemetry rewrite, it produced **496,495 bytes minified / 107,300 bytes gzip at level 9**. Zod contributed 453,825 output bytes; the core contributed 36,791 and ci-info 5,196. These package contributions do not include final bundle wrapper overhead and must not be added to gzip figures. This is one pinned peer selection and build configuration, not a universal package-size estimate.

The three downloaded tarballs total **1,513,533 bytes** and their regular extracted files total **7,596,765 bytes**. That closure includes the selected required Zod peer and the declared ci-info dependency; it excludes the optional MCP SDK and the already-installed build tool.

Inspection of the pinned [published source archive](https://registry.npmjs.org/@openuidev/lang-core/-/lang-core-1.0.1.tgz) found an opt-out installation telemetry hook and opt-in Node runtime parser/prompt telemetry. The public root imports Zod and a shared telemetry module, and the measured parser bundle retains telemetry capture code. Lifecycle execution was avoided entirely. Both `OPENUI_TELEMETRY_DISABLED=1` and `DO_NOT_TRACK=1` were set, and `globalThis.fetch` was guarded during actual module import and parser execution: **zero fetch attempts were observed**. The guard covers that API; it is not an operating-system network sandbox or a claim about every upstream integration.

An optional importer remains gated on reviewed mappings for dynamic semantics and host authority, explicit handling of lossy results, and parser resource/streaming qualification. The current evidence supports keeping this reproducible experiment separate from the shipped runtime.

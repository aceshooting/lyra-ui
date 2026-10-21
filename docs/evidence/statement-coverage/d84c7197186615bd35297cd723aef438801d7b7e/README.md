# Statement coverage evidence

These measurements and the complete source census apply to source commit
`d84c7197186615bd35297cd723aef438801d7b7e`. This evidence is published in a later
commit; it does not claim that the publication commit was measured.

The [methodology](../../../statement-coverage.md) defines locked `v8-to-istanbul`
9.3.0 physical-source-line statement counters, not AST instrumentation or a Codecov
line percentage. The scope includes all seven packages and original repository
tooling, examples, executable manifest/workflow text and original patch additions.
Unmeasured original code receives zero covered counters. Four measured test fixtures
(165 covered counters) are explicitly omitted from both numerator and denominator;
their full raw-map entries and `ignoredMeasuredSources` records remain available.
Each measured source keeps
its full physical-line ceiling, including any absent counters. Generated duplicates,
tests and compiler-proved type-only sources have explicit content-addressed exclusions.
The model does not establish language-independent AST statement coverage.

The lower bound is **515,340 / 637,993 × 100 = 80.77518092%**,
above 80% within this declared model. It does not assert that unmeasured packages have
no tests; their coverage is conservatively credited as zero here.

| Scope | Covered counters | Denominator ceiling |
| --- | ---: | ---: |
| repository tooling/examples | 0 | 30,032 |
| packages/lyra-3d | 0 | 1,755 |
| packages/lyra-docs | 9,704 | 13,355 |
| packages/lyra-flags | 0 | 3,446 |
| packages/lyra-ide | 0 | 72 |
| packages/lyra-map | 0 | 1,261 |
| packages/lyra-translations | 0 | 111 |
| packages/lyra-ui | 505,636 | 587,961 |

The UI collector's own statement result is 505,801/506,953 (99.77276000%),
including 165 fixture counters. Those fixtures are removed from both terms for project
accounting. The docs collector contributes 9,704/9,724 (99.79432332%). The project
numerator is therefore `(505,801 - 165) + 9,704 = 515,340`; the complete census ceiling
is 637,993, including unmeasured original source and embedded executable text. Counts
are summed across distinct canonical files; package percentages are not averaged.
The UI selection contains 35,005 cases, zero failures/errors and 17 skips. The docs
transcript contains 835 passing unit tests and 230 passing Chromium checks.

## Completed collection

The UI measurement comes from the four successful coverage shards and successful
merge/floor job in [CI run 39666245495](https://github.com/aceshooting/lyra-ui/actions/runs/39666245495),
run attempt 1. Exact committed test membership was checked against the deterministic
four-shard partition before merging. The overall source-commit CI run had a separate
IDE-package size failure; the coverage jobs' successful results are reported separately.
The subsequent [IDE documentation repair](https://github.com/aceshooting/lyra-ui/commit/5326427d2)
removes redundant README prose and verifies the actual tarball against unchanged size
ceilings. It does not alter the measured source commit.

The document companion was measured in a complete maintainer-run Node/Chromium
collection on a clean checkout of the same source commit, with Node 22.23.2 and pnpm
12.14.0. This is a maintainer execution receipt, not a GitHub Actions attestation.
The complete transcript, metadata and raw map are included. Its collector zero-enrolls
unloaded runtime modules; unit and browser statuses are both zero.

`assembly-receipt.json` binds original inputs, public normalized maps, actual run/job
URLs, archive IDs/digests and execution receipts. Hosted shard archives expire; the full
merged UI map is preserved here so reproduction does not depend on their retention.
Only map keys and their corresponding `path` fields were canonicalized to repository
paths; every statement/branch/function map and counter is retained. JSON formatting and
key order were normalized and gzip uses a zero timestamp. Private execution roots in
the full docs transcript/metadata were replaced by neutral labels; no test results were
removed. `exclusion-proof-receipt.json` links the actual generator, emission,
classification and source-provenance checks. All original generators and transforms
remain counted as uncovered unless measured.

## Reproduce the calculation

Use Python 3 with PyYAML, a repository containing the measured commit, and this directory's
files. Decompress the two full maps into task scratch, then create a copy of `evidence.json`
whose two `coverage` paths point to those JSON files. From the repository root:

```sh
python3 scripts/report-statement-coverage.py \
  d84c7197186615bd35297cd723aef438801d7b7e \
  /path/to/evidence.json /path/to/exclusions.json \
  --patch-provenance docs/evidence/engine-patch-provenance.json \
  > /path/to/reproduced-statement-coverage.json
```

Use the reporter from this evidence publication; its exact source digest and Python/PyYAML
versions are in `evidence.json`. The pinned patch proof is unchanged from the measured
commit. The reporter reads committed blobs, not a possibly modified working tree. Compare the full
report to `statement-coverage.json`, including per-file hashes, totals, package inventory,
embedded-code census and exclusions. Review the collection receipts separately: the
reporter validates accounting and hashes, not whether an arbitrary supplied report was
actually collected by the claimed run.

The retained upstream-patch proof excludes only 19,595 byte-identical lines relocated
from actual deleted blocks in the pinned upstream source, using the fixed minimum of
20 consecutive lines. Source-lock and patch hashes were reverified at the measured commit;
the earlier extraction was not falsely presented as a new run. All unmatched additions
remain uncovered. See the [public proof and reproducer](../../../statement-coverage.md#original-patch-code-and-moved-upstream-blocks).

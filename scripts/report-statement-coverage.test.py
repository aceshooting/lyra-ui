#!/usr/bin/env python3
"""Focused reporting checks; no browser, build, or mandatory CI gate."""

import hashlib
import json
import pathlib
import subprocess
import sys
import tempfile
import unittest

SCRIPT = pathlib.Path(__file__).with_name("report-statement-coverage.py")


class ReportingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="lyra-statement-report-")
        self.addCleanup(self.temp.cleanup)
        self.root = pathlib.Path(self.temp.name)
        self.git("init", "-q")
        self.git("config", "user.email", "tests@example.invalid")
        self.git("config", "user.name", "Coverage tests")
        self.put(
            "packages/lyra-ui/src/a.ts", "export const a = 1;\nexport const b = 2;\n"
        )
        self.put("packages/lyra-3d/src/b.ts", "export const c = 3;\n")
        self.put("scripts/build.mjs", "first();\nsecond();\n")
        self.put(
            ".github/workflows/test.yml",
            "jobs:\n  check:\n    steps:\n      - run: |\n"
            "          first\n          second\n",
        )
        self.put("packages/lyra-ui/src/a.test.ts", "test code\n" * 30)
        self.git("add", ".")
        self.git("commit", "-qm", "fixture")
        self.sha = self.git("rev-parse", "HEAD").strip()
        self.map = {
            "packages/lyra-ui/src/a.ts": {
                "s": {"0": 1, "1": 0},
                "statementMap": {"0": self.loc(1), "1": self.loc(2)},
            }
        }
        self.reports = [
            {
                "package": "packages/lyra-ui",
                "coverage": str(self.root / "coverage.json"),
                "complete": True,
                "provenance": "complete fixture run",
            }
        ]
        self.exclusions = []

    def git(self, *a):
        return subprocess.check_output(["git", *a], cwd=self.root, text=True)

    def put(self, p, s):
        f = self.root / p
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text(s)

    def loc(self, n):
        return {"start": {"line": n, "column": 0}, "end": {"line": n, "column": 1}}

    def run_report(self, commit=None, provenance=None):
        self.put("coverage.json", json.dumps(self.map))
        self.put(
            "evidence.json",
            json.dumps({"commit": commit or self.sha, "reports": self.reports}),
        )
        self.put("exclusions.json", json.dumps(self.exclusions))
        command = [
            sys.executable,
            str(SCRIPT),
            self.sha,
            "evidence.json",
            "exclusions.json",
        ]
        if provenance is not None:
            self.put("provenance.json", json.dumps(provenance))
            command += ["--patch-provenance", "provenance.json"]
        return subprocess.run(
            command,
            cwd=self.root,
            text=True,
            capture_output=True,
        )

    def patch_proof(self):
        patch = "--- a/x.js\n+++ b/x.js\n@@ -1 +1,3 @@\n+vendor();\n+own();\n context\n"
        self.put("patches/library.patch", patch)
        self.put("engine.lock.json", "{}\n")
        self.git("add", ".")
        self.git("commit", "-qm", "patch provenance fixture")
        self.sha = self.git("rev-parse", "HEAD").strip()
        return {
            "commit": self.sha,
            "lock": {
                "path": "engine.lock.json",
                "sha256": hashlib.sha256(b"{}\n").hexdigest(),
            },
            "patches": [
                {
                    "path": "patches/library.patch",
                    "sha256": hashlib.sha256(patch.encode()).hexdigest(),
                }
            ],
            "provedMovedUpstreamLines": 1,
            "matches": [
                {
                    "patch": "patches/library.patch",
                    "patchStart": 4,
                    "lines": 1,
                    "sha256": hashlib.sha256(b"vendor();\n").hexdigest(),
                }
            ],
        }

    def test_patch_proof_excludes_only_verified_rows_and_retains_unknown(self):
        proof = self.patch_proof()
        result = self.run_report(provenance=proof)
        self.assertEqual(result.returncode, 0, result.stderr)
        report = json.loads(result.stdout)
        self.assertEqual(report["totalUpperBound"], 8)
        self.assertEqual(report["appliedPatchProvenance"]["excludedAddedLines"], 1)
        patch = next(
            x for x in report["embeddedExecutableText"] if x["path"].endswith(".patch")
        )
        self.assertEqual((patch["allAddedLines"], patch["total"]), (2, 1))

    def test_stale_patch_hash_rejected(self):
        proof = self.patch_proof()
        proof["patches"][0]["sha256"] = "0" * 64
        self.assertNotEqual(self.run_report(provenance=proof).returncode, 0)

    def test_stale_patch_lock_rejected(self):
        proof = self.patch_proof()
        proof["lock"]["sha256"] = "0" * 64
        self.assertNotEqual(self.run_report(provenance=proof).returncode, 0)

    def test_overlapping_patch_ranges_rejected(self):
        proof = self.patch_proof()
        proof["matches"] *= 2
        self.assertNotEqual(self.run_report(provenance=proof).returncode, 0)

    def test_invalid_patch_range_rejected(self):
        proof = self.patch_proof()
        for start, count in [(0, 1), (4, 999), (4, 0), (6, 1)]:
            with self.subTest(start=start, count=count):
                proof["matches"][0].update(patchStart=start, lines=count)
                self.assertNotEqual(self.run_report(provenance=proof).returncode, 0)

    def test_tampered_patch_source_indices_rejected(self):
        proof = self.patch_proof()
        proof["matches"][0]["patchStart"] = 5
        self.assertNotEqual(self.run_report(provenance=proof).returncode, 0)

    def test_tampered_patch_range_digest_rejected(self):
        proof = self.patch_proof()
        proof["matches"][0]["sha256"] = "0" * 64
        self.assertNotEqual(self.run_report(provenance=proof).returncode, 0)

    def test_combined_denominator_and_unmeasured_code(self):
        r = self.run_report()
        self.assertEqual(r.returncode, 0, r.stderr)
        j = json.loads(r.stdout)
        self.assertEqual((j["covered"], j["totalUpperBound"]), (1, 7))
        self.assertEqual(j["packages"]["packages/lyra-3d"]["total"], 1)

    def test_sparse_map_keeps_full_source_denominator(self):
        del self.map["packages/lyra-ui/src/a.ts"]["s"]["1"]
        del self.map["packages/lyra-ui/src/a.ts"]["statementMap"]["1"]
        r = self.run_report()
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(json.loads(r.stdout)["totalUpperBound"], 7)

    def test_extensionless_script_patch_additions_and_package_commands(self):
        self.put("scripts/ci-bin/pnpm", '#!/bin/sh\nexec pnpm "$@"\n')
        self.put("package.json", json.dumps({"scripts": {"build": "a\nb"}}))
        self.put(
            "patches/library.patch",
            "--- a/a.js\n+++ b/a.js\n@@ -1 +1,2 @@\n-old();\n+new();\n+++ value;\n",
        )
        self.git("add", ".")
        self.git("commit", "-qm", "more executable sources")
        self.sha = self.git("rev-parse", "HEAD").strip()
        r = self.run_report()
        self.assertEqual(r.returncode, 0, r.stderr)
        j = json.loads(r.stdout)
        self.assertEqual(j["totalUpperBound"], 13)
        self.assertEqual(sum((p["total"] for p in j["packages"].values())), 13)

    def test_duplicate_reports_rejected(self):
        self.reports *= 2
        self.assertNotEqual(self.run_report().returncode, 0)

    def test_commit_mismatch_rejected(self):
        self.assertNotEqual(self.run_report("0" * 40).returncode, 0)

    def test_stale_exclusion_rejected(self):
        self.exclusions = [
            {
                "path": "scripts/build.mjs",
                "sha256": "0" * 64,
                "reason": "generated",
                "proof": "generator check",
            }
        ]
        self.assertNotEqual(self.run_report().returncode, 0)

    def test_content_addressed_exclusion(self):
        p = "scripts/build.mjs"
        self.exclusions = [
            {
                "path": p,
                "sha256": hashlib.sha256((self.root / p).read_bytes()).hexdigest(),
                "reason": "fixture generated duplicate",
                "proof": "fixture deterministic producer",
            }
        ]
        r = self.run_report()
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(json.loads(r.stdout)["totalUpperBound"], 5)

    def test_multiline_and_duplicate_statement_locations_rejected(self):
        self.map["packages/lyra-ui/src/a.ts"]["statementMap"]["1"] = self.loc(1)
        self.assertNotEqual(self.run_report().returncode, 0)
        self.map["packages/lyra-ui/src/a.ts"]["statementMap"]["1"]["end"]["line"] = 2
        self.assertNotEqual(self.run_report().returncode, 0)

    def test_incomplete_report_rejected(self):
        self.reports[0]["complete"] = False
        self.assertNotEqual(self.run_report().returncode, 0)


if __name__ == "__main__":
    unittest.main()

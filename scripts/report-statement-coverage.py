#!/usr/bin/env python3
"""Report a conservative physical-source-line bound; never changes coverage gates.
Inputs: exact Git SHA; evidence manifest; content-addressed exclusion manifest.
Evidence manifest: {commit, reports:[{package, coverage, complete, provenance}]}.
Exclusions: [{path, sha256, reason, proof}]. Reports must be independently verified.
Requires PyYAML to enumerate executable workflow blocks.
"""

import argparse
import hashlib
import json
import pathlib
import re
import subprocess

import yaml


def git(*a):
    return subprocess.check_output(["git", *a])


def lines(s):
    return max(
        1,
        s.rstrip(
            "\t\x0b\x0c \xa0\ufeff\n\r\u2028\u2029\u1680"
            "\u2000\u2001\u2002\u2003\u2004\u2005\u2006"
            "\u2007\u2008\u2009\u200a\u202f\u205f\u3000"
        ).count("\n")
        + 1,
    )


def excluded_test(p):
    return (
        p.endswith((".d.ts", ".d.mts", ".d.cts"))
        or bool(re.search("\\.(?:test|stories)\\.", p))
        or any((x in p for x in ["/test/", "/type-tests/", "/stories/", "/fixtures/"]))
    )


def patch_addition_rows(rows):
    """Return one-based added rows, distinguishing +++ source from file headers."""
    additions = set()
    before = after = 0
    for index, row in enumerate(rows, 1):
        if row.startswith(b"@@ "):
            if before or after:
                raise ValueError("incomplete patch hunk")
            header = re.match(
                rb"@@ -[0-9]+(?:,([0-9]+))? \+[0-9]+(?:,([0-9]+))? @@", row
            )
            if not header:
                raise ValueError("invalid patch hunk header")
            before = int(header[1] or b"1")
            after = int(header[2] or b"1")
        elif before or after:
            prefix = row[:1]
            if prefix == b"+":
                additions.add(index)
                after -= 1
            elif prefix == b"-":
                before -= 1
            elif prefix == b" ":
                before -= 1
                after -= 1
            elif prefix == b"\\":
                continue
            else:
                raise ValueError("invalid patch hunk row")
            if before < 0 or after < 0:
                raise ValueError("patch hunk row count mismatch")
    if before or after:
        raise ValueError("incomplete final patch hunk")
    return additions


def validate_patch_provenance(commit, proof_path):
    """Check immutable inputs and added rows; upstream origin is replayed separately."""
    raw_proof = pathlib.Path(proof_path).read_bytes()
    proof = json.loads(raw_proof)
    lock = proof["lock"]
    lock_raw = git("show", commit + ":" + lock["path"])
    if hashlib.sha256(lock_raw).hexdigest() != lock["sha256"]:
        raise ValueError("stale patch provenance lock")
    rows_by_patch = {}
    excluded_rows = {}
    additions_by_patch = {}
    for patch in proof["patches"]:
        path = patch["path"]
        if path in rows_by_patch or not path.endswith(".patch"):
            raise ValueError("duplicate or invalid provenance patch")
        raw = git("show", commit + ":" + path)
        if hashlib.sha256(raw).hexdigest() != patch["sha256"]:
            raise ValueError((path, "stale patch provenance"))
        rows_by_patch[path] = raw.splitlines(keepends=True)
        excluded_rows[path] = set()
        additions_by_patch[path] = patch_addition_rows(rows_by_patch[path])
    for match in proof["matches"]:
        path = match["patch"]
        if path not in rows_by_patch:
            raise ValueError("match references an unverified patch")
        start, count = match["patchStart"], match["lines"]
        if type(start) is not int or type(count) is not int or start < 1 or count < 1:
            raise ValueError("invalid patch provenance range")
        indices = set(range(start, start + count))
        rows = rows_by_patch[path]
        if start + count - 1 > len(rows) or indices & excluded_rows[path]:
            raise ValueError("overlapping or out-of-range patch provenance")
        selected = [rows[index - 1] for index in range(start, start + count)]
        if not indices <= additions_by_patch[path]:
            raise ValueError("patch provenance range includes a non-addition")
        content = b"".join(row[1:] for row in selected)
        if hashlib.sha256(content).hexdigest() != match["sha256"]:
            raise ValueError("patch provenance range digest mismatch")
        excluded_rows[path].update(indices)
    excluded_count = sum(len(indices) for indices in excluded_rows.values())
    if proof["provedMovedUpstreamLines"] != excluded_count:
        raise ValueError("patch provenance total mismatch")
    return excluded_rows, {
        "sha256": hashlib.sha256(raw_proof).hexdigest(),
        "excludedAddedLines": excluded_count,
        "proof": proof,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("commit")
    ap.add_argument("evidence")
    ap.add_argument("exclusions")
    ap.add_argument("--patch-provenance")
    args = ap.parse_args()
    sha = git("rev-parse", args.commit + "^{commit}").decode().strip()
    evidence = json.loads(pathlib.Path(args.evidence).read_text())
    if evidence["commit"] != sha:
        raise ValueError("invalid coverage evidence")
    exclusions = {
        x["path"]: x for x in json.loads(pathlib.Path(args.exclusions).read_text())
    }
    tree = {}
    for entry in git("ls-tree", "-r", "-z", sha).split(b"\x00"):
        if entry:
            metadata, path = entry.split(b"\t", 1)
            tree[path.decode()] = metadata.split()[0].decode()
    paths = list(tree)
    records = {}
    excluded = []
    source_totals = {}
    ignored_measured = []
    observed = {}
    for p in paths:
        extensionless = "." not in pathlib.PurePosixPath(p).name
        if not (
            p.endswith(
                (
                    ".ts",
                    ".js",
                    ".mjs",
                    ".cjs",
                    ".tsx",
                    ".jsx",
                    ".sh",
                    ".py",
                    ".html",
                    ".vue",
                    ".svelte",
                    ".mdx",
                    ".mts",
                    ".cts",
                )
            )
            or p.startswith(".githooks/")
            or tree[p] == "100755"
            or extensionless
        ):
            continue
        raw = git("show", sha + ":" + p)
        if (
            extensionless
            and tree[p] != "100755"
            and (not p.startswith(".githooks/"))
            and (not raw.startswith(b"#!"))
        ):
            continue
        digest = hashlib.sha256(raw).hexdigest()
        source_totals[p] = lines(raw.decode())
        if excluded_test(p):
            excluded.append(
                {
                    "path": p,
                    "sha256": digest,
                    "reason": "test, story, declaration, or fixture",
                }
            )
            continue
        if p in exclusions:
            e = exclusions[p]
            if e["sha256"] != digest:
                raise ValueError((p, "stale exclusion"))
            if not (e["proof"] and e["reason"]):
                raise ValueError("invalid coverage evidence")
            excluded.append(e)
            continue
        records[p] = {
            "path": p,
            "sha256": digest,
            "total": source_totals[p],
            "covered": 0,
            "kind": "unmeasured upper bound",
        }
    excluded_by_path = {item["path"]: item for item in excluded}
    for r in evidence["reports"]:
        if not (r["complete"] is True and r["provenance"]):
            raise ValueError("incomplete or unattested report")
        coverage = json.loads(pathlib.Path(r["coverage"]).read_text())
        for key, c in coverage.items():
            normalized = key.replace("\\", "/")
            marker = r["package"].rstrip("/") + "/"
            if marker in normalized:
                p = marker + normalized.split(marker, 1)[1]
            else:
                p = marker + normalized.removeprefix("./")
            if p not in records and p not in excluded_by_path:
                raise ValueError((p, "report source missing from census"))
            if p in observed:
                raise ValueError(
                    (
                        p,
                        "duplicate report: merge runs before input",
                    )
                )
            if set(c["s"]) != set(c["statementMap"]):
                raise ValueError("invalid coverage evidence")
            covered = 0
            seen_lines = set()
            for k, v in c["s"].items():
                loc = c["statementMap"][k]
                if not loc["start"]["line"] == loc["end"]["line"]:
                    raise ValueError((p, "incompatible statement-counter model"))
                if not loc["start"]["line"] not in seen_lines:
                    raise ValueError((p, "duplicate physical line counter"))
                seen_lines.add(loc["start"]["line"])
                if not 1 <= loc["start"]["line"] <= source_totals[p]:
                    raise ValueError((p, "invalid mapped source location"))
                covered += int(v > 0)
            if not len(c["s"]) <= source_totals[p]:
                raise ValueError((p, "counter count exceeds physical-line model"))
            observed[p] = True
            if p in excluded_by_path:
                exclusion = excluded_by_path[p]
                ignored_measured.append(
                    {
                        "path": p,
                        "sha256": exclusion["sha256"],
                        "reason": exclusion["reason"],
                        "observedCounters": len(c["s"]),
                        "coveredCounters": covered,
                        "sourceCounters": source_totals[p],
                    }
                )
                continue
            records[p].update(
                covered=covered,
                observedCounters=len(c["s"]),
                unobservedCounters=records[p]["total"] - len(c["s"]),
                kind="measured",
            )
    blocks = []
    embedded = []
    patch_exclusions = {}
    applied_patch_provenance = None
    if args.patch_provenance:
        patch_exclusions, applied_patch_provenance = validate_patch_provenance(
            sha, args.patch_provenance
        )
    for p in paths:
        if pathlib.PurePosixPath(p).name == "package.json":
            package = json.loads(git("show", sha + ":" + p))
            for name, body in package.get("scripts", {}).items():
                if not isinstance(body, str):
                    raise ValueError((p, "non-string package script"))
                embedded.append(
                    {
                        "path": p,
                        "script": name,
                        "total": lines(body),
                        "covered": 0,
                        "source": body,
                        "kind": "package script",
                    }
                )
        if p.endswith(".patch"):
            rows = git("show", sha + ":" + p).splitlines(keepends=True)
            additions = patch_addition_rows(rows)
            omitted = patch_exclusions.get(p, set())
            if not omitted <= additions:
                raise ValueError("provenance excludes a non-addition")
            embedded.append(
                {
                    "path": p,
                    "total": len(additions - omitted),
                    "allAddedLines": len(additions),
                    "provedUpstreamAddedLines": len(omitted),
                    "covered": 0,
                    "kind": "patch additions; all own or unresolved additions retained",
                }
            )
    for p in paths:
        if not (p.startswith(".github/workflows/") and p.endswith((".yml", ".yaml"))):
            continue
        document = yaml.safe_load(git("show", sha + ":" + p))
        for name, job in (document.get("jobs") or {}).items():
            for i, step in enumerate(job.get("steps", [])):
                if "run" not in step:
                    continue
                block = str(step["run"])
                blocks.append(
                    {
                        "workflow": p,
                        "job": name,
                        "step": i,
                        "total": lines(block),
                        "covered": 0,
                        "source": block,
                    }
                )
    covered = sum((r["covered"] for r in records.values()))
    total = (
        sum((r["total"] for r in records.values()))
        + sum((b["total"] for b in blocks))
        + sum((b["total"] for b in embedded))
    )
    packages = {}
    for p, r in records.items():
        group = (
            "/".join(p.split("/")[:2])
            if p.startswith("packages/")
            else "repository tooling/examples"
        )
        x = packages.setdefault(
            group, {"covered": 0, "total": 0, "measuredFiles": 0, "unmeasuredFiles": 0}
        )
        x["covered"] += r["covered"]
        x["total"] += r["total"]
        x["measuredFiles" if r["kind"] == "measured" else "unmeasuredFiles"] += 1
    for b in embedded + blocks:
        p = b.get("path", b.get("workflow"))
        group = (
            "/".join(p.split("/")[:2])
            if p.startswith("packages/")
            else "repository tooling/examples"
        )
        x = packages.setdefault(
            group, {"covered": 0, "total": 0, "measuredFiles": 0, "unmeasuredFiles": 0}
        )
        x["total"] += b["total"]
        x["unmeasuredTextBlocks"] = x.get("unmeasuredTextBlocks", 0) + 1
    if not sum((p["total"] for p in packages.values())) == total:
        raise ValueError("invalid coverage evidence")
    print(
        json.dumps(
            {
                "commit": sha,
                "model": (
                    "V8 physical-source-line counter model; other executable text "
                    "conservatively counted as physical lines, not AST statements"
                ),
                "covered": covered,
                "totalUpperBound": total,
                "lowerBoundPercent": covered / total * 100,
                "supports80WithinDeclaredModel": covered >= 0.8 * total,
                "packages": packages,
                "workflowRunBlocks": blocks,
                "embeddedExecutableText": embedded,
                "appliedPatchProvenance": applied_patch_provenance,
                "files": list(records.values()),
                "exclusions": excluded,
                "ignoredMeasuredSources": ignored_measured,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()

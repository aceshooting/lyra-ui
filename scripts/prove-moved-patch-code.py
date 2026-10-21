#!/usr/bin/env python3
"""Prove exact long blocks moved from locked upstream deletions.

No whitespace normalization, token matching, AST inference, or threshold-driven tuning.
All unmatched added lines remain own/unresolved and fully uncovered. Run at repo root.
"""

import argparse
import collections
import hashlib
import json
import pathlib
import re
import subprocess
import tarfile


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("commit")
    ap.add_argument("archive")
    ap.add_argument("output")
    args = ap.parse_args()

    def require(condition):
        if not condition:
            raise ValueError("Source provenance verification failed")

    sha = (
        subprocess.check_output(["git", "rev-parse", args.commit + "^{commit}"])
        .decode()
        .strip()
    )

    def blob(path):
        return subprocess.check_output(["git", "show", sha + ":" + path])

    def digest(data):
        return hashlib.sha256(data).hexdigest()

    lock_path = "packages/lyra-docs/scripts/engine-source.lock.json"
    lock_raw = blob(lock_path)
    lock = json.loads(lock_raw)
    archive = pathlib.Path(args.archive)
    archive_raw = archive.read_bytes()
    require(len(archive_raw) == lock["upstream"]["archiveBytes"])
    require(digest(archive_raw) == lock["upstream"]["archiveSha256"])
    original = {}
    with tarfile.open(archive, "r:gz") as tar:
        members = {m.name: m for m in tar.getmembers()}
        for item in lock["inputs"]:
            member = members[lock["upstream"]["archivePrefix"] + "/" + item["path"]]
            require(member.isfile())
            raw = tar.extractfile(member).read()
            require(len(raw) == item["bytes"])
            require(digest(raw) == item["sha256"])
            require(
                hashlib.sha1(
                    b"blob " + str(len(raw)).encode() + b"\0" + raw
                ).hexdigest()
                == item["gitBlobSha1"]
            )
            original[item["path"]] = raw

    prepared = dict(original)
    deletions = []
    additions = []
    patches = []
    for p in lock["patches"]:
        patch_path = "packages/lyra-docs/scripts/" + p["path"]
        patch_raw = blob(patch_path)
        require(len(patch_raw) == p["bytes"] and digest(patch_raw) == p["sha256"])
        patches.append({"path": patch_path, "sha256": digest(patch_raw)})
        rows = patch_raw.splitlines(keepends=True)
        i = 0
        while i < len(rows):
            before = rows[i]
            after = rows[i + 1]
            i += 2
            require(before.startswith(b"--- ") and after.startswith(b"+++ b/"))
            path = after[6:].decode().rstrip("\n")
            require(
                before == b"--- /dev/null\n"
                or before == ("--- a/" + path + "\n").encode()
            )
            source = prepared.get(path, b"").splitlines(keepends=True)
            result = []
            cursor = 0
            while i < len(rows) and rows[i].startswith(b"@@ "):
                h = re.fullmatch(
                    rb"@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@\n", rows[i]
                )
                i += 1
                require(h)
                start = max(0, int(h[1]) - 1)
                require(start >= cursor)
                result.extend(source[cursor:start])
                cursor = start
                require(len(result) == max(0, int(h[3]) - 1))
                removed = added = 0
                run = None
                while removed < int(h[2] or b"1") or added < int(h[4] or b"1"):
                    row = rows[i]
                    i += 1
                    require(row[:1] in (b" ", b"-", b"+"))
                    prefix = row[:1]
                    if prefix != b"+":
                        require(source[cursor] == row[1:])
                    if prefix in (b"+", b"-"):
                        if run is None or run["prefix"] != prefix:
                            run = {
                                "path": path,
                                "start": cursor + 1
                                if prefix == b"-"
                                else len(result) + 1,
                                "patch": patch_path,
                                "patchStart": i,
                                "prefix": prefix,
                                "lines": [],
                            }
                            (deletions if prefix == b"-" else additions).append(run)
                        run["lines"].append(row[1:])
                    else:
                        run = None
                    if prefix != b"+":
                        cursor += 1
                        removed += 1
                    if prefix != b"-":
                        result.append(row[1:])
                        added += 1
                require(removed == int(h[2] or b"1") and added == int(h[4] or b"1"))
            result.extend(source[cursor:])
            prepared[path] = b"".join(result)

    require(set(prepared) == {p["path"] for p in lock["prepared"]})
    for item in lock["prepared"]:
        require(len(prepared[item["path"]]) == item["bytes"])
        require(digest(prepared[item["path"]]) == item["sha256"])

    # Every deletion must itself refer to bytes in the original locked input.
    for run in deletions:
        old = original[run["path"]].splitlines(keepends=True)
        require(
            old[run["start"] - 1 : run["start"] - 1 + len(run["lines"])] == run["lines"]
        )

    # A fixed twenty-line minimum excludes only substantial verbatim moved blocks.
    # Source candidates are actual patch deletions, verified above against pinned inputs.
    minimum = 20
    index = collections.defaultdict(list)
    for d, run in enumerate(deletions):
        for offset in range(len(run["lines"]) - minimum + 1):
            index[tuple(run["lines"][offset : offset + minimum])].append((d, offset))
    matches = []
    file_totals = collections.defaultdict(lambda: {"added": 0, "provedMoved": 0})
    for run in additions:
        file_totals[run["path"]]["added"] += len(run["lines"])
        offset = 0
        while offset + minimum <= len(run["lines"]):
            choices = index.get(tuple(run["lines"][offset : offset + minimum]), [])
            best = None
            for d, start in choices:
                old = deletions[d]
                length = minimum
                while (
                    offset + length < len(run["lines"])
                    and start + length < len(old["lines"])
                    and run["lines"][offset + length] == old["lines"][start + length]
                ):
                    length += 1
                if best is None or length > best[0]:
                    best = (length, d, start)
            if best is None:
                offset += 1
                continue
            length, d, start = best
            old = deletions[d]
            matches.append(
                {
                    "destination": run["path"],
                    "destinationStart": run["start"] + offset,
                    "patch": run["patch"],
                    "patchStart": run["patchStart"] + offset,
                    "upstream": old["path"],
                    "upstreamStart": old["start"] + start,
                    "lines": length,
                    "sha256": digest(b"".join(run["lines"][offset : offset + length])),
                }
            )
            file_totals[run["path"]]["provedMoved"] += length
            offset += length

    for value in file_totals.values():
        value["ownOrUnresolvedUpperBound"] = value["added"] - value["provedMoved"]
    total = sum(v["added"] for v in file_totals.values())
    moved = sum(v["provedMoved"] for v in file_totals.values())
    out = {
        "commit": sha,
        "lock": {"path": lock_path, "sha256": digest(lock_raw)},
        "upstream": lock["upstream"],
        "patches": patches,
        "method": "Only exact contiguous blocks of at least twenty physical lines matched to actual deletions verified against hash-pinned upstream inputs. All unmatched additions count as own/unresolved, including comments, whitespace and type-only text. No normalization. No coverage credit.",
        "verifiedInputFiles": len(original),
        "verifiedPreparedFiles": len(prepared),
        "minimumMovedBlockLines": minimum,
        "addedLines": total,
        "provedMovedUpstreamLines": moved,
        "ownOrUnresolvedAddedLineUpperBound": total - moved,
        "files": dict(file_totals),
        "matches": matches,
    }
    pathlib.Path(args.output).write_text(json.dumps(out, indent=2) + "\n")
    print(
        json.dumps(
            {
                k: v
                for k, v in out.items()
                if k not in ("files", "matches", "upstream", "method")
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()

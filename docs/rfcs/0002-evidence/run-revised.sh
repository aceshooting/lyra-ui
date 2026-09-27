#!/usr/bin/env bash
# The sequence that produced the proposal's evidence (variant E). Runs sequentially; logs go to out/.
set -u
cd "$(dirname "$0")"
node parity-e.mjs > out/parity-ae.log 2>&1
node parity-modes.mjs > out/parity-modes.log 2>&1
node structure.mjs a,e > out/structure-ae.log 2>&1
R="--variants a,e --runs 5 --sizes 1000,3000"
node run.mjs $R > out/run7-mix-ae.log 2>&1
node run.mjs $R --scopes 50 > out/run8-scopes50-ae.log 2>&1
node run.mjs $R --row-scopes > out/run9-rowscopes-ae.log 2>&1
node run.mjs $R --roots > out/run10-roots-ae.log 2>&1
node run.mjs $R --roots --host-scope > out/run11-roots-hostscope-ae.log 2>&1
node late-adopt.mjs > out/late-adopt-ae.log 2>&1
for v in a e; do node probe-ssr.mjs "$v"; done > out/ssr-ae.log
node analyze-inputs.mjs > out/inputs.log 2>&1

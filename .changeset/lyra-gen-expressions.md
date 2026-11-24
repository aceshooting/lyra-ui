---
"@aceshooting/lyra-gen": minor
---

Generated nodes can declare `visible` (show only while a condition over owned state, live data or the current repeat item holds, keeping the element and its state), `checks` (conditions that must all hold, otherwise a role with `disabled` renders disabled) and `computes` (a declared property computed by a host-registered pure function from referenced values, through `lr-gen-view.functions`, defaulting to the built-in bounded registry). Conditions use a closed operator set and literal comparisons; no generated code is evaluated.

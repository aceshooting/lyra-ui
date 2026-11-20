---
'@aceshooting/lyra-ui': patch
'@aceshooting/lyra-docs': patch
---

- Every public property, attribute and method of every component now reaches `custom-elements.json`, editor hover data and the generated references with a description. Members whose meaning the platform fixes (form lifecycle callbacks, constraint validation, focus and selection passthroughs, native editing hints) share one library-wide description; everything else is documented where it is declared.
- `lr-chart`'s `config` merge contract and `lr-lite-chart`'s `layout` modes are now documented on the public members instead of being lost from the manifest.
- Member documentation states current behavior instead of comparing it with earlier releases.

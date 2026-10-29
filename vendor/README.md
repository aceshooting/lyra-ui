# Vendored development dependencies

## SheetJS Community Edition 0.20.3

`xlsx-0.20.3.tgz` is the unchanged upstream package archive, retained here so contributor and CI
installs do not depend on the availability of the SheetJS CDN. SheetJS
[recommends vendoring](https://docs.sheetjs.com/docs/getting-started/installation/frameworks/#vendoring)
for this purpose.

- Original source: <https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz>
- Package: `xlsx`, version `0.20.3`
- SHA-512 integrity:
  `sha512-oLDq3jw7AcLqKWH2AhCpVTZl8mf6X2YReP+Neh0SJUzV/BdZYjth94tG5toiMB1PPrYtxOCfaoUCkvtuH+3AJA==`
- License: Apache-2.0. The original license and attribution material remain inside the archive.

Only the library's development dependency uses this local archive. The published optional `xlsx`
peer remains a version range; applications continue to supply their own compatible installation.
The archive is not a modified fork and does not replace dependency security checks.

To refresh it, obtain the original archive from the authoritative upstream distribution, review the
version and license, and verify its bytes against the reviewed integrity before changing the
archive, development dependency, provenance here, or lockfile. Do not reconstruct the archive from
installed files. Verify a fresh frozen-lockfile installation and the spreadsheet behavior and
package-content checks before accepting an update. Preserve upstream license and attribution files.

`pnpm check:dependency-security` verifies the archive integrity, package identity, retained Apache
license, development pin, and optional peer contract. Because the package manager omits local
archive dependencies from its advisory request, this gate also queries the npm security endpoint
explicitly for `xlsx@0.20.3`. Request failures, malformed responses, and reported advisories fail
the check. The dependency upgrade script preserves this reviewed archive pin and peer floor.

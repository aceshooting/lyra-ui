---
"@aceshooting/lyra-ui": minor
---

Add `lr-transfer-manager` for application-controlled upload and download queues. Display per-transfer and overall progress, live transfer rates and estimated completion times in an application header or a collapsible floating panel. Pause, resume, cancel and retry actions report eligible transfer IDs to the application.

The new component adds registration code to the utility and full-library bundles, a tag entry to the CDN autoloader, and English messages to the shared localization bundle. The CDN autoloader's initial route measures 14,093 bytes gzip. Transfer messages across the locale catalogs bring the translations archive to 2,073,961 bytes packed and 9,121,822 bytes unpacked. Generated editor data brings the IDE archive to 1,977,010 bytes packed. The affected size limits use the next 64-byte boundary above each measurement.

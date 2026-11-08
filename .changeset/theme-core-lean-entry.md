---
"@aceshooting/lyra-ui": minor
---

New `@aceshooting/lyra-ui/theme-core.css` lean theme entry for single-look applications: `theme.css` without the built-in Shadcn, Glass and Emerald profile, resolving to the Lyra look, Solid surface and no accent (about 83 KB against 104 KB raw). `looks/*.css`, `surfaces/glass.css`, `accents.css` and `density.css` add the choices an application selects, and the composition resolves identically to `theme.css`. Development builds now also warn when a selected default-profile look, surface or accent has no stylesheet under `theme-core.css`.

import { defineConfig } from 'vite';

// Playground dev server: serves docs/ and resolves the library from ../src.
export default defineConfig({
  root: 'docs',
  server: { open: true },
});

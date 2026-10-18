import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  sourcemap: true,
  clean: true,
  // Workspace packages ship TypeScript source, so they must be bundled in.
  noExternal: ['@ais/db', '@ais/shared'],
})

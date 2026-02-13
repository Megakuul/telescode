import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  publicDir: 'src/assets',
  build: {
    target: 'node18',
    lib: {
      entry: resolve(__dirname, 'src/extension.ts'),
      name: 'telescode',
      fileName: 'extension',
      formats: ['cjs'],
    },
    rollupOptions: {
      external: ['vscode', 'path', /^node:/],
      output: {
        inlineDynamicImports: true,
      },
    },
    outDir: 'dist/extension',
  },
});

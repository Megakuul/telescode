import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/extension.ts'),
      name: 'telescode',
      fileName: 'extension',
      formats: ['cjs'],
    },
    rollupOptions: {
      external: 'vscode',
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});

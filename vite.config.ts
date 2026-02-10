import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    tailwindcss(),
    svelte({
      compilerOptions: {
        css: 'injected',
      },
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/web.ts'),
      name: 'telescode',
      fileName: 'web',
      formats: ['es'],
    },

    rollupOptions: {
      external: ['vscode'],
    },
    outDir: 'dist/web',
  },
});

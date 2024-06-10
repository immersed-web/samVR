import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import VueDevtools from 'vite-plugin-vue-devtools';
import { viteExternalsPlugin } from 'vite-plugin-externals'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag.startsWith('a-') || tag.startsWith('tc-'),
        },
      },
    }),
    VueDevtools(),
    viteExternalsPlugin({
      three: 'THREE',

    }, { useWindow: true })
  ],
  envDir: '../',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['database'],
    // include: ['schemas'],
  },
  envPrefix: 'EXPOSED_',
});

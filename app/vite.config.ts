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
        transformAssetUrls: {
          video: ['src', 'poster'],
          source: ['src'],
          img: ['src'],
          image: ['xlink:href', 'href'],
          use: ['xlink:href', 'href'],
          'a-asset-item': ['src'],
        },
      },
    }),
    VueDevtools(),
    viteExternalsPlugin({
      three: 'THREE',

    }, { useWindow: true })
  ],
  build: {
    target: 'es2022'
  },
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

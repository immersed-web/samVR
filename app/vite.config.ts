import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(
    {
      template: {
        compilerOptions: {
          // NOT WORKING: treat any tag that starts with a- as custom elements
          isCustomElement: (tag) => tag.startsWith('a-'),
        },
      },
    },
  )],
  envDir: '../',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
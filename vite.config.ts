import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isProd = mode === 'production'
  return {
    plugins: [vue(), vueDevTools()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    base: isProd ? '/schedulerMOC/' : '/',
    build: {
      outDir: isProd ? 'docs' : 'dist',
      sourcemap: !isProd,
    },
    define: {
      __APP_ENV__: JSON.stringify(mode),
    },
  }
})

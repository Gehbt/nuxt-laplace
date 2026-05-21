// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/ui', '@nuxt/test-utils', '@pinia/nuxt'],

  devtools: {
    enabled: true,
  },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    databaseUrl: '',
  },

  routeRules: {
    // '/': { prerender: true },
  },
  devServer: {
    port: 4331,
  },
  experimental: {
    typescriptPlugin: true,
  },

  compatibilityDate: '2026-05-15',
  nitro: {
    experimental: {
      websocket: true,
    },
  },
  vite: {
    optimizeDeps: {
      include: ['@vue/devtools-core', '@vue/devtools-kit'],
    },
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs',
      },
    },
  },
})
